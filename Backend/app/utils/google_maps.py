# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations
import os
import requests
import urllib.parse
from app.core.config import settings
from cachetools import TTLCache

# Caches for Google API responses to handle rate limits and avoid duplicate billing
place_search_cache = TTLCache(maxsize=1000, ttl=86400) # 24 hrs cache for place searches
directions_cache = TTLCache(maxsize=1000, ttl=900)     # 15 mins cache for routes

def decode_polyline(polyline_str: str) -> list[list[float]]:
    """Decode a Google Maps encoded polyline into a list of [lng, lat] coordinates."""
    index, lat, lng = 0, 0, 0
    coordinates = []
    length = len(polyline_str)
    while index < length:
        # Latitude
        shift, result = 0, 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # Longitude
        shift, result = 0, 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        # Coords are [lng, lat] for the frontend map component
        coordinates.append([float(lng / 1e5), float(lat / 1e5)])
    return coordinates

def search_places_google(query: str) -> list[dict]:
    """
    Search for places using Google Places API (New or Legacy).
    Falls back to OpenStreetMap Nominatim if Google Maps API key is not configured or fails.
    """
    if not query or len(query.strip()) < 2:
        return []

    # Check cache first
    cached_res = place_search_cache.get(query)
    if cached_res is not None:
        return cached_res

    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        # Fallback to Nominatim OSM Search
        return search_places_nominatim(query)

    # 1. Try Places API (New) - modern and default
    try:
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location"
        }
        body = {
            "textQuery": query,
            "languageCode": "en"
        }
        response = requests.post(url, json=body, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results = []
            for item in data.get("places", []):
                loc = item.get("location", {})
                lat = loc.get("latitude")
                lng = loc.get("longitude")
                if lat is not None and lng is not None:
                    results.append({
                        "name": item.get("displayName", {}).get("text", "Unknown"),
                        "formatted_address": item.get("formattedAddress", ""),
                        "lat": float(lat),
                        "lng": float(lng),
                        "place_id": item.get("id")
                    })
            if results:
                place_search_cache[query] = results
                return results
    except Exception as e:
        print(f"Places API (New) failed: {e}. Trying legacy API...")

    # 2. Try legacy Places Text Search API
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": api_key,
        "region": "in" # bias to India
    }
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # If API key is invalid or returned an error status, skip to Nominatim fallback
        if data.get("status") not in ("REQUEST_DENIED", "INVALID_REQUEST", "OVER_QUERY_LIMIT"):
            results = []
            for item in data.get("results", []):
                lat = item.get("geometry", {}).get("location", {}).get("lat")
                lng = item.get("geometry", {}).get("location", {}).get("lng")
                if lat is not None and lng is not None:
                    results.append({
                        "name": item.get("name"),
                        "formatted_address": item.get("formatted_address"),
                        "lat": float(lat),
                        "lng": float(lng),
                        "place_id": item.get("place_id")
                    })
            if results:
                place_search_cache[query] = results
                return results
            
    except Exception as e:
        print(f"Google Places legacy API request failed: {e}. Falling back to Nominatim.")

    # 3. Fallback to Nominatim OSM Search
    return search_places_nominatim(query)

def search_places_nominatim(query: str) -> list[dict]:
    """
    Fallback Nominatim OSM search to maintain search functionality without API key.
    """
    url = f"{settings.NOMINATIM_URL}/search"
    params = {
        "format": "json",
        "q": query,
        "limit": 10,
        "countrycodes": "in" # bias to India
    }
    headers = {
        "User-Agent": "EcoLensApp/1.0 (contact@ecolens.app)"
    }
    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        results = []
        for item in data:
            lat = item.get("lat")
            lng = item.get("lon")
            display_name = item.get("display_name", "")
            # Place name is usually the first part of the comma separated string
            name = display_name.split(",")[0] if display_name else "Unknown"
            if lat is not None and lng is not None:
                results.append({
                    "name": name,
                    "formatted_address": display_name,
                    "lat": float(lat),
                    "lng": float(lng),
                    "place_id": f"osm_{item.get('place_id')}"
                })
        return results
    except Exception as e:
        print(f"Nominatim fallback query failed: {e}")
        return []

def get_google_directions(origin: dict, destination: dict) -> list[dict]:
    """
    Query Google Directions/Routes API for all available routes (with alternatives).
    Returns list of route data.
    """
    cache_key = (origin["lat"], origin["lng"], destination["lat"], destination["lng"])
    cached_res = directions_cache.get(cache_key)
    if cached_res is not None:
        return cached_res

    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return []

    # 1. Try Routes API (New) - modern and default
    try:
        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.description"
        }
        body = {
            "origin": {
                "location": {
                    "latLng": {
                        "latitude": float(origin["lat"]),
                        "longitude": float(origin["lng"])
                    }
                }
            },
            "destination": {
                "location": {
                    "latLng": {
                        "latitude": float(destination["lat"]),
                        "longitude": float(destination["lng"])
                    }
                }
            },
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
            "computeAlternativeRoutes": True
        }
        response = requests.post(url, json=body, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            routes = data.get("routes", [])
            if routes:
                legacy_format_routes = []
                for item in routes:
                    # duration is returned as string e.g. "1320s", convert to seconds
                    duration_str = item.get("duration", "0s").replace("s", "")
                    duration_sec = int(duration_str) if duration_str.isdigit() else 0
                    
                    # overview polyline
                    poly_points = item.get("polyline", {}).get("encodedPolyline", "")
                    
                    # summary / description
                    summary = item.get("description", "")
                    
                    legacy_format_routes.append({
                        "summary": summary,
                        "overview_polyline": {"points": poly_points},
                        "legs": [
                            {
                                "distance": {"value": item.get("distanceMeters", 0)},
                                "duration": {"value": duration_sec}
                            }
                        ]
                    })
                directions_cache[cache_key] = legacy_format_routes
                return legacy_format_routes
    except Exception as e:
        print(f"Routes API (New) failed: {e}. Trying legacy Directions API...")

    # 2. Try legacy Directions API
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{origin['lat']},{origin['lng']}",
        "destination": f"{destination['lat']},{destination['lng']}",
        "alternatives": "true",
        "key": api_key
    }

    try:
        response = requests.get(url, params=params, timeout=8)
        response.raise_for_status()
        data = response.json()

        if data.get("status") not in ("REQUEST_DENIED", "INVALID_REQUEST", "OVER_QUERY_LIMIT"):
            routes = data.get("routes", [])
            directions_cache[cache_key] = routes
            return routes
    except Exception as e:
        print(f"Google Directions legacy API request failed: {e}")

    return []
