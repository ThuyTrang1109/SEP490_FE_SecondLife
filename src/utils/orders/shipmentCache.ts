import type { EscrowOrder, ShipmentBackend } from '../../types';
import { shouldTrackInboundShipment } from '../inspectionCenterData';

export function getOrderAllShipments(orderId: string): ShipmentBackend[] {
  if (typeof window === 'undefined' || !orderId) return [];
  try {
    const storage = window.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return [];
    const raw = storage.getItem(`sl_order_shipments_${orderId}`) ||
      storage.getItem(`order_shipments_${orderId}`) ||
      storage.getItem(`sl_insp_shipments_${orderId}`);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch { }
  return [];
}

export function isHubInboundInProgress(order: EscrowOrder) {
  return shouldTrackInboundShipment({
    orderType: order.inspectionMethod,
    status: order.inspectionStatus || order.backendStatus || order.status || '',
  });
}
