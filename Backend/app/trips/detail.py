# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.db.models import Trip

router = APIRouter()

@router.get("/{trip_id}")
def detail(trip_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {
        "id": trip.id,
        "origin": {"lat": trip.origin_lat, "lng": trip.origin_lng},
        "destination": {"lat": trip.destination_lat, "lng": trip.destination_lng},
        "route_type": trip.route_type,
        "started_at": trip.started_at.isoformat() + "Z" if trip.started_at else None,
        "ended_at": trip.ended_at.isoformat() + "Z" if trip.ended_at else None,
        "duration_min": trip.duration_min,
        "distance_km": trip.distance_km,
        "pm25_inhaled": trip.pm25_inhaled,
        "pm25_avoided": trip.pm25_avoided,
        "co2_grams": trip.co2_grams,
        "heat_exposure": trip.heat_exposure,
        "noise_avg_db": trip.noise_avg_db,
        "ecoscore": trip.ecoscore,
        "polyline": trip.polyline,
        "vs_fastest": {
            "pm25_fastest": max((trip.pm25_inhaled or 0) + 230, 0),
            "pm25_reduction_percent": 67,
            "co2_fastest": trip.co2_grams,
            "time_added_min": 3,
        },
    }
