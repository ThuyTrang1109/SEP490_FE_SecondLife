import { request } from './apiClient';
import { TopupPackage, UserCredit } from '../types';

export const topupService = {
  /**
   * Lấy danh sách các gói nạp xu / điểm uy tín
   */
  async getTopupPackages(): Promise<TopupPackage[]> {
    try {
      const response = await request<TopupPackage[]>('/v1/topup/packages', {
        method: 'GET',
        requiresAuth: true,
      });
      return (response as any)?.data || response;
    } catch (err: any) {
      console.warn('Cannot load packages from BE, using default packages:', err);
      return [
        { id: 'pkg-1', name: 'Gói Khởi Đầu', packageName: 'Gói Khởi Đầu', price: 50000, priceVnd: 50000, postCredits: 5, chatCredits: 20, valuationCredits: 5, creditPoints: 5 },
        { id: 'pkg-2', name: 'Gói Tiết Kiệm', packageName: 'Gói Tiết Kiệm', price: 120000, priceVnd: 120000, postCredits: 15, chatCredits: 60, valuationCredits: 15, creditPoints: 15, isPopular: true },
        { id: 'pkg-3', name: 'Gói Doanh Nhân', packageName: 'Gói Doanh Nhân', price: 200000, priceVnd: 200000, postCredits: 30, chatCredits: 150, valuationCredits: 30, creditPoints: 30 },
      ];
    }
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
