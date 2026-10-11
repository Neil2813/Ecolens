# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.route import RerouteRequest
from app.utils.auth_dep import get_current_user
from app.services import generate_reroute

router = APIRouter()

@router.post("/reroute")
def reroute(payload: RerouteRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return generate_reroute(
        db,
        payload.current_position.model_dump(),
        payload.destination.model_dump(),
        payload.original_route_type,
        payload.reason,
    )
