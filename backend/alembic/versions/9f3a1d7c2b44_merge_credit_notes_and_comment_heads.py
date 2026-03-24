"""merge credit notes and comment heads

Revision ID: 9f3a1d7c2b44
Revises: c0c27e07ad81, 4e8c6f2b1a21
Create Date: 2026-03-24 18:20:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '9f3a1d7c2b44'
down_revision = ('c0c27e07ad81', '4e8c6f2b1a21')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
