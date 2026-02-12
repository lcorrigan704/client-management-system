from datetime import datetime, timedelta
import json

from sqlalchemy.orm import Session

from . import models, schemas
from .security import encrypt_secret, hash_password


def build_display_id(prefix: str, numeric_id: int) -> str:
    return f"{prefix}-{numeric_id + 999}"


def ensure_display_id_unique(db: Session, model, display_id: str, exclude_id: int | None = None):
    if not display_id:
        return
    query = db.query(model).filter(model.display_id == display_id)
    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)
    if query.first():
        raise ValueError("Display ID already exists.")


def get_or_create_settings(db: Session) -> models.Settings:
    settings = db.query(models.Settings).first()
    if settings:
        if not settings.expense_prefix:
            settings.expense_prefix = "EXP"
            db.commit()
            db.refresh(settings)
        return settings
    settings = models.Settings()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_settings(db: Session, payload: schemas.SettingsUpdate) -> models.Settings:
    settings = get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "smtp_password":
            if value:
                settings.smtp_password = encrypt_secret(value)
            continue
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


def _serialize_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _json_dump(payload):
    return json.dumps(payload, default=_serialize_datetime)


def _agreement_snapshot(agreement: models.ServiceAgreement):
    data = {
        "display_id": agreement.display_id,
        "client_id": agreement.client_id,
        "quote_id": agreement.quote_id,
        "title": agreement.title,
        "summary": agreement.summary,
        "content": agreement.content,
        "document_url": agreement.document_url,
        "start_date": agreement.start_date,
        "end_date": agreement.end_date,
        "scope_of_services": agreement.scope_of_services,
        "duration": agreement.duration,
        "availability": agreement.availability,
        "meetings": agreement.meetings,
        "access_requirements": agreement.access_requirements,
        "fees_payments": agreement.fees_payments,
        "data_protection": agreement.data_protection,
        "termination": agreement.termination,
        "company_signatory_name": agreement.company_signatory_name,
        "company_signatory_title": agreement.company_signatory_title,
        "company_signed_date": agreement.company_signed_date,
        "client_signatory_name": agreement.client_signatory_name,
    }
    sla_items = [
        {"sla": item.sla, "timescale": item.timescale} for item in agreement.sla_items or []
    ]
    return _json_dump(data), _json_dump(sla_items)


def _proposal_snapshot(proposal: models.Proposal):
    data = {
        "display_id": proposal.display_id,
        "client_id": proposal.client_id,
        "quote_id": proposal.quote_id,
        "title": proposal.title,
        "status": proposal.status,
        "submitted_on": proposal.submitted_on,
        "valid_until": proposal.valid_until,
        "summary": proposal.summary,
        "approach": proposal.approach,
        "timeline": proposal.timeline,
        "content": proposal.content,
    }
    requirements = [
        {"description": item.description} for item in proposal.requirements or []
    ]
    attachments = [
        {"filename": item.filename, "file_path": item.file_path}
        for item in proposal.attachments or []
    ]
    return _json_dump(data), _json_dump(requirements), _json_dump(attachments)


def create_agreement_version(db: Session, agreement: models.ServiceAgreement, user_id: int | None):
    next_version = (agreement.current_version or 0) + 1
    now = datetime.utcnow()
    agreement.current_version = next_version
    agreement.updated_at = now
    agreement.updated_by_user_id = user_id
    db.commit()
    db.refresh(agreement)
    data_json, sla_json = _agreement_snapshot(agreement)
    version = models.ServiceAgreementVersion(
        agreement_id=agreement.id,
        version_number=next_version,
        title=agreement.title,
        data_json=data_json,
        sla_items_json=sla_json,
        created_at=now,
        created_by_user_id=user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def create_proposal_version(db: Session, proposal: models.Proposal, user_id: int | None):
    next_version = (proposal.current_version or 0) + 1
    now = datetime.utcnow()
    proposal.current_version = next_version
    proposal.updated_at = now
    proposal.updated_by_user_id = user_id
    db.commit()
    db.refresh(proposal)
    data_json, requirements_json, attachments_json = _proposal_snapshot(proposal)
    version = models.ProposalVersion(
        proposal_id=proposal.id,
        version_number=next_version,
        title=proposal.title,
        status=proposal.status,
        data_json=data_json,
        requirements_json=requirements_json,
        attachments_json=attachments_json,
        created_at=now,
        created_by_user_id=user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def list_users(db: Session):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


def list_active_users(db: Session):
    return (
        db.query(models.User)
        .filter(models.User.is_active == True)  # noqa: E712
        .order_by(models.User.created_at.desc())
        .all()
    )


def create_user(db: Session, payload: schemas.UserCreate, role: str | None = None):
    user = models.User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role or payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: models.User, payload: schemas.UserUpdate):
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: models.User):
    db.delete(user)
    db.commit()


