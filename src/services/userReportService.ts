import { request, resolveApiUrl, getAccessToken, clearAuthTokens, PageResponse } from './apiClient';
import type {
  ReportReasonCode,
  ReportStatus,
  ReportDecision,
  ResponsibleParty,
} from './staffReportService';

export type {
  ReportReasonCode,
  ReportStatus,
  ReportDecision,
  ResponsibleParty,
};

export interface CreateReportRequestDto {
  requestId?: string;
  postId?: string;
  orderId?: string;
  reasonCode: ReportReasonCode | string;
  description: string;
  evidenceUrls?: string[];
}

export interface ReportEvidenceUploadResponse {
  id: string;
  evidenceUrl: string;
}

export interface UserReportResponseDto {
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

export const userReportService = {
  /**
   * Tạo khiếu nại đối với bài đăng hoặc đơn hàng
   * POST /api/v1/reports
   */
  async createReport(data: CreateReportRequestDto): Promise<UserReportResponseDto> {
    const payload = {
      requestId: data.requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`),
      postId: data.postId || null,
      orderId: data.orderId || null,
      reasonCode: data.reasonCode,
      description: data.description.trim(),
      evidenceUrls: Array.isArray(data.evidenceUrls) ? data.evidenceUrls : [],
    };

    const res = await request<UserReportResponseDto>('/v1/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem danh sách các khiếu nại của chính người dùng đăng nhập
   * GET /api/v1/reports/me
   */
  async getMyReports(page = 0, size = 10): Promise<PageResponse<UserReportResponseDto>> {
    const res = await request<any>(`/v1/reports/me?page=${page}&size=${size}&sort=createdAt,desc`, {
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
   * Xem chi tiết một khiếu nại theo ID
   * GET /api/v1/reports/{id}
   */
  async getReportById(id: string): Promise<UserReportResponseDto> {
    const res = await request<UserReportResponseDto>(`/v1/reports/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Tải file bằng chứng khiếu nại riêng tư (private evidence)
   * POST /api/v1/reports/evidence
   */
  async uploadEvidence(file: File): Promise<ReportEvidenceUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken();
    if (!token) {
      clearAuthTokens();
      throw new Error('Chưa đăng nhập để tải bằng chứng.');
    }

    const url = resolveApiUrl('/v1/reports/evidence');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errMsg = `Tải bằng chứng thất bại (HTTP ${response.status})`;
      try {
        const j = await response.json();
        errMsg = j?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const resJson = await response.json();
    return resJson?.data || resJson;
  },
};
