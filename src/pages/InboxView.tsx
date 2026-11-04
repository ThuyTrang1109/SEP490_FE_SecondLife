import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Listing, Language, UserRole, UserProfile, Negotiation } from '../types';
import {
  MessageSquare,
  Clock,
  ChevronRight,
  Loader2,
  Tag,
  Check,
  X,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import {
  chatService,
  ChatRoomDto,
  parseSystemMessage,
  getStoredUser,
  negotiationService
} from '../services';
import { formatVND } from '../utils/translations';
import { DedicatedChatRoom } from '../components/chat/DedicatedChatRoom';
import { buildChatProductListing, getChatPostStatusBadge } from '../utils/chatProduct';

interface InboxViewProps {
  listings: Listing[];
  currentRole: UserRole;
  lang: Language;
  currentUser?: UserProfile | null;
  initialListing?: Listing | null;
  initialRoomId?: string;
  initialPartnerName?: string;
  initialPartnerAvatar?: string;
  initialRoom?: ChatRoomDto;
  onBuyClick?: (listing: Listing, agreedPrice?: number, negotiationId?: string) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
  onOpenChat?: (
    listing: Listing,
    roomId?: string,
    partnerName?: string,
    partnerAvatar?: string,
    room?: ChatRoomDto
  ) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  listings,
  currentRole,
  lang,
  currentUser,
  initialListing,
  initialRoomId,
  initialRoom,
  onBuyClick,
  onOpenSellerReviews,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'negotiations'>('chats');
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId || initialRoom?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  // Negotiations state
  const [negotiationTab, setNegotiationTab] = useState<'seller' | 'buyer'>('seller');
  const [sellerNegotiations, setSellerNegotiations] = useState<Negotiation[]>([]);
  const [buyerNegotiations, setBuyerNegotiations] = useState<Negotiation[]>([]);
  const [loadingNegotiations, setLoadingNegotiations] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Splitter resizable pane state
  const splitContainerRef = useRef<HTMLDivElement>(null);
  // Track external navigation to prevent re-forcing selected room when rooms or background polling updates
  const appliedNavKeyRef = useRef<string | null>(null);
  const userManuallySelectedRef = useRef<boolean>(false);
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('inbox_splitter_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 600) return parsed;
      }
    } catch { }
    return 360;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const minW = 260;
      const maxW = Math.min(600, rect.width * 0.55);
      const clamped = Math.max(minW, Math.min(maxW, newWidth));
      setLeftWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      try {
        localStorage.setItem('inbox_splitter_width', leftWidth.toString());
      } catch { }
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter, leftWidth]);

  const handleResetSplitterWidth = () => {
    setLeftWidth(360);
    try {
      localStorage.setItem('inbox_splitter_width', '360');
    } catch { }
  };

  const activeUserId = currentUser?.id ? String(currentUser.id) : '';

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  const isNameOfMe = useCallback((name?: string) => {
    const activeUser = currentUser || getStoredUser();
    if (!name || !activeUser) return false;
    const n = name.trim().toLowerCase();
    const myName = (activeUser.fullName || activeUser.name || '').trim().toLowerCase();
    const myEmail = (activeUser.email || '').trim().toLowerCase();
    return (myName && n === myName) || (myEmail && n === myEmail);
  }, [currentUser]);

  // Helper to determine role and partner information per room based on IDs
  const getRoomPartnerInfo = useCallback(
    (room: ChatRoomDto) => {
      const activeUser = currentUser || getStoredUser();
      const currentUserId = activeUser?.id ? String(activeUser.id) : null;
      const isMeSeller = Boolean(currentUserId && room.sellerId && currentUserId === String(room.sellerId));
      const isMeBuyer = Boolean(currentUserId && room.buyerId && currentUserId === String(room.buyerId));

      let isRoomSeller = false;
      if (isMeSeller) {
        isRoomSeller = true;
      } else if (isMeBuyer) {
        isRoomSeller = false;
      } else {
        const foundListing = listings?.find((l) => l.id === room.postId);
        if (foundListing?.sellerId && currentUserId && String(foundListing.sellerId) === currentUserId) {
          isRoomSeller = true;
        }
      }

      let partnerName: string;
      let partnerAvatar: string;
      let roleLabel: string;

      if (isRoomSeller) {
        roleLabel = lang === 'vi' ? 'Đối tác: Người mua' : 'Partner: Buyer';
        partnerName =
          (!isNameOfMe(room.buyerName) && room.buyerName) ||
          (lang === 'vi' ? 'Khách Hàng' : 'Customer');
        partnerAvatar =
          room.buyerAvatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
      } else {
        roleLabel = lang === 'vi' ? 'Đối tác: Người bán' : 'Partner: Seller';
        partnerName =
          (!isNameOfMe(room.sellerName) && room.sellerName) ||
          (lang === 'vi' ? 'Người Bán' : 'Seller');
        partnerAvatar =
          room.sellerAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
      }

      return { isRoomSeller, partnerName, partnerAvatar, roleLabel };
    },
    [currentUser, listings, lang, isNameOfMe]
  );

  // Unread status checker for rooms
  const isRoomUnread = useCallback(
    (room: ChatRoomDto): boolean => {
      if (!activeUserId) return false;
      const readTime = Number(localStorage.getItem(`chat_room_last_read_${room.id}_${activeUserId}`) || 0);
      const touchTime = Number(localStorage.getItem(`chat_room_latest_touch_${room.id}`) || 0);
      const serverTime = room.updatedAt ? new Date(room.updatedAt).getTime() : 0;
      const latestActivity = Math.max(touchTime, serverTime);

      // If last message was sent by me, do not mark as unread for me
      const lastSenderId = localStorage.getItem(`chat_room_latest_sender_${room.id}`);
      if (lastSenderId && lastSenderId.toLowerCase() === activeUserId.toLowerCase()) {
        return false;
      }

      return latestActivity > readTime;
    },
    [activeUserId]
  );

  // Effective timestamp for sorting
  const getRoomEffectiveTimestamp = (room: ChatRoomDto): number => {
    const localTouch = localStorage.getItem(`chat_room_latest_touch_${room.id}`);
    const localTime = localTouch ? Number(localTouch) : 0;
    const serverTime = room.updatedAt ? new Date(room.updatedAt).getTime() : 0;
    return Math.max(localTime, serverTime);
  };

  // Fetch chat rooms
  const loadChatRooms = useCallback(async () => {
    try {
      const serverRooms = await chatService.getChatRooms();
      const uniqueRooms: ChatRoomDto[] = [];
      const seenIds = new Set<string>();

      for (const r of serverRooms) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          const mergedRoom = { ...r };
          const localMsg = localStorage.getItem(`chat_room_latest_msg_${r.id}`);
          const localTouch = localStorage.getItem(`chat_room_latest_touch_${r.id}`);
          if (localMsg && localTouch) {
            const touchTime = Number(localTouch);
            const serverTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
            if (touchTime > serverTime) {
              mergedRoom.lastMessage = localMsg;
              mergedRoom.updatedAt = new Date(touchTime).toISOString();
            }
          }
          uniqueRooms.push(mergedRoom);
        }
      }

      uniqueRooms.sort((a, b) => getRoomEffectiveTimestamp(b) - getRoomEffectiveTimestamp(a));
      setRooms(uniqueRooms);
    } catch (err) {
      console.warn('Failed to load chat rooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch negotiations
  const loadNegotiations = useCallback(async () => {
    setLoadingNegotiations(true);
    try {
      const [sellerRes, buyerRes] = await Promise.allSettled([
        negotiationService.getSellerNegotiations(0, 50),
        negotiationService.getBuyerNegotiations(0, 50),
      ]);
      if (sellerRes.status === 'fulfilled') {
        setSellerNegotiations(sellerRes.value.content || []);
      }
      if (buyerRes.status === 'fulfilled') {
        setBuyerNegotiations(buyerRes.value.content || []);
      }
    } catch (err) {
      console.warn('Failed to load negotiations:', err);
    } finally {
      setLoadingNegotiations(false);
    }
  }, []);

  // Initial loading & background polling
  useEffect(() => {
    loadChatRooms();
    loadNegotiations();

    chatService.connectWebSocket();
    const unsubscribe = chatService.subscribeToMessages((msg) => {
      if (msg?.conversationId) {
        localStorage.setItem(`chat_room_latest_touch_${msg.conversationId}`, Date.now().toString());
        localStorage.setItem(`chat_room_latest_msg_${msg.conversationId}`, msg.messageContent);
        if (msg.senderId) {
          localStorage.setItem(`chat_room_latest_sender_${msg.conversationId}`, msg.senderId);
        }
      }
      loadChatRooms();
    });

    const intervalId = setInterval(() => {
      loadChatRooms();
    }, 12000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [loadChatRooms, loadNegotiations]);

  // Handle external navigation with initialListing or initialRoomId
  useEffect(() => {
    const targetNavKey = initialRoomId
      ? `room_${initialRoomId}`
      : initialListing?.id
      ? `post_${initialListing.id}`
      : null;

    if (!targetNavKey) return;

    // If user has already clicked a room manually and incoming navigation has not changed, do not override
    if (userManuallySelectedRef.current && appliedNavKeyRef.current === targetNavKey) {
      return;
    }

    // If this exact navigation target was already applied, do not re-apply when rooms update
    if (appliedNavKeyRef.current === targetNavKey) {
      return;
    }

    if (initialRoomId) {
      setSelectedRoomId(initialRoomId);
      appliedNavKeyRef.current = targetNavKey;
    } else if (initialListing) {
      const existing = rooms.find((r) => r.postId === initialListing.id);
      if (existing) {
        setSelectedRoomId(existing.id);
        appliedNavKeyRef.current = targetNavKey;
      } else if (!loading) {
        chatService.getOrCreateRoom(initialListing.id)
          .then((newRoom) => {
            if (newRoom?.id) {
              setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
              setSelectedRoomId(newRoom.id);
              appliedNavKeyRef.current = targetNavKey;
            }
          })
          .catch((err) => {
            console.warn('Failed to get or create room for listing:', err);
          });
      }
    }
  }, [initialRoomId, initialListing, rooms, loading]);

  const handleSelectRoom = (room: ChatRoomDto) => {
    userManuallySelectedRef.current = true;
    setSelectedRoomId(room.id);
    if (activeUserId) {
      localStorage.setItem(`chat_room_last_read_${room.id}_${activeUserId}`, Date.now().toString());
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    const found = rooms.find((r) => r.id === selectedRoomId);
    if (found) return found;
    if (initialRoom && initialRoom.id === selectedRoomId) return initialRoom;
    return null;
  }, [selectedRoomId, rooms, initialRoom]);

  const selectedListing = useMemo((): Listing | null => {
    if (!selectedRoom) return initialListing || null;

    const matchedInitial = initialListing && initialListing.id === selectedRoom.postId && (initialListing.priceVnd || 0) > 0
      ? initialListing
      : undefined;
    const matchedFromListings = listings?.find((l) => l.id === selectedRoom.postId && (l.priceVnd || 0) > 0);
    const existing = matchedFromListings || matchedInitial;

    return buildChatProductListing(selectedRoom, existing) as unknown as Listing;
  }, [selectedRoom, listings, initialListing]);

  // Format preview message
  const formatLastMessage = (rawText?: string) => {
    if (!rawText) return lang === 'vi' ? 'Bắt đầu cuộc trò chuyện...' : 'Start conversation...';
    const parsed = parseSystemMessage(rawText);
    if (parsed.isSystem) {
      if (parsed.offer) {
        const off = parsed.offer;
        if (off.status === 'ACCEPTED') {
          return `🎉 ${lang === 'vi' ? 'Đã chốt giá:' : 'Agreed price:'} ${formatVND(off.price)}`;
        }
        if (off.status === 'REJECTED') {
          return `❌ ${lang === 'vi' ? 'Từ chối giá:' : 'Rejected:'} ${formatVND(off.price)}`;
        }
        if (off.status === 'CANCELLED') {
          return `[${lang === 'vi' ? 'Đã hủy trả giá' : 'Cancelled offer'}]`;
        }
        return `🤝 ${lang === 'vi' ? 'Đề xuất giá mới:' : 'New offer:'} ${formatVND(off.price)}`;
      }
      return `[Hệ thống] ${parsed.cleanText}`;
    }
    return rawText;
  };

  // Filtered rooms
  const unreadCount = useMemo(() => {
    return rooms.filter(isRoomUnread).length;
  }, [rooms, isRoomUnread]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // 1. Filter by unread mode
      if (filterMode === 'unread' && !isRoomUnread(r)) {
        return false;
      }
      // 2. Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const { partnerName } = getRoomPartnerInfo(r);
        const matchTitle = (r.postTitle || '').toLowerCase().includes(q);
        const matchPartner = partnerName.toLowerCase().includes(q);
        const matchLastMsg = (r.lastMessage || '').toLowerCase().includes(q);
        return matchTitle || matchPartner || matchLastMsg;
      }
      return true;
    });
  }, [rooms, filterMode, searchQuery, isRoomUnread, getRoomPartnerInfo]);

  // Negotiation Actions
  const handleAcceptNegotiation = async (id: string) => {
    setActionInProgressId(id);
    try {
      const updated = await negotiationService.acceptNegotiation(id);
      setSellerNegotiations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated?.status || 'ACCEPTED' } : item))
      );
      showNotice(lang === 'vi' ? 'Đã chấp nhận đề xuất trả giá thành công.' : 'Accepted negotiation successfully.');
    } catch {
      showNotice(lang === 'vi' ? 'Lỗi khi chấp nhận đề xuất.' : 'Error accepting negotiation.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRejectNegotiation = async (id: string) => {
    setActionInProgressId(id);
    try {
      const updated = await negotiationService.rejectNegotiation(id);
      setSellerNegotiations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated?.status || 'REJECTED' } : item))
      );
      showNotice(lang === 'vi' ? 'Đã từ chối đề xuất trả giá.' : 'Rejected negotiation.');
    } catch {
      showNotice(lang === 'vi' ? 'Lỗi khi từ chối đề xuất.' : 'Error rejecting negotiation.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCancelNegotiation = async (id: string) => {
    setActionInProgressId(id);
    try {
      const updated = await negotiationService.cancelNegotiation(id);
      setBuyerNegotiations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated?.status || 'CANCELLED' } : item))
      );
      showNotice(lang === 'vi' ? 'Đã hủy đề xuất thương lượng.' : 'Cancelled negotiation.');
    } catch {
      showNotice(lang === 'vi' ? 'Lỗi khi hủy đề xuất.' : 'Error cancelling negotiation.');
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden">
      {noticeMessage && (
        <div className="mb-3 p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-lg animate-fadeIn flex items-center justify-between">
          <span>{noticeMessage}</span>
          <button onClick={() => setNoticeMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DEDICATED FULL-PAGE MESSENGER CHAT CONTAINER WITH SPLITTER */}
      <div
        ref={splitContainerRef}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 h-full min-h-0 flex flex-col md:flex-row relative"
      >

        {/* LEFT COLUMN: CONVERSATION LIST (Hidden on mobile if a room is active) */}
        <div
          style={{ width: isDesktop ? `${leftWidth}px` : '100%' }}
          className={`w-full md:shrink-0 flex flex-col h-full min-h-0 bg-[#faf8f5] ${selectedRoom ? 'hidden md:flex' : 'flex'
            }`}
        >
          {/* Header of Conversation List */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-[#24263e] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#c34c36]" />
                <span>{lang === 'vi' ? 'Đoạn chat & Đàm phán' : 'Chats & Negotiations'}</span>
              </h2>

              {/* View Switcher: Chats vs Negotiations */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('chats')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${activeTab === 'chats' ? 'bg-white text-[#24263e] shadow-2xs' : 'text-slate-500 hover:text-black'
                    }`}
                >
                  {lang === 'vi' ? 'Chat' : 'Chats'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('negotiations')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${activeTab === 'negotiations' ? 'bg-white text-[#24263e] shadow-2xs' : 'text-slate-500 hover:text-black'
                    }`}
                >
                  {lang === 'vi' ? 'Mặc cả' : 'Offers'}
                </button>
              </div>
            </div>

            {activeTab === 'chats' && (
              <>
                {/* Search Box */}
                <div className="relative mb-2.5">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'vi' ? 'Tìm kiếm cuộc trò chuyện...' : 'Search conversations...'}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36] focus:bg-white transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs: All vs Unread (Messenger Style) */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${filterMode === 'all'
                        ? 'bg-[#24263e] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {lang === 'vi' ? 'Tất cả' : 'All'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('unread')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${filterMode === 'unread'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    <span>{lang === 'vi' ? 'Chưa đọc' : 'Unread'}</span>
                    {unreadCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${filterMode === 'unread' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                        }`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ROOMS LIST */}
          {activeTab === 'chats' ? (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#c34c36] animate-spin" />
                  <p className="text-xs font-semibold text-slate-400">
                    {lang === 'vi' ? 'Đang tải hộp thư...' : 'Loading chats...'}
                  </p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">
                    {filterMode === 'unread'
                      ? (lang === 'vi' ? 'Không có tin nhắn chưa đọc nào' : 'No unread messages')
                      : (lang === 'vi' ? 'Không tìm thấy cuộc trò chuyện nào' : 'No conversations found')}
                  </p>
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const { partnerName, partnerAvatar, roleLabel, isRoomSeller } = getRoomPartnerInfo(room);
                  const isSelected = selectedRoomId === room.id;
                  const unread = isRoomUnread(room);
                  const timeStr = room.updatedAt
                    ? new Date(room.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={room.id}
                      onClick={() => handleSelectRoom(room)}
                      className={`p-3.5 transition cursor-pointer flex items-center gap-3 relative ${isSelected
                          ? 'bg-white md:border-l-4 md:border-l-[#c34c36] shadow-2xs'
                          : unread
                            ? 'bg-blue-50/40 hover:bg-blue-50/60'
                            : 'hover:bg-slate-100/60'
                        }`}
                    >
                      {/* Avatar with Online Dot */}
                      <div className="relative shrink-0">
                        <img
                          src={partnerAvatar}
                          alt={partnerName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                      </div>

                      {/* Content info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-xs truncate ${unread ? 'font-black text-[#24263e]' : 'font-bold text-slate-800'}`}>
                            {partnerName}
                          </span>
                          {timeStr && (
                            <span className={`text-[10px] shrink-0 ${unread ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}`}>
                              {timeStr}
                            </span>
                          )}
                        </div>

                        {/* Partner role & listing title & status */}
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${isRoomSeller
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                            {roleLabel}
                          </span>
                          {room.postStatus && (() => {
                            const badge = getChatPostStatusBadge(room.postStatus, lang);
                            return badge ? (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-[11px] text-slate-500 truncate" title={room.postTitle || undefined}>
                            • {room.postTitle || 'Sản phẩm'}
                          </span>
                        </div>

                        {/* Last message preview */}
                        <p className={`text-xs truncate ${unread ? 'font-bold text-slate-900' : 'text-slate-500 font-normal'}`}>
                          {formatLastMessage(room.lastMessage)}
                        </p>
                      </div>

                      {/* Messenger Unread Blue Dot Badge */}
                      {unread && (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 shadow-xs" title="Tin nhắn chưa đọc" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* NEGOTIATIONS LIST SUB-VIEW */
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setNegotiationTab('seller')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${negotiationTab === 'seller' ? 'bg-[#24263e] text-white shadow-xs' : 'bg-white border text-slate-600'
                    }`}
                >
                  Khách mặc cả ({sellerNegotiations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNegotiationTab('buyer')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${negotiationTab === 'buyer' ? 'bg-[#24263e] text-white shadow-xs' : 'bg-white border text-slate-600'
                    }`}
                >
                  Tôi mặc cả ({buyerNegotiations.length})
                </button>
              </div>

              {(negotiationTab === 'seller' ? sellerNegotiations : buyerNegotiations).map((neg) => {
                const foundListing = listings?.find((l) => l.id === neg.postId);
                const isActionLoading = actionInProgressId === neg.id;

                return (
                  <div key={neg.id} className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#24263e] truncate max-w-[180px]">
                        {foundListing?.title || neg.postTitle || 'Sản phẩm'}
                      </span>
                      <span className="text-xs font-black text-[#c34c36]">
                        {formatVND(neg.offeredPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Trạng thái: <strong>{neg.status}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          const matched = rooms.find((r) => r.postId === neg.postId);
                          if (matched) {
                            userManuallySelectedRef.current = true;
                            setSelectedRoomId(matched.id);
                            setActiveTab('chats');
                          }
                        }}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Vào chat
                      </button>
                    </div>

                    {/* Quick actions for PENDING */}
                    {neg.status === 'PENDING' && negotiationTab === 'seller' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleAcceptNegotiation(neg.id)}
                          disabled={isActionLoading}
                          className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectNegotiation(neg.id)}
                          disabled={isActionLoading}
                          className="flex-1 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}

                    {neg.status === 'PENDING' && negotiationTab === 'buyer' && (
                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleCancelNegotiation(neg.id)}
                          disabled={isActionLoading}
                          className="w-full py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold"
                        >
                          Hủy yêu cầu
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RESIZABLE SPLITTER BAR (DESKTOP) */}
        <div
          onMouseDown={handleSplitterMouseDown}
          onDoubleClick={handleResetSplitterWidth}
          className={`hidden md:flex w-2 shrink-0 cursor-col-resize select-none relative z-10 items-center justify-center transition-colors group ${isDraggingSplitter ? 'bg-[#c34c36]' : 'bg-slate-200 hover:bg-[#c34c36]/70'
            }`}
          title={lang === 'vi' ? 'Kéo để đổi độ rộng (Nhấp đúp để đặt lại)' : 'Drag to resize (Double-click to reset)'}
        >
          {/* Subtle grab handle indicator */}
          <div className="flex flex-col gap-1 items-center justify-center py-2 pointer-events-none">
            <div className={`w-0.5 h-1.5 rounded-full ${isDraggingSplitter ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-0.5 h-1.5 rounded-full ${isDraggingSplitter ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-0.5 h-1.5 rounded-full ${isDraggingSplitter ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-0.5 h-1.5 rounded-full ${isDraggingSplitter ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
          </div>
        </div>

        {/* RIGHT COLUMN: DEDICATED CHAT ROOM & ORDER BANNER */}
        <div className={`flex-1 flex flex-col h-full min-h-0 min-w-0 bg-white overflow-hidden ${!selectedRoom ? 'hidden md:flex' : 'flex'
          }`}>
          {selectedRoom && selectedListing ? (
            <DedicatedChatRoom
              key={selectedRoom.id}
              room={selectedRoom}
              listing={selectedListing}
              currentUser={currentUser}
              currentRole={currentRole}
              lang={lang}
              onBack={() => setSelectedRoomId(null)}
              onBuyClick={onBuyClick}
              onOpenSellerReviews={onOpenSellerReviews}
              onRoomActivity={loadChatRooms}
            />
          ) : (
            /* EMPTY PLACEHOLDER WHEN NO CONVERSATION IS SELECTED */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-[#fbfbfa]">
              <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-xs text-slate-300 mb-3">
                <MessageSquare className="w-8 h-8 text-[#c34c36]" />
              </div>
              <h3 className="text-base font-bold text-[#24263e] mb-1">
                {lang === 'vi' ? 'Chọn một cuộc trò chuyện để bắt đầu' : 'Select a conversation to start chatting'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {lang === 'vi'
                  ? 'Trang chat riêng hỗ trợ trao đổi tin nhắn trực tiếp, đàm phán giá và bảo lãnh giao dịch an toàn 100% qua Quỹ tín thác Escrow của SecondLife Hub.'
                  : 'Direct private chat supporting negotiations, inspection proposals and 100% Escrow safe transactions.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
