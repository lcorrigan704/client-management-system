"""add agreement/proposal versioning and comments

Revision ID: 2c7f9d4f3e7a
Revises: 11f0bd851dde
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2c7f9d4f3e7a"
down_revision = "11f0bd851dde"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("service_agreements") as batch_op:
        batch_op.add_column(sa.Column("current_version", sa.Integer(), server_default="1", nullable=True))
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_service_agreements_updated_by_user",
            "users",
            ["updated_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("proposals") as batch_op:
        batch_op.add_column(sa.Column("current_version", sa.Integer(), server_default="1", nullable=True))
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_proposals_updated_by_user",
            "users",
            ["updated_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "agreement_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200)),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("sla_items_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer()),
        sa.ForeignKeyConstraint(["agreement_id"], ["service_agreements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "proposal_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("proposal_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200)),
        sa.Column("status", sa.String(length=50)),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("requirements_json", sa.Text(), nullable=False),
        sa.Column("attachments_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer()),
        sa.ForeignKeyConstraint(["proposal_id"], ["proposals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "agreement_version_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_version_id", sa.Integer(), nullable=False),
        sa.Column("field_key", sa.String(length=200), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer()),
        sa.Column("like_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("dislike_count", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["agreement_version_id"], ["agreement_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "agreement_version_comment_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["agreement_version_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_agreement_comment_user"),
    )

    op.create_table(
        "proposal_version_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("proposal_version_id", sa.Integer(), nullable=False),
        sa.Column("field_key", sa.String(length=200), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer()),
        sa.Column("like_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("dislike_count", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["proposal_version_id"], ["proposal_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "proposal_version_comment_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["proposal_version_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_proposal_comment_user"),
    )


def downgrade():
    op.drop_table("proposal_version_comment_reactions")
    op.drop_table("proposal_version_comments")
    op.drop_table("agreement_version_comment_reactions")
    op.drop_table("agreement_version_comments")
    op.drop_table("proposal_versions")
    op.drop_table("agreement_versions")

    with op.batch_alter_table("proposals") as batch_op:
        batch_op.drop_constraint("fk_proposals_updated_by_user", type_="foreignkey")
        batch_op.drop_column("updated_by_user_id")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("current_version")

    with op.batch_alter_table("service_agreements") as batch_op:
        batch_op.drop_constraint("fk_service_agreements_updated_by_user", type_="foreignkey")
        batch_op.drop_column("updated_by_user_id")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("current_version")
