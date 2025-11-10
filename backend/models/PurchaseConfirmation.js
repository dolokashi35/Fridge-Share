import mongoose from "mongoose";

const purchaseConfirmationSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    buyerUsername: { type: String, required: true },
    sellerUsername: { type: String, required: true },
    buyerConfirmed: { type: Boolean, default: false },
    sellerConfirmed: { type: Boolean, default: false },
    completed: { type: Boolean, default: false }, // true when both confirmed
  },
  { timestamps: true }
);

purchaseConfirmationSchema.index({ itemId: 1, buyerUsername: 1, sellerUsername: 1 });

export default mongoose.model("PurchaseConfirmation", purchaseConfirmationSchema);

