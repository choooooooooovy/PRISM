from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel
from app.tasks.registry import TASK_TYPES, TaskType


class AiRunRequest(APIModel):
    session_id: UUID
    task_type: TaskType
    input_json: dict = Field(default_factory=dict)
    prompt_version: str = 'v1'
    store_artifact: bool = True
    model_override: str | None = None


class PromptRunRead(APIModel):
    id: UUID
    session_id: UUID | None = None
    run_id: UUID | None = None
    task_type: str
    prompt_version: str
    model: str
    input_json: dict
    output_json: dict | None = None
    latency_ms: int | None = None
    error: str | None = None
    created_at: datetime


class AiRunResponse(APIModel):
    session_id: UUID
    task_type: str
    output_json: dict
    prompt_run_id: UUID
    artifact_id: UUID | None = None
    meta: dict = Field(default_factory=dict)


class TaskRegistryRead(APIModel):
    task_types: list[str] = Field(default_factory=lambda: list(TASK_TYPES))
