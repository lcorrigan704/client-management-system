from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .auth import clear_session, create_session, get_current_user, require_role, require_user
from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .email_utils import generate_email_draft, send_email_smtp
from base64 import b64encode
from .security import password_meets_policy, verify_password


app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "public" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
BACKUP_DIR = ROOT_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024
_login_rate_cache: dict[str, dict[str, datetime | int]] = {}


def _resolve_db_path() -> Path:
    db_path = Path(__file__).resolve().parent.parent / "app.db"
    docker_db_path = Path(__file__).resolve().parent.parent / "data" / "app.db"
    return db_path if db_path.exists() else docker_db_path


def _safe_extract(tar, path: Path):
    for member in tar.getmembers():
        member_path = Path(member.name)
        if member_path.is_absolute() or ".." in member_path.parts:
            raise HTTPException(status_code=400, detail="Unsafe path in backup archive.")
    tar.extractall(path)


def _save_upload_limited(uploaded: UploadFile, destination: Path, max_bytes: int):
    total = 0
    with destination.open("wb") as buffer:
        while True:
            chunk = uploaded.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status_code=413, detail="Upload exceeds size limit.")
            buffer.write(chunk)


def _clear_uploads():
    if not UPLOADS_DIR.exists():
        return
    for item in UPLOADS_DIR.iterdir():
        if item.name == ".gitkeep":
            continue
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            for child in item.rglob("*"):
                if child.is_file():
                    child.unlink()
            for child in sorted(item.rglob("*"), reverse=True):
                if child.is_dir():
                    child.rmdir()
            item.rmdir()


def _restore_from_archive(archive_path: Path):
    import tarfile
    import tempfile
    import shutil

    if not archive_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found.")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        with tarfile.open(archive_path, "r:gz") as tar:
            _safe_extract(tar, temp_dir_path)

        extracted_db = temp_dir_path / "app.db"
        if not extracted_db.exists():
            raise HTTPException(status_code=400, detail="Backup missing app.db.")

        target_db = _resolve_db_path()
        engine.dispose()
        shutil.copy2(extracted_db, target_db)

        extracted_uploads = temp_dir_path / "uploads"
        if extracted_uploads.exists():
            _clear_uploads()
            shutil.copytree(extracted_uploads, UPLOADS_DIR, dirs_exist_ok=True)

allowed_origins = [
    origin.strip()
    for origin in settings.allowed_origins.split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_AUTH_ALLOWLIST = {
    "/health",
    "/auth/status",
    "/auth/login",
    "/auth/setup",
}
if settings.enable_docs:
    _AUTH_ALLOWLIST.update({"/docs", "/redoc", "/openapi.json"})


@app.middleware("http")
async def upload_size_limit(request: Request, call_next):
    if request.method in {"POST", "PUT"}:
        if request.url.path in {"/proposals/uploads", "/admin/restore/upload"}:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_UPLOAD_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Upload exceeds size limit."})
    return await call_next(request)


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _AUTH_ALLOWLIST:
        return await call_next(request)
    db = SessionLocal()
    try:
        user = get_current_user(request, db)
    finally:
        db.close()
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    request.state.user = user
    return await call_next(request)


@app.get("/health")
def health_check():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.get("/settings", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db), user=Depends(require_user)):
    settings_row = crud.get_or_create_settings(db)
    settings_row.smtp_password = None
    return settings_row


@app.put("/settings", response_model=schemas.SettingsOut)
def update_settings(
    payload: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner", "admin"])),
):
    settings_row = crud.update_settings(db, payload)
    settings_row.smtp_password = None
    return settings_row


@app.post("/admin/backup")
def create_backup(payload: schemas.BackupRequest, user=Depends(require_role(["owner", "admin"]))):
    import tarfile
    from datetime import datetime
    import tempfile

    source_db = _resolve_db_path()
    if not source_db.exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    if not payload.download and not payload.store:
        raise HTTPException(status_code=400, detail="Select download and/or store.")

    timestamp = datetime.utcnow().strftime("%Y-%m-%d")
    backup_name = f"cms-{timestamp}.tar.gz"

    if payload.store:
        backup_path = BACKUP_DIR / backup_name
    else:
        temp_file = tempfile.NamedTemporaryFile(prefix="cms-", suffix=".tar.gz", delete=False)
        backup_path = Path(temp_file.name)
        temp_file.close()

    with tarfile.open(backup_path, "w:gz") as tar:
        tar.add(str(source_db), arcname="app.db")
        if UPLOADS_DIR.exists():
            tar.add(str(UPLOADS_DIR), arcname="uploads")

    if payload.download:
        background = None
        if not payload.store:
            background = BackgroundTask(lambda: backup_path.unlink(missing_ok=True))
        return FileResponse(
            path=str(backup_path),
            filename=backup_name,
            media_type="application/gzip",
            background=background,
        )

    return {"status": "stored", "filename": backup_name}


