# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""WAQI (World Air Quality Index) API client.

Provides real-time station-level AQI and granular pollutant metrics.
Requires a free token from https://aqicn.org/data-platform/token/

Gracefully falls back to an empty dict if:
  - WAQI_TOKEN is not set / empty
  - The API returns a non-ok status
  - The station is not found near the given coordinate
"""

from __future__ import annotations
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# WAQI internal key → our internal parameter name
_IAQI_MAP: dict[str, str] = {
    "pm25": "pm25",
    "pm10": "pm10",
    "no2":  "no2",
    "o3":   "o3",
    "so2":  "so2",
    "co":   "co",
    "no":   "no",
    "t":    "temperature",
    "h":    "humidity",
    "p":    "pressure",
    "w":    "wind_speed",
}


def fetch(lat: float, lon: float, timeout: int = 3) -> dict[str, Any]:
    """Return the nearest WAQI station AQI + individual pollutant readings.

    Returns::

        {
            "source":      "waqi",
            "aqi":         142,
            "station":     "Hebbal, Bengaluru",
            "station_id":  "@12345",
            "pm25":        55.2,
            "pm10":        80.1,
            "no2":         28.4,
            "o3":          41.0,
            "so2":         6.2,
            "co":          0.8,
            "temperature": 29.0,
            "humidity":    68.0,
        }
    """
    if not settings.WAQI_TOKEN:
        logger.debug("WAQI token not configured, skipping.")
        return {}

    url = f"{settings.WAQI_API_URL}/feed/geo:{lat};{lon}/"
    try:
        resp = requests.get(url, params={"token": settings.WAQI_TOKEN}, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("WAQI fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}

    if data.get("status") != "ok":
        logger.debug("WAQI returned non-ok status for (%s, %s): %s", lat, lon, data.get("status"))
        return {}

    body = data.get("data", {})
    aqi_raw = body.get("aqi")
    aqi = int(aqi_raw) if isinstance(aqi_raw, (int, float)) else None
    station_info = body.get("city", {})
    iaqi = body.get("iaqi", {})

    result: dict[str, Any] = {
        "source":     "waqi",
        "aqi":        aqi,
        "station":    station_info.get("name", "Unknown"),
        "station_id": str(body.get("idx", "")),
    }

    for waqi_key, internal_key in _IAQI_MAP.items():
        entry = iaqi.get(waqi_key, {})
        val = entry.get("v")
        if val is not None:
            result[internal_key] = round(float(val), 2)

    return result if aqi is not None else {}
