import type { Language, ShipmentBackend } from '../types';
import type { InspectionOrderDto } from '../services/inspectorService';
import { isDeliveredInspectionCashShipment } from './inspectionCashShipping';
import { getInspectionPurchaseDecision } from './inspectionPurchase';

export function getCenterTabDataNeeds(tab: string) {
  return {
    orders: ['overview', 'dispatch', 'staff', 'orders', 'appeals'].includes(tab),
    staff: ['overview', 'dispatch', 'staff', 'orders'].includes(tab),
  };
}

const inboundTrackingStatuses = new Set([
  'CONFIRMED_PENDING_DISPATCH', 'DISPATCHED', 'SCHEDULED', 'SHIPPING_TO_CENTER',
  'WAITING_INSPECTION', 'AWAITING_INSPECTION', 'RECEIVED_AT_CENTER', 'INSPECTING',
]);

const dispatchStatuses = new Set([
  ...inboundTrackingStatuses, 'PENDING', 'ASSIGNED', 'INSPECTION_IN_PROGRESS',
]);

export function getCenterDispatchStage(
  order: Pick<InspectionOrderDto, 'orderType' | 'status' | 'inspectorId'> & {
    appointmentScheduledAt?: string;
    appointmentStatus?: string;
    id?: string;
    linkedOrderId?: string;
    orderId?: string;
    inspectionOrderId?: string;
    counterScheduledAt?: string;
  },
  receivedAtHub: boolean,
) {
  let apptTime = order.appointmentScheduledAt;
  let apptStatus = (order as any).appointmentStatus;
  let counterTime = (order as any).counterScheduledAt;

  if (typeof window !== 'undefined') {
    const possibleIds = [
      order.id,
      (order as any).linkedOrderId,
      (order as any).orderId,
      (order as any).inspectionOrderId,
    ].filter(Boolean) as string[];

    for (const id of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
          if (parsed.status) apptStatus = parsed.status;
          if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
            counterTime = undefined;
          } else if (parsed.counterScheduledAt) {
            counterTime = parsed.counterScheduledAt;
          }
          break;
        }
      } catch {}
    }

    if (apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
      const idSet = new Set(possibleIds);
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const list = JSON.parse(rawCenter);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
              if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
              apptStatus = 'PENDING_CENTER_CONFIRMATION';
              counterTime = undefined;
            }
          }
        }
      } catch {}
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller && apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
              if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
              apptStatus = 'PENDING_CENTER_CONFIRMATION';
              counterTime = undefined;
            }
          }
        }
      } catch {}
    }
  }

  // Khi lịch hẹn tại nhà đang trong giai đoạn thương lượng (Hub đã gửi đề xuất mới, chờ Seller duyệt):
  const isCountered = order.orderType === 'AT_HOME' && Boolean(
    apptStatus !== 'PENDING_CENTER_CONFIRMATION' &&
    (
      apptStatus === 'COUNTERED_BY_CENTER' ||
      counterTime ||
      (order.status === 'WAITING_SELLER_APPROVAL' && (apptTime || counterTime)) ||
      ((order as any).customerStatus === 'WAITING_SELLER_APPROVAL' && (apptTime || counterTime))
    )
  );

  if (isCountered) {
    return 'WAITING_SELLER_APPROVAL';
  }

  if (!dispatchStatuses.has(order.status)) return null;

  if (order.orderType === 'AT_HOME') {
    if (!apptTime || apptStatus === 'REJECTED') {
      return 'WAITING_SELLER_APPOINTMENT';
    }
    if (apptStatus === 'PENDING_CENTER_CONFIRMATION' || apptStatus === 'PENDING_CONFIRMATION') {
      return 'WAITING_CENTER_APPROVAL';
    }
  }

  return order.inspectorId ? 'ASSIGNED' : 'READY_TO_ASSIGN';
}

export function shouldTrackInboundShipment(order: { orderType?: string; status: string }) {
  return order.orderType === 'AT_CENTER' && inboundTrackingStatuses.has(order.status);
}

export function filterCenterApiOrders(orders: InspectionOrderDto[], centerId: string): InspectionOrderDto[] {
  // The scoped API also authorizes legacy orders through the assigned inspector's manager.
  return orders.filter((order) => order.inspectionCenterId == null || order.inspectionCenterId === centerId);
}

