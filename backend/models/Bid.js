const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      required: [true, 'RFQ reference is required'],
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supplier reference is required'],
    },
    carrierName: {
      type: String,
      required: [true, 'Carrier name is required'],
      trim: true,
    },
    freightCharges: {
      type: Number,
      required: [true, 'Freight charges are required'],
      min: [0, 'Freight charges cannot be negative'],
    },
    originCharges: {
      type: Number,
      required: [true, 'Origin charges are required'],
      min: [0, 'Origin charges cannot be negative'],
    },
    destinationCharges: {
      type: Number,
      required: [true, 'Destination charges are required'],
      min: [0, 'Destination charges cannot be negative'],
    },
    totalAmount: {
      type: Number,
    },
    transitTime: {
      type: Number,
      required: [true, 'Transit time is required'],
      min: [1, 'Transit time must be at least 1 day'],
    },
    quoteValidityDate: {
      type: Date,
      required: [true, 'Quote validity date is required'],
    },
    rank: {
      type: Number,
    },
    isLatest: {
      type: Boolean,
      default: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Auto-compute totalAmount before saving
bidSchema.pre('save', function (next) {
  this.totalAmount =
    (this.freightCharges || 0) +
    (this.originCharges || 0) +
    (this.destinationCharges || 0);
  next();
});

// Index for efficient leaderboard queries
bidSchema.index({ rfq: 1, isLatest: 1, totalAmount: 1 });
bidSchema.index({ rfq: 1, supplier: 1, isLatest: 1 });

module.exports = mongoose.model('Bid', bidSchema);
