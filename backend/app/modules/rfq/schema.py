"""Request/response schemas for the RFQ module."""

from pydantic import BaseModel
from typing import Literal, Optional


class AuctionConfigSchema(BaseModel):
    triggerWindowMinutes: int
    extensionDurationMinutes: int
    extensionTrigger: Literal["bid_received", "any_rank_change", "l1_rank_change"]


class CreateRFQRequest(BaseModel):
    name: str
    bidStartTime: str       # ISO 8601 string from the frontend
    bidCloseTime: str
    forcedCloseTime: str
    pickupDate: str
    auctionConfig: AuctionConfigSchema


class UpdateRFQRequest(BaseModel):
    name: Optional[str] = None
    bidStartTime: Optional[str] = None
    bidCloseTime: Optional[str] = None
    forcedCloseTime: Optional[str] = None
    pickupDate: Optional[str] = None
    auctionConfig: Optional[AuctionConfigSchema] = None
