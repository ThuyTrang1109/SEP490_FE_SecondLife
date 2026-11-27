import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EscrowOrder, Language, ShipmentBackend, ShipmentEventBackend, LalamoveTrackingResponse, CreateShipmentRequestDto } from '../../types';
import { formatVND } from '../../utils/translations';
import { InspectionCashShipmentStatus } from '../inspection/InspectionCashShipmentStatus';
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  AlertTriangle,
  X,
  Printer,
  Copy,
  ExternalLink,
  Camera,
  Check,
  User,
  Phone,
  MapPin,
  Navigation,
  Radio,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Loader2,
  Info
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import { orderService } from '../../services/orderService';
import { inspectorService } from '../../services/inspectorService';
import { dialogService } from '../../utils/dialogService';
import { translateApiError } from '../../services/apiClient';
import { resolveListingCategory, resolveOrderListing } from '../../utils/catalogCache';
import { getHubReturnProgress, getHubReturnState, getInboundShipmentProgress, getLatestInboundShipment, getLatestReturnShipment, getLatestBuyerDeliveryShipment } from '../../utils/inspectionCenterData';
import { createInFlightRequests } from '../../utils/inFlightRequests';
import { canSellerRebookShipment, getLalamoveInterruption, getLatestDirectShipment, isLalamoveShipmentTerminal, shouldSyncLalamoveShipment } from '../../utils/lalamoveTracking';
import { LalamoveProgress } from '../common/LalamoveProgress';
import { getOrderEscrowHoldNotice, isOrderEscrowOnHold } from '../../utils/orders/orderDispute';
import { getRebookableDirectShipment } from '../../utils/orders/directShipment';

const settlementStep = { title: 'Quyết toán', desc: 'Người mua xác nhận & giải ngân Escrow' };
const carrierSyncUnavailable = 'Chưa thể đồng bộ với Lalamove. Đang hiển thị trạng thái gần nhất từ SecondLife.';

interface GroupedShipmentEvent {
  key: string;
  status: string;
  type: string;
  title: string;
  description: string;
  badgeClass: string;
  firstOccurredAt: string;
  lastOccurredAt: string;
  count: number;
  reason?: string | null;
  isLatest: boolean;
}

