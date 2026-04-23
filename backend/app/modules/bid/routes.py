"""Bid routes — submit bids and view the leaderboard for an RFQ."""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.middleware.auth import get_current_user, require_role
from app.modules.bid.schema import SubmitBidRequest
from app.modules.bid import service as bid_service
from app.modules.rfq import service as rfq_service

router = APIRouter()


@router.post("/{rfq_id}/bids", status_code=201)
async def submit_bid(
    request: Request,
    rfq_id: str,
    body: SubmitBidRequest,
    current_user: dict = Depends(require_role("supplier")),
):
    """Submit a bid for an active RFQ. Supplier only."""
    try:
        updated_bids, extension_log, rfq = await bid_service.submit_bid(
            rfq_id=rfq_id,
            supplier_id=current_user["_id"],
            bid_data=body.model_dump(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail={"success": False, "error": str(e)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"success": False, "error": str(e)})

    new_close_iso = (
        rfq["bidCloseTime"].isoformat() if rfq.get("bidCloseTime") else None
    )

    # NOTE: Socket.io removed — real-time updates are handled by frontend polling.
    # The updated bid data is returned in the HTTP response so the submitting
    # supplier gets immediate feedback; other clients pick it up on next poll.

    return {
        "success": True,
        "data": {
            "bids": updated_bids,
            "extensionLog": extension_log,
            "newBidCloseTime": new_close_iso,
        },
    }


@router.get("/{rfq_id}/bids")
async def get_bids_for_rfq(
    rfq_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all active bids for an RFQ sorted by rank."""
    rfq = await rfq_service.get_rfq_raw(rfq_id)
    if not rfq:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "error": "RFQ not found."},
        )

    bids = await bid_service.get_leaderboard(rfq_id)
    return {"success": True, "data": {"bids": bids}}
