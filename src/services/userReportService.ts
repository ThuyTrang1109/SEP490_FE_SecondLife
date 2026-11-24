import { request, resolveApiUrl, getAccessToken, clearAuthTokens, PageResponse } from './apiClient';
import type { RequestOptions } from './apiClient';
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

export interface CreateListingReportRequestDto {
  requestId?: string;
  reasonCode: 'FRAUD' | 'MISLEADING_DESCRIPTION' | 'DUPLICATE_LISTING' | 'OTHER' | string;
  description: string;
  evidenceUrls?: string[];
  relatedPostId?: string | null;
}

export interface ReportEvidenceUploadResponse {
  id: string;
  evidenceUrl: string;
}

export interface ReportSubmissionResponse {
  id: string;
  reportId: string;
  authorId: string;
  authorRole: 'BUYER' | 'SELLER' | 'STAFF' | string;
  requestId: string;
  description: string;
  evidenceUrls: string[];
  createdAt: string;
}

export interface ReportEvidenceMetadataResponse {
  evidenceId: string;
  contentType: string;
  size: number;
  mediaType: 'IMAGE' | 'VIDEO';
  contentUrl: string;
}

export interface SellerOrderDisputeDetailDto {
  id: string;
  reasonCode: ReportReasonCode;
  description: string;
  buyerEvidenceUrls: string[];
  status?: ReportStatus;
  responsibleParty?: ResponsibleParty | null;
  decisionReason?: string | null;
  resolvedAt?: string | null;
  orderId?: string | null;
  postId?: string | null;
  resolutionAction?: 'NONE' | 'RETURN_AND_REFUND' | null;
  refundedAt?: string | null;
  refundAmount?: number | null;
  returnShipmentId?: string | null;
  sellerResponseDeadlineAt?: string | null;
  sellerRespondedAt?: string | null;
  createdAt?: string;
}

export interface SellerOrderDisputeDto {
  id: string;
  orderId: string;
  postTitle: string | null;
  reasonCode: ReportReasonCode;
  status: ReportStatus;
  resolutionAction: 'NONE' | 'RETURN_AND_REFUND';
  refundedAt?: string | null;
  sellerResponseDeadlineAt?: string | null;
  sellerRespondedAt?: string | null;
  createdAt: string;
  postId?: string | null;
  responsibleParty?: ResponsibleParty | null;
  decisionReason?: string | null;
  resolvedAt?: string | null;
  description?: string;
  evidenceUrls?: string[];
  returnShipmentId?: string | null;
  returnShipment?: any;
}

export interface UserReportResponseDto {
  id: string;
  requestId: string;
  reporterId: string;
  sellerId?: string | null;
  postId?: string | null;
  orderId?: string | null;
  targetType?: 'ORDER' | 'LISTING' | string;
  reasonCode: ReportReasonCode;
  description: string;
  evidenceUrls: string[];
  status: ReportStatus;
  reviewerId?: string | null;
  resolutionAction?: 'NONE' | 'RETURN_AND_REFUND' | null;
  responsibleParty?: ResponsibleParty | null;
  decisionReason?: string | null;
  returnShipmentId?: string | null;
  returnApprovedAt?: string | null;
  refundedAt?: string | null;
  refundedBy?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
}

