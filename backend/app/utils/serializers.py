from app.models import ArtifactModel, MessageModel, PromptRunModel, SessionModel


def session_to_dict(item: SessionModel) -> dict:
    return {
        'id': item.id,
        'title': item.title,
        'condition_tags': item.condition_tags,
        'metadata_json': item.metadata_json,
        'created_at': item.created_at,
        'updated_at': item.updated_at,
    }


def message_to_dict(item: MessageModel) -> dict:
    return {
        'id': item.id,
        'session_id': item.session_id,
        'phase': item.phase,
        'step': item.step,
        'role': item.role,
        'content': item.content,
        'turn_index': item.turn_index,
        'created_at': item.created_at,
    }


def artifact_to_dict(item: ArtifactModel) -> dict:
    return {
        'id': item.id,
        'session_id': item.session_id,
        'phase': item.phase,
        'step': item.step,
        'artifact_type': item.artifact_type,
        'payload': item.payload,
        'prompt_run_id': item.prompt_run_id,
        'created_at': item.created_at,
        'updated_at': item.updated_at,
    }


def prompt_run_to_dict(item: PromptRunModel) -> dict:
    return {
        'id': item.id,
        'session_id': item.session_id,
        'task_type': item.task_type,
        'prompt_version': item.prompt_version,
        'model': item.model,
        'input_json': item.input_json,
        'output_json': item.output_json,
        'latency_ms': item.latency_ms,
        'error': item.error,
        'created_at': item.created_at,
    }
