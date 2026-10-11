# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from typing import List, Optional
from pydantic import BaseModel, Field

class Coordinate(BaseModel):
    lat: float
    lng: float

class GenerateRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate

class RerouteRequest(BaseModel):
    current_position: Coordinate
    destination: Coordinate
    original_route_type: str = Field(pattern="^(fastest|cleanest_air|lowest_carbon)$")
    reason: str = Field(pattern="^(off_route|pollution_spike|user_requested)$")

class RouteResponse(BaseModel):
    type: str
    label: str
    duration_min: int
    distance_km: float
    pm25_exposure: float
    co2_grams: float
    ecoscore: int
    polyline: list
    segment_ids: list
    recommended: bool = False
