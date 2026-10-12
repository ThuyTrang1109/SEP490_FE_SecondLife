import { request } from './apiClient';
import { TopupPackage, UserCredit } from '../types';

export const topupService = {
  /**
   * Lấy danh sách các gói nạp xu / điểm uy tín
   */
  async getTopupPackages(): Promise<TopupPackage[]> {
    const response = await request<TopupPackage[]>('/v1/topup/packages', {
      method: 'GET',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy số dư xu của người dùng hiện tại
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
   * Thực hiện thanh toán / mua gói nạp xu
   */
  async purchasePackage(packageId: string): Promise<UserCredit> {
    const response = await request<UserCredit>(`/v1/topup/purchase/${packageId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },
};
