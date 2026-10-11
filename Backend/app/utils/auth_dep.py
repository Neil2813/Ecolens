# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import uuid
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.jwt_handler import get_bearer_token, safe_decode
from app.db.models import User

DEMO_USER_ID = "a0000000-0000-0000-0000-000000000001"


def _ensure_valid_uuid(val: str) -> str:
    try:
        return str(uuid.UUID(str(val)))
    except Exception:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(val)))


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    token = get_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    # Handle demo mode token with guaranteed RFC 4122 UUID
    if token == "demo":
        user = db.query(User).filter(User.id == DEMO_USER_ID).first()
        if not user:
            user = User(
                id=DEMO_USER_ID,
                email="demo@ecolens.app",
                password_hash="demo_password",
                name="Demo User",
                city="Bengaluru"
            )
            try:
                db.add(user)
                db.commit()
                db.refresh(user)
            except Exception:
                db.rollback()
                user = db.query(User).filter(User.id == DEMO_USER_ID).first()
        return user

    payload = safe_decode(token)
    if not payload or payload.get("user_id") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    raw_user_id = str(payload["user_id"])
    user_id = _ensure_valid_uuid(raw_user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Auto-provision fallback user in SQLite fallback mode so active sessions aren't dropped
        user = User(
            id=user_id,
            email=payload.get("email", f"user_{user_id[:8]}@ecolens.app"),
            password_hash="fallback_mode_password",
            name=payload.get("name", "EcoLens Explorer"),
            city="Bengaluru"
        )
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
