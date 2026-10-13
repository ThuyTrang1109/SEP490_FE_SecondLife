import { request } from './apiClient';
import { UserWallet, DepositResponseDTO, DepositCreateRequestDTO, WalletTransaction } from '../types';

export const walletService = {
  /**
   * Lấy số dư và thông tin ví hiện tại của người dùng đang đăng nhập
   * GET /api/v1/wallets/me
   */
  async getMyWallet(): Promise<UserWallet> {
    const response = await request<UserWallet>('/v1/wallets/me', {
      method: 'GET',
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
};
