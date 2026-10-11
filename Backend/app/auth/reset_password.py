# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.common import ResetPasswordRequest
from app.db.models import User
from app.utils.jwt_handler import safe_decode
from app.utils.argon2_handler import hash_password

router = APIRouter()

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    data = safe_decode(payload.reset_token)
    if not data or data.get("type") != "password_reset":
        raise HTTPException(status_code=401, detail="Invalid reset token")
    email = data.get("email")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid reset token")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
