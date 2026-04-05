from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from .db import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="workspace_memberships")


class WorkspaceScoped:
    @declared_attr
    def workspace_id(cls):  # noqa: N805
        return mapped_column(
            ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
        )


class Client(WorkspaceScoped, Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    company: Mapped[str | None] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(300))
    invoice_email: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="client", cascade="all, delete-orphan"
    )
    quotes: Mapped[list["Quote"]] = relationship(
        "Quote", back_populates="client", cascade="all, delete-orphan"
    )
    agreements: Mapped[list["ServiceAgreement"]] = relationship(
        "ServiceAgreement", back_populates="client", cascade="all, delete-orphan"
    )
    proposals: Mapped[list["Proposal"]] = relationship(
        "Proposal", back_populates="client", cascade="all, delete-orphan"
    )
    expenses: Mapped[list["Expense"]] = relationship(
        "Expense", back_populates="client", cascade="all, delete-orphan"
    )


class Invoice(WorkspaceScoped, Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    quote_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[datetime | None] = mapped_column(DateTime)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text())

    client: Mapped["Client"] = relationship("Client", back_populates="invoices")
    quote: Mapped["Quote"] = relationship("Quote", back_populates="invoices")
    line_items: Mapped[list["InvoiceLineItem"]] = relationship(
        "InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    credit_notes: Mapped[list["CreditNote"]] = relationship(
        "CreditNote", back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        "InvoicePayment", back_populates="invoice", cascade="all, delete-orphan"
    )


class Quote(WorkspaceScoped, Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text())

    client: Mapped["Client"] = relationship("Client", back_populates="quotes")
    line_items: Mapped[list["QuoteLineItem"]] = relationship(
        "QuoteLineItem", back_populates="quote", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="quote"
    )
    agreements: Mapped[list["ServiceAgreement"]] = relationship(
        "ServiceAgreement", back_populates="quote"
    )


class InvoiceLineItem(WorkspaceScoped, Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_override: Mapped[bool] = mapped_column(Boolean, default=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="line_items")
    credit_note_line_items: Mapped[list["CreditNoteLineItem"]] = relationship(
        "CreditNoteLineItem", back_populates="invoice_line_item"
    )


class CreditNote(WorkspaceScoped, Base):
    __tablename__ = "credit_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[str | None] = mapped_column(Text())
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="credit_notes")
    line_items: Mapped[list["CreditNoteLineItem"]] = relationship(
        "CreditNoteLineItem", back_populates="credit_note", cascade="all, delete-orphan"
    )
    refunds: Mapped[list["Refund"]] = relationship(
        "Refund", back_populates="credit_note", cascade="all, delete-orphan"
    )


