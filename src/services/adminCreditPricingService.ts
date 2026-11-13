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
