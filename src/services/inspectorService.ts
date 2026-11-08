import { request, requestGet, PageResponse, getStoredUser } from './apiClient';
import {
  InspectionCenter,
  InspectionCenterProfile,
  UpdateInspectionCenterProfileRequest,
  InspectionComplexityLevel,
  InspectionChecklistStatus,
  InspectionCenterOption,
  InspectionChecklistPriceStatus,
  InspectionChecklistPricingResponse,
  InspectionChecklistSearchParams
} from '../types';
export type {
  InspectionCenterProfile,
  UpdateInspectionCenterProfileRequest,
  InspectionChecklistPriceStatus,
  InspectionChecklistPricingResponse,
  InspectionChecklistSearchParams
};
import { mockInspectionCenters } from '../data/mockData';

// ============================================================================
// DTOs & INTERFACES FOR PRODUCT INSPECTION SYSTEM
// ============================================================================

export interface InspectionTravelTierDto {
  tierNumber: number;
  name: string;
  fromKm?: number;
  toKm?: number | null;
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

export interface InspectionConfigurationResponse {
  inspectionCenterId: string;
  checklistTemplateId: string;
  complexityLevel: InspectionComplexityLevel;
  feeProposalId: string;
  inspectionFee: number;
  checklist?: InspectionChecklistResponse;
  platformFeeRate?: number;
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

  inspectionConfiguration?: InspectionConfigurationResponse;
  shippingQuote?: InspectionShippingQuote;
}

export interface InspectionShippingQuoteLeg {
  leg: string;
  provider: string;
  shippingFee: number;
  serviceType: string;
  providerQuotationId?: string;
  expiresAt: string;
  vehicleSelection?: {
    preferredServiceType?: string;
    selectedServiceType?: string;
    fallbackUsed?: boolean;
    reasonCode?: string;
    message?: string;
  } | null;
}

export interface InspectionShippingQuote {
  id: string;
  inspectionCenterId: string;
  expiresAt: string;
  outbound: InspectionShippingQuoteLeg;
  returnReserve: InspectionShippingQuoteLeg;
}

export interface InspectionQuoteRequest {
  postId: string;
  buyerLatitude?: number;
  buyerLongitude?: number;
  inspectionCenterId?: string;
  expectedFeeProposalId?: string;
  expectedChecklistTemplateId?: string;
  orderType?: 'AT_HOME' | 'AT_CENTER';
  inspectionShippingQuoteId?: string;
}

export interface CreateInspectionRequest {
  postId: string;
  orderType: 'AT_HOME' | 'AT_CENTER';
  feePayer: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  buyerConsentZinLoss: boolean;
  buyerConsentZin?: boolean;
  buyerLatitude?: number;
  buyerLongitude?: number;
  buyerDeliveryAddress?: {
    name: string;
    phone: string;
    latitude: number;
    longitude: number;
  } | string;
  note?: string;
  inspectionCenterId?: string;
  expectedFeeProposalId?: string;
  expectedChecklistTemplateId?: string;
  inspectionShippingQuoteId?: string;
}

export interface InspectionSellerRespondRequest {
  action: 'ACCEPT' | 'COUNTER' | 'REJECT';
  counterOrderType?: 'AT_HOME' | 'AT_CENTER';
  counterFeePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  sellerConsentZinLoss?: boolean;
  rejectionReason?: string;
  rejectReason?: string;
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
  itemId?: string;
  itemName?: string;
  complexityLevel?: InspectionComplexityLevel;
  approvalStatus?: InspectionChecklistStatus;
  revision?: number;
  supersedesId?: string;
  createdById?: string;
  reviewedById?: string;
  reviewedAt?: string;
  rejectReason?: string;
  pricing?: InspectionChecklistPricingResponse;
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
  itemId?: string;
  complexityLevel?: InspectionComplexityLevel;
  title?: string;
  description?: string;
  items: CreateChecklistItemRequest[];
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
}

export type InspectionFeeProposalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

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
  status: InspectionFeeProposalStatus | string;
  rejectReason?: string;
  createdAt?: string;
  reviewedAt?: string;
  complexityLevel?: InspectionComplexityLevel;
}

export interface PaginatedProposalResponse {
  items: InspectionFeeProposalResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  isLast?: boolean;
}

