import React, { useState, useEffect, useCallback } from 'react';
import { Listing, Language, UserRole } from '../types';
import { MessageSquare, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { chatService, ChatRoomDto, parseSystemMessage } from '../services';
import { formatVND } from '../utils/translations';

interface InboxViewProps {
  listings: Listing[];
  currentRole: UserRole;
  lang: Language;
  onOpenChat: (listing: Listing) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ listings, currentRole, lang, onOpenChat }) => {
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch rooms from Backend API: GET /api/v1/chats
  const loadChatRooms = useCallback(async () => {
    try {
      const data = await chatService.getChatRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load chat rooms from backend:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChatRooms();

    // Subscribe to WebSocket for incoming messages to refresh inbox in real-time
    chatService.connectWebSocket();
    const unsubscribe = chatService.subscribeToMessages(() => {
      loadChatRooms();
    });

    // Also poll gently every 10 seconds as backup
    const intervalId = setInterval(loadChatRooms, 10000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [loadChatRooms]);

  const handleSelectRoom = (room: ChatRoomDto) => {
    // Check if listing already exists in prop
    const found = listings.find((l) => l.id === room.postId);
    if (found) {
      onOpenChat(found);
      return;
    }

    // Otherwise create fallback Listing object from ChatRoom metadata
    const fallbackListing: Listing = {
      id: room.postId,
      title: room.postTitle || 'Sản phẩm trao đổi',
      brand: 'Chính hãng',
      priceVnd: 500000,
      description: 'Thông tin sản phẩm trong cuộc hội thoại',
      category: 'Electronics',
      condition: 'good',
      sellerId: room.sellerId,
      sellerName: room.sellerName || 'Người bán',
      location: 'Hồ Chí Minh',
      status: 'active',
      isEscrowSecured: true,
      photos: {
        front: room.postImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        back: room.postImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      },
      createdAt: room.updatedAt || new Date().toISOString(),
    };

    onOpenChat(fallbackListing);
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#c34c36] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">
          {lang === 'vi' ? 'Đang tải hộp thư trò chuyện...' : 'Loading inbox messages...'}
        </p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="max-w-3xl mx-auto pb-16">
        <div className="bg-[#FFFFFF] rounded-3xl p-12 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#24263e]">
            {lang === 'vi' ? 'Hộp thư trống' : 'Empty Inbox'}
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {lang === 'vi'
              ? 'Bạn chưa có cuộc trò chuyện nào. Khi bạn liên hệ người bán hoặc có người gửi tin nhắn về bài đăng của bạn, tin nhắn sẽ xuất hiện tại đây theo thời gian thực.'
              : 'You have no conversations yet. When someone messages you or you contact a seller, messages will appear here in real-time.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="bg-[#FFFFFF] rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-[#faf8f5] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#24263e] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#c34c36]" />
              {lang === 'vi' ? 'Hộp thư đàm phán & Chat' : 'Negotiation & Chat Inbox'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {lang === 'vi'
                ? 'Quản lý các cuộc trao đổi và tiến trình đàm phán giá qua WebSocket thời gian thực.'
                : 'Manage real-time conversations and price negotiation progress.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rooms.map((room) => {
            const partnerName =
              currentRole === 'seller'
                ? room.buyerName || 'Khách Hàng'
                : room.sellerName || 'Người Bán';

            const partnerAvatar =
              currentRole === 'seller'
                ? room.buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
                : room.sellerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

            const timeStr = room.updatedAt
              ? new Date(room.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className="p-4 sm:p-6 hover:bg-slate-50 transition cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center group"
              >
                <div className="relative shrink-0">
                  <img
                    src={room.postImageUrl || partnerAvatar}
                    alt={room.postTitle || 'Product'}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200"
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

                  <div className="flex items-center gap-2 text-xs mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold truncate max-w-[140px]">
                      {currentRole === 'seller' ? 'Người Mua' : 'Người Bán'}: {partnerName}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 truncate">
                    {formatLastMessage(room.lastMessage)}
                  </p>
                </div>

                <div className="shrink-0 text-slate-300 group-hover:text-[#c34c36] transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
