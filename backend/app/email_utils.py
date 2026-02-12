from email.message import EmailMessage
import smtplib
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from .config import settings as env_settings
from .crud import get_or_create_settings
from .security import decrypt_secret


ROOT_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT_DIR / "templates"
PUBLIC_DIR = ROOT_DIR / "public"
_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _format_gbp(value):
    return f"£{float(value or 0):,.2f}"


def _format_date(value):
    if not value:
        return "—"
    return value.strftime("%d/%m/%Y")


def render_invoice_pdf(
    company_name,
    invoice,
    client,
    bank_details,
    company_address="",
    company_invoice_email="",
):
    line_items = []
    subtotal = 0.0
    for item in invoice.line_items or []:
        line_total = float(item.quantity) * float(item.unit_amount)
        subtotal += line_total
        line_items.append(
            {
                "description": item.description,
                "quantity": f"{float(item.quantity):.2f}",
                "unit_amount": _format_gbp(item.unit_amount),
                "line_total": _format_gbp(line_total),
            }
        )
    context = {
        "company_name": company_name,
        "company_address": company_address or "",
        "invoice_id": invoice.display_id or f"INV-{invoice.id}",
        "issued_date": _format_date(invoice.issued_at),
        "due_date": _format_date(invoice.due_date),
        "client_company": client.company or client.name,
        "client_name": client.contact_name or client.name,
        "client_email": client.invoice_email or client.contact_email or client.email,
        "client_address": client.address,
        "invoice_title": invoice.title,
        "status": (invoice.status or "").capitalize(),
        "company_invoice_email": company_invoice_email,
        "line_items": line_items,
        "subtotal": _format_gbp(subtotal),
        "total": _format_gbp(invoice.amount),
        "bank_details": bank_details or "",
        "notes": invoice.notes,
    }
    template = _jinja_env.get_template("invoice.html")
    html = template.render(**context)
    return HTML(string=html, base_url=str(PUBLIC_DIR)).write_pdf()


def render_quote_pdf(company_name, quote, client, company_address="", company_invoice_email=""):
    line_items = []
    subtotal = 0.0
    for item in quote.line_items or []:
        line_total = float(item.quantity) * float(item.unit_amount)
        subtotal += line_total
        line_items.append(
            {
                "description": item.description,
                "quantity": f"{float(item.quantity):.2f}",
                "unit_amount": _format_gbp(item.unit_amount),
                "line_total": _format_gbp(line_total),
            }
        )
    context = {
        "company_name": company_name,
        "company_address": company_address or "",
        "quote_id": quote.display_id or f"QUOTE-{quote.id}",
        "issued_date": _format_date(quote.issued_at),
        "valid_until": _format_date(quote.valid_until),
        "client_company": client.company or client.name,
        "client_name": client.contact_name or client.name,
        "client_email": client.contact_email or client.email,
        "client_address": client.address,
        "quote_title": quote.title,
        "status": (quote.status or "").capitalize(),
        "company_invoice_email": company_invoice_email,
        "line_items": line_items,
        "subtotal": _format_gbp(subtotal),
        "total": _format_gbp(quote.amount),
        "notes": quote.notes,
    }
    template = _jinja_env.get_template("quote.html")
    html = template.render(**context)
    return HTML(string=html, base_url=str(PUBLIC_DIR)).write_pdf()


def render_agreement_pdf(
    company_name,
    agreement,
    client,
    quote,
    bank_details,
    company_address="",
):
    sla_items = [
        {"sla": item.sla, "timescale": item.timescale}
        for item in (agreement.sla_items or [])
    ]
    quote_line_items = []
    if quote:
        for item in quote.line_items or []:
            line_total = float(item.quantity) * float(item.unit_amount)
            quote_line_items.append(
                {
                    "description": item.description,
                    "quantity": f"{float(item.quantity):.2f}",
                    "unit_amount": _format_gbp(item.unit_amount),
                    "line_total": _format_gbp(line_total),
                }
            )
    context = {
        "company_name": company_name,
        "company_address": company_address or "",
        "agreement_id": agreement.display_id or f"AGR-{agreement.id}",
        "start_date": _format_date(agreement.start_date),
        "end_date": _format_date(agreement.end_date) if agreement.end_date else "N/A",
        "client_company": client.company or client.name,
        "client_name": client.contact_name or client.name,
        "client_address": client.address or "",
        "scope_of_services": agreement.scope_of_services or "",
        "duration": agreement.duration or "",
        "availability": agreement.availability or "",
        "meetings": agreement.meetings or "",
        "sla_items": sla_items,
        "access_requirements": agreement.access_requirements or "",
        "fees_payments": agreement.fees_payments or "",
        "data_protection": agreement.data_protection or "",
        "termination": agreement.termination or "",
        "quote_id": quote.display_id if quote else "—",
        "quote_total": _format_gbp(quote.amount) if quote else "—",
        "quote_line_items": quote_line_items,
        "bank_details": bank_details or "",
        "company_signatory_name": agreement.company_signatory_name or "",
        "company_signatory_title": agreement.company_signatory_title or "",
        "company_signed_date": _format_date(agreement.company_signed_date),
        "client_signatory_name": agreement.client_signatory_name or "",
    }
    template = _jinja_env.get_template("agreement.html")
    html = template.render(**context)
    return HTML(string=html, base_url=str(PUBLIC_DIR)).write_pdf()


