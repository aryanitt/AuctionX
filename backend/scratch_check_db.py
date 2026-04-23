
import asyncio
from app.db import users_collection

async def check():
    try:
        print("Connecting to DB...")
        count = await users_collection.count_documents({})
        print(f"Connection successful. User count: {count}")
    except Exception as e:
        print(f"DB Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(check())
