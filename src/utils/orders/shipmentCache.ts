import type { EscrowOrder, ShipmentBackend } from '../../types';
import { shouldTrackInboundShipment } from '../inspectionCenterData';
import { getInspectionPurchaseDecision } from '../inspectionPurchase';

export function getOrderAllShipments(orderId?: string | null, linkedOrderId?: string | null): ShipmentBackend[] {
  if (typeof window === 'undefined') return [];
  const ids = [orderId, linkedOrderId].filter(Boolean) as string[];
  if (ids.length === 0) return [];
  try {
    const storage = window.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return [];
    for (const id of ids) {
      const raw = storage.getItem(`sl_order_shipments_${id}`) ||
        storage.getItem(`order_shipments_${id}`) ||
        storage.getItem(`sl_insp_shipments_${id}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    }
  } catch { }
  return [];
}

export function isHubInboundInProgress(order: EscrowOrder) {
  const status = String(order.inspectionStatus || order.backendStatus || order.status || '').toUpperCase();
  const method = String(order.inspectionMethod || (order as any).orderType || '').toUpperCase();
  const isAtCenter = method === 'AT_CENTER' || order.hasInspectionService;
  return shouldTrackInboundShipment({
    orderType: order.inspectionMethod,
    status,
  }) || (
    isAtCenter &&
    (['FAILED', 'INSPECTION_FAILED', 'PASSED', 'INSPECTION_PASSED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER', 'RETURNING_TO_SELLER', 'RETURNED_TO_SELLER'].includes(status) ||
      getInspectionPurchaseDecision(order) === 'rejected')
  );
}
