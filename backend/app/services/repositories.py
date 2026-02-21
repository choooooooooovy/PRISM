from __future__ import annotations

import math
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ArtifactModel,
    MessageModel,
    PromptRunModel,
    RetrievalLogModel,
    SessionModel,
)


def _sanitize_json(value: Any) -> Any:
    if isinstance(value, float):
        if math.isfinite(value):
            return value
        return None
    if isinstance(value, dict):
        return {str(k): _sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    if isinstance(value, tuple):
        return [_sanitize_json(v) for v in value]
    return value


async def create_session(
    db: AsyncSession,
    *,
    title: str | None,
    condition_tags: dict | None,
    metadata_json: dict | None,
) -> SessionModel:
    item = SessionModel(title=title, condition_tags=condition_tags, metadata_json=metadata_json)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_session(db: AsyncSession, session_id: UUID) -> SessionModel | None:
    return await db.get(SessionModel, session_id)


async def get_session_with_data(db: AsyncSession, session_id: UUID) -> tuple[SessionModel | None, list, list]:
    session = await get_session(db, session_id)
    if not session:
        return None, [], []

    artifacts_q = (
        select(ArtifactModel)
        .where(ArtifactModel.session_id == session_id)
        .order_by(ArtifactModel.created_at.desc())
    )
    messages_q = (
        select(MessageModel)
        .where(MessageModel.session_id == session_id)
        .order_by(MessageModel.created_at.desc())
        .limit(100)
    )
    artifacts = list((await db.execute(artifacts_q)).scalars().all())
    messages = list((await db.execute(messages_q)).scalars().all())
    return session, artifacts, messages


async def upsert_artifact(
    db: AsyncSession,
    *,
    session_id: UUID,
    phase: str,
    step: str,
    artifact_type: str,
    payload: dict[str, Any],
    prompt_run_id: UUID | None = None,
) -> ArtifactModel:
    q = select(ArtifactModel).where(
        ArtifactModel.session_id == session_id,
        ArtifactModel.phase == phase,
        ArtifactModel.step == step,
        ArtifactModel.artifact_type == artifact_type,
    )
    existing = (await db.execute(q)).scalar_one_or_none()

    if existing:
        existing.payload = payload
        existing.prompt_run_id = prompt_run_id
        item = existing
    else:
        item = ArtifactModel(
            session_id=session_id,
            phase=phase,
            step=step,
            artifact_type=artifact_type,
            payload=payload,
            prompt_run_id=prompt_run_id,
        )
        db.add(item)

    await db.commit()
    await db.refresh(item)
    return item


async def list_artifacts_by_phase_step(
    db: AsyncSession, session_id: UUID, phase: str, step: str
) -> list[ArtifactModel]:
    q = (
        select(ArtifactModel)
        .where(
            ArtifactModel.session_id == session_id,
            ArtifactModel.phase == phase,
            ArtifactModel.step == step,
        )
        .order_by(ArtifactModel.created_at.desc())
    )
    return list((await db.execute(q)).scalars().all())


async def get_latest_artifact_by_type(
    db: AsyncSession, session_id: UUID, artifact_type: str
) -> ArtifactModel | None:
    q = (
        select(ArtifactModel)
        .where(ArtifactModel.session_id == session_id, ArtifactModel.artifact_type == artifact_type)
        .order_by(ArtifactModel.created_at.desc())
        .limit(1)
    )
    return (await db.execute(q)).scalar_one_or_none()


async def create_message(
    db: AsyncSession,
    *,
    session_id: UUID,
    phase: str,
    step: str,
    role: str,
    content: str,
    turn_index: int | None = None,
) -> MessageModel:
    row = MessageModel(
        session_id=session_id,
        phase=phase,
        step=step,
        role=role,
        content=content,
        turn_index=turn_index,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def create_prompt_run(
    db: AsyncSession,
    *,
    session_id: UUID | None,
    run_id: UUID | None,
    task_type: str,
    prompt_version: str,
    model: str,
    input_json: dict,
    output_json: dict | None,
    latency_ms: int | None,
    error: str | None,
) -> PromptRunModel:
    row = PromptRunModel(
        session_id=session_id,
        run_id=run_id,
        task_type=task_type,
        prompt_version=prompt_version,
        model=model,
        input_json=_sanitize_json(input_json),
        output_json=_sanitize_json(output_json),
        latency_ms=latency_ms,
        error=error,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def create_retrieval_log(
    db: AsyncSession,
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
) -> RetrievalLogModel:
    row = RetrievalLogModel(
        session_id=session_id,
        run_id=run_id,
        task_type=task_type,
        route=route,
        persona_query=persona_query,
        transformed_query=transformed_query,
        tavily_results_meta=_sanitize_json(tavily_results_meta),
        rag_chunk_ids=_sanitize_json(rag_chunk_ids),
        error=error,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_artifacts_for_step(db: AsyncSession, session_id: UUID, phase: str, step: str) -> None:
    await db.execute(
        delete(ArtifactModel).where(
            ArtifactModel.session_id == session_id,
            ArtifactModel.phase == phase,
            ArtifactModel.step == step,
        )
    )
    await db.commit()
