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
  category: string;
  title: string;
  label?: string; // Compatibility alias for title
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  notes?: string;
  testedValue?: string;
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
  detectedGrade: ConditionGrade;
  conditionScore: number; // 0 - 100
  tamperSealId: string;
  checklistResults: InspectionChecklistItem[];
  inspectorPhotos: string[];
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
  inspectionMethod?: 'AT_CENTER' | 'AT_HOME';
  inspectorId?: string;
  inspectorName?: string;
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
  offerStatus?: 'pending' | 'accepted' | 'declined' | 'countered';
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
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  method: 'AT_CENTER' | 'AT_HOME';
  feeSplit: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100';
  estimatedFeeVnd: number;
  proposedByRole: 'buyer' | 'seller';
  proposalId?: string;
  orderId?: string;
  note?: string;
}

export interface InspectionCenter {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  capacityPerDay: number;
  currentQueue: number;
  certifiedCategories: string[];
  activeInspectors: number;
  passRatePercentage: number;
  slaHours: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  discountPercentage?: number;
  isPopular?: boolean;
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

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'PAYMENT' | 'REFUND' | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  description: string;
  createdAt: string;
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
export type OrderBackendStatus = OrderStatusBackend;
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
}

export interface CreateShipmentRequestDto {
  requestId: string;
  leg: 'SELLER_TO_BUYER' | 'SELLER_TO_CENTER' | 'CENTER_TO_BUYER' | 'BUYER_TO_SELLER';
  fromAddress?: any;
  toAddress?: any;
  reason?: string;
}

export interface ShipmentBackend {
  shipmentId: string;
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

