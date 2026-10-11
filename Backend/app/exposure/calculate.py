# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.exposure import ExposureCalculateRequest
from app.services import calculate_exposure_from_trip

router = APIRouter()

@router.post("/calculate", status_code=201)
def calculate(payload: ExposureCalculateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return calculate_exposure_from_trip(db, user, payload.trip.model_dump())
