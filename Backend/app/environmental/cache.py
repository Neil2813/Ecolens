# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Shared in-memory TTL caches for all environmental data clients.

Using cachetools.TTLCache so hot coordinates don't hammer external APIs:
  - AQ data:     900 s  (15 min) — changes on hourly resolution
  - Weather:     600 s  (10 min) — current conditions
  - Soil:       3600 s  (1 hr)   — slow-changing
  - Water:      3600 s  (1 hr)   — gauge readings update ~15 min but low traffic
  - Events:     1800 s  (30 min) — EONET events update infrequently
"""

from cachetools import TTLCache

# maxsize = max number of unique (lat, lon) keys to keep in memory
aq_cache: TTLCache = TTLCache(maxsize=512, ttl=900)
weather_cache: TTLCache = TTLCache(maxsize=512, ttl=600)
soil_cache: TTLCache = TTLCache(maxsize=256, ttl=3600)
water_cache: TTLCache = TTLCache(maxsize=128, ttl=3600)
events_cache: TTLCache = TTLCache(maxsize=64, ttl=1800)


def _round_coord(lat: float, lon: float) -> tuple[float, float]:
    """Round lat/lon to 2 dp (~1.1 km resolution) for cache key grouping."""
    return round(lat, 2), round(lon, 2)
