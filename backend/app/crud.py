from datetime import datetime, timedelta
import json

from sqlalchemy.orm import Session

from . import models, schemas
from .security import encrypt_secret, hash_password


def _round_money(value: float | int | None) -> float:
    return round(float(value or 0) + 1e-9, 2)


def _line_tax_totals(quantity: float, unit_amount: float, tax_rate: float = 0, tax_inclusive: bool = False):
    gross_input = float(quantity or 0) * float(unit_amount or 0)
    rate = float(tax_rate or 0)
    if tax_inclusive and rate > 0:
        net = gross_input / (1 + (rate / 100))
        tax = gross_input - net
        gross = gross_input
    else:
        net = gross_input
        tax = net * (rate / 100)
        gross = net + tax
    return _round_money(net), _round_money(tax), _round_money(gross)


def _build_line_item_model(model_cls, item: dict):
    quantity = float(item.get("quantity") or 0)
    unit_amount = float(item.get("unit_amount") or 0)
    tax_rate = float(item.get("tax_rate") or 0)
    tax_inclusive = bool(item.get("tax_inclusive") or False)
    net_amount, tax_amount, gross_amount = _line_tax_totals(
        quantity, unit_amount, tax_rate, tax_inclusive
    )
    return model_cls(
        description=item["description"],
        quantity=quantity,
        unit_amount=unit_amount,
        net_amount=net_amount,
        tax_amount=tax_amount,
        gross_amount=gross_amount,
        tax_rate=tax_rate,
        tax_code=item.get("tax_code") or "standard",
        tax_kind=item.get("tax_kind") or "vat",
        tax_inclusive=tax_inclusive,
        tax_override=bool(item.get("tax_override") or False),
    )


def _apply_line_tax_defaults(item: dict, settings: models.Settings):
    next_item = dict(item or {})
    next_item.setdefault("tax_kind", "vat")
    next_item.setdefault("tax_code", settings.default_vat_code or "standard")
    if next_item.get("tax_rate") is None:
        next_item["tax_rate"] = float(settings.default_vat_rate or 0)
    next_item.setdefault("tax_inclusive", bool(settings.vat_inclusive_default))
    next_item.setdefault("tax_override", False)
    return next_item


def _default_tax_rate_catalog_payload():
    return {
        "tax_year": "2025-26",
        "version_label": "HMRC baseline",
        "source_label": "HMRC guidance",
        "vat_rates": [
            {"code": "standard", "label": "Standard rate", "rate": 20.0, "kind": "vat", "reclaimable": True},
            {"code": "reduced", "label": "Reduced rate", "rate": 5.0, "kind": "vat", "reclaimable": True},
            {"code": "zero", "label": "Zero rate", "rate": 0.0, "kind": "vat", "reclaimable": True},
            {"code": "exempt", "label": "Exempt", "rate": 0.0, "kind": "vat", "reclaimable": False},
            {"code": "out_of_scope", "label": "Out of scope", "rate": 0.0, "kind": "vat", "reclaimable": False},
            {"code": "reverse_charge", "label": "Reverse charge", "rate": 20.0, "kind": "vat", "reclaimable": True},
        ],
        "direct_tax_rates": {
            "corporation_tax": {
                "small_profits_rate": 19.0,
                "main_rate": 25.0,
                "small_profits_threshold": 50000.0,
                "main_rate_threshold": 250000.0,
                "marginal_relief_fraction": 0.015,
            },
            "sole_trader": {
                "personal_allowance": 12570.0,
                "basic_rate_limit": 50270.0,
                "basic_rate": 0.20,
                "higher_rate": 0.40,
                "additional_rate": 0.45,
                "additional_rate_threshold": 125140.0,
                "class4_lower_profits_limit": 12570.0,
                "class4_upper_profits_limit": 50270.0,
                "class4_main_rate": 0.06,
                "class4_upper_rate": 0.02,
                "class2_small_profits_threshold": 6845.0,
                "class2_weekly_rate": 3.50,
            },
        },
        "assumptions": [
            "UK rates seeded from HMRC guidance and should be reviewed annually.",
            "Estimates are planning-only and not filing advice.",
            "Reliefs, allowances, and special-case adjustments are not fully modeled in v1.5.",
        ],
    }


