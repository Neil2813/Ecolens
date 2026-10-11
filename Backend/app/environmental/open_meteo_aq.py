# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Open-Meteo Air Quality API client (keyless, non-commercial use).

Endpoint: https://air-quality-api.open-meteo.com/v1/air-quality
Resolution: 11 km global grid, hourly data
No API key required.
"""

from __future__ import annotations
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Mapping of Open-Meteo variable names to our internal parameter names + units
_VARIABLE_MAP: dict[str, tuple[str, str]] = {
    "pm2_5":            ("pm25",   "µg/m³"),
    "pm10":             ("pm10",   "µg/m³"),
    "carbon_monoxide":  ("co",     "µg/m³"),
    "nitrogen_dioxide": ("no2",    "µg/m³"),
    "sulphur_dioxide":  ("so2",    "µg/m³"),
    "ozone":            ("o3",     "µg/m³"),
    "european_aqi":     ("aqi_eu", "index"),
    "us_aqi":           ("aqi_us", "index"),
}


def fetch(lat: float, lon: float, timeout: int = 3) -> dict[str, Any]:
    """Return the most recent non-null hourly air quality readings for a coordinate.

    Returns a dict like::

        {
            "source": "open_meteo_aq",
            "pm25": 45.2,  "pm25_unit": "µg/m³",
            "pm10": 60.1,  "pm10_unit": "µg/m³",
            "co":   850.0, "co_unit": "µg/m³",
            "no2":  22.4,  "no2_unit": "µg/m³",
            "so2":  5.1,   "so2_unit": "µg/m³",
            "o3":   80.2,  "o3_unit": "µg/m³",
            "aqi_eu": 3,   "aqi_eu_unit": "index",
            "aqi_us": 42,  "aqi_us_unit": "index",
        }

    On error returns an empty dict so callers can handle gracefully.
    """
    variables = list(_VARIABLE_MAP.keys())
    params = {
        "latitude":  lat,
        "longitude": lon,
        "hourly":    ",".join(variables),
        "timezone":  "auto",
        "past_hours": 1,
        "forecast_hours": 0,
    }
    try:
        resp = requests.get(settings.OPEN_METEO_AQ_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("open_meteo_aq fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}

    hourly = data.get("hourly", {})
    result: dict[str, Any] = {"source": "open_meteo_aq"}

    for om_key, (internal_key, unit) in _VARIABLE_MAP.items():
        values = hourly.get(om_key, [])
        # Take the last non-null value
        val = None
        for v in reversed(values):
            if v is not None:
                val = round(float(v), 2)
                break
        result[internal_key] = val
        result[f"{internal_key}_unit"] = unit

    return result
