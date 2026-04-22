"""
MongoDB document serializer.

Motor returns raw BSON types (ObjectId, datetime, etc.) that aren't
JSON-serializable or are slow for FastAPI's encoder. This module converts
them to plain Python types suitable for API responses.
"""

from datetime import datetime

from bson import ObjectId


def _serialize_value(value):
    """Convert a single value to a JSON-safe type."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return serialize_doc(value)
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def serialize_doc(doc: dict | None) -> dict | None:
    """Recursively convert ObjectId and datetime fields throughout a document."""
    if doc is None:
        return None

    return {key: _serialize_value(value) for key, value in doc.items()}
