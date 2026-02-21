"""init tables

Revision ID: 20260220_0001
Revises:
Create Date: 2026-02-20 12:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260220_0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('condition_tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'prompt_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('task_type', sa.String(length=80), nullable=False),
        sa.Column('prompt_version', sa.String(length=40), nullable=False),
        sa.Column('model', sa.String(length=60), nullable=False),
        sa.Column('input_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('output_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_prompt_runs_session_id', 'prompt_runs', ['session_id'])
    op.create_index('ix_prompt_runs_task_type', 'prompt_runs', ['task_type'])
    op.create_index('ix_prompt_runs_created_at', 'prompt_runs', ['created_at'])

    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phase', sa.String(length=30), nullable=False),
        sa.Column('step', sa.String(length=30), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('turn_index', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_messages_session_id', 'messages', ['session_id'])
    op.create_index('ix_messages_phase', 'messages', ['phase'])
    op.create_index('ix_messages_step', 'messages', ['step'])
    op.create_index('ix_messages_role', 'messages', ['role'])

    op.create_table(
        'artifacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phase', sa.String(length=30), nullable=False),
        sa.Column('step', sa.String(length=30), nullable=False),
        sa.Column('artifact_type', sa.String(length=80), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('prompt_run_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prompt_run_id'], ['prompt_runs.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_artifacts_session_id', 'artifacts', ['session_id'])
    op.create_index('ix_artifacts_phase', 'artifacts', ['phase'])
    op.create_index('ix_artifacts_step', 'artifacts', ['step'])
    op.create_index('ix_artifacts_artifact_type', 'artifacts', ['artifact_type'])

    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source_id', sa.String(length=200), nullable=False),
        sa.Column('source_type', sa.String(length=80), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=True),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('embedding', Vector(3072), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_documents_source_id', 'documents', ['source_id'])
    op.create_index('ix_documents_source_type', 'documents', ['source_type'])

    op.create_table(
        'retrieval_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('task_type', sa.String(length=80), nullable=False),
        sa.Column('route', sa.String(length=20), nullable=False),
        sa.Column('persona_query', sa.Text(), nullable=False),
        sa.Column('transformed_query', sa.Text(), nullable=True),
        sa.Column('tavily_results_meta', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('rag_chunk_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_retrieval_logs_session_id', 'retrieval_logs', ['session_id'])
    op.create_index('ix_retrieval_logs_task_type', 'retrieval_logs', ['task_type'])
    op.create_index('ix_retrieval_logs_route', 'retrieval_logs', ['route'])


def downgrade() -> None:
    op.drop_index('ix_retrieval_logs_route', table_name='retrieval_logs')
    op.drop_index('ix_retrieval_logs_task_type', table_name='retrieval_logs')
    op.drop_index('ix_retrieval_logs_session_id', table_name='retrieval_logs')
    op.drop_table('retrieval_logs')

    op.drop_index('ix_documents_source_type', table_name='documents')
    op.drop_index('ix_documents_source_id', table_name='documents')
    op.drop_table('documents')

    op.drop_index('ix_artifacts_artifact_type', table_name='artifacts')
    op.drop_index('ix_artifacts_step', table_name='artifacts')
    op.drop_index('ix_artifacts_phase', table_name='artifacts')
    op.drop_index('ix_artifacts_session_id', table_name='artifacts')
    op.drop_table('artifacts')

    op.drop_index('ix_messages_role', table_name='messages')
    op.drop_index('ix_messages_step', table_name='messages')
    op.drop_index('ix_messages_phase', table_name='messages')
    op.drop_index('ix_messages_session_id', table_name='messages')
    op.drop_table('messages')

    op.drop_index('ix_prompt_runs_created_at', table_name='prompt_runs')
    op.drop_index('ix_prompt_runs_task_type', table_name='prompt_runs')
    op.drop_index('ix_prompt_runs_session_id', table_name='prompt_runs')
    op.drop_table('prompt_runs')

    op.drop_table('sessions')
