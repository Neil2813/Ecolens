# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from argon2 import PasswordHasher
from app.core.config import settings

ph = PasswordHasher(time_cost=settings.ARGON2_TIME_COST, memory_cost=settings.ARGON2_MEMORY_COST)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return ph.verify(password_hash, password)
    except Exception:
        return False
