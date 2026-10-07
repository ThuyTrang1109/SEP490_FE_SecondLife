import React, { useState, useEffect } from 'react';
import { Listing, Language, UserRole, ChatMessage } from '../types';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';

interface InboxViewProps {
  listings: Listing[];
  currentRole: UserRole;
  lang: Language;
  onOpenChat: (listing: Listing) => void;
}

interface ChatThread {
  listing: Listing;
  latestMessage: ChatMessage;
  unreadCount?: number;
}

export const InboxView: React.FC<InboxViewProps> = ({ listings, currentRole, lang, onOpenChat }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    const loadThreads = () => {
      const loadedThreads: ChatThread[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chat_history_')) {
          const listingId = key.replace('chat_history_', '');
          const listing = listings.find(l => l.id === listingId);
          if (!listing) continue;

          // Filter out chats not relevant to this role if needed.
          // For demo, we just show all chats where this listing is involved.
          
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored) as ChatMessage[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                const latestMessage = parsed[parsed.length - 1];
                loadedThreads.push({
                  listing,
                  latestMessage
                });
              }
            }
          } catch (err) {}
        }
      }
      
      // Sort threads by latest message timestamp (roughly)
      loadedThreads.sort((a, b) => {
        const tA = a.latestMessage.timestamp || '';
        const tB = b.latestMessage.timestamp || '';
        return tB.localeCompare(tA);
      });
      
      setThreads(loadedThreads);
    };

    loadThreads();

    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('chat_history_')) {
        loadThreads();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    // Periodically refresh in case of manual local storage changes or lack of cross-tab events in same tab
    const intervalId = setInterval(loadThreads, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(intervalId);
    };
  }, [listings, currentRole]);

  if (threads.length === 0) {
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
              ? 'Bạn chưa có cuộc trò chuyện nào. Khi có người nhắn tin hoặc bạn liên hệ với người bán, tin nhắn sẽ xuất hiện tại đây.' 
              : 'You have no conversations yet. When someone messages you or you contact a seller, messages will appear here.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="bg-[#FFFFFF] rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-[#faf8f5]">
          <h2 className="text-xl font-bold text-[#24263e] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#c34c36]" />
            {lang === 'vi' ? 'Hộp thư đàm phán' : 'Negotiation Inbox'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'vi' ? 'Quản lý các cuộc trò chuyện và đề xuất giá.' : 'Manage your conversations and offers.'}
          </p>
        </div>
        
        <div className="divide-y divide-slate-100">
          {threads.map((thread) => (
            <div 
              key={thread.listing.id}
              onClick={() => onOpenChat(thread.listing)}
              className="p-4 sm:p-6 hover:bg-slate-50 transition cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center group"
            >
              <div className="relative shrink-0">
                <img 
                  src={thread.listing.photos.front} 
                  alt={thread.listing.title} 
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#c34c36] text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-white">
                  <MessageSquare className="w-3 h-3" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-[#24263e] truncate">
                    {thread.listing.title}
                  </h3>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {thread.latestMessage.timestamp}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs mb-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold truncate max-w-[120px]">
                    {currentRole === 'seller' ? 'Khách Hàng' : thread.listing.sellerName}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-[#24263e]">
                    {thread.latestMessage.senderName}
                  </span>
                </div>
                
                <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                  {thread.latestMessage.isOffer ? (
                    <span className="text-[#c34c36] font-semibold">
                      [Đề xuất giá: {thread.latestMessage.offerAmountVnd?.toLocaleString('vi-VN')} đ]
                    </span>
                  ) : (
                    <span>{thread.latestMessage.text}</span>
                  )}
                </p>
              </div>
              
              <div className="shrink-0 text-slate-300 group-hover:text-[#c34c36] transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
