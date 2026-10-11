# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Central aggregator for all environmental data sources.

This is the single entrypoint for the rest of the application.
It coordinates fetching from all sources, applies the TTL cache,
and persists new readings to the LiveEnvironmentalReading DB table.

Source priority for air quality:
  1. OpenAQ v3 (station-level, government-grade) — if key configured
  2. WAQI (station-level, AQI index)              — if token configured
  3. Open-Meteo AQ (grid, 11 km resolution)       — always available, no key

Weather, soil, and events always use their single authoritative source.
"""

from __future__ import annotations
import concurrent.futures
import json
import logging
import threading
from datetime import datetime
from typing import Any

db_lock = threading.Lock()

from sqlalchemy.orm import Session
from app.db.session import SessionLocal

from app.db.models import LiveEnvironmentalReading
from app.environmental.cache import (
    _round_coord,
    aq_cache,
    events_cache,
    soil_cache,
    water_cache,
    weather_cache,
)
from app.environmental import (
    nasa_eonet,
    open_meteo_aq,
    open_meteo_soil,
    open_meteo_weather,
    openaq_client,
    usgs_water,
    waqi_client,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _persist_readings(
    db: Session | None,
    lat: float,
    lon: float,
    source: str,
    readings: dict[str, Any],
) -> None:
    """Upsert scalar readings from a fetched dict into LiveEnvironmentalReading."""
    # Round for DB key consistency
    rlat, rlon = _round_coord(lat, lon)
    now = datetime.utcnow()

    skip_keys = {"source", "station", "station_id", "distance_km", "site_name",
                 "site_code", "aqi", "weather_label", "weather_code",
                 "events", "events_found"}

    with db_lock:
        local_db = SessionLocal()
        try:
            for key, val in readings.items():
                if key in skip_keys or key.endswith("_unit") or not isinstance(val, (int, float)):
                    continue
                try:
                    existing = (
                        local_db.query(LiveEnvironmentalReading)
                        .filter_by(lat=rlat, lon=rlon, source=source, parameter=key)
                        .first()
                    )
                    if existing:
                        existing.value = float(val)
                        existing.fetched_at = now
                    else:
                        local_db.add(LiveEnvironmentalReading(
                            lat=rlat, lon=rlon,
                            source=source, parameter=key,
                            value=float(val),
                            unit=readings.get(f"{key}_unit", ""),
                            raw_json=json.dumps({key: val}),
                            fetched_at=now,
                        ))
                except Exception as exc:
                    logger.debug("Could not persist reading %s/%s: %s", source, key, exc)

            local_db.commit()
        except Exception as exc:
            logger.warning("DB commit failed for live readings: %s", exc)
            local_db.rollback()
        finally:
            local_db.close()


def _merge_aq(om: dict, openaq: dict, waqi: dict) -> dict:
    """Merge air quality from three sources, highest priority wins per field."""
    merged: dict[str, Any] = {}
    # Start with lowest priority (Open-Meteo)
    merged.update(om)
    # WAQI overwrites scalars if available
    if waqi:
        for k in ("pm25", "pm10", "no2", "o3", "so2", "co", "temperature", "humidity", "aqi"):
            if k in waqi:
                merged[k] = waqi[k]
        merged["aqi_source"] = "waqi"
        merged["waqi_station"] = waqi.get("station")
        merged["waqi_aqi"] = waqi.get("aqi")
    # OpenAQ overwrites scalars if available (highest quality)
    if openaq:
        for k in ("pm25", "pm10", "no2", "o3", "so2", "co"):
            if k in openaq:
                merged[k] = openaq[k]
        merged["openaq_station"] = openaq.get("station")
        merged["openaq_distance_km"] = openaq.get("distance_km")
    return merged


# ---------------------------------------------------------------------------
# Public fetch functions (with caching)
# ---------------------------------------------------------------------------

def get_air_quality(lat: float, lon: float, db: Session | None = None) -> dict[str, Any]:
    """Return merged air quality data, using TTL cache."""
    key = _round_coord(lat, lon)
    if key in aq_cache:
        return {**aq_cache[key], "is_cached": True}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        f_om    = ex.submit(open_meteo_aq.fetch, lat, lon)
        f_oaq   = ex.submit(openaq_client.fetch, lat, lon)
        f_waqi  = ex.submit(waqi_client.fetch, lat, lon)
        om_data   = f_om.result()
        oaq_data  = f_oaq.result()
        waqi_data = f_waqi.result()

    merged = _merge_aq(om_data, oaq_data, waqi_data)
    merged["source"] = "merged"
    merged["is_cached"] = False

    if db:
        if om_data:   _persist_readings(db, lat, lon, "open_meteo_aq", om_data)
        if oaq_data:  _persist_readings(db, lat, lon, "openaq", oaq_data)
        if waqi_data: _persist_readings(db, lat, lon, "waqi", waqi_data)

    aq_cache[key] = {k: v for k, v in merged.items() if k != "is_cached"}
    return merged


def get_weather(lat: float, lon: float, db: Session | None = None) -> dict[str, Any]:
    """Return current weather stressors, using TTL cache."""
    key = _round_coord(lat, lon)
    if key in weather_cache:
        return {**weather_cache[key], "is_cached": True}

    data = open_meteo_weather.fetch(lat, lon)
    data["is_cached"] = False

    if db and data:
        _persist_readings(db, lat, lon, "open_meteo_weather", data)

    if data:
        weather_cache[key] = {k: v for k, v in data.items() if k != "is_cached"}
    return data


def get_soil(lat: float, lon: float, db: Session | None = None) -> dict[str, Any]:
    """Return soil moisture & temperature, using TTL cache."""
    key = _round_coord(lat, lon)
    if key in soil_cache:
        return {**soil_cache[key], "is_cached": True}

    data = open_meteo_soil.fetch(lat, lon)
    data["is_cached"] = False

    if db and data:
        _persist_readings(db, lat, lon, "open_meteo_soil", data)

    if data:
        soil_cache[key] = {k: v for k, v in data.items() if k != "is_cached"}
    return data


def get_water(lat: float, lon: float, db: Session | None = None) -> dict[str, Any] | None:
    """Return water quality data (USGS for US, None outside US), using TTL cache."""
    key = _round_coord(lat, lon)
    if key in water_cache:
        cached = water_cache[key]
        return ({**cached, "is_cached": True} if cached is not None else None)

    data = usgs_water.fetch(lat, lon)  # Returns None if outside US, {} if no gauge found

    if data is not None:
        if db and data:
            _persist_readings(db, lat, lon, "usgs_water", data)
        data_with_flag = {**data, "is_cached": False}
        water_cache[key] = {k: v for k, v in data_with_flag.items() if k != "is_cached"}
        return data_with_flag
    else:
        water_cache[key] = None  # Cache the "outside coverage" result
        return None


def get_events(
    lat: float, lon: float, radius_km: float = 500, db: Session | None = None
) -> dict[str, Any]:
    """Return nearby NASA EONET natural events, using TTL cache."""
    key = (*_round_coord(lat, lon), int(radius_km))
    if key in events_cache:
        return {**events_cache[key], "is_cached": True}

    data = nasa_eonet.fetch(lat, lon, radius_km=radius_km)
    data["is_cached"] = False

    events_cache[key] = {k: v for k, v in data.items() if k != "is_cached"}
    return data


def get_composite(
    lat: float, lon: float, radius_km: float = 500, db: Session | None = None
) -> dict[str, Any]:
    """Fetch all environmental domains in parallel and return a unified dict."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        f_aq      = ex.submit(get_air_quality, lat, lon, db)
        f_weather = ex.submit(get_weather, lat, lon, db)
        f_soil    = ex.submit(get_soil, lat, lon, db)
        f_water   = ex.submit(get_water, lat, lon, db)
        f_events  = ex.submit(get_events, lat, lon, radius_km, db)

        aq_data      = f_aq.result()
        weather_data = f_weather.result()
        soil_data    = f_soil.result()
        water_data   = f_water.result()
        events_data  = f_events.result()

    return {
        "lat":          lat,
        "lon":          lon,
        "fetched_at":   datetime.utcnow().isoformat() + "Z",
        "air_quality":  aq_data,
        "weather":      weather_data,
        "soil":         soil_data,
        "water":        water_data,      # None if outside US coverage
        "events":       events_data,
    }
