import React, { useState, useEffect, useRef, type RefObject } from 'react';
import { shippingService, InspectionOrderDto } from '../../../services';
import { ApiError, isUserIdle } from '../../../services/apiClient';
import { UserProfile, ShipmentBackend, CreateShipmentRequestDto } from '../../../types';
import { dialogService } from '../../../utils/dialogService';
import { notifyInspectionCashConfirmed } from '../../../utils/inspectionCashShipping';
import {
  canBookHubBuyerDelivery,
  canReadCenterInspectionShipments,
  getHubBuyerShipmentLabel,
  getInboundShipmentProgress,
  getLatestInboundShipment,
  getLatestInspectionShipment,
  isPaidHubBuyerDelivery,
  shouldTrackInboundShipment,
  getHubReturnProgress,
  getHubReturnState,
  isCenterReturnEligible,
  isHubReturnCase,
  shouldSyncHubReturnOnOpen,
} from '../../../utils/inspectionCenterData';
import { resolveInspectionCenter } from '../../../utils/orderUtils';
import { INBOUND_SHIPMENT_CONCURRENCY } from './shipmentTrackingConfig';
import type { useCenterOrders } from './useCenterOrders';
import type { useCenterProfile } from '../useCenterProfile';

interface Options {
  centerProfile: ReturnType<typeof useCenterProfile>['centerProfile'];
  currentUser: UserProfile | null | undefined;
  loadCenterProfile: ReturnType<typeof useCenterProfile>['loadCenterProfile'];
  loadingShipmentsRef: React.RefObject<boolean>;
  loadOrders: ReturnType<typeof useCenterOrders>['loadOrders'];
  showNotice: (msg: string) => void;
  showOrderShipments: boolean;
  trackedOrders: ReturnType<typeof useCenterOrders>['trackedOrders'];
}

