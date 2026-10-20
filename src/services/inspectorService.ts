import { request, PageResponse } from './apiClient';

// ============================================================================
// DTOs & INTERFACES FOR PRODUCT INSPECTION SYSTEM
// ============================================================================

export interface InspectionTravelTierDto {
  tierNumber: number;
  name: string;
  fromKm?: number;
  toKm?: number;
  pricePerKm: number;
  distanceChargedInTier?: number;
  feeInTier?: number;
  status?: string;
}

export interface InspectionQuotePackageAtHome {
  distanceKm?: number;
  travelFeeOneWay?: number;
  travelFeeRoundTrip?: number;
  totalFee?: number;
  suggestedSplit50?: number;
  tiersBreakdown?: InspectionTravelTierDto[];
}

export interface InspectionQuotePackageAtCenter {
  shippingToCenterFee?: number;
  returnReserveFee?: number;
  totalFee?: number;
  suggestedSplit50?: number;
}

export interface InspectionQuoteResponse {
  postId: string;
  postTitle?: string;
  postPrice?: number;
  baseFee?: number;
  baseInspectionFee: number;

  // AT_HOME package
  travelDistanceKm?: number;
  travelFeeOneWay?: number;
  travelFeeRoundTrip?: number;
  atHomeTotalFee?: number;
  appliedTiers?: InspectionTravelTierDto[];
  atHomeSplitOptions?: Record<string, number>;
  atHomePackage?: InspectionQuotePackageAtHome;

  // AT_CENTER package
  shippingToCenterFee?: number;
  returnShippingReserveFee?: number;
  atCenterTotalFee?: number;
  atCenterSplitOptions?: Record<string, number>;
  atCenterPackage?: InspectionQuotePackageAtCenter;
}

export interface InspectionQuoteRequest {
  postId: string;
  buyerLatitude?: number;
  buyerLongitude?: number;
}

export interface CreateInspectionRequest {
  postId: string;
  orderType: 'AT_HOME' | 'AT_CENTER';
  feePayer: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  buyerConsentZinLoss: boolean;
  buyerLatitude?: number;
  buyerLongitude?: number;
  buyerDeliveryAddress?: {
    name: string;
    phone: string;
    latitude: number;
    longitude: number;
  } | string;
  note?: string;
}

export interface InspectionSellerRespondRequest {
  action: 'ACCEPT' | 'COUNTER' | 'REJECT';
  counterOrderType?: 'AT_HOME' | 'AT_CENTER';
  counterFeePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  sellerConsentZinLoss?: boolean;
  rejectionReason?: string;
}

export interface ChecklistResultItem {
  itemId: string;
  itemTitle: string;
  isPassed?: boolean;
  passed?: boolean;
  inspectorNote?: string;
}

export interface SubmitInspectionReportRequest {
  status: 'PASSED' | 'FAILED' | string;
  note?: string;
  conditionScore?: number;
  conditionGrade?: string;
  tamperSealId?: string;
  barcode?: string;
  videoProofUrl?: string;
  unboxingVideoUrl?: string;
  checklistResults?: ChecklistResultItem[];
}

// Backward compatibility alias for SubmitInspectionReportRequest
export type SubmitInspectionResultRequest = SubmitInspectionReportRequest;

export interface InspectionChecklistItemResponse {
  id: string;
  itemTitle?: string;
  name?: string;
  criteriaDescription?: string;
  description?: string;
  mandatory?: boolean;
  orderIndex?: number;
  weight?: number;
}

