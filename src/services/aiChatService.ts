import { getAccessToken } from './apiClient';
import { AiChatResponseDto } from '../types';

export const aiChatService = {
  /**
   * Gửi tin nhắn tư vấn AI Chatbot (nhận reply từ Ollama / LLM Backend)
   */
  async chat(message: string, sessionId?: string, postId?: string, image?: File): Promise<AiChatResponseDto> {
    const formData = new FormData();
    formData.append('message', message);
    if (sessionId) formData.append('sessionId', sessionId);
    if (postId) formData.append('postId', postId);
    if (image) formData.append('image', image);

    const token = getAccessToken();
    const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

    const res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Lỗi AI Chatbot (${res.status})`);
    }

    const responseJson = await res.json();
    return responseJson?.data || responseJson;
  },
};
