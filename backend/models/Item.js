import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: "Fresh",
    enum: [
      "Produce", "Dairy", "Baked", "Meat", "Seafood",
      "Frozen", "Fresh", "Drinks", "Snacks", "Canned", "Spices", "Sauces"
    ]
  },
  price: {
    type: Number,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    default: ""
  },
  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  expirationDate: {
    type: Date
  },
  listingDuration: {
    type: Number,
    min: 1,
    max: 7,
    default: 7
  },
  transferMethods: [{
    type: String,
    enum: ["Pickup", "Dropoff"]
  }],
  imageUrl: {
    type: String,
    default: ""
  },
  username: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["active", "reserved", "sold", "expired", "handed_off"],
    default: "active"
  },
  paymentIntentId: {
    type: String,
    default: null
  },
  handoffStatus: {
    type: String,
    enum: ["pending", "completed", "cancelled"],
    default: null
  },
  handoffTo: {
    type: String, // username of recipient
    default: null
  },
  handoffDate: {
    type: Date,
    default: null
  },
  handoffNotes: {
    type: String,
    default: ""
  },
  pickupCodeHash: {
    type: String,
    default: null
  },
  pickupCodeExpires: {
    type: Date,
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: false
    },
    name: {
      type: String,
      default: ""
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
});

// Index for better query performance
itemSchema.index({ status: 1, expiresAt: 1 });
itemSchema.index({ username: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ location: '2dsphere' }); // Geospatial index for location queries

export default mongoose.model('Item', itemSchema);
