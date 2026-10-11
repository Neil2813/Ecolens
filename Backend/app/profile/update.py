# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.profile import ProfileUpdateRequest
from app.services import profile_to_dict

router = APIRouter()

@router.patch("")
def update_profile(payload: ProfileUpdateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return profile_to_dict(user)