export interface InspectionChecklistResponse {
  id: string;
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  title: string;
  description?: string;
  active?: boolean;
  items?: InspectionChecklistItemResponse[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateChecklistItemRequest {
  itemTitle?: string;
  name?: string;
  criteriaDescription?: string;
  description?: string;
  mandatory?: boolean;
  orderIndex?: number;
  code?: string;
  weight?: number;
  inspectionType?: string;
}

export interface CreateChecklistTemplateRequest {
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  title?: string;
  description?: string;
  items: CreateChecklistItemRequest[];
}

export interface InspectionFeeProposalResponse {
  id: string;
  categoryId?: string;
  categoryName?: string;
  baseInspectionFee: number;
  tiersJson?: string;
  tiers?: InspectionTravelTierDto[];
  proposedById?: string;
  proposedByName?: string;
  proposedByEmail?: string;
  reviewedById?: string;
  reviewedByName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  rejectReason?: string;
  createdAt?: string;
  reviewedAt?: string;
}

export interface ProposeTravelTiersRequest {
  categoryId?: string;
  baseInspectionFee: number;
  tiers: {
    tierNumber: number;
    name: string;
    fromKm: number;
    toKm: number;
    pricePerKm: number;
  }[];
}

export interface InspectionOrderDto {
  id: string;
  postId: string;
  postTitle?: string;
  postImageUrl?: string;
  postImageUrls?: string[];
  postPrice?: number;

  buyerId?: string;
  buyerEmail?: string;
  buyerName?: string;

  sellerId?: string;
  sellerEmail?: string;
  sellerName?: string;

  inspectorId?: string;
  inspectorName?: string;

  orderType?: 'AT_HOME' | 'AT_CENTER' | string;
  feePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50' | string;
  status: string;
  note?: string;

  inspectionFee?: number;
  shippingFee?: number;
  travelDistanceKm?: number;
  travelFee?: number;
  returnShippingReserveFee?: number;

  buyerFeeShare?: number;
  sellerFeeShare?: number;

  paymentDeadline?: string;
  buyerPaidAt?: string;
  sellerPaidAt?: string;

  appointmentScheduledAt?: string;
  checklistResultJson?: string;
  videoProofUrl?: string;
  unboxingVideoUrl?: string;

  buyerConsentZin?: boolean;
  sellerConsentZin?: boolean;

  conditionScore?: number;
  conditionGrade?: string;
  tamperSealId?: string;
  barcode?: string;

  finalPaymentDeadline?: string;
  finalPaymentPaidAt?: string;
  finalItemPrice?: number;
  finalShippingFee?: number;

  initialDepositPaid?: number;
  finalPaymentRequired?: boolean;

  address?: string;
  sellerAddress?: string;
  sellerPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspectionStaffDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus?: string;
  emailVerified?: boolean;
  gender?: string;
  role?: string;
  createdAt?: string;
  assignedOrdersCount?: number;
}

export interface CreateInspectionStaffRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface InspectionSealLogDto {
  id: string;
  scannedAt: string;
  scannedByName?: string;
  scanStage: 'INITIAL_SEAL' | 'CARRIER_HANDOVER' | 'DELIVERED_BUYER' | string;
  sealCondition: 'INTACT' | 'TAMPERED' | string;
  locationText?: string;
  note?: string;
}

export interface InspectionSealVerificationResponse {
  tamperSealId: string;
  inspectionOrderId: string;
  postId: string;
  productTitle?: string;
  productModel?: string;
  productBrand?: string;
  conditionScore?: number;
  conditionGrade?: string;
  inspectionStatus?: string;
  inspectionCenterName?: string;
  inspectorName?: string;
  inspectedAt?: string;
  currentSealStatus?: 'INTACT' | 'TAMPERED' | string;
  isOfficialSecondLifeSeal: boolean;
  scanHistory?: InspectionSealLogDto[];
}

export interface InspectionSealScanRequest {
  tamperSealId: string;
  scanStage: 'INITIAL_SEAL' | 'CARRIER_HANDOVER' | 'DELIVERED_BUYER';
  sealCondition: 'INTACT' | 'TAMPERED';
  locationText?: string;
  note?: string;
}

// ============================================================================
// INSPECTOR SERVICE
// ============================================================================

export const inspectorService = {
  // --------------------------------------------------------------------------
  // 1. BUYER & SELLER INSPECTION FLOW (/api/v1/inspection)
  // --------------------------------------------------------------------------

  /**
   * Tính toán báo giá chi tiết 2 gói AT_HOME và AT_CENTER
   */
  async getQuote(data: InspectionQuoteRequest): Promise<InspectionQuoteResponse> {
    const res = await request<InspectionQuoteResponse>('/inspection/quote', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: false, // Public endpoint
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer tạo yêu cầu mua hàng kèm kiểm định
   */
  async createRequest(data: CreateInspectionRequest): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>('/inspection/requests', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Seller phản hồi yêu cầu: ACCEPT, COUNTER hoặc REJECT
   */
  async respondRequest(orderId: string, data: InspectionSellerRespondRequest): Promise<InspectionOrderDto> {
    const payload = {
      ...data,
      sellerConsentZinLoss: data.sellerConsentZinLoss ?? (data.action === 'ACCEPT'),
      sellerConsentZin: data.sellerConsentZinLoss ?? (data.action === 'ACCEPT'),
    };
    const res = await request<InspectionOrderDto>(`/inspection/requests/${orderId}/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer hoặc Seller nộp phí kiểm định từ Ví vào Escrow (Hạn 6h)
   */
  async payInspectionFee(orderId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspection/orders/${orderId}/pay-fee`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lấy chi tiết đơn kiểm định
   */
  async getOrder(orderId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspection/orders/${orderId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer xem danh sách đơn mua có kiểm định của mình
   */
  async getMyBuyerOrders(page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const res = await request<PageResponse<InspectionOrderDto>>(`/inspection/my-buyer-orders?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Seller xem danh sách đơn bán có kiểm định của mình
   */
  async getMySellerOrders(page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const res = await request<PageResponse<InspectionOrderDto>>(`/inspection/my-seller-orders?page=${page}&size=${size}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer thanh toán tiền hàng và phí vận chuyển cuối sau khi máy PASSED (Hạn 6h)
   */
  async confirmPurchase(orderId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspection/orders/${orderId}/confirm-purchase`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer từ chối mua tiếp sau khi có kết quả kiểm định (Hủy đơn & thông báo cho Người bán)
   */
  async rejectPurchase(orderId: string, reason?: string): Promise<any> {
    const res = await request<any>(`/inspection/orders/${orderId}/reject-purchase`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Người mua từ chối mua tiếp sau kiểm định' }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Quét mã QR tra cứu và xác thực thông tin tem niêm phong
   */
  async getSealVerification(tamperSealId: string): Promise<InspectionSealVerificationResponse> {
    const res = await request<InspectionSealVerificationResponse>(`/inspection/seal/${encodeURIComponent(tamperSealId)}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (res as any)?.data || res;
  },

  /**
   * Ghi nhận lịch sử các lần quét mã QR tem niêm phong (KTV, Shipper, Buyer)
   */
  async recordSealScan(data: InspectionSealScanRequest): Promise<InspectionSealLogDto> {
    const res = await request<InspectionSealLogDto>('/inspection/seal/scan', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  // --------------------------------------------------------------------------
  // 2. INSPECTOR EXECUTION FLOW (/api/v1/inspector)
  // --------------------------------------------------------------------------

  /**
   * KTV xem danh sách đơn được phân công cho mình
   */
  async getMyOrders(): Promise<InspectionOrderDto[]> {
    const res = await request<InspectionOrderDto[]>('/inspector/orders', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : (data?.items || []);
  },

  /**
   * Xem danh sách tất cả các đơn kiểm định (hỗ trợ phân trang và lọc status)
   * GET /api/v1/inspector/orders/all
   */
  async getAllInspectorOrders(status?: string, page = 0, size = 10): Promise<PageResponse<InspectionOrderDto>> {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.append('status', status);
    const res = await request<PageResponse<InspectionOrderDto>>(`/inspector/orders/all?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return data;
  },

  /**
   * KTV bắt đầu tiến hành kiểm định đơn hàng (chuyển trạng thái sang INSPECTING)
   */
  async startInspection(orderId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspector/orders/${orderId}/start`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lên lịch hẹn kiểm tra tại nhà (Gói AT_HOME)
   */
  async scheduleAppointment(orderId: string, scheduledAt: string, note?: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspector/orders/${orderId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt, note }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lấy bộ checklist động theo danh mục sản phẩm của đơn
   */
  async getOrderChecklist(orderId: string): Promise<InspectionChecklistResponse> {
    const res = await request<InspectionChecklistResponse>(`/inspector/orders/${orderId}/checklist`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * KTV nộp báo cáo kết quả kiểm định chuyên sâu kèm video và checklist
   */
  async submitReport(orderId: string, data: SubmitInspectionReportRequest): Promise<InspectionOrderDto> {
    const formattedChecklistResults = (data.checklistResults || []).map((item) => ({
      ...item,
      passed: Boolean((item as any).passed ?? item.isPassed),
      isPassed: Boolean(item.isPassed ?? (item as any).passed),
    }));

    const payload = {
      ...data,
      checklistResults: formattedChecklistResults,
    };

    const res = await request<InspectionOrderDto>(`/inspector/orders/${orderId}/result`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Alias nộp kết quả tương thích ngược
   */
  async submitResult(orderId: string, data: SubmitInspectionReportRequest): Promise<InspectionOrderDto> {
    return this.submitReport(orderId, data);
  },

  /**
   * Kỹ thuật viên yêu cầu hệ thống tự sinh mã tem niêm phong số chuẩn kèm checksum
   * POST /api/v1/inspector/orders/{orderId}/generate-seal
   */
  async generateSeal(orderId: string): Promise<string> {
    const res = await request<any>(`/inspector/orders/${orderId}/generate-seal`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || (res as any)?.message || String(res);
  },

  // --------------------------------------------------------------------------
  // 3. INSPECTION CENTER PORTAL (/api/v1/inspector-center)
  // --------------------------------------------------------------------------

  /**
   * Manager xem danh sách tất cả các đơn kiểm định
   */
  async getAllOrders(status?: string, page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await request<PageResponse<InspectionOrderDto>>(`/inspector-center/orders?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager phân công Inspector cho đơn kiểm định
   */
  async assignInspector(orderId: string, inspectorId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(
      `/inspector-center/orders/${orderId}/assign?inspectorId=${encodeURIComponent(inspectorId)}`,
      {
        method: 'POST',
        requiresAuth: true,
      }
    );
    return (res as any)?.data || res;
  },

  /**
   * Manager xem danh sách nhân viên KTV thuộc trung tâm quản lý
   */
  async getStaff(): Promise<InspectionStaffDto[]> {
    const res = await request<InspectionStaffDto[]>('/inspector-center/staff', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : (data?.items || []);
  },

  /**
   * Manager tạo tài khoản kỹ thuật viên mới cho trung tâm
   */
  async createStaff(data: CreateInspectionStaffRequest): Promise<any> {
    const res = await request<any>('/inspector-center/staff', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email?.trim(),
        fullName: data.fullName?.trim(),
        password: data.password,
      }),
      requiresAuth: true,
    });
    return (res as any)?.data || (res as any)?.message || res;
  },

  /**
   * Manager xem các mẫu checklist kiểm định
   */
  async getChecklists(): Promise<InspectionChecklistResponse[]> {
    const res = await request<InspectionChecklistResponse[]>('/inspector-center/checklists', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Manager xem chi tiết một bộ checklist kiểm định theo ID
   * GET /api/v1/inspector-center/checklists/{id}
   */
  async getChecklistById(id: string): Promise<InspectionChecklistResponse> {
    const res = await request<InspectionChecklistResponse>(`/inspector-center/checklists/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager tạo mẫu checklist theo danh mục
   */
  async createChecklist(data: CreateChecklistTemplateRequest): Promise<InspectionChecklistResponse> {
    const res = await request<InspectionChecklistResponse>('/inspector-center/checklists', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager cập nhật mẫu checklist
   */
  async updateChecklist(id: string, data: Partial<CreateChecklistTemplateRequest>): Promise<InspectionChecklistResponse> {
    const res = await request<InspectionChecklistResponse>(`/inspector-center/checklists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager xóa mẫu checklist
   */
  async deleteChecklist(id: string): Promise<void> {
    await request<void>(`/inspector-center/checklists/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  /**
   * Manager xem bảng giá 6 bậc cước di chuyển hiện tại
   */
  async getTravelTiers(): Promise<InspectionTravelTierDto[]> {
    const res = await request<InspectionTravelTierDto[]>('/inspector-center/travel-tiers', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Manager gửi đề xuất điều chỉnh biểu phí lên Admin sàn
   */
  async proposeTravelTiers(data: ProposeTravelTiersRequest): Promise<InspectionFeeProposalResponse> {
    const res = await request<InspectionFeeProposalResponse>('/inspector-center/travel-tiers/propose', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager xem lịch sử các đề xuất biểu phí của trung tâm
   */
  async getTierProposals(): Promise<InspectionFeeProposalResponse[]> {
    const res = await request<InspectionFeeProposalResponse[]>('/inspector-center/travel-tiers/proposals', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  // --------------------------------------------------------------------------
  // 4. ADMIN GOVERNANCE FLOW (/api/v1/admin/inspection)
  // --------------------------------------------------------------------------

  /**
   * Admin xem danh sách các đề xuất biểu phí
   */
  async getAdminFeeProposals(): Promise<InspectionFeeProposalResponse[]> {
    const res = await request<InspectionFeeProposalResponse[]>('/admin/inspection/fee-proposals', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Admin duyệt hoặc từ chối đề xuất biểu phí
   * POST /api/v1/admin/inspection/fee-proposals/{id}/review
   */
  async reviewFeeProposal(id: string, data: { approved: boolean; reason?: string; note?: string }): Promise<InspectionFeeProposalResponse> {
    const payload = {
      approved: data.approved,
      reason: data.reason || data.note,
    };
    const res = await request<InspectionFeeProposalResponse>(`/admin/inspection/fee-proposals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Admin xem bảng 6 bậc thang cước di chuyển
   */
  async getAdminTravelTiers(): Promise<InspectionTravelTierDto[]> {
    const res = await request<InspectionTravelTierDto[]>('/admin/inspection/travel-tiers', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Admin cập nhật trực tiếp biểu phí bậc thang di chuyển
   */
  async updateAdminTravelTiers(tiers: InspectionTravelTierDto[]): Promise<InspectionTravelTierDto[]> {
    const res = await request<InspectionTravelTierDto[]>('/admin/inspection/travel-tiers', {
      method: 'PUT',
      body: JSON.stringify(tiers),
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },
};
