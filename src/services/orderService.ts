import { request } from './apiClient';
import { OrderBackend, OrderRequestDTO } from '../types';
import { PageResult } from './negotiationService';

export const orderService = {
  /**
   * Đặt mua hàng & ký quỹ Escrow (trừ tiền ví ngay lập tức, tiền giữ ở escrow)
   * POST /api/v1/orders
   */
  async createOrder(postId: string, negotiationId?: string): Promise<OrderBackend> {
    const payload: OrderRequestDTO = {
      postId,
      ...(negotiationId ? { negotiationId } : {}),
    };
    const response = await request<OrderBackend>('/v1/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as OrderBackend;
  },

  /**
   * Lấy danh sách đơn hàng đã mua của Người mua
   * GET /api/v1/orders/buyer?page=0&size=10
   */
  async getBuyerOrders(page = 0, size = 10): Promise<PageResult<OrderBackend>> {
    const response = await request<PageResult<OrderBackend>>(`/v1/orders/buyer?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
    return {
      content: Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [],
      totalElements: data?.totalElements ?? (Array.isArray(data) ? data.length : 0),
      totalPages: data?.totalPages ?? 1,
      size: data?.size ?? size,
      number: data?.number ?? page,
    };
  },

  /**
   * Lấy danh sách đơn hàng cần giao của Người bán
   * GET /api/v1/orders/seller?page=0&size=10
   */
  async getSellerOrders(page = 0, size = 10): Promise<PageResult<OrderBackend>> {
    const response = await request<PageResult<OrderBackend>>(`/v1/orders/seller?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
    return {
      content: Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [],
      totalElements: data?.totalElements ?? (Array.isArray(data) ? data.length : 0),
      totalPages: data?.totalPages ?? 1,
      size: data?.size ?? size,
      number: data?.number ?? page,
    };
  },

  /**
   * Người bán xác nhận đã giao hàng cho bưu tá
   * PUT /api/v1/orders/{id}/shipped
   */
  async markAsShipped(id: string): Promise<OrderBackend> {
    const response = await request<OrderBackend>(`/v1/orders/${id}/shipped`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as OrderBackend;
  },

  /**
   * Người mua xác nhận đã nhận hàng thành công (Giải phóng tiền Escrow về Ví người bán)
   * PUT /api/v1/orders/{id}/delivered
   */
  async confirmDelivery(id: string): Promise<OrderBackend> {
    const response = await request<OrderBackend>(`/v1/orders/${id}/delivered`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as OrderBackend;
  },

  /**
   * Hủy đơn hàng (Trước khi giao) - Hoàn trả 100% tiền Escrow về Ví người mua
   * PUT /api/v1/orders/{id}/cancel
   */
  async cancelOrder(id: string): Promise<OrderBackend> {
    const response = await request<OrderBackend>(`/v1/orders/${id}/cancel`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as OrderBackend;
  },
};
