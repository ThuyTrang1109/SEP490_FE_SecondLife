import type { ShipmentBackend, ShipmentEventBackend } from '../types';

type ShipmentStatus = Partial<Pick<ShipmentBackend, 'status' | 'providerStatus'>>;

const interruptedStatuses = new Set(['CANCELED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED']);
const terminalStatuses = new Set([...interruptedStatuses, 'COMPLETED', 'DELIVERED', 'RETURNED']);
const carrierSyncIntervalMs = 60_000;

export function getLalamoveInterruption(shipment?: ShipmentStatus | null) {
  const providerStatus = shipment?.providerStatus?.toUpperCase();
  if (providerStatus && interruptedStatuses.has(providerStatus)) return providerStatus;
  const status = shipment?.status?.toUpperCase();
  return status && interruptedStatuses.has(status) ? status : null;
}

export function isLalamoveShipmentTerminal(shipment?: ShipmentStatus | null) {
  return terminalStatuses.has(shipment?.status?.toUpperCase() ?? '') ||
    terminalStatuses.has(shipment?.providerStatus?.toUpperCase() ?? '');
}

export function shouldSyncLalamoveShipment(
  shipment: Pick<ShipmentBackend, 'orderCode' | 'status' | 'providerStatus'>,
  lastAttemptAt: number | undefined,
  now: number,
) {
  return Boolean(shipment.orderCode && !isLalamoveShipmentTerminal(shipment) &&
    (lastAttemptAt === undefined || now - lastAttemptAt >= carrierSyncIntervalMs));
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
