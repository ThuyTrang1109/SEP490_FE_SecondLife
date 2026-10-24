import React, { useState, useEffect, useCallback } from 'react';
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
  AlertCircle
} from 'lucide-react';
import {
  chatService,
  ChatRoomDto,
  parseSystemMessage,
  getStoredUser,
  negotiationService
} from '../services';
import { formatVND } from '../utils/translations';

interface InboxViewProps {
  listings: Listing[];
  currentRole: UserRole;
  lang: Language;
  onOpenChat: (
    listing: Listing,
    roomId?: string,
    partnerName?: string,
    partnerAvatar?: string,
    room?: ChatRoomDto
  ) => void;
  currentUser?: UserProfile | null;
}

export const InboxView: React.FC<InboxViewProps> = ({
  listings,
  currentRole,
  lang,
  onOpenChat,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'negotiations'>('chats');
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Negotiations state
  const [negotiationTab, setNegotiationTab] = useState<'seller' | 'buyer'>('seller');
  const [sellerNegotiations, setSellerNegotiations] = useState<Negotiation[]>([]);
  const [buyerNegotiations, setBuyerNegotiations] = useState<Negotiation[]>([]);
  const [loadingNegotiations, setLoadingNegotiations] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

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
        roleLabel = lang === 'vi' ? 'Người Mua' : 'Buyer';
        partnerName =
          (!isNameOfMe(room.buyerName) && room.buyerName) ||
          (lang === 'vi' ? 'Khách Hàng' : 'Customer');
        partnerAvatar =
          room.buyerAvatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
      } else {
        roleLabel = lang === 'vi' ? 'Người Bán' : 'Seller';
        partnerName =
          (!isNameOfMe(room.sellerName) && room.sellerName) ||
          (lang === 'vi' ? 'Người Bán' : 'Seller');
        partnerAvatar =
          room.sellerAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
      }

      return { isRoomSeller, partnerName, partnerAvatar, roleLabel };
    },
    [currentUser, listings, lang]
  );

  // Helper to calculate effective timestamp for room sorting
  const getRoomEffectiveTimestamp = (room: ChatRoomDto): number => {
    const now = Date.now();
    // 1. Highest priority: local touch timestamp (when user just chatted in this room or received a message)
    const localTouch = localStorage.getItem(`chat_room_latest_touch_${room.id}`);
    const localTouchTime = localTouch ? Number(localTouch) : 0;

    // 2. Room updatedAt from backend
    let serverTime = 0;
    if (room.updatedAt) {
      const parsed = new Date(room.updatedAt).getTime();
      if (!isNaN(parsed)) {
        // If server time is in the future (> now + 30s), clamp it so it doesn't artificially pin over live activity
        serverTime = parsed > (now + 30000) ? (now - 60000) : parsed;
      }
    }

    return Math.max(localTouchTime, serverTime);
  };

  // Fetch rooms from Backend API: GET /api/v1/chats
  const loadChatRooms = useCallback(async () => {
    try {
      const data = await chatService.getChatRooms();
      const rawRooms = Array.isArray(data) ? data : [];
      const uniqueRooms: ChatRoomDto[] = [];
      const seen = new Set();
      for (const r of rawRooms) {
        if (!r.lastMessage || r.lastMessage.trim() === '') {
          continue;
        }
        const key = r.postId && r.buyerId && r.sellerId ? `${r.postId}_${r.buyerId}_${r.sellerId}` : r.id;
        if (!seen.has(key)) {
          seen.add(key);
          const localMsg = localStorage.getItem(`chat_room_latest_msg_${r.id}`);
          const localTouch = localStorage.getItem(`chat_room_latest_touch_${r.id}`);
          const mergedRoom = { ...r };
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

      // Sort rooms by latest message timestamp DESCENDING
      uniqueRooms.sort((a, b) => {
        const timeA = getRoomEffectiveTimestamp(a);
        const timeB = getRoomEffectiveTimestamp(b);
        return timeB - timeA;
      });

      setRooms(uniqueRooms);
    } catch (err) {
      console.warn('Failed to load chat rooms from backend:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const bumpRoomToTop = useCallback((roomId?: string, postId?: string, lastMessage?: string) => {
    if (!roomId && !postId) return;
    setRooms((prevRooms) => {
      const index = prevRooms.findIndex((r) => (roomId && r.id === roomId) || (postId && r.postId === postId));
      if (index === -1) {
        loadChatRooms();
        return prevRooms;
      }
      const targetRoom = {
        ...prevRooms[index],
        lastMessage: lastMessage || prevRooms[index].lastMessage,
        updatedAt: new Date().toISOString()
      };
      const rest = prevRooms.filter((_, i) => i !== index);
      return [targetRoom, ...rest];
    });
  }, [loadChatRooms]);

  // Fetch negotiations from Backend API: GET /api/v1/negotiations/seller & buyer
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

  useEffect(() => {
    loadChatRooms();
    loadNegotiations();

    chatService.connectWebSocket();
    const unsubscribe = chatService.subscribeToMessages((msg) => {
      if (msg?.conversationId) {
        bumpRoomToTop(msg.conversationId, undefined, msg.messageContent);
      }
      loadChatRooms();
      loadNegotiations();
    });

    const handleMessageSent = (e: any) => {
      const { roomId, postId, message } = e.detail || {};
      if (roomId || postId) {
        bumpRoomToTop(roomId, postId, message);
      }
    };
    window.addEventListener('chat_message_sent', handleMessageSent);

    const intervalId = setInterval(() => {
      loadChatRooms();
      loadNegotiations();
    }, 10000);

    return () => {
      unsubscribe();
      window.removeEventListener('chat_message_sent', handleMessageSent);
      clearInterval(intervalId);
    };
  }, [loadChatRooms, loadNegotiations, bumpRoomToTop]);

  const handleSelectRoom = (room: ChatRoomDto) => {
    const { partnerName, partnerAvatar } = getRoomPartnerInfo(room);
    const found = listings?.find((l) => l.id === room.postId);

    const targetListing: Listing = found
      ? {
          ...found,
          sellerId: room.sellerId || found.sellerId,
          sellerName: (room.sellerName && !isNameOfMe(room.sellerName) ? room.sellerName : found.sellerName) || 'Người Bán',
          sellerAvatar: room.sellerAvatar || found.sellerAvatar,
        }
      : ({
          id: room.postId,
          title: room.postTitle || 'Sản phẩm trao đổi',
          brand: 'Chính hãng',
          priceVnd: 500000,
          description: 'Thông tin sản phẩm trong cuộc hội thoại',
          category: 'Thiết bị gia dụng',
          sellerId: room.sellerId,
          sellerName: room.sellerName || 'Người bán',
          location: 'Hồ Chí Minh',
          status: 'active',
          photos: {
            front:
              room.postImageUrl ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            back:
              room.postImageUrl ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            screenOrDetails: '',
            accessoriesOrBox: '',
            serialOrReceipt: '',
          },
          createdAt: room.updatedAt || new Date().toISOString(),
        } as unknown as Listing);

    onOpenChat(targetListing, room.id, partnerName, partnerAvatar, room);
  };

  const handleOpenChatForNegotiation = (neg: Negotiation) => {
    const found = listings?.find((l) => l.id === neg.postId);
    const targetListing: Listing = found
      ? {
          ...found,
          sellerId: neg.sellerId || found.sellerId,
          sellerName: found.sellerName || 'Người Bán',
          priceVnd: found.priceVnd || neg.offeredPrice,
        }
      : ({
          id: neg.postId,
          title: neg.postTitle || 'Sản phẩm thương lượng',
          brand: 'Chính hãng',
          priceVnd: neg.offeredPrice,
          description: 'Sản phẩm đang được trao đổi thương lượng giá',
          category: 'Thiết bị gia dụng',
          sellerId: neg.sellerId,
          status: 'active',
          photos: {
            front: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            back: '',
            screenOrDetails: '',
            accessoriesOrBox: '',
            serialOrReceipt: '',
          },
          createdAt: neg.createdAt || new Date().toISOString(),
        } as unknown as Listing);

    const matchedRoom = rooms.find((r) =>
      r.postId === neg.postId &&
      (neg.buyerId ? String(r.buyerId) === String(neg.buyerId) : true) &&
      (neg.sellerId ? String(r.sellerId) === String(neg.sellerId) : true)
    ) || rooms.find((r) => r.postId === neg.postId);

    const activeUser = currentUser || getStoredUser();
    const currentUserId = activeUser?.id ? String(activeUser.id) : null;
    const isMeSeller = Boolean(currentUserId && neg.sellerId && currentUserId === String(neg.sellerId));
    const partnerName = isMeSeller ? 'Người Mua' : (matchedRoom?.sellerName || targetListing.sellerName || 'Người Bán');
    const partnerAvatar = isMeSeller ? matchedRoom?.buyerAvatar : (matchedRoom?.sellerAvatar || targetListing.sellerAvatar);

    const roomToPass: ChatRoomDto | undefined = matchedRoom || (neg.sellerId && neg.buyerId ? {
      id: '',
      postId: neg.postId,
      postTitle: neg.postTitle,
      buyerId: neg.buyerId,
      sellerId: neg.sellerId,
      lastMessage: '',
      updatedAt: neg.createdAt
    } : undefined);

    onOpenChat(targetListing, matchedRoom?.id, partnerName, partnerAvatar, roomToPass);
  };

  const handleAcceptNegotiation = async (id: string) => {
    setActionInProgressId(id);
    try {
      const updated = await negotiationService.acceptNegotiation(id);
      setSellerNegotiations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated?.status || 'ACCEPTED' } : item))
      );
      showNotice(
        lang === 'vi'
          ? '🎉 Đã chấp thuận đề xuất giá! Người mua có thể thanh toán theo mức giá này.'
          : '🎉 Accepted price offer!'
      );
    } catch (err: any) {
      showNotice(err?.message || (lang === 'vi' ? 'Có lỗi khi chấp thuận đề xuất' : 'Failed to accept offer'));
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
      showNotice(lang === 'vi' ? '❌ Đã từ chối đề xuất giá.' : 'Rejected price offer.');
    } catch (err: any) {
      showNotice(err?.message || (lang === 'vi' ? 'Có lỗi khi từ chối đề xuất' : 'Failed to reject offer'));
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
      showNotice(lang === 'vi' ? 'Đã hủy bỏ yêu cầu thương lượng giá.' : 'Cancelled price offer.');
    } catch (err: any) {
      showNotice(err?.message || (lang === 'vi' ? 'Có lỗi khi hủy đề xuất' : 'Failed to cancel offer'));
    } finally {
      setActionInProgressId(null);
    }
  };

  const formatLastMessage = (rawText?: string) => {
    if (!rawText) return lang === 'vi' ? 'Bắt đầu cuộc trò chuyện...' : 'Start conversation...';
    const parsed = parseSystemMessage(rawText);
    if (parsed.isSystem) {
      if (parsed.offer) {
        const off = parsed.offer;
        if (off.status === 'ACCEPTED') {
          return `🎉 ${lang === 'vi' ? 'Đã chốt giá thỏa thuận:' : 'Agreed price:'} ${off.price.toLocaleString('vi-VN')} đ`;
        }
        if (off.status === 'REJECTED') {
          return `❌ ${lang === 'vi' ? 'Đã từ chối đề xuất giá:' : 'Rejected offer:'} ${off.price.toLocaleString('vi-VN')} đ`;
        }
        if (off.status === 'CANCELLED') {
          return `[${lang === 'vi' ? 'Hủy đề xuất' : 'Cancelled offer'}]`;
        }
        return `🤝 ${lang === 'vi' ? 'Đề xuất giá mới:' : 'New offer:'} ${off.price.toLocaleString('vi-VN')} đ`;
      }
      return `[Hệ thống] ${parsed.cleanText}`;
    }
    return rawText;
  };

  const pendingSellerCount = sellerNegotiations.filter((n) => n.status === 'PENDING').length;
  const pendingBuyerCount = buyerNegotiations.filter((n) => n.status === 'PENDING').length;
  const currentNegotiationList = negotiationTab === 'seller' ? sellerNegotiations : buyerNegotiations;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {noticeMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-lg animate-in fade-in flex items-center justify-between">
          <span>{noticeMessage}</span>
          <button onClick={() => setNoticeMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-[#FFFFFF] rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Main Header with Navigation Tabs */}
        <div className="p-6 border-b border-slate-100 bg-[#faf8f5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#24263e] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#c34c36]" />
              {lang === 'vi' ? 'Hộp thư đàm phán & Trò chuyện' : 'Negotiation & Chat Inbox'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'vi'
                ? 'Theo dõi trao đổi tin nhắn trực tiếp và các đề xuất mặc cả giá sản phẩm.'
                : 'Track direct conversations and buyer price negotiations.'}
            </p>
          </div>
        </div>

        {/* TAB 1: CHATS LIST */}
        {activeTab === 'chats' && (
          <div>
            {loading ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#c34c36] animate-spin" />
                <p className="text-sm font-semibold text-slate-500">
                  {lang === 'vi' ? 'Đang tải hộp thư trò chuyện...' : 'Loading inbox messages...'}
                </p>
              </div>
            ) : rooms.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-[#24263e]">
                  {lang === 'vi' ? 'Chưa có cuộc trò chuyện nào' : 'No conversations yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {lang === 'vi'
                    ? 'Khi bạn nhắn tin với người bán hoặc có khách hỏi mua sản phẩm của bạn, tin nhắn sẽ hiển thị tại đây theo thời gian thực.'
                    : 'When you message a seller or buyers ask about your items, conversations will appear here.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rooms.map((room) => {
                  const { isRoomSeller, partnerName, partnerAvatar, roleLabel } = getRoomPartnerInfo(room);
                  const timeStr = room.updatedAt
                    ? new Date(room.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={room.id}
                      onClick={() => handleSelectRoom(room)}
                      className="p-4 sm:p-5 hover:bg-slate-50 transition cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center group"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={partnerAvatar}
                          alt={partnerName || 'User Avatar'}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#c34c36] text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-white">
                          <MessageSquare className="w-3 h-3" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-[#24263e] truncate">
                            {room.postTitle || 'Sản phẩm đăng bán'}
                          </h3>
                          {timeStr && (
                            <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeStr}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] truncate max-w-[200px] ${
                              isRoomSeller
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {roleLabel}: {partnerName}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 truncate">{formatLastMessage(room.lastMessage)}</p>
                      </div>

                      <div className="shrink-0 text-slate-300 group-hover:text-[#c34c36] transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NEGOTIATIONS LIST */}
        {activeTab === 'negotiations' && (
          <div>
            {/* Sub-bar: Seller vs Buyer */}
            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNegotiationTab('seller')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    negotiationTab === 'seller'
                      ? 'bg-[#24263e] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đề xuất nhận được (Người bán)' : 'Received Offers (Seller)'}</span>
                  {pendingSellerCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                      {pendingSellerCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setNegotiationTab('buyer')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    negotiationTab === 'buyer'
                      ? 'bg-[#24263e] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đề xuất đã gửi (Người mua)' : 'Sent Offers (Buyer)'}</span>
                  {pendingBuyerCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                      {pendingBuyerCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={loadNegotiations}
                disabled={loadingNegotiations}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Tải lại danh sách đàm phán"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingNegotiations ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
              </button>
            </div>

            {loadingNegotiations ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#c34c36] animate-spin" />
                <p className="text-sm font-semibold text-slate-500">
                  {lang === 'vi' ? 'Đang tải danh sách thương lượng...' : 'Loading negotiations...'}
                </p>
              </div>
            ) : currentNegotiationList.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center">
                  <Tag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-[#24263e]">
                  {negotiationTab === 'seller'
                    ? lang === 'vi'
                      ? 'Chưa có đề xuất mặc cả nào gửi đến bạn'
                      : 'No offers received'
                    : lang === 'vi'
                      ? 'Bạn chưa gửi đề xuất giá nào cho người bán'
                      : 'You have not made any price offers'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {lang === 'vi'
                    ? 'Tính năng mặc cả cho phép hai bên thỏa thuận mức giá hợp lý trước khi tiến hành đặt hàng.'
                    : 'Negotiations allow buyers and sellers to agree on a fair price before ordering.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentNegotiationList.map((neg) => {
                  const foundListing = listings?.find((l) => l.id === neg.postId);
                  const isActionLoading = actionInProgressId === neg.id;

                  const statusConfig = {
                    PENDING: {
                      label: lang === 'vi' ? 'Chờ phản hồi' : 'Pending',
                      color: 'bg-amber-50 text-amber-800 border-amber-200',
                      icon: Clock,
                    },
                    ACCEPTED: {
                      label: lang === 'vi' ? 'Đã đồng ý giá' : 'Accepted',
                      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      icon: CheckCircle2,
                    },
                    REJECTED: {
                      label: lang === 'vi' ? 'Đã từ chối' : 'Rejected',
                      color: 'bg-rose-50 text-rose-800 border-rose-200',
                      icon: XCircle,
                    },
                    CANCELLED: {
                      label: lang === 'vi' ? 'Đã hủy' : 'Cancelled',
                      color: 'bg-slate-100 text-slate-600 border-slate-200',
                      icon: AlertCircle,
                    },
                  }[neg.status] || {
                    label: neg.status,
                    color: 'bg-slate-100 text-slate-600 border-slate-200',
                    icon: AlertCircle,
                  };

                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={neg.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-6 h-6" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-[#24263e] truncate">
                              {neg.postTitle || foundListing?.title || `Sản phẩm #${neg.postId}`}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${statusConfig.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{statusConfig.label}</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div>
                              <span className="text-slate-400">Giá đề xuất: </span>
                              <span className="font-mono font-black text-sm text-[#c34c36]">
                                {formatVND(neg.offeredPrice)}
                              </span>
                            </div>
                            {foundListing?.priceVnd && (
                              <div>
                                <span className="text-slate-400">Giá niêm yết: </span>
                                <span className="line-through text-slate-500 font-mono">
                                  {formatVND(foundListing.priceVnd)}
                                </span>
                              </div>
                            )}
                          </div>

                          {neg.createdAt && (
                            <p className="text-[10px] text-slate-400">
                              Thời gian: {new Date(neg.createdAt).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenChatForNegotiation(neg)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Nhắn tin' : 'Chat'}</span>
                        </button>

                        {/* Seller Actions on PENDING */}
                        {negotiationTab === 'seller' && neg.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectNegotiation(neg.id)}
                              disabled={isActionLoading}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Từ chối' : 'Reject'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAcceptNegotiation(neg.id)}
                              disabled={isActionLoading}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{lang === 'vi' ? 'Đồng ý giá' : 'Accept'}</span>
                            </button>
                          </>
                        )}

                        {/* Buyer Actions on PENDING */}
                        {negotiationTab === 'buyer' && neg.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancelNegotiation(neg.id)}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            <span>{lang === 'vi' ? 'Hủy đề xuất' : 'Cancel'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

