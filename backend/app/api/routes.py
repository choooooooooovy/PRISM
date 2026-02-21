from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.models.document import DocumentModel
from app.schemas.ai import AiRunRequest, AiRunResponse, TaskRegistryRead
from app.schemas.artifacts import ArtifactPatch, ArtifactRead
from app.schemas.rag import RAGIngestRequest, RAGIngestResponse
from app.schemas.session import SessionCreate, SessionDetail, SessionRead
from app.services.openai_service import OpenAIService
from app.services.repositories import (
    create_session,
    get_session_with_data,
    upsert_artifact,
)
from app.tasks.runner import TaskRunner
from app.utils.serializers import artifact_to_dict, message_to_dict, session_to_dict
from app.utils.text import chunk_text

router = APIRouter()
runner = TaskRunner()
openai_service = OpenAIService()
settings = get_settings()


@router.get('/health')
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(text('SELECT 1'))
    return {'status': 'ok'}


@router.get('/ready')
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    checks: dict[str, str] = {'db': 'ok', 'openai': 'ok', 'tavily': 'ok'}
    try:
        await db.execute(text('SELECT 1'))
    except Exception as exc:  # noqa: BLE001
        checks['db'] = f'error: {type(exc).__name__}'
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={'status': 'not_ready', 'checks': checks},
        ) from exc

    if not settings.llm_mock_mode and not settings.openai_api_key.strip():
        checks['openai'] = 'missing_key'
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={'status': 'not_ready', 'checks': checks},
        )
    if not settings.tavily_api_key.strip():
        checks['tavily'] = 'missing_key'

    return {'status': 'ok', 'checks': checks}


@router.get('/tasks', response_model=TaskRegistryRead)
async def list_tasks() -> TaskRegistryRead:
    return TaskRegistryRead()


@router.post('/sessions', response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session_route(payload: SessionCreate, db: AsyncSession = Depends(get_db)):
    row = await create_session(
        db,
        title=payload.title,
        condition_tags=payload.condition_tags,
        metadata_json=payload.metadata_json,
    )
    return SessionRead.model_validate(session_to_dict(row))


@router.get('/sessions/{session_id}', response_model=SessionDetail)
async def get_session_route(session_id: UUID, db: AsyncSession = Depends(get_db)):
    session, artifacts, messages = await get_session_with_data(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='session not found')

    payload = session_to_dict(session)
    payload['artifacts'] = [artifact_to_dict(a) for a in artifacts]
    payload['messages'] = [message_to_dict(m) for m in messages]
    return SessionDetail.model_validate(payload)


@router.patch('/sessions/{session_id}/artifacts', response_model=ArtifactRead)
async def patch_artifact_route(
    session_id: UUID,
    payload: ArtifactPatch,
    db: AsyncSession = Depends(get_db),
):
    row = await upsert_artifact(
        db,
        session_id=session_id,
        phase=payload.phase,
        step=payload.step,
        artifact_type=payload.artifact_type,
        payload=payload.payload,
    )
    return ArtifactRead.model_validate(artifact_to_dict(row))


@router.post('/ai/run', response_model=AiRunResponse)
async def ai_run_route(payload: AiRunRequest, db: AsyncSession = Depends(get_db)):
    run_id = uuid4()
    result = await runner.run(db, payload, run_id)
    return AiRunResponse(
        session_id=payload.session_id,
        task_type=payload.task_type,
        output_json=result.output_json,
        prompt_run_id=result.prompt_run_id,
        artifact_id=result.artifact_id,
        meta={'run_id': str(run_id)},
    )


@router.post('/admin/rag/ingest', response_model=RAGIngestResponse)
async def rag_ingest_route(payload: RAGIngestRequest, db: AsyncSession = Depends(get_db)):
    inserted = 0
    source_ids: set[str] = set()

    for doc in payload.documents:
        chunks = chunk_text(doc.content, payload.chunk_size, payload.chunk_overlap)
        for idx, chunk in enumerate(chunks):
            emb = await openai_service.create_embedding(chunk)
            db.add(
                DocumentModel(
                    source_id=doc.source_id,
                    source_type=doc.source_type,
                    title=doc.title,
                    chunk_index=idx,
                    content=chunk,
                    metadata_json=doc.metadata_json,
                    embedding=emb,
                )
            )
            inserted += 1
            source_ids.add(doc.source_id)

    await db.commit()
    return RAGIngestResponse(chunks_inserted=inserted, source_ids=sorted(source_ids))