def _apply_document_totals(document, line_items):
    document.net_amount = _round_money(sum(float(item.net_amount or 0) for item in line_items))
    document.tax_amount = _round_money(sum(float(item.tax_amount or 0) for item in line_items))
    document.gross_amount = _round_money(sum(float(item.gross_amount or 0) for item in line_items))
    document.amount = document.gross_amount
    first_item = line_items[0] if line_items else None
    document.tax_rate = float(getattr(first_item, "tax_rate", 0) or 0)
    document.tax_code = getattr(first_item, "tax_code", "standard") if first_item else "standard"
    document.tax_kind = getattr(first_item, "tax_kind", "vat") if first_item else "vat"
    document.tax_inclusive = bool(getattr(first_item, "tax_inclusive", False)) if first_item else False


def _default_payment_allocation(invoice: models.Invoice, amount: float):
    invoice_gross = float(invoice.gross_amount or invoice.amount or 0)
    if invoice_gross <= 0:
        return {
            "tax_kind": invoice.tax_kind or "vat",
            "tax_code": invoice.tax_code or "standard",
            "tax_rate": float(invoice.tax_rate or 0),
            "net_amount": _round_money(amount),
            "tax_amount": 0.0,
            "gross_amount": _round_money(amount),
        }
    ratio = min(1.0, max(0.0, float(amount or 0) / invoice_gross))
    tax_amount = _round_money(float(invoice.tax_amount or 0) * ratio)
    gross_amount = _round_money(amount)
    net_amount = _round_money(gross_amount - tax_amount)
    return {
        "tax_kind": invoice.tax_kind or "vat",
        "tax_code": invoice.tax_code or "standard",
        "tax_rate": float(invoice.tax_rate or 0),
        "net_amount": net_amount,
        "tax_amount": tax_amount,
        "gross_amount": gross_amount,
    }


def _refresh_invoice_payment_status(db: Session, invoice: models.Invoice):
    paid_total = _round_money(sum(float(payment.amount or 0) for payment in invoice.payments))
    invoice_total = _round_money(float(invoice.gross_amount or invoice.amount or 0))
    if paid_total >= invoice_total and invoice_total > 0:
        invoice.status = "paid"
        if not invoice.paid_at:
            latest_paid = max((payment.paid_at for payment in invoice.payments), default=datetime.utcnow())
            invoice.paid_at = latest_paid
    else:
        if invoice.status == "paid":
            invoice.status = "sent"
        invoice.paid_at = None
    db.commit()
    db.refresh(invoice)


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
        changed = False
        if not settings.expense_prefix:
            settings.expense_prefix = "EXP"
            changed = True
        if not getattr(settings, "credit_note_prefix", None):
            settings.credit_note_prefix = "CN"
            changed = True
        if not getattr(settings, "refund_prefix", None):
            settings.refund_prefix = "RF"
            changed = True
        if getattr(settings, "default_vat_rate", None) is None:
            settings.default_vat_rate = 20
            changed = True
        if not getattr(settings, "vat_scheme", None):
            settings.vat_scheme = "standard"
            changed = True
        if not getattr(settings, "vat_filing_frequency", None):
            settings.vat_filing_frequency = "quarterly"
            changed = True
        if getattr(settings, "vat_period_start_month", None) is None:
            settings.vat_period_start_month = settings.fy_start_month or 1
            changed = True
        if getattr(settings, "vat_period_start_day", None) is None:
            settings.vat_period_start_day = settings.fy_start_day or 1
            changed = True
        if not getattr(settings, "vat_accounting_method", None):
            settings.vat_accounting_method = "accrual"
            changed = True
        if getattr(settings, "corporation_tax_rate", None) is None:
            settings.corporation_tax_rate = 25
            changed = True
        if getattr(settings, "corporation_tax_period_start_month", None) is None:
            settings.corporation_tax_period_start_month = settings.fy_start_month or 1
            changed = True
        if getattr(settings, "corporation_tax_period_start_day", None) is None:
            settings.corporation_tax_period_start_day = settings.fy_start_day or 1
            changed = True
        if getattr(settings, "other_taxes", None) is None:
            settings.other_taxes = []
            changed = True
        if not getattr(settings, "business_tax_mode", None):
            settings.business_tax_mode = "limited_company"
            changed = True
        if not getattr(settings, "default_vat_code", None):
            settings.default_vat_code = "standard"
            changed = True
        if not getattr(settings, "tax_estimate_basis", None):
            settings.tax_estimate_basis = "accrual"
            changed = True
        if changed:
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


