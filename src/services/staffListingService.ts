import { request, PageResponse } from './apiClient';
import { ListingDraftResponse } from './postService';

export interface StaffListingRejectRequest {
  reason: string;
}

export const staffListingService = {
  /**
   * Danh sách bài đăng trong hàng đợi kiểm duyệt nghi trùng của Staff
   * GET /api/staff/listings?page=0&size=20
   */
  async getQueue(page = 0, size = 20): Promise<PageResponse<ListingDraftResponse>> {
    const res = await request<PageResponse<ListingDraftResponse>>(`/staff/listings?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Chi tiết bài đăng kiểm duyệt kèm danh sách bài đối chiếu duplicateMatches
   * GET /api/staff/listings/{postId}
   */
  async getDetail(postId: string): Promise<ListingDraftResponse> {
    const res = await request<ListingDraftResponse>(`/staff/listings/${postId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Staff phê duyệt bài đăng nghi trùng (Duyệt bài giá thường chuyển ACTIVE, giá cao chuyển PENDING_INSPECTION)
   * POST /api/staff/listings/{postId}/approve
   */
  async approve(postId: string): Promise<ListingDraftResponse> {
    try {
      const res = await request<ListingDraftResponse>(`/staff/listings/${postId}/approve`, {
        method: 'POST',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      // Fallback to admin post approve if staff listing endpoint not routed
      const res = await request<ListingDraftResponse>(`/admin/posts/${postId}/approve`, {
        method: 'POST',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    }
  },

  /**
   * Staff từ chối bài đăng nghi trùng
   * POST /api/staff/listings/{postId}/reject
   */
  async reject(postId: string, reason: string): Promise<ListingDraftResponse> {
    try {
      const res = await request<ListingDraftResponse>(`/staff/listings/${postId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch {
      // Fallback to admin post reject
      const res = await request<ListingDraftResponse>(`/admin/posts/${postId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    }
  },
};