def render_expense_pdf(company_name, expense, client, user, company_address=""):
    bank_lines = []
    if user:
        if user.bank_account_name:
            bank_lines.append(f"Account name: {user.bank_account_name}")
        if user.bank_account_number:
            bank_lines.append(f"Account number: {user.bank_account_number}")
        if user.bank_sort_code:
            bank_lines.append(f"Sort code: {user.bank_sort_code}")
    bank_lines.append(f"Reference: {expense.display_id or f'EXP-{expense.id}'}")
    bank_details = "<br/>".join(bank_lines) if bank_lines else ""
    context = {
        "company_name": company_name,
        "company_address": company_address or "",
        "expense_id": expense.display_id or f"EXP-{expense.id}",
        "incurred_date": _format_date(expense.incurred_date),
        "client_company": client.company or client.name if client else "Internal",
        "expense_title": expense.title,
        "status": "Recorded",
        "total": _format_gbp(expense.amount),
        "notes": expense.notes or "",
        "bank_details": bank_details,
    }
    template = _jinja_env.get_template("expense.html")
    html = template.render(**context)
    return HTML(string=html, base_url=str(PUBLIC_DIR)).write_pdf()


def render_proposal_pdf(company_name, proposal, client, quote, company_address=""):
    quote_line_items = []
    if quote:
        for item in quote.line_items or []:
            line_total = float(item.quantity) * float(item.unit_amount)
            quote_line_items.append(
                {
                    "description": item.description,
                    "quantity": f"{float(item.quantity):.2f}",
                    "unit_amount": _format_gbp(item.unit_amount),
                    "line_total": _format_gbp(line_total),
                }
            )
    context = {
        "company_name": company_name,
        "company_address": company_address or "",
        "proposal_id": proposal.display_id or f"PROP-{proposal.id}",
        "submitted_on": _format_date(proposal.submitted_on),
        "valid_until": _format_date(proposal.valid_until),
        "client_company": client.company or client.name,
        "client_name": client.contact_name or client.name,
        "client_address": client.address or "",
        "project_title": proposal.title,
        "summary": proposal.summary or "",
        "approach": proposal.approach or "",
        "timeline": proposal.timeline or "",
        "requirements": proposal.requirements or [],
        "quote_id": quote.display_id if quote else "—",
        "quote_total": _format_gbp(quote.amount) if quote else "—",
        "quote_line_items": quote_line_items,
        "attachments": proposal.attachments or [],
    }
    template = _jinja_env.get_template("proposal.html")
    html = template.render(**context)
    return HTML(string=html, base_url=str(PUBLIC_DIR)).write_pdf()