class CreditNoteLineItem(WorkspaceScoped, Base):
    __tablename__ = "credit_note_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    credit_note_id: Mapped[int] = mapped_column(
        ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False
    )
    invoice_line_item_id: Mapped[int] = mapped_column(
        ForeignKey("invoice_line_items.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    source_unit_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    credited_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    credited_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    credit_note: Mapped["CreditNote"] = relationship("CreditNote", back_populates="line_items")
    invoice_line_item: Mapped["InvoiceLineItem"] = relationship(
        "InvoiceLineItem", back_populates="credit_note_line_items"
    )


class Refund(WorkspaceScoped, Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    credit_note_id: Mapped[int] = mapped_column(
        ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    refunded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    credit_note: Mapped["CreditNote"] = relationship("CreditNote", back_populates="refunds")
    client: Mapped["Client"] = relationship("Client")
    invoice: Mapped["Invoice"] = relationship("Invoice")


class QuoteLineItem(WorkspaceScoped, Base):
    __tablename__ = "quote_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    quote_id: Mapped[int] = mapped_column(
        ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_override: Mapped[bool] = mapped_column(Boolean, default=False)

    quote: Mapped["Quote"] = relationship("Quote", back_populates="line_items")


class ServiceAgreement(WorkspaceScoped, Base):
    __tablename__ = "service_agreements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    quote_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text())
    content: Mapped[str | None] = mapped_column(Text())
    document_url: Mapped[str | None] = mapped_column(String(500))
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    scope_of_services: Mapped[str | None] = mapped_column(Text())
    duration: Mapped[str | None] = mapped_column(Text())
    availability: Mapped[str | None] = mapped_column(Text())
    meetings: Mapped[str | None] = mapped_column(Text())
    access_requirements: Mapped[str | None] = mapped_column(Text())
    fees_payments: Mapped[str | None] = mapped_column(Text())
    data_protection: Mapped[str | None] = mapped_column(Text())
    termination: Mapped[str | None] = mapped_column(Text())
    company_signatory_name: Mapped[str | None] = mapped_column(String(200))
    company_signatory_title: Mapped[str | None] = mapped_column(String(200))
    company_signed_date: Mapped[datetime | None] = mapped_column(DateTime)
    client_signatory_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    client: Mapped["Client"] = relationship("Client", back_populates="agreements")
    quote: Mapped["Quote"] = relationship("Quote", back_populates="agreements")
    sla_items: Mapped[list["ServiceAgreementSLA"]] = relationship(
        "ServiceAgreementSLA", back_populates="agreement", cascade="all, delete-orphan"
    )
    versions: Mapped[list["ServiceAgreementVersion"]] = relationship(
        "ServiceAgreementVersion", back_populates="agreement", cascade="all, delete-orphan"
    )
    updated_by: Mapped["User"] = relationship("User", foreign_keys=[updated_by_user_id])

    @property
    def updated_by_email(self) -> str | None:
        return self.updated_by.email if self.updated_by else None


class ServiceAgreementSLA(WorkspaceScoped, Base):
    __tablename__ = "agreement_slas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agreement_id: Mapped[int] = mapped_column(
        ForeignKey("service_agreements.id", ondelete="CASCADE"), nullable=False
    )
    sla: Mapped[str] = mapped_column(String(300), nullable=False)
    timescale: Mapped[str] = mapped_column(String(200), nullable=False)

    agreement: Mapped["ServiceAgreement"] = relationship("ServiceAgreement", back_populates="sla_items")


class Proposal(WorkspaceScoped, Base):
    __tablename__ = "proposals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    quote_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    submitted_on: Mapped[datetime | None] = mapped_column(DateTime)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    summary: Mapped[str | None] = mapped_column(Text())
    approach: Mapped[str | None] = mapped_column(Text())
    timeline: Mapped[str | None] = mapped_column(Text())
    content: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    client: Mapped["Client"] = relationship("Client", back_populates="proposals")
    quote: Mapped["Quote"] = relationship("Quote")
    requirements: Mapped[list["ProposalRequirement"]] = relationship(
        "ProposalRequirement", back_populates="proposal", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["ProposalAttachment"]] = relationship(
        "ProposalAttachment", back_populates="proposal", cascade="all, delete-orphan"
    )
    versions: Mapped[list["ProposalVersion"]] = relationship(
        "ProposalVersion", back_populates="proposal", cascade="all, delete-orphan"
    )
    updated_by: Mapped["User"] = relationship("User", foreign_keys=[updated_by_user_id])

    @property
    def updated_by_email(self) -> str | None:
        return self.updated_by.email if self.updated_by else None


class ProposalRequirement(WorkspaceScoped, Base):
    __tablename__ = "proposal_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_id: Mapped[int] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="requirements")


class ProposalAttachment(WorkspaceScoped, Base):
    __tablename__ = "proposal_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_id: Mapped[int] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="attachments")


class ServiceAgreementVersion(WorkspaceScoped, Base):
    __tablename__ = "agreement_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agreement_id: Mapped[int] = mapped_column(
        ForeignKey("service_agreements.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    data_json: Mapped[str] = mapped_column(Text(), nullable=False)
    sla_items_json: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    agreement: Mapped["ServiceAgreement"] = relationship("ServiceAgreement", back_populates="versions")
    created_by: Mapped["User"] = relationship("User")

    @property
    def created_by_email(self) -> str | None:
        return self.created_by.email if self.created_by else None


class ProposalVersion(WorkspaceScoped, Base):
    __tablename__ = "proposal_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_id: Mapped[int] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str | None] = mapped_column(String(50))
    data_json: Mapped[str] = mapped_column(Text(), nullable=False)
    requirements_json: Mapped[str] = mapped_column(Text(), nullable=False)
    attachments_json: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="versions")
    created_by: Mapped["User"] = relationship("User")

    @property
    def created_by_email(self) -> str | None:
        return self.created_by.email if self.created_by else None


class AgreementVersionComment(WorkspaceScoped, Base):
    __tablename__ = "agreement_version_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agreement_version_id: Mapped[int] = mapped_column(
        ForeignKey("agreement_versions.id", ondelete="CASCADE"), nullable=False
    )
    field_key: Mapped[str] = mapped_column(String(200), nullable=False)
    comment: Mapped[str] = mapped_column(Text(), nullable=False)
    mentions: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    implemented: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0)

    version: Mapped["ServiceAgreementVersion"] = relationship("ServiceAgreementVersion")
    created_by: Mapped["User"] = relationship("User")

    @property
    def created_by_email(self) -> str | None:
        return self.created_by.email if self.created_by else None

    @property
    def version_number(self) -> int | None:
        return self.version.version_number if self.version else None

    @property
    def is_current(self) -> bool:
        return bool(self.version.is_current) if self.version else False


class AgreementVersionCommentReaction(WorkspaceScoped, Base):
    __tablename__ = "agreement_version_comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_agreement_comment_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("agreement_version_comments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reaction: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProposalVersionComment(WorkspaceScoped, Base):
    __tablename__ = "proposal_version_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_version_id: Mapped[int] = mapped_column(
        ForeignKey("proposal_versions.id", ondelete="CASCADE"), nullable=False
    )
    field_key: Mapped[str] = mapped_column(String(200), nullable=False)
    comment: Mapped[str] = mapped_column(Text(), nullable=False)
    mentions: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    implemented: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0)

    version: Mapped["ProposalVersion"] = relationship("ProposalVersion")
    created_by: Mapped["User"] = relationship("User")

    @property
    def created_by_email(self) -> str | None:
        return self.created_by.email if self.created_by else None

    @property
    def version_number(self) -> int | None:
        return self.version.version_number if self.version else None

    @property
    def is_current(self) -> bool:
        return bool(self.version.is_current) if self.version else False


