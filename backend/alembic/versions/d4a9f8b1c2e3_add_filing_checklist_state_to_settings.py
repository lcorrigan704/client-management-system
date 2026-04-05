"""add filing checklist state to settings

Revision ID: d4a9f8b1c2e3
Revises: a7c3d1f9b2aa
Create Date: 2026-04-05 12:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4a9f8b1c2e3"
down_revision: Union[str, None] = "a7c3d1f9b2aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "filing_checklist_state",
                sa.JSON(),
                nullable=True,
                server_default=sa.text("'{}'"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.drop_column("filing_checklist_state")
