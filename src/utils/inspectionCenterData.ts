import type { Language, ShipmentBackend } from '../types';
import type { InspectionOrderDto } from '../services/inspectorService';
import { isDeliveredInspectionCashShipment } from './inspectionCashShipping';

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
  },
  receivedAtHub: boolean,
) {
  if (!dispatchStatuses.has(order.status)) return null;
  if (order.orderType !== 'AT_HOME' && !receivedAtHub) return 'WAITING_FOR_HUB';

  if (order.orderType === 'AT_HOME') {
    let apptTime = order.appointmentScheduledAt;
    let apptStatus = (order as any).appointmentStatus;
    if (typeof window !== 'undefined' && order.id) {
      try {
        const raw = localStorage.getItem(`order_appointment_${order.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt && !apptTime) apptTime = parsed.scheduledAt;
          if (parsed.status && !apptStatus) apptStatus = parsed.status;
        }
      } catch {}
    }
    if (!apptTime || apptStatus === 'REJECTED') {
      return 'WAITING_SELLER_APPOINTMENT';
    }
    if (apptStatus === 'PENDING_CENTER_CONFIRMATION' || apptStatus === 'PENDING_CONFIRMATION') {
      return 'WAITING_CENTER_APPROVAL';
    }
    if (apptStatus === 'COUNTERED_BY_CENTER') {
      return 'WAITING_SELLER_APPROVAL';
    }
  }

  return order.inspectorId ? 'ASSIGNED' : 'READY_TO_ASSIGN';
}

export function shouldTrackInboundShipment(order: { orderType?: string; status: string }) {
  return order.orderType === 'AT_CENTER' && inboundTrackingStatuses.has(order.status);
}

export function canReadCenterInspectionShipments(order: Pick<InspectionOrderDto, 'inspectionCenterId'>, centerId?: string) {
  return Boolean(centerId && order.inspectionCenterId === centerId);
}

export function shouldTrackCenterInspectionShipments(order: InspectionOrderDto, centerId?: string, role?: string) {
  return canReadCenterInspectionShipments(order, centerId) &&
    (shouldTrackInboundShipment(order) || isPaidHubBuyerDelivery(order) || isCenterReturnEligible(order, centerId, role));
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
    case 'DELIVERING': return progress(2, 'Đang giao hàng về Hub', 'On the way to Hub');
    case 'COMPLETED': return progress(3, 'Lalamove đã giao tới Hub', 'Delivered to Hub');
    case 'CANCELED': return progress(null, 'Vận đơn đã hủy', 'Shipment cancelled');
    case 'REJECTED':
    case 'EXPIRED': return progress(null, 'Vận đơn thất bại', 'Shipment failed');
    case 'CREATING': return progress(null, 'Đang tạo vận đơn', 'Creating shipment');
    default: return progress(null, 'Đang chờ cập nhật vận đơn', 'Awaiting shipment update');
  }
}
