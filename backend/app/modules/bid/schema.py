"""Request/response schemas for the bid module."""

from pydantic import BaseModel


class SubmitBidRequest(BaseModel):
    carrierName: str
    freightCharges: float
    originCharges: float
    destinationCharges: float
    transitTime: int
    quoteValidityDate: str  # ISO 8601 date string
