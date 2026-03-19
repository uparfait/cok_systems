import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { FiMessageSquare, FiX, FiSend, FiUsers, FiGlobe, FiEdit2, FiCheck, FiChevronDown } from 'react-icons/fi';

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
  
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'inbox'>('global');
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!token && !!user;

  // Generate avatar color based on username
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Reset input height
  const resetInputHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '40px';
    }
  }, []);

  // Focus input
  const focusInput = useCallback(() => {
    if (inputRef.current && (activeTab === 'global' || selectedUser)) {
      inputRef.current.focus();
    }
  }, [activeTab, selectedUser]);

  const fetchInitialData = useCallback(async () => {
    if (!socket || !isConnected || !isAuthenticated) return;
    
    setIsLoading(true);
    setError(null);
    
    if (activeTab === 'global') {
      emit('get_global_messages', {}, (response: any) => {
        if (response?.success) {
          setMessages(response.messages || []);
        }
        setIsLoading(false);
        setIsInitialLoad(false);
      });
    } else {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [socket, isConnected, isAuthenticated, activeTab, emit]);

  const fetchUsers = useCallback(async () => {
    if (!socket || !isConnected || !isAuthenticated) return;
    
    setIsLoadingUsers(true);
    
    emit('get_all_users', {}, (response: any) => {
      if (response?.success) {
        const otherUsers = (response.users || []).filter((u: User) => u.userId !== user?.userId);
        const onlineUsers = otherUsers.filter((u: User) => response.connectedUsers?.includes(u.userId));
        setConnectedUsers(response.connectedUsers || []);
        setUsers(onlineUsers);
      }
      setIsLoadingUsers(false);
    });
  }, [socket, isConnected, isAuthenticated, emit, user]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated) return;

    const handleGlobalMessages = (data: Message[]) => {
      if (activeTab === 'global') {
        setMessages(data);
        setIsInitialLoad(false);
        if (!isOpen || activeTab !== 'global') {
          setGlobalUnreadCount(prev => prev + (data.length - messages.length));
        }
      } else if (!isOpen) {
        setGlobalUnreadCount(prev => prev + (data.length - messages.length));
      }
    };

    const handleGlobalMessageEdited = (data: { messageId: string; newMessage: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === data.messageId 
          ? { ...msg, message: data.newMessage, isEdited: true }
          : msg
      ));
    };

    const handleNewInboxMessage = (data: Message) => {
      const messageTime = new Date(data.createdAt).getTime();
      const otherUserId = data.sender.userId === user?.userId ? data.receiver?.userId : data.sender.userId;
      if (otherUserId) {
        setLastMessageTimes(prev => ({ ...prev, [otherUserId]: messageTime }));
      }
      
      if (activeTab === 'inbox' && selectedUser) {
        if (data.sender.userId === selectedUser.userId || data.receiver?.userId === selectedUser.userId) {
          setMessages(prev => [...prev, data]);
        }
      } else {
        setMessages(prev => [...prev, data]);
      }
      
      if (data.receiver?.userId === user?.userId && data.sender.userId !== user?.userId) {
        if (activeTab !== 'inbox' || !selectedUser || data.sender.userId !== selectedUser.userId) {
          setUnreadCountsPerUser(prev => ({
            ...prev,
            [data.sender.userId]: (prev[data.sender.userId] || 0) + 1
          }));
          setUnreadCount(prev => prev + 1);
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

    const handleUserOnline = (data: { userId: string; fullName: string }) => {
      setConnectedUsers(prev => [...prev, data.userId]);
      if (activeTab === 'inbox') {
        setUsers(prev => {
          const user = prev.find(u => u.userId === data.userId);
          if (!user) {
            fetchUsers();
          }
          return prev;
        });
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      setConnectedUsers(prev => prev.filter(id => id !== data.userId));
      if (activeTab === 'inbox') {
        setUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    };

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

    const handleMessagesMarkedRead = (data: { byUserId: string; byUserName: string; count: number }) => {
      if (selectedUser && data.byUserId === selectedUser.userId) {
        setUnreadCountsPerUser(prev => {
          const newCounts = { ...prev };
          delete newCounts[data.byUserId];
          return newCounts;
        });
        setUnreadCount(prev => Math.max(0, prev - data.count));
      }
    };

    on('global_messages', handleGlobalMessages);
    on('global_message_edited', handleGlobalMessageEdited);
    on('new_inbox_message', handleNewInboxMessage);
    on('inbox_message_edited', handleInboxMessageEdited);
    on('user_online', handleUserOnline);
    on('user_offline', handleUserOffline);
    on('user_typing_global', handleUserTypingGlobal);
    on('user_typing_inbox', handleUserTypingInbox);
    on('messages_marked_read', handleMessagesMarkedRead);

    return () => {
      off('global_messages', handleGlobalMessages);
      off('global_message_edited', handleGlobalMessageEdited);
      off('new_inbox_message', handleNewInboxMessage);
      off('inbox_message_edited', handleInboxMessageEdited);
      off('user_online', handleUserOnline);
      off('user_offline', handleUserOffline);
      off('user_typing_global', handleUserTypingGlobal);
      off('user_typing_inbox', handleUserTypingInbox);
      off('messages_marked_read', handleMessagesMarkedRead);
    };
  }, [socket, isConnected, isAuthenticated, activeTab, selectedUser, on, off, user, isOpen, messages.length, fetchUsers]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      if (activeTab === 'global') {
        fetchInitialData();
      } else if (activeTab === 'inbox') {
        setMessages([]);
        fetchUsers();
      }
      focusInput();
    }
  }, [isOpen, isAuthenticated, activeTab, fetchInitialData, fetchUsers, focusInput]);

  useEffect(() => {
    if (isOpen && activeTab === 'global') {
      setGlobalUnreadCount(0);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    if (selectedUser && socket && isConnected) {
      emit('get_conversation', { userId: selectedUser.userId }, (response: any) => {
        if (response?.success) {
          setMessages(response.messages || []);
          setIsInitialLoad(false);
        }
      });
      
      emit('mark_messages_read', { fromUserId: selectedUser.userId }, (response: any) => {
        if (response?.success) {
          setUnreadCountsPerUser(prev => {
            const newCounts = { ...prev };
            delete newCounts[selectedUser.userId];
            return newCounts;
          });
          setUnreadCount(prev => Math.max(0, prev - (unreadCountsPerUser[selectedUser.userId] || 0)));
        }
      });
    }
  }, [selectedUser, socket, isConnected, emit]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !socket || !isConnected) return;
    
    setIsSending(true);
    setError(null);

    try {
      if (activeTab === 'global') {
        emit('send_global_message', { message: inputMessage.trim() }, (response: any) => {
          if (response?.success) {
            setInputMessage('');
            resetInputHeight();
            focusInput();
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
            resetInputHeight();
            focusInput();
          } else {
            setError(response?.message || 'Failed to send message');
          }
          setIsSending(false);
        });
      }
    } catch (err) {
      setError('Failed to send message');
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editMessageText.trim() || !socket || !isConnected) return;
    
    setIsSending(true);
    setError(null);

    const eventName = activeTab === 'global' ? 'edit_global_message' : 'edit_inbox_message';
    
    emit(eventName, { messageId, message: editMessageText.trim() }, (response: any) => {
      if (response?.success) {
        setEditingMessageId(null);
        setEditMessageText('');
        focusInput();
      } else {
        setError(response?.message || 'Failed to edit message');
      }
      setIsSending(false);
    });
  };

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

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

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

  const canModifyMessage = (msg: Message) => {
    return msg.sender.userId === user?.userId;
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return null;
  }

  const displayMessages = getDisplayMessages();

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

      {/* Chat Panel with Animation */}
      {isOpen && (
        <div className={`fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200 transition-all duration-300 transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-800 rounded-lg p-1 transition-colors"
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
              {isLoadingUsers ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FiUsers className="w-12 h-12 mb-2" />
                  <p className="text-sm">No users online</p>
                </div>
              ) : (
                users.map(u => (
                  <div
                    key={u.userId}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 ${getAvatarColor(u.full_name)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
                        {getInitials(u.full_name)}
                      </div>
                      {connectedUsers.includes(u.userId) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    {unreadCountsPerUser[u.userId] > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCountsPerUser[u.userId]}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Back button for inbox */}
          {activeTab === 'inbox' && selectedUser && (
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <button 
                onClick={() => {
                  setSelectedUser(null);
                  setMessages([]);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
              >
                ← Back
              </button>
              <span className="text-gray-400">|</span>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 ${getAvatarColor(selectedUser.full_name)} rounded-full flex items-center justify-center text-white text-xs font-medium`}>
                  {getInitials(selectedUser.full_name)}
                </div>
                <span className="text-sm text-gray-600">
                  {selectedUser.full_name}
                  {connectedUsers.includes(selectedUser.userId) && (
                    <span className="ml-2 text-xs text-green-600">● Online</span>
                  )}
                </span>
              </div>
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
                {isLoading && isInitialLoad ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FiMessageSquare className="w-12 h-12 mb-2" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {displayMessages.map((msg) => {
                      const isOwn = msg.sender.userId === user?.userId;
                      return (
                        <div key={msg.messageId} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}>
                          {!isOwn && (
                            <div className="flex-shrink-0 mr-2 mt-1">
                              <div className={`w-8 h-8 ${getAvatarColor(msg.sender.full_name)} rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm`}>
                                {getInitials(msg.sender.full_name)}
                              </div>
                            </div>
                          )}
                          <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                            {!isOwn && (
                              <div className="text-xs text-gray-500 mb-1 ml-1">
                                {msg.sender.full_name}
                              </div>
                            )}
                            <div className={`rounded-2xl px-4 py-2 ${
                              isOwn 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
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
                                    <FiCheck size={16} />
                                  </button>
                                  <button 
                                    onClick={() => { setEditingMessageId(null); setEditMessageText(''); }}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <FiX size={16} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm break-words">{msg.message}</p>
                                  <div className={`flex items-center gap-1 mt-1 text-xs ${
                                    isOwn ? 'text-blue-200' : 'text-gray-400'
                                  }`}>
                                    <span>{formatTime(msg.createdAt)}</span>
                                    {isOwn && (
                                      <span className="ml-1">
                                        {msg.isEdited ? '(edited)' : '✓'}
                                      </span>
                                    )}
                                    {!isOwn && msg.isEdited && (
                                      <span className="ml-1">(edited)</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            {editingMessageId !== msg.messageId && canModifyMessage(msg) && (
                              <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                <button 
                                  onClick={() => { setEditingMessageId(msg.messageId); setEditMessageText(msg.message); }}
                                  className="text-gray-400 hover:text-blue-500 p-1"
                                  title="Edit"
                                >
                                  <FiEdit2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
                
                {/* Typing Indicator */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 italic mt-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    {Object.values(typingUsers)[0]}
                  </div>
                )}
              </div>

              {/* Scroll to Bottom Button - Positioned absolutely relative to messages container */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-20 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all transform hover:scale-105 flex items-center justify-center z-10"
                  title="Scroll to bottom"
                >
                  <FiChevronDown size={20} />
                </button>
              )}

              {/* Input */}
              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => { 
                      setInputMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      handleTyping();
                    }}
                    onKeyDown={handleKeyPress}
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
