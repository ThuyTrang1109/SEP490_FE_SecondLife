import { request } from './apiClient';

export interface SellerReputationDto {
  sellerId: string;
  score: number | null;
  goodTransactions: number;
  badTransactions: number;
  evaluatedOrders: number;
  minimumEvaluatedOrders: number;
  assessmentStatus: 'NO_TRANSACTIONS' | 'INSUFFICIENT_EVIDENCE' | 'EVALUATED' | string;
  confirmedIncidents: number;
  seriousIncidents: number;
  sellingRestricted: boolean;
  warningCode?: 'SELLING_RESTRICTED' | 'SERIOUS_VIOLATION_HISTORY' | 'ORDER_CONFIRMATION_VIOLATION' | 'CONFIRMED_VIOLATION_HISTORY' | string | null;
  updatedAt?: string | null;
  formulaVersion?: string | null;
  sellerCancellationOrders?: number;
  sellerReturnFaultOrders?: number;
  nonFulfillmentOrders?: number;
  nonFulfillmentRate?: number | null;
  handoverEvaluatedOrders?: number;
  lateHandoverOrders?: number;
  lateHandoverRate?: number | null;
  transactionScore?: number | null;
  confirmationPenaltyPoints?: number | null;
}

export interface ReputationHistoryDto {
  id: string;
  sellerId?: string;
  eventType: string;
  orderId?: string | null;
  reportId?: string | null;
  goodBefore?: number;
  badBefore?: number;
  goodAfter?: number;
  badAfter?: number;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  penaltyBefore?: number | null;
  penaltyAfter?: number | null;
  priorGood?: number | null;
  priorTotal?: number | null;
  formulaVersion?: string | null;
  eventSequence?: number | null;
  createdAt: string;
  reason?: string;
}

export interface ReputationHistoryPageResponse {
  items: ReputationHistoryDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
}

/**
 * Trả về thông tin nhãn, màu sắc và mô tả cho trạng thái đánh giá uy tín
 */
export function getAssessmentStatusMeta(status?: string | null): {
  label: string;
  shortLabel: string;
  badgeClass: string;
  desc: string;
} {
  switch (status) {
    case 'EVALUATED':
      return {
        label: 'Đủ số đơn tham chiếu',
        shortLabel: 'Đã thẩm định (≥5 đơn)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        desc: 'Đã tích lũy đủ từ 5 đơn hàng đánh giá trở lên. Điểm có độ tin cậy chuẩn.',
      };
    case 'INSUFFICIENT_EVIDENCE':
      return {
        label: 'Chưa đủ mẫu tham chiếu',
        shortLabel: 'Đang tích lũy (<5 đơn)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        desc: 'Đã có giao dịch nhưng chưa đủ mốc 5 đơn tối thiểu.',
      };
    case 'NO_TRANSACTIONS':
    default:
      return {
        label: 'Chưa có mẫu giao dịch',
        shortLabel: 'Người bán mới',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        desc: 'Chưa có đơn hàng nào kết thúc (hoàn thành hoặc phát sinh lỗi).',
      };
  }
}

/**
 * Trả về thông tin hiển thị cho mã cảnh báo uy tín theo thứ tự ưu tiên BE
 */
export function getReputationWarningMeta(warningCode?: string | null): {
  title: string;
  desc: string;
  severity: 'danger' | 'warning' | 'info';
  badgeClass: string;
} | null {
  if (!warningCode) return null;
  switch (warningCode) {
    case 'SELLING_RESTRICTED':
      return {
        title: 'Đang bị hạn chế bán hàng',
        desc: 'Tài khoản người bán đang tạm thời bị hạn chế đăng bán sản phẩm mới do điểm phạt hoặc vi phạm.',
        severity: 'danger',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      };
    case 'SERIOUS_VIOLATION_HISTORY':
      return {
        title: 'Có lịch sử vi phạm nghiêm trọng',
        desc: 'Tài khoản từng bị ghi nhận xử lý vi phạm nghiêm trọng quy chuẩn hoạt động.',
        severity: 'danger',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      };
    case 'ORDER_CONFIRMATION_VIOLATION':
      return {
        title: 'Có điểm phạt chưa xác nhận đơn đúng hạn',
        desc: 'Người bán có đơn hàng bị trừ điểm phạt do trễ hạn xác nhận sau 24h hoặc 48h.',
        severity: 'warning',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      };
    case 'CONFIRMED_VIOLATION_HISTORY':
      return {
        title: 'Có vi phạm đã được xác nhận',
        desc: 'Đã ghi nhận các vi phạm được kiểm chứng trong quy trình bán hàng.',
        severity: 'warning',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      };
    default:
      return {
        title: warningCode,
        desc: 'Cảnh báo chỉ số uy tín từ hệ thống.',
        severity: 'info',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
      };
  }
}

/**
 * Ánh xạ mã sự kiện lịch sử uy tín sang nhãn tiếng Việt chuẩn theo BE
 */
