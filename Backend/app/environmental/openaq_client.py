# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""OpenAQ v3 API client.

Provides station-level, government-grade air quality measurements.
Requires a free API key from https://openaq.org/#/register

Gracefully falls back to an empty dict if:
  - OPENAQ_API_KEY is not set / empty
  - The API returns an error
  - No stations found within the search radius

This client finds the nearest monitoring station to the given coordinate
and returns the most recent measurements for PM2.5, PM10, NO2, O3, SO2, CO.
"""

from __future__ import annotations
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Max radius (km) to search for a nearby station
_SEARCH_RADIUS_KM = 25
# Parameters to extract (OpenAQ parameter names)
_PARAMETERS = {"pm25", "pm10", "no2", "o3", "so2", "co"}
_UNITS: dict[str, str] = {
    "pm25": "µg/m³", "pm10": "µg/m³",
    "no2":  "µg/m³", "o3":   "µg/m³",
    "so2":  "µg/m³", "co":   "µg/m³",
}


def fetch(lat: float, lon: float, timeout: int = 3) -> dict[str, Any]:
    """Return latest AQ measurements from the nearest OpenAQ v3 station.

    Returns::

        {
            "source":      "openaq",
            "station":     "Hebbal, Bengaluru",
            "station_id":  12345,
            "distance_km": 3.2,
            "pm25":        48.3,  "pm25_unit": "µg/m³",
            "no2":         25.1,  "no2_unit":  "µg/m³",
            ...
        }
    """
    if not settings.OPENAQ_API_KEY:
        logger.debug("OpenAQ API key not configured, skipping.")
        return {}

    headers = {"X-API-Key": settings.OPENAQ_API_KEY}

    # Step 1: Find nearest locations
    try:
        loc_resp = requests.get(
            f"{settings.OPENAQ_V3_URL}/locations",
            params={
                "coordinates": f"{lat},{lon}",
                "radius":      _SEARCH_RADIUS_KM * 1000,  # API expects metres
                "limit":       5,
            },
            headers=headers,
            timeout=timeout,
        )
        loc_resp.raise_for_status()
        locations = loc_resp.json().get("results", [])
    except Exception as exc:
        logger.warning("OpenAQ locations lookup failed for (%s, %s): %s", lat, lon, exc)
        return {}

    if not locations:
        logger.debug("No OpenAQ stations within %s km of (%s, %s)", _SEARCH_RADIUS_KM, lat, lon)
        return {}

    nearest = locations[0]
    station_id = nearest.get("id")
    station_name = nearest.get("name", "Unknown")
    distance_m = nearest.get("distance", 0)

    # Step 2: Fetch latest measurements for that station
    try:
        meas_resp = requests.get(
            f"{settings.OPENAQ_V3_URL}/locations/{station_id}/latest",
            headers=headers,
            timeout=timeout,
        )
        meas_resp.raise_for_status()
        measurements = meas_resp.json().get("results", [])
    except Exception as exc:
        logger.warning("OpenAQ measurements fetch failed for station %s: %s", station_id, exc)
        return {}

    result: dict[str, Any] = {
        "source":      "openaq",
        "station":     station_name,
        "station_id":  station_id,
        "distance_km": round(distance_m / 1000, 2) if distance_m else None,
    }

    for meas in measurements:
        param = meas.get("parameter", "")
        if param in _PARAMETERS:
            val = meas.get("value")
            result[param] = round(float(val), 2) if val is not None else None
            result[f"{param}_unit"] = _UNITS.get(param, meas.get("unit", ""))

    return result if len(result) > 4 else {}  # Only return if we got at least one measurement
