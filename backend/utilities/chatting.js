/* Chat utility to send messages*/
/* First fetch the authenticated user info from the socket, then handle chat events */
/* then fetch all users in userModel for easiest chat implementation */


// Declaring chatting database as it is not be saved to database

// old ones will be removed only last 1000 messages stored


/*Schema
{
message: '',
createdAt: '',
time: '10:30 AM',
sender: {
    email: '',
    full_name: '',
    telephone: '',
    userId: '',
}


*/
var Global_Messages = []

// these stored for a whole day

/*schema

{
message: '',
createdAt: '',
time: '10:30 AM',
sender: {
    email: '',
    full_name: '',
    telephone: '',
    userId: '',
},
receiver: {
    email: '',
    full_name: '',
    telephone: '',
    userId: '',
}

*/
var InBoxMessages = []
// updated every 10 minutes from database to makesure that we have all users in the system for chat functionality
var AllUsers = []

// schema

/*

{
messageId: '',
readerIds: [userId1, userId2, ...],
}

*/

var MessagesWithWhoReadIt = []

// import all neccessary modules and crypto for message id
const crypto = require('crypto')
const user_model = require('../models/user.js')

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
        hour12: true 
    });
}

function Global_ChatRoom() {
    return "global_chat_room"
}

function Private_Room(userId) {
    return `PRIVATE_ROOM_${userId}`
}

/**
 * Update AllUsers from database
 */
async function UpdateAllUsers() {
    try {
        const users = await user_model.find({}, "is_active email full_name telephone")
        AllUsers = users
    } catch (e) {
        console.log('Error fetching users for chat:', e)
    }
}

/**
 * Get all users
 * @returns {Array} - Array of users
 */
function GetAllUsers() {
    return AllUsers;
}

/* with respective MessagesWithWhoReadIt */

 async function MarkMessagesAsRead( userId, MessageArrayIds) {
    try {
        MessageArrayIds.forEach(messageId => {
            let messageReadInfo = MessagesWithWhoReadIt.find(msg => msg.messageId === messageId)
            if (messageReadInfo) {
                if (!messageReadInfo.readerIds.includes(userId)) {
                    messageReadInfo.readerIds.push(userId)
                }
            } else {
                MessagesWithWhoReadIt.push({
                    messageId: messageId,
                    readerIds: [userId]
                })
            }
        })
    } catch (e) {
        console.log('Error marking messages as read:', e)
    }
}

/**
 * Mark a single inbox message as read
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID who is reading the message
 * @returns {object} - Result object
 */