const getLalamoveStatusDetails = (status: string | null | undefined, type?: string) => {
  const s = (status || type || '').toUpperCase();
  if (s === 'ASSIGNING_DRIVER') {
    return {
      title: 'Đang tìm kiếm tài xế Lalamove',
      description: 'Hệ thống đang phát chuyến và kết nối tài xế khu vực gần điểm lấy kiện hàng.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  if (s === 'ON_GOING') {
    return {
      title: 'Tài xế đã nhận chuyến & đang di chuyển',
      description: 'Tài xế đối tác Lalamove đã nhận đơn và đang trên đường đến điểm lấy kiện hàng từ người gửi.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  if (s === 'PICKED_UP' || s === 'PICKED' || s === 'SHIPPED') {
    return {
      title: 'Tài xế đã lấy kiện hàng',
      description: 'Tài xế đã nhận kiện hàng từ người gửi và đang trên lộ trình di chuyển tới người nhận.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  if (s === 'COMPLETED' || s === 'DELIVERED') {
    return {
      title: 'Đã giao hàng thành công',
      description: 'Kiện hàng đã được bàn giao tận tay người nhận thành công.',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }
  if (s.includes('CANCEL')) {
    return {
      title: 'Vận đơn đã bị hủy',
      description: 'Vận đơn giao hàng qua đối tác Lalamove đã được hủy.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }
  if (s === 'REJECTED') {
    return {
      title: 'Lalamove đã từ chối chuyến',
      description: 'Lalamove đã dừng tìm tài xế cho chuyến này.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }
  if (s === 'EXPIRED') {
    return {
      title: 'Đã hết hạn tìm tài xế',
      description: 'Chuyến Lalamove đã hết thời gian chờ tài xế nhận đơn.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }
  if (s === 'FAILED') {
    return {
      title: 'Vận đơn thất bại',
      description: 'Chuyến Lalamove đã dừng do sự cố vận chuyển.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }
  return {
    title: s ? `Trạng thái: ${s}` : 'Cập nhật hành trình',
    description: 'Hệ thống ghi nhận sự kiện cập nhật từ đối tác vận chuyển Lalamove.',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  };
};

interface OrderTrackingModalProps {
  order: EscrowOrder;
  onClose: () => void;
  lang: Language;
  isSeller?: boolean;
  onConfirmReceipt?: (orderId: string) => void;
  onOpenLabelModal?: (shipment: ShipmentBackend) => void;
  onOrderUpdated?: () => void;
  onDirectShipmentChanged?: (shipment: ShipmentBackend) => void;
  onInboundShipmentLoaded?: (orderId: string, shipment: ShipmentBackend | null) => void;
  onReturnShipmentLoaded?: (orderId: string, shipment: ShipmentBackend | null) => void;
  returnOnly?: boolean;
  initialShipmentId?: string;
}

function loadLeaflet(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).L) {
    return Promise.resolve((window as any).L);
  }
  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  order,
  onClose,
  lang,
  isSeller = false,
  onConfirmReceipt,
  onOpenLabelModal,
  onOrderUpdated,
  onDirectShipmentChanged,
  onInboundShipmentLoaded,
  onReturnShipmentLoaded,
  returnOnly = false,
  initialShipmentId,
}) => {
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(initialShipmentId || null);
  const selectedShipmentId = useRef<string | null>(initialShipmentId || null);
  const shipmentRequest = useRef(0);
  const syncAttempts = useRef(new Map<string, number>());
  const pendingSyncs = useMemo(createInFlightRequests, []);
  const syncCarrierShipment = useCallback((shipmentId: string) => pendingSyncs.run(shipmentId, () => {
    syncAttempts.current.set(shipmentId, Date.now());
    return shippingService.syncShipment(shipmentId);
  }), [pendingSyncs]);
  const [events, setEvents] = useState<ShipmentEventBackend[]>([]);
  const [trackingData, setTrackingData] = useState<LalamoveTrackingResponse | null>(null);
  const selectShipment = (id: string) => {
    selectedShipmentId.current = id;
    setActiveShipmentId(id);
    setEvents([]);
    setTrackingData(null);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isConfirmingDelivered, setIsConfirmingDelivered] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isReceiptConfirmed = Boolean(
    String(order.escrowStatus) === 'COMPLETED_RELEASED' ||
    String(order.escrowStatus) === 'RELEASED' ||
    String(order.escrowStatus) === 'COMPLETED' ||
    String((order as any).status).toUpperCase() === 'COMPLETED' ||
    String((order as any).backendStatus).toUpperCase() === 'COMPLETED' ||
    (order as any).buyerConfirmedAt ||
    (order as any).buyer_confirmed_at ||
    (order as any).releasedAt ||
    (order as any).released_at ||
    (typeof window !== 'undefined' && localStorage.getItem(`order_receipt_confirmed_${order.id}`) === 'true')
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const bookingRequestIds = useRef(new Map<string, string>());
  const bookingInFlight = useRef(false);

  const handleManualCreateShipment = async () => {
    if (!isSeller || returnOnly || bookingInFlight.current ||
      (activeShipment ? !canRebookShipment : isOrderEscrowOnHold(order))) return;
    bookingInFlight.current = true;
    setIsCreatingShipment(true);
    setErrorMsg(null);
    try {
      const shipsToHub = activeShipment ? activeShipment.leg === 'SELLER_TO_CENTER'
        : order.inspectionMethod === 'AT_CENTER' || (!order.inspectionMethod && isInspectionOrder);
      const leg = shipsToHub ? 'SELLER_TO_CENTER' : 'SELLER_TO_BUYER';
      const parentId = shipsToHub ? activeShipment?.inspectionOrderId || order.id
        : activeShipment?.orderId || order.linkedOrderId || order.id;
      const requestKey = `sl_booking_request_${parentId}_${leg}_${activeShipment?.shipmentId || 'first'}`;
      let requestId = bookingRequestIds.current.get(requestKey);
      if (!requestId) {
        try { requestId = localStorage.getItem(requestKey) || undefined; } catch { }
        requestId ||= crypto.randomUUID();
        bookingRequestIds.current.set(requestKey, requestId);
        try { localStorage.setItem(requestKey, requestId); } catch { }
      }

      const payload: CreateShipmentRequestDto = { requestId, leg };
      const shipment = shipsToHub
        ? await shippingService.createInspectionShipment(parentId, payload)
        : await shippingService.createShipment(parentId, payload);
      if (!shipment?.shipmentId) throw new Error('Hệ thống chưa xác nhận vận đơn mới. Vui lòng thử lại.');

      selectShipment(shipment.shipmentId);
      setShipments((previous) => [...previous.filter((item) => item.shipmentId !== shipment.shipmentId), shipment]);
      if (!isInspectionOrder) onDirectShipmentChanged?.(shipment);
      void loadShipmentData(true, shipment);
      const failure = getLalamoveInterruption(shipment);
      if (failure) throw new Error(shipment.lastError || getLalamoveStatusDetails(failure).description);
      if (!shipment.orderCode) {
        showNotification('Hệ thống đang xác minh kết quả đặt chuyến. Vận đơn sẽ hiện mã khi Lalamove xác nhận.');
        return;
      }

      try {
        const nowIso = new Date().toISOString();
        localStorage.setItem(`order_shipment_created_${order.id}`, 'true');
        localStorage.setItem(`seller_ready_${order.id}`, nowIso);
        localStorage.setItem(`order_packed_${order.id}`, 'true');
        if (shipsToHub) localStorage.setItem(`seller_shipped_to_hub_${order.id}`, 'true');
        const history = [...shipments.filter((item) => item.shipmentId !== shipment.shipmentId), shipment];
        localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(history));
        localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(history));
      } catch { }

      showNotification(`Đã tạo vận đơn Lalamove #${shipment.orderCode}.`);
      onOrderUpdated?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || '';
      if (/already active or uncertain/i.test(message)) {
        showNotification('Đơn đã có chuyến đang chạy, đã lấy hàng hoặc đang chờ xác minh. Hãy kiểm tra trạng thái chuyến trước khi đặt lại.', true);
        void loadShipmentData(true);
      } else {
        showNotification(translateApiError(message) || 'Không thể tạo vận đơn Lalamove. Vui lòng thử lại.', true);
      }
    } finally {
      bookingInFlight.current = false;
      setIsCreatingShipment(false);
    }
  };

  // Polling state (10 - 15s interval as specified in Section 10.4 of guide)
  const [pollingActive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Backend Order Extra States (GET /orders/{id}/confirmation, /fulfillment, /payment)
  const [orderConfirmation, setOrderConfirmation] = useState<any>(null);
  const [orderFulfillment, setOrderFulfillment] = useState<any>(null);
  const [orderPayment, setOrderPayment] = useState<any>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState<boolean>(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');

  const loadOrderExtraDetails = useCallback(async () => {
    if (returnOnly) return;
    // Nhận diện đơn kiểm định (Inspection Order)
    const isInspection = Boolean(
      order.hasInspectionService ||
      order.inspectionMethod ||
      order.inspectionCenterId ||
      (order as any).inspectionStatus
    );

    // Đối với đơn kiểm định: ID là inspectionOrderId, không thuộc bảng orders thông thường
    // Gọi API đơn kiểm định để lấy tiến trình, không gọi /orders/{id}/confirmation hay /fulfillment (tránh lỗi 404)
    if (isInspection) {
      try {
        const inspDto = await inspectorService.getOrder(order.id);
        if (inspDto) {
          setOrderConfirmation({
            confirmationStatus: inspDto.status,
            sellerConfirmedAt: inspDto.sellerPaidAt || inspDto.appointmentScheduledAt,
            confirmationDeadline: inspDto.paymentDeadline,
          });
          setOrderFulfillment({
            handoverDeadline: inspDto.paymentDeadline,
            sellerReadyAt: inspDto.sellerPaidAt,
          });
        }
      } catch (e) {
        // Bỏ qua nếu là môi trường dev hoặc chưa có bản ghi
      }
      return;
    }

    try {
      const [confRes, fulfRes] = await Promise.allSettled([
        orderService.getOrderConfirmation(order.id),
        orderService.getOrderFulfillment(order.id),
      ]);
      if (confRes.status === 'fulfilled') setOrderConfirmation(confRes.value);
      if (fulfRes.status === 'fulfilled') setOrderFulfillment(fulfRes.value);
    } catch (e) {
      console.warn('Failed to load confirmation or fulfillment extra details:', e);
    }
  }, [order.id, order.hasInspectionService, order.inspectionMethod, order.inspectionCenterId, (order as any).inspectionStatus, returnOnly]);

  useEffect(() => {
    loadOrderExtraDetails();
  }, [loadOrderExtraDetails]);

  // Countdown timer for seller confirmation deadline
  useEffect(() => {
    const deadlineStr = orderConfirmation?.confirmationDeadline || orderFulfillment?.confirmationDeadline;
    if (!deadlineStr || orderConfirmation?.sellerConfirmedAt || orderFulfillment?.sellerConfirmedAt) {
      setCountdownText('');
      return;
    }

    const updateCountdown = () => {
      const diff = new Date(deadlineStr).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText('Đã quá hạn xác nhận bàn giao');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(`${hours}h ${mins}m ${secs}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [orderConfirmation?.confirmationDeadline, orderConfirmation?.sellerConfirmedAt, orderFulfillment?.confirmationDeadline, orderFulfillment?.sellerConfirmedAt]);

  const handleLookupPayment = async () => {
    setIsLoadingPayment(true);
    setPaymentNotice(null);
    try {
      const isInspection = Boolean(
        order.hasInspectionService ||
        order.inspectionMethod ||
        order.inspectionCenterId ||
        (order as any).inspectionStatus
      );

      if (isInspection) {
        const inspDto = await inspectorService.getOrder(order.id);
        if (inspDto) {
          setPaymentNotice(
            inspDto.buyerPaidAt
              ? 'Người mua đã nộp đủ tiền kiểm định & cước vận chuyển vào Quỹ Escrow!'
              : 'Đơn kiểm định đang chờ người mua thanh toán.'
          );
        }
        return;
      }

      const res = await orderService.getOrderPayment(order.id);
      setOrderPayment(res);
      setPaymentNotice('Đã cập nhật trạng thái thanh toán từ cổng SePay thành công!');
    } catch (err: any) {
      setPaymentNotice(err?.message || 'Không thể tra cứu trạng thái thanh toán.');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const activeShipment = shipments.find((s) => s.shipmentId === activeShipmentId) || shipments[0] || null;
  const isInspectionOrder = returnOnly || Boolean(order.hasInspectionService || order.inspectionMethod || order.inspectionStatus);
  const escrowOnHold = isOrderEscrowOnHold(order);
  const escrowNotice = getOrderEscrowHoldNotice(order, lang, shipments);
  const canRebookShipment = isSeller && !returnOnly && Boolean(activeShipment &&
    (isInspectionOrder
      ? !escrowOnHold && canSellerRebookShipment(activeShipment, shipments, events)
      : getRebookableDirectShipment(order, shipments)?.shipmentId === activeShipment.shipmentId));
  const interruption = getLalamoveInterruption(activeShipment) ?? (
    isLalamoveShipmentTerminal(activeShipment) ? null : getLalamoveInterruption(trackingData)
  );
  const effectiveProviderStatus = interruption ?? activeShipment?.providerStatus ?? trackingData?.providerStatus;
  const canShowDriver = effectiveProviderStatus === 'ON_GOING' || effectiveProviderStatus === 'PICKED_UP';
  const isHubSeller = isSeller && order.inspectionMethod === 'AT_CENTER';

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(translateApiError(msg));
      setTimeout(() => setErrorMsg(null), 6000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Fetch shipments, events and Lalamove tracking details
  const loadShipmentData = useCallback(async (isBackground = false, syncedShipment?: ShipmentBackend) => {
    const request = ++shipmentRequest.current;
    if (!isBackground) setIsLoading(true);
    try {
      let shipList: ShipmentBackend[] = [];
      let loadedFromBackend = false;
      const targetQueryIds = [order.id, (order as any).linkedOrderId].filter(Boolean) as string[];

      for (const id of targetQueryIds) {
        let foundAny = false;
        if (isInspectionOrder) {
          try {
            const inspShips = await shippingService.getInspectionShipments(id, { isBackground });
            if (Array.isArray(inspShips) && inspShips.length > 0) {
              for (const s of inspShips) {
                if (!shipList.some((existing) => existing.shipmentId === s.shipmentId)) {
                  shipList.push(s);
                }
              }
              loadedFromBackend = true;
              foundAny = true;
            }
          } catch (inspShipErr) {
            if (isHubSeller || returnOnly) throw inspShipErr;
            console.warn('Could not load inspection shipments:', inspShipErr);
          }
        }
        try {
          const ordShips = await shippingService.getOrderShipments(id);
          if (Array.isArray(ordShips) && ordShips.length > 0) {
            for (const s of ordShips) {
              if (!shipList.some((existing) => existing.shipmentId === s.shipmentId)) {
                shipList.push(s);
              }
            }
            loadedFromBackend = true;
            foundAny = true;
          }
        } catch (orderShipErr) {
          console.warn('Could not load order shipments:', orderShipErr);
        }
        if (foundAny) break;
      }
      if (request !== shipmentRequest.current) return;
      if (returnOnly) shipList = shipList.filter((shipment) => shipment.leg === 'CENTER_TO_SELLER');

      // Nạp từ localStorage nếu backend chưa đồng bộ hoặc chưa có bản ghi
      if (shipList.length === 0 && !returnOnly) {
        try {
          for (const id of targetQueryIds) {
            const raw = localStorage.getItem(`sl_order_shipments_${id}`) ||
              localStorage.getItem(`order_shipments_${id}`) ||
              localStorage.getItem(`sl_insp_shipments_${id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                shipList = parsed;
                break;
              }
            }
          }
        } catch { }
      }

      if (syncedShipment) {
        shipList = shipList.some((shipment) => shipment.shipmentId === syncedShipment.shipmentId)
          ? shipList.map((shipment) => shipment.shipmentId === syncedShipment.shipmentId
            ? { ...shipment, ...syncedShipment, canRebook: shipment.canRebook }
            : shipment)
          : [...shipList, syncedShipment];
      }

      setShipments(shipList);
      try {
        if (typeof window !== 'undefined' && order.id) {
          localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(shipList));
          localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(shipList));
          const allCancelled = shipList.length > 0 && shipList.every((s) => {
            const st = String(s.status || '').toUpperCase();
            const pst = String(s.providerStatus || '').toUpperCase();
            return ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(st) ||
              ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(pst);
          });
          if (allCancelled) {
            localStorage.removeItem(`order_packed_${order.id}`);
            localStorage.removeItem(`order_shipment_created_${order.id}`);
          }
          window.dispatchEvent(new CustomEvent('secondlife_shipment_updated', { detail: { orderId: order.id, shipments: shipList } }));
        }
      } catch { }
      const latestInbound = getLatestInboundShipment(shipList);
      if ((loadedFromBackend || syncedShipment) && (isHubSeller || latestInbound)) onInboundShipmentLoaded?.(order.id, latestInbound);
      if ((loadedFromBackend || syncedShipment) && returnOnly) onReturnShipmentLoaded?.(order.id, getHubReturnState(shipList).shipment);

      if (shipList.length > 0) {
        const selected = selectedShipmentId.current;
        const returnShipment = getLatestReturnShipment(shipList) || getHubReturnState(shipList).shipment;
        const buyerDeliveryShipment = isInspectionOrder ? getLatestBuyerDeliveryShipment(shipList) : getLatestDirectShipment(shipList);

        const targetId = selected && shipList.some((s) => s.shipmentId === selected)
          ? selected
          : (returnShipment
            ? returnShipment.shipmentId
            : (!isSeller || !isInspectionOrder) && buyerDeliveryShipment
              ? buyerDeliveryShipment.shipmentId
              : isSeller && latestInbound
                ? latestInbound.shipmentId
                : shipList[0].shipmentId);

        if (selected !== targetId) selectShipment(targetId);

        const currentShipment = shipList.find((s) => s.shipmentId === targetId) || shipList[0];
        // Poll SecondLife frequently and reconcile with the carrier at a lower rate if the webhook is delayed.
        if (!syncedShipment && shouldSyncLalamoveShipment(currentShipment, syncAttempts.current.get(targetId), Date.now())) {
          try {
            const synced = await syncCarrierShipment(targetId);
            if (request !== shipmentRequest.current) return;
            if (synced) {
              shipList = shipList.map((s) => (s.shipmentId === targetId ? { ...s, ...synced } : s));
              setShipments(shipList);
              try {
                if (typeof window !== 'undefined' && order.id) {
                  localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(shipList));
                  localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(shipList));
                  const allCancelled = shipList.length > 0 && shipList.every((s) => {
                    const st = String(s.status || '').toUpperCase();
                    const pst = String(s.providerStatus || '').toUpperCase();
                    return ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(st) ||
                      ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(pst);
                  });
                  if (allCancelled) {
                    localStorage.removeItem(`order_packed_${order.id}`);
                    localStorage.removeItem(`order_shipment_created_${order.id}`);
                  }
                  window.dispatchEvent(new CustomEvent('secondlife_shipment_updated', { detail: { orderId: order.id, shipments: shipList } }));
                }
              } catch { }
              setErrorMsg((message) => message === carrierSyncUnavailable ? null : message);
              if (currentShipment.leg === 'SELLER_TO_CENTER') {
                onInboundShipmentLoaded?.(order.id, getLatestInboundShipment(shipList));
              }
              if (returnOnly) onReturnShipmentLoaded?.(order.id, getHubReturnState(shipList).shipment);
            }
          } catch {
            if (request !== shipmentRequest.current) return;
            setErrorMsg((message) => message ?? carrierSyncUnavailable);
          }
        }

        // Parallel load tracking and events
        const [evList, trackRes] = await Promise.allSettled([
          shippingService.getShipmentEvents(targetId),
          shippingService.getShipmentTracking(targetId),
        ]);
        if (request !== shipmentRequest.current) return;

        if (evList.status === 'fulfilled') {
          setEvents(evList.value);
        } else {
          setEvents([]);
        }

        setTrackingData(trackRes.status === 'fulfilled' ? trackRes.value : null);
      } else {
        setEvents([]);
        setTrackingData(null);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      if (request !== shipmentRequest.current) return;
      console.warn('Error fetching shipment tracking data:', err);
      if (!isBackground) {
        setErrorMsg(err?.message || 'Không thể tải thông tin vận đơn từ hệ thống.');
      }
    } finally {
      if (request === shipmentRequest.current) setIsLoading(false);
    }
  }, [order.id, isInspectionOrder, isHubSeller, isSeller, onInboundShipmentLoaded, returnOnly, onReturnShipmentLoaded, syncCarrierShipment]);

  // Initial load
  useEffect(() => {
    loadShipmentData();
    return () => { shipmentRequest.current++; };
  }, [loadShipmentData]);

  // Polling Effect (12 seconds, tạm dừng khi tab ẩn hoặc khi chuyến đã hoàn tất/hủy)
  useEffect(() => {
    if (!pollingActive || isLoading || isSyncing || isLalamoveShipmentTerminal(activeShipment)) return;

    let isPolling = false;
    const interval = setInterval(() => {
      if (isPolling || document.hidden) return;
      isPolling = true;
      void loadShipmentData(true).finally(() => { isPolling = false; });
    }, 12000);
    return () => clearInterval(interval);
  }, [pollingActive, isLoading, isSyncing, loadShipmentData, activeShipment?.status, activeShipment?.providerStatus]);

  // Render Leaflet map when driver GPS coordinates are AVAILABLE
  useEffect(() => {
    const coordinates = trackingData?.driver?.coordinates;
    const isLocationAvailable = canShowDriver && trackingData?.locationStatus === 'AVAILABLE' && coordinates;
    const lat = coordinates ? Number(coordinates.lat) : NaN;
    const lng = coordinates ? Number(coordinates.lng) : NaN;
    const hasValidCoords = isLocationAvailable && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

    if (!hasValidCoords) {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) { }
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('lalamove-driver-map');
      if (!container) return;

      loadLeaflet().then((L) => {
        if (!mapInstanceRef.current) {
          const map = L.map('lalamove-driver-map', {
            zoomControl: true,
            scrollWheelZoom: false,
          }).setView([lat, lng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
          }).addTo(map);

          const icon = L.divIcon({
            className: 'custom-driver-icon',
            html: '<div style="background-color:#ea580c;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:2px solid white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3m15 0h2v-3.34a4 4 0 0 0-1.17-2.83L19 8h-5v9h2"/></svg></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const marker = L.marker([lat, lng], { icon }).addTo(map);
          marker.bindPopup(`<b>Vị trí tài xế Lalamove</b><br>${coordinates?.updatedAt ? new Date(coordinates.updatedAt).toLocaleTimeString('vi-VN') : 'Đang giao'}`).openPopup();

          mapInstanceRef.current = map;
          markerRef.current = marker;
        } else {
          mapInstanceRef.current.setView([lat, lng], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
        }
      }).catch((e) => console.warn('Leaflet map error:', e));
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [canShowDriver, trackingData?.locationStatus, trackingData?.driver?.coordinates?.lat, trackingData?.driver?.coordinates?.lng]);

  // Clean map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) { }
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Handle Sync Lalamove
  const handleSyncLalamove = async () => {
    if (!activeShipment?.orderCode || isSyncing) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const updated = await syncCarrierShipment(activeShipment.shipmentId);
      const updatedList = shipments.map((shipment) => shipment.shipmentId === updated.shipmentId ? { ...shipment, ...updated } : shipment);
      setShipments(updatedList);
      try {
        if (typeof window !== 'undefined' && order.id) {
          localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(updatedList));
          localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(updatedList));
          const allCancelled = updatedList.length > 0 && updatedList.every((s) => {
            const st = String(s.status || '').toUpperCase();
            const pst = String(s.providerStatus || '').toUpperCase();
            return ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(st) ||
              ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(pst);
          });
          if (allCancelled) {
            localStorage.removeItem(`order_packed_${order.id}`);
            localStorage.removeItem(`order_shipment_created_${order.id}`);
          }
          window.dispatchEvent(new CustomEvent('secondlife_shipment_updated', { detail: { orderId: order.id, shipments: updatedList } }));
        }
      } catch { }
      const statusDesc = getLalamoveStatusDetails(getLalamoveInterruption(updated) || updated.providerStatus || updated.status).title;
      showNotification(`Đã đồng bộ thành công từ Lalamove: ${statusDesc}`);
      await loadShipmentData(true, updated);
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Lỗi khi đồng bộ trạng thái từ hệ thống Lalamove.', true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Cancelling a direct shipment keeps the purchase open for another booking.
  const handleCancelShipment = async () => {
    if (!activeShipment) return;
    const confirmed = await dialogService.confirm(
      'Bạn có chắc chắn muốn hủy vận đơn Lalamove này trước khi tài xế đến lấy hàng?',
      { title: 'Hủy Vận Đơn', type: 'warning' }
    );
    if (!confirmed) return;
    setIsCancelling(true);
    try {
      const cancelledShipment = await shippingService.cancelShipment(activeShipment.shipmentId);
      const cancelledShipments = shipments.map((s) =>
        s.shipmentId === activeShipment.shipmentId
          ? { ...s, ...cancelledShipment }
          : s
      );
      setShipments(cancelledShipments);
      if (!isInspectionOrder) onDirectShipmentChanged?.(cancelledShipment);
      try {
        if (typeof window !== 'undefined' && order.id) {
          localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(cancelledShipments));
          localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(cancelledShipments));
          const allCancelled = cancelledShipments.length > 0 && cancelledShipments.every((s) => {
            const st = String(s.status || '').toUpperCase();
            const pst = String(s.providerStatus || '').toUpperCase();
            return ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(st) ||
              ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(pst);
          });
          if (allCancelled) {
            localStorage.removeItem(`order_packed_${order.id}`);
            localStorage.removeItem(`order_shipment_created_${order.id}`);
          }
          window.dispatchEvent(new CustomEvent('secondlife_shipment_updated', { detail: { orderId: order.id, shipments: cancelledShipments } }));
        }
      } catch { }
      if (isInspectionOrder) {
        try {
          await shippingService.refundShipment(activeShipment.shipmentId);
          showNotification('Đã hủy vận đơn thành công và tự động hoàn cước vận chuyển về Ví SecondLife.');
        } catch {
          showNotification('Đã hủy vận đơn Lalamove thành công.');
        }
      } else {
        showNotification('Đã hủy vận đơn Lalamove thành công. Bạn có thể tạo lại vận đơn cho đơn hàng này.');
      }
      await loadShipmentData(false, cancelledShipment);
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Không thể hủy vận đơn.', true);
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Reconcile Creation (when API timeout or creation error)
  const handleReconcileShipment = async () => {
    if (!activeShipment) return;
    setIsReconciling(true);
    setErrorMsg(null);
    try {
      const updated = await shippingService.reconcileCreation(activeShipment.shipmentId);
      showNotification(`Đã kích hoạt đối soát và tạo lại vận đơn thành công: #${updated.orderCode || updated.shipmentId}`);
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Không thể đối soát tạo lại vận đơn.', true);
    } finally {
      setIsReconciling(false);
    }
  };

  // Handle Manual Refund Shipment Fee
  const handleRefundShipment = async () => {
    if (!activeShipment) return;
    const confirmed = await dialogService.confirm(
      'Xác nhận hoàn cước vận chuyển của vận đơn này về Ví SecondLife?',
      { title: 'Hoàn Cước Vận Chuyển', type: 'confirm' }
    );
    if (!confirmed) return;
    setIsRefunding(true);
    setErrorMsg(null);
    try {
      await shippingService.refundShipment(activeShipment.shipmentId);
      showNotification('Đã hoàn cước vận chuyển thành công về Ví SecondLife!');
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Không thể hoàn cước vận chuyển.', true);
    } finally {
      setIsRefunding(false);
    }
  };

  // Handle Buyer Confirm Delivery
  const handleConfirmReceived = async () => {
    const confirmed = await dialogService.confirm(
      'Xác nhận bạn đã nhận được hàng và nghiệm thu thiết bị? Tiền sẽ được giải ngân cho người bán.',
      { title: 'Xác Nhận Đã Nhận Hàng', type: 'success' }
    );
    if (!confirmed) return;
    setIsConfirmingDelivered(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`order_receipt_confirmed_${order.id}`, 'true');
      }
      await orderService.confirmDelivery(order.id);
      showNotification('Đã xác nhận nhận hàng thành công! Đơn hàng hoàn tất và quỹ Escrow đã được giải ngân.');
      onConfirmReceipt?.(order.id);
      onOrderUpdated?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      showNotification(err?.message || 'Không thể xác nhận nhận hàng. Vui lòng kiểm tra lại trạng thái Lalamove.', true);
    } finally {
      setIsConfirmingDelivered(false);
    }
  };

  // Handle Copy Tracking Code
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Step Calculation based on Lalamove providerStatus (Section 10.2)
  const getStepIndex = (
    providerStatus: string | null | undefined,
    shipmentStatus: string,
    orderCompleted = false
  ): number => {
    const p = (providerStatus || '').toUpperCase();
    const s = (shipmentStatus || '').toUpperCase();
    if (p.includes('CANCEL') || s.includes('CANCEL')) return -1;
    if (p.includes('REJECT') || p.includes('EXPIRE') || s.includes('FAIL')) return -2;
    if (orderCompleted || (s === 'DELIVERED' && order.backendStatus === 'COMPLETED')) return 4;
    if (p === 'COMPLETED' || s === 'DELIVERED') return 3;
    if (p === 'PICKED_UP' || s === 'PICKED' || s === 'SHIPPED') return 2;
    if (p === 'ON_GOING' || s === 'ASSIGNED') return 1;
    return 0; // ASSIGNING_DRIVER, READY_TO_PICK, PENDING
  };

  const interruptionDetails = interruption ? getLalamoveStatusDetails(interruption) : null;
  const isReturnShipment = activeShipment?.leg === 'CENTER_TO_SELLER' || activeShipment?.leg === 'BUYER_TO_SELLER';
  const hubProgress = isReturnShipment ? getHubReturnProgress(activeShipment, lang)
    : activeShipment?.leg === 'SELLER_TO_CENTER' ? getInboundShipmentProgress(activeShipment, lang) : null;
  const currentStep = interruption ? -1 : hubProgress ? (hubProgress.step ?? -1) : getStepIndex(
    effectiveProviderStatus,
    activeShipment?.status || '',
    order.backendStatus === 'COMPLETED' || order.escrowStatus === 'COMPLETED_RELEASED'
  );

  const getProviderStatusBadge = (providerStatus: string | null | undefined) => {
    const p = (providerStatus || 'ASSIGNING_DRIVER').toUpperCase();
    if (p === 'COMPLETED') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Lalamove: Đã giao thành công</span>;
    }
    if (p === 'PICKED_UP') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">Lalamove: Đã lấy hàng & Đang giao</span>;
    }
    if (p === 'ON_GOING') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">Lalamove: Tài xế đang đến lấy hàng</span>;
    }
    if (p === 'ASSIGNING_DRIVER') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">Lalamove: Đang tìm tài xế</span>;
    }
    if (p.includes('CANCEL')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Lalamove: Vận đơn đã hủy</span>;
    }
    if (p.includes('REJECT') || p.includes('EXPIRE')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Lalamove: Từ chối / Hết hạn</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">{providerStatus}</span>;
  };

  const coordinates = trackingData?.driver?.coordinates;
  const isLocationAvailable = canShowDriver && trackingData?.locationStatus === 'AVAILABLE' && coordinates;
  const lat = coordinates ? Number(coordinates.lat) : NaN;
  const lng = coordinates ? Number(coordinates.lng) : NaN;
  const hasValidCoords = isLocationAvailable && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  // Gộp các sự kiện liên tiếp có cùng trạng thái (do hệ thống ghi nhận mỗi lần đồng bộ)
  // và hiển thị sự kiện MỚI NHẤT ở trên cùng
  const groupedEvents: GroupedShipmentEvent[] = useMemo(() => {
    if (!events || events.length === 0) return [];

    // Sắp xếp tăng dần theo thời gian xảy ra (Ascending) để phân tích chuỗi tiến trình
    const sorted = [...events].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const groups: {
      key: string;
      status: string;
      type: string;
      firstOccurredAt: string;
      lastOccurredAt: string;
      count: number;
      reason?: string | null;
    }[] = [];

    for (const ev of sorted) {
      const currentStatus = (ev.status || ev.type || 'UNKNOWN').toUpperCase();
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.status === currentStatus) {
        lastGroup.count += 1;
        lastGroup.lastOccurredAt = ev.occurredAt;
        if (ev.reason && !lastGroup.reason) {
          lastGroup.reason = ev.reason;
        }
      } else {
        groups.push({
          key: ev.id || `${currentStatus}-${ev.occurredAt}`,
          status: currentStatus,
          type: ev.type,
          firstOccurredAt: ev.occurredAt,
          lastOccurredAt: ev.occurredAt,
          count: 1,
          reason: ev.reason,
        });
      }
    }

    // Đảo ngược thứ tự để mốc mới nhất (trạng thái hiện tại) nằm ở TRÊN CÙNG
    const reversed = groups.reverse();
    return reversed.map((grp, index) => {
      const details = getLalamoveStatusDetails(grp.status, grp.type);
      return {
        ...grp,
        title: details.title,
        description: details.description,
        badgeClass: details.badgeClass,
        isLatest: index === 0,
      };
    });
  }, [events]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#ffe8d6] to-[#faf8f5] text-[#24263e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-center shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#24263e]">
                  {returnOnly ? (lang === 'vi' ? 'Theo dõi hoàn trả về người bán' : 'Track return to seller') : 'Quá trình giao hàng'}
                </h3>
                <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded-md border border-[#24263e]/15 font-bold">
                  #{order.id.slice(0, 12)}
                </span>
              </div>
              <p className="text-[11px] text-[#24263e]/80 mt-0.5 flex items-center gap-2">
                <span>Đối tác vận chuyển: <strong>Lalamove Delivery</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${pollingActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  Cập nhật lúc: {lastUpdated.toLocaleTimeString('vi-VN')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncLalamove}
              disabled={isSyncing || !activeShipment?.orderCode}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Đồng bộ trực tiếp từ server Lalamove"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-orange-600' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ Lalamove</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#24263e] hover:bg-white/60 p-1.5 rounded-xl cursor-pointer transition font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 text-xs text-[#24263e] flex-1 overflow-y-auto subtle-scrollbar">
          {/* Notification Banners */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Product Summary Mini Card */}
          <div className="flex items-center gap-3.5 bg-[#faf8f5] p-3 rounded-2xl border border-gray-200">
            <img
              src={order.listing.photos.front}
              alt={order.listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-orange-600 uppercase font-black">{resolveOrderListing(order.listing).brand}</span>
                <span className="text-gray-300">•</span>
                <span className="text-[10px] text-slate-500 font-semibold">{resolveListingCategory(order.listing)}</span>
              </div>
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
              <div className="flex items-center justify-between mt-1 text-slate-600 text-[11px]">
                <span>Người bán: <strong className="text-slate-900">{order.sellerName}</strong></span>
                <span>Tiền hàng: <strong className="text-orange-600 font-bold">{formatVND(order.itemPriceVnd)}</strong></span>
              </div>
            </div>
          </div>

          {/* Multiple Shipments Tabs (if order has multiple shipments) */}
          {shipments.length > 1 && (
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="font-bold text-slate-500 text-[11px]">Chọn kiện hàng:</span>
              {shipments.map((s, idx) => (
                <button
                  key={s.shipmentId}
                  onClick={() => {
                    if (s.shipmentId === activeShipment?.shipmentId) return;
                    selectShipment(s.shipmentId);
                    void loadShipmentData(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeShipment?.shipmentId === s.shipmentId
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
                    }`}
                >
                  Kiện {idx + 1} ({s.leg === 'SELLER_TO_CENTER' ? 'Chặng 1: Hub' : s.leg === 'CENTER_TO_SELLER' ? 'Hoàn trả' : s.leg === 'CENTER_TO_BUYER' ? 'Giao khách' : s.leg === 'SELLER_TO_BUYER' ? 'Giao trực tiếp' : s.leg === 'BUYER_TO_SELLER' ? 'Hoàn về người bán' : s.leg || 'Lalamove'})
                </button>
              ))}
            </div>
          )}

          {/* Main Shipment Card */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
              <span className="font-bold text-sm">Đang tải dữ liệu tracking từ hệ thống Lalamove...</span>
            </div>
          ) : !activeShipment ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-3xl space-y-4">
              <Package className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">{returnOnly ? 'Chưa có vận đơn hoàn trả' : 'Chưa có vận đơn nào được tạo'}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {returnOnly ? 'Vận đơn hoàn trả sẽ hiện khi trung tâm tạo chuyến.' : isSeller
                  ? 'Đơn hàng chưa có mã vận đơn Lalamove. Bạn có thể bấm nút bên dưới để tạo vận đơn và phát lệnh điều phối tài xế Lalamove ngay lập tức.'
                  : 'Người bán chưa khởi tạo mã vận đơn Lalamove cho đơn hàng này. Vui lòng chờ người bán đóng gói và tạo vận đơn bàn giao cho tài xế.'}
              </p>
              {isSeller && !returnOnly && (
                <div className="pt-2">
                  <button
                    onClick={handleManualCreateShipment}
                    disabled={isCreatingShipment}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-90 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingShipment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Đang kết nối Lalamove...</span>
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 text-white" />
                        <span>Tạo Vận Đơn Lalamove Ngay</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shipment Meta Details Card */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-[#faf8f5] p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Mã vận đơn Lalamove</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base sm:text-lg font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        {activeShipment.orderCode || 'CHƯA_CÓ_MÃ'}
                      </span>
                      {activeShipment.orderCode && (
                        <button
                          onClick={() => handleCopyCode(activeShipment.orderCode!)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-600 transition cursor-pointer"
                          title="Sao chép mã vận đơn"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-black">Trạng thái vận đơn</span>
                    {interruptionDetails ? (
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${interruptionDetails.badgeClass}`}>{interruptionDetails.title}</span>
                    ) : hubProgress ? (
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${hubProgress.step === 3 ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}>{hubProgress.label}</span>
                    ) : getProviderStatusBadge(effectiveProviderStatus)}
                  </div>
                </div>

                <InspectionCashShipmentStatus shipment={activeShipment} />
                {isReturnShipment && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                    <span>Cước trả hàng thực tế {activeShipment.actualFee == null ? 'đang chờ đối soát' : formatVND(activeShipment.actualFee)}</span>
                    {(activeShipment.shareLink || trackingData?.shareLink) && (
                      <a href={activeShipment.shareLink || trackingData?.shareLink} target="_blank" rel="noreferrer" className="font-bold text-orange-600 hover:underline">
                        Theo dõi trên Lalamove
                      </a>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Thời điểm giao thực tế</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {activeShipment.deliveredAt
                          ? new Date(activeShipment.deliveredAt).toLocaleString('vi-VN')
                          : 'Chưa hoàn tất giao'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Chặng giao nhận</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-orange-600" />
                      <span>
                        {activeShipment.leg === 'SELLER_TO_CENTER'
                          ? 'Chặng 1: Người Bán ➔ Lab Hub'
                          : activeShipment.leg === 'CENTER_TO_BUYER'
                            ? 'Chặng 2: Lab Hub ➔ Người mua'
                            : activeShipment.leg === 'CENTER_TO_SELLER'
                              ? 'Chặng 2: Hoàn trả ➔ Người bán'
                              : activeShipment.leg === 'SELLER_TO_BUYER'
                                ? 'Giao thẳng (Người Bán ➔ Người Mua)'
                                : activeShipment.leg === 'BUYER_TO_SELLER'
                                  ? 'Hoàn hàng (Người Mua ➔ Người Bán)'
                                  : activeShipment.leg}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logistics Exception & Retry / Refund Banner */}
                {(interruptionDetails || activeShipment.status === 'PENDING_RETRY') && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-tight text-rose-700">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Sự Cố Giao Vận / Vận Đơn Bị Gián Đoạn</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      {interruptionDetails?.description || 'Vận đơn đang chờ xử lý lại do sự cố vận chuyển.'}
                    </p>
                    {canRebookShipment && (
                      <button
                        onClick={handleManualCreateShipment}
                        disabled={isCreatingShipment}
                        className="px-4 py-2 bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                      >
                        {isCreatingShipment ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang kết nối Lalamove...</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Tạo lại vận đơn' : 'Rebook shipment'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}



                {/* Driver Assigned - Loading details fallback */}
                {!trackingData?.driver && effectiveProviderStatus === 'ON_GOING' && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <Truck className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded">
                            Tài xế đã nhận chuyến
                          </span>
                          {activeShipment.driverId && (
                            <span className="text-xs font-mono font-bold text-slate-700">#{activeShipment.driverId}</span>
                          )}
                        </div>
                        <p className="text-xs text-indigo-950 font-semibold mt-0.5">
                          Tài xế Lalamove đang trên đường đến điểm lấy hàng. Đang kết nối tín hiệu tài xế...
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncLalamove}
                      disabled={isSyncing}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Cập nhật</span>
                    </button>
                  </div>
                )}

                {/* Driver Information Card (Section 10.3) */}
                {canShowDriver && trackingData?.driver && (
                  <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase bg-orange-200 text-orange-900 px-2 py-0.5 rounded">
                          Tài xế Lalamove
                        </span>
                        <span className="font-bold text-slate-800 text-xs">Thông tin người vận chuyển</span>
                      </div>
                      {trackingData.shareLink && (
                        <a
                          href={trackingData.shareLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                        >
                          <span>Mở theo dõi Lalamove</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      {trackingData.driver.photo ? (
                        <img
                          src={trackingData.driver.photo}
                          alt={trackingData.driver.name || 'Tài xế'}
                          className="w-12 h-12 rounded-full object-cover border-2 border-orange-300 shadow-xs bg-white"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center font-bold">
                          <User className="w-6 h-6" />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Họ tên tài xế</span>
                          <span className="font-bold text-slate-900 text-xs">{trackingData.driver.name || 'Đang điều phối'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Số điện thoại</span>
                          {trackingData.driver.phone ? (
                            <a href={`tel:${trackingData.driver.phone}`} className="font-bold text-orange-700 hover:underline flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{trackingData.driver.phone}</span>
                            </a>
                          ) : (
                            <span className="font-bold text-slate-400 text-xs">Chưa cập nhật</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Biển số xe</span>
                          <span className="font-bold text-slate-900 text-xs font-mono">{trackingData.driver.plateNumber || 'Chưa cập nhật'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver Live GPS Map (Section 10.4) */}
                <div className="space-y-2">


                  {hasValidCoords ? (
                    <div id="lalamove-driver-map" className="w-full h-56 rounded-2xl border border-gray-200 z-0 shadow-inner" />
                  ) : activeShipment.providerStatus === 'COMPLETED' || activeShipment.status === 'DELIVERED' || activeShipment.deliveredAt ? (
                    <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Chuyến xe Lalamove đã hoàn tất giao hàng thành công!</span>
                      </div>

                    </div>
                  ) : (
                    <span></span>
                  )}
                </div>

                {/* POD Proof of delivery if available */}
                {activeShipment.podUrl && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Camera className="w-5 h-5 text-emerald-700" />
                      <div>
                        <span className="font-bold text-emerald-900 block text-xs">Ảnh chụp tài xế đã giao hàng thành công (POD)</span>
                        <span className="text-[11px] text-emerald-700">Biên bản chữ ký / ảnh bưu kiện tại cửa</span>
                      </div>
                    </div>
                    <a
                      href={activeShipment.podUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs"
                    >
                      <span>Xem ảnh</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Last Error if present */}
                {activeShipment.lastError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Ghi chú tài xế / cảnh báo Lalamove:</span>
                      <span>{translateApiError(activeShipment.lastError)}</span>
                    </div>
                  </div>
                )}
              </div>

              <LalamoveProgress
                routeBadge={returnOnly ? 'Hub → Người bán' : undefined}
                currentStep={currentStep}
                completeCurrentStep={hubProgress ? currentStep === 3 : currentStep === 4}
                finalStep={hubProgress ? undefined : settlementStep}
              />

              {/* Timeline of Events (GET /api/v1/shipments/{id}/events) */}
              <div className="p-5 bg-white rounded-3xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span>Lịch sử sự kiện Lalamove ({groupedEvents.length} mốc tiến trình{events.length > groupedEvents.length ? ` • ${events.length} lần cập nhật` : ''})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Thời gian thực</span>
                </div>

                {/* Banner giải thích trực quan khi đơn đang ở trạng thái ON_GOING */}
                {effectiveProviderStatus === 'ON_GOING' && (
                  <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 animate-fadeIn">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Tài xế đã nhận đơn & đang di chuyển tới lấy hàng.</p>
                      <p className="text-indigo-800 text-[11px] leading-relaxed">
                        Tiến trình tiếp theo <strong>&quot;Đã lấy kiện&quot;</strong> sẽ tự động cập nhật khi tài xế đến lấy hàng và xác nhận trên ứng dụng.
                        Bạn có thể nhấn nút <strong>&quot;Đồng bộ từ Lalamove&quot;</strong> bên dưới để làm mới dữ liệu bất kỳ lúc nào.
                      </p>
                    </div>
                  </div>
                )}

                {groupedEvents.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Chưa có nhật ký sự kiện ghi nhận từ Lalamove. Hệ thống sẽ cập nhật khi tài xế nhận đơn và bắt đầu giao.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {groupedEvents.map((ev) => (
                      <div key={ev.key} className="relative flex items-start gap-3">
                        {/* Dot indicator: Newest event is active pulsing */}
                        {ev.isLatest ? (
                          <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-orange-600 ring-4 ring-orange-100 flex items-center justify-center animate-pulse">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        ) : (
                          <div className="absolute -left-5.5 top-2 w-3 h-3 rounded-full bg-slate-300 border-2 border-white" />
                        )}

                        <div
                          className={`flex-1 p-3.5 rounded-2xl border transition-all ${ev.isLatest
                            ? 'bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-white border-orange-200 shadow-2xs'
                            : 'bg-[#faf8f5] border-gray-200'
                            } space-y-1.5`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${ev.badgeClass}`}>
                                {ev.title}
                              </span>
                              {ev.isLatest && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-600 text-white animate-pulse">
                                  Hiện tại
                                </span>
                              )}
                            </div>

                            <span className="text-slate-500 font-mono text-[10px]">
                              {ev.count > 1 && ev.firstOccurredAt !== ev.lastOccurredAt ? (
                                <span>
                                  Bắt đầu: {new Date(ev.firstOccurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • Lần cuối: {new Date(ev.lastOccurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              ) : (
                                <span>{new Date(ev.firstOccurredAt).toLocaleString('vi-VN')}</span>
                              )}
                            </span>
                          </div>

                          <p className="text-slate-700 text-xs leading-relaxed">
                            {ev.description}
                          </p>

                          {ev.reason && (
                            <p className="text-slate-500 text-[11px] italic bg-white/70 p-2 rounded-xl border border-slate-200/60 mt-1">
                              {ev.reason}
                            </p>
                          )}

                          {ev.count > 1 && (
                            <div className="text-[10px] text-slate-400 font-medium pt-0.5 flex items-center gap-1">
                              <span>Đã đồng bộ tín hiệu {ev.count} lần từ hệ thống đối tác Lalamove</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Print Label Button for Seller */}
                  {/* {onOpenLabelModal && activeShipment && (
                      // <button
                      //   onClick={() => onOpenLabelModal(activeShipment)}
                      //   className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
                      // >
                      //   <Printer className="w-4 h-4 text-orange-600" />
                      //   <span>In Phiếu Gửi Lalamove</span>
                      // </button>
                    )} */}

                  {/* Cancel Shipment Button for Seller (only if before picked) */}
                  {isSeller && !isReturnShipment && !interruption && (hubProgress ? currentStep === 0 : currentStep <= 0) && (
                    <button
                      onClick={handleCancelShipment}
                      disabled={isCancelling}
                      className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer disabled:opacity-50"
                    >
                      {isCancelling ? 'Đang hủy...' : 'Hủy Vận Đơn Lalamove'}
                    </button>
                  )}
                </div>

                {/* Confirm Receipt for Buyer when Delivered (Section 12) */}
                {!hubProgress && (!isSeller || escrowNotice) && (
                  <div>
                    {isReceiptConfirmed && !isSeller ? (
                      <span className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Đơn hàng đã hoàn tất & giải ngân thành công</span>
                      </span>
                    ) : escrowNotice ? (
                      <span className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>
                          {escrowNotice.title}
                          <span className="block font-normal">{escrowNotice.description}</span>
                        </span>
                      </span>
                    ) : escrowOnHold ? null
                      : activeShipment.providerStatus === 'COMPLETED' || activeShipment.status === 'DELIVERED' || activeShipment.deliveredAt || order.shippingDeliveredAt ? (
                        <button
                          onClick={handleConfirmReceived}
                          disabled={isConfirmingDelivered}
                          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-90 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 animate-pulse"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isConfirmingDelivered ? 'Đang giải ngân...' : 'Xác nhận đã nhận hàng'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          (Nút xác nhận nhận hàng sẽ mở sau khi Lalamove hoàn tất giao hàng và quỹ Escrow đang giữ)
                        </span>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
