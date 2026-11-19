import { requestGet } from './apiClient';
import type { InspectionOrderDto } from './inspectorService';
import type { OrderBackend, SellerCommissionPreviewDTO } from '../types';
import type { OrderFeedQuery, OrderFilterTab } from '../utils/escrowOrderFilters';

export interface OrderFeedItem {
  order: OrderBackend | null;
  inspection: InspectionOrderDto | null;
  sellerCommissionPreview?: SellerCommissionPreviewDTO | null;
  buyerName: string | null;
  sellerName: string | null;
  postImageUrl: string | null;
  categoryId: string | null;
  itemId: string | null;
  itemCondition: string | null;
}

export interface OrderFeed {
  items: OrderFeedItem[];
  detail: OrderFeedItem | null;
  counts: Record<OrderFilterTab, number>;
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export async function getOrderFeed(query: OrderFeedQuery, orderId?: string, signal?: AbortSignal): Promise<OrderFeed> {
  const params = new URLSearchParams({
    filter: query.filter,
    perspective: query.perspective,
    q: query.q,
    page: String(query.page),
    size: '10',
  });
  if (orderId) params.set('orderId', orderId);
  const { data } = await requestGet<OrderFeed>(`/orders/feed?${params}`, { requiresAuth: true, signal });
  if (!data || !Array.isArray(data.items) || !data.counts) throw new Error('Invalid order feed response');
  return data;
}

export function orderFeedItemToRaw({ order, inspection, ...metadata }: OrderFeedItem) {
  const ordAny = order as any;
  const merged = {
    ...order,
    ...inspection,
    ...metadata,
    id: order?.id || inspection?.linkedOrderId || inspection?.id,
    buyerName: metadata.buyerName ?? inspection?.buyerName ?? ordAny?.buyerName,
    sellerName: metadata.sellerName ?? inspection?.sellerName ?? ordAny?.sellerName,
    postImageUrl: inspection?.postImageUrls?.[0] ?? metadata.postImageUrl,
    inspectionOrderId: inspection?.id,
    inspectionStatus: inspection?.customerStatus || inspection?.status || ordAny?.inspectionStatus,
    linkedOrderId: order && inspection ? order.id : inspection?.linkedOrderId,
    purchaseShippingFee: inspection ? order?.shippingFee : undefined,
    appointmentStatus: inspection?.appointmentStatus || ordAny?.appointmentStatus,
    appointmentScheduledAt: inspection?.appointmentScheduledAt || ordAny?.appointmentScheduledAt,
    appointmentShift: inspection?.appointmentShift || ordAny?.appointmentShift,
    appointmentNote: inspection?.appointmentNote || ordAny?.appointmentNote,
    counterScheduledAt: inspection?.counterScheduledAt || ordAny?.counterScheduledAt,
    counterShift: inspection?.counterShift || ordAny?.counterShift,
    counterNote: inspection?.counterNote || ordAny?.counterNote,
    inspectionOrder: inspection || ordAny?.inspectionOrder,
    __isInspection: Boolean(inspection),
  };

  const targetIds = [merged.id, merged.linkedOrderId, merged.inspectionOrderId].filter(Boolean) as string[];

  // 1. Kiểm tra cache localStorage xem có thông tin thương lượng/đề xuất lịch hẹn đã được lưu chưa
  let existingStoredAppt: any = null;
  if (typeof window !== 'undefined') {
    for (const tid of targetIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${tid}`);
        if (raw && raw !== 'null' && raw !== 'undefined') {
          const parsed = JSON.parse(raw);
          // Dọn dẹp dữ liệu mock cũ bị lệch timezone (13:30Z = 20:30 tối)
          if (parsed && parsed.counterScheduledAt === '2026-11-19T13:30:00.000Z') {
            try { localStorage.removeItem(`order_appointment_${tid}`); } catch {}
            continue;
          }
          if (parsed && (parsed.counterScheduledAt || parsed.status === 'COUNTERED_BY_CENTER' || parsed.status === 'PENDING_CENTER_CONFIRMATION')) {
            existingStoredAppt = parsed;
            break;
          }
        }
      } catch {}
    }
  }

  // Nếu có thông tin đề xuất lịch từ Hub mà Backend feed chưa cập nhật, hợp nhất ngay vào merged để UI hiển thị chuẩn xác
  if (existingStoredAppt?.counterScheduledAt && existingStoredAppt?.status === 'COUNTERED_BY_CENTER') {
    if (!merged.counterScheduledAt) {
      merged.counterScheduledAt = existingStoredAppt.counterScheduledAt;
    }
    if (!merged.counterShift) {
      merged.counterShift = existingStoredAppt.counterShift;
    }
    if (!merged.counterNote) {
      merged.counterNote = existingStoredAppt.counterNote;
    }
    if (merged.appointmentStatus !== 'CONFIRMED' && merged.appointmentStatus !== 'REJECTED' && merged.appointmentStatus !== 'PENDING_CENTER_CONFIRMATION') {
      merged.appointmentStatus = 'COUNTERED_BY_CENTER';
    }
  }

  if (typeof window !== 'undefined' && (merged.counterScheduledAt || merged.appointmentScheduledAt || existingStoredAppt)) {
    const isCounter = Boolean(merged.counterScheduledAt || merged.appointmentStatus === 'COUNTERED_BY_CENTER');
    const apptStatus = isCounter
      ? 'COUNTERED_BY_CENTER'
      : (merged.appointmentStatus || (merged.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION'));
    const apptRecord = {
      scheduledAt: merged.appointmentScheduledAt || existingStoredAppt?.scheduledAt,
      note: merged.appointmentNote || existingStoredAppt?.note || '',
      shift: merged.counterShift || existingStoredAppt?.shift || merged.appointmentShift || 'MORNING',
      status: apptStatus,
      counterScheduledAt: merged.counterScheduledAt,
      counterShift: merged.counterShift,
      counterNote: merged.counterNote,
    };
    targetIds.forEach((tid) => {
      try {
        localStorage.setItem(`order_appointment_${tid}`, JSON.stringify(apptRecord));
      } catch { }
    });
  }

  return merged;
}

