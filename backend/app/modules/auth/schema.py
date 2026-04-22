"""Request/response schemas for the auth module."""

from pydantic import BaseModel, EmailStr
from typing import Literal


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["buyer", "supplier"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
