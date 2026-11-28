import type { Language, ShipmentBackend, ShipmentEventBackend } from '../types';

type ShipmentStatus = Partial<Pick<ShipmentBackend, 'status' | 'providerStatus'>>;

const interruptedStatuses = new Set(['CANCELED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED']);
const terminalStatuses = new Set([...interruptedStatuses, 'COMPLETED', 'DELIVERED', 'RETURNED']);

export function getLalamoveInterruption(shipment?: ShipmentStatus | null) {
  const providerStatus = shipment?.providerStatus?.toUpperCase();
  if (providerStatus && interruptedStatuses.has(providerStatus)) return providerStatus;
  const status = shipment?.status?.toUpperCase();
  return status && interruptedStatuses.has(status) ? status : null;
}

export function isDirectShipment(shipment: Pick<ShipmentBackend, 'leg'>): boolean {
  return !shipment.leg || shipment.leg === 'SELLER_TO_BUYER' || shipment.leg === 'DELIVERY';
}

export function getLatestDirectShipment(shipments: ShipmentBackend[] = []): ShipmentBackend | null {
  const createdTime = (shipment: ShipmentBackend & { createdAt?: string; createdDate?: string; updatedAt?: string }) =>
    Date.parse(shipment.createdAt || shipment.createdDate || shipment.updatedAt || '') || 0;
  let latest: ShipmentBackend | null = null;
  for (const shipment of shipments) {
    if (!isDirectShipment(shipment)) continue;
    // For responses without timestamps, the backend returns shipments in creation order.
    if (!latest || createdTime(shipment) >= createdTime(latest)) latest = shipment;
  }
  return latest;
}

export function upsertShipment(shipments: ShipmentBackend[], shipment: ShipmentBackend): ShipmentBackend[] {
  return shipments.some((item) => item.shipmentId === shipment.shipmentId)
    ? shipments.map((item) => item.shipmentId === shipment.shipmentId ? { ...item, ...shipment } : item)
    : [...shipments, shipment];
}

export function getDirectShipmentInterruptionLabel(shipment: ShipmentBackend | null, lang: Language): string | null {
  switch (getLalamoveInterruption(shipment)) {
    case 'REJECTED': return lang === 'vi' ? 'Vận đơn bị từ chối' : 'Shipment Rejected';
    case 'EXPIRED': return lang === 'vi' ? 'Vận đơn đã hết hạn' : 'Shipment Expired';
    case 'FAILED': return lang === 'vi' ? 'Vận đơn thất bại' : 'Shipment Failed';
    case 'CANCELED':
    case 'CANCELLED': return lang === 'vi' ? 'Vận đơn đã bị hủy' : 'Shipment Cancelled';
    default: return null;
  }
}

export function isLalamoveShipmentTerminal(shipment?: ShipmentStatus | null) {
  return terminalStatuses.has(shipment?.status?.toUpperCase() ?? '') ||
    terminalStatuses.has(shipment?.providerStatus?.toUpperCase() ?? '');
}

export function getPendingLalamoveDeliveryProof(shipment?: Partial<ShipmentBackend> | null, lang: Language = 'vi') {
  const time = shipment?.proofOfDeliveryAt;
  const proof = shipment?.proofOfDeliveryStatus;
  if (!time || !Number.isFinite(Date.parse(time)) || shipment?.deliveredAt || isLalamoveShipmentTerminal(shipment)) return null;
  if (proof === 'SIGNED') {
    return {
      time,
      label: lang === 'vi' ? 'Đã ký nhận · Chờ Lalamove chốt vận đơn' : 'Signed for · Waiting for Lalamove to close the shipment',
      timeLabel: lang === 'vi' ? 'Thời điểm ký nhận' : 'Signed at',
    };
  }
  if (proof === 'DELIVERED') {
    return {
      time,
      label: lang === 'vi' ? 'Đã có bằng chứng giao · Chờ Lalamove chốt vận đơn' : 'Delivery proof received · Waiting for Lalamove to close the shipment',
      timeLabel: lang === 'vi' ? 'Thời điểm ghi nhận giao hàng' : 'Delivery proof time',
    };
  }
  return null;
}

export function canSellerRebookShipment(shipment: ShipmentBackend, shipments: ShipmentBackend[], events: ShipmentEventBackend[]) {
  if (shipment.leg !== 'SELLER_TO_CENTER' && shipment.leg !== 'SELLER_TO_BUYER') return false;
  const sameLeg = shipments.filter((item) => item.leg === shipment.leg);
  if (sameLeg[sameLeg.length - 1]?.shipmentId !== shipment.shipmentId) return false;
  if (shipment.status === 'CANCELLED') return true;

  return shipment.leg === 'SELLER_TO_CENTER' && shipment.status === 'FAILED' && Boolean(shipment.orderCode) &&
    (shipment.providerStatus === 'REJECTED' || shipment.providerStatus === 'EXPIRED') && !shipment.deliveredAt &&
    !events.some((event) => event.status === 'PICKED_UP' || event.status === 'COMPLETED');
}
