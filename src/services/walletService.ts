import { request } from './apiClient';
import { UserWallet, DepositResponseDTO, DepositCreateRequestDTO } from '../types';

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
};