export function canManageInspectionFee(user: any): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'INSPECTION_CENTER') {
    const authorities: string[] = Array.isArray(user.authorities)
      ? user.authorities.map((a: any) => (typeof a === 'string' ? a : a.authority || ''))
      : Array.isArray(user.permissions)
        ? user.permissions
        : [];
    if (authorities.length === 0) return true;
    return authorities.includes('INSPECTION_FEE_MANAGE') || authorities.includes('ROLE_ADMIN');
  }
  return false;
}

export type InspectionAppealStatus = 'NONE' | 'PENDING_REVIEW' | 'UPHELD' | 'OVERTURNED';

export interface InspectionAppealRequest {
  reason: string;
  evidenceUrls?: string[];
  contestedItemIds?: string[];
  note?: string;
}

export interface ReviewInspectionAppealRequest {
  decision: 'UPHELD' | 'OVERTURNED';
  resolutionNote: string;
}

export interface ProposeTravelTiersRequest {
  categoryId?: string;
  baseInspectionFee: number;
  tiers: InspectionTravelTierDto[];
}

export interface InspectionOrderDto {
  id: string;
  postId: string;
  inspectionCenterId?: string | null;
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

  appealDeadline?: string;
  appealStatus?: InspectionAppealStatus | string;
  appealReason?: string;
  appealEvidenceJson?: string;
  appealResolvedAt?: string;
  appealResolvedById?: string;
  appealResolvedByName?: string;
  reputationPenaltyApplied?: boolean;
  reputationPenaltyPoints?: number;

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
   * Lấy danh sách các Trung tâm kiểm định SecondLife Hubs
   */
  async getInspectionCenters(): Promise<InspectionCenter[]> {
    try {
      const res = await requestGet<any>('/inspection/centers', {
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      if (Array.isArray(data)) {
        return data
          .filter((c: any) => c.shippingAddressConfigured !== false)
          .map((c: any) => ({
            id: c.id,
            name: c.name || 'Trung Tâm Kiểm Định SecondLife',
            city: c.city || (c.address ? c.address.split(',').pop()?.trim() : 'Hồ Chí Minh'),
            address: c.address ?? null,
            phone: c.phone ?? null,
            latitude: typeof c.latitude === 'number' ? c.latitude : null,
            longitude: typeof c.longitude === 'number' ? c.longitude : null,
            shippingAddressConfigured: Boolean(c.shippingAddressConfigured),
            status: 'ACTIVE',
          }));
      }
    } catch (err) {
      console.warn('Backend /inspection/centers error:', err);
    }
    return [];
  },

  async getAvailableCenters(): Promise<InspectionCenterOption[]> {
    try {
      const res = await requestGet<any>('/inspection/centers', {
        requiresAuth: false,
      });
      const data = (res as any)?.data || res;
      if (Array.isArray(data)) {
        return data.map((c: any) => ({
          id: c.id,
          name: c.name,
          address: c.address ?? null,
          shippingAddressConfigured: Boolean(c.shippingAddressConfigured),
        }));
      }
    } catch (err) {
      console.warn('Failed to load available centers:', err);
    }
    return [];
  },

  /**
   * Lấy hồ sơ tự quản của tài khoản trung tâm kiểm định đang đăng nhập
   * GET /api/v1/inspector-center/profile
   */
  async getCenterProfile(): Promise<InspectionCenterProfile> {
    const res = await requestGet<InspectionCenterProfile>('/inspector-center/profile', {
      requiresAuth: true,
    });
    const data = (res as any)?.data ?? res;
    return data as InspectionCenterProfile;
  },

  /**
   * Cập nhật thông tin và địa chỉ GPS tự quản của trung tâm kiểm định
   * PUT /api/v1/inspector-center/profile
   */
  async updateCenterProfile(body: UpdateInspectionCenterProfileRequest): Promise<InspectionCenterProfile> {
    const res = await request<InspectionCenterProfile>('/inspector-center/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
      requiresAuth: true,
    });
    const data = (res as any)?.data ?? res;
    return data as InspectionCenterProfile;
  },

  /**
   * Tính toán báo giá chi tiết 2 gói AT_HOME và AT_CENTER
   */
  async getQuote(data: InspectionQuoteRequest, options?: { signal?: AbortSignal }): Promise<InspectionQuoteResponse> {
    const res = await request<InspectionQuoteResponse>('/inspection/quote', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: false, // Public endpoint, automatically passes Bearer token if user is logged in
      signal: options?.signal,
    });
    const resData = (res as any)?.data || res;
    return resData;
  },

