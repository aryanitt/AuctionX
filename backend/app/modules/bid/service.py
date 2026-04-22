"""
Bid service — submission, ranking, extension logic, and leaderboard queries.

This module handles the core auction mechanics:
  1. Validating that the RFQ is open for bidding
  2. Replacing a supplier's previous bid (mark old as stale)
  3. Re-ranking all active bids by total amount ascending (L1 = lowest)
  4. Checking whether the auction deadline should be extended
"""

from datetime import datetime, timezone

from bson import ObjectId
from pymongo import UpdateOne

from app.db import bids_collection, rfqs_collection
from app.utils.serializer import serialize_doc
from app.utils.helpers import parse_iso_date, ensure_utc


# ---------------------------------------------------------------------------
# Rank comparison
# ---------------------------------------------------------------------------

def _compare_ranks(previous_ranks: dict, current_bids: list) -> dict:
    """
    Compare current bid rankings against a pre-bid snapshot.

    Returns ``{"any_changed": bool, "l1_changed": bool}`` indicating
    whether any supplier's rank shifted, and specifically whether
    the L1 (lowest bidder) position changed hands.
    """
    any_changed = False
    l1_changed = False

    for bid in current_bids:
        supplier_id = str(bid["supplier"])
        prev_rank = previous_ranks.get(supplier_id)

        if prev_rank is None:
            # New supplier appeared on the leaderboard
            any_changed = True
            if bid["rank"] == 1:
                l1_changed = True
        elif bid["rank"] != prev_rank:
            any_changed = True
            if bid["rank"] == 1 or prev_rank == 1:
                l1_changed = True

    # Check if a previously ranked supplier disappeared
    if not any_changed:
        current_ids = {str(b["supplier"]) for b in current_bids}
        for sid in previous_ranks:
            if sid not in current_ids:
                any_changed = True
                break

    return {"any_changed": any_changed, "l1_changed": l1_changed}


# ---------------------------------------------------------------------------
# Auction extension logic
# ---------------------------------------------------------------------------

async def _check_and_extend(
    rfq: dict,
    previous_ranks: dict,
    updated_bids: list,
) -> dict | None:
    """
    Decide whether to extend the auction deadline based on the configured
    extension trigger rule.

    Extension only happens when a bid falls inside the trigger window
    (the last N minutes before ``bidCloseTime``). The new close time is
    always clamped to ``forcedCloseTime`` — the hard deadline.

    Returns the extension log entry dict if extended, or ``None``.
    """
    now = datetime.now(timezone.utc)
    config = rfq["auctionConfig"]

    bid_close = ensure_utc(rfq["bidCloseTime"])
    forced_close = ensure_utc(rfq["forcedCloseTime"])

    trigger_window_seconds = config["triggerWindowMinutes"] * 60
    window_start = bid_close.timestamp() - trigger_window_seconds

    # Bid must land inside the trigger window to qualify
    if now.timestamp() < window_start:
        return None

    # Evaluate the configured trigger rule
    trigger = config["extensionTrigger"]
    should_extend = False
    reason = ""

    if trigger == "bid_received":
        should_extend = True
        reason = f"Bid received within {config['triggerWindowMinutes']}-min trigger window"

    elif trigger == "any_rank_change":
        ranks = _compare_ranks(previous_ranks, updated_bids)
        if ranks["any_changed"]:
            should_extend = True
            reason = "Supplier ranking changed within trigger window"

    elif trigger == "l1_rank_change":
        ranks = _compare_ranks(previous_ranks, updated_bids)
        if ranks["l1_changed"]:
            should_extend = True
            reason = "L1 (lowest bidder) changed within trigger window"

    if not should_extend:
        return None

    # Calculate the new close time, clamped to the forced deadline
    extension_seconds = config["extensionDurationMinutes"] * 60
    proposed_ts = bid_close.timestamp() + extension_seconds

    if proposed_ts > forced_close.timestamp():
        new_close = forced_close
    else:
        new_close = datetime.fromtimestamp(proposed_ts, tz=timezone.utc)

    # Nothing to extend if we're already at or past the forced close
    if new_close <= bid_close:
        return None

    extension_log = {
        "previousCloseTime": bid_close,
        "newCloseTime": new_close,
        "triggerReason": reason,
        "extendedAt": now,
    }

    await rfqs_collection.update_one(
        {"_id": rfq["_id"]},
        {
            "$set": {"bidCloseTime": new_close, "updatedAt": now},
            "$push": {"extensionLogs": extension_log},
        },
    )

    # Reflect the change in the caller's rfq reference
    rfq["bidCloseTime"] = new_close

    return extension_log


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

