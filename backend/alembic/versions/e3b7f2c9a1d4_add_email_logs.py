"""add email logs

Revision ID: e3b7f2c9a1d4
Revises: b1c2d3e4f5a6
Create Date: 2026-04-04 13:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e3b7f2c9a1d4"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "email_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("client_label", sa.String(length=200), nullable=False),
        sa.Column("to_email", sa.String(length=300), nullable=True),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("entity_refs", sa.JSON(), nullable=False),
        sa.Column("attachment_count", sa.Integer(), nullable=False),
        sa.Column("send_message", sa.Text(), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_logs_id"), "email_logs", ["id"], unique=False)
    op.create_index(op.f("ix_email_logs_group_id"), "email_logs", ["group_id"], unique=False)
    op.create_index(op.f("ix_email_logs_client_id"), "email_logs", ["client_id"], unique=False)
    op.create_index(op.f("ix_email_logs_status"), "email_logs", ["status"], unique=False)
    op.create_index(op.f("ix_email_logs_created_at"), "email_logs", ["created_at"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_email_logs_created_at"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_status"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_client_id"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_group_id"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_id"), table_name="email_logs")
    op.drop_table("email_logs")
