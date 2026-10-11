# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

THRESHOLDS = {
    "pm25": {"min": 0, "max": 300},
    "no2": {"min": 0, "max": 200},
    "carbon": {"min": 0, "max": 20},
    "heat": {"min": -2, "max": 8},
    "noise": {"min": 40, "max": 85},
    "ndvi": {"min": 0, "max": 1},
    "weather": {"min": 0, "max": 10},
    "time": {"min": 0, "max": 90},
    "distance": {"min": 0, "max": 20},
    "load": {"min": 0, "max": 50},
}


def normalise(value: float, signal: str) -> float:
    threshold = THRESHOLDS[signal]
    low = threshold["min"]
    high = threshold["max"]
    if high == low:
        return 0.0
    return max(0.0, min(100.0, ((value - low) / (high - low)) * 100.0))


def inverted_ndvi_score(ndvi: float) -> float:
    return 100.0 - normalise(ndvi, "ndvi")


def compute_weather_score(weather_data: dict | None) -> float:
    if not weather_data:
        return 2.5

    precipitation = float(weather_data.get("precipitation_mm") or weather_data.get("precipitation") or 0)
    wind = float(weather_data.get("wind_speed_kmh") or weather_data.get("wind_speed_10m") or 0)
    uv_index = float(weather_data.get("uv_index") or 0)
    visibility = float(weather_data.get("visibility_km") or 10)

    score = 0.0
    score += min(3.0, precipitation * 0.5)
    score += min(2.0, max(0.0, wind - 20.0) * 0.1)
    score += min(2.0, uv_index * 0.3)
    score += min(3.0, max(0.0, 100.0 - visibility * 10.0))
    return max(0.0, min(10.0, score))
