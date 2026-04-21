const cron = require('node-cron');
const RFQ = require('../models/RFQ');

/**
 * Register cron jobs for automatic auction lifecycle management.
 * Runs every minute to detect auctions that should be closed or force-closed.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance for event emission
 */
const registerCronJobs = (io) => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    try {
      // Force-close auctions that have exceeded their hard deadline
      const forceCloseable = await RFQ.find({
        status: 'active',
        forcedCloseTime: { $lte: now },
      });

      for (const rfq of forceCloseable) {
        rfq.status = 'force_closed';
        await rfq.save();

        io.to(`rfq:${rfq._id}`).emit('auction_force_closed', {
          rfqId: rfq._id,
          message: 'Auction has been force-closed (hard deadline reached).',
        });

        console.log(`[CRON] Force-closed RFQ ${rfq.referenceId}`);
      }

      // Close auctions that have passed their (possibly extended) bidCloseTime
      // but not yet at forcedCloseTime
      const closeable = await RFQ.find({
        status: 'active',
        bidCloseTime: { $lte: now },
        forcedCloseTime: { $gt: now },
      });

      for (const rfq of closeable) {
        rfq.status = 'closed';
        await rfq.save();

        io.to(`rfq:${rfq._id}`).emit('auction_closed', {
          rfqId: rfq._id,
          message: 'Auction bidding period has ended.',
        });

        console.log(`[CRON] Closed RFQ ${rfq.referenceId}`);
      }
    } catch (error) {
      console.error('[CRON] Error during auction lifecycle check:', error.message);
    }
  });

  console.log('[CRON] Auction lifecycle jobs registered (runs every minute)');
};

module.exports = { registerCronJobs };
