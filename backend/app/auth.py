from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from . import crud, models
from .db import get_db
from .security import compare_hash, expires_at, generate_session_token, hash_token
from .config import settings

SESSION_COOKIE = "session_token"


def _get_token_from_request(request: Request) -> Optional[str]:
    return request.cookies.get(SESSION_COOKIE)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[models.User]:
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
    return session.user


def require_user(user: models.User | None = Depends(get_current_user)) -> models.User:
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_role(roles: Iterable[str]):
    def _role_guard(user: models.User = Depends(require_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return _role_guard


def create_session(response: Response, db: Session, user: models.User):
    token = generate_session_token()
    token_hash = hash_token(token)
    crud.create_session(db, user, token_hash, expires_at())
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
