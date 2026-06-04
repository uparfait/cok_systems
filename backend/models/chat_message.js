const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  message: {
    type: String,
    default: '',
    maxlength: 50000,
  },
  type: {
    type: String,
    enum: ['global', 'inbox'],
    required: true,
    index: true,
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'gif', 'sticker', 'view_once'],
    default: 'text',
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
  // File/media metadata
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },
  mimeType: { type: String, default: null },
  thumbnailUrl: { type: String, default: null },
  duration: { type: Number, default: null }, // audio/video duration in seconds
  // View once (disappearing messages)
  isViewOnce: { type: Boolean, default: false },
  viewedBy: [
    {
      userId: { type: String },
      viewedAt: { type: Date, default: Date.now },
    },
  ],
  // For stickers
  stickerUrl: { type: String, default: null },
  // For GIFs
  gifUrl: { type: String, default: null },
  gifTitle: { type: String, default: '' },
  // For forwarded messages
  isForwarded: { type: Boolean, default: false },
  forwardedFrom: { type: String, default: null },
  // Message metadata
  createdAt: { type: Date, default: Date.now, index: true },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  editHistory: [
    {
      previousMessage: String,
      editedAt: { type: Date, default: Date.now },
    },
  ],
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  // For "delete for everyone"
  deletedForEveryone: { type: Boolean, default: false },
  readBy: [
    {
      userId: { type: String },
      readAt: { type: Date, default: Date.now },
    },
  ],
  deliveredTo: [
    {
      userId: { type: String },
      deliveredAt: { type: Date, default: Date.now },
    },
  ],
  // Reply to
  replyTo: {
    messageId: { type: String, default: null },
    message: { type: String, default: '' },
    senderName: { type: String, default: '' },
  },
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
chatMessageSchema.index({ conversationKey: 1, createdAt: -1 });

chatMessageSchema.statics.makeConversationKey = function (userId1, userId2) {
  const ids = [String(userId1), String(userId2)].sort();
  return `${ids[0]}_${ids[1]}`;
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);