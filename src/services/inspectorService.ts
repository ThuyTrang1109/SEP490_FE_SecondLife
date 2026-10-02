import { request, PageResponse } from './apiClient';

export interface InspectionOrderDto {
  id: string;
  postId: string;
  postTitle?: string;
  postImageUrl?: string;
  postPrice?: number;
  inspectorId?: string;
  inspectorName?: string;
  status: string;
  note?: string;
  inspectionFee?: number;
  shippingFee?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspectionStaffDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  createdAt?: string;
}

export interface CreateInspectionStaffRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface SubmitInspectionResultRequest {
  status: 'PASSED' | 'FAILED' | string;
  note?: string;
}

export const inspectorService = {
  /**
   * Inspector xem danh sách đơn hàng kiểm định được phân công cho mình
   */
  async getMyOrders(): Promise<InspectionOrderDto[]> {
    const res = await request<InspectionOrderDto[]>('/inspector/orders', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager xem toàn bộ danh sách đơn kiểm định
   */
  async getAllOrders(status?: string, page: number = 0, size: number = 20): Promise<PageResponse<InspectionOrderDto>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await request<PageResponse<InspectionOrderDto>>(`/inspector/orders/all?${params.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Manager phân công Inspector cho đơn kiểm định
   */
  async assignInspector(orderId: string, inspectorId: string): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(
      `/inspector/orders/${orderId}/assign?inspectorId=${encodeURIComponent(inspectorId)}`,
      {
        method: 'POST',
        requiresAuth: true,
      }
    );
    return res.data;
  },

  /**
   * Inspector nộp kết quả thẩm định thực tế (PASSED/FAILED)
   */
  async submitResult(orderId: string, data: SubmitInspectionResultRequest): Promise<InspectionOrderDto> {
    const res = await request<InspectionOrderDto>(`/inspector/orders/${orderId}/result`, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  /**
   * Manager xem danh sách nhân viên trung tâm
   */
  async getStaff(): Promise<InspectionStaffDto[]> {
    const res = await request<InspectionStaffDto[]>('/inspector-center/staff', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Manager tạo tài khoản nhân viên kiểm định
   */
  async createStaff(data: CreateInspectionStaffRequest): Promise<InspectionStaffDto> {
    const res = await request<InspectionStaffDto>('/inspector-center/staff', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },
};
