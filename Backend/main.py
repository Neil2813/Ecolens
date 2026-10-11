# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import init_db
from app.scheduler import start_scheduler, stop_scheduler

from app.auth import register, login, logout, forgot_password, verify_otp, reset_password
from app.routes import generate, reroute, assistant, travel, audio_tour
from app.tiles import environment
from app.segments import pollution
from app.exposure import calculate
from app.dashboard import summary
from app.alerts import push
from app.profile import get, update, delete
from app.trips import history, detail
from app.notifications import settings as notification_settings
from app.environmental import router as env_router

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    init_db()
    if settings.ENABLE_SCHEDULER:
        start_scheduler()

@app.on_event("shutdown")
async def on_shutdown():
    stop_scheduler()

# Auth
app.include_router(register.router, prefix="/api/auth", tags=["Auth"])
app.include_router(login.router, prefix="/api/auth", tags=["Auth"])
app.include_router(logout.router, prefix="/api/auth", tags=["Auth"])
app.include_router(forgot_password.router, prefix="/api/auth", tags=["Auth"])
app.include_router(verify_otp.router, prefix="/api/auth", tags=["Auth"])
app.include_router(reset_password.router, prefix="/api/auth", tags=["Auth"])

# Routes
app.include_router(generate.router, prefix="/api/routes", tags=["Routes"])
app.include_router(reroute.router, prefix="/api/routes", tags=["Routes"])

# Environmental tiles
app.include_router(environment.router, prefix="/api/tiles", tags=["Tiles"])

# Segments
app.include_router(pollution.router, prefix="/api/segments", tags=["Segments"])

# Exposure
app.include_router(calculate.router, prefix="/api/exposure", tags=["Exposure"])

# Dashboard
app.include_router(summary.router, prefix="/api/dashboard", tags=["Dashboard"])

# Alerts
app.include_router(push.router, prefix="/api/alerts", tags=["Alerts"])

# Profile
app.include_router(get.router, prefix="/api/profile", tags=["Profile"])
app.include_router(update.router, prefix="/api/profile", tags=["Profile"])
app.include_router(delete.router, prefix="/api/profile", tags=["Profile"])

# Trips
app.include_router(history.router, prefix="/api/trips", tags=["Trips"])
app.include_router(detail.router, prefix="/api/trips", tags=["Trips"])

# Notifications
app.include_router(notification_settings.router, prefix="/api/notifications", tags=["Notifications"])

# Live environmental data (Open-Meteo, OpenAQ, WAQI, USGS, NASA EONET)
app.include_router(env_router.router, prefix="/api/env", tags=["Environment"])

# Assistant
app.include_router(assistant.router, prefix="/api/assistant", tags=["Assistant"])

# Travel Planner (Multi-Agent)
app.include_router(travel.router, prefix="/api/travel", tags=["Travel Planner"])

# Audio Tour (Multi-Agent)
app.include_router(audio_tour.router, prefix="/api/tour", tags=["Audio Tour"])

@app.get("/")
def root():
    return {"status": "EcoLens API is running", "version": app.version}