class ProposalVersionCommentReaction(WorkspaceScoped, Base):
    __tablename__ = "proposal_version_comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_proposal_comment_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("proposal_version_comments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reaction: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Expense(WorkspaceScoped, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    vat_reclaimable: Mapped[bool] = mapped_column(Boolean, default=False)
    incurred_date: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="expenses")
    user: Mapped["User"] = relationship("User", back_populates="expenses")
    receipts: Mapped[list["ExpenseReceipt"]] = relationship(
        "ExpenseReceipt", back_populates="expense", cascade="all, delete-orphan"
    )


class ExpenseReceipt(WorkspaceScoped, Base):
    __tablename__ = "expense_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    expense: Mapped["Expense"] = relationship("Expense", back_populates="receipts")


class EmailLog(WorkspaceScoped, Base):
    __tablename__ = "email_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_label: Mapped[str] = mapped_column(String(200), nullable=False)
    to_email: Mapped[str | None] = mapped_column(String(300))
    subject: Mapped[str] = mapped_column(Text(), nullable=False)
    body: Mapped[str] = mapped_column(Text(), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="sent", index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="compose")
    entity_refs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    attachment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    send_message: Mapped[str | None] = mapped_column(Text())
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    client: Mapped["Client"] = relationship("Client")
    created_by: Mapped["User"] = relationship("User")


class InvoicePayment(WorkspaceScoped, Base):
    __tablename__ = "invoice_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reference: Mapped[str | None] = mapped_column(String(200))
    method: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
    tax_allocations: Mapped[list["PaymentTaxAllocation"]] = relationship(
        "PaymentTaxAllocation", back_populates="payment", cascade="all, delete-orphan"
    )


class PaymentTaxAllocation(WorkspaceScoped, Base):
    __tablename__ = "payment_tax_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("invoice_payments.id", ondelete="CASCADE"), nullable=False
    )
    tax_kind: Mapped[str | None] = mapped_column(String(50), default="vat")
    tax_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    payment: Mapped["InvoicePayment"] = relationship("InvoicePayment", back_populates="tax_allocations")


