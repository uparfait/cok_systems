/**
 * Chat Real-time Handler - Full WhatsApp-like features
 * Supports: files, GIFs, audio, view once, pagination, replies, edit/delete
 */
const chat = require('../../../utilities/chatting.js');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

function checkAuth(socket) {
  if (!socket.user) return { isAuthenticated: false, user: null };
  return { isAuthenticated: true, user: socket.user };
}

async function InitChatting(socket) {
  try {
    await chat.UpdateAllUsers();
    await chat.SendAllUsersToClient(socket);
  } catch (e) { /* ignore */ }

  if (socket.user) {
    chat.RegisterUserSocket(socket.user.userId, socket.id);
    socket.join(chat.Private_Room(socket.user.userId));
    socket.join(chat.Global_ChatRoom());
    global.WebsocketIO.emit('user_online', { userId: socket.user.userId, fullName: socket.user.fullName, email: socket.user.email });
    socket.emit('connected_users', chat.GetConnectedUsers());
  }

  // ─── GLOBAL CHAT ───
  socket.on('send_global_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const sender = { email: auth.user.email, full_name: auth.user.fullName, userId: auth.user.userId };
      const newMessage = await chat.CreateGlobalMessage(data.message, sender, data.extra || {});
      await chat.SendGlobalMessagesToAllClients(0);
      return callback({ success: true, message: newMessage });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  socket.on('get_global_messages', async (data, callback) => {
    try {
      const page = data?.page || 0;
      const messages = await chat.GetGlobalMessages(page);
      const total = await chat.GetGlobalMessagesCount();
      return callback({ success: true, messages, page, hasMore: messages.length === chat.PAGE_SIZE, total });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── INBOX CHAT ───
  socket.on('send_inbox_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const sender = { email: auth.user.email, full_name: auth.user.fullName, userId: auth.user.userId };
      const receiver = { email: data.receiverEmail || '', full_name: data.receiverName || '', userId: data.receiverId };
      const extra = data.extra || {};
      const newMessage = await chat.CreateInboxMessage(data.message, sender, receiver, extra);
      global.WebsocketIO.to(chat.Private_Room(data.receiverId)).emit('new_inbox_message', newMessage);
      socket.emit('new_inbox_message', newMessage);
      return callback({ success: true, message: newMessage });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  socket.on('get_conversation', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const page = data?.page || 0;
      const messages = await chat.GetMessagesBetweenUsers(auth.user.userId, data.userId, page);
      const total = await chat.GetMessagesBetweenUsersCount(auth.user.userId, data.userId);
      return callback({ success: true, messages, page, hasMore: messages.length === chat.PAGE_SIZE, total });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── EDIT / DELETE ───
  socket.on('edit_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const result = await chat.EditMessage(data.messageId, data.message, auth.user.userId);
      if (result.success) {
        global.WebsocketIO.emit('message_edited', { messageId: data.messageId, newMessage: data.message, editedAt: result.message.editedAt });
      }
      return callback(result);
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  socket.on('delete_message', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const result = await chat.DeleteMessage(data.messageId, auth.user.userId, data.forEveryone);
      if (result.success) {
        global.WebsocketIO.emit('message_deleted', { messageId: data.messageId, forEveryone: result.deletedForEveryone });
      }
      return callback(result);
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── READ RECEIPTS ───
  socket.on('mark_messages_read', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      const allMessages = await chat.GetMessagesBetweenUsers(auth.user.userId, data.fromUserId, 0);
      const unread = allMessages.filter(msg =>
        msg.sender.userId === String(auth.user.userId) === false &&
        msg.receiver && msg.receiver.userId === String(auth.user.userId) &&
        !(msg.readBy && msg.readBy.some(r => r.userId === String(auth.user.userId)))
      );
      for (const msg of unread) await chat.MarkMessageAsRead(msg.messageId, auth.user.userId);
      if (unread.length > 0) {
        global.WebsocketIO.to(chat.Private_Room(data.fromUserId)).emit('messages_marked_read', {
          byUserId: auth.user.userId, byUserName: auth.user.fullName, count: unread.length,
        });
      }
      return callback({ success: true, count: unread.length });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── VIEW ONCE ───
  socket.on('mark_view_once_viewed', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      await chat.MarkViewOnceViewed(data.messageId, auth.user.userId);
      return callback({ success: true });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── FILE UPLOAD ───
  socket.on('upload_file', async (data, callback) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return callback({ success: false, message: 'Auth required' });
    try {
      if (!data.file || !data.file.buffer) return callback({ success: false, message: 'No file data' });
      const buffer = Buffer.from(data.file.buffer);
      const fileInfo = await chat.SaveFile(buffer, data.file.mimeType, data.file.name);
      return callback({ success: true, file: fileInfo });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── USERS ───
  socket.on('get_all_users', async (data, callback) => {
    try {
      await chat.UpdateAllUsers();
      const users = chat.GetAllUsers();
      const connectedUsers = chat.GetConnectedUsers();
      const mapped = users.map(u => ({
        userId: u._id || u.userId, email: u.email, full_name: u.full_name,
        telephone: u.telephone, is_active: connectedUsers.includes(String(u._id)),
      }));
      return callback({ success: true, users: mapped, connectedUsers });
    } catch (e) { return callback({ success: false, message: e.message }); }
  });

  // ─── TYPING ───
  socket.on('global_typing', () => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;
    socket.to(chat.Global_ChatRoom()).emit('user_typing_global', { userId: auth.user.userId, fullName: auth.user.fullName });
  });
  socket.on('inbox_typing', (data) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;
    if (data?.receiverId) {
      global.WebsocketIO.to(chat.Private_Room(data.receiverId)).emit('user_typing_inbox', { senderId: auth.user.userId, senderName: auth.user.fullName });
    }
  });
  socket.on('stop_typing', (data) => {
    const auth = checkAuth(socket);
    if (!auth.isAuthenticated) return;
    if (data?.roomType === 'global') socket.to(chat.Global_ChatRoom()).emit('user_stopped_typing', { userId: auth.user.userId });
    else if (data?.receiverId) global.WebsocketIO.to(chat.Private_Room(data.receiverId)).emit('user_stopped_typing', { userId: auth.user.userId });
  });

  // ─── DISCONNECT ───
  socket.on('disconnect', () => {
    if (socket.user) {
      chat.UnregisterUserSocket(socket.user.userId, socket.id);
      global.WebsocketIO.emit('user_offline', { userId: socket.user.userId, fullName: socket.user.fullName });
      global.WebsocketIO.emit('connected_users', chat.GetConnectedUsers());
    }
  });
}

module.exports = InitChatting;