# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

from datetime import datetime

from app.ml.load_tracker import tracker
from app.ml.route_generator import CandidateRoute
from app.ml.route_scorer import WEIGHTS
from app.ml.signal_normaliser import inverted_ndvi_score, normalise


def classify_time(now: datetime | None = None) -> str:
    hour = (now or datetime.now()).hour
    if 8 <= hour < 10:
        return "morning_peak"
    if 17 <= hour < 20:
        return "evening_peak"
    return "off_peak"


def _traffic_multiplier(minutes_ahead: int) -> float:
    per_10 = {
        "morning_peak": 1.15,
        "evening_peak": 1.12,
        "off_peak": 1.02,
    }[classify_time()]
    return per_10 ** (minutes_ahead / 10)


def project_load(route: CandidateRoute, minutes_ahead: int) -> float:
    current = tracker.get_route_load(route.route_id)
    inflow = tracker.get_inflow_rate(route.route_id)
    outflow = 1 / max(route.duration_min, 1)
    return max(0.0, current + (inflow - outflow) * minutes_ahead)


def wind_pollution_factor(route: CandidateRoute, weather_data: dict | None = None) -> float:
    if not weather_data:
        return 1.0
    wind_speed = float(weather_data.get("wind_speed_kmh") or weather_data.get("wind_speed_10m") or 0)
    wind_direction = float(weather_data.get("wind_direction") or weather_data.get("wind_direction_10m") or 0)
    if len(route.polyline) < 2 or wind_speed <= 10:
        return 1.0
    start = route.polyline[0]
    end = route.polyline[-1]
    route_bearing = (end[1] - start[1]) * 90 + (end[0] - start[0]) * 45
    angular_diff = abs(route_bearing - wind_direction) % 360
    if angular_diff > 180:
        angular_diff = 360 - angular_diff
    if angular_diff < 45:
        return 1.3
    if angular_diff < 90:
        return 1.0
    return 0.85


def predict_future_ecoscore(
    route: CandidateRoute,
    minutes_ahead: int,
    weather_data: dict | None = None,
) -> int:
    signals = route.metrics
    traffic = _traffic_multiplier(minutes_ahead)
    load_future = project_load(route, minutes_ahead)
    wind = wind_pollution_factor(route, weather_data)
    pm25_future = signals["pm25_avg"] * wind * (1 + max(0, load_future - route.current_load) * 0.015)
    carbon_future = min(100.0, normalise(signals["carbon_per_min"], "carbon") * traffic)
    noise_future = min(100.0, normalise(signals["noise_db"], "noise") * traffic)

    raw = (
        WEIGHTS["pm25"] * normalise(pm25_future, "pm25")
        + WEIGHTS["no2"] * normalise(signals["no2"], "no2")
        + WEIGHTS["carbon"] * carbon_future
        + WEIGHTS["heat"] * normalise(signals["heat_anomaly"], "heat")
        + WEIGHTS["noise"] * noise_future
        + WEIGHTS["ndvi"] * inverted_ndvi_score(signals["ndvi"])
        + WEIGHTS["weather"] * normalise(signals["weather_score"], "weather")
        + WEIGHTS["time"] * normalise(route.duration_min, "time")
        + WEIGHTS["distance"] * normalise(route.distance_km, "distance")
        + WEIGHTS["load"] * normalise(load_future, "load")
    )
    return int(max(0, min(100, round(100 - raw))))


def forecast_route(route: CandidateRoute, weather_data: dict | None = None) -> None:
    route.forecasts = {
        "ecoscore_t10": predict_future_ecoscore(route, 10, weather_data),
        "ecoscore_t20": predict_future_ecoscore(route, 20, weather_data),
        "ecoscore_t30": predict_future_ecoscore(route, 30, weather_data),
    }
    route.degradation_rate = max(0.0, (route.metrics["ecoscore_now"] - route.forecasts["ecoscore_t30"]) / 30)


def degradation_warning(route: CandidateRoute) -> str | None:
    capacity = {"residential": 15, "arterial": 25, "highway": 40, "mixed": 20}.get(
        route.primary_road_class,
        20,
    )
    projected_t10 = project_load(route, 10)
    if route.current_load >= capacity:
        return "Route is saturated - EcoScore dropping"
    if projected_t10 >= capacity * 0.85:
        return "Approaching high load - EcoScore dropping"
    if route.forecasts["ecoscore_t10"] < route.metrics["ecoscore_now"] - 15:
        return "Predicted degradation in the next 10 minutes"
    return None


def forecast_note(route: CandidateRoute) -> str:
    now = route.metrics["ecoscore_now"]
    t10 = route.forecasts["ecoscore_t10"]
    t20 = route.forecasts["ecoscore_t20"]
    if t10 > now + 3:
        return "Slightly worse now but expected to improve within ~10 minutes."
    if t20 >= now - 5:
        return "This route stays clean for the next 20 minutes."
    return "Pollution and route load may increase during this trip."
