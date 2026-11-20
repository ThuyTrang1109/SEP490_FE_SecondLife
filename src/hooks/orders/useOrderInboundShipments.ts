import React, { useState } from 'react';
import type { EscrowOrder, ShipmentBackend } from '../../types';
import { ApiError, isUserIdle } from '../../services/apiClient';
import { notificationWsClient } from '../../services/notificationWsClient';
import { shippingService } from '../../services/shippingService';
import { getHubReturnState, getLatestInboundShipment } from '../../utils/inspectionCenterData';
import { getInspectionPurchaseDecision } from '../../utils/inspectionPurchase';
import { getOrderAllShipments, isHubInboundInProgress } from '../../utils/orders/shipmentCache';

interface Options {
  userId?: string;
  userOrders: EscrowOrder[];
  trackingOrderId?: string;
  createShipmentOrderId?: string;
  detailOrderId?: string;
  detailShipments: ShipmentBackend[];
}

export function useOrderInboundShipments({
  userId, userOrders, trackingOrderId, createShipmentOrderId, detailOrderId, detailShipments,
}: Options) {
  const [sellerInboundShipments, setSellerInboundShipments] = useState<ReadonlyMap<string, ShipmentBackend | null>>(() => {
    const map = new Map<string, ShipmentBackend | null>();
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sl_order_shipments_') || key.startsWith('order_shipments_'))) {
            const orderId = key.replace(/^(sl_)?order_shipments_/, '');
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list) && list.length > 0) {
                const latest = getLatestInboundShipment(list);
                if (latest) map.set(orderId, latest);
              }
            }
          }
        }
      } catch { }
    }
    return map;
  });
  const [inboundLoadingOrders, setInboundLoadingOrders] = useState<ReadonlySet<string>>(new Set());
  const [sellerReturnShipments, setSellerReturnShipments] = useState<ReadonlyMap<string, ShipmentBackend | null>>(new Map());
  const [, setDeliveryCacheVersion] = useState(0);

  const failedInboundOrderIdsRef = React.useRef<Set<string>>(new Set());

  const saveSellerInboundShipment = React.useCallback((orderId: string, shipment: ShipmentBackend | null) => {
    if (typeof window !== 'undefined' && orderId) {
      try {
        if (shipment) {
          const existing = getOrderAllShipments(orderId);
          const index = existing.findIndex((s) => s.shipmentId === shipment.shipmentId || s.leg === shipment.leg);
          let updated: ShipmentBackend[];
          if (index >= 0) {
            updated = [...existing];
            updated[index] = { ...updated[index], ...shipment };
          } else {
            updated = [shipment, ...existing];
          }
          localStorage.setItem(`sl_order_shipments_${orderId}`, JSON.stringify(updated));
          localStorage.setItem(`order_shipments_${orderId}`, JSON.stringify(updated));
        }
      } catch { }
    }
    setSellerInboundShipments((previous) => {
      const existing = previous.get(orderId);
      if (existing?.shipmentId === shipment?.shipmentId &&
        existing?.status === shipment?.status &&
        existing?.providerStatus === shipment?.providerStatus &&
        existing?.cashPayerId === shipment?.cashPayerId &&
        existing?.cashConfirmedAt === shipment?.cashConfirmedAt &&
        existing?.orderCode === shipment?.orderCode &&
        previous.has(orderId)) return previous;
      return new Map(previous).set(orderId, shipment);
    });
  }, []);

  const saveSellerReturnShipment = React.useCallback((orderId: string, shipment: ShipmentBackend | null) => {
    setSellerReturnShipments((previous) => {
      const current = previous.get(orderId);
      if (previous.has(orderId) && current?.shipmentId === shipment?.shipmentId &&
        current?.status === shipment?.status && current?.providerStatus === shipment?.providerStatus &&
        current?.orderCode === shipment?.orderCode) return previous;
      return new Map(previous).set(orderId, shipment);
    });
  }, []);

  const isAtHomeOrder = (o: EscrowOrder) =>
    o.inspectionMethod === 'AT_HOME' || (o as any).orderType === 'AT_HOME';

  const sellerInboundOrderKey = userId
    ? Array.from(
        new Set(
          userOrders
            .filter((order) => order.id !== trackingOrderId && order.id !== createShipmentOrderId &&
              !isAtHomeOrder(order) && isHubInboundInProgress(order))
            .map((order) => order.id)
        )
      ).sort().join(',')
    : '';

  const atHomeDeliveryKey = JSON.stringify(userId ? Array.from(
    new Map(
      userOrders
        .filter((order) => order.id !== trackingOrderId && order.id !== createShipmentOrderId &&
          isAtHomeOrder(order) && !order.shippingDeliveredAt &&
          !['COMPLETED_RELEASED', 'DELIVERED_INSPECTION_WINDOW', 'CANCELLED', 'REFUNDED_TO_BUYER'].includes(order.escrowStatus) &&
          (getInspectionPurchaseDecision(order) === 'accepted' || order.inspectionStatus === 'DELIVERING_TO_BUYER'))
        .map(({ id, linkedOrderId, inspectionOrderId }) => [id, { id, purchaseId: linkedOrderId || id, inspectionOrderId }])
    ).values()
  ) : []);

  const prevUserIdForInboundRef = React.useRef<string | null>(userId || null);
  React.useEffect(() => {
    const currentId = userId || null;
    if (prevUserIdForInboundRef.current && currentId && prevUserIdForInboundRef.current !== currentId) {
      setSellerInboundShipments(new Map());
      setSellerReturnShipments(new Map());
      failedInboundOrderIdsRef.current.clear();
    }
    prevUserIdForInboundRef.current = currentId;
  }, [userId]);

  React.useEffect(() => {
    const inboundIds = sellerInboundOrderKey ? sellerInboundOrderKey.split(',') : [];
    const atHomeOrders: Array<{ id: string; purchaseId: string; inspectionOrderId?: string | null }> = JSON.parse(atHomeDeliveryKey);
    const seenTargetIds = new Set<string>();
    const targets: Array<{ id: string; purchaseId: string | null; inspectionOrderId?: string | null }> = [];
    for (const id of inboundIds) {
      if (!seenTargetIds.has(id)) {
        seenTargetIds.add(id);
        targets.push({ id, purchaseId: null, inspectionOrderId: null });
      }
    }
    for (const ath of atHomeOrders) {
      if (!seenTargetIds.has(ath.id)) {
        seenTargetIds.add(ath.id);
        targets.push(ath);
      }
    }

    if (targets.length === 0) {
      setInboundLoadingOrders(new Set());
      return;
    }
    setInboundLoadingOrders((prev) => {
      const pendingIds = inboundIds.filter((id) => !sellerInboundShipments.has(id));
      if (pendingIds.length === 0) return prev;
      return new Set([...prev, ...pendingIds]);
    });

    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.hidden || isUserIdle()) return;
      refreshing = true;
      let nextIndex = 0;
      const read = async () => {
        while (!controller.signal.aborted && !document.hidden && nextIndex < targets.length) {
          const { id: orderId, purchaseId, inspectionOrderId } = targets[nextIndex++];

          // Bỏ qua các đơn hàng đã bị 403 Forbidden hoặc 404 để không call lặp vô hạn
          if (failedInboundOrderIdsRef.current.has(orderId)) {
            continue;
          }

          try {
            if (purchaseId) {
              const shipments = await shippingService.getOrderShipments(purchaseId, {
                signal: controller.signal,
                isBackground: true,
              });
              if (controller.signal.aborted) continue;

              const raw = JSON.stringify(shipments);
              let changed = false;
              for (const id of new Set([orderId, purchaseId, inspectionOrderId])) {
                if (!id) continue;
                const key = `sl_order_shipments_${id}`;
                if (localStorage.getItem(key) === raw) continue;
                localStorage.setItem(key, raw);
                changed = true;
              }
              if (changed) setDeliveryCacheVersion((previous) => previous + 1);
              continue;
            }
            const shipments = await shippingService.getInspectionShipments(orderId, {
              signal: controller.signal,
              isBackground: true,
            });
            if (!controller.signal.aborted) {
              if (Array.isArray(shipments) && shipments.length > 0) {
                try {
                  localStorage.setItem(`sl_order_shipments_${orderId}`, JSON.stringify(shipments));
                  localStorage.setItem(`order_shipments_${orderId}`, JSON.stringify(shipments));
                } catch { }
              }
              saveSellerInboundShipment(orderId, getLatestInboundShipment(shipments));
              saveSellerReturnShipment(orderId, getHubReturnState(shipments).shipment);
            }
          } catch (error) {
            if (!controller.signal.aborted && error instanceof ApiError && [403, 404].includes(error.status)) {
              failedInboundOrderIdsRef.current.add(orderId);
              if (!purchaseId) {
                saveSellerInboundShipment(orderId, null);
                saveSellerReturnShipment(orderId, null);
              }
            }
          } finally {
            if (!controller.signal.aborted) {
              setInboundLoadingOrders((prev) => {
                if (!prev.has(orderId)) return prev;
                const next = new Set(prev);
                next.delete(orderId);
                return next;
              });
            }
          }
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(3, targets.length) }, read));
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    // Khi WebSocket đang active: poll dự phòng thưa (60s). Khi mất kết nối: 30s.
    const intervalMs = notificationWsClient.isConnected() ? 60_000 : 30_000;
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener('visibilitychange', refresh);

    // Lắng nghe sự kiện cập nhật đơn hàng/vận đơn qua WebSocket để refresh
    const unsubWs = notificationWsClient.subscribeListener((notification) => {
      const ref = String(notification?.referenceType || '').toUpperCase();
      if (ref === 'SHIPMENT' || ref === 'INSPECTION_ORDER') {
        void refresh();
      }
    });

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      unsubWs();
    };
  }, [userId, sellerInboundOrderKey, atHomeDeliveryKey, saveSellerInboundShipment, saveSellerReturnShipment]);

  const getOrderInboundShipment = React.useCallback((order: EscrowOrder | null | undefined): ShipmentBackend | null => {
    if (!order?.id) return null;
    const fromMap = sellerInboundShipments.get(order.id);
    if (fromMap) return fromMap;
    if (detailOrderId === order.id && detailShipments.length > 0) {
      const fromDetail = getLatestInboundShipment(detailShipments);
      if (fromDetail) return fromDetail;
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`order_shipments_${order.id}`) || localStorage.getItem(`sl_order_shipments_${order.id}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            return getLatestInboundShipment(list);
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [sellerInboundShipments, detailOrderId, detailShipments]);
  return { getOrderInboundShipment, saveSellerInboundShipment, inboundLoadingOrders, sellerInboundShipments, sellerReturnShipments };
}
