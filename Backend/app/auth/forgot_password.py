# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from datetime import datetime, timedelta
import random
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.common import ForgotPasswordRequest
from app.db.models import User, OTPToken

router = APIRouter()

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    code = f"{random.randint(0, 999999):06d}"
    db.query(OTPToken).filter(OTPToken.email == payload.email, OTPToken.used == False).delete(synchronize_session=False)  # noqa: E712
    otp = OTPToken(
        email=payload.email,
        otp_code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        used=False,
        user_id=user.id if user else None,
    )
    db.add(otp)
    db.commit()
    return {"message": "If this email exists, an OTP has been sent"}
