import { InspectionOrderDto } from '../../../services';

export const INBOUND_SHIPMENT_REFRESH_MS = 30_000;
export const INBOUND_SHIPMENT_CONCURRENCY = 3;

export const hasLocalShipmentSignal = (order: InspectionOrderDto | null): boolean => {
  if (!order || typeof window === 'undefined') return false;
  return localStorage.getItem(`seller_shipped_to_hub_${order.id}`) === 'true' ||
    localStorage.getItem(`order_ready_${order.id}`) === 'true';
};