def get_or_create_tax_rate_catalog(db: Session) -> models.TaxRateCatalog:
    active = (
        db.query(models.TaxRateCatalog)
        .filter(models.TaxRateCatalog.is_active == True)  # noqa: E712
        .order_by(models.TaxRateCatalog.updated_at.desc(), models.TaxRateCatalog.id.desc())
        .first()
    )
    if active:
        return active

    seed = _default_tax_rate_catalog_payload()
    active = models.TaxRateCatalog(
        tax_year=seed["tax_year"],
        version_label=seed["version_label"],
        source_label=seed["source_label"],
        effective_date=datetime.utcnow(),
        vat_rates=seed["vat_rates"],
        direct_tax_rates=seed["direct_tax_rates"],
        assumptions=seed["assumptions"],
        review_notes="Seeded from HMRC baseline values.",
        is_active=True,
    )
    db.add(active)
    db.commit()
    db.refresh(active)
    return active


def update_tax_rate_catalog(db: Session, payload: schemas.TaxRateCatalogUpdate) -> models.TaxRateCatalog:
    catalog = get_or_create_tax_rate_catalog(db)
    if payload.version:
        version_data = payload.version.model_dump(exclude_unset=True)
        for key in ("tax_year", "version_label", "source_label", "effective_date", "review_notes", "is_active"):
            if key in version_data:
                setattr(catalog, key, version_data[key])
        if "assumptions" in version_data:
            catalog.assumptions = version_data["assumptions"] or []
    if payload.vat_rates is not None:
        catalog.vat_rates = [item.model_dump() if hasattr(item, "model_dump") else item for item in payload.vat_rates]
    if payload.direct_tax_rates is not None:
        catalog.direct_tax_rates = payload.direct_tax_rates
    catalog.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(catalog)
    return catalog


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


def _resolve_restored_quote_id(
    db: Session,
    client_id: int,
    quote_id: int | None,
) -> int | None:
    if not quote_id:
        return None
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote or quote.client_id != client_id:
        return None
    return quote_id


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
                    "tax_rate": float(getattr(item, "tax_rate", 0) or 0),
                    "tax_code": getattr(item, "tax_code", "standard"),
                    "tax_kind": getattr(item, "tax_kind", "vat"),
                    "tax_inclusive": bool(getattr(item, "tax_inclusive", False)),
                    "tax_override": bool(getattr(item, "tax_override", False)),
                }
                for item in quote.line_items
            ]
    settings = get_or_create_settings(db)

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
            normalized_line_items = [
                _apply_line_tax_defaults(item, settings)
                for item in line_items
            ]
            invoice.line_items = [
                _build_line_item_model(models.InvoiceLineItem, item)
                for item in normalized_line_items
            ]
            _apply_document_totals(invoice, invoice.line_items)
            db.commit()
            db.refresh(invoice)
        if not invoice.display_id:
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
        settings = get_or_create_settings(db)
        normalized_line_items = [
            _apply_line_tax_defaults(item, settings)
            for item in line_items
        ]
        invoice.line_items = [
            _build_line_item_model(models.InvoiceLineItem, item)
            for item in normalized_line_items
        ]
        _apply_document_totals(invoice, invoice.line_items)
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
    paid_total = _round_money(sum(float(payment.amount or 0) for payment in invoice.payments))
    remaining = _round_money(float(invoice.gross_amount or invoice.amount or 0) - paid_total)
    if remaining <= 0:
        _refresh_invoice_payment_status(db, invoice)
        return invoice
    payment = models.InvoicePayment(
        invoice_id=invoice.id,
        amount=remaining,
        paid_at=datetime.utcnow(),
        reference="Marked as paid",
        method="manual",
    )
    payment.tax_allocations = [
        models.PaymentTaxAllocation(**_default_payment_allocation(invoice, remaining))
    ]
    db.add(payment)
    db.commit()
    db.refresh(invoice)
    _refresh_invoice_payment_status(db, invoice)
    return invoice


def _credited_amount_for_invoice_line(
    db: Session,
    invoice_line_item_id: int,
    exclude_credit_note_id: int | None = None,
):
    query = db.query(models.CreditNoteLineItem).filter(
        models.CreditNoteLineItem.invoice_line_item_id == invoice_line_item_id
    )
    if exclude_credit_note_id is not None:
        query = query.filter(models.CreditNoteLineItem.credit_note_id != exclude_credit_note_id)
    return sum(float(item.credited_amount or 0) for item in query.all())


def _refunded_amount_for_credit_note(
    db: Session,
    credit_note_id: int,
    exclude_refund_id: int | None = None,
):
    query = db.query(models.Refund).filter(models.Refund.credit_note_id == credit_note_id)
    if exclude_refund_id is not None:
        query = query.filter(models.Refund.id != exclude_refund_id)
    return sum(float(item.amount or 0) for item in query.all())


