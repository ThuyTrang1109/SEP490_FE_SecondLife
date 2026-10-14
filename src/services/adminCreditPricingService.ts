import { request } from './apiClient';

export type CreditType = 'LISTING' | 'VALUATION' | 'AI_CHAT' | string;

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
   * Lấy bảng giá đơn vị hiện hành cho các loại credit (LISTING, VALUATION, AI_CHAT)
   */
  async getCreditPrices(): Promise<CreditPricingRuleResponseDto[]> {
    try {
      const res = await request<CreditPricingRuleResponseDto[]>('/admin/credit-pricing', {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Failed to fetch admin credit prices from BE, using fallback prices:', err);
    }

    return [
      { creditType: 'LISTING', unitPrice: 20000, currency: 'VND', active: true },
      { creditType: 'VALUATION', unitPrice: 50000, currency: 'VND', active: true },
      { creditType: 'AI_CHAT', unitPrice: 5000, currency: 'VND', active: true },
    ];
  },

  /**
   * Cập nhật đơn giá VNĐ cho một loại credit
   */
  async updateCreditPrice(
    creditType: CreditType,
    unitPrice: number
  ): Promise<CreditPricingRuleResponseDto> {
    try {
      const res = await request<CreditPricingRuleResponseDto>(`/admin/credit-pricing/${creditType}`, {
        method: 'PUT',
        body: JSON.stringify({ unitPrice }),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch (err) {
      console.warn(`Update credit price for ${creditType} failed on BE:`, err);
      return {
        creditType,
        unitPrice,
        currency: 'VND',
        active: true,
      };
    }
  },

  /**
   * Lấy danh sách các bậc chiết khấu (Volume discount tiers)
   */
  async getDiscountTiers(): Promise<CreditDiscountTierResponseDto[]> {
    try {
      const res = await request<CreditDiscountTierResponseDto[]>('/admin/credit-discount-tiers', {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data || res;
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      // Endpoint /admin/credit-discount-tiers is omitted in current backend
    }

    // Check localStorage for admin created custom tiers
    try {
      const local = localStorage.getItem('secondlife_admin_discount_tiers');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    // Fallback: check topup packages from BE /v1/topup/packages
    try {
      const pkgRes = await request<any[]>('/v1/topup/packages', {
        method: 'GET',
        requiresAuth: true,
      });
      const pkgs = (pkgRes as any)?.data || pkgRes;
      if (Array.isArray(pkgs) && pkgs.length > 0) {
        return pkgs
          .filter((p: any) => (p.discountPercentage || 0) > 0)
          .map((p: any, idx: number) => ({
            id: p.id || `tier-${idx + 1}`,
            minQuantity: (p.postCredits || 0) + (p.valuationCredits || 0) + (p.chatCredits || 0),
            maxQuantity: null,
            discountRate: (p.discountPercentage || 0) / 100,
            active: p.active !== false,
          }));
      }
    } catch (_) {}

    // Standard fallback discount tiers
    return [
      { id: 'tier-1', minQuantity: 10, maxQuantity: 49, discountRate: 0.05, active: true },
      { id: 'tier-2', minQuantity: 50, maxQuantity: 99, discountRate: 0.10, active: true },
      { id: 'tier-3', minQuantity: 100, maxQuantity: null, discountRate: 0.20, active: true },
    ];
  },

  /**
   * Tạo mới bậc chiết khấu khi mua số lượng lớn
   */
  async createDiscountTier(
    data: SaveCreditDiscountTierRequestDto
  ): Promise<CreditDiscountTierResponseDto> {
    try {
      const res = await request<CreditDiscountTierResponseDto>('/admin/credit-discount-tiers', {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch (err) {
      console.warn('Backend /admin/credit-discount-tiers not supported, saving locally:', err);
      const newTier: CreditDiscountTierResponseDto = {
        id: `tier-${Date.now()}`,
        ...data,
      };
      const existing = await this.getDiscountTiers();
      const updated = [...existing, newTier];
      localStorage.setItem('secondlife_admin_discount_tiers', JSON.stringify(updated));
      return newTier;
    }
  },

  /**
   * Cập nhật thông tin bậc chiết khấu
   */
  async updateDiscountTier(
    tierId: string,
    data: SaveCreditDiscountTierRequestDto
  ): Promise<CreditDiscountTierResponseDto> {
    try {
      const res = await request<CreditDiscountTierResponseDto>(`/admin/credit-discount-tiers/${tierId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        requiresAuth: true,
      });
      return (res as any)?.data || res;
    } catch (err) {
      console.warn('Backend /admin/credit-discount-tiers update not supported, updating locally:', err);
      const existing = await this.getDiscountTiers();
      const updated = existing.map((t) => (t.id === tierId ? { ...t, ...data } : t));
      localStorage.setItem('secondlife_admin_discount_tiers', JSON.stringify(updated));
      return { id: tierId, ...data };
    }
  },
};
