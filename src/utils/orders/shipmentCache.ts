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
    const map = new Map<string, ShipmentBackend>();
    for (const id of ids) {
      for (const prefix of ['sl_order_shipments_', 'order_shipments_', 'sl_insp_shipments_']) {
        const raw = storage.getItem(`${prefix}${id}`);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((s) => {
                const sid = s?.shipmentId || s?.id;
                if (s && sid) {
                  const key = String(sid);
                  map.set(key, { ...map.get(key), shipmentId: key, ...s });
                }
              });
            }
          } catch { }
        }
      }
    }
    if (map.size > 0) {
      return Array.from(map.values());
    }
  } catch { }
  return [];
}

export function isHubInboundInProgress(order: EscrowOrder) {
  const method = String(order.inspectionMethod || (order as any).orderType || '').toUpperCase();
  if (method === 'AT_HOME') return false;
  const status = String(order.inspectionStatus || order.backendStatus || order.status || '').toUpperCase();
  const isAtCenter = method === 'AT_CENTER' || order.hasInspectionService;
  return shouldTrackInboundShipment({
    orderType: order.inspectionMethod || (order as any).orderType,
    status,
  }) || (
    isAtCenter &&
    (['FAILED', 'INSPECTION_FAILED', 'PASSED', 'INSPECTION_PASSED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER', 'RETURNING_TO_SELLER', 'RETURNED_TO_SELLER'].includes(status) ||
      getInspectionPurchaseDecision(order) === 'rejected')
  );
}
