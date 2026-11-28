import { request, type PageResponse } from './apiClient';
import { SystemWalletData, SystemWalletTransactionsPage, SystemWalletTransactionFilter } from '../types';

export type SystemWalletBalanceFund = 'PRODUCT_ESCROW' | 'SHIPPING';

interface SystemWalletBalanceEntry {
  orderId: string | null;
  inspectionOrderId: string | null;
  amount: number;
  credited: number | null;
  debited: number | null;
}

export interface SystemWalletBalanceDetails {
  balance: number;
  recordsTotal: number;
  credited: number | null;
  debited: number | null;
  updatedAt: string;
  entries: PageResponse<SystemWalletBalanceEntry>;
}

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

  async getBalanceDetails(fund: SystemWalletBalanceFund, page = 0, signal?: AbortSignal): Promise<SystemWalletBalanceDetails> {
    const query = new URLSearchParams({ fund, page: String(page), size: '20' });
    const response = await request<SystemWalletBalanceDetails>('/admin/system-wallet/balance-details?' + query, {
      requiresAuth: true,
      signal,
    });
    return response.data;
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
    const extractedItems = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : [];
    return {
      items: extractedItems,
      page: data?.page ?? data?.number ?? p,
      size: data?.size ?? s,
      totalElements: data?.totalElements ?? extractedItems.length,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? data?.last ?? true,
    };
  },
};
