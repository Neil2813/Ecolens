# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.alerts import SubscribeRequest
from app.db.models import User

from app.utils.push_handler import ACTIVE_ANOMALIES, check_and_notify

router = APIRouter()

@router.post("/subscribe")
def subscribe(payload: SubscribeRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    user.push_subscription = payload.subscription.model_dump_json()
    db.commit()
    return {"message": "Push subscription saved"}

@router.get("/active")
def get_active_alerts(user=Depends(get_current_user)):
    # Dynamically warm up active anomalies before returning
    check_and_notify()
    return list(ACTIVE_ANOMALIES.values())

@router.post("/trigger")
def trigger(db: Session = Depends(get_db)):
    res = check_and_notify()
    return {"message": "Push check triggered", "results": res}
