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

export const postService = {
  /**
   * Lấy danh sách tin đăng bài công khai từ Backend
   */
  async getPublicPosts(categoryId?: string, itemId?: string): Promise<any> {
    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId);
    if (itemId) params.append('itemId', itemId);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await request<any>(`/posts${queryString}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Khởi tạo bài đăng mới (POST /api/v1/posts/init với JSON payload)
   * Trả về postId, sessionId, aiInitialMessage
   */
  async initPost(payload: PostInitRequest): Promise<PostInitResponse> {
    const response = await request<PostInitResponse>('/posts/init', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Gửi bài đăng để Admin duyệt
   */
  async submitPost(postId: string): Promise<string> {
    const response = await request<string>(`/posts/submit/${postId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Submit successfully';
  },

  /**
   * AI tổng hợp cuộc hội thoại và cập nhật mô tả vào bài đăng (POST /api/v1/posts/finalize-chat/{sessionId})
   */
  async finalizeChat(sessionId: string): Promise<string> {
    const response = await request<string>(`/posts/finalize-chat/${sessionId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Đã tổng hợp mô tả thành công';
  },
};
