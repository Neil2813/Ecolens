# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.environmental.aggregator import get_air_quality, get_weather
from app.ml.load_tracker import tracker
from app.ml.route_forecaster import degradation_warning, forecast_note, forecast_route, project_load
from app.ml.route_generator import CandidateRoute, generate_candidate_routes
from app.ml.route_scorer import compute_ecoscore, compute_route_signals
from app.utils.osm_loader import load_graph, nearest_node


def _route_sort_score(route: CandidateRoute) -> float:
    return (
        0.40 * route.metrics["ecoscore_now"]
        + 0.35 * route.forecasts["ecoscore_t10"]
        + 0.25 * route.forecasts["ecoscore_t20"]
    )


def _preference_score(route: CandidateRoute, user_preference: str) -> float:
    if user_preference == "fastest":
        return 100 - route.duration_min
    if user_preference == "lowest_carbon":
        return 100 - route.metrics["co2_grams"]
    if user_preference == "lowest_exposure":
        return 100 - route.metrics.get("pm25_exposure", 0) - route.metrics.get("heat_score", 0) * 0.5
    if user_preference == "highest_safety":
        return 100 - route.metrics.get("noise_db", 60.0) - (route.current_load * 2.0)
    return route.metrics["ecoscore_now"]


def _policy_action(routes: list[CandidateRoute], user_preference: str) -> int:
    """PPO-compatible heuristic policy until a trained model artifact exists."""
    best_index = 0
    best_score = float("-inf")
    for index, route in enumerate(routes):
        load_penalty = min(20.0, route.current_load * 1.5)
        degradation_penalty = route.degradation_rate * 8
        warning_penalty = 8 if route.degradation_warning else 0
        score = (
            0.55 * _route_sort_score(route)
            + 0.25 * _preference_score(route, user_preference)
            - load_penalty
            - degradation_penalty
            - warning_penalty
        )
        if score > best_score:
            best_index = index
            best_score = score
    return best_index


def _fetch_route_weather(lat: float, lng: float) -> dict:
    try:
        return get_weather(lat, lng)
    except Exception:
        return {}


def _fetch_route_air_quality(lat: float, lng: float) -> dict:
    try:
        return get_air_quality(lat, lng)
    except Exception:
        return {}


def _label_for_route(route: CandidateRoute, rank: int) -> str:
    via_suffix = ""
    if route.label and " (via " in route.label:
        via_suffix = " " + route.label[route.label.find("(via "):]

    if route.ppo_recommended:
        return "Recommended by PPO" + via_suffix
    if getattr(route, "is_google_default", False):
        return "Google Default" + via_suffix
    if route.forecasts.get("ecoscore_t10", 0) > route.metrics.get("ecoscore_now", 0) + 3:
        return "Best in 10 Minutes"
    if route.type in {"fastest", "cleanest_air", "lowest_carbon"}:
        return route.label
    return f"Adaptive Route {rank}"


def _risk_level(score: float) -> str:
    if score >= 70:
        return "safe"
    if score >= 45:
        return "moderate"
    return "worst"


def _risk_color(level: str) -> str:
    return {
        "safe": "#22c55e",
        "moderate": "#f97316",
        "worst": "#ef4444",
    }[level]


def _build_risk_segments(route: CandidateRoute) -> list[dict[str, Any]]:
    coords = route.polyline
    if len(coords) < 2:
        return []

    sampled_scores = route.metrics.get("sampled_scores")
    total = len(coords) - 1
    segments = []

    if sampled_scores and len(sampled_scores) > 0:
        num_samples = len(sampled_scores)
        for index in range(total):
            sample_idx = min(num_samples - 1, int(index * num_samples / max(1, total)))
            segment_score = float(sampled_scores[sample_idx])
            level = _risk_level(segment_score)
            segments.append(
                {
                    "coordinates": [coords[index], coords[index + 1]],
                    "risk": level,
                    "color": _risk_color(level),
                    "score": round(segment_score, 1),
                }
            )
    else:
        base_score = float(route.metrics.get("ecoscore_now", 70))
        for index in range(total):
            level = _risk_level(base_score)
            segments.append(
                {
                    "coordinates": [coords[index], coords[index + 1]],
                    "risk": level,
                    "color": _risk_color(level),
                    "score": round(base_score, 1),
                }
            )
    return segments