def create_session(db: Session, user: models.User, token_hash: str, expires_at: datetime):
    session = models.UserSession(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session_by_hash(db: Session, token_hash: str):
    return db.query(models.UserSession).filter(models.UserSession.token_hash == token_hash).first()


def delete_session(db: Session, session: models.UserSession):
    db.delete(session)
    db.commit()


def get_client(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id == client_id).first()


def get_clients(db: Session):
    return db.query(models.Client).order_by(models.Client.created_at.desc()).all()


def create_client(db: Session, payload: schemas.ClientCreate):
    client = models.Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client: models.Client, payload: schemas.ClientUpdate):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client: models.Client):
    db.query(models.InvoiceLineItem).filter(
        models.InvoiceLineItem.invoice_id.in_(
            db.query(models.Invoice.id).filter(models.Invoice.client_id == client.id)
        )
    ).delete(synchronize_session=False)
    db.query(models.QuoteLineItem).filter(
        models.QuoteLineItem.quote_id.in_(
            db.query(models.Quote.id).filter(models.Quote.client_id == client.id)
        )
    ).delete(synchronize_session=False)
    db.query(models.Invoice).filter(models.Invoice.client_id == client.id).delete(
        synchronize_session=False
    )
    db.query(models.Quote).filter(models.Quote.client_id == client.id).delete(
        synchronize_session=False
    )
    db.query(models.ServiceAgreement).filter(
        models.ServiceAgreement.client_id == client.id
    ).delete(synchronize_session=False)
    db.query(models.Proposal).filter(models.Proposal.client_id == client.id).delete(
        synchronize_session=False
    )
    db.query(models.Expense).filter(models.Expense.client_id == client.id).delete(
        synchronize_session=False
    )
    db.delete(client)
    db.commit()


