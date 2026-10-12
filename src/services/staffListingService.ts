import { request, PageResponse } from './apiClient';
import { ListingDraftResponse } from './postService';

export interface StaffListingRejectRequest {
  reason: string;
}

export const staffListingService = {
  /**
   * Danh sách bài đăng trong hàng đợi kiểm duyệt nghi trùng của Staff / Admin
   * GET /api/v1/staff/listings?page=0&size=20 (fallback: /api/v1/admin/posts)
   */
  async getQueue(page = 0, size = 20): Promise<any> {
    try {
      const res = await request<any>(`/v1/staff/listings?page=${page}&size=${size}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
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
    }
  },

  /**
   * Chi tiết bài đăng kiểm duyệt
   * GET /api/v1/staff/listings/{postId} (fallback: /api/v1/posts/{postId})
   */
  async getDetail(postId: string): Promise<ListingDraftResponse> {
    try {
      const res = await request<ListingDraftResponse>(`/v1/staff/listings/${postId}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
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
    }
  },

  /**
   * Phê duyệt bài đăng (Duyệt bài giá thường chuyển ACTIVE, giá cao chuyển PENDING_INSPECTION)
   * POST /api/v1/staff/listings/{postId}/approve (fallback: /api/v1/admin/posts/{postId}/approve)
   */
  async approve(postId: string): Promise<any> {
    try {
      const res = await request<any>(`/v1/staff/listings/${postId}/approve`, {
        method: 'POST',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      const res = await request<any>(`/v1/admin/posts/${postId}/approve`, {
        method: 'POST',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    }
  },

  /**
   * Từ chối bài đăng kèm lý do
   * POST /api/v1/staff/listings/{postId}/reject (body: { reason }) (fallback: /api/v1/admin/posts/{postId}/reject?reason=...)
   */
  async reject(postId: string, reason: string): Promise<any> {
    try {
      const res = await request<any>(`/v1/staff/listings/${postId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const res = await request<any>(`/v1/admin/posts/${postId}/reject${query}`, {
        method: 'POST',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    }
  },
};
