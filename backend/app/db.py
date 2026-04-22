"""
MongoDB connection and collection references.

A single Motor client is created at import time and reused for the lifetime
of the process. Motor is async-native, so one client handles all concurrent
requests safely — no connection pool tuning needed for development.
"""

import logging

import certifi
import motor.motor_asyncio
from app.config import settings

logger = logging.getLogger(__name__)

# Use certifi's CA bundle so Atlas SSL handshakes succeed on all platforms
client = motor.motor_asyncio.AsyncIOMotorClient(
    settings.MONGO_URI,
    tlsCAFile=certifi.where(),
)
db = client["british-auction"]

# Collection shortcuts — import these directly in services
users_collection = db["users"]
rfqs_collection = db["rfqs"]
bids_collection = db["bids"]


async def ensure_indexes():
    """
    Create indexes for frequently queried fields.

    Called once at startup. Motor's ``create_index`` is idempotent — if the
    index already exists it returns immediately.
    """
    try:
        # Users — email lookups during auth
        await users_collection.create_index("email", unique=True)

        # RFQs — lifecycle scheduler filters by status + time fields
        await rfqs_collection.create_index("status")
        await rfqs_collection.create_index("bidStartTime")
        await rfqs_collection.create_index("createdAt")
        await rfqs_collection.create_index("buyer")

        # Bids — leaderboard and lowest-bid queries
        await bids_collection.create_index([("rfq", 1), ("isLatest", 1)])
        await bids_collection.create_index([("rfq", 1), ("supplier", 1), ("isLatest", 1)])
        await bids_collection.create_index([("rfq", 1), ("isLatest", 1), ("totalAmount", 1)])

        logger.info("MongoDB indexes ensured successfully")
    except Exception as e:
        logger.warning("Failed to create indexes (non-fatal): %s", e)
