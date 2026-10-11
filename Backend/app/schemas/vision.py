# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from pydantic import BaseModel

class VisionDetectRequest(BaseModel):
    image_base64: str
    user_lat: float
    user_lng: float
