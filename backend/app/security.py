from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional

from argon2 import PasswordHasher
from cryptography.fernet import Fernet

from .config import settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except Exception:
        return False


def password_meets_policy(password: str) -> bool:
    if len(password) < 9:
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(not char.isalnum() for char in password):
        return False
    return True


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    secret = settings.app_secret or ""
    key = hashlib.sha256(secret.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    token = _fernet().encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")


def expires_at(hours: int | None = None) -> datetime:
    ttl = hours if hours is not None else settings.session_ttl_hours
    return datetime.utcnow() + timedelta(hours=ttl)


def compare_hash(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
