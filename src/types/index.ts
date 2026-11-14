export type UserRole = 'buyer' | 'seller' | 'inspector' | 'staff' | 'admin' | 'inspection_center';

export type Language = 'vi' | 'en';

export type ThemeMode = 'dark' | 'light';

export type ConditionGrade = 'Like New' | 'Good' | 'Fair';

export type ItemCategory = 
  | 'Tủ lạnh & Tủ đông'
  | 'Máy giặt & Máy sấy'
  | 'Điều hòa & Máy lọc'
  | 'Robot & Máy hút bụi'
  | 'Lò vi sóng & Lò nướng'
  | 'Nồi cơm & Bếp từ'
  | 'Phòng ngủ'
  | 'Bếp & Phòng ăn'
  | 'Ban công & Giặt giũ'
  | 'Phòng tắm & Vệ sinh'
  | 'Phòng khách'
  | 'Khác'
  | string;

export type ListingStatus = 'active' | 'pending' | 'reserved' | 'sold' | 'draft' | 'RESERVED' | 'rejected' | 'pending_inspection';

export interface PhotoChecklist {
  front: string;
  back: string;
  screenOrDetails: string;
  accessoriesOrBox: string;
  serialOrReceipt: string;
  extraDetail?: string;
}

export interface InspectionChecklistItem {
  id: string;
  rawId?: string | null;
  category: string;
  title: string;
  label?: string; // Compatibility alias for title
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  mandatory?: boolean;
  notes?: string;
  testedValue?: string;
  orderIndex?: number;
}

export interface MultiStagePhotos {
  listingPhotos: string[];
  inspectorPhotos?: string[];
  handoverPhotos?: string[];
}

export interface Listing {
  id: string;
  categoryId?: string;
  itemId?: string;
  categoryName?: string;
  itemName?: string;
  title: string;
  category: ItemCategory;
  brand: string;
  model: string;
  modelCode?: string;
  purchaseYear: number;
  priceVnd: number;
  originalPriceVnd?: number;
  conditionGrade: ConditionGrade;
  declaredConditionText: string;
  description: string;
  location: string;
  sellerId: string;
  sellerName: string;
  sellerAddress?: string;
  seller?: { name?: string; phone?: string };
  sellerAvatarUrl?: string;
  sellerAvatar?: string;
  sellerRating: number;
  sellerCompletedOrders: number;
  sellerVerified: boolean;
  sellerTrustScore?: number;
  status: ListingStatus;
  createdAt: string;
  isInspectionGuaranteed: boolean;
  requiresInspection: boolean;
  isInspected?: boolean;
  inspectionPassed?: boolean;
  inspectionStatus?: string;
  inspectionSeal?: string;
  photos: PhotoChecklist;
  photoGallery: string[];
  shippingWeight?: number;
  shippingLength?: number;
  shippingWidth?: number;
  shippingHeight?: number;
  aiPriceEstimation?: {
    minVnd: number;
    maxVnd: number;
    suggestedVnd: number;
    quickSaleVnd: number;
    confidence: number;
    daysToSell: number;
  };
  aiSuggestedPrice?: number;
  aiFraudCheck?: {
    anomaly: boolean;
    trustScore: number;
    duplicateFound: boolean;
  };
  backendStatus?: string;
  rejectionReason?: string;
  listingCreditCharged?: boolean;
  aiDescription?: string | null;
}

export interface SellerPostDetailDto {
  id: string;
  categoryId: string;
  itemId?: string | null;
  title: string;
  description: string;
  imageUrls: string[];
  status: string; // ACTIVE, RESERVED, PAYMENT_PENDING, SOLD, DRAFT, PENDING, REJECTED
  createdAt: string;
  updatedAt?: string;
  price: number;
  itemCondition?: string;
  aiDescription?: string | null;
  aiSuggestedPrice?: number | null;
  rejectionReason?: string | null;
  listingCreditCharged?: boolean;
  shippingWeight?: number | null;
  shippingLength?: number | null;
  shippingWidth?: number | null;
  shippingHeight?: number | null;
  user?: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    address?: string | null;
  };
}

