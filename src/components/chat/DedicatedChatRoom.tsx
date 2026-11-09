import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChatMessage, Listing, Language, UserRole, UserProfile, Negotiation } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Send,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Tag,
  Check,
  ShieldCheck,
  Loader2,
  CheckCheck,
  ArrowLeft,
  Award,
  MessageSquare
} from 'lucide-react';
import { reviewService } from '../../data/mockReviews';
import {
  negotiationService,
  chatService,
  parseSystemMessage,
  ChatMessageDto,
  ChatRoomDto,
  SystemOfferPayload,
  reputationService,
  SellerReputationDto,
} from '../../services';
import { SystemInspectionProposalPayload, InspectionProposalPrefillData } from '../../types';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { InspectionProposalModal } from '../modals/InspectionProposalModal';
import { InspectionProposalCard } from './InspectionProposalCard';
import { paths } from '../../app/router/paths';
import { navigatePath, useBrowserLocation } from '../../app/router/browser';
import { formatVndInput, cleanVndInput } from '../../utils/numberToWords';
import { clearInspectionChatIntent, inspectionChatDraftFromUrl, isInspectionProposalForPost, matchesInspectionChatDraft } from '../../utils/inspectionChatDraft';

export interface DedicatedChatRoomProps {
  room: ChatRoomDto;
  listing: Listing;
  initialInspectionDraft?: InspectionProposalPrefillData | null;
  currentUser?: UserProfile | null;
  currentRole: UserRole;
  lang: Language;
  onBack?: () => void;
  onBuyClick?: (listing: Listing, agreedPrice?: number, negotiationId?: string) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
  onRoomActivity?: () => void;
}

