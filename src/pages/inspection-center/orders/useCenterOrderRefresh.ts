import { observeResourceChanges } from '../../../services/observeResourceChanges';
import { useEffect } from 'react';
import { isUserIdle } from '../../../services';
import { INBOUND_SHIPMENT_REFRESH_MS } from './shipmentTrackingConfig';

interface Options {
  centerId?: string;
  isDispatchTab: boolean;
  needsOrders: boolean;
  needsStaff: boolean;
  showOrderShipments: boolean;
  loadOrders: (background?: boolean) => Promise<void>;
  loadStaff: () => Promise<void>;
}

export function useCenterOrderRefresh({
  centerId,
  isDispatchTab,
  needsOrders,
  needsStaff,
  showOrderShipments,
  loadOrders,
  loadStaff,
}: Options) {
  useEffect(() => {
    if (needsStaff && centerId) void loadStaff();
  }, [needsStaff, centerId, loadStaff]);

  useEffect(() => {
    if (needsOrders) void loadOrders();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSignal = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (needsOrders) void loadOrders();
        if (needsStaff) void loadStaff();
      }, 250);
    };

    const stop = observeResourceChanges(['ORDER', 'INSPECTION', 'SHIPMENT'], debouncedSignal);
    window.addEventListener('secondlife_order_placed_signal', debouncedSignal);
    window.addEventListener('secondlife_inspection_task_created', debouncedSignal);
    window.addEventListener('secondlife_order_assigned_signal', debouncedSignal);
    window.addEventListener('secondlife_inspection_completed', debouncedSignal);
    window.addEventListener('secondlife_hub_package_received', debouncedSignal);
    window.addEventListener('secondlife_seller_shipped_to_hub', debouncedSignal);
    window.addEventListener('secondlife_appointment_scheduled', debouncedSignal);
    window.addEventListener('secondlife_appointment_confirmed', debouncedSignal);
    window.addEventListener('secondlife_appointment_updated', debouncedSignal);
    window.addEventListener('secondlife_appointment_countered', debouncedSignal);
    window.addEventListener('secondlife_inspector_confirmed_signal', debouncedSignal);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('secondlife_inspection_channel');
        channel.onmessage = (event) => {
          if (
            event.data?.type === 'INSPECTOR_CONFIRMED' ||
            event.data?.type === 'ORDER_ASSIGNED' ||
            event.data?.type === 'APPOINTMENT_SCHEDULED' ||
            event.data?.type === 'APPOINTMENT_UPDATED' ||
            event.data?.type === 'APPOINTMENT_CONFIRMED'
          ) {
            debouncedSignal();
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'recent_placed_orders' ||
        e.key === 'center_inspection_orders' ||
        e.key?.startsWith('order_assigned_inspector_') ||
        e.key?.startsWith('order_confirmed_by_inspector_') ||
        e.key?.startsWith('order_appointment_') ||
        e.key?.startsWith('inspection_status_') ||
        e.key?.startsWith('hub_package_received_') ||
        e.key?.startsWith('seller_shipped_to_hub_')
      ) {
        debouncedSignal();
      }
    };
    window.addEventListener('storage', handleStorage);

    const refreshOrderTracking = () => {
      if (!document.hidden && !isUserIdle()) void loadOrders(true);
    };
    const shouldPoll = showOrderShipments || isDispatchTab;
    const trackingTimer = shouldPoll
      ? window.setInterval(refreshOrderTracking, INBOUND_SHIPMENT_REFRESH_MS)
      : undefined;
    if (shouldPoll) document.addEventListener('visibilitychange', refreshOrderTracking);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      channel?.close();
      stop();
      window.removeEventListener('secondlife_order_placed_signal', debouncedSignal);
      window.removeEventListener('secondlife_inspection_task_created', debouncedSignal);
      window.removeEventListener('secondlife_order_assigned_signal', debouncedSignal);
      window.removeEventListener('secondlife_inspection_completed', debouncedSignal);
      window.removeEventListener('secondlife_hub_package_received', debouncedSignal);
      window.removeEventListener('secondlife_seller_shipped_to_hub', debouncedSignal);
      window.removeEventListener('secondlife_appointment_scheduled', debouncedSignal);
      window.removeEventListener('secondlife_appointment_confirmed', debouncedSignal);
      window.removeEventListener('secondlife_appointment_updated', debouncedSignal);
      window.removeEventListener('secondlife_appointment_countered', debouncedSignal);
      window.removeEventListener('secondlife_inspector_confirmed_signal', debouncedSignal);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(trackingTimer);
      if (shouldPoll) document.removeEventListener('visibilitychange', refreshOrderTracking);
    };
  }, [needsOrders, needsStaff, showOrderShipments, isDispatchTab, centerId]);
}
