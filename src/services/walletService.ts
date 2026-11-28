import { ACCESS_TOKEN_KEY, request, requestGet, resolveApiUrl } from './apiClient';
import type { RequestOptions } from './apiClient';
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

export const OFFICIAL_BANK_WARNING_TEXT =
  'Vui lòng kiểm tra kỹ tên ngân hàng, số tài khoản và tên chủ tài khoản trước khi xác nhận. SecondLife sẽ thực hiện chuyển khoản theo thông tin bạn cung cấp. Nếu thông tin không chính xác, tiền có thể được chuyển nhầm hoặc khó thu hồi. Bạn chịu trách nhiệm về tính chính xác của thông tin đã xác nhận theo các điều khoản và quy định áp dụng.';

export const WITHDRAWAL_PROCESSING_NOTICE =
  'Yêu cầu rút tiền của bạn sẽ được nhân viên kiểm tra và xử lý dự kiến trong vòng 1–3 ngày làm việc.';

export const WITHDRAWAL_SUBMITTED_NOTICE =
  'Yêu cầu rút tiền của bạn đã được gửi thành công và đang chờ nhân viên tiếp nhận.';

export const DEFAULT_BANK_ACCOUNT_STORAGE_KEY = 'sl_default_bank_account_id';

export const WITHDRAWAL_DISPUTE_TYPES: Array<{ code: string; label: string }> = [
  { code: 'NOT_RECEIVED', label: 'Chưa nhận được tiền' },
  { code: 'SHORT_AMOUNT', label: 'Nhận thiếu tiền' },
  { code: 'WRONG_AMOUNT', label: 'Nhận sai số tiền' },
  { code: 'WRONG_ACCOUNT', label: 'Tiền được chuyển vào tài khoản khác' },
  { code: 'INCORRECT_TRANSACTION_INFO', label: 'Thông tin giao dịch không chính xác' },
  { code: 'INVALID_EVIDENCE', label: 'Minh chứng chuyển khoản không hợp lệ' },
  { code: 'OTHER', label: 'Vấn đề khác' },
];

export const WITHDRAWAL_RESOLUTION_OUTCOMES: Array<{ code: string; label: string; description: string }> = [
  {
    code: 'RESOLVED_VALID_TRANSFER',
    label: 'Chuyển khoản hợp lệ (Giữ nguyên giao dịch)',
    description: 'Đã đối chiếu sao kê ngân hàng xác nhận tiền đã chuyển đúng thông tin snapshot.',
  },
  {
    code: 'RESOLVED_RETRY_TRANSFER',
    label: 'Chuyển khoản lại (Đưa về lỗi CK để xử lý lại)',
    description: 'Giao dịch ngân hàng chưa vào tài khoản người nhận; giữ tiền phong tỏa để chuyển khoản lại.',
  },
  {
    code: 'RESOLVED_REFUND_TO_WALLET',
    label: 'Hoàn tiền về số dư khả dụng của ví',
    description: 'Giao dịch không thành công / đã thu hồi; hoàn lại toàn bộ số tiền rút về ví người dùng.',
  },
];

export type WithdrawalStatusCode =
  | 'PENDING'
  | 'PROCESSING'
  | 'TRANSFERRED_AWAITING_REVIEW'
  | 'DISPUTED'
  | 'DISPUTE_PROCESSING'
  | 'DISPUTE_RESOLVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TRANSFER_FAILED';

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ tiếp nhận',
  PROCESSING: 'Đang xử lý',
  TRANSFERRED_AWAITING_REVIEW: 'Đã chuyển khoản - Chờ đối soát',
  DISPUTED: 'Có báo cáo lỗi',
  DISPUTE_PROCESSING: 'Đang xử lý khiếu nại',
  DISPUTE_RESOLVED: 'Đã xử lý khiếu nại',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
  TRANSFER_FAILED: 'Chuyển khoản thất bại',
};

export const notifyWalletBalanceUpdated = (balance?: number, deductAmount?: number) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('secondlife_wallet_updated', {
        detail: { balance, deductAmount, timestamp: Date.now() },
      }),
    );
    try {
      localStorage.setItem('sl_wallet_last_updated', String(Date.now()));
    } catch {}
  }
};

