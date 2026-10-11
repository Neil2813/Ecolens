# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from jose import jwt, JWTError
from app.core.config import settings

def create_access_token(payload: Dict[str, Any], expires_hours: int | None = None) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=expires_hours or settings.JWT_EXPIRY_HOURS)
    to_encode = {**payload, "exp": expires}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_reset_token(payload: Dict[str, Any], minutes: int = 15) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode = {**payload, "exp": expires, "type": "password_reset"}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

def get_bearer_token(auth_header: str | None) -> str | None:
    if not auth_header:
        return None
    if not auth_header.lower().startswith("bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()

def safe_decode(token: str) -> Dict[str, Any] | None:
    try:
        return decode_token(token)
    except JWTError:
        return None
