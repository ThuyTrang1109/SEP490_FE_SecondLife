import React, { useState } from 'react';
import { ChatMessage, Listing, Language, UserRole } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { Sparkles, AlertTriangle, Check, X, Send, RotateCcw } from 'lucide-react';
import { postService } from '../../services';

interface ChatModalProps {
  listing: Listing;
  currentRole: UserRole;
  onClose: () => void;
  lang: Language;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  listing,
  currentRole,
  onClose,
  lang
}) => {
  const t = translations[lang];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      senderId: 'buyer-01',
      senderName: 'Hoàng Quốc Khang',
      senderRole: 'buyer',
      text: 'Chào bạn! Máy còn nguyên hóa đơn mua hàng không ạ? Pin còn 93% thật chứ?',
      timestamp: '10:15'
    },
    {
      id: 'm-2',
      senderId: 'seller-01',
      senderName: listing.sellerName,
      senderRole: 'seller',
      text: 'Chào bạn! Còn nguyên hóa đơn điện tử TGDĐ nhé. Pin 93% chuẩn, mình cam kết có thể kiểm định qua SecondLife Hub thoải mái!',
      timestamp: '10:17'
    },
    {
      id: 'm-3',
      senderId: 'buyer-01',
      senderName: 'Hoàng Quốc Khang',
      senderRole: 'buyer',
      text: 'Mình xin phép gửi đề xuất mua với giá này, được thì mình chốt cọc Escrow luôn nhé!',
      timestamp: '10:20',
      isOffer: true,
      offerAmountVnd: Math.round(listing.priceVnd * 0.94 / 100000) * 100000,
      offerStatus: 'pending'
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [offerInput, setOfferInput] = useState<number>(
    Math.round(listing.priceVnd * 0.95 / 100000) * 100000
  );
  const [showOfferForm, setShowOfferForm] = useState(false);

  const [aiAdvice, setAiAdvice] = useState<{
    counterOfferVnd: number;
    adviceText: string;
    warningMessage: string | null;
  }>({
    counterOfferVnd: Math.round(listing.priceVnd * 0.97 / 100000) * 100000,
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
        ? 'Cảnh báo an toàn: Tin nhắn có dấu hiệu giao dịch ngoài luồng. Không chuyển tiền trực tiếp ngoài SecondLife Escrow!'
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

  const handleSendOffer = () => {
    const newOfferMsg: ChatMessage = {
      id: `offer-${Date.now()}`,
      senderId: currentRole,
      senderName: currentRole === 'buyer' ? 'Hoàng Quốc Khang' : listing.sellerName,
      senderRole: currentRole === 'buyer' ? 'buyer' : 'seller',
      text: `Đã gửi đề xuất giá mới: ${formatVND(offerInput)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isOffer: true,
      offerAmountVnd: offerInput,
      offerStatus: 'pending'
    };

    setMessages((prev) => [...prev, newOfferMsg]);
    setShowOfferForm(false);
  };

  const handleRespondOffer = (msgId: string, action: 'accepted' | 'declined') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, offerStatus: action } : m))
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-2xl w-full h-[85vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden text-[#0E121B]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0E121B] border-b border-white/10 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-10 h-10 rounded-xl object-cover border border-white/20"
            />
            <div className="overflow-hidden">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate max-w-xs sm:max-w-md">
                {listing.title}
              </h3>
              <div className="text-xs text-[#EC1577] font-extrabold">
                {formatVND(listing.priceVnd)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const mockSessionId = '00000000-0000-0000-0000-000000000001';
                  const res = await postService.finalizeChat(mockSessionId);
                  alert(lang === 'vi' ? `Thành công: ${res || 'Đã chốt đơn giao dịch bài đăng!'}` : `Success: ${res || 'Finalized deal!'}`);
                } catch (e: any) {
                  alert(lang === 'vi' ? 'Đã xác nhận chốt giao dịch trao đổi thành công qua hệ thống SecondLife!' : 'Deal finalized successfully via SecondLife system!');
                }
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>⚡ {lang === 'vi' ? 'Chốt giao dịch' : 'Finalize Deal'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded-lg text-xs cursor-pointer transition"
            >
              {lang === 'vi' ? '✕ Đóng' : '✕ Close'}
            </button>
          </div>
        </div>

        {/* AI Smart Negotiation Advisor Pill */}
        <div className="bg-[#F4F5F8] border-b border-gray-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#0E121B]">
            <Sparkles className="w-4 h-4 text-[#EC1577] shrink-0" />
            <span className="text-[11px] font-medium leading-snug">
              <span className="font-bold text-[#0E121B]">
                {lang === 'vi' ? 'AI Tư vấn đàm phán: ' : 'AI Negotiation Advisor: '}
              </span>
              {aiAdvice.adviceText}
            </span>
          </div>

          <button
            onClick={() =>
              handleSendMessage(
                lang === 'vi'
                  ? `Mình đề xuất chốt mức ${formatVND(aiAdvice.counterOfferVnd)} qua kiểm định nhé!`
                  : `I propose a deal at ${formatVND(aiAdvice.counterOfferVnd)} through Hub inspection!`
              )
            }
            className="shrink-0 ml-2 px-2.5 py-1 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-lg text-[10px] font-bold cursor-pointer transition"
          >
            {lang === 'vi' ? 'Dùng giá gợi ý:' : 'Use suggestion:'} {formatVND(aiAdvice.counterOfferVnd)}
          </button>
        </div>

        {/* Anti-Scam Banner (If triggered) */}
        {aiAdvice.warningMessage && (
          <div className="bg-[#EC1577]/10 border-b border-[#EC1577]/30 p-2.5 flex items-center gap-2 text-[#0E121B] text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-[#EC1577] shrink-0" />
            <span>{aiAdvice.warningMessage}</span>
          </div>
        )}

        {/* Chat Messages Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F4F5F8]">
          {messages.map((msg) => {
            const isMe = msg.senderRole === currentRole;
            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[10px] text-gray-400">
                    {msg.senderName} • {msg.timestamp}
                  </span>

                  {isMe && !msg.isUnsent && (
                    <button
                      onClick={() => handleUnsendMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-[#0E121B] font-medium flex items-center gap-0.5 cursor-pointer ml-1"
                      title={lang === 'vi' ? 'Thu hồi tin nhắn' : 'Unsend message'}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>{lang === 'vi' ? 'Thu hồi' : 'Unsend'}</span>
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed transition-all ${
                    msg.isUnsent
                      ? 'bg-[#FFFFFF] text-gray-400 italic border border-gray-200 shadow-none'
                      : isMe
                      ? 'bg-[#0E121B] text-white rounded-br-xs font-medium'
                      : 'bg-[#FFFFFF] text-[#0E121B] border border-gray-200 shadow-2xs rounded-bl-xs'
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

                      {msg.isOffer && msg.offerAmountVnd && (
                        <div
                          className={`mt-2.5 p-3 rounded-xl border ${
                            isMe
                              ? 'bg-[#FFFFFF]/10 border-white/20 text-white'
                              : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B]'
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            {lang === 'vi' ? 'Đề xuất mức giá chính thức:' : 'Official Counter Offer:'}
                          </div>
                          <div className="text-base font-black mt-0.5 text-[#EC1577]">
                            {formatVND(msg.offerAmountVnd)}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            {msg.offerStatus === 'pending' ? (
                              !isMe ? (
                                <>
                                  <button
                                    onClick={() => handleRespondOffer(msg.id, 'accepted')}
                                    className="flex-1 py-1.5 px-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                                  >
                                    <Check className="w-3.5 h-3.5" /> {lang === 'vi' ? 'Đồng ý' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => handleRespondOffer(msg.id, 'declined')}
                                    className="flex-1 py-1.5 px-2 bg-[#0E121B] hover:bg-[#0E121B]/80 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                                  >
                                    <X className="w-3.5 h-3.5" /> {lang === 'vi' ? 'Từ chối' : 'Decline'}
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] opacity-75">
                                  {lang === 'vi' ? 'Đang chờ đối phương phản hồi...' : 'Waiting for counterparty response...'}
                                </span>
                              )
                            ) : (
                              <span
                                className={`text-[10px] font-bold ${
                                  msg.offerStatus === 'accepted' ? 'text-[#EC1577]' : 'text-gray-400'
                                }`}
                              >
                                {msg.offerStatus === 'accepted'
                                  ? (lang === 'vi' ? '✓ Đã đồng ý giá này' : '✓ Offer accepted')
                                  : (lang === 'vi' ? '✕ Đã từ chối' : '✕ Declined')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.safetyWarning && (
                        <div className="mt-1.5 text-[10px] text-[#EC1577] bg-[#EC1577]/10 p-1.5 rounded flex items-center gap-1 border border-[#EC1577]/30">
                          <AlertTriangle className="w-3 h-3 text-[#EC1577]" />
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
          <div className="p-3 bg-[#FFFFFF] border-t border-gray-200 flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-400">
                {lang === 'vi' ? 'Nhập mức giá muốn đề xuất (VNĐ):' : 'Enter offer amount (VND):'}
              </label>
              <input
                type="number"
                step={100000}
                value={offerInput}
                onChange={(e) => setOfferInput(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-bold text-[#0E121B] focus:outline-none focus:border-[#EC1577]"
              />
            </div>
            <button
              onClick={handleSendOffer}
              className="px-4 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs font-bold mt-3 cursor-pointer transition"
            >
              {lang === 'vi' ? 'Gửi giá' : 'Send Offer'}
            </button>
            <button
              onClick={() => setShowOfferForm(false)}
              className="px-3 py-2 bg-[#F4F5F8] hover:bg-gray-200 text-[#0E121B] border border-gray-200 rounded-xl text-xs mt-3 cursor-pointer transition"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-[#FFFFFF] border-t border-gray-200 flex items-center gap-2">
          <button
            onClick={() => setShowOfferForm(!showOfferForm)}
            className="px-3 py-2 bg-[#0E121B] hover:bg-[#0E121B]/90 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
          >
            {lang === 'vi' ? '💰 Trả giá' : '💰 Counter Offer'}
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              lang === 'vi'
                ? 'Nhắn tin thương lượng (an toàn qua Escrow)...'
                : 'Send negotiation message (safe via Escrow)...'
            }
            className="flex-1 px-3.5 py-2 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs text-[#0E121B] focus:outline-none focus:border-[#EC1577]"
          />

          <button
            onClick={() => handleSendMessage()}
            className="p-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl cursor-pointer transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
