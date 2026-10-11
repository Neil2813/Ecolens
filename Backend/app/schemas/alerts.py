# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from pydantic import BaseModel

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscription(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys

class SubscribeRequest(BaseModel):
    subscription: PushSubscription
