"""add_credit_notes_and_refunds

Revision ID: 4e8c6f2b1a21
Revises: 6d6127209dab
Create Date: 2026-03-24 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '4e8c6f2b1a21'
down_revision = '6d6127209dab'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('settings', sa.Column('credit_note_prefix', sa.String(length=20), nullable=True))
    op.add_column('settings', sa.Column('refund_prefix', sa.String(length=20), nullable=True))
    op.execute("UPDATE settings SET credit_note_prefix = 'CN' WHERE credit_note_prefix IS NULL")
    op.execute("UPDATE settings SET refund_prefix = 'RF' WHERE refund_prefix IS NULL")
    with op.batch_alter_table('settings') as batch_op:
        batch_op.alter_column('credit_note_prefix', existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column('refund_prefix', existing_type=sa.String(length=20), nullable=False)

    op.create_table(
        'credit_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('display_id', sa.String(length=30), nullable=True),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('issued_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_notes_id'), 'credit_notes', ['id'], unique=False)
    op.create_index(op.f('ix_credit_notes_display_id'), 'credit_notes', ['display_id'], unique=True)

    op.create_table(
        'credit_note_line_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('credit_note_id', sa.Integer(), nullable=False),
        sa.Column('invoice_line_item_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(length=300), nullable=False),
        sa.Column('source_unit_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('credited_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('credited_amount', sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(['credit_note_id'], ['credit_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invoice_line_item_id'], ['invoice_line_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_note_line_items_id'), 'credit_note_line_items', ['id'], unique=False)

    op.create_table(
        'refunds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('display_id', sa.String(length=30), nullable=True),
        sa.Column('credit_note_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('refunded_at', sa.DateTime(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['credit_note_id'], ['credit_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refunds_id'), 'refunds', ['id'], unique=False)
    op.create_index(op.f('ix_refunds_display_id'), 'refunds', ['display_id'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_refunds_display_id'), table_name='refunds')
    op.drop_index(op.f('ix_refunds_id'), table_name='refunds')
    op.drop_table('refunds')

    op.drop_index(op.f('ix_credit_note_line_items_id'), table_name='credit_note_line_items')
    op.drop_table('credit_note_line_items')

    op.drop_index(op.f('ix_credit_notes_display_id'), table_name='credit_notes')
    op.drop_index(op.f('ix_credit_notes_id'), table_name='credit_notes')
    op.drop_table('credit_notes')

    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('refund_prefix')
        batch_op.drop_column('credit_note_prefix')
