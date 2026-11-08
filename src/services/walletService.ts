import { request, requestGet } from './apiClient';
import {
  UserWallet,
  DepositResponseDTO,
  DepositCreateRequestDTO,
  WalletTransaction,
  WalletTransactionsQuery,
  WalletTransactionsPage,
} from '../types';
import {
  normalizeWalletTransaction,
  normalizeWalletTransactionPage,
} from '../utils/walletTransactions';

export type WalletBackend = UserWallet;

export const walletService = {
  /**
   * Lấy số dư và thông tin ví hiện tại của người dùng đang đăng nhập
   * GET /api/v1/wallets/me
   */
  async getMyWallet(): Promise<UserWallet> {
    const response = await requestGet<UserWallet>('/v1/wallets/me', {
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as UserWallet;
  },

  /**
   * Tạo yêu cầu nạp tiền vào ví (nhận mã chuyển khoản và thông tin VietQR)
   * POST /api/v1/wallets/deposit-request
   */
  async createDepositRequest(amount: number): Promise<DepositResponseDTO> {
    const payload: DepositCreateRequestDTO = { amount };
    const response = await request<DepositResponseDTO>('/v1/wallets/deposit-request', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as DepositResponseDTO;
  },

  /**
   * Lấy danh sách lịch sử giao dịch ví người dùng (hỗ trợ lọc loại, khoảng thời gian và phân trang)
   * GET /api/v1/wallets/me/transactions
   */
  async getTransactions(
    query: WalletTransactionsQuery = {},
    signal?: AbortSignal
  ): Promise<WalletTransactionsPage> {
    const params = new URLSearchParams();
    params.set('page', String(query.page ?? 0));
    params.set('size', String(query.size ?? 10));
    params.set('sort', query.sort || 'createdAt,desc');

    if (query.type && (query.type as string) !== 'ALL') {
      params.set('type', query.type);
    }
    if (query.from && query.from.trim()) {
      params.set('from', query.from.trim());
    }
    if (query.to && query.to.trim()) {
      params.set('to', query.to.trim());
    }

    const response = await request<any>(`/v1/wallets/me/transactions?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
      signal,
    });

    return normalizeWalletTransactionPage(response, query.page ?? 0, query.size ?? 10);
  },

  /**
   * Lấy chi tiết một giao dịch ví cụ thể của người dùng
   * GET /api/v1/wallets/me/transactions/{transactionId}
   */
  async getTransactionDetail(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<WalletTransaction> {
    if (!transactionId) {
      throw new Error('Mã giao dịch (transactionId) không được để trống.');
    }

    const response = await request<any>(`/v1/wallets/me/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      requiresAuth: true,
      signal,
    });

    const data =
      (response as any)?.data !== undefined &&
      (response as any)?.data !== null &&
      typeof (response as any)?.data === 'object' &&
      !('id' in response)
        ? (response as any).data
        : response;

    return normalizeWalletTransaction(data);
  },

  /**
   * Lấy lịch sử giao dịch của ví
   * GET /api/v1/wallets/me/transactions
   */
  async getTransactionHistory(): Promise<WalletTransaction[]> {
    const response = await request<any>('/v1/wallets/me/transactions?page=0&size=50&sort=createdAt,desc', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;

    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.items)) {
      list = data.items;
    } else if (data && Array.isArray(data.content)) {
      list = data.content;
    } else if (data && data.data && Array.isArray(data.data.items)) {
      list = data.data.items;
    } else if (data && data.data && Array.isArray(data.data.content)) {
      list = data.data.content;
    } else if (data && data.data && Array.isArray(data.data)) {
      list = data.data;
    }

    return list
      .map((item: any) => ({
        ...item,
        amount: Number(item.amount ?? 0),
        status: item.status || 'SUCCESS',
        description: item.description || (
          item.type === 'DEPOSIT' ? 'Nạp tiền vào ví (VietQR)' :
          item.type === 'PAYMENT' ? 'Thanh toán mua gói / dịch vụ' :
          item.type === 'EARNING' ? 'Tiền bán hàng Escrow giải ngân' :
          item.type === 'REFUND' ? 'Hoàn tiền bảo lãnh Escrow' :
          item.type === 'WITHDRAW' ? 'Rút tiền về ngân hàng' : 'Biến động số dư ví'
        ),
      }))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }) as WalletTransaction[];
  },

  /**
   * Người dùng tạo yêu cầu rút tiền từ ví về tài khoản ngân hàng
   * POST /api/v1/wallets/withdrawals
   */
  async requestWithdrawal(data: CreateWithdrawalRequestDto): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>('/wallets/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Người dùng xem lịch sử các yêu cầu rút tiền của mình
   * GET /api/v1/wallets/withdrawals
   */
  async getMyWithdrawals(page = 0, size = 20): Promise<{
    items: WalletWithdrawalResponseDto[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    isLast: boolean;
  }> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('size', String(size));

    const res = await request<any>(`/wallets/withdrawals?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items) ? data.items : Array.isArray(data?.content) ? data.content : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },

  /**
   * Admin lấy danh sách tất cả yêu cầu rút tiền
   * GET /api/v1/wallets/admin/withdrawals
   */
  async getAdminWithdrawals(status?: string, page = 0, size = 20): Promise<{
    items: WalletWithdrawalResponseDto[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    isLast: boolean;
  }> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    params.append('page', String(page));
    params.append('size', String(size));

    const res = await request<any>(`/wallets/admin/withdrawals?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items) ? data.items : Array.isArray(data?.content) ? data.content : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },

  /**
   * Admin phê duyệt hoặc từ chối yêu cầu rút tiền
   * POST /api/v1/wallets/admin/withdrawals/{id}/review
   */
  async reviewWithdrawal(id: string, action: 'APPROVE' | 'REJECT', adminNote?: string): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(`/wallets/admin/withdrawals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, adminNote: adminNote || '' }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};

export interface CreateWithdrawalRequestDto {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface WalletWithdrawalResponseDto {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletWithdrawalReviewRequestDto {
  action: 'APPROVE' | 'REJECT';
  adminNote?: string;
}

