const mongoose = require('mongoose');

const extensionLogSchema = new mongoose.Schema(
  {
    previousCloseTime: { type: Date, required: true },
    newCloseTime: { type: Date, required: true },
    triggerReason: { type: String, required: true },
    extendedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const auctionConfigSchema = new mongoose.Schema(
  {
    triggerWindowMinutes: {
      type: Number,
      required: [true, 'Trigger window duration is required'],
      min: [1, 'Trigger window must be at least 1 minute'],
    },
    extensionDurationMinutes: {
      type: Number,
      required: [true, 'Extension duration is required'],
      min: [1, 'Extension duration must be at least 1 minute'],
    },
    extensionTrigger: {
      type: String,
      enum: ['bid_received', 'any_rank_change', 'l1_rank_change'],
      required: [true, 'Extension trigger type is required'],
    },
  },
  { _id: false }
);

const rfqSchema = new mongoose.Schema(
  {
    referenceId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'RFQ name is required'],
      trim: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer reference is required'],
    },
    bidStartTime: {
      type: Date,
      required: [true, 'Bid start time is required'],
    },
    bidCloseTime: {
      type: Date,
      required: [true, 'Bid close time is required'],
    },
    forcedCloseTime: {
      type: Date,
      required: [true, 'Forced close time is required'],
    },
    pickupDate: {
      type: Date,
      required: [true, 'Pickup date is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'force_closed'],
      default: 'draft',
    },
    auctionConfig: {
      type: auctionConfigSchema,
      required: [true, 'Auction configuration is required'],
    },
    extensionLogs: [extensionLogSchema],
  },
  { timestamps: true }
);

// Pre-save validation: forcedCloseTime must be strictly after bidCloseTime
rfqSchema.pre('save', function (next) {
  if (this.forcedCloseTime <= this.bidCloseTime) {
    return next(
      new Error('forcedCloseTime must be greater than bidCloseTime')
    );
  }
  next();
});

module.exports = mongoose.model('RFQ', rfqSchema);
