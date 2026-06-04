/**
 * Chat Utility - MongoDB Persistence with full WhatsApp-like features
 * Supports: pagination, files, GIFs, audio, view once, replies, forwarding, stickers
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const ChatMessage = require('../models/chat_message.js');
const User = require('../models/user.js');

const UserSockets = {};
const PAGE_SIZE = 20;

function generateMessageId() {
  return crypto.randomBytes(16).toString('hex');
}

function Global_ChatRoom() {
  return 'global_chat_room';
}

function Private_Room(userId) {
  return `PRIVATE_ROOM_${String(userId)}`;
}

// ── User socket mappings ──
function RegisterUserSocket(userId, socketId) {
  if (!UserSockets[userId]) UserSockets[userId] = [];
  if (!UserSockets[userId].includes(socketId)) UserSockets[userId].push(socketId);
}
function UnregisterUserSocket(userId, socketId) {
  if (UserSockets[userId]) {
    UserSockets[userId] = UserSockets[userId].filter(id => id !== socketId);
    if (UserSockets[userId].length === 0) delete UserSockets[userId];
  }
}
function GetUserSocketId(userId) {
  const sockets = UserSockets[userId];
  return sockets && sockets.length > 0 ? sockets[0] : null;
}
function GetAllUserSockets(userId) {
  return UserSockets[userId] || [];
}
function GetConnectedUsers() {
  return Object.keys(UserSockets);
}

// ── Users cache ──
let AllUsers = [];
let lastUsersFetch = 0;
const USERS_FETCH_INTERVAL = 10 * 60 * 1000;

async function UpdateAllUsers() {
  try {
    const now = Date.now();
    if (now - lastUsersFetch < USERS_FETCH_INTERVAL && AllUsers.length > 0) return;
    AllUsers = await User.find({}, 'is_active email full_name telephone').lean();
    lastUsersFetch = now;
  } catch (e) { console.log('Error fetching users:', e); }
}
function GetAllUsers() { return AllUsers; }
async function SendAllUsersToClient(socket) { socket.emit('all_users', AllUsers); }

// ── File upload helper ──
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function getFileType(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/') && !mimeType.includes('gif')) return 'image';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function getExtension(mimeType) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm',
    'audio/mp3': '.mp3', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg',
    'audio/wav': '.wav', 'audio/webm': '.webm', 'application/pdf': '.pdf',
  };
  return map[mimeType] || '.bin';
}

async function SaveFile(buffer, mimeType, originalName) {
  const ext = getExtension(mimeType) || path.extname(originalName) || '.bin';
  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return {
    url: `/uploads/chat/${filename}`,
    name: originalName || filename,
    size: buffer.length,
    mimeType,
    contentType: getFileType(mimeType),
  };
}

// ── Global Messages ──
async function CreateGlobalMessage(message, sender, extra = {}) {
  const messageId = generateMessageId();
  const doc = await ChatMessage.create({
    messageId,
    message,
    type: 'global',
    contentType: extra.contentType || 'text',
    sender: { userId: sender.userId, email: sender.email, full_name: sender.full_name },
    fileUrl: extra.fileUrl || null,
    fileName: extra.fileName || null,
    fileSize: extra.fileSize || null,
    mimeType: extra.mimeType || null,
    thumbnailUrl: extra.thumbnailUrl || null,
    duration: extra.duration || null,
    gifUrl: extra.gifUrl || null,
    gifTitle: extra.gifTitle || '',
    stickerUrl: extra.stickerUrl || null,
    isForwarded: extra.isForwarded || false,
    forwardedFrom: extra.forwardedFrom || null,
    replyTo: extra.replyTo || null,
    isViewOnce: extra.isViewOnce || false,
    createdAt: new Date(),
  });
  return doc.toJSON();
}

async function GetGlobalMessages(page = 0) {
  return ChatMessage.find({ type: 'global', isDeleted: false })
    .sort({ createdAt: -1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean()
    .then(docs => docs.reverse());
}

async function GetGlobalMessagesCount() {
  return ChatMessage.countDocuments({ type: 'global', isDeleted: false });
}

async function SendGlobalMessagesToClient(socket, page = 0) {
  const msgs = await GetGlobalMessages(page);
  socket.emit('global_messages', { messages: msgs, page, hasMore: msgs.length === PAGE_SIZE });
}
async function SendGlobalMessagesToAllClients(page = 0) {
  const msgs = await GetGlobalMessages(page);
  global.WebsocketIO.to(Global_ChatRoom()).emit('global_messages', { messages: msgs, page, hasMore: msgs.length === PAGE_SIZE });
}

// ── Inbox Messages ──
async function CreateInboxMessage(message, sender, receiver, extra = {}) {
  const messageId = generateMessageId();
  const conversationKey = ChatMessage.makeConversationKey(sender.userId, receiver.userId);
  const doc = await ChatMessage.create({
    messageId, message, type: 'inbox',
    contentType: extra.contentType || 'text',
    sender: { userId: sender.userId, email: sender.email, full_name: sender.full_name },
    receiver: { userId: String(receiver.userId), email: receiver.email || '', full_name: receiver.full_name || '' },
    conversationKey,
    fileUrl: extra.fileUrl || null, fileName: extra.fileName || null, fileSize: extra.fileSize || null,
    mimeType: extra.mimeType || null, thumbnailUrl: extra.thumbnailUrl || null, duration: extra.duration || null,
    gifUrl: extra.gifUrl || null, gifTitle: extra.gifTitle || '',
    stickerUrl: extra.stickerUrl || null,
    isForwarded: extra.isForwarded || false, forwardedFrom: extra.forwardedFrom || null,
    replyTo: extra.replyTo || null,
    isViewOnce: extra.isViewOnce || false,
    createdAt: new Date(),
  });
  return doc.toJSON();
}

async function GetMessagesBetweenUsers(userId1, userId2, page = 0) {
  const conversationKey = ChatMessage.makeConversationKey(userId1, userId2);
  return ChatMessage.find({
    type: 'inbox', isDeleted: false, conversationKey,
  })
    .sort({ createdAt: -1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean()
    .then(docs => docs.reverse());
}

async function GetMessagesBetweenUsersCount(userId1, userId2) {
  const conversationKey = ChatMessage.makeConversationKey(userId1, userId2);
  return ChatMessage.countDocuments({ type: 'inbox', isDeleted: false, conversationKey });
}

async function SendInboxMessageToUser(message, receiverId) {
  const room = Private_Room(receiverId);
  if (global.WebsocketIO) global.WebsocketIO.to(room).emit('new_inbox_message', message);
  if (message.sender && message.sender.userId) {
    const senderRoom = Private_Room(message.sender.userId);
    if (global.WebsocketIO) global.WebsocketIO.to(senderRoom).emit('new_inbox_message', message);
  }
}

// ── Edit / Delete ──
async function EditMessage(messageId, newMessage, userId) {
  const msg = await ChatMessage.findOne({ messageId, isDeleted: false });
  if (!msg) return { success: false, error: 'Message not found' };
  if (msg.sender.userId !== userId) return { success: false, error: 'Unauthorized' };
  const previousMessage = msg.message;
  msg.message = newMessage;
  msg.isEdited = true;
  msg.editedAt = new Date();
  if (!msg.editHistory) msg.editHistory = [];
  msg.editHistory.push({ previousMessage, editedAt: new Date() });
  await msg.save();
  return { success: true, message: msg.toJSON() };
}

async function DeleteMessage(messageId, userId, deleteForEveryone = false) {
  const msg = await ChatMessage.findOne({ messageId, isDeleted: false });
  if (!msg) return { success: false, error: 'Message not found' };
  if (msg.sender.userId !== userId && !deleteForEveryone) return { success: false, error: 'Unauthorized' };
  if (deleteForEveryone) {
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.deletedForEveryone = true;
  } else {
    // "delete for me" - we still keep but mark
    msg.message = '[Message deleted]';
    msg.isDeleted = true;
    msg.deletedAt = new Date();
  }
  await msg.save();
  return { success: true, messageId, deletedForEveryone: msg.deletedForEveryone };
}

// ── Read receipts ──
async function MarkMessageAsRead(messageId, userId) {
  try {
    const msg = await ChatMessage.findOne({ messageId, isDeleted: false });
    if (!msg) return { success: false, error: 'Message not found' };
    const alreadyRead = msg.readBy.some(r => r.userId === userId);
    if (!alreadyRead) {
      msg.readBy.push({ userId, readAt: new Date() });
      await msg.save();
    }
    return { success: true, messageId, readBy: msg.readBy };
  } catch (e) { return { success: false, error: e.message }; }
}

async function MarkViewOnceViewed(messageId, userId) {
  try {
    const msg = await ChatMessage.findOne({ messageId, isViewOnce: true });
    if (!msg) return { success: false, error: 'Message not found' };
    const alreadyViewed = msg.viewedBy && msg.viewedBy.some(r => r.userId === userId);
    if (!alreadyViewed) {
      if (!msg.viewedBy) msg.viewedBy = [];
      msg.viewedBy.push({ userId, viewedAt: new Date() });
      // Auto-delete after view
      msg.isDeleted = true;
      msg.deletedAt = new Date();
      await msg.save();
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ── Trim old ──
async function TrimOldGlobalMessages() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await ChatMessage.deleteMany({ type: 'global', createdAt: { $lt: sevenDaysAgo } });
}

module.exports = {
  Global_ChatRoom, Private_Room,
  UpdateAllUsers, GetAllUsers, SendAllUsersToClient,
  RegisterUserSocket, UnregisterUserSocket, GetUserSocketId, GetAllUserSockets, GetConnectedUsers,
  CreateGlobalMessage, GetGlobalMessages, GetGlobalMessagesCount, SendGlobalMessagesToClient, SendGlobalMessagesToAllClients,
  CreateInboxMessage, GetMessagesBetweenUsers, GetMessagesBetweenUsersCount, SendInboxMessageToUser,
  EditMessage, DeleteMessage, MarkMessageAsRead, MarkViewOnceViewed,
  TrimOldGlobalMessages, generateMessageId,
  SaveFile, getFileType, PAGE_SIZE,
};