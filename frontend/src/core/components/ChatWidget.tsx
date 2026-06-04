import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import GifPicker from 'gif-picker-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import {
  FiMessageSquare, FiX, FiSend, FiUsers, FiGlobe, FiEdit2,
  FiChevronDown, FiSearch, FiTrash2, FiCheck, FiChevronLeft,
  FiClock, FiCheckCircle, FiAlertCircle, FiPaperclip,
  FiMaximize2, FiMinimize2, FiMic, FiSquare, FiFile,
  FiEyeOff,
  FiMoreHorizontal, FiDownload, FiMessageCircle,
} from 'react-icons/fi';

interface UserItem {
  userId: string; email: string; full_name: string; telephone?: string; is_active?: boolean;
}
interface ChatMessage {
  messageId: string; message: string; type: 'global' | 'inbox'; contentType: string;
  createdAt: string; sender: { email: string; full_name: string; userId: string };
  receiver?: { email: string; full_name: string; userId: string };
  fileUrl?: string; fileName?: string; fileSize?: number; mimeType?: string;
  thumbnailUrl?: string; duration?: number; gifUrl?: string; gifTitle?: string;
  stickerUrl?: string; isViewOnce?: boolean; viewedBy?: Array<{ userId: string }>;
  isForwarded?: boolean; isEdited?: boolean; editedAt?: string;
  isDeleted?: boolean; readBy?: Array<{ userId: string; readAt: string }>;
  replyTo?: { messageId: string; message: string; senderName: string } | null;
}
interface Conversation { userId: string; user: UserItem; lastMessage: ChatMessage | null; unreadCount: number; }
interface SocketResponse<T = unknown> { success?: boolean; message?: string; messages?: T[]; users?: UserItem[]; connectedUsers?: string[]; hasMore?: boolean; page?: number; total?: number; file?: { url: string; name: string; size: number; mimeType: string; contentType: string }; }
interface GifResult { url?: string; previewUrl?: string; title?: string; }

