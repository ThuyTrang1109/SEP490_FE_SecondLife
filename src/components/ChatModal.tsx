import React, { useState } from 'react';
import { ChatMessage, Listing, Language, UserRole } from '../types';
import { translations, formatVND } from '../utils/translations';
import { MessageSquare, Send, Sparkles, AlertTriangle, ShieldCheck, Check, X, ArrowRight, User } from 'lucide-react';

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

  // Real-time AI negotiation & anti-scam advice state
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

    // Check scam triggers locally
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
            />
            <div className="overflow-hidden">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate max-w-xs sm:max-w-md">
                {listing.title}
              </h3>
              <div className="text-xs text-emerald-400 font-extrabold font-['Outfit']">
                {formatVND(listing.priceVnd)}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg text-xs"
          >
            ✕ Đóng
          </button>
        </div>

        {/* AI Smart Negotiation Advisor Pill */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-medium leading-snug">
              <span className="font-bold">AI Tư vấn đàm phán: </span>
              {aiAdvice.adviceText}
            </span>
          </div>

          <button
            onClick={() => handleSendMessage(`Mình đề xuất chốt mức ${formatVND(aiAdvice.counterOfferVnd)} qua kiểm định nhé!`)}
            className="shrink-0 ml-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
          >
            Dùng giá gợi ý: {formatVND(aiAdvice.counterOfferVnd)}
          </button>
        </div>

        {/* Anti-Scam Banner (If triggered) */}
        {aiAdvice.warningMessage && (
          <div className="bg-red-50 border-b border-red-200 p-2.5 flex items-center gap-2 text-red-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{aiAdvice.warningMessage}</span>
          </div>
        )}

        {/* Chat Messages Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          {messages.map((msg) => {
            const isMe = msg.senderRole === currentRole;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                  {msg.senderName} • {msg.timestamp}
                </span>

                <div
                  className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed ${isMe
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-bl-xs'
                    }`}
                >
                  <p>{msg.text}</p>

                  {/* If it's an offer card */}
                  {msg.isOffer && msg.offerAmountVnd && (
                    <div className={`mt-2.5 p-3 rounded-xl border ${isMe ? 'bg-emerald-700/60 border-emerald-500' : 'bg-slate-50 border-slate-200'
                      }`}>
                      <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                        Đề xuất mức giá chính thức:
                      </div>
                      <div className="text-base font-black font-['Outfit'] mt-0.5">
                        {formatVND(msg.offerAmountVnd)}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        {msg.offerStatus === 'pending' ? (
                          !isMe ? (
                            <>
                              <button
                                onClick={() => handleRespondOffer(msg.id, 'accepted')}
                                className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Đồng ý
                              </button>
                              <button
                                onClick={() => handleRespondOffer(msg.id, 'declined')}
                                className="flex-1 py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Từ chối
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] opacity-75">Đang chờ đối phương phản hồi...</span>
                          )
                        ) : (
                          <span className={`text-[10px] font-bold ${msg.offerStatus === 'accepted' ? 'text-emerald-300' : 'text-red-300'}`}>
                            {msg.offerStatus === 'accepted' ? '✓ Đã đồng ý giá này' : '✕ Đã từ chối'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {msg.safetyWarning && (
                    <div className="mt-1.5 text-[10px] text-red-200 bg-red-900/40 p-1.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-300" />
                      <span>{msg.safetyWarning}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Offer Popup / Drawer */}
        {showOfferForm && (
          <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-600">Nhập mức giá muốn đề xuất (VNĐ):</label>
              <input
                type="number"
                step={100000}
                value={offerInput}
                onChange={(e) => setOfferInput(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-['Outfit']"
              />
            </div>
            <button
              onClick={handleSendOffer}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs mt-3"
            >
              Gửi giá
            </button>
            <button
              onClick={() => setShowOfferForm(false)}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs mt-3"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <button
            onClick={() => setShowOfferForm(!showOfferForm)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
          >
            💰 Trả giá
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Nhắn tin thương lượng (an toàn qua Escrow)..."
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden"
          />

          <button
            onClick={() => handleSendMessage()}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
