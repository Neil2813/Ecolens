# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""NASA EONET (Earth Observatory Natural Event Tracker) client (keyless).

API: https://eonet.gsfc.nasa.gov/api/v3/events
Tracks: wildfires, volcanic eruptions, severe storms, and other
        natural events in near real-time from NASA's satellite feeds.

No API key required.
"""

from __future__ import annotations
import logging
import math
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Category IDs we care about for environmental health
_CATEGORY_MAP: dict[str, str] = {
    "wildfires":          "Wildfire",
    "volcanoes":          "Volcano",
    "severeStorms":       "Severe Storm",
    "earthquakes":        "Earthquake",
    "dustHaze":           "Dust / Haze",
    "floods":             "Flood",
    "droughts":           "Drought",
    "manmade":            "Man-made Event",
}

_DEFAULT_RADIUS_KM = 500  # Default radius for "nearby" events


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch(
    lat: float,
    lon: float,
    radius_km: float = _DEFAULT_RADIUS_KM,
    limit: int = 50,
    timeout: int = 10,
) -> dict[str, Any]:
    """Return open natural events within ``radius_km`` of the given coordinate.

    Returns::

        {
            "source": "nasa_eonet",
            "events_found": 3,
            "events": [
                {
                    "id":          "EONET_6420",
                    "title":       "Wildfire near Nagpur",
                    "category":    "Wildfire",
                    "status":      "open",
                    "date":        "2026-06-13T12:00:00Z",
                    "lat":         21.14,
                    "lon":         79.09,
                    "distance_km": 342.1,
                    "link":        "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6420",
                },
                ...
            ]
        }
    """
    try:
        resp = requests.get(
            settings.NASA_EONET_URL,
            params={
                "status": "open",
                "limit":  limit,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("NASA EONET fetch failed for (%s, %s): %s", lat, lon, exc)
        return {"source": "nasa_eonet", "events_found": 0, "events": []}

    raw_events = data.get("events", [])
    nearby: list[dict[str, Any]] = []

    for event in raw_events:
        # Get the most recent geometry point
        geometries = event.get("geometry", [])
        if not geometries:
            continue
        # Sort by date descending and take the latest point
        sorted_geom = sorted(
            geometries,
            key=lambda g: g.get("date", ""),
            reverse=True,
        )
        geom = sorted_geom[0]
        coords = geom.get("coordinates", [])
        # EONET returns [lon, lat] for Point types
        if not coords or len(coords) < 2:
            continue
        evt_lon, evt_lat = float(coords[0]), float(coords[1])
        dist_km = _haversine_km(lat, lon, evt_lat, evt_lon)
        if dist_km > radius_km:
            continue

        categories = event.get("categories", [])
        cat_id = categories[0].get("id", "") if categories else ""
        cat_label = _CATEGORY_MAP.get(cat_id, cat_id.replace("_", " ").title())

        nearby.append({
            "id":          event.get("id", ""),
            "title":       event.get("title", ""),
            "category":    cat_label,
            "category_id": cat_id,
            "status":      event.get("status", "open"),
            "date":        geom.get("date", ""),
            "lat":         evt_lat,
            "lon":         evt_lon,
            "distance_km": round(dist_km, 1),
            "link":        event.get("link", ""),
        })

    # Sort by distance
    nearby.sort(key=lambda e: e["distance_km"])

    return {
        "source":       "nasa_eonet",
        "events_found": len(nearby),
        "events":       nearby,
    }