export type EscrowStatus =
  | 'AWAITING_PAYMENT'
  | 'HELD_IN_ESCROW'
  | 'AWAITING_INSPECTION'
  | 'INSPECTION_IN_PROGRESS'
  | 'INSPECTION_PASSED'
  | 'INSPECTION_FAILED'
  | 'SHIPPED_TO_BUYER'
  | 'DELIVERED_INSPECTION_WINDOW'
  | 'COMPLETED_RELEASED'
  | 'DISPUTED'
  | 'REFUNDED_TO_BUYER'
  | 'CANCELLED'
  | 'CANCELED';

export interface InspectionReport {
  id: string;
  orderId: string;
  centerId: string;
  centerName: string;
  inspectorName: string;
  inspectedAt: string;
  completedAt?: string;
  verdict: 'PASS' | 'FAIL';
  status?: 'PASSED' | 'FAILED';
  detectedGrade: ConditionGrade;
  conditionScore: number; // 0 - 100
  tamperSealId?: string;
  checklistResults: InspectionChecklistItem[];
  inspectorPhotos: string[];
  evidencePhotoUrls?: string[];
  summaryNotes: string;
  autoRefundTriggered?: boolean;
}

export interface ShippingLeg {
  id: string;
  legType: 'SELLER_TO_CENTER' | 'CENTER_TO_BUYER' | 'DIRECT' | string;
  carrier: 'Lalamove' | 'GHN' | string;
  trackingNumber: string;
  status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | string;
  origin: string;
  destination: string;
  estimatedDelivery: string;
  timeline: {
    timestamp: string;
    description: string;
    location?: string;
  }[];
}

export interface EscrowOrder {
  id: string;
  listingId: string;
  listing: Listing;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  itemPriceVnd: number;
  inspectionFeeVnd: number;
  shippingFeeVnd: number;
  platformFeeVnd: number;
  totalPaidVnd: number;
  escrowStatus: EscrowStatus;
  hasInspectionService: boolean;
  inspectionCenterId?: string;
  inspectionCenterName?: string;
  inspectionCenterAddress?: string;
  inspectionCenterPhone?: string;
  inspectionMethod?: 'AT_CENTER' | 'AT_HOME';
  sellerPaidAt?: string | null;
  buyerPaidAt?: string | null;
  sellerFeeShare?: number;
  buyerFeeShare?: number;
  cashShippingSimulation?: boolean;
  buyerCommitmentDeposit?: number;
  paymentDeadline?: string | null;
  returnShippingReserveFee?: number;
  feeSettledAt?: string | null;
  returnReserveStatus?: string | null;
  linkedOrderId?: string | null;
  inspectionStatus?: string;
  inspectionNote?: string;
  finalPaymentPaidAt?: string | null;
  inspectorId?: string;
  inspectorName?: string;
  inspectorEmail?: string;
  inspectorPhone?: string;
  feePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50' | string;
  finalPaymentDeadline?: string | null;
  inspectionFeeSplit?: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100';
  buyerInspectionFeeVnd?: number;
  sellerInspectionFeeVnd?: number;
  inspectionReport?: InspectionReport;
  shippingLegs: ShippingLeg[];
  inspectionWindowEndsAt?: string;
  createdAt: string;
  updatedAt?: string;
  multiStagePhotos: MultiStagePhotos;
  isReviewed?: boolean;
  userReview?: ProductReview;
  backendStatus?: OrderBackendStatus;
  status?: OrderBackendStatus | string | null;
  shippingQuoteId?: string;
  shippingDeliveredAt?: string;
  deliveryAddress?: any;
  sellerConfirmedAt?: string | null;
  confirmationDeadline?: string | null;
  confirmationCancelAt?: string | null;
  confirmationStatus?: string | null;
  sellerReadyAt?: string | null;
  carrierPickedUpAt?: string | null;
  handoverDeadline?: string | null;
  appointmentScheduledAt?: string | null;
  appointmentNote?: string | null;
  paymentMethod?: 'WALLET' | 'BANK_TRANSFER' | string;
  paymentExpiresAt?: string | null;
  bankPaymentDetails?: any;
  cancellationReasonCode?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  appealDeadline?: string | null;
  appealStatus?: string | null;
  appealReason?: string | null;
  appealEvidenceJson?: string | null;
  appealResolvedAt?: string | null;
  appealResolvedById?: string | null;
  appealResolvedByName?: string | null;
  reputationPenaltyApplied?: boolean | null;
  reputationPenaltyPoints?: number | null;
}

