/**
 * Chat Real-time Handler
 * Handles WebSocket events for global chat and private messaging
 * All messages are persisted to MongoDB
 */

const chat = require('../../../utilities/chatting.js');
const User = require('../../../models/user.js');

/**
 * Check if socket is authenticated
 * @param {object} socket - Socket instance
 * @returns {object} - { isAuthenticated: boolean, user: object|null }
 */
function checkAuth(socket) {
  if (!socket.user) {
    return { isAuthenticated: false, user: null };
  }d ../backend
  return { isAuthenticated: true, user: socket.user };
}

/**
 * Initialize chatting handlers for a socket connection
 * @param {object} socket - Socket.IO socket instance
 */
async function InitChatting(socket) {
  // Fetch all users on connection
  try {
    await chat.UpdateAllUsers();
    await chat.SendAllUsersToClient(socket);
  } catch (e) {
    console.log('Error fetching all users for chat:', e);
  }

  // Register user socket if authenticated
  if (socket.user) {
    chat.RegisterUserSocket(socket.user.userId, socket.id);

    // Join user's private room
    socket.join(chat.Private_Room(socket.user.userId));

    // Join global chat room
    socket.join(chat.Global_ChatRoom());

    // Notify others that user is online
    global.WebsocketIO.emit('user_online', {
      userId: socket.user.userId,
      fullName: socket.user.fullName,
      email: socket.user.email,
    });

    // Send connected users list
    const connectedUsers = chat.GetConnectedUsers();
    socket.emit('connected_users', connectedUsers);
  }

  // ========================
  // GLOBAL CHAT EVENTS
  // ========================

  // Send global message
  socket.on('send_global_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { message } = data;
      if (!message || message.trim() === '') {
        return callback({ success: false, message: 'Message cannot be empty' });
      }

      const sender = {
        email: auth.user.email,
        full_name: auth.user.fullName,
        userId: auth.user.userId,
      };

      const newMessage = await chat.CreateGlobalMessage(message, sender);

      // Broadcast updated messages to all clients in global chat room
      await chat.SendGlobalMessagesToAllClients();

      return callback({ success: true, message: newMessage });
    } catch (error) {
      console.error('Error sending global message:', error);
      return callback({ success: false, message: 'Error sending message' });
    }
  });

  // Edit global message
  socket.on('edit_global_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { messageId, message } = data;
      if (!messageId || !message) {
        return callback({ success: false, message: 'Message ID and content required' });
      }

      const result = await chat.EditGlobalMessage(messageId, message, auth.user.userId);

      if (result.success) {
        // Broadcast edit to all clients
        global.WebsocketIO.emit('global_message_edited', {
          messageId,
          newMessage: message,
          editedAt: result.message.editedAt,
        });
      }

      return callback(result);
    } catch (error) {
      console.error('Error editing global message:', error);
      return callback({ success: false, message: 'Error editing message' });
    }
  });

  // Delete global message
  socket.on('delete_global_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { messageId } = data;
      if (!messageId) {
        return callback({ success: false, message: 'Message ID required' });
      }

      const result = await chat.DeleteGlobalMessage(messageId, auth.user.userId);

      if (result.success) {
        // Notify all clients about the deletion
        global.WebsocketIO.emit('global_message_deleted', { messageId });
        // Send updated messages
        await chat.SendGlobalMessagesToAllClients();
      }

      return callback(result);
    } catch (error) {
      console.error('Error deleting global message:', error);
      return callback({ success: false, message: 'Error deleting message' });
    }
  });

  // Get global messages
  socket.on('get_global_messages', async (data, callback) => {
    try {
      const messages = await chat.GetGlobalMessages();
      return callback({ success: true, messages });
    } catch (error) {
      console.error('Error getting global messages:', error);
      return callback({ success: false, message: 'Error getting messages' });
    }
  });

  // ========================
  // INBOX/PRIVATE MESSAGE EVENTS
  // ========================

  // Send private/inbox message
  socket.on('send_inbox_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { message, receiverId, receiverName, receiverEmail } = data;
      if (!message || message.trim() === '') {
        return callback({ success: false, message: 'Message cannot be empty' });
      }

      if (!receiverId) {
        return callback({ success: false, message: 'Receiver ID required' });
      }

      const sender = {
        email: auth.user.email,
        full_name: auth.user.fullName,
        userId: auth.user.userId,
      };

      const receiver = {
        email: receiverEmail || '',
        full_name: receiverName || '',
        userId: receiverId,
      };

      const newMessage = await chat.CreateInboxMessage(message, sender, receiver);

      // Send to receiver's private room
      global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('new_inbox_message', newMessage);

      // Also send back to sender
      socket.emit('new_inbox_message', newMessage);

      return callback({ success: true, message: newMessage });
    } catch (error) {
      console.error('Error sending inbox message:', error);
      return callback({ success: false, message: 'Error sending message' });
    }
  });

  // Edit inbox message
  socket.on('edit_inbox_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { messageId, message } = data;
      if (!messageId || !message) {
        return callback({ success: false, message: 'Message ID and content required' });
      }

      const result = await chat.EditInboxMessage(messageId, message, auth.user.userId);

      if (result.success) {
        // Get the message to find both participants
        const originalMessage = await chat.GetInboxMessageById(messageId, auth.user.userId);
        if (originalMessage) {
          const editPayload = {
            messageId,
            newMessage: message,
            editedAt: result.message.editedAt,
          };

          // Notify sender
          global.WebsocketIO.to(chat.Private_Room(originalMessage.sender.userId))
            .emit('inbox_message_edited', editPayload);

          // Notify receiver if different
          if (originalMessage.sender.userId !== originalMessage.receiver.userId) {
            global.WebsocketIO.to(chat.Private_Room(originalMessage.receiver.userId))
              .emit('inbox_message_edited', editPayload);
          }
        }
      }

      return callback(result);
    } catch (error) {
      console.error('Error editing inbox message:', error);
      return callback({ success: false, message: 'Error editing message' });
    }
  });

  // Delete inbox message
  socket.on('delete_inbox_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { messageId } = data;
      if (!messageId) {
        return callback({ success: false, message: 'Message ID required' });
      }

      // Get the message before deletion so we can notify both parties
      const originalMessage = await chat.GetInboxMessageById(messageId, auth.user.userId);

      const result = await chat.DeleteInboxMessage(messageId, auth.user.userId);

      if (result.success && originalMessage) {
        // Notify both sender and receiver
        global.WebsocketIO.to(chat.Private_Room(originalMessage.sender.userId))
          .emit('inbox_message_deleted', { messageId });

        if (originalMessage.sender.userId !== originalMessage.receiver.userId) {
          global.WebsocketIO.to(chat.Private_Room(originalMessage.receiver.userId))
            .emit('inbox_message_deleted', { messageId });
        }
      }

      return callback(result);
    } catch (error) {
      console.error('Error deleting inbox message:', error);
      return callback({ success: false, message: 'Error deleting message' });
    }
  });

  // Get inbox messages for current user
  socket.on('get_inbox_messages', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const messages = await chat.GetInboxMessages(auth.user.userId);

      // Calculate unread counts per user
      const unreadCounts = {};
      const sid = String(auth.user.userId);
      messages.forEach(msg => {
        if (msg.sender.userId !== sid) {
          const senderId = msg.sender.userId;
          const hasRead = msg.readBy && msg.readBy.some(r => r.userId === sid);
          if (!hasRead) {
            unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
          }
        }
      });

      return callback({ success: true, messages, unreadCounts });
    } catch (error) {
      console.error('Error getting inbox messages:', error);
      return callback({ success: false, message: 'Error getting messages' });
    }
  });

  // Get conversation with a specific user
  socket.on('get_conversation', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { userId } = data;
      if (!userId) {
        return callback({ success: false, message: 'User ID required' });
      }

      const messages = await chat.GetMessagesBetweenUsers(auth.user.userId, userId);
      return callback({ success: true, messages });
    } catch (error) {
      console.error('Error getting conversation:', error);
      return callback({ success: false, message: 'Error getting messages' });
    }
  });

  // Mark messages as read
  socket.on('mark_messages_read', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      const { fromUserId } = data;
      if (!fromUserId) {
        return callback({ success: false, message: 'User ID required' });
      }

      // Get all unread messages from this user
      const allMessages = await chat.GetInboxMessages(auth.user.userId);
      const messagesToMark = allMessages.filter(msg =>
        msg.sender.userId === String(fromUserId) &&
        msg.receiver &&
        msg.receiver.userId === String(auth.user.userId) &&
        !(msg.readBy && msg.readBy.some(r => r.userId === String(auth.user.userId)))
      );

      // Mark each message as read
      for (const msg of messagesToMark) {
        await chat.MarkMessageAsRead(msg.messageId, auth.user.userId);
      }

      // Notify sender that messages were read
      global.WebsocketIO.to(chat.Private_Room(fromUserId)).emit('messages_marked_read', {
        byUserId: auth.user.userId,
        byUserName: auth.user.fullName,
        count: messagesToMark.length,
      });

      return callback({ success: true, count: messagesToMark.length });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return callback({ success: false, message: 'Error marking messages as read' });
    }
  });

  // Mark all inbox messages as read
  socket.on('mark_all_inbox_read', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) {
      return callback({ success: false, message: 'Authentication required' });
    }

    try {
      // Get all messages for this user where they are the receiver
      const allMessages = await chat.GetInboxMessages(auth.user.userId);
      const unreadMessages = allMessages.filter(msg =>
        msg.receiver &&
        msg.receiver.userId === String(auth.user.userId) &&
        !(msg.readBy && msg.readBy.some(r => r.userId === String(auth.user.userId)))
      );

      // Mark each message as read
      for (const msg of unreadMessages) {
        await chat.MarkMessageAsRead(msg.messageId, auth.user.userId);
      }

      // Notify all senders that their messages were read
      const senderIds = [...new Set(unreadMessages.map(msg => msg.sender.userId))];
      for (const senderId of senderIds) {
        const count = unreadMessages.filter(msg => msg.sender.userId === senderId).length;
        global.WebsocketIO.to(chat.Private_Room(senderId)).emit('messages_marked_read', {
          byUserId: auth.user.userId,
          byUserName: auth.user.fullName,
          count,
        });
      }

      return callback({ success: true, count: unreadMessages.length });
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return callback({ success: false, message: 'Error marking messages as read' });
    }
  });

  // ========================
  // USER STATUS EVENTS
  // ========================

  // Get all users
  socket.on('get_all_users', async (data, callback) => {
    try {
      await chat.UpdateAllUsers();
      const users = chat.GetAllUsers();
      const connectedUsers = chat.GetConnectedUsers();

      const usersWithStatus = users.map(u => ({
        userId: u._id || u.userId,
        email: u.email,
        full_name: u.full_name,
        telephone: u.telephone,
        is_active: connectedUsers.includes(String(u._id)),
      }));

      return callback({
        success: true,
        users: usersWithStatus,
        connectedUsers,
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      return callback({ success: false, message: 'Error getting users' });
    }
  });

  // Get connected users
  socket.on('get_connected_users', async (data, callback) => {
    try {
      const connectedUsers = chat.GetConnectedUsers();
      return callback({ success: true, users: connectedUsers });
    } catch (error) {
      console.error('Error getting connected users:', error);
      return callback({ success: false, message: 'Error getting users' });
    }
  });

  // ========================
  // DISCONNECT HANDLER
  // ========================

  socket.on('disconnect', async () => {
    console.log('Chat user disconnected:', socket.id);

    if (socket.user) {
      // Unregister user socket
      chat.UnregisterUserSocket(socket.user.userId, socket.id);

      // Notify others that user is offline
      global.WebsocketIO.emit('user_offline', {
        userId: socket.user.userId,
        fullName: socket.user.fullName,
      });

      // Update connected users
      const connectedUsers = chat.GetConnectedUsers();
      global.WebsocketIO.emit('connected_users', connectedUsers);
    }
  });

  // ========================
  // TYPING INDICATOR EVENTS
  // ========================

  socket.on('global_typing', (data) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;

    socket.to(chat.Global_ChatRoom()).emit('user_typing_global', {
      userId: auth.user.userId,
      fullName: auth.user.fullName,
    });
  });

  socket.on('inbox_typing', (data) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;

    const { receiverId } = data;
    if (receiverId) {
      global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('user_typing_inbox', {
        senderId: auth.user.userId,
        senderName: auth.user.fullName,
        receiverId,
      });
    }
  });

  socket.on('stop_typing', (data) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;

    const { roomType, receiverId } = data;

    if (roomType === 'global') {
      socket.to(chat.Global_ChatRoom()).emit('user_stopped_typing', {
        userId: auth.user.userId,
      });
    } else if (roomType === 'inbox' && receiverId) {
      global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('user_stopped_typing', {
        userId: auth.user.userId,
        receiverId,
      });
    }
  });

  console.log('Chat handlers initialized for socket:', socket.id);
}

module.exports = InitChatting;