export const walletService = {
  /**
   * Lấy số dư và thông tin ví hiện tại của người dùng đang đăng nhập
   * GET /api/v1/wallets/me
   */
  async getMyWallet(options?: Pick<RequestOptions, 'signal' | 'isBackground'>): Promise<UserWallet> {
    const response = await requestGet<UserWallet>('/v1/wallets/me', {
      requiresAuth: true,
      ...options,
    });
    const wallet = ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as UserWallet;
    return wallet;
  },

  /**
   * Tạo yêu cầu nạp tiền vào ví (nhận mã chuyển khoản và thông tin VietQR)
   * POST /api/v1/wallets/deposit-request
   */
  async getDepositRequest(id: string): Promise<DepositResponseDTO> {
    const response = await requestGet<DepositResponseDTO>('/v1/wallets/deposit-request/' + encodeURIComponent(id), { requiresAuth: true });
    return response.data ?? (response as unknown as DepositResponseDTO);
  },

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
   * Lấy danh sách lịch sử giao dịch ví người dùng
   * GET /api/v1/wallets/me/transactions
   */
  async getTransactions(
    query: WalletTransactionsQuery = {},
    signal?: AbortSignal,
    options?: Pick<RequestOptions, 'isBackground'>,
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
      ...options,
    });

    return normalizeWalletTransactionPage(response, query.page ?? 0, query.size ?? 10);
  },

  /**
   * Lấy chi tiết một giao dịch ví cụ thể của người dùng
   * GET /api/v1/wallets/me/transactions/{transactionId}
   */
  async getTransactionDetail(
    transactionId: string,
    signal?: AbortSignal,
  ): Promise<WalletTransaction> {
    if (!transactionId) {
      throw new Error('Mã giao dịch (transactionId) không được để trống.');
    }

    const response = await request<any>(
      `/v1/wallets/me/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: 'GET',
        requiresAuth: true,
        signal,
      },
    );

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
    const response = await request<any>(
      '/v1/wallets/me/transactions?page=0&size=50&sort=createdAt,desc',
      {
        method: 'GET',
        requiresAuth: true,
      },
    );
    const data =
      (response as any)?.data !== undefined && (response as any)?.data !== null
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
        description:
          item.description ||
          (item.type === 'DEPOSIT'
            ? 'Nạp tiền vào ví (VietQR)'
            : item.type === 'PAYMENT'
              ? 'Thanh toán mua gói / dịch vụ'
              : item.type === 'EARNING'
                ? 'Tiền bán hàng Escrow giải ngân'
                : item.type === 'REFUND'
                  ? 'Hoàn tiền bảo lãnh Escrow'
                  : item.type === 'WITHDRAW'
                    ? 'Rút tiền về ngân hàng'
                    : 'Biến động số dư ví'),
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
  async requestWithdrawal(
    data: CreateWithdrawalRequestDto,
    idempotencyKey: string,
  ): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>('/wallets/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': idempotencyKey,
        'X-Bank-Info-Confirmed': 'true',
        'X-Bank-Info-Warning-Version': data.warningVersion || '',
      },
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  async getWithdrawalBankConfirmation(): Promise<{ version: string; text: string }> {
    const res = await request<{ version: string; text: string }>(
      '/wallets/withdrawal-bank-confirmation',
      { method: 'GET', requiresAuth: true },
    );
    return (res as any)?.data || res;
  },

  /**
   * Người dùng xem lịch sử các yêu cầu rút tiền của mình
   * GET /api/v1/wallets/withdrawals
   */
  async getMyWithdrawals(
    page = 0,
    size = 20,
  ): Promise<{
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
    params.append('sort', 'createdAt,desc');

    const res = await request<any>(`/wallets/withdrawals?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
          ? data.content
          : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },

  /**
   * Chi tiết một yêu cầu rút tiền của người dùng
   * GET /api/v1/wallets/withdrawals/{id}
   */
  async getWithdrawalDetail(id: string): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/withdrawals/${encodeURIComponent(id)}`,
      { method: 'GET', requiresAuth: true },
    );
    return (res as any)?.data || res;
  },

  /**
   * Lịch sử cập nhật trạng thái của một yêu cầu rút tiền
   * GET /api/v1/wallets/withdrawals/{id}/history
   */
  async getWithdrawalHistory(id: string): Promise<WalletWithdrawalStatusHistoryItem[]> {
    const res = await request<WalletWithdrawalStatusHistoryItem[]>(
      `/wallets/withdrawals/${encodeURIComponent(id)}/history`,
      { method: 'GET', requiresAuth: true },
    );
    const data = (res as any)?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * CRUD Danh bạ tài khoản ngân hàng cá nhân (/api/v1/me/bank-accounts)
   */
  async savedBankAccounts(): Promise<SavedBankAccount[]> {
    const result = await request<SavedBankAccount[]>('/api/v1/me/bank-accounts', {
      method: 'GET',
      requiresAuth: true,
    });
    const list = (result as any)?.data ?? result;
    return Array.isArray(list) ? list : [];
  },

  async getBankAccountHistory(): Promise<BankAccountHistoryItem[]> {
    const result = await request<BankAccountHistoryItem[]>('/api/v1/me/bank-accounts/history', {
      method: 'GET',
      requiresAuth: true,
    });
    const list = (result as any)?.data ?? result;
    return Array.isArray(list) ? list : [];
  },

  async saveBankAccount(bank: Omit<SavedBankAccount, 'id'>): Promise<string> {
    const payload = {
      bankCode: bank.bankCode.trim(),
      bankName: bank.bankName.trim(),
      accountNumber: bank.accountNumber.replace(/\s+/g, ''),
      accountHolderName: bank.accountHolderName.trim().toUpperCase(),
    };
    const res = await request<any>('/api/v1/me/bank-accounts', {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify(payload),
    });
    const id = (res as any)?.data ?? res;
    return typeof id === 'string' ? id : String(id ?? '');
  },

  async updateBankAccount(id: string, bank: Omit<SavedBankAccount, 'id'>): Promise<void> {
    const payload = {
      bankCode: bank.bankCode.trim(),
      bankName: bank.bankName.trim(),
      accountNumber: bank.accountNumber.replace(/\s+/g, ''),
      accountHolderName: bank.accountHolderName.trim().toUpperCase(),
    };
    await request(`/api/v1/me/bank-accounts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      requiresAuth: true,
      body: JSON.stringify(payload),
    });
  },

  async deleteBankAccount(id: string): Promise<void> {
    await request(`/api/v1/me/bank-accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
    if (this.getDefaultBankAccountId() === id) {
      this.setDefaultBankAccountId(null);
    }
  },

  getDefaultBankAccountId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(DEFAULT_BANK_ACCOUNT_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  setDefaultBankAccountId(id: string | null): void {
    if (typeof window === 'undefined') return;
    try {
      if (id) {
        localStorage.setItem(DEFAULT_BANK_ACCOUNT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(DEFAULT_BANK_ACCOUNT_STORAGE_KEY);
      }
    } catch {}
  },

  async confirmReceipt(id: string): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/withdrawals/${encodeURIComponent(id)}/received`,
      { method: 'POST', requiresAuth: true },
    );
    return (res as any)?.data || res;
  },

  async cancelWithdrawal(id: string): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/withdrawals/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', requiresAuth: true },
    );
    return (res as any)?.data || res;
  },

  async reportWithdrawalIssue(
    id: string,
    type: string,
    description: string,
    evidenceUrls: string[] = [],
  ): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/withdrawals/${encodeURIComponent(id)}/disputes`,
      {
        method: 'POST',
        body: JSON.stringify({ type, description, evidenceUrls }),
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async requestWithdrawalException(
    id: string,
    reason: string,
    evidenceUrls: string[] = [],
  ): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/withdrawals/${encodeURIComponent(id)}/exception`,
      {
        method: 'POST',
        body: JSON.stringify({ reason, evidenceUrls }),
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getAdminWithdrawalHistory(id: string): Promise<WalletWithdrawalStatusHistoryItem[]> {
    const res = await request<WalletWithdrawalStatusHistoryItem[]>(
      `/wallets/admin/withdrawals/${encodeURIComponent(id)}/history`,
      { method: 'GET', requiresAuth: true },
    );
    const data = (res as any)?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Tải ảnh minh chứng chuyển khoản có kèm Authorization header
   * GET /api/v1/wallets/withdrawals/evidence/{id}
   */
  async fetchWithdrawalEvidenceBlobUrl(evidenceUrl: string): Promise<string> {
    const url = resolveApiUrl(evidenceUrl);
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        token =
          localStorage.getItem(ACCESS_TOKEN_KEY) ||
          sessionStorage.getItem(ACCESS_TOKEN_KEY);
      } catch {}
    }
    const headers: Record<string, string> = {
      'ngrok-skip-browser-warning': 'true',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Không thể tải ảnh minh chứng giao dịch.');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Admin / Staff lấy danh sách tất cả yêu cầu rút tiền
   * GET /api/v1/wallets/admin/withdrawals
   */
  async getAdminWithdrawals(
    status?: string,
    page = 0,
    size = 20,
  ): Promise<{
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
    params.append('sort', 'createdAt,desc');

    const res = await request<any>(`/wallets/admin/withdrawals?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
          ? data.content
          : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
      isLast: data?.isLast ?? true,
    };
  },

  /**
   * Admin / Staff xử lý yêu cầu rút tiền
   * POST /api/v1/wallets/admin/withdrawals/{id}/review
   */
  async reviewWithdrawal(
    id: string,
    action: string,
    adminNote?: string,
    extra?: {
      disputeResolutionOutcome?: string;
      evidenceUrl?: string;
      evidenceUrls?: string[];
      targetStaffId?: string;
    },
  ): Promise<WalletWithdrawalResponseDto> {
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/admin/withdrawals/${encodeURIComponent(id)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({
          action,
          adminNote: adminNote || '',
          ...(extra?.disputeResolutionOutcome
            ? { disputeResolutionOutcome: extra.disputeResolutionOutcome }
            : {}),
          ...(extra?.evidenceUrl ? { evidenceUrl: extra.evidenceUrl } : {}),
          ...(extra?.evidenceUrls ? { evidenceUrls: extra.evidenceUrls } : {}),
          ...(extra?.targetStaffId ? { targetStaffId: extra.targetStaffId } : {}),
        }),
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async uploadWithdrawalEvidence(
    id: string,
    file: File,
  ): Promise<WalletWithdrawalResponseDto> {
    const body = new FormData();
    body.append('file', file);
    const res = await request<WalletWithdrawalResponseDto>(
      `/wallets/admin/withdrawals/${encodeURIComponent(id)}/evidence`,
      {
        method: 'POST',
        body,
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async createMobileUploadSession(
    withdrawalId: string,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/admin/withdrawals/${encodeURIComponent(withdrawalId)}/mobile-upload-session`,
      {
        method: 'POST',
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getMobileUploadSessionStatus(
    withdrawalId: string,
    sessionId: string,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/admin/withdrawals/${encodeURIComponent(withdrawalId)}/mobile-upload-session/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        requiresAuth: true,
        isBackground: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getMobileUploadNetworkInfo(): Promise<MobileUploadNetworkInfoDto> {
    const res = await request<MobileUploadNetworkInfoDto>(
      '/wallets/admin/withdrawals/mobile-upload-network-info',
      {
        method: 'GET',
        requiresAuth: true,
        isBackground: true,
      },
    );
    return (res as any)?.data || res;
  },

  async createUserMobileUploadSession(
    withdrawalId: string,
    purpose: 'USER_DISPUTE' | 'USER_EXCEPTION' = 'USER_DISPUTE',
    maxFiles = 3,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const params = new URLSearchParams({
      purpose,
      maxFiles: String(Math.max(1, Math.min(3, maxFiles))),
    });
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/mobile-upload-session?${params.toString()}`,
      {
        method: 'POST',
        requiresAuth: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getUserMobileUploadSessionStatus(
    withdrawalId: string,
    sessionId: string,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/mobile-upload-session/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        requiresAuth: true,
        isBackground: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getUserMobileUploadNetworkInfo(): Promise<MobileUploadNetworkInfoDto> {
    const res = await request<MobileUploadNetworkInfoDto>(
      '/wallets/withdrawals/mobile-upload-network-info',
      {
        method: 'GET',
        requiresAuth: true,
        isBackground: true,
      },
    );
    return (res as any)?.data || res;
  },

  async getPublicMobileUploadSession(
    token: string,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/withdrawals/mobile-upload/${encodeURIComponent(token)}`,
      {
        method: 'GET',
        requiresAuth: false,
      },
    );
    return (res as any)?.data || res;
  },

  async uploadPublicMobileEvidence(
    token: string,
    file: File,
  ): Promise<WithdrawalMobileUploadSessionDto> {
    const body = new FormData();
    body.append('file', file);
    const res = await request<WithdrawalMobileUploadSessionDto>(
      `/wallets/withdrawals/mobile-upload/${encodeURIComponent(token)}/evidence`,
      {
        method: 'POST',
        body,
        requiresAuth: false,
      },
    );
    return (res as any)?.data || res;
  },
};

export const DEFAULT_WITHDRAWAL_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export function getDefaultWithdrawalEvidenceMaxBytes(): number {
  const raw = (import.meta as any)?.env?.VITE_WITHDRAWAL_EVIDENCE_MAX_FILE_SIZE_BYTES;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_WITHDRAWAL_EVIDENCE_MAX_BYTES;
}

export function formatEvidenceSizeLimit(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : DEFAULT_WITHDRAWAL_EVIDENCE_MAX_BYTES;
  const mb = safeBytes / (1024 * 1024);
  if (mb >= 1) {
    return `${Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1).replace(/\.0$/, '')} MB`;
  }
  return `${Math.max(1, Math.round(safeBytes / 1024))} KB`;
}

export interface WithdrawalMobileUploadSessionDto {
  sessionId: string;
  token?: string | null;
  withdrawalId: string;
  requestCode: string;
  purpose?: 'STAFF_RECEIPT' | 'USER_DISPUTE' | 'USER_EXCEPTION' | string;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  amount: number;
  bankName: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  status: 'PENDING' | 'UPLOADED' | 'EXPIRED' | string;
  expiresAt: string;
  uploadedAt?: string | null;
  evidenceUrl?: string | null;
  evidenceUrls?: string[];
}

export interface MobileUploadNetworkInfoDto {
  lanIps: string[];
  backendPort: number;
  recommendedFrontendPort: number;
  maxEvidenceFileSizeBytes?: number;
}

export interface CreateWithdrawalRequestDto {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  bankName?: string;
  warningVersion?: string;
}

export interface WalletWithdrawalResponseDto {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  status: WithdrawalStatusCode;
  requestCode?: string;
  bankName?: string;
  availableBalance?: number | null;
  reservedBalance?: number | null;
  ownerRole?: string;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  transferredBy?: string | null;
  transferredAt?: string | null;
  disputeDeadline?: string | null;
  completedAt?: string | null;
  evidenceUrl?: string | null;
  disputeType?: string | null;
  disputeDescription?: string | null;
  disputeResolution?: string | null;
  serverTime?: string | null;
  remainingDisputeSeconds?: number | null;
  disputeEvidenceUrls?: string[];
  disputeResolutionOutcome?: string | null;
  disputeResolutionEvidenceUrl?: string | null;
  exceptionRequestedAt?: string | null;
  exceptionReason?: string | null;
  exceptionEvidenceUrls?: string[];
  walletStatus?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletWithdrawalStatusHistoryItem {
  oldStatus?: string | null;
  newStatus: string;
  actorId?: string | null;
  action: string;
  reason?: string | null;
  createdAt: string;
}

export interface WalletWithdrawalReviewRequestDto {
  action:
    | 'CLAIM'
    | 'ACCEPT'
    | 'UNCLAIM'
    | 'REASSIGN'
    | 'APPROVE'
    | 'CONFIRM_TRANSFER'
    | 'REJECT'
    | 'CANCEL'
    | 'TRANSFER_FAILED'
    | 'START_DISPUTE_REVIEW'
    | 'RESOLVE_DISPUTE';
  adminNote?: string;
  disputeResolutionOutcome?: string;
  evidenceUrl?: string;
  evidenceUrls?: string[];
  targetStaffId?: string;
}

export interface SavedBankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary?: boolean;
  updatedAt?: string;
}

export interface BankAccountHistoryItem {
  id: string;
  bankAccountId?: string | null;
  action: string;
  previousBankCode?: string | null;
  previousBankName?: string | null;
  previousAccountNumber?: string | null;
  previousAccountHolderName?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolderName?: string | null;
  createdAt: string;
}
