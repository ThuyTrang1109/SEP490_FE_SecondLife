import { request, PageResponse } from './apiClient';

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

export interface SellerReturnShippingDebtResponse {
  sellerId: string;
  outstandingDebt: number;
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

  /**
   * Danh sách các khoản phí hoàn hàng của chính seller đang đăng nhập
   * GET /api/v1/seller/return-shipping-fees?page=0&size=20&outstandingOnly=false
   * Quyền: ROLE_SELLER + PROFILE_READ_SELF
   */
  async getMyReturnShippingFees(params?: {
    page?: number;
    size?: number;
    outstandingOnly?: boolean;
  }): Promise<PageResponse<ReturnShippingFeeResponse>> {
    const page = params?.page ?? 0;
    const size = params?.size ?? 20;
    const outstandingOnly = params?.outstandingOnly ?? false;

    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      outstandingOnly: String(outstandingOnly),
    });

    const res = await request<PageResponse<ReturnShippingFeeResponse>>(`/seller/return-shipping-fees?${query.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const d = (res as any)?.data ?? res;
    return {
      items: Array.isArray(d?.items) ? d.items : Array.isArray(d?.content) ? d.content : [],
      page: d?.page ?? page,
      size: d?.size ?? size,
      totalElements: d?.totalElements ?? 0,
      totalPages: d?.totalPages ?? 1,
      isLast: d?.isLast ?? true,
    };
  },

  /**
   * Tổng công nợ phí hoàn hàng chưa thanh toán của seller
   * GET /api/v1/seller/return-shipping-fees/debt
   * Quyền: ROLE_SELLER + PROFILE_READ_SELF
   */
  async getMyReturnShippingDebt(): Promise<SellerReturnShippingDebtResponse> {
    const res = await request<SellerReturnShippingDebtResponse>('/seller/return-shipping-fees/debt', {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as SellerReturnShippingDebtResponse;
  },
};
