# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.profile import DeleteProfileRequest
from app.utils.argon2_handler import verify_password
from app.db.models import User, OTPToken, Trip, DailyExposure, LSTMForecast

router = APIRouter()

@router.delete("")
def delete_profile(payload: DeleteProfileRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not verify_password(payload.confirm_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
    db.query(LSTMForecast).filter(LSTMForecast.user_id == user.id).delete(synchronize_session=False)
    db.query(DailyExposure).filter(DailyExposure.user_id == user.id).delete(synchronize_session=False)
    db.query(Trip).filter(Trip.user_id == user.id).delete(synchronize_session=False)
    db.query(OTPToken).filter(OTPToken.email == user.email).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return {"message": "Account permanently deleted"}