def get_credit_notes(db: Session):
    return db.query(models.CreditNote).order_by(models.CreditNote.issued_at.desc()).all()


def get_refunds(db: Session):
    return db.query(models.Refund).order_by(models.Refund.refunded_at.desc()).all()


def create_credit_note(db: Session, payload: schemas.CreditNoteCreate):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == payload.invoice_id).first()
    if not invoice:
        raise ValueError("Invoice not found.")
    if not payload.line_items:
        raise ValueError("At least one credit line is required.")

    credit_note = models.CreditNote(
        client_id=invoice.client_id,
        invoice_id=invoice.id,
        issued_at=payload.issued_at or datetime.utcnow(),
        notes=payload.notes,
        total_amount=0,
    )
    db.add(credit_note)
    db.commit()
    db.refresh(credit_note)

    total_amount = 0.0
    total_net = 0.0
    total_tax = 0.0
    total_gross = 0.0
    line_items = []
    invoice_line_item_ids = {item.id for item in invoice.line_items}
    for item in payload.line_items:
        if item.invoice_line_item_id not in invoice_line_item_ids:
            raise ValueError("Credit line item does not belong to the selected invoice.")
        invoice_line = next(
            line for line in invoice.line_items if line.id == item.invoice_line_item_id
        )
        source_total = float(invoice_line.quantity or 0) * float(invoice_line.unit_amount or 0)
        already_credited = _credited_amount_for_invoice_line(db, invoice_line.id)
        remaining = source_total - already_credited
        if item.credited_amount <= 0:
            raise ValueError("Credited amount must be greater than zero.")
        if float(item.credited_amount) > remaining + 0.0001:
            raise ValueError("Credited amount exceeds the remaining line value.")
        if item.credited_quantity <= 0:
            raise ValueError("Credited quantity must be greater than zero.")
        if float(item.credited_quantity) > float(invoice_line.quantity or 0) + 0.0001:
            raise ValueError("Credited quantity exceeds the source line quantity.")
        line_items.append(
            models.CreditNoteLineItem(
                invoice_line_item_id=invoice_line.id,
                description=invoice_line.description,
                source_unit_amount=invoice_line.unit_amount,
                credited_quantity=item.credited_quantity,
                net_amount=_round_money(
                    float(getattr(invoice_line, "net_amount", source_total))
                    * (float(item.credited_amount) / max(source_total, 0.01))
                ),
                tax_amount=_round_money(
                    float(getattr(invoice_line, "tax_amount", 0))
                    * (float(item.credited_amount) / max(source_total, 0.01))
                ),
                gross_amount=_round_money(float(item.credited_amount)),
                tax_rate=float(getattr(invoice_line, "tax_rate", 0) or 0),
                tax_code=getattr(invoice_line, "tax_code", "standard"),
                tax_kind=getattr(invoice_line, "tax_kind", "vat"),
                tax_inclusive=bool(getattr(invoice_line, "tax_inclusive", False)),
                credited_amount=item.credited_amount,
            )
        )
        total_amount += float(item.credited_amount)
        total_net += float(line_items[-1].net_amount or 0)
        total_tax += float(line_items[-1].tax_amount or 0)
        total_gross += float(line_items[-1].gross_amount or 0)

    credit_note.line_items = line_items
    credit_note.net_amount = _round_money(total_net)
    credit_note.tax_amount = _round_money(total_tax)
    credit_note.gross_amount = _round_money(total_gross)
    credit_note.total_amount = total_amount
    settings = get_or_create_settings(db)
    credit_note.display_id = build_display_id(settings.credit_note_prefix, credit_note.id)
    db.commit()
    db.refresh(credit_note)
    return credit_note


def update_credit_note(db: Session, credit_note: models.CreditNote, payload: schemas.CreditNoteUpdate):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(credit_note, field, value)
    db.commit()
    db.refresh(credit_note)
    return credit_note


