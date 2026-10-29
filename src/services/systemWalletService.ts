import { request } from './apiClient';
import { SystemWalletData, SystemWalletTransactionsPage } from '../types';

export const systemWalletService = {
  /**
   * Lấy số dư ví hệ thống nội bộ của Admin
   * GET /api/v1/admin/system-wallet
   * Trả về data: { id, currency, heldBalance, shippingBalance, revenueBalance, totalBalance, updatedAt }
   */
  async getSystemWallet(): Promise<SystemWalletData> {
    const res = await request<SystemWalletData>('/v1/admin/system-wallet', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lấy lịch sử biến động giao dịch của ví hệ thống
   * GET /api/v1/admin/system-wallet/transactions?page=0&size=10
   * Trả về data: { items, page, size, totalElements, totalPages, isLast }
   */
  async getTransactions(page = 0, size = 10): Promise<SystemWalletTransactionsPage> {
    const res = await request<SystemWalletTransactionsPage>(
      `/v1/admin/system-wallet/transactions?page=${page}&size=${size}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },
};
