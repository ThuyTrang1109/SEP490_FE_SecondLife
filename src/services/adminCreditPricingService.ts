import { request } from './apiClient';

export type CreditType = 'LISTING' | 'VALUATION';

export interface CreditPricingRuleResponseDto {
  creditType: CreditType;
  unitPrice: number;
  currency: string;
  active: boolean;
}

export interface CreditDiscountTierResponseDto {
  id: string;
  minQuantity: number;
  maxQuantity?: number | null;
  discountRate: number;
  active: boolean;
}

export interface SaveCreditDiscountTierRequestDto {
  minQuantity: number;
  maxQuantity?: number | null;
  discountRate: number;
  active: boolean;
}

export interface UpdateCreditPricingRequestDto {
  unitPrice: number;
}

export const adminCreditPricingService = {
  /**
   * Lấy bảng giá đơn vị hiện hành cho các loại credit (LISTING, VALUATION)
   */
  async getCreditPrices(): Promise<CreditPricingRuleResponseDto[]> {
    const res = await request<CreditPricingRuleResponseDto[]>('/admin/credit-pricing', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật đơn giá VNĐ cho một loại credit
   */
  async updateCreditPrice(
    creditType: CreditType,
    unitPrice: number
  ): Promise<CreditPricingRuleResponseDto> {
    const res = await request<CreditPricingRuleResponseDto>(`/admin/credit-pricing/${creditType}`, {
      method: 'PUT',
      body: JSON.stringify({ unitPrice }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Lấy danh sách các bậc chiết khấu (Volume discount tiers)
   */
  async getDiscountTiers(): Promise<CreditDiscountTierResponseDto[]> {
    const res = await request<CreditDiscountTierResponseDto[]>('/admin/credit-discount-tiers', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Tạo mới bậc chiết khấu khi mua số lượng lớn
   */
  async createDiscountTier(
    data: SaveCreditDiscountTierRequestDto
  ): Promise<CreditDiscountTierResponseDto> {
    const res = await request<CreditDiscountTierResponseDto>('/admin/credit-discount-tiers', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật thông tin bậc chiết khấu
   */
  async updateDiscountTier(
    tierId: string,
    data: SaveCreditDiscountTierRequestDto
  ): Promise<CreditDiscountTierResponseDto> {
    const res = await request<CreditDiscountTierResponseDto>(`/admin/credit-discount-tiers/${tierId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
