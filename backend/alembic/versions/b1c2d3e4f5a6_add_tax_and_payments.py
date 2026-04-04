"""add tax and payments

Revision ID: b1c2d3e4f5a6
Revises: 9f3a1d7c2b44
Create Date: 2026-03-26 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "9f3a1d7c2b44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_code", sa.String(length=50), nullable=True, server_default="standard"))
        batch_op.add_column(sa.Column("tax_kind", sa.String(length=50), nullable=True, server_default="vat"))
        batch_op.add_column(sa.Column("tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    with op.batch_alter_table("quotes") as batch_op:
        batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_code", sa.String(length=50), nullable=True, server_default="standard"))
        batch_op.add_column(sa.Column("tax_kind", sa.String(length=50), nullable=True, server_default="vat"))
        batch_op.add_column(sa.Column("tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    for table_name in ("invoice_line_items", "quote_line_items"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("tax_code", sa.String(length=50), nullable=True, server_default="standard"))
            batch_op.add_column(sa.Column("tax_kind", sa.String(length=50), nullable=True, server_default="vat"))
            batch_op.add_column(sa.Column("tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_code", sa.String(length=50), nullable=True, server_default="standard"))
        batch_op.add_column(sa.Column("tax_kind", sa.String(length=50), nullable=True, server_default="vat"))
        batch_op.add_column(sa.Column("tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("vat_reclaimable", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    for table_name in ("credit_notes", "refunds"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))

    with op.batch_alter_table("credit_note_line_items") as batch_op:
        batch_op.add_column(sa.Column("net_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("tax_code", sa.String(length=50), nullable=True, server_default="standard"))
        batch_op.add_column(sa.Column("tax_kind", sa.String(length=50), nullable=True, server_default="vat"))
        batch_op.add_column(sa.Column("tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    with op.batch_alter_table("settings") as batch_op:
        batch_op.add_column(sa.Column("vat_registered", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("vat_number", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("vat_scheme", sa.String(length=50), nullable=True, server_default="standard"))
        batch_op.add_column(sa.Column("default_vat_rate", sa.Numeric(5, 2), nullable=False, server_default="20"))
        batch_op.add_column(sa.Column("vat_inclusive_default", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("vat_filing_frequency", sa.String(length=50), nullable=True, server_default="quarterly"))
        batch_op.add_column(sa.Column("vat_period_start_month", sa.Integer(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("vat_period_start_day", sa.Integer(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("vat_next_filing_due", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("vat_accounting_method", sa.String(length=50), nullable=True, server_default="accrual"))
        batch_op.add_column(sa.Column("corporation_tax_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("corporation_tax_reference", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("corporation_tax_rate", sa.Numeric(5, 2), nullable=False, server_default="25"))
        batch_op.add_column(sa.Column("corporation_tax_period_start_month", sa.Integer(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("corporation_tax_period_start_day", sa.Integer(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("corporation_tax_payment_due", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("corporation_tax_return_due", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("other_taxes", sa.JSON(), nullable=True))

    op.create_table(
        "invoice_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=False),
        sa.Column("reference", sa.String(length=200), nullable=True),
        sa.Column("method", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_payments_id"), "invoice_payments", ["id"], unique=False)

    op.create_table(
        "payment_tax_allocations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_id", sa.Integer(), nullable=False),
        sa.Column("tax_kind", sa.String(length=50), nullable=True),
        sa.Column("tax_code", sa.String(length=50), nullable=True),
        sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("net_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["invoice_payments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payment_tax_allocations_id"), "payment_tax_allocations", ["id"], unique=False)

    op.execute("UPDATE invoices SET net_amount = amount, tax_amount = 0, gross_amount = amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0")
    op.execute("UPDATE quotes SET net_amount = amount, tax_amount = 0, gross_amount = amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0")
    op.execute("UPDATE expenses SET net_amount = amount, tax_amount = 0, gross_amount = amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0, vat_reclaimable = 0")
    op.execute("UPDATE credit_notes SET net_amount = total_amount, tax_amount = 0, gross_amount = total_amount")
    op.execute("UPDATE refunds SET net_amount = amount, tax_amount = 0, gross_amount = amount")
    op.execute("UPDATE invoice_line_items SET net_amount = quantity * unit_amount, tax_amount = 0, gross_amount = quantity * unit_amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0")
    op.execute("UPDATE quote_line_items SET net_amount = quantity * unit_amount, tax_amount = 0, gross_amount = quantity * unit_amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0")
    op.execute("UPDATE credit_note_line_items SET net_amount = credited_amount, tax_amount = 0, gross_amount = credited_amount, tax_rate = 0, tax_code = 'standard', tax_kind = 'vat', tax_inclusive = 0")
    op.execute("UPDATE settings SET other_taxes = '[]' WHERE other_taxes IS NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_tax_allocations_id"), table_name="payment_tax_allocations")
    op.drop_table("payment_tax_allocations")
    op.drop_index(op.f("ix_invoice_payments_id"), table_name="invoice_payments")
    op.drop_table("invoice_payments")

    with op.batch_alter_table("settings") as batch_op:
        batch_op.drop_column("other_taxes")
        batch_op.drop_column("corporation_tax_return_due")
        batch_op.drop_column("corporation_tax_payment_due")
        batch_op.drop_column("corporation_tax_period_start_day")
        batch_op.drop_column("corporation_tax_period_start_month")
        batch_op.drop_column("corporation_tax_rate")
        batch_op.drop_column("corporation_tax_reference")
        batch_op.drop_column("corporation_tax_enabled")
        batch_op.drop_column("vat_accounting_method")
        batch_op.drop_column("vat_next_filing_due")
        batch_op.drop_column("vat_period_start_day")
        batch_op.drop_column("vat_period_start_month")
        batch_op.drop_column("vat_filing_frequency")
        batch_op.drop_column("vat_inclusive_default")
        batch_op.drop_column("default_vat_rate")
        batch_op.drop_column("vat_scheme")
        batch_op.drop_column("vat_number")
        batch_op.drop_column("vat_registered")

    with op.batch_alter_table("credit_note_line_items") as batch_op:
        batch_op.drop_column("tax_inclusive")
        batch_op.drop_column("tax_kind")
        batch_op.drop_column("tax_code")
        batch_op.drop_column("tax_rate")
        batch_op.drop_column("gross_amount")
        batch_op.drop_column("tax_amount")
        batch_op.drop_column("net_amount")

    for table_name in ("credit_notes", "refunds"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column("gross_amount")
            batch_op.drop_column("tax_amount")
            batch_op.drop_column("net_amount")

    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_column("vat_reclaimable")
        batch_op.drop_column("tax_inclusive")
        batch_op.drop_column("tax_kind")
        batch_op.drop_column("tax_code")
        batch_op.drop_column("tax_rate")
        batch_op.drop_column("gross_amount")
        batch_op.drop_column("tax_amount")
        batch_op.drop_column("net_amount")

    for table_name in ("invoice_line_items", "quote_line_items"):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column("tax_inclusive")
            batch_op.drop_column("tax_kind")
            batch_op.drop_column("tax_code")
            batch_op.drop_column("tax_rate")
            batch_op.drop_column("gross_amount")
            batch_op.drop_column("tax_amount")
            batch_op.drop_column("net_amount")

    with op.batch_alter_table("quotes") as batch_op:
        batch_op.drop_column("tax_inclusive")
        batch_op.drop_column("tax_kind")
        batch_op.drop_column("tax_code")
        batch_op.drop_column("tax_rate")
        batch_op.drop_column("gross_amount")
        batch_op.drop_column("tax_amount")
        batch_op.drop_column("net_amount")

    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_column("tax_inclusive")
        batch_op.drop_column("tax_kind")
        batch_op.drop_column("tax_code")
        batch_op.drop_column("tax_rate")
        batch_op.drop_column("gross_amount")
        batch_op.drop_column("tax_amount")
        batch_op.drop_column("net_amount")
