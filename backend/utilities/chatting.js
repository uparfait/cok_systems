/**
 * Chat Utility - MongoDB Persistence
 * All messages are stored in MongoDB instead of in-memory variables
 * Provides full CRUD operations for global and inbox chat messages
 */

const crypto = require('crypto');
const ChatMessage = require('../models/chat_message.js');
const User = require('../models/user.js');

// In-memory cache for connected user socket mappings (still needed for real-time)
const UserSockets = {};

/**
 * Generate a unique message ID
 * @returns {string} - Unique message ID
 */
function generateMessageId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Get current time in HH:MM AM/PM format
 * @returns {string} - Formatted time
 */
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function Global_ChatRoom() {
  return 'global_chat_room';
}

function Private_Room(userId) {
  return `PRIVATE_ROOM_${String(userId)}`;
}

// ──────────────────────────────────────────────
// USER SOCKET MAPPING
// ──────────────────────────────────────────────

function RegisterUserSocket(userId, socketId) {
  if (!UserSockets[userId]) {
    UserSockets[userId] = [];
  }
  if (!UserSockets[userId].includes(socketId)) {
    UserSockets[userId].push(socketId);
  }
}

function UnregisterUserSocket(userId, socketId) {
  if (UserSockets[userId]) {
    UserSockets[userId] = UserSockets[userId].filter(id => id !== socketId);
    if (UserSockets[userId].length === 0) {
      delete UserSockets[userId];
    }
  }
}

function GetUserSocketId(userId) {
  const sockets = UserSockets[userId];
  return sockets && sockets.length > 0 ? sockets[0] : null;
}

function GetConnectedUsers() {
  return Object.keys(UserSockets);
}

// ──────────────────────────────────────────────
// USERS (cached from DB every 10 minutes)
// ──────────────────────────────────────────────

let AllUsers = [];
let lastUsersFetch = 0;
const USERS_FETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function UpdateAllUsers() {
  try {
    const now = Date.now();
    if (now - lastUsersFetch < USERS_FETCH_INTERVAL && AllUsers.length > 0) {
      return;
    }
    const users = await User.find(
      {},
      'is_active email full_name telephone',
    ).lean();
    AllUsers = users;
    lastUsersFetch = now;
  } catch (e) {
    console.log('Error fetching users for chat:', e);
  }
}

function GetAllUsers() {
  return AllUsers;
}

async function SendAllUsersToClient(socket) {
  socket.emit('all_users', AllUsers);
}

// ──────────────────────────────────────────────
// GLOBAL MESSAGES
// ──────────────────────────────────────────────

/**
 * Create a new global message (persisted to MongoDB)
 */
async function CreateGlobalMessage(message, sender) {
  const messageId = generateMessageId();
  const doc = await ChatMessage.create({
    messageId,
    message,
    type: 'global',
    sender: {
      userId: sender.userId,
      email: sender.email,
      full_name: sender.full_name,
    },
    createdAt: new Date(),
  });
  return doc.toJSON();
}

/**
 * Edit a global message
 */
async function EditGlobalMessage(messageId, newMessage, userId) {
  const msg = await ChatMessage.findOne({ messageId, type: 'global', isDeleted: false });
  if (!msg) {
    return { success: false, error: 'Message not found' };
  }
  if (msg.sender.userId !== userId) {
    return { success: false, error: 'Unauthorized to edit this message' };
  }
  msg.message = newMessage;
  msg.isEdited = true;
  msg.editedAt = new Date();
  await msg.save();
  return { success: true, message: msg.toJSON() };
}

/**
 * Delete a global message (soft delete)
 */
async function DeleteGlobalMessage(messageId, userId) {
  const msg = await ChatMessage.findOne({ messageId, type: 'global', isDeleted: false });
  if (!msg) {
    return { success: false, error: 'Message not found' };
  }
  if (msg.sender.userId !== userId) {
    return { success: false, error: 'Unauthorized to delete this message' };
  }
  msg.isDeleted = true;
  msg.deletedAt = new Date();
  await msg.save();
  return { success: true, messageId };
}

