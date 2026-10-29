import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChatMessage, Listing, Language, UserRole, UserCredit, UserProfile } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { dialogService } from '../../utils/dialogService';
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
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
  Clock,
  ShieldCheck,
  Home,
  Building2,
} from 'lucide-react';
import { reviewService } from '../../data/mockReviews';
import {
  negotiationService,
  chatService,
  getStoredUser,
  parseSystemMessage,
  ChatMessageDto,
  ChatRoomDto,
  SystemOfferPayload,
  topupService,
  reputationService,
  SellerReputationDto,
  getAssessmentStatusMeta,
} from '../../services';
import { SystemInspectionProposalPayload } from '../../types';
import { formatVndInput, cleanVndInput } from '../../utils/numberToWords';

// In-memory cache to instantly retrieve known ChatRoom per PostId without duplicate API calls
const postRoomCache = new Map<string, ChatRoomDto>();

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
  initialRoom?: ChatRoomDto;
  currentUser?: UserProfile | null;
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
  partnerAvatar,
  initialRoom,
  currentUser: propCurrentUser
}) => {
  const t = translations[lang];
  const currentUser = propCurrentUser || getStoredUser();
  const effectiveUserId = currentUser?.id ? String(currentUser.id) : null;

  const [activeRoom, setActiveRoom] = useState<ChatRoomDto | null>(initialRoom || null);

  // Sync activeRoom whenever initialRoom prop changes
  useEffect(() => {
    if (initialRoom) {
      setActiveRoom(initialRoom);
    }
  }, [initialRoom]);

  // Role detection scoped to this specific listing / chat room:
  // An account with system role 'seller' can still be the BUYER when inquiring/buying another seller's listing!
  const isExplicitBuyer = Boolean(
    effectiveUserId && activeRoom?.buyerId && effectiveUserId.toLowerCase() === String(activeRoom.buyerId).toLowerCase()
  );

  const isExplicitSeller = Boolean(
    effectiveUserId && activeRoom?.sellerId && effectiveUserId.toLowerCase() === String(activeRoom.sellerId).toLowerCase()
  );

  const isListingSeller = Boolean(
    effectiveUserId && listing?.sellerId && effectiveUserId.toLowerCase() === String(listing.sellerId).toLowerCase()
  );

  const isListingBuyer = Boolean(
    effectiveUserId && listing?.sellerId && effectiveUserId.toLowerCase() !== String(listing.sellerId).toLowerCase()
  );

  // If user is explicitly the room's buyer, they CANNOT be seller!
  // If user is inquiring on another seller's listing (listing.sellerId !== effectiveUserId), they are buyer!
  const isSeller = isExplicitBuyer
    ? false
    : isExplicitSeller
    ? true
    : isListingSeller
    ? true
    : isListingBuyer
    ? false
    : currentRole === 'seller';

  const isBuyer = !isSeller;
  const chatRole: 'seller' | 'buyer' = isSeller ? 'seller' : 'buyer';

  const isNameOfCurrentUser = useCallback((name?: string) => {
    if (!name || !currentUser) return false;
    const n = name.trim().toLowerCase();
    const myName = (currentUser.fullName || currentUser.name || '').trim().toLowerCase();
    const myEmail = (currentUser.email || '').trim().toLowerCase();
    return (myName && n === myName) || (myEmail && n === myEmail);
  }, [currentUser]);

  const resolvedPartnerName = useMemo(() => {
    if (isSeller) {
      if (activeRoom?.buyerName && !isNameOfCurrentUser(activeRoom.buyerName)) {
        return activeRoom.buyerName;
      }
      if (partnerName && !isNameOfCurrentUser(partnerName)) {
        return partnerName;
      }
      return lang === 'vi' ? 'Người Mua' : 'Buyer';
    } else {
      if (activeRoom?.sellerName && !isNameOfCurrentUser(activeRoom.sellerName)) {
        return activeRoom.sellerName;
      }
      if (listing.sellerName && !isNameOfCurrentUser(listing.sellerName)) {
        return listing.sellerName;
      }
      if (partnerName && !isNameOfCurrentUser(partnerName)) {
        return partnerName;
      }
      return lang === 'vi' ? 'Người Bán' : 'Seller';
    }
  }, [isSeller, activeRoom, partnerName, listing.sellerName, isNameOfCurrentUser, lang]);

  const resolvedPartnerAvatar = useMemo(() => {
    const defaultBuyerAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200";
    const defaultSellerAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

    if (isSeller) {
      return activeRoom?.buyerAvatar || partnerAvatar || defaultBuyerAvatar;
    } else {
      return activeRoom?.sellerAvatar || listing.sellerAvatar || partnerAvatar || defaultSellerAvatar;
    }
  }, [isSeller, activeRoom, partnerAvatar, listing.sellerAvatar]);

  const sellerTrust = reviewService.getSellerTrustProfile(listing.sellerId, listing.sellerName);
  const [sellerReputation, setSellerReputation] = useState<SellerReputationDto | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (listing.sellerId) {
      reputationService.getSellerReputation(listing.sellerId)
        .then((rep) => {
          if (isMounted) setSellerReputation(rep);
        })
        .catch((err) => {
          console.warn('Could not fetch seller reputation:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [listing.sellerId]);

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
  const isSendingOfferRef = useRef(false);
  const isSendingInspectionRef = useRef(false);
  const isSendingMessageRef = useRef(false);
  const isRespondingOfferRef = useRef(false);
  const isCancellingOfferRef = useRef(false);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inspection Proposal Negotiation state
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [inspectionMethod, setInspectionMethod] = useState<'AT_CENTER' | 'AT_HOME'>('AT_CENTER');
  const [inspectionFeeSplit, setInspectionFeeSplit] = useState<'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100'>('SPLIT_50_50');
  const [inspectionFeeAmount, setInspectionFeeAmount] = useState(150000);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionNote, setInspectionNote] = useState('');

  // Fetch User Credit (only for sellers/admins, buyers do not use credit system)
  useEffect(() => {
    if (isBuyer) {
      setLoadingCredit(false);
      return;
    }

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
  }, [isBuyer]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const notifyChatInteraction = useCallback((targetRoomId?: string, text?: string) => {
    const rid = targetRoomId || roomId || activeRoom?.id;
    if (!rid && !listing?.id) return;
    try {
      if (rid) {
        localStorage.setItem(`chat_room_latest_touch_${rid}`, Date.now().toString());
        if (text) {
          localStorage.setItem(`chat_room_latest_msg_${rid}`, text);
        }
      }
      window.dispatchEvent(
        new CustomEvent('chat_message_sent', {
          detail: {
            roomId: rid,
            postId: listing?.id,
            message: text,
            timestamp: Date.now(),
          },
        })
      );
    } catch {}
  }, [roomId, activeRoom?.id, listing?.id]);

  // Convert ChatMessageDto from backend to ChatMessage for UI
  const mapDtoToChatMessage = useCallback(
    (dto: ChatMessageDto): ChatMessage => {
      const isSenderMe = Boolean(effectiveUserId && dto.senderId && String(dto.senderId) === effectiveUserId);
      const parsedSys = parseSystemMessage(dto.messageContent);

      const isSystem = parsedSys.isSystem;
      const senderRole: 'buyer' | 'seller' | 'system' = isSystem
        ? 'system'
        : isSenderMe
        ? chatRole
        : (activeRoom?.sellerId && String(dto.senderId) === String(activeRoom.sellerId))
        ? 'seller'
        : (activeRoom?.buyerId && String(dto.senderId) === String(activeRoom.buyerId))
        ? 'buyer'
        : isBuyer
        ? 'seller'
        : 'buyer';

      const senderName = isSystem
        ? 'SecondLife System'
        : isSenderMe
        ? (lang === 'vi' ? 'Bạn' : 'You')
        : resolvedPartnerName;

      const timeStr = dto.sentAt
        ? new Date(dto.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      let isOffer = false;
      let offerAmountVnd: number | undefined;
      let offerStatus: 'pending' | 'accepted' | 'declined' | undefined;
      let negotiationId: string | undefined;
      let offerSenderRole: 'buyer' | 'seller' | undefined;

      if (parsedSys.offer) {
        isOffer = true;
        offerAmountVnd = parsedSys.offer.price;
        negotiationId = parsedSys.offer.negotiationId;
        offerSenderRole = parsedSys.offer.senderRole || (parsedSys.offer.negotiationId?.startsWith('seller-offer-') ? 'seller' : 'buyer');
        offerStatus =
          parsedSys.offer.status === 'ACCEPTED'
            ? 'accepted'
            : parsedSys.offer.status === 'REJECTED' || parsedSys.offer.status === 'CANCELLED'
            ? 'declined'
            : 'pending';
      }

      let isInspectionProposal = false;
      let inspectionProposal: SystemInspectionProposalPayload | undefined;
      if (parsedSys.inspectionProposal) {
        isInspectionProposal = true;
        inspectionProposal = parsedSys.inspectionProposal;
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
        offerSenderRole,
        negotiationId,
        isInspectionProposal,
        inspectionProposal,
      };
    },
    [effectiveUserId, chatRole, activeRoom, isBuyer, lang, resolvedPartnerName]
  );

  const mapDtoRef = useRef(mapDtoToChatMessage);
  useEffect(() => {
    mapDtoRef.current = mapDtoToChatMessage;
  }, [mapDtoToChatMessage]);

  // Initialize or fetch Chat Room from Backend
  useEffect(() => {
    let isMounted = true;
    const initRoom = async () => {
      if (!listing?.id) return;
      setLoadingRoom(true);
      try {
        let finalRoomId = predefinedRoomId;
        let resolvedRoom = activeRoom;

        // 1. Fast Path: Use in-memory cache for this post if room was already visited
        if (!finalRoomId && postRoomCache.has(listing.id)) {
          const cached = postRoomCache.get(listing.id)!;
          finalRoomId = cached.id;
          resolvedRoom = cached;
          if (isMounted) setActiveRoom(cached);
        }

        console.log('[ChatModal] initRoom - predefinedRoomId:', predefinedRoomId, 'finalRoomId:', finalRoomId);
        
        // 2. Network Path: Only call API if room is not yet resolved
        if (!finalRoomId) {
          // API: POST /api/v1/chats/rooms?postId={postId}
          // Only creates/fetches room for current user as buyer
          const room = await chatService.getOrCreateRoom(listing.id);
          if (room?.id) {
            finalRoomId = room.id;
            resolvedRoom = room;
            postRoomCache.set(listing.id, room);
            if (isMounted) setActiveRoom(room);
          }
        } else if (!resolvedRoom || !resolvedRoom.sellerId || !resolvedRoom.buyerId) {
          // Non-blocking background sync if room is lacking party details
          chatService.getRoom(listing.id)
            .then((room) => {
              if (room && isMounted) {
                setActiveRoom(room);
                postRoomCache.set(listing.id, room);
              }
            })
            .catch(() => {});
        }

        console.log('[ChatModal] initRoom - resolved finalRoomId:', finalRoomId);

        if (!isMounted) return;

        // 3. Load message history
        if (finalRoomId) {
          setRoomId(finalRoomId);
          // API: GET /api/v1/chats/{roomId}/messages
          const historyDtos = await chatService.getMessages(finalRoomId);
          if (isMounted && Array.isArray(historyDtos)) {
            const uiMsgs = historyDtos.map((dto) => mapDtoRef.current(dto));
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
  }, [listing.id, predefinedRoomId]);

  // Helper to deduplicate and cleanly synchronize incoming messages (WS or periodic fetch)
  const syncIncomingMessage = useCallback((uiMsg: ChatMessage) => {
    setMessages((prev) => {
      // 1. If exact id already exists:
      if (prev.some((m) => m.id === uiMsg.id)) {
        return prev;
      }

      // 2. If it's an OFFER: match by negotiationId
      if (uiMsg.negotiationId) {
        const existingOfferIndex = prev.findIndex(
          (m) =>
            m.negotiationId === uiMsg.negotiationId ||
            m.id === `nego-${uiMsg.negotiationId}` ||
            (m.isOffer && m.offerAmountVnd === uiMsg.offerAmountVnd && m.offerStatus === uiMsg.offerStatus)
        );
        if (existingOfferIndex !== -1) {
          const next = [...prev];
          next[existingOfferIndex] = {
            ...next[existingOfferIndex],
            ...uiMsg,
            id: uiMsg.id, // Upgrade temp id to real backend message id
          };
          return next;
        }
      }

      // 3. If it's an INSPECTION PROPOSAL: match by proposalId
      if (uiMsg.inspectionProposal?.proposalId) {
        const existingPropIndex = prev.findIndex(
          (m) =>
            m.inspectionProposal?.proposalId === uiMsg.inspectionProposal?.proposalId ||
            m.id === uiMsg.inspectionProposal?.proposalId
        );
        if (existingPropIndex !== -1) {
          const next = [...prev];
          next[existingPropIndex] = {
            ...next[existingPropIndex],
            ...uiMsg,
            id: uiMsg.id,
          };
          return next;
        }
      }

      // 4. If standard text message: replace matching optimistic message
      const optIndex = prev.findIndex(
        (m) =>
          (m.id.startsWith('msg-') || m.id.startsWith('temp-')) &&
          m.text.trim() === uiMsg.text.trim()
      );
      if (optIndex !== -1) {
        const next = [...prev];
        next[optIndex] = uiMsg;
        return next;
      }

      // 5. Truly new message
      return [...prev, uiMsg];
    });
  }, []);

  // Subscribe to WebSocket for real-time messages (/user/queue/messages)
  useEffect(() => {
    if (!roomId) return;

    // Connect WS
    chatService.connectWebSocket();

    const unsubscribe = chatService.subscribeToMessages((newDto: ChatMessageDto) => {
      // Check if message belongs to this room
      if (newDto.conversationId === roomId) {
        const uiMsg = mapDtoRef.current(newDto);
        syncIncomingMessage(uiMsg);
        notifyChatInteraction(roomId, newDto.messageContent);
        setTimeout(scrollToBottom, 60);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, syncIncomingMessage, notifyChatInteraction]);

  // Periodic background sync while ChatModal is open to guarantee real-time updates without page reset
  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;
    const intervalId = setInterval(async () => {
      try {
        const historyDtos = await chatService.getMessages(roomId);
        if (isMounted && Array.isArray(historyDtos)) {
          historyDtos.forEach((dto) => {
            const uiMsg = mapDtoRef.current(dto);
            syncIncomingMessage(uiMsg);
          });
        }
      } catch (err) {
        // silent background sync
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [roomId, syncIncomingMessage]);

  // 1. Phân tích trạng thái mới nhất của từng phiên thương lượng (theo negotiationId)
  const negotiationMap = new Map<string, { id: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'; price: number }>();
  messages.forEach((m) => {
    const parsed = parseSystemMessage(m.text);
    if (parsed.offer && parsed.offer.negotiationId) {
      negotiationMap.set(parsed.offer.negotiationId, {
        id: parsed.offer.negotiationId,
        status: parsed.offer.status,
        price: parsed.offer.price,
      });
    } else if (m.isOffer && m.negotiationId) {
      negotiationMap.set(m.negotiationId, {
        id: m.negotiationId,
        status: m.offerStatus === 'accepted' ? 'ACCEPTED' : m.offerStatus === 'declined' ? 'REJECTED' : 'PENDING',
        price: m.offerAmountVnd || listing.priceVnd,
      });
    }
  });

  // Chỉ coi là có pending offer nếu có phiên thương lượng mà trạng thái MỚI NHẤT là PENDING
  const activePendingNegotiation = Array.from(negotiationMap.values()).find(
    (n) => n.status === 'PENDING'
  );
  const hasPendingOffer = !!activePendingNegotiation;

  // Danh sách các phiên thương lượng bị từ chối
  const rejectedNegotiations = Array.from(negotiationMap.values()).filter(
    (n) => n.status === 'REJECTED'
  );
  // Mức giá cao nhất từng bị từ chối
  const maxRejectedPrice = rejectedNegotiations.reduce(
    (max, n) => Math.max(max, n.price),
    0
  );
  const maxRejectionsAllowed = 3;
  const isMaxRejectionsReached = rejectedNegotiations.length >= maxRejectionsAllowed;

  // Lấy giá thương lượng được chấp thuận mới nhất (nếu có)
  const acceptedNegotiations = Array.from(negotiationMap.values()).filter(
    (n) => n.status === 'ACCEPTED'
  );
  const latestAccepted = acceptedNegotiations[acceptedNegotiations.length - 1];
  const latestAcceptedOffer = latestAccepted?.price;
  const latestAcceptedNegotiationId = latestAccepted?.id;

  const [aiAdvice, setAiAdvice] = useState<{
    counterOfferVnd: number;
    adviceText: string;
    warningMessage: string | null;
  }>({
    counterOfferVnd: Math.round((listing.priceVnd * (isBuyer ? 0.95 : 0.98)) / 100000) * 100000,
    adviceText: isBuyer 
      ? 'Mức giá đề xuất của người mua (-5% đến -8%) nằm trong biên độ thanh khoản cao của thị trường đồ cũ tại Việt Nam.' 
      : 'Khách hàng này có lịch sử chốt đơn nhanh. Chủ động đề xuất giảm nhẹ (2%) để tăng khả năng chốt đơn ngay!',
    warningMessage: null
  });

  // Send standard text message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isSendingMessageRef.current || isSending) return;
    isSendingMessageRef.current = true;

    const scamTriggers = ['zalo', 'whatsapp', 'chuyển khoản trước', 'cọc ngoài', 'gửi link', 'ship ngoài'];
    const hasScam = scamTriggers.some((t) => text.toLowerCase().includes(t));

    const tempId = `msg-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: currentUser?.id || chatRole,
      senderName: 'Bạn',
      senderRole: chatRole,
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isSending: true,
      isFailed: false,
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Mất kết nối Internet');
      }

      let targetRoomId = roomId;
      if (!targetRoomId && listing?.id) {
        const room = await chatService.getOrCreateRoom(listing.id);
        if (room?.id) {
          targetRoomId = room.id;
          setRoomId(room.id);
          setActiveRoom(room);
          postRoomCache.set(listing.id, room);
        }
      }

      if (!targetRoomId) {
        throw new Error('Không thể kết nối phòng chat đến máy chủ Backend');
      }

      // Call Backend API: POST /api/v1/chats/{roomId}/messages
      const res = await chatService.sendMessage(targetRoomId, text);
      if (res?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: res.id, isSending: false, isFailed: false } : m))
        );
        notifyChatInteraction(targetRoomId, text);
      } else {
        throw new Error('Máy chủ không phản hồi mã tin nhắn');
      }
    } catch (err: any) {
      console.warn('Could not send message via backend API, marking as failed:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                isSending: false,
                isFailed: true,
                errorReason: err?.message || 'Không thể gửi tin nhắn'
              }
            : m
        )
      );
    } finally {
      isSendingMessageRef.current = false;
      setIsSending(false);
    }
  };

  // Retry sending failed message
  const handleRetrySendMessage = async (failedMsg: ChatMessage) => {
    if (!failedMsg || isSending) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, isSending: true, isFailed: false } : m))
    );
    setIsSending(true);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Mất kết nối Internet');
      }

      let targetRoomId = roomId;
      if (!targetRoomId && listing?.id) {
        const room = await chatService.getOrCreateRoom(listing.id);
        if (room?.id) {
          targetRoomId = room.id;
          setRoomId(room.id);
          setActiveRoom(room);
        }
      }

      if (!targetRoomId) {
        throw new Error('Không thể kết nối phòng chat đến máy chủ Backend');
      }

      const res = await chatService.sendMessage(targetRoomId, failedMsg.text);
      if (res?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === failedMsg.id ? { ...m, id: res.id, isSending: false, isFailed: false } : m))
        );
      } else {
        throw new Error('Máy chủ không phản hồi mã tin nhắn');
      }
    } catch (err: any) {
      console.warn('Retry sending message failed:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id
            ? {
                ...m,
                isSending: false,
                isFailed: true,
                errorReason: err?.message || 'Không thể gửi lại tin nhắn'
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleRemoveFailedMessage = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Send official negotiation offer (Buyer or Seller)
  const handleSendOffer = async () => {
    if (!offerInput || offerInput <= 0 || isSendingOfferRef.current) {
      if (!offerInput || offerInput <= 0) {
        setOfferError(
          lang === 'vi'
            ? (isSeller ? 'Vui lòng nhập mức giá bạn muốn đề xuất bán (VNĐ).' : 'Vui lòng nhập mức giá bạn muốn đề xuất mua (VNĐ).')
            : 'Please enter an offer price (VND).'
        );
      }
      return;
    }
    if (offerInput >= listing.priceVnd) {
      setOfferError(
        lang === 'vi'
          ? (isSeller
              ? 'Mức giá đề xuất bán ưu đãi phải thấp hơn giá niêm yết ban đầu.'
              : `Mức giá đề xuất phải thấp hơn giá gốc (${formatVND(listing.priceVnd)})`)
          : `Offer price must be lower than original price (${formatVND(listing.priceVnd)})`
      );
      return;
    }
    if (offerInput < 1000) {
      setOfferError(lang === 'vi' ? 'Mức giá đề xuất tối thiểu là 1.000 đ' : 'Minimum offer is 1,000 VND');
      return;
    }
    if (!isSeller && maxRejectedPrice > 0 && offerInput <= maxRejectedPrice) {
      setOfferError(
        lang === 'vi'
          ? `Mức giá mới phải lớn hơn mức giá cao nhất đã bị từ chối (${formatVND(maxRejectedPrice)})`
          : `Offer must be strictly higher than your highest rejected price (${formatVND(maxRejectedPrice)})`
      );
      return;
    }

    isSendingOfferRef.current = true;
    setNegotiationLoading(true);
    setOfferError(null);

    try {
      if (isSeller) {
        // Seller proposal flow
        const offerId = `seller-offer-${Date.now()}`;
        const offerPayload: SystemOfferPayload = {
          type: 'OFFER',
          status: 'PENDING',
          price: offerInput,
          negotiationId: offerId,
          senderRole: 'seller',
        };
        const systemText = `SYSTEM: ${JSON.stringify(offerPayload)}`;

        const localOfferMsg: ChatMessage = {
          id: offerId,
          senderId: currentUser?.id || chatRole,
          senderName: listing.sellerName || 'Người bán',
          senderRole: 'system',
          text: systemText,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isOffer: true,
          offerAmountVnd: offerInput,
          offerStatus: 'pending',
          offerSenderRole: 'seller',
          negotiationId: offerId,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.negotiationId === offerId || m.id === offerId)) return prev;
          return [...prev, localOfferMsg];
        });
        setShowOfferForm(false);
        setOfferError(null);
        setTimeout(scrollToBottom, 50);

        let targetRoomId = roomId;
        if (!targetRoomId && listing?.id) {
          const room = await chatService.getOrCreateRoom(listing.id);
          if (room?.id) {
            targetRoomId = room.id;
            setRoomId(room.id);
            setActiveRoom(room);
            postRoomCache.set(listing.id, room);
          }
        }

        if (targetRoomId) {
          await chatService.sendMessage(targetRoomId, systemText);
        }
        notifyChatInteraction(targetRoomId, `Người bán đề xuất giá: ${formatVND(offerInput)}`);
      } else {
        // Buyer offer flow (via Backend API)
        const res = await negotiationService.createNegotiation(listing.id, offerInput);
        setShowOfferForm(false);
        setOfferError(null);

        if (res?.id) {
          const localOfferMsg: ChatMessage = {
            id: `nego-${res.id}`,
            senderId: currentUser?.id || chatRole,
            senderName: isBuyer ? 'Bạn' : listing.sellerName,
            senderRole: 'system',
            text: `SYSTEM: {"type":"OFFER","status":"PENDING","price":${offerInput},"negotiationId":"${res.id}","senderRole":"buyer"}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            isOffer: true,
            offerAmountVnd: offerInput,
            offerStatus: 'pending',
            offerSenderRole: 'buyer',
            negotiationId: res.id,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.negotiationId === res.id || m.id === `nego-${res.id}`)) return prev;
            return [...prev, localOfferMsg];
          });
          notifyChatInteraction(roomId || activeRoom?.id, `Đề xuất giá: ${formatVND(offerInput)}`);
          setTimeout(scrollToBottom, 50);
        }
      }
    } catch (err: any) {
      console.warn('Negotiation creation error:', err);
      const msg = err?.response?.data?.message || err?.message || '';
      if (msg.includes('internal error') || msg.includes('500')) {
        setOfferError('Máy chủ Backend gặp lỗi nội bộ (500) khi lưu đàm phán hoặc gửi tin nhắn hệ thống. Vui lòng kiểm tra lại server.');
      } else if (msg.includes('strictly greater than your highest rejected price') || msg.includes('highest rejected price')) {
        const match = msg.match(/highest rejected price:\s*(\d+)/i) || msg.match(/(\d+(?:\.\d+)?)/);
        const rejectedNum = match ? Number(match[1] || match[0]) : maxRejectedPrice;
        const formattedNum = rejectedNum ? formatVND(rejectedNum) : '';
        setOfferError(
          lang === 'vi'
            ? `Mức giá đề xuất mới phải lớn hơn mức giá cao nhất từng bị từ chối (${formattedNum || formatVND(maxRejectedPrice)}).`
            : `Offered price must be strictly greater than your highest rejected price: ${formattedNum}`
        );
      } else if (msg.includes('maximum number of rejected negotiations')) {
        setOfferError(
          lang === 'vi'
            ? 'Bạn đã đạt số lần tối đa bị từ chối đàm phán cho sản phẩm này (tối đa 3 lần).'
            : msg
        );
      } else if (msg.includes('already have an active negotiation')) {
        setOfferError(
          lang === 'vi'
            ? 'Bạn đang có một yêu cầu đàm phán giá đang chờ người bán phản hồi.'
            : msg
        );
      } else if (msg.includes('lower than') || msg.includes('must be lower')) {
        setOfferError(
          lang === 'vi'
            ? 'Mức giá đề xuất phải thấp hơn giá gốc của bài đăng.'
            : 'Offered price must be lower than original post price.'
        );
      } else {
        setOfferError(msg || 'Không thể tạo đề xuất thương lượng. Mức giá đề xuất phải thấp hơn giá gốc.');
      }
    } finally {
      isSendingOfferRef.current = false;
      setNegotiationLoading(false);
    }
  };

  // Seller accepts/rejects buyer offer OR Buyer accepts/rejects seller offer
  const handleRespondOffer = async (
    negotiationId: string,
    action: 'accepted' | 'declined',
    senderRole?: 'buyer' | 'seller',
    price?: number
  ) => {
    if (isRespondingOfferRef.current) return;
    isRespondingOfferRef.current = true;
    try {
      const isSellerOffer = senderRole === 'seller' || negotiationId.startsWith('seller-offer-');
      const actionUpper = action === 'accepted' ? 'ACCEPTED' : 'REJECTED';
      let systemTextToSend = '';

      if (!isSellerOffer) {
        if (action === 'accepted') {
          // PUT /api/v1/negotiations/{id}/accept
          await negotiationService.acceptNegotiation(negotiationId);
        } else {
          // PUT /api/v1/negotiations/{id}/reject
          await negotiationService.rejectNegotiation(negotiationId);
        }
      }

      // Update offer status in local state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.negotiationId === negotiationId || m.id === `nego-${negotiationId}` || m.id === negotiationId) {
            const finalPrice = price || m.offerAmountVnd || listing.priceVnd;
            const updatedPayload: SystemOfferPayload = {
              type: 'OFFER',
              status: actionUpper,
              price: finalPrice,
              negotiationId,
              senderRole: isSellerOffer ? 'seller' : 'buyer',
            };
            systemTextToSend = `SYSTEM: ${JSON.stringify(updatedPayload)}`;
            return {
              ...m,
              offerStatus: action,
              text: systemTextToSend,
            };
          }
          return m;
        })
      );

      // Broadcast update over chat if seller offer
      if (isSellerOffer && (roomId || activeRoom?.id) && systemTextToSend) {
        try {
          await chatService.sendMessage(roomId || activeRoom!.id, systemTextToSend);
        } catch (e) {
          console.warn('Could not broadcast seller offer response:', e);
        }
      }

      notifyChatInteraction(roomId || activeRoom?.id, action === 'accepted' ? 'Đã chấp nhận đề xuất giá' : 'Đã từ chối đề xuất giá');
    } catch (err: any) {
      console.warn('Backend respond negotiation error:', err);
      dialogService.error(err?.message || 'Thao tác không thành công. Vui lòng thử lại.', 'Lỗi Phản Hồi Trả Giá');
    } finally {
      isRespondingOfferRef.current = false;
    }
  };

  // Buyer or Seller cancels their own pending offer
  const handleCancelOffer = async (
    negotiationId: string,
    senderRole?: 'buyer' | 'seller',
    price?: number
  ) => {
    if (isCancellingOfferRef.current) return;
    isCancellingOfferRef.current = true;
    try {
      const isSellerOffer = senderRole === 'seller' || negotiationId.startsWith('seller-offer-');
      let systemTextToSend = '';

      if (!isSellerOffer) {
        // PUT /api/v1/negotiations/{id}/cancel
        await negotiationService.cancelNegotiation(negotiationId);
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.negotiationId === negotiationId || m.id === `nego-${negotiationId}` || m.id === negotiationId) {
            const finalPrice = price || m.offerAmountVnd || listing.priceVnd;
            const updatedPayload: SystemOfferPayload = {
              type: 'OFFER',
              status: 'CANCELLED',
              price: finalPrice,
              negotiationId,
              senderRole: isSellerOffer ? 'seller' : 'buyer',
            };
            systemTextToSend = `SYSTEM: ${JSON.stringify(updatedPayload)}`;
            return {
              ...m,
              offerStatus: 'declined',
              text: systemTextToSend,
            };
          }
          return m;
        })
      );

      if (isSellerOffer && (roomId || activeRoom?.id) && systemTextToSend) {
        try {
          await chatService.sendMessage(roomId || activeRoom!.id, systemTextToSend);
        } catch (e) {
          console.warn('Could not broadcast offer cancellation:', e);
        }
      }
    } catch (err: any) {
      console.warn('Backend cancel negotiation error:', err);
    } finally {
      isCancellingOfferRef.current = false;
    }
  };

  // Buyer or Seller sends official inspection proposal
  const handleSendInspectionProposal = async () => {
    if (isSendingInspectionRef.current) return;
    isSendingInspectionRef.current = true;
    setInspectionLoading(true);

    const proposalId = `insp-prop-${Date.now()}`;
    const proposalPayload: SystemInspectionProposalPayload = {
      type: 'INSPECTION_PROPOSAL',
      status: 'PENDING',
      method: inspectionMethod,
      feeSplit: inspectionFeeSplit,
      estimatedFeeVnd: inspectionFeeAmount,
      proposedByRole: isSeller ? 'seller' : 'buyer',
      proposalId,
      note: inspectionNote.trim() || undefined,
    };
    const systemText = `SYSTEM: ${JSON.stringify(proposalPayload)}`;

    const localMsg: ChatMessage = {
      id: proposalId,
      senderId: currentUser?.id || chatRole,
      senderName: isBuyer ? 'Bạn' : listing.sellerName,
      senderRole: 'system',
      text: systemText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isInspectionProposal: true,
      inspectionProposal: proposalPayload,
    };

    // Optimistically update UI immediately (0ms latency, eliminates perceived delay)
    setMessages((prev) => {
      if (prev.some((m) => m.inspectionProposal?.proposalId === proposalId || m.id === proposalId)) {
        return prev;
      }
      return [...prev, localMsg];
    });
    setShowInspectionForm(false);
    setTimeout(scrollToBottom, 50);

    try {
      let targetRoomId = roomId;
      if (!targetRoomId && listing?.id) {
        const room = await chatService.getOrCreateRoom(listing.id);
        if (room?.id) {
          targetRoomId = room.id;
          setRoomId(room.id);
          setActiveRoom(room);
          postRoomCache.set(listing.id, room);
        }
      }

      if (targetRoomId) {
        await chatService.sendMessage(targetRoomId, systemText);
      }
    } catch (err: any) {
      console.warn('Could not send inspection proposal to backend:', err);
    } finally {
      isSendingInspectionRef.current = false;
      setInspectionLoading(false);
    }
  };

  const handleRespondInspectionProposal = async (proposalId: string, action: 'ACCEPTED' | 'REJECTED') => {
    let systemTextToSend = '';
    setMessages((prev) =>
      prev.map((m) => {
        if (m.inspectionProposal && (m.inspectionProposal.proposalId === proposalId || m.id === proposalId)) {
          const updated: SystemInspectionProposalPayload = { ...m.inspectionProposal, status: action };
          systemTextToSend = `SYSTEM: ${JSON.stringify(updated)}`;
          return {
            ...m,
            inspectionProposal: updated,
            text: systemTextToSend,
          };
        }
        return m;
      })
    );

    if (roomId && systemTextToSend) {
      try {
        await chatService.sendMessage(roomId, systemTextToSend);
      } catch (err) {
        console.warn('Could not broadcast inspection response:', err);
      }
    }
  };

  const handleCancelInspectionProposal = async (proposalId: string) => {
    let systemTextToSend = '';
    setMessages((prev) =>
      prev.map((m) => {
        if (m.inspectionProposal && (m.inspectionProposal.proposalId === proposalId || m.id === proposalId)) {
          const updated: SystemInspectionProposalPayload = { ...m.inspectionProposal, status: 'CANCELLED' };
          systemTextToSend = `SYSTEM: ${JSON.stringify(updated)}`;
          return {
            ...m,
            inspectionProposal: updated,
            text: systemTextToSend,
          };
        }
        return m;
      })
    );

    if (roomId && systemTextToSend) {
      try {
        await chatService.sendMessage(roomId, systemTextToSend);
      } catch (err) {
        console.warn('Could not broadcast cancel inspection:', err);
      }
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
          isSeller 
            ? 'bg-gradient-to-r from-[#24263e] to-slate-800 text-white border-slate-700' 
            : 'bg-gradient-to-r from-[#fce5da] to-white border-[#24263e]/15 text-[#24263e]'
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={resolvedPartnerAvatar}
              alt={resolvedPartnerName}
              className={`w-11 h-11 rounded-xl object-cover shrink-0 ${isSeller ? 'border-2 border-white/20' : 'border border-[#24263e]/20'}`}
            />
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-extrabold text-xs truncate ${isSeller ? 'text-white' : 'text-[#24263e]'}`}>
                  {resolvedPartnerName}
                </span>
                
                {isSeller ? (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-200 rounded text-[9px] font-bold border border-blue-400/30">
                    {lang === 'vi' ? 'Người mua' : 'Buyer'}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold border border-emerald-300">
                    {lang === 'vi' ? 'Người bán' : 'Seller'}
                  </span>
                )}

                {/* Seller Reputation Score Pill */}
                {isBuyer && (
                  <button
                    type="button"
                    onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[10px] font-black text-amber-800 shadow-2xs hover:bg-amber-50 cursor-pointer transition"
                    title="Bấm để xem chi tiết uy tín và đánh giá từ người mua khác"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>
                      {sellerReputation?.assessmentStatus === 'NO_TRANSACTIONS'
                        ? 'Người bán mới'
                        : sellerReputation?.score !== undefined && sellerReputation?.score !== null
                        ? `${sellerReputation.score}/100 uy tín`
                        : `${sellerTrust.trustScore} điểm uy tín`}
                    </span>
                    <span className="text-slate-400">|</span>
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>{sellerTrust.rating}</span>
                    {sellerReputation?.assessmentStatus && (
                      <span className="ml-1 text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                        {getAssessmentStatusMeta(sellerReputation.assessmentStatus).shortLabel}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <div className={`text-[11px] truncate mt-0.5 ${isSeller ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className={`font-semibold ${isSeller ? 'text-white' : 'text-slate-800'}`}>{listing.title}</span> •{' '}
                <span className={`font-bold ${isSeller ? 'text-[#e36a54]' : 'text-[#c34c36]'}`}>{formatVND(listing.priceVnd)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Buy Now button in header */}
            {isBuyer && (
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
                isSeller 
                  ? 'text-slate-300 hover:text-white hover:bg-white/10' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Accepted Offer Sticky Banner */}
        {latestAcceptedOffer && isBuyer && (
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
            <div className="space-y-3.5 p-2 animate-pulse">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                <div className="space-y-1.5 max-w-[70%]">
                  <div className="w-24 h-3 bg-slate-200 rounded" />
                  <div className="w-48 h-8 bg-slate-200 rounded-2xl rounded-tl-none" />
                </div>
              </div>
              <div className="flex items-start justify-end gap-2.5">
                <div className="space-y-1.5 max-w-[70%] flex flex-col items-end">
                  <div className="w-20 h-3 bg-slate-200 rounded" />
                  <div className="w-44 h-8 bg-[#c34c36]/20 rounded-2xl rounded-tr-none" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#c34c36]/20 shrink-0" />
              </div>
              <div className="flex items-center justify-center gap-2 pt-4 text-slate-400">
                <Loader2 className="w-4 h-4 text-[#c34c36] animate-spin" />
                <span className="text-xs font-medium text-slate-500">
                  {lang === 'vi' ? 'Đang kết nối phòng chat bảo mật...' : 'Connecting to secure chat room...'}
                </span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-2">
              <ShoppingBag className={`w-10 h-10 ${isSeller ? 'text-blue-200' : 'text-slate-300'}`} />
              <p className="text-xs font-semibold text-slate-500">
                {lang === 'vi'
                  ? (isSeller 
                      ? 'Người mua đang quan tâm đến sản phẩm của bạn. Hãy gửi tin nhắn chào hỏi!' 
                      : 'Chưa có tin nhắn nào. Hãy gửi tin nhắn hoặc đề xuất giá đầu tiên!')
                  : 'No messages yet. Send a message or make an offer!'}
              </p>
            </div>
          ) : (
            messages.map((msg, msgIndex) => {
              const parsedSys = parseSystemMessage(msg.text);

              // -------------------------------------------------------------
              // 4. XỬ LÝ "TIN NHẮN HỆ THỐNG" (SYSTEM MESSAGE) KHI THƯƠNG LƯỢNG
              // Render bong bóng / thông báo ở CHÍNH GIỮA MÀN HÌNH thay vì lệch trái/phải
              // -------------------------------------------------------------
              if (parsedSys.isSystem) {
                // If it's a structured OFFER from backend or seller proposal
                if (parsedSys.offer || msg.isOffer) {
                  const offer = parsedSys.offer || {
                    price: msg.offerAmountVnd || 0,
                    status: (msg.offerStatus?.toUpperCase() as any) || 'PENDING',
                    negotiationId: msg.negotiationId || msg.id,
                    senderRole: msg.offerSenderRole,
                  };

                  // Nếu có tin nhắn trạng thái mới hơn cho cùng negotiationId này, ẩn tin nhắn cũ đi để không bị trùng lặp thẻ
                  const hasLaterStatusMessage = messages.slice(msgIndex + 1).some((laterMsg) => {
                    const p = parseSystemMessage(laterMsg.text);
                    return (p.offer?.negotiationId && p.offer.negotiationId === offer.negotiationId) ||
                           (laterMsg.isOffer && laterMsg.negotiationId === offer.negotiationId);
                  });
                  if (hasLaterStatusMessage) {
                    return null;
                  }

                  const latestStatus = (offer.negotiationId && negotiationMap.get(offer.negotiationId)?.status) || offer.status;
                  const isAccepted = latestStatus === 'ACCEPTED';
                  const isRejected = latestStatus === 'REJECTED';
                  const isCancelled = latestStatus === 'CANCELLED';
                  const isExpired = false; // Note: EXPIRED is not in SystemOfferPayload
                  const isPending = latestStatus === 'PENDING';
                  
                  const isSellerOffer = offer.senderRole === 'seller' || (Boolean(offer.negotiationId) && offer.negotiationId.startsWith('seller-offer-'));
                  const isProposerMe = isSellerOffer ? isSeller : isBuyer;
                  const isRecipientMe = isSellerOffer ? isBuyer : isSeller;

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
                              : isSellerOffer
                              ? '🏷️ Người Bán Đề Xuất Giá Mới'
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
                            {isSellerOffer ? 'Giảm' : 'Tiết kiệm'} {formatVND(listing.priceVnd - offer.price)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 mb-2">
                          {isAccepted
                            ? (isBuyer
                                ? (lang === 'vi' ? 'Người bán đã chấp nhận mức giá này. Bạn có thể tiến hành đặt cọc qua Escrow ngay bây giờ!' : 'Seller accepted this offer. You can checkout now!')
                                : (lang === 'vi' ? 'Mức giá đã được chốt thành công. Đang chờ người mua tiến hành thanh toán qua Escrow.' : 'You accepted this offer. Waiting for buyer to checkout.'))
                            : isRejected
                            ? (isProposerMe
                                ? (lang === 'vi' ? 'Mức giá đề xuất chưa phù hợp với đối phương. Bạn có thể gửi lại mức giá khác hợp lý hơn.' : 'Offer was declined.')
                                : (lang === 'vi' ? 'Bạn đã từ chối mức giá đề xuất này.' : 'You declined this offer.'))
                            : isCancelled
                            ? (isProposerMe
                                ? (lang === 'vi' ? 'Bạn đã hủy yêu cầu thương lượng giá này.' : 'You cancelled this offer.')
                                : (lang === 'vi' ? 'Đối phương đã hủy yêu cầu thương lượng giá này.' : 'Buyer cancelled this offer.'))
                            : isPending
                            ? (isRecipientMe
                                ? (lang === 'vi'
                                    ? (isSellerOffer
                                        ? 'Người bán chủ động đề xuất mức giá bán ưu đãi cho bạn. Bạn có muốn đồng ý mua với giá này không?'
                                        : 'Người mua gửi đề xuất giá cho sản phẩm của bạn. Vui lòng phản hồi:')
                                    : 'You received a price offer. Please respond:')
                                : (lang === 'vi' ? 'Đề xuất giá đã được gửi tới đối phương, đang chờ phản hồi...' : 'Offer sent, waiting for response...'))
                            : ''}
                        </p>

                        {/* Action buttons inside System Offer Banner for recipient */}
                        {isPending && isRecipientMe && (
                          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-amber-200/60">
                            <button
                              onClick={() => handleRespondOffer(offer.negotiationId, 'accepted', offer.senderRole, offer.price)}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Chấp nhận giá này' : 'Accept Offer'}</span>
                            </button>
                            <button
                              onClick={() => handleRespondOffer(offer.negotiationId, 'declined', offer.senderRole, offer.price)}
                              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Từ chối' : 'Decline'}</span>
                            </button>
                          </div>
                        )}

                        {/* Proposer cancel button */}
                        {isPending && isProposerMe && (
                          <div className="mt-2 pt-2 border-t border-amber-200/60 flex justify-center">
                            <button
                              onClick={() => handleCancelOffer(offer.negotiationId, offer.senderRole, offer.price)}
                              className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              <span>{lang === 'vi' ? 'Hủy đề xuất thương lượng' : 'Cancel Offer'}</span>
                            </button>
                          </div>
                        )}

                        {/* Checkout button for buyer once offer is accepted */}
                        {isAccepted && isBuyer && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 flex justify-center">
                            <button
                              onClick={() => handleBuyNow(offer.price, isSellerOffer ? undefined : offer.negotiationId)}
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

                        {/* Nút gửi lại đề xuất giá mới khi bị từ chối */}
                        {isRejected && currentRole === 'buyer' && !hasPendingOffer && (
                          <div className="mt-2.5 pt-2.5 border-t border-rose-200/60 flex flex-col items-center gap-1.5">
                            {!isMaxRejectionsReached ? (
                              <>
                                <button
                                  onClick={() => {
                                    const minNext = offer.price + 50000;
                                    const suggestedNext = Math.min(
                                      listing.priceVnd - 50000,
                                      Math.max(minNext, Math.round((listing.priceVnd + offer.price) / 2 / 50000) * 50000)
                                    );
                                    setOfferInput(suggestedNext);
                                    setShowOfferForm(true);
                                    setOfferError(null);
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition transform hover:scale-102"
                                >
                                  <span>💰</span>
                                  <span>{lang === 'vi' ? 'Đề xuất mức giá khác' : 'Make Another Offer'}</span>
                                </button>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {lang === 'vi'
                                    ? `(Còn ${maxRejectionsAllowed - rejectedNegotiations.length} lượt thương lượng • Mức giá mới cần > ${formatVND(offer.price)})`
                                    : `(${maxRejectionsAllowed - rejectedNegotiations.length} attempts left • Must be > ${formatVND(offer.price)})`}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-rose-600 font-bold bg-rose-100/60 px-3 py-1 rounded-lg border border-rose-200">
                                {lang === 'vi'
                                  ? 'Đã đạt giới hạn 3 lần thương lượng giá cho sản phẩm này'
                                  : 'Maximum 3 offer attempts reached for this item'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Interactive Inspection Proposal System Message Card
                if (parsedSys.inspectionProposal || msg.inspectionProposal) {
                  const prop = parsedSys.inspectionProposal || msg.inspectionProposal!;
                  const isPending = prop.status === 'PENDING';
                  const isAccepted = prop.status === 'ACCEPTED';
                  const isRejected = prop.status === 'REJECTED';
                  const isCancelled = prop.status === 'CANCELLED';
                  const isProposerMe = prop.proposedByRole === chatRole;

                  return (
                    <div key={msg.id} className="flex justify-center my-3 animate-fadeIn">
                      <div className={`p-4 rounded-2xl border text-xs shadow-md max-w-md w-full transition-all ${
                        isAccepted
                          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-900'
                          : isRejected || isCancelled
                          ? 'bg-slate-50 border-slate-300 text-slate-500'
                          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-slate-900'
                      }`}>
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200/50">
                          <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-tight text-blue-900">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <span>Đề Xuất Phương Án Kiểm Định</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isAccepted
                              ? 'bg-emerald-600 text-white'
                              : isRejected
                              ? 'bg-rose-600 text-white'
                              : isCancelled
                              ? 'bg-slate-400 text-white'
                              : 'bg-blue-600 text-white animate-pulse'
                          }`}>
                            {isAccepted ? 'Đã Đồng Ý' : isRejected ? 'Đã Từ Chối' : isCancelled ? 'Đã Hủy' : 'Chờ Phản Hồi'}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Hình thức kiểm tra:</span>
                            <strong className="text-slate-800 flex items-center gap-1">
                              {prop.method === 'AT_HOME' ? <Home className="w-3.5 h-3.5 text-orange-600" /> : <Building2 className="w-3.5 h-3.5 text-blue-600" />}
                              <span>{prop.method === 'AT_HOME' ? 'Kỹ thuật viên đến tận nhà' : 'Gửi về Hub SecondLife'}</span>
                            </strong>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Phân chia chi phí:</span>
                            <strong className="text-blue-800">
                              {prop.feeSplit === 'SPLIT_50_50'
                                ? `Chia đôi 50/50 (Mỗi bên ${formatVND(Math.round(prop.estimatedFeeVnd / 2))})`
                                : prop.feeSplit === 'SELLER_100'
                                ? `Người bán tài trợ 100% (${formatVND(prop.estimatedFeeVnd)})`
                                : `Người mua thanh toán 100% (${formatVND(prop.estimatedFeeVnd)})`}
                            </strong>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-blue-200/40">
                            <span className="text-slate-500">Tổng phí kiểm định dự kiến:</span>
                            <span className="font-black text-slate-900 text-xs">
                              {formatVND(prop.estimatedFeeVnd)}
                            </span>
                          </div>
                        </div>

                        {/* Actions for receiver */}
                        {isPending && !isProposerMe && (
                          <div className="flex items-center justify-center gap-2 mt-3 pt-2.5 border-t border-blue-200/60">
                            <button
                              onClick={() => handleRespondInspectionProposal(prop.proposalId || msg.id, 'ACCEPTED')}
                              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đồng Ý Kiểm Định</span>
                            </button>
                            <button
                              onClick={() => handleRespondInspectionProposal(prop.proposalId || msg.id, 'REJECTED')}
                              className="py-1.5 px-3 bg-slate-200 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Từ Chối</span>
                            </button>
                          </div>
                        )}

                        {/* Cancel for proposer */}
                        {isPending && isProposerMe && (
                          <div className="mt-2.5 pt-2 border-t border-blue-200/60 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Đang chờ đối phương xác nhận...</span>
                            <button
                              onClick={() => handleCancelInspectionProposal(prop.proposalId || msg.id)}
                              className="text-rose-600 hover:underline cursor-pointer font-bold"
                            >
                              Hủy đề xuất
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
              const isMe = Boolean(
                (effectiveUserId && msg.senderId && String(msg.senderId) === effectiveUserId) ||
                msg.senderName === 'Bạn' ||
                msg.senderName === 'You'
              );

              return (
                <div
                  key={msg.id}
                  className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span className="text-[10px] text-[#24263e]/70 font-medium">
                      {msg.senderName} • {msg.timestamp}
                    </span>

                    {isMe && !msg.isUnsent && !msg.isFailed && (
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

                  {/* Message Bubble + Failed Icon / Sending Indicator */}
                  <div className={`flex items-center gap-1.5 max-w-[85%] ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Dấu chấm than đỏ thể hiện tin nhắn không gửi được khi mất kết nối hoặc lỗi */}
                    {msg.isFailed && (
                      <button
                        type="button"
                        onClick={() => handleRetrySendMessage(msg)}
                        className="p-1 rounded-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer shrink-0 animate-bounce"
                        title={lang === 'vi' ? 'Lỗi gửi tin nhắn (Mất kết nối máy chủ). Nhấn để gửi lại' : 'Message not sent. Click to retry'}
                      >
                        <AlertCircle className="w-5 h-5 text-rose-600 fill-rose-100" />
                      </button>
                    )}

                    {msg.isSending && (
                      <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />
                    )}

                    <div
                      className={`rounded-2xl p-3 text-xs leading-relaxed transition-all ${
                        msg.isUnsent
                          ? 'bg-[#FFFFFF] text-gray-400 italic border border-gray-200 shadow-none'
                          : msg.isFailed
                          ? 'bg-[#24263e]/90 text-white rounded-br-xs font-medium border-2 border-rose-500 shadow-xs'
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
                                isSeller ? (
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
                                          ? 'Đang chờ người bán phản hồi...'
                                          : 'Waiting for seller response...'}
                                      </span>
                                    </div>
                                    {isBuyer && msg.negotiationId && (
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
                                        : (lang === 'vi' ? (isBuyer ? '✓ Người bán đã chấp thuận mức giá này!' : '✓ Người mua đã chấp thuận!') : '✓ Accepted!')}
                                    </span>
                                  </div>

                                  {isBuyer && (
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

                {/* Thông báo chi tiết ngay dưới tin nhắn không gửi được */}
                {msg.isFailed && (
                  <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-rose-600 font-medium animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{lang === 'vi' ? 'Tin nhắn chưa được gửi' : 'Not delivered'}</span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleRetrySendMessage(msg)}
                      className="underline hover:text-rose-700 font-bold cursor-pointer"
                    >
                      {lang === 'vi' ? 'Thử lại' : 'Retry'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFailedMessage(msg.id)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer text-[10px]"
                    >
                      {lang === 'vi' ? 'Xóa' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Offer Popup */}
        {showOfferForm && !hasPendingOffer && (isSeller || !isMaxRejectionsReached) && (
          <div className={`p-3.5 border-t flex items-center gap-3 animate-fadeIn shrink-0 ${
            isSeller ? 'bg-blue-50/30 border-blue-100' : 'bg-[#FFFFFF] border-gray-200'
          }`}>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700">
                  {lang === 'vi'
                    ? (isSeller ? 'Nhập mức giá bạn muốn đề xuất bán (VNĐ):' : 'Nhập mức giá bạn muốn đề xuất mua (VNĐ):')
                    : (isSeller ? 'Enter proposed selling price (VND):' : 'Enter offer price (VND):')}
                </label>
                <span className={`text-[10px] font-bold ${isSeller ? 'text-blue-600' : 'text-[#c34c36]'}`}>
                  {lang === 'vi' ? (isSeller ? 'Giá niêm yết:' : 'Giá gốc:') : 'Original:'} {formatVND(listing.priceVnd)}
                </span>
              </div>

              {maxRejectedPrice > 0 && !isSeller && (
                <div className="text-[10px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 font-medium flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    {lang === 'vi'
                      ? `Mức giá mới phải cao hơn mức giá bị từ chối cao nhất (${formatVND(maxRejectedPrice)}) và thấp hơn ${formatVND(listing.priceVnd)}.`
                      : `New offer must be strictly higher than ${formatVND(maxRejectedPrice)}.`}
                  </span>
                </div>
              )}

              <div className="relative mt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ví dụ: 1.200.000"
                  value={offerInput > 0 ? formatVndInput(offerInput) : ''}
                  onChange={(e) => {
                    const cleaned = cleanVndInput(e.target.value);
                    setOfferInput(cleaned ? Number(cleaned) : 0);
                    if (offerError) setOfferError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendOffer();
                    }
                  }}
                  className={`w-full px-3 py-1.5 pr-8 border rounded-xl text-xs font-black text-[#24263e] focus:outline-none ${
                    isSeller
                      ? 'bg-white border-blue-200 focus:border-blue-500'
                      : 'bg-[#faf8f5] border-gray-200 focus:border-[#c34c36]'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  đ
                </span>
              </div>
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
              className={`px-4 py-2 text-white rounded-xl text-xs font-bold mt-4 cursor-pointer transition shadow-xs flex items-center gap-1 ${
                isSeller
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95'
                  : 'bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95'
              }`}
            >
              {negotiationLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>{lang === 'vi' ? (isSeller ? 'Gửi Đề Xuất Giá' : 'Gửi Offer') : (isSeller ? 'Send Proposal' : 'Send Offer')}</span>
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
          <>
            {/* Quick Inspection Proposal Popup */}
            {showInspectionForm && (
              <div className="p-4 border-t space-y-3 animate-fadeIn shrink-0 bg-white border-blue-200 shadow-sm text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Thỏa Thuận Phương Án Kiểm Định</span>
              </span>
              <button
                onClick={() => setShowInspectionForm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Inspection Location Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                1. Chọn hình thức kiểm định:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInspectionMethod('AT_CENTER');
                    setInspectionFeeAmount(150000);
                  }}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                    inspectionMethod === 'AT_CENTER'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold ring-1 ring-blue-600/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Tại Hub SecondLife</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Phí chuẩn: 150.000 ₫</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInspectionMethod('AT_HOME');
                    setInspectionFeeAmount(250000);
                  }}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                    inspectionMethod === 'AT_HOME'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold ring-1 ring-blue-600/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-orange-600" />
                    <span>KTV Đến Tận Nhà</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Phí chuẩn: 250.000 ₫</div>
                </button>
              </div>
            </div>

            {/* Step 2: Fee Split */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                2. Đề xuất phương án chia phí:
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setInspectionFeeSplit('SPLIT_50_50')}
                  className={`py-2 px-1 rounded-xl border cursor-pointer text-[11px] transition ${
                    inspectionFeeSplit === 'SPLIT_50_50'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-1 ring-amber-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>Chia đôi 50/50</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mỗi bên {formatVND(Math.round(inspectionFeeAmount / 2))}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionFeeSplit('BUYER_100')}
                  className={`py-2 px-1 rounded-xl border cursor-pointer text-[11px] transition ${
                    inspectionFeeSplit === 'BUYER_100'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-1 ring-amber-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>Người mua 100%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{formatVND(inspectionFeeAmount)}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionFeeSplit('SELLER_100')}
                  className={`py-2 px-1 rounded-xl border cursor-pointer text-[11px] transition ${
                    inspectionFeeSplit === 'SELLER_100'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-1 ring-amber-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>Người bán 100%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{formatVND(inspectionFeeAmount)}</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInspectionForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendInspectionProposal}
                disabled={inspectionLoading}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {inspectionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi Đề Xuất Kiểm Định</span>
              </button>
            </div>
          </div>
        )}

        <div className={`p-3 border-t flex items-center gap-2 shrink-0 ${
          isSeller ? 'bg-slate-50 border-slate-200' : 'bg-[#FFFFFF] border-gray-200'
        }`}>
          {!hasPendingOffer && (isSeller || !isMaxRejectionsReached) && (
            <button
              onClick={() => {
                if (!isSeller && maxRejectedPrice > 0 && offerInput <= maxRejectedPrice) {
                  setOfferInput(Math.min(listing.priceVnd - 50000, maxRejectedPrice + 50000));
                }
                setShowOfferForm(!showOfferForm);
                setShowInspectionForm(false);
                setOfferError(null);
              }}
              className={`px-3 py-2 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1 ${
                isSeller
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95'
                  : 'bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95'
              }`}
            >
              <span>💰</span>
              <span>
                {lang === 'vi'
                  ? isSeller
                    ? 'Đề xuất giá'
                    : maxRejectedPrice > 0
                    ? 'Trả giá lại'
                    : 'Trả giá'
                  : isSeller
                  ? 'Propose Price'
                  : 'Offer'}
              </span>
            </button>
          )}

          {/* Inspection Proposal Button */}
          <button
            onClick={() => {
              setShowInspectionForm(!showInspectionForm);
              setShowOfferForm(false);
            }}
            className="px-3 py-2 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95"
            title="Thương lượng hình thức kiểm định & chia phí"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'vi' ? 'Đề Xuất Kiểm Định' : 'Inspection'}</span>
            <span className="sm:hidden">Kiểm Định</span>
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              lang === 'vi'
                ? (isSeller ? 'Tư vấn cho người mua...' : 'Nhắn tin thương lượng (an toàn 100% qua Escrow)...')
                : 'Chat & negotiate safely via Escrow...'
            }
            className={`flex-1 px-3.5 py-2 border rounded-xl text-xs text-[#24263e] focus:outline-none ${
              isSeller 
                ? 'bg-white border-slate-200 focus:border-blue-500' 
                : 'bg-[#faf8f5] border-gray-200 focus:border-[#c34c36]'
            }`}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={isSending}
            className={`p-2.5 text-white rounded-xl cursor-pointer transition shadow-xs flex items-center justify-center ${
              isSeller ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#24263e] hover:bg-black'
            }`}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
