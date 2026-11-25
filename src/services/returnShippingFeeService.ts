import { request, type PageResponse } from './apiClient';

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
  lastCollectedAt?: string | null;
}

export interface ReturnShippingDeduction {
  id: string;
  orderId: string;
  amount: number;
  deductedAt: string;
}

export const returnShippingFeeService = {
  async getMyFees(page: number, outstandingOnly: boolean): Promise<PageResponse<ReturnShippingFeeResponse>> {
    const params = new URLSearchParams({ page: String(page), size: '20', outstandingOnly: String(outstandingOnly) });
    const response = await request<PageResponse<ReturnShippingFeeResponse>>('/seller/return-shipping-fees?' + params, {
      requiresAuth: true,
    });
    return response.data;
  },

  async getMyDeductions(page: number, outstandingOnly: boolean): Promise<PageResponse<ReturnShippingDeduction>> {
    const params = new URLSearchParams({ page: String(page), size: '10', outstandingOnly: String(outstandingOnly) });
    const response = await request<PageResponse<ReturnShippingDeduction>>('/seller/return-shipping-fees/deductions?' + params, {
      requiresAuth: true,
    });
    return response.data;
  },

  async getMyDebt(): Promise<{ outstandingDebt: number }> {
    const response = await request<{ outstandingDebt: number }>('/seller/return-shipping-fees/debt', { requiresAuth: true });
    return response.data;
  },

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
