import type {
  AdminCollectionStatus,
  AdminReturnReserveStatus,
} from '../types/adminInspectionFunds';

/**
 * Map collectionStatus to user-facing labels
 */
export function resolveCollectionStatusLabel(status?: AdminCollectionStatus | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'NOT_DUE':
      return 'Chưa đến bước thu phí';
    case 'NO_PAYMENT_REQUIRED':
      return 'Không cần nộp';
    case 'UNPAID':
      return 'Chưa nộp';
    case 'PARTIALLY_PAID':
      return 'Đã nộp một phần';
    case 'PAID':
      return 'Đã thu đủ';
    default:
      return 'Chưa xác định';
  }
}

export function getCollectionStatusBadgeStyle(status?: AdminCollectionStatus | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'PAID':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'PARTIALLY_PAID':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'UNPAID':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'NO_PAYMENT_REQUIRED':
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    case 'NOT_DUE':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Map returnReserve.status to user-facing labels
 */
export function resolveReturnReserveStatusLabel(status?: AdminReturnReserveStatus | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'NOT_REQUIRED':
      return 'Không áp dụng dự phòng';
    case 'NOT_COLLECTED':
      return 'Chưa thu dự phòng';
    case 'HELD_PENDING_INSPECTION':
      return 'Đang giữ dự phòng';
    case 'REFUNDED_UNUSED':
      return 'Đã hoàn dự phòng chưa sử dụng';
    case 'AWAITING_RETURN_SHIPMENT':
      return 'Chờ tạo chuyến hoàn';
    case 'RETURN_IN_PROGRESS':
      return 'Đang trả hàng';
    case 'AWAITING_ACTUAL_FEE':
      return 'Chờ cước thực tế';
    case 'AWAITING_CASH_CONFIRMATION':
      return 'Đã giao về seller · Chờ xác nhận chi cước';
    case 'AWAITING_RECONCILIATION':
      return 'Chờ đối soát cước';
    case 'EXCEEDS_RESERVE':
      return 'Cước thực tế vượt dự phòng';
    case 'SETTLED':
      return 'Đã quyết toán cước hoàn';
    default:
      return 'Chưa xác định';
  }
}

export function getReturnReserveBadgeStyle(status?: AdminReturnReserveStatus | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'SETTLED':
    case 'REFUNDED_UNUSED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'HELD_PENDING_INSPECTION':
    case 'AWAITING_RETURN_SHIPMENT':
    case 'RETURN_IN_PROGRESS':
    case 'AWAITING_ACTUAL_FEE':
    case 'AWAITING_RECONCILIATION':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'AWAITING_CASH_CONFIRMATION':
      return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' };
    case 'EXCEEDS_RESERVE':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'NOT_REQUIRED':
    case 'NOT_COLLECTED':
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Map shipments[].status to user-facing labels
 */
export function resolveShipmentStatusLabel(status?: string | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Chờ xử lý';
    case 'ASSIGNING_DRIVER':
      return 'Đang tìm tài xế';
    case 'DRIVER_ASSIGNED':
      return 'Đã có tài xế';
    case 'PICKED_UP':
    case 'PICKED':
    case 'IN_TRANSIT':
      return 'Đang vận chuyển';
    case 'DELIVERED':
      return 'Đã giao hàng';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'FAILED':
      return 'Thất bại';
    default:
      return 'Chưa xác định';
  }
}

export function getShipmentStatusBadgeStyle(status?: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'DELIVERED':
    case 'COMPLETED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'IN_TRANSIT':
    case 'PICKED_UP':
    case 'PICKED':
    case 'DRIVER_ASSIGNED':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    case 'PENDING':
    case 'ASSIGNING_DRIVER':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'CANCELLED':
    case 'FAILED':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Resolve leg display label
 */
export function resolveShipmentLegLabel(leg?: string | null): string {
  if (!leg) return 'Chuyến vận chuyển';
  const norm = leg.toUpperCase();
  switch (norm) {
    case 'SELLER_TO_CENTER':
    case 'SELLER_TO_HUB':
      return 'Chặng 1: Người bán → Hub';
    case 'CENTER_TO_SELLER':
    case 'HUB_TO_SELLER':
      return 'Chặng hoàn: Hub → Người bán';
    case 'CENTER_TO_BUYER':
    case 'HUB_TO_BUYER':
      return 'Chặng 2: Hub → Người mua';
    case 'BUYER_TO_CENTER':
    case 'BUYER_TO_HUB':
      return 'Người mua → Hub';
    default:
      return leg;
  }
}

/**
 * Resolves inspection order ID according to the requirement:
 * "Dùng ID đơn kiểm định. Nếu đối tượng FE có cả id và linkedOrderId, lấy id của đơn kiểm định."
 */
export function resolveInspectionOrderId(order: any): string {
  if (!order) return '';
  if (typeof order === 'string') return order.trim();
  if (order.id && order.linkedOrderId) {
    return String(order.id).trim();
  }
  if (order.inspectionOrderId) {
    return String(order.inspectionOrderId).trim();
  }
  return order.id ? String(order.id).trim() : '';
}

/**
 * Format date time cleanly
 */
export function formatAuditDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

