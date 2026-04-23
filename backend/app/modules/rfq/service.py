"""RFQ service — CRUD operations and reference ID generation."""

from datetime import datetime, timezone

from bson import ObjectId

from app.db import rfqs_collection, bids_collection
from app.utils.serializer import serialize_doc
from app.utils.helpers import parse_iso_date


async def generate_reference_id() -> str:
    """
    Auto-generate a yearly sequential reference like ``RFQ-2025-001``.

    Finds the highest existing RFQ number for the current year and increments it,
    avoiding duplicate keys if earlier RFQs were deleted.
    """
    year = datetime.now(timezone.utc).year
    start_of_year = datetime(year, 1, 1, tzinfo=timezone.utc)

    # Find the RFQ from this year with the highest referenceId
    latest_rfq = await rfqs_collection.find(
        {"createdAt": {"$gte": start_of_year}}
    ).sort("referenceId", -1).limit(1).to_list(length=1)

    if not latest_rfq or "referenceId" not in latest_rfq[0]:
        return f"RFQ-{year}-001"

    latest_id = latest_rfq[0]["referenceId"]
    # Example: "RFQ-2025-005" -> extract the "005" part
    try:
        sequence_num = int(latest_id.split("-")[-1])
    except (ValueError, IndexError):
        sequence_num = 0

    return f"RFQ-{year}-{str(sequence_num + 1).zfill(3)}"


async def create_rfq(buyer_id: str, data: dict) -> dict:
    """
    Create a new RFQ document.

    Validates time constraints (start < close < forced close) and
    determines the initial status — ``draft`` if bidding hasn't started
    yet, ``active`` if it already has.
    """
    bid_start = parse_iso_date(data["bidStartTime"])
    bid_close = parse_iso_date(data["bidCloseTime"])
    forced_close = parse_iso_date(data["forcedCloseTime"])

    if bid_start >= bid_close:
        raise ValueError("bidStartTime must be before bidCloseTime.")
    if forced_close <= bid_close:
        raise ValueError("forcedCloseTime must be after bidCloseTime.")

    now = datetime.now(timezone.utc)
    status = "active" if bid_start <= now else "draft"

    rfq_doc = {
        "referenceId": await generate_reference_id(),
        "name": data["name"].strip(),
        "buyer": ObjectId(buyer_id),
        "bidStartTime": bid_start,
        "bidCloseTime": bid_close,
        "forcedCloseTime": forced_close,
        "pickupDate": parse_iso_date(data["pickupDate"]),
        "status": status,
        "auctionConfig": data["auctionConfig"],
        "extensionLogs": [],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await rfqs_collection.insert_one(rfq_doc)
    rfq_doc["_id"] = result.inserted_id
    return rfq_doc


async def list_rfqs() -> list:
    """
    Return all RFQs sorted newest-first, with buyer details populated
    and the lowest active bid (L1) attached to each.

    Uses a single aggregation pipeline to avoid multiple DB round-trips.
    """
    pipeline = [
        {
            "$lookup": {
                "from": "users",
                "localField": "buyer",
                "foreignField": "_id",
                "as": "buyer",
                "pipeline": [{"$project": {"name": 1, "email": 1}}],
            }
        },
        {"$unwind": {"path": "$buyer", "preserveNullAndEmptyArrays": True}},
        # Lookup the lowest bid for each RFQ in the same pipeline
        {
            "$lookup": {
                "from": "bids",
                "let": {"rfq_id": "$_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$eq": ["$rfq", "$$rfq_id"]},
                        {"$eq": ["$isLatest", True]},
                    ]}}},
                    {"$sort": {"totalAmount": 1}},
                    {"$limit": 1},
                    {"$project": {"totalAmount": 1, "transitTime": 1}},
                ],
                "as": "lowestBidArr",
            }
        },
        {"$sort": {"createdAt": -1}},
    ]

    rfqs = await rfqs_collection.aggregate(pipeline).to_list(length=None)

    return [
        serialize_doc({
            "_id": rfq["_id"],
            "referenceId": rfq.get("referenceId"),
            "name": rfq.get("name"),
            "status": rfq.get("status"),
            "bidStartTime": rfq.get("bidStartTime"),
            "bidCloseTime": rfq.get("bidCloseTime"),
            "forcedCloseTime": rfq.get("forcedCloseTime"),
            "buyer": rfq.get("buyer"),
            "lowestBid": rfq["lowestBidArr"][0] if rfq.get("lowestBidArr") else None,
        })
        for rfq in rfqs
    ]


