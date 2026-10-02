import { request, PageResponse } from './apiClient';
import { CreditPricingRuleResponseDto, CreditDiscountTierResponseDto } from './adminCreditPricingService';

export interface CreditBalanceResponseDto {
  listing: number;
  valuation: number;
}

export interface CreditQuoteResponseDto {
  listingQuantity: number;
  valuationQuantity: number;
  listingUnitPrice: number;
  valuationUnitPrice: number;
  discountTierId?: string | null;
  discountMinQuantity?: number;
  discountMaxQuantity?: number | null;
  discountRate: number;
  subtotal: number;
  discountAmount: number;
  finalFee: number;
  currency: string;
}

export interface CreditPricingResponseDto {
  prices: CreditPricingRuleResponseDto[];
  discountTiers: CreditDiscountTierResponseDto[];
  quote?: CreditQuoteResponseDto;
}

export interface CreateCreditPurchaseRequestDto {
  listingQuantity: number;
  valuationQuantity: number;
}

export interface CreditPurchaseResponseDto {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | string;
  snapshot: CreditQuoteResponseDto;
  paymentIntentId?: string;
  paymentProvider?: string;
  providerIntentId?: string;
  paymentStatus?: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface CreditLedgerResponseDto {
  id: string;
  creditType: 'LISTING' | 'VALUATION';
  purchaseId?: string;
  entryType: string;
  quantityDelta: number;
  balanceAfter: number;
  createdAt: string;
}

export const sellerCreditService = {
  /**
   * Lấy số dư 2 loại tín dụng của người bán: số lượt đăng tin (listing) & định giá AI (valuation)
   * GET /api/seller/credits
   */
  async getCredits(): Promise<CreditBalanceResponseDto> {
    const res = await request<CreditBalanceResponseDto>('/seller/credits', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem bảng giá và tính toán số tiền tạm tính khi chọn số lượng lượt mua
   * GET /api/seller/credit-pricing?listingQuantity=...&valuationQuantity=...
   */
  async getPricing(
    listingQuantity?: number,
    valuationQuantity?: number
  ): Promise<CreditPricingResponseDto> {
    const params = new URLSearchParams();
    if (listingQuantity !== undefined) params.append('listingQuantity', listingQuantity.toString());
    if (valuationQuantity !== undefined) params.append('valuationQuantity', valuationQuantity.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<CreditPricingResponseDto>(`/seller/credit-pricing${qs}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Tạo đơn mua gói tín dụng theo số lượng tùy chọn của Seller
   * POST /api/seller/credit-purchases
   */
  async createPurchase(
    data: CreateCreditPurchaseRequestDto
  ): Promise<CreditPurchaseResponseDto> {
    const res = await request<CreditPurchaseResponseDto>('/seller/credit-purchases', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem lịch sử các đơn hàng mua tín dụng của Seller
   * GET /api/seller/credit-purchases
   */
  async getPurchases(
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<CreditPurchaseResponseDto>> {
    const res = await request<PageResponse<CreditPurchaseResponseDto>>(
      `/seller/credit-purchases?page=${page}&size=${size}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    return res.data;
  },

  /**
   * Xem sổ cái ghi nhận biến động tăng / giảm tín dụng của Seller
   * GET /api/seller/credit-ledger
   */
  async getLedger(
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<CreditLedgerResponseDto>> {
    const res = await request<PageResponse<CreditLedgerResponseDto>>(
      `/seller/credit-ledger?page=${page}&size=${size}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    return res.data;
  },
};
