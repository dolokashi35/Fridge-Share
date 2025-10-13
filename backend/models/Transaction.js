import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  sellerId: {
    type: String,
    required: true
  },
  buyerId: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    enum: ['direct', 'handoff'],
    default: 'direct'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  pickupWindow: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  verificationCode: {
    type: String,
    required: true
  },
  qrCode: {
    type: String,
    required: true
  },
  chatRoomId: {
    type: String,
    required: true
  },
  sellerLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    lastUpdated: Date
  },
  buyerLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    lastUpdated: Date
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
transactionSchema.index({ itemId: 1 });
transactionSchema.index({ sellerId: 1 });
transactionSchema.index({ buyerId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ pickupWindow: 1 });
transactionSchema.index({ location: '2dsphere' });

export default mongoose.model('Transaction', transactionSchema);
