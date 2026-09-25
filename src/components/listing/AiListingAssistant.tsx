import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, CheckCircle2, Loader2, ShieldCheck, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { Language } from '../../types';
import { aiChatService, postService } from '../../services';

interface Message {
  id: string;
  role: 'ai' | 'seller';
  content: string;
  timestamp: string;
}

export interface AiListingAssistantProps {
  sessionId: string;
  postId: string;
  aiInitialMessage: string;
  lang: Language;
  onPostSubmitted: (postId: string) => void;
  onCancel?: () => void;
}

export const AiListingAssistant: React.FC<AiListingAssistantProps> = ({
  sessionId,
  postId,
  aiInitialMessage,
  lang,
  onPostSubmitted,
  onCancel,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-msg',
      role: 'ai',
      content: aiInitialMessage || (lang === 'vi'
        ? 'Xin chào! Tôi là Trợ lý AI SecondLife. Hãy cung cấp thêm thông tin về tình trạng máy, xuất xứ, phụ kiện để tôi hỗ trợ tổng hợp mô tả chuẩn SEO và đề xuất định giá tốt nhất cho bạn.'
        : 'Hello! I am SecondLife AI Assistant. Please tell me more about the item condition, origins, and accessories so I can compile an optimized description for you.'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizeNotice, setFinalizeNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userText = inputText.trim();
    setInputText('');
    setErrorMsg(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'seller',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await aiChatService.chat(userText, sessionId, postId);
      const aiReply = res?.reply || (res as any)?.message || (lang === 'vi' ? 'Tôi đã ghi nhận thông tin sản phẩm của bạn.' : 'I have noted your item details.');
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'vi' ? 'Không thể kết nối tới Trợ lý AI. Vui lòng thử lại.' : 'Failed to reach AI Assistant. Please retry.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleFinalizeChat = async () => {
    setIsFinalizing(true);
    setErrorMsg(null);
    try {
      const res = await postService.finalizeChat(sessionId);
      setIsFinalized(true);
      setFinalizeNotice(
        typeof res === 'string' && res.length > 0 && !res.toLowerCase().includes('finalized')
          ? res
          : (lang === 'vi'
              ? 'AI đã tổng hợp cuộc trò chuyện và cập nhật mô tả chi tiết vào bài đăng thành công! Bạn có thể gửi bài đăng ngay bây giờ.'
              : 'AI has summarized the conversation and saved the description to your post! You can now submit the post.')
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'vi' ? 'Lỗi khi hoàn tất mô tả AI. Vui lòng thử lại.' : 'Failed to finalize AI description.'));
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSubmitPost = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await postService.submitPost(postId);
      onPostSubmitted(postId);
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'vi' ? 'Gửi duyệt bài đăng thất bại.' : 'Failed to submit post.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex flex-col h-[700px] max-w-4xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#EC1577] to-[#F1622A] flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>{lang === 'vi' ? 'Trợ Lý AI Soạn Thảo Bài Đăng' : 'AI Listing Description Assistant'}</span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ollama LLM
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              {lang === 'vi'
                ? 'Hội thoại với AI để làm rõ tình trạng, ngoại quan và để AI tạo mô tả hoàn chỉnh'
                : 'Chat with AI to clarify condition, specs and automatically generate description'}
            </p>
          </div>
        </div>

        {onCancel && !isFinalized && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition cursor-pointer"
          >
            {lang === 'vi' ? 'Quay lại' : 'Back'}
          </button>
        )}
      </div>

      {/* Status Notice Banner */}
      {finalizeNotice && (
        <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{finalizeNotice}</span>
          </div>
          <button
            onClick={handleSubmitPost}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === 'vi' ? 'Đang gửi...' : 'Submitting...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Gửi duyệt bài đăng ngay' : 'Submit Post Now'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {messages.map((m) => {
          const isAi = m.role === 'ai';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                  isAi
                    ? 'bg-white border border-gray-200 text-slate-800'
                    : 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-medium'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={`text-[10px] mt-1.5 text-right ${
                    isAi ? 'text-slate-400' : 'text-white/80'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
              {!isAi && (
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <Loader2 className="w-4 h-4 text-[#EC1577] animate-spin" />
              <span>{lang === 'vi' ? 'AI đang suy nghĩ và phản hồi...' : 'AI is processing your response...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Action Toolbar & Input */}
      <div className="p-4 bg-white border-t border-gray-200 space-y-3">
        {/* Quick finalize toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#EC1577]" />
            {lang === 'vi'
              ? 'Sau khi cung cấp đủ chi tiết, hãy nhấn Hoàn tất mô tả để AI tạo mô tả chính thức:'
              : 'When you are done sharing item details, finalize to generate official description:'}
          </span>

          <div className="flex items-center gap-2">
            {!isFinalized ? (
              <button
                type="button"
                onClick={handleFinalizeChat}
                disabled={isFinalizing || isSending}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === 'vi' ? 'AI đang tạo mô tả...' : 'Compiling description...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Hoàn tất mô tả sản phẩm' : 'Finalize Description'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitPost}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === 'vi' ? 'Đang gửi duyệt...' : 'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Gửi duyệt bài đăng' : 'Submit Post'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending || isSubmitting}
            placeholder={
              lang === 'vi'
                ? 'Nhập thông tin thêm cho AI (ví dụ: máy mua năm nào, phụ kiện còn gì, có vết trầy nào không...)'
                : 'Type additional details for AI (e.g. purchase date, accessories, blemishes...)'
            }
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending || isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'vi' ? 'Gửi' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
