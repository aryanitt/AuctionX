"""
JWT token creation and verification.
"""

from datetime import datetime, timedelta, timezone

from jose import jwt
from app.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRY_DAYS = 7


def create_access_token(user_id: str, role: str) -> str:
    """Sign a JWT containing the user's id and role. Expires in 7 days."""
    payload = {
        "id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT. Raises ``JWTError`` if invalid or expired."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