def create_invoice(db: Session, client_id: int, payload: schemas.InvoiceCreate):
    data = payload.model_dump()
    line_items = data.pop("line_items", None)
    display_id = (data.pop("display_id", None) or "").strip()
    is_legacy = data.pop("is_legacy", None)
    recurrence_enabled = bool(data.pop("recurrence_enabled", False))
    recurrence_frequency = data.pop("recurrence_frequency", None)
    recurrence_count = data.pop("recurrence_count", None)
    recurrence_day_of_month = data.pop("recurrence_day_of_month", None)
    due_rule_unit = data.pop("due_rule_unit", None)
    due_rule_value = data.pop("due_rule_value", None)
    send_now = bool(data.pop("send_now", False))
    quote_id = data.get("quote_id")
    if quote_id:
        quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
        if not quote or quote.client_id != client_id:
            raise ValueError("Selected quote does not belong to this client.")
        if not line_items:
            line_items = [
                {
                    "description": item.description,
                    "quantity": float(item.quantity),
                    "unit_amount": float(item.unit_amount),
                }
                for item in quote.line_items
            ]

    def add_months(base_date: datetime, months: int, day_override: int | None = None) -> datetime:
        import calendar
        month = base_date.month - 1 + months
        year = base_date.year + month // 12
        month = month % 12 + 1
        day = day_override or base_date.day
        last_day = calendar.monthrange(year, month)[1]
        return base_date.replace(year=year, month=month, day=min(day, last_day))

    def compute_due_date(issue_date: datetime) -> datetime | None:
        if due_rule_unit and due_rule_value:
            if due_rule_unit == "days":
                return issue_date + timedelta(days=due_rule_value)
            if due_rule_unit == "weeks":
                return issue_date + timedelta(weeks=due_rule_value)
            if due_rule_unit == "months":
                return add_months(issue_date, due_rule_value)
        return None

    def build_invoice(
        issue_date: datetime,
        due_date: datetime | None,
        status_override: str | None = None,
        display_id_override: str | None = None,
        legacy_override: bool | None = None,
    ) -> models.Invoice:
        invoice = models.Invoice(client_id=client_id, **data)
        invoice.issued_at = issue_date
        if due_date:
            invoice.due_date = due_date
        if status_override:
            invoice.status = status_override
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        if line_items:
            invoice.line_items = [
                models.InvoiceLineItem(
                    description=item["description"],
                    quantity=item["quantity"],
                    unit_amount=item["unit_amount"],
                )
                for item in line_items
            ]
            invoice.amount = sum(
                float(item.quantity) * float(item.unit_amount) for item in invoice.line_items
            )
            db.commit()
            db.refresh(invoice)
        if not invoice.display_id:
            settings = get_or_create_settings(db)
            chosen_display_id = display_id_override or display_id
            if chosen_display_id:
                ensure_display_id_unique(db, models.Invoice, chosen_display_id)
                invoice.display_id = chosen_display_id
                if legacy_override is None:
                    invoice.is_legacy = True if is_legacy is None else bool(is_legacy)
                else:
                    invoice.is_legacy = bool(legacy_override)
            else:
                invoice.display_id = build_display_id(settings.invoice_prefix, invoice.id)
                if legacy_override is None:
                    invoice.is_legacy = False
                else:
                    invoice.is_legacy = bool(legacy_override)
            db.commit()
            db.refresh(invoice)
        return invoice

    issued_at = data.get("issued_at") or datetime.utcnow()
    due_date = data.get("due_date")
    if not due_rule_unit and not due_rule_value and due_date:
        due_offset = due_date - issued_at
    else:
        due_offset = None

    first_invoice = None
    if recurrence_enabled:
        if not recurrence_frequency or not recurrence_count:
            raise ValueError("Recurrence frequency and count are required.")
        if recurrence_count < 1:
            raise ValueError("Recurrence count must be at least 1.")
        frequency = recurrence_frequency
        day_of_month = recurrence_day_of_month or issued_at.day
        created = None
        for index in range(recurrence_count):
            if index == 0:
                issue_date = issued_at
            else:
                if frequency == "weekly":
                    issue_date = issued_at + timedelta(weeks=index)
                elif frequency == "monthly":
                    issue_date = add_months(issued_at, index, day_of_month)
                elif frequency == "quarterly":
                    issue_date = add_months(issued_at, index * 3, day_of_month)
                elif frequency == "annually":
                    issue_date = add_months(issued_at, index * 12, day_of_month)
                else:
                    raise ValueError("Unsupported recurrence frequency.")

            if due_rule_unit and due_rule_value:
                next_due = compute_due_date(issue_date)
            elif due_offset is not None:
                next_due = issue_date + due_offset
            else:
                next_due = None
            status_override = "sent" if index == 0 and send_now else None
            display_id_override = display_id if index == 0 else None
            legacy_override = bool(is_legacy) if index == 0 and display_id else None
            created = build_invoice(
                issue_date,
                next_due,
                status_override=status_override,
                display_id_override=display_id_override,
                legacy_override=legacy_override,
            )
            if index == 0:
                first_invoice = created
        return created, first_invoice

    status_override = "sent" if send_now else None
    created = build_invoice(
        issued_at,
        compute_due_date(issued_at) or due_date,
        status_override=status_override,
        display_id_override=display_id,
        legacy_override=bool(is_legacy) if display_id else None,
    )
    if send_now:
        first_invoice = created
    return created, first_invoice


