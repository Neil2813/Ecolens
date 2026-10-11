# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Open-Meteo Weather + UV API client (keyless, non-commercial use).

Endpoint: https://api.open-meteo.com/v1/forecast
Provides: temperature, humidity, wind speed/direction, UV index, precipitation.
No API key required.
"""

from __future__ import annotations
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_CURRENT_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "uv_index",
    "weather_code",
    "cloud_cover",
    "surface_pressure",
]

_UNITS: dict[str, str] = {
    "temperature_2m":      "°C",
    "relative_humidity_2m": "%",
    "apparent_temperature": "°C",
    "precipitation":        "mm",
    "wind_speed_10m":       "km/h",
    "wind_direction_10m":   "°",
    "uv_index":             "index",
    "weather_code":         "WMO",
    "cloud_cover":          "%",
    "surface_pressure":     "hPa",
}

# WMO weather interpretation codes → human-readable labels
_WMO_LABELS: dict[int, str] = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Icy fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm + slight hail", 99: "Thunderstorm + heavy hail",
}


def fetch(lat: float, lon: float, timeout: int = 3) -> dict[str, Any]:
    """Return current weather stressors for a coordinate.

    Returns::

        {
            "source": "open_meteo_weather",
            "temperature":       28.4,  "temperature_unit": "°C",
            "feels_like":        31.2,  "feels_like_unit":  "°C",
            "humidity":          72,    "humidity_unit":    "%",
            "precipitation":     0.0,   "precipitation_unit": "mm",
            "wind_speed":        14.0,  "wind_speed_unit":  "km/h",
            "wind_direction":    220,   "wind_direction_unit": "°",
            "uv_index":          7.2,   "uv_index_unit":    "index",
            "cloud_cover":       20,    "cloud_cover_unit": "%",
            "pressure":          1008,  "pressure_unit":    "hPa",
            "weather_code":      2,
            "weather_label":     "Partly cloudy",
        }
    """
    params = {
        "latitude":          lat,
        "longitude":         lon,
        "current":           ",".join(_CURRENT_VARIABLES),
        "timezone":          "auto",
        "wind_speed_unit":   "kmh",
        "temperature_unit":  "celsius",
    }
    try:
        resp = requests.get(settings.OPEN_METEO_WEATHER_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("open_meteo_weather fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}

    current = data.get("current", {})
    if not current:
        return {}

    def _val(key: str):
        v = current.get(key)
        return round(float(v), 2) if v is not None else None

    weather_code = current.get("weather_code")
    return {
        "source":               "open_meteo_weather",
        "temperature":          _val("temperature_2m"),
        "temperature_unit":     "°C",
        "feels_like":           _val("apparent_temperature"),
        "feels_like_unit":      "°C",
        "humidity":             _val("relative_humidity_2m"),
        "humidity_unit":        "%",
        "precipitation":        _val("precipitation"),
        "precipitation_unit":   "mm",
        "wind_speed":           _val("wind_speed_10m"),
        "wind_speed_unit":      "km/h",
        "wind_direction":       _val("wind_direction_10m"),
        "wind_direction_unit":  "°",
        "uv_index":             _val("uv_index"),
        "uv_index_unit":        "index",
        "cloud_cover":          _val("cloud_cover"),
        "cloud_cover_unit":     "%",
        "pressure":             _val("surface_pressure"),
        "pressure_unit":        "hPa",
        "weather_code":         weather_code,
        "weather_label":        _WMO_LABELS.get(int(weather_code), "Unknown") if weather_code is not None else None,
    }
