import { request } from './apiClient';

export interface SellerReputationDto {
  sellerId: string;
  score: number | null;
  goodTransactions: number;
  badTransactions: number;
  evaluatedOrders: number;
  minimumEvaluatedOrders: number;
  assessmentStatus: string;
  confirmedIncidents: number;
  seriousIncidents: number;
  sellingRestricted: boolean;
  warningCode?: string | null;
  updatedAt?: string | null;
  formulaVersion?: string | null;
  sellerCancellationOrders?: number;
  sellerReturnFaultOrders?: number;
  nonFulfillmentOrders?: number;
  nonFulfillmentRate?: number | null;
  handoverEvaluatedOrders?: number;
  lateHandoverOrders?: number;
  lateHandoverRate?: number | null;
  transactionScore?: number | null;
  confirmationPenaltyPoints?: number | null;
}

export interface ReputationHistoryDto {
  id: string;
  sellerId: string;
  eventType: string;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  reason?: string;
  createdAt: string;
}

export const reputationService = {
  /**
   * Lấy chỉ số uy tín công khai của Người Bán theo sellerId
   * GET /api/v1/sellers/{sellerId}/reputation
   */
  async getSellerReputation(sellerId: string): Promise<SellerReputationDto | null> {
    if (!sellerId) return null;
    try {
      const res = await request<any>(`/sellers/${sellerId}/reputation`, {
        method: 'GET',
        requiresAuth: false,
      });
      const data = (res as any)?.data || res;
      return data || null;
    } catch (err) {
      console.warn('[reputationService] getSellerReputation fallback:', err);
      return null;
    }
  },

  /**
   * Người bán tự tra cứu uy tín của bản thân
   * GET /api/v1/seller/reputation/me
   */
  async getMyReputation(): Promise<SellerReputationDto | null> {
    try {
      const res = await request<any>('/seller/reputation/me', {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      return data || null;
    } catch (err) {
      console.warn('[reputationService] getMyReputation error:', err);
      return null;
    }
  },

  /**
   * Xem lịch sử biến động điểm uy tín cá nhân
   * GET /api/v1/seller/reputation/me/history
   */
  async getMyReputationHistory(page = 0, size = 20): Promise<{
    items: ReputationHistoryDto[];
    page: number;
    size: number;
    totalElements: number;
  }> {
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await request<any>(`/seller/reputation/me/history?${params.toString()}`, {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      return {
        items: Array.isArray(data?.items) ? data.items : Array.isArray(data?.content) ? data.content : [],
        page: data?.page ?? page,
        size: data?.size ?? size,
        totalElements: data?.totalElements ?? 0,
      };
    } catch (err) {
      console.warn('[reputationService] getMyReputationHistory error:', err);
      return { items: [], page, size, totalElements: 0 };
    }
  },

  /**
   * Admin gỡ bỏ giới hạn bán hàng cho Seller
   * POST /api/v1/admin/sellers/{sellerId}/reputation/lift-restriction
   */
  async liftRestriction(sellerId: string, reason: string): Promise<SellerReputationDto> {
    const res = await request<SellerReputationDto>(`/admin/sellers/${sellerId}/reputation/lift-restriction`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
