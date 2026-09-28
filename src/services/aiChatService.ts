import { request } from './apiClient';
import { AiChatResponseDto } from '../types';

export interface AiChatRequest {
  sessionId?: string;
  postId?: string;
  message: string;
  base64Image?: string;
}

export const aiChatService = {
  /**
   * Gửi tin nhắn tư vấn AI Chatbot (nhận reply từ LLM Backend)
   * Gửi JSON { sessionId, postId, message, base64Image } khớp đúng AiChatRequest DTO ở BE
   */
  async chat(
    messageOrPayload: string | AiChatRequest,
    sessionId?: string,
    postId?: string,
    base64Image?: string
  ): Promise<AiChatResponseDto> {
    let payload: AiChatRequest;
    if (typeof messageOrPayload === 'string') {
      payload = {
        message: messageOrPayload,
        sessionId: sessionId || undefined,
        postId: postId || undefined,
        base64Image: base64Image || undefined,
      };
    } else {
      payload = {
        message: messageOrPayload.message,
        sessionId: messageOrPayload.sessionId || sessionId || undefined,
        postId: messageOrPayload.postId || postId || undefined,
        base64Image: messageOrPayload.base64Image || base64Image || undefined,
      };
    }

    const response = await request<AiChatResponseDto>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });

    return (response as any)?.data || response;
  },
};