def generate_email_draft(entity_type, client, entity):
    from .db import SessionLocal
    db = SessionLocal()
    try:
        app_settings = get_or_create_settings(db)
    finally:
        db.close()
    company_name = app_settings.company_name or "Your Company"
    company_address = app_settings.company_address or ""
    company_invoice_email = app_settings.company_invoice_email or ""
    subject = f"{entity_type.title()} update for {client.name}" if client else f"{entity_type.title()} update"
    greeting_name = client.company or client.name if client else "there"
    body_lines = [
        f"Hi {greeting_name},",
        "",
    ]

    def format_date(value):
        if not value:
            return "Not set"
        return value.strftime("%d/%m/%Y")

    bank_details = []
    if app_settings.bank_name:
        bank_details.append(f"Bank: {app_settings.bank_name}")
    if app_settings.bank_account_name:
        bank_details.append(f"Account name: {app_settings.bank_account_name}")
    if app_settings.bank_account_number:
        bank_details.append(f"Account number: {app_settings.bank_account_number}")
    if app_settings.bank_sort_code:
        bank_details.append(f"Sort code: {app_settings.bank_sort_code}")
    if app_settings.bank_iban:
        bank_details.append(f"IBAN: {app_settings.bank_iban}")
    if app_settings.bank_swift:
        bank_details.append(f"SWIFT/BIC: {app_settings.bank_swift}")
    if app_settings.bank_reference:
        bank_details.append(f"Reference: {app_settings.bank_reference}")
    bank_details_html = "<br/>".join(bank_details) if bank_details else None

    pdf_bytes = None
    pdf_filename = None

    if entity_type == "invoice":
        subject = f"{entity.display_id or f'#{entity.id}'} from {company_name}"
        body_lines.append("Please find your invoice attached.")
        body_lines.append("")
        body_lines.append(f"Due date: {format_date(entity.due_date)}")
        pdf_bytes = render_invoice_pdf(
            company_name,
            entity,
            client,
            bank_details_html,
            company_address=company_address,
            company_invoice_email=company_invoice_email,
        )
        pdf_filename = f"{entity.display_id or f'INV-{entity.id}'}.pdf"
    elif entity_type == "quote":
        subject = f"{entity.display_id or f'#{entity.id}'} from {company_name}"
        body_lines.append("Here's your quote attached.")
        body_lines.append("")
        body_lines.append(f"Valid until: {format_date(entity.valid_until)}")
        pdf_bytes = render_quote_pdf(
            company_name,
            entity,
            client,
            company_address=company_address,
            company_invoice_email=company_invoice_email,
        )
        pdf_filename = f"{entity.display_id or f'QUOTE-{entity.id}'}.pdf"
    elif entity_type == "proposal":
        subject = f"{entity.display_id or f'#{entity.id}'} from {company_name}"
        body_lines.append("Please find the proposal attached for review.")
        pdf_bytes = render_proposal_pdf(
            company_name,
            entity,
            client,
            getattr(entity, "quote", None),
            company_address=company_address,
        )
        pdf_filename = f"{entity.display_id or f'PROP-{entity.id}'}.pdf"
    elif entity_type == "agreement":
        subject = f"{entity.display_id or f'#{entity.id}'} from {company_name}"
        body_lines.append("Please find the service agreement attached.")
        pdf_bytes = render_agreement_pdf(
            company_name,
            entity,
            client,
            getattr(entity, "quote", None),
            bank_details_html,
            company_address=company_address,
        )
        pdf_filename = f"{entity.display_id or f'AGR-{entity.id}'}.pdf"
    elif entity_type == "expense":
        subject = f"{entity.display_id or f'#{entity.id}'} from {company_name}"
        body_lines.append("Here is the expense record attached for your records.")
        body_lines.append("")
        body_lines.append(f"Date incurred: {format_date(entity.incurred_date)}")
        pdf_bytes = render_expense_pdf(
            company_name,
            entity,
            client,
            entity.user if hasattr(entity, "user") else None,
            company_address=company_address,
        )
        pdf_filename = f"{entity.display_id or f'EXP-{entity.id}'}.pdf"

    body_lines.extend(
        [
            "",
            "Let me know if you have any questions.",
            "",
            "Best,",
            company_name,
        ]
    )

    return subject, "\n".join(body_lines), pdf_bytes, pdf_filename


def send_email_smtp(to_email, subject, body, attachments=None):
    from .db import SessionLocal
    db = SessionLocal()
    try:
        app_settings = get_or_create_settings(db)
    finally:
        db.close()

    smtp_host = app_settings.smtp_host or env_settings.smtp_host
    smtp_port = app_settings.smtp_port or env_settings.smtp_port
    smtp_username = app_settings.smtp_username or env_settings.smtp_username
    smtp_password = (
        decrypt_secret(app_settings.smtp_password)
        or app_settings.smtp_password
        or env_settings.smtp_password
    )
    smtp_from = app_settings.smtp_from or env_settings.smtp_from
    smtp_use_tls = (
        app_settings.smtp_use_tls
        if app_settings.smtp_use_tls is not None
        else env_settings.smtp_use_tls
    )

    if not smtp_host:
        return False, "SMTP host not configured."

    if not to_email:
        return False, "Recipient email is required for sending."

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(body)
    if attachments:
        for attachment in attachments:
            msg.add_attachment(
                attachment["content"],
                maintype=attachment.get("maintype", "application"),
                subtype=attachment.get("subtype", "pdf"),
                filename=attachment.get("filename", "attachment.pdf"),
            )

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_use_tls:
                    server.starttls()
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        return True, "Email sent via SMTP."
    except Exception as exc:
        return False, f"SMTP send failed: {exc}"


def test_smtp_connection():
    logger = logging.getLogger("smtp_test")
    from .db import SessionLocal
    db = SessionLocal()
    try:
        app_settings = get_or_create_settings(db)
    finally:
        db.close()

    smtp_host = app_settings.smtp_host or env_settings.smtp_host
    smtp_port = app_settings.smtp_port or env_settings.smtp_port
    smtp_username = app_settings.smtp_username or env_settings.smtp_username
    smtp_password = (
        decrypt_secret(app_settings.smtp_password)
        or app_settings.smtp_password
        or env_settings.smtp_password
    )
    smtp_use_tls = (
        app_settings.smtp_use_tls
        if app_settings.smtp_use_tls is not None
        else env_settings.smtp_use_tls
    )

    if not smtp_host:
        logger.warning("SMTP test failed: host missing.")
        return False, "SMTP host not configured."

    try:
        logger.warning(
            "SMTP test config: host=%s port=%s tls=%s username=%s from=%s password_set=%s",
            smtp_host,
            smtp_port,
            smtp_use_tls,
            smtp_username or "",
            app_settings.smtp_from or env_settings.smtp_from,
            bool(smtp_password),
        )
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.noop()
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_use_tls:
                    server.starttls()
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.noop()
        return True, "SMTP connection successful."
    except Exception as exc:
        logger.exception("SMTP test failed.")
        return False, f"SMTP connection failed: {exc}"