def create_refund(db: Session, payload: schemas.RefundCreate):
    credit_note = db.query(models.CreditNote).filter(models.CreditNote.id == payload.credit_note_id).first()
    if not credit_note:
        raise ValueError("Credit note not found.")
    refunded_amount = _refunded_amount_for_credit_note(db, credit_note.id)
    remaining = float(credit_note.total_amount or 0) - refunded_amount
    if payload.amount <= 0:
        raise ValueError("Refund amount must be greater than zero.")
    if float(payload.amount) > remaining + 0.0001:
        raise ValueError("Refund amount exceeds the remaining credit note balance.")

    refund = models.Refund(
        credit_note_id=credit_note.id,
        client_id=credit_note.client_id,
        invoice_id=credit_note.invoice_id,
        refunded_at=payload.refunded_at or datetime.utcnow(),
        amount=payload.amount,
        gross_amount=_round_money(payload.amount),
        tax_amount=_round_money(
            float(payload.amount or 0)
            * (
                float(credit_note.tax_amount or 0)
                / max(float(credit_note.gross_amount or credit_note.total_amount or 1), 1)
            )
        ),
        net_amount=0,
        notes=payload.notes,
    )
    refund.net_amount = _round_money(float(refund.gross_amount or 0) - float(refund.tax_amount or 0))
    db.add(refund)
    db.commit()
    db.refresh(refund)
    settings = get_or_create_settings(db)
    refund.display_id = build_display_id(settings.refund_prefix, refund.id)
    db.commit()
    db.refresh(refund)
    return refund


def update_refund(db: Session, refund: models.Refund, payload: schemas.RefundUpdate):
    data = payload.model_dump(exclude_unset=True)
    if "amount" in data:
        amount = float(data["amount"] or 0)
        refunded_amount = _refunded_amount_for_credit_note(
            db, refund.credit_note_id, exclude_refund_id=refund.id
        )
        remaining = float(refund.credit_note.total_amount or 0) - refunded_amount
        if amount <= 0:
            raise ValueError("Refund amount must be greater than zero.")
        if amount > remaining + 0.0001:
            raise ValueError("Refund amount exceeds the remaining credit note balance.")
    for field, value in data.items():
        setattr(refund, field, value)
    if "amount" in data:
        ratio = float(refund.credit_note.tax_amount or 0) / max(
            float(refund.credit_note.gross_amount or refund.credit_note.total_amount or 1), 1
        )
        refund.gross_amount = _round_money(refund.amount)
        refund.tax_amount = _round_money(float(refund.amount or 0) * ratio)
        refund.net_amount = _round_money(float(refund.amount or 0) - float(refund.tax_amount or 0))
    db.commit()
    db.refresh(refund)
    return refund


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
        normalized_line_items = [
            _apply_line_tax_defaults(item, settings)
            for item in line_items
        ]
        quote.line_items = [
            _build_line_item_model(models.QuoteLineItem, item)
            for item in normalized_line_items
        ]
        _apply_document_totals(quote, quote.line_items)
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
        settings = get_or_create_settings(db)
        normalized_line_items = [
            _apply_line_tax_defaults(item, settings)
            for item in line_items
        ]
        quote.line_items = [
            _build_line_item_model(models.QuoteLineItem, item)
            for item in normalized_line_items
        ]
        _apply_document_totals(quote, quote.line_items)
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
    restored_client_id = data.get("client_id", agreement.client_id)
    data["quote_id"] = _resolve_restored_quote_id(
        db,
        restored_client_id,
        data.get("quote_id"),
    )
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
    restored_client_id = data.get("client_id", proposal.client_id)
    data["quote_id"] = _resolve_restored_quote_id(
        db,
        restored_client_id,
        data.get("quote_id"),
    )
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
    net_amount, tax_amount, gross_amount = _line_tax_totals(
        1, float(expense.amount or 0), float(expense.tax_rate or 0), bool(expense.tax_inclusive)
    )
    expense.net_amount = _round_money(data.get("net_amount", net_amount))
    expense.tax_amount = _round_money(data.get("tax_amount", tax_amount))
    expense.gross_amount = _round_money(data.get("gross_amount", gross_amount))
    expense.amount = expense.gross_amount
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
    if any(
        field in data
        for field in ("amount", "net_amount", "tax_amount", "gross_amount", "tax_rate", "tax_inclusive")
    ):
        net_amount, tax_amount, gross_amount = _line_tax_totals(
            1, float(expense.amount or 0), float(expense.tax_rate or 0), bool(expense.tax_inclusive)
        )
        expense.net_amount = _round_money(data.get("net_amount", net_amount))
        expense.tax_amount = _round_money(data.get("tax_amount", tax_amount))
        expense.gross_amount = _round_money(data.get("gross_amount", gross_amount))
        expense.amount = expense.gross_amount
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


def get_payments(db: Session):
    return db.query(models.InvoicePayment).order_by(models.InvoicePayment.paid_at.desc()).all()


