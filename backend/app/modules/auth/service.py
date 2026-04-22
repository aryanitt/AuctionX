"""Auth service — user creation, password hashing, and token generation."""

from datetime import datetime, timezone

import bcrypt
from bson import ObjectId

from app.db import users_collection
from app.utils.jwt import create_access_token
from app.utils.serializer import serialize_doc


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt with 12 rounds."""
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(plain.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


async def create_user(name: str, email: str, password: str, role: str) -> dict:
    """Create a new user document with a hashed password."""
    now = datetime.now(timezone.utc)
    user_doc = {
        "name": name.strip(),
        "email": email.lower().strip(),
        "password": hash_password(password),
        "role": role,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return user_doc


async def find_user_by_email(email: str, include_password: bool = False) -> dict | None:
    """
    Look up a user by email address.

    By default the password field is excluded from the result. Pass
    ``include_password=True`` when you need to verify credentials.
    """
    projection = None if include_password else {"password": 0}
    return await users_collection.find_one(
        {"email": email.lower().strip()}, projection
    )


def build_user_response(user_doc: dict) -> dict:
    """Serialize a user document for API output, stripping the password."""
    cleaned = serialize_doc(user_doc)
    cleaned.pop("password", None)
    return cleaned


def build_token_for_user(user_doc: dict) -> str:
    """Generate a signed JWT for the given user."""
    return create_access_token(
        user_id=str(user_doc["_id"]),
        role=user_doc["role"],
    )
