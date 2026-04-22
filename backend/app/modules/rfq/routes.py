"""RFQ routes — list, detail, create, and update RFQs."""

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user, require_role
from app.modules.rfq.schema import CreateRFQRequest, UpdateRFQRequest
from app.modules.rfq import service as rfq_service
from app.modules.bid import service as bid_service
from app.utils.serializer import serialize_doc

router = APIRouter()


@router.get("")
async def list_rfqs(current_user: dict = Depends(get_current_user)):
    """Return all RFQs with buyer info and the current L1 bid."""
    rfqs = await rfq_service.list_rfqs()
    return {"success": True, "data": {"rfqs": rfqs}}


@router.get("/{rfq_id}")
async def get_rfq(rfq_id: str, current_user: dict = Depends(get_current_user)):
    """Return full RFQ detail with populated buyer and ranked bid leaderboard."""
    rfq = await rfq_service.get_rfq_by_id(rfq_id)
    if not rfq:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "error": "RFQ not found."},
        )

    bids = await bid_service.get_leaderboard(rfq_id)

    return {
        "success": True,
        "data": {
            "rfq": serialize_doc(rfq),
            "bids": bids,
        },
    }


@router.post("", status_code=201)
async def create_rfq(
    body: CreateRFQRequest,
    current_user: dict = Depends(require_role("buyer")),
):
    """Create a new RFQ. Buyer only."""
    try:
        rfq = await rfq_service.create_rfq(
            buyer_id=current_user["_id"],
            data=body.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "error": str(e)},
        )

    return {"success": True, "data": {"rfq": serialize_doc(rfq)}}


@router.put("/{rfq_id}")
async def update_rfq(
    rfq_id: str,
    body: UpdateRFQRequest,
    current_user: dict = Depends(require_role("buyer")),
):
    """Update a draft RFQ before bidding starts. Buyer only."""
    try:
        updates = body.model_dump(exclude_none=True)
        updated = await rfq_service.update_rfq(
            rfq_id=rfq_id,
            buyer_id=current_user["_id"],
            updates=updates,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail={"success": False, "error": str(e)})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"success": False, "error": str(e)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"success": False, "error": str(e)})

    return {"success": True, "data": {"rfq": serialize_doc(updated)}}


@router.delete("/{rfq_id}")
async def delete_rfq(
    rfq_id: str,
    current_user: dict = Depends(require_role("buyer")),
):
    """Delete a draft RFQ. Buyer only."""
    try:
        await rfq_service.delete_rfq(
            rfq_id=rfq_id,
            buyer_id=current_user["_id"],
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail={"success": False, "error": str(e)})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"success": False, "error": str(e)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"success": False, "error": str(e)})

    return {"success": True, "message": "RFQ deleted successfully."}
