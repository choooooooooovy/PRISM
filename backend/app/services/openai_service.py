from __future__ import annotations

import json
import time
from typing import Any, Callable, TypeVar
from uuid import UUID

from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.repositories import create_prompt_run

T = TypeVar('T', bound=BaseModel)


class OpenAIService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = AsyncOpenAI(
            api_key=self.settings.openai_api_key or None,
            timeout=self.settings.openai_timeout_sec,
        )

    async def create_embedding(self, text: str) -> list[float]:
        if self.settings.llm_mock_mode or not self.settings.openai_api_key:
            return [0.0] * self.settings.embedding_dimensions

        response = await self.client.embeddings.create(
            model=self.settings.openai_embedding_model,
            input=text,
        )
        emb = list(response.data[0].embedding)
        if len(emb) < self.settings.embedding_dimensions:
            emb.extend([0.0] * (self.settings.embedding_dimensions - len(emb)))
        elif len(emb) > self.settings.embedding_dimensions:
            emb = emb[: self.settings.embedding_dimensions]
        return emb

    async def run_structured(
        self,
        *,
        db: AsyncSession | None,
        session_id: UUID | None,
        task_type: str,
        run_id: UUID | None,
        prompt_version: str,
        output_model: type[T],
        system_prompt: str,
        input_json: dict[str, Any],
        mock_output_factory: Callable[[], dict[str, Any]],
        model_override: str | None = None,
        timeout_sec: float | None = None,
    ) -> tuple[T, Any]:
        model_name = model_override or self.settings.openai_model
        schema = self._to_strict_json_schema(output_model.model_json_schema())

        errors: list[str] = []
        for attempt in range(2):
            started = time.perf_counter()
            output_json: dict[str, Any] | None = None
            error: str | None = None

            try:
                if self.settings.llm_mock_mode or not self.settings.openai_api_key:
                    output_json = mock_output_factory()
                else:
                    client = self.client.with_options(timeout=timeout_sec) if timeout_sec else self.client
                    response = await client.responses.create(
                        model=model_name,
                        input=[
                            {
                                'role': 'system',
                                'content': [{'type': 'input_text', 'text': system_prompt}],
                            },
                            {
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'input_text',
                                        'text': json.dumps(input_json, ensure_ascii=False),
                                    }
                                ],
                            },
                        ],
                        text={
                            'format': {
                                'type': 'json_schema',
                                'name': f'{task_type}_output',
                                'schema': schema,
                                'strict': True,
                            }
                        },
                    )
                    output_json = self._extract_response_json(response)

                parsed = output_model.model_validate(output_json)

                latency_ms = int((time.perf_counter() - started) * 1000)
                prompt_run = await create_prompt_run(
                    db,
                    session_id=session_id,
                    run_id=run_id,
                    task_type=task_type,
                    prompt_version=prompt_version,
                    model=model_name,
                    input_json=input_json,
                    output_json=parsed.model_dump(mode='json', by_alias=True),
                    latency_ms=latency_ms,
                    error=None,
                )
                return parsed, prompt_run
            except Exception as exc:  # noqa: BLE001
                error = f'{type(exc).__name__}: {exc}'
                errors.append(error)
                latency_ms = int((time.perf_counter() - started) * 1000)
                await create_prompt_run(
                    db,
                    session_id=session_id,
                    run_id=run_id,
                    task_type=task_type,
                    prompt_version=prompt_version,
                    model=model_name,
                    input_json=input_json,
                    output_json=output_json,
                    latency_ms=latency_ms,
                    error=error,
                )
                if attempt == 0 and not self._is_non_retryable_error(exc):
                    system_prompt = (
                        system_prompt
                        + '\n\nIMPORTANT: Return valid JSON matching schema exactly. No prose.'
                    )
                else:
                    raise RuntimeError('; '.join(errors)) from exc

        raise RuntimeError('unreachable')

    @classmethod
    def _to_strict_json_schema(cls, schema: dict[str, Any]) -> dict[str, Any]:
        sanitized = json.loads(json.dumps(schema))
        cls._normalize_schema_node(sanitized)
        return sanitized

    @classmethod
    def _normalize_schema_node(cls, node: Any) -> None:
        if isinstance(node, dict):
            node.pop('default', None)

            props = node.get('properties')
            if isinstance(props, dict):
                node['required'] = list(props.keys())
                node['additionalProperties'] = False
                for value in props.values():
                    cls._normalize_schema_node(value)

            items = node.get('items')
            if items is not None:
                cls._normalize_schema_node(items)

            for key in ('anyOf', 'allOf', 'oneOf'):
                branch = node.get(key)
                if isinstance(branch, list):
                    for item in branch:
                        cls._normalize_schema_node(item)

            defs = node.get('$defs')
            if isinstance(defs, dict):
                for value in defs.values():
                    cls._normalize_schema_node(value)
            return

        if isinstance(node, list):
            for item in node:
                cls._normalize_schema_node(item)

    @staticmethod
    def _extract_response_json(response: Any) -> dict[str, Any]:
        output_text = getattr(response, 'output_text', None)
        if output_text:
            return json.loads(output_text)

        output = getattr(response, 'output', None) or []
        for item in output:
            for content in getattr(item, 'content', []) or []:
                if getattr(content, 'type', '') in {'output_text', 'text'}:
                    txt = getattr(content, 'text', None)
                    if txt:
                        return json.loads(txt)

        raise ValueError('No JSON output returned from OpenAI Responses API')

    @staticmethod
    def _is_non_retryable_error(exc: Exception) -> bool:
        lowered = str(exc).lower()
        return any(
            token in lowered
            for token in (
                'insufficient_quota',
                'invalid_api_key',
                'authenticationerror',
                'permissiondeniederror',
            )
        )
