import { request, PageResponse } from './apiClient';

export interface CommissionRuleResponse {
  id: string;
  name: string;
  rate: number; // 0.05 nghĩa là 5%
  minCommission: number;
  maxCommission?: number | null;
  active: boolean;
  revision: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRuleRequest {
  name: string;
  rate: number; // 0.05 nghĩa là 5%
  minCommission: number;
  maxCommission?: number | null;
  active: boolean;
  reason: string;
}

export interface CommissionAuditResponse {
  id: string;
  ruleId: string;
  actorId?: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string;
  changedAt?: string;
  // Aliases for compatibility
  changedBy?: string;
  createdAt?: string;
  name?: string;
  rate?: number;
  minCommission?: number;
  maxCommission?: number | null;
  active?: boolean;
  revision?: number;
}

export const adminCommissionService = {
  /**
   * Lấy chi tiết quy tắc hoa hồng sàn
   * GET /api/v1/admin/commission-rules/{id}
   */
  async getCommissionRuleById(id: string): Promise<CommissionRuleResponse> {
    const res = await request<CommissionRuleResponse>(`/v1/admin/commission-rules/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lấy danh sách quy tắc hoa hồng sàn
   * GET /api/v1/admin/commission-rules
   */
  async getCommissionRules(page = 0, size = 10): Promise<PageResponse<CommissionRuleResponse>> {
    const res = await request<any>(`/v1/admin/commission-rules?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const d = (res as any)?.data || res;
    return {
      items: d?.items || d?.content || (Array.isArray(d) ? d : []),
      page: d?.page ?? page,
      size: d?.size ?? size,
      totalElements: d?.totalElements ?? 0,
      totalPages: d?.totalPages ?? 1,
      isLast: d?.isLast ?? true,
    };
  },

  /**
   * Tạo chính sách hoa hồng sàn mới
   * POST /api/v1/admin/commission-rules
   */
  async createCommissionRule(data: CommissionRuleRequest): Promise<CommissionRuleResponse> {
    const res = await request<CommissionRuleResponse>('/v1/admin/commission-rules', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật chính sách hoa hồng sàn
   * PUT /api/v1/admin/commission-rules/{id}
   */
  async updateCommissionRule(id: string, data: CommissionRuleRequest): Promise<CommissionRuleResponse> {
    const res = await request<CommissionRuleResponse>(`/v1/admin/commission-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Tạm ngưng chính sách hoa hồng sàn
   * POST /api/v1/admin/commission-rules/{id}/deactivate
   */
  async deactivateCommissionRule(id: string, reason: string): Promise<CommissionRuleResponse> {
    const res = await request<CommissionRuleResponse>(`/v1/admin/commission-rules/${id}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem lịch sử sửa đổi chính sách hoa hồng
   * GET /api/v1/admin/commission-rules/{id}/history
   */
  async getCommissionRuleHistory(id: string, page = 0, size = 10): Promise<PageResponse<CommissionAuditResponse>> {
    const res = await request<any>(`/v1/admin/commission-rules/${id}/history?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const d = (res as any)?.data || res;
    return {
      items: d?.items || d?.content || (Array.isArray(d) ? d : []),
      page: d?.page ?? page,
      size: d?.size ?? size,
      totalElements: d?.totalElements ?? 0,
      totalPages: d?.totalPages ?? 1,
      isLast: d?.isLast ?? true,
    };
  },
};
