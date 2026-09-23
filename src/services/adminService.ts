import { request, PageResponse } from './apiClient';
import { SellerVerificationResponseDto } from './sellerService';

export interface UserAdminResponseDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminStatusUpdateRequestDto {
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  reason?: string;
}

export interface SellerVerificationReviewRequestDto {
  reasonCode: string;
  rejectionReason: string;
  allowResubmission?: boolean;
}

export interface GetAdminUsersParams {
  email?: string;
  status?: string;
  role?: string;
  page?: number;
  size?: number;
}

export interface GetSellerVerificationsParams {
  status?: string;
  ekycStatus?: string;
  riskStatus?: string;
  reasonCode?: string;
  page?: number;
  size?: number;
}

export const adminService = {
  async getAdminUsers(params: GetAdminUsersParams = {}): Promise<PageResponse<UserAdminResponseDto>> {
    const queryParams = new URLSearchParams();
    if (params.email) queryParams.append('email', params.email);
    if (params.status) queryParams.append('status', params.status);
    if (params.role) queryParams.append('role', params.role);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    const queryString = queryParams.toString();
    const endpoint = `/admin/users${queryString ? `?${queryString}` : ''}`;

    const res = await request<PageResponse<UserAdminResponseDto>>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async getAdminUserById(userId: string): Promise<UserAdminResponseDto> {
    const res = await request<UserAdminResponseDto>(`/admin/users/${userId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async updateUserStatus(
    userId: string,
    data: AdminStatusUpdateRequestDto
  ): Promise<UserAdminResponseDto> {
    const res = await request<UserAdminResponseDto>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  async getSellerVerifications(
    params: GetSellerVerificationsParams = {}
  ): Promise<PageResponse<SellerVerificationResponseDto>> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.ekycStatus) queryParams.append('ekycStatus', params.ekycStatus);
    if (params.riskStatus) queryParams.append('riskStatus', params.riskStatus);
    if (params.reasonCode) queryParams.append('reasonCode', params.reasonCode);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    const queryString = queryParams.toString();
    const endpoint = `/admin/seller-verifications${queryString ? `?${queryString}` : ''}`;

    const res = await request<PageResponse<SellerVerificationResponseDto>>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async getSellerVerificationById(id: string): Promise<any> {
    const res = await request<any>(`/admin/seller-verifications/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async approveSellerVerification(id: string): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/admin/seller-verifications/${id}/approve`, {
      method: 'POST',
      requiresAuth: true,
    });
    return res.data;
  },

  async rejectSellerVerification(
    id: string,
    data: { rejectionReason: string }
  ): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/admin/seller-verifications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  async createInspectionCenterAccount(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<any> {
    const res = await request<any>('/admin/inspection-center-accounts', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },
};
