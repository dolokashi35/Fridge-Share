import mongoose from 'mongoose';

const chatRoomSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  participants: [{
    userId: String,
    username: String,
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
  }],
  messages: [{
    senderId: String,
    senderUsername: String,
    content: String,
    type: {
      type: String,
      enum: ['text', 'location', 'system'],
      default: 'text'
    },
    locationData: {
      coordinates: [Number],
      name: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
chatRoomSchema.index({ transactionId: 1 });
chatRoomSchema.index({ 'participants.userId': 1 });
chatRoomSchema.index({ lastMessageAt: -1 });

export default mongoose.model('ChatRoom', chatRoomSchema);
