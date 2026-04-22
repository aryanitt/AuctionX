"""Auth routes — registration, login, and profile retrieval."""

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.modules.auth.schema import RegisterRequest, LoginRequest
from app.modules.auth import service as auth_service

router = APIRouter()


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    """Register a new buyer or supplier account."""
    existing = await auth_service.find_user_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"success": False, "error": "An account with this email already exists."},
        )

    user = await auth_service.create_user(
        name=body.name,
        email=body.email,
        password=body.password,
        role=body.role,
    )
    token = auth_service.build_token_for_user(user)

    return {
        "success": True,
        "data": {
            "token": token,
            "user": auth_service.build_user_response(user),
        },
    }


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate with email and password, returning a signed JWT."""
    user = await auth_service.find_user_by_email(body.email, include_password=True)

    if not user or not auth_service.verify_password(body.password, user["password"]):
        raise HTTPException(
            status_code=401,
            detail={"success": False, "error": "Invalid email or password."},
        )

    token = auth_service.build_token_for_user(user)

    return {
        "success": True,
        "data": {
            "token": token,
            "user": auth_service.build_user_response(user),
        },
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {
        "success": True,
        "data": {"user": current_user},
    }
