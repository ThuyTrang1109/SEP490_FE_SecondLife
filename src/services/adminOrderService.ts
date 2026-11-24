import { request, PageResponse } from './apiClient';

export interface AdminOrderResponse {
  id: string;
  postId: string;
  postTitle: string;
  postImageUrl?: string;
  postPrice?: number;
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  sellerPhone?: string;
  finalPrice: number;
  shippingFee: number;
  totalAmount: number;
  status: 'PENDING_PAYMENT' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | string;
  escrowStatus: 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN' | string;
  paymentMethod: 'WALLET' | 'BANK_TRANSFER' | string;
  deliveryAddress?: string;
  cancellationReasonCode?: string;
  hasInspection?: boolean;
  inspectionOrderId?: string;
  inspectionStatus?: string;
  createdAt: string;
  paidAt?: string;
  sellerConfirmedAt?: string;
  shippingDeliveredAt?: string;
  updatedAt?: string;
}

export interface AdminOrderStatsResponse {
  totalOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippingOrders: number;
  deliveredOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  disputedOrders: number;
  totalGmv: number;
  heldEscrowAmount: number;
  withInspectionCount: number;
}

export interface GetAdminOrdersParams {
  status?: string;
  escrowStatus?: string;
  search?: string;
  hasInspection?: boolean;
  page?: number;
  size?: number;
  sort?: string[];
}

export const adminOrderService = {
  /**
   * Lấy danh sách toàn bộ đơn hàng trên sàn có hỗ trợ phân trang & lọc đa tiêu chí
   */
  async getAdminOrders(params: GetAdminOrdersParams = {}): Promise<PageResponse<AdminOrderResponse>> {
    const queryParams = new URLSearchParams();
    if (params.status && params.status !== 'ALL') queryParams.append('status', params.status);
    if (params.escrowStatus && params.escrowStatus !== 'ALL') queryParams.append('escrowStatus', params.escrowStatus);
    if (params.search && params.search.trim()) queryParams.append('search', params.search.trim());
    if (params.hasInspection !== undefined) queryParams.append('hasInspection', String(params.hasInspection));
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    if (params.sort && params.sort.length > 0) {
      params.sort.forEach((s) => queryParams.append('sort', s));
    }

    const queryString = queryParams.toString();
    const endpoint = `/v1/admin/orders${queryString ? `?${queryString}` : ''}`;

    const res = await request<PageResponse<AdminOrderResponse>>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
    const d = (res as any)?.data ?? res;
    return {
      items: Array.isArray(d?.items) ? d.items : Array.isArray(d?.content) ? d.content : Array.isArray(d) ? d : [],
      page: d?.page ?? d?.number ?? params.page ?? 0,
      size: d?.size ?? params.size ?? 10,
      totalElements: d?.totalElements ?? (Array.isArray(d?.items) ? d.items.length : Array.isArray(d?.content) ? d.content.length : Array.isArray(d) ? d.length : 0),
      totalPages: d?.totalPages ?? 1,
      isLast: d?.isLast ?? d?.last ?? true,
    };
  },

  /**
   * Lấy thống kê tổng quan về đơn hàng, GMV và tiền ký quỹ Escrow
   */
  async getAdminOrderStats(): Promise<AdminOrderStatsResponse> {
    const res = await request<AdminOrderStatsResponse>('/v1/admin/orders/stats', {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as AdminOrderStatsResponse;
  },

  /**
   * Lấy thông tin chi tiết một đơn hàng cụ thể dành cho Admin
   */
  async getAdminOrderById(orderId: string): Promise<AdminOrderResponse> {
    const res = await request<AdminOrderResponse>(`/v1/admin/orders/${orderId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as AdminOrderResponse;
  },
};
