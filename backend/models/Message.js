import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // Threading by item (multiple chats with same user for different items)
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null },
    itemName: { type: String, default: "" },
    itemImageUrl: { type: String, default: "" },
  },
  { timestamps: false }
);

messageSchema.index({ from: 1, to: 1, timestamp: -1 });
messageSchema.index({ itemId: 1, from: 1, to: 1, timestamp: -1 });

export default mongoose.model("Message", messageSchema);


