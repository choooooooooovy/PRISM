from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

from app.core.config import get_settings

_LOCK = asyncio.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _base_dir() -> Path:
    settings = get_settings()
    root = Path(settings.storage_dir)
    if not root.is_absolute():
        root = Path(__file__).resolve().parents[2] / root
    return root


def _sessions_dir() -> Path:
    return _base_dir() / 'sessions'


def _logs_dir() -> Path:
    return _base_dir() / 'logs'


def _ensure_dirs() -> None:
    _sessions_dir().mkdir(parents=True, exist_ok=True)
    _logs_dir().mkdir(parents=True, exist_ok=True)


def _session_file(session_id: UUID) -> Path:
    return _sessions_dir() / f'{session_id}.json'


def _serialize_dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    tmp_path = path.with_suffix(path.suffix + '.tmp')
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    tmp_path.replace(path)


def _write_jsonl_line(path: Path, payload: dict[str, Any]) -> None:
    with path.open('a', encoding='utf-8') as fp:
        fp.write(json.dumps(payload, ensure_ascii=False) + '\n')


def _load_session_store(session_id: UUID) -> dict[str, Any] | None:
    path = _session_file(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def _to_session_ns(raw: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        id=UUID(str(raw['id'])),
        title=raw.get('title'),
        condition_tags=raw.get('condition_tags'),
        metadata_json=raw.get('metadata_json'),
        created_at=_parse_dt(raw.get('created_at')),
        updated_at=_parse_dt(raw.get('updated_at')),
    )


def _to_artifact_ns(raw: dict[str, Any]) -> SimpleNamespace:
    prompt_run_id = raw.get('prompt_run_id')
    return SimpleNamespace(
        id=UUID(str(raw['id'])),
        session_id=UUID(str(raw['session_id'])),
        phase=raw.get('phase', ''),
        step=raw.get('step', ''),
        artifact_type=raw.get('artifact_type', ''),
        payload=raw.get('payload', {}),
        prompt_run_id=UUID(str(prompt_run_id)) if prompt_run_id else None,
        created_at=_parse_dt(raw.get('created_at')),
        updated_at=_parse_dt(raw.get('updated_at')),
    )


def _to_message_ns(raw: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        id=UUID(str(raw['id'])),
        session_id=UUID(str(raw['session_id'])),
        phase=raw.get('phase', ''),
        step=raw.get('step', ''),
        role=raw.get('role', ''),
        content=raw.get('content', ''),
        turn_index=raw.get('turn_index'),
        created_at=_parse_dt(raw.get('created_at')),
    )


def _to_prompt_run_ns(raw: dict[str, Any]) -> SimpleNamespace:
    session_id = raw.get('session_id')
    run_id = raw.get('run_id')
    return SimpleNamespace(
        id=UUID(str(raw['id'])),
        session_id=UUID(str(session_id)) if session_id else None,
        run_id=UUID(str(run_id)) if run_id else None,
        task_type=raw.get('task_type', ''),
        prompt_version=raw.get('prompt_version', ''),
        model=raw.get('model', ''),
        input_json=raw.get('input_json', {}),
        output_json=raw.get('output_json'),
        latency_ms=raw.get('latency_ms'),
        error=raw.get('error'),
        created_at=_parse_dt(raw.get('created_at')),
    )


def _sort_by_created_desc(items: list[SimpleNamespace]) -> list[SimpleNamespace]:
    return sorted(items, key=lambda x: x.created_at or _now(), reverse=True)


async def create_session(*, title: str | None, condition_tags: dict | None, metadata_json: dict | None):
    _ensure_dirs()
    session_id = uuid4()
    now = _now()
    store = {
        'session': {
            'id': str(session_id),
            'title': title,
            'condition_tags': condition_tags,
            'metadata_json': metadata_json,
            'created_at': _serialize_dt(now),
            'updated_at': _serialize_dt(now),
        },
        'artifacts': [],
        'messages': [],
    }
    async with _LOCK:
        _write_json_atomic(_session_file(session_id), store)
    return _to_session_ns(store['session'])


async def purge_conversation_data() -> None:
    _ensure_dirs()
    async with _LOCK:
        for path in _sessions_dir().glob('*.json'):
            path.unlink(missing_ok=True)


async def get_session(session_id: UUID):
    _ensure_dirs()
    async with _LOCK:
        store = _load_session_store(session_id)
    if not store:
        return None
    return _to_session_ns(store['session'])


async def get_session_with_data(session_id: UUID):
    _ensure_dirs()
    async with _LOCK:
        store = _load_session_store(session_id)
    if not store:
        return None, [], []

    session = _to_session_ns(store['session'])
    artifacts = [_to_artifact_ns(item) for item in list(store.get('artifacts') or [])]
    messages = [_to_message_ns(item) for item in list(store.get('messages') or [])]
    artifacts = _sort_by_created_desc(artifacts)
    messages = _sort_by_created_desc(messages)[:100]
    return session, artifacts, messages


async def upsert_artifact(
    *,
    session_id: UUID,
    phase: str,
    step: str,
    artifact_type: str,
    payload: dict[str, Any],
    prompt_run_id: UUID | None = None,
):
    _ensure_dirs()
    now = _now()
    async with _LOCK:
        store = _load_session_store(session_id)
        if not store:
            raise ValueError('session not found')
        items = list(store.get('artifacts') or [])
        found = None
        for item in items:
            if (
                item.get('phase') == phase
                and item.get('step') == step
                and item.get('artifact_type') == artifact_type
            ):
                found = item
                break
        if found is None:
            found = {
                'id': str(uuid4()),
                'session_id': str(session_id),
                'phase': phase,
                'step': step,
                'artifact_type': artifact_type,
                'payload': payload,
                'prompt_run_id': str(prompt_run_id) if prompt_run_id else None,
                'created_at': _serialize_dt(now),
                'updated_at': _serialize_dt(now),
            }
            items.append(found)
        else:
            found['payload'] = payload
            found['prompt_run_id'] = str(prompt_run_id) if prompt_run_id else None
            found['updated_at'] = _serialize_dt(now)
        store['artifacts'] = items
        store['session']['updated_at'] = _serialize_dt(now)
        _write_json_atomic(_session_file(session_id), store)
    return _to_artifact_ns(found)


async def list_artifacts_by_phase_step(session_id: UUID, phase: str, step: str):
    _, artifacts, _ = await get_session_with_data(session_id)
    return [a for a in artifacts if a.phase == phase and a.step == step]


async def get_latest_artifact_by_type(session_id: UUID, artifact_type: str):
    _, artifacts, _ = await get_session_with_data(session_id)
    for artifact in artifacts:
        if artifact.artifact_type == artifact_type:
            return artifact
    return None


async def create_message(
    *,
    session_id: UUID,
    phase: str,
    step: str,
    role: str,
    content: str,
    turn_index: int | None = None,
):
    _ensure_dirs()
    now = _now()
    row = {
        'id': str(uuid4()),
        'session_id': str(session_id),
        'phase': phase,
        'step': step,
        'role': role,
        'content': content,
        'turn_index': turn_index,
        'created_at': _serialize_dt(now),
    }
    async with _LOCK:
        store = _load_session_store(session_id)
        if not store:
            raise ValueError('session not found')
        messages = list(store.get('messages') or [])
        messages.append(row)
        store['messages'] = messages
        store['session']['updated_at'] = _serialize_dt(now)
        _write_json_atomic(_session_file(session_id), store)
    return _to_message_ns(row)


async def get_messages_by_step(session_id: UUID, phase: str, step: str, limit: int = 20) -> list[dict[str, str]]:
    _, _, messages = await get_session_with_data(session_id)
    filtered = [m for m in messages if m.phase == phase and m.step == step]
    filtered = sorted(filtered, key=lambda m: m.created_at or _now())
    if limit > 0:
        filtered = filtered[-limit:]
    return [{'role': str(m.role), 'content': str(m.content)} for m in filtered]


async def create_prompt_run(
    *,
    session_id: UUID | None,
    run_id: UUID | None,
    task_type: str,
    prompt_version: str,
    model: str,
    input_json: dict[str, Any],
    output_json: dict[str, Any] | None,
    latency_ms: int | None,
    error: str | None,
):
    _ensure_dirs()
    now = _now()
    row = {
        'id': str(uuid4()),
        'session_id': str(session_id) if session_id else None,
        'run_id': str(run_id) if run_id else None,
        'task_type': task_type,
        'prompt_version': prompt_version,
        'model': model,
        'input_json': input_json,
        'output_json': output_json,
        'latency_ms': latency_ms,
        'error': error,
        'created_at': _serialize_dt(now),
    }
    async with _LOCK:
        _write_jsonl_line(_logs_dir() / 'prompt_runs.jsonl', row)
    return _to_prompt_run_ns(row)


async def create_retrieval_log(
    *,
    session_id: UUID | None,
    run_id: UUID | None,
    task_type: str,
    route: str,
    persona_query: str,
    transformed_query: str | None,
    tavily_results_meta: list[dict] | None,
    rag_chunk_ids: list[str] | None,
    error: str | None = None,
):
    _ensure_dirs()
    now = _now()
    row = {
        'id': str(uuid4()),
        'session_id': str(session_id) if session_id else None,
        'run_id': str(run_id) if run_id else None,
        'task_type': task_type,
        'route': route,
        'persona_query': persona_query,
        'transformed_query': transformed_query,
        'tavily_results_meta': tavily_results_meta,
        'rag_chunk_ids': rag_chunk_ids,
        'error': error,
        'created_at': _serialize_dt(now),
    }
    async with _LOCK:
        _write_jsonl_line(_logs_dir() / 'retrieval_logs.jsonl', row)
    return SimpleNamespace(**row, created_at=_parse_dt(row['created_at']))


async def delete_artifacts_for_step(session_id: UUID, phase: str, step: str) -> None:
    _ensure_dirs()
    async with _LOCK:
        store = _load_session_store(session_id)
        if not store:
            return
        artifacts = list(store.get('artifacts') or [])
        artifacts = [a for a in artifacts if not (a.get('phase') == phase and a.get('step') == step)]
        store['artifacts'] = artifacts
        store['session']['updated_at'] = _serialize_dt(_now())
        _write_json_atomic(_session_file(session_id), store)
