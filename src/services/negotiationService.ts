import { request } from './apiClient';
import { Negotiation, NegotiationRequestDTO } from '../types';

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export const negotiationService = {
  /**
   * Người mua gửi đề xuất thương lượng / mặc cả giá
   * POST /api/v1/negotiations
   */
  async createNegotiation(postId: string, offeredPrice: number): Promise<Negotiation> {
    const payload: NegotiationRequestDTO = { postId, offeredPrice };
    const response = await request<Negotiation>('/v1/negotiations', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
  },

  /**
   * Lấy danh sách thương lượng của Người mua
   * GET /api/v1/negotiations/buyer?page=0&size=10
   */
  async getBuyerNegotiations(page = 0, size = 10): Promise<PageResult<Negotiation>> {
    const response = await request<PageResult<Negotiation>>(`/v1/negotiations/buyer?page=${page}&size=${size}`, {
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
   * Lấy danh sách thương lượng gửi đến Người bán
   * GET /api/v1/negotiations/seller?page=0&size=10
   */
  async getSellerNegotiations(page = 0, size = 10): Promise<PageResult<Negotiation>> {
    const response = await request<PageResult<Negotiation>>(`/v1/negotiations/seller?page=${page}&size=${size}`, {
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
   * Người bán đồng ý mức giá mặc cả
   * PUT /api/v1/negotiations/{id}/accept
   */
  async acceptNegotiation(id: string): Promise<Negotiation> {
    const response = await request<Negotiation>(`/v1/negotiations/${id}/accept`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
  },

  /**
   * Người bán từ chối mức giá mặc cả
   * PUT /api/v1/negotiations/{id}/reject
   */
  async rejectNegotiation(id: string): Promise<Negotiation> {
    const response = await request<Negotiation>(`/v1/negotiations/${id}/reject`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
  },

  /**
   * Người mua hủy bỏ yêu cầu thương lượng
   * PUT /api/v1/negotiations/{id}/cancel
   */
  async cancelNegotiation(id: string): Promise<Negotiation> {
    const response = await request<Negotiation>(`/v1/negotiations/${id}/cancel`, {
      method: 'PUT',
      requiresAuth: true,
    });
    return (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
  },
};
