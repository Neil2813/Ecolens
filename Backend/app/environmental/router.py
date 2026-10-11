# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""FastAPI router for live environmental data endpoints.

All endpoints:
  - Require JWT authentication (get_current_user)
  - Use the 15-min TTL cache via the aggregator module
  - Return data with source, fetched_at, and is_cached metadata

Endpoints:
  GET /api/env/air-quality   — PM2.5, PM10, NO2, SO2, O3, CO, AQI
  GET /api/env/weather       — temperature, humidity, wind, UV index
  GET /api/env/soil          — soil moisture & temperature at multiple depths
  GET /api/env/water         — water quality: pH, DO, turbidity (US-only via USGS)
  GET /api/env/events        — NASA EONET natural events nearby
  GET /api/env/composite     — all domains in a single unified response
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.environmental import aggregator
from app.utils.auth_dep import get_current_user

router = APIRouter()


def _validate_coords(lat: float, lon: float) -> None:
    if not (-90 <= lat <= 90):
        raise HTTPException(status_code=422, detail="lat must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="lon must be between -180 and 180")


@router.get("/air-quality", summary="Live air quality for a coordinate")
def air_quality(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return live air quality data for a coordinate.

    **Sources (priority order)**:
    1. **OpenAQ v3** — station-level, government-grade (requires `OPENAQ_API_KEY`)
    2. **WAQI** — station-level AQI index (requires `WAQI_TOKEN`)
    3. **Open-Meteo AQ** — 11 km grid, always available, no key needed

    **Fields**: pm25, pm10, no2, so2, o3, co, aqi_eu, aqi_us, station metadata.
    """
    try:
        data = aggregator.get_air_quality(lat, lon, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Air quality fetch failed: {exc}")
    return data


@router.get("/weather", summary="Live weather stressors for a coordinate")
def weather(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return current weather conditions that act as ambient pollution catalysts.

    **Source**: Open-Meteo Forecast API (keyless, global).

    **Fields**: temperature, feels_like, humidity, precipitation, wind_speed,
    wind_direction, uv_index, cloud_cover, pressure, weather_label.
    """
    try:
        data = aggregator.get_weather(lat, lon, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Weather fetch failed: {exc}")
    if not data:
        raise HTTPException(status_code=503, detail="Weather data unavailable")
    return data


@router.get("/soil", summary="Live soil moisture and temperature")
def soil(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return soil moisture and temperature at multiple depths.

    **Source**: Open-Meteo Forecast API — soil reanalysis model (keyless, global).

    **Fields**: moisture_0_1cm, moisture_1_3cm, moisture_3_9cm, moisture_9_27cm,
    temp_surface, temp_6cm, temp_18cm — all with units.
    """
    try:
        data = aggregator.get_soil(lat, lon, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Soil data fetch failed: {exc}")
    if not data:
        raise HTTPException(status_code=503, detail="Soil data unavailable")
    return data


@router.get("/water", summary="Live water quality (US-only via USGS)")
def water(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return real-time water quality from the nearest USGS stream gauge.

    **Source**: USGS Water Data Services (keyless, US coverage only).

    **Fields**: ph, dissolved_oxygen, turbidity, water_temp, discharge.

    Returns `{"coverage": "none", "reason": "..."}` for coordinates outside the US.
    """
    try:
        data = aggregator.get_water(lat, lon, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Water data fetch failed: {exc}")

    if data is None:
        return {
            "source":   "usgs_water",
            "coverage": "none",
            "reason":   "USGS Water Services only covers US coordinates. "
                        "EEA European water data is available via bulk download only.",
        }
    return data


@router.get("/events", summary="NASA EONET natural events nearby")
def events(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    radius_km: float = Query(500.0, description="Search radius in km", ge=10, le=5000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return open natural events (wildfires, volcanoes, storms, floods) near a coordinate.

    **Source**: NASA EONET v3 (keyless, global, near real-time satellite feeds).

    **Events tracked**: Wildfires, Volcanoes, Severe Storms, Earthquakes,
    Dust/Haze, Floods, Droughts.

    Results are sorted by distance from the given coordinate.
    """
    try:
        data = aggregator.get_events(lat, lon, radius_km=radius_km, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Events fetch failed: {exc}")
    return data


@router.get("/composite", summary="All environmental domains in one call")
def composite(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    radius_km: float = Query(500.0, description="Event search radius in km", ge=10, le=5000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return a unified environmental snapshot for a coordinate.

    Fetches all 4 domains in parallel:
    - **air_quality** — PM2.5, PM10, NO2, SO2, O3, CO, AQI
    - **weather** — temperature, humidity, wind, UV, precipitation
    - **soil** — moisture and temperature at multiple depths
    - **water** — USGS gauge data (US-only, null elsewhere)
    - **events** — NASA EONET open natural events nearby

    All results respect the per-domain TTL cache (15 min for AQ, etc.).
    Check `is_cached` field on each sub-object to see if data was served from cache.
    """
    try:
        return aggregator.get_composite(lat, lon, radius_km=radius_km, db=db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Composite fetch failed: {exc}")


@router.get("/stubble-fires", summary="NASA EONET stubble burning & wind plume dispersion")
def stubble_fires(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    radius_km: float = Query(600.0, description="Search radius in km", ge=10, le=3000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Analyze active agricultural/stubble fires and compute downwind smoke plume trajectory."""
    from app.environmental import air_safety
    try:
        return air_safety.analyze_stubble_fires(lat, lon, radius_km=radius_km, db=db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stubble fire analysis failed: {exc}")


@router.get("/indoor-estimate", summary="EPA building indoor air infiltration and smart ventilation")
def indoor_estimate(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    outdoor_pm25: float = Query(None, description="Optional override for outdoor PM2.5"),
    outdoor_aqi: float = Query(None, description="Optional override for outdoor AQI"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Compute indoor PM2.5/AQI scenarios across 4 building envelopes and find the cleanest ventilation window."""
    from app.environmental import air_safety
    try:
        return air_safety.analyze_indoor_air(
            lat, lon, outdoor_pm25=outdoor_pm25, outdoor_aqi=outdoor_aqi, db=db
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Indoor air analysis failed: {exc}")


@router.get("/school-safety", summary="Pediatric air quality safety protocol and commute risk matrix")
def school_safety(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    outdoor_pm25: float = Query(None, description="Optional override for outdoor PM2.5"),
    outdoor_aqi: float = Query(None, description="Optional override for outdoor AQI"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return child-specific health vulnerability index, recess/sports matrix, and school commute drop-off safety."""
    from app.environmental import air_safety
    try:
        return air_safety.analyze_school_safety(
            lat, lon, outdoor_pm25=outdoor_pm25, outdoor_aqi=outdoor_aqi, db=db
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"School safety analysis failed: {exc}")

