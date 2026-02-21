from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


class SessionCreate(APIModel):
    title: str | None = None
    condition_tags: dict | None = None
    metadata_json: dict | None = None


class SessionRead(APIModel):
    id: UUID
    title: str | None = None
    condition_tags: dict | None = None
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime | None = None


class SessionDetail(SessionRead):
    artifacts: list[dict] = Field(default_factory=list)
    messages: list[dict] = Field(default_factory=list)
