import React, { useState, useEffect } from 'react';
import { ChatMessage, Listing, Language, UserRole } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import {
  Sparkles,
  AlertTriangle,
  Check,
  X,
  Send,
  RotateCcw,
  ShoppingBag,
  ShieldCheck,
  Star,
  CheckCircle2,
  TrendingDown,
  Award
} from 'lucide-react';
import { reviewService } from '../../data/mockReviews';
import { negotiationService } from '../../services';

interface ChatModalProps {
  listing: Listing;
  currentRole: UserRole;
  onClose: () => void;
  lang: Language;
  onBuyClick?: (listing: Listing, agreedPrice?: number, negotiationId?: string) => void;
  onOpenSellerReviews?: (sellerId: string, sellerName: string) => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  listing,
  currentRole,
  onClose,
  lang,
  onBuyClick,
  onOpenSellerReviews
}) => {
  const t = translations[lang];

  const sellerTrust = reviewService.getSellerTrustProfile(listing.sellerId, listing.sellerName);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      senderId: 'buyer-01',
      senderName: 'Hoàng Quốc Khang',
      senderRole: 'buyer',
      text: 'Chào bạn! Máy còn nguyên hóa đơn mua hàng không ạ? Khả năng vận hành và bảo hành thế nào?',
      timestamp: '10:15'
    },
    {
      id: 'm-2',
      senderId: 'seller-01',
      senderName: listing.sellerName,
      senderRole: 'seller',
      text: 'Chào bạn! Máy nguyên zin 100%, đủ phụ kiện và hóa đơn. Mình hoàn toàn đồng ý giao dịch qua kiểm định SecondLife Hub để bạn an tâm!',
      timestamp: '10:17'
    },
    {
      id: 'm-3',
      senderId: 'buyer-01',
      senderName: 'Hoàng Quốc Khang',
      senderRole: 'buyer',
      text: 'Mình xin phép gửi đề xuất mua với mức giá này, nếu được bạn đồng ý để mình chốt cọc Escrow luôn nhé!',
      timestamp: '10:20',
      isOffer: true,
      offerAmountVnd: Math.round((listing.priceVnd * 0.94) / 100000) * 100000,
      offerStatus: 'pending'
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [offerInput, setOfferInput] = useState<number>(
    Math.round((listing.priceVnd * 0.92) / 100000) * 100000
  );
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [negotiationLoading, setNegotiationLoading] = useState(false);

  // Track latest accepted offer price & negotiationId
  const latestAcceptedMsg = messages
    .filter((m) => m.isOffer && m.offerStatus === 'accepted' && m.offerAmountVnd)
    .pop();
  const latestAcceptedOffer = latestAcceptedMsg?.offerAmountVnd;
  const latestAcceptedNegotiationId = latestAcceptedMsg?.negotiationId;

  // Load active negotiations for this post from Backend on mount
  useEffect(() => {
    let isMounted = true;
    const loadNegotiations = async () => {
      if (!listing?.id) return;
      try {
        const res = currentRole === 'seller'
          ? await negotiationService.getSellerNegotiations(0, 50)
          : await negotiationService.getBuyerNegotiations(0, 50);

        const matching = (res?.content || []).filter(n => n.postId === listing.id);
        if (matching.length > 0 && isMounted) {
          const loadedOfferMsgs: ChatMessage[] = matching.map(n => ({
            id: `nego-${n.id}`,
            senderId: n.buyerId || 'buyer',
            senderName: currentRole === 'buyer' ? 'Bạn' : 'Người Mua',
            senderRole: 'buyer',
            text: `Đề xuất thương lượng giá chính thức: ${formatVND(n.offeredPrice)}`,
            timestamp: n.createdAt ? new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay',
            isOffer: true,
            offerAmountVnd: n.offeredPrice,
            offerStatus: n.status === 'ACCEPTED' ? 'accepted' : n.status === 'REJECTED' || n.status === 'CANCELLED' ? 'declined' : 'pending',
            negotiationId: n.id,
          }));

          setMessages(prev => {
            const existingNegoIds = new Set(prev.map(m => m.negotiationId).filter(Boolean));
            const newToAdd = loadedOfferMsgs.filter(m => !existingNegoIds.has(m.negotiationId));
            return newToAdd.length > 0 ? [...prev, ...newToAdd] : prev;
          });
        }
      } catch (err) {
        console.warn('Could not load negotiations from BE:', err);
      }
    };
    loadNegotiations();
    return () => { isMounted = false; };
  }, [listing.id, currentRole]);

  const [aiAdvice, setAiAdvice] = useState<{
    counterOfferVnd: number;
    adviceText: string;
    warningMessage: string | null;
  }>({
    counterOfferVnd: Math.round((listing.priceVnd * 0.95) / 100000) * 100000,
    adviceText: 'Mức giá đề xuất của người mua (-6%) nằm trong biên độ thanh khoản cao của thị trường đồ cũ tại Việt Nam.',
    warningMessage: null
  });

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const scamTriggers = ['zalo', 'whatsapp', 'chuyển khoản trước', 'cọc ngoài', 'gửi link', 'ship ngoài'];
    const hasScam = scamTriggers.some((t) => text.toLowerCase().includes(t));

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentRole,
      senderName: currentRole === 'buyer' ? 'Hoàng Quốc Khang' : listing.sellerName,
      senderRole: currentRole === 'buyer' ? 'buyer' : 'seller',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      safetyWarning: hasScam
        ? 'Cảnh báo an toàn: Tin nhắn có dấu hiệu giao dịch ngoài luồng. Tuyệt đối không chuyển tiền cọc trực tiếp ngoài SecondLife Escrow!'
        : undefined
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');

    if (hasScam) {
      setAiAdvice((prev) => ({
        ...prev,
        warningMessage: 'Hệ thống AI phát hiện từ khóa lôi kéo ra Zalo/kênh ngoài. Đơn hàng sẽ mất bảo hiểm nếu bạn giao dịch ngoài hệ thống!'
      }));
    }
  };

  const handleSendOffer = async () => {
    if (!offerInput || offerInput <= 0) return;
    setNegotiationLoading(true);
    let negotiationId: string | undefined = undefined;

    try {
      const res = await negotiationService.createNegotiation(listing.id, offerInput);
      if (res?.id) {
        negotiationId = res.id;
      }
    } catch (err: any) {
      console.warn('Backend negotiation creation fallback to local state:', err);
    } finally {
      setNegotiationLoading(false);
    }

    const newOfferMsg: ChatMessage = {
      id: negotiationId ? `nego-${negotiationId}` : `offer-${Date.now()}`,
      senderId: currentRole,
      senderName: currentRole === 'buyer' ? 'Hoàng Quốc Khang' : listing.sellerName,
      senderRole: currentRole === 'buyer' ? 'buyer' : 'seller',
      text: `Đã gửi đề xuất thương lượng giá mới: ${formatVND(offerInput)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isOffer: true,
      offerAmountVnd: offerInput,
      offerStatus: 'pending',
      negotiationId,
    };

    setMessages((prev) => [...prev, newOfferMsg]);
    setShowOfferForm(false);
  };

  const handleRespondOffer = async (msgId: string, action: 'accepted' | 'declined') => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (targetMsg?.negotiationId) {
      try {
        if (action === 'accepted') {
          await negotiationService.acceptNegotiation(targetMsg.negotiationId);
        } else {
          await negotiationService.rejectNegotiation(targetMsg.negotiationId);
        }
      } catch (err: any) {
        console.warn('Backend respond negotiation error:', err);
      }
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, offerStatus: action } : m))
    );

    if (action === 'accepted') {
      if (targetMsg?.offerAmountVnd) {
        const confirmMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          senderId: 'system',
          senderName: 'SecondLife Bot',
          senderRole: 'system',
          text: `🎉 Thỏa thuận thành công! Người bán đã chấp nhận mức giá: ${formatVND(targetMsg.offerAmountVnd)}. Bạn có thể tiến hành đặt mua ngay với giá ưu đãi này!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setTimeout(() => {
          setMessages((prev) => [...prev, confirmMsg]);
        }, 300);
      }
    }
  };

  const handleCancelOffer = async (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (targetMsg?.negotiationId) {
      try {
        await negotiationService.cancelNegotiation(targetMsg.negotiationId);
      } catch (err: any) {
        console.warn('Backend cancel negotiation error:', err);
      }
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, offerStatus: 'declined', text: 'Đã hủy yêu cầu thương lượng' } : m))
    );
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
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#fce5da] to-white border-b border-[#24263e]/15 flex items-center justify-between text-[#24263e]">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-11 h-11 rounded-xl object-cover border border-[#24263e]/20 shrink-0"
            />
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs text-[#24263e] truncate">
                  {listing.sellerName}
                </span>

                {/* Seller Trust Score Pill (Requirement 2 & 3) */}
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
              </div>

              <div className="text-[11px] text-slate-600 truncate mt-0.5">
                <span className="font-semibold text-slate-800">{listing.title}</span> •{' '}
                <span className="font-bold text-[#c34c36]">{formatVND(listing.priceVnd)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Buy Now button in header (Requirement 5) */}
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

            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 hover:bg-white/60 p-2 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Accepted Offer Sticky Banner (if any offer accepted) */}
        {latestAcceptedOffer && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs">
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
        <div className="bg-[#faf8f5] border-b border-gray-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#24263e]">
            <Sparkles className="w-4 h-4 text-[#c34c36] shrink-0" />
            <span className="text-[11px] font-medium leading-snug">
              <span className="font-bold text-[#24263e]">
                {lang === 'vi' ? 'AI Gợi ý thương lượng: ' : 'AI Negotiation Advisor: '}
              </span>
              {aiAdvice.adviceText}
            </span>
          </div>

          <button
            onClick={() =>
              handleSendMessage(
                lang === 'vi'
                  ? `Mình đề xuất chốt mức ${formatVND(aiAdvice.counterOfferVnd)} qua kiểm định Hub nhé!`
                  : `I propose a deal at ${formatVND(aiAdvice.counterOfferVnd)} through Hub inspection!`
              )
            }
            className="shrink-0 ml-2 px-2.5 py-1 bg-[#24263e] hover:bg-black text-white rounded-lg text-[10px] font-bold cursor-pointer transition shadow-2xs"
          >
            {lang === 'vi' ? 'Dùng giá gợi ý:' : 'Use suggestion:'} {formatVND(aiAdvice.counterOfferVnd)}
          </button>
        </div>

        {/* Anti-Scam Banner (If triggered) */}
        {aiAdvice.warningMessage && (
          <div className="bg-rose-50 border-b border-rose-200 p-2.5 flex items-center gap-2 text-rose-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{aiAdvice.warningMessage}</span>
          </div>
        )}

        {/* Chat Messages Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#faf8f5]">
          {messages.map((msg) => {
            const isMe = msg.senderRole === currentRole;
            const isSystem = msg.senderRole === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-2xl text-[11px] font-bold shadow-2xs flex items-center gap-2 max-w-md text-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

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

                      {/* Interactive Offer Card (Requirement 5) */}
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

                          {/* Offer Status & Action Buttons */}
                          <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-2">
                            {msg.offerStatus === 'pending' ? (
                              !isMe ? (
                                /* When recipient views the offer */
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleRespondOffer(msg.id, 'accepted')}
                                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{lang === 'vi' ? 'Chấp nhận giá' : 'Accept Offer'}</span>
                                  </button>
                                  <button
                                    onClick={() => handleRespondOffer(msg.id, 'declined')}
                                    className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>{lang === 'vi' ? 'Từ chối' : 'Decline'}</span>
                                  </button>
                                </div>
                              ) : (
                                /* When sender views their pending offer */
                                <div className="space-y-1.5">
                                  <div className="text-[10px] opacity-80 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span>{lang === 'vi' ? 'Đang chờ người bán phản hồi...' : 'Waiting for seller response...'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOffer(msg.id)}
                                    className="w-full py-1 px-2 bg-rose-600/80 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center justify-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>{lang === 'vi' ? 'Hủy yêu cầu thương lượng' : 'Cancel Offer'}</span>
                                  </button>
                                </div>
                              )
                            ) : msg.offerStatus === 'accepted' ? (
                              /* OFFER ACCEPTED: Direct Buy Button (Requirement 5) */
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  <span>{lang === 'vi' ? '✓ Người bán đã chấp thuận mức giá này!' : '✓ Seller accepted this offer!'}</span>
                                </div>

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
          })}
        </div>

        {/* Quick Offer Popup */}
        {showOfferForm && (
          <div className="p-3.5 bg-[#FFFFFF] border-t border-gray-200 flex items-center gap-3 animate-fadeIn">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700">
                  {lang === 'vi' ? 'Nhập mức giá bạn muốn đề xuất mua (VNĐ):' : 'Enter offer price (VND):'}
                </label>
                <span className="text-[10px] text-[#c34c36] font-bold">
                  {lang === 'vi' ? 'Giá gốc:' : 'Original:'} {formatVND(listing.priceVnd)}
                </span>
              </div>
              <input
                type="number"
                step={50000}
                value={offerInput}
                onChange={(e) => setOfferInput(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-black text-[#24263e] focus:outline-none focus:border-[#c34c36] mt-1"
              />
            </div>
            <button
              onClick={handleSendOffer}
              className="px-4 py-2 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-xl text-xs font-bold mt-4 cursor-pointer transition shadow-xs"
            >
              {lang === 'vi' ? 'Gửi Offer' : 'Send Offer'}
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
        <div className="p-3 bg-[#FFFFFF] border-t border-gray-200 flex items-center gap-2">
          <button
            onClick={() => setShowOfferForm(!showOfferForm)}
            className="px-3 py-2 bg-gradient-to-r from-[#c34c36] to-[#e36a54] hover:opacity-95 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1"
          >
            <span>💰</span>
            <span>{lang === 'vi' ? 'Trả giá / Offer' : 'Make Offer'}</span>
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              lang === 'vi'
                ? 'Nhắn tin thương lượng (an toàn 100% qua Escrow)...'
                : 'Chat & negotiate safely via Escrow...'
            }
            className="flex-1 px-3.5 py-2 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
          />

          <button
            onClick={() => handleSendMessage()}
            className="p-2.5 bg-[#24263e] hover:bg-black text-white rounded-xl cursor-pointer transition shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
