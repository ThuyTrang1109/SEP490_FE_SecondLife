import { request, ApiResponse, PageResponse } from './apiClient';
import { TopupPackage, UserCredit, TopupPurchaseRequest, TopupPackagePurchaseResponse } from '../types';

export const topupService = {
  /**
   * Lấy danh sách các gói nạp dịch vụ công khai đang mở bán (active=true, pricingAvailable=true)
   * GET /api/v1/topup/packages
   */
  async getTopupPackages(): Promise<TopupPackage[]> {
    const response = await request<TopupPackage[]>('/v1/topup/packages', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data || response;
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },

  /**
   * Lấy số dư lượt dịch vụ của người dùng hiện tại
   * GET /api/v1/topup/my-credit
   */
  async getMyCredit(): Promise<UserCredit> {
    try {
      const response = await request<UserCredit>('/v1/topup/my-credit', {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch (err: any) {
      // Nếu là tài khoản Buyer (403 Forbidden do không có CREDIT_READ_SELF), trả về credit 0 mặc định
      const msg = String(err?.message || '');
      if (msg.includes('403') || err?.status === 403) {
        return { postCredits: 0, valuationCredits: 0, chatCredits: 0 };
      }
      throw err;
    }
  },

  /**
   * Mua gói dịch vụ bằng tiền từ ví SecondLife (Idempotent với requestId)
   * POST /api/v1/topup/purchase/{packageId}
   * Body: { requestId, packageVersion, expectedPrice }
   */
  async purchasePackage(
    packageId: string,
    body: TopupPurchaseRequest
  ): Promise<ApiResponse<TopupPackagePurchaseResponse>> {
    const response = await request<TopupPackagePurchaseResponse>(`/v1/topup/purchase/${packageId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      requiresAuth: true,
    });
    return response as any;
  },

  /**
   * Lấy danh sách lịch sử biên nhận mua gói dịch vụ của người dùng hiện tại
   * GET /api/v1/topup/purchases?page=0&size=20
   */
  async getPurchases(page = 0, size = 20): Promise<PageResponse<TopupPackagePurchaseResponse>> {
    const response = await request<PageResponse<TopupPackagePurchaseResponse>>(`/v1/topup/purchases?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data || response;
    return data;
  },

  /**
   * Xem chi tiết một biên nhận mua gói theo ID
   * GET /api/v1/topup/purchases/{purchaseId}
   */
  async getPurchaseDetail(purchaseId: string): Promise<TopupPackagePurchaseResponse> {
    const response = await request<TopupPackagePurchaseResponse>(`/v1/topup/purchases/${purchaseId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data || response;
    return data;
  },
};
