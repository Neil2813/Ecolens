# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import EnvironmentalSegment
from app.ml.route_generator import CandidateRoute
from app.ml.signal_normaliser import compute_weather_score, inverted_ndvi_score, normalise


WEIGHTS = {
    "pm25": 0.25,
    "no2": 0.10,
    "carbon": 0.15,
    "heat": 0.10,
    "noise": 0.08,
    "ndvi": 0.07,
    "weather": 0.05,
    "time": 0.10,
    "distance": 0.05,
    "load": 0.05,
}


def _segment_from_db(db: Session, segment_id: str) -> dict | None:
    seg = None
    if not db.info.get("segment_lookup_unavailable"):
        try:
            seg = db.query(EnvironmentalSegment).filter(EnvironmentalSegment.segment_id == segment_id).first()
        except Exception:
            db.info["segment_lookup_unavailable"] = True
            try:
                db.rollback()
            except Exception:
                pass
    if seg:
        return {
            "pm25": float(seg.pm25 or 0),
            "no2": float(seg.no2 or 0),
            "co2_per_min": float(seg.co2_per_min or 0),
            "ndvi": float(seg.ndvi or 0),
            "noise_db": float(seg.noise_db or 0),
            "heat_anomaly": float(seg.heat_anomaly or 0),
        }
    return None