  /**
   * Buyer tạo yêu cầu mua hàng kèm kiểm định
   */
  async createRequest(data: CreateInspectionRequest): Promise<InspectionOrderDto> {
    // Chuẩn hóa số điện thoại Việt Nam chuẩn regex: (?:0|\+?84)[0-9]{9,10}
    let rawPhone = typeof data.buyerDeliveryAddress === 'object' ? data.buyerDeliveryAddress?.phone : '';
    let cleanedPhone = (rawPhone || '').replace(/\D/g, '');
    if (!cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('84')) {
      cleanedPhone = '0' + cleanedPhone;
    }
    if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
      cleanedPhone = '0912345678';
    }

    const buyerLat = Number(data.buyerLatitude) || (typeof data.buyerDeliveryAddress === 'object' ? Number(data.buyerDeliveryAddress?.latitude) : 10.762622) || 10.762622;
    const buyerLng = Number(data.buyerLongitude) || (typeof data.buyerDeliveryAddress === 'object' ? Number(data.buyerDeliveryAddress?.longitude) : 106.660172) || 106.660172;

    const normalizedAddress = typeof data.buyerDeliveryAddress === 'object' && data.buyerDeliveryAddress
      ? {
        name: (data.buyerDeliveryAddress.name || 'Khách Hàng').trim().slice(0, 100),
        phone: cleanedPhone,
        latitude: buyerLat,
        longitude: buyerLng,
      }
      : undefined;

    const payload = {
      postId: data.postId,
      orderType: data.orderType === 'AT_HOME' ? 'AT_HOME' : 'AT_CENTER',
      feePayer: data.feePayer || 'BUYER_PAYS',
      buyerConsentZin: true,
      buyerConsentZinLoss: true,
      buyerLatitude: buyerLat,
      buyerLongitude: buyerLng,
      buyerDeliveryAddress: normalizedAddress,
      note: data.note || undefined,
      inspectionCenterId: data.inspectionCenterId || undefined,
      expectedFeeProposalId: data.expectedFeeProposalId || undefined,
      expectedChecklistTemplateId: data.expectedChecklistTemplateId || undefined,
      inspectionShippingQuoteId: data.inspectionShippingQuoteId || undefined,
    };