@app.get("/admin/backups")
def list_backups(user=Depends(require_role(["owner", "admin"]))):
    files = sorted(
        [p.name for p in BACKUP_DIR.glob("*.tar.gz") if p.is_file()],
        reverse=True,
    )
    return {"backups": files}


@app.post("/admin/restore")
def restore_backup(payload: schemas.RestoreRequest, user=Depends(require_role(["owner", "admin"]))):
    archive_path = BACKUP_DIR / payload.filename
    _restore_from_archive(archive_path)
    return {"status": "restored", "source": "server", "filename": payload.filename}


@app.post("/admin/restore/upload")
def restore_backup_upload(file: UploadFile = File(...), user=Depends(require_role(["owner", "admin"]))):
    import tempfile
    filename = file.filename or ""
    if not filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Only .tar.gz backups are supported.")
    temp_file = tempfile.NamedTemporaryFile(prefix="cms-restore-", suffix=".tar.gz", delete=False)
    temp_path = Path(temp_file.name)
    temp_file.close()
    _save_upload_limited(file, temp_path, MAX_UPLOAD_BYTES)
    try:
        _restore_from_archive(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)
    return {"status": "restored", "source": "upload"}


@app.post("/admin/reset")
def reset_data(db: Session = Depends(get_db), user=Depends(require_role(["owner", "admin"]))):
    db.query(models.ProposalAttachment).delete()
    db.query(models.ProposalRequirement).delete()
    db.query(models.ServiceAgreementSLA).delete()
    db.query(models.InvoiceLineItem).delete()
    db.query(models.QuoteLineItem).delete()
    db.query(models.Proposal).delete()
    db.query(models.ServiceAgreement).delete()
    db.query(models.Invoice).delete()
    db.query(models.Quote).delete()
    db.query(models.Expense).delete()
    db.query(models.Client).delete()
    db.commit()

    if UPLOADS_DIR.exists():
        for item in UPLOADS_DIR.iterdir():
            if item.name == ".gitkeep":
                continue
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                for child in item.rglob("*"):
                    if child.is_file():
                        child.unlink()
                for child in sorted(item.rglob("*"), reverse=True):
                    if child.is_dir():
                        child.rmdir()
                item.rmdir()

    return {"status": "reset"}


@app.post("/admin/reset-workspace")
def reset_workspace(db: Session = Depends(get_db), user=Depends(require_role(["owner"]))):
    # Remove business data first.
    reset_data(db, user)

    # Remove auth/session data and settings.
    db.query(models.UserSession).delete()
    db.query(models.User).delete()
    db.query(models.Settings).delete()
    db.commit()

    return {"status": "workspace_reset"}


@app.get("/auth/status", response_model=schemas.AuthStatus)
def auth_status(request: Request, db: Session = Depends(get_db)):
    needs_setup = db.query(models.User).count() == 0
    user = get_current_user(request, db) if request else None
    return schemas.AuthStatus(needs_setup=needs_setup, user=user)


