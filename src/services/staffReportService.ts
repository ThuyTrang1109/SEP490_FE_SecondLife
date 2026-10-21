import { request } from './apiClient';

export type ReportReasonCode =
  | 'MISLEADING_DESCRIPTION'
  | 'COUNTERFEIT'
  | 'FRAUD'
  | 'ITEM_NOT_RECEIVED'
  | 'OTHER'
  | 'LATE_HANDOVER'
  | 'SELLER_CANCELLATION'
  | 'RETURN_NOT_AS_DESCRIBED'
  | 'DUPLICATE_LISTING';

export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'CONFIRMED' | 'DISMISSED';
export type ReportDecision = 'CONFIRMED' | 'DISMISSED';
export type ResponsibleParty = 'SELLER' | 'BUYER' | 'CARRIER' | 'NONE';

export interface ReportItemDto {
  id: string;
  requestId: string;
  reporterId: string;
  sellerId?: string | null;
  postId?: string | null;
  orderId?: string | null;
  reasonCode: ReportReasonCode;
  description: string;
  evidenceUrls: string[];
  status: ReportStatus;
  reviewerId?: string | null;
  responsibleParty?: ResponsibleParty | null;
  decisionReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
}

export interface ResolveReportRequestDto {
  decision: ReportDecision;
  responsibleParty?: ResponsibleParty;
  reason: string;
}

export const staffReportService = {
  /**
   * Lấy danh sách hàng đợi các báo cáo vi phạm cần duyệt
   * GET /api/v1/staff/reports
   */
  async getReportQueue(status?: ReportStatus, page = 0, size = 20): Promise<{
    items: ReportItemDto[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', String(page));
    params.append('size', String(size));

    const res = await request<any>(`/staff/reports?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return {
      items: Array.isArray(data?.items) ? data.items : Array.isArray(data?.content) ? data.content : [],
      page: data?.page ?? page,
      size: data?.size ?? size,
      totalElements: data?.totalElements ?? 0,
      totalPages: data?.totalPages ?? 1,
    };
  },

  /**
   * Staff nhận xử lý báo cáo
   * POST /api/v1/staff/reports/{id}/start-review
   */
  async startReview(id: string): Promise<ReportItemDto> {
    const res = await request<ReportItemDto>(`/staff/reports/${id}/start-review`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Staff đưa ra phán quyết xử phạt hoặc bác bỏ báo cáo
   * POST /api/v1/staff/reports/{id}/resolve
   */
  async resolveReport(id: string, payload: ResolveReportRequestDto): Promise<ReportItemDto> {
    const res = await request<ReportItemDto>(`/staff/reports/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
