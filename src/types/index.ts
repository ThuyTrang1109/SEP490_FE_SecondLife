export type UserRole = 'buyer' | 'seller' | 'inspector' | 'admin';

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

export type ListingStatus = 'active' | 'reserved' | 'sold' | 'draft';

export interface PhotoChecklist {
  front: string;
  back: string;
  screenOrDetails: string;
  accessoriesOrBox: string;
  serialOrReceipt: string;
}

export interface InspectionChecklistItem {
  id: string;
  category: string;
  title: string;
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
  purchaseYear: number;
  priceVnd: number;
  originalPriceVnd?: number;
  conditionGrade: ConditionGrade;
  declaredConditionText: string;
  description: string;
  location: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  sellerCompletedOrders: number;
  sellerVerified: boolean;
  status: ListingStatus;
  createdAt: string;
  isInspectionGuaranteed: boolean;
  requiresInspection: boolean;
  photos: PhotoChecklist;
  photoGallery: string[];
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
  legType: 'SELLER_TO_CENTER' | 'CENTER_TO_BUYER' | 'DIRECT';
  carrier: 'GHTK' | 'GHN';
  trackingNumber: string;
  status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
  origin: string;
  destination: string;
  estimatedDelivery: string;
  timeline: {
    timestamp: string;
    description: string;
    location: string;
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
  updatedAt: string;
  multiStagePhotos: MultiStagePhotos;
}

export interface DisputeCase {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
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
  creditPoints?: number;
  bonusPoints?: number;
  description?: string;
  discountPercentage?: number;
  isPopular?: boolean;
}

export interface UserCredit {
  id?: string;
  userId?: string;
  balance?: number;
  postCredits?: number;
  chatCredits?: number;
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


