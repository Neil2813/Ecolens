# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""USGS Water Data Services client (keyless, US-only coverage).

REST endpoint: https://waterservices.usgs.gov/nwis/iv/
Provides real-time stream gauge data: pH, dissolved oxygen (DO), turbidity,
water temperature, and stream discharge at thousands of US monitoring stations.

Returns None for non-US coordinates rather than erroring, so callers can
gracefully handle coverage gaps.
"""

from __future__ import annotations
import logging
import math
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# US bounding box (rough) — lat 24–50, lon -125 to -66
_US_LAT = (18.0, 72.0)   # extended to include Alaska, Hawaii, territories
_US_LON = (-180.0, -60.0)

# USGS parameter codes we request
_PARAM_CODES = {
    "00400": ("ph",              "pH units"),
    "00300": ("dissolved_oxygen", "mg/L"),
    "63680": ("turbidity",        "NTU"),
    "00010": ("water_temp",       "°C"),
    "00060": ("discharge",        "ft³/s"),
}

# bBox format: minLon,minLat,maxLon,maxLat
_BOX_DELTA = 0.5  # ±0.5° search box around the coordinate


def _is_us_coordinate(lat: float, lon: float) -> bool:
    return _US_LAT[0] <= lat <= _US_LAT[1] and _US_LON[0] <= lon <= _US_LON[1]


def fetch(lat: float, lon: float, timeout: int = 10) -> dict[str, Any] | None:
    """Return real-time water quality from the nearest USGS gauge.

    Returns ``None`` for non-US coordinates.
    Returns an empty dict if no station is found within the bounding box.

    Returns::

        {
            "source":           "usgs_water",
            "site_name":        "Colorado R at Austin TX",
            "site_code":        "08158000",
            "ph":               7.8,  "ph_unit": "pH units",
            "dissolved_oxygen": 8.2,  "dissolved_oxygen_unit": "mg/L",
            "turbidity":        3.1,  "turbidity_unit": "NTU",
            "water_temp":       22.4, "water_temp_unit": "°C",
            "discharge":        1420, "discharge_unit": "ft³/s",
        }
    """
    if not _is_us_coordinate(lat, lon):
        logger.debug("USGS: coordinate (%s, %s) outside US coverage, skipping.", lat, lon)
        return None  # Explicit None = outside coverage, not an error

    bbox = f"{lon - _BOX_DELTA},{lat - _BOX_DELTA},{lon + _BOX_DELTA},{lat + _BOX_DELTA}"
    param_codes_str = ",".join(_PARAM_CODES.keys())

    params = {
        "format":        "json",
        "bBox":          bbox,
        "parameterCd":   param_codes_str,
        "siteStatus":    "active",
        "siteType":      "ST",  # stream gauges
    }
    try:
        resp = requests.get(settings.USGS_WATER_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("USGS fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}

    time_series = data.get("value", {}).get("timeSeries", [])
    if not time_series:
        logger.debug("USGS: no stations found near (%s, %s)", lat, lon)
        return {}

    # Pick the nearest site by Euclidean distance
    def _dist(ts: dict) -> float:
        loc = ts.get("sourceInfo", {}).get("geoLocation", {}).get("geogLocation", {})
        try:
            return math.sqrt((float(loc["latitude"]) - lat) ** 2 + (float(loc["longitude"]) - lon) ** 2)
        except Exception:
            return float("inf")

    best_by_site: dict[str, dict] = {}
    for ts in time_series:
        site_code = ts.get("sourceInfo", {}).get("siteCode", [{}])[0].get("value", "")
        if site_code not in best_by_site:
            best_by_site[site_code] = ts
        elif _dist(ts) < _dist(best_by_site[site_code]):
            best_by_site[site_code] = ts

    # Sort by distance and take the closest
    closest_ts = min(time_series, key=_dist)
    site_info = closest_ts.get("sourceInfo", {})
    site_name = site_info.get("siteName", "Unknown")
    site_code = site_info.get("siteCode", [{}])[0].get("value", "")

    result: dict[str, Any] = {
        "source":    "usgs_water",
        "site_name": site_name,
        "site_code": site_code,
    }

    # Collect readings from all time series for this area
    for ts in time_series:
        variable = ts.get("variable", {})
        param_cd = variable.get("variableCode", [{}])[0].get("value", "")
        if param_cd not in _PARAM_CODES:
            continue
        internal_key, unit = _PARAM_CODES[param_cd]
        values_list = ts.get("values", [{}])[0].get("value", [])
        # Get most recent non-masked value
        for entry in reversed(values_list):
            raw_val = entry.get("value")
            if raw_val and raw_val != "-999999":
                try:
                    result[internal_key] = round(float(raw_val), 3)
                    result[f"{internal_key}_unit"] = unit
                    break
                except ValueError:
                    continue

    return result