async def get_rfq_by_id(rfq_id: str) -> dict | None:
    """Get a single RFQ with buyer details populated."""
    pipeline = [
        {"$match": {"_id": ObjectId(rfq_id)}},
        {
            "$lookup": {
                "from": "users",
                "localField": "buyer",
                "foreignField": "_id",
                "as": "buyer",
                "pipeline": [{"$project": {"name": 1, "email": 1}}],
            }
        },
        {"$unwind": {"path": "$buyer", "preserveNullAndEmptyArrays": True}},
    ]
    result = await rfqs_collection.aggregate(pipeline).to_list(length=1)
    return result[0] if result else None


async def get_rfq_raw(rfq_id: str) -> dict | None:
    """Fetch a raw RFQ document without any joins — used internally by other services."""
    return await rfqs_collection.find_one({"_id": ObjectId(rfq_id)})


async def update_rfq(rfq_id: str, buyer_id: str, updates: dict) -> dict:
    """
    Update a draft RFQ's fields.

    Only the owning buyer can update, and only before bidding has started.
    Re-validates time constraints after applying partial updates.
    """
    rfq = await rfqs_collection.find_one({"_id": ObjectId(rfq_id)})
    if not rfq:
        raise LookupError("RFQ not found.")

    if str(rfq["buyer"]) != buyer_id:
        raise PermissionError("Not authorized to modify this RFQ.")

    now = datetime.now(timezone.utc)
    bid_start = rfq["bidStartTime"]
    if bid_start.tzinfo is None:
        bid_start = bid_start.replace(tzinfo=timezone.utc)

    if bid_start <= now:
        raise ValueError("Cannot modify RFQ after bidding has started.")

    # Build the $set payload from provided fields
    set_fields = {"updatedAt": now}

    if updates.get("name"):
        set_fields["name"] = updates["name"].strip()
    if updates.get("bidStartTime"):
        set_fields["bidStartTime"] = parse_iso_date(updates["bidStartTime"])
    if updates.get("bidCloseTime"):
        set_fields["bidCloseTime"] = parse_iso_date(updates["bidCloseTime"])
    if updates.get("forcedCloseTime"):
        set_fields["forcedCloseTime"] = parse_iso_date(updates["forcedCloseTime"])
    if updates.get("pickupDate"):
        set_fields["pickupDate"] = parse_iso_date(updates["pickupDate"])
    if updates.get("auctionConfig"):
        set_fields["auctionConfig"] = updates["auctionConfig"]

    # Merge updated fields with existing values for cross-field validation
    final_start = set_fields.get("bidStartTime", rfq["bidStartTime"])
    final_close = set_fields.get("bidCloseTime", rfq["bidCloseTime"])
    final_forced = set_fields.get("forcedCloseTime", rfq["forcedCloseTime"])

    if final_start >= final_close:
        raise ValueError("bidStartTime must be before bidCloseTime.")
    if final_forced <= final_close:
        raise ValueError("forcedCloseTime must be after bidCloseTime.")

    # Recalculate status based on the (potentially updated) start time
    if final_start.tzinfo is None:
        final_start = final_start.replace(tzinfo=timezone.utc)
    set_fields["status"] = "active" if final_start <= now else "draft"

    await rfqs_collection.update_one({"_id": ObjectId(rfq_id)}, {"$set": set_fields})
    return await rfqs_collection.find_one({"_id": ObjectId(rfq_id)})


async def delete_rfq(rfq_id: str, buyer_id: str) -> bool:
    """
    Delete a draft RFQ.
    
    Only the owning buyer can delete, and only before bidding has started.
    """
    rfq = await rfqs_collection.find_one({"_id": ObjectId(rfq_id)})
    if not rfq:
        raise LookupError("RFQ not found.")

    if str(rfq["buyer"]) != buyer_id:
        raise PermissionError("Not authorized to modify this RFQ.")

    if rfq["status"] != "draft":
        raise ValueError("Cannot delete RFQ after bidding has started.")

    await rfqs_collection.delete_one({"_id": ObjectId(rfq_id)})
    # Also delete any bids that might have been somehow attached to this draft RFQ
    await bids_collection.delete_many({"rfq": ObjectId(rfq_id)})
    return True
