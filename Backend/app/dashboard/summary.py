# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.services import dashboard_summary

router = APIRouter()

@router.get("/summary")
def summary(
    date: date = Query(default_factory=date.today),
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return dashboard_summary(db, user, date, lat=lat, lon=lon)