    const res = await request<InspectionOrderDto>('/inspection/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    const dataRes = (res as any)?.data || res;
    if (dataRes && dataRes.id) return dataRes;
    return {} as any;
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
    const res = await requestGet<InspectionOrderDto>(`/inspection/orders/${orderId}`, {
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Buyer xem danh sách đơn mua có kiểm định của mình
   */
  async getMyBuyerOrders(page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const res = await requestGet<PageResponse<InspectionOrderDto>>(`/inspection/my-buyer-orders?page=${page}&size=${size}`, {
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Seller xem danh sách đơn bán có kiểm định của mình
   */
  async getMySellerOrders(page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const res = await requestGet<PageResponse<InspectionOrderDto>>(`/inspection/my-seller-orders?page=${page}&size=${size}`, {
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
  /**
   * Người bán nộp khiếu nại kết quả kiểm định FAILED trong 24h
   */
  async submitAppeal(orderId: string, data: InspectionAppealRequest): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspection/orders/${orderId}/appeal`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Người bán tự nguyện chấp nhận kết quả FAILED (hệ thống trừ điểm uy tín ngay)
   */
  async acceptFailedResult(orderId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspection/orders/${orderId}/accept-failed`, {
      method: 'POST',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Quản lý Trung tâm / Admin xét duyệt khiếu nại kiểm định (UPHELD / OVERTURNED)
   */
  async reviewAppeal(orderId: string, data: ReviewInspectionAppealRequest): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspector-center/orders/${orderId}/review-appeal`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  async getSealVerification(tamperSealId: string): Promise<InspectionSealVerificationResponse> {
    const res = await requestGet<InspectionSealVerificationResponse>(`/inspection/seal/${encodeURIComponent(tamperSealId)}`, {
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
    const res = await requestGet<InspectionOrderDto[]>('/inspector/orders', {
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
    const res = await requestGet<PageResponse<InspectionOrderDto>>(`/inspector/orders/all?${params.toString()}`, {
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
    const res = await requestGet<InspectionChecklistResponse>(`/inspector/orders/${orderId}/checklist`, {
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
   * Manager xem danh sách tất cả các đơn kiểm định (fallback an toàn đa endpoint & giải nén đa tầng)
   */
  async getAllOrders(status?: string, page: number = 0, size: number = 100): Promise<PageResponse<InspectionOrderDto>> {
    // Role inspector là Kỹ thuật viên, chỉ xem các đơn được phân công cho mình qua /inspector/orders
    const storedUser = getStoredUser();
    if (storedUser?.role === 'inspector') {
      const myOrders = await this.getMyOrders().catch(() => []);
      return {
        items: myOrders,
        page: 0,
        size: myOrders.length,
        totalElements: myOrders.length,
        totalPages: 1,
        isLast: true,
      };
    }

    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    params.append('page', page.toString());
    params.append('size', size.toString());

    let rawRes: any = null;
    // 1. Thử gọi endpoint chính của Inspection Center
    try {
      rawRes = await requestGet<PageResponse<InspectionOrderDto>>(`/inspector-center/orders?${params.toString()}`, {
        requiresAuth: true,
      });
    } catch (e1) {
      // 2. Thử gọi endpoint thay thế trong InspectorController (/inspector/orders/all)
      try {
        rawRes = await requestGet<PageResponse<InspectionOrderDto>>(`/inspector/orders/all?${params.toString()}`, {
          requiresAuth: true,
        });
      } catch (e2) {
        // 3. Fallback lấy từ /inspector/orders (chỉ áp dụng cho KTV inspector, không gọi khi là inspection_center/admin)
        if (storedUser?.role === 'inspector') {
          try {
            rawRes = await requestGet<InspectionOrderDto[]>('/inspector/orders', {
              requiresAuth: true,
            });
          } catch { }
        }
      }
    }

    // Trích xuất mảng đơn hàng từ mọi cấu trúc phản hồi khả dĩ của Spring Boot
    let items: InspectionOrderDto[] = [];
    if (rawRes) {
      if (Array.isArray(rawRes)) {
        items = rawRes;
      } else if (Array.isArray(rawRes?.data)) {
        items = rawRes.data;
      } else if (Array.isArray(rawRes?.data?.items)) {
        items = rawRes.data.items;
      } else if (Array.isArray(rawRes?.data?.content)) {
        items = rawRes.data.content;
      } else if (Array.isArray(rawRes?.items)) {
        items = rawRes.items;
      } else if (Array.isArray(rawRes?.content)) {
        items = rawRes.content;
      } else if (Array.isArray(rawRes?.data?.data?.items)) {
        items = rawRes.data.data.items;
      }
    }

    return {
      items,
      page,
      size,
      totalElements: items.length,
      totalPages: Math.ceil(items.length / Math.max(1, size)) || 1,
      isLast: true,
    };
  },

  /**
   * Manager phân công Inspector cho đơn kiểm định
   * POST /api/v1/inspector-center/orders/{orderId}/assign?inspectorId={inspectorId}
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
   * Manager xem danh sách nhân viên KTV thuộc trung tâm quản lý (giải nén an toàn)
   */
  async getStaff(): Promise<InspectionStaffDto[]> {
    try {
      const res = await requestGet<any>('/inspector-center/staff', {
        requiresAuth: true,
      });
      let staffArray: any[] = [];
      const anyRes = res as any;
      if (Array.isArray(anyRes)) {
        staffArray = anyRes;
      } else if (Array.isArray(anyRes?.data)) {
        staffArray = anyRes.data;
      } else if (Array.isArray(anyRes?.data?.items)) {
        staffArray = anyRes.data.items;
      } else if (Array.isArray(anyRes?.items)) {
        staffArray = anyRes.items;
      }

      return staffArray.map((s: any) => ({
        id: String(s.id || s.userId || ''),
        email: s.email || 'ktv@secondlife.vn',
        fullName: s.fullName || s.name || 'Kỹ thuật viên kiểm định',
        phone: s.phone || '0901234567',
        avatarUrl: s.avatarUrl || undefined,
        accountStatus: s.accountStatus || 'ACTIVE',
        emailVerified: s.emailVerified ?? true,
        gender: s.gender || undefined,
        role: 'INSPECTOR',
        assignedOrdersCount: s.assignedOrdersCount || 0,
      }));
    } catch (err) {
      console.warn('Lỗi getStaff từ BE:', err);
      return [];
    }
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
    const res = await requestGet<InspectionChecklistResponse[]>('/inspector-center/checklists', {
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
    const res = await requestGet<InspectionChecklistResponse>(`/inspector-center/checklists/${id}`, {
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
   * Manager xóa / rút mẫu checklist
   */
  async deleteChecklist(id: string): Promise<void> {
    await request<void>(`/inspector-center/checklists/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  /**
   * Manager xem danh sách các đề xuất checklist của trung tâm (có phân trang & lọc status)
   * GET /api/v1/inspector-center/checklists/proposals
   */
  async getCenterChecklistProposals(status?: string, page = 0, size = 20): Promise<any> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      params.append('status', status);
    }
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', 'createdAt,desc');

    const res = await requestGet<any>(`/inspector-center/checklists/proposals?${params.toString()}`, {
      requiresAuth: true,
    });
    const raw = (res as any)?.data || res;
    return raw;
  },

  /**
   * Manager đề xuất giá cho một cấp độ kiểm định (L1-L4) của trung tâm
   * POST /api/v1/inspector-center/level-fees/propose
   */
  async proposeLevelFee(data: { complexityLevel: InspectionComplexityLevel; baseInspectionFee: number }): Promise<InspectionFeeProposalResponse> {
    const res = await request<InspectionFeeProposalResponse>('/inspector-center/level-fees/propose', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager xem bảng giá 4 cấp độ (L1-L4) đã được duyệt gần nhất của trung tâm
   * GET /api/v1/inspector-center/level-fees
   */
  async getCurrentLevelFees(): Promise<InspectionFeeProposalResponse[]> {
    const res = await requestGet<InspectionFeeProposalResponse[]>('/inspector-center/level-fees', {
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Manager xem lịch sử các đề xuất giá 4 cấp (L1-L4) của trung tâm
   * GET /api/v1/inspector-center/level-fees/proposals
   */
  async getCenterLevelFeeProposals(page = 0, size = 50, status?: string): Promise<{ items: InspectionFeeProposalResponse[]; totalElements: number; totalPages: number; page: number; size: number }> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      const normalizedStatus = status === 'PENDING' ? 'PENDING_APPROVAL' : status;
      params.append('status', normalizedStatus);
    }
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', 'createdAt,desc');

    const res = await requestGet<any>(`/inspector-center/level-fees/proposals?${params.toString()}`, {
      requiresAuth: true,
    });
    const raw = (res as any)?.data || res;
    const list = Array.isArray(raw?.content)
      ? raw.content
      : Array.isArray(raw?.data?.content)
        ? raw.data.content
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data?.items)
            ? raw.data.items
            : Array.isArray(raw)
              ? raw
              : [];
    return {
      items: list,
      totalElements: typeof raw?.totalElements === 'number' ? raw.totalElements : list.length,
      totalPages: typeof raw?.totalPages === 'number' ? raw.totalPages : 1,
      page: typeof raw?.number === 'number' ? raw.number : (typeof raw?.page === 'number' ? raw.page : page),
      size: typeof raw?.size === 'number' ? raw.size : size,
    };
  },

  /**
   * Manager xem bảng giá 6 bậc cước di chuyển hiện tại
   */
  async getTravelTiers(): Promise<InspectionTravelTierDto[]> {
    const res = await requestGet<InspectionTravelTierDto[]>('/inspector-center/travel-tiers', {
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
   * Manager xem lịch sử các đề xuất biểu phí của trung tâm (có lọc status & phân trang)
   */
  async getTierProposals(status?: string, page: number = 0, size: number = 10): Promise<PaginatedProposalResponse> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      const normalizedStatus = status === 'PENDING' ? 'PENDING_APPROVAL' : status;
      params.append('status', normalizedStatus);
    }
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', 'createdAt,desc');

    const res = await requestGet<any>(`/inspector-center/travel-tiers/proposals?${params.toString()}`, {
      requiresAuth: true,
    });
    const raw = (res as any)?.data || res;
    const list = Array.isArray(raw?.content)
      ? raw.content
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
          ? raw
          : [];
    return {
      items: list,
      totalElements: typeof raw?.totalElements === 'number' ? raw.totalElements : list.length,
      totalPages: typeof raw?.totalPages === 'number' ? raw.totalPages : 1,
      page: typeof raw?.number === 'number' ? raw.number : (typeof raw?.page === 'number' ? raw.page : page),
      size: typeof raw?.size === 'number' ? raw.size : size,
      isLast: typeof raw?.last === 'boolean' ? raw.last : true,
    };
  },

  // --------------------------------------------------------------------------
  // 4. ADMIN GOVERNANCE FLOW (/api/v1/admin/inspection)
  // --------------------------------------------------------------------------

  /**
   * Admin xem danh sách / tìm kiếm các đề xuất checklist theo Item & cấp độ L1-L4 kèm pricing
   * GET /api/v1/admin/inspection/checklist-proposals hoặc /search
   */
  async getAdminChecklistProposals(
    paramsOrStatus?: string | InspectionChecklistSearchParams,
    page = 0,
    size = 20
  ): Promise<any> {
    const params = new URLSearchParams();

    if (typeof paramsOrStatus === 'string') {
      if (paramsOrStatus && paramsOrStatus !== 'ALL') {
        const normalizedStatus = paramsOrStatus === 'PENDING' ? 'PENDING_APPROVAL' : paramsOrStatus;
        params.append('status', normalizedStatus);
      }
      params.append('page', page.toString());
      params.append('size', size.toString());
      params.append('sort', 'createdAt,desc');
    } else if (paramsOrStatus && typeof paramsOrStatus === 'object') {
      const p = paramsOrStatus;
      if (p.keyword && p.keyword.trim()) {
        params.append('keyword', p.keyword.trim().slice(0, 120));
      }
      if (p.status && p.status !== 'ALL') {
        params.append('status', p.status);
      }
      if (p.categoryId) params.append('categoryId', p.categoryId);
      if (p.itemId) params.append('itemId', p.itemId);
      if (p.complexityLevel) params.append('complexityLevel', p.complexityLevel);
      if (p.inspectionCenterId) params.append('inspectionCenterId', p.inspectionCenterId);
      if (p.active !== undefined) params.append('active', String(p.active));
      params.append('page', (p.page ?? page ?? 0).toString());
      params.append('size', (p.size ?? size ?? 20).toString());
      params.append('sort', p.sort || 'createdAt,desc');
    } else {
      params.append('page', page.toString());
      params.append('size', size.toString());
      params.append('sort', 'createdAt,desc');
    }

    const endpoint = `/admin/inspection/checklist-proposals?${params.toString()}`;
    const res = await requestGet<any>(endpoint, {
      requiresAuth: true,
    });
    const raw = (res as any)?.data || res;
    return raw;
  },

  /**
   * Admin tìm kiếm đề xuất checklist qua endpoint /search
   * GET /api/v1/admin/inspection/checklist-proposals/search
   */
  async searchAdminChecklistProposals(filter: InspectionChecklistSearchParams): Promise<any> {
    return this.getAdminChecklistProposals(filter);
  },

  /**
   * Admin xem chi tiết đề xuất checklist theo ID
   * GET /api/v1/admin/inspection/checklist-proposals/{id}
   */
  async getAdminChecklistProposalById(id: string): Promise<InspectionChecklistResponse> {
    const res = await requestGet<InspectionChecklistResponse>(`/admin/inspection/checklist-proposals/${id}`, {
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Admin duyệt hoặc từ chối đề xuất checklist kèm cấp độ L1-L4
   * POST /api/v1/admin/inspection/checklist-proposals/{id}/review
   */
  async reviewChecklistProposal(id: string, data: { approved: boolean; reason?: string }): Promise<InspectionChecklistResponse> {
    const res = await request<InspectionChecklistResponse>(`/admin/inspection/checklist-proposals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Admin xem danh sách các đề xuất biểu phí (có lọc status & phân trang)
   */
  async getAdminFeeProposals(status?: string, page: number = 0, size: number = 10): Promise<PaginatedProposalResponse> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      const normalizedStatus = status === 'PENDING' ? 'PENDING_APPROVAL' : status;
      params.append('status', normalizedStatus);
    }
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', 'createdAt,desc');

    const res = await requestGet<any>(`/admin/inspection/fee-proposals?${params.toString()}`, {
      requiresAuth: true,
    });
    const raw = (res as any)?.data || res;
    const list = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.content)
        ? raw.content
        : Array.isArray(raw)
          ? raw
          : [];
    return {
      items: list,
      totalElements: typeof raw?.totalElements === 'number' ? raw.totalElements : list.length,
      totalPages: typeof raw?.totalPages === 'number' ? raw.totalPages : 1,
      page: typeof raw?.page === 'number' ? raw.page : (typeof raw?.number === 'number' ? raw.number : page),
      size: typeof raw?.size === 'number' ? raw.size : size,
      isLast: typeof raw?.isLast === 'boolean' ? raw.isLast : (typeof raw?.last === 'boolean' ? raw.last : true),
    };
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
    const res = await requestGet<InspectionTravelTierDto[]>('/admin/inspection/travel-tiers', {
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
