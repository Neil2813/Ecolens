# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

def feature_collection(features, updated_at):
    return {"type": "FeatureCollection", "updated_at": updated_at, "features": features}

def line_feature(segment_id, coordinates, properties):
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "properties": {"segment_id": segment_id, **properties},
    }