export function canReadCenterInspectionShipments(order: Pick<InspectionOrderDto, 'inspectionCenterId'>, centerId?: string) {
  return Boolean(centerId && order.inspectionCenterId === centerId);
}

export function shouldTrackCenterInspectionShipments(order: InspectionOrderDto, centerId?: string, role?: string) {
  const isCompletedCenterOrder = (order.orderType === 'AT_CENTER' || !order.orderType || (order as any).inspectionMethod === 'AT_CENTER') &&
    ['PASSED', 'COMPLETED', 'FAILED'].includes(order.status);
  return canReadCenterInspectionShipments(order, centerId) &&
    (shouldTrackInboundShipment(order) || isPaidHubBuyerDelivery(order) || isCenterReturnEligible(order, centerId, role) || isCompletedCenterOrder);
}

export function getLatestInboundShipment(shipments: ShipmentBackend[]): ShipmentBackend | null {
  return getLatestInspectionShipment(shipments, 'SELLER_TO_CENTER');
}

export function getLatestInspectionShipment(shipments: ShipmentBackend[], leg: string): ShipmentBackend | null {
  // The BE returns shipments in creation order.
  for (let index = shipments.length - 1; index >= 0; index--) {
    if (shipments[index].leg === leg) return shipments[index];
  }
  return null;
}

export function isPaidHubBuyerDelivery(order: {
  orderType?: string;
  status: string;
  linkedOrderId?: string | null;
  finalPaymentPaidAt?: string | null;
}) {
  return order.orderType === 'AT_CENTER' && order.status === 'DELIVERING_TO_BUYER' &&
    Boolean(order.linkedOrderId && order.finalPaymentPaidAt);
}

export function canBookHubBuyerDelivery(shipment: ShipmentBackend | null | undefined) {
  return shipment === null || shipment?.status === 'CANCELLED';
}

export function canBookCenterBuyerDelivery(
  order: InspectionOrderDto,
  centerId: string | undefined,
  shipment: ShipmentBackend | null | undefined,
) {
  return canReadCenterInspectionShipments(order, centerId) && isPaidHubBuyerDelivery(order) &&
    canBookHubBuyerDelivery(shipment);
}

export function isHubReturnCase(order?: Pick<InspectionOrderDto, 'orderType' | 'status'> | null) {
  return order?.orderType === 'AT_CENTER' && ['FAILED', 'CANCELLED'].includes(order.status);
}

export function isCenterReturnEligible(order: InspectionOrderDto, centerId?: string, role?: string) {
  return role?.toLowerCase() === 'inspection_center' && Boolean(centerId && centerId === order.inspectionCenterId) &&
    isHubReturnCase(order) && Boolean(order.feeSettledAt) && order.returnShippingReserveFee != null &&
    order.finalPaymentPaidAt == null;
}

export function getHubReturnState(shipments: ShipmentBackend[]) {
  const returns = shipments.filter((shipment) => shipment.leg === 'CENTER_TO_SELLER').reverse();
  return {
    received: shipments.some((shipment) => shipment.leg === 'SELLER_TO_CENTER' && shipment.status === 'DELIVERED'),
    shipment: returns.find((shipment) => shipment.status !== 'CANCELLED') ?? returns[0] ?? null,
  };
}

export function canBookCenterReturn(
  order: InspectionOrderDto,
  centerId: string | undefined,
  role: string | undefined,
  state: ReturnType<typeof getHubReturnState> | undefined,
) {
  return isCenterReturnEligible(order, centerId, role) &&
    (order.status === 'FAILED' || getInspectionPurchaseDecision(null, order) === 'rejected') &&
    state?.received === true && canBookHubBuyerDelivery(state.shipment);
}

export function shouldSyncHubReturnOnOpen(shipment: ShipmentBackend | null): shipment is ShipmentBackend {
  if (!shipment?.shipmentId || !shipment.orderCode || shipment.leg !== 'CENTER_TO_SELLER') return false;
  if (isDeliveredInspectionCashShipment(shipment)) return !shipment.cashConfirmedAt;
  return !['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED', 'RETURNED', 'CREATION_UNCERTAIN'].includes(shipment.status);
}

