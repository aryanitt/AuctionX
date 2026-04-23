"""
Auction lifecycle service — invoked by the Vercel Cron endpoint.

Transitions RFQ statuses based on timestamps:
  - ``draft``  → ``active``       when ``bidStartTime`` has passed
  - ``active`` → ``force_closed`` when ``forcedCloseTime`` has passed
  - ``active`` → ``closed``       when ``bidCloseTime`` passed (but not forced)

Socket.io emit calls have been removed; the frontend polls for status changes.
"""

import logging
from datetime import datetime, timezone

from app.db import rfqs_collection

logger = logging.getLogger(__name__)


async def run_auction_lifecycle_check():
    """
    Check all RFQs and transition statuses based on their deadlines.
    Called once per minute by the Vercel Cron job via POST /api/cron/lifecycle.
    """
    now = datetime.now(timezone.utc)
    # MongoDB stores naive datetimes internally as UTC.
    # Use a naive version for query comparisons to avoid mismatch.
    now_naive = now.replace(tzinfo=None)

    try:
        # ---------------------------------------------------------------
        # Phase 0: Activate drafts whose bidding window has opened
        # ---------------------------------------------------------------
        activatable = await rfqs_collection.find({
            "status": "draft",
            "bidStartTime": {"$lte": now_naive},
        }).to_list(length=None)

        for rfq in activatable:
            await rfqs_collection.update_one(
                {"_id": rfq["_id"]},
                {"$set": {"status": "active", "updatedAt": now}},
            )
            logger.info("Activated draft RFQ %s", rfq.get("referenceId"))

        # ---------------------------------------------------------------
        # Phase 1: Force-close — hard deadline exceeded
        # ---------------------------------------------------------------
        force_closeable = await rfqs_collection.find({
            "status": "active",
            "forcedCloseTime": {"$lte": now_naive},
        }).to_list(length=None)

        for rfq in force_closeable:
            await rfqs_collection.update_one(
                {"_id": rfq["_id"]},
                {"$set": {"status": "force_closed", "updatedAt": now}},
            )
            logger.info("Force-closed RFQ %s", rfq.get("referenceId"))

        # ---------------------------------------------------------------
        # Phase 2: Regular close — bidCloseTime passed but not forced
        # ---------------------------------------------------------------
        closeable = await rfqs_collection.find({
            "status": "active",
            "bidCloseTime": {"$lte": now_naive},
            "forcedCloseTime": {"$gt": now_naive},
        }).to_list(length=None)

        for rfq in closeable:
            await rfqs_collection.update_one(
                {"_id": rfq["_id"]},
                {"$set": {"status": "closed", "updatedAt": now}},
            )
            logger.info("Closed RFQ %s", rfq.get("referenceId"))

    except Exception as e:
        logger.error("Error during auction lifecycle check: %s", e)