@app.post("/auth/setup", response_model=schemas.AuthStatus)
def auth_setup(payload: schemas.AuthSetupRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup already completed.")
    if not password_meets_policy(payload.password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements.")
    user = crud.create_user(
        db,
        schemas.UserCreate(
            email=payload.owner_email,
            password=payload.password,
            role="owner",
            is_active=True,
        ),
        role="owner",
    )
    settings_data = payload.model_dump(exclude_none=True)
    settings_data.pop("owner_email", None)
    settings_data.pop("password", None)
    settings_payload = schemas.SettingsUpdate(**settings_data)
    crud.update_settings(db, settings_payload)
    create_session(response, db, user)
    return schemas.AuthStatus(needs_setup=False, user=user)


@app.post("/auth/login", response_model=schemas.AuthStatus)
def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(key: str) -> bool:
    now = datetime.utcnow()
    entry = _login_rate_cache.get(key)
    if not entry or entry["reset_at"] < now:
        _login_rate_cache[key] = {
            "count": 1,
            "reset_at": now + timedelta(seconds=settings.login_rate_limit_window_seconds),
        }
        return False
    entry["count"] = int(entry["count"]) + 1
    return int(entry["count"]) > settings.login_rate_limit_attempts


@app.post("/auth/login", response_model=schemas.AuthStatus)
def auth_login(payload: schemas.AuthLoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    client_ip = _get_client_ip(request)
    rate_key = f"{client_ip}:{payload.email}"
    if _rate_limited(rate_key):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    user = crud.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive.")
    create_session(response, db, user)
    return schemas.AuthStatus(needs_setup=False, user=user)


@app.post("/auth/logout")
def auth_logout(response: Response, request: Request, db: Session = Depends(get_db)):
    clear_session(response, request, db)
    return {"status": "ok"}


@app.get("/auth/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), user=Depends(require_role(["owner"]))):
    return crud.list_users(db)


@app.get("/auth/users/assignable", response_model=list[schemas.UserOut])
def list_assignable_users(db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.list_active_users(db)


@app.post("/auth/users", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db), user=Depends(require_role(["owner"]))):
    if not password_meets_policy(payload.password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements.")
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="User already exists.")
    return crud.create_user(db, payload)


@app.put("/auth/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db), user=Depends(require_role(["owner"]))):
    target = crud.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.password and not password_meets_policy(payload.password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements.")
    return crud.update_user(db, target, payload)


@app.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), user=Depends(require_role(["owner"]))):
    target = crud.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    crud.delete_user(db, target)
    return {"status": "deleted"}




@app.get("/clients", response_model=list[schemas.ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return crud.get_clients(db)


@app.post("/clients", response_model=schemas.ClientOut)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.create_client(db, payload)


@app.get("/clients/{client_id}", response_model=schemas.ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@app.put("/clients/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: int, payload: schemas.ClientUpdate, db: Session = Depends(get_db)):
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.update_client(db, client, payload)


@app.delete("/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    crud.delete_client(db, client)
    return {"status": "deleted"}


@app.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db)):
    return db.query(models.Invoice).order_by(models.Invoice.issued_at.desc()).all()


@app.post("/clients/{client_id}/invoices", response_model=schemas.InvoiceOut)
def create_invoice(client_id: int, payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        return crud.create_invoice(db, client_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/invoices/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@app.put("/invoices/{invoice_id}", response_model=schemas.InvoiceOut)
def update_invoice(invoice_id: int, payload: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return crud.update_invoice(db, invoice, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/invoices/{invoice_id}/mark-paid", response_model=schemas.InvoiceOut)
def mark_invoice_paid(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return crud.mark_invoice_paid(db, invoice)


@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(invoice)
    db.commit()
    return {"status": "deleted"}


@app.get("/quotes", response_model=list[schemas.QuoteOut])
def list_quotes(db: Session = Depends(get_db)):
    return db.query(models.Quote).order_by(models.Quote.issued_at.desc()).all()


@app.post("/clients/{client_id}/quotes", response_model=schemas.QuoteOut)
def create_quote(client_id: int, payload: schemas.QuoteCreate, db: Session = Depends(get_db)):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        return crud.create_quote(db, client_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/quotes/{quote_id}", response_model=schemas.QuoteOut)
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@app.put("/quotes/{quote_id}", response_model=schemas.QuoteOut)
def update_quote(quote_id: int, payload: schemas.QuoteUpdate, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    try:
        return crud.update_quote(db, quote, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/quotes/{quote_id}")
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    db.delete(quote)
    db.commit()
    return {"status": "deleted"}


@app.get("/agreements", response_model=list[schemas.AgreementOut])
def list_agreements(db: Session = Depends(get_db)):
    return db.query(models.ServiceAgreement).order_by(models.ServiceAgreement.created_at.desc()).all()


@app.post("/clients/{client_id}/agreements", response_model=schemas.AgreementOut)
def create_agreement(client_id: int, payload: schemas.AgreementCreate, db: Session = Depends(get_db)):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    if not payload.quote_id:
        raise HTTPException(status_code=400, detail="Quote is required for a service agreement")
    quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
    if not quote:
        raise HTTPException(status_code=400, detail="Quote not found")
    if quote.client_id != client_id:
        raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.create_agreement(db, client_id, payload)


@app.get("/agreements/{agreement_id}", response_model=schemas.AgreementOut)
def get_agreement(agreement_id: int, db: Session = Depends(get_db)):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agreement


@app.put("/agreements/{agreement_id}", response_model=schemas.AgreementOut)
def update_agreement(agreement_id: int, payload: schemas.AgreementUpdate, db: Session = Depends(get_db)):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if payload.quote_id is not None:
        quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
        if not quote:
            raise HTTPException(status_code=400, detail="Quote not found")
        if quote.client_id != agreement.client_id:
            raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.update_agreement(db, agreement, payload)


@app.delete("/agreements/{agreement_id}")
def delete_agreement(agreement_id: int, db: Session = Depends(get_db)):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    db.delete(agreement)
    db.commit()
    return {"status": "deleted"}


@app.get("/proposals", response_model=list[schemas.ProposalOut])
def list_proposals(db: Session = Depends(get_db)):
    return db.query(models.Proposal).order_by(models.Proposal.created_at.desc()).all()


@app.post("/clients/{client_id}/proposals", response_model=schemas.ProposalOut)
def create_proposal(client_id: int, payload: schemas.ProposalCreate, db: Session = Depends(get_db)):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    if not payload.quote_id:
        raise HTTPException(status_code=400, detail="Quote is required for a proposal")
    quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
    if not quote:
        raise HTTPException(status_code=400, detail="Quote not found")
    if quote.client_id != client_id:
        raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.create_proposal(db, client_id, payload)


@app.get("/proposals/{proposal_id}", response_model=schemas.ProposalOut)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@app.put("/proposals/{proposal_id}", response_model=schemas.ProposalOut)
def update_proposal(proposal_id: int, payload: schemas.ProposalUpdate, db: Session = Depends(get_db)):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if payload.quote_id is not None:
        quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
        if not quote:
            raise HTTPException(status_code=400, detail="Quote not found")
        if quote.client_id != proposal.client_id:
            raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.update_proposal(db, proposal, payload)


@app.delete("/proposals/{proposal_id}")
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    db.delete(proposal)
    db.commit()
    return {"status": "deleted"}


@app.post("/proposals/uploads")
def upload_proposal_assets(files: list[UploadFile] = File(...)):
    saved = []
    for uploaded in files:
        if not uploaded.filename:
            continue
        suffix = Path(uploaded.filename).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(status_code=400, detail="Only image files are supported.")
        filename = f"{uuid4().hex}{suffix}"
        destination = UPLOADS_DIR / filename
        _save_upload_limited(uploaded, destination, MAX_UPLOAD_BYTES)
        saved.append(
            {
                "filename": uploaded.filename,
                "file_path": f"uploads/{filename}",
            }
        )
    return {"files": saved}


@app.get("/expenses", response_model=list[schemas.ExpenseOut])
def list_expenses(db: Session = Depends(get_db)):
    return db.query(models.Expense).order_by(models.Expense.incurred_date.desc()).all()


@app.post("/expenses", response_model=schemas.ExpenseOut)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_expense(db, None, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/clients/{client_id}/expenses", response_model=schemas.ExpenseOut)
def create_client_expense(client_id: int, payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        return crud.create_expense(db, client_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/expenses/{expense_id}", response_model=schemas.ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@app.put("/expenses/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, payload: schemas.ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    try:
        return crud.update_expense(db, expense, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    crud.delete_expense(db, expense)
    return {"status": "deleted"}


@app.post("/email/draft", response_model=schemas.EmailDraftResponse)

def create_email_draft(payload: schemas.EmailDraftRequest, db: Session = Depends(get_db)):
    entity_type = payload.entity_type.lower()
    entity = None
    client = None

    if entity_type == "invoice":
        entity = db.query(models.Invoice).filter(models.Invoice.id == payload.entity_id).first()
        if entity:
            client = entity.client
    elif entity_type == "quote":
        entity = db.query(models.Quote).filter(models.Quote.id == payload.entity_id).first()
        if entity:
            client = entity.client
    elif entity_type == "proposal":
        entity = db.query(models.Proposal).filter(models.Proposal.id == payload.entity_id).first()
        if entity:
            client = entity.client
    elif entity_type == "agreement":
        entity = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == payload.entity_id).first()
        if entity:
            client = entity.client
    elif entity_type == "expense":
        entity = db.query(models.Expense).filter(models.Expense.id == payload.entity_id).first()
        if entity:
            client = entity.client
    if entity_type == "expense":
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
    else:
        if not entity or not client:
            raise HTTPException(status_code=404, detail="Entity not found")

    subject, body, pdf_bytes, pdf_filename = generate_email_draft(entity_type, client, entity)

    if payload.send:
        attachments = []
        if pdf_bytes:
            attachments.append(
                {
                    "content": pdf_bytes,
                    "filename": pdf_filename or "document.pdf",
                    "maintype": "application",
                    "subtype": "pdf",
                }
            )
        sent, message = send_email_smtp(payload.to_email, subject, body, attachments=attachments)
    else:
        sent, message = False, "Draft generated."

    return schemas.EmailDraftResponse(
        subject=subject,
        body=body,
        sent=sent,
        message=message,
        pdf_base64=b64encode(pdf_bytes).decode("utf-8") if pdf_bytes else None,
        pdf_filename=pdf_filename,
    )
