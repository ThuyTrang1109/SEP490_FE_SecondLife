import { request } from './apiClient';
import { TopupPackage, UserCredit } from '../types';

export const topupService = {
  /**
   * Lấy danh sách các gói nạp xu / điểm uy tín
   */
  async getTopupPackages(): Promise<TopupPackage[]> {
    const response = await request<TopupPackage[]>('/topup/packages', {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy số dư xu của người dùng hiện tại
   */
  async getMyCredit(): Promise<UserCredit> {
    const response = await request<UserCredit>('/topup/my-credit', {
      method: 'GET',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Thực hiện thanh toán / mua gói nạp xu
   */
  async purchasePackage(packageId: string): Promise<UserCredit> {
    const response = await request<UserCredit>(`/topup/purchase/${packageId}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },
};