async function MarkMessageAsRead(messageId, userId) {
    try {
        const message = InBoxMessages.find(msg => msg.messageId === messageId);
        
        if (!message) {
            return { success: false, error: 'Message not found' };
        }
        
        // Initialize readBy array if it doesn't exist
        if (!message.readBy) {
            message.readBy = [];
        }
        
        // Add user to readBy if not already there
        if (!message.readBy.includes(userId)) {
            message.readBy.push(userId);
            message.readAt = new Date().toISOString();
        }
        
        return { success: true, messageId, readBy: message.readBy };
    } catch (e) {
        console.log('Error marking message as read:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Get unread message count for a user from a specific sender
 * @param {string} userId - User ID (receiver)
 * @param {string} fromUserId - Sender user ID
 * @returns {number} - Unread message count
 */
function GetUnreadCount(userId, fromUserId) {
    const messages = InBoxMessages.filter(msg => 
        !msg.isDeleted &&
        msg.sender.userId === fromUserId &&
        msg.receiver.userId === userId
    );
    
    return messages.filter(msg => !msg.readBy || !msg.readBy.includes(userId)).length;
}

/**
 * Create a new global message
 * @param {string} message - Message content
 * @param {object} sender - Sender info {email, full_name, telephone, userId}
 * @returns {object} - Created message object
 */
async function CreateGlobalMessage(message, sender) {
    const messageId = generateMessageId();
    const newMessage = {
        messageId,
        message,
        createdAt: new Date().toISOString(),
        time: getCurrentTime(),
        sender,
        isEdited: false,
        isDeleted: false
    };
    
    Global_Messages.push(newMessage);
    
    // Keep only last 1000 messages
    await RemainLast1000GlobalMessages();
    
    return newMessage;
}

/**
 * Create a new inbox message (private/direct message)
 * @param {string} message - Message content
 * @param {object} sender - Sender info {email, full_name, telephone, userId}
 * @param {object} receiver - Receiver info {email, full_name, telephone, userId}
 * @returns {object} - Created message object
 */
async function CreateInboxMessage(message, sender, receiver) {
    const messageId = generateMessageId();
    const newMessage = {
        messageId,
        message,
        createdAt: new Date().toISOString(),
        time: getCurrentTime(),
        sender,
        receiver,
        isEdited: false,
        isDeleted: false
    };
    
    InBoxMessages.push(newMessage);
    
    return newMessage;
}

/**
 * Edit a global message
 * @param {string} messageId - Message ID to edit
 * @param {string} newMessage - New message content
 * @param {string} userId - User ID (for authorization)
 * @returns {object|null} - Updated message or null if not found/unauthorized
 */
async function EditGlobalMessage(messageId, newMessage, userId) {
    const message = Global_Messages.find(msg => msg.messageId === messageId);
    
    if (!message) {
        return { success: false, error: 'Message not found' };
    }
    
    if (message.sender.userId !== userId) {
        return { success: false, error: 'Unauthorized to edit this message' };
    }
    
    message.message = newMessage;
    message.isEdited = true;
    message.editedAt = new Date().toISOString();
    message.editedTime = getCurrentTime();
    
    return { success: true, message };
}

/**
 * Edit an inbox message
 * @param {string} messageId - Message ID to edit
 * @param {string} newMessage - New message content
 * @param {string} userId - User ID (for authorization)
 * @returns {object|null} - Updated message or null if not found/unauthorized
 */
async function EditInboxMessage(messageId, newMessage, userId) {
    const message = InBoxMessages.find(msg => msg.messageId === messageId);
    
    if (!message) {
        return { success: false, error: 'Message not found' };
    }
    
    // Both sender and receiver can edit the message
    if (message.sender.userId !== userId && message.receiver.userId !== userId) {
        return { success: false, error: 'Unauthorized to edit this message' };
    }
    
    message.message = newMessage;
    message.isEdited = true;
    message.editedAt = new Date().toISOString();
    message.editedTime = getCurrentTime();
    
    return { success: true, message };
}

/**
 * Delete a global message (soft delete)
 * @param {string} messageId - Message ID to delete
 * @param {string} userId - User ID (for authorization)
 * @returns {object} - Result object
 */
async function DeleteGlobalMessage(messageId, userId) {
    const messageIndex = Global_Messages.findIndex(msg => msg.messageId === messageId);
    
    if (messageIndex === -1) {
        return { success: false, error: 'Message not found' };
    }
    
    const message = Global_Messages[messageIndex];
    
    // Only sender can delete their own message
    if (message.sender.userId !== userId) {
        return { success: false, error: 'Unauthorized to delete this message' };
    }
    
    // Soft delete
    Global_Messages[messageIndex].isDeleted = true;
    Global_Messages[messageIndex].deletedAt = new Date().toISOString();
    Global_Messages[messageIndex].message = '[Message deleted]';
    
    // Also remove from read tracking
    MessagesWithWhoReadIt = MessagesWithWhoReadIt.filter(msg => msg.messageId !== messageId);
    
    return { success: true, messageId };
}

/**
 * Delete an inbox message (soft delete)
 * @param {string} messageId - Message ID to delete
 * @param {string} userId - User ID (for authorization)
 * @returns {object} - Result object
 */
async function DeleteInboxMessage(messageId, userId) {
    const messageIndex = InBoxMessages.findIndex(msg => msg.messageId === messageId);
    
    if (messageIndex === -1) {
        return { success: false, error: 'Message not found' };
    }
    
    const message = InBoxMessages[messageIndex];
    
    // Both sender and receiver can delete the message
    if (message.sender.userId !== userId && message.receiver.userId !== userId) {
        return { success: false, error: 'Unauthorized to delete this message' };
    }
    
    // Soft delete
    InBoxMessages[messageIndex].isDeleted = true;
    InBoxMessages[messageIndex].deletedAt = new Date().toISOString();
    InBoxMessages[messageIndex].message = '[Message deleted]';
    
    return { success: true, messageId };
}

/**
 * Get global messages
 * @returns {Array} - Array of global messages
 */
function GetGlobalMessages() {
    return Global_Messages.filter(msg => !msg.isDeleted);
}

/**
 * Get inbox messages for a user
 * @param {string} userId - User ID
 * @returns {Array} - Array of inbox messages
 */
async function GetInboxMessages(userId) {
    return InBoxMessages.filter(msg => 
        !msg.isDeleted && 
        (msg.sender.userId === userId || msg.receiver.userId === userId)
    );
}

/**
 * Get a specific message by ID (global)
 * @param {string} messageId - Message ID
 * @returns {object|null} - Message object or null
 */
function GetGlobalMessageById(messageId) {
    return Global_Messages.find(msg => msg.messageId === messageId && !msg.isDeleted);
}

/**
 * Get a specific message by ID (inbox)
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID (for authorization)
 * @returns {object|null} - Message object or null
 */
function GetInboxMessageById(messageId, userId) {
    const message = InBoxMessages.find(msg => 
        msg.messageId === messageId && 
        !msg.isDeleted &&
        (msg.sender.userId === userId || msg.receiver.userId === userId)
    );
    return message || null;
}

/* delete messages from global*/

async function DeleteMessageFromGlobal(messageId) {
    Global_Messages = Global_Messages.filter(msg => msg.messageId !== messageId)
    MessagesWithWhoReadIt = MessagesWithWhoReadIt.filter(msg => msg.messageId !== messageId)
}


async function RemainLast1000GlobalMessages() {
    if (Global_Messages.length > 1000) {
        Global_Messages = Global_Messages.slice(-1000)
    }
}


async function SendAllUsersToClient(socket) {
    socket.emit('all_users', AllUsers)
}

async function SendGlobalMessagesToClient(socket) {
    socket.emit('global_messages', GetGlobalMessages())
}

async function SendGlobalMessagesToAllClients() {
    global.WebsocketIO.to(Global_ChatRoom()).emit('global_messages', GetGlobalMessages())
}

async function SendInBoxMessagesToClient(socket) {
    const userId = socket.user.userId
    const userInBoxMessages = InBoxMessages.filter(msg => 
        !msg.isDeleted && (msg.sender.userId === userId) || (msg.receiver.userId === userId)
    )
    socket.emit('inbox_messages', userInBoxMessages)
}

/**
 * Send inbox message to specific user
 * @param {string} userId - Receiver user ID
 * @param {object} message - Message object
 */
async function SendInboxMessageToUser(userId, message) {
    const userSocketId = GetUserSocketId(userId);
    if (userSocketId) {
        global.WebsocketIO.to(userSocketId).emit('new_inbox_message', message);
    }
    // Also emit to the sender
    const senderSocketId = GetUserSocketId(message.sender.userId);
    if (senderSocketId) {
        global.WebsocketIO.to(senderSocketId).emit('new_inbox_message', message);
    }
}

// Store user socket mappings
var UserSockets = {};

/**
 * Register a user's socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function RegisterUserSocket(userId, socketId) {
    if (!UserSockets[userId]) {
        UserSockets[userId] = [];
    }
    if (!UserSockets[userId].includes(socketId)) {
        UserSockets[userId].push(socketId);
    }
}

/**
 * Unregister a user's socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function UnregisterUserSocket(userId, socketId) {
    if (UserSockets[userId]) {
        UserSockets[userId] = UserSockets[userId].filter(id => id !== socketId);
        if (UserSockets[userId].length === 0) {
            delete UserSockets[userId];
        }
    }
}

/**
 * Get socket ID for a user
 * @param {string} userId - User ID
 * @returns {string|null} - Socket ID or null
 */
function GetUserSocketId(userId) {
    const sockets = UserSockets[userId];
    return sockets && sockets.length > 0 ? sockets[0] : null;
}

/**
 * Get all connected users
 * @returns {Array} - Array of user IDs
 */
function GetConnectedUsers() {
    return Object.keys(UserSockets);
}

/**
 * Get messages between two specific users
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Array} - Array of messages between the two users
 */
function GetMessagesBetweenUsers(userId1, userId2) {
    
    // Convert userIds to strings for comparison (handle both MongoDB ObjectId and plain strings)
    const id1 = String(userId1);
    const id2 = String(userId2);
    
    const messages = InBoxMessages.filter(msg => {
        const senderId = String(msg.sender.userId);
        const receiverId = String(msg.receiver.userId);
        return !msg.isDeleted &&
        ((senderId === id1 && receiverId === id2) ||
         (senderId === id2 && receiverId === id1));
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    return messages;
}

// Export all functions
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
    RemainLast1000GlobalMessages,
    SendAllUsersToClient,
    
    // Get messages between users
    GetMessagesBetweenUsers
};
