import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    name: { type: String, default: "" },
    lastUpdated: { type: Date },
  },
  { _id: false }
);

const windowSchema = new mongoose.Schema(
  {
    start: { type: Date },
    end: { type: Date },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    sellerId: { type: String, required: true }, // using username as id in current app
    buyerId: { type: String, required: true },
    verificationCode: { type: String, required: true },
    qrCode: { type: String, default: "" },
    chatRoomId: { type: String, required: true },
    status: { type: String, enum: ["pending", "confirmed", "completed"], default: "pending" },
    completedAt: { type: Date },
    pickupWindow: { type: windowSchema, default: undefined },
    location: { type: pointSchema, default: undefined },
    sellerLocation: { type: pointSchema, default: undefined },
    buyerLocation: { type: pointSchema, default: undefined },
  },
  { timestamps: true }
);

transactionSchema.index({ sellerId: 1, buyerId: 1, createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);