def create_invoice_payment(db: Session, invoice: models.Invoice, payload: schemas.InvoicePaymentCreate):
    amount = _round_money(payload.amount)
    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero.")
    paid_total = _round_money(sum(float(payment.amount or 0) for payment in invoice.payments))
    remaining = _round_money(float(invoice.gross_amount or invoice.amount or 0) - paid_total)
    if amount > remaining + 0.0001:
        raise ValueError("Payment amount exceeds the outstanding invoice balance.")
    payment = models.InvoicePayment(
        invoice_id=invoice.id,
        amount=amount,
        paid_at=payload.paid_at or datetime.utcnow(),
        reference=payload.reference,
        method=payload.method,
        notes=payload.notes,
    )
    allocation_payloads = payload.tax_allocations or [_default_payment_allocation(invoice, amount)]
    payment.tax_allocations = [
        models.PaymentTaxAllocation(
            **(
                allocation.model_dump()
                if hasattr(allocation, "model_dump")
                else allocation
            )
        )
        for allocation in allocation_payloads
    ]
    db.add(payment)
    db.commit()
    db.refresh(payment)
    db.refresh(invoice)
    _refresh_invoice_payment_status(db, invoice)
    return payment


def delete_invoice_payment(db: Session, payment: models.InvoicePayment):
    invoice = payment.invoice
    db.delete(payment)
    db.commit()
    if invoice:
        db.refresh(invoice)
        _refresh_invoice_payment_status(db, invoice)


def _coerce_period(period: str | None):
    return (period or "all").strip().lower()


def _period_bounds(period: str, settings: models.Settings):
    today = datetime.utcnow()
    if period == "all":
        return None, None

    if period.startswith("fy_"):
        try:
            fy_year = int(period.split("_", 1)[1])
        except (TypeError, ValueError):
            fy_year = today.year
        fy_month = settings.fy_start_month or 1
        fy_day = settings.fy_start_day or 1
        fy_start = datetime(fy_year, fy_month, fy_day)
        fy_end = datetime(fy_year + 1, fy_month, fy_day) - timedelta(seconds=1)
        return fy_start, fy_end

    if period == "current_tax_year":
        tax_year_start = datetime(today.year, 4, 6)
        if today < tax_year_start:
            tax_year_start = datetime(today.year - 1, 4, 6)
        tax_year_end = datetime(tax_year_start.year + 1, 4, 5, 23, 59, 59)
        return tax_year_start, tax_year_end

    fy_month = settings.fy_start_month or 1
    fy_day = settings.fy_start_day or 1
    fy_start = datetime(today.year, fy_month, fy_day)
    if today < fy_start:
        fy_start = datetime(today.year - 1, fy_month, fy_day)
    fy_end = datetime(fy_start.year + 1, fy_month, fy_day) - timedelta(seconds=1)
    return fy_start, fy_end


def _in_period(value: datetime | None, start: datetime | None, end: datetime | None):
    if not value:
        return False if (start or end) else True
    if start and value < start:
        return False
    if end and value > end:
        return False
    return True


def _build_tax_assumptions(db: Session, warnings: list[str] | None = None):
    catalog = get_or_create_tax_rate_catalog(db)
    return {
        "tax_year": catalog.tax_year,
        "source_label": catalog.source_label,
        "version_label": catalog.version_label,
        "generated_at": datetime.utcnow(),
        "warnings": warnings or [],
    }


def get_vat_summary(db: Session, period: str | None = None):
    settings = get_or_create_settings(db)
    accounting_method = settings.vat_accounting_method or "accrual"
    normalized_period = _coerce_period(period)
    period_start, period_end = _period_bounds(normalized_period, settings)
    qualifying_statuses = {"sent", "paid", "overdue"}
    invoices = [
        item
        for item in db.query(models.Invoice).all()
        if _in_period(item.issued_at, period_start, period_end)
        and str(item.status or "").lower() in qualifying_statuses
    ]
    expenses = [item for item in db.query(models.Expense).all() if _in_period(item.incurred_date, period_start, period_end)]
    credit_notes = [item for item in db.query(models.CreditNote).all() if _in_period(item.issued_at, period_start, period_end)]
    refunds = [item for item in db.query(models.Refund).all() if _in_period(item.refunded_at, period_start, period_end)]
    allocations = [
        item
        for item in db.query(models.PaymentTaxAllocation).all()
        if _in_period(getattr(item.payment, "paid_at", None), period_start, period_end)
    ]

    output_vat = _round_money(sum(float(invoice.tax_amount or 0) for invoice in invoices))
    input_vat = _round_money(
        sum(float(expense.tax_amount or 0) for expense in expenses if expense.vat_reclaimable)
    )
    credit_note_vat = _round_money(sum(float(note.tax_amount or 0) for note in credit_notes))
    refund_vat = _round_money(sum(float(refund.tax_amount or 0) for refund in refunds))
    payment_allocated_vat = _round_money(sum(float(item.tax_amount or 0) for item in allocations))
    net_vat_due = (
        _round_money(payment_allocated_vat - input_vat)
        if accounting_method == "cash"
        else _round_money(output_vat - credit_note_vat - input_vat)
    )
    return {
        "tax_kind": "vat",
        "accounting_method": accounting_method,
        "period_start": period_start,
        "period_end": period_end,
        "next_due": settings.vat_next_filing_due,
        "output_vat": output_vat,
        "input_vat": input_vat,
        "credit_note_vat": credit_note_vat,
        "refund_vat": refund_vat,
        "payment_allocated_vat": payment_allocated_vat,
        "net_vat_due": net_vat_due,
    }


