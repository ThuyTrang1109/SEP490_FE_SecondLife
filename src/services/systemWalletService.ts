import { request } from './apiClient';
import { SystemWalletData, SystemWalletTransactionsPage, SystemWalletTransactionFilter } from '../types';

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
   * Có hỗ trợ filter: type, hasShipping, orderId
   * Trả về data: { items, page, size, totalElements, totalPages, isLast }
   */
  async getTransactions(
    pageOrFilter: number | SystemWalletTransactionFilter = 0,
    size = 10,
    filter?: SystemWalletTransactionFilter
  ): Promise<SystemWalletTransactionsPage> {
    let p = 0;
    let s = 10;
    let type: string | undefined;
    let fundCategory: SystemWalletTransactionFilter['fundCategory'];
    let hasShipping: boolean | undefined;
    let orderId: string | undefined;

    if (typeof pageOrFilter === 'object' && pageOrFilter !== null) {
      p = pageOrFilter.page ?? 0;
      s = pageOrFilter.size ?? size ?? 10;
      type = pageOrFilter.type;
      fundCategory = pageOrFilter.fundCategory;
      hasShipping = pageOrFilter.hasShipping;
      orderId = pageOrFilter.orderId;
    } else {
      p = typeof pageOrFilter === 'number' ? pageOrFilter : 0;
      s = size ?? 10;
      if (filter) {
        type = filter.type;
        fundCategory = filter.fundCategory;
        hasShipping = filter.hasShipping;
        orderId = filter.orderId;
      }
    }

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(p));
    queryParams.set('size', String(s));
    if (type && type.trim() && type !== 'ALL') {
      queryParams.set('type', type.trim());
    }
    if (fundCategory) {
      queryParams.set('fundCategory', fundCategory);
    }
    if (hasShipping !== undefined) {
      queryParams.set('hasShipping', String(hasShipping));
    }
    if (orderId && orderId.trim()) {
      queryParams.set('orderId', orderId.trim());
    }

    const res = await request<SystemWalletTransactionsPage>(
      `/v1/admin/system-wallet/transactions?${queryParams.toString()}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      page: data?.page ?? p,
      size: data?.size ?? s,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },
};
