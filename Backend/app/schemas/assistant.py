# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from pydantic import BaseModel

class AssistantChatRequest(BaseModel):
    message: str
