"""add run_id correlation and retrieval error fields

Revision ID: 20260220_0002
Revises: 20260220_0001
Create Date: 2026-02-20 15:20:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260220_0002'
down_revision: Union[str, Sequence[str], None] = '20260220_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('prompt_runs', sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_prompt_runs_run_id', 'prompt_runs', ['run_id'])

    op.add_column('retrieval_logs', sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('retrieval_logs', sa.Column('error', sa.Text(), nullable=True))
    op.create_index('ix_retrieval_logs_run_id', 'retrieval_logs', ['run_id'])


def downgrade() -> None:
    op.drop_index('ix_retrieval_logs_run_id', table_name='retrieval_logs')
    op.drop_column('retrieval_logs', 'error')
    op.drop_column('retrieval_logs', 'run_id')

    op.drop_index('ix_prompt_runs_run_id', table_name='prompt_runs')
    op.drop_column('prompt_runs', 'run_id')
