from datetime import datetime, timedelta, timezone
from collections import defaultdict
import csv
import io
import mimetypes
from pathlib import Path
import re
import sqlite3
import zipfile
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from . import crud, models, schemas
from .auth import (
    clear_session,
    create_session,
    get_current_session,
    get_current_user,
    require_role,
    require_user,
    require_workspace_context,
    resolve_workspace_context,
)
from .config import settings
from .db import (
    Base,
    engine,
    get_db,
    SessionLocal,
    reset_current_workspace_id,
    set_current_workspace_id,
)
from .email_utils import generate_email_draft, send_email_smtp, test_smtp_connection
from base64 import b64encode, b64decode
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
WORKSPACE_SCOPED_TABLES = [
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


def _slugify_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return cleaned or "workspace"


def _create_sqlite_snapshot(source_db: Path, target_db: Path):
    source_conn = sqlite3.connect(str(source_db))
    try:
        target_conn = sqlite3.connect(str(target_db))
        try:
            source_conn.backup(target_conn)
        finally:
            target_conn.close()
    finally:
        source_conn.close()


def _create_workspace_sqlite_snapshot(source_db: Path, target_db: Path, workspace_id: int):
    _create_sqlite_snapshot(source_db, target_db)
    conn = sqlite3.connect(str(target_db))
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=OFF")
        for table_name in WORKSPACE_SCOPED_TABLES:
            cur.execute(f"DELETE FROM {table_name} WHERE workspace_id != ?", (workspace_id,))
        cur.execute("DELETE FROM workspace_memberships WHERE workspace_id != ?", (workspace_id,))
        cur.execute("DELETE FROM workspaces WHERE id != ?", (workspace_id,))
        cur.execute("SELECT DISTINCT user_id FROM workspace_memberships WHERE workspace_id = ?", (workspace_id,))
        user_ids = [row[0] for row in cur.fetchall()]
        if user_ids:
            placeholders = ",".join("?" for _ in user_ids)
            cur.execute(f"DELETE FROM users WHERE id NOT IN ({placeholders})", tuple(user_ids))
            cur.execute(
                f"DELETE FROM user_sessions WHERE user_id NOT IN ({placeholders})",
                tuple(user_ids),
            )
            cur.execute(
                "UPDATE user_sessions SET active_workspace_id = ? WHERE user_id IN "
                f"({placeholders})",
                tuple([workspace_id, *user_ids]),
            )
        else:
            cur.execute("DELETE FROM users")
            cur.execute("DELETE FROM user_sessions")
        cur.execute("PRAGMA foreign_keys=ON")
        conn.commit()
    finally:
        conn.close()


def _workspace_upload_paths(db: Session, workspace_id: int) -> set[str]:
    proposal_paths = (
        db.query(models.ProposalAttachment.file_path)
        .filter(models.ProposalAttachment.workspace_id == workspace_id)
        .all()
    )
    receipt_paths = (
        db.query(models.ExpenseReceipt.file_path)
        .filter(models.ExpenseReceipt.workspace_id == workspace_id)
        .all()
    )
    return {
        str(path)
        for (path,) in [*proposal_paths, *receipt_paths]
        if path
    }


def _delete_upload_paths(paths: set[str]):
    for relative in paths:
        clean = str(relative).strip()
        if clean.startswith("uploads/"):
            clean = clean[len("uploads/"):]
        target = (UPLOADS_DIR / clean).resolve()
        try:
            target.relative_to(UPLOADS_DIR.resolve())
        except ValueError:
            continue
        if target.exists() and target.is_file():
            target.unlink(missing_ok=True)


def _copy_workspace_uploads_to_temp(paths: set[str], destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    for relative in paths:
        clean = str(relative).strip()
        if clean.startswith("uploads/"):
            clean = clean[len("uploads/"):]
        source = (UPLOADS_DIR / clean).resolve()
        try:
            source.relative_to(UPLOADS_DIR.resolve())
        except ValueError:
            continue
        if not source.exists() or not source.is_file():
            continue
        target = destination / clean
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())

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
        if request.url.path in {"/proposals/uploads", "/admin/restore/upload", "/expenses/uploads"}:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_UPLOAD_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Upload exceeds size limit."})
    return await call_next(request)


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _AUTH_ALLOWLIST:
        return await call_next(request)
    db = SessionLocal()
    workspace_token = None
    context_error = None
    try:
        session = get_current_session(request, db)
        user = session.user if session else None
        if user:
            try:
                context = resolve_workspace_context(db, user, session)
            except HTTPException as exc:
                context_error = exc
            else:
                request.state.workspace_context = context
                workspace_token = set_current_workspace_id(context.workspace.id)
    finally:
        db.close()
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    if context_error:
        return JSONResponse(status_code=context_error.status_code, content={"detail": context_error.detail})
    request.state.user = user
    try:
        return await call_next(request)
    finally:
        if workspace_token is not None:
            reset_current_workspace_id(workspace_token)


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


@app.post("/settings/smtp/test")
def test_smtp(user=Depends(require_role(["owner", "admin"]))):
    ok, message = test_smtp_connection()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return {"status": "ok", "message": message}


@app.post("/admin/backup")
def create_backup(
    payload: schemas.BackupRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner", "admin"])),
    context=Depends(require_workspace_context),
):
    import tarfile
    import tempfile

    source_db = _resolve_db_path()
    if not source_db.exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    if not payload.download and not payload.store:
        raise HTTPException(status_code=400, detail="Select download and/or store.")

    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    workspace_part = _slugify_filename_part(context.workspace.name)
    if payload.scope == "tenant":
        backup_name = f"cms-tenant-{timestamp}.tar.gz"
    else:
        backup_name = f"cms-workspace-{workspace_part}-{timestamp}.tar.gz"

    if payload.store:
        backup_path = BACKUP_DIR / backup_name
    else:
        temp_file = tempfile.NamedTemporaryFile(prefix="cms-", suffix=".tar.gz", delete=False)
        backup_path = Path(temp_file.name)
        temp_file.close()

    with tempfile.NamedTemporaryFile(prefix="cms-db-snapshot-", suffix=".db", delete=False) as snapshot_file:
        snapshot_path = Path(snapshot_file.name)
    workspace_upload_dir = Path(
        tempfile.mkdtemp(prefix="cms-workspace-uploads-")
    ) if payload.scope == "workspace" else None
    try:
        if payload.scope == "workspace":
            _create_workspace_sqlite_snapshot(source_db, snapshot_path, context.workspace.id)
        else:
            _create_sqlite_snapshot(source_db, snapshot_path)
        with tarfile.open(backup_path, "w:gz") as tar:
            tar.add(str(snapshot_path), arcname="app.db")
            if payload.scope == "workspace":
                upload_paths = _workspace_upload_paths(db, context.workspace.id)
                if workspace_upload_dir is not None:
                    _copy_workspace_uploads_to_temp(upload_paths, workspace_upload_dir)
                    tar.add(str(workspace_upload_dir), arcname="uploads")
            elif UPLOADS_DIR.exists():
                tar.add(str(UPLOADS_DIR), arcname="uploads")
    finally:
        snapshot_path.unlink(missing_ok=True)
        if workspace_upload_dir and workspace_upload_dir.exists():
            for path in sorted(workspace_upload_dir.rglob("*"), reverse=True):
                if path.is_file():
                    path.unlink(missing_ok=True)
                elif path.is_dir():
                    path.rmdir()
            workspace_upload_dir.rmdir()

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

    return {"status": "stored", "filename": backup_name, "scope": payload.scope}


@app.get("/admin/backups")
def list_backups(user=Depends(require_role(["owner", "admin"]))):
    files = sorted(
        [p.name for p in BACKUP_DIR.glob("*.tar.gz") if p.is_file()],
        reverse=True,
    )
    return {"backups": files}


@app.post("/admin/restore")
def restore_backup(
    payload: schemas.RestoreRequest,
    user=Depends(require_role(["owner", "admin"])),
):
    if not payload.workspace_name.strip():
        raise HTTPException(status_code=400, detail="Workspace name is required.")
    archive_path = BACKUP_DIR / payload.filename
    _restore_from_archive(archive_path)
    db = SessionLocal()
    try:
        workspace = db.query(models.Workspace).order_by(models.Workspace.id.asc()).first()
        if workspace:
            workspace.name = payload.workspace_name.strip()
            workspace.slug = crud._ensure_workspace_slug(
                db, payload.workspace_name.strip(), exclude_workspace_id=workspace.id
            )
            db.commit()
    finally:
        db.close()
    return {
        "status": "restored",
        "source": "server",
        "filename": payload.filename,
        "workspace_name": payload.workspace_name.strip(),
    }


@app.post("/admin/restore/upload")
def restore_backup_upload(
    file: UploadFile = File(...),
    workspace_name: str = Form(...),
    user=Depends(require_role(["owner", "admin"])),
):
    import tempfile
    filename = file.filename or ""
    if not workspace_name.strip():
        raise HTTPException(status_code=400, detail="Workspace name is required.")
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
    db = SessionLocal()
    try:
        workspace = db.query(models.Workspace).order_by(models.Workspace.id.asc()).first()
        if workspace:
            workspace.name = workspace_name.strip()
            workspace.slug = crud._ensure_workspace_slug(
                db, workspace_name.strip(), exclude_workspace_id=workspace.id
            )
            db.commit()
    finally:
        db.close()
    return {"status": "restored", "source": "upload", "workspace_name": workspace_name.strip()}


@app.post("/admin/reset")
def reset_data(
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner", "admin"])),
    context=Depends(require_workspace_context),
):
    workspace_id = context.workspace.id
    upload_paths = _workspace_upload_paths(db, workspace_id)
    db.query(models.AgreementVersionCommentReaction).filter(models.AgreementVersionCommentReaction.workspace_id == workspace_id).delete()
    db.query(models.AgreementVersionComment).filter(models.AgreementVersionComment.workspace_id == workspace_id).delete()
    db.query(models.ProposalVersionCommentReaction).filter(models.ProposalVersionCommentReaction.workspace_id == workspace_id).delete()
    db.query(models.ProposalVersionComment).filter(models.ProposalVersionComment.workspace_id == workspace_id).delete()
    db.query(models.ServiceAgreementVersion).filter(models.ServiceAgreementVersion.workspace_id == workspace_id).delete()
    db.query(models.ProposalVersion).filter(models.ProposalVersion.workspace_id == workspace_id).delete()
    db.query(models.ExpenseReceipt).filter(models.ExpenseReceipt.workspace_id == workspace_id).delete()
    db.query(models.ProposalAttachment).filter(models.ProposalAttachment.workspace_id == workspace_id).delete()
    db.query(models.ProposalRequirement).filter(models.ProposalRequirement.workspace_id == workspace_id).delete()
    db.query(models.ServiceAgreementSLA).filter(models.ServiceAgreementSLA.workspace_id == workspace_id).delete()
    db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.workspace_id == workspace_id).delete()
    db.query(models.QuoteLineItem).filter(models.QuoteLineItem.workspace_id == workspace_id).delete()
    db.query(models.Proposal).filter(models.Proposal.workspace_id == workspace_id).delete()
    db.query(models.ServiceAgreement).filter(models.ServiceAgreement.workspace_id == workspace_id).delete()
    db.query(models.Invoice).filter(models.Invoice.workspace_id == workspace_id).delete()
    db.query(models.Quote).filter(models.Quote.workspace_id == workspace_id).delete()
    db.query(models.Expense).filter(models.Expense.workspace_id == workspace_id).delete()
    db.query(models.Client).filter(models.Client.workspace_id == workspace_id).delete()
    db.commit()
    _delete_upload_paths(upload_paths)

    return {"status": "reset", "workspace_id": workspace_id}