def update_invoice(db: Session, invoice: models.Invoice, payload: schemas.InvoiceUpdate):
    data = payload.model_dump(exclude_unset=True)
    line_items = data.pop("line_items", None)
    if "quote_id" in data:
        quote_id = data.pop("quote_id")
        if quote_id:
            quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
            if not quote or quote.client_id != invoice.client_id:
                raise ValueError("Selected quote does not belong to this client.")
        setattr(invoice, "quote_id", quote_id)
    if "display_id" in data:
        display_id = (data.pop("display_id") or "").strip()
        if display_id:
            ensure_display_id_unique(db, models.Invoice, display_id, exclude_id=invoice.id)
            invoice.display_id = display_id
            invoice.is_legacy = True
        else:
            invoice.display_id = None
            invoice.is_legacy = False
    if "is_legacy" in data:
        invoice.is_legacy = bool(data.pop("is_legacy"))
    for field, value in data.items():
        setattr(invoice, field, value)
    if line_items is not None:
        invoice.line_items = [
            models.InvoiceLineItem(
                description=item["description"],
                quantity=item["quantity"],
                unit_amount=item["unit_amount"],
            )
            for item in line_items
        ]
        invoice.amount = sum(
            float(item.quantity) * float(item.unit_amount) for item in invoice.line_items
        )
    db.commit()
    db.refresh(invoice)
    if not invoice.display_id:
        settings = get_or_create_settings(db)
        invoice.display_id = build_display_id(settings.invoice_prefix, invoice.id)
        invoice.is_legacy = False
        db.commit()
        db.refresh(invoice)
    return invoice


def mark_invoice_paid(db: Session, invoice: models.Invoice):
    invoice.status = "paid"
    invoice.paid_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return invoice


def create_quote(db: Session, client_id: int, payload: schemas.QuoteCreate):
    data = payload.model_dump()
    line_items = data.pop("line_items", None)
    display_id = (data.pop("display_id", None) or "").strip()
    is_legacy = data.pop("is_legacy", None)
    quote = models.Quote(client_id=client_id, **data)
    db.add(quote)
    db.commit()
    db.refresh(quote)
    settings = get_or_create_settings(db)
    if line_items:
        quote.line_items = [
            models.QuoteLineItem(
                description=item["description"],
                quantity=item["quantity"],
                unit_amount=item["unit_amount"],
            )
            for item in line_items
        ]
        quote.amount = sum(
            float(item.quantity) * float(item.unit_amount) for item in quote.line_items
        )
        db.commit()
        db.refresh(quote)
    if not quote.display_id:
        if display_id:
            ensure_display_id_unique(db, models.Quote, display_id)
            quote.display_id = display_id
            quote.is_legacy = True if is_legacy is None else bool(is_legacy)
        else:
            quote.display_id = build_display_id(settings.quote_prefix, quote.id)
            quote.is_legacy = False
        db.commit()
        db.refresh(quote)
    return quote


def update_quote(db: Session, quote: models.Quote, payload: schemas.QuoteUpdate):
    data = payload.model_dump(exclude_unset=True)
    line_items = data.pop("line_items", None)
    if "display_id" in data:
        display_id = (data.pop("display_id") or "").strip()
        if display_id:
            ensure_display_id_unique(db, models.Quote, display_id, exclude_id=quote.id)
            quote.display_id = display_id
            quote.is_legacy = True
        else:
            quote.display_id = None
            quote.is_legacy = False
    if "is_legacy" in data:
        quote.is_legacy = bool(data.pop("is_legacy"))
    for field, value in data.items():
        setattr(quote, field, value)
    if line_items is not None:
        quote.line_items = [
            models.QuoteLineItem(
                description=item["description"],
                quantity=item["quantity"],
                unit_amount=item["unit_amount"],
            )
            for item in line_items
        ]
        quote.amount = sum(
            float(item.quantity) * float(item.unit_amount) for item in quote.line_items
        )
    db.commit()
    db.refresh(quote)
    if not quote.display_id:
        settings = get_or_create_settings(db)
        quote.display_id = build_display_id(settings.quote_prefix, quote.id)
        quote.is_legacy = False
        db.commit()
        db.refresh(quote)
    return quote


