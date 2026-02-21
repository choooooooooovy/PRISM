import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RetrievalLogModel(Base):
    __tablename__ = 'retrieval_logs'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey('sessions.id', ondelete='SET NULL'), index=True, nullable=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True, nullable=True)
    task_type: Mapped[str] = mapped_column(String(80), index=True)
    route: Mapped[str] = mapped_column(String(20), index=True)
    persona_query: Mapped[str] = mapped_column(Text)
    transformed_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    tavily_results_meta: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    rag_chunk_ids: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