export function getHubReturnProgress(shipment: ShipmentBackend, lang: Language = 'vi') {
  const progress = getInboundShipmentProgress({ status: shipment.status, providerStatus: null }, lang);
  if (shipment.status === 'CREATION_UNCERTAIN') return { ...progress, label: lang === 'vi' ? 'Chờ đối soát với Lalamove' : 'Awaiting Lalamove reconciliation' };
  if (progress.step === 3) return { ...progress, label: lang === 'vi' ? 'Đã trả về người bán' : 'Delivered back to the seller' };
  if (progress.step === 2) return { ...progress, label: lang === 'vi' ? 'Đang trả về người bán' : 'Returning to the seller' };
  return progress;
}

export function getReturnReserveMessage(reserve: number | null | undefined, shipment: ShipmentBackend) {
  if (shipment.status !== 'DELIVERED') return 'Phần dự phòng còn dư sẽ được đối soát sau khi giao hàng.';
  if (shipment.cashPayerId && !shipment.cashConfirmedAt) return 'Phần dự phòng còn dư được hoàn sau khi hệ thống đối soát cước tự động.';
  if (reserve == null || shipment.actualFee == null || shipment.actualFee > reserve) return 'Đang chờ đối soát cước trả hàng.';
  if (shipment.actualFee === reserve) return 'Cước thực tế bằng khoản dự phòng. Không có phần dư.';
  return 'Phần dự phòng còn dư được hoàn vào ví của bên đã nộp sau đối soát.';
}

export function canAppealInspection(order: InspectionOrderDto, sellerId?: string, now = Date.now()) {
  return Boolean(sellerId && sellerId === order.sellerId && order.status === 'FAILED' &&
    (!order.appealStatus || order.appealStatus === 'NONE') && order.appealDeadline && Date.parse(order.appealDeadline) > now);
}

export function getHubBuyerShipmentLabel(shipment: ShipmentBackend) {
  const progress = getInboundShipmentProgress(shipment);
  if (progress.step === 3) return 'Đã giao cho người mua';
  if (progress.step === 2) return 'Đang giao cho người mua';
  return progress.label;
}

export function getBuyerDeliveryProgress(
  shipment: Pick<ShipmentBackend, 'status' | 'providerStatus'>,
  lang: Language = 'vi',
) {
  const progress = (step: 0 | 1 | 2 | 3 | null, vi: string, en: string) => ({
    step,
    label: lang === 'vi' ? vi : en,
  });
  switch (shipment.status.toUpperCase()) {
    case 'DELIVERED':
    case 'COMPLETED': return progress(3, 'Lalamove đã giao tới người mua', 'Delivered to Buyer');
    case 'CANCELLED': return progress(null, 'Vận đơn đã hủy', 'Shipment cancelled');
    case 'FAILED': return progress(null, 'Vận đơn thất bại', 'Shipment failed');
    case 'RETURNED': return progress(null, 'Vận đơn đã hoàn trả', 'Shipment returned');
    case 'CREATING': return progress(null, 'Đang tạo vận đơn', 'Creating shipment');
    case 'CREATION_UNCERTAIN': return progress(null, 'Đang xác minh vận đơn', 'Verifying shipment');
  }
  switch ((shipment.providerStatus || shipment.status).toUpperCase()) {
    case 'ASSIGNING_DRIVER':
    case 'READY_TO_PICK': return progress(0, 'Đã tạo vận đơn · Đang tìm tài xế', 'Shipment created · Finding a driver');
    case 'ON_GOING':
    case 'ASSIGNED': return progress(1, 'Tài xế đang đến lấy hàng', 'Driver on the way to pickup');
    case 'PICKED_UP':
    case 'PICKED':
    case 'SHIPPED':
    case 'DELIVERING': return progress(2, 'Đang giao hàng đến người mua', 'On the way to Buyer');
    case 'COMPLETED': return progress(3, 'Lalamove đã giao tới người mua', 'Delivered to Buyer');
    case 'CANCELED': return progress(null, 'Vận đơn đã hủy', 'Shipment cancelled');
    case 'REJECTED':
    case 'EXPIRED': return progress(null, 'Vận đơn thất bại', 'Shipment failed');
    case 'CREATING': return progress(null, 'Đang tạo vận đơn', 'Creating shipment');
    default: return progress(null, 'Đang chờ cập nhật vận đơn', 'Awaiting shipment update');
  }
}