def create_agreement(db: Session, client_id: int, payload: schemas.AgreementCreate, user_id: int | None = None):
    data = payload.model_dump()
    display_id = data.get("display_id")
    if display_id:
        ensure_display_id_unique(db, models.ServiceAgreement, display_id)
    sla_items = data.pop("sla_items", None) or []
    agreement = models.ServiceAgreement(client_id=client_id, **data)
    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    settings = get_or_create_settings(db)
    if not agreement.display_id:
        agreement.display_id = build_display_id(settings.agreement_prefix, agreement.id)
        db.commit()
        db.refresh(agreement)
    if sla_items:
        agreement.sla_items = [
            models.ServiceAgreementSLA(sla=item["sla"], timescale=item["timescale"])
            for item in sla_items
        ]
        db.commit()
        db.refresh(agreement)
    agreement.current_version = 0
    create_agreement_version(db, agreement, user_id)
    return agreement


def update_agreement(db: Session, agreement: models.ServiceAgreement, payload: schemas.AgreementUpdate, user_id: int | None = None):
    data = payload.model_dump(exclude_unset=True)
    display_id = data.get("display_id")
    if display_id:
        ensure_display_id_unique(db, models.ServiceAgreement, display_id, exclude_id=agreement.id)
    sla_items = data.pop("sla_items", None)
    for field, value in data.items():
        setattr(agreement, field, value)
    if sla_items is not None:
        agreement.sla_items = []
        for item in sla_items:
            agreement.sla_items.append(
                models.ServiceAgreementSLA(sla=item["sla"], timescale=item["timescale"])
            )
    db.commit()
    db.refresh(agreement)
    create_agreement_version(db, agreement, user_id)
    return agreement


def create_proposal(db: Session, client_id: int, payload: schemas.ProposalCreate, user_id: int | None = None):
    data = payload.model_dump()
    display_id = data.get("display_id")
    if display_id:
        ensure_display_id_unique(db, models.Proposal, display_id)
    requirements = data.pop("requirements", None) or []
    attachments = data.pop("attachments", None) or []
    proposal = models.Proposal(client_id=client_id, **data)
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    settings = get_or_create_settings(db)
    if not proposal.display_id:
        proposal.display_id = build_display_id(settings.proposal_prefix, proposal.id)
        db.commit()
        db.refresh(proposal)
    if requirements:
        proposal.requirements = [
            models.ProposalRequirement(description=item["description"]) for item in requirements
        ]
    if attachments:
        proposal.attachments = [
            models.ProposalAttachment(
                filename=item["filename"],
                file_path=item["file_path"],
            )
            for item in attachments
        ]
    if requirements or attachments:
        db.commit()
        db.refresh(proposal)
    proposal.current_version = 0
    create_proposal_version(db, proposal, user_id)
    return proposal


def update_proposal(db: Session, proposal: models.Proposal, payload: schemas.ProposalUpdate, user_id: int | None = None):
    data = payload.model_dump(exclude_unset=True)
    display_id = data.get("display_id")
    if display_id:
        ensure_display_id_unique(db, models.Proposal, display_id, exclude_id=proposal.id)
    requirements = data.pop("requirements", None)
    attachments = data.pop("attachments", None)
    for field, value in data.items():
        setattr(proposal, field, value)
    if requirements is not None:
        proposal.requirements = [
            models.ProposalRequirement(description=item["description"]) for item in requirements
        ]
    if attachments is not None:
        proposal.attachments = [
            models.ProposalAttachment(
                filename=item["filename"],
                file_path=item["file_path"],
            )
            for item in attachments
        ]
    db.commit()
    db.refresh(proposal)
    create_proposal_version(db, proposal, user_id)
    return proposal


