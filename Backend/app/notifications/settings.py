# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.profile import NotificationSettingsRequest

router = APIRouter()

@router.patch("/settings")
def settings_update(payload: NotificationSettingsRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    user.notifications_pollution = payload.pollution_alerts
    user.notifications_forecast = payload.forecast_reminders
    user.notifications_weekly = payload.weekly_summary
    user.notifications_reroute_suggestions = payload.reroute_suggestions
    user.notifications_daily_report = payload.daily_report
    db.commit()
    return payload.model_dump()
