# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.common import RegisterRequest
from app.db.models import User
from app.services import create_user, create_tokens_for_user, user_to_dict

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = create_user(
        db,
        payload.name,
        payload.email,
        payload.password,
        use_everyday=payload.use_everyday,
        commute_destination=payload.commute_destination,
        commute_destination_coords=payload.commute_destination_coords
    )
    return {"token": create_tokens_for_user(user), "user": user_to_dict(user)}
