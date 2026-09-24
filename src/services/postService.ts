import { request, getAccessToken, ACCESS_TOKEN_KEY } from './apiClient';

export interface PostInitPayload {
  title: string;
  categoryId?: string;
  itemId?: string;
  priceVnd?: number;
  conditionGrade?: string;
  description?: string;
  images?: File[];
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
   * Khởi tạo bài đăng mới (upload ảnh / form multipart)
   */
  async initPost(payload: PostInitPayload): Promise<any> {
    const formData = new FormData();
    if (payload.title) formData.append('title', payload.title);
    if (payload.categoryId) formData.append('categoryId', payload.categoryId);
    if (payload.itemId) formData.append('itemId', payload.itemId);
    if (payload.priceVnd) formData.append('priceVnd', payload.priceVnd.toString());
    if (payload.conditionGrade) formData.append('conditionGrade', payload.conditionGrade);
    if (payload.description) formData.append('description', payload.description);

    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((img) => formData.append('images', img));
    }

    const token = getAccessToken();
    const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

    const res = await fetch(`${BASE_URL}/posts/init`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Lỗi khi khởi tạo bài đăng (${res.status})`);
    }

    return await res.json();
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
   * Chốt đơn giao dịch mua/đổi bài đăng từ khung chat
   */
  async finalizeChat(sessionId: string): Promise<string> {
    const response = await request<string>(`/posts/finalize-chat/${sessionId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Finalized deal';
  },
};