class Settings(WorkspaceScoped, Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(200), default="Your Company")
    company_address: Mapped[str | None] = mapped_column(String(300))
    company_invoice_email: Mapped[str | None] = mapped_column(String(200))
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV")
    quote_prefix: Mapped[str] = mapped_column(String(20), default="QUOTE")
    proposal_prefix: Mapped[str] = mapped_column(String(20), default="PROP")
    agreement_prefix: Mapped[str] = mapped_column(String(20), default="AGR")
    expense_prefix: Mapped[str] = mapped_column(String(20), default="EXP")
    credit_note_prefix: Mapped[str] = mapped_column(String(20), default="CN")
    refund_prefix: Mapped[str] = mapped_column(String(20), default="RF")

    fy_start_month: Mapped[int] = mapped_column(Integer, default=1)
    fy_start_day: Mapped[int] = mapped_column(Integer, default=1)
    fy_end_month: Mapped[int] = mapped_column(Integer, default=12)
    fy_end_day: Mapped[int] = mapped_column(Integer, default=31)

    accounts_due_month: Mapped[int] = mapped_column(Integer, default=10)
    accounts_due_day: Mapped[int] = mapped_column(Integer, default=31)

    confirmation_date_month: Mapped[int] = mapped_column(Integer, default=1)
    confirmation_date_day: Mapped[int] = mapped_column(Integer, default=27)
    confirmation_due_month: Mapped[int] = mapped_column(Integer, default=2)
    confirmation_due_day: Mapped[int] = mapped_column(Integer, default=10)

    smtp_host: Mapped[str | None] = mapped_column(String(200))
    smtp_port: Mapped[int | None] = mapped_column(Integer)
    smtp_username: Mapped[str | None] = mapped_column(String(200))
    smtp_password: Mapped[str | None] = mapped_column(String(200))
    smtp_from: Mapped[str | None] = mapped_column(String(200))
    smtp_use_tls: Mapped[bool | None] = mapped_column(Integer)

    bank_name: Mapped[str | None] = mapped_column(String(200))
    bank_account_name: Mapped[str | None] = mapped_column(String(200))
    bank_account_number: Mapped[str | None] = mapped_column(String(50))
    bank_sort_code: Mapped[str | None] = mapped_column(String(50))
    bank_iban: Mapped[str | None] = mapped_column(String(100))
    bank_swift: Mapped[str | None] = mapped_column(String(100))
    bank_reference: Mapped[str | None] = mapped_column(String(200))
    vat_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    vat_registration_date: Mapped[datetime | None] = mapped_column(DateTime)
    vat_number: Mapped[str | None] = mapped_column(String(100))
    utr: Mapped[str | None] = mapped_column(String(100))
    company_number: Mapped[str | None] = mapped_column(String(50))
    business_tax_mode: Mapped[str] = mapped_column(String(50), default="limited_company")
    vat_scheme: Mapped[str | None] = mapped_column(String(50), default="standard")
    default_vat_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20)
    default_vat_code: Mapped[str | None] = mapped_column(String(50), default="standard")
    vat_inclusive_default: Mapped[bool] = mapped_column(Boolean, default=False)
    vat_filing_frequency: Mapped[str | None] = mapped_column(String(50), default="quarterly")
    vat_period_start_month: Mapped[int] = mapped_column(Integer, default=1)
    vat_period_start_day: Mapped[int] = mapped_column(Integer, default=1)
    vat_next_filing_due: Mapped[datetime | None] = mapped_column(DateTime)
    vat_accounting_method: Mapped[str | None] = mapped_column(String(50), default="accrual")
    corporation_tax_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    corporation_tax_reference: Mapped[str | None] = mapped_column(String(100))
    corporation_tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=25)
    corporation_tax_period_start_month: Mapped[int] = mapped_column(Integer, default=1)
    corporation_tax_period_start_day: Mapped[int] = mapped_column(Integer, default=1)
    corporation_tax_payment_due: Mapped[datetime | None] = mapped_column(DateTime)
    corporation_tax_return_due: Mapped[datetime | None] = mapped_column(DateTime)
    tax_estimate_basis: Mapped[str] = mapped_column(String(50), default="accrual")
    tax_policy_effective_date: Mapped[datetime | None] = mapped_column(DateTime)
    tax_policy_last_reviewed: Mapped[datetime | None] = mapped_column(DateTime)
    tax_policy_next_review_due: Mapped[datetime | None] = mapped_column(DateTime)
    tax_policy_review_notes: Mapped[str | None] = mapped_column(Text())
    other_taxes: Mapped[list[dict] | None] = mapped_column(JSON, default=list)


class TaxRateCatalog(WorkspaceScoped, Base):
    __tablename__ = "tax_rate_catalogs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tax_year: Mapped[str] = mapped_column(String(20), nullable=False, default="2025-26", index=True)
    version_label: Mapped[str] = mapped_column(String(100), nullable=False, default="HMRC baseline")
    source_label: Mapped[str] = mapped_column(String(200), nullable=False, default="HMRC guidance")
    effective_date: Mapped[datetime | None] = mapped_column(DateTime)
    vat_rates: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    direct_tax_rates: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    assumptions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    review_notes: Mapped[str | None] = mapped_column(Text())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    bank_account_name: Mapped[str | None] = mapped_column(String(200))
    bank_account_number: Mapped[str | None] = mapped_column(String(50))
    bank_sort_code: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["UserSession"]] = relationship("UserSession", back_populates="user")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="user")
    workspace_memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    active_workspace_id: Mapped[int | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    active_workspace: Mapped["Workspace"] = relationship("Workspace")
