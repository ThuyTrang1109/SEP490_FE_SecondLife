import { request, getAccessToken, ACCESS_TOKEN_KEY } from './apiClient';

export interface PostInitRequest {
  categoryId: string;
  itemId: string;
  base64Image: string;
}

export interface PostInitResponse {
  postId: string;
  sessionId: string;
  aiInitialMessage: string;
}

export interface PostSubmitRequest {
  title: string;
  description: string;
  price: number;
}

export const postService = {
  /**
   * Lấy danh sách tin đăng bài công khai từ Backend
   */
  async getPublicPosts(categoryId?: string, itemId?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId);
      if (itemId) params.append('itemId', itemId);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await request<any>(`/v1/posts${queryString}`, {
        method: 'GET',
        requiresAuth: false,
      });
      return (response as any)?.data || response;
    } catch (err) {
      console.warn('Backend chưa có API GET /api/v1/posts công khai (404), trả về danh sách rỗng fallback:', err);
      return [];
    }
  },

  /**
   * Khởi tạo bài đăng mới (POST /api/v1/posts/init với JSON payload)
   * Trả về postId, sessionId, aiInitialMessage
   * Chỉ gửi categoryId, itemId để khớp với Jackson deserializer của Backend PostInitRequest
   */
  async initPost(payload: PostInitRequest): Promise<PostInitResponse> {
    const jsonBody = {
      categoryId: payload.categoryId,
      itemId: payload.itemId,
    };
    const response = await request<PostInitResponse>('/v1/posts/init', {
      method: 'POST',
      body: JSON.stringify(jsonBody),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Gửi bài đăng để Admin duyệt
   */
  async submitPost(postId: string, data?: PostSubmitRequest): Promise<string> {
    const payload = data || {
      title: 'Bài đăng mới',
      description: 'Mô tả bài đăng sản phẩm',
      price: 1000000,
    };
    const response = await request<string>(`/v1/posts/submit/${postId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Gửi bài đăng thành công';
  },

  /**
   * AI tổng hợp cuộc hội thoại và cập nhật mô tả vào bài đăng (POST /api/v1/posts/finalize-chat/{sessionId})
   */
  async finalizeChat(sessionId: string): Promise<string> {
    const response = await request<string>(`/v1/posts/finalize-chat/${sessionId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Đã tổng hợp mô tả thành công';
  },
};
