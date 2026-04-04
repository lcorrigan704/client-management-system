"""add vat tax workspace fields

Revision ID: f4a1c9e7d2b3
Revises: e3b7f2c9a1d4
Create Date: 2026-04-04 17:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f4a1c9e7d2b3"
down_revision = "e3b7f2c9a1d4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("settings") as batch_op:
        batch_op.add_column(sa.Column("vat_registration_date", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("utr", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("company_number", sa.String(length=50), nullable=True))
        batch_op.add_column(
            sa.Column("business_tax_mode", sa.String(length=50), nullable=False, server_default="limited_company")
        )
        batch_op.add_column(
            sa.Column("default_vat_code", sa.String(length=50), nullable=True, server_default="standard")
        )
        batch_op.add_column(
            sa.Column("tax_estimate_basis", sa.String(length=50), nullable=False, server_default="accrual")
        )
        batch_op.add_column(sa.Column("tax_policy_effective_date", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("tax_policy_last_reviewed", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("tax_policy_next_review_due", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("tax_policy_review_notes", sa.Text(), nullable=True))

    with op.batch_alter_table("invoice_line_items") as batch_op:
        batch_op.add_column(
            sa.Column("tax_override", sa.Boolean(), nullable=False, server_default=sa.text("0"))
        )

    with op.batch_alter_table("quote_line_items") as batch_op:
        batch_op.add_column(
            sa.Column("tax_override", sa.Boolean(), nullable=False, server_default=sa.text("0"))
        )

    op.create_table(
        "tax_rate_catalogs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year", sa.String(length=20), nullable=False),
        sa.Column("version_label", sa.String(length=100), nullable=False),
        sa.Column("source_label", sa.String(length=200), nullable=False),
        sa.Column("effective_date", sa.DateTime(), nullable=True),
        sa.Column("vat_rates", sa.JSON(), nullable=False),
        sa.Column("direct_tax_rates", sa.JSON(), nullable=False),
        sa.Column("assumptions", sa.JSON(), nullable=False),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tax_rate_catalogs_id"), "tax_rate_catalogs", ["id"], unique=False)
    op.create_index(op.f("ix_tax_rate_catalogs_tax_year"), "tax_rate_catalogs", ["tax_year"], unique=False)
    op.create_index(op.f("ix_tax_rate_catalogs_is_active"), "tax_rate_catalogs", ["is_active"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_tax_rate_catalogs_is_active"), table_name="tax_rate_catalogs")
    op.drop_index(op.f("ix_tax_rate_catalogs_tax_year"), table_name="tax_rate_catalogs")
    op.drop_index(op.f("ix_tax_rate_catalogs_id"), table_name="tax_rate_catalogs")
    op.drop_table("tax_rate_catalogs")

    with op.batch_alter_table("quote_line_items") as batch_op:
        batch_op.drop_column("tax_override")

    with op.batch_alter_table("invoice_line_items") as batch_op:
        batch_op.drop_column("tax_override")

    with op.batch_alter_table("settings") as batch_op:
        batch_op.drop_column("tax_policy_review_notes")
        batch_op.drop_column("tax_policy_next_review_due")
        batch_op.drop_column("tax_policy_last_reviewed")
        batch_op.drop_column("tax_policy_effective_date")
        batch_op.drop_column("tax_estimate_basis")
        batch_op.drop_column("default_vat_code")
        batch_op.drop_column("business_tax_mode")
        batch_op.drop_column("company_number")
        batch_op.drop_column("utr")
        batch_op.drop_column("vat_registration_date")
