# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.common import VerifyOtpRequest
from app.db.models import OTPToken
from app.utils.jwt_handler import create_reset_token

router = APIRouter()

@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    otp = (
        db.query(OTPToken)
        .filter(OTPToken.email == payload.email, OTPToken.used == False, OTPToken.expires_at > __import__("datetime").datetime.utcnow())  # noqa: E712
        .order_by(OTPToken.expires_at.desc())
        .first()
    )
    if not otp or otp.otp_code != payload.otp_code:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    otp.used = True
    db.commit()
    return {"reset_token": create_reset_token({"email": payload.email})}
