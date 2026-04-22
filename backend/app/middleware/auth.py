"""
Authentication and authorization dependencies for FastAPI routes.
"""

from fastapi import Depends, Header, HTTPException
from jose import JWTError
from bson import ObjectId

from app.db import users_collection
from app.utils.jwt import decode_access_token
from app.utils.serializer import serialize_doc


async def get_current_user(authorization: str = Header(default=None)) -> dict:
    """
    Validate the ``Authorization: Bearer <token>`` header and return the
    authenticated user document (password excluded).

    Use as a route dependency: ``current_user = Depends(get_current_user)``
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"success": False, "error": "Access denied. No token provided."},
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "error": "Token is invalid or expired."},
        )

    user = await users_collection.find_one(
        {"_id": ObjectId(payload["id"])},
        {"password": 0},
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "error": "Token is valid but user no longer exists."},
        )

    return serialize_doc(user)


def require_role(role: str):
    """
    Role-based access guard factory.

    Usage::

        @router.post("/", dependencies=[Depends(require_role("buyer"))])
        async def create_something(current_user = Depends(require_role("buyer"))):
            ...
    """
    async def _check_role(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") != role:
            raise HTTPException(
                status_code=403,
                detail={"success": False, "error": f"Access restricted to {role}s only."},
            )
        return current_user

    return _check_role