@app.post("/admin/reset-workspace")
def reset_workspace(
    payload: schemas.ResetWorkspaceRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner"])),
    context=Depends(require_workspace_context),
):
    workspace = crud.get_workspace(db, context.workspace.id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if payload.workspace_name_confirm.strip() != workspace.name.strip():
        raise HTTPException(status_code=400, detail="Workspace name confirmation does not match.")
    total_workspaces = db.query(models.Workspace).count()
    if total_workspaces <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining workspace.")
    upload_paths = _workspace_upload_paths(db, workspace.id)
    db.delete(workspace)
    db.commit()
    _delete_upload_paths(upload_paths)
    return {"status": "workspace_reset", "workspace_id": context.workspace.id}


@app.get("/auth/status", response_model=schemas.AuthStatus)
def auth_status(request: Request, db: Session = Depends(get_db)):
    needs_setup = db.query(models.User).count() == 0
    user = get_current_user(request, db) if request else None
    if not user:
        return schemas.AuthStatus(needs_setup=needs_setup, user=None, workspaces=[])
    session = get_current_session(request, db) if request else None
    context = resolve_workspace_context(db, user, session) if session else None
    workspaces = crud.list_workspaces_for_user(db, user.id)
    return schemas.AuthStatus(
        needs_setup=needs_setup,
        user=user,
        active_workspace=context.workspace if context else None,
        workspace_role=context.membership.role if context else None,
        workspaces=workspaces,
    )


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
    workspace_name = (payload.company_name or "").strip() or "Primary Workspace"
    workspace = crud.create_workspace(
        db,
        schemas.WorkspaceCreate(name=workspace_name, set_default=True),
        user,
    )
    settings_payload = schemas.SettingsUpdate(**settings_data)
    crud.update_settings(db, settings_payload, workspace_id=workspace.id)
    create_session(response, db, user, active_workspace_id=workspace.id)
    return schemas.AuthStatus(
        needs_setup=False,
        user=user,
        active_workspace=workspace,
        workspace_role="owner",
        workspaces=crud.list_workspaces_for_user(db, user.id),
    )


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
    memberships = crud.list_workspaces_for_user(db, user.id)
    default_membership = next((item for item in memberships if item.is_default), None) or (memberships[0] if memberships else None)
    active_workspace_id = default_membership.workspace_id if default_membership else None
    create_session(response, db, user, active_workspace_id=active_workspace_id)
    return schemas.AuthStatus(
        needs_setup=False,
        user=user,
        active_workspace=default_membership.workspace if default_membership else None,
        workspace_role=default_membership.role if default_membership else None,
        workspaces=memberships,
    )


@app.post("/auth/logout")
def auth_logout(response: Response, request: Request, db: Session = Depends(get_db)):
    clear_session(response, request, db)
    return {"status": "ok"}


@app.get("/workspaces", response_model=list[schemas.WorkspaceMembershipOut])
def list_workspaces(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return crud.list_workspaces_for_user(db, user.id)


@app.post("/workspaces", response_model=schemas.WorkspaceOut)
def create_workspace(
    payload: schemas.WorkspaceCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner", "admin"])),
):
    return crud.create_workspace(db, payload, user)


@app.patch("/workspaces/{workspace_id}", response_model=schemas.WorkspaceOut)
def update_workspace(
    workspace_id: int,
    payload: schemas.WorkspaceUpdate,
    db: Session = Depends(get_db),
    context=Depends(require_workspace_context),
):
    if context.membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    workspace = crud.get_workspace(db, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    membership = crud.get_workspace_membership(db, workspace_id, context.user.id)
    if not membership or not membership.is_active:
        raise HTTPException(status_code=403, detail="Forbidden")
    return crud.update_workspace(db, workspace, payload)


@app.post("/workspaces/switch", response_model=schemas.WorkspaceSwitchResponse)
def switch_workspace(
    payload: schemas.WorkspaceSwitchRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    session = get_current_session(request, db)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    membership = crud.get_workspace_membership(db, payload.workspace_id, user.id)
    if not membership or not membership.is_active:
        raise HTTPException(status_code=403, detail="No access to workspace")
    workspace = membership.workspace
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=403, detail="Workspace is inactive")
    crud.set_session_active_workspace(db, session, workspace.id)
    return schemas.WorkspaceSwitchResponse(
        active_workspace=workspace,
        membership_role=membership.role,
    )


@app.post("/workspaces/{workspace_id}/set-default", response_model=schemas.WorkspaceMembershipOut)
def set_default_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    membership = crud.get_workspace_membership(db, workspace_id, user.id)
    if not membership or not membership.is_active:
        raise HTTPException(status_code=403, detail="No access to workspace")
    updated = crud.set_default_workspace(db, user.id, workspace_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Workspace membership not found")
    return updated


@app.get("/workspaces/{workspace_id}/members", response_model=list[schemas.WorkspaceMembershipOut])
def list_workspace_members(
    workspace_id: int,
    db: Session = Depends(get_db),
    context=Depends(require_workspace_context),
):
    membership = crud.get_workspace_membership(db, workspace_id, context.user.id)
    if not membership or not membership.is_active:
        raise HTTPException(status_code=403, detail="Forbidden")
    if context.membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return crud.list_workspace_members(db, workspace_id)


@app.put("/workspaces/{workspace_id}/members/{user_id}", response_model=schemas.WorkspaceMembershipOut)
def update_workspace_member(
    workspace_id: int,
    user_id: int,
    payload: schemas.WorkspaceMembershipUpdate,
    db: Session = Depends(get_db),
    context=Depends(require_workspace_context),
):
    if context.membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    actor_membership = crud.get_workspace_membership(db, workspace_id, context.user.id)
    if not actor_membership or not actor_membership.is_active:
        raise HTTPException(status_code=403, detail="Forbidden")
    membership = crud.get_workspace_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    return crud.update_workspace_membership(db, membership, payload)


@app.delete("/workspaces/{workspace_id}/members/{user_id}")
def delete_workspace_member(
    workspace_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    context=Depends(require_workspace_context),
):
    if context.membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    membership = crud.get_workspace_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    crud.delete_workspace_membership(db, membership)
    return {"status": "deleted"}


@app.get("/auth/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner"])),
    context=Depends(require_workspace_context),
):
    return crud.list_users(db, workspace_id=context.workspace.id)


@app.get("/auth/users/assignable", response_model=list[schemas.UserOut])
def list_assignable_users(
    db: Session = Depends(get_db),
    user=Depends(require_user),
    context=Depends(require_workspace_context),
):
    return crud.list_active_users(db, workspace_id=context.workspace.id)


@app.get("/auth/users/search", response_model=list[schemas.UserSearchOut])
def search_users(
    q: str,
    db: Session = Depends(get_db),
    user=Depends(require_user),
    context=Depends(require_workspace_context),
):
    term = q.strip()
    if not term:
        return []
    results = (
        db.query(models.User)
        .join(models.WorkspaceMembership, models.WorkspaceMembership.user_id == models.User.id)
        .filter(models.User.is_active == True)  # noqa: E712
        .filter(
            models.WorkspaceMembership.workspace_id == context.workspace.id,
            models.WorkspaceMembership.is_active == True,  # noqa: E712
        )
        .filter(models.User.email.ilike(f"%{term}%"))
        .order_by(models.User.email.asc())
        .limit(10)
        .all()
    )
    return results


@app.post("/auth/users", response_model=schemas.UserOut)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner"])),
    context=Depends(require_workspace_context),
):
    if not password_meets_policy(payload.password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements.")
    existing = crud.get_user_by_email(db, payload.email)
    if existing:
        membership = crud.get_workspace_membership(db, context.workspace.id, existing.id)
        if membership:
            raise HTTPException(status_code=400, detail="User already exists in this workspace.")
        membership = models.WorkspaceMembership(
            workspace_id=context.workspace.id,
            user_id=existing.id,
            role=payload.role,
            is_active=payload.is_active,
            is_default=False,
        )
        db.add(membership)
        db.commit()
        db.refresh(existing)
        return existing
    return crud.create_user(db, payload, workspace_id=context.workspace.id)


@app.put("/auth/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner"])),
    context=Depends(require_workspace_context),
):
    target = crud.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    membership = crud.get_workspace_membership(db, context.workspace.id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.password and not password_meets_policy(payload.password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements.")
    return crud.update_user(db, target, payload)


@app.delete("/auth/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role(["owner"])),
    context=Depends(require_workspace_context),
):
    target = crud.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    membership = crud.get_workspace_membership(db, context.workspace.id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="User not found")
    crud.delete_workspace_membership(db, membership)
    remaining = db.query(models.WorkspaceMembership).filter(models.WorkspaceMembership.user_id == user_id).count()
    if remaining == 0:
        target = crud.get_user(db, user_id)
        if target:
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
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        created, first_invoice = crud.create_invoice(db, client_id, payload)
        if payload.send_now and first_invoice:
            to_email = client.invoice_email or client.contact_email or client.email
            if to_email:
                subject, body, pdf_bytes, pdf_filename = generate_email_draft(
                    "invoice", client, first_invoice
                )
                attachments = []
                if pdf_bytes:
                    attachments.append(
                        {
                            "content": pdf_bytes,
                            "filename": pdf_filename or "invoice.pdf",
                            "maintype": "application",
                            "subtype": "pdf",
                        }
                    )
                sent, _message = send_email_smtp(to_email, subject, body, attachments=attachments)
                if not sent:
                    first_invoice.status = "draft"
                    db.commit()
            else:
                first_invoice.status = "draft"
                db.commit()
        return created
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


@app.get("/payments", response_model=list[schemas.InvoicePaymentOut])
def list_payments(db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_payments(db)


@app.get("/invoices/{invoice_id}/payments", response_model=list[schemas.InvoicePaymentOut])
def list_invoice_payments(invoice_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice.payments


@app.post("/invoices/{invoice_id}/payments", response_model=schemas.InvoicePaymentOut)
def create_invoice_payment(
    invoice_id: int,
    payload: schemas.InvoicePaymentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return crud.create_invoice_payment(db, invoice, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    payment = db.query(models.InvoicePayment).filter(models.InvoicePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    crud.delete_invoice_payment(db, payment)
    return {"status": "deleted"}


@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(invoice)
    db.commit()
    return {"status": "deleted"}


@app.get("/credit-notes", response_model=list[schemas.CreditNoteOut])
def list_credit_notes(db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_credit_notes(db)


@app.post("/credit-notes", response_model=schemas.CreditNoteOut)
def create_credit_note(
    payload: schemas.CreditNoteCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        return crud.create_credit_note(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/credit-notes/{credit_note_id}", response_model=schemas.CreditNoteOut)
def get_credit_note(
    credit_note_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    credit_note = db.query(models.CreditNote).filter(models.CreditNote.id == credit_note_id).first()
    if not credit_note:
        raise HTTPException(status_code=404, detail="Credit note not found")
    return credit_note


@app.put("/credit-notes/{credit_note_id}", response_model=schemas.CreditNoteOut)
def update_credit_note(
    credit_note_id: int,
    payload: schemas.CreditNoteUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    credit_note = db.query(models.CreditNote).filter(models.CreditNote.id == credit_note_id).first()
    if not credit_note:
        raise HTTPException(status_code=404, detail="Credit note not found")
    return crud.update_credit_note(db, credit_note, payload)


@app.delete("/credit-notes/{credit_note_id}")
def delete_credit_note(
    credit_note_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    credit_note = db.query(models.CreditNote).filter(models.CreditNote.id == credit_note_id).first()
    if not credit_note:
        raise HTTPException(status_code=404, detail="Credit note not found")
    db.delete(credit_note)
    db.commit()
    return {"status": "deleted"}


@app.get("/refunds", response_model=list[schemas.RefundOut])
def list_refunds(db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_refunds(db)


@app.get("/tax/rates", response_model=schemas.TaxRateCatalog)
def get_tax_rates(db: Session = Depends(get_db), user=Depends(require_user)):
    catalog = crud.get_or_create_tax_rate_catalog(db)
    return schemas.TaxRateCatalog(
        version=schemas.TaxRateVersion(
            id=catalog.id,
            tax_year=catalog.tax_year,
            version_label=catalog.version_label,
            source_label=catalog.source_label,
            effective_date=catalog.effective_date,
            assumptions=catalog.assumptions or [],
            review_notes=catalog.review_notes,
            is_active=catalog.is_active,
            updated_at=catalog.updated_at,
            created_at=catalog.created_at,
        ),
        vat_rates=[schemas.VatCodeRule(**item) for item in (catalog.vat_rates or [])],
        direct_tax_rates=catalog.direct_tax_rates or {},
    )


@app.put("/tax/rates", response_model=schemas.TaxRateCatalog)
def update_tax_rates(
    payload: schemas.TaxRateCatalogUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role(["admin", "owner"])),
):
    catalog = crud.update_tax_rate_catalog(db, payload)
    return schemas.TaxRateCatalog(
        version=schemas.TaxRateVersion(
            id=catalog.id,
            tax_year=catalog.tax_year,
            version_label=catalog.version_label,
            source_label=catalog.source_label,
            effective_date=catalog.effective_date,
            assumptions=catalog.assumptions or [],
            review_notes=catalog.review_notes,
            is_active=catalog.is_active,
            updated_at=catalog.updated_at,
            created_at=catalog.created_at,
        ),
        vat_rates=[schemas.VatCodeRule(**item) for item in (catalog.vat_rates or [])],
        direct_tax_rates=catalog.direct_tax_rates or {},
    )


@app.get("/tax/vat-summary", response_model=schemas.VatSummaryOut)
def vat_summary(period: str = "all", db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_vat_summary(db, period=period)


@app.get("/tax/corporation-summary", response_model=schemas.CorporationTaxSummaryOut)
def corporation_tax_summary(period: str = "all", db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_corporation_tax_summary(db, period=period)


@app.get("/tax/direct-summary", response_model=schemas.DirectTaxSummaryOut)
def direct_tax_summary(period: str = "all", db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_direct_tax_summary(db, period=period)


@app.get("/tax/filing-pack", response_model=schemas.FilingPackResponse)
def filing_pack_summary(period: str = "all", db: Session = Depends(get_db), user=Depends(require_user)):
    return crud.get_filing_pack(db, period=period)


@app.get("/tax/filing-pack/export")
def filing_pack_export(
    period: str = "all",
    format: str = "zip",
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    normalized_period = crud._coerce_period(period)
    if normalized_period == "all":
        raise HTTPException(
            status_code=400,
            detail="Select a specific financial year before exporting the filing pack.",
        )
    if (format or "zip").strip().lower() not in {"zip"}:
        raise HTTPException(status_code=400, detail="Only ZIP export is supported for filing pack.")

    settings_row = crud.get_or_create_settings(db)
    period_start, period_end = crud._period_bounds(normalized_period, settings_row)
    invoices = [
        item
        for item in db.query(models.Invoice).all()
        if crud._in_period(item.issued_at, period_start, period_end)
    ]
    expenses = [
        item
        for item in db.query(models.Expense).all()
        if crud._in_period(item.incurred_date, period_start, period_end)
    ]

    def _dt(value):
        if not value:
            return ""
        return value.isoformat()

    def _money(value):
        return f"{float(value or 0):.2f}"

    def _csv_bytes(headers: list[str], rows: list[list[str]]):
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(headers)
        writer.writerows(rows)
        return stream.getvalue().encode("utf-8")

    if period_start:
        folder_name = f"FY{period_start.year}{str((period_start.year + 1) % 100).zfill(2)}"
    else:
        folder_name = normalized_period.replace("fy_", "FY")
    root = f"{folder_name}/"

    invoice_rows = []
    line_item_rows = []
    for invoice in sorted(invoices, key=lambda item: (item.issued_at or datetime.min, item.id)):
        client = getattr(invoice, "client", None)
        invoice_rows.append(
            [
                str(invoice.id),
                invoice.display_id or "",
                str(invoice.client_id or ""),
                getattr(client, "company", None) or getattr(client, "name", None) or "",
                invoice.title or "",
                str(invoice.status or "").title(),
                _dt(invoice.issued_at),
                _dt(invoice.due_date),
                _money(invoice.net_amount or invoice.amount),
                _money(invoice.tax_amount),
                _money(invoice.gross_amount or invoice.amount),
                _money(invoice.amount),
                invoice.notes or "",
            ]
        )
        for line in invoice.line_items or []:
            line_item_rows.append(
                [
                    str(invoice.id),
                    invoice.display_id or "",
                    str(line.id),
                    line.description or "",
                    str(float(line.quantity or 0)),
                    _money(line.unit_amount),
                    _money(line.net_amount),
                    _money(line.tax_amount),
                    _money(line.gross_amount),
                    str(line.tax_code or ""),
                    str(float(line.tax_rate or 0)),
                    str(line.tax_kind or ""),
                    "inclusive" if bool(line.tax_inclusive) else "exclusive",
                ]
            )

    expense_rows = []
    receipt_rows = []
    receipt_binary_items: list[tuple[str, bytes]] = []
    used_receipt_names: set[str] = set()
    for expense in sorted(expenses, key=lambda item: (item.incurred_date or datetime.min, item.id)):
        client = getattr(expense, "client", None)
        expense_rows.append(
            [
                str(expense.id),
                expense.display_id or "",
                str(expense.client_id or ""),
                getattr(client, "company", None) or getattr(client, "name", None) or "",
                expense.title or "",
                _dt(expense.incurred_date),
                _money(expense.net_amount or expense.amount),
                _money(expense.tax_amount),
                _money(expense.gross_amount or expense.amount),
                str(expense.tax_code or ""),
                str(float(expense.tax_rate or 0)),
                str(expense.tax_kind or ""),
                "inclusive" if bool(expense.tax_inclusive) else "exclusive",
                "yes" if bool(expense.vat_reclaimable) else "no",
                expense.notes or "",
            ]
        )
        for receipt in expense.receipts or []:
            receipt_name = _next_unique_filename(
                receipt.filename or Path(receipt.file_path or "").name or "receipt",
                used_receipt_names,
            )
            receipt_rows.append(
                [
                    str(expense.id),
                    expense.display_id or "",
                    str(receipt.id),
                    receipt.filename or "",
                    receipt.file_path or "",
                    f"receipts/{receipt_name}",
                ]
            )
            payload = _load_upload_attachment(receipt.file_path or "")
            if payload is not None:
                receipt_binary_items.append((receipt_name, payload))

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            f"{root}invoices/invoices.csv",
            _csv_bytes(
                [
                    "id",
                    "display_id",
                    "client_id",
                    "client_name",
                    "title",
                    "status",
                    "issued_at",
                    "due_date",
                    "net_amount",
                    "tax_amount",
                    "gross_amount",
                    "amount",
                    "notes",
                ],
                invoice_rows,
            ),
        )
        archive.writestr(
            f"{root}invoices/invoice_line_items.csv",
            _csv_bytes(
                [
                    "invoice_id",
                    "invoice_display_id",
                    "line_item_id",
                    "description",
                    "quantity",
                    "unit_amount",
                    "net_amount",
                    "tax_amount",
                    "gross_amount",
                    "tax_code",
                    "tax_rate",
                    "tax_kind",
                    "tax_mode",
                ],
                line_item_rows,
            ),
        )
        archive.writestr(
            f"{root}expenses/expenses.csv",
            _csv_bytes(
                [
                    "id",
                    "display_id",
                    "client_id",
                    "client_name",
                    "title",
                    "incurred_date",
                    "net_amount",
                    "tax_amount",
                    "gross_amount",
                    "tax_code",
                    "tax_rate",
                    "tax_kind",
                    "tax_mode",
                    "vat_reclaimable",
                    "notes",
                ],
                expense_rows,
            ),
        )
        archive.writestr(
            f"{root}expenses/expense_receipts.csv",
            _csv_bytes(
                [
                    "expense_id",
                    "expense_display_id",
                    "receipt_id",
                    "filename",
                    "file_path",
                    "bundle_path",
                ],
                receipt_rows,
            ),
        )
        archive.writestr(
            f"{root}expenses/receipts/README.txt",
            "Put expense receipt files in this folder if missing from export.",
        )
        for receipt_name, payload in receipt_binary_items:
            archive.writestr(f"{root}expenses/receipts/{receipt_name}", payload)
        archive.writestr(
            f"{root}bank-statements/README.txt",
            "Place bank statements for this filing period in this folder.",
        )
        archive.writestr(
            f"{root}P60s/README.txt",
            "Place payroll/P60 documents for this filing period in this folder.",
        )

    zip_filename = f"tax-filing-pack-{folder_name}.zip"
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


@app.post("/refunds", response_model=schemas.RefundOut)
def create_refund(
    payload: schemas.RefundCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        return crud.create_refund(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/refunds/{refund_id}", response_model=schemas.RefundOut)
def get_refund(refund_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    return refund


@app.put("/refunds/{refund_id}", response_model=schemas.RefundOut)
def update_refund(
    refund_id: int,
    payload: schemas.RefundUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    try:
        return crud.update_refund(db, refund, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/refunds/{refund_id}")
def delete_refund(refund_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    db.delete(refund)
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
def create_agreement(
    client_id: int,
    payload: schemas.AgreementCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    if not payload.quote_id:
        raise HTTPException(status_code=400, detail="Quote is required for a service agreement")
    quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
    if not quote:
        raise HTTPException(status_code=400, detail="Quote not found")
    if quote.client_id != client_id:
        raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.create_agreement(db, client_id, payload, user_id=user.id)


@app.get("/agreements/{agreement_id}", response_model=schemas.AgreementOut)
def get_agreement(agreement_id: int, db: Session = Depends(get_db)):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agreement


@app.put("/agreements/{agreement_id}", response_model=schemas.AgreementOut)
def update_agreement(
    agreement_id: int,
    payload: schemas.AgreementUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if payload.quote_id is not None:
        quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
        if not quote:
            raise HTTPException(status_code=400, detail="Quote not found")
        if quote.client_id != agreement.client_id:
            raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.update_agreement(db, agreement, payload, user_id=user.id)


@app.delete("/agreements/{agreement_id}")
def delete_agreement(agreement_id: int, db: Session = Depends(get_db)):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    db.delete(agreement)
    db.commit()
    return {"status": "deleted"}


@app.get("/agreements/{agreement_id}/versions", response_model=list[schemas.AgreementVersionOut])
def list_agreement_versions(
    agreement_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    versions = (
        db.query(models.ServiceAgreementVersion)
        .filter(models.ServiceAgreementVersion.agreement_id == agreement_id)
        .order_by(models.ServiceAgreementVersion.version_number.desc())
        .all()
    )
    for version in versions:
        version.is_current = version.version_number == agreement.current_version
    return versions


@app.post("/agreements/{agreement_id}/versions/{version_id}/restore", response_model=schemas.AgreementOut)
def restore_agreement_version(
    agreement_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    agreement = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    version = (
        db.query(models.ServiceAgreementVersion)
        .filter(models.ServiceAgreementVersion.id == version_id)
        .first()
    )
    if not version or version.agreement_id != agreement_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return crud.restore_agreement_version(db, agreement, version, user_id=user.id)


@app.get("/agreements/versions/{version_id}/comments", response_model=list[schemas.AgreementCommentOut])
def list_agreement_comments(
    version_id: int,
    field_key: str | None = None,
    all_versions: bool = False,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    version = (
        db.query(models.ServiceAgreementVersion)
        .filter(models.ServiceAgreementVersion.id == version_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    query = db.query(models.AgreementVersionComment)
    if all_versions:
        query = query.join(
            models.ServiceAgreementVersion,
            models.AgreementVersionComment.agreement_version_id
            == models.ServiceAgreementVersion.id,
        ).filter(models.ServiceAgreementVersion.agreement_id == version.agreement_id)
    else:
        query = query.filter(models.AgreementVersionComment.agreement_version_id == version_id)
    if field_key:
        query = query.filter(models.AgreementVersionComment.field_key == field_key)
    return query.order_by(models.AgreementVersionComment.created_at.asc()).all()


@app.post("/agreements/versions/{version_id}/comments", response_model=schemas.AgreementCommentOut)
def add_agreement_comment(
    version_id: int,
    payload: schemas.AgreementCommentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = models.AgreementVersionComment(
        agreement_version_id=version_id,
        field_key=payload.field_key,
        comment=payload.comment,
        mentions=payload.mentions or [],
        created_by_user_id=user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.patch("/agreements/comments/{comment_id}", response_model=schemas.AgreementCommentOut)
def update_agreement_comment_status(
    comment_id: int,
    payload: schemas.CommentStatusUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.AgreementVersionComment)
        .filter(models.AgreementVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.implemented = payload.implemented
    db.commit()
    db.refresh(comment)
    return comment


@app.delete("/agreements/comments/{comment_id}")
def delete_agreement_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.AgreementVersionComment)
        .filter(models.AgreementVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.created_by_user_id != user.id and user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    db.delete(comment)
    db.commit()
    return {"detail": "Comment deleted"}


@app.post("/agreements/comments/{comment_id}/reaction", response_model=schemas.AgreementCommentOut)
def react_agreement_comment(
    comment_id: int,
    payload: schemas.CommentReactionRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.AgreementVersionComment)
        .filter(models.AgreementVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    reaction = payload.reaction
    existing = (
        db.query(models.AgreementVersionCommentReaction)
        .filter(
            models.AgreementVersionCommentReaction.comment_id == comment_id,
            models.AgreementVersionCommentReaction.user_id == user.id,
        )
        .first()
    )
    if existing and existing.reaction == reaction:
        if reaction == "like":
            comment.like_count = max(0, comment.like_count - 1)
        else:
            comment.dislike_count = max(0, comment.dislike_count - 1)
        db.delete(existing)
    elif existing:
        if existing.reaction == "like":
            comment.like_count = max(0, comment.like_count - 1)
        else:
            comment.dislike_count = max(0, comment.dislike_count - 1)
        if reaction == "like":
            comment.like_count += 1
        else:
            comment.dislike_count += 1
        existing.reaction = reaction
    else:
        if reaction == "like":
            comment.like_count += 1
        else:
            comment.dislike_count += 1
        db.add(
            models.AgreementVersionCommentReaction(
                comment_id=comment_id, user_id=user.id, reaction=reaction
            )
        )
    db.commit()
    db.refresh(comment)
    return comment


@app.get("/proposals", response_model=list[schemas.ProposalOut])
def list_proposals(db: Session = Depends(get_db)):
    return db.query(models.Proposal).order_by(models.Proposal.created_at.desc()).all()


@app.post("/clients/{client_id}/proposals", response_model=schemas.ProposalOut)
def create_proposal(
    client_id: int,
    payload: schemas.ProposalCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    if not crud.get_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    if not payload.quote_id:
        raise HTTPException(status_code=400, detail="Quote is required for a proposal")
    quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
    if not quote:
        raise HTTPException(status_code=400, detail="Quote not found")
    if quote.client_id != client_id:
        raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.create_proposal(db, client_id, payload, user_id=user.id)


@app.get("/proposals/{proposal_id}", response_model=schemas.ProposalOut)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@app.put("/proposals/{proposal_id}", response_model=schemas.ProposalOut)
def update_proposal(
    proposal_id: int,
    payload: schemas.ProposalUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if payload.quote_id is not None:
        quote = db.query(models.Quote).filter(models.Quote.id == payload.quote_id).first()
        if not quote:
            raise HTTPException(status_code=400, detail="Quote not found")
        if quote.client_id != proposal.client_id:
            raise HTTPException(status_code=400, detail="Quote does not belong to this client")
    return crud.update_proposal(db, proposal, payload, user_id=user.id)


@app.delete("/proposals/{proposal_id}")
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    db.delete(proposal)
    db.commit()
    return {"status": "deleted"}


@app.get("/proposals/{proposal_id}/versions", response_model=list[schemas.ProposalVersionOut])
def list_proposal_versions(
    proposal_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    versions = (
        db.query(models.ProposalVersion)
        .filter(models.ProposalVersion.proposal_id == proposal_id)
        .order_by(models.ProposalVersion.version_number.desc())
        .all()
    )
    for version in versions:
        version.is_current = version.version_number == proposal.current_version
    return versions


@app.post("/proposals/{proposal_id}/versions/{version_id}/restore", response_model=schemas.ProposalOut)
def restore_proposal_version(
    proposal_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    version = (
        db.query(models.ProposalVersion)
        .filter(models.ProposalVersion.id == version_id)
        .first()
    )
    if not version or version.proposal_id != proposal_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return crud.restore_proposal_version(db, proposal, version, user_id=user.id)


@app.get("/proposals/versions/{version_id}/comments", response_model=list[schemas.ProposalCommentOut])
def list_proposal_comments(
    version_id: int,
    field_key: str | None = None,
    all_versions: bool = False,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    version = (
        db.query(models.ProposalVersion)
        .filter(models.ProposalVersion.id == version_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    query = db.query(models.ProposalVersionComment)
    if all_versions:
        query = query.join(
            models.ProposalVersion,
            models.ProposalVersionComment.proposal_version_id == models.ProposalVersion.id,
        ).filter(models.ProposalVersion.proposal_id == version.proposal_id)
    else:
        query = query.filter(models.ProposalVersionComment.proposal_version_id == version_id)
    if field_key:
        query = query.filter(models.ProposalVersionComment.field_key == field_key)
    return query.order_by(models.ProposalVersionComment.created_at.asc()).all()


@app.post("/proposals/versions/{version_id}/comments", response_model=schemas.ProposalCommentOut)
def add_proposal_comment(
    version_id: int,
    payload: schemas.ProposalCommentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = models.ProposalVersionComment(
        proposal_version_id=version_id,
        field_key=payload.field_key,
        comment=payload.comment,
        mentions=payload.mentions or [],
        created_by_user_id=user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.patch("/proposals/comments/{comment_id}", response_model=schemas.ProposalCommentOut)
def update_proposal_comment_status(
    comment_id: int,
    payload: schemas.CommentStatusUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.ProposalVersionComment)
        .filter(models.ProposalVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.implemented = payload.implemented
    db.commit()
    db.refresh(comment)
    return comment


@app.delete("/proposals/comments/{comment_id}")
def delete_proposal_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.ProposalVersionComment)
        .filter(models.ProposalVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.created_by_user_id != user.id and user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    db.delete(comment)
    db.commit()
    return {"detail": "Comment deleted"}


@app.post("/proposals/comments/{comment_id}/reaction", response_model=schemas.ProposalCommentOut)
def react_proposal_comment(
    comment_id: int,
    payload: schemas.CommentReactionRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    comment = (
        db.query(models.ProposalVersionComment)
        .filter(models.ProposalVersionComment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    reaction = payload.reaction
    existing = (
        db.query(models.ProposalVersionCommentReaction)
        .filter(
            models.ProposalVersionCommentReaction.comment_id == comment_id,
            models.ProposalVersionCommentReaction.user_id == user.id,
        )
        .first()
    )
    if existing and existing.reaction == reaction:
        if reaction == "like":
            comment.like_count = max(0, comment.like_count - 1)
        else:
            comment.dislike_count = max(0, comment.dislike_count - 1)
        db.delete(existing)
    elif existing:
        if existing.reaction == "like":
            comment.like_count = max(0, comment.like_count - 1)
        else:
            comment.dislike_count = max(0, comment.dislike_count - 1)
        if reaction == "like":
            comment.like_count += 1
        else:
            comment.dislike_count += 1
        existing.reaction = reaction
    else:
        if reaction == "like":
            comment.like_count += 1
        else:
            comment.dislike_count += 1
        db.add(
            models.ProposalVersionCommentReaction(
                comment_id=comment_id, user_id=user.id, reaction=reaction
            )
        )
    db.commit()
    db.refresh(comment)
    return comment


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


@app.post("/expenses/uploads")
def upload_expense_receipts(files: list[UploadFile] = File(...)):
    saved = []
    for uploaded in files:
        if not uploaded.filename:
            continue
        suffix = Path(uploaded.filename).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".pdf"}:
            raise HTTPException(status_code=400, detail="Only PDF or image files are supported.")
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
def create_email_draft(
    payload: schemas.EmailDraftRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
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
        status_value = "sent" if sent else "failed"
        _create_email_log(
            db,
            group_id=f"draft-{entity_type}-{entity.id}",
            client_id=getattr(client, "id", None),
            client_label=(client.company or client.name) if client else "Unassigned",
            to_email=payload.to_email,
            subject=subject,
            body=body,
            status=status_value,
            source="draft",
            entity_refs=[{"entity_type": entity_type, "entity_id": entity.id}],
            attachment_count=len(attachments),
            send_message=message,
            error_message=message if not sent else None,
            sent_at=datetime.utcnow() if sent else None,
            created_by_user_id=user.id,
        )
        if sent:
            if entity_type == "invoice" and entity.status != "paid":
                entity.status = "sent"
                db.commit()
            elif entity_type == "quote" and entity.status == "draft":
                entity.status = "sent"
                db.commit()
            elif entity_type == "proposal" and entity.status == "draft":
                entity.status = "sent"
                db.commit()
            else:
                db.commit()
        else:
            db.commit()
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


def _resolve_email_entity(db: Session, entity_type: str, entity_id: int):
    entity_type = (entity_type or "").lower().strip()
    entity = None
    client = None

    if entity_type == "invoice":
        entity = db.query(models.Invoice).filter(models.Invoice.id == entity_id).first()
    elif entity_type == "quote":
        entity = db.query(models.Quote).filter(models.Quote.id == entity_id).first()
    elif entity_type == "proposal":
        entity = db.query(models.Proposal).filter(models.Proposal.id == entity_id).first()
    elif entity_type == "agreement":
        entity = db.query(models.ServiceAgreement).filter(models.ServiceAgreement.id == entity_id).first()
    elif entity_type == "expense":
        entity = db.query(models.Expense).filter(models.Expense.id == entity_id).first()
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type: {entity_type}")

    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} {entity_id} not found")

    client = getattr(entity, "client", None)
    return entity_type, entity, client


def _entity_display_id(entity_type: str, entity):
    prefixes = {
        "invoice": "INV",
        "quote": "QUOTE",
        "proposal": "PROP",
        "agreement": "AGR",
        "expense": "EXP",
    }
    return getattr(entity, "display_id", None) or f"{prefixes.get(entity_type, 'DOC')}-{entity.id}"


def _load_upload_attachment(file_path: str):
    if not file_path:
        return None
    relative = file_path.replace("\\", "/").lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[len("uploads/"):]
    candidate = (UPLOADS_DIR / relative).resolve()
    try:
        candidate.relative_to(UPLOADS_DIR.resolve())
    except ValueError:
        return None
    if not candidate.exists() or not candidate.is_file():
        return None
    return candidate.read_bytes()


def _next_unique_filename(filename: str, used_names: set[str]):
    base_name = (filename or "attachment.pdf").strip() or "attachment.pdf"
    stem = Path(base_name).stem
    suffix = Path(base_name).suffix
    candidate = base_name
    index = 2
    while candidate.lower() in used_names:
        candidate = f"{stem}-{index}{suffix}"
        index += 1
    used_names.add(candidate.lower())
    return candidate


def _default_to_email_for_client(client):
    if not client:
        return None
    return client.invoice_email or client.contact_email or client.email


def _create_email_log(
    db: Session,
    *,
    group_id: str,
    client_id: int | None,
    client_label: str,
    to_email: str | None,
    subject: str,
    body: str,
    status: str,
    source: str,
    entity_refs: list[dict],
    attachment_count: int,
    send_message: str | None = None,
    provider_message_id: str | None = None,
    error_message: str | None = None,
    sent_at: datetime | None = None,
    delivered_at: datetime | None = None,
    created_by_user_id: int | None = None,
):
    if not _email_logs_enabled(db):
        return None
    log_row = models.EmailLog(
        group_id=group_id,
        client_id=client_id,
        client_label=client_label,
        to_email=to_email,
        subject=subject,
        body=body,
        status=status,
        source=source,
        entity_refs=entity_refs,
        attachment_count=attachment_count,
        send_message=send_message,
        provider_message_id=provider_message_id,
        error_message=error_message,
        sent_at=sent_at,
        delivered_at=delivered_at,
        created_by_user_id=created_by_user_id,
    )
    db.add(log_row)
    db.flush()
    return log_row


def _email_logs_enabled(db: Session) -> bool:
    bind = db.get_bind()
    if not bind:
        return False
    try:
        return inspect(bind).has_table("email_logs")
    except Exception:
        return False


@app.post("/email/compose", response_model=schemas.EmailComposeResponse)
def compose_email(
    payload: schemas.EmailComposeRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    settings_row = crud.get_or_create_settings(db)
    company_name = settings_row.company_name or "Your Company"

    deduped_items = []
    seen = set()
    for item in payload.items:
        key = (item.entity_type.lower().strip(), int(item.entity_id))
        if key in seen:
            continue
        seen.add(key)
        deduped_items.append(key)

    grouped = defaultdict(list)
    for entity_type, entity_id in deduped_items:
        resolved_type, entity, client = _resolve_email_entity(db, entity_type, entity_id)
        group_key = str(client.id) if client else "unassigned"
        grouped[group_key].append((resolved_type, entity, client))

    groups_out: list[schemas.EmailComposeGroup] = []
    sent_groups = 0
    failed_groups = 0
    total_attachments = 0

    for group_key, group_items in grouped.items():
        client = group_items[0][2] if group_items else None
        client_id = client.id if client else None
        client_label = (
            (client.company or client.name) if client else "Unassigned expenses"
        )
        to_default = _default_to_email_for_client(client)
        to_override = payload.to_email_overrides.get(group_key)
        to_email = to_override if to_override is not None else to_default

        entities_out: list[schemas.EmailComposeEntityOut] = []
        attachments_out: list[schemas.EmailComposeAttachment] = []
        used_filenames: set[str] = set()
        warnings: list[str] = []
        item_lines: list[str] = []
        first_subject = ""

        for entity_type, entity, item_client in group_items:
            subject, _body, pdf_bytes, pdf_filename = generate_email_draft(entity_type, item_client, entity)
            if not first_subject:
                first_subject = subject

            display_id = _entity_display_id(entity_type, entity)
            entities_out.append(
                schemas.EmailComposeEntityOut(
                    entity_type=entity_type,
                    entity_id=entity.id,
                    display_id=display_id,
                    title=getattr(entity, "title", None),
                )
            )
            item_lines.append(f"- {display_id} ({entity_type.title()})")

            if pdf_bytes:
                filename = _next_unique_filename(pdf_filename or f"{display_id}.pdf", used_filenames)
                attachments_out.append(
                    schemas.EmailComposeAttachment(
                        filename=filename,
                        entity_type=entity_type,
                        entity_id=entity.id,
                        source="generated_pdf",
                        content_base64=b64encode(pdf_bytes).decode("utf-8"),
                    )
                )

            if payload.include_proposal_assets and entity_type == "proposal":
                for attachment in getattr(entity, "attachments", []) or []:
                    if isinstance(attachment, dict):
                        file_path = attachment.get("file_path") or ""
                        attachment_filename = attachment.get("filename")
                    else:
                        file_path = getattr(attachment, "file_path", "") or ""
                        attachment_filename = getattr(attachment, "filename", None)
                    raw = _load_upload_attachment(file_path)
                    if raw is None:
                        warnings.append(
                            f"Could not load proposal attachment: {attachment_filename or file_path}"
                        )
                        continue
                    candidate_name = (
                        attachment_filename
                        or file_path.split("/")[-1]
                        or f"{display_id}-attachment"
                    )
                    filename = _next_unique_filename(candidate_name, used_filenames)
                    attachments_out.append(
                        schemas.EmailComposeAttachment(
                            filename=filename,
                            entity_type=entity_type,
                            entity_id=entity.id,
                            source="proposal_asset",
                            content_base64=b64encode(raw).decode("utf-8"),
                        )
                    )

        if len(group_items) == 1:
            suggested_subject = first_subject or f"Document update from {company_name}"
        else:
            suggested_subject = f"Documents for {client_label} from {company_name}"

        suggested_body = "\n".join(
            [
                f"Hi {client_label},",
                "",
                "Please find the following documents attached:",
                *item_lines,
                "",
                "Let me know if you have any questions.",
                "",
                "Best,",
                company_name,
            ]
        )

        subject = payload.subject_overrides.get(group_key) or suggested_subject
        body = payload.body_overrides.get(group_key) or suggested_body

        send_result = None
        if payload.send:
            if not to_email:
                warnings.append("No recipient email found for this group.")
                send_result = schemas.EmailComposeSendResult(
                    sent=False,
                    message="Recipient email is required for sending.",
                )
                _create_email_log(
                    db,
                    group_id=group_key,
                    client_id=client_id,
                    client_label=client_label,
                    to_email=to_email,
                    subject=subject,
                    body=body,
                    status="failed",
                    source="compose",
                    entity_refs=[
                        {"entity_type": entity_type, "entity_id": entity.id}
                        for entity_type, entity, _ in group_items
                    ],
                    attachment_count=len(attachments_out),
                    send_message="Recipient email is required for sending.",
                    error_message="Recipient email is required for sending.",
                    created_by_user_id=user.id,
                )
                db.commit()
                failed_groups += 1
            else:
                smtp_attachments = [
                    {
                        "content": b"" if not attachment.content_base64 else b64decode(attachment.content_base64),
                        "filename": attachment.filename,
                        "maintype": (mimetypes.guess_type(attachment.filename)[0] or "application/octet-stream").split("/")[0],
                        "subtype": (mimetypes.guess_type(attachment.filename)[0] or "application/octet-stream").split("/")[1],
                    }
                    for attachment in attachments_out
                ]
                sent, message = send_email_smtp(to_email, subject, body, attachments=smtp_attachments)
                send_result = schemas.EmailComposeSendResult(
                    sent=sent,
                    message=message,
                    sent_at=datetime.now(timezone.utc) if sent else None,
                )
                _create_email_log(
                    db,
                    group_id=group_key,
                    client_id=client_id,
                    client_label=client_label,
                    to_email=to_email,
                    subject=subject,
                    body=body,
                    status="sent" if sent else "failed",
                    source="compose",
                    entity_refs=[
                        {"entity_type": entity_type, "entity_id": entity.id}
                        for entity_type, entity, _ in group_items
                    ],
                    attachment_count=len(attachments_out),
                    send_message=message,
                    error_message=message if not sent else None,
                    sent_at=datetime.now(timezone.utc) if sent else None,
                    created_by_user_id=user.id,
                )
                if sent:
                    sent_groups += 1
                    for entity_type, entity, _ in group_items:
                        if entity_type == "invoice" and getattr(entity, "status", None) != "paid":
                            entity.status = "sent"
                        elif entity_type == "quote" and getattr(entity, "status", None) == "draft":
                            entity.status = "sent"
                        elif entity_type == "proposal" and getattr(entity, "status", None) == "draft":
                            entity.status = "sent"
                    db.commit()
                else:
                    db.commit()
                    failed_groups += 1

        total_attachments += len(attachments_out)
        groups_out.append(
            schemas.EmailComposeGroup(
                group_id=group_key,
                client_id=client_id,
                client_label=client_label,
                to_email_default=to_default,
                to_email=to_email,
                subject=subject,
                body=body,
                entities=entities_out,
                attachments=attachments_out,
                send_result=send_result,
                warnings=warnings,
            )
        )

    groups_out.sort(key=lambda item: (item.client_label.lower(), item.group_id))

    return schemas.EmailComposeResponse(
        groups=groups_out,
        summary=schemas.EmailComposeSummary(
            total_items=len(deduped_items),
            total_groups=len(groups_out),
            total_attachments=total_attachments,
            sent_groups=sent_groups,
            failed_groups=failed_groups,
        ),
    )


@app.get("/email/logs", response_model=list[schemas.EmailLogOut])
def list_email_logs(db: Session = Depends(get_db), user=Depends(require_user)):
    if not _email_logs_enabled(db):
        return []
    return (
        db.query(models.EmailLog)
        .order_by(models.EmailLog.created_at.desc(), models.EmailLog.id.desc())
        .all()
    )


@app.post("/email/logs/{log_id}/resend", response_model=schemas.EmailComposeResponse)
def resend_email_log(log_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    if not _email_logs_enabled(db):
        raise HTTPException(status_code=400, detail="Email logs are not initialized. Run migrations.")
    log_row = db.query(models.EmailLog).filter(models.EmailLog.id == log_id).first()
    if not log_row:
        raise HTTPException(status_code=404, detail="Email log not found")
    if not log_row.entity_refs:
        raise HTTPException(status_code=400, detail="Log does not include entities to resend.")

    payload = schemas.EmailComposeRequest(
        items=[
            schemas.EmailComposeItem(
                entity_type=item.get("entity_type", ""),
                entity_id=int(item.get("entity_id", 0)),
            )
            for item in (log_row.entity_refs or [])
            if item.get("entity_type") and item.get("entity_id")
        ],
        send=True,
        include_proposal_assets=True,
        to_email_overrides={log_row.group_id: log_row.to_email} if log_row.to_email else {},
        subject_overrides={log_row.group_id: log_row.subject},
        body_overrides={log_row.group_id: log_row.body},
    )
    if not payload.items:
        raise HTTPException(status_code=400, detail="Log does not include valid entities to resend.")
    return compose_email(payload=payload, db=db, user=user)


@app.post("/email/logs/resend/bulk", response_model=schemas.EmailComposeSummary)
def resend_email_logs_bulk(
    payload: schemas.EmailLogBulkActionRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    if not _email_logs_enabled(db):
        raise HTTPException(status_code=400, detail="Email logs are not initialized. Run migrations.")
    sent_groups = 0
    failed_groups = 0
    total_attachments = 0
    total_items = 0
    total_groups = 0

    for log_id in payload.log_ids:
        try:
            response = resend_email_log(log_id=log_id, db=db, user=user)
            sent_groups += int(response.summary.sent_groups or 0)
            failed_groups += int(response.summary.failed_groups or 0)
            total_attachments += int(response.summary.total_attachments or 0)
            total_items += int(response.summary.total_items or 0)
            total_groups += int(response.summary.total_groups or 0)
        except HTTPException:
            failed_groups += 1

    return schemas.EmailComposeSummary(
        total_items=total_items,
        total_groups=total_groups,
        total_attachments=total_attachments,
        sent_groups=sent_groups,
        failed_groups=failed_groups,
    )


@app.post("/email/logs/{log_id}/mark-delivered", response_model=schemas.EmailLogOut)
def mark_email_log_delivered(log_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    if not _email_logs_enabled(db):
        raise HTTPException(status_code=400, detail="Email logs are not initialized. Run migrations.")
    log_row = db.query(models.EmailLog).filter(models.EmailLog.id == log_id).first()
    if not log_row:
        raise HTTPException(status_code=404, detail="Email log not found")
    log_row.status = "delivered"
    log_row.delivered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(log_row)
    return log_row


@app.post("/email/logs/mark-delivered/bulk", response_model=list[schemas.EmailLogOut])
def mark_email_logs_delivered_bulk(
    payload: schemas.EmailLogBulkActionRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    if not _email_logs_enabled(db):
        raise HTTPException(status_code=400, detail="Email logs are not initialized. Run migrations.")
    logs = (
        db.query(models.EmailLog)
        .filter(models.EmailLog.id.in_(payload.log_ids))
        .all()
    )
    now = datetime.now(timezone.utc)
    for log_row in logs:
        log_row.status = "delivered"
        log_row.delivered_at = now
    db.commit()
    for log_row in logs:
        db.refresh(log_row)
    return logs