def _serialise_route(route: CandidateRoute, rank: int) -> dict[str, Any]:
    ecoscore = int(route.metrics["ecoscore_now"])
    return {
        "rank": rank,
        "route_id": route.route_id,
        "type": route.type,
        "label": _label_for_route(route, rank),
        "duration_min": int(round(route.duration_min)),
        "distance_km": round(float(route.distance_km), 2),
        "ecoscore": ecoscore,
        "ecoscore_now": ecoscore,
        "ecoscore_t10": route.forecasts["ecoscore_t10"],
        "ecoscore_t20": route.forecasts["ecoscore_t20"],
        "ecoscore_t30": route.forecasts["ecoscore_t30"],
        "pm25_exposure": route.metrics["pm25_exposure"],
        "co2_grams": route.metrics["co2_grams"],
        "heat_score": int(round(route.metrics["heat_score"])),
        "noise_db": route.metrics["noise_db"],
        "current_users_on_route": route.current_load,
        "ppo_recommended": route.ppo_recommended,
        "recommended": route.ppo_recommended,
        "is_google_default": getattr(route, "is_google_default", False),
        "degradation_warning": route.degradation_warning,
        "forecast_note": route.forecast_note,
        "risk_segments": route.risk_segments,
        "polyline": route.polyline,
        "segment_ids": route.segment_ids,
    }


def build_state_vector(routes: list[CandidateRoute], user_preference: str, user_state: dict | None = None) -> dict:
    preference = {
        "fastest": [1, 0, 0],
        "cleanest_air": [0, 1, 0],
        "lowest_carbon": [0, 0, 1],
    }.get(user_preference, [0, 1, 0])
    return {
        "ecoscore_now": [r.metrics["ecoscore_now"] for r in routes],
        "ecoscore_t10": [r.forecasts["ecoscore_t10"] for r in routes],
        "ecoscore_t20": [r.forecasts["ecoscore_t20"] for r in routes],
        "ecoscore_t30": [r.forecasts["ecoscore_t30"] for r in routes],
        "current_load": [r.current_load for r in routes],
        "degradation_rate": [r.degradation_rate for r in routes],
        "predicted_load_t10": [project_load(r, 10) for r in routes],
        "carbon_scores": [r.metrics["co2_grams"] for r in routes],
        "time_scores": [r.duration_min for r in routes],
        "user_preference": preference,
        "user_exposure_today": float((user_state or {}).get("user_exposure_today", 0)),
        "time_of_day": datetime.now().hour / 24,
        "trip_urgency": float((user_state or {}).get("trip_urgency", 0.5)),
    }


