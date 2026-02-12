from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Client(Base):
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


class Invoice(Base):
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


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
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


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="line_items")


class QuoteLineItem(Base):
    __tablename__ = "quote_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    quote_id: Mapped[int] = mapped_column(
        ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    quote: Mapped["Quote"] = relationship("Quote", back_populates="line_items")


class ServiceAgreement(Base):
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


class ServiceAgreementSLA(Base):
    __tablename__ = "agreement_slas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agreement_id: Mapped[int] = mapped_column(
        ForeignKey("service_agreements.id", ondelete="CASCADE"), nullable=False
    )
    sla: Mapped[str] = mapped_column(String(300), nullable=False)
    timescale: Mapped[str] = mapped_column(String(200), nullable=False)

    agreement: Mapped["ServiceAgreement"] = relationship("ServiceAgreement", back_populates="sla_items")


class Proposal(Base):
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


class ProposalRequirement(Base):
    __tablename__ = "proposal_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_id: Mapped[int] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="requirements")


class ProposalAttachment(Base):
    __tablename__ = "proposal_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    proposal_id: Mapped[int] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="attachments")


class ServiceAgreementVersion(Base):
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


class ProposalVersion(Base):
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


class AgreementVersionComment(Base):
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


class AgreementVersionCommentReaction(Base):
    __tablename__ = "agreement_version_comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_agreement_comment_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("agreement_version_comments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reaction: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProposalVersionComment(Base):
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


class ProposalVersionCommentReaction(Base):
    __tablename__ = "proposal_version_comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_proposal_comment_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("proposal_version_comments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reaction: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Expense(Base):
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
    incurred_date: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="expenses")
    user: Mapped["User"] = relationship("User", back_populates="expenses")
    receipts: Mapped[list["ExpenseReceipt"]] = relationship(
        "ExpenseReceipt", back_populates="expense", cascade="all, delete-orphan"
    )


class ExpenseReceipt(Base):
    __tablename__ = "expense_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    expense: Mapped["Expense"] = relationship("Expense", back_populates="receipts")


class Settings(Base):
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


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
