import type { Language, ShipmentBackend } from '../types';
import type { InspectionOrderDto } from '../services/inspectorService';
import { isDeliveredInspectionCashShipment } from './inspectionCashShipping';
import { getInspectionPurchaseDecision, isExpiredInspectionPurchase, extractInspectionRejectionDetails } from './inspectionPurchase';

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

export function hasCenterCounterProposal(order: Pick<InspectionOrderDto, 'appointmentStatus' | 'counterScheduledAt'>) {
  return order.appointmentStatus === 'COUNTERED_BY_CENTER' ||
    (!order.appointmentStatus && Boolean(order.counterScheduledAt));
}

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

  // If backend explicitly says CONFIRMED or PENDING_CENTER_CONFIRMATION with no counter proposal, backend is source of truth
  const isBackendConfirmed = (apptStatus === 'CONFIRMED' || order.status === 'SCHEDULED' || (order as any).backendStatus === 'SCHEDULED') && !counterTime;
  const isBackendPendingCenter = apptStatus === 'PENDING_CENTER_CONFIRMATION' && !counterTime;
  if (isBackendConfirmed) {
    counterTime = undefined;
    apptStatus = 'CONFIRMED';
  } else if (isBackendPendingCenter) {
    counterTime = undefined;
  }

  if (!hasCenterCounterProposal(order) && (typeof window !== 'undefined' || typeof localStorage !== 'undefined')) {
    const possibleIds = [
      order.id,
      (order as any).linkedOrderId,
      (order as any).orderId,
      (order as any).inspectionOrderId,
    ].filter(Boolean) as string[];

    if (isBackendConfirmed || isBackendPendingCenter) {
      // Clean up stale localStorage records that might still hold an old counter proposal
      for (const id of possibleIds) {
        try {
          const raw = localStorage.getItem(`order_appointment_${id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.counterScheduledAt || (isBackendConfirmed && parsed.status !== 'CONFIRMED')) {
              delete parsed.counterScheduledAt;
              delete parsed.counterShift;
              delete parsed.counterNote;
              parsed.status = isBackendConfirmed ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION';
              if (order.appointmentScheduledAt) parsed.scheduledAt = order.appointmentScheduledAt;
              localStorage.setItem(`order_appointment_${id}`, JSON.stringify(parsed));
            }
          }
        } catch {}
      }
    } else {
      for (const id of possibleIds) {
        try {
          const raw = localStorage.getItem(`order_appointment_${id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.status === 'CONFIRMED' || apptStatus === 'CONFIRMED') {
              apptStatus = 'CONFIRMED';
              if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
              counterTime = undefined;
            } else if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
              apptStatus = 'PENDING_CENTER_CONFIRMATION';
              if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
              counterTime = undefined;
            } else if (parsed.counterScheduledAt) {
              counterTime = parsed.counterScheduledAt;
              apptStatus = 'COUNTERED_BY_CENTER';
            } else {
              if (parsed.scheduledAt && !apptTime) apptTime = parsed.scheduledAt;
              if (parsed.status && !apptStatus) apptStatus = parsed.status;
            }
            break;
          }
        } catch {}
      }
    }

    if (apptStatus !== 'PENDING_CENTER_CONFIRMATION' && apptStatus !== 'CONFIRMED') {
      const idSet = new Set(possibleIds);
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const list = JSON.parse(rawCenter);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m) {
              if (m.appointmentStatus === 'CONFIRMED') {
                apptStatus = 'CONFIRMED';
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                counterTime = undefined;
              } else if (m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                apptStatus = 'PENDING_CENTER_CONFIRMATION';
                counterTime = undefined;
              }
            }
          }
        }
      } catch {}
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent && apptStatus !== 'CONFIRMED') {
          const listRecent = JSON.parse(rawRecent);
          if (Array.isArray(listRecent)) {
            const m = listRecent.find((ro: any) => idSet.has(ro.id) || idSet.has(ro.linkedOrderId) || idSet.has(ro.orderId) || idSet.has(ro.inspectionOrderId));
            if (m && m.appointmentStatus === 'CONFIRMED') {
              apptStatus = 'CONFIRMED';
              if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
              counterTime = undefined;
            }
          }
        }
      } catch {}
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller && apptStatus !== 'PENDING_CENTER_CONFIRMATION' && apptStatus !== 'CONFIRMED') {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m) {
              if (m.appointmentStatus === 'CONFIRMED') {
                apptStatus = 'CONFIRMED';
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                counterTime = undefined;
              } else if (m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                apptStatus = 'PENDING_CENTER_CONFIRMATION';
                counterTime = undefined;
              }
            }
          }
        }
      } catch {}
    }
  }

  // Khi lịch hẹn tại nhà đang trong giai đoạn thương lượng (Hub đã gửi đề xuất mới, chờ Seller duyệt):
  const isCountered = order.orderType === 'AT_HOME' && apptStatus !== 'CONFIRMED' && Boolean(
    counterTime ||
    (
      apptStatus !== 'PENDING_CENTER_CONFIRMATION' &&
      (
        apptStatus === 'COUNTERED_BY_CENTER' ||
        (order.status === 'WAITING_SELLER_APPROVAL' && (apptTime || counterTime)) ||
        ((order as any).customerStatus === 'WAITING_SELLER_APPROVAL' && (apptTime || counterTime))
      )
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
  } else if (!receivedAtHub) {
    return 'WAITING_HUB_RECEIPT';
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
    ['PASSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'CANCELED'].includes(order.status);
  return canReadCenterInspectionShipments(order, centerId) &&
    (shouldTrackInboundShipment(order) || isPaidHubBuyerDelivery(order) || isCenterReturnEligible(order, centerId, role) || isCompletedCenterOrder);
}

export function getLatestInboundShipment(shipments: ShipmentBackend[]): ShipmentBackend | null {
  return getLatestInspectionShipment(shipments, 'SELLER_TO_CENTER');
}

export function hasCenterReceivedInbound(
  order: Pick<InspectionOrderDto, 'status' | 'orderType'>,
  shipment?: Pick<ShipmentBackend, 'leg' | 'status' | 'providerStatus'> | null,
) {
  if (order.orderType === 'AT_HOME') return false;
  if (order.status === 'RECEIVED_AT_CENTER') return true;
  if (shipment) return shipment.leg === 'SELLER_TO_CENTER' && getInboundShipmentProgress(shipment).step === 3;
  return order.status === 'INSPECTING' || order.status === 'INSPECTION_IN_PROGRESS';
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

export const INTERRUPTED_SHIPMENT_STATUSES = [
  'CANCELLED',
  'CANCELED',
  'FAILED',
  'EXPIRED',
  'REJECTED',
];

export function isShipmentInterrupted(shipment: Pick<ShipmentBackend, 'status' | 'providerStatus'> | null | undefined): boolean {
  if (!shipment) return false;
  const s = (shipment.status || '').toUpperCase();
  const p = (shipment.providerStatus || '').toUpperCase();
  return INTERRUPTED_SHIPMENT_STATUSES.includes(s) || INTERRUPTED_SHIPMENT_STATUSES.includes(p);
}

export function canBookHubBuyerDelivery(shipment: ShipmentBackend | null | undefined) {
  if (shipment === undefined) return false;
  return shipment === null || isShipmentInterrupted(shipment);
}

export function canBookCenterBuyerDelivery(
  order: InspectionOrderDto,
  centerId: string | undefined,
  shipment: ShipmentBackend | null | undefined,
) {
  return canReadCenterInspectionShipments(order, centerId) && isPaidHubBuyerDelivery(order) &&
    canBookHubBuyerDelivery(shipment);
}

export function isHubReturnCase(order?: Pick<InspectionOrderDto, 'orderType' | 'status' | 'inspectionScope'> | null) {
  if (!order) return false;
  const isAtCenter =
    order.orderType === 'AT_CENTER' ||
    (order as any).inspectionMethod === 'AT_CENTER' ||
    (order as any).inspectionScope === 'AT_CENTER' ||
    (order as any).isAtCenter ||
    (!order.orderType && (order as any).inspectionScope !== 'AT_HOME');
  if (!isAtCenter) return false;
  const status = String(order.status || '').toUpperCase();
  if (['FAILED', 'CANCELLED', 'CANCELED'].includes(status)) return true;
  if (order.inspectionScope === 'PRE_LISTING' && status === 'COMPLETED') return true;
  return false;
}

export function isCenterReturnEligible(order: InspectionOrderDto, centerId?: string, role?: string) {
  const normRole = (role || '').toLowerCase();
  const isAuthorizedRole = !role || normRole === 'inspection_center' || normRole === 'staff' || normRole === 'admin' || normRole === 'inspector';
  const isCenterMatch = Boolean(centerId && (order.inspectionCenterId === centerId || !order.inspectionCenterId));
  if (!isAuthorizedRole || !isCenterMatch) return false;
  if (!isHubReturnCase(order)) return false;
  if (order.finalPaymentPaidAt != null) return false;

  const isPreListingCompleted = order.inspectionScope === 'PRE_LISTING' && order.status === 'COMPLETED';
  const isExpired = isExpiredInspectionPurchase(order.status, order.note || (order as any).rejectionReason);
  const isBuyerRejected = getInspectionPurchaseDecision(null, order) === 'rejected' ||
    extractInspectionRejectionDetails(order.note || (order as any).rejectionReason).isBuyerPurchaseRejected;

  // Đơn được phép trả hàng khi đã có quyết toán phí, hoặc là pre-listing hoàn tất, hoặc người mua từ chối / hết hạn 6h
  const isSettledOrSpecial = Boolean(order.feeSettledAt) || isPreListingCompleted || isExpired || isBuyerRejected;
  if (!isSettledOrSpecial) return false;

  return order.returnShippingReserveFee != null || isExpired || isBuyerRejected || isPreListingCompleted;
}

function canBookHubReturnShipment(shipment: ShipmentBackend | null | undefined) {
  if (shipment === null || shipment === undefined) return true;
  if (shipment?.leg !== 'CENTER_TO_SELLER') return false;
  if (shipment.status === 'CANCELLED') return true;
  return shipment.status === 'FAILED' && Boolean(shipment.orderCode) && !shipment.deliveredAt && !shipment.cashConfirmedAt &&
    (shipment.providerStatus === 'REJECTED' || shipment.providerStatus === 'EXPIRED');
}

export function getHubReturnState(shipments: ShipmentBackend[], orderStatus?: string) {
  const returns = shipments.filter((shipment) => shipment.leg === 'CENTER_TO_SELLER').reverse();
  const blockingReturn = returns.find((shipment) => !canBookHubReturnShipment(shipment));
  const isReceived = shipments.some((shipment) =>
    shipment.leg === 'SELLER_TO_CENTER' &&
    (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED' || (shipment.providerStatus || '').toUpperCase() === 'COMPLETED')
  ) || (orderStatus ? ['FAILED', 'PASSED', 'COMPLETED', 'RECEIVED_AT_CENTER', 'INSPECTING', 'INSPECTION_IN_PROGRESS', 'CANCELLED', 'CANCELED'].includes(orderStatus.toUpperCase()) : false);

  return {
    received: isReceived,
    shipment: blockingReturn ?? returns[0] ?? null,
  };
}

export function getSellerHubReturnStage(shipment?: ShipmentBackend | null) {
  if (shipment?.leg !== 'CENTER_TO_SELLER') return 'pending';
  const status = shipment.status.toUpperCase();
  const step = getHubReturnProgress(shipment).step;
  if (step === 3) return 'returned';
  const unsuccessful = ['CREATING', 'CREATION_UNCERTAIN', 'CANCELLED', 'CANCELED', 'FAILED', 'RETURNED', 'EXPIRED', 'REJECTED'];
  if (unsuccessful.includes(status) || unsuccessful.includes(shipment.providerStatus?.toUpperCase() ?? '')) return 'pending';
  if (step === 2 || status === 'IN_TRANSIT' || shipment.orderCode?.trim()) return 'returning';
  return 'pending';
}

export function getLatestReturnShipment(shipments: ShipmentBackend[] | null | undefined): ShipmentBackend | null {
  if (!Array.isArray(shipments) || shipments.length === 0) return null;
  const returns = shipments.filter((s) => s && (s.leg === 'CENTER_TO_SELLER' || s.leg === 'RETURN' || s.leg === 'BUYER_TO_SELLER'));
  if (returns.length === 0) return null;
  if (returns.length === 1) return returns[0];

  const sorted = [...returns].sort((a, b) => {
    const timeA = (a as any).createdAt || (a as any).createdDate || (a as any).updatedAt;
    const timeB = (b as any).createdAt || (b as any).createdDate || (b as any).updatedAt;
    if (timeA && timeB) {
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    }
    return 0;
  });

  const reversed = [...sorted].reverse();
  // 1. Ưu tiên vận đơn hoàn trả mới nhất đang hoạt động (không bị hủy hoặc thất bại)
  const activeReturn = reversed.find(
    (s) => s.status !== 'CANCELLED' && s.status !== 'CANCELED' && s.status !== 'FAILED'
  );
  if (activeReturn) return activeReturn;

  // 2. Tiếp theo là vận đơn mới nhất không bị CANCELLED
  const nonCancelled = reversed.find(
    (s) => s.status !== 'CANCELLED' && s.status !== 'CANCELED'
  );
  if (nonCancelled) return nonCancelled;

  // 3. Cuối cùng trả về vận đơn mới nhất trong danh sách (dù là FAILED hay CANCELLED)
  return reversed[0] || null;
}

export function getLatestBuyerDeliveryShipment(shipments: ShipmentBackend[] | null | undefined): ShipmentBackend | null {
  if (!Array.isArray(shipments) || shipments.length === 0) return null;
  const buyerLegs = shipments.filter((s) => s && (s.leg === 'CENTER_TO_BUYER' || s.leg === 'SELLER_TO_BUYER' || s.leg === 'DELIVERY'));
  if (buyerLegs.length === 0) return null;
  if (buyerLegs.length === 1) return buyerLegs[0];

  const sorted = [...buyerLegs].sort((a, b) => {
    const timeA = (a as any).createdAt || (a as any).createdDate || (a as any).updatedAt;
    const timeB = (b as any).createdAt || (b as any).createdDate || (b as any).updatedAt;
    if (timeA && timeB) {
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    }
    return 0;
  });

  const reversed = [...sorted].reverse();
  const activeShipment = reversed.find(
    (s) => s.status !== 'CANCELLED' && s.status !== 'CANCELED' && s.status !== 'FAILED'
  );
  if (activeShipment) return activeShipment;

  const nonCancelled = reversed.find(
    (s) => s.status !== 'CANCELLED' && s.status !== 'CANCELED'
  );
  if (nonCancelled) return nonCancelled;

  return reversed[0] || null;
}

export function canBookCenterReturn(
  order: InspectionOrderDto,
  centerId: string | undefined,
  role: string | undefined,
  state: ReturnType<typeof getHubReturnState> | undefined,
) {
  const isPreListingCompleted = order.inspectionScope === 'PRE_LISTING' && order.status === 'COMPLETED';
  const isExpired = isExpiredInspectionPurchase(order.status, order.note || (order as any).rejectionReason);
  const isBuyerRejected = getInspectionPurchaseDecision(null, order) === 'rejected' ||
    extractInspectionRejectionDetails(order.note || (order as any).rejectionReason).isBuyerPurchaseRejected;
  const isOrderAtHubStatus = ['FAILED', 'PASSED', 'COMPLETED', 'RECEIVED_AT_CENTER', 'INSPECTING', 'INSPECTION_IN_PROGRESS'].includes((order.status || '').toUpperCase()) ||
    (['CANCELLED', 'CANCELED'].includes((order.status || '').toUpperCase()) && Boolean((order as any).conditionScore != null || isExpired || isBuyerRejected));
  const isReceived = state !== undefined ? state.received === true : isOrderAtHubStatus;

  const isEligibleStatus = order.status === 'FAILED' || isPreListingCompleted || isBuyerRejected || isExpired;

  return isCenterReturnEligible(order, centerId, role) &&
    isEligibleStatus &&
    isReceived &&
    canBookHubReturnShipment(state?.shipment);
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

export function canAppealInspection(_order?: InspectionOrderDto, _sellerId?: string, _now = Date.now()) {
  return false;
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
  assignmentLocked?: boolean;
  inspectorConfirmedAt?: string;
  stage?: string;
  note?: string;
}): boolean {
  if (!order || !order.inspectorId) return false;

  // 1. Kiểm tra cờ xác nhận từ Backend DTO hoặc thuộc tính khóa điều phối rõ ràng
  if (
    order.inspectorConfirmed === true ||
    (order as any).assignmentLocked === true ||
    (order as any).isInspectorConfirmed === true ||
    Boolean((order as any).inspectorConfirmedAt)
  ) {
    return true;
  }

  const rawStatus = (order.status || order.backendStatus || '').toUpperCase();

  // 2. Nếu đơn đã xong hoặc đang giao cho người mua thì chắc chắn đã qua kiểm định
  const trulyDoneStatuses = new Set([
    'PASSED',
    'FAILED',
    'COMPLETED',
    'DELIVERING_TO_BUYER',
  ]);
  if (trulyDoneStatuses.has(rawStatus)) {
    return true;
  }

  // 3. Nếu đơn đang thực sự kiểm định tại bàn hoặc đã tiếp nhận
  if (
    rawStatus === 'INSPECTING' ||
    rawStatus === 'INSPECTION_IN_PROGRESS' ||
    rawStatus === 'CONFIRMED_BY_INSPECTOR' ||
    rawStatus === 'ACCEPTED'
  ) {
    return true;
  }

  // 4. Kiểm tra cờ xác nhận cục bộ của KTV (khi KTV bấm "Xác Nhận Đơn" trên cùng browser)
  if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') {
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

  // 5. Nếu trong note có đánh dấu KTV đã xác nhận
  if (order.note && order.note.includes('[INSPECTOR_CONFIRMED]')) {
    return true;
  }

  // 6. Nếu đơn đang ở trạng thái vừa phân công (DISPATCHED, SCHEDULED, CONFIRMED_PENDING_DISPATCH)
  // và CHƯA có cờ xác nhận ở trên -> Chắc chắn KTV CHƯA xác nhận đơn -> KHÔNG ĐƯỢC KHÓA!
  if (['DISPATCHED', 'SCHEDULED', 'CONFIRMED_PENDING_DISPATCH'].includes(rawStatus)) {
    return false;
  }

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
