# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Header, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.jwt_handler import get_bearer_token, safe_decode

router = APIRouter()

@router.post("/logout")
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    token = get_bearer_token(authorization)
    if token:
        safe_decode(token)
    return {"message": "Logged out successfully"}
