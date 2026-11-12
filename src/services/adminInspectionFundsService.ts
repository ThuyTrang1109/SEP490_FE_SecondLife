import { requestGet, ApiError } from './apiClient';
import type { AdminInspectionOrderFundsDTO } from '../types/adminInspectionFunds';

export async function getAdminInspectionOrderFunds(
  inspectionOrderId: string
): Promise<AdminInspectionOrderFundsDTO> {
  if (!inspectionOrderId || !inspectionOrderId.trim()) {
    throw new Error('Mã đơn kiểm định không hợp lệ.');
  }

  try {
    const res = await requestGet<AdminInspectionOrderFundsDTO>(
      `/admin/inspection/orders/${encodeURIComponent(inspectionOrderId.trim())}/funds`,
      { requiresAuth: true }
    );
    const data = (res as any)?.data ?? res;
    return data as AdminInspectionOrderFundsDTO;
  } catch (error: any) {
    if (error instanceof ApiError || (error && typeof error.status === 'number')) {
      if (error.status === 403) {
        throw new Error('Bạn không có quyền xem đối soát');
      }
      if (error.status === 404) {
        throw new Error('Không tìm thấy đơn kiểm định');
      }
    }
    throw error;
  }
}

