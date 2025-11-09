import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderUsername: { type: String, required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "system"], default: "text" },
    locationData: {
      type: {
        lat: Number,
        lng: Number,
      },
      default: undefined,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatRoomSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    participants: { type: [participantSchema], default: [] },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

chatRoomSchema.index({ transactionId: 1 });
chatRoomSchema.index({ lastMessageAt: -1 });

export default mongoose.model("ChatRoom", chatRoomSchema);
