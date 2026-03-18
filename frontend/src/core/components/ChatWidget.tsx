import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { FiMessageSquare, FiX, FiSend, FiUsers, FiGlobe, FiMoreVertical, FiEdit2, FiTrash2, FiCheck, FiCheckCircle, FiChevronDown } from 'react-icons/fi';

// Types
interface User {
  userId: string;
  email: string;
  full_name: string;
  telephone?: string;
  title?: string;
  is_active?: boolean;
}

interface Message {
  messageId: string;
  message: string;
  createdAt: string;
  time: string;
  sender: {
    email: string;
    full_name: string;
    userId: string;
  };
  receiver?: {
    email: string;
    full_name: string;
    userId: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  editedAt?: string;
  editedTime?: string;
}

interface ChatWidgetProps {
  className?: string;
}

const ChatWidget: React.FC<ChatWidgetProps> = () => {
  const { socket, isConnected, emit, on, off } = useSocket();
  const { user, token } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'inbox'>('global');
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [unreadCountsPerUser, setUnreadCountsPerUser] = useState<{ [key: string]: number }>({});
  const [lastMessageTimes, setLastMessageTimes] = useState<{ [key: string]: number }>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is authenticated
  const isAuthenticated = !!token && !!user;

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    if (!socket || !isConnected || !isAuthenticated) {
      console.log('[ChatWidget] Cannot fetch - socket not ready:', { socket: !!socket, isConnected, isAuthenticated });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    console.log('[ChatWidget] Fetching initial data...');
    
    try {
      // Fetch global messages
      emit('get_global_messages', {}, (response: any) => {
        console.log('[ChatWidget] Global messages response:', response);
        if (response?.success) {
          setMessages(response.messages || []);
        } else {
          console.error('[ChatWidget] Failed to get global messages:', response?.message);
        }
      });

      // Fetch all users
      emit('get_all_users', {}, (response: any) => {
        console.log('[ChatWidget] Users response:', response);
        if (response?.success) {
          console.log('[ChatWidget] Current user from auth:', user);
          console.log('[ChatWidget] Current user userId:', user?.userId);
          // Filter out current user
          let otherUsers = (response.users || []).filter((u: User) => {
            const isCurrentUser = u.userId === user?.userId;
            console.log('[ChatWidget] Comparing user:', u.userId, '===', user?.userId, '=', isCurrentUser);
            return !isCurrentUser;
          });
          
          console.log('[ChatWidget] Filtered users:', otherUsers.length);
          setUsers(otherUsers);
          setConnectedUsers(response.connectedUsers || []);
        } else {
          console.error('[ChatWidget] Failed to get users:', response?.message);
        }
      });

      // Fetch inbox messages if on inbox tab
      if (activeTab === 'inbox') {
        emit('get_inbox_messages', {}, (response: any) => {
          console.log('[ChatWidget] Inbox messages response:', response);
          if (response?.success) {
            setMessages(response.messages || []);
            // Store unread counts per user
            if (response.unreadCounts) {
              const counts = response.unreadCounts as { [key: string]: number };
              setUnreadCountsPerUser(counts);
              // Calculate total unread
              const totalUnread = Object.values(counts).reduce((a, b) => a + b, 0);
              setUnreadCount(totalUnread);
            }
          }
        });
      }
    } catch (err) {
      setError('Failed to load chat data');
      console.error('Chat fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [socket, isConnected, isAuthenticated, activeTab, emit, user]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated) return;

    // Global messages handlers
    const handleGlobalMessages = (data: Message[]) => {
      if (activeTab === 'global') {
        setMessages(data);
        // If widget is not open or not on global tab, track as unread
        if (!isOpen || activeTab !== 'global') {
          const newUnread = data.length;
          if (newUnread > 0) {
            setGlobalUnreadCount(prev => prev + 1);
          }
        }
      } else if (!isOpen) {
        // Track global unread when widget is closed
        setGlobalUnreadCount(prev => prev + 1);
      }
    };

    const handleGlobalMessageEdited = (data: { messageId: string; newMessage: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === data.messageId 
          ? { ...msg, message: data.newMessage, isEdited: true }
          : msg
      ));
    };

    const handleGlobalMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg.messageId !== data.messageId));
    };

