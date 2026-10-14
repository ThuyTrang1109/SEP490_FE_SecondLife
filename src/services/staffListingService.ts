import { request } from './apiClient';
import { StaffListingItemDTO } from '../types';

export interface StaffListingQueueResponse {
  content: StaffListingItemDTO[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  numberOfElements?: number;
  empty?: boolean;
}

export interface StaffListingRejectRequest {
  reason: string;
}

export const staffListingService = {
  /**
   * Danh sách bài đăng trong hàng đợi kiểm duyệt nghi trùng của Staff / Admin
   * GET /api/v1/staff/listings?page=0&size=10
   */
  async getStaffQueue(page = 0, size = 10): Promise<StaffListingQueueResponse> {
    const res = await request<StaffListingQueueResponse>(`/v1/staff/listings?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      content: Array.isArray(data?.content) ? data.content : [],
      number: data?.number ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? (Array.isArray(data?.content) ? data.content.length : 0),
      totalPages: data?.totalPages ?? 1,
      first: data?.first ?? page === 0,
      last: data?.last ?? true,
      numberOfElements: data?.numberOfElements ?? (Array.isArray(data?.content) ? data.content.length : 0),
      empty: data?.empty ?? (!Array.isArray(data?.content) || data.content.length === 0),
    };
  },

  /**
   * Chi tiết bài đăng kiểm duyệt
   * GET /api/v1/staff/listings/{postId}
   */
  async getStaffListingDetail(postId: string): Promise<StaffListingItemDTO> {
    const res = await request<StaffListingItemDTO>(`/v1/staff/listings/${postId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Phê duyệt bài đăng (Duyệt bài giá thường chuyển ACTIVE, giá cao chuyển PENDING_INSPECTION)
   * POST /api/v1/staff/listings/{postId}/approve
   */
  async approveStaffListing(postId: string): Promise<any> {
    const res = await request<any>(`/v1/staff/listings/${postId}/approve`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Từ chối bài đăng kèm lý do (tối đa 2000 ký tự)
   * POST /api/v1/staff/listings/{postId}/reject
   * Body: { reason: string }
   */
  async rejectStaffListing(postId: string, reason: string): Promise<any> {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new Error('Lý do từ chối không được để trống.');
    }
    const res = await request<any>(`/v1/staff/listings/${postId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: trimmed }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  // Legacy compatibility helpers
  async getQueue(page = 0, size = 10): Promise<any> {
    return this.getStaffQueue(page, size);
  },

  async getDetail(postId: string): Promise<any> {
    return this.getStaffListingDetail(postId);
  },

  async approve(postId: string): Promise<any> {
    return this.approveStaffListing(postId);
  },

  async reject(postId: string, reason: string): Promise<any> {
    return this.rejectStaffListing(postId, reason);
  },
};
