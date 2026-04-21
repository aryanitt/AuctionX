const Bid = require('../models/Bid');
const RFQ = require('../models/RFQ');
const { asyncHandler } = require('../utils/asyncHandler');
const { checkAndExtend } = require('../services/extensionService');

/**
 * POST /api/rfqs/:rfqId/bids
 * Submit a new bid for an active RFQ (supplier only).
 *
 * Flow:
 *  1. Validate RFQ is active and within bid window
 *  2. Capture previous ranks for extension comparison
 *  3. Mark supplier's prior bids as isLatest=false
 *  4. Create new bid (totalAmount auto-computed in pre-save)
 *  5. Re-rank all isLatest=true bids via bulkWrite
 *  6. Run extension check
 *  7. Emit socket event
 *  8. Return updated leaderboard
 */
const submitBid = asyncHandler(async (req, res) => {
  const { rfqId } = req.params;
  const {
    carrierName,
    freightCharges,
    originCharges,
    destinationCharges,
    transitTime,
    quoteValidityDate,
  } = req.body;

  // Step 1: Fetch and validate RFQ status and timing
  const rfq = await RFQ.findById(rfqId);
  if (!rfq) {
    return res.status(404).json({ success: false, error: 'RFQ not found.' });
  }

  if (rfq.status !== 'active') {
    return res.status(400).json({
      success: false,
      error: `Cannot bid on an RFQ with status "${rfq.status}".`,
    });
  }

  const now = new Date();
  if (now < rfq.bidStartTime) {
    return res.status(400).json({
      success: false,
      error: 'Bidding has not started yet.',
    });
  }

  if (now > rfq.bidCloseTime) {
    return res.status(400).json({
      success: false,
      error: 'Bidding window has closed.',
    });
  }

  // Step 2: Snapshot current ranks before this bid changes anything
  const previousBids = await Bid.find({ rfq: rfqId, isLatest: true }).lean();
  const previousRanks = new Map(
    previousBids.map((bid) => [bid.supplier.toString(), bid.rank])
  );

  // Step 3: Mark all previous bids by this supplier for this RFQ as stale
  await Bid.updateMany(
    { rfq: rfqId, supplier: req.user._id, isLatest: true },
    { $set: { isLatest: false } }
  );

  // Step 4: Create the new bid
  const newBid = await Bid.create({
    rfq: rfqId,
    supplier: req.user._id,
    carrierName,
    freightCharges: Number(freightCharges),
    originCharges: Number(originCharges),
    destinationCharges: Number(destinationCharges),
    transitTime: Number(transitTime),
    quoteValidityDate: new Date(quoteValidityDate),
    isLatest: true,
  });

  // Step 5: Re-rank all isLatest=true bids for this RFQ by totalAmount ascending
  const allLatestBids = await Bid.find({ rfq: rfqId, isLatest: true })
    .sort({ totalAmount: 1 })
    .lean();

  // Assign rank: lowest totalAmount = rank 1 (L1)
  const bulkOperations = allLatestBids.map((bid, index) => ({
    updateOne: {
      filter: { _id: bid._id },
      update: { $set: { rank: index + 1 } },
    },
  }));

  if (bulkOperations.length > 0) {
    await Bid.bulkWrite(bulkOperations);
  }

  // Fetch updated bids with ranks applied for response and extension check
  const updatedBids = await Bid.find({ rfq: rfqId, isLatest: true })
    .populate('supplier', 'name email')
    .sort({ rank: 1 })
    .lean();

  // Step 6: Check if the auction should be extended
  const extensionLog = await checkAndExtend(rfq, newBid, previousRanks, updatedBids);

  // Step 7: Emit real-time socket events to all clients watching this RFQ
  const io = req.app.get('io');
  if (io) {
    io.to(`rfq:${rfqId}`).emit('bid_update', {
      rfqId,
      bids: updatedBids,
      extensionLog,
      newBidCloseTime: rfq.bidCloseTime,
    });

    if (extensionLog) {
      io.to(`rfq:${rfqId}`).emit('auction_extended', {
        rfqId,
        extensionLog,
        newBidCloseTime: rfq.bidCloseTime,
      });
    }
  }

  // Step 8: Return updated leaderboard
  res.status(201).json({
    success: true,
    data: {
      bids: updatedBids,
      extensionLog,
      newBidCloseTime: rfq.bidCloseTime,
    },
  });
});

/**
 * GET /api/rfqs/:rfqId/bids
 * Get all active (isLatest=true) bids for an RFQ, sorted by rank.
 */
const getBidsForRFQ = asyncHandler(async (req, res) => {
  const { rfqId } = req.params;

  const rfqExists = await RFQ.exists({ _id: rfqId });
  if (!rfqExists) {
    return res.status(404).json({ success: false, error: 'RFQ not found.' });
  }

  const bids = await Bid.find({ rfq: rfqId, isLatest: true })
    .populate('supplier', 'name email')
    .sort({ rank: 1 })
    .lean();

  res.json({
    success: true,
    data: { bids },
  });
});

module.exports = { submitBid, getBidsForRFQ };