def _calculate_profit(db: Session, period: str | None = None):
    settings = get_or_create_settings(db)
    period_start, period_end = _period_bounds(_coerce_period(period), settings)
    qualifying_statuses = {"sent", "paid", "overdue"}
    invoices = [
        item
        for item in db.query(models.Invoice).all()
        if _in_period(item.issued_at, period_start, period_end)
        and str(item.status or "").lower() in qualifying_statuses
    ]
    credit_notes = [item for item in db.query(models.CreditNote).all() if _in_period(item.issued_at, period_start, period_end)]
    refunds = [item for item in db.query(models.Refund).all() if _in_period(item.refunded_at, period_start, period_end)]
    expenses = [item for item in db.query(models.Expense).all() if _in_period(item.incurred_date, period_start, period_end)]

    invoice_gross = _round_money(
        sum(float(invoice.gross_amount or invoice.amount or 0) for invoice in invoices)
    )
    credit_gross = _round_money(
        sum(float(note.gross_amount or note.total_amount or 0) for note in credit_notes)
    )
    refund_gross = _round_money(
        sum(float(refund.gross_amount or refund.amount or 0) for refund in refunds)
    )
    expense_gross = _round_money(
        sum(float(expense.gross_amount or expense.amount or 0) for expense in expenses)
    )
    estimated_profit_gross = _round_money(
        invoice_gross - credit_gross - refund_gross - expense_gross
    )

    invoice_net = _round_money(
        sum(float(invoice.net_amount or invoice.amount or 0) for invoice in invoices)
    )
    credit_net = _round_money(sum(float(note.net_amount or 0) for note in credit_notes))
    refund_net = _round_money(sum(float(refund.net_amount or 0) for refund in refunds))
    expense_net = _round_money(
        sum(float(expense.net_amount or expense.amount or 0) for expense in expenses)
    )
    estimated_profit_net = _round_money(
        invoice_net - credit_net - refund_net - expense_net
    )

    return (
        {
            "invoice_gross": invoice_gross,
            "credit_note_gross": credit_gross,
            "refund_gross": refund_gross,
            "expense_gross": expense_gross,
            "estimated_profit_gross": estimated_profit_gross,
            "invoice_net": invoice_net,
            "credit_note_net": credit_net,
            "refund_net": refund_net,
            "expense_net": expense_net,
            "estimated_profit_net": estimated_profit_net,
        },
        period_start,
        period_end,
    )


def get_corporation_tax_summary(db: Session, period: str | None = None):
    settings = get_or_create_settings(db)
    catalog = get_or_create_tax_rate_catalog(db)
    corp_rates = (catalog.direct_tax_rates or {}).get("corporation_tax", {})
    profit_breakdown, period_start, period_end = _calculate_profit(db, period=period)
    small_rate = float(corp_rates.get("small_profits_rate", 19))
    main_rate = float(corp_rates.get("main_rate", settings.corporation_tax_rate or 25))
    lower = float(corp_rates.get("small_profits_threshold", 50000))
    upper = float(corp_rates.get("main_rate_threshold", 250000))

    estimated_profit = _round_money(float(profit_breakdown.get("estimated_profit_gross", 0)))
    taxable_profit = max(estimated_profit, 0)
    if taxable_profit <= lower:
        effective_rate = small_rate
    elif taxable_profit >= upper:
        effective_rate = main_rate
    else:
        effective_rate = _round_money(small_rate + ((taxable_profit - lower) / max(upper - lower, 1)) * (main_rate - small_rate))
    estimated_tax_due = _round_money(taxable_profit * (effective_rate / 100))
    return {
        "tax_kind": "corporation_tax",
        "period_start": period_start,
        "period_end": period_end,
        "next_payment_due": settings.corporation_tax_payment_due,
        "next_return_due": settings.corporation_tax_return_due,
        "estimated_profit": estimated_profit,
        "estimated_tax_due": estimated_tax_due,
        "rate": effective_rate,
        "profit_breakdown": profit_breakdown,
    }