export function createReportRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const userReportService = {
  async getSellerDisputeDetail(reportId: string): Promise<SellerOrderDisputeDetailDto> {
    const result = await request<SellerOrderDisputeDetailDto>(
      '/v1/reports/seller/' + encodeURIComponent(reportId), { requiresAuth: true },
    );
    return result.data;
  },

  async getSellerDisputes(page: number, size = 10, options?: Pick<RequestOptions, 'signal' | 'isBackground'>): Promise<PageResponse<SellerOrderDisputeDto>> {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    const response = await request<PageResponse<SellerOrderDisputeDto>>('/v1/reports/seller?' + query, {
      requiresAuth: true,
      ...options,
    });
    return response.data;
  },

  /**
   * Tạo khiếu nại đối với bài đăng hoặc đơn hàng
   * POST /api/v1/reports
   */
  async createReport(data: CreateReportRequestDto): Promise<UserReportResponseDto> {
    const payload: any = {
      requestId: data.requestId || createReportRequestId(),
      reasonCode: data.reasonCode,
      description: data.description.trim(),
      evidenceUrls: Array.isArray(data.evidenceUrls) ? data.evidenceUrls : [],
    };

    if (data.orderId) {
      payload.orderId = data.orderId;
      payload.postId = null;
    } else if (data.postId) {
      payload.postId = data.postId;
      payload.orderId = null;
    } else {
      payload.orderId = null;
      payload.postId = null;
    }

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
  async getMyReports(page = 0, size = 10, targetType?: string, options?: Pick<RequestOptions, 'signal' | 'isBackground'>): Promise<PageResponse<UserReportResponseDto>> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort: 'createdAt,desc',
    });
    if (targetType) {
      query.append('targetType', targetType);
    }
    const res = await request<any>(`/v1/reports/me?${query.toString()}`, {
      method: 'GET',
      requiresAuth: true,
      ...options,
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
   * GET /api/v1/reports/{id} hoặc fallback sang seller dispute detail nếu là người bán
   */
  async getReportById(id: string): Promise<UserReportResponseDto> {
    try {
      const res = await request<UserReportResponseDto>(`/v1/reports/${encodeURIComponent(id)}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch (err: any) {
      // Nếu 403 Forbidden hoặc lỗi do là người bán, thử gọi getSellerDisputeDetail
      try {
        const sellerDetail = await this.getSellerDisputeDetail(id);
        if (sellerDetail) {
          return {
            id: sellerDetail.id,
            requestId: sellerDetail.id,
            reporterId: '',
            sellerId: '',
            orderId: sellerDetail.orderId ?? null,
            postId: sellerDetail.postId ?? null,
            reasonCode: sellerDetail.reasonCode,
            description: sellerDetail.description,
            evidenceUrls: sellerDetail.buyerEvidenceUrls || [],
            status: sellerDetail.status || 'OPEN',
            responsibleParty: sellerDetail.responsibleParty,
            decisionReason: sellerDetail.decisionReason,
            resolvedAt: sellerDetail.resolvedAt,
            resolutionAction: sellerDetail.resolutionAction,
            returnShipmentId: sellerDetail.returnShipmentId,
            refundAmount: sellerDetail.refundAmount,
            refundedAt: sellerDetail.refundedAt,
            sellerResponseDeadlineAt: sellerDetail.sellerResponseDeadlineAt,
            sellerRespondedAt: sellerDetail.sellerRespondedAt,
            createdAt: sellerDetail.createdAt || new Date().toISOString(),
          } as UserReportResponseDto;
        }
      } catch {
        // bỏ qua fallback nếu cũng thất bại
      }
      throw err;
    }
  },

  /**
   * Gửi phản hồi hoặc bằng chứng đóng gói bổ sung vào báo cáo
   * POST /api/v1/reports/{reportId}/responses
   * Quyền: Reporter (BUYER) hoặc SELLER của đơn; report còn OPEN hoặc IN_REVIEW
   */
  async submitReportResponse(
    reportId: string,
    data: { requestId?: string; description: string; evidenceUrls?: string[] }
  ): Promise<ReportSubmissionResponse> {
    const payload = {
      requestId: data.requestId || createReportRequestId(),
      description: data.description.trim(),
      evidenceUrls: Array.isArray(data.evidenceUrls) ? data.evidenceUrls : [],
    };
    const res = await request<ReportSubmissionResponse>(`/reports/${reportId}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as ReportSubmissionResponse;
  },

  /**
   * Lấy danh sách phản hồi bổ sung của hồ sơ khiếu nại
   * GET /api/v1/reports/{reportId}/responses
   * Buyer/Seller chỉ xem phản hồi của mình; Reviewer xem được của cả hai bên
   */
  async getReportResponses(
    reportId: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<ReportSubmissionResponse>> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    const res = await request<PageResponse<ReportSubmissionResponse>>(`/reports/${reportId}/responses?${query.toString()}`, {
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
   * Lấy metadata của bằng chứng riêng tư (xác định IMAGE hay VIDEO)
   * GET /api/v1/reports/evidence/{id}/metadata
   */
  async getEvidenceMetadata(evidenceId: string): Promise<ReportEvidenceMetadataResponse> {
    const res = await request<ReportEvidenceMetadataResponse>(`/reports/evidence/${evidenceId}/metadata`, {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as ReportEvidenceMetadataResponse;
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

  /**
   * Báo cáo vi phạm bài đăng trực tiếp (không bắt buộc mua hàng)
   * POST /api/v1/reports/listings/{postId}
   */
  async reportListing(postId: string, data: CreateListingReportRequestDto): Promise<UserReportResponseDto> {
    const payload = {
      requestId: data.requestId || createReportRequestId(),
      reasonCode: data.reasonCode,
      description: data.description.trim(),
      evidenceUrls: Array.isArray(data.evidenceUrls) ? data.evidenceUrls : [],
      relatedPostId: data.relatedPostId || null,
    };

    const res = await request<UserReportResponseDto>(`/v1/reports/listings/${postId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Tải / xem file bằng chứng riêng tư (byte[]) kèm Bearer token
   * GET /api/v1/reports/evidence/{id}
   */
  async getEvidenceBlobUrl(rawEvidenceIdOrUrl: string): Promise<string> {
    if (!rawEvidenceIdOrUrl) return '';
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = rawEvidenceIdOrUrl.match(uuidRegex);
    const evidenceId = match ? match[0] : rawEvidenceIdOrUrl.trim();

    const token = getAccessToken();
    const url = resolveApiUrl(`/v1/reports/evidence/${evidenceId}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Không thể tải bằng chứng (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Tải thông tin view đa phương tiện cho bằng chứng (IMAGE hoặc VIDEO playback)
   */
  async loadPrivateEvidenceView(
    evidenceUrl: string,
    signal?: AbortSignal
  ): Promise<{ kind: 'IMAGE' | 'VIDEO'; src: string; expiresAt?: string; dispose: () => void }> {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = evidenceUrl.match(uuidRegex);
    if (!match) throw new Error('Đường dẫn bằng chứng không chứa UUID hợp lệ');
    const evidenceId = match[0];

    const metadata = await userReportService.getEvidenceMetadata(evidenceId);
    if (metadata.mediaType === 'IMAGE') {
      const token = getAccessToken();
      const imgUrl = resolveApiUrl(metadata.contentUrl || `/v1/reports/evidence/${evidenceId}`);
      const res = await fetch(imgUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (!res.ok) throw new Error(`Không tải được ảnh: HTTP ${res.status}`);
      const blob = await res.blob();
      const src = URL.createObjectURL(blob);
      return { kind: 'IMAGE', src, dispose: () => URL.revokeObjectURL(src) };
    }

    if (metadata.mediaType === 'VIDEO') {
      const token = getAccessToken();
      const playbackPath = metadata.contentUrl || `/video/${evidenceId}/playback`;
      const playbackUrl = resolveApiUrl(playbackPath);
      const res = await fetch(playbackUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (!res.ok) throw new Error(`Không thể lấy playback video: HTTP ${res.status}`);
      const j = await res.json();
      const pData = j?.data ?? j;
      if (!pData?.url) throw new Error('Không có URL phát video');
      return { kind: 'VIDEO', src: pData.url, expiresAt: pData.expiresAt, dispose: () => {} };
    }

    throw new Error('Loại bằng chứng không được hỗ trợ');
  },
};
