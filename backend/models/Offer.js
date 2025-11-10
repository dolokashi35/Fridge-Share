import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    buyerUsername: { type: String, required: true },
    sellerUsername: { type: String, required: true },
    offerPrice: { type: Number, required: true, min: 0 },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "countered", "ready_for_pickup", "completed", "cancelled"],
      default: "pending",
    },
    counterPrice: { type: Number, default: null },
    schedule: {
      timeOption: { type: String, enum: ["within_hour", "later_today", "tomorrow", null], default: null },
      preferredLocation: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

offerSchema.index({ itemId: 1, buyerUsername: 1, createdAt: -1 });

export default mongoose.model("Offer", offerSchema);