export function getInboundShipmentProgress(
  shipment: Pick<ShipmentBackend, 'status' | 'providerStatus'>,
  lang: Language = 'vi',
) {
  const progress = (step: 0 | 1 | 2 | 3 | null, vi: string, en: string) => ({
    step,
    label: lang === 'vi' ? vi : en,
  });
  switch (shipment.status.toUpperCase()) {
    case 'DELIVERED':
    case 'COMPLETED': return progress(3, 'Lalamove đã giao tới Hub', 'Delivered to Hub');
    case 'CANCELLED': return progress(null, 'Vận đơn đã hủy', 'Shipment cancelled');
    case 'FAILED': return progress(null, 'Vận đơn thất bại', 'Shipment failed');
    case 'RETURNED': return progress(null, 'Vận đơn đã hoàn trả', 'Shipment returned');
    case 'CREATING': return progress(null, 'Đang tạo vận đơn', 'Creating shipment');
    case 'CREATION_UNCERTAIN': return progress(null, 'Đang xác minh vận đơn', 'Verifying shipment');
  }
  switch ((shipment.providerStatus || shipment.status).toUpperCase()) {
    case 'ASSIGNING_DRIVER':
    case 'READY_TO_PICK': return progress(0, 'Đã tạo vận đơn · Đang tìm tài xế', 'Shipment created · Finding a driver');
    case 'ON_GOING':
    case 'ASSIGNED': return progress(1, 'Tài xế đang đến lấy hàng', 'Driver on the way to pickup');
    case 'PICKED_UP':
    case 'PICKED':
    case 'SHIPPED':
    case 'DELIVERING': return progress(2, 'Đang giao hàng đến Hub', 'On the way to Hub');
    case 'COMPLETED': return progress(3, 'Lalamove đã giao tới Hub', 'Delivered to Hub');
    case 'CANCELED': return progress(null, 'Vận đơn đã hủy', 'Shipment cancelled');
    case 'REJECTED':
    case 'EXPIRED': return progress(null, 'Vận đơn thất bại', 'Shipment failed');
    case 'CREATING': return progress(null, 'Đang tạo vận đơn', 'Creating shipment');
    default: return progress(null, 'Đang chờ cập nhật vận đơn', 'Awaiting shipment update');
  }
}

/**
 * Kiểm tra xem Kỹ thuật viên đã xác nhận đơn hay chưa.
 * Đơn chỉ được tính là đã xác nhận khi:
 * 1. KTV đã ấn nút "Xác Nhận Đơn" (order_confirmed_by_inspector_{id} === 'true' hoặc inspectorConfirmed === true).
 * 2. Đơn đã hoàn tất kiểm định (PASSED, FAILED, COMPLETED).
 */
export function isOrderConfirmedByInspector(order: {
  id?: string;
  orderId?: string;
  status?: string;
  backendStatus?: string;
  customerStatus?: string;
  inspectorId?: string;
  inspectorConfirmed?: boolean;
  stage?: string;
  note?: string;
}): boolean {
  if (!order || !order.inspectorId) return false;

  const rawStatus = (order.status || order.backendStatus || '').toUpperCase();

  // 1. Nếu đơn đã xong hoặc đang giao cho người mua thì chắc chắn đã qua kiểm định
  const trulyDoneStatuses = new Set([
    'PASSED',
    'FAILED',
    'COMPLETED',
    'DELIVERING_TO_BUYER',
  ]);
  if (trulyDoneStatuses.has(rawStatus)) {
    return true;
  }

  // 2. Kiểm tra cờ xác nhận cục bộ của KTV (khi KTV bấm "Xác Nhận Đơn")
  if (typeof window !== 'undefined') {
    const possibleIds = [
      order.id,
      order.orderId,
      (order as any).linkedOrderId,
      (order as any).inspectionOrderId,
    ].filter(Boolean) as string[];

    for (const tid of possibleIds) {
      if (
        localStorage.getItem(`order_confirmed_by_inspector_${tid}`) === 'true' ||
        localStorage.getItem(`inspection_status_${tid}`) === 'INSPECTING'
      ) {
        return true;
      }
    }
  }

  // 3. Nếu trong note có đánh dấu KTV đã xác nhận
  if (order.note && order.note.includes('[INSPECTOR_CONFIRMED]')) {
    return true;
  }

  // 4. Nếu đơn đang ở trạng thái vừa phân công (DISPATCHED, SCHEDULED, CONFIRMED_PENDING_DISPATCH)
  // và CHƯA có cờ xác nhận ở trên -> Chắc chắn KTV CHƯA xác nhận đơn -> KHÔNG ĐƯỢC KHÓA!
  if (['DISPATCHED', 'SCHEDULED', 'CONFIRMED_PENDING_DISPATCH'].includes(rawStatus)) {
    return false;
  }

  // 5. Nếu đơn đang thực sự kiểm định tại bàn
  if (rawStatus === 'INSPECTING' || rawStatus === 'INSPECTION_IN_PROGRESS') {
    return true;
  }

  if (order.inspectorConfirmed) return true;

  return false;
}

/**
 * Kiểm tra xem quyền thay đổi KTV (Đổi KTV) tại Trung tâm kiểm định có bị khóa hay không.
 * Quy tắc:
 * - Chỉ khóa KHI Kỹ thuật viên phụ trách ĐÃ xác nhận đơn, đơn đang đo kiểm, hoặc đơn đã hoàn tất kiểm định.
 * - Nếu KTV CHƯA ấn "Xác Nhận Đơn" (chưa tiếp nhận), Trung tâm vẫn hoàn toàn có quyền "Đổi KTV".
 */
export function isInspectorAssignmentLocked(order: {
  id?: string;
  orderId?: string;
  status?: string;
  backendStatus?: string;
  customerStatus?: string;
  inspectorId?: string;
  inspectorConfirmed?: boolean;
  stage?: string;
  note?: string;
}): boolean {
  if (!order || !order.inspectorId) return false;
  return isOrderConfirmedByInspector(order);
}

/**
 * Đánh dấu đơn kiểm định đã được KTV xác nhận tiếp nhận.
 * Đồng thời cập nhật các danh sách cục bộ và phát tín hiệu cho các bên (CenterDispatch, InspectorPortal,...).
 */
export function markOrderConfirmedByInspector(orderId: string, additionalIds?: string[]): void {
  if (!orderId || typeof window === 'undefined') return;

  const allIds = Array.from(new Set([orderId, ...(additionalIds || [])].filter(Boolean)));
  allIds.forEach((id) => {
    localStorage.setItem(`order_confirmed_by_inspector_${id}`, 'true');
    localStorage.setItem(`order_confirmed_by_inspector_at_${id}`, new Date().toISOString());
  });

  const isMatched = (o: any) => allIds.some((id) => o.id === id || o.orderId === id || o.linkedOrderId === id || o.inspectionOrderId === id);

  try {
    const rawCenter = localStorage.getItem('center_inspection_orders');
    if (rawCenter) {
      const list = JSON.parse(rawCenter);
      if (Array.isArray(list)) {
        const updated = list.map((o: any) => {
          if (isMatched(o)) {
            return { ...o, inspectorConfirmed: true };
          }
          return o;
        });
        localStorage.setItem('center_inspection_orders', JSON.stringify(updated));
      }
    }
  } catch {}

  try {
    const rawRecent = localStorage.getItem('recent_placed_orders');
    if (rawRecent) {
      const list = JSON.parse(rawRecent);
      if (Array.isArray(list)) {
        const updated = list.map((o: any) => {
          if (isMatched(o)) {
            return { ...o, inspectorConfirmed: true };
          }
          return o;
        });
        localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
      }
    }
  } catch {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('secondlife_inspection_channel');
      bc.postMessage({ type: 'INSPECTOR_CONFIRMED', orderId, ids: allIds });
      bc.close();
    }
  } catch {}

  window.dispatchEvent(
    new CustomEvent('secondlife_inspector_confirmed_signal', {
      detail: { orderId, ids: allIds },
    })
  );
}
