import { request, PageResponse } from './apiClient';
import { SellerVerificationResponseDto } from './sellerService';

export interface GetStaffSellerVerificationsParams {
  status?: string;
  ekycStatus?: string;
  riskStatus?: string;
  reasonCode?: string;
  page?: number;
  size?: number;
  sort?: string[];
}

export interface ReviewSellerVerificationRequestDto {
  decision: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}

export const staffService = {
  /**
   * Staff xem hàng đợi hồ sơ ngoại lệ cần kiểm duyệt
   */
  async listVerifications(
    params: GetStaffSellerVerificationsParams = {}
  ): Promise<PageResponse<SellerVerificationResponseDto>> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.ekycStatus) queryParams.append('ekycStatus', params.ekycStatus);
    if (params.riskStatus) queryParams.append('riskStatus', params.riskStatus);
    if (params.reasonCode) queryParams.append('reasonCode', params.reasonCode);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    if (params.sort && params.sort.length > 0) {
      params.sort.forEach((s) => queryParams.append('sort', s));
    }

    const queryString = queryParams.toString();
    const endpoint = `/staff/seller-verifications${queryString ? `?${queryString}` : ''}`;

    const res = await request<PageResponse<SellerVerificationResponseDto>>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Staff xem chi tiết hồ sơ & lịch sử audit của hồ sơ ngoại lệ
   */
  async getVerificationById(id: string): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/staff/seller-verifications/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Staff duyệt hoặc từ chối hồ sơ ngoại lệ eKYC
   */
  async reviewVerification(
    id: string,
    data: ReviewSellerVerificationRequestDto
  ): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/staff/seller-verifications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
