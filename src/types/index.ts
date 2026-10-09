export type UserRole = 'buyer' | 'seller' | 'inspector' | 'staff' | 'admin';

export type Language = 'vi' | 'en';

export type ThemeMode = 'dark' | 'light';

export type ConditionGrade = 'Like New' | 'Good' | 'Fair';

export type ItemCategory = 
  | 'Tủ lạnh & Tủ đông'
  | 'Máy giặt & Máy sấy'
  | 'Điều hòa & Máy lọc'
  | 'Robot & Máy hút bụi'
  | 'Lò vi sóng & Lò nướng'
  | 'Nồi cơm & Bếp từ';

export type ListingStatus = 'active' | 'pending' | 'reserved' | 'sold' | 'draft' | 'RESERVED';

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
  | 'INSPECTION_IN_PROGRESS'
  | 'INSPECTION_PASSED'
  | 'INSPECTION_FAILED'
  | 'SHIPPED_TO_BUYER'
  | 'DELIVERED_INSPECTION_WINDOW'
  | 'COMPLETED_RELEASED'
  | 'DISPUTED'
  | 'REFUNDED_TO_BUYER';

export interface InspectionReport {
  id: string;
  orderId: string;
  centerId: string;
  centerName: string;
  inspectorName: string;
  inspectedAt: string;
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
  carrier: 'GHTK' | 'GHN' | 'GHN Express' | string;
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
  negotiationId?: string;
  safetyWarning?: string;
  isUnsent?: boolean;
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
  gender?: 'male' | 'female' | 'other';
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
export type OrderStatusBackend = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
export type OrderBackendStatus = OrderStatusBackend;
export type EscrowStatusBackend = 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN';

export interface OrderRequestDTO {
  postId: string;
  shippingQuoteId: string;
  requestId: string;
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
}

// ==========================================
// 4. GHN Shipping & Tracking Types
// ==========================================
export interface ShippingQuoteDeliveryAddressDto {
  name: string;
  phone: string;
  address: string;
  provinceName: string;
  wardName: string;
  newAddress: boolean;
}

export interface ShippingQuoteRequestDto {
  postId: string;
  negotiationId?: string;
  deliveryAddress: ShippingQuoteDeliveryAddressDto;
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
  providerStatus: string | null; // GHN status: ready_to_pick, picking, picked, storing, transporting, delivering, delivered, cancel
  quotedFee?: number;
  actualFee?: number;
  expectedDeliveryTime: string | null;
  deliveredAt: string | null;
  reason?: string | null;
  lastError?: string | null;
  podUrl?: string | null;
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



