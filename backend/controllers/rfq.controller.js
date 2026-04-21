const RFQ = require('../models/RFQ');
const Bid = require('../models/Bid');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Generate a unique referenceId in the format RFQ-YYYY-NNN.
 * Counts existing RFQs created this year to compute the sequence number.
 */
const generateReferenceId = async () => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);

  const count = await RFQ.countDocuments({ createdAt: { $gte: startOfYear } });
  const sequence = String(count + 1).padStart(3, '0');

  return `RFQ-${year}-${sequence}`;
};

/**
 * POST /api/rfqs
 * Create a new RFQ. Buyer only.
 */
const createRFQ = asyncHandler(async (req, res) => {
  const {
    name,
    bidStartTime,
    bidCloseTime,
    forcedCloseTime,
    pickupDate,
    auctionConfig,
  } = req.body;

  // Validate required fields
  if (!name || !bidStartTime || !bidCloseTime || !forcedCloseTime || !pickupDate || !auctionConfig) {
    return res.status(400).json({
      success: false,
      error: 'All RFQ fields are required.',
    });
  }

  const parsedBidStart = new Date(bidStartTime);
  const parsedBidClose = new Date(bidCloseTime);
  const parsedForcedClose = new Date(forcedCloseTime);

  if (parsedBidStart >= parsedBidClose) {
    return res.status(400).json({
      success: false,
      error: 'bidStartTime must be before bidCloseTime.',
    });
  }

  if (parsedForcedClose <= parsedBidClose) {
    return res.status(400).json({
      success: false,
      error: 'forcedCloseTime must be after bidCloseTime.',
    });
  }

  const referenceId = await generateReferenceId();

  // Determine initial status based on whether bidding has already started
  const now = new Date();
  const status = parsedBidStart <= now ? 'active' : 'draft';

  const rfq = await RFQ.create({
    referenceId,
    name,
    buyer: req.user._id,
    bidStartTime: parsedBidStart,
    bidCloseTime: parsedBidClose,
    forcedCloseTime: parsedForcedClose,
    pickupDate: new Date(pickupDate),
    status,
    auctionConfig,
  });

  res.status(201).json({
    success: true,
    data: { rfq },
  });
});

/**
 * GET /api/rfqs
 * List all RFQs with buyer name and current L1 (lowest active) bid.
 */
const listRFQs = asyncHandler(async (req, res) => {
  const rfqs = await RFQ.find()
    .populate('buyer', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  // For each RFQ, look up the lowest isLatest=true bid
  const rfqIds = rfqs.map((r) => r._id);

  const lowestBids = await Bid.aggregate([
    { $match: { rfq: { $in: rfqIds }, isLatest: true } },
    { $sort: { totalAmount: 1 } },
    {
      $group: {
        _id: '$rfq',
        lowestBid: { $first: '$$ROOT' },
      },
    },
  ]);

  const lowestBidMap = {};
  lowestBids.forEach((entry) => {
    lowestBidMap[entry._id.toString()] = entry.lowestBid;
  });

  const enrichedRFQs = rfqs.map((rfq) => ({
    _id: rfq._id,
    referenceId: rfq.referenceId,
    name: rfq.name,
    status: rfq.status,
    bidCloseTime: rfq.bidCloseTime,
    forcedCloseTime: rfq.forcedCloseTime,
    buyer: rfq.buyer,
    lowestBid: lowestBidMap[rfq._id.toString()] || null,
  }));

  res.json({
    success: true,
    data: { rfqs: enrichedRFQs },
  });
});

/**
 * GET /api/rfqs/:id
 * Get full RFQ detail with populated buyer and ranked bid leaderboard.
 */
const getRFQById = asyncHandler(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id)
    .populate('buyer', 'name email')
    .lean();

  if (!rfq) {
    return res.status(404).json({
      success: false,
      error: 'RFQ not found.',
    });
  }

  // Fetch leaderboard: all latest bids sorted by rank ascending
  const bids = await Bid.find({ rfq: rfq._id, isLatest: true })
    .populate('supplier', 'name email')
    .sort({ rank: 1 })
    .lean();

  res.json({
    success: true,
    data: { rfq, bids },
  });
});

/**
 * PUT /api/rfqs/:id
 * Update an RFQ. Only the buyer can update, and only before bidding starts.
 */
const updateRFQ = asyncHandler(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id);

  if (!rfq) {
    return res.status(404).json({ success: false, error: 'RFQ not found.' });
  }

  if (rfq.buyer.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, error: 'Not authorized to modify this RFQ.' });
  }

  const now = new Date();
  if (rfq.bidStartTime <= now) {
    return res.status(400).json({ success: false, error: 'Cannot modify RFQ after bidding has started.' });
  }

  const {
    name,
    bidStartTime,
    bidCloseTime,
    forcedCloseTime,
    pickupDate,
    auctionConfig,
  } = req.body;

  if (name) rfq.name = name;
  if (bidStartTime) rfq.bidStartTime = new Date(bidStartTime);
  if (bidCloseTime) rfq.bidCloseTime = new Date(bidCloseTime);
  if (forcedCloseTime) rfq.forcedCloseTime = new Date(forcedCloseTime);
  if (pickupDate) rfq.pickupDate = new Date(pickupDate);
  if (auctionConfig) rfq.auctionConfig = auctionConfig;

  if (rfq.bidStartTime >= rfq.bidCloseTime) {
    return res.status(400).json({ success: false, error: 'bidStartTime must be before bidCloseTime.' });
  }
  if (rfq.forcedCloseTime <= rfq.bidCloseTime) {
    return res.status(400).json({ success: false, error: 'forcedCloseTime must be after bidCloseTime.' });
  }

  // Update status based on new start time
  rfq.status = rfq.bidStartTime <= now ? 'active' : 'draft';

  await rfq.save();

  res.json({
    success: true,
    data: { rfq },
  });
});

module.exports = { createRFQ, listRFQs, getRFQById, updateRFQ };