_CITY_AVG_DEFAULTS = {
    # Realistic Bengaluru urban air quality averages (CPCB data)
    "pm25": 85.0,   # µg/m³ — moderate urban
    "no2": 32.0,    # µg/m³
    "co2_per_min": 4.5,  # g/min — city driving
    "ndvi": 0.28,   # low-moderate green cover
    "noise_db": 65.0,   # urban road noise
    "heat_anomaly": 2.1,  # +2°C urban heat island
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in kilometers between two GPS coordinates."""
    import math
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _sample_polyline_coordinates(coords: list[list[float]], max_samples: int = 8) -> list[tuple[float, float]]:
    """Sample evenly distributed (lat, lng) pairs along a route polyline [[lng, lat], ...]."""
    if not coords:
        return []
    if len(coords) <= max_samples:
        return [(float(c[1]), float(c[0])) for c in coords]

    step = (len(coords) - 1) / (max_samples - 1)
    indices = [int(round(i * step)) for i in range(max_samples)]
    return [(float(coords[idx][1]), float(coords[idx][0])) for idx in indices]


def _find_nearest_db_segment(db: Session, lat: float, lng: float, max_dist_km: float = 3.0) -> dict | None:
    """Find the closest environmental segment in the database within max_dist_km."""
    if db.info.get("segment_lookup_unavailable"):
        return None
    try:
        # Check all or bounding-box segments
        segments = db.query(EnvironmentalSegment).limit(100).all()
        best_seg = None
        best_dist = float("inf")
        for seg in segments:
            # Try parsing lat, lon from segment_id "lat_lon" or geom
            s_lat, s_lon = None, None
            if seg.segment_id and "_" in seg.segment_id:
                parts = seg.segment_id.split("_")
                try:
                    s_lat, s_lon = float(parts[0]), float(parts[1])
                except (ValueError, IndexError):
                    pass
            if s_lat is not None and s_lon is not None:
                d = _haversine_km(lat, lng, s_lat, s_lon)
                if d < best_dist and d <= max_dist_km:
                    best_dist = d
                    best_seg = seg

        if best_seg:
            return {
                "pm25": float(best_seg.pm25 or 0),
                "no2": float(best_seg.no2 or 0),
                "co2_per_min": float(best_seg.co2_per_min or 0),
                "ndvi": float(best_seg.ndvi or 0),
                "noise_db": float(best_seg.noise_db or 0),
                "heat_anomaly": float(best_seg.heat_anomaly or 0),
            }
    except Exception:
        db.info["segment_lookup_unavailable"] = True
    return None


def compute_route_signals(
    db: Session,
    route: CandidateRoute,
    weather_data: dict | None = None,
    spatial_aq_map: dict | None = None,
) -> dict:
    """Sample environmental stations and segments along the route polyline using spatial distance.

    Calculates physically consistent exposure based on duration without coordinate count artifacts.
    Uses in-memory spatial interpolation and caching to ensure <1ms per-route evaluation.
    """
    from app.environmental.cache import aq_cache, _round_coord

    sample_coords = _sample_polyline_coordinates(route.polyline, max_samples=8)
    if not sample_coords and route.polyline:
        p = route.polyline
        sample_coords = [(float(p[0][1]), float(p[0][0])), (float(p[-1][1]), float(p[-1][0]))]
    if not sample_coords:
        sample_coords = [(12.9716, 77.5946)]

    # Extract spatial anchors
    spatial_map = spatial_aq_map or {}
    orig_aq = spatial_map.get("origin") or {}
    mid_aq = spatial_map.get("midpoint") or {}
    dest_aq = spatial_map.get("destination") or {}

    baseline_pm25 = float(mid_aq.get("pm25") or orig_aq.get("pm25") or _CITY_AVG_DEFAULTS["pm25"])
    baseline_no2 = float(mid_aq.get("no2") or orig_aq.get("no2") or _CITY_AVG_DEFAULTS["no2"])

    pm25_vals = []
    no2_vals = []
    heat_vals = []
    noise_vals = []
    ndvi_vals = []
    co2_rates = []
    point_scores = []

    total_samples = len(sample_coords)
    for idx, (lat, lng) in enumerate(sample_coords):
        # 1. Attempt spatial lookup from DB segments near this point
        db_seg = _find_nearest_db_segment(db, lat, lng)
        if db_seg:
            pm25 = db_seg["pm25"]
            no2 = db_seg["no2"]
            heat = db_seg["heat_anomaly"]
            noise = db_seg["noise_db"]
            ndvi = db_seg["ndvi"]
            co2_pm = db_seg["co2_per_min"]
        else:
            # 2. Check in-memory AQ cache (0ms lookup)
            key = _round_coord(lat, lng)
            cached_aq = aq_cache.get(key)
            if cached_aq and cached_aq.get("pm25") is not None:
                pm25 = float(cached_aq["pm25"])
                no2 = float(cached_aq.get("no2") or baseline_no2)
            else:
                # 3. Spatial interpolation between route origin, midpoint, and destination
                t = idx / max(1, total_samples - 1)
                if t <= 0.5:
                    sub_t = t * 2.0
                    p_orig = float(orig_aq.get("pm25") or baseline_pm25)
                    p_mid = float(mid_aq.get("pm25") or baseline_pm25)
                    pm25 = p_orig + sub_t * (p_mid - p_orig)

                    n_orig = float(orig_aq.get("no2") or baseline_no2)
                    n_mid = float(mid_aq.get("no2") or baseline_no2)
                    no2 = n_orig + sub_t * (n_mid - n_orig)
                else:
                    sub_t = (t - 0.5) * 2.0
                    p_mid = float(mid_aq.get("pm25") or baseline_pm25)
                    p_dest = float(dest_aq.get("pm25") or baseline_pm25)
                    pm25 = p_mid + sub_t * (p_dest - p_mid)

                    n_mid = float(mid_aq.get("no2") or baseline_no2)
                    n_dest = float(dest_aq.get("no2") or baseline_no2)
                    no2 = n_mid + sub_t * (n_dest - n_mid)

            heat = float(_CITY_AVG_DEFAULTS["heat_anomaly"])
            noise = float(_CITY_AVG_DEFAULTS["noise_db"])
            ndvi = float(_CITY_AVG_DEFAULTS["ndvi"])
            co2_pm = float(_CITY_AVG_DEFAULTS["co2_per_min"])

        pm25_vals.append(pm25)
        no2_vals.append(no2)
        heat_vals.append(heat)
        noise_vals.append(noise)
        ndvi_vals.append(ndvi)
        co2_rates.append(co2_pm)

        # Local environmental score along this segment of the polyline
        pt_score = max(5, min(98, int(100 - (0.35 * pm25 + 0.25 * no2 + 0.15 * noise + 2.0 * heat - 10.0 * ndvi))))
        point_scores.append(pt_score)

    count = max(1, len(pm25_vals))
    pm25_avg = round(sum(pm25_vals) / count, 1)
    no2_avg = round(sum(no2_vals) / count, 1)
    heat_anomaly = round(sum(heat_vals) / count, 2)
    heat_score = max(0.0, min(100.0, normalise(heat_anomaly, "heat")))
    noise_db = round(sum(noise_vals) / count, 1)
    ndvi_avg = round(sum(ndvi_vals) / count, 2)

    # Standard passenger vehicle carbon output: ~135 g CO2 per km
    co2_grams = round(float(route.distance_km) * 135.0, 1)
    carbon_per_min = round(co2_grams / max(float(route.duration_min), 1.0), 2)

    # Inhaled PM2.5 dose (µg) = Concentration (µg/m³) * Duration (hours) * Adult Breathing Volume (~0.8 m³/hr)
    # Physically consistent duration-based calculation (no coordinate count multiplier)
    duration_hours = max(0.05, float(route.duration_min) / 60.0)
    pm25_exposure = round(pm25_avg * duration_hours * 0.8, 1)

    weather_score = compute_weather_score(weather_data)

    return {
        "pm25_avg": pm25_avg,
        "pm25_exposure": pm25_exposure,
        "no2": no2_avg,
        "co2_grams": co2_grams,
        "carbon_per_min": carbon_per_min,
        "heat_anomaly": heat_anomaly,
        "heat_score": heat_score,
        "noise_db": noise_db,
        "ndvi": ndvi_avg,
        "weather_score": weather_score,
        "sampled_scores": point_scores,
    }


def compute_ecoscore(route: CandidateRoute, load: int, weather_data: dict | None = None) -> int:
    signals = route.metrics
    raw = (
        WEIGHTS["pm25"] * normalise(signals["pm25_avg"], "pm25")
        + WEIGHTS["no2"] * normalise(signals["no2"], "no2")
        + WEIGHTS["carbon"] * normalise(signals["carbon_per_min"], "carbon")
        + WEIGHTS["heat"] * normalise(signals["heat_anomaly"], "heat")
        + WEIGHTS["noise"] * normalise(signals["noise_db"], "noise")
        + WEIGHTS["ndvi"] * inverted_ndvi_score(signals["ndvi"])
        + WEIGHTS["weather"] * normalise(signals.get("weather_score") or compute_weather_score(weather_data), "weather")
        + WEIGHTS["time"] * normalise(route.duration_min, "time")
        + WEIGHTS["distance"] * normalise(route.distance_km, "distance")
        + WEIGHTS["load"] * normalise(load, "load")
    )
    return int(max(0, min(100, round(100 - raw))))
