from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


def _blank_to_none(value):
    if value == "":
        return None
    return value


class ClientBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    contact_phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    invoice_email: Optional[EmailStr] = None
    address: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    contact_phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    invoice_email: Optional[EmailStr] = None
    address: Optional[str] = None


class ClientOut(ClientBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    title: str
    amount: float
    status: Optional[str] = "draft"
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    quote_id: Optional[int] = None


class LineItemBase(BaseModel):
    description: str
    quantity: float
    unit_amount: float


class LineItemOut(LineItemBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(InvoiceBase):
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    line_items: Optional[list[LineItemBase]] = None
    recurrence_enabled: Optional[bool] = None
    recurrence_frequency: Optional[str] = None
    recurrence_count: Optional[int] = None
    recurrence_day_of_month: Optional[int] = None
    due_rule_unit: Optional[str] = None
    due_rule_value: Optional[int] = None
    send_now: Optional[bool] = None


class InvoiceUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    quote_id: Optional[int] = None
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    line_items: Optional[list[LineItemBase]] = None


class InvoiceOut(InvoiceBase):
    id: int
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    client_id: int
    quote_id: Optional[int] = None
    issued_at: datetime
    paid_at: Optional[datetime] = None
    line_items: list[LineItemOut] = []
    model_config = ConfigDict(from_attributes=True)


class QuoteBase(BaseModel):
    title: str
    amount: float
    status: Optional[str] = "draft"
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None


class QuoteCreate(QuoteBase):
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    line_items: Optional[list[LineItemBase]] = None


class QuoteUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    line_items: Optional[list[LineItemBase]] = None


class QuoteOut(QuoteBase):
    id: int
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    client_id: int
    issued_at: datetime
    line_items: list[LineItemOut] = []
    model_config = ConfigDict(from_attributes=True)


class AgreementBase(BaseModel):
    title: str
    quote_id: Optional[int] = None
    display_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    scope_of_services: Optional[str] = None
    duration: Optional[str] = None
    availability: Optional[str] = None
    meetings: Optional[str] = None
    access_requirements: Optional[str] = None
    fees_payments: Optional[str] = None
    data_protection: Optional[str] = None
    termination: Optional[str] = None
    company_signatory_name: Optional[str] = None
    company_signatory_title: Optional[str] = None
    company_signed_date: Optional[datetime] = None
    client_signatory_name: Optional[str] = None
    summary: Optional[str] = None
    document_url: Optional[str] = None
    content: Optional[str] = None
    sla_items: Optional[list["AgreementSLAItem"]] = None

    _normalize_display_id = field_validator("display_id", mode="before")(_blank_to_none)


class AgreementSLAItem(BaseModel):
    sla: str
    timescale: str


class AgreementSLAOut(AgreementSLAItem):
    id: int
    model_config = ConfigDict(from_attributes=True)


class AgreementCreate(AgreementBase):
    pass


class AgreementUpdate(BaseModel):
    title: Optional[str] = None
    quote_id: Optional[int] = None
    display_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    scope_of_services: Optional[str] = None
    duration: Optional[str] = None
    availability: Optional[str] = None
    meetings: Optional[str] = None
    access_requirements: Optional[str] = None
    fees_payments: Optional[str] = None
    data_protection: Optional[str] = None
    termination: Optional[str] = None
    company_signatory_name: Optional[str] = None
    company_signatory_title: Optional[str] = None
    company_signed_date: Optional[datetime] = None
    client_signatory_name: Optional[str] = None
    summary: Optional[str] = None
    document_url: Optional[str] = None
    content: Optional[str] = None
    sla_items: Optional[list[AgreementSLAItem]] = None

    _normalize_display_id = field_validator("display_id", mode="before")(_blank_to_none)


class AgreementOut(AgreementBase):
    id: int
    client_id: int
    created_at: datetime
    current_version: Optional[int] = None
    updated_at: Optional[datetime] = None
    updated_by_email: Optional[str] = None
    sla_items: list[AgreementSLAOut] = []
    model_config = ConfigDict(from_attributes=True)


class AgreementVersionOut(BaseModel):
    id: int
    agreement_id: int
    version_number: int
    title: Optional[str] = None
    created_at: datetime
    created_by_email: Optional[str] = None
    is_current: bool = False

    model_config = ConfigDict(from_attributes=True)


class AgreementCommentCreate(BaseModel):
    field_key: str
    comment: str
    mentions: list[str] | None = None


class CommentStatusUpdate(BaseModel):
    implemented: bool


class AgreementCommentOut(BaseModel):
    id: int
    agreement_version_id: Optional[int] = None
    field_key: str
    comment: str
    mentions: list[str] | None = None
    implemented: bool = False
    version_number: Optional[int] = None
    is_current: bool = False
    created_at: datetime
    created_by_email: Optional[str] = None
    like_count: int
    dislike_count: int

    model_config = ConfigDict(from_attributes=True)


class ProposalBase(BaseModel):
    title: str
    status: Optional[str] = "draft"
    quote_id: Optional[int] = None
    display_id: Optional[str] = None
    submitted_on: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    summary: Optional[str] = None
    approach: Optional[str] = None
    timeline: Optional[str] = None
    content: Optional[str] = None
    requirements: Optional[list["ProposalRequirementItem"]] = None
    attachments: Optional[list["ProposalAttachmentItem"]] = None

    _normalize_display_id = field_validator("display_id", mode="before")(_blank_to_none)


class ProposalRequirementItem(BaseModel):
    description: str


class ProposalRequirementOut(ProposalRequirementItem):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProposalAttachmentItem(BaseModel):
    filename: str
    file_path: str


class ProposalAttachmentOut(ProposalAttachmentItem):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProposalCreate(ProposalBase):
    pass


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    quote_id: Optional[int] = None
    display_id: Optional[str] = None
    submitted_on: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    summary: Optional[str] = None
    approach: Optional[str] = None
    timeline: Optional[str] = None
    content: Optional[str] = None
    requirements: Optional[list[ProposalRequirementItem]] = None
    attachments: Optional[list[ProposalAttachmentItem]] = None

    _normalize_display_id = field_validator("display_id", mode="before")(_blank_to_none)


class ProposalOut(ProposalBase):
    id: int
    client_id: int
    created_at: datetime
    current_version: Optional[int] = None
    updated_at: Optional[datetime] = None
    updated_by_email: Optional[str] = None
    requirements: list[ProposalRequirementOut] = []
    attachments: list[ProposalAttachmentOut] = []
    model_config = ConfigDict(from_attributes=True)


class ProposalVersionOut(BaseModel):
    id: int
    proposal_id: int
    version_number: int
    title: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime
    created_by_email: Optional[str] = None
    is_current: bool = False

    model_config = ConfigDict(from_attributes=True)


class ProposalCommentCreate(BaseModel):
    field_key: str
    comment: str
    mentions: list[str] | None = None


class ProposalCommentOut(BaseModel):
    id: int
    proposal_version_id: Optional[int] = None
    field_key: str
    comment: str
    mentions: list[str] | None = None
    implemented: bool = False
    version_number: Optional[int] = None
    is_current: bool = False
    created_at: datetime
    created_by_email: Optional[str] = None
    like_count: int
    dislike_count: int

    model_config = ConfigDict(from_attributes=True)


class CommentReactionRequest(BaseModel):
    reaction: Literal["like", "dislike"]


class UserSearchOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: str

    model_config = ConfigDict(from_attributes=True)


class ExpenseBase(BaseModel):
    title: str
    amount: float
    incurred_date: Optional[datetime] = None
    notes: Optional[str] = None
    user_id: Optional[int] = None


class ExpenseReceiptItem(BaseModel):
    filename: str
    file_path: str


class ExpenseReceiptOut(ExpenseReceiptItem):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ExpenseCreate(ExpenseBase):
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    receipts: Optional[list[ExpenseReceiptItem]] = None


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    incurred_date: Optional[datetime] = None
    notes: Optional[str] = None
    client_id: Optional[int] = None
    user_id: Optional[int] = None
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    receipts: Optional[list[ExpenseReceiptItem]] = None


class ExpenseOut(ExpenseBase):
    id: int
    display_id: Optional[str] = None
    is_legacy: Optional[bool] = None
    client_id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: datetime
    receipts: list[ExpenseReceiptOut] = []
    model_config = ConfigDict(from_attributes=True)


class EmailDraftRequest(BaseModel):
    entity_type: str
    entity_id: int
    to_email: Optional[EmailStr] = None
    send: bool = False

    @field_validator("to_email", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if value == "":
            return None
        return value


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthSetupRequest(BaseModel):
    owner_email: EmailStr
    password: str
    company_name: str
    company_address: str | None = None
    company_invoice_email: EmailStr | None = None
    invoice_prefix: str | None = None
    quote_prefix: str | None = None
    proposal_prefix: str | None = None
    agreement_prefix: str | None = None
    expense_prefix: str | None = None
    fy_start_month: int | None = None
    fy_start_day: int | None = None
    fy_end_month: int | None = None
    fy_end_day: int | None = None
    accounts_due_month: int | None = None
    accounts_due_day: int | None = None
    confirmation_date_month: int | None = None
    confirmation_date_day: int | None = None
    confirmation_due_month: int | None = None
    confirmation_due_day: int | None = None
    bank_name: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_sort_code: str | None = None
    bank_iban: str | None = None
    bank_swift: str | None = None
    bank_reference: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool | None = None


class UserBase(BaseModel):
    email: EmailStr
    role: str = "user"
    is_active: bool = True
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_sort_code: str | None = None


class UserOut(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuthStatus(BaseModel):
    needs_setup: bool
    user: Optional[UserOut] = None


class EmailDraftResponse(BaseModel):
    subject: str
    body: str
    sent: bool
    message: str
    pdf_base64: Optional[str] = None
    pdf_filename: Optional[str] = None


class BackupRequest(BaseModel):
    download: bool = True
    store: bool = True


class RestoreRequest(BaseModel):
    filename: str


class SettingsBase(BaseModel):
    company_name: str
    company_address: Optional[str] = None
    company_invoice_email: Optional[str] = None
    invoice_prefix: str
    quote_prefix: str
    proposal_prefix: str
    agreement_prefix: str
    expense_prefix: str
    fy_start_month: int
    fy_start_day: int
    fy_end_month: int
    fy_end_day: int
    accounts_due_month: int
    accounts_due_day: int
    confirmation_date_month: int
    confirmation_date_day: int
    confirmation_due_month: int
    confirmation_due_day: int
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    bank_name: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_reference: Optional[str] = None


class SettingsOut(SettingsBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SettingsUpdate(BaseModel):
    company_name: str | None = None
    company_address: str | None = None
    company_invoice_email: str | None = None
    invoice_prefix: str | None = None
    quote_prefix: str | None = None
    proposal_prefix: str | None = None
    agreement_prefix: str | None = None
    expense_prefix: str | None = None
    fy_start_month: int | None = None
    fy_start_day: int | None = None
    fy_end_month: int | None = None
    fy_end_day: int | None = None
    accounts_due_month: int | None = None
    accounts_due_day: int | None = None
    confirmation_date_month: int | None = None
    confirmation_date_day: int | None = None
    confirmation_due_month: int | None = None
    confirmation_due_day: int | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool | None = None
    bank_name: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_sort_code: str | None = None
    bank_iban: str | None = None
    bank_swift: str | None = None
    bank_reference: str | None = None