    // Inbox messages handlers
    const handleNewInboxMessage = (data: Message) => {
      // Update last message time for this user
      const messageTime = new Date(data.createdAt).getTime();
      const otherUserId = data.sender.userId === user?.userId ? data.receiver?.userId : data.sender.userId;
      if (otherUserId) {
        setLastMessageTimes(prev => ({
          ...prev,
          [otherUserId]: messageTime
        }));
      }
      
      if (activeTab === 'inbox' && selectedUser) {
        // Only add message if it's for the current conversation
        if (data.sender.userId === selectedUser.userId || data.receiver?.userId === selectedUser.userId) {
          setMessages(prev => [...prev, data]);
        }
      } else {
        // Add to messages list
        setMessages(prev => [...prev, data]);
      }
      
      // Increment unread count per user if message is for current user
      if (data.receiver?.userId === user?.userId) {
        // Only count as unread if not from current user and not viewing that conversation
        if (data.sender.userId !== user?.userId) {
          if (activeTab !== 'inbox' || !selectedUser || data.sender.userId !== selectedUser.userId) {
            setUnreadCountsPerUser(prev => ({
              ...prev,
              [data.sender.userId]: (prev[data.sender.userId] || 0) + 1
            }));
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    };

    const handleInboxMessageEdited = (data: { messageId: string; newMessage: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === data.messageId 
          ? { ...msg, message: data.newMessage, isEdited: true }
          : msg
      ));
    };

    const handleInboxMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg.messageId !== data.messageId));
    };

    // User status handlers
    const handleUserOnline = (data: { userId: string; fullName: string }) => {
      setConnectedUsers(prev => [...prev, data.userId]);
    };

    const handleUserOffline = (data: { userId: string }) => {
      setConnectedUsers(prev => prev.filter(id => id !== data.userId));
    };

    // Typing indicators
    const handleUserTypingGlobal = (data: { userId: string; fullName: string }) => {
      setTypingUsers(prev => ({ ...prev, [data.userId]: `${data.fullName} is typing...` }));
      setTimeout(() => {
        setTypingUsers(prev => {
          const newState = { ...prev };
          delete newState[data.userId];
          return newState;
        });
      }, 3000);
    };

    const handleUserTypingInbox = (data: { senderId: string; senderName: string }) => {
      if (selectedUser && data.senderId === selectedUser.userId) {
        setTypingUsers(prev => ({ ...prev, [data.senderId]: `${data.senderName} is typing...` }));
        setTimeout(() => {
          setTypingUsers(prev => {
            const newState = { ...prev };
            delete newState[data.senderId];
            return newState;
          });
        }, 3000);
      }
    };

    // Messages marked as read handler
    const handleMessagesMarkedRead = (data: { byUserId: string; byUserName: string; count: number }) => {
      // Update unread counts when other user reads our messages
      if (selectedUser && data.byUserId === selectedUser.userId) {
        setUnreadCountsPerUser(prev => {
          const newCounts = { ...prev };
          delete newCounts[data.byUserId];
          return newCounts;
        });
        // Recalculate total
        setUnreadCount(prev => Math.max(0, prev - data.count));
      }
    };

    // Register event listeners
    on('global_messages', handleGlobalMessages);
    on('global_message_edited', handleGlobalMessageEdited);
    on('global_message_deleted', handleGlobalMessageDeleted);
    on('new_inbox_message', handleNewInboxMessage);
    on('inbox_message_edited', handleInboxMessageEdited);
    on('inbox_message_deleted', handleInboxMessageDeleted);
    on('user_online', handleUserOnline);
    on('user_offline', handleUserOffline);
    on('user_typing_global', handleUserTypingGlobal);
    on('user_typing_inbox', handleUserTypingInbox);
    on('messages_marked_read', handleMessagesMarkedRead);

    // Cleanup
    return () => {
      off('global_messages', handleGlobalMessages);
      off('global_message_edited', handleGlobalMessageEdited);
      off('global_message_deleted', handleGlobalMessageDeleted);
      off('new_inbox_message', handleNewInboxMessage);
      off('inbox_message_edited', handleInboxMessageEdited);
      off('inbox_message_deleted', handleInboxMessageDeleted);
      off('user_online', handleUserOnline);
      off('user_offline', handleUserOffline);
      off('user_typing_global', handleUserTypingGlobal);
      off('user_typing_inbox', handleUserTypingInbox);
      off('messages_marked_read', handleMessagesMarkedRead);
    };
  }, [socket, isConnected, isAuthenticated, activeTab, selectedUser, on, off, user, isOpen]);

  // Fetch data when tab changes or chat opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchInitialData();
    }
  }, [isOpen, isAuthenticated, activeTab, fetchInitialData]);

  // Reset global unread count when switching to global tab
  useEffect(() => {
    if (isOpen && activeTab === 'global') {
      setGlobalUnreadCount(0);
    }
  }, [isOpen, activeTab]);

  // Auto-scroll to bottom when new messages arrive (if user is at bottom)
  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      // Small delay to ensure DOM is updated
      const timeout = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [messages, isAtBottom]);

  // Sort users: online first, then unread messages, then by time
  useEffect(() => {
    if (users.length > 0) {
      const sortedUsers = [...users].sort((a, b) => {
        // First: online users at top
        const aOnline = connectedUsers.includes(a.userId);
        const bOnline = connectedUsers.includes(b.userId);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        
        // Second: users with unread messages at top
        const aUnread = unreadCountsPerUser[a.userId] || 0;
        const bUnread = unreadCountsPerUser[b.userId] || 0;
        if (aUnread > 0 && bUnread === 0) return -1;
        if (aUnread === 0 && bUnread > 0) return 1;
        
        // Third: by most recent message time (descending)
        const aLastMsg = lastMessageTimes[a.userId] || 0;
        const bLastMsg = lastMessageTimes[b.userId] || 0;
        return bLastMsg - aLastMsg;
      });
      setUsers(sortedUsers);
    }
  }, [connectedUsers, unreadCountsPerUser, lastMessageTimes]);


  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !socket || !isConnected) return;
    
    setIsSending(true);
    setError(null);

    try {
      if (activeTab === 'global') {
        emit('send_global_message', { message: inputMessage.trim() }, (response: any) => {
          if (response?.success) {
            setInputMessage('');
          } else {
            setError(response?.message || 'Failed to send message');
          }
          setIsSending(false);
        });
      } else if (activeTab === 'inbox' && selectedUser) {
        emit('send_inbox_message', { 
          message: inputMessage.trim(),
          receiverId: selectedUser.userId,
          receiverName: selectedUser.full_name,
          receiverEmail: selectedUser.email
        }, (response: any) => {
          if (response?.success) {
            setInputMessage('');
          } else {
            setError(response?.message || 'Failed to send message');
          }
          setIsSending(false);
        });
      } else {
        setIsSending(false);
      }
    } catch (err) {
      setError('Failed to send message');
      setIsSending(false);
    }
  };

  // Handle editing message
  const handleEditMessage = async (messageId: string) => {
    if (!editMessageText.trim() || !socket || !isConnected) return;
    
    setIsSending(true);
    setError(null);

    const eventName = activeTab === 'global' ? 'edit_global_message' : 'edit_inbox_message';
    
    emit(eventName, { messageId, message: editMessageText.trim() }, (response: any) => {
      if (response?.success) {
        setEditingMessageId(null);
        setEditMessageText('');
      } else {
        setError(response?.message || 'Failed to edit message');
      }
      setIsSending(false);
    });
  };

  // Handle deleting message
  const handleDeleteMessage = async (messageId: string) => {
    if (!socket || !isConnected) return;
    
    setIsSending(true);
    setError(null);

    const eventName = activeTab === 'global' ? 'delete_global_message' : 'delete_inbox_message';
    
    emit(eventName, { messageId }, (response: any) => {
      if (!response?.success) {
        setError(response?.message || 'Failed to delete message');
      }
      setIsSending(false);
    });
  };

  // Handle typing
  const handleTyping = () => {
    if (!socket || !isConnected || isTyping) return;
    
    setIsTyping(true);
    emit(activeTab === 'global' ? 'global_typing' : 'inbox_typing', 
      { roomType: activeTab, receiverId: selectedUser?.userId },
      () => {}
    );

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emit('stop_typing', { roomType: activeTab, receiverId: selectedUser?.userId }, () => {});
      setIsTyping(false);
    }, 2000);
  };

  // Handle scroll to detect if user is at bottom
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom);
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setShowScrollButton(false);
      setIsAtBottom(true);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessageId) {
        handleEditMessage(editingMessageId);
      } else {
        handleSendMessage();
      }
    }
  };

  // Get messages for current view
  const getDisplayMessages = () => {
    if (activeTab === 'global') {
      return messages;
    } else if (activeTab === 'inbox' && selectedUser) {
      return messages.filter(msg => 
        (msg.sender.userId === user?.userId && msg.receiver?.userId === selectedUser.userId) ||
        (msg.sender.userId === selectedUser.userId && msg.receiver?.userId === user?.userId)
      );
    }
    return [];
  };

  // Check if user can edit/delete message
  const canModifyMessage = (msg: Message) => {
    return msg.sender.userId === user?.userId;
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-105"
        >
          {isOpen ? (
            <FiX className="w-6 h-6 text-white" />
          ) : (
            <>
              <FiMessageSquare className="w-6 h-6 text-white" />
              {(unreadCount + globalUnreadCount) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {(unreadCount + globalUnreadCount) > 9 ? '9+' : (unreadCount + globalUnreadCount)}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-800 rounded-lg p-1"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'global' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiGlobe className="w-4 h-4" />
              Global
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'inbox' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiUsers className="w-4 h-4" />
              Inbox
              {unreadCount > 0 && activeTab !== 'inbox' && (
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>

          {/* Inbox User Selection */}
          {activeTab === 'inbox' && !selectedUser && (
            <div className="flex-1 overflow-y-auto p-2">
              {users.map(u => (
                <div
                  key={u.userId}
                  onClick={() => {
                    setSelectedUser(u);
                    // Fetch conversation messages with this user
                    if (socket && isConnected && u.userId) {
                      emit('get_conversation', { userId: u.userId }, (response: any) => {
                        if (response?.success) {
                          setMessages(response.messages || []);
                        }
                      });
                      // Mark messages from this user as read
                      emit('mark_messages_read', { fromUserId: u.userId }, (response: any) => {
                        if (response?.success) {
                          // Clear unread count for this user
                          setUnreadCountsPerUser(prev => {
                            const newCounts = { ...prev };
                            delete newCounts[u.userId];
                            return newCounts;
                          });
                          // Recalculate total
                          const currentCount = unreadCountsPerUser[u.userId] || 0;
                          setUnreadCount(prev => Math.max(0, prev - currentCount));
                        }
                      });
                    }
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium">
                        {u.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {connectedUsers.includes(u.userId) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || u.title || 'Unknown User'}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email || u.telephone || ''}</p>
                  </div>
                  {unreadCountsPerUser[u.userId] > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCountsPerUser[u.userId]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Back button for inbox */}
          {activeTab === 'inbox' && selectedUser && (
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                ← Back
              </button>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-600">
                {selectedUser.full_name}
                {connectedUsers.includes(selectedUser.userId) && (
                  <span className="ml-2 text-xs text-green-600">● Online</span>
                )}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Messages */}
          {(activeTab === 'global' || (activeTab === 'inbox' && selectedUser)) && (
            <>
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 relative" ref={messagesContainerRef} onScroll={handleScroll}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : getDisplayMessages().length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FiMessageSquare className="w-12 h-12 mb-2" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {getDisplayMessages().map((msg) => (
                      <div 
                        key={msg.messageId} 
                        className={`flex ${msg.sender.userId === user?.userId ? 'justify-end' : 'justify-start'} mb-3`}
                      >
                        <div className={`max-w-[75%] ${msg.sender.userId === user?.userId ? 'order-2' : 'order-1'}`}>
                          {msg.sender.userId !== user?.userId && (
                            <div className="text-xs text-gray-500 mb-1 ml-1">
                              {msg.sender.full_name}
                            </div>
                          )}
                          <div className={`rounded-lg px-4 py-2 ${
                            msg.sender.userId === user?.userId 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}>
                            {editingMessageId === msg.messageId ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editMessageText}
                                  onChange={(e) => setEditMessageText(e.target.value)}
                                  className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-500"
                                  autoFocus
                                />
                                <button 
                                  onClick={() => handleEditMessage(msg.messageId)}
                                  disabled={isSending}
                                  className="text-green-500 hover:text-green-700"
                                >
                                  <FiCheck />
                                </button>
                                <button 
                                  onClick={() => { setEditingMessageId(null); setEditMessageText(''); }}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <FiX />
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm break-words">{msg.message}</p>
                                <div className={`flex items-center gap-1 mt-1 text-xs ${msg.sender.userId === user?.userId ? 'text-blue-200' : 'text-gray-400'}`}>
                                  <span>{msg.time}</span>
                                  {msg.isEdited && <span className="italic">(edited)</span>}
                                </div>
                              </>
                            )}
                          </div>
                          {editingMessageId !== msg.messageId && canModifyMessage(msg) && (
                            <div className={`flex gap-2 mt-1 ${msg.sender.userId === user?.userId ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <button 
                                onClick={() => { setEditingMessageId(msg.messageId); setEditMessageText(msg.message); }}
                                className="text-gray-400 hover:text-blue-500 p-1"
                                title="Edit"
                              >
                                <FiEdit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteMessage(msg.messageId)}
                                disabled={isSending}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Delete"
                              >
                                <FiTrash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
                
                {/* Typing Indicator */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="text-sm text-gray-400 italic mt-2">
                    {Object.values(typingUsers)[0]}
                  </div>
                )}

                {/* Scroll to Bottom Button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-20 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors flex items-center justify-center"
                    title="Scroll to bottom"
                  >
                    <FiChevronDown size={20} />
                  </button>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef as any}
                    value={inputMessage}
                    onChange={(e) => { 
                      setInputMessage(e.target.value); 
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      handleTyping(); 
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (editingMessageId) {
                          handleEditMessage(editingMessageId);
                        } else {
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={activeTab === 'global' 
                      ? 'Type a message...' 
                      : selectedUser 
                        ? `Message ${selectedUser.full_name}...`
                        : 'Select a user to chat...'
                    }
                    disabled={isSending || (activeTab === 'inbox' && !selectedUser)}
                    rows={1}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isSending || (activeTab === 'inbox' && !selectedUser)}
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FiSend className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;