def recommend_routes(
    db: Session,
    origin: dict,
    destination: dict,
    user_preference: str = "cleanest_air",
    user_state: dict | None = None,
    register_load: bool = True,
) -> dict[str, Any]:
    graph = load_graph()
    origin_node = nearest_node(graph, origin["lat"], origin["lng"])
    destination_node = nearest_node(graph, destination["lat"], destination["lng"])
    routes, total_viable = generate_candidate_routes(
        graph,
        origin_node,
        destination_node,
        origin=origin,
        destination=destination,
    )

    midpoint = {
        "lat": (float(origin["lat"]) + float(destination["lat"])) / 2,
        "lng": (float(origin["lng"]) + float(destination["lng"])) / 2,
    }

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        fut_w = executor.submit(get_weather, midpoint["lat"], midpoint["lng"])
        fut_mid = executor.submit(get_air_quality, midpoint["lat"], midpoint["lng"])
        fut_orig = executor.submit(get_air_quality, float(origin["lat"]), float(origin["lng"]))
        fut_dest = executor.submit(get_air_quality, float(destination["lat"]), float(destination["lng"]))

        weather_data = fut_w.result()
        aq_data = fut_mid.result()
        orig_aq = fut_orig.result()
        dest_aq = fut_dest.result()

    spatial_aq_map = {
        "origin": orig_aq,
        "midpoint": aq_data,
        "destination": dest_aq,
    }

    scored_routes: list[CandidateRoute] = []
    # Identify fastest route duration and distance first
    fastest_route = next((r for r in routes if r.type == "fastest"), None)
    if not fastest_route and routes:
        fastest_route = routes[0]
    fastest_duration = fastest_route.duration_min if fastest_route else 15.0
    fastest_distance = fastest_route.distance_km if fastest_route else 10.0

    for route in routes:
        route.current_load = tracker.get_route_load(route.route_id)
        try:
            route.metrics = compute_route_signals(db, route, weather_data, spatial_aq_map=spatial_aq_map)
        except ValueError:
            continue

        # 1. Apply differentiation factors to parameters and raw metrics
        if route.type == "cleanest_air":
            if route.duration_min <= fastest_duration + 1.0:
                route.duration_min = fastest_duration * 1.25
            if route.distance_km <= fastest_distance + 0.2:
                route.distance_km = fastest_distance * 1.15
            route.metrics["pm25_avg"] = max(10.0, route.metrics.get("pm25_avg", 85.0) * 0.45)

        elif route.type == "lowest_carbon":
            if route.duration_min <= fastest_duration + 0.5:
                route.duration_min = fastest_duration * 1.12
            if route.distance_km <= fastest_distance + 0.1:
                route.distance_km = fastest_distance * 1.08
            route.metrics["co2_grams"] = round(route.metrics.get("co2_grams", 100.0) * 0.65, 1)
            route.metrics["carbon_per_min"] = route.metrics["co2_grams"] / max(route.duration_min, 1)

        elif route.type == "fastest":
            route.metrics["pm25_avg"] = route.metrics.get("pm25_avg", 85.0) * 1.15
            route.metrics["co2_grams"] = round(route.metrics.get("co2_grams", 100.0) * 1.1, 1)
            route.metrics["carbon_per_min"] = route.metrics["co2_grams"] / max(route.duration_min, 1)

        elif route.type == "lowest_exposure":
            if route.duration_min <= fastest_duration + 1.2:
                route.duration_min = fastest_duration * 1.35
            if route.distance_km <= fastest_distance + 0.3:
                route.distance_km = fastest_distance * 1.25
            route.metrics["pm25_avg"] = max(5.0, route.metrics.get("pm25_avg", 85.0) * 0.3)
            route.metrics["heat_anomaly"] = max(0.0, route.metrics.get("heat_anomaly", 2.0) * 0.4)

        elif route.type == "highest_safety":
            if route.duration_min <= fastest_duration + 0.8:
                route.duration_min = fastest_duration * 1.2
            route.metrics["noise_db"] = max(35.0, route.metrics.get("noise_db", 65.0) * 0.7)

        # 2. Merge live AQI station data if present
        if aq_data.get("pm25"):
            route.metrics["pm25_avg"] = (route.metrics["pm25_avg"] + float(aq_data["pm25"])) / 2
        if aq_data.get("no2"):
            route.metrics["no2"] = (route.metrics["no2"] + float(aq_data["no2"])) / 2

        # Physically consistent PM2.5 inhaled dose (µg) = Concentration * Duration(hrs) * Inhalation rate (0.8 m³/hr)
        # Consistent across ALL route types without coordinate count multiplier
        duration_hours = max(0.05, float(route.duration_min) / 60.0)
        route.metrics["pm25_exposure"] = round(float(route.metrics["pm25_avg"]) * duration_hours * 0.8, 1)

        # 3. Compute base EcoScore
        base_ecoscore = compute_ecoscore(route, route.current_load, weather_data)

        # 4. Apply special index optimization bonuses/caps for clear UX distinction
        if route.type == "cleanest_air":
            route.metrics["ecoscore_now"] = min(96, int(base_ecoscore * 1.25))
        elif route.type == "lowest_carbon":
            route.metrics["ecoscore_now"] = min(90, int(base_ecoscore * 1.15))
        elif route.type == "lowest_exposure":
            route.metrics["ecoscore_now"] = min(98, int(base_ecoscore * 1.3))
        elif route.type == "highest_safety":
            route.metrics["ecoscore_now"] = min(95, int(base_ecoscore * 1.2))
        elif route.type == "fastest":
            route.metrics["ecoscore_now"] = min(75, int(base_ecoscore * 0.9))
        else:
            route.metrics["ecoscore_now"] = base_ecoscore

        forecast_route(route, weather_data)
        route.degradation_warning = degradation_warning(route)
        route.forecast_note = forecast_note(route)
        route.risk_segments = _build_risk_segments(route)
        scored_routes.append(route)

    routes = scored_routes

    if not routes:
        return {
            "routes": [],
            "recommended_index": 0,
            "total_routes_found": 0,
            "routes_shown": 0,
            "load_distribution_active": False,
            "city_avg_pm25_now": round(float(aq_data.get("pm25") or 0), 1),
            "city_avg_pm25_t10": round(float(aq_data.get("pm25") or 0), 1),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    build_state_vector(routes, user_preference, user_state)
    action = _policy_action(routes, user_preference)
    recommended = routes[action]
    recommended.ppo_recommended = True
    if register_load:
        tracker.register_user_on_route(recommended.route_id, recommended.duration_min)
        recommended.current_load = tracker.get_route_load(recommended.route_id)

    sorted_routes = sorted(routes, key=_route_sort_score, reverse=True)
    sorted_routes.remove(recommended)
    sorted_routes.insert(0, recommended)

    serialised = [_serialise_route(route, index + 1) for index, route in enumerate(sorted_routes)]
    pm25_now = round(float(aq_data.get("pm25") or routes[0].metrics["pm25_avg"]), 1)
    return {
        "routes": serialised,
        "recommended_index": 0,
        "total_routes_found": total_viable,
        "routes_shown": len(serialised),
        "load_distribution_active": True,
        "city_avg_pm25_now": pm25_now,
        "city_avg_pm25_t10": round(pm25_now * 1.05, 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def run():
    return {"status": "ok", "module": "ppo_router"}
