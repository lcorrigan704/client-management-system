from datetime import datetime

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
    invoice = models.Invoice(client_id=client_id, **data)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    settings = get_or_create_settings(db)
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
        if display_id:
            ensure_display_id_unique(db, models.Invoice, display_id)
            invoice.display_id = display_id
            invoice.is_legacy = True if is_legacy is None else bool(is_legacy)
        else:
            invoice.display_id = build_display_id(settings.invoice_prefix, invoice.id)
            invoice.is_legacy = False
        db.commit()
        db.refresh(invoice)
    return invoice


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


def create_agreement(db: Session, client_id: int, payload: schemas.AgreementCreate):
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
    return agreement


def update_agreement(db: Session, agreement: models.ServiceAgreement, payload: schemas.AgreementUpdate):
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
    return agreement


def create_proposal(db: Session, client_id: int, payload: schemas.ProposalCreate):
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
    return proposal


def update_proposal(db: Session, proposal: models.Proposal, payload: schemas.ProposalUpdate):
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
    return proposal


def create_expense(db: Session, client_id: int | None, payload: schemas.ExpenseCreate):
    data = payload.model_dump()
    display_id = (data.pop("display_id", None) or "").strip()
    is_legacy = data.pop("is_legacy", None)
    expense = models.Expense(client_id=client_id, **data)
    db.add(expense)
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