export interface ProductReview {
  id: string;
  orderId?: string;
  listingId: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  rating: number; // 1-5
  comment: string;
  tags?: string[];
  photos?: string[];
  createdAt: string;
  isVerifiedPurchase: boolean;
  conditionGrade?: ConditionGrade;
  sellerResponse?: {
    comment: string;
    respondedAt: string;
  };
}

export interface SellerTrustProfile {
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  trustScore: number; // 0 - 100
  tier: 'Kim Cương' | 'Bạch Kim' | 'Vàng' | 'Bạc';
  rating: number;
  reviewCount: number;
  successfulOrders: number;
  completionRate: number;
  responseRate: number;
  responseTime: string;
  hubPassRate: number;
  cancellationRate: number;
  badges: string[];
}

export interface DisputeCase {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  reason: 'NOT_AS_DESCRIBED' | 'DAMAGE_IN_TRANSIT' | 'AUTHENTICITY_CLAIM' | 'MISSING_ACCESSORIES';
  description: string;
  buyerEvidencePhotos: string[];
  openedAt: string;
  status: 'PENDING_ARBITRATION' | 'SELLER_REBUTTAL' | 'RESOLVED_REFUND' | 'RESOLVED_PAY_SELLER' | 'PARTIAL_REFUND';
  adminDecisionNotes?: string;
  arbitratedAt?: string;
  refundAmountVnd?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'system';
  text: string;
  timestamp: string;
  isOffer?: boolean;
  offerAmountVnd?: number;
  offerStatus?: 'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled';
  offerSenderRole?: 'buyer' | 'seller';
  negotiationId?: string;
  safetyWarning?: string;
  isUnsent?: boolean;
  isInspectionProposal?: boolean;
  inspectionProposal?: SystemInspectionProposalPayload;
  isSending?: boolean;
  isFailed?: boolean;
  errorReason?: string;
}

export interface SystemInspectionProposalPayload {
  type: 'INSPECTION_PROPOSAL';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COUNTERED';
  method: 'AT_CENTER' | 'AT_HOME';
  feeSplit: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100';
  estimatedFeeVnd: number;
  proposedByRole: 'buyer' | 'seller';
  proposalId?: string;
  orderId?: string;
  note?: string;

  // Rich metadata for AT_CENTER negotiation
  centerId?: string;
  centerName?: string;
  feePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  baseInspectionFee?: number;
  travelFeeRoundTrip?: number;
  travelDistanceKm?: number;
  shippingToCenterFee?: number;
  returnShippingReserveFee?: number;
  totalAtCenterFee?: number;
  buyerFeeShare?: number;
  sellerFeeShare?: number;
  cashShippingSimulation?: boolean;
  orderStatus?: string;
  counterFeePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  rejectionReason?: string;
  isZinLossAcknowledged?: boolean;
}

export interface InspectionProposalPrefillData {
  postId?: string;
  buyerId?: string;
  buyerLatitude?: number;
  buyerLongitude?: number;
  negotiationId?: string;
  agreedPrice?: number;
  centerId?: string;
  centerName?: string;
  centerAddress?: string;
  centerPhone?: string;
  inspectionMethod?: 'AT_CENTER' | 'AT_HOME';
  feeSplit?: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100';
  feePayer?: 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
  isZinLossAcknowledged?: boolean;
  quote?: any;
  baseInspectionFee?: number;
  travelFeeRoundTrip?: number;
  travelDistanceKm?: number;
  shippingToCenterFee?: number;
  returnShippingReserveFee?: number;
  totalAtCenterFee?: number;
  totalAtHomeFee?: number;
  buyerInspectionFee?: number;
  sellerInspectionFee?: number;
  upfrontAmount?: number;
  savedAt?: number;
}

export interface InspectionCenter {
  id: string;
  name: string;
  city?: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  shippingAddressConfigured?: boolean;
  status?: string;
  capacityPerDay?: number;
  currentQueue?: number;
  certifiedCategories?: string[];
  activeInspectors?: number;
  passRatePercentage?: number;
  slaHours?: number;
}

export interface InspectionCenterProfile {
  id: string;
  name: string;
  phone: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  streetAddress: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  shippingAddressConfigured: boolean;
  updatedAt: string | null;
}

