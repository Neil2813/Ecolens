# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from datetime import datetime, date
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator

class MessageResponse(BaseModel):
    message: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class ResetTokenResponse(BaseModel):
    reset_token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)
    use_everyday: Optional[bool] = False
    commute_destination: Optional[str] = None
    commute_destination_coords: Optional[str] = None

    @model_validator(mode="after")
    def validate_match(self):
        if self.password != self.confirm_password:
            raise ValueError("confirm_password must match password")
        return self

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Password must contain at least one number")
        return value

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)

    @model_validator(mode="after")
    def validate_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("confirm_password must match new_password")
        return self

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value):
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Password must contain at least one number")
        return value

class AuthUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    city: str
    theme: str
    default_route_preference: str
    use_everyday: bool
    commute_destination: Optional[str] = None
    commute_destination_coords: Optional[str] = None