def restore_agreement_version(
    db: Session,
    agreement: models.ServiceAgreement,
    version: models.ServiceAgreementVersion,
    user_id: int | None = None,
):
    data = json.loads(version.data_json or "{}")
    sla_items = json.loads(version.sla_items_json or "[]")
    date_fields = {"start_date", "end_date", "company_signed_date"}
    for field, value in data.items():
        if field in date_fields and value:
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                pass
        setattr(agreement, field, value)
    agreement.sla_items = [
        models.ServiceAgreementSLA(sla=item["sla"], timescale=item["timescale"])
        for item in sla_items
    ]
    db.commit()
    db.refresh(agreement)
    create_agreement_version(db, agreement, user_id)
    return agreement


def restore_proposal_version(
    db: Session,
    proposal: models.Proposal,
    version: models.ProposalVersion,
    user_id: int | None = None,
):
    data = json.loads(version.data_json or "{}")
    requirements = json.loads(version.requirements_json or "[]")
    attachments = json.loads(version.attachments_json or "[]")
    date_fields = {"submitted_on", "valid_until"}
    for field, value in data.items():
        if field in date_fields and value:
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                pass
        setattr(proposal, field, value)
    proposal.requirements = [
        models.ProposalRequirement(description=item["description"]) for item in requirements
    ]
    proposal.attachments = [
        models.ProposalAttachment(filename=item["filename"], file_path=item["file_path"])
        for item in attachments
    ]
    db.commit()
    db.refresh(proposal)
    create_proposal_version(db, proposal, user_id)
    return proposal


def create_expense(db: Session, client_id: int | None, payload: schemas.ExpenseCreate):
    data = payload.model_dump()
    receipts = data.pop("receipts", None) or []
    display_id = (data.pop("display_id", None) or "").strip()
    is_legacy = data.pop("is_legacy", None)
    if len(receipts) == 0:
        raise ValueError("At least one receipt is required.")
    expense = models.Expense(client_id=client_id, **data)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    expense.receipts = [
        models.ExpenseReceipt(filename=item["filename"], file_path=item["file_path"])
        for item in receipts
    ]
    db.commit()
    db.refresh(expense)
    settings = get_or_create_settings(db)
    if not expense.display_id:
        if display_id:
            ensure_display_id_unique(db, models.Expense, display_id)
            expense.display_id = display_id
            expense.is_legacy = True if is_legacy is None else bool(is_legacy)
        else:
            expense.display_id = build_display_id(settings.expense_prefix or "EXP", expense.id)
            expense.is_legacy = False
        db.commit()
        db.refresh(expense)
    return expense


def update_expense(db: Session, expense: models.Expense, payload: schemas.ExpenseUpdate):
    data = payload.model_dump(exclude_unset=True)
    receipts = data.pop("receipts", None)
    if "display_id" in data:
        display_id = (data.pop("display_id") or "").strip()
        if display_id:
            ensure_display_id_unique(db, models.Expense, display_id, exclude_id=expense.id)
            expense.display_id = display_id
            expense.is_legacy = True
        else:
            expense.display_id = None
            expense.is_legacy = False
    if "is_legacy" in data:
        expense.is_legacy = bool(data.pop("is_legacy"))
    for field, value in data.items():
        setattr(expense, field, value)
    if receipts is not None:
        if len(receipts) == 0:
            raise ValueError("At least one receipt is required.")
        expense.receipts = [
            models.ExpenseReceipt(filename=item["filename"], file_path=item["file_path"])
            for item in receipts
        ]
    db.commit()
    db.refresh(expense)
    if not expense.display_id:
        settings = get_or_create_settings(db)
        expense.display_id = build_display_id(settings.expense_prefix or "EXP", expense.id)
        expense.is_legacy = False
        db.commit()
        db.refresh(expense)
    return expense


def delete_expense(db: Session, expense: models.Expense):
    db.delete(expense)
    db.commit()
