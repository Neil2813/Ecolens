# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Cache warmer — APScheduler job to pre-fetch environmental data for major Indian cities.

Runs every 15 minutes to keep caches warm so the first real user request
returns data instantly rather than waiting for external API calls.
"""

from __future__ import annotations
import logging

from app.environmental import aggregator

logger = logging.getLogger(__name__)

# Major city center coordinates to pre-warm (lat, lon, name)
_CITY_SEEDS: list[tuple[float, float, str]] = [
    (12.9716, 77.5946, "Bengaluru"),
    (13.0827, 80.2707, "Chennai"),
    (19.0760, 72.8777, "Mumbai"),
    (28.6139, 77.2090, "New Delhi"),
    (17.3850, 78.4867, "Hyderabad"),
    (22.5726, 88.3639, "Kolkata"),
    (23.0225, 72.5714, "Ahmedabad"),
    (18.5204, 73.8567, "Pune"),
]


def run() -> None:
    """Pre-warm all environmental caches for the configured city list.

    Intentionally runs without a DB session — we only need to populate
    the in-memory TTLCache, not persist to DB (that happens on user requests).
    """
    logger.info("ENV cache warmer: warming %d cities...", len(_CITY_SEEDS))
    for lat, lon, name in _CITY_SEEDS:
        try:
            aggregator.get_air_quality(lat, lon, db=None)
            aggregator.get_weather(lat, lon, db=None)
            aggregator.get_soil(lat, lon, db=None)
            aggregator.get_events(lat, lon, radius_km=500, db=None)
            logger.debug("ENV cache warmer: warmed %s (%s, %s)", name, lat, lon)
        except Exception as exc:
            logger.warning("ENV cache warmer failed for %s: %s", name, exc)
    logger.info("ENV cache warmer: complete.")
