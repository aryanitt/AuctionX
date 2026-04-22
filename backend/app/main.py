"""
AuctionX — FastAPI application entry point.

Sets up the ASGI app with:
  - CORS middleware
  - Socket.io for real-time auction events
  - APScheduler for background auction lifecycle checks
  - Modular route registration
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import partial

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.db import ensure_indexes
from app.events import register_socket_events
from app.modules.auth.routes import router as auth_router
from app.modules.rfq.routes import router as rfq_router
from app.modules.bid.routes import router as bid_router
from app.modules.auction.service import run_auction_lifecycle_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Socket.io
# ---------------------------------------------------------------------------

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.CLIENT_URL,
)
register_socket_events(sio)


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown hooks
# ---------------------------------------------------------------------------

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AuctionX backend...")

    # Create DB indexes for fast queries
    await ensure_indexes()

    # Store sio on app.state so routes can access it via request.app.state.sio
    app.state.sio = sio

    # Run the auction lifecycle check every minute
    scheduler.add_job(
        partial(run_auction_lifecycle_check, sio=sio),
        "interval",
        minutes=1,
        id="auction_lifecycle",
    )
    scheduler.start()
    logger.info("Auction lifecycle scheduler started (1-min interval)")

    yield

    scheduler.shutdown(wait=False)
    logger.info("AuctionX backend shut down.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AuctionX API",
    description="British Auction RFQ System — FastAPI backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CLIENT_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(rfq_router, prefix="/api/rfqs", tags=["RFQs"])
app.include_router(bid_router, prefix="/api/rfqs", tags=["Bids"])


@app.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    return {
        "success": True,
        "data": {
            "status": "OK",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Route not found."},
    )


from fastapi import HTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": str(exc.detail)},
    )


from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"][1:]) if len(err["loc"]) > 1 else str(err["loc"][0])
        errors.append(f"{field}: {err['msg']}")
    error_msg = ", ".join(errors)
    return JSONResponse(
        status_code=422,
        content={"success": False, "error": f"Validation failed: {error_msg}"},
    )



@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error."},
    )


# ---------------------------------------------------------------------------
# ASGI mount — combine FastAPI + Socket.io
# ---------------------------------------------------------------------------

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
