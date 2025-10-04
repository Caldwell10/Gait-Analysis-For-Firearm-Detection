"""Add OAuth fields to User model

Revision ID: b3f9a1c4d5e6
Revises: 5c258263c971
Create Date: 2025-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3f9a1c4d5e6'
down_revision = '5c258263c971'
branch_labels = None
depends_on = None


def upgrade():
    # Add OAuth provider field
    op.add_column('users', sa.Column('oauth_provider', sa.String(length=50), nullable=True))

    # Add OAuth ID field
    op.add_column('users', sa.Column('oauth_id', sa.String(length=255), nullable=True))

    # Create index on oauth_id for fast lookups
    op.create_index('ix_users_oauth_id', 'users', ['oauth_id'], unique=False)

    # Make password_hash nullable (OAuth users won't have passwords)
    op.alter_column('users', 'password_hash',
                    existing_type=sa.String(length=255),
                    nullable=True)


def downgrade():
    # Remove index
    op.drop_index('ix_users_oauth_id', table_name='users')

    # Remove OAuth columns
    op.drop_column('users', 'oauth_id')
    op.drop_column('users', 'oauth_provider')

    # Make password_hash non-nullable again
    op.alter_column('users', 'password_hash',
                    existing_type=sa.String(length=255),
                    nullable=False)
