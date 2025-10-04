"""Add video records and gait analysis tables

Revision ID: adb7ee20c2cd
Revises: 
Create Date: 2025-09-23 01:39:34.078546

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'adb7ee20c2cd'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
    op.add_column('video_records', sa.Column('description', sa.Text(), nullable=True))

    op.add_column('video_records', sa.Column('tags', sa.Text(), nullable=True))
    op.add_column('video_records', sa.Column('subject_id', sa.String(length=100), nullable=True))
    # Add is_deleted column with default value for existing records
    op.add_column('video_records', sa.Column('is_deleted', sa.Boolean(), nullable=True))
    op.execute("UPDATE video_records SET is_deleted = false WHERE is_deleted IS NULL")
    op.alter_column('video_records', 'is_deleted', nullable=False)
    op.add_column('video_records', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('video_records', sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_video_records_deleted_by'), 'video_records', ['deleted_by'], unique=False)
    op.create_index(op.f('ix_video_records_is_deleted'), 'video_records', ['is_deleted'], unique=False)
   


def downgrade() -> None:
    op.drop_index(op.f('ix_video_records_is_deleted'), table_name='video_records')
    op.drop_index(op.f('ix_video_records_deleted_by'), table_name='video_records')
    op.drop_column('video_records', 'deleted_by')
    op.drop_column('video_records', 'deleted_at')
    op.drop_column('video_records', 'is_deleted')
    op.drop_column('video_records', 'subject_id')
    op.drop_column('video_records', 'tags')
    op.drop_column('video_records', 'description')
    op.add_column('users', sa.Column('totp_secret', sa.VARCHAR(length=32), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.BOOLEAN(), autoincrement=False, nullable=False))
  