export interface UpdateInspectionCenterProfileRequest {
  name: string;
  phone: string;
  province: string;
  district?: string | null;
  ward: string;
  streetAddress: string;
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  permissions?: string[];
  phone?: string;
  address?: string;
  avatar?: string;
  gender?: 'male' | 'female' | 'other' | 'MALE' | 'FEMALE' | 'OTHER' | '';
  birthday?: string;
  walletBalanceVnd?: number;
  walletBalance?: number;
  escrowLockedVnd?: number;
  kycStatus?: 'verified' | 'pending' | 'unverified';
  emailVerified?: boolean;
  accountStatus?: string;
  trustScore?: number;
  completedOrdersCount?: number;
  sellerRating?: number;
  isSellerRegistered?: boolean;
  shopName?: string;
  pickupAddress?: string;
  wardName?: string;
  provinceName?: string;
  province?: string;
  district?: string;
  ward?: string;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
  idCardNumber?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  productTypes?: string;
}

export interface TopupPackage {
  id: string;
  name?: string;
  packageName?: string;
  price?: number;
  priceVnd?: number;
  postCredits?: number;
  chatCredits?: number;
  valuationCredits?: number;
  creditPoints?: number;
  bonusPoints?: number;
  description?: string;
  discountPercentage?: number | null;
  referencePrice?: number | null;
  pricingAvailable?: boolean;
  active?: boolean;
  packageVersion?: number;
  isPopular?: boolean;
}

export interface TopupPurchaseRequest {
  requestId: string;
  packageVersion: number;
  expectedPrice: number;
}

export interface TopupPackagePurchaseResponse {
  id: string;
  requestId: string;
  packageId: string;
  packageVersion: number;
  packageName: string;
  packageDescription?: string;
  postCredits: number;
  chatCredits: number;
  valuationCredits: number;
  price: number;
  currency: string;
  referencePrice?: number | null;
  discountPercentage?: number | null;
  listingUnitPrice?: number;
  chatUnitPrice?: number;
  valuationUnitPrice?: number;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  postBalanceAfter: number;
  chatBalanceAfter: number;
  valuationBalanceAfter: number;
  createdAt: string;
}

export interface UserCredit {
  id?: string;
  userId?: string;
  postCredits: number;
  valuationCredits: number;
  chatCredits: number;
  updatedAt?: string;
}

export interface CategoryBackend {
  id: string;
  name: string;
  description?: string;
}

export interface ItemBackend {
  id: string;
  name: string;
  categoryId: string;
  description?: string;
  selectable?: boolean;
  replacementForItemId?: string | null;
  variantCode?: string | null;
}

export type InspectionComplexityLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type InspectionChecklistStatus = 'LEGACY' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export type InspectionChecklistPriceStatus =
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'NOT_CONFIGURED'
  | 'LEGACY'
  | 'CENTER_UNAVAILABLE';

export interface InspectionChecklistPricingResponse {
  inspectionCenterId?: string;
  inspectionCenterName?: string;
  complexityLevel?: InspectionComplexityLevel;
  baseInspectionFee?: number | null;
  feeProposalId?: string;
  feeReviewedAt?: string;
  pendingBaseInspectionFee?: number | null;
  pendingFeeProposalId?: string;
  priceStatus?: InspectionChecklistPriceStatus;
  applicable?: boolean;
  unavailableReason?: string | null;
}

export interface InspectionChecklistSearchParams {
  keyword?: string;
  status?: InspectionChecklistStatus | 'ALL';
  categoryId?: string;
  itemId?: string;
  complexityLevel?: InspectionComplexityLevel;
  inspectionCenterId?: string;
  active?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface InspectionCenterOption {
  id: string;
  name: string;
  address?: string | null;
  shippingAddressConfigured?: boolean;
}

export interface AiChatResponseDto {
  sessionId: string;
  reply: string;
}

// ==========================================
// 1. Wallet & Deposit Types
// ==========================================
export interface UserWallet {
  id: string;
  userId: string;
  balance: number;
  updatedAt?: string;
}

export interface DepositCreateRequestDTO {
  amount: number;
}

export interface DepositResponseDTO {
  id: string;
  amount: number;
  code: string;
  status: 'PENDING' | 'SUCCESS' | 'CANCELLED' | string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  createdAt: string;
  expiresAt?: string;
}

export type WalletTransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'PAYMENT'
  | 'EARNING'
  | 'REFUND'
  | 'RETURN_SHIPPING_FEE'
  | 'SHIPPING_REIMBURSE';

export type WalletTransactionReferenceType =
  | 'ORDER'
  | 'INSPECTION_ORDER'
  | 'DEPOSIT_REQUEST'
  | 'WITHDRAWAL'
  | 'SHIPMENT'
  | 'CREDIT_PURCHASE'
  | 'TOPUP_PACKAGE'
  | 'UNKNOWN';

export type WalletTransactionDirection = 'CREDIT' | 'DEBIT' | 'NEUTRAL';

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: WalletTransactionType | string;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  description: string;
  createdAt: string;
  referenceId?: string | null;
  referenceType?: WalletTransactionReferenceType | string;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  currency?: string;
  direction?: WalletTransactionDirection;
}

export interface WalletTransactionsQuery {
  page?: number;
  size?: number;
  sort?: string;
  type?: WalletTransactionType | '';
  from?: string;
  to?: string;
}

export interface WalletTransactionsPage {
  items: WalletTransaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
}


// ==========================================
// 2. Negotiation Types
// ==========================================
export type NegotiationStatusBackend = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';

export interface NegotiationRequestDTO {
  postId: string;
  offeredPrice: number;
}

export interface Negotiation {
  id: string;
  postId: string;
  postTitle?: string;
  buyerId?: string;
  sellerId?: string;
  offeredPrice: number;
  status: NegotiationStatusBackend;
  createdAt?: string;
  expiredAt?: string;
}

// ==========================================
// 3. Order & Escrow Types
// ==========================================
export type OrderStatusBackend = 'PENDING' | 'PENDING_PAYMENT' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'WAITING_SELLER_APPROVAL';
export type OrderBackendStatus = OrderStatusBackend | 'PASSED' | 'FAILED';
export type EscrowStatusBackend = 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN';

export interface OrderRequestDTO {
  postId: string;
  shippingQuoteId: string;
  requestId: string;
  paymentMethod?: 'WALLET' | 'BANK_TRANSFER';
  negotiationId?: string;
  agreedPrice?: number;
}

export interface OrderBackend {
  id: string;
  postId: string;
  postTitle?: string;
  buyerId: string;
  sellerId: string;
  negotiationId?: string;
  finalPrice: number;
  shippingQuoteId?: string;
  shippingFee?: number;
  totalPaid?: number;
  shippingDeliveredAt?: string;
  deliveryAddress?: string;
  status: OrderStatusBackend;
  escrowStatus: EscrowStatusBackend;
  createdAt: string;
  sellerConfirmedAt?: string | null;
  confirmationDeadline?: string | null;
  confirmationCancelAt?: string | null;
  confirmationStatus?: string | null;
  sellerReadyAt?: string | null;
  carrierPickedUpAt?: string | null;
  handoverDeadline?: string | null;
}

// ==========================================
// 4. Lalamove Shipping & Tracking Types
// ==========================================
export interface GeocodedAddressDto {
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  countryCode: string;
  placeId?: string;
}

export interface ShippingQuoteDeliveryAddressDto {
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  address?: string;
  // Legacy fields kept for backward compatibility if needed
  provinceName?: string;
  wardName?: string;
  newAddress?: boolean;
}

export interface ShippingQuoteRequestDto {
  postId: string;
  negotiationId?: string;
  deliveryAddress: ShippingQuoteDeliveryAddressDto;
  serviceType?: string;
}

export interface ShippingVehicleSelection {
  preferredServiceType: string;
  selectedServiceType: string;
  fallbackUsed: boolean;
  reasonCode?: 'PREFERRED_VEHICLE_OUT_OF_SERVICE_AREA'
    | 'PREFERRED_VEHICLE_UNAVAILABLE'
    | (string & {});
  providerErrorCode?: string;
  pickupCity?: string;
  deliveryCity?: string;
  distanceKm?: number;
  message?: string;
}

export interface ShippingRouteErrorDetails {
  preferredServiceType?: string;
  attemptedServiceTypes?: string[];
  pickupCity?: string;
  deliveryCity?: string;
  providerErrorCode?: string;
}

export interface ShippingQuoteResponseDto {
  quoteId: string;
  leg: string;
  shippingFee: number;
  productPrice: number;
  totalPayable: number;
  insuranceValue?: number;
  expiresAt: string;
  expectedDeliveryTime?: string;
  carrier?: string;
  provider?: string;
  serviceType?: string;
  providerQuotationId?: string;
  /** Packed measurements used by this quotation: grams and centimeters. */
  shippingWeight?: number;
  shippingLength?: number;
  shippingWidth?: number;
  shippingHeight?: number;
  vehicleSelection?: ShippingVehicleSelection | null;
}

export interface CreateShipmentRequestDto {
  requestId: string;
  leg: 'SELLER_TO_BUYER' | 'SELLER_TO_CENTER' | 'CENTER_TO_BUYER' | 'CENTER_TO_SELLER' | 'BUYER_TO_SELLER';
  fromAddress?: any;
  toAddress?: any;
  reason?: string;
  reportId?: string;
  maxReturnFee?: number;
}

export interface ShipmentBackend {
  shipmentId: string;
  cashPayerId?: string | null;
  cashConfirmedAt?: string | null;
  cashPaidAmount?: number | null;
  cashReimbursedAmount?: number | null;
  orderId: string;
  inspectionOrderId?: string;
  leg: string;
  orderCode: string | null;
  status: string; // PENDING, READY_TO_PICK, PICKING, PICKED, DELIVERING, DELIVERED, CANCELLED
  providerStatus: string | null; // Lalamove status: ASSIGNING_DRIVER, ON_GOING, PICKED_UP, COMPLETED, CANCELED, REJECTED, EXPIRED
  quotedFee?: number;
  actualFee?: number;
  expectedDeliveryTime: string | null;
  deliveredAt: string | null;
  reason?: string | null;
  lastError?: string | null;
  podUrl?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverPlateNumber?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverAddress?: string | null;
  shareLink?: string | null;
}

export interface ShipmentEventBackend {
  id: string;
  shipmentId: string;
  eventKey?: string;
  type: string;
  status: string | null;
  occurredAt: string;
  reason: string | null;
  payload?: string;
}

export interface LalamoveDriverCoordinates {
  lat: string | number;
  lng: string | number;
  updatedAt?: string;
}

export interface LalamoveDriverInfo {
  name?: string;
  phone?: string;
  plateNumber?: string;
  photo?: string;
  coordinates?: LalamoveDriverCoordinates | null;
}

export interface LalamoveTrackingResponse {
  status?: string;
  providerStatus?: string;
  locationStatus: 'AVAILABLE' | 'UNAVAILABLE';
  driver?: LalamoveDriverInfo | null;
  shareLink?: string | null;
  expectedDeliveryTime?: string | null;
}

export interface SystemWalletData {
  id: string;
  currency: string;
  heldBalance: number;
  shippingBalance: number;
  revenueBalance: number;
  totalBalance: number;
  updatedAt: string;
}

export interface SystemWalletTransaction {
  id: number;
  orderId: string;
  type: 'OPENING_BALANCE' | 'PAYMENT_HOLD' | 'SETTLEMENT' | 'REFUND' | string;
  heldDelta: number;
  shippingDelta: number;
  revenueDelta: number;
  heldBalanceAfter: number;
  shippingBalanceAfter: number;
  revenueBalanceAfter: number;
  createdAt: string;
}

export interface SystemWalletTransactionsPage {
  items: SystemWalletTransaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
}

export interface OrderSettlementDTO {
  settlementId?: string;
  orderId?: string;
  commissionSnapshotId?: string;
  commissionBase: number;
  rawCommission: number;
  platformCommission: number;
  sellerPayout: number;
  shippingFee: number;
  currency: string;
  roundingMode?: string;
  settledAt: string;
}

export interface OrderCommissionDTO {
  orderId?: string;
  commissionBase?: number;
  ratePercent?: number;
  minFee?: number;
  maxFee?: number;
  platformCommission?: number;
  ruleCode?: string;
  status?: string;
}

export interface StaffListingItemDTO {
  postId: string;
  categoryId?: string | null;
  itemId?: string | null;
  title: string;
  description: string;
  itemCondition?: string;
  imageUrl?: string;
  imageUrls: string[];
  price: number;
  aiSuggestedPrice?: number | null;
  status: string;
  rejectionReason?: string | null;
  listingCreditCharged?: boolean;
  aiDescription?: string | null;
  descriptionAccepted?: boolean;
  reviewReason?: string | null;
  duplicateMatches?: string[];
}
export * from './notification';

