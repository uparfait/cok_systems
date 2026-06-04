const mongoose = require('mongoose');

/**
 * Chat Message Schema
 * Stores all chat messages persistently in MongoDB
 * Supports both global chat and private inbox messages
 */
const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 10000,
  },
  type: {
    type: String,
    enum: ['global', 'inbox'],
    required: true,
    index: true,
  },
  sender: {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    full_name: { type: String, required: true },
  },
  receiver: {
    userId: { type: String, default: null },
    email: { type: String, default: '' },
    full_name: { type: String, default: '' },
  },
  conversationKey: {
    type: String,
    default: null,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  readBy: [
    {
      userId: { type: String },
      readAt: { type: Date, default: Date.now },
    },
  ],
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform(doc, ret) {
      delete ret.__v;
      delete ret._id;
      return ret;
    },
  },
});

// Compound indexes for efficient queries
chatMessageSchema.index({ type: 1, createdAt: -1 });
chatMessageSchema.index({ type: 1, isDeleted: 1, createdAt: -1 });
chatMessageSchema.index({ 'sender.userId': 1, 'receiver.userId': 1, createdAt: -1 });
chatMessageSchema.index({ conversationKey: 1, isDeleted: 1, createdAt: -1 });

/**
 * Generate a deterministic conversation key for inbox messages
 * @param {string} userId1
 * @param {string} userId2
 * @returns {string}
 */
chatMessageSchema.statics.makeConversationKey = function (userId1, userId2) {
  const ids = [String(userId1), String(userId2)].sort();
  return `${ids[0]}_${ids[1]}`;
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);