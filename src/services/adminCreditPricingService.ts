export interface TopupPackageRequestDto {
  name: string;
  description?: string;
  postCredits: number;
  chatCredits: number;
  valuationCredits: number;
  price: number;
  active: boolean;
}

import { request } from './apiClient';
import { TopupPackage } from '../types';

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
   * GET /api/v1/admin/credit-pricing
   */
  async getCreditPrices(): Promise<CreditPricingRuleResponseDto[]> {
    const res = await request<CreditPricingRuleResponseDto[]>('/admin/credit-pricing', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },

  /**
   * Cập nhật đơn giá VNĐ cho một loại credit
   * PUT /api/v1/admin/credit-pricing/{creditType}
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
    try {
      const local = localStorage.getItem('secondlife_admin_discount_tiers');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

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
    const newTier: CreditDiscountTierResponseDto = {
      id: `tier-${Date.now()}`,
      ...data,
    };
    try {
      const existing = await this.getDiscountTiers();
      const updated = [...existing, newTier];
      localStorage.setItem('secondlife_admin_discount_tiers', JSON.stringify(updated));
    } catch (_) {}
    return newTier;
  },

  /**
   * Cập nhật thông tin bậc chiết khấu
   */
  async updateDiscountTier(
    tierId: string,
    data: SaveCreditDiscountTierRequestDto
  ): Promise<CreditDiscountTierResponseDto> {
    try {
      const existing = await this.getDiscountTiers();
      const updated = existing.map((t) => (t.id === tierId ? { ...t, ...data } : t));
      localStorage.setItem('secondlife_admin_discount_tiers', JSON.stringify(updated));
    } catch (_) {}
    return { id: tierId, ...data };
  },

  /**
   * Lấy danh sách gói nạp dành riêng cho Admin (bao gồm cả gói ngừng bán)
   * GET /api/v1/admin/topup-packages
   */
  async getAdminTopupPackages(): Promise<TopupPackage[]> {
    const res = await request<TopupPackage[]>('/admin/topup-packages', {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (res as any)?.data || res;
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },

  /**
   * Tạo gói nạp mới
   * POST /api/v1/admin/topup-packages
   */
  async createTopupPackage(data: TopupPackageRequestDto): Promise<TopupPackage> {
    const res = await request<TopupPackage>('/admin/topup-packages', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật thông tin gói nạp
   * PUT /api/v1/admin/topup-packages/{packageId}
   */
  async updateTopupPackage(packageId: string, data: TopupPackageRequestDto): Promise<TopupPackage> {
    const res = await request<TopupPackage>(`/admin/topup-packages/${packageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Bật/tắt trạng thái mở bán hoặc ngừng bán gói dịch vụ
   * PATCH /api/v1/admin/topup-packages/{packageId}/status
   */
  async updatePackageStatus(packageId: string, active: boolean): Promise<TopupPackage> {
    const res = await request<TopupPackage>(`/admin/topup-packages/${packageId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Ngừng bán gói dịch vụ (alias của ngừng bán)
   * DELETE /api/v1/admin/topup-packages/{packageId}
   */
  async deleteTopupPackage(packageId: string): Promise<void> {
    await request<void>(`/admin/topup-packages/${packageId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};
