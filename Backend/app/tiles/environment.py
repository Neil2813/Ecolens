# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.services import bbox_to_features

router = APIRouter()

@router.get("/environment")
def environment(
    bbox: str = Query(..., description="min_lng,min_lat,max_lng,max_lat"),
    layers: str | None = None,
    forecast_hours: int = Query(default=0, description="Offset hours to forecast"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        layer_list = [x.strip() for x in layers.split(",") if x.strip()] if layers else None
        return bbox_to_features(db, bbox, layer_list, forecast_hours=forecast_hours)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bbox")
