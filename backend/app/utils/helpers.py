"""
Shared helper functions used across multiple modules.
"""

from datetime import datetime, timezone


def parse_iso_date(value: str | None) -> datetime | None:
    """
    Parse an ISO 8601 date string into a timezone-aware UTC datetime.

    Handles both ``Z`` suffix and ``+00:00`` offset formats sent by the frontend.
    Returns ``None`` if the input is empty or ``None``.
    """
    if not value:
        return None

    value = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(value)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt


def ensure_utc(dt: datetime) -> datetime:
    """Attach UTC tzinfo to a naive datetime. No-op if already aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