export function useCenterShipments({ centerProfile, currentUser, loadCenterProfile, loadingShipmentsRef, loadOrders, showNotice, showOrderShipments, trackedOrders }: Options) {
  const [deniedShipmentOrders, setDeniedShipmentOrders] = useState<ReadonlySet<string>>(new Set());
  const [inboundShipments, setInboundShipments] = useState<ReadonlyMap<string, ShipmentBackend>>(new Map());
  const [buyerShipments, setBuyerShipments] = useState<ReadonlyMap<string, ShipmentBackend | null>>(new Map());
  const [bookingBuyerOrderId, setBookingBuyerOrderId] = useState<string | null>(null);
  const bookingBuyerOrderRef = useRef<string | null>(null);
  const buyerBookingVersion = useRef(0);
  const buyerBookingRequestIds = useRef(new Map<string, string>());
  const [hubReturns, setHubReturns] = useState<ReadonlyMap<string, ReturnType<typeof getHubReturnState>>>(new Map());
  const [bookingReturnId, setBookingReturnId] = useState<string | null>(null);
  const [returnQuoteOrder, setReturnQuoteOrder] = useState<InspectionOrderDto | null>(null);
  const returnBookingRef = useRef<string | null>(null);
  const returnBookingVersion = useRef(0);
  const returnRequestIds = useRef(new Map<string, string>());
  const [expandedInboundOrderId, setExpandedInboundOrderId] = useState<string | null>(null);
  const [expandedReturnOrderId, setExpandedReturnOrderId] = useState<string | null>(null);
  const [expandedBuyerOrderId, setExpandedBuyerOrderId] = useState<string | null>(null);

  // Helper: Kiểm tra đơn hàng kiểm định tại Hub đã được tiếp nhận kiện hàng thực tế tại trạm hay chưa
  const isOrderReceivedAtHub = (order: any): boolean => {
    if (!order) return false;
    if (order.orderType === 'AT_HOME') return true; // Đơn tại nhà không cần nhận hàng tại Hub
    const s = String(order.status || order.backendStatus || order.escrowStatus || '').toUpperCase();
    if (['RECEIVED_AT_CENTER', 'AWAITING_INSPECTION', 'INSPECTING', 'INSPECTION_IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER'].includes(s)) {
      return true;
    }
    const shipment = inboundShipments.get(order.id);
    if (shipment && (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED')) {
      return true;
    }
    if (typeof window !== 'undefined') {
      if (localStorage.getItem(`hub_package_received_${order.id}`) === 'true') {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (!showOrderShipments) return;

    const trackedIds = new Set(trackedOrders.map((order) => order.id));
    setInboundShipments((previous) => {
      const current = new Map([...previous].filter(([id]) => trackedIds.has(id)));
      return current.size === previous.size ? previous : current;
    });
    setBuyerShipments((previous) => {
      const current = new Map([...previous].filter(([id]) => trackedIds.has(id)));
      return current.size === previous.size ? previous : current;
    });
    setHubReturns((previous) => new Map([...previous].filter(([id]) => trackedIds.has(id))));
    if (trackedOrders.length === 0 || document.hidden || isUserIdle()) return;

    const controller = new AbortController();
    let nextIndex = 0;
    loadingShipmentsRef.current = true;

    const readShipments = async () => {
      while (!controller.signal.aborted && nextIndex < trackedOrders.length) {
        const order = trackedOrders[nextIndex++];
        const orderId = order.id;
        if (deniedShipmentOrders.has(orderId)) continue;
        const bookingVersion = buyerBookingVersion.current;
        const returnVersion = returnBookingVersion.current;
        const modalRequest = shipmentModalRequestRef.current;
        let shipments: ShipmentBackend[];
        try {
          shipments = await shippingService.getInspectionShipments(orderId, {
            signal: controller.signal,
            isBackground: true,
          });
        } catch (error) {
          // Preserve the last known status during transient errors.
          if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) continue;
          if (!controller.signal.aborted) {
            if (error.status === 403) setDeniedShipmentOrders((previous) => new Set(previous).add(orderId));
            setHubReturns((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
            setBuyerShipments((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
            setInboundShipments((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
          }
          continue;
        }
        if (controller.signal.aborted) return;

        if (isHubReturnCase(order) && returnVersion === returnBookingVersion.current) {
          setHubReturns((previous) => new Map(previous).set(orderId, getHubReturnState(shipments)));
          if (returnModalOrderIdRef.current === orderId && modalRequest === shipmentModalRequestRef.current) {
            setInspectionShipments(shipments.filter((shipment) => shipment.leg === 'CENTER_TO_SELLER'));
          }
        }

        const shipment = getLatestInboundShipment(shipments);
        if (isPaidHubBuyerDelivery(order) && bookingVersion === buyerBookingVersion.current) {
          const delivery = getLatestInspectionShipment(shipments, 'CENTER_TO_BUYER');
          setBuyerShipments((previous) => {
            const existing = previous.get(orderId);
            if (previous.has(orderId) && existing?.shipmentId === delivery?.shipmentId &&
              existing?.status === delivery?.status && existing?.providerStatus === delivery?.providerStatus &&
              existing?.orderCode === delivery?.orderCode) return previous;
            return new Map(previous).set(orderId, delivery);
          });
        }
        setInboundShipments((previous) => {
          const existing = previous.get(orderId);
          if (existing?.shipmentId === shipment?.shipmentId &&
            existing?.status === shipment?.status &&
            existing?.providerStatus === shipment?.providerStatus &&
            existing?.cashPayerId === shipment?.cashPayerId &&
            existing?.cashConfirmedAt === shipment?.cashConfirmedAt &&
            existing?.orderCode === shipment?.orderCode) return previous;

          const current = new Map(previous);
          if (shipment) current.set(orderId, shipment);
          else current.delete(orderId);
          return current;
        });
      }
    };

    void Promise.all(Array.from(
      { length: Math.min(INBOUND_SHIPMENT_CONCURRENCY, trackedOrders.length) },
      readShipments,
    )).finally(() => {
      if (!controller.signal.aborted) loadingShipmentsRef.current = false;
    });
    return () => {
      controller.abort();
      loadingShipmentsRef.current = false;
    };
    // A denied ID is skipped on the next polling round without restarting other reads in this one.
  }, [showOrderShipments, trackedOrders]);

  // Inspection Shipment Modal State (GET/POST /api/v1/inspection-orders/{inspectionId}/shipments)
  const [shipmentModalOrder, setShipmentModalOrder] = useState<InspectionOrderDto | null>(null);
  const returnModalOrderIdRef = useRef<string | null>(null);
  const shipmentModalRequestRef = useRef(0);
  const shipmentSyncRequests = useRef(new Map<string, Promise<ShipmentBackend>>());
  const [syncingShipments, setSyncingShipments] = useState<ReadonlySet<string>>(new Set());
  const [inspectionShipments, setInspectionShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [shipmentTab, setShipmentTab] = useState<'tracking' | 'create'>('tracking');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const initialCenter = resolveInspectionCenter();
  const [receiverName, setReceiverName] = useState(initialCenter.name);
  const [receiverPhone, setReceiverPhone] = useState(initialCenter.phone);
  const [receiverAddress, setReceiverAddress] = useState(initialCenter.address);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [shipmentSuccess, setShipmentSuccess] = useState<string | null>(null);
  const canCreateInboundInModal = shipmentModalOrder && canReadCenterInspectionShipments(shipmentModalOrder, currentUser?.id) &&
    shouldTrackInboundShipment(shipmentModalOrder);

  const handleBookReturn = async (order: InspectionOrderDto, maxReturnFee: number): Promise<string | null> => {
    const state = hubReturns.get(order.id);
    if (returnBookingRef.current || !isCenterReturnEligible(order, currentUser?.id, currentUser?.role) ||
      !state?.received || !canBookHubBuyerDelivery(state.shipment)) return 'Đơn hiện chưa sẵn sàng để đặt chuyến trả.';

    returnBookingRef.current = order.id;
    setBookingReturnId(order.id);
    try {
      const key = `hub_return_request_${order.id}_${state.shipment?.shipmentId || 'first'}`;
      let requestId = returnRequestIds.current.get(key);
      if (!requestId) {
        try { requestId = localStorage.getItem(key) || undefined; } catch { }
        requestId ||= crypto.randomUUID();
        returnRequestIds.current.set(key, requestId);
        try { localStorage.setItem(key, requestId); } catch { }
      }

      returnBookingVersion.current++;
      try {
        const shipment = await shippingService.createInspectionShipment(order.id, { requestId, leg: 'CENTER_TO_SELLER', maxReturnFee });
        setHubReturns((previous) => new Map(previous).set(order.id, { received: true, shipment }));
        if (['CANCELLED', 'FAILED'].includes(shipment.status)) {
          return shipment.lastError || getHubReturnProgress(shipment).label;
        }
        setReturnQuoteOrder(null);
        showNotice(getHubReturnProgress(shipment).label);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không tạo được vận đơn trả người bán.';
        return error instanceof ApiError && error.status === 403
          ? 'Trung tâm không phụ trách đơn hoặc tài khoản thiếu quyền.'
          : error instanceof ApiError && error.status === 409 && /vượt.*dự phòng/i.test(message)
            ? 'Cước chiều về vượt khoản dự phòng đã thu, cần xử lý chênh lệch trước khi đặt chuyến.'
            : message;
      } finally {
        try {
          const shipments = await shippingService.getInspectionShipments(order.id);
          try {
            if (Array.isArray(shipments) && shipments.length > 0) {
              localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(shipments));
              localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(shipments));
            }
          } catch { }
          returnBookingVersion.current++;
          setHubReturns((previous) => new Map(previous).set(order.id, getHubReturnState(shipments)));
        } catch { }
        await loadOrders(true);
      }
    } finally {
      returnBookingRef.current = null;
      setBookingReturnId(null);
    }
  };

  const handleBookBuyerDelivery = async (order: InspectionOrderDto) => {
    const previousShipment = buyerShipments.get(order.id);
    if (bookingBuyerOrderRef.current || !isPaidHubBuyerDelivery(order) || !canBookHubBuyerDelivery(previousShipment)) return;
    bookingBuyerOrderRef.current = order.id;
    setBookingBuyerOrderId(order.id);
    try {
      const confirmed = await dialogService.confirm(
        `Tạo vận đơn Lalamove giao “${order.postTitle || 'sản phẩm'}” từ Hub đến ${order.buyerName || 'người mua'} theo báo giá đã thanh toán?`,
        { title: 'Giao hàng từ Hub đến người mua', confirmText: 'Tạo vận đơn' },
      );
      if (!confirmed) return;

      // Keep the same request ID if a submission needs to be retried.
      const key = `hub_delivery_request_${order.id}_${previousShipment?.shipmentId || 'first'}`;
      let requestId = buyerBookingRequestIds.current.get(key);
      if (!requestId) {
        try { requestId = sessionStorage.getItem(key) || undefined; } catch { }
        requestId ||= crypto.randomUUID();
        buyerBookingRequestIds.current.set(key, requestId);
        try { sessionStorage.setItem(key, requestId); } catch { }
      }

      const shipment = await shippingService.createInspectionShipment(order.id, {
        requestId,
        leg: 'CENTER_TO_BUYER',
      });
      buyerBookingVersion.current++;
      setBuyerShipments((previous) => new Map(previous).set(order.id, shipment));
      try {
        const raw = localStorage.getItem(`sl_order_shipments_${order.id}`) || localStorage.getItem(`order_shipments_${order.id}`);
        const parsed = raw ? JSON.parse(raw) : [];
        const updated = Array.isArray(parsed) ? [shipment, ...parsed.filter((s: any) => s.shipmentId !== shipment.shipmentId)] : [shipment];
        localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(updated));
        localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(updated));
      } catch { }
      showNotice(shipment.orderCode
        ? `Đã tạo vận đơn giao người mua #${shipment.orderCode}`
        : getHubBuyerShipmentLabel(shipment));
    } catch (error) {
      void dialogService.error(error instanceof Error ? error.message : 'Không tạo được vận đơn giao người mua.');
    } finally {
      bookingBuyerOrderRef.current = null;
      setBookingBuyerOrderId(null);
    }
  };

  const updateAddressesForLeg = (
    ord: InspectionOrderDto,
    profile = centerProfile
  ) => {
    // Lấy chính xác thông tin vị trí trung tâm kiểm định của đơn hàng hoặc tài khoản quản lý (không hardcode)
    const center = resolveInspectionCenter({
      ...ord,
      inspectionCenterName: (currentUser as any)?.centerName || currentUser?.name || (ord as any).inspectionCenterName,
      inspectionCenterAddress: (currentUser as any)?.address || (ord as any).inspectionCenterAddress,
      inspectionCenterPhone: (currentUser as any)?.phone || (ord as any).inspectionCenterPhone,
    });
    const assignedProfile = profile && (!ord.inspectionCenterId || ord.inspectionCenterId === profile.id)
      ? profile
      : null;
    const hubName = assignedProfile?.name || center.name;
    const hubPhone = assignedProfile?.phone || center.phone;
    const hubAddress = assignedProfile?.address || center.address;

    const sName = ord.sellerName || 'Người bán';
    const sPhone = (ord as any).sellerPhone || (ord as any).phone || '0912345678';
    const sAddress = (ord as any).sellerAddress || (ord as any).address || (ord as any).location || 'Địa chỉ kho người bán';

    setSenderName(sName);
    setSenderPhone(sPhone);
    setSenderAddress(sAddress);
    setReceiverName(hubName);
    setReceiverPhone(hubPhone);
    setReceiverAddress(hubAddress);
  };

  const handleSyncCenterShipment = async (orderId: string, shipment: ShipmentBackend, modalRequest: number) => {
    const shipmentId = shipment.shipmentId;
    if (!shipment.orderCode || !shipmentId) return;
    let pending = shipmentSyncRequests.current.get(shipmentId);
    if (!pending) {
      setSyncingShipments((previous) => new Set(previous).add(shipmentId));
      pending = shippingService.syncShipment(shipmentId).then((synced) => {
        if (synced?.shipmentId !== shipmentId) throw new Error('Máy chủ chưa trả về vận đơn đã đồng bộ.');

        if (shipment.leg === 'CENTER_TO_SELLER') {
          if (!shipment.cashConfirmedAt && synced.cashConfirmedAt) notifyInspectionCashConfirmed();
          returnBookingVersion.current++;
          setHubReturns((previous) => {
            const state = previous.get(orderId);
            return state?.shipment?.shipmentId === shipmentId
              ? new Map(previous).set(orderId, { ...state, shipment: synced }) : previous;
          });
          if (synced.status === 'DELIVERED') void loadOrders(true);
        } else if (shipment.leg === 'CENTER_TO_BUYER') {
          buyerBookingVersion.current++;
          setBuyerShipments((previous) => previous.get(orderId)?.shipmentId === shipmentId
            ? new Map(previous).set(orderId, synced) : previous);
        } else if (shipment.leg === 'SELLER_TO_CENTER') {
          setInboundShipments((previous) => previous.get(orderId)?.shipmentId === shipmentId
            ? new Map(previous).set(orderId, synced) : previous);
        }
        return synced;
      }).finally(() => {
        shipmentSyncRequests.current.delete(shipmentId);
        setSyncingShipments((previous) => {
          const next = new Set(previous);
          next.delete(shipmentId);
          return next;
        });
      });
      shipmentSyncRequests.current.set(shipmentId, pending);
    }

    setShipmentError(null);
    setShipmentSuccess(null);
    try {
      const synced = await pending;
      if (modalRequest !== shipmentModalRequestRef.current) return;
      setInspectionShipments((previous) => previous.map((item) => item.shipmentId === shipmentId ? { ...item, ...synced } : item));
      setShipmentSuccess(shipment.leg === 'CENTER_TO_SELLER'
        ? `Đã đồng bộ Lalamove · ${getHubReturnProgress(synced).label}` : 'Đã đồng bộ trạng thái từ Lalamove.');
    } catch (error) {
      if (modalRequest !== shipmentModalRequestRef.current) return;
      const reason = error instanceof Error ? error.message : '';
      setShipmentError(reason ? `Không đồng bộ được vận đơn Lalamove. ${reason}` : 'Không đồng bộ được vận đơn Lalamove.');
    }
  };

  const closeShipmentModal = () => {
    returnModalOrderIdRef.current = null;
    shipmentModalRequestRef.current++;
    setShipmentModalOrder(null);
  };

  const handleOpenShipmentModal = async (ord: InspectionOrderDto) => {
    const request = ++shipmentModalRequestRef.current;
    const returnDelivery = isHubReturnCase(ord);
    returnModalOrderIdRef.current = null;
    setShipmentModalOrder(ord);
    setInspectionShipments([]);
    setShipmentTab('tracking');
    setShipmentError(null);
    setShipmentSuccess(null);

    if (!canReadCenterInspectionShipments(ord, currentUser?.id)) {
      setShipmentError('Trung tâm chưa có quyền xem vận đơn của đơn kiểm định này.');
      setIsLoadingShipments(false);
      return;
    }

    if (returnDelivery) returnModalOrderIdRef.current = ord.id;
    const buyerDelivery = isPaidHubBuyerDelivery(ord);
    if (!returnDelivery && !buyerDelivery) updateAddressesForLeg(ord);
    setIsLoadingShipments(true);
    try {
      const [list, profile] = await Promise.all([
        shippingService.getInspectionShipments(ord.id),
        returnDelivery || buyerDelivery || centerProfile ? Promise.resolve(centerProfile) : loadCenterProfile(),
      ]);
      if (request !== shipmentModalRequestRef.current) return;
      if (returnDelivery || buyerDelivery) {
        const leg = returnDelivery ? 'CENTER_TO_SELLER' : 'CENTER_TO_BUYER';
        setInspectionShipments(list.filter((shipment) => shipment.leg === leg));
        if (returnDelivery) {
          const returnState = getHubReturnState(list);
          setHubReturns((previous) => new Map(previous).set(ord.id, returnState));
          if (shouldSyncHubReturnOnOpen(returnState.shipment)) {
            void handleSyncCenterShipment(ord.id, returnState.shipment, request);
          }
        }
      } else {
        if (profile) updateAddressesForLeg(ord, profile);
        const inbound = list.filter((shipment) => shipment.leg === 'SELLER_TO_CENTER');
        setInspectionShipments(inbound);
        setShipmentTab(inbound.length === 0 && shouldTrackInboundShipment(ord) ? 'create' : 'tracking');
      }
    } catch (error) {
      if (request === shipmentModalRequestRef.current) setShipmentError(error instanceof Error ? error.message : 'Không tải được vận đơn kiểm định.');
    } finally {
      if (request === shipmentModalRequestRef.current) setIsLoadingShipments(false);
    }
  };

  const handleCreateInspectionShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentModalOrder || !canCreateInboundInModal) return;
    setIsCreatingShipment(true);
    setShipmentError(null);
    setShipmentSuccess(null);

    const cleanPhone = (p: string, def: string) => {
      const d = (p || '').replace(/\D/g, '');
      if (/^(?:0|84)\d{9,10}$/.test(d)) return d.startsWith('84') ? '0' + d.slice(2) : d;
      return def;
    };

    const sName = senderName.trim() || 'Người gửi';
    const sPhone = cleanPhone(senderPhone, '0912345678');
    const rName = receiverName.trim() || 'Người nhận';
    const rPhone = cleanPhone(receiverPhone, '0908123456');

    const assignedProfile = centerProfile &&
      (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id)
      ? centerProfile : null;
    const hubCoords = assignedProfile?.latitude != null && assignedProfile?.longitude != null
      ? { latitude: assignedProfile.latitude, longitude: assignedProfile.longitude }
      : { latitude: 10.8415, longitude: 106.8098 };
    const payload: CreateShipmentRequestDto = {
      requestId: crypto.randomUUID(),
      leg: 'SELLER_TO_CENTER',
      fromAddress: { name: sName, phone: sPhone, latitude: 10.7769, longitude: 106.7009 },
      toAddress: { name: rName, phone: rPhone, ...hubCoords },
      reason: 'Điều phối vận đơn Hub: SELLER_TO_CENTER',
    };

    try {
      const created = await shippingService.createInspectionShipment(shipmentModalOrder.id, payload);
      setInspectionShipments((previous) => [created, ...previous.filter((item) => item.shipmentId !== created.shipmentId)]);
      setShipmentTab('tracking');
      if (created.lastError) setShipmentError(created.lastError);
      else if (created.orderCode && created.status !== 'CANCELLED') setShipmentSuccess(`Đã tạo vận đơn #${created.orderCode}`);
      else setShipmentSuccess(getInboundShipmentProgress(created).label);
    } catch (error) {
      setShipmentError(error instanceof Error ? error.message : 'Không thể tạo vận đơn kiểm định.');
    } finally {
      setIsCreatingShipment(false);
    }
  };

  return {
    bookingBuyerOrderId,
    bookingReturnId,
    buyerShipments,
    canCreateInboundInModal,
    closeShipmentModal,
    deniedShipmentOrders,
    expandedBuyerOrderId,
    expandedInboundOrderId,
    expandedReturnOrderId,
    handleBookBuyerDelivery,
    handleBookReturn,
    handleCreateInspectionShipment,
    handleOpenShipmentModal,
    handleSyncCenterShipment,
    hubReturns,
    inboundShipments,
    inspectionShipments,
    isCreatingShipment,
    isLoadingShipments,
    isOrderReceivedAtHub,
    receiverAddress,
    receiverName,
    receiverPhone,
    returnQuoteOrder,
    senderAddress,
    senderName,
    senderPhone,
    setDeniedShipmentOrders,
    setExpandedBuyerOrderId,
    setExpandedInboundOrderId,
    setExpandedReturnOrderId,
    setReceiverAddress,
    setReceiverName,
    setReceiverPhone,
    setReturnQuoteOrder,
    setSenderAddress,
    setSenderName,
    setSenderPhone,
    setShipmentError,
    setShipmentSuccess,
    setShipmentTab,
    shipmentError,
    shipmentModalOrder,
    shipmentModalRequestRef,
    shipmentSuccess,
    shipmentTab,
    syncingShipments,
  };
}