export const DedicatedChatRoom: React.FC<DedicatedChatRoomProps> = ({
  room,
  listing,
  initialInspectionDraft,
  currentUser,
  currentRole,
  lang,
  onBack,
  onBuyClick,
  onOpenSellerReviews,
  onRoomActivity,
}) => {
  const effectiveUserId = currentUser?.id ? String(currentUser.id) : null;

  // 1. Precise Role Detection (buyer vs seller)
  const isExplicitBuyer = Boolean(
    effectiveUserId && room?.buyerId && effectiveUserId.toLowerCase() === String(room.buyerId).toLowerCase()
  );
  const isExplicitSeller = Boolean(
    effectiveUserId && room?.sellerId && effectiveUserId.toLowerCase() === String(room.sellerId).toLowerCase()
  );
  const isListingSeller = Boolean(
    effectiveUserId && listing?.sellerId && effectiveUserId.toLowerCase() === String(listing.sellerId).toLowerCase()
  );
  const isListingBuyer = Boolean(
    effectiveUserId && listing?.sellerId && effectiveUserId.toLowerCase() !== String(listing.sellerId).toLowerCase()
  );

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

  const isNameOfCurrentUser = useCallback((name?: string) => {
    if (!name || !currentUser) return false;
    const n = name.trim().toLowerCase();
    const myName = (currentUser.name || '').trim().toLowerCase();
    const myEmail = (currentUser.email || '').trim().toLowerCase();
    return (myName && n === myName) || (myEmail && n === myEmail);
  }, [currentUser]);

  const resolvedPartnerName = useMemo(() => {
    if (isSeller) {
      if (room?.buyerName && !isNameOfCurrentUser(room.buyerName)) {
        return room.buyerName;
      }
      return lang === 'vi' ? 'Người Mua' : 'Buyer';
    } else {
      if (room?.sellerName && !isNameOfCurrentUser(room.sellerName)) {
        return room.sellerName;
      }
      if (listing.sellerName && !isNameOfCurrentUser(listing.sellerName)) {
        return listing.sellerName;
      }
      return lang === 'vi' ? 'Người Bán' : 'Seller';
    }
  }, [isSeller, room, listing.sellerName, isNameOfCurrentUser, lang]);

  const resolvedPartnerAvatar = useMemo(() => {
    const defaultBuyerAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200";
    const defaultSellerAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

    if (isSeller) {
      return room?.buyerAvatar || defaultBuyerAvatar;
    } else {
      return room?.sellerAvatar || listing.sellerAvatar || defaultSellerAvatar;
    }
  }, [isSeller, room, listing.sellerAvatar]);

  const [sellerReputation, setSellerReputation] = useState<SellerReputationDto | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (listing.sellerId) {
      reputationService.getSellerReputation(listing.sellerId)
        .then((rep) => {
          if (isMounted) setSellerReputation(rep);
        })
        .catch(() => { });
    }
    return () => {
      isMounted = false;
    };
  }, [listing.sellerId]);

  // Messages & Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [offerInput, setOfferInput] = useState<number>(
    listing?.priceVnd ? Math.round((listing.priceVnd * 0.92) / 100000) * 100000 : 0
  );

  useEffect(() => {
    if (listing?.priceVnd && listing.priceVnd > 0) {
      setOfferInput(Math.round((listing.priceVnd * 0.92) / 100000) * 100000);
    }
  }, [listing?.id, listing?.priceVnd]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const isSendingOfferRef = useRef(false);
  const isSendingMessageRef = useRef(false);
  const isRespondingOfferRef = useRef(false);
  const isCancellingOfferRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Inspection Proposal state
  const routeLocation = useBrowserLocation();
  const [inspectionPrefillData, setInspectionPrefillData] = useState<InspectionProposalPrefillData | null>(null);
  const [showInspectionProposalModal, setShowInspectionProposalModal] = useState(false);
  const openInspectionProposal = useCallback((location?: string) => {
    let draft: InspectionProposalPrefillData | null = null;
    if (matchesInspectionChatDraft(initialInspectionDraft, listing.id, effectiveUserId || '')) {
      draft = initialInspectionDraft ?? null;
    }
    try {
      if (!draft) {
        const raw = sessionStorage.getItem(`secondlife_inspection_prefill_${listing.id}`);
        const saved = raw ? JSON.parse(raw) : null;
        if (matchesInspectionChatDraft(saved, listing.id, effectiveUserId || '')) draft = saved;
      }
    } catch (e) {
      console.warn('Failed to parse inspection prefill from sessionStorage:', e);
    }
    const fallback = location ? inspectionChatDraftFromUrl(location, listing.id) : null;
    setInspectionPrefillData((previous) => draft ?? fallback ??
      (matchesInspectionChatDraft(previous, listing.id, effectiveUserId || '') ? previous : null));
    setShowInspectionProposalModal(true);
    setShowOfferForm(false);
  }, [initialInspectionDraft, listing.id, effectiveUserId]);

  useEffect(() => {
    if (!isBuyer || room.postId !== listing.id || !isInspectionProposalForPost(routeLocation, listing.id)) return;
    openInspectionProposal(routeLocation);
    navigatePath(clearInspectionChatIntent(routeLocation), { replace: true });
  }, [isBuyer, room.postId, listing.id, routeLocation, openInspectionProposal]);
  const [currentInspectionOrder, setCurrentInspectionOrder] = useState<InspectionOrderDto | null>(null);
  const [loadingInspectionOrder, setLoadingInspectionOrder] = useState(false);

  const hasActiveInspection = useMemo(() => {
    if (!currentInspectionOrder) return false;
    const activeStatuses = [
      'WAITING_SELLER_APPROVAL',
      'WAITING_BUYER_APPROVAL',
      'WAITING_FEE_PAYMENT',
      'CONFIRMED_PENDING_DISPATCH',
      'DISPATCHED_TO_CENTER',
      'RECEIVED_AT_CENTER',
      'IN_PROGRESS',
      'PENDING',
    ];
    return activeStatuses.includes(currentInspectionOrder.status);
  }, [currentInspectionOrder]);

  const canShowInspectionProposalButton = useMemo(() => {
    const isEligibleListing = listing.status === 'active' || listing.backendStatus === 'ACTIVE';
    return isBuyer && isEligibleListing && !hasActiveInspection;
  }, [isBuyer, listing.status, listing.backendStatus, hasActiveInspection]);

  // Messenger Read/Unread State Tracking
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    const key = `chat_room_last_read_${room.id}_${effectiveUserId || 'me'}`;
    return Number(localStorage.getItem(key) || Date.now());
  });

  const markRoomAsRead = useCallback(() => {
    if (!room.id || !effectiveUserId) return;
    const now = Date.now();
    localStorage.setItem(`chat_room_last_read_${room.id}_${effectiveUserId}`, now.toString());
    setLastReadTimestamp(now);
    window.dispatchEvent(new CustomEvent('chat_room_read_updated', { detail: { roomId: room.id, userId: effectiveUserId } }));
    onRoomActivity?.();
  }, [room.id, effectiveUserId, onRoomActivity]);

  const loadInspectionOrderForRoom = useCallback(async () => {
    const postId = room.postId || listing.id;
    if (!postId) return;
    try {
      setLoadingInspectionOrder(true);
      const res = isSeller
        ? await inspectorService.getMySellerOrders(0, 50)
        : await inspectorService.getMyBuyerOrders(0, 50);
      const list: InspectionOrderDto[] = (res as any)?.content || (res as any)?.items || (Array.isArray(res) ? res : []);

      const matched = list.find((o: InspectionOrderDto) => {
        const matchPost = String(o.postId) === String(postId);
        const matchBuyer = !room.buyerId || !o.buyerId || String(o.buyerId).toLowerCase() === String(room.buyerId).toLowerCase();
        const matchSeller = !room.sellerId || !o.sellerId || String(o.sellerId).toLowerCase() === String(room.sellerId).toLowerCase();
        return matchPost && matchBuyer && matchSeller;
      });

      if (matched?.id) {
        const fresh = await inspectorService.getOrder(matched.id);
        setCurrentInspectionOrder(fresh || matched);
      }
    } catch (err) {
      console.warn('[DedicatedChatRoom] Could not load inspection order:', err);
    } finally {
      setLoadingInspectionOrder(false);
    }
  }, [room.postId, room.buyerId, room.sellerId, listing.id, isSeller]);

  useEffect(() => {
    loadInspectionOrderForRoom();
  }, [loadInspectionOrderForRoom]);

  const mapDtoToChatMessage = useCallback((dto: ChatMessageDto): ChatMessage => {
    const myId = effectiveUserId?.toLowerCase();
    const sender = dto.senderId ? dto.senderId.toLowerCase() : '';
    const isMe = Boolean(myId && sender && myId === sender);

    const parsedSys = parseSystemMessage(dto.messageContent);
    let isOffer = false;
    let offerAmount: number | undefined;
    let offerStatus: 'pending' | 'accepted' | 'declined' | 'cancelled' | undefined;
    let offerSenderRole: 'buyer' | 'seller' | undefined;
    let negotiationId: string | undefined;

    if (parsedSys.isSystem && parsedSys.offer) {
      isOffer = true;
      offerAmount = parsedSys.offer.price;
      offerStatus = parsedSys.offer.status === 'ACCEPTED'
        ? 'accepted'
        : parsedSys.offer.status === 'REJECTED'
          ? 'declined'
          : parsedSys.offer.status === 'CANCELLED'
            ? 'cancelled'
            : 'pending';
      negotiationId = parsedSys.offer.negotiationId;
      offerSenderRole = parsedSys.offer.senderRole || (parsedSys.offer.negotiationId?.startsWith('seller-offer-') ? 'seller' : 'buyer');
    }

    let timestampStr = '';
    try {
      if (dto.sentAt) {
        const d = new Date(dto.sentAt);
        if (!isNaN(d.getTime())) {
          timestampStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch { }
    if (!timestampStr) {
      timestampStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    return {
      id: dto.id || `msg-${Date.now()}-${Math.random()}`,
      senderId: dto.senderId || (isMe ? (effectiveUserId || '') : (room.sellerId || '')),
      senderName: isMe ? (currentUser?.name || 'Tôi') : resolvedPartnerName,
      senderRole: isMe ? (isSeller ? 'seller' : 'buyer') : (isSeller ? 'buyer' : 'seller'),
      text: dto.messageContent,
      timestamp: timestampStr,
      isOffer,
      offerAmountVnd: offerAmount,
      offerStatus,
      offerSenderRole,
      negotiationId,
      isInspectionProposal: Boolean(parsedSys.inspectionProposal),
      inspectionProposal: parsedSys.inspectionProposal,
    };
  }, [effectiveUserId, currentUser?.name, resolvedPartnerName, isSeller, room.sellerId]);

  // Load message history from backend
  useEffect(() => {
    let isMounted = true;
    setLoadingMessages(true);
    markRoomAsRead();

    chatService.getMessages(room.id)
      .then((history) => {
        if (!isMounted) return;
        if (Array.isArray(history)) {
          // Deduplicate by message ID and consolidate negotiation offers by negotiationId
          const seenIds = new Set<string>();
          const negotiationIndexMap = new Map<string, number>();
          const mapped: ChatMessage[] = [];

          for (const dto of history) {
            if (dto.id && seenIds.has(dto.id)) continue;
            if (dto.id) seenIds.add(dto.id);

            const chatMsg = mapDtoToChatMessage(dto);
            const negoId = chatMsg.negotiationId;

            if (negoId) {
              if (negotiationIndexMap.has(negoId)) {
                // Update the existing card in place with latest status & details from newer message
                const idx = negotiationIndexMap.get(negoId)!;
                mapped[idx] = chatMsg;
                continue;
              }
              negotiationIndexMap.set(negoId, mapped.length);
            }
            if (chatMsg.isInspectionProposal && chatMsg.inspectionProposal?.orderId) {
              inspectorService.getOrder(chatMsg.inspectionProposal.orderId).then(ord => {
                if (ord) setCurrentInspectionOrder(ord);
              }).catch(() => {});
            }
            mapped.push(chatMsg);
          }
          setMessages(mapped);
        }
      })
      .catch((err) => {
        console.warn('[DedicatedChatRoom] Failed to load messages:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [room.id, mapDtoToChatMessage, markRoomAsRead]);

  // Robust deduplication and synchronization for incoming messages (WebSocket or API response)
  const syncIncomingMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      // 1. If exact id already exists: skip duplicate
      if (prev.some((m) => m.id === incoming.id)) {
        return prev;
      }

      // 2. If it's an offer: match and update existing offer card by negotiationId
      if (incoming.negotiationId) {
        const existingOfferIndex = prev.findIndex(
          (m) => m.negotiationId === incoming.negotiationId
        );
        if (existingOfferIndex !== -1) {
          const next = [...prev];
          next[existingOfferIndex] = incoming;
          // Filter out any other duplicate cards for this same negotiationId
          return next.filter((m, idx) => idx === existingOfferIndex || m.negotiationId !== incoming.negotiationId);
        }
      }

      // 2.5. If it's an inspection proposal: match and update existing proposal card by orderId
      const incomingOrderId = incoming.inspectionProposal?.orderId;
      if (incomingOrderId) {
        const existingProposalIndex = prev.findIndex(
          (m) => m.inspectionProposal?.orderId === incomingOrderId
        );
        if (existingProposalIndex !== -1) {
          const next = [...prev];
          next[existingProposalIndex] = incoming;
          return next.filter((m, idx) => idx === existingProposalIndex || m.inspectionProposal?.orderId !== incomingOrderId);
        }
      }

      // 3. If standard message from the current user: replace matching optimistic message (temp-* or msg-*)
      const isFromMe = Boolean(
        effectiveUserId && incoming.senderId &&
        effectiveUserId.toLowerCase() === incoming.senderId.toLowerCase()
      );

      if (isFromMe) {
        const optIndex = prev.findIndex(
          (m) =>
            (m.id.startsWith('temp-') || m.id.startsWith('msg-')) &&
            m.text.trim() === incoming.text.trim()
        );
        if (optIndex !== -1) {
          const next = [...prev];
          next[optIndex] = incoming;
          return next;
        }
      }

      // 4. Truly new message
      return [...prev, incoming];
    });
  }, [effectiveUserId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // WebSocket real-time subscription
  useEffect(() => {
    chatService.connectWebSocket();
    const unsubscribe = chatService.subscribeToMessages((dto) => {
      if (dto.conversationId === room.id) {
        const incoming = mapDtoToChatMessage(dto);
        syncIncomingMessage(incoming);
        markRoomAsRead();

        // Auto-scroll down smoothly if user is already near bottom
        if (messagesContainerRef.current) {
          const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
          if (scrollHeight - scrollTop - clientHeight < 150) {
            setTimeout(() => scrollToBottom('smooth'), 50);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [room.id, mapDtoToChatMessage, markRoomAsRead, syncIncomingMessage, scrollToBottom]);

  // Analyze negotiation offers from messages
  const negotiationMap = useMemo(() => {
    const map = new Map<string, { id: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'; price: number }>();
    messages.forEach((m) => {
      const parsed = parseSystemMessage(m.text);
      if (parsed.offer && parsed.offer.negotiationId) {
        map.set(parsed.offer.negotiationId, {
          id: parsed.offer.negotiationId,
          status: parsed.offer.status,
          price: parsed.offer.price,
        });
      } else if (m.isOffer && m.negotiationId) {
        map.set(m.negotiationId, {
          id: m.negotiationId,
          status: m.offerStatus === 'accepted' ? 'ACCEPTED' : m.offerStatus === 'declined' ? 'REJECTED' : m.offerStatus === 'cancelled' ? 'CANCELLED' : 'PENDING',
          price: m.offerAmountVnd || listing.priceVnd,
        });
      }
    });
    return map;
  }, [messages, listing.priceVnd]);

  // Consolidate offer & inspection cards so each appears exactly once in the chat timeline with its latest status
  const displayMessages = useMemo(() => {
    const latestNegoMsgMap = new Map<string, ChatMessage>();
    const latestInspectionMsgMap = new Map<string, ChatMessage>();

    for (const m of messages) {
      const parsed = parseSystemMessage(m.text);
      const negoId = parsed.offer?.negotiationId || m.negotiationId;
      if (negoId) {
        latestNegoMsgMap.set(negoId, m);
      }
      const orderId = parsed.inspectionProposal?.orderId || m.inspectionProposal?.orderId;
      if (orderId) {
        latestInspectionMsgMap.set(orderId, m);
      }
    }

    const seenNegotiationIds = new Set<string>();
    const seenInspectionOrderIds = new Set<string>();
    const result: ChatMessage[] = [];

    for (const m of messages) {
      const parsed = parseSystemMessage(m.text);
      const negoId = parsed.offer?.negotiationId || m.negotiationId;
      const orderId = parsed.inspectionProposal?.orderId || m.inspectionProposal?.orderId;

      if (negoId) {
        if (seenNegotiationIds.has(negoId)) {
          continue;
        }
        seenNegotiationIds.add(negoId);
        result.push(latestNegoMsgMap.get(negoId) || m);
      } else if (orderId) {
        if (seenInspectionOrderIds.has(orderId)) {
          continue;
        }
        seenInspectionOrderIds.add(orderId);
        result.push(latestInspectionMsgMap.get(orderId) || m);
      } else {
        result.push(m);
      }
    }

    // If an active inspection order exists from API but no message exists in chat yet, inject it into the stream
    if (currentInspectionOrder && hasActiveInspection && !seenInspectionOrderIds.has(currentInspectionOrder.id)) {
      const totalFee =
        (currentInspectionOrder.inspectionFee || 0) +
        (currentInspectionOrder.shippingFee || 0) +
        (currentInspectionOrder.returnShippingReserveFee || 0);

      const feeSplitValue: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100' =
        currentInspectionOrder.feePayer === 'BUYER_PAYS'
          ? 'BUYER_100'
          : currentInspectionOrder.feePayer === 'SELLER_PAYS'
          ? 'SELLER_100'
          : 'SPLIT_50_50';

      const payloadStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' =
        currentInspectionOrder.status === 'WAITING_FEE_PAYMENT' || currentInspectionOrder.status === 'CONFIRMED_PENDING_DISPATCH'
          ? 'ACCEPTED'
          : currentInspectionOrder.status === 'REJECTED'
          ? 'REJECTED'
          : currentInspectionOrder.status === 'CANCELLED'
          ? 'CANCELLED'
          : 'PENDING';

      const payload: SystemInspectionProposalPayload = {
        type: 'INSPECTION_PROPOSAL',
        orderId: currentInspectionOrder.id,
        status: payloadStatus,
        orderStatus: currentInspectionOrder.status,
        method: 'AT_CENTER',
        feeSplit: feeSplitValue,
        feePayer: currentInspectionOrder.feePayer as any,
        estimatedFeeVnd: totalFee,
        proposedByRole: 'buyer',
        buyerFeeShare: currentInspectionOrder.buyerFeeShare,
        sellerFeeShare: currentInspectionOrder.sellerFeeShare,
        centerId: currentInspectionOrder.inspectionCenterId,
        centerName: (currentInspectionOrder as any).centerName,
        baseInspectionFee: currentInspectionOrder.inspectionFee,
        shippingToCenterFee: currentInspectionOrder.shippingFee,
        returnShippingReserveFee: currentInspectionOrder.returnShippingReserveFee,
        isZinLossAcknowledged: currentInspectionOrder.buyerConsentZin ?? true,
      };

      result.push({
        id: `active-inspection-${currentInspectionOrder.id}`,
        senderId: currentInspectionOrder.buyerId || '',
        senderName: 'Hệ thống Kiểm định',
        senderRole: 'system',
        text: `SYSTEM: ${JSON.stringify(payload)}`,
        timestamp: '',
        isOffer: false,
        isInspectionProposal: true,
        inspectionProposal: payload,
      });
    }

    return result;
  }, [messages, currentInspectionOrder, hasActiveInspection]);

  // Scroll to bottom of message container (strictly inside container, never touches window scroll)
  useEffect(() => {
    if (!loadingMessages && displayMessages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom('instant');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [room.id, loadingMessages, scrollToBottom, displayMessages.length]);

  const activePendingNegotiation = useMemo(() => {
    return Array.from(negotiationMap.values()).find((n) => n.status === 'PENDING');
  }, [negotiationMap]);

  const hasPendingOffer = Boolean(activePendingNegotiation);

  const rejectedNegotiations = useMemo(() => {
    return Array.from(negotiationMap.values()).filter((n) => n.status === 'REJECTED');
  }, [negotiationMap]);

  const maxRejectedPrice = useMemo(() => {
    return rejectedNegotiations.reduce((max, n) => Math.max(max, n.price), 0);
  }, [rejectedNegotiations]);

  const maxRejectionsAllowed = 3;
  const isMaxRejectionsReached = rejectedNegotiations.length >= maxRejectionsAllowed;

  const acceptedNegotiations = useMemo(() => {
    return Array.from(negotiationMap.values()).filter((n) => n.status === 'ACCEPTED');
  }, [negotiationMap]);

  const latestAccepted = acceptedNegotiations[acceptedNegotiations.length - 1];
  const latestAcceptedOffer = latestAccepted?.price;
  const latestAcceptedNegotiationId = latestAccepted?.id;

  // Check if buyer has initiated any price negotiation request in this room
  const hasBuyerRequestedNegotiation = useMemo(() => {
    for (const [id] of negotiationMap) {
      if (!id.startsWith('seller-offer-')) return true;
    }
    return displayMessages.some((m) => {
      const parsed = parseSystemMessage(m.text);
      if (parsed.offer) {
        return parsed.offer.senderRole !== 'seller' && !parsed.offer.negotiationId?.startsWith('seller-offer-');
      }
      return Boolean(m.isOffer && !m.negotiationId?.startsWith('seller-offer-'));
    });
  }, [displayMessages, negotiationMap]);

  const isListingClosed = Boolean(
    (listing as any).isNotAvailable ||
    (listing as any).notFound ||
    listing.status === 'sold' ||
    listing.status === 'reserved'
  );

  // Button display condition (strict logic: seller only sees button after buyer requested!)
  const canShowOfferButton = !isListingClosed && !hasPendingOffer && (
    isSeller ? hasBuyerRequestedNegotiation : !isMaxRejectionsReached
  );

  // Send regular text message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isSendingMessageRef.current || isSending) return;

    isSendingMessageRef.current = true;
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: effectiveUserId || '',
      senderName: currentUser?.name || 'Tôi',
      senderRole: isSeller ? 'seller' : 'buyer',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage('');
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const serverDto = await chatService.sendMessage(room.id, text);
      const serverMsg = mapDtoToChatMessage(serverDto);
      setMessages((prev) => {
        // If serverMsg.id is already in prev (from WebSocket arrival):
        if (serverMsg.id && prev.some((m) => m.id === serverMsg.id)) {
          // Remove the optimistic placeholder so it does not duplicate
          return prev.filter((m) => m.id !== tempId);
        }
        // Otherwise replace temp placeholder with server message
        return prev.map((m) => (m.id === tempId ? serverMsg : m));
      });
      markRoomAsRead();
    } catch (err) {
      console.warn('Failed to send message:', err);
    } finally {
      setIsSending(false);
      isSendingMessageRef.current = false;
    }
  };

  // Send Offer (Buyer or Seller)
  const handleSendOffer = async () => {
    if (!offerInput || offerInput <= 0 || isSendingOfferRef.current) return;

    if (listing.priceVnd > 0 && offerInput >= listing.priceVnd) {
      setOfferError(
        lang === 'vi'
          ? (isSeller
            ? 'Mức giá đề xuất bán phải thấp hơn giá niêm yết ban đầu.'
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

    if (isSeller && !hasBuyerRequestedNegotiation) {
      setOfferError(
        lang === 'vi'
          ? 'Người bán chỉ có thể đề xuất giá sau khi người mua đã gửi yêu cầu trả giá.'
          : 'Seller can only propose a price after buyer has requested negotiation.'
      );
      return;
    }

    isSendingOfferRef.current = true;
    setNegotiationLoading(true);
    setOfferError(null);

    try {
      if (isSeller) {
        const offerId = `seller-offer-${Date.now()}`;
        const offerPayload: SystemOfferPayload = {
          type: 'OFFER',
          status: 'PENDING',
          price: offerInput,
          negotiationId: offerId,
          senderRole: 'seller',
        };
        const systemText = `SYSTEM: ${JSON.stringify(offerPayload)}`;
        await chatService.sendMessage(room.id, systemText);
        setShowOfferForm(false);
      } else {
        const res = await negotiationService.createNegotiation(listing.id, offerInput);
        setShowOfferForm(false);
        // Note: Backend NegotiationService already creates and broadcasts the SYSTEM offer message!
        // We optimistically create the card locally for immediate feedback without sending a duplicate message to the backend.
        if (res?.id) {
          const optimisticOfferMsg: ChatMessage = {
            id: `nego-${res.id}`,
            senderId: effectiveUserId || '',
            senderName: currentUser?.name || 'Tôi',
            senderRole: 'buyer',
            text: `SYSTEM: {"type":"OFFER","status":"PENDING","price":${offerInput},"negotiationId":"${res.id}","senderRole":"buyer"}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            isOffer: true,
            offerAmountVnd: offerInput,
            offerStatus: 'pending',
            offerSenderRole: 'buyer',
            negotiationId: res.id,
          };
          syncIncomingMessage(optimisticOfferMsg);
        }
      }
      markRoomAsRead();
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err: any) {
      console.warn('Negotiation creation error:', err);
      const msg = err?.response?.data?.message || err?.message || '';
      setOfferError(msg || (lang === 'vi' ? 'Không thể gửi đề xuất lúc này. Vui lòng thử lại.' : 'Could not create offer.'));
    } finally {
      setNegotiationLoading(false);
      isSendingOfferRef.current = false;
    }
  };

  // Respond to Offer (Accept / Reject)
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
      if (!isSellerOffer) {
        if (action === 'accepted') {
          await negotiationService.acceptNegotiation(negotiationId);
        } else {
          await negotiationService.rejectNegotiation(negotiationId);
        }
        // Backend already creates and broadcasts the SYSTEM message!
      } else {
        const offerPrice = price || listing.priceVnd;
        const statusStr = action === 'accepted' ? 'ACCEPTED' : 'REJECTED';
        const systemText = `SYSTEM: {"type":"OFFER","status":"${statusStr}","price":${offerPrice},"negotiationId":"${negotiationId}"}`;
        await chatService.sendMessage(room.id, systemText);
      }

      // Optimistically update the existing offer card in local state
      const offerPrice = price || listing.priceVnd;
      const statusStr = action === 'accepted' ? 'ACCEPTED' : 'REJECTED';
      setMessages((prev) =>
        prev.map((m) => {
          if (m.negotiationId === negotiationId) {
            return {
              ...m,
              offerStatus: action,
              text: `SYSTEM: {"type":"OFFER","status":"${statusStr}","price":${offerPrice},"negotiationId":"${negotiationId}"}`,
            };
          }
          return m;
        })
      );

      markRoomAsRead();
    } catch (err) {
      console.warn('Offer response error:', err);
    } finally {
      isRespondingOfferRef.current = false;
    }
  };

  // Cancel Offer
  const handleCancelOffer = async (
    negotiationId: string,
    senderRole?: 'buyer' | 'seller',
    price?: number
  ) => {
    if (isCancellingOfferRef.current) return;
    isCancellingOfferRef.current = true;

    try {
      const isSellerOffer = senderRole === 'seller' || negotiationId.startsWith('seller-offer-');
      if (!isSellerOffer) {
        await negotiationService.cancelNegotiation(negotiationId);
        // Backend already creates and broadcasts the SYSTEM CANCELLED message!
      } else {
        const offerPrice = price || listing.priceVnd;
        const systemText = `SYSTEM: {"type":"OFFER","status":"CANCELLED","price":${offerPrice},"negotiationId":"${negotiationId}"}`;
        await chatService.sendMessage(room.id, systemText);
      }

      // Optimistically update the existing offer card in local state to CANCELLED
      const offerPrice = price || listing.priceVnd;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.negotiationId === negotiationId) {
            return {
              ...m,
              offerStatus: 'cancelled',
              text: `SYSTEM: {"type":"OFFER","status":"CANCELLED","price":${offerPrice},"negotiationId":"${negotiationId}"}`,
            };
          }
          return m;
        })
      );

      markRoomAsRead();
    } catch (err) {
      console.warn('Offer cancel error:', err);
    } finally {
      isCancellingOfferRef.current = false;
    }
  };

  // Buy Now click
  const handleBuyNow = (priceToUse?: number, specificNegotiationId?: string) => {
    const finalPrice = priceToUse || latestAcceptedOffer || listing.priceVnd;
    const finalNegoId = specificNegotiationId || latestAcceptedNegotiationId;
    if (onBuyClick) {
      onBuyClick(listing, finalPrice, finalNegoId);
    }
  };

  // Handle proposal submission from InspectionProposalModal
  const handleProposalSubmitSuccess = async (newOrder: InspectionOrderDto) => {
    setCurrentInspectionOrder(newOrder);
    setShowInspectionProposalModal(false);

    const totalAtCenterFee =
      (newOrder.inspectionFee || 0) + (newOrder.shippingFee || 0) + (newOrder.returnShippingReserveFee || 0);

    const proposalPayload: SystemInspectionProposalPayload = {
      type: 'INSPECTION_PROPOSAL',
      orderId: newOrder.id,
      status: 'PENDING',
      method: (newOrder.orderType as any) || 'AT_CENTER',
      feeSplit:
        newOrder.feePayer === 'BUYER_PAYS'
          ? 'BUYER_100'
          : newOrder.feePayer === 'SELLER_PAYS'
          ? 'SELLER_100'
          : 'SPLIT_50_50',
      estimatedFeeVnd: totalAtCenterFee,
      proposedByRole: 'buyer',
      orderStatus: newOrder.status || 'WAITING_SELLER_APPROVAL',
      buyerFeeShare: newOrder.buyerFeeShare,
      sellerFeeShare: newOrder.sellerFeeShare,
      feePayer: newOrder.feePayer as any,
      centerId: newOrder.inspectionCenterId || undefined,
      centerName: (newOrder as any).centerName,
      baseInspectionFee: newOrder.inspectionFee,
      shippingToCenterFee: newOrder.shippingFee,
      returnShippingReserveFee: newOrder.returnShippingReserveFee,
      isZinLossAcknowledged: true,
    };

    try {
      const serverDto = await chatService.sendMessage(room.id, `SYSTEM: ${JSON.stringify(proposalPayload)}`);
      if (serverDto) {
        syncIncomingMessage(mapDtoToChatMessage(serverDto));
      }

      const feeSplitText =
        newOrder.feePayer === 'BUYER_PAYS'
          ? 'Người mua chịu 100%'
          : newOrder.feePayer === 'SELLER_PAYS'
          ? 'Người bán chịu 100%'
          : 'Chia đôi 50/50';
      const textDto = await chatService.sendMessage(
        room.id,
        `[ĐỀ XUẤT KIỂM ĐỊNH] Người mua đã gửi yêu cầu kiểm định tại trung tâm SecondLife Hub (#${newOrder.id.slice(0, 8).toUpperCase()}). Phương án: ${feeSplitText}. Tổng phí: ${formatVND(totalAtCenterFee)}. Vui lòng xem và phản hồi trên thẻ đề xuất!`
      );
      if (textDto) {
        syncIncomingMessage(mapDtoToChatMessage(textDto));
      }

      markRoomAsRead();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      console.warn('Failed to send inspection proposal system message:', err);
    }
  };

  // Handle updates when Seller or Buyer interacts with proposal card
  const handleInspectionOrderUpdated = async (updated: InspectionOrderDto) => {
    setCurrentInspectionOrder(updated);

    const totalAtCenterFee =
      (updated.inspectionFee || 0) + (updated.shippingFee || 0) + (updated.returnShippingReserveFee || 0);

    const proposalPayload: SystemInspectionProposalPayload = {
      type: 'INSPECTION_PROPOSAL',
      orderId: updated.id,
      status:
        updated.status === 'WAITING_FEE_PAYMENT' || updated.status === 'CONFIRMED_PENDING_DISPATCH'
          ? 'ACCEPTED'
          : updated.status === 'REJECTED' || updated.status === 'CANCELLED'
          ? 'REJECTED'
          : 'PENDING',
      method: 'AT_CENTER',
      feeSplit:
        updated.feePayer === 'BUYER_PAYS'
          ? 'BUYER_100'
          : updated.feePayer === 'SELLER_PAYS'
          ? 'SELLER_100'
          : 'SPLIT_50_50',
      estimatedFeeVnd: totalAtCenterFee,
      proposedByRole: isSeller ? 'seller' : 'buyer',
      orderStatus: updated.status,
      buyerFeeShare: updated.buyerFeeShare,
      sellerFeeShare: updated.sellerFeeShare,
      feePayer: updated.feePayer as any,
      centerId: updated.inspectionCenterId || (currentInspectionOrder as any)?.inspectionCenterId,
      centerName: (updated as any).centerName || (currentInspectionOrder as any)?.centerName,
      baseInspectionFee: updated.inspectionFee || (currentInspectionOrder as any)?.inspectionFee,
      shippingToCenterFee: updated.shippingFee || (currentInspectionOrder as any)?.shippingFee,
      returnShippingReserveFee: updated.returnShippingReserveFee || (currentInspectionOrder as any)?.returnShippingReserveFee,
      isZinLossAcknowledged: true,
    };

    try {
      const serverDto = await chatService.sendMessage(room.id, `SYSTEM: ${JSON.stringify(proposalPayload)}`);
      if (serverDto) {
        syncIncomingMessage(mapDtoToChatMessage(serverDto));
      }
      markRoomAsRead();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      console.warn('Failed to broadcast updated inspection proposal:', err);
    }
  };

  // Unread divider detection
  const firstUnreadMsgId = useMemo(() => {
    if (!lastReadTimestamp) return null;
    const unread = displayMessages.find((m) => {
      const isFromPartner = m.senderId && m.senderId.toLowerCase() !== effectiveUserId?.toLowerCase();
      // If message index is greater than messages before lastReadTimestamp
      return isFromPartner;
    });
    return unread?.id || null;
  }, [displayMessages, lastReadTimestamp, effectiveUserId]);

  // Last sent message by ME
  const myLastMsgIndex = useMemo(() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      const m = displayMessages[i];
      const isMe = m.senderId && m.senderId.toLowerCase() === effectiveUserId?.toLowerCase();
      if (isMe) return i;
    }
    return -1;
  }, [displayMessages, effectiveUserId]);

  // Check if partner has sent messages AFTER my last message (means partner saw it!)
  const isLastMsgSeen = useMemo(() => {
    if (myLastMsgIndex === -1) return false;
    for (let i = myLastMsgIndex + 1; i < displayMessages.length; i++) {
      const m = displayMessages[i];
      const isFromPartner = m.senderId && m.senderId.toLowerCase() !== effectiveUserId?.toLowerCase();
      if (isFromPartner) return true;
    }
    return false;
  }, [myLastMsgIndex, displayMessages, effectiveUserId]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[#FFFFFF] overflow-hidden">
      {/* 1. CONVERSATION HEADER */}
      <div className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between shrink-0 ${isSeller
        ? 'bg-gradient-to-r from-[#24263e] to-slate-800 text-white border-slate-700'
        : 'bg-gradient-to-r from-[#fce5da] to-white border-slate-200 text-[#24263e]'
        }`}>
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
          {/* Mobile Back Button to conversation list */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={`p-1.5 -ml-1 rounded-xl transition cursor-pointer md:hidden ${isSeller ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-black hover:bg-black/5'
                }`}
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            <img
              src={resolvedPartnerAvatar}
              alt={resolvedPartnerName}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover shrink-0 ${isSeller ? 'border-2 border-white/20' : 'border border-[#24263e]/20'
                }`}
            />
            {/* Green Online Dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white" title="Đang trực tuyến" />
          </div>

          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-extrabold text-xs sm:text-sm truncate ${isSeller ? 'text-white' : 'text-[#24263e]'}`}>
                {resolvedPartnerName}
              </span>

              {/* Explicit Partner Role Badge */}
              {isSeller ? (
                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-200 rounded text-[9px] font-bold border border-blue-400/30">
                  {lang === 'vi' ? 'Đối tác: Người mua' : 'Partner: Buyer'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold border border-emerald-300">
                  {lang === 'vi' ? 'Đối tác: Người bán' : 'Partner: Seller'}
                </span>
              )}

              {/* Seller Trust Score Pill */}
              {isBuyer && (
                <button
                  type="button"
                  onClick={() => onOpenSellerReviews?.(listing.sellerId, listing.sellerName)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[10px] font-black text-amber-800 shadow-2xs hover:bg-amber-50 cursor-pointer transition"
                  title="Bấm để xem chi tiết uy tín và đánh giá từ người mua khác"
                >
                  <Award className="w-3 h-3 text-amber-600" />
                  <span>
                    {sellerReputation?.score !== undefined && sellerReputation?.score !== null
                      ? `${sellerReputation.score}/100 uy tín`
                      : 'Uy tín xác thực'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. PINNED ORDER / LISTING BANNER (VISIBLE TO BOTH SELLER & BUYER - NO DESCRIPTION) */}
      <div className="bg-[#faf8f5] border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={listing.photos?.front || room.postImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
            alt={listing.title}
            className="w-13 h-13 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {lang === 'vi' ? 'Thông tin sản phẩm' : 'Product Info'}
              </span>
              {isSeller ? (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded border border-blue-200">
                  {lang === 'vi' ? 'Sản phẩm của bạn' : 'Your Listing'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200">
                  {lang === 'vi' ? 'Sản phẩm mua' : 'Purchasing Item'}
                </span>
              )}
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium hidden sm:inline-flex">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {lang === 'vi' ? 'Bảo lãnh Escrow 100%' : '100% Escrow Protected'}
              </span>
            </div>

            {/* Product Title - Clean and No Description */}
            <h4 className="text-xs sm:text-sm font-bold text-[#24263e] truncate max-w-xs sm:max-w-md mt-0.5" title={listing.title}>
              {listing.title}
            </h4>

            {/* Price display */}
            <div className="flex items-center gap-2 mt-0.5">
              {latestAcceptedOffer ? (
                <>
                  <span className="text-xs font-black text-emerald-700">
                    {formatVND(latestAcceptedOffer)}
                  </span>
                  {listing.priceVnd > 0 && (
                    <span className="text-[11px] line-through text-slate-400 font-medium">
                      {formatVND(listing.priceVnd)}
                    </span>
                  )}
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded">
                    {lang === 'vi' ? 'Đã chốt giá' : 'Deal Agreed'}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {listing.priceVnd > 0 ? (
                    <span className="text-xs font-black text-[#c34c36]">
                      {formatVND(listing.priceVnd)}
                    </span>
                  ) : null}
                  {isListingClosed ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {lang === 'vi' ? 'Đã đóng giao dịch / Ngừng bán' : 'Listing closed'}
                    </span>
                  ) : !listing.priceVnd || listing.priceVnd <= 0 ? (
                    <span className="text-slate-400 font-medium italic text-xs flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                      <span>{lang === 'vi' ? 'Đang cập nhật giá...' : 'Loading price...'}</span>
                    </span>
                  ) : null}
                  {hasActiveInspection && (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      <span>{lang === 'vi' ? 'Đang đề xuất kiểm định' : 'Active inspection proposal'}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Action for Order Banner */}
        <div className="shrink-0">
          {isBuyer ? (
            isListingClosed && !latestAcceptedOffer ? (
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl border border-slate-200 cursor-not-allowed">
                {lang === 'vi' ? 'Ngừng mở bán' : 'Unavailable'}
              </span>
            ) : (
              <button
                type="button"
                disabled={!latestAcceptedOffer && (!listing.priceVnd || listing.priceVnd <= 0)}
                onClick={() => handleBuyNow(latestAcceptedOffer || listing.priceVnd, latestAcceptedNegotiationId)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition ${!latestAcceptedOffer && (!listing.priceVnd || listing.priceVnd <= 0)
                  ? 'bg-slate-300 cursor-not-allowed opacity-60'
                  : latestAcceptedOffer
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 cursor-pointer'
                    : 'bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 cursor-pointer'
                  }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">
                  {latestAcceptedOffer
                    ? (lang === 'vi' ? `Mua giá chốt (${formatVND(latestAcceptedOffer)})` : `Buy Deal (${formatVND(latestAcceptedOffer)})`)
                    : (lang === 'vi' ? 'Mua Ngay' : 'Buy Now')}
                </span>
              </button>
            )
          ) : (
            <div className="text-right">
              {latestAcceptedOffer ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">{lang === 'vi' ? 'Đã đồng ý giá' : 'Deal Agreed'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">{lang === 'vi' ? 'Niêm yết' : 'Listed'}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. MESSAGE STREAM */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#fdfdfd]" style={{ overscrollBehavior: "contain" }}>
        {loadingMessages ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 text-[#c34c36] animate-spin" />
            <p className="text-xs font-semibold text-slate-400">
              {lang === 'vi' ? 'Đang đồng bộ tin nhắn...' : 'Loading messages...'}
            </p>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center space-y-2 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-600">
              {lang === 'vi' ? 'Chưa có tin nhắn nào trong phòng chat' : 'No messages yet in this room'}
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              {lang === 'vi'
                ? 'Hãy gửi lời chào hoặc bắt đầu đàm phán giá an toàn qua Quỹ bảo lãnh Escrow.'
                : 'Send a greeting or propose a negotiation via Escrow.'}
            </p>
          </div>
        ) : (
          displayMessages.map((msg, index) => {
            const isMe = Boolean(effectiveUserId && msg.senderId && effectiveUserId.toLowerCase() === msg.senderId.toLowerCase());
            const parsedSys = parseSystemMessage(msg.text);
            const isUnreadDivider = msg.id === firstUnreadMsgId;
            const isMyLastSent = index === myLastMsgIndex;

            return (
              <React.Fragment key={msg.id}>
                {/* Messenger-style Unread Divider */}
                {isUnreadDivider && (
                  <div className="flex items-center justify-center my-4 animate-fadeIn">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-bold text-blue-800 shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>{lang === 'vi' ? 'Tin nhắn mới chưa đọc' : 'New unread messages'}</span>
                    </div>
                  </div>
                )}

                {/* SYSTEM INSPECTION PROPOSAL CARD */}
                {parsedSys.isSystem && parsedSys.inspectionProposal ? (
                  <InspectionProposalCard
                    order={
                      currentInspectionOrder && currentInspectionOrder.id === parsedSys.inspectionProposal.orderId
                        ? ({
                            ...currentInspectionOrder,
                            inspectionFee: currentInspectionOrder.inspectionFee || parsedSys.inspectionProposal.baseInspectionFee,
                            shippingFee: currentInspectionOrder.shippingFee || parsedSys.inspectionProposal.shippingToCenterFee,
                            returnShippingReserveFee: currentInspectionOrder.returnShippingReserveFee || parsedSys.inspectionProposal.returnShippingReserveFee,
                            centerName: (currentInspectionOrder as any).centerName || parsedSys.inspectionProposal.centerName,
                            orderType: currentInspectionOrder.orderType || parsedSys.inspectionProposal.method || 'AT_CENTER',
                            feePayer: currentInspectionOrder.feePayer || parsedSys.inspectionProposal.feePayer,
                            buyerFeeShare: currentInspectionOrder.buyerFeeShare || parsedSys.inspectionProposal.buyerFeeShare,
                            sellerFeeShare:
                              currentInspectionOrder.sellerFeeShare !== undefined && currentInspectionOrder.sellerFeeShare !== null && currentInspectionOrder.sellerFeeShare > 0
                                ? currentInspectionOrder.sellerFeeShare
                                : parsedSys.inspectionProposal.sellerFeeShare,
                            inspectionCenterId: currentInspectionOrder.inspectionCenterId || parsedSys.inspectionProposal.centerId,
                            buyerConsentZin: (currentInspectionOrder as any).buyerConsentZin ?? parsedSys.inspectionProposal.isZinLossAcknowledged ?? true,
                            postPrice: listing.priceVnd,
                            postTitle: listing.title,
                            postImageUrl: listing.photos?.front,
                          } as any)
                        : ({
                            id: parsedSys.inspectionProposal.orderId || msg.id,
                            postId: listing.id,
                            postTitle: listing.title,
                            postImageUrl: listing.photos?.front,
                            buyerId: room.buyerId,
                            sellerId: room.sellerId,
                            status:
                              parsedSys.inspectionProposal.orderStatus ||
                              (parsedSys.inspectionProposal.status === 'PENDING'
                                ? 'WAITING_SELLER_APPROVAL'
                                : parsedSys.inspectionProposal.status),
                            orderType: parsedSys.inspectionProposal.method || 'AT_CENTER',
                            feePayer: parsedSys.inspectionProposal.feePayer ||
                              (parsedSys.inspectionProposal.feeSplit === 'BUYER_100' ? 'BUYER_PAYS' : parsedSys.inspectionProposal.feeSplit === 'SELLER_100' ? 'SELLER_PAYS' : 'SPLIT_50_50'),
                            inspectionFee:
                              parsedSys.inspectionProposal.baseInspectionFee || 0,
                            shippingFee: parsedSys.inspectionProposal.shippingToCenterFee || 0,
                            returnShippingReserveFee: parsedSys.inspectionProposal.returnShippingReserveFee || 0,
                            buyerFeeShare:
                              parsedSys.inspectionProposal.buyerFeeShare ??
                              Math.round(parsedSys.inspectionProposal.estimatedFeeVnd / 2),
                            sellerFeeShare:
                              parsedSys.inspectionProposal.sellerFeeShare ??
                              parsedSys.inspectionProposal.estimatedFeeVnd -
                                Math.round(parsedSys.inspectionProposal.estimatedFeeVnd / 2),
                            inspectionCenterId: parsedSys.inspectionProposal.centerId,
                            centerName: parsedSys.inspectionProposal.centerName,
                            buyerConsentZin: parsedSys.inspectionProposal.isZinLossAcknowledged ?? true,
                            postPrice: listing.priceVnd,
                          } as any)
                    }
                    listing={listing}
                    currentUserId={effectiveUserId}
                    isSeller={isSeller}
                    isBuyer={isBuyer}
                    currentRole={currentRole}
                    lang={lang}
                    onOrderUpdated={handleInspectionOrderUpdated}
                    onViewDetails={(orderId) => navigatePath(paths.decision(currentRole, orderId))}
                  />
                ) : parsedSys.isSystem && parsedSys.offer ? (
                  (() => {
                    const offer = parsedSys.offer;
                    const latestStatus = (offer.negotiationId && negotiationMap.get(offer.negotiationId)?.status) || offer.status;
                    const isAccepted = latestStatus === 'ACCEPTED';
                    const isRejected = latestStatus === 'REJECTED';
                    const isCancelled = latestStatus === 'CANCELLED';
                    const isPending = latestStatus === 'PENDING';

                    const isSellerOffer = offer.senderRole === 'seller' || offer.negotiationId.startsWith('seller-offer-');
                    const isProposerMe = isSellerOffer ? isSeller : isBuyer;
                    const isRecipientMe = isSellerOffer ? isBuyer : isSeller;

                    return (
                      <div className="flex justify-center my-3 animate-fadeIn">
                        <div className={`max-w-md w-full rounded-2xl border p-3.5 shadow-xs text-center transition-all ${isAccepted
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : isRejected || isCancelled
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-gradient-to-b from-amber-50 to-orange-50/50 border-amber-300 text-amber-950'
                          }`}>
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            {isAccepted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : isRejected || isCancelled ? (
                              <XCircle className="w-4 h-4 text-rose-500" />
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
                                    : isSellerOffer
                                      ? '🏷️ Người Bán Đề Xuất Giá Mới'
                                      : '🤝 Đề Xuất Thương Lượng Giá Mới'}
                            </span>
                          </div>

                          <div className="my-1.5 flex items-baseline justify-center gap-2">
                            <span className="text-base font-black text-[#c34c36]">
                              {formatVND(offer.price)}
                            </span>
                            {listing.priceVnd > 0 && (
                              <span className="text-xs line-through text-slate-400 font-medium">
                                {formatVND(listing.priceVnd)}
                              </span>
                            )}
                            {listing.priceVnd > 0 && listing.priceVnd > offer.price && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Tiết kiệm {formatVND(listing.priceVnd - offer.price)}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-600 mb-2">
                            {isAccepted
                              ? (isBuyer
                                ? 'Người bán đã đồng ý mức giá này. Bạn có thể tiến hành đặt mua qua Escrow ngay bây giờ!'
                                : 'Mức giá đã chốt thành công. Đang chờ người mua tiến hành thanh toán qua Escrow.')
                              : isRejected
                                ? (isProposerMe ? 'Mức giá đề xuất chưa được chấp nhận.' : 'Bạn đã từ chối mức giá đề xuất này.')
                                : isCancelled
                                  ? 'Yêu cầu trả giá đã được hủy.'
                                  : isPending
                                    ? (isRecipientMe
                                      ? (isSellerOffer ? 'Người bán đề xuất giá ưu đãi cho bạn. Bạn có muốn đồng ý mua?' : 'Người mua gửi đề xuất giá cho sản phẩm của bạn. Vui lòng phản hồi:')
                                      : 'Đề xuất giá đã gửi tới đối phương, đang chờ phản hồi...')
                                    : ''}
                          </p>

                          {/* Recipient Action buttons */}
                          {isPending && isRecipientMe && (
                            <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-amber-200/60">
                              <button
                                type="button"
                                onClick={() => handleRespondOffer(offer.negotiationId, 'accepted', offer.senderRole, offer.price)}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Chấp nhận giá này' : 'Accept Offer'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRespondOffer(offer.negotiationId, 'declined', offer.senderRole, offer.price)}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Từ chối' : 'Decline'}</span>
                              </button>
                            </div>
                          )}

                          {/* Proposer Cancel button */}
                          {isPending && isProposerMe && (
                            <div className="mt-2 pt-2 border-t border-amber-200/60 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleCancelOffer(offer.negotiationId, offer.senderRole, offer.price)}
                                className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>{lang === 'vi' ? 'Hủy đề xuất trả giá' : 'Cancel Offer'}</span>
                              </button>
                            </div>
                          )}

                          {/* Checkout button for Buyer after accepted */}
                          {isAccepted && isBuyer && (
                            <div className="mt-2 pt-2 border-t border-emerald-200 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleBuyNow(offer.price, offer.negotiationId)}
                                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span>{lang === 'vi' ? `Đặt mua ngay với giá ${formatVND(offer.price)}` : `Buy Now at ${formatVND(offer.price)}`}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* STANDARD TEXT MESSAGE */
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-end gap-1.5 max-w-[80%]">
                      {!isMe && (
                        <img
                          src={resolvedPartnerAvatar}
                          alt={resolvedPartnerName}
                          className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0 mb-1"
                        />
                      )}
                      <div>
                        <div
                          className={`p-3 rounded-2xl text-xs font-medium shadow-2xs leading-relaxed break-words ${isMe
                            ? 'bg-gradient-to-r from-[#24263e] to-slate-800 text-white rounded-br-xs'
                            : 'bg-white border border-slate-200 text-[#24263e] rounded-bl-xs'
                            }`}
                        >
                          {msg.text}
                        </div>
                        <div className={`text-[10px] text-slate-400 mt-1 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Messenger-style Read / Sent status under my latest sent message */}
                    {isMe && isMyLastSent && (
                      <div className="flex items-center gap-1 mt-0.5 mr-1 text-[10px] font-semibold text-slate-400 animate-fadeIn">
                        {isLastMsgSeen ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>{lang === 'vi' ? 'Đã xem' : 'Seen'}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Check className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lang === 'vi' ? 'Đã gửi' : 'Sent'}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* 4. QUICK OFFER DRAWER / POPUP */}
      {showOfferForm && canShowOfferButton && (
        <div className={`p-3.5 border-t flex flex-col gap-2.5 animate-fadeIn shrink-0 ${isSeller ? 'bg-blue-50/40 border-blue-100' : 'bg-orange-50/40 border-orange-100'
          }`}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              {isSeller
                ? 'Nhập mức giá bạn muốn đề xuất bán (VNĐ):'
                : 'Nhập mức giá bạn muốn đề xuất mua (VNĐ):'}
            </label>
            <span className="text-xs font-bold text-slate-500">
              {lang === 'vi' ? 'Giá niêm yết:' : 'Listed price:'}{' '}
              {listing.priceVnd > 0 ? (
                formatVND(listing.priceVnd)
              ) : (
                <span className="italic text-slate-400">{lang === 'vi' ? 'Đang tải...' : 'Loading...'}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                value={offerInput > 0 ? formatVndInput(offerInput) : ''}
                onChange={(e) => {
                  const cleaned = cleanVndInput(e.target.value);
                  setOfferInput(cleaned ? Number(cleaned) : 0);
                  setOfferError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendOffer();
                  }
                }}
                placeholder="VD: 1.500.000"
                className={`w-full px-3.5 py-2 pr-9 border rounded-xl text-xs font-bold text-[#24263e] bg-white focus:outline-none ${isSeller ? 'focus:border-blue-600' : 'focus:border-[#c34c36]'
                  }`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none select-none">
                đ
              </span>
            </div>

            <button
              type="button"
              onClick={handleSendOffer}
              disabled={negotiationLoading}
              className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 ${isSeller ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#c34c36] hover:bg-[#a83d2a]'
                }`}
            >
              {negotiationLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSeller ? 'Gửi Đề Xuất Bán' : 'Gửi Yêu Cầu Trả Giá'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowOfferForm(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {offerError && (
            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{offerError}</span>
            </p>
          )}
        </div>
      )}

      {/* 5. BOTTOM TOOLBAR (INPUT & ACTIONS) */}
      <div className={`p-3 border-t flex items-center gap-2 shrink-0 ${isSeller ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
        }`}>
        {/* Price negotiation button */}
        {canShowOfferButton && (
          <button
            type="button"
            onClick={() => {
              if (!isSeller && maxRejectedPrice > 0 && offerInput <= maxRejectedPrice && listing.priceVnd > 50000) {
                setOfferInput(Math.min(listing.priceVnd - 50000, maxRejectedPrice + 50000));
              }
              setShowOfferForm(!showOfferForm);
              setShowInspectionProposalModal(false);
              setOfferError(null);
            }}
            className={`px-3 py-2 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1 ${isSeller
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95'
              : 'bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95'
              }`}
          >
            <span>💰</span>
            <span>
              {isSeller
                ? 'Đề xuất giá'
                : maxRejectedPrice > 0
                  ? 'Trả giá lại'
                  : 'Trả giá'}
            </span>
          </button>
        )}

        {/* Inspection Proposal Button (Only for Buyer when listing is active and no active proposal) */}
        {canShowInspectionProposalButton && (
          <button
            type="button"
            onClick={() => openInspectionProposal()}
            className="px-3 py-2 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95"
            title="Đề xuất kiểm định tại trung tâm & thương lượng chia phí"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'vi' ? 'Đề Xuất Kiểm Định' : 'Inspection Proposal'}</span>
            <span className="sm:hidden">Kiểm Định</span>
          </button>
        )}

        {/* Text Input */}
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={
            isSeller
              ? 'Tư vấn cho người mua...'
              : 'Nhắn tin thương lượng (an toàn 100% qua Escrow)...'
          }
          className={`flex-1 px-3.5 py-2 border rounded-xl text-xs text-[#24263e] focus:outline-none ${isSeller
            ? 'bg-white border-slate-200 focus:border-blue-500'
            : 'bg-[#faf8f5] border-gray-200 focus:border-[#c34c36]'
            }`}
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={isSending}
          className={`p-2.5 text-white rounded-xl cursor-pointer transition shadow-xs flex items-center justify-center ${isSeller ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#24263e] hover:bg-black'
            }`}
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* 6. INSPECTION PROPOSAL MODAL FOR BUYER */}
      {showInspectionProposalModal && <InspectionProposalModal
        key={inspectionPrefillData?.savedAt ?? listing.id}
        isOpen
        onClose={() => setShowInspectionProposalModal(false)}
        listing={listing}
        currentUser={currentUser}
        lang={lang}
        negotiationId={inspectionPrefillData ? inspectionPrefillData.negotiationId : latestAcceptedNegotiationId}
        agreedPrice={inspectionPrefillData ? inspectionPrefillData.agreedPrice : latestAcceptedOffer}
        initialData={inspectionPrefillData}
        onSubmitSuccess={handleProposalSubmitSuccess}
      />}
    </div>
  );
};