export function getReputationEventMeta(eventType: string): {
  label: string;
  desc: string;
  type: 'positive' | 'negative' | 'neutral';
} {
  switch (eventType) {
    case 'ORDER_COMPLETED':
      return {
        label: 'Đánh giá giao dịch hoàn tất',
        desc: 'Đơn hàng hoàn tất và tiền ký quỹ giải ngân thành công (GOOD +1)',
        type: 'positive',
      };
    case 'ORDER_CONFIRMATION_LATE':
      return {
        label: 'Phạt quá hạn xác nhận (24h)',
        desc: 'Chậm xác nhận đơn sau 24h kể từ khi thanh toán',
        type: 'negative',
      };
    case 'ORDER_CONFIRMATION_TIMEOUT':
      return {
        label: 'Phạt quá hạn hủy đơn (48h)',
        desc: 'Quá 48h không xác nhận, đơn tự hủy và hoàn tiền người mua',
        type: 'negative',
      };
    case 'SELLER_CANCELLED_ORDER':
      return {
        label: 'Hủy do lỗi người bán',
        desc: 'Đơn hàng bị hủy do người bán hoặc quá hạn xử lý (BAD +1)',
        type: 'negative',
      };
    case 'SELLER_FAULT_CONFIRMED':
      return {
        label: 'Xác nhận lỗi người bán',
        desc: 'Đơn trả hàng hoặc khiếu nại xác định có lỗi của người bán (BAD +1)',
        type: 'negative',
      };
    case 'SERIOUS_VIOLATION_CONFIRMED':
      return {
        label: 'Xác nhận vi phạm nghiêm trọng',
        desc: 'Ghi nhận sự cố vi phạm nghiêm trọng quy chuẩn của sàn',
        type: 'negative',
      };
    case 'CLOSED_ORDER_EVALUATED':
      return {
        label: 'Đánh giá đơn đã kết thúc',
        desc: 'Ghi nhận kết quả giao dịch vào chỉ số uy tín',
        type: 'neutral',
      };
    case 'HISTORICAL_ORDER_IMPORTED':
      return {
        label: 'Nhập dữ liệu lịch sử',
        desc: 'Đồng bộ kết quả từ các đơn hàng trước đó',
        type: 'neutral',
      };
    case 'REPUTATION_POLICY_CHANGED':
      return {
        label: 'Đổi chính sách uy tín',
        desc: 'Cập nhật phiên bản công thức tính điểm hệ thống',
        type: 'neutral',
      };
    default:
      return {
        label: eventType || 'Biến động uy tín',
        desc: 'Ghi nhận biến động chỉ số',
        type: 'neutral',
      };
  }
}

export const reputationService = {
  /**
   * Lấy chỉ số uy tín công khai của Người Bán theo sellerId
   * GET /api/v1/sellers/{sellerId}/reputation
   */
  async getSellerReputation(sellerId: string): Promise<SellerReputationDto | null> {
    if (!sellerId) return null;
    try {
      const res = await request<any>(`/sellers/${sellerId}/reputation`, {
        method: 'GET',
        requiresAuth: false,
      });
      const data = (res as any)?.data || res;
      return data || null;
    } catch (err) {
      console.warn('[reputationService] getSellerReputation fallback:', err);
      return null;
    }
  },

  /**
   * Người bán tự tra cứu uy tín của bản thân
   * GET /api/v1/seller/reputation/me
   */
  async getMyReputation(): Promise<SellerReputationDto | null> {
    try {
      const res = await request<any>('/seller/reputation/me', {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      return data || null;
    } catch (err) {
      console.warn('[reputationService] getMyReputation error:', err);
      return null;
    }
  },

  /**
   * Xem lịch sử biến động điểm uy tín cá nhân
   * GET /api/v1/seller/reputation/me/history?page=0&size=20
   */
  async getMyReputationHistory(page = 0, size = 20): Promise<ReputationHistoryPageResponse> {
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await request<any>(`/seller/reputation/me/history?${params.toString()}`, {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      const rawList = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
        ? data
        : [];

      return {
        items: rawList,
        page: data?.page ?? page,
        size: data?.size ?? size,
        totalElements: data?.totalElements ?? rawList.length,
        totalPages: data?.totalPages ?? 1,
        isLast: data?.isLast ?? true,
      };
    } catch (err) {
      console.warn('[reputationService] getMyReputationHistory error:', err);
      return { items: [], page, size, totalElements: 0, totalPages: 1, isLast: true };
    }
  },

  /**
   * Admin gỡ bỏ giới hạn bán hàng cho Seller
   * POST /api/v1/admin/sellers/{sellerId}/reputation/lift-restriction
   */
  async liftRestriction(sellerId: string, reason: string): Promise<SellerReputationDto> {
    const res = await request<SellerReputationDto>(`/admin/sellers/${sellerId}/reputation/lift-restriction`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};

