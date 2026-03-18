/**
 * Chat Real-time Handler
 * Handles WebSocket events for global chat and private messaging
 * Uses the chatting utility functions
 */

const chat = require('../../../utilities/chatting.js');
const user_model = require('../../../models/user.js');

/**
 * Check if socket is authenticated
 * @param {object} socket - Socket instance
 * @returns {object} - { isAuthenticated: boolean, user: object|null }
 */
function checkAuth(socket) {
    if (!socket.user) {
        return { isAuthenticated: false, user: null };
    }
    return { isAuthenticated: true, user: socket.user };
}

/**
 * Initialize chatting handlers for a socket connection
 * @param {object} socket - Socket.IO socket instance
 */
async function InitChatting(socket) {
    // First, fetch all users in the system and store in AllUsers variable
    async function fetchAllUsers() {
        try {
            await chat.UpdateAllUsers();
            await chat.SendAllUsersToClient(socket);
        } catch (e) {
            console.log('Error fetching all users for chat:', e);
        }
    }

    // Fetch all users on connection
    await fetchAllUsers();

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
            email: socket.user.email
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
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { message } = data;
            if (!message || message.trim() === '') {
                return callback({ success: false, message: "Message cannot be empty" });
            }

            const sender = {
                email: auth.user.email,
                full_name: auth.user.fullName,
                userId: auth.user.userId
            };

            const newMessage = await chat.CreateGlobalMessage(message, sender);
            
            // Send to all clients in global chat room
            await chat.SendGlobalMessagesToAllClients();
            
            return callback({ success: true, message: newMessage });
        } catch (error) {
            console.error('Error sending global message:', error);
            return callback({ success: false, message: "Error sending message" });
        }
    });

    // Edit global message
    socket.on('edit_global_message', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { messageId, message } = data;
            if (!messageId || !message) {
                return callback({ success: false, message: "Message ID and content required" });
            }

            const result = await chat.EditGlobalMessage(messageId, message, auth.user.userId);
            
            if (result.success) {
                // Notify all clients about the edit
                global.WebsocketIO.emit('global_message_edited', {
                    messageId,
                    newMessage: message,
                    editedAt: result.message.editedAt,
                    editedTime: result.message.editedTime
                });
            }
            
            return callback(result);
        } catch (error) {
            console.error('Error editing global message:', error);
            return callback({ success: false, message: "Error editing message" });
        }
    });

    // Delete global message
    socket.on('delete_global_message', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { messageId } = data;
            if (!messageId) {
                return callback({ success: false, message: "Message ID required" });
            }

            const result = await chat.DeleteGlobalMessage(messageId, auth.user.userId);
            
            if (result.success) {
                // Notify all clients about the deletion
                global.WebsocketIO.emit('global_message_deleted', {
                    messageId
                });
                // Send updated messages
                await chat.SendGlobalMessagesToAllClients();
            }
            
            return callback(result);
        } catch (error) {
            console.error('Error deleting global message:', error);
            return callback({ success: false, message: "Error deleting message" });
        }
    });

    // Get global messages
    socket.on('get_global_messages', async (data, callback) => {
        try {
            const messages = chat.GetGlobalMessages();
            return callback({ success: true, messages });
        } catch (error) {
            console.error('Error getting global messages:', error);
            return callback({ success: false, message: "Error getting messages" });
        }
    });

    // ========================
    // INBOX/PRIVATE MESSAGE EVENTS
    // ========================

    // Send private/inbox message
    socket.on('send_inbox_message', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { message, receiverId, receiverName, receiverEmail } = data;
            if (!message || message.trim() === '') {
                return callback({ success: false, message: "Message cannot be empty" });
            }

            if (!receiverId) {
                return callback({ success: false, message: "Receiver ID required" });
            }

            const sender = {
                email: auth.user.email,
                full_name: auth.user.fullName,
                userId: auth.user.userId
            };

            const receiver = {
                email: receiverEmail || '',
                full_name: receiverName || '',
                userId: receiverId
            };

            const newMessage = await chat.CreateInboxMessage(message, sender, receiver);
            
            // Send to receiver's private room
            global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('new_inbox_message', newMessage);
            
            // Also send back to sender
            socket.emit('new_inbox_message', newMessage);
            
            return callback({ success: true, message: newMessage });
        } catch (error) {
            console.error('Error sending inbox message:', error);
            return callback({ success: false, message: "Error sending message" });
        }
    });

    // Edit inbox message
    socket.on('edit_inbox_message', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { messageId, message } = data;
            if (!messageId || !message) {
                return callback({ success: false, message: "Message ID and content required" });
            }

            const result = await chat.EditInboxMessage(messageId, message, auth.user.userId);
            
            if (result.success) {
                // Get the message to find receiver
                const originalMessage = chat.GetInboxMessageById(messageId, auth.user.userId);
                if (originalMessage) {
                    // Notify both sender and receiver
                    global.WebsocketIO.to(chat.Private_Room(originalMessage.sender.userId))
                        .emit('inbox_message_edited', {
                            messageId,
                            newMessage: message,
                            editedAt: result.message.editedAt,
                            editedTime: result.message.editedTime
                        });
                    
                    if (originalMessage.sender.userId !== originalMessage.receiver.userId) {
                        global.WebsocketIO.to(chat.Private_Room(originalMessage.receiver.userId))
                            .emit('inbox_message_edited', {
                                messageId,
                                newMessage: message,
                                editedAt: result.message.editedAt,
                                editedTime: result.message.editedTime
                            });
                    }
                }
            }
            
            return callback(result);
        } catch (error) {
            console.error('Error editing inbox message:', error);
            return callback({ success: false, message: "Error editing message" });
        }
    });

    // Delete inbox message
    socket.on('delete_inbox_message', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { messageId } = data;
            if (!messageId) {
                return callback({ success: false, message: "Message ID required" });
            }

            const result = await chat.DeleteInboxMessage(messageId, auth.user.userId);
            
            if (result.success) {
                // Get the message to find receiver
                // We need to find it before it's fully deleted
                const allMessages = chat.GetInboxMessages(auth.user.userId);
                const deletedMessage = allMessages.find(m => m.messageId === messageId);
                
                if (deletedMessage) {
                    // Notify both sender and receiver
                    global.WebsocketIO.to(chat.Private_Room(deletedMessage.sender.userId))
                        .emit('inbox_message_deleted', { messageId });
                    
                    if (deletedMessage.sender.userId !== deletedMessage.receiver.userId) {
                        global.WebsocketIO.to(chat.Private_Room(deletedMessage.receiver.userId))
                            .emit('inbox_message_deleted', { messageId });
                    }
                }
            }
            
            return callback(result);
        } catch (error) {
            console.error('Error deleting inbox message:', error);
            return callback({ success: false, message: "Error deleting message" });
        }
    });

    // Get inbox messages for current user
    socket.on('get_inbox_messages', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const messages = await chat.GetInboxMessages(auth.user.userId);
            
            // Calculate unread count for each user
            const unreadCounts = {};
            messages.forEach(msg => {
                if (msg.sender.userId !== auth.user.userId) {
                    const senderId = msg.sender.userId;
                    if (!msg.readBy || !msg.readBy.includes(auth.user.userId)) {
                        unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
                    }
                }
            });
            
            return callback({ success: true, messages, unreadCounts });
        } catch (error) {
            console.error('Error getting inbox messages:', error);
            return callback({ success: false, message: "Error getting messages" });
        }
    });

    // Mark messages as read
    socket.on('mark_messages_read', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { fromUserId } = data;
            if (!fromUserId) {
                return callback({ success: false, message: "User ID required" });
            }

            // Get all messages from this user and mark as read
            const allMessages = await chat.GetInboxMessages(auth.user.userId);
            const messagesToMark = allMessages.filter(msg => 
                msg.sender.userId === fromUserId && 
                msg.receiver?.userId === auth.user.userId
            );

            // Mark each message as read
            for (const msg of messagesToMark) {
                await chat.MarkMessageAsRead(msg.messageId, auth.user.userId);
            }

            // Notify sender that messages were read
            global.WebsocketIO.to(chat.Private_Room(fromUserId)).emit('messages_marked_read', {
                byUserId: auth.user.userId,
                byUserName: auth.user.fullName,
                count: messagesToMark.length
            });

            return callback({ success: true, count: messagesToMark.length });
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return callback({ success: false, message: "Error marking messages as read" });
        }
    });

    // Get conversation with specific user
    socket.on('get_conversation', async (data, callback) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) {
            return callback({ success: false, message: "Authentication required" });
        }

        try {
            const { otherUserId } = data;
            if (!otherUserId) {
                return callback({ success: false, message: "Other user ID required" });
            }

            const allMessages = await chat.GetInboxMessages(auth.user.userId);
            const conversation = allMessages.filter(msg => 
                (msg.sender.userId === auth.user.userId && msg.receiver.userId === otherUserId) ||
                (msg.sender.userId === otherUserId && msg.receiver.userId === auth.user.userId)
            );

            return callback({ success: true, messages: conversation });
        } catch (error) {
            console.error('Error getting conversation:', error);
            return callback({ success: false, message: "Error getting conversation" });
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
            
            // Convert Mongoose documents to plain objects and map userId
            const usersWithStatus = users.map(u => {
                const plainUser = u.toObject ? u.toObject() : u;
                return {
                    userId: plainUser._id || plainUser.userId,
                    email: plainUser.email,
                    full_name: plainUser.full_name,
                    telephone: plainUser.telephone,
                    is_active: connectedUsers.includes(plainUser._id) ? true : plainUser.is_active || false
                };
            });
            
            return callback({ 
                success: true, 
                users: usersWithStatus,
                connectedUsers: connectedUsers
            });
        } catch (error) {
            console.error('Error getting all users:', error);
            return callback({ success: false, message: "Error getting users" });
        }
    });

    // Get connected users
    socket.on('get_connected_users', async (data, callback) => {
        try {
            const connectedUsers = chat.GetConnectedUsers();
            return callback({ success: true, users: connectedUsers });
        } catch (error) {
            console.error('Error getting connected users:', error);
            return callback({ success: false, message: "Error getting users" });
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
                fullName: socket.user.fullName
            });
            
            // Update connected users
            const connectedUsers = chat.GetConnectedUsers();
            global.WebsocketIO.emit('connected_users', connectedUsers);
        }
    });

    // ========================
    // TYPING INDICATOR EVENTS
    // ========================

    // User is typing in global chat
    socket.on('global_typing', (data) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) return;

        socket.to(chat.Global_ChatRoom()).emit('user_typing_global', {
            userId: auth.user.userId,
            fullName: auth.user.fullName
        });
    });

    // User is typing in private chat
    socket.on('inbox_typing', (data) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) return;

        const { receiverId } = data;
        if (receiverId) {
            global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('user_typing_inbox', {
                senderId: auth.user.userId,
                senderName: auth.user.fullName,
                receiverId: receiverId
            });
        }
    });

    // Stop typing
    socket.on('stop_typing', (data) => {
        const auth = checkAuth(socket);
        if (!auth.isAuthenticated) return;

        const { roomType, receiverId } = data;
        
        if (roomType === 'global') {
            socket.to(chat.Global_ChatRoom()).emit('user_stopped_typing', {
                userId: auth.user.userId
            });
        } else if (roomType === 'inbox' && receiverId) {
            global.WebsocketIO.to(chat.Private_Room(receiverId)).emit('user_stopped_typing', {
                userId: auth.user.userId,
                receiverId: receiverId
            });
        }
    });

    console.log('Chat handlers initialized for socket:', socket.id);
}

module.exports = InitChatting;
