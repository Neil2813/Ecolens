# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from typing import Optional
from pydantic import BaseModel

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    default_route_preference: Optional[str] = None
    theme: Optional[str] = None

class DeleteProfileRequest(BaseModel):
    confirm_password: str

class NotificationSettingsRequest(BaseModel):
    pollution_alerts: bool
    forecast_reminders: bool
    weekly_summary: bool
    reroute_suggestions: bool
    daily_report: bool
