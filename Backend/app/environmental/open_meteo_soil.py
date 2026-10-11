# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Open-Meteo Soil API client (keyless, non-commercial use).

Uses the same Open-Meteo Forecast API endpoint with soil-specific variables.
Provides: soil moisture and temperature at multiple depths.
No API key required.
"""

from __future__ import annotations
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Soil variables available from Open-Meteo (hourly)
_SOIL_VARIABLES = [
    "soil_moisture_0_to_1cm",
    "soil_moisture_1_to_3cm",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
    "soil_temperature_0cm",
    "soil_temperature_6cm",
    "soil_temperature_18cm",
]

_LABELS: dict[str, tuple[str, str]] = {
    "soil_moisture_0_to_1cm":  ("moisture_0_1cm",   "m³/m³"),
    "soil_moisture_1_to_3cm":  ("moisture_1_3cm",   "m³/m³"),
    "soil_moisture_3_to_9cm":  ("moisture_3_9cm",   "m³/m³"),
    "soil_moisture_9_to_27cm": ("moisture_9_27cm",  "m³/m³"),
    "soil_temperature_0cm":    ("temp_surface",     "°C"),
    "soil_temperature_6cm":    ("temp_6cm",         "°C"),
    "soil_temperature_18cm":   ("temp_18cm",        "°C"),
}


def fetch(lat: float, lon: float, timeout: int = 8) -> dict[str, Any]:
    """Return the most recent hourly soil readings for a coordinate.

    Returns::

        {
            "source":          "open_meteo_soil",
            "moisture_0_1cm":  0.32,  "moisture_0_1cm_unit":  "m³/m³",
            "moisture_1_3cm":  0.30,  ...
            "temp_surface":    28.4,  "temp_surface_unit":    "°C",
            "temp_6cm":        26.1,  ...
        }
    """
    params = {
        "latitude":     lat,
        "longitude":    lon,
        "hourly":       ",".join(_SOIL_VARIABLES),
        "timezone":     "auto",
        "past_hours":   1,
        "forecast_hours": 0,
    }
    try:
        resp = requests.get(settings.OPEN_METEO_WEATHER_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("open_meteo_soil fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}

    hourly = data.get("hourly", {})
    result: dict[str, Any] = {"source": "open_meteo_soil"}

    for om_key, (internal_key, unit) in _LABELS.items():
        values = hourly.get(om_key, [])
        val = None
        for v in reversed(values):
            if v is not None:
                val = round(float(v), 4)
                break
        result[internal_key] = val
        result[f"{internal_key}_unit"] = unit

    return result
