from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from . import crud, models
from .config import settings
from .db import get_db
from .security import expires_at, generate_session_token, hash_token

SESSION_COOKIE = "session_token"


@dataclass
class WorkspaceContext:
    user: models.User
    session: models.UserSession
    workspace: models.Workspace
    membership: models.WorkspaceMembership


def _get_token_from_request(request: Request) -> Optional[str]:
    return request.cookies.get(SESSION_COOKIE)


def get_current_session(
    request: Request, db: Session = Depends(get_db)
) -> Optional[models.UserSession]:
    token = _get_token_from_request(request)
    if not token:
        return None
    token_hash = hash_token(token)
    session = crud.get_session_by_hash(db, token_hash)
    if not session:
        return None
    if session.expires_at < datetime.utcnow():
        crud.delete_session(db, session)
        return None
    return session


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[models.User]:
    session = get_current_session(request, db)
    if not session:
        return None
    return session.user


def require_user(user: models.User | None = Depends(get_current_user)) -> models.User:
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_role(roles: Iterable[str]):
    allowed_roles = set(roles)

    def _role_guard(
        request: Request,
        user: models.User = Depends(require_user),
    ) -> models.User:
        workspace_context = getattr(request.state, "workspace_context", None)
        effective_role = workspace_context.membership.role if workspace_context else user.role
        if effective_role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return _role_guard


def resolve_workspace_context(
    db: Session,
    user: models.User,
    session: models.UserSession,
) -> WorkspaceContext:
    memberships = (
        db.query(models.WorkspaceMembership)
        .filter(
            models.WorkspaceMembership.user_id == user.id,
            models.WorkspaceMembership.is_active == True,  # noqa: E712
        )
        .order_by(
            models.WorkspaceMembership.is_default.desc(),
            models.WorkspaceMembership.id.asc(),
        )
        .all()
    )
    if not memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No workspace access.")

    membership_by_workspace = {membership.workspace_id: membership for membership in memberships}
    membership = None
    if session.active_workspace_id:
        membership = membership_by_workspace.get(session.active_workspace_id)
    if membership is None:
        membership = next((item for item in memberships if item.is_default), None) or memberships[0]
        session.active_workspace_id = membership.workspace_id
        db.commit()
        db.refresh(session)

    workspace = membership.workspace
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace is inactive.")

    return WorkspaceContext(
        user=user,
        session=session,
        workspace=workspace,
        membership=membership,
    )


def require_workspace_context(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user),
) -> WorkspaceContext:
    context = getattr(request.state, "workspace_context", None)
    if context:
        return context
    session = get_current_session(request, db)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    context = resolve_workspace_context(db, user, session)
    request.state.workspace_context = context
    return context


def create_session(
    response: Response,
    db: Session,
    user: models.User,
    active_workspace_id: int | None = None,
):
    token = generate_session_token()
    token_hash = hash_token(token)
    crud.create_session(db, user, token_hash, expires_at(), active_workspace_id=active_workspace_id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.session_secure,
        max_age=settings.session_ttl_hours * 3600,
    )


def clear_session(response: Response, request: Request, db: Session):
    token = _get_token_from_request(request)
    if token:
        token_hash = hash_token(token)
        session = crud.get_session_by_hash(db, token_hash)
        if session:
            crud.delete_session(db, session)
    response.delete_cookie(SESSION_COOKIE)
