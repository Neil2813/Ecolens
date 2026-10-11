# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.db.models import Trip

router = APIRouter()

@router.get("/history")
def history(page: int = 1, limit: int = 20, filter: str = Query(default="all"), db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.started_at.desc())
    trips = q.offset((page - 1) * limit).limit(limit).all()
    total = q.count()
    return {
        "trips": [
            {
                "id": t.id,
                "route_type": t.route_type,
                "started_at": t.started_at.isoformat() + "Z" if t.started_at else None,
                "duration_min": t.duration_min,
                "distance_km": t.distance_km,
                "pm25_inhaled": t.pm25_inhaled,
                "pm25_avoided": t.pm25_avoided,
                "co2_grams": t.co2_grams,
                "ecoscore": t.ecoscore,
            }
            for t in trips
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }
