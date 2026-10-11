# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.services import profile_to_dict

router = APIRouter()

@router.get("")
def get_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return profile_to_dict(user)
