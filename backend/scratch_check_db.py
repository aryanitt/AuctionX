import asyncio
from app.db import rfqs_collection

async def main():
    doc = await rfqs_collection.find_one({'name': 'onion'})
    print(doc)

asyncio.run(main())
