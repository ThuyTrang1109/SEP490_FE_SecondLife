import { request } from './apiClient';
import { AiChatResponseDto } from '../types';

export interface AiChatRequest {
  sessionId?: string;
  postId?: string;
  message: string;
  image?: File | Blob;
  base64Image?: string;
}

function base64ToBlob(base64: string): Blob {
  try {
    const parts = base64.split(';base64,');
    const contentType = parts[0]?.replace('data:', '') || 'image/jpeg';
    const raw = atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (err) {
    console.warn('Failed to convert base64 image to Blob:', err);
    return new Blob([], { type: 'image/jpeg' });
  }
}

export const aiChatService = {
  /**
   * Gửi tin nhắn tư vấn AI Chatbot (nhận reply từ LLM Backend)
   * Sử dụng FormData để tương thích với @ModelAttribute và MultipartFile ở Backend AiChatController
   */
  async chat(
    messageOrPayload: string | AiChatRequest,
    sessionId?: string,
    postId?: string,
    imageOrBase64?: File | Blob | string
  ): Promise<AiChatResponseDto> {
    let payload: AiChatRequest;
    if (typeof messageOrPayload === 'string') {
      payload = {
        message: messageOrPayload,
        sessionId: sessionId || undefined,
        postId: postId || undefined,
        ...(typeof imageOrBase64 === 'string'
          ? { base64Image: imageOrBase64 }
          : { image: imageOrBase64 }),
      };
    } else {
      payload = {
        message: messageOrPayload.message,
        sessionId: messageOrPayload.sessionId || sessionId || undefined,
        postId: messageOrPayload.postId || postId || undefined,
        image: messageOrPayload.image || (imageOrBase64 instanceof Blob ? imageOrBase64 : undefined),
        base64Image: messageOrPayload.base64Image || (typeof imageOrBase64 === 'string' ? imageOrBase64 : undefined),
      };
    }

    const formData = new FormData();
    formData.append('message', payload.message || '');
    if (payload.sessionId) {
      formData.append('sessionId', payload.sessionId);
    }
    if (payload.postId) {
      formData.append('postId', payload.postId);
    }

    if (payload.image instanceof Blob) {
      const fileName = (payload.image as File).name || 'upload.jpg';
      formData.append('image', payload.image, fileName);
    } else if (payload.base64Image && payload.base64Image.trim()) {
      const blob = base64ToBlob(payload.base64Image);
      formData.append('image', blob, 'chat_image.jpg');
    }

    const response = await request<AiChatResponseDto>('/v1/ai/chat', {
      method: 'POST',
      body: formData,
      requiresAuth: true,
    });

    return (response as any)?.data || response;
  },

  async regenerate(sessionId: string): Promise<any> {
    const response = await request<any>(/v1/posts/regenerate-chat/, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },
};

