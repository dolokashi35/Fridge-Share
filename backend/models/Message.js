import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

messageSchema.index({ from: 1, to: 1, timestamp: -1 });

export default mongoose.model("Message", messageSchema);