const GRADIENTS = ['from-blue-500 to-blue-600','from-emerald-500 to-emerald-600','from-purple-500 to-purple-600','from-pink-500 to-pink-600','from-indigo-500 to-indigo-600','from-rose-500 to-rose-600','from-teal-500 to-teal-600','from-orange-500 to-orange-600','from-cyan-500 to-cyan-600','from-violet-500 to-violet-600'];
function getGrad(n: string) { let h = 0; for (let i = 0; i < n.length; i++) { h = ((h << 5) - h) + n.charCodeAt(i); h &= h; } return GRADIENTS[Math.abs(h) % GRADIENTS.length]; }
function getInits(n: string) { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : n.charAt(0).toUpperCase(); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtConvTime(d: string) { const dt = new Date(d); const n = new Date(); const diff = Math.floor((n.getTime() - dt.getTime()) / 86400000); if (diff === 0) return fmtTime(d); if (diff === 1) return 'Yesterday'; if (diff < 7) return dt.toLocaleDateString([], { weekday: 'short' }); return dt.toLocaleDateString([], { month: 'short', day: 'numeric' }); }
function getReadStatus(msg: ChatMessage, uid: string): 'sent' | 'delivered' | 'read' { if (!msg.readBy || msg.readBy.length === 0) return 'sent'; return msg.readBy.some((r: { userId: string }) => r.userId !== uid) ? 'read' : 'delivered'; }
function formatBytes(b: number) { if (!b) return ''; const u = ['B','KB','MB','GB']; let i = 0; let s = b; while (s >= 1024 && i < 3) { s /= 1024; i++; } return s.toFixed(i > 0 ? 1 : 0) + ' ' + u[i]; }

const Avatar: React.FC<{ name: string; size?: 'sm'|'md'|'lg'; online?: boolean; showOnline?: boolean }> = ({ name, size='md', online, showOnline }) => {
  const d = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return <div className="relative flex-shrink-0"><div className={`${d} bg-gradient-to-r ${getGrad(name)} rounded-full flex items-center justify-center text-white font-semibold shadow-sm`}>{getInits(name)}</div>{showOnline && <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />}</div>;
};
const TypingDots: React.FC = () => (
  <span className="inline-flex items-center gap-[3px] px-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} /></span>
);
const MarkdownMsg: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>,
  }}>{content}</ReactMarkdown>
);
const FileViewer: React.FC<{ msg: ChatMessage; onClose: () => void }> = ({ msg, onClose }) => {
  const isImage = msg.mimeType?.startsWith('image/');
  const isVideo = msg.mimeType?.startsWith('video/');
  const isAudio = msg.mimeType?.startsWith('audio/');
  const fileUrl = msg.fileUrl;
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-gray-300 z-10"><FiX className="w-6 h-6" /></button>
        {isImage && <img src={fileUrl} alt={msg.fileName || ''} className="max-w-full max-h-[85vh] object-contain rounded-lg" />}
        {isVideo && <video src={fileUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg" />}
        {isAudio && <div className="bg-gray-800 p-8 rounded-xl text-white"><audio src={fileUrl} controls autoPlay className="w-80" /><p className="mt-2 text-sm text-gray-400">{msg.fileName}</p></div>}
        {!isImage && !isVideo && !isAudio && (
          <div className="bg-gray-800 p-8 rounded-xl text-white flex flex-col items-center gap-3">
            <FiFile className="w-12 h-12" /><p className="text-lg">{msg.fileName}</p><p className="text-sm text-gray-400">{formatBytes(msg.fileSize || 0)}</p>
            <a href={fileUrl} download={msg.fileName} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Download</a>
          </div>
        )}
      </div>
    </div>
  );
};
const FiPlusIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const FiReplyIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);
const FiReplyIconMd: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const ChatWidget: React.FC = () => {
  const { socket, isConnected, emit, on, off } = useSocket();
  const { user, token } = useAuth();

  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<'global'|'inbox'>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadByUser, setUnreadByUser] = useState<Record<string,number>>({});
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<ChatMessage|null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTextVal, setEditTextVal] = useState('');
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage|null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [viewOnceMsg, setViewOnceMsg] = useState<ChatMessage|null>(null);
  const [viewerMsg, setViewerMsg] = useState<ChatMessage|null>(null);
  const [cache, setCache] = useState<{ global: ChatMessage[]; inbox: Record<string, ChatMessage[]> }>({ global: [], inbox: {} });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const tabRef = useRef(tab);
  const selUserRef = useRef(selectedUser);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fetchUsersRef = useRef<()=>void>(()=>{});
  const loadGlobalRef = useRef<(page?: number)=>void>(()=>{});
  const loadConvRef = useRef<(uid: string, page?: number)=>void>(()=>{});

  const isAuthed = !!token && !!user;
  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:2026');

  // ── ALL HOOKS BEFORE EARLY RETURN ──
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { selUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }, [messages.length]);
  useEffect(() => { if (showScrollBtn) { const btn = document.getElementById('scroll-btn'); if (btn) btn.style.display = 'flex'; } }, [showScrollBtn]);
  useEffect(() => { const handler = () => setContextMenu(null); if (contextMenu) { document.addEventListener('click', handler); return () => document.removeEventListener('click', handler); } }, [contextMenu]);

  // Data fetching - fetchUsers
  useEffect(() => {
    fetchUsersRef.current = () => {
      if (!socket || !isConnected || !isAuthed || !user) return;
      emit('get_all_users', {}, (res: SocketResponse) => {
        if (res?.success) {
          setConnectedUsers(res.connectedUsers || []);
          setUsers((res.users || []).filter((u: UserItem) => u.userId !== user.userId));
        }
      });
    };
  }, [socket, isConnected, isAuthed, emit, user]);

  // Data fetching - loadGlobal
  useEffect(() => {
    loadGlobalRef.current = (p = 0) => {
      if (!socket || !isConnected || !isAuthed) return;
      setIsLoading(true);
      emit('get_global_messages', { page: p }, (res: SocketResponse<ChatMessage>) => {
        if (res?.success) {
          const msgs = (res.messages || []) as ChatMessage[];
          if (p === 0) { setMessages(msgs); setCache(prev => ({ ...prev, global: msgs })); }
          else { setMessages(prev => [...msgs, ...prev]); setCache(prev => ({ global: [...msgs, ...prev.global], inbox: prev.inbox })); }
          setHasMore(res.hasMore || false); setCurrentPage(p);
        }
        setIsLoading(false);
      });
    };
  }, [socket, isConnected, isAuthed, emit]);

  // Data fetching - loadConversation
  useEffect(() => {
    loadConvRef.current = (uid: string, p = 0) => {
      if (!socket || !isConnected || !isAuthed) return;
      setIsLoading(true);
      emit('get_conversation', { userId: uid, page: p }, (res: SocketResponse<ChatMessage>) => {
        if (res?.success) {
          const msgs = (res.messages || []) as ChatMessage[];
          if (p === 0) { setMessages(msgs); setCache(prev => ({ ...prev, inbox: { ...prev.inbox, [uid]: msgs } })); }
          else { setMessages(prev => [...msgs, ...prev]); setCache(prev => ({ ...prev, inbox: { ...prev.inbox, [uid]: [...msgs, ...(prev.inbox[uid] || [])] } })); }
          setHasMore(res.hasMore || false); setCurrentPage(p);
          emit('mark_messages_read', { fromUserId: uid }, () => {});
        }
        setIsLoading(false);
      });
    };
  }, [socket, isConnected, isAuthed, emit]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !isAuthed || !user) return;
    const onGlobalMsgs = (data: ChatMessage[] | SocketResponse<ChatMessage>) => {
      const msgsArr = Array.isArray(data) ? data : ((data as SocketResponse<ChatMessage>).messages || []) as ChatMessage[];
      if (tabRef.current === 'global') setMessages(msgsArr);
      setCache(prev => ({ ...prev, global: msgsArr }));
    };
    const onNewInbox = (data: ChatMessage) => {
      const myIdLocal = String(user.userId);
      const otherId = data.sender.userId === myIdLocal ? data.receiver?.userId : data.sender.userId;
      if (tabRef.current === 'inbox' && selUserRef.current && (data.sender.userId === selUserRef.current.userId || data.receiver?.userId === selUserRef.current.userId)) {
        setMessages(prev => [...prev, data]);
      }
      if (otherId) setCache(prev => ({ ...prev, inbox: { ...prev.inbox, [otherId]: [...(prev.inbox[otherId] || []), data] } }));
      if (data.receiver?.userId === myIdLocal && data.sender.userId !== myIdLocal && (tabRef.current !== 'inbox' || !selUserRef.current || data.sender.userId !== selUserRef.current.userId)) {
        setUnreadByUser(prev => ({ ...prev, [data.sender.userId]: (prev[data.sender.userId] || 0) + 1 }));
        setUnreadTotal(prev => prev + 1);
      }
    };
    const onMsgEdited = (data: { messageId: string; newMessage: string }) => {
      setMessages(prev => prev.map(m => m.messageId === data.messageId ? { ...m, message: data.newMessage, isEdited: true } : m));
    };
    const onMsgDeleted = (data: { messageId: string }) => setMessages(prev => prev.filter(m => m.messageId !== data.messageId));
    const onMarkedRead = (data: { byUserId: string; count: number }) => {
      if (selUserRef.current && data.byUserId === selUserRef.current.userId) {
        setUnreadByUser(prev => { const n = { ...prev }; delete n[data.byUserId]; return n; });
        setUnreadTotal(prev => Math.max(0, prev - data.count));
      }
    };
    on('global_messages', onGlobalMsgs);
    on('new_inbox_message', onNewInbox);
    on('message_edited', onMsgEdited);
    on('message_deleted', onMsgDeleted);
    on('messages_marked_read', onMarkedRead);
    on('user_online', () => fetchUsersRef.current());
    on('user_offline', () => fetchUsersRef.current());
    return () => {
      off('global_messages', onGlobalMsgs); off('new_inbox_message', onNewInbox);
      off('message_edited', onMsgEdited); off('message_deleted', onMsgDeleted);
      off('messages_marked_read', onMarkedRead);
      off('user_online', fetchUsersRef.current); off('user_offline', fetchUsersRef.current);
    };
  }, [socket, isConnected, isAuthed, user, on, off]);

  // Tab switching - use ref to avoid direct setState in effect
  useEffect(() => {
    if (!isOpen || !isAuthed) return;
    if (tab === 'global') loadGlobalRef.current(0);
    else { setMessages([]); setSelectedUser(null); fetchUsersRef.current(); }
  }, [tab, isOpen, isAuthed]);

  // ── Derived data (useMemo must be BEFORE early return) ──
  const conversationList: Conversation[] = useMemo(() => {
    return users.filter(u => !searchQuery || u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(u => { const msgs = cache.inbox[u.userId] || []; const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null; return { userId: u.userId, user: u, lastMessage: lastMsg, unreadCount: unreadByUser[u.userId] || 0 }; })
      .sort((a, b) => { const aOn = connectedUsers.includes(a.userId) ? 1 : 0; const bOn = connectedUsers.includes(b.userId) ? 1 : 0; if (aOn !== bOn) return bOn - aOn; if (a.lastMessage && b.lastMessage) return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(); if (a.lastMessage) return -1; if (b.lastMessage) return 1; return a.user.full_name.localeCompare(b.user.full_name); });
  }, [users, cache.inbox, unreadByUser, connectedUsers, searchQuery]);

  // ── EARLY RETURN ──
  if (!isAuthed) return null;

  const myId = String(user?.userId || '');

  const selectConversation = (u: UserItem) => {
    setSelectedUser(u); setSearchQuery(''); setMessages(cache.inbox[u.userId] || []); setCurrentPage(0);
    loadConvRef.current(u.userId, 0);
    setUnreadByUser(prev => { const c = prev[u.userId] || 0; setUnreadTotal(t => Math.max(0, t - c)); const n = { ...prev }; delete n[u.userId]; return n; });
  };
  const loadMore = () => { const np = currentPage + 1; if (tab === 'global') loadGlobalRef.current(np); else if (selectedUser) loadConvRef.current(selectedUser.userId, np); };
  const sendMsg = (extra?: Record<string, string | number | boolean | undefined>) => {
    const text = inputText.trim();
    if ((!text && !extra) || !socket || !isConnected || isSending) return;
    setIsSending(true); setError(null);
    const payload: Record<string, unknown> = { extra: { ...extra } };
    if (text) payload.message = text;
    if (replyToMsg) (payload.extra as Record<string, unknown>).replyTo = { messageId: replyToMsg.messageId, message: replyToMsg.message.substring(0, 100), senderName: replyToMsg.sender.full_name };
    const cb = (res: SocketResponse) => { if (res?.success) { setInputText(''); setReplyToMsg(null); if (inputRef.current) inputRef.current.style.height = '44px'; } else setError(res?.message || 'Failed'); setIsSending(false); };
    if (tab === 'global') emit('send_global_message', payload, cb);
    else if (tab === 'inbox' && selectedUser) emit('send_inbox_message', { ...payload, receiverId: selectedUser.userId, receiverName: selectedUser.full_name, receiverEmail: selectedUser.email }, cb);
  };
  const uploadFile = async (file: File) => {
    if (!socket || !isConnected || isSending) return;
    setIsSending(true);
    const buffer = await file.arrayBuffer();
    emit('upload_file', { file: { buffer: Array.from(new Uint8Array(buffer)), mimeType: file.type, name: file.name } }, (res: SocketResponse) => {
      if (res?.success && res.file) sendMsg({ contentType: res.file.contentType, fileUrl: `${API_URL}${res.file.url}`, fileName: res.file.name, fileSize: res.file.size, mimeType: res.file.mimeType });
      else setError('Upload failed');
      setIsSending(false);
    });
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice_message.webm', { type: 'audio/webm' });
        uploadFile(file);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch { setError('Microphone access denied'); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const handleEdit = (msg: ChatMessage) => { setEditingMsg(msg); setEditTextVal(msg.message); setEditModalOpen(true); setContextMenu(null); };
  const submitEdit = () => {
    if (!editTextVal.trim() || !editingMsg) return;
    emit('edit_message', { messageId: editingMsg.messageId, message: editTextVal.trim() }, (res: SocketResponse) => {
      if (res?.success) { setEditModalOpen(false); setEditingMsg(null); setEditTextVal(''); } else setError(res?.message || 'Edit failed');
    });
  };
  const handleDelete = (msg: ChatMessage, forEveryone = true) => {
    emit('delete_message', { messageId: msg.messageId, forEveryone }, (res: SocketResponse) => { if (!res?.success) setError(res?.message || 'Delete failed'); setContextMenu(null); });
  };
  const onGifSelect = (gif: GifResult) => { sendMsg({ contentType: 'gif', gifUrl: gif.url || gif.previewUrl || '', gifTitle: gif.title || '' }); setShowGifPicker(false); };
  const openViewOnce = (msg: ChatMessage) => { setViewOnceMsg(msg); emit('mark_view_once_viewed', { messageId: msg.messageId }, () => {}); };
  const scrollToBottom = () => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  const handleScroll = () => {
    const el = msgContainerRef.current; if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
    if (el.scrollTop < 100 && hasMore && !isLoading) loadMore();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
  const handleTyping = () => {
    if (!socket || !isConnected) return;
    emit(tab === 'global' ? 'global_typing' : 'inbox_typing', { roomType: tab, receiverId: selectedUser?.userId }, () => {});
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emit('stop_typing', { roomType: tab, receiverId: selectedUser?.userId }, () => {}), 2000);
  };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) uploadFile(files[0]); };
  const onDragOverLocal = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (files && files.length > 0) uploadFile(files[0]); e.target.value = ''; };
  const groupByDate = (msgs: ChatMessage[]) => {
    const g: Record<string, ChatMessage[]> = {};
    for (const m of msgs) { const d = new Date(m.createdAt); const key = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); if (!g[key]) g[key] = []; g[key].push(m); }
    return g;
  };
  const openFileUrl = (url: string | undefined) => { if (url) window.open(url, '_blank'); };

  const grouped = groupByDate(messages);
  const ImageContent = ({ msg: imgMsg }: { msg: ChatMessage }) => (
    <div className="mb-1 cursor-pointer" onClick={() => setViewerMsg(imgMsg)}><img src={imgMsg.thumbnailUrl || imgMsg.fileUrl} alt={imgMsg.fileName || ''} className="max-w-full max-h-60 rounded-lg object-cover" />{imgMsg.fileName && <p className="text-[11px] mt-1 opacity-70">{imgMsg.fileName}</p>}</div>
  );
  const VideoContent = ({ msg: vMsg }: { msg: ChatMessage }) => <div className="mb-1 cursor-pointer" onClick={() => setViewerMsg(vMsg)}><video src={vMsg.fileUrl} className="max-w-full max-h-60 rounded-lg" controls /></div>;
  const AudioContent = ({ msg: aMsg }: { msg: ChatMessage }) => <div className="mb-1"><audio src={aMsg.fileUrl} controls className="w-full h-10" /></div>;
  const GifContentLocal = ({ msg: gMsg }: { msg: ChatMessage }) => <div className="mb-1"><img src={gMsg.gifUrl} alt={gMsg.gifTitle || 'GIF'} className="max-w-full max-h-48 rounded-lg" /></div>;
  const StickerContent = ({ msg: sMsg }: { msg: ChatMessage }) => <div className="mb-1"><img src={sMsg.stickerUrl} alt="Sticker" className="max-w-[150px] max-h-[150px]" /></div>;
  const DocumentContent = ({ msg: dMsg }: { msg: ChatMessage }) => (
    <div className="mb-1 flex items-center gap-2 p-2 bg-white/50 rounded-lg cursor-pointer" onClick={() => setViewerMsg(dMsg)}>
      <FiFile className="w-6 h-6 flex-shrink-0" /><div className="min-w-0"><p className="text-xs font-medium truncate">{dMsg.fileName}</p><p className="text-[10px] opacity-60">{formatBytes(dMsg.fileSize || 0)}</p></div>
    </div>
  );

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {isOpen ? <FiX className="w-6 h-6 text-white" /> : <><FiMessageSquare className="w-6 h-6 text-white" />{unreadTotal > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg animate-pulse">{unreadTotal > 9 ? '9+' : unreadTotal}</span>}</>}
      </button>
      {isOpen && (
        <div className={`fixed ${isFullScreen ? 'inset-0 rounded-none' : 'bottom-24 right-6 w-[400px] h-[650px] rounded-2xl'} bg-white shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200 animate-in`}>
          <div className="flex items-center justify-between px-4 py-3 bg-[#075e54] text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><FiMessageSquare className="w-5 h-5" /></div>
              <div><h3 className="font-semibold text-sm">WhatsApp Chat</h3><p className="text-[10px] text-white/70">{isConnected ? `${connectedUsers.length} online` : 'Connecting...'}</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setTab(tab === 'global' ? 'inbox' : 'global')} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors">{tab === 'global' ? <FiUsers className="w-4 h-4" /> : <FiGlobe className="w-4 h-4" />}</button>
              <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors">{isFullScreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}</button>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"><FiX className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex bg-[#f0f0f0] flex-shrink-0">
            <button onClick={() => setTab('global')} className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition-all ${tab === 'global' ? 'text-[#075e54] border-b-2 border-[#075e54] bg-white' : 'text-gray-600 hover:text-gray-800'}`}><FiGlobe className="w-4 h-4" />Global</button>
            <button onClick={() => setTab('inbox')} className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition-all ${tab === 'inbox' ? 'text-[#075e54] border-b-2 border-[#075e54] bg-white' : 'text-gray-600 hover:text-gray-800'}`}><FiUsers className="w-4 h-4" />Inbox{unreadTotal > 0 && tab !== 'inbox' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}</button>
          </div>
          {tab === 'inbox' && !selectedUser ? (
            <div className="flex-1 flex flex-col bg-white min-h-0">
              <div className="p-2.5 bg-white border-b border-gray-200">
                <div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search or start new chat" className="w-full pl-9 pr-3 py-2 text-sm bg-[#f0f2f5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#075e54]/30 placeholder-gray-400" /></div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversationList.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12"><FiUsers className="w-10 h-10 mb-2 opacity-50" /><p className="text-sm font-medium">No chats</p></div> : conversationList.map(conv => (
                  <button key={conv.userId} onClick={() => selectConversation(conv.user)} className="w-full flex items-center gap-3 p-3 hover:bg-[#f0f2f5] transition-colors text-left border-b border-gray-100">
                    <Avatar name={conv.user.full_name} showOnline online={connectedUsers.includes(conv.userId)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-900 truncate">{conv.user.full_name}</p>{conv.lastMessage && <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">{fmtConvTime(conv.lastMessage.createdAt)}</span>}</div>
                      <div className="flex items-center justify-between mt-0.5"><p className="text-xs text-gray-500 truncate">{conv.lastMessage ? conv.lastMessage.message : 'Click to start chatting'}</p>{conv.unreadCount > 0 && <span className="flex-shrink-0 ml-2 min-w-[18px] h-[18px] bg-[#25d366] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</span>}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 bg-[#f0f2f5] border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                {tab === 'inbox' && selectedUser && <button onClick={() => { setSelectedUser(null); setMessages([]); }} className="text-[#075e54] p-1 -ml-1"><FiChevronLeft className="w-5 h-5" /></button>}
                {tab === 'inbox' && selectedUser ? <><Avatar name={selectedUser.full_name} size="sm" showOnline online={connectedUsers.includes(selectedUser.userId)} /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{selectedUser.full_name}</p><p className="text-[10px] text-gray-500">{connectedUsers.includes(selectedUser.userId) ? <span className="text-green-600 font-medium">Online</span> : 'Offline'}</p></div></> : <div className="flex items-center gap-2"><FiGlobe className="w-5 h-5 text-[#075e54]" /><span className="text-sm font-medium">Global Chat</span><span className="text-[10px] bg-[#075e54]/10 text-[#075e54] px-2 py-0.5 rounded-full">Public</span></div>}
              </div>
              <div ref={msgContainerRef} onScroll={handleScroll} onDrop={onDrop} onDragOver={onDragOverLocal} onDragLeave={onDragLeave} className="flex-1 overflow-y-auto px-4 py-3 bg-[#efeae2] relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d1d7db\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
                {dragOver && <div className="absolute inset-0 bg-[#075e54]/10 border-2 border-dashed border-[#075e54] rounded-lg flex items-center justify-center z-10"><div className="bg-white px-6 py-4 rounded-xl shadow-lg"><FiPaperclip className="w-8 h-8 text-[#075e54] mx-auto mb-2" /><p className="text-sm font-medium">Drop files here</p></div></div>}
                {isLoading && messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full"><div className="flex gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /><span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}} /></div><p className="text-xs text-gray-400 mt-2">Loading messages...</p></div> : messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-gray-400"><FiMessageCircle className="w-10 h-10 mb-2 opacity-40" /><p className="text-sm font-medium">No messages yet</p></div> : (
                  <>{hasMore && <div ref={loadMoreRef} className="flex justify-center py-2"><button onClick={loadMore} disabled={isLoading} className="px-4 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors disabled:opacity-50">{isLoading ? 'Loading...' : 'Load older messages'}</button></div>}
                    {Object.entries(grouped).map(([date, msgs]) => (
                      <div key={date}>
                        <div className="flex justify-center my-3"><span className="px-3 py-1 bg-gray-200/80 text-[10px] text-gray-500 font-medium rounded-full">{date}</span></div>
                        {msgs.map((msg: ChatMessage) => {
                          const isOwn = msg.sender.userId === myId;
                          const readStatus = getReadStatus(msg, myId);
                          const isDeleted = msg.isDeleted;
                          const hasReply = msg.replyTo?.messageId;
                          return (
                            <div key={msg.messageId} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group`} onContextMenu={e => { e.preventDefault(); setContextMenu({ msg, x: e.clientX, y: e.clientY }); }}>
                              {!isOwn && <Avatar name={msg.sender.full_name} size="sm" />}
                              <div className={`max-w-[80%] ${isOwn ? 'ml-2' : 'mr-2'}`}>
                                {!isOwn && <p className="text-[10px] font-medium text-gray-500 mb-0.5 ml-1">{msg.sender.full_name}</p>}
                                {hasReply && <div className={`flex items-center gap-1.5 px-3 py-1.5 ${isOwn ? 'bg-blue-500/30' : 'bg-gray-100'} rounded-t-xl text-lg-[11px] ${isOwn ? 'text-blue-100' : 'text-gray-600'} mb-0.5`}><FiReplyIcon /><div className="truncate"><span className="font-medium">{msg.replyTo!.senderName}: </span>{msg.replyTo!.message}</div></div>}
                                {isDeleted ? <div className="rounded-2xl px-4 py-2 bg-gray-100 text-gray-400 italic text-xs">Message deleted</div> : (
                                  <div className={`rounded-2xl px-3.5 py-2 shadow-sm ${isOwn ? 'bg-[#d9fdd3] text-gray-900 rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}>
                                    {msg.contentType === 'image' && <ImageContent msg={msg} />}
                                    {msg.contentType === 'video' && <VideoContent msg={msg} />}
                                    {msg.contentType === 'audio' && <AudioContent msg={msg} />}
                                    {msg.contentType === 'gif' && <GifContentLocal msg={msg} />}
                                    {msg.contentType === 'sticker' && <StickerContent msg={msg} />}
                                    {msg.contentType === 'document' && <DocumentContent msg={msg} />}
                                    {msg.contentType === 'view_once' && (
                                      <div className="mb-1"><button onClick={() => openViewOnce(msg)} disabled={isOwn} className="flex items-center gap-2 px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"><FiEyeOff className="w-4 h-4" /><span className="text-sm">{isOwn ? 'You sent a view-once message' : 'View once photo'}</span></button></div>
                                    )}
                                    {(msg.contentType === 'text' || !msg.contentType) && msg.message && <div className="text-sm leading-relaxed whitespace-pre-wrap break-words [&_*]:!text-inherit [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"><MarkdownMsg content={msg.message} /></div>}
                                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                      {msg.isForwarded && <span className="text-[9px] opacity-50">Forwarded</span>}
                                      <span className={`text-[10px] ${isOwn ? 'text-gray-500' : 'text-gray-400'}`}>{fmtTime(msg.createdAt)}</span>
                                      {msg.isEdited && <span className="text-[10px] opacity-60">edited</span>}
                                      {isOwn && <span className="text-[11px] ml-0.5">{readStatus === 'read' ? <FiCheckCircle className="w-3 h-3 text-blue-500" /> : readStatus === 'delivered' ? <FiCheck className="w-3 h-3 text-blue-400" /> : <FiClock className="w-3 h-3" />}</span>}
                                    </div>
                                  </div>
                                )}
                                {!isDeleted && <div className={`flex gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <button onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }} className="text-gray-400 hover:text-blue-500 p-0.5 transition-colors"><FiReplyIcon /></button>
                                  {isOwn && <button onClick={() => handleEdit(msg)} className="text-gray-400 hover:text-blue-500 p-0.5 transition-colors"><FiEdit2 className="w-3 h-3" /></button>}
                                  {isOwn && <button onClick={() => handleDelete(msg)} className="text-gray-400 hover:text-red-500 p-0.5 transition-colors"><FiTrash2 className="w-3 h-3" /></button>}
                                  <button onClick={() => setContextMenu({ msg, x: 0, y: 0 })} className="text-gray-400 hover:text-gray-600 p-0.5 transition-colors"><FiMoreHorizontal className="w-3 h-3" /></button>
                                </div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={msgEndRef} />
                  </>
                )}
                {showScrollBtn && !dragOver && <button id="scroll-btn" onClick={scrollToBottom} className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-lg text-xs text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all flex items-center gap-1.5"><FiChevronDown className="w-3.5 h-3.5" />New messages</button>}
              </div>
              {replyToMsg && <div className="px-3 py-1.5 bg-[#f0f2f5] border-t border-gray-200 flex items-center gap-2 text-sm"><div className="w-0.5 h-8 bg-[#075e54] rounded" /><div className="flex-1 min-w-0"><p className="text-xs font-medium text-[#075e54]">Replying to {replyToMsg.sender.full_name}</p><p className="text-[11px] text-gray-500 truncate">{replyToMsg.message}</p></div><button onClick={() => setReplyToMsg(null)} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button></div>}
              {error && <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 flex items-center gap-2"><FiAlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-[11px] text-red-600 flex-1">{error}</p><button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600"><FiX className="w-3.5 h-3.5" /></button></div>}
              <div className="px-3 py-2 bg-[#f0f2f5] flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <button onClick={() => setShowGifPicker(!showGifPicker)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-800 flex-shrink-0"><span className="text-sm font-bold">GIF</span></button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-800 flex-shrink-0"><FiPlusIcon /></button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
                  <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all ${isRecording ? 'bg-red-500 text-white scale-110 animate-pulse' : 'text-gray-600 hover:text-gray-800'}`}>{isRecording ? <FiSquare className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}</button>
                  <textarea ref={inputRef} value={inputText} onChange={e => { setInputText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; handleTyping(); }} onKeyDown={handleKeyDown} placeholder="Type a message" disabled={isSending || (tab === 'inbox' && !selectedUser)} rows={1} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-2xl focus:outline-none focus:border-[#075e54] focus:ring-2 focus:ring-[#075e54]/20 text-sm resize-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed" style={{ minHeight: '44px', maxHeight: '120px' }} />
                  <button onClick={() => sendMsg()} disabled={!inputText.trim() || isSending || (tab === 'inbox' && !selectedUser)} className="w-[44px] h-[44px] bg-[#075e54] hover:bg-[#064e45] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0">{isSending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSend className="w-5 h-5 text-white" />}</button>
                </div>
              </div>
            </div>
          )}
          {showGifPicker && <div className="absolute bottom-16 right-4 z-50 shadow-2xl rounded-xl overflow-hidden"><button onClick={() => setShowGifPicker(false)} className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-1"><FiX className="w-4 h-4 text-white" /></button><GifPicker tenorApiKey={import.meta.env.VITE_TENOR_API_KEY || 'YOUR_TENOR_API_KEY'} onGifClick={onGifSelect} width={350} /></div>}
        </div>
      )}
      {editModalOpen && <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center" onClick={() => setEditModalOpen(false)}><div className="bg-white rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}><h3 className="text-lg font-semibold mb-3">Edit Message</h3><textarea value={editTextVal} onChange={e => setEditTextVal(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-[#075e54] text-sm resize-none" /><div className="flex gap-2 justify-end mt-3"><button onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button><button onClick={submitEdit} className="px-4 py-2 text-sm bg-[#075e54] text-white rounded-lg hover:bg-[#064e45]">Save</button></div></div></div>}
      {contextMenu && <div className="fixed z-[150] bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button onClick={() => { setReplyToMsg(contextMenu.msg); inputRef.current?.focus(); setContextMenu(null); }} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"><FiReplyIconMd />Reply</button>
        {contextMenu.msg.sender.userId === myId && <><button onClick={() => handleEdit(contextMenu.msg)} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"><FiEdit2 className="w-4 h-4" />Edit</button><button onClick={() => handleDelete(contextMenu.msg, true)} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"><FiTrash2 className="w-4 h-4" />Delete for everyone</button><button onClick={() => handleDelete(contextMenu.msg, false)} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"><FiX className="w-4 h-4" />Delete for me</button></>}
        <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.message).then(() => setContextMenu(null)).catch(() => {}); }} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"><FiFile className="w-4 h-4" />Copy</button>
        <button onClick={() => { openFileUrl(contextMenu.msg.fileUrl); setContextMenu(null); }} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"><FiDownload className="w-4 h-4" />Download</button>
      </div>}
      {viewerMsg && <FileViewer msg={viewerMsg} onClose={() => setViewerMsg(null)} />}
      {viewOnceMsg && <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={() => setViewOnceMsg(null)}><div className="relative" onClick={e => e.stopPropagation()}><button onClick={() => setViewOnceMsg(null)} className="absolute -top-10 right-0 text-white"><FiX className="w-6 h-6" /></button><p className="text-white text-center mb-4">View once media - will auto-delete</p>{viewOnceMsg.mimeType?.startsWith('image/') && <img src={viewOnceMsg.fileUrl} className="max-w-[80vw] max-h-[70vh] rounded-lg" />}{viewOnceMsg.mimeType?.startsWith('video/') && <video src={viewOnceMsg.fileUrl} controls autoPlay className="max-w-[80vw] max-h-[70vh] rounded-lg" />}{viewOnceMsg.mimeType?.startsWith('audio/') && <audio src={viewOnceMsg.fileUrl} controls autoPlay className="w-80" />}<p className="text-gray-400 text-xs text-center mt-4">This message has been viewed and will be deleted</p></div></div>}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.animate-in{animation:slideIn .3s ease-out}.overflow-y-auto::-webkit-scrollbar{width:4px}.overflow-y-auto::-webkit-scrollbar-track{background:transparent}.overflow-y-auto::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:2px}.overflow-y-auto::-webkit-scrollbar-thumb:hover{background:#a1a1a1}`}</style>
    </>
  );
};

export default ChatWidget;