import { request } from './apiClient';

export type ReturnShippingFeeStatus = 'PENDING_FEE' | 'PAID' | 'OUTSTANDING';

export interface ReturnShippingFeeResponse {
  shipmentId: string;
  orderId: string;
  reportId: string;
  sellerId: string;
  status: ReturnShippingFeeStatus;
  feeAmount: number | null;
  collectedAmount: number | null;
  debtAmount: number | null;
  createdAt: string;
  assessedAt?: string | null;
  assessedBy?: string | null;
}

export const returnShippingFeeService = {
  /**
   * Đọc chi tiết khoản phí hoàn hàng riêng tư theo shipmentId
   * GET /api/v1/shipments/{shipmentId}/return-shipping-fee
   * Quyền: SELLER chủ đơn hoặc STAFF (STAFF_DISPUTE_REVIEW) / ADMIN
   */
  async getReturnShippingFee(shipmentId: string): Promise<ReturnShippingFeeResponse> {
    const res = await request<ReturnShippingFeeResponse>(`/shipments/${shipmentId}/return-shipping-fee`, {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as ReturnShippingFeeResponse;
  },
};