/**
 * Get all non-deleted global messages (last 1000)
 */
async function GetGlobalMessages() {
  return ChatMessage.find({ type: 'global', isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean()
    .then(docs => docs.reverse());
}

function GetGlobalMessageById(messageId) {
  return ChatMessage.findOne({ messageId, type: 'global', isDeleted: false }).lean();
}

async function SendGlobalMessagesToClient(socket) {
  const msgs = await GetGlobalMessages();
  socket.emit('global_messages', msgs);
}

async function SendGlobalMessagesToAllClients() {
  const msgs = await GetGlobalMessages();
  global.WebsocketIO.to(Global_ChatRoom()).emit('global_messages', msgs);
}

async function DeleteMessageFromGlobal(messageId) {
  await ChatMessage.updateOne({ messageId }, { isDeleted: true, deletedAt: new Date() });
}

/**
 * Trim global messages older than 7 days (keep only recent)
 */
async function TrimOldGlobalMessages() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await ChatMessage.deleteMany({ type: 'global', createdAt: { $lt: sevenDaysAgo } });
}

// ──────────────────────────────────────────────
// INBOX / PRIVATE MESSAGES
// ──────────────────────────────────────────────

/**
 * Create a new inbox message (persisted to MongoDB)
 */
async function CreateInboxMessage(message, sender, receiver) {
  const messageId = generateMessageId();
  const conversationKey = ChatMessage.makeConversationKey(sender.userId, receiver.userId);
  const doc = await ChatMessage.create({
    messageId,
    message,
    type: 'inbox',
    sender: {
      userId: sender.userId,
      email: sender.email,
      full_name: sender.full_name,
    },
    receiver: {
      userId: String(receiver.userId),
      email: receiver.email || '',
      full_name: receiver.full_name || '',
    },
    conversationKey,
    createdAt: new Date(),
  });
  return doc.toJSON();
}

/**
 * Edit an inbox message
 */
async function EditInboxMessage(messageId, newMessage, userId) {
  const msg = await ChatMessage.findOne({ messageId, type: 'inbox', isDeleted: false });
  if (!msg) {
    return { success: false, error: 'Message not found' };
  }
  if (msg.sender.userId !== userId && msg.receiver.userId !== userId) {
    return { success: false, error: 'Unauthorized to edit this message' };
  }
  msg.message = newMessage;
  msg.isEdited = true;
  msg.editedAt = new Date();
  await msg.save();
  return { success: true, message: msg.toJSON() };
}

/**
 * Delete an inbox message (soft delete)
 */
async function DeleteInboxMessage(messageId, userId) {
  const msg = await ChatMessage.findOne({ messageId, type: 'inbox', isDeleted: false });
  if (!msg) {
    return { success: false, error: 'Message not found' };
  }
  if (msg.sender.userId !== userId && msg.receiver.userId !== userId) {
    return { success: false, error: 'Unauthorized to delete this message' };
  }
  msg.isDeleted = true;
  msg.deletedAt = new Date();
  await msg.save();
  return { success: true, messageId };
}

/**
 * Get all inbox messages for a user (conversations list)
 */
async function GetInboxMessages(userId) {
  const sid = String(userId);
  return ChatMessage.find({
    type: 'inbox',
    isDeleted: false,
    $or: [{ 'sender.userId': sid }, { 'receiver.userId': sid }],
  })
    .sort({ createdAt: -1 })
    .lean();
}

function GetInboxMessageById(messageId, userId) {
  return ChatMessage.findOne({
    messageId,
    type: 'inbox',
    isDeleted: false,
    $or: [{ 'sender.userId': userId }, { 'receiver.userId': userId }],
  }).lean();
}

/**
 * Get messages between two specific users (sorted chronological)
 */
async function GetMessagesBetweenUsers(userId1, userId2) {
  const conversationKey = ChatMessage.makeConversationKey(userId1, userId2);
  return ChatMessage.find({
    type: 'inbox',
    isDeleted: false,
    conversationKey,
  })
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Send the latest inbox messages snapshot to a specific socket for a given user
 */
async function SendInBoxMessagesToClient(socket) {
  const userId = socket.user.userId;
  const msgs = await GetInboxMessages(userId);
  const sid = String(userId);

  // Group by conversation and get latest message per conversation
  const conversations = {};
  for (const msg of msgs) {
    const otherId = msg.sender.userId === sid ? msg.receiver.userId : msg.sender.userId;
    if (!conversations[otherId] || new Date(msg.createdAt) > new Date(conversations[otherId].createdAt)) {
      conversations[otherId] = msg;
    }
  }

  socket.emit('inbox_messages', msgs);
}

/**
 * Send a specific inbox message to a user via their private room
 */
async function SendInboxMessageToUser(message, receiverId) {
  const room = Private_Room(receiverId);
  if (global.WebsocketIO) {
    global.WebsocketIO.to(room).emit('new_inbox_message', message);
  }

  // Also send to the sender
  if (message.sender && message.sender.userId) {
    const senderRoom = Private_Room(message.sender.userId);
    if (global.WebsocketIO) {
      global.WebsocketIO.to(senderRoom).emit('new_inbox_message', message);
    }
  }
}

// ──────────────────────────────────────────────
// READ TRACKING
// ──────────────────────────────────────────────

async function MarkMessageAsRead(messageId, userId) {
  try {
    const msg = await ChatMessage.findOne({ messageId, isDeleted: false });
    if (!msg) {
      return { success: false, error: 'Message not found' };
    }

    const alreadyRead = msg.readBy.some(r => r.userId === userId);
    if (!alreadyRead) {
      msg.readBy.push({ userId, readAt: new Date() });
      await msg.save();
    }
    return { success: true, messageId, readBy: msg.readBy };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function MarkMessagesAsRead(userId, messageIds) {
  const sid = String(userId);
  for (const messageId of messageIds) {
    try {
      const msg = await ChatMessage.findOne({ messageId, isDeleted: false });
      if (msg) {
        const alreadyRead = msg.readBy.some(r => r.userId === sid);
        if (!alreadyRead) {
          msg.readBy.push({ userId: sid, readAt: new Date() });
          await msg.save();
        }
      }
    } catch (e) {
      // continue with next
    }
  }
}

function GetUnreadCount(userId, fromUserId) {
  // We'll handle this via MongoDB query
  return ChatMessage.countDocuments({
    type: 'inbox',
    isDeleted: false,
    'sender.userId': String(fromUserId),
    'receiver.userId': String(userId),
    'readBy.userId': { $ne: String(userId) },
  });
}

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────

module.exports = {
  // Room functions
  Global_ChatRoom,
  Private_Room,

  // User functions
  UpdateAllUsers,
  GetAllUsers,
  RegisterUserSocket,
  UnregisterUserSocket,
  GetUserSocketId,
  GetConnectedUsers,

  // Global message functions
  CreateGlobalMessage,
  EditGlobalMessage,
  DeleteGlobalMessage,
  GetGlobalMessages,
  GetGlobalMessageById,
  SendGlobalMessagesToClient,
  SendGlobalMessagesToAllClients,

  // Inbox message functions
  CreateInboxMessage,
  EditInboxMessage,
  DeleteInboxMessage,
  GetInboxMessages,
  GetInboxMessageById,
  SendInBoxMessagesToClient,
  SendInboxMessageToUser,

  // Read tracking
  MarkMessagesAsRead,
  MarkMessageAsRead,
  GetUnreadCount,

  // Utilities
  generateMessageId,
  getCurrentTime,
  DeleteMessageFromGlobal,
  TrimOldGlobalMessages,
  SendAllUsersToClient,

  // Get messages between users
  GetMessagesBetweenUsers,
};