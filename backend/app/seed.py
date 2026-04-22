"""
Database seed script — populates test data for local development.

Usage:
    cd backend
    python -m app.seed

Creates:
  - 2 buyer accounts
  - 4 supplier accounts
  - 2 RFQs (one active, one closed)
  - Sample bids on the active RFQ

All test accounts use the password: Test@1234
"""

import asyncio
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from bson import ObjectId

from app.db import users_collection, rfqs_collection, bids_collection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
PASSWORD = pwd_context.hash("Test@1234")


async def seed():
    print("Dropping existing collections...")
    await users_collection.drop()
    await rfqs_collection.drop()
    await bids_collection.drop()

    now = datetime.now(timezone.utc)

    # ----- Users -----
    buyers = [
        {"_id": ObjectId(), "name": "Alice Buyer", "email": "buyer1@test.com", "password": PASSWORD, "role": "buyer", "createdAt": now, "updatedAt": now},
        {"_id": ObjectId(), "name": "Bob Buyer", "email": "buyer2@test.com", "password": PASSWORD, "role": "buyer", "createdAt": now, "updatedAt": now},
    ]
    suppliers = [
        {"_id": ObjectId(), "name": "Supplier One", "email": "supplier1@test.com", "password": PASSWORD, "role": "supplier", "createdAt": now, "updatedAt": now},
        {"_id": ObjectId(), "name": "Supplier Two", "email": "supplier2@test.com", "password": PASSWORD, "role": "supplier", "createdAt": now, "updatedAt": now},
        {"_id": ObjectId(), "name": "Supplier Three", "email": "supplier3@test.com", "password": PASSWORD, "role": "supplier", "createdAt": now, "updatedAt": now},
        {"_id": ObjectId(), "name": "Supplier Four", "email": "supplier4@test.com", "password": PASSWORD, "role": "supplier", "createdAt": now, "updatedAt": now},
    ]

    all_users = buyers + suppliers
    await users_collection.insert_many(all_users)
    print(f"  Inserted {len(all_users)} users")

    # ----- RFQs -----
    active_rfq = {
        "_id": ObjectId(),
        "referenceId": f"RFQ-{now.year}-001",
        "name": "Mumbai → Delhi Freight",
        "buyer": buyers[0]["_id"],
        "bidStartTime": now - timedelta(hours=1),
        "bidCloseTime": now + timedelta(hours=2),
        "forcedCloseTime": now + timedelta(hours=4),
        "pickupDate": now + timedelta(days=3),
        "status": "active",
        "auctionConfig": {
            "triggerWindowMinutes": 15,
            "extensionDurationMinutes": 10,
            "extensionTrigger": "l1_rank_change",
        },
        "extensionLogs": [],
        "createdAt": now - timedelta(hours=2),
        "updatedAt": now,
    }

    closed_rfq = {
        "_id": ObjectId(),
        "referenceId": f"RFQ-{now.year}-002",
        "name": "Chennai → Bangalore Freight",
        "buyer": buyers[1]["_id"],
        "bidStartTime": now - timedelta(days=2),
        "bidCloseTime": now - timedelta(days=1),
        "forcedCloseTime": now - timedelta(hours=12),
        "pickupDate": now + timedelta(days=1),
        "status": "closed",
        "auctionConfig": {
            "triggerWindowMinutes": 10,
            "extensionDurationMinutes": 5,
            "extensionTrigger": "bid_received",
        },
        "extensionLogs": [],
        "createdAt": now - timedelta(days=3),
        "updatedAt": now - timedelta(days=1),
    }

    await rfqs_collection.insert_many([active_rfq, closed_rfq])
    print("  Inserted 2 RFQs")

    # ----- Bids on the active RFQ -----
    bids = [
        {
            "rfq": active_rfq["_id"],
            "supplier": suppliers[0]["_id"],
            "carrierName": "FastShip Logistics",
            "freightCharges": 15000.0,
            "originCharges": 2000.0,
            "destinationCharges": 1500.0,
            "totalAmount": 18500.0,
            "transitTime": 3,
            "quoteValidityDate": now + timedelta(days=7),
            "isLatest": True,
            "rank": 1,
            "submittedAt": now - timedelta(minutes=30),
            "createdAt": now - timedelta(minutes=30),
            "updatedAt": now - timedelta(minutes=30),
        },
        {
            "rfq": active_rfq["_id"],
            "supplier": suppliers[1]["_id"],
            "carrierName": "QuickHaul Transport",
            "freightCharges": 16000.0,
            "originCharges": 2500.0,
            "destinationCharges": 1800.0,
            "totalAmount": 20300.0,
            "transitTime": 2,
            "quoteValidityDate": now + timedelta(days=7),
            "isLatest": True,
            "rank": 2,
            "submittedAt": now - timedelta(minutes=20),
            "createdAt": now - timedelta(minutes=20),
            "updatedAt": now - timedelta(minutes=20),
        },
        {
            "rfq": active_rfq["_id"],
            "supplier": suppliers[2]["_id"],
            "carrierName": "EcoMove Carriers",
            "freightCharges": 17500.0,
            "originCharges": 2200.0,
            "destinationCharges": 2000.0,
            "totalAmount": 21700.0,
            "transitTime": 4,
            "quoteValidityDate": now + timedelta(days=5),
            "isLatest": True,
            "rank": 3,
            "submittedAt": now - timedelta(minutes=10),
            "createdAt": now - timedelta(minutes=10),
            "updatedAt": now - timedelta(minutes=10),
        },
    ]

    await bids_collection.insert_many(bids)
    print(f"  Inserted {len(bids)} bids")

    print("\nSeed complete!")
    print("  Buyers:    buyer1@test.com, buyer2@test.com")
    print("  Suppliers: supplier1@test.com .. supplier4@test.com")
    print("  Password:  Test@1234")


if __name__ == "__main__":
    asyncio.run(seed())
