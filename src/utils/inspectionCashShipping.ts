import type { ShipmentBackend, UserProfile } from '../types';

export type InspectionFeePayer = 'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50';
export const inspectionCashConfirmedEvent = 'secondlife_inspection_cash_confirmed';

export function notifyInspectionCashConfirmed() {
  window.dispatchEvent(new Event(inspectionCashConfirmedEvent));
  try {
    localStorage.setItem(inspectionCashConfirmedEvent, String(Date.now()));
  } catch {
    // The current tab can still refresh when browser storage is unavailable.
  }
}

export function getCashInspectionFeeShares(totalFee: number, outboundFee: number, payer: InspectionFeePayer) {
  const outbound = Math.round(outboundFee * 100);
  const remaining = Math.round(totalFee * 100) - outbound;
  const buyerPart = (amount: number) => payer === 'BUYER_PAYS' ? amount : payer === 'SELLER_PAYS' ? 0 : Math.round(amount / 2);
  const buyerRemaining = buyerPart(remaining);
  return { buyer: (buyerRemaining + buyerPart(outbound)) / 100, seller: (remaining - buyerRemaining) / 100 };
}

export function isInspectionCashShipment(shipment: ShipmentBackend) {
  return Boolean(shipment.cashPayerId) && (shipment.leg === 'SELLER_TO_CENTER' || shipment.leg === 'CENTER_TO_SELLER');
}

export function canReviewInspectionCash(user?: UserProfile | null) {
  const roles = [user?.role, ...(user?.roles ?? [])].map((role) => role?.toUpperCase().replace(/^ROLE_/, ''));
  return (roles.includes('STAFF') && user?.permissions?.includes('STAFF_DISPUTE_REVIEW')) ||
    (roles.includes('ADMIN') && user?.permissions?.includes('ADMIN_RBAC_MANAGE')) || false;
}

export function isDeliveredInspectionCashShipment(shipment: ShipmentBackend) {
  return isInspectionCashShipment(shipment) && shipment.status === 'DELIVERED' && shipment.providerStatus === 'COMPLETED';
}

export function canConfirmInspectionCash(shipment: ShipmentBackend) {
  return isDeliveredInspectionCashShipment(shipment) && Boolean(shipment.orderCode?.trim())
    && shipment.actualFee != null && Number.isFinite(shipment.actualFee) && shipment.actualFee >= 0
    && !shipment.cashConfirmedAt;
}
