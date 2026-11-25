import { request } from './apiClient';

export const adminPostService = {
  /**
   * Admin lấy danh sách các bài đăng (lọc theo status / category)
   */
  async getAdminPosts(
    status?: string,
    categoryId?: string,
    itemId?: string,
    pagination?: { page: number; size: number }
  ): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (categoryId) params.append('categoryId', categoryId);
    if (itemId) params.append('itemId', itemId);
    if (pagination) {
      params.set('page', String(pagination.page));
      params.set('size', String(pagination.size));
      params.append('sort', 'createdAt,desc');
      params.append('sort', 'id,desc');
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await request<any>(`/v1/admin/posts${queryString}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Admin duyệt bài đăng
   */
  async approvePost(postId: string): Promise<string> {
    const response = await request<string>(`/v1/admin/posts/${postId}/approve`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Post approved successfully';
  },

  /**
   * Admin từ chối bài đăng kèm lý do
   */
  async rejectPost(postId: string, reason?: string): Promise<string> {
    const params = new URLSearchParams();
    if (reason) params.append('reason', reason);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await request<string>(`/v1/admin/posts/${postId}/reject${queryString}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response?.message || 'Post rejected successfully';
  },
};
