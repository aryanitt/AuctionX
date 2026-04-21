const Bid = require('../models/Bid');

/**
 * Compare the current ranks of all latest bids for an RFQ against the
 * supplied previousRanks map (supplierId string → rank number).
 *
 * @param {Map<string,number>} previousRanks - Snapshot before new bid
 * @param {Object[]} currentBids - Current sorted bid array (rank already updated)
 * @returns {{ anyChanged: boolean, l1Changed: boolean }}
 */
const compareRanks = (previousRanks, currentBids) => {
  let anyChanged = false;
  let l1Changed = false;

  for (const bid of currentBids) {
    const supplierId = bid.supplier.toString();
    const previousRank = previousRanks.get(supplierId);

    if (previousRank === undefined) {
      // This supplier is new to the leaderboard — counts as a rank change
      anyChanged = true;
      if (bid.rank === 1) l1Changed = true;
    } else if (bid.rank !== previousRank) {
      anyChanged = true;
      // L1 changed if either previous L1 supplier lost the top spot or
      // a supplier newly became L1
      if (bid.rank === 1 || previousRank === 1) {
        l1Changed = true;
      }
    }
  }

  // Also check if any supplier that previously had a rank is now gone
  if (!anyChanged) {
    for (const [supplierId] of previousRanks) {
      const stillPresent = currentBids.some(
        (b) => b.supplier.toString() === supplierId
      );
      if (!stillPresent) {
        anyChanged = true;
        break;
      }
    }
  }

  return { anyChanged, l1Changed };
};

/**
 * Core auction extension logic.
 * Checks if the new bid falls inside the trigger window and, based on the
 * configured extensionTrigger, decides whether to extend bidCloseTime.
 *
 * Clamping: Proposed new close time is capped at forcedCloseTime so the
 * hard deadline is never exceeded.
 *
 * @param {Object} rfq - Mongoose RFQ document (mutable, will be saved if extended)
 * @param {Object} newBid - The newly submitted Bid document
 * @param {Map<string,number>} previousRanks - supplierId→rank snapshot before this bid
 * @param {Object[]} updatedBids - Current leaderboard after re-ranking
 * @returns {Object|null} Extension log entry if extended, null otherwise
 */
const checkAndExtend = async (rfq, newBid, previousRanks, updatedBids) => {
  const now = new Date();
  const triggerWindowMs = rfq.auctionConfig.triggerWindowMinutes * 60 * 1000;
  const windowStart = new Date(rfq.bidCloseTime.getTime() - triggerWindowMs);

  // Bid must be within the trigger window to qualify for extension
  if (now < windowStart) return null;

  const { extensionTrigger, extensionDurationMinutes } = rfq.auctionConfig;
  let shouldExtend = false;
  let reason = '';

  if (extensionTrigger === 'bid_received') {
    // Any bid within the window triggers extension
    shouldExtend = true;
    reason = `Bid received within ${rfq.auctionConfig.triggerWindowMinutes}-minute trigger window`;
  } else if (extensionTrigger === 'any_rank_change') {
    const { anyChanged } = compareRanks(previousRanks, updatedBids);
    if (anyChanged) {
      shouldExtend = true;
      reason = 'Supplier ranking changed within trigger window';
    }
  } else if (extensionTrigger === 'l1_rank_change') {
    const { l1Changed } = compareRanks(previousRanks, updatedBids);
    if (l1Changed) {
      shouldExtend = true;
      reason = 'L1 (lowest bidder) changed within trigger window';
    }
  }

  if (!shouldExtend) return null;

  const extensionMs = extensionDurationMinutes * 60 * 1000;
  const proposedCloseTime = new Date(rfq.bidCloseTime.getTime() + extensionMs);

  // Clamp: never extend beyond forcedCloseTime
  const newCloseTime =
    proposedCloseTime > rfq.forcedCloseTime
      ? rfq.forcedCloseTime
      : proposedCloseTime;

  // No-op if already at or past forced close
  if (newCloseTime <= rfq.bidCloseTime) return null;

  const extensionLog = {
    previousCloseTime: rfq.bidCloseTime,
    newCloseTime,
    triggerReason: reason,
    extendedAt: now,
  };

  rfq.extensionLogs.push(extensionLog);
  rfq.bidCloseTime = newCloseTime;
  await rfq.save();

  return extensionLog;
};

module.exports = { checkAndExtend };