def get_sole_trader_tax_summary(db: Session, period: str | None = None):
    catalog = get_or_create_tax_rate_catalog(db)
    rates = (catalog.direct_tax_rates or {}).get("sole_trader", {})
    profit_breakdown, period_start, period_end = _calculate_profit(db, period=period)
    estimated_profit = _round_money(float(profit_breakdown.get("estimated_profit_gross", 0)))
    taxable_profit = max(0.0, _round_money(estimated_profit - float(rates.get("personal_allowance", 12570))))

    basic_limit = float(rates.get("basic_rate_limit", 50270))
    basic_rate = float(rates.get("basic_rate", 0.20))
    higher_rate = float(rates.get("higher_rate", 0.40))
    additional_rate = float(rates.get("additional_rate", 0.45))
    additional_threshold = float(rates.get("additional_rate_threshold", 125140))
    class4_lower = float(rates.get("class4_lower_profits_limit", 12570))
    class4_upper = float(rates.get("class4_upper_profits_limit", 50270))
    class4_main_rate = float(rates.get("class4_main_rate", 0.06))
    class4_upper_rate = float(rates.get("class4_upper_rate", 0.02))

    income_tax = 0.0
    gross_profit = max(estimated_profit, 0)
    if gross_profit > additional_threshold:
        income_tax += max(0.0, additional_threshold - basic_limit) * higher_rate
        income_tax += max(0.0, basic_limit - float(rates.get("personal_allowance", 12570))) * basic_rate
        income_tax += max(0.0, gross_profit - additional_threshold) * additional_rate
    elif gross_profit > basic_limit:
        income_tax += max(0.0, basic_limit - float(rates.get("personal_allowance", 12570))) * basic_rate
        income_tax += max(0.0, gross_profit - basic_limit) * higher_rate
    else:
        income_tax += taxable_profit * basic_rate

    class4_nic = 0.0
    if gross_profit > class4_lower:
        class4_nic += max(0.0, min(gross_profit, class4_upper) - class4_lower) * class4_main_rate
    if gross_profit > class4_upper:
        class4_nic += (gross_profit - class4_upper) * class4_upper_rate

    return {
        "tax_kind": "sole_trader_tax",
        "period_start": period_start,
        "period_end": period_end,
        "estimated_profit": _round_money(estimated_profit),
        "taxable_profit": _round_money(taxable_profit),
        "estimated_income_tax_due": _round_money(income_tax),
        "estimated_class4_nic_due": _round_money(class4_nic),
        "class2_small_profits_threshold": float(rates.get("class2_small_profits_threshold", 6845)),
        "class2_weekly_rate": float(rates.get("class2_weekly_rate", 3.50)),
        "assumptions": [
            "Estimate excludes personal allowances beyond configured defaults.",
            "No student loan, pension, or special relief adjustments are included.",
        ],
        "profit_breakdown": profit_breakdown,
    }


def get_direct_tax_summary(db: Session, period: str | None = None):
    settings = get_or_create_settings(db)
    mode = settings.business_tax_mode or "limited_company"
    basis = settings.tax_estimate_basis or "accrual"
    warnings = [
        "Estimates are for planning only and should be reviewed with an accountant.",
        "Direct-tax estimate currently uses gross profit (gross income less gross credits/refunds/expenses).",
    ]
    assumptions = _build_tax_assumptions(db, warnings=warnings)
    result = {
        "mode": mode,
        "basis": basis,
        "assumptions": assumptions,
        "corporation": None,
        "sole_trader": None,
    }
    if mode == "sole_trader":
        result["sole_trader"] = get_sole_trader_tax_summary(db, period=period)
    else:
        result["corporation"] = get_corporation_tax_summary(db, period=period)
    return result


def get_filing_pack(db: Session, period: str | None = None):
    settings = get_or_create_settings(db)
    vat_summary = get_vat_summary(db, period=period)
    direct_summary = get_direct_tax_summary(db, period=period)
    assumptions = _build_tax_assumptions(
        db,
        warnings=["Not tax advice. Confirm calculations with a qualified accountant before filing."],
    )
    return {
        "period_start": vat_summary.get("period_start"),
        "period_end": vat_summary.get("period_end"),
        "basis": settings.tax_estimate_basis or "accrual",
        "mode": settings.business_tax_mode or "limited_company",
        "vat_summary": vat_summary,
        "direct_tax_summary": direct_summary,
        "assumptions": assumptions,
    }
