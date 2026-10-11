# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from typing import List
from pydantic import BaseModel

class Coordinate(BaseModel):
    lat: float
    lng: float

class TripPayload(BaseModel):
    origin: Coordinate
    destination: Coordinate
    route_type: str
    segment_ids: List[str]
    segment_durations_sec: List[int]
    started_at: str
    ended_at: str

class ExposureCalculateRequest(BaseModel):
    trip: TripPayload
