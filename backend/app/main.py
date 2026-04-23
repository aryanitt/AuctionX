"""
AuctionX — FastAPI application entry point (Vercel serverless build).

Changes from local dev version:
  - Socket.io removed (replaced by HTTP polling on the frontend)
  - APScheduler removed (replaced by Vercel Cron calling POST /api/cron/lifecycle)
  - Entry point is plain `app` (wrapped by Mangum in api/index.py)
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.db import ensure_indexes
from app.modules.auth.routes import router as auth_router
from app.modules.rfq.routes import router as rfq_router
from app.modules.bid.routes import router as bid_router
from app.modules.auction.service import run_auction_lifecycle_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup hook only (no scheduler needed)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AuctionX backend...")
    await ensure_indexes()
    yield
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
    allow_origin_regex=r"https://.*\.vercel\.app",
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
# Cron endpoint — called by Vercel Cron every minute
# ---------------------------------------------------------------------------

@app.post("/api/cron/lifecycle")
async def cron_lifecycle(request: Request):
    """
    Vercel Cron calls this every minute to run the auction lifecycle check.
    Protected by a shared secret in the x-cron-secret header.
    """
    secret = request.headers.get("x-cron-secret", "")
    if secret != settings.CRON_SECRET:
        raise HTTPException(
            status_code=403,
            detail={"success": False, "error": "Forbidden."},
        )

    await run_auction_lifecycle_check()
    return {"success": True, "message": "Lifecycle check complete."}


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Route not found."},
    )


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
