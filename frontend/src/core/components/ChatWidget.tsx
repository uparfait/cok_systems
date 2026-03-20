import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { FiMessageSquare, FiX, FiSend, FiUsers, FiGlobe, FiEdit2, FiCheck, FiChevronDown, FiUser, FiMessageCircle } from 'react-icons/fi';

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

// Bouncing Loader Component
const BouncingLoader: React.FC<{ message?: string }> = ({ message = 'Loading messages...' }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <div className="flex gap-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
    <p className="text-sm text-gray-500">{message}</p>
  </div>
);

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
  const [isLoadingSilent, setIsLoadingSilent] = useState(false);
  const [messageCache, setMessageCache] = useState<{ [key: string]: Message[] }>({
    global: [],
    inbox: {}
  });
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeTabRef = useRef(activeTab);
  const selectedUserRef = useRef(selectedUser);

  const isAuthenticated = !!token && !!user;

  // Update refs
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Generate avatar color based on username with gradient
  const getAvatarColor = (name: string) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-red-500 to-red-600',
      'from-teal-500 to-teal-600',
      'from-orange-500 to-orange-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    return gradients[Math.abs(hash) % gradients.length];
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab, selectedUser]);

  // Silent load messages (without showing spinner)
  const loadMessagesSilently = useCallback(async (type: 'global' | 'inbox', userId?: string) => {
    if (!socket || !isConnected || !isAuthenticated) return;
    
    setIsLoadingSilent(true);
    
    if (type === 'global') {
      emit('get_global_messages', {}, (response: any) => {
        if (response?.success && activeTabRef.current === 'global') {
          setMessages(response.messages || []);
          setMessageCache(prev => ({ ...prev, global: response.messages || [] }));
        }
        setIsLoadingSilent(false);
      });
    } else if (type === 'inbox' && userId) {
      emit('get_conversation', { userId }, (response: any) => {
        if (response?.success && activeTabRef.current === 'inbox' && selectedUserRef.current?.userId === userId) {
          setMessages(response.messages || []);
          setMessageCache(prev => ({
            ...prev,
            inbox: { ...prev.inbox, [userId]: response.messages || [] }
          }));
        }
        setIsLoadingSilent(false);
      });
    }
  }, [socket, isConnected, isAuthenticated, emit]);

  // Load messages with loader (initial load)
  const loadMessagesWithLoader = useCallback(async (type: 'global' | 'inbox', userId?: string) => {
    if (!socket || !isConnected || !isAuthenticated) return;
    
    setIsLoading(true);
    
    if (type === 'global') {
      emit('get_global_messages', {}, (response: any) => {
        if (response?.success) {
          setMessages(response.messages || []);
          setMessageCache(prev => ({ ...prev, global: response.messages || [] }));
        }
        setIsLoading(false);
        setIsInitialLoad(false);
      });
    } else if (type === 'inbox' && userId) {
      emit('get_conversation', { userId }, (response: any) => {
        if (response?.success) {
          setMessages(response.messages || []);
          setMessageCache(prev => ({
            ...prev,
            inbox: { ...prev.inbox, [userId]: response.messages || [] }
          }));
        }
        setIsLoading(false);
        setIsInitialLoad(false);
      });
    }
  }, [socket, isConnected, isAuthenticated, emit]);

  const fetchUsers = useCallback(async () => {
    if (!socket || !isConnected || !isAuthenticated) return;
    
    setIsLoadingUsers(true);
    
    emit('get_all_users', {}, (response: any) => {
      if (response?.success) {
        const allUsers = response.users || [];
        const otherUsers = allUsers.filter((u: User) => u.userId !== user?.userId);
        setConnectedUsers(response.connectedUsers || []);
        setUsers(otherUsers);
      }
      setIsLoadingUsers(false);
    });
  }, [socket, isConnected, isAuthenticated, emit, user]);

  // Set up socket event listeners with proper error handling
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated) return;

    const handleGlobalMessages = (data: Message[]) => {
      if (activeTabRef.current === 'global') {
        setMessages(data);
        setMessageCache(prev => ({ ...prev, global: data }));
      } else if (!isOpen) {
        setGlobalUnreadCount(prev => prev + (data.length - (messageCache.global?.length || 0)));
      } else {
        setMessageCache(prev => ({ ...prev, global: data }));
      }
    };

    const handleGlobalMessageEdited = (data: { messageId: string; newMessage: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === data.messageId 
          ? { ...msg, message: data.newMessage, isEdited: true, editedAt: new Date().toISOString() }
          : msg
      ));
      setMessageCache(prev => ({
        ...prev,
        global: prev.global.map(msg =>
          msg.messageId === data.messageId
            ? { ...msg, message: data.newMessage, isEdited: true, editedAt: new Date().toISOString() }
            : msg
        )
      }));
    };

    const handleNewInboxMessage = (data: Message) => {
      const messageTime = new Date(data.createdAt).getTime();
      const otherUserId = data.sender.userId === user?.userId ? data.receiver?.userId : data.sender.userId;
      
      if (otherUserId) {
        setLastMessageTimes(prev => ({ ...prev, [otherUserId]: messageTime }));
      }
      
      // Update messages if in correct conversation
      if (activeTabRef.current === 'inbox' && selectedUserRef.current) {
        if (data.sender.userId === selectedUserRef.current.userId || 
            data.receiver?.userId === selectedUserRef.current.userId) {
          setMessages(prev => [...prev, data]);
        }
      }
      
      // Update cache
      if (otherUserId) {
        setMessageCache(prev => ({
          ...prev,
          inbox: {
            ...prev.inbox,
            [otherUserId]: [...(prev.inbox[otherUserId] || []), data]
          }
        }));
      }
      
      // Handle unread counts
      if (data.receiver?.userId === user?.userId && data.sender.userId !== user?.userId) {
        if (activeTabRef.current !== 'inbox' || !selectedUserRef.current || 
            data.sender.userId !== selectedUserRef.current.userId) {
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
          ? { ...msg, message: data.newMessage, isEdited: true, editedAt: new Date().toISOString() }
          : msg
      ));
      
      // Update cache
      if (selectedUserRef.current) {
        setMessageCache(prev => ({
          ...prev,
          inbox: {
            ...prev.inbox,
            [selectedUserRef.current!.userId]: prev.inbox[selectedUserRef.current!.userId]?.map(msg =>
              msg.messageId === data.messageId
                ? { ...msg, message: data.newMessage, isEdited: true, editedAt: new Date().toISOString() }
                : msg
            ) || []
          }
        }));
      }
    };

    const handleUserOnline = (data: { userId: string; fullName: string }) => {
      setConnectedUsers(prev => [...prev, data.userId]);
      if (activeTabRef.current === 'inbox') {
        fetchUsers();
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      setConnectedUsers(prev => prev.filter(id => id !== data.userId));
      if (activeTabRef.current === 'inbox') {
        fetchUsers();
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
      if (selectedUserRef.current && data.senderId === selectedUserRef.current.userId) {
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
      if (selectedUserRef.current && data.byUserId === selectedUserRef.current.userId) {
        setUnreadCountsPerUser(prev => {
          const newCounts = { ...prev };
          delete newCounts[data.byUserId];
          return newCounts;
        });
        setUnreadCount(prev => Math.max(0, prev - data.count));
      }
    };

    // Register event listeners
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
  }, [socket, isConnected, isAuthenticated, on, off, user, isOpen, fetchUsers]);

  // Handle tab switching
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    
    const switchToGlobal = async () => {
      // Check cache first
      if (messageCache.global && messageCache.global.length > 0) {
        setMessages(messageCache.global);
        setIsInitialLoad(false);
        // Silently refresh in background
        loadMessagesSilently('global');
      } else {
        // First time load with loader
        loadMessagesWithLoader('global');
      }
      focusInput();
    };
    
    const switchToInbox = async () => {
      setMessages([]);
      fetchUsers();
      focusInput();
    };
    
    if (activeTab === 'global') {
      switchToGlobal();
    } else if (activeTab === 'inbox') {
      switchToInbox();
    }
    
    // Reset unread counts for active tab
    if (activeTab === 'global') {
      setGlobalUnreadCount(0);
    }
  }, [activeTab, isOpen, isAuthenticated, messageCache.global, loadMessagesSilently, loadMessagesWithLoader, fetchUsers, focusInput]);

  // Handle user selection in inbox
  useEffect(() => {
    if (!selectedUser || !socket || !isConnected || activeTab !== 'inbox') return;
    
    const loadConversation = async () => {
      // Check cache first
      if (messageCache.inbox[selectedUser.userId] && messageCache.inbox[selectedUser.userId].length > 0) {
        setMessages(messageCache.inbox[selectedUser.userId]);
        setIsInitialLoad(false);
        // Silently refresh in background
        loadMessagesSilently('inbox', selectedUser.userId);
      } else {
        // First time load with loader
        loadMessagesWithLoader('inbox', selectedUser.userId);
      }
      
      // Mark messages as read
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
    };
    
    loadConversation();
  }, [selectedUser, socket, isConnected, activeTab, messageCache.inbox, loadMessagesSilently, loadMessagesWithLoader, emit, unreadCountsPerUser]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !socket || !isConnected || isSending) return;
    
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
    if (!editMessageText.trim() || !socket || !isConnected || isSending) return;
    
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
      return messages;
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

  const formatDate = (time: string) => {
    const date = new Date(time);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach(msg => {
      const date = formatDate(msg.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  if (!isAuthenticated) {
    return null;
  }

  const displayMessages = getDisplayMessages();
  const groupedMessages = groupMessagesByDate(displayMessages);
  const showLoader = isLoading && isInitialLoad;
  const showSilentLoader = isLoadingSilent && !isInitialLoad;

  return (
    <>
      {/* Chat Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isOpen ? (
            <FiX className="w-6 h-6 text-white" />
          ) : (
            <>
              <FiMessageSquare className="w-6 h-6 text-white" />
              {(unreadCount + globalUnreadCount) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 animate-pulse">
                  {(unreadCount + globalUnreadCount) > 9 ? '9+' : (unreadCount + globalUnreadCount)}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200 transition-all duration-300 transform scale-100 opacity-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Chat</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-800 rounded-lg p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'global' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiGlobe className="w-4 h-4" />
              Global
              {globalUnreadCount > 0 && activeTab !== 'global' && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'inbox' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiUsers className="w-4 h-4" />
              Inbox
              {unreadCount > 0 && activeTab !== 'inbox' && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Inbox User Selection */}
          {activeTab === 'inbox' && !selectedUser && (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center h-full">
                  <BouncingLoader message="Loading users..." />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FiUsers className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">No users available</p>
                  <p className="text-xs">Check back later</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {users.map(u => (
                    <div
                      key={u.userId}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center gap-3 p-3 hover:bg-white cursor-pointer transition-all duration-200 group"
                    >
                      <div className="relative">
                        <div className={`w-10 h-10 bg-gradient-to-r ${getAvatarColor(u.full_name)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
                          {getInitials(u.full_name)}
                        </div>
                        {connectedUsers.includes(u.userId) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        {lastMessageTimes[u.userId] && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Last message: {formatTime(new Date(lastMessageTimes[u.userId]).toISOString())}
                          </p>
                        )}
                      </div>
                      {unreadCountsPerUser[u.userId] > 0 && (
                        <span className="min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 animate-pulse">
                          {unreadCountsPerUser[u.userId] > 9 ? '9+' : unreadCountsPerUser[u.userId]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
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
                  setIsInitialLoad(true);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors flex items-center gap-1"
              >
                ← Back to users
              </button>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 bg-gradient-to-r ${getAvatarColor(selectedUser.full_name)} rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm`}>
                  {getInitials(selectedUser.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedUser.full_name}
                  </span>
                  {connectedUsers.includes(selectedUser.userId) && (
                    <span className="ml-2 text-xs text-green-600">● Online</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg animate-shake">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Messages Area */}
          {(activeTab === 'global' || (activeTab === 'inbox' && selectedUser)) && (
            <>
              <div 
                className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white relative" 
                ref={messagesContainerRef} 
                onScroll={handleScroll}
              >
                {showLoader ? (
                  <BouncingLoader message="Loading messages..." />
                ) : Object.keys(groupedMessages).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FiMessageCircle className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Be the first to send a message!</p>
                  </div>
                ) : (
                  <>
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                      <div key={date}>
                        <div className="flex justify-center my-4">
                          <div className="px-3 py-1 bg-gray-200 rounded-full text-xs text-gray-600 font-medium shadow-sm">
                            {date}
                          </div>
                        </div>
                        {msgs.map((msg) => {
                          const isOwn = msg.sender.userId === user?.userId;
                          return (
                            <div key={msg.messageId} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group animate-fadeIn`}>
                              {!isOwn && (
                                <div className="flex-shrink-0 mr-2 mt-1">
                                  <div className={`w-8 h-8 bg-gradient-to-r ${getAvatarColor(msg.sender.full_name)} rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm`}>
                                    {getInitials(msg.sender.full_name)}
                                  </div>
                                </div>
                              )}
                              <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                {!isOwn && (
                                  <div className="text-xs font-medium text-gray-600 mb-1 ml-1">
                                    {msg.sender.full_name}
                                  </div>
                                )}
                                <div className={`rounded-2xl px-4 py-2 shadow-sm transition-all duration-200 ${
                                  isOwn 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none hover:shadow-md' 
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none hover:shadow-md'
                                }`}>
                                  {editingMessageId === msg.messageId ? (
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={editMessageText}
                                        onChange={(e) => setEditMessageText(e.target.value)}
                                        className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => handleEditMessage(msg.messageId)}
                                        disabled={isSending}
                                        className="text-green-500 hover:text-green-700 transition-colors"
                                      >
                                        <FiCheck size={16} />
                                      </button>
                                      <button 
                                        onClick={() => { setEditingMessageId(null); setEditMessageText(''); }}
                                        className="text-gray-500 hover:text-gray-700 transition-colors"
                                      >
                                        <FiX size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm break-words leading-relaxed">{msg.message}</p>
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
                                  <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                                    <button 
                                      onClick={() => { setEditingMessageId(msg.messageId); setEditMessageText(msg.message); }}
                                      className="text-gray-400 hover:text-blue-500 p-1 transition-colors"
                                      title="Edit message"
                                    >
                                      <FiEdit2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef
