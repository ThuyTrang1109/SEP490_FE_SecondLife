import type { Language, ShipmentBackend } from '../types';

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

export function shouldTrackInboundShipment(order: { orderType?: string; status: string }) {
  return order.orderType === 'AT_CENTER' && inboundTrackingStatuses.has(order.status);
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
