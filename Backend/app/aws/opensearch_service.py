# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
AWS OpenSearch Geospatial Indexing & Search Service.

Provides spatial indexing and sub-millisecond proximity queries for NASA EONET
wildfire/stubble-burning hotspots and global air quality monitoring stations.

Features:
- Dynamic geo_point index mapping for high-precision latitude/longitude coordinates.
- Elastic geo_distance bounding queries (e.g. 600km stubble smoke radius search).
- 100% Zero-Config Fallback: If USE_OPENSEARCH=false or OpenSearch is unavailable,
  EcoLens executes pure in-memory Haversine spatial math.
"""

from __future__ import annotations
import logging
from typing import Any
import httpx

from app.core.config import settings

logger = logging.getLogger("opensearch_service")


class OpenSearchGeoService:
    def __init__(self):
        self._checked_cluster = False
        self._cluster_available = False

    @property
    def is_active(self) -> bool:
        """Returns True if OpenSearch is enabled in config."""
        return bool(settings.USE_OPENSEARCH)

    def _ensure_cluster(self) -> bool:
        """Ping OpenSearch cluster and verify health."""
        if not self.is_active:
            return False
        if self._checked_cluster:
            return self._cluster_available

        try:
            resp = httpx.get(settings.OPENSEARCH_URL, timeout=2.0)
            if resp.status_code == 200:
                self._cluster_available = True
                self._ensure_indices()
                logger.info(f"Connected to AWS OpenSearch at {settings.OPENSEARCH_URL}")
            else:
                self._cluster_available = False
        except Exception as e:
            logger.debug(f"OpenSearch not reachable ({e}). Operating in memory/Haversine fallback.")
            self._cluster_available = False

        self._checked_cluster = True
        return self._cluster_available

    def _ensure_indices(self):
        """Create indices with geo_point mapping if not yet created."""
        for index_name in [settings.OPENSEARCH_INDEX_FIRES, settings.OPENSEARCH_INDEX_STATIONS]:
            try:
                mapping = {
                    "mappings": {
                        "properties": {
                            "id": {"type": "keyword"},
                            "title": {"type": "text"},
                            "coordinates": {"type": "geo_point"},
                            "timestamp": {"type": "date"},
                            "aqi": {"type": "float"},
                            "pm25": {"type": "float"},
                            "confidence": {"type": "keyword"}
                        }
                    }
                }
                httpx.put(f"{settings.OPENSEARCH_URL}/{index_name}", json=mapping, timeout=3.0)
            except Exception:
                pass

    def index_fire_events(self, events: list[dict[str, Any]]) -> int:
        """Bulk index satellite fire hotspot events into OpenSearch geo_point index."""
        if not self._ensure_cluster() or not events:
            return 0

        indexed = 0
        try:
            for ev in events:
                coords = ev.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    doc = {
                        "id": ev.get("id"),
                        "title": ev.get("title"),
                        "coordinates": {
                            "lat": float(coords[1]),
                            "lon": float(coords[0]),
                        },
                        "timestamp": ev.get("geometry", {}).get("date"),
                    }
                    httpx.post(
                        f"{settings.OPENSEARCH_URL}/{settings.OPENSEARCH_INDEX_FIRES}/_doc/{ev.get('id')}",
                        json=doc,
                        timeout=1.5,
                    )
                    indexed += 1
        except Exception as exc:
            logger.warning(f"Error indexing fires to OpenSearch: {exc}")
        return indexed

    def search_nearby_fires(
        self, lat: float, lon: float, radius_km: float = 600.0
    ) -> list[dict[str, Any]] | None:
        """Query OpenSearch for wildfire/stubble burning hotspots within radius_km.
        
        Returns None if OpenSearch is inactive/unreachable so caller uses fallback math.
        """
        if not self._ensure_cluster():
            return None

        query = {
            "size": 100,
            "query": {
                "bool": {
                    "filter": {
                        "geo_distance": {
                            "distance": f"{int(radius_km)}km",
                            "coordinates": {
                                "lat": lat,
                                "lon": lon,
                            },
                        }
                    }
                }
            },
            "sort": [
                {
                    "_geo_distance": {
                        "coordinates": {"lat": lat, "lon": lon},
                        "order": "asc",
                        "unit": "km",
                        "distance_type": "arc",
                    }
                }
            ],
        }
        try:
            resp = httpx.post(
                f"{settings.OPENSEARCH_URL}/{settings.OPENSEARCH_INDEX_FIRES}/_search",
                json=query,
                timeout=3.0,
            )
            if resp.status_code == 200:
                hits = resp.json().get("hits", {}).get("hits", [])
                results = []
                for hit in hits:
                    src = hit["_source"]
                    sort_dist = hit.get("sort", [None])[0]
                    results.append({
                        "id": src.get("id"),
                        "title": src.get("title"),
                        "lat": src.get("coordinates", {}).get("lat"),
                        "lon": src.get("coordinates", {}).get("lon"),
                        "distance_km": round(float(sort_dist), 1) if sort_dist is not None else None,
                        "source": "AWS_OpenSearch",
                    })
                return results
        except Exception as e:
            logger.warning(f"OpenSearch query failed: {e}. Falling back to in-memory math.")
        return None


# Global singleton instance
opensearch_geo = OpenSearchGeoService()
