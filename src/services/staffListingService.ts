import { request, PageResponse } from './apiClient';
import { ListingDraftResponse } from './postService';

export interface StaffListingRejectRequest {
  reason: string;
}

export const staffListingService = {
  /**
   * Danh sách bài đăng trong hàng đợi kiểm duyệt nghi trùng của Staff / Admin
   * GET /api/v1/admin/posts?status=PENDING&page=0&size=20
   */
  async getQueue(page = 0, size = 20): Promise<any> {
    try {
      const res = await request<any>(`/v1/admin/posts?status=PENDING&page=${page}&size=${size}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      const res = await request<any>(`/v1/admin/posts?page=${page}&size=${size}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    }
  },

  /**
   * Chi tiết bài đăng kiểm duyệt
   */
  async getDetail(postId: string): Promise<ListingDraftResponse> {
    try {
      const res = await request<ListingDraftResponse>(`/v1/posts/${postId}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      return {
        id: postId,
        postId,
        title: 'Chi tiết bài đăng',
        description: '',
        imageUrls: [],
        descriptionAccepted: false,
        status: 'PENDING',
      };
    }
  },

  /**
   * Phê duyệt bài đăng (Duyệt bài giá thường chuyển ACTIVE, giá cao chuyển PENDING_INSPECTION)
   * POST /api/v1/admin/posts/{postId}/approve
   */
  async approve(postId: string): Promise<any> {
    const res = await request<any>(`/v1/admin/posts/${postId}/approve`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Từ chối bài đăng kèm lý do (BE @RequestParam String reason)
   * POST /api/v1/admin/posts/{postId}/reject?reason=...
   */
  async reject(postId: string, reason: string): Promise<any> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    const res = await request<any>(`/v1/admin/posts/${postId}/reject${query}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
