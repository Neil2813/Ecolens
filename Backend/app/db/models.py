# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from datetime import datetime, timezone
import uuid
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.session import Base

def _uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False, default="Chennai")
    default_route_preference = Column(String(20), nullable=False, default="cleanest_air")
    theme = Column(String(10), nullable=False, default="dark")
    push_subscription = Column(Text, nullable=True)
    notifications_pollution = Column(Boolean, nullable=False, default=True)
    notifications_forecast = Column(Boolean, nullable=False, default=True)
    notifications_weekly = Column(Boolean, nullable=False, default=True)
    notifications_reroute_suggestions = Column(Boolean, nullable=False, default=True)
    notifications_daily_report = Column(Boolean, nullable=False, default=True)
    use_everyday = Column(Boolean, nullable=False, default=False)
    commute_destination = Column(String(255), nullable=True)
    commute_destination_coords = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")
    exposures = relationship("DailyExposure", back_populates="user", cascade="all, delete-orphan")
    forecasts = relationship("LSTMForecast", back_populates="user", cascade="all, delete-orphan")
    otps = relationship("OTPToken", back_populates="user", cascade="all, delete-orphan")

class OTPToken(Base):
    __tablename__ = "otp_tokens"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="otps")

class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    route_type = Column(String(20), nullable=False)
    duration_min = Column(Integer, nullable=True)
    distance_km = Column(Float, nullable=True)
    pm25_inhaled = Column(Float, nullable=True)
    pm25_avoided = Column(Float, nullable=True)
    co2_grams = Column(Float, nullable=True)
    ecoscore = Column(Integer, nullable=True)
    polyline = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    heat_exposure = Column(Float, nullable=True)
    noise_avg_db = Column(Float, nullable=True)
    no2_exposure = Column(Float, nullable=True, default=0)

    user = relationship("User", back_populates="trips")

class DailyExposure(Base):
    __tablename__ = "daily_exposure"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    total_pm25 = Column(Float, nullable=False, default=0)
    avoided_pm25 = Column(Float, nullable=False, default=0)
    total_co2 = Column(Float, nullable=False, default=0)
    city_avg_co2 = Column(Float, nullable=False, default=0)
    ecoscore = Column(Integer, nullable=False, default=0)
    heat_exposure = Column(Float, nullable=False, default=0)
    noise_avg_db = Column(Float, nullable=False, default=0)
    total_no2 = Column(Float, nullable=False, default=0)

    user = relationship("User", back_populates="exposures")

class LSTMForecast(Base):
    __tablename__ = "lstm_forecasts"
    __table_args__ = (UniqueConstraint("user_id", "forecast_date", name="uq_user_forecast_date"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)
    risk_level = Column(String(10), nullable=False)
    recommended_departure = Column(String(10), nullable=False)
    recommended_route = Column(Text, nullable=False)
    predicted_pm25 = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="forecasts")

class EnvironmentalSegment(Base):
    __tablename__ = "environmental_segments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    segment_id = Column(String(50), unique=True, nullable=False, index=True)
    geom = Column(Text().with_variant(Geometry("LINESTRING", srid=4326), "postgresql"), nullable=True)
    pm25 = Column(Float, nullable=False, default=0)
    no2 = Column(Float, nullable=False, default=0)
    carbon_intensity = Column(String(10), nullable=False, default="medium")
    co2_per_min = Column(Float, nullable=False, default=0)
    ndvi = Column(Float, nullable=False, default=0)
    noise_db = Column(Float, nullable=False, default=0)
    heat_anomaly = Column(Float, nullable=False, default=0)
    ecoscore = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class LiveEnvironmentalReading(Base):
    """Persists a single parameter reading fetched from a live environmental API.

    Keyed by (lat, lon, source, parameter) with a fetched_at timestamp so that
    the aggregator can determine data freshness before hitting external APIs again.
    """
    __tablename__ = "live_environmental_readings"
    __table_args__ = (
        UniqueConstraint("lat", "lon", "source", "parameter", name="uq_live_reading"),
    )

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    # Rounded to 2 dp (~1.1 km precision) for locality grouping
    lat = Column(Float, nullable=False, index=True)
    lon = Column(Float, nullable=False, index=True)
    # e.g. "open_meteo_aq", "openaq", "waqi", "usgs", "nasa_eonet", "open_meteo_soil"
    source = Column(String(30), nullable=False)
    # e.g. "pm25", "no2", "temperature", "soil_moisture_0_1cm", "aqi"
    parameter = Column(String(40), nullable=False)
    value = Column(Float, nullable=True)
    unit = Column(String(20), nullable=True)
    raw_json = Column(Text, nullable=True)  # full raw payload for debugging
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)
