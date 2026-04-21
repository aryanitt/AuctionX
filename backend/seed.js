require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const RFQ = require('./models/RFQ');
const Bid = require('./models/Bid');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/british-auction';

const seedDatabase = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('[SEED] Connected to MongoDB');

  // Clear existing data
  await Bid.deleteMany({});
  await RFQ.deleteMany({});
  await User.deleteMany({});
  console.log('[SEED] Cleared existing data');

  // ─── Users ─────────────────────────────────────────────────────────────────
  const password = 'Test@1234';
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const usersData = [
    { name: 'Alice Buyer', email: 'buyer1@test.com', password: hashedPassword, role: 'buyer' },
    { name: 'Bob Buyer', email: 'buyer2@test.com', password: hashedPassword, role: 'buyer' },
    { name: 'Supply Co Ltd', email: 'supplier1@test.com', password: hashedPassword, role: 'supplier' },
    { name: 'Global Freight Inc', email: 'supplier2@test.com', password: hashedPassword, role: 'supplier' },
    { name: 'FastMove Logistics', email: 'supplier3@test.com', password: hashedPassword, role: 'supplier' },
    { name: 'BlueLine Carriers', email: 'supplier4@test.com', password: hashedPassword, role: 'supplier' },
  ];

  // Bypass pre-save hook for seeding (password is already hashed)
  const users = await User.insertMany(usersData);
  console.log(`[SEED] Created ${users.length} users`);

  const buyer1 = users.find((u) => u.email === 'buyer1@test.com');
  const buyer2 = users.find((u) => u.email === 'buyer2@test.com');
  const supplier1 = users.find((u) => u.email === 'supplier1@test.com');
  const supplier2 = users.find((u) => u.email === 'supplier2@test.com');
  const supplier3 = users.find((u) => u.email === 'supplier3@test.com');
  const supplier4 = users.find((u) => u.email === 'supplier4@test.com');

  // ─── RFQs ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const pickupDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pickupDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const rfqsData = [
    {
      referenceId: `RFQ-${now.getFullYear()}-001`,
      name: 'Mumbai to Delhi Freight',
      buyer: buyer1._id,
      bidStartTime: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      bidCloseTime: twoHoursFromNow,
      forcedCloseTime: threeHoursFromNow,
      pickupDate: pickupDate1,
      status: 'active',
      auctionConfig: {
        triggerWindowMinutes: 10,
        extensionDurationMinutes: 5,
        extensionTrigger: 'l1_rank_change',
      },
      extensionLogs: [
        {
          previousCloseTime: new Date(now.getTime() + 1.5 * 60 * 60 * 1000),
          newCloseTime: twoHoursFromNow,
          triggerReason: 'L1 (lowest bidder) changed within trigger window',
          extendedAt: new Date(now.getTime() - 10 * 60 * 1000),
        },
      ],
    },
    {
      referenceId: `RFQ-${now.getFullYear()}-002`,
      name: 'Pune Export Shipment',
      buyer: buyer2._id,
      bidStartTime: threeDaysAgo,
      bidCloseTime: twoDaysAgo,
      forcedCloseTime: yesterday,
      pickupDate: pickupDate2,
      status: 'closed',
      auctionConfig: {
        triggerWindowMinutes: 15,
        extensionDurationMinutes: 10,
        extensionTrigger: 'bid_received',
      },
      extensionLogs: [],
    },
  ];

  const rfqs = await RFQ.insertMany(rfqsData);
  console.log(`[SEED] Created ${rfqs.length} RFQs`);

  const activeRFQ = rfqs.find((r) => r.referenceId === `RFQ-${now.getFullYear()}-001`);

  // ─── Bids (for active RFQ) ─────────────────────────────────────────────────
  // Six bids from four suppliers with varying amounts to show ranking
  const bidsData = [
    {
      rfq: activeRFQ._id,
      supplier: supplier1._id,
      carrierName: 'DTDC Express',
      freightCharges: 12000,
      originCharges: 1500,
      destinationCharges: 1000,
      totalAmount: 14500,
      transitTime: 3,
      quoteValidityDate: fiveHoursFromNow,
      rank: 1,
      isLatest: true,
    },
    {
      rfq: activeRFQ._id,
      supplier: supplier2._id,
      carrierName: 'Blue Dart',
      freightCharges: 13500,
      originCharges: 1200,
      destinationCharges: 800,
      totalAmount: 15500,
      transitTime: 2,
      quoteValidityDate: fiveHoursFromNow,
      rank: 2,
      isLatest: true,
    },
    {
      rfq: activeRFQ._id,
      supplier: supplier3._id,
      carrierName: 'FedEx India',
      freightCharges: 14000,
      originCharges: 2000,
      destinationCharges: 1200,
      totalAmount: 17200,
      transitTime: 4,
      quoteValidityDate: fiveHoursFromNow,
      rank: 3,
      isLatest: true,
    },
    {
      rfq: activeRFQ._id,
      supplier: supplier4._id,
      carrierName: 'Gati Express',
      freightCharges: 15000,
      originCharges: 1800,
      destinationCharges: 1500,
      totalAmount: 18300,
      transitTime: 5,
      quoteValidityDate: fiveHoursFromNow,
      rank: 4,
      isLatest: true,
    },
    // Stale bids (isLatest=false) showing bid history for suppliers 1 & 2
    {
      rfq: activeRFQ._id,
      supplier: supplier1._id,
      carrierName: 'DTDC Express',
      freightCharges: 16000,
      originCharges: 1600,
      destinationCharges: 1100,
      totalAmount: 18700,
      transitTime: 3,
      quoteValidityDate: fiveHoursFromNow,
      rank: null,
      isLatest: false,
    },
    {
      rfq: activeRFQ._id,
      supplier: supplier2._id,
      carrierName: 'Blue Dart',
      freightCharges: 17000,
      originCharges: 1400,
      destinationCharges: 900,
      totalAmount: 19300,
      transitTime: 2,
      quoteValidityDate: fiveHoursFromNow,
      rank: null,
      isLatest: false,
    },
  ];

  await Bid.insertMany(bidsData);
  console.log(`[SEED] Created ${bidsData.length} bids`);

  console.log('\n[SEED] ✅ Database seeded successfully!\n');
  console.log('─────────────────────────────────────');
  console.log('Test Credentials (password: Test@1234)');
  console.log('─────────────────────────────────────');
  console.log('Buyers:    buyer1@test.com | buyer2@test.com');
  console.log('Suppliers: supplier1@test.com | supplier2@test.com');
  console.log('           supplier3@test.com | supplier4@test.com');
  console.log('─────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
};

seedDatabase().catch((error) => {
  console.error('[SEED] Error:', error.message);
  process.exit(1);
});
