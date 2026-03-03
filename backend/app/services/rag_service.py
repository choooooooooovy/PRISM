from __future__ import annotations

import math
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import DocumentModel
from app.services.openai_service import OpenAIService
from app.services.tavily_service import TavilyService

DYNAMIC_HINTS = (
    '최신',
    '트렌드',
    '뉴스',
    '최근',
    '채용',
    '공고',
    '시장',
    'salary 202',
)


class RAGService:
    def __init__(self, openai_service: OpenAIService, tavily_service: TavilyService) -> None:
        self.settings = get_settings()
        self.openai_service = openai_service
        self.tavily_service = tavily_service

    def route_query(self, persona_query: str) -> str:
        lowered = persona_query.lower()
        if any(token in lowered for token in DYNAMIC_HINTS):
            return 'dynamic'
        return 'static'

    def transform_query(self, persona_query: str, persona: dict[str, Any]) -> str:
        trait_pairs = [
            ('핵심 가치', persona.get('core_career_values')),
            ('도전 성향', persona.get('risk_challenge_orientation')),
            ('정보처리 방식', persona.get('information_processing_style')),
            ('주도성', persona.get('proactive_agency')),
        ]
        trait_line = ' | '.join(f'{label}: {value}' for label, value in trait_pairs if value)
        return f"{persona_query}\n페르소나 관점: {persona.get('display_name')}\n{trait_line}".strip()

    async def retrieve_static(
        self,
        db: AsyncSession,
        query: str,
        top_k: int | None = None,
        exclude_ids: set[str] | None = None,
    ) -> tuple[list[dict], list[str]]:
        top_k = top_k or self.settings.rag_top_k
        emb = await self.openai_service.create_embedding(query)

        distance = DocumentModel.embedding.cosine_distance(emb).label('distance')
        stmt = select(DocumentModel, distance).order_by(distance).limit(max(top_k * 3, top_k))
        rows = (await db.execute(stmt)).all()

        chunks: list[dict] = []
        ids: list[str] = []
        excluded_uuid_ids: set[UUID] = set()
        for raw in exclude_ids or set():
            try:
                excluded_uuid_ids.add(UUID(str(raw)))
            except Exception:  # noqa: BLE001
                continue
        for doc, dist in rows:
            if excluded_uuid_ids and doc.id in excluded_uuid_ids:
                continue
            dist_value = float(dist) if dist is not None else None
            if dist_value is not None and not math.isfinite(dist_value):
                dist_value = None
            ids.append(str(doc.id))
            chunks.append(
                {
                    'id': str(doc.id),
                    'source_id': doc.source_id,
                    'title': doc.title,
                    'content': doc.content,
                    'distance': dist_value,
                }
            )
            if len(chunks) >= top_k:
                break
        return chunks, ids

    def retrieve_dynamic(self, query: str, top_k: int | None = None) -> list[dict]:
        return self.tavily_service.search(query, max_results=top_k or self.settings.rag_top_k)