async def get_leaderboard(rfq_id: str) -> list:
    """
    Return all active (``isLatest=True``) bids for an RFQ, sorted by rank,
    with supplier name and email populated.
    """
    pipeline = [
        {"$match": {"rfq": ObjectId(rfq_id), "isLatest": True}},
        {
            "$lookup": {
                "from": "users",
                "localField": "supplier",
                "foreignField": "_id",
                "as": "supplier",
                "pipeline": [{"$project": {"name": 1, "email": 1}}],
            }
        },
        {"$unwind": {"path": "$supplier", "preserveNullAndEmptyArrays": True}},
        {"$sort": {"rank": 1}},
    ]

    bids = await bids_collection.aggregate(pipeline).to_list(length=None)
    return [serialize_doc(b) for b in bids]


# ---------------------------------------------------------------------------
# Bid submission
# ---------------------------------------------------------------------------

async def submit_bid(
    rfq_id: str,
    supplier_id: str,
    bid_data: dict,
) -> tuple[list, dict | None, dict]:
    """
    Complete bid submission flow:

    1. Validate that the RFQ is active and within the bidding window
    2. Snapshot current supplier rankings
    3. Mark the supplier's previous bid(s) for this RFQ as stale
    4. Insert the new bid document
    5. Re-rank all active bids by ``totalAmount`` ascending
    6. Fetch the updated leaderboard with supplier details
    7. Check if the auction deadline should be extended
    8. Return ``(leaderboard, extension_log, rfq)``
    """

    # 1 — Validate the RFQ
    rfq = await rfqs_collection.find_one({"_id": ObjectId(rfq_id)})
    if not rfq:
        raise LookupError("RFQ not found.")

    if rfq["status"] != "active":
        raise ValueError(f'Cannot bid on an RFQ with status "{rfq["status"]}".')

    now = datetime.now(timezone.utc)
    # Stored datetimes may be naive — compare using naive UTC
    now_naive = now.replace(tzinfo=None)
    bid_start = rfq["bidStartTime"] if rfq["bidStartTime"].tzinfo is None else rfq["bidStartTime"].replace(tzinfo=None)
    bid_close = rfq["bidCloseTime"] if rfq["bidCloseTime"].tzinfo is None else rfq["bidCloseTime"].replace(tzinfo=None)

    if now_naive < bid_start:
        raise ValueError("Bidding has not started yet.")
    if now_naive > bid_close:
        raise ValueError("Bidding window has closed.")

    # 2 — Snapshot rankings before any mutations
    previous_bids = await bids_collection.find(
        {"rfq": ObjectId(rfq_id), "isLatest": True}
    ).to_list(length=None)

    previous_ranks = {str(b["supplier"]): b.get("rank") for b in previous_bids}

    # 3 — Retire supplier's old bid(s)
    await bids_collection.update_many(
        {"rfq": ObjectId(rfq_id), "supplier": ObjectId(supplier_id), "isLatest": True},
        {"$set": {"isLatest": False}},
    )

    # 4 — Insert the new bid
    freight = float(bid_data["freightCharges"])
    origin = float(bid_data["originCharges"])
    destination = float(bid_data["destinationCharges"])

    new_bid = {
        "rfq": ObjectId(rfq_id),
        "supplier": ObjectId(supplier_id),
        "carrierName": bid_data["carrierName"],
        "freightCharges": freight,
        "originCharges": origin,
        "destinationCharges": destination,
        "totalAmount": freight + origin + destination,
        "transitTime": int(bid_data["transitTime"]),
        "quoteValidityDate": parse_iso_date(bid_data["quoteValidityDate"]),
        "isLatest": True,
        "rank": None,
        "submittedAt": now,
        "createdAt": now,
        "updatedAt": now,
    }

    await bids_collection.insert_one(new_bid)

    # 5 — Re-rank all active bids (L1 = lowest total = rank 1)
    all_latest = await bids_collection.find(
        {"rfq": ObjectId(rfq_id), "isLatest": True}
    ).sort("totalAmount", 1).to_list(length=None)

    if all_latest:
        bulk_ops = [
            UpdateOne({"_id": bid["_id"]}, {"$set": {"rank": idx + 1}})
            for idx, bid in enumerate(all_latest)
        ]
        await bids_collection.bulk_write(bulk_ops)

    # 6 — Fetch the populated leaderboard
    leaderboard = await get_leaderboard(rfq_id)

    # 7 — Check extension
    extension_log = await _check_and_extend(rfq, previous_ranks, all_latest)

    # 8 — Return results for the route handler to emit via Socket.io
    return leaderboard, extension_log, rfq
