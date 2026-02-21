from pydantic import Field

from app.schemas.common import APIModel


class IngestDocument(APIModel):
    source_id: str
    source_type: str
    title: str | None = None
    content: str
    metadata_json: dict | None = None


class RAGIngestRequest(APIModel):
    documents: list[IngestDocument] = Field(min_length=1)
    chunk_size: int = 700
    chunk_overlap: int = 100


class RAGIngestResponse(APIModel):
    chunks_inserted: int
    source_ids: list[str]
