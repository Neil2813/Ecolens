# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.services import pollution_for_segments

router = APIRouter()

@router.get("/pollution")
def pollution(segment_ids: str = Query(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    ids = [x.strip() for x in segment_ids.split(",") if x.strip()]
    return pollution_for_segments(db, ids)
