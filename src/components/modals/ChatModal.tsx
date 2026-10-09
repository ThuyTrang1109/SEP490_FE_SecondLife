import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, Listing, Language, UserRole, UserCredit } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import {
  Sparkles,
  AlertTriangle,
  Check,
  X,
  Send,
  RotateCcw,
  ShoppingBag,
  Star,
  CheckCircle2,
  Award,
  Loader2,
  XCircle,
  Tag,
  Clock
} from 'lucide-react';
import { reviewService } from '../../data/mockReviews';
import {
  negotiationService,
  chatService,
  getStoredUser,
  parseSystemMessage,
  ChatMessageDto,
  SystemOfferPayload,
  topupService
} from '../../services';

interface ChatModalProps {
  listing: Listing;
  currentRole: UserRole;
  onClose: () => void;
  lang: Language;
  onBuyClick?: (listing: Listing, agreedPrice?: number, negotiationId?: string) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
  predefinedRoomId?: string;
  partnerName?: string;
  partnerAvatar?: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  listing,
  currentRole,
  onClose,
  lang,
  onBuyClick,
  onOpenSellerReviews,
  predefinedRoomId,
  partnerName,
  partnerAvatar
}) => {
  const t = translations[lang];
  const currentUser = getStoredUser();

  const sellerTrust = reviewService.getSellerTrustProfile(listing.sellerId, listing.sellerName);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [offerInput, setOfferInput] = useState<number>(
    Math.round((listing.priceVnd * 0.92) / 100000) * 100000
  );
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch User Credit
  useEffect(() => {
    let isMounted = true;
    const fetchCredit = async () => {
      try {
        const credit = await topupService.getMyCredit();
        if (isMounted) setUserCredit(credit);
      } catch (err) {
        console.warn('Could not fetch credit:', err);
      } finally {
        if (isMounted) setLoadingCredit(false);
      }
    };
    fetchCredit();
    return () => {
      isMounted = false;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Convert ChatMessageDto from backend to ChatMessage for UI
  const mapDtoToChatMessage = useCallback(
    (dto: ChatMessageDto): ChatMessage => {
      const isSenderMe = currentUser?.id ? dto.senderId === currentUser.id : false;
      const parsedSys = parseSystemMessage(dto.messageContent);

      const isSystem = parsedSys.isSystem;
      const senderRole: 'buyer' | 'seller' | 'system' = isSystem
        ? 'system'
        : isSenderMe
        ? currentRole === 'staff' ? 'seller' : currentRole as ('buyer' | 'seller')
        : currentRole === 'buyer'
        ? 'seller'
        : 'buyer';

      const senderName = isSystem
        ? 'SecondLife System'
        : isSenderMe
        ? 'Bạn'
        : (partnerName || (currentRole === 'buyer' ? listing.sellerName : 'Khách Hàng'));

      const timeStr = dto.sentAt
        ? new Date(dto.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      let isOffer = false;
      let offerAmountVnd: number | undefined;
      let offerStatus: 'pending' | 'accepted' | 'declined' | undefined;
      let negotiationId: string | undefined;

      if (parsedSys.offer) {
        isOffer = true;
        offerAmountVnd = parsedSys.offer.price;
        negotiationId = parsedSys.offer.negotiationId;
        offerStatus =
          parsedSys.offer.status === 'ACCEPTED'
            ? 'accepted'
            : parsedSys.offer.status === 'REJECTED' || parsedSys.offer.status === 'CANCELLED'
            ? 'declined'
            : 'pending';
      }

      return {
        id: dto.id || `msg-${Date.now()}-${Math.random()}`,
        senderId: dto.senderId,
        senderName,
        senderRole,
        text: dto.messageContent,
        timestamp: timeStr,
        isOffer,
        offerAmountVnd,
        offerStatus,
        negotiationId,
      };
    },
    [currentUser?.id, currentRole, listing.sellerName, partnerName]
  );

  // Initialize or fetch Chat Room from Backend
  useEffect(() => {
    let isMounted = true;
    const initRoom = async () => {
      if (!listing?.id) return;
      setLoadingRoom(true);
      try {
        let finalRoomId = predefinedRoomId;
        console.log('[ChatModal] initRoom - predefinedRoomId:', predefinedRoomId, 'partnerName:', partnerName, 'currentRole:', currentRole);
        
        if (!finalRoomId) {
          // API: POST /api/v1/chats/rooms?postId={postId}
          // Only creates/fetches room for current user as buyer
          const room = await chatService.getOrCreateRoom(listing.id);
          if (room?.id) {
            finalRoomId = room.id;
          }
        }

        console.log('[ChatModal] initRoom - finalRoomId:', finalRoomId);

        if (!isMounted) return;

        if (finalRoomId) {
          setRoomId(finalRoomId);
          // API: GET /api/v1/chats/{roomId}/messages
          const historyDtos = await chatService.getMessages(finalRoomId);
          if (isMounted && Array.isArray(historyDtos)) {
            const uiMsgs = historyDtos.map(mapDtoToChatMessage);
            setMessages(uiMsgs);
          }
        }
      } catch (err) {
        console.warn('Could not initialize room from backend, falling back to local chat cache:', err);
        // Fallback to local storage if network or auth error
        const historyKey = `chat_history_${listing.id}`;
        const stored = localStorage.getItem(historyKey);
        if (stored && isMounted) {
          try {
            const parsed = JSON.parse(stored) as ChatMessage[];
            if (Array.isArray(parsed)) setMessages(parsed);
          } catch {}
        }
      } finally {
        if (isMounted) setLoadingRoom(false);
      }
    };

    initRoom();
    return () => {
      isMounted = false;
    };
  }, [listing.id, mapDtoToChatMessage]);

  // Subscribe to WebSocket for real-time messages (/user/queue/messages)
  useEffect(() => {
    if (!roomId) return;

    // Connect WS
    chatService.connectWebSocket();

    const unsubscribe = chatService.subscribeToMessages((newDto: ChatMessageDto) => {
      // Check if message belongs to this room
      if (newDto.conversationId === roomId) {
        const uiMsg = mapDtoToChatMessage(newDto);
        setMessages((prev) => {
          // Avoid duplicate by id
          if (prev.some((m) => m.id === uiMsg.id)) {
            return prev;
          }
          
          // Avoid duplicate by optimistic message (same text, starts with msg-)
          const optimisticIndex = prev.findIndex(
            (m) => m.id.startsWith('msg-') && m.text === uiMsg.text && m.senderRole === uiMsg.senderRole
          );
          
          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = uiMsg;
            return next;
          }
          
          return [...prev, uiMsg];
        });
        setTimeout(scrollToBottom, 100);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, mapDtoToChatMessage]);

  // Track latest accepted offer price & negotiationId
  const acceptedOffers = messages.filter(
    (m) => (m.isOffer && m.offerStatus === 'accepted' && m.offerAmountVnd) ||
           (m.text && m.text.includes('"status":"ACCEPTED"'))
  );
  
  let latestAcceptedOffer: number | undefined;
  let latestAcceptedNegotiationId: string | undefined;

  if (acceptedOffers.length > 0) {
    const last = acceptedOffers[acceptedOffers.length - 1];
    if (last.offerAmountVnd) {
      latestAcceptedOffer = last.offerAmountVnd;
      latestAcceptedNegotiationId = last.negotiationId;
    } else {
      const parsed = parseSystemMessage(last.text);
      if (parsed.offer && parsed.offer.status === 'ACCEPTED') {
        latestAcceptedOffer = parsed.offer.price;
        latestAcceptedNegotiationId = parsed.offer.negotiationId;
      }
    }
  }

  const hasPendingOffer = messages.some(
    (m) =>
      (m.isOffer && m.offerStatus === 'pending') ||
      (m.text && m.text.includes('"status":"PENDING"'))
  );

  const [aiAdvice, setAiAdvice] = useState<{
    counterOfferVnd: number;
    adviceText: string;
    warningMessage: string | null;
  }>({
    counterOfferVnd: Math.round((listing.priceVnd * (currentRole === 'buyer' ? 0.95 : 0.98)) / 100000) * 100000,
    adviceText: currentRole === 'buyer' 
      ? 'Mức giá đề xuất của người mua (-5% đến -8%) nằm trong biên độ thanh khoản cao của thị trường đồ cũ tại Việt Nam.' 
      : 'Khách hàng này có lịch sử chốt đơn nhanh. Chủ động đề xuất giảm nhẹ (2%) để tăng khả năng chốt đơn ngay!',
    warningMessage: null
  });

  // Send standard text message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isSending) return;

    const scamTriggers = ['zalo', 'whatsapp', 'chuyển khoản trước', 'cọc ngoài', 'gửi link', 'ship ngoài'];
    const hasScam = scamTriggers.some((t) => text.toLowerCase().includes(t));

    const tempId = `msg-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: currentUser?.id || currentRole,
      senderName: 'Bạn',
      senderRole: currentRole === 'buyer' ? 'buyer' : 'seller',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      safetyWarning: hasScam
        ? 'Cảnh báo an toàn: Tin nhắn có dấu hiệu giao dịch ngoài luồng. Tuyệt đối không chuyển tiền cọc trực tiếp ngoài SecondLife Escrow!'
        : undefined
    };

    // Optimistically update UI
    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
    setIsSending(true);
    setTimeout(scrollToBottom, 50);

    if (hasScam) {
      setAiAdvice((prev) => ({
        ...prev,
        warningMessage: 'Hệ thống AI phát hiện từ khóa lôi kéo ra Zalo/kênh ngoài. Đơn hàng sẽ mất bảo hiểm nếu bạn giao dịch ngoài hệ thống!'
      }));
    }

    try {
      if (roomId) {
        // Call Backend API: POST /api/v1/chats/{roomId}/messages
        const res = await chatService.sendMessage(roomId, text);
        if (res?.id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: res.id } : m))
          );
        }
      }
    } catch (err) {
      console.warn('Could not send message via backend API, kept in local state:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Send official negotiation offer
  const handleSendOffer = async () => {
    if (!offerInput || offerInput <= 0) return;
    setNegotiationLoading(true);
    setOfferError(null);

    try {
      // POST /api/v1/negotiations
      const res = await negotiationService.createNegotiation(listing.id, offerInput);
      setShowOfferForm(false);
      setOfferError(null);

      // Backend will automatically generate a SYSTEM message and broadcast via WebSocket.
      // We also add an optimistic offer card to UI immediately in case WS has network latency
      if (res?.id) {
        const localOfferMsg: ChatMessage = {
          id: `nego-${res.id}`,
          senderId: currentUser?.id || currentRole,
          senderName: currentRole === 'buyer' ? 'Bạn' : listing.sellerName,
          senderRole: 'system',
          text: `SYSTEM: {"type":"OFFER","status":"PENDING","price":${offerInput},"negotiationId":"${res.id}"}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isOffer: true,
          offerAmountVnd: offerInput,
          offerStatus: 'pending',
          negotiationId: res.id,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.negotiationId === res.id)) return prev;
          return [...prev, localOfferMsg];
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (err: any) {
      console.warn('Backend negotiation creation error:', err);
      const msg = err?.message || '';
      if (msg.includes('internal error') || msg.includes('500')) {
        setOfferError('Máy chủ Backend gặp lỗi nội bộ (500) khi lưu đàm phán hoặc gửi tin nhắn hệ thống. Vui lòng kiểm tra lại server.');
      } else {
        setOfferError(msg || 'Không thể tạo đề xuất thương lượng. Mức giá đề xuất phải thấp hơn giá gốc.');
      }
    } finally {
      setNegotiationLoading(false);
    }
  };

  // Seller accepts or rejects offer
  const handleRespondOffer = async (negotiationId: string, action: 'accepted' | 'declined') => {
    try {
      if (action === 'accepted') {
        // PUT /api/v1/negotiations/{id}/accept
        await negotiationService.acceptNegotiation(negotiationId);
      } else {
        // PUT /api/v1/negotiations/{id}/reject
        await negotiationService.rejectNegotiation(negotiationId);
      }

      // Update offer status in local state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.negotiationId === negotiationId) {
            return {
              ...m,
              offerStatus: action,
              text: `SYSTEM: {"type":"OFFER","status":"${action === 'accepted' ? 'ACCEPTED' : 'REJECTED'}","price":${m.offerAmountVnd || listing.priceVnd},"negotiationId":"${negotiationId}"}`
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      console.warn('Backend respond negotiation error:', err);
      alert(err?.message || 'Thao tác không thành công. Vui lòng thử lại.');
    }
  };

  // Buyer cancels pending offer
  const handleCancelOffer = async (negotiationId: string) => {
    try {
      // PUT /api/v1/negotiations/{id}/cancel
      await negotiationService.cancelNegotiation(negotiationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.negotiationId === negotiationId
            ? {
                ...m,
                offerStatus: 'declined',
                text: `SYSTEM: {"type":"OFFER","status":"CANCELLED","price":${m.offerAmountVnd || listing.priceVnd},"negotiationId":"${negotiationId}"}`
              }
            : m
        )
      );
    } catch (err: any) {
      console.warn('Backend cancel negotiation error:', err);
    }
  };

  const handleUnsendMessage = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, isUnsent: true, text: 'Tin nhắn đã được thu hồi' }
          : m
      )
    );
  };

  const handleBuyNow = (priceToUse?: number, specificNegotiationId?: string) => {
    const finalPrice = priceToUse || latestAcceptedOffer || listing.priceVnd;
    const finalNegoId = specificNegotiationId || latestAcceptedNegotiationId;
    if (onBuyClick) {
      onBuyClick(listing, finalPrice, finalNegoId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-2xl w-full h-[88vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden text-[#24263e]">
        {/* Header with Seller Trust Score & Buy Now button */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
          currentRole === 'seller' 
            ? 'bg-gradient-to-r from-[#24263e] to-slate-800 text-white border-slate-700' 
            : 'bg-gradient-to-r from-[#fce5da] to-white border-[#24263e]/15 text-[#24263e]'
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={partnerAvatar || (currentRole === 'buyer' && listing.sellerAvatar ? listing.sellerAvatar : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200")}
              alt={partnerName || (currentRole === 'buyer' ? listing.sellerName : 'Khách Hàng')}
              className={`w-11 h-11 rounded-xl object-cover shrink-0 ${currentRole === 'seller' ? 'border-2 border-white/20' : 'border border-[#24263e]/20'}`}
            />
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-extrabold text-xs truncate ${currentRole === 'seller' ? 'text-white' : 'text-[#24263e]'}`}>
                  {partnerName || (currentRole === 'buyer' ? listing.sellerName : 'Khách Hàng')}
                </span>
                
                {currentRole === 'seller' && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-200 rounded text-[9px] font-bold border border-blue-400/30">
                    Người mua
                  </span>
                )}

                {/* Seller Trust Score Pill */}
                {currentRole === 'buyer' && (
                  <button
                    type="button"
                    onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                    className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md bg-white border border-amber-300 text-[10px] font-black text-amber-800 shadow-2xs hover:bg-amber-50 cursor-pointer transition"
                    title="Bấm để xem chi tiết uy tín và đánh giá từ người mua khác"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>{sellerTrust.trustScore} điểm uy tín</span>
                    <span className="text-slate-400">|</span>
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>{sellerTrust.rating}</span>
                  </button>
                )}
              </div>

              <div className={`text-[11px] truncate mt-0.5 ${currentRole === 'seller' ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className={`font-semibold ${currentRole === 'seller' ? 'text-white' : 'text-slate-800'}`}>{listing.title}</span> •{' '}
                <span className={`font-bold ${currentRole === 'seller' ? 'text-[#e36a54]' : 'text-[#c34c36]'}`}>{formatVND(listing.priceVnd)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Buy Now button in header */}
            {currentRole === 'buyer' && (
              <button
                onClick={() => handleBuyNow(latestAcceptedOffer || listing.priceVnd)}
                className="px-3.5 py-2 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-white" />
                <span>
                  {latestAcceptedOffer
                    ? `${lang === 'vi' ? 'Mua giá chốt' : 'Buy Deal'} (${formatVND(latestAcceptedOffer)})`
                    : lang === 'vi' ? 'Mua Ngay' : 'Buy Now'}
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`p-2 rounded-xl text-xs font-bold cursor-pointer transition ${
                currentRole === 'seller' 
                  ? 'text-slate-300 hover:text-white hover:bg-white/10' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Accepted Offer Sticky Banner */}
        {latestAcceptedOffer && currentRole === 'buyer' && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {lang === 'vi'
                  ? `Đã chốt giá thỏa thuận: ${formatVND(latestAcceptedOffer)} (Tiết kiệm ${formatVND(listing.priceVnd - latestAcceptedOffer)})`
                  : `Agreed Deal: ${formatVND(latestAcceptedOffer)}`}
              </span>
            </div>

            <button
              onClick={() => handleBuyNow(latestAcceptedOffer)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1 shadow-xs"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>{lang === 'vi' ? 'Đặt hàng ngay' : 'Checkout Now'}</span>
            </button>
          </div>
        )}

        {/* AI Smart Negotiation Advisor Pill */}
        <div className={`border-b px-4 py-2.5 flex items-center justify-between text-xs shrink-0 ${
          currentRole === 'seller' ? 'bg-blue-50/60 border-blue-100' : 'bg-[#faf8f5] border-gray-200'
        }`}>
          <div className="flex items-center gap-2 text-[#24263e]">
            <Sparkles className={`w-4 h-4 shrink-0 ${currentRole === 'seller' ? 'text-blue-600' : 'text-[#c34c36]'}`} />
            <span className="text-[11px] font-medium leading-snug">
              <span className={`font-bold ${currentRole === 'seller' ? 'text-blue-900' : 'text-[#24263e]'}`}>
                {lang === 'vi' 
                  ? (currentRole === 'seller' ? 'Insight bán hàng: ' : 'AI Gợi ý thương lượng: ') 
                  : 'AI Advisor: '}
              </span>
              <span className={currentRole === 'seller' ? 'text-blue-800' : ''}>
                {aiAdvice.adviceText}
              </span>
            </span>
          </div>

          <button
            onClick={() =>
              handleSendMessage(
                lang === 'vi'
                  ? (currentRole === 'seller' ? `Mình có thể giảm một chút, chốt giá ${formatVND(aiAdvice.counterOfferVnd)} qua kiểm định Hub nhé!` : `Mình đề xuất chốt mức ${formatVND(aiAdvice.counterOfferVnd)} qua kiểm định Hub nhé!`)
                  : `I propose a deal at ${formatVND(aiAdvice.counterOfferVnd)} through Hub inspection!`
              )
            }
            className={`shrink-0 ml-2 px-2.5 py-1 text-white rounded-lg text-[10px] font-bold cursor-pointer transition shadow-2xs ${
              currentRole === 'seller' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#24263e] hover:bg-black'
            }`}
          >
            {lang === 'vi' ? (currentRole === 'seller' ? 'Gửi đề xuất:' : 'Dùng giá gợi ý:') : 'Use suggestion:'} {formatVND(aiAdvice.counterOfferVnd)}
          </button>
        </div>

        {/* Anti-Scam Banner */}
        {aiAdvice.warningMessage && (
          <div className="bg-rose-50 border-b border-rose-200 p-2.5 flex items-center gap-2 text-rose-800 text-xs font-semibold shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{aiAdvice.warningMessage}</span>
          </div>
        )}

        {/* Chat Messages Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#faf8f5]">
          {loadingRoom ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 text-[#c34c36] animate-spin" />
              <p className="text-xs font-medium">Đang tải phòng chat an toàn...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-2">
              <ShoppingBag className={`w-10 h-10 ${currentRole === 'seller' ? 'text-blue-200' : 'text-slate-300'}`} />
              <p className="text-xs font-semibold text-slate-500">
                {lang === 'vi'
                  ? (currentRole === 'seller' 
                      ? 'Người mua đang quan tâm đến sản phẩm của bạn. Hãy gửi tin nhắn chào hỏi!' 
                      : 'Chưa có tin nhắn nào. Hãy gửi tin nhắn hoặc đề xuất giá đầu tiên!')
                  : 'No messages yet. Send a message or make an offer!'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const parsedSys = parseSystemMessage(msg.text);

              // -------------------------------------------------------------
              // 4. XỬ LÝ "TIN NHẮN HỆ THỐNG" (SYSTEM MESSAGE) KHI THƯƠNG LƯỢNG
              // Render bong bóng / thông báo ở CHÍNH GIỮA MÀN HÌNH thay vì lệch trái/phải
              // -------------------------------------------------------------
              if (parsedSys.isSystem) {
                // If it's a structured OFFER from backend
                if (parsedSys.offer) {
                  const offer = parsedSys.offer;
                  const isAccepted = offer.status === 'ACCEPTED';
                  const isRejected = offer.status === 'REJECTED';
                  const isCancelled = offer.status === 'CANCELLED';
                  const isExpired = false; // Note: EXPIRED is not in SystemOfferPayload
                  const isPending = offer.status === 'PENDING';
                  
                  const isOfferSenderMe = currentUser?.id ? msg.senderId === currentUser.id : msg.senderId === currentRole;

                  return (
                    <div key={msg.id} className="flex justify-center my-3 animate-fadeIn">
                      <div
                        className={`max-w-md w-full rounded-2xl border p-3.5 shadow-sm text-center transition-all ${
                          isAccepted
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : isRejected || isCancelled
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : isExpired
                            ? 'bg-slate-50 border-slate-300 text-slate-500'
                            : 'bg-gradient-to-b from-amber-50 to-orange-50/50 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-1.5">
                          {isAccepted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isRejected || isCancelled ? (
                            <XCircle className="w-4 h-4 text-rose-500" />
                          ) : isExpired ? (
                            <Clock className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Tag className="w-4 h-4 text-amber-600" />
                          )}
                          <span className="text-[11px] font-black uppercase tracking-wider">
                            {isAccepted
                              ? '🎉 Thỏa Thuận Chốt Giá Thành Công'
                              : isRejected
                              ? '❌ Đề Xuất Giá Đã Bị Từ Chối'
                              : isCancelled
                              ? 'Đề Xuất Giá Đã Được Hủy'
                              : isExpired
                              ? '⏳ Phiên Thương Lượng Đã Hết Hạn'
                              : '🤝 Đề Xuất Thương Lượng Giá Mới'}
                          </span>
                        </div>

                        <div className="my-1.5 flex items-baseline justify-center gap-2">
                          <span className="text-base font-black text-[#c34c36]">
                            {formatVND(offer.price)}
                          </span>
                          <span className="text-xs line-through text-slate-400 font-medium">
                            {formatVND(listing.priceVnd)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Tiết kiệm {formatVND(listing.priceVnd - offer.price)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 mb-2">
                          {isAccepted
                            ? 'Người bán đã chấp nhận mức giá này. Người mua có thể tiến hành đặt cọc qua Escrow ngay bây giờ!'
                            : isRejected
                            ? 'Mức giá đề xuất chưa phù hợp với người bán. Bạn có thể gửi lại mức giá khác hợp lý hơn.'
                            : isCancelled
                            ? 'Người mua đã hủy yêu cầu thương lượng giá này.'
                            : currentRole === 'seller'
                            ? 'Người mua gửi đề xuất giá cho sản phẩm của bạn. Vui lòng phản hồi:'
                            : 'Đề xuất đã được gửi tới người bán, đang chờ phản hồi...'}
                        </p>

                        {/* Action buttons inside System Offer Banner */}
                        {isPending && currentRole === 'seller' && (
                          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-amber-200/60">
                            <button
                              onClick={() => handleRespondOffer(offer.negotiationId, 'accepted')}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Chấp nhận giá này' : 'Accept Offer'}</span>
                            </button>
                            <button
                              onClick={() => handleRespondOffer(offer.negotiationId, 'declined')}
                              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Từ chối' : 'Decline'}</span>
                            </button>
                          </div>
                        )}

                        {isPending && currentRole === 'buyer' && (
                          <div className="mt-2 pt-2 border-t border-amber-200/60 flex justify-center">
                            <button
                              onClick={() => handleCancelOffer(offer.negotiationId)}
                              className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              <span>{lang === 'vi' ? 'Hủy đề xuất thương lượng' : 'Cancel Offer'}</span>
                            </button>
                          </div>
                        )}

                        {isAccepted && currentRole === 'buyer' && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 flex justify-center">
                            <button
                              onClick={() => handleBuyNow(offer.price, offer.negotiationId)}
                              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition transform hover:scale-102"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              <span>
                                {lang === 'vi'
                                  ? `Đặt mua ngay với giá ${formatVND(offer.price)}`
                                  : `Buy Now at ${formatVND(offer.price)}`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Plain text system notification (starts with "SYSTEM: ")
                return (
                  <div key={msg.id} className="flex justify-center my-2.5 animate-fadeIn">
                    <div className="bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-2xl text-[11px] font-medium shadow-2xs flex items-center gap-2 max-w-md text-center">
                      <Sparkles className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                      <span>{parsedSys.cleanText}</span>
                    </div>
                  </div>
                );
              }

              // Standard User Chat Bubble (Left/Right)
              const isMe = msg.senderRole === currentRole;

              return (
                <div
                  key={msg.id}
                  className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span className="text-[10px] text-[#24263e]/70 font-medium">
                      {msg.senderName} • {msg.timestamp}
                    </span>

                    {isMe && !msg.isUnsent && (
                      <button
                        onClick={() => handleUnsendMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-[#24263e] font-medium flex items-center gap-0.5 cursor-pointer ml-1"
                        title={lang === 'vi' ? 'Thu hồi tin nhắn' : 'Unsend message'}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>{lang === 'vi' ? 'Thu hồi' : 'Unsend'}</span>
                      </button>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed transition-all ${
                      msg.isUnsent
                        ? 'bg-[#FFFFFF] text-gray-400 italic border border-gray-200 shadow-none'
                        : isMe
                        ? 'bg-[#24263e] text-white rounded-br-xs font-medium shadow-2xs'
                        : 'bg-[#FFFFFF] text-[#24263e] border border-gray-200 shadow-2xs rounded-bl-xs'
                    }`}
                  >
                    {msg.isUnsent ? (
                      <p className="flex items-center gap-1.5 text-gray-400 font-normal not-italic">
                        <RotateCcw className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="italic">
                          {lang === 'vi' ? 'Tin nhắn đã được thu hồi' : 'Message was unsent'}
                        </span>
                      </p>
                    ) : (
                      <>
                        <p>{msg.text}</p>

                        {/* Interactive Legacy Offer Card if present */}
                        {msg.isOffer && msg.offerAmountVnd && (
                          <div
                            className={`mt-2.5 p-3 rounded-xl border ${
                              isMe
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-[#faf8f5] border-gray-200 text-[#24263e]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider opacity-85">
                              <span>{lang === 'vi' ? 'Đề xuất giá thỏa thuận:' : 'Official Counter Offer:'}</span>
                              <span className="text-emerald-400 font-black">
                                Giảm {formatVND(listing.priceVnd - msg.offerAmountVnd)}
                              </span>
                            </div>

                            <div className="text-lg font-black mt-1 flex items-baseline gap-2">
                              <span className={isMe ? 'text-white' : 'text-[#c34c36]'}>
                                {formatVND(msg.offerAmountVnd)}
                              </span>
                              <span className="text-xs line-through opacity-60">
                                {formatVND(listing.priceVnd)}
                              </span>
                            </div>

                            <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-2">
                              {msg.offerStatus === 'pending' ? (
                                !isMe ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => msg.negotiationId && handleRespondOffer(msg.negotiationId, 'accepted')}
                                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{lang === 'vi' ? 'Chấp nhận giá' : 'Accept Offer'}</span>
                                    </button>
                                    <button
                                      onClick={() => msg.negotiationId && handleRespondOffer(msg.negotiationId, 'declined')}
                                      className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>{lang === 'vi' ? 'Từ chối' : 'Decline'}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] opacity-80 flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                      <span>
                                        {lang === 'vi'
                                          ? (currentRole === 'buyer' ? 'Đang chờ người bán phản hồi...' : 'Đang chờ người mua phản hồi...')
                                          : 'Waiting for response...'}
                                      </span>
                                    </div>
                                    {msg.negotiationId && (
                                      <button
                                        type="button"
                                        onClick={() => handleCancelOffer(msg.negotiationId!)}
                                        className="w-full py-1 px-2 bg-rose-600/80 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center justify-center gap-1"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>{lang === 'vi' ? 'Hủy yêu cầu thương lượng' : 'Cancel Offer'}</span>
                                      </button>
                                    )}
                                  </div>
                                )
                              ) : msg.offerStatus === 'accepted' ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span>
                                      {isMe
                                        ? (lang === 'vi' ? '✓ Bạn đã chấp thuận mức giá này!' : '✓ You accepted this offer!')
                                        : (lang === 'vi' ? (currentRole === 'buyer' ? '✓ Người bán đã chấp thuận mức giá này!' : '✓ Người mua đã chấp thuận!') : '✓ Accepted!')}
                                    </span>
                                  </div>

                                  {currentRole === 'buyer' && (
                                    <button
                                      type="button"
                                      onClick={() => handleBuyNow(msg.offerAmountVnd, msg.negotiationId)}
                                      className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-102"
                                    >
                                      <ShoppingBag className="w-4 h-4" />
                                      <span>
                                        {lang === 'vi'
                                          ? `Mua Hàng Ngay Với Giá ${formatVND(msg.offerAmountVnd)}`
                                          : `Buy Now at ${formatVND(msg.offerAmountVnd)}`}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                  <X className="w-4 h-4" />
                                  <span>{lang === 'vi' ? '✕ Đã từ chối mức giá này' : '✕ Offer declined'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {msg.safetyWarning && (
                          <div className="mt-1.5 text-[10px] text-rose-700 bg-rose-50 p-2 rounded-xl flex items-center gap-1.5 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{msg.safetyWarning}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Offer Popup */}
        {showOfferForm && currentRole === 'buyer' && !hasPendingOffer && (
          <div className={`p-3.5 border-t flex items-center gap-3 animate-fadeIn shrink-0 bg-[#FFFFFF] border-gray-200`}>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700">
                  {lang === 'vi' ? 'Nhập mức giá bạn muốn đề xuất mua (VNĐ):' : 'Enter offer price (VND):'}
                </label>
                <span className={`text-[10px] font-bold text-[#c34c36]`}>
                  {lang === 'vi' ? 'Giá gốc:' : 'Original:'} {formatVND(listing.priceVnd)}
                </span>
              </div>
              <input
                type="number"
                step={50000}
                value={offerInput}
                onChange={(e) => {
                  setOfferInput(Number(e.target.value));
                  if (offerError) setOfferError(null);
                }}
                className={`w-full px-3 py-1.5 border rounded-xl text-xs font-black text-[#24263e] focus:outline-none mt-1 bg-[#faf8f5] border-gray-200 focus:border-[#c34c36]`}
              />
              {offerError && (
                <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 bg-rose-50 p-2 rounded-lg border border-rose-200 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{offerError}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleSendOffer}
              disabled={negotiationLoading}
              className={`px-4 py-2 text-white rounded-xl text-xs font-bold mt-4 cursor-pointer transition shadow-xs flex items-center gap-1 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95`}
            >
              {negotiationLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>{lang === 'vi' ? 'Gửi Offer' : 'Send Offer'}</span>
              )}
            </button>
            <button
              onClick={() => setShowOfferForm(false)}
              className="px-3 py-2 bg-[#faf8f5] hover:bg-gray-200 text-[#24263e] border border-gray-200 rounded-xl text-xs mt-4 cursor-pointer transition font-medium"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Input Bar */}
        {!loadingCredit && userCredit && userCredit.chatCredits <= 0 ? (
          <div className="p-4 bg-[#FFFFFF] border-t border-gray-200 flex flex-col items-center justify-center gap-1.5 shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#c34c36]" />
            <span className="text-xs font-bold text-[#24263e]">
              {lang === 'vi' ? 'Bạn đã hết lượt Chat AI' : 'Out of AI Chat credits'}
            </span>
            <span className="text-[10px] text-[#24263e]/70">
              {lang === 'vi' ? 'Vui lòng nạp thêm Credit để tiếp tục.' : 'Please top up to continue.'}
            </span>
            <button
              onClick={() => { window.location.href = '#topup'; }}
              className="mt-1 px-4 py-1.5 bg-[#c34c36] hover:bg-[#a83d2a] text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer"
            >
              {lang === 'vi' ? 'Nạp Thêm Credit (Topup)' : 'Top Up Credits'}
            </button>
          </div>
        ) : (
        <div className={`p-3 border-t flex items-center gap-2 shrink-0 ${
          currentRole === 'seller' ? 'bg-slate-50 border-slate-200' : 'bg-[#FFFFFF] border-gray-200'
        }`}>
          {currentRole === 'buyer' && !hasPendingOffer && (
            <button
              onClick={() => setShowOfferForm(!showOfferForm)}
              className="px-3 py-2 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1 bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95"
            >
              <span>💰</span>
              <span>{lang === 'vi' ? 'Trả giá / Offer' : 'Make Offer'}</span>
            </button>
          )}

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              lang === 'vi'
                ? (currentRole === 'seller' ? 'Tư vấn cho người mua...' : 'Nhắn tin thương lượng (an toàn 100% qua Escrow)...')
                : 'Chat & negotiate safely via Escrow...'
            }
            className={`flex-1 px-3.5 py-2 border rounded-xl text-xs text-[#24263e] focus:outline-none ${
              currentRole === 'seller' 
                ? 'bg-white border-slate-200 focus:border-blue-500' 
                : 'bg-[#faf8f5] border-gray-200 focus:border-[#c34c36]'
            }`}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={isSending}
            className={`p-2.5 text-white rounded-xl cursor-pointer transition shadow-xs flex items-center justify-center ${
              currentRole === 'seller' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#24263e] hover:bg-black'
            }`}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};
