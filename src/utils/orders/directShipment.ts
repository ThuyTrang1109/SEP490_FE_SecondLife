import type { EscrowOrder, ShipmentBackend } from '../../types';
import { getLatestDirectShipment, isDirectShipment } from '../lalamoveTracking';
import { isOrderDisputed, isOrderEscrowOnHold } from './orderDispute';
import { isOrderDeliveredToBuyer, isOrderWithInspection } from './orderReceipt';

export function getRebookableDirectShipment(order: EscrowOrder, shipments: ShipmentBackend[] = order.shipments ?? []) {
  const escrow = order.backendEscrowStatus;
  const hasPaidEscrow = escrow ? escrow === 'HELD' : ['HELD_IN_ESCROW', 'SHIPPED_TO_BUYER'].includes(order.escrowStatus);
  const closed = [order.backendStatus, order.status, order.escrowStatus]
    .some((status) => ['CANCELLED', 'CANCELED', 'COMPLETED', 'COMPLETED_RELEASED', 'REFUNDED_TO_BUYER'].includes(status ?? ''));

  if (closed || isOrderDisputed(order) || order.orderReturn || order.carrierPickedUpAt ||
      isOrderWithInspection(order) || isOrderDeliveredToBuyer(order)) return null;

  const lastShipment = getLatestDirectShipment(shipments);
  if (lastShipment?.canRebook && !lastShipment.deliveredAt) return lastShipment;
  if (!hasPaidEscrow || isOrderEscrowOnHold(order)) return null;
  if (lastShipment?.status !== 'CANCELLED' || lastShipment.deliveredAt) return null;
  // A cancelled trip only frees the route when no other outbound booking is still active or uncertain.
  return shipments.some((shipment) =>
    (isDirectShipment(shipment) || shipment.leg === 'CENTER_TO_BUYER') && shipment.status !== 'CANCELLED')
    ? null
    : lastShipment;
}
