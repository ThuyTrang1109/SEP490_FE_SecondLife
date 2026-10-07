import { request } from './apiClient';

export type VerificationType = 'CITIZEN_ID' | 'PASSPORT';
export type SellerVerificationStatus =
  | 'SUBMITTED'
  | 'EKYC_PENDING'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'RESUBMIT_REQUIRED'
  | 'REJECTED'
  | 'PENDING';

export interface SellerVerificationRequestDto {
  verificationType: VerificationType;
  documentNumber: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  selfieUrl?: string;
  clientSession?: string;
  token?: string;
}

export interface SellerVerificationResubmitRequestDto {
  documentFrontUrl: string;
  documentBackUrl: string;
  selfieUrl?: string;
  clientSession?: string;
  token?: string;
}

export interface SellerVerificationResponseDto {
  id: string;
  userId: string;
  userEmail?: string;
  userFullName?: string;
  shopName?: string;
  shopEmail?: string;
  phone?: string;
  pickupAddress?: string;
  verificationType: VerificationType;
  documentNumber: string;
  documentNumberMasked?: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  selfieUrl?: string;
  status: SellerVerificationStatus;
  ekycStatus?: string;
  riskStatus?: string;
  reviewSource?: string;
  reasonCode?: string;
  reasonCodeDescription?: string;
  providerName?: string;
  providerReferenceId?: string;
  faceMatchScore?: number;
  livenessScore?: number;
  documentScore?: number;
  riskScore?: number;
  resubmissionCount: number;
  submittedAt?: string;
  ekycCompletedAt?: string;
  riskEvaluatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  eventHistory?: any[];
}

export const sellerService = {
  async submitVerification(data: SellerVerificationRequestDto): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>('/seller-verifications', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  async getMyVerification(): Promise<SellerVerificationResponseDto | null> {
    try {
      const res = await request<SellerVerificationResponseDto>('/seller-verifications/me', {
        method: 'GET',
        requiresAuth: true,
      });
      return res.data || null;
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  },

  async getVerificationHistory(): Promise<SellerVerificationResponseDto[]> {
    const res = await request<SellerVerificationResponseDto[]>('/seller-verifications/me/history', {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data || [];
  },

  async getVerificationByStatus(status: string): Promise<SellerVerificationResponseDto | null> {
    const res = await request<SellerVerificationResponseDto>(`/seller-verifications/me/status/${status}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data || null;
  },

  async getVerificationDetail(verificationId: string): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/seller-verifications/${verificationId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async resubmitVerification(
    verificationId: string,
    data: SellerVerificationResubmitRequestDto
  ): Promise<SellerVerificationResponseDto> {
    const res = await request<SellerVerificationResponseDto>(`/seller-verifications/${verificationId}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Gọi trực tiếp VNPT eKYC xác thực CMND/CCCD và ảnh chân dung selfie
   * POST /api/v1/ekyc/verify (multipart/form-data)
   */
  async verifyVnptEkyc(
    frontImage: File,
    backImage: File,
    selfieImage: File,
    clientSession: string = 'client-session-' + Date.now(),
    token: string = 'token-auth'
  ): Promise<any> {
    const formData = new FormData();
    formData.append('frontImage', frontImage);
    formData.append('backImage', backImage);
    formData.append('selfieImage', selfieImage);
    formData.append('clientSession', clientSession);
    formData.append('token', token);

    const res = await request<any>('/v1/ekyc/verify', {
      method: 'POST',
      body: formData,
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },
};
