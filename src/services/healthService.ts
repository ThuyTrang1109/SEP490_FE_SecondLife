import { request } from './apiClient';

export interface HealthResponseDto {
  status: string;
}

export const healthService = {
  /**
   * Kiểm tra tình trạng hoạt động của Backend Server
   * GET /api/health
   */
  async checkHealth(): Promise<HealthResponseDto> {
    const res = await request<HealthResponseDto>('/health', {
      method: 'GET',
      requiresAuth: false,
    });
    return (res as any)?.data || res;
  },
};
