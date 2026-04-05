"""add workspaces multitenancy

Revision ID: a7c3d1f9b2aa
Revises: f4a1c9e7d2b3
Create Date: 2026-04-04 18:10:00.000000
"""

from __future__ import annotations

from datetime import datetime
import re

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "a7c3d1f9b2aa"
down_revision = "f4a1c9e7d2b3"
branch_labels = None
depends_on = None


WORKSPACE_TABLES = [
    "clients",
    "invoices",
    "quotes",
    "invoice_line_items",
    "quote_line_items",
    "credit_notes",
    "credit_note_line_items",
    "refunds",
    "service_agreements",
    "agreement_slas",
    "agreement_versions",
    "agreement_version_comments",
    "agreement_version_comment_reactions",
    "proposals",
    "proposal_requirements",
    "proposal_attachments",
    "proposal_versions",
    "proposal_version_comments",
    "proposal_version_comment_reactions",
    "expenses",
    "expense_receipts",
    "settings",
    "tax_rate_catalogs",
    "email_logs",
    "invoice_payments",
    "payment_tax_allocations",
]


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return slug or "workspace"


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_workspaces_id", "workspaces", ["id"])
    op.create_index("ix_workspaces_slug", "workspaces", ["slug"], unique=True)

    op.create_table(
        "workspace_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),
    )
    op.create_index("ix_workspace_memberships_id", "workspace_memberships", ["id"])
    op.create_index("ix_workspace_memberships_workspace_id", "workspace_memberships", ["workspace_id"])
    op.create_index("ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"])

    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.add_column(sa.Column("active_workspace_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_user_sessions_active_workspace_id", ["active_workspace_id"])
        batch_op.create_foreign_key(
            "fk_user_sessions_active_workspace_id",
            "workspaces",
            ["active_workspace_id"],
            ["id"],
            ondelete="SET NULL",
        )

    for table_name in WORKSPACE_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("workspace_id", sa.Integer(), nullable=True))
            batch_op.create_index(f"ix_{table_name}_workspace_id", ["workspace_id"])
            batch_op.create_foreign_key(
                f"fk_{table_name}_workspace_id",
                "workspaces",
                ["workspace_id"],
                ["id"],
                ondelete="CASCADE",
            )

    workspace_name = bind.execute(
        text("SELECT company_name FROM settings ORDER BY id LIMIT 1")
    ).scalar() or "Primary Workspace"
    slug_base = _slugify(workspace_name)
    slug = slug_base
    suffix = 2
    while bind.execute(text("SELECT id FROM workspaces WHERE slug = :slug"), {"slug": slug}).scalar():
        slug = f"{slug_base}-{suffix}"
        suffix += 1

    bind.execute(
        text(
            """
            INSERT INTO workspaces (name, slug, is_active, metadata_json, created_at, updated_at)
            VALUES (:name, :slug, 1, :metadata_json, :created_at, :updated_at)
            """
        ),
        {
            "name": workspace_name,
            "slug": slug,
            "metadata_json": "{}",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        },
    )
    workspace_id = bind.execute(
        text("SELECT id FROM workspaces WHERE slug = :slug"),
        {"slug": slug},
    ).scalar()

    for table_name in WORKSPACE_TABLES:
        bind.execute(
            text(f"UPDATE {table_name} SET workspace_id = :workspace_id WHERE workspace_id IS NULL"),
            {"workspace_id": workspace_id},
        )

    bind.execute(
        text(
            """
            INSERT INTO workspace_memberships (workspace_id, user_id, role, is_default, is_active, created_at, updated_at)
            SELECT :workspace_id, users.id, users.role, 1, users.is_active, :created_at, :updated_at
            FROM users
            """
        ),
        {"workspace_id": workspace_id, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()},
    )
    bind.execute(
        text(
            """
            UPDATE user_sessions
            SET active_workspace_id = :workspace_id
            WHERE active_workspace_id IS NULL
            """
        ),
        {"workspace_id": workspace_id},
    )

    for table_name in WORKSPACE_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column("workspace_id", nullable=False)

    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_invoices_workspace_match_insert
        BEFORE INSERT ON invoices
        FOR EACH ROW
        WHEN NEW.client_id IS NOT NULL AND
             (SELECT workspace_id FROM clients WHERE id = NEW.client_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: invoices.client_id');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_invoices_workspace_match_update
        BEFORE UPDATE ON invoices
        FOR EACH ROW
        WHEN NEW.client_id IS NOT NULL AND
             (SELECT workspace_id FROM clients WHERE id = NEW.client_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: invoices.client_id');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_invoice_line_items_workspace_match_insert
        BEFORE INSERT ON invoice_line_items
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM invoices WHERE id = NEW.invoice_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: invoice_line_items.invoice_id');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_quote_line_items_workspace_match_insert
        BEFORE INSERT ON quote_line_items
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM quotes WHERE id = NEW.quote_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: quote_line_items.quote_id');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_credit_notes_workspace_match_insert
        BEFORE INSERT ON credit_notes
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM invoices WHERE id = NEW.invoice_id) != NEW.workspace_id
           OR (SELECT workspace_id FROM clients WHERE id = NEW.client_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: credit_notes');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_credit_note_line_items_workspace_match_insert
        BEFORE INSERT ON credit_note_line_items
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM credit_notes WHERE id = NEW.credit_note_id) != NEW.workspace_id
           OR (SELECT workspace_id FROM invoice_line_items WHERE id = NEW.invoice_line_item_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: credit_note_line_items');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_refunds_workspace_match_insert
        BEFORE INSERT ON refunds
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM credit_notes WHERE id = NEW.credit_note_id) != NEW.workspace_id
           OR (SELECT workspace_id FROM invoices WHERE id = NEW.invoice_id) != NEW.workspace_id
           OR (SELECT workspace_id FROM clients WHERE id = NEW.client_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: refunds');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_expenses_workspace_match_insert
        BEFORE INSERT ON expenses
        FOR EACH ROW
        WHEN NEW.client_id IS NOT NULL AND
             (SELECT workspace_id FROM clients WHERE id = NEW.client_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: expenses.client_id');
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_invoice_payments_workspace_match_insert
        BEFORE INSERT ON invoice_payments
        FOR EACH ROW
        WHEN (SELECT workspace_id FROM invoices WHERE id = NEW.invoice_id) != NEW.workspace_id
        BEGIN
            SELECT RAISE(ABORT, 'workspace mismatch: invoice_payments.invoice_id');
        END;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_invoice_payments_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_expenses_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_refunds_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_credit_note_line_items_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_credit_notes_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_quote_line_items_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_invoice_line_items_workspace_match_insert")
    op.execute("DROP TRIGGER IF EXISTS trg_invoices_workspace_match_update")
    op.execute("DROP TRIGGER IF EXISTS trg_invoices_workspace_match_insert")

    for table_name in WORKSPACE_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_constraint(f"fk_{table_name}_workspace_id", type_="foreignkey")
            batch_op.drop_index(f"ix_{table_name}_workspace_id")
            batch_op.drop_column("workspace_id")

    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.drop_constraint("fk_user_sessions_active_workspace_id", type_="foreignkey")
        batch_op.drop_index("ix_user_sessions_active_workspace_id")
        batch_op.drop_column("active_workspace_id")

    op.drop_index("ix_workspace_memberships_user_id", table_name="workspace_memberships")
    op.drop_index("ix_workspace_memberships_workspace_id", table_name="workspace_memberships")
    op.drop_index("ix_workspace_memberships_id", table_name="workspace_memberships")
    op.drop_table("workspace_memberships")

    op.drop_index("ix_workspaces_slug", table_name="workspaces")
    op.drop_index("ix_workspaces_id", table_name="workspaces")
    op.drop_table("workspaces")
