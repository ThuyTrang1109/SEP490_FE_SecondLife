import React, { useState, useEffect, useMemo } from 'react';
import { EscrowOrder, Language, UserRole, UserProfile } from '../types';
import { EscrowOrderFilters, EscrowOrderPagination } from '../components/orders/EscrowOrderFilters';
import { ORDER_FILTER_TABS, readOrderFeedQuery, type OrderFeedQuery, type OrderFilterTab } from '../utils/escrowOrderFilters';
import type { OrderFeed } from '../services/orderFeedService';
import { formatVND } from '../utils/translations';
import {
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Package,
  Store,
  User,
  Wallet,
  Scale,
} from 'lucide-react';
import { ProductReviewModal } from '../components/modals/ProductReviewModal';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { OrderTrackingModal } from '../components/modals/OrderTrackingModal';
import { CreateShipmentModal } from '../components/modals/CreateShipmentModal';
import { InspectionCashShipmentStatus } from '../components/inspection/InspectionCashShipmentStatus';
import { ShippingLabelModal } from '../components/modals/ShippingLabelModal';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionSealVerificationModal } from '../components/modals/InspectionSealVerificationModal';
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { ShipmentBackend, OrderSettlementDTO, OrderCommissionDTO } from '../types';
import { orderService } from '../services/orderService';
import { inspectorService } from '../services/inspectorService';
import { UserReportModal } from '../components/modals/UserReportModal';
import { InspectionProductQRModal } from '../components/modals/InspectionProductQRModal';
import { VietQrEscrowModal } from '../components/modals/VietQrEscrowModal';
import { isInspectionPaymentExpired } from '../utils/inspectionPaymentDeadline';
import { buyerInspectionStageLabel, getBuyerInspectionStage, getInspectionPurchaseDecision, inspectionPurchaseDecisionLabel, isExpiredInspectionPurchase } from '../utils/inspectionPurchase';
import { getHubReturnProgress, getHubReturnState, getInboundShipmentProgress } from '../utils/inspectionCenterData';
import { resolveOrderListing } from '../utils/catalogCache';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { OrderCard } from '../components/orders/card/OrderCard';
import { OrderDetailModal } from '../components/orders/detail/OrderDetailModal';
import { useOrderDetailData } from '../hooks/orders/useOrderDetailData';
import { useOrderInboundShipments } from '../hooks/orders/useOrderInboundShipments';
import { OrderDetailHeader } from '../components/orders/detail/OrderDetailHeader';
import { OrderDetailProduct } from '../components/orders/detail/OrderDetailProduct';
import { OrderDetailDirectShipping } from '../components/orders/detail/OrderDetailDirectShipping';
import { OrderDeliveryJourney } from '../components/orders/detail/OrderDeliveryJourney';
import { OrderDetailCertificate } from '../components/orders/detail/OrderDetailCertificate';
import { OrderDetailPhotos } from '../components/orders/detail/OrderDetailPhotos';
import { OrderFeeBreakdown } from '../components/orders/detail/OrderFeeBreakdown';
import { OrderSettlement } from '../components/orders/detail/OrderSettlement';
import { OrderDetailActions } from '../components/orders/detail/OrderDetailActions';
import { createInspectionOrderActions } from '../actions/orders/createInspectionOrderActions';
import { createSellerOrderActions } from '../actions/orders/createSellerOrderActions';
import { createOrderCancellationActions } from '../actions/orders/createOrderCancellationActions';
import { createAppointmentActions } from '../actions/orders/createAppointmentActions';
import { useOrderBankPayment } from '../hooks/orders/useOrderBankPayment';
import { useOrderReviews } from '../hooks/orders/useOrderReviews';
import { useEscrowOrdersNavigation } from '../hooks/orders/useEscrowOrdersNavigation';
import { OrderActionDialog } from '../components/orders/OrderActionDialog';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import type { ConfirmDialogState } from '../types/orders/orderTypes';
import { getOrderAllShipments, isHubInboundInProgress } from '../utils/orders/shipmentCache';
import { getAtHomeDeliveryStage } from '../utils/orders/orderReceipt';
import { readOrderAppointment } from '../utils/orders/orderAppointments';
import { getCommissionPayout, getInspectionPayoutPreview, getOrderFinanceLookup, getSettlementPayout, type SellerPayoutData } from '../utils/orders/orderFinance';
import { isOrderWithInspection } from '../utils/orders/orderReceipt';

export { getOrderAllShipments } from '../utils/orders/shipmentCache';
interface EscrowOrdersViewProps {
  orders: EscrowOrder[];
  overviewOrders: EscrowOrder[];
  routeOrder: EscrowOrder | null;
  filterQuery: OrderFeedQuery;
  filterResult?: OrderFeed;
  filterCounts?: OrderFeed['counts'];
  filterFailed: boolean;
  currentUser?: UserProfile | null;
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  onMarkShipped?: (orderId: string) => void;
  onCancelOrder?: (
    orderId: string,
    cancelData?: { reasonCode: 'BUYER_REQUESTED' | 'SELLER_OUT_OF_STOCK' | 'SELLER_CANNOT_FULFILL'; reason: string }
  ) => void;
  onRefreshOrders?: () => void;
  onRefreshFilter: () => void;
  lang: Language;
  userRole?: UserRole;
  onOpenChat?: (listing: any, roomId?: string) => void;
  onOpenInspectionDecision?: (order: EscrowOrder) => void;
  onNavigateToDisputes?: () => void;
  isLoading?: boolean;
}

export const VALID_ORDER_FILTER_TABS = ORDER_FILTER_TABS;
export const ORDER_TAB_STORAGE_KEY = 'secondlife_orders_filter_tab';
export function getInitialOrderFilterTab(): OrderFilterTab {
  return typeof window === 'undefined' ? 'all' : readOrderFeedQuery(window.location.href).filter;
}

export { getSortableOrderTimestamp } from '../utils/orderUtils';

export const EscrowOrdersView: React.FC<EscrowOrdersViewProps> = ({
  orders,
  overviewOrders,
  routeOrder,
  filterQuery,
  filterResult,
  filterCounts,
  filterFailed,
  currentUser,
  onConfirmReceipt,
  onOpenDispute,
  onMarkShipped,
  onCancelOrder,
  onRefreshOrders,
  onRefreshFilter,
  lang,
  userRole = 'buyer',
  onOpenChat,
  onOpenInspectionDecision,
  onNavigateToDisputes,
  isLoading = false,
}) => {

  const isOrderSeller = (ord: EscrowOrder) => {
    if (orderPerspective === 'seller') return true;
    if (orderPerspective === 'buyer') return false;

    if (currentUser?.id) {
      if (ord.sellerId && String(ord.sellerId) === String(currentUser.id)) return true;
      if (ord.listing?.sellerId && String(ord.listing.sellerId) === String(currentUser.id)) return true;
      if ((ord.listing as any)?.userId && String((ord.listing as any).userId) === String(currentUser.id)) return true;
      if ((ord.listing as any)?.user?.id && String((ord.listing as any).user.id) === String(currentUser.id)) return true;
      if (ord.buyerId && String(ord.buyerId) === String(currentUser.id)) return false;
    }
    const activeUserName = ((currentUser as any)?.fullName || currentUser?.name || '').trim().toLowerCase();
    const activeEmail = (currentUser?.email || '').trim().toLowerCase();
    const ordSellerName = (ord.sellerName || ord.listing?.sellerName || '').trim().toLowerCase();
    const ordBuyerName = (ord.buyerName || '').trim().toLowerCase();
    const ordSellerEmail = ((ord as any).sellerEmail || (ord.listing as any)?.sellerEmail || '').trim().toLowerCase();
    const ordBuyerEmail = ((ord as any).buyerEmail || '').trim().toLowerCase();

    if (activeUserName && ordSellerName && ordSellerName === activeUserName) return true;
    if (activeEmail && ordSellerEmail && ordSellerEmail === activeEmail) return true;
    if (activeUserName && ordBuyerName && ordBuyerName === activeUserName) return false;
    if (activeEmail && ordBuyerEmail && ordBuyerEmail === activeEmail) return false;

    if (userRole === 'seller' && (!ord.buyerId || String(ord.buyerId) !== String(currentUser?.id))) {
      return true;
    }

    return false;
  };

  const resolvedOrders = useMemo(() => {
    return (overviewOrders || []).map((ord) => {
      if (!ord) return ord;
      let finalOrd = ord;

      // Đọc trạng thái đóng gói bền vững (sellerReadyAt / seller_ready / seller_shipped_to_hub / order_packed)
      if (typeof window !== 'undefined' && ord.id) {
        try {
          const storedReadyAt = localStorage.getItem(`seller_ready_${ord.id}`);
          const isShippedToHub = localStorage.getItem(`seller_shipped_to_hub_${ord.id}`) === 'true';
          const isPacked = localStorage.getItem(`order_packed_${ord.id}`) === 'true';
          if (!finalOrd.sellerReadyAt && (storedReadyAt || isShippedToHub || isPacked)) {
            finalOrd = {
              ...finalOrd,
              sellerReadyAt: storedReadyAt || new Date().toISOString(),
            };
          }
        } catch { }
      }

      // Kiểm tra trạng thái hủy từ localStorage nếu backend chưa đồng bộ
      if (typeof window !== 'undefined' && ord.id) {
        try {
          const rawCancel = localStorage.getItem(`order_cancellation_info_${ord.id}`);
          const isCancelledFlag = localStorage.getItem(`order_cancelled_${ord.id}`) === 'true';
          const activeInspectionStatuses = [
            'WAITING_SELLER_APPROVAL',
            'WAITING_BUYER_APPROVAL',
            'WAITING_FEE_PAYMENT',
            'CONFIRMED_PENDING_DISPATCH',
            'DISPATCHED',
            'SCHEDULED',
            'SHIPPING_TO_CENTER',
            'INSPECTING',
            'PASSED',
            'DELIVERING_TO_BUYER',
          ];
          const backend = String((ord as any).backendStatus || '').toUpperCase();
          const status = String((ord as any).status || '').toUpperCase();
          const isActivelyProcessing = activeInspectionStatuses.includes(backend) || activeInspectionStatuses.includes(status);

          if (!isActivelyProcessing && (rawCancel || isCancelledFlag) && !isOrderReceiptConfirmed(ord)) {
            const parsedCancel = rawCancel ? JSON.parse(rawCancel) : null;
            finalOrd = {
              ...finalOrd,
              escrowStatus: 'REFUNDED_TO_BUYER',
              backendStatus: 'CANCELLED' as any,
              status: 'CANCELLED',
              cancellationReasonCode: parsedCancel?.reasonCode || 'SELLER_CONFIRMATION_TIMEOUT',
              cancellationReason: parsedCancel?.reason || 'Đơn hàng đã tự động hủy và hoàn tiền 100% về ví do hết hạn xác nhận hoặc người mua/người bán hủy đơn.',
            };
          }
        } catch { }
      }

      let resolvedListing = finalOrd.listing;
      if (!resolvedListing || !resolvedListing.title) {
        try {
          const rawOrderListing = localStorage.getItem(`order_listing_${finalOrd.id}`);
          if (rawOrderListing) {
            resolvedListing = JSON.parse(rawOrderListing);
          }
        } catch { }
      }
      if (!resolvedListing || !resolvedListing.title) {
        try {
          const lid = finalOrd.listingId || (finalOrd as any).postId;
          if (lid) {
            const rawPost = localStorage.getItem(`cached_post_${lid}`);
            if (rawPost) resolvedListing = JSON.parse(rawPost);
          }
        } catch { }
      }

      if (!resolvedListing || !resolvedListing.title) {
        resolvedListing = {
          id: finalOrd.listingId || finalOrd.id,
          title: (finalOrd as any).postTitle || 'Thiết bị gia dụng SecondLife',
          category: 'Nội thất & Gia dụng',
          brand: 'SecondLife',
          model: 'Standard',
          purchaseYear: 2024,
          priceVnd: finalOrd.itemPriceVnd || finalOrd.totalPaidVnd || 0,
          conditionGrade: 'Good',
          declaredConditionText: 'Đã bảo lãnh Escrow',
          description: 'Giao dịch qua sàn SecondLife',
          location: 'Hà Nội',
          sellerId: finalOrd.sellerId || '',
          sellerName: finalOrd.sellerName || 'Người bán SecondLife',
          sellerRating: 5.0,
          sellerCompletedOrders: 3,
          sellerVerified: true,
          status: 'reserved',
          createdAt: finalOrd.createdAt,
          isInspectionGuaranteed: true,
          requiresInspection: false,
          photos: {
            front: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
            back: '',
            screenOrDetails: '',
            accessoriesOrBox: '',
            serialOrReceipt: ''
          },
          photoGallery: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800']
        };
      }

      return {
        ...finalOrd,
        listing: resolveOrderListing(resolvedListing),
      };
    });
  }, [overviewOrders]);

  const userOrders = useMemo(() => {
    if (!currentUser?.id) return resolvedOrders;
    return resolvedOrders.filter((ord) => {
      if (userRole === 'admin' || currentUser.role === 'admin' || currentUser.role === 'inspector' || currentUser.role === 'inspection_center') {
        return true;
      }
      const activeUserName = ((currentUser as any)?.fullName || currentUser?.name || '').trim().toLowerCase();
      const activeEmail = (currentUser.email || '').trim().toLowerCase();
      const ordBuyerName = (ord.buyerName || '').trim().toLowerCase();
      const ordSellerName = (ord.sellerName || ord.listing?.sellerName || '').trim().toLowerCase();
      const ordSellerEmail = ((ord as any).sellerEmail || (ord.listing as any)?.sellerEmail || '').trim().toLowerCase();
      const ordBuyerEmail = ((ord as any).buyerEmail || '').trim().toLowerCase();

      const isBuyer = (ord.buyerId && String(ord.buyerId) === String(currentUser.id)) ||
        (ord.buyerId === 'buyer-current') ||
        (activeUserName && ordBuyerName === activeUserName) ||
        (activeEmail && ordBuyerEmail && ordBuyerEmail === activeEmail);
      const isSeller = (ord.sellerId && String(ord.sellerId) === String(currentUser.id)) ||
        (ord.listing?.sellerId && String(ord.listing.sellerId) === String(currentUser.id)) ||
        ((ord.listing as any)?.userId && String((ord.listing as any).userId) === String(currentUser.id)) ||
        ((ord.listing as any)?.user?.id && String((ord.listing as any).user.id) === String(currentUser.id)) ||
        (activeUserName && ordSellerName === activeUserName) ||
        (activeEmail && ordSellerEmail && ordSellerEmail === activeEmail) ||
        (userRole === 'seller' && !isBuyer);
      return isBuyer || isSeller;
    });
  }, [resolvedOrders, currentUser, userRole]);

  const orderPerspective = filterQuery.perspective;
  const authoritativeOrders = useMemo(() => new Set([
    ...orders.map(({ id }) => id),
    ...(routeOrder ? [routeOrder.id] : []),
  ]), [orders, routeOrder]);
  const buyerOrdersCount = userOrders.filter(o => !isOrderSeller(o)).length;
  const sellerOrdersCount = userOrders.filter(o => isOrderSeller(o)).length;
  const isSellerView = orderPerspective === 'seller' || (orderPerspective === 'all' && (userRole === 'seller' || sellerOrdersCount > 0));
  const isSeller = isSellerView;

  const {
    activeTab, updateQuery, setActiveTab, setOrderPerspective,
    searchQuery, setSearchQuery, searching, detailModalOrder, setDetailModalOrder,
  } = useEscrowOrdersNavigation({
    filterQuery, currentRole: currentUser?.role, userRole, orders, routeOrder, isLoading,
  });
  const findOrderForAction = (id: string) =>
    orders.find((order) => order.id === id) ??
    (detailModalOrder?.id === id ? detailModalOrder : userOrders.find((order) => order.id === id));
  const autoPaidOrderIdsRef = React.useRef<Set<string>>(new Set());

  // Tự động nộp phí kiểm định vào Escrow cho Người mua nếu đơn ở trạng thái WAITING_FEE_PAYMENT
  // (Người mua đã chọn thanh toán qua Ví Escrow tại checkout)
  React.useEffect(() => {
    if (!userOrders || userOrders.length === 0) return;

    userOrders.forEach((ord) => {
      const bStatus = String((ord as any)?.backendStatus || (ord as any)?.status || '').toUpperCase();
      const isBuyer = !isOrderSeller(ord);
      const hasInsp = Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0));

      const deadline = ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline;
      const isFeeExpired = isInspectionPaymentExpired(deadline);
      const buyerFee = getPartyInspectionFee(ord, false);
      const isSeller100 = ord.inspectionFeeSplit === 'SELLER_100' || buyerFee <= 0;

      if (isBuyer && hasInsp && bStatus === 'WAITING_FEE_PAYMENT' && !isFeeExpired && !isSeller100 && buyerFee > 0 && !autoPaidOrderIdsRef.current.has(ord.id)) {
        autoPaidOrderIdsRef.current.add(ord.id);
        inspectorService.payInspectionFee(ord.id)
          .then((res) => {
            console.log('Auto payInspectionFee success for order:', ord.id, res);
            onRefreshOrders?.();
          })
          .catch((err) => {
            console.warn('Auto payInspectionFee notice:', err);
            onRefreshOrders?.();
          });
      }
    });
  }, [userOrders]);
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('listing');
  const [orderFinancialData, setOrderFinancialData] = useState<{
    orderId: string;
    resource: 'settlement' | 'commission';
    settlement?: OrderSettlementDTO;
    commission?: OrderCommissionDTO;
  } | null>(null);

  // Map of payout and commission data fetched from backend API per order
  const [payoutDataMap, setPayoutDataMap] = useState<Record<string, SellerPayoutData>>({});

  // Force update when appointment status changes realtime
  const [, setApptTick] = useState<number>(0);

  // Theo dõi KTV đã quét mã tiếp nhận đến nhà kiểm tra hay chưa
  const [arrivedOrderIds, setArrivedOrderIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('at_home_inspector_arrived_')) {
            set.add(key.replace('at_home_inspector_arrived_', ''));
          } else if (key?.startsWith('order_inspecting_') && localStorage.getItem(key) === 'true') {
            set.add(key.replace('order_inspecting_', ''));
          } else if (key?.startsWith('inspection_status_') && localStorage.getItem(key) === 'INSPECTING') {
            set.add(key.replace('inspection_status_', ''));
          }
        }
        const rawSync = localStorage.getItem('secondlife_inspector_arrived_sync');
        if (rawSync) {
          const data = JSON.parse(rawSync);
          if (data?.targetIds && Array.isArray(data.targetIds)) {
            data.targetIds.forEach((id: string) => set.add(id));
          }
        }
      }
    } catch { }
    return set;
  });

  useEffect(() => {
    const handler = (e: any) => {
      const orderId = e?.detail?.orderId || (e?.key?.startsWith('at_home_inspector_arrived_') ? e.key.replace('at_home_inspector_arrived_', '') : null);
      if (orderId) {
        setArrivedOrderIds((prev) => new Set(prev).add(orderId));
      }
      if (e?.detail?.targetIds && Array.isArray(e.detail.targetIds)) {
        setArrivedOrderIds((prev) => {
          const next = new Set(prev);
          e.detail.targetIds.forEach((id: string) => next.add(id));
          return next;
        });
      }
      if (e?.key === 'secondlife_inspector_arrived_sync' || e?.key?.startsWith('at_home_inspector_arrived_') || e?.key?.startsWith('order_inspecting_') || e?.key?.startsWith('inspection_status_')) {
        try {
          const raw = localStorage.getItem('secondlife_inspector_arrived_sync');
          if (raw) {
            const data = JSON.parse(raw);
            if (data?.targetIds && Array.isArray(data.targetIds)) {
              setArrivedOrderIds((prev) => {
                const next = new Set(prev);
                data.targetIds.forEach((id: string) => next.add(id));
                return next;
              });
            }
          }
        } catch { }
        setApptTick((t) => t + 1);
        onRefreshOrders?.();
      }
      if (e?.key?.startsWith('order_appointment_') || e?.key?.startsWith('recent_placed_orders')) {
        setApptTick((t) => t + 1);
      }
    };
    window.addEventListener('secondlife_inspector_arrived', handler);
    window.addEventListener('storage', handler);

    const handleApptSignal = (e?: any) => {
      const d = e?.detail;
      if (d?.orderId && d?.counterScheduledAt) {
        const targetIds = [d.orderId, d.linkedOrderId].filter(Boolean);
        targetIds.forEach((tid) => {
          try {
            const raw = localStorage.getItem(`order_appointment_${tid}`);
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem(`order_appointment_${tid}`, JSON.stringify({
              ...prev,
              status: 'COUNTERED_BY_CENTER',
              counterScheduledAt: d.counterScheduledAt,
              counterShift: d.counterShift,
              counterNote: d.counterNote,
            }));
          } catch { }
        });
        setDetailModalOrder((prev) => {
          if (!prev) return null;
          const ids = [prev.id, (prev as any).linkedOrderId, (prev as any).inspectionOrderId].filter(Boolean);
          if (ids.includes(d.orderId) || (d.linkedOrderId && ids.includes(d.linkedOrderId))) {
            return {
              ...prev,
              appointmentStatus: 'COUNTERED_BY_CENTER',
              counterScheduledAt: d.counterScheduledAt,
              counterShift: d.counterShift,
              counterNote: d.counterNote,
            };
          }
          return prev;
        });
      } else if (d?.orderId && d?.scheduledAt) {
        setDetailModalOrder((prev) => {
          if (!prev) return null;
          const ids = [prev.id, (prev as any).linkedOrderId, (prev as any).inspectionOrderId].filter(Boolean);
          if (ids.includes(d.orderId) || (d.linkedOrderId && ids.includes(d.linkedOrderId)) || (d.inspectionOrderId && ids.includes(d.inspectionOrderId))) {
            return {
              ...prev,
              appointmentScheduledAt: d.scheduledAt,
              appointmentShift: d.shift || 'MORNING',
              appointmentNote: d.note || '',
              appointmentStatus: d.status || 'PENDING_CENTER_CONFIRMATION',
              counterScheduledAt: null,
              counterShift: null,
              counterNote: null,
            };
          }
          return prev;
        });
      }
      setApptTick((t) => t + 1);
      onRefreshOrders?.();
    };
    window.addEventListener('secondlife_appointment_rejected', handleApptSignal);
    window.addEventListener('secondlife_order_assigned_signal', handleApptSignal);
    window.addEventListener('secondlife_appointment_scheduled', handleApptSignal);
    window.addEventListener('secondlife_appointment_confirmed', handleApptSignal);
    window.addEventListener('secondlife_appointment_countered', handleApptSignal);

    return () => {
      window.removeEventListener('secondlife_inspector_arrived', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('secondlife_appointment_rejected', handleApptSignal);
      window.removeEventListener('secondlife_order_assigned_signal', handleApptSignal);
      window.removeEventListener('secondlife_appointment_scheduled', handleApptSignal);
      window.removeEventListener('secondlife_appointment_confirmed', handleApptSignal);
      window.removeEventListener('secondlife_appointment_countered', handleApptSignal);
    };
  }, []);

  const isInspectorArrivedForOrder = (orderId: string, ord?: any): boolean => {
    const isCompleted =
      ord?.status === 'PASSED' || ord?.status === 'FAILED' ||
      ord?.backendStatus === 'PASSED' || ord?.backendStatus === 'FAILED' ||
      ord?.escrowStatus === 'INSPECTION_PASSED' || ord?.escrowStatus === 'INSPECTION_FAILED' ||
      ord?.escrowStatus === 'COMPLETED_RELEASED' || ord?.escrowStatus === 'REFUNDED_TO_BUYER' ||
      (ord as any)?.inspectionOrder?.status === 'PASSED' || (ord as any)?.inspectionOrder?.status === 'FAILED' ||
      Boolean(ord?.finalPaymentPaidAt) || Boolean(ord?.tamperSealId);
    if (isCompleted) return false;

    const ids = [
      orderId,
      ord?.id,
      ord?.linkedOrderId,
      ord?.inspectionOrderId,
      ord?.orderId,
      (ord as any)?.inspectionOrder?.id,
      (ord as any)?.inspectionOrder?.linkedOrderId,
      (ord as any)?.inspectionOrder?.orderId,
    ].filter(Boolean) as string[];

    for (const id of ids) {
      if (arrivedOrderIds.has(id)) return true;
      if (typeof window !== 'undefined') {
        if (localStorage.getItem(`at_home_inspector_arrived_${id}`)) return true;
        if (localStorage.getItem(`order_inspecting_${id}`) === 'true') return true;
        if (localStorage.getItem(`inspection_status_${id}`) === 'INSPECTING') return true;
      }
    }

    return Boolean(
      ord?.inspectionStatus === 'INSPECTING' ||
      ord?.status === 'INSPECTING' ||
      ord?.backendStatus === 'INSPECTING' ||
      ord?.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      (ord as any)?.inspectionOrder?.status === 'INSPECTING' ||
      ord?.homeCheckedInAt ||
      (ord as any)?.inspectionOrder?.homeCheckedInAt
    );
  };

  React.useEffect(() => {
    if (activePhotoStage === 'handover') {
      setActivePhotoStage('listing');
    } else if (detailModalOrder && !isOrderWithInspection(detailModalOrder) && activePhotoStage === 'inspector') {
      setActivePhotoStage('listing');
    }
  }, [detailModalOrder, activePhotoStage]);

  React.useEffect(() => {
    if (!detailModalOrder) return;
    const freshOrder = orders.find(
      (order) => order.id === detailModalOrder.id || (order as any).linkedOrderId === detailModalOrder.id
    );
    if (freshOrder) {
      setDetailModalOrder((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...freshOrder,
          ...((prev as any).appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !(freshOrder as any).counterScheduledAt ? {
            appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
            appointmentScheduledAt: prev.appointmentScheduledAt,
            appointmentShift: (prev as any).appointmentShift,
            appointmentNote: prev.appointmentNote,
            counterScheduledAt: null,
            counterShift: null,
            counterNote: null,
          } : {})
        };
      });
    }
  }, [orders]);

  const detailFinance = detailModalOrder && isOrderSeller(detailModalOrder) ? getOrderFinanceLookup(detailModalOrder) : null;
  const financeOrderId = detailFinance?.orderId;
  const financeResource = detailFinance?.resource;
  const financeRowId = detailModalOrder?.id;
  const displayedFinancialData = orderFinancialData?.orderId === financeOrderId &&
    orderFinancialData?.resource === financeResource ? orderFinancialData : null;

  React.useEffect(() => {
    setOrderFinancialData(null);
    if (!financeOrderId || !financeResource || !financeRowId) return;
    let active = true;
    const target = { orderId: financeOrderId, resource: financeResource };

    const load = async () => {
      try {
        if (financeResource === 'settlement') {
          const settlement = await orderService.getOrderSettlement(financeOrderId);
          if (!active) return;
          setOrderFinancialData({ ...target, settlement });
          const payout = getSettlementPayout(settlement);
          if (payout) {
            setPayoutDataMap((previous) => ({
              ...previous,
              [financeRowId]: payout,
            }));
          }
        } else {
          const commission = await orderService.getOrderCommission(financeOrderId);
          if (!active) return;
          setOrderFinancialData({ ...target, commission });
          const payout = getCommissionPayout(commission);
          if (payout) {
            setPayoutDataMap((previous) => ({
              ...previous,
              [financeRowId]: payout,
            }));
          }
        }
      } catch {
        if (active) setOrderFinancialData(target);
      }
    };

    void load();
    return () => { active = false; };
  }, [financeOrderId, financeResource, financeRowId]);

  // Each order has its own commission snapshot; one order's rate cannot be applied to another.
  const sellerFinanceRequests = JSON.stringify(orders.flatMap((order) => {
    if (!isOrderSeller(order)) return [];
    const lookup = getOrderFinanceLookup(order);
    return lookup ? [{ rowId: order.id, ...lookup }] : [];
  }));
  React.useEffect(() => {
    let active = true;
    const requests: Array<{ rowId: string; orderId: string; resource: 'settlement' | 'commission' }> = JSON.parse(sellerFinanceRequests);
    setPayoutDataMap({});
    for (const target of requests) {
      const load = target.resource === 'settlement'
        ? orderService.getOrderSettlement(target.orderId).then(getSettlementPayout)
        : orderService.getOrderCommission(target.orderId).then(getCommissionPayout);
      void load.then((payout) => {
        if (active && payout) setPayoutDataMap((previous) => ({ ...previous, [target.rowId]: payout }));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [sellerFinanceRequests, currentUser?.id]);

  // Real Backend Shipments for Detail Modal
  const detailOrderId = detailModalOrder?.id;
  const detailLinkedOrderId = (detailModalOrder as any)?.linkedOrderId || (detailModalOrder as any)?.inspectionOrderId;
  const detailIsInspection = Boolean(detailModalOrder?.inspectionStatus || detailModalOrder?.hasInspectionService);
  const detailHasInspection = detailIsInspection || Boolean(
    detailModalOrder?.inspectionMethod ||
    detailModalOrder?.inspectionCenterId ||
    (detailModalOrder && detailModalOrder.inspectionFeeVnd > 0)
  );
  const {
    detailShipments, setDetailShipments, isLoadingDetailShipments,
    detailInspectionDto, setDetailInspectionDto,
    expandedDetailLeg1, setExpandedDetailLeg1, expandedDetailLeg2, setExpandedDetailLeg2,
  } = useOrderDetailData(detailOrderId, detailIsInspection, setApptTick, detailLinkedOrderId);
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | undefined>(undefined);

  // Lalamove Shipping Modals state
  const [trackingSelection, setTrackingOrder] = useState<EscrowOrder | null>(null);
  const trackingOrder = orders.find((order) => order.id === trackingSelection?.id) ?? trackingSelection;
  const detailBuyerInspectionStage = detailModalOrder && !isOrderSeller(detailModalOrder)
    ? getBuyerInspectionStage(detailModalOrder)
    : null;
  const [createShipmentOrder, setCreateShipmentOrder] = useState<EscrowOrder | null>(null);
  const { getOrderInboundShipment, saveSellerInboundShipment, inboundLoadingOrders, sellerInboundShipments } = useOrderInboundShipments({
    userId: currentUser?.id,
    userOrders,
    trackingOrderId: trackingOrder?.id,
    createShipmentOrderId: createShipmentOrder?.id,
    detailOrderId,
    detailShipments,
  });
  const detailInboundShipment = detailModalOrder?.inspectionMethod === 'AT_CENTER'
    ? getOrderInboundShipment(detailModalOrder)
    : null;
  const detailInboundProgress = detailInboundShipment ? getInboundShipmentProgress(detailInboundShipment, lang) : null;
  const detailHasInboundTracking = Boolean(detailModalOrder && detailInboundProgress && isHubInboundInProgress(detailModalOrder));
  const getSellerInboundLabel = (order: EscrowOrder) => {
    if (order.inspectionMethod !== 'AT_CENTER') return null;
    const shipment = getOrderInboundShipment(order);
    if (shipment) return getInboundShipmentProgress(shipment, lang).label;
    const status = order.inspectionStatus || order.backendStatus;
    if (status === 'SHIPPING_TO_CENTER') return lang === 'vi' ? 'Đang giao hàng đến Hub' : 'On the way to Hub';
    if (['RECEIVED_AT_CENTER', 'INSPECTING', 'PASSED', 'FAILED', 'DELIVERING_TO_BUYER', 'COMPLETED'].includes(status || '')) {
      return lang === 'vi' ? 'Hub đã tiếp nhận hàng' : 'Received at Hub';
    }
    return null;
  };
  const detailInboundLabel = detailInboundProgress?.label ?? (detailModalOrder && getSellerInboundLabel(detailModalOrder));
  const [activeLabelShipment, setActiveLabelShipment] = useState<{ order: EscrowOrder; shipment: ShipmentBackend } | null>(null);
  const [certificateModalOrder, setCertificateModalOrder] = useState<EscrowOrder | null>(null);
  const [appealModalOrder, setAppealModalOrder] = useState<EscrowOrder | null>(null);
  const [verifySealId, setVerifySealId] = useState<string>('');
  const [isVerifySealModalOpen, setIsVerifySealModalOpen] = useState(false);
  const [printSealOrder, setPrintSealOrder] = useState<EscrowOrder | null>(null);
  const [printInspectionQrOrder, setPrintInspectionQrOrder] = useState<EscrowOrder | null>(null);
  const [inspectionActionNotice, _setInspectionActionNotice] = useState<string | null>(null);
  const setInspectionActionNotice = (msg: string | null) => {
    _setInspectionActionNotice(msg ? translateSystemNotification(msg) : null);
  };
  const [reportingOrder, setReportingOrder] = useState<EscrowOrder | null>(null);
  const [localReadyOrderIds, setLocalReadyOrderIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            if (key.startsWith('seller_ready_')) {
              set.add(key.replace('seller_ready_', ''));
            } else if (key.startsWith('seller_shipped_to_hub_')) {
              set.add(key.replace('seller_shipped_to_hub_', ''));
            } else if (key.startsWith('order_packed_')) {
              set.add(key.replace('order_packed_', ''));
            }
          }
        }
      } catch { }
    }
    return set;
  });
  const [confirmingReceiptIds, setConfirmingReceiptIds] = useState<Set<string>>(new Set());


  const isOrderUnpaid = (ord: EscrowOrder): boolean => {
    if (!ord) return false;
    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String(ord.backendStatus || '').toUpperCase();

    // Đã thanh toán / Đang xử lý / Đang giao / Hoàn tất
    if (
      escrow === 'HELD_IN_ESCROW' ||
      escrow === 'COMPLETED_RELEASED' ||
      escrow === 'SHIPPED_TO_BUYER' ||
      escrow === 'DELIVERED_INSPECTION_WINDOW' ||
      escrow === 'INSPECTION_IN_PROGRESS' ||
      escrow === 'INSPECTION_PASSED' ||
      backend === 'PROCESSING' ||
      backend === 'CONFIRMED_PENDING_DISPATCH' ||
      backend === 'DISPATCHED' ||
      backend === 'SHIPPING_TO_CENTER' ||
      backend === 'SHIPPED' ||
      backend === 'DELIVERED' ||
      backend === 'COMPLETED'
    ) {
      return false;
    }

    // Đã hủy / Đã hoàn tiền / Đã từ chối / Hết hạn
    if (
      escrow === 'REFUNDED_TO_BUYER' ||
      escrow === 'REFUNDED' ||
      escrow === 'CANCELLED' ||
      escrow === 'CANCELED' ||
      backend === 'CANCELLED' ||
      backend === 'CANCELED' ||
      backend === 'REFUNDED' ||
      backend === 'REJECTED' ||
      backend === 'FAILED' ||
      backend === 'PAYMENT_EXPIRED'
    ) {
      return false;
    }

    // CHỈ coi là chưa thanh toán khi đang chờ thanh toán tiền hàng Escrow ban đầu
    return (escrow === 'AWAITING_PAYMENT' || backend === 'PENDING_PAYMENT' || backend === 'AWAITING_PAYMENT') && backend !== 'WAITING_FEE_PAYMENT';
  };

  const isOrderReceiptConfirmed = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord) return false;
    if (!isOrderSeller(ord) && getBuyerInspectionStage(ord)) return false;
    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String((ord as any).backendStatus || '').toUpperCase();
    const status = String((ord as any).status || '').toUpperCase();

    if (
      escrow === 'COMPLETED_RELEASED' ||
      escrow === 'RELEASED' ||
      escrow === 'COMPLETED' ||
      backend === 'COMPLETED' ||
      backend === 'RELEASED' ||
      status === 'COMPLETED' ||
      status === 'RELEASED' ||
      Boolean((ord as any).buyerConfirmedAt) ||
      Boolean((ord as any).buyer_confirmed_at) ||
      Boolean((ord as any).releasedAt) ||
      Boolean((ord as any).released_at)
    ) {
      if (typeof window !== 'undefined' && ord.id) {
        try {
          localStorage.setItem(`order_receipt_confirmed_${ord.id}`, 'true');
          localStorage.removeItem(`order_cancellation_info_${ord.id}`);
        } catch { }
      }
      return true;
    }

    if (!authoritativeOrders.has(ord.id) && typeof window !== 'undefined' && ord.id) {
      try {
        if (localStorage.getItem(`order_receipt_confirmed_${ord.id}`) === 'true') {
          return true;
        }
      } catch { }
    }

    return false;
  };

  const isOrderSellerConfirmed = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord) return false;
    const hasInsp = Boolean(
      ord.hasInspectionService ||
      (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) ||
      ord.inspectionCenterId ||
      ord.inspectionMethod ||
      (ord as any).orderType ||
      (ord as any).inspectionStatus ||
      (ord as any).inspectionOrder
    );
    if (hasInsp) {
      const rawStatus = String(
        (ord as any).backendStatus ||
        (ord as any).inspectionStatus ||
        (ord as any).inspectionOrder?.status ||
        ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') ||
        ''
      ).toUpperCase();
      if (
        rawStatus === 'WAITING_SELLER_APPROVAL' ||
        rawStatus === 'WAITING_BUYER_APPROVAL' ||
        rawStatus === 'PENDING'
      ) {
        return false;
      }
    }
    if (ord.sellerConfirmedAt || ord.confirmationStatus === 'CONFIRMED') return true;
    if (hasInsp) {
      const rawStatus = String(
        (ord as any).backendStatus ||
        (ord as any).inspectionStatus ||
        (ord as any).inspectionOrder?.status ||
        ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') ||
        ''
      ).toUpperCase();
      if (
        rawStatus &&
        rawStatus !== 'WAITING_SELLER_APPROVAL' &&
        rawStatus !== 'WAITING_BUYER_APPROVAL' &&
        rawStatus !== 'PENDING'
      ) {
        return true;
      }
    }
    return false;
  };

  const getInspectionFeeSplit = (ord: EscrowOrder | null | undefined): 'SPLIT_50_50' | 'SELLER_100' | 'BUYER_100' => {
    if (!ord) return 'BUYER_100';
    const currentInspection = detailInspectionDto?.id === ord.id ? detailInspectionDto : null;
    const fp = currentInspection?.feePayer || ord.feePayer || (ord as any).counterFeePayer || (ord as any).inspectionOrder?.feePayer;
    if (fp === 'SELLER_PAYS') return 'SELLER_100';
    if (fp === 'SPLIT_50_50') return 'SPLIT_50_50';
    if (fp === 'BUYER_PAYS') return 'BUYER_100';
    if (ord.inspectionFeeSplit) return ord.inspectionFeeSplit;
    const sShare = currentInspection?.sellerFeeShare ?? ord.sellerFeeShare;
    const bShare = currentInspection?.buyerFeeShare ?? ord.buyerFeeShare;
    if (sShare !== undefined && sShare > 0 && bShare !== undefined && bShare > 0) return 'SPLIT_50_50';
    if (sShare !== undefined && sShare > 0) return 'SELLER_100';
    return 'BUYER_100';
  };

  const getPartyInspectionFee = (ord: EscrowOrder | null | undefined, isSeller: boolean): number => {
    if (!ord) return 0;
    const currentInspection = detailInspectionDto?.id === ord.id ? detailInspectionDto : ord;
    if (isSeller) {
      if (currentInspection.sellerFeeShare !== undefined && currentInspection.sellerFeeShare !== null) {
        return Number(currentInspection.sellerFeeShare);
      }
      if (ord.sellerFeeShare !== undefined && ord.sellerFeeShare !== null) {
        return Number(ord.sellerFeeShare);
      }
      if (ord.sellerInspectionFeeVnd !== undefined && ord.sellerInspectionFeeVnd !== null) {
        return Number(ord.sellerInspectionFeeVnd);
      }
    } else {
      if (currentInspection.buyerFeeShare !== undefined && currentInspection.buyerFeeShare !== null) {
        return Number(currentInspection.buyerFeeShare) + Number((currentInspection as any).buyerCommitmentDeposit ?? 0);
      }
      if (ord.buyerFeeShare !== undefined && ord.buyerFeeShare !== null) {
        return Number(ord.buyerFeeShare) + Number(ord.buyerCommitmentDeposit ?? 0);
      }
      if (ord.buyerInspectionFeeVnd !== undefined && ord.buyerInspectionFeeVnd !== null) {
        return Number(ord.buyerInspectionFeeVnd) + Number(ord.buyerCommitmentDeposit ?? 0);
      }
    }
    const total = Number(ord.inspectionFeeVnd || (ord as any).inspectionFee || 0);
    const split = getInspectionFeeSplit(ord);

    if (isSeller) {
      if (split === 'SELLER_100') return total;
      if (split === 'SPLIT_50_50') return Math.round(total / 2);
      return 0;
    } else {
      if (split === 'BUYER_100') return total;
      if (split === 'SPLIT_50_50') return Math.round(total / 2);
      return 0;
    }
  };

  const isPartyInspectionFeePaid = (ord: EscrowOrder | null | undefined, isSeller: boolean): boolean => {
    if (!ord) return false;
    const currentInspection = detailInspectionDto?.id === ord.id ? detailInspectionDto : null;
    if (isSeller) {
      return Boolean(currentInspection?.sellerPaidAt || ord.sellerPaidAt || (ord as any).seller_paid_at);
    } else {
      return Boolean(currentInspection?.buyerPaidAt || ord.buyerPaidAt || (ord as any).buyer_paid_at);
    }
  };

  const isPartyInspectionFeePending = (ord: EscrowOrder | null | undefined, isSeller: boolean): boolean => {
    if (!ord) return false;
    const bStatus = String((ord as any).backendStatus || (ord as any).status || '').toUpperCase();
    if (bStatus !== 'WAITING_FEE_PAYMENT') return false;
    const feeOwed = getPartyInspectionFee(ord, isSeller);
    if (feeOwed <= 0) return false;
    return !isPartyInspectionFeePaid(ord, isSeller);
  };

  const isOrderPacked = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord?.id) return false;
    // Đơn hàng chỉ thực sự được coi là đã đóng gói chờ shipper khi đã có vận đơn Lalamove
    return isShipmentCreatedForOrder(ord);
  };

  const isShipmentCreatedForOrder = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord?.id) return false;

    // Đơn hàng kiểm định đang ở giai đoạn chờ phê duyệt hoặc chờ hai bên nộp phí thì chưa thể có vận đơn đóng gói
    const rawInspStatus = String(
      (ord as any)?.backendStatus ||
      (ord as any)?.inspectionStatus ||
      (ord as any)?.inspectionOrder?.status ||
      ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') ||
      ''
    ).toUpperCase();
    if (['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING'].includes(rawInspStatus)) {
      return false;
    }

    if (ord.inspectionMethod === 'AT_HOME') return getAtHomeDeliveryStage(ord) !== 'awaiting_shipment';

    if (sellerInboundShipments.has(ord.id) && isHubInboundInProgress(ord)) {
      return Boolean(sellerInboundShipments.get(ord.id));
    }
    const bStatus = String((ord as any).backendStatus || (ord as any).status || ord.escrowStatus || '').toUpperCase();
    if (
      ord.carrierPickedUpAt ||
      (ord as any).orderShipmentCode ||
      (ord as any).trackingCode ||
      (ord as any).waybillCode ||
      bStatus === 'SHIPPED' ||
      bStatus === 'DELIVERED' ||
      bStatus === 'DELIVERING_TO_BUYER' ||
      bStatus === 'SHIPPED_TO_BUYER'
    ) return true;
    if (ord.shippingLegs?.some((leg) => leg.status === 'IN_TRANSIT' || leg.status === 'COMPLETED' || Boolean((leg as any).trackingCode))) return true;
    const linkedId = (ord as any).linkedOrderId || (ord as any).inspectionOrderId;
    if (
      (detailModalOrder?.id === ord.id || (linkedId && detailModalOrder?.id === linkedId) || (detailModalOrder?.linkedOrderId && detailModalOrder.linkedOrderId === ord.id)) &&
      detailShipments.some((s) => s.status !== 'CANCELLED')
    ) {
      return true;
    }
    try {
      if (typeof window !== 'undefined') {
        const ids = [ord.id, linkedId].filter(Boolean) as string[];
        for (const id of ids) {
          if (localStorage.getItem(`order_shipment_created_${id}`) === 'true') return true;
          if (localStorage.getItem(`order_packed_${id}`) === 'true') return true;
          if (localStorage.getItem(`order_shipments_${id}`)) return true;
          if (localStorage.getItem(`sl_order_shipments_${id}`)) return true;
          if (localStorage.getItem(`sl_insp_shipments_${id}`)) return true;
        }
      }
    } catch { }
    return false;
  };

  const isOrderCancelledOrRefunded = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord) return false;
    if (isOrderReceiptConfirmed(ord)) {
      return false;
    }

    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String((ord as any).backendStatus || '').toUpperCase();
    const status = String((ord as any).status || '').toUpperCase();
    if (authoritativeOrders.has(ord.id)) return escrow === 'REFUNDED_TO_BUYER';

    // Các trạng thái đang được xử lý thực tế tuyệt đối không coi là đơn hủy
    const activeInspectionStatuses = [
      'WAITING_SELLER_APPROVAL',
      'WAITING_BUYER_APPROVAL',
      'WAITING_FEE_PAYMENT',
      'CONFIRMED_PENDING_DISPATCH',
      'DISPATCHED',
      'SCHEDULED',
      'SHIPPING_TO_CENTER',
      'INSPECTING',
      'PASSED',
      'DELIVERING_TO_BUYER',
    ];
    if (activeInspectionStatuses.includes(backend) || activeInspectionStatuses.includes(status)) {
      return false;
    }

    // Nếu đơn đã giải ngân, hoàn tất, đã giao hàng, hoặc người mua đã xác nhận thì TUYỆT ĐỐI KHÔNG coi là đơn hủy
    if (
      escrow === 'COMPLETED_RELEASED' ||
      escrow === 'RELEASED' ||
      escrow === 'COMPLETED' ||
      backend === 'COMPLETED' ||
      backend === 'RELEASED' ||
      status === 'COMPLETED' ||
      Boolean((ord as any).releasedAt) ||
      Boolean((ord as any).released_at) ||
      Boolean(ord.shippingDeliveredAt)
    ) {
      return false;
    }

    // Kiểm tra trực tiếp metadata hủy đơn trong localStorage
    if (typeof window !== 'undefined' && ord.id) {
      try {
        if (
          localStorage.getItem(`order_cancellation_info_${ord.id}`) ||
          localStorage.getItem(`order_cancelled_${ord.id}`) === 'true'
        ) {
          return true;
        }
      } catch { }
    }

    const inspStatus = String((ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || '').toUpperCase();
    return (
      escrow === 'REFUNDED_TO_BUYER' ||
      escrow === 'REFUNDED' ||
      escrow === 'CANCELLED' ||
      escrow === 'CANCELED' ||
      backend === 'CANCELLED' ||
      backend === 'CANCELED' ||
      backend === 'REFUNDED' ||
      backend === 'FAILED' ||
      backend === 'PAYMENT_EXPIRED' ||
      backend === 'REJECTED' ||
      status === 'CANCELLED' ||
      status === 'CANCELED' ||
      status === 'REJECTED' ||
      inspStatus === 'CANCELLED' ||
      inspStatus === 'CANCELED' ||
      inspStatus === 'REJECTED'
    );
  };

  const { bankPaymentOrder, setBankPaymentOrder, bankPaymentInfo, setBankPaymentInfo, loadingBankPaymentId, handleOpenBankPaymentModal } = useOrderBankPayment();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  const { handleAcceptFailedInspection, handleRespondInspection, handlePayInspectionFee, handleConfirmInspectionPurchase } = createInspectionOrderActions({
    lang, detailModalOrder, setDetailModalOrder, onRefreshOrders, setInspectionActionNotice, setOrderActionLoading,
    findOrderForAction, getPartyInspectionFee, orders, isOrderSeller, isSeller, setConfirmDialog,
  });
  const renderInspectionDecision = (order: EscrowOrder, close?: () => void) => {
    const isInsideDetailModal = Boolean(close);
    const decision = getInspectionPurchaseDecision(order);
    const failed = order.inspectionStatus === 'FAILED' || order.escrowStatus === 'INSPECTION_FAILED';
    const expired = isExpiredInspectionPurchase(order.inspectionStatus, order.inspectionNote);
    if (!decision && !failed && !expired) return null;
    // Khi người mua đã xác nhận mua tiếp: Trạng thái đã hiển thị đầy đủ ở huy hiệu trên đầu thẻ đơn (OrderStatusBadge).
    // Ngoài danh sách thẻ đơn không hiển thị lặp lại nhãn tĩnh ở thanh thao tác.
    if (decision === 'accepted' && !isInsideDetailModal) return null;
    // Khi đơn kiểm định không đạt (failed) hoặc người mua từ chối mua tiếp (rejected):
    // Trạng thái chi tiết (chờ hoàn / đang hoàn / đã hoàn trả)
    // đã hiển thị đầy đủ ở huy hiệu trên đầu thẻ (OrderStatusBadge) và trong khối hành trình Chặng 2.
    // Bỏ nhãn tĩnh ở góc dưới thanh thao tác để đồng bộ và gọn gàng.
    if ((failed || decision === 'rejected') && !isInsideDetailModal) return null;
    const isSeller = isOrderSeller(order);
    const canDecide = decision === 'pending' && !isSeller && !isOrderCancelledOrRefunded(order);
    const returnShipment = detailOrderId === order.id && close
      ? getHubReturnState(detailShipments.length > 0 ? detailShipments : getOrderAllShipments(order.id)).shipment
      : null;

    // Trong modal Xem Chi Tiết: Luôn hiển thị nút xem kết quả kiểm định / quyết định mua nếu có handler
    // Ngoài giao diện chính (danh sách thẻ đơn): Bỏ nút tra cứu kết quả "Xem kết quả kiểm định", chỉ hiện nút nếu đang chờ người mua quyết định mua
    const shouldShowButton = isInsideDetailModal
      ? Boolean(onOpenInspectionDecision || canDecide)
      : canDecide;

    // Khi người mua đang chờ quyết định (decision === 'pending' && !isSeller):
    // Huy hiệu trạng thái trên đầu thẻ (OrderStatusBadge) đã nêu rõ "Kiểm định ĐẠT • Chờ bạn quyết định mua",
    // đồng thời nút hành động "Xem kết quả & quyết định mua" đã hiển thị đầy đủ,
    // nên nhãn tĩnh "Chờ quyết định từ bạn" ở góc dưới cạnh nút bị trùng lặp, cần loại bỏ.
    // Tương tự khi failed, không hiển thị nhãn trạng thái ở góc dưới.
    const shouldShowDecisionBadge = !isInsideDetailModal && !failed && !(decision === 'pending' && !isSeller);

    if (!shouldShowDecisionBadge && !returnShipment && !shouldShowButton) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {shouldShowDecisionBadge && (
          <span className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${failed ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}>
            {failed ? buyerInspectionStageLabel('failed', lang, isSeller) : expired
              ? (lang === 'vi' ? 'Đã hủy do hết hạn thanh toán' : 'Cancelled after payment expired')
              : decision && inspectionPurchaseDecisionLabel(decision, lang, isSeller)}
          </span>
        )}
        {!isInsideDetailModal && returnShipment && (
          <button type="button" onClick={() => {
            if (isOrderSeller(order)) { close?.(); setTrackingOrder(order); }
            else if (onOpenInspectionDecision) { close?.(); onOpenInspectionDecision(order); }
          }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:underline cursor-pointer">
            {getHubReturnProgress(returnShipment, lang).label}
          </button>
        )}
        {!isInsideDetailModal && returnShipment && <InspectionCashShipmentStatus shipment={returnShipment} />}
        {shouldShowButton && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              close?.();
              if (onOpenInspectionDecision) onOpenInspectionDecision(order);
              else handleConfirmInspectionPurchase(order.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer shadow-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {canDecide
              ? (lang === 'vi' ? 'Xem kết quả & quyết định mua' : 'Review & decide')
              : (lang === 'vi' ? 'Xem kết quả kiểm định' : 'View inspection report')}
          </button>
        )}
      </div>
    );
  };

  const { handlePromptRejectInspection, handleSellerConfirmOrder, handleSellerMarkReadyForPickup } = createSellerOrderActions({
    lang, detailModalOrder, setDetailModalOrder, onRefreshOrders, setInspectionActionNotice, setOrderActionLoading,
    findOrderForAction, getPartyInspectionFee, handleRespondInspection, getInspectionFeeSplit, setConfirmDialog,
    setLocalReadyOrderIds, setDetailShipments,
  });
  const { handlePromptCancelOrder, handlePromptCancelInspectionRequest } = createOrderCancellationActions({
    lang, isOrderSeller, setConfirmDialog, onCancelOrder, detailModalOrder, setDetailModalOrder, setActiveTab,
  });
  const [schedulingOrder, setSchedulingOrder] = useState<EscrowOrder | null>(null);
  const [schedulingReadOnly, setSchedulingReadOnly] = useState<boolean>(false);

  const getOrderAppointment = (order: EscrowOrder) => readOrderAppointment(order, detailInspectionDto);
  const { handleSellerAcceptCounterAppointment } = createAppointmentActions({
    setApptTick, setInspectionActionNotice, onRefreshOrders,
  });
  const {
    reviewModalOrder, setReviewModalOrder, sellerReviewsModalData, setSellerReviewsModalData, reviewedOrderIds, handleReviewSubmit,
  } = useOrderReviews();
  const [pickupConfirmedNotice, _setPickupConfirmedNotice] = useState<string | null>(null);
  const setPickupConfirmedNotice = (msg: string | null) => {
    _setPickupConfirmedNotice(msg ? translateSystemNotification(msg) : null);
  };
  const [shippingLabelOrder, setShippingLabelOrder] = useState<EscrowOrder | null>(null);

  const handleConfirmCourierPickup = (orderId: string) => {
    setPickupConfirmedNotice(`Đã lên lịch thành công! Tài xế Lalamove sẽ đến địa chỉ kho lấy máy #${orderId} giao đến Hub trong hôm nay.`);
    setTimeout(() => setPickupConfirmedNotice(null), 5000);
  };

  // Seller metrics
  const pendingEscrowTotal = useMemo(() => {
    const pending = userOrders.filter((o) => isOrderSeller(o) && o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER');
    if (pending.some((o) => payoutDataMap[o.id] === undefined)) return null;
    return pending.reduce((sum, o) => sum + payoutDataMap[o.id].sellerPayout, 0);
  }, [userOrders, payoutDataMap, orderPerspective, currentUser?.id]);

  const awaitingPickupCount = userOrders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = userOrders.filter(
    (o) =>
      o.escrowStatus === 'AWAITING_INSPECTION' ||
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
  ).length;
  const completedPaidCount = userOrders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  const getStatusBadge = (status: string, hasInspection?: boolean, isCurrentOrderSeller?: boolean, orderItem?: EscrowOrder) => (
    <OrderStatusBadge
      status={status}
      hasInspection={hasInspection}
      isCurrentOrderSeller={isCurrentOrderSeller}
      orderItem={orderItem}
      lang={lang}
      isSeller={isSeller}
      isOrderCancelledOrRefunded={isOrderCancelledOrRefunded}
      isOrderSellerConfirmed={isOrderSellerConfirmed}
      getOrderInboundShipment={getOrderInboundShipment}
      inboundLoadingOrders={inboundLoadingOrders}
      isInspectorArrivedForOrder={isInspectorArrivedForOrder}
      getOrderAppointment={getOrderAppointment}
      autoPaidOrderIds={autoPaidOrderIdsRef.current}
      isPartyInspectionFeePending={isPartyInspectionFeePending}
      getPartyInspectionFee={getPartyInspectionFee}
      isPartyInspectionFeePaid={isPartyInspectionFeePaid}
    />
  );

  return (
    <div className="space-y-6 pb-16 text-[#24263e]">
      {/* Perspective switcher (Tất cả / Đơn Tôi Mua / Đơn Tôi Bán) */}
      {((sellerOrdersCount > 0 && buyerOrdersCount > 0) || orderPerspective !== 'all') && (
        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setOrderPerspective('all')}
            aria-pressed={orderPerspective === 'all'}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${orderPerspective === 'all'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <span>{lang === 'vi' ? 'Tất Cả' : 'All'} ({userOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setOrderPerspective('buyer')}
            aria-pressed={orderPerspective === 'buyer'}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${orderPerspective === 'buyer'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đơn Tôi Mua' : 'My Purchases'} ({buyerOrdersCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setOrderPerspective('seller')}
            aria-pressed={orderPerspective === 'seller'}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${orderPerspective === 'seller'
              ? 'bg-[#c34c36] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đơn Tôi Bán' : 'My Sales'} ({sellerOrdersCount})</span>
          </button>
        </div>
      )}

      {/* Top Banner: Switch between Buyer and Seller mode */}
      {isSellerView ? (
        <div className="space-y-4">
          <div className="bg-[#fce5da] text-[#24263e] rounded-3xl p-6 sm:p-7 shadow-xl border border-[#24263e]/15 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-[#24263e] text-xs font-bold border border-[#24263e]/15 shadow-xs">
                  <Store className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{lang === 'vi' ? 'Kênh Người Bán SecondLife • Quản Lý Đơn Hàng' : 'SecondLife Seller Center • Order Management'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#24263e] mt-2">
                  {lang === 'vi' ? 'Quản Lý Đơn Bán Hàng & Dòng Tiền Escrow' : 'Seller Orders & Escrow Payouts'}
                </h1>
                <p className="text-xs sm:text-sm text-[#24263e]/80 mt-1 font-semibold">
                  {lang === 'vi'
                    ? 'Theo dõi lịch bưu tá đến kho lấy hàng chuyển đến Hub, kết quả kiểm định kỹ thuật và đối soát tiền giải ngân vào ví người bán.'
                    : 'Track courier pickup schedules to Hub, technical inspection results, and automated escrow payouts to seller wallet.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-2 rounded-xl bg-white/80 text-[#24263e] border border-[#24263e]/15 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span>{lang === 'vi' ? 'Bảo Lãnh Escrow' : 'Escrow Protection'}</span>
                </span>
              </div>
            </div>

            {/* Seller Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#24263e]/15">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Tiền Chờ Giải Ngân (Escrow)' : 'Pending Escrow Payout'}
                </div>
                <div className="text-lg sm:text-xl font-black text-[#24263e] mt-0.5">
                  {pendingEscrowTotal === null ? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Unavailable') : formatVND(pendingEscrowTotal)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Tự động giải ngân sau giao' : 'Auto-released after delivery'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Cần Giao Bưu Tá (Kho lấy)' : 'Awaiting Courier Pickup'}
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">
                  {awaitingPickupCount} {lang === 'vi' ? 'Đơn' : 'Orders'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Hẹn tài xế Lalamove' : 'Lalamove Delivery'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}
                </div>
                <div className="text-lg sm:text-xl font-black text-purple-600 mt-0.5">
                  {inHubInspectionCount} {lang === 'vi' ? 'Thiết Bị' : 'Items'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Test 48 bước & dán NFC' : '48-step test & NFC seal'}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? 'Đã Nhận Tiền Thành Công' : 'Successfully Paid Out'}
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
                  {completedPaidCount} {lang === 'vi' ? 'Đơn' : 'Orders'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Tiền đã cộng vào tài khoản' : 'Credited to balance'}
                </div>
              </div>
            </div>
          </div>

          {pickupConfirmedNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{translateSystemNotification(pickupConfirmedNotice)}</span>
            </div>
          )}
        </div>
      ) : (
        /* Buyer Header */
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] text-[#24263e] text-xs font-bold border border-gray-200 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#24263e]" />
            <span>SecondLife Smart Escrow & Multi-Leg Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#24263e] mt-2">
            {lang === 'vi' ? 'Đơn Hàng & Escrow' : 'Orders & Escrow Protection'}
          </h1>
          <p className="text-xs sm:text-sm text-[#24263e]/70">
            {lang === 'vi'
              ? 'Theo dõi hành trình giao nhận, tiến độ kiểm định chất lượng, biên bản nghiệm thu và ảnh 3 giai đoạn bảo chứng Escrow.'
              : 'Track shipping progress, quality inspection reports, handover receipts, and 3-stage escrow protection photos.'}
          </p>
        </div>
      )}

      {inspectionActionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{translateSystemNotification(inspectionActionNotice)}</span>
        </div>
      )}

      <EscrowOrderFilters
        lang={lang}
        active={activeTab}
        counts={filterCounts}
        search={searchQuery}
        searching={searching}
        seller={isSeller}
        loading={isLoading}
        onFilter={setActiveTab}
        onSearch={setSearchQuery}
        onRefresh={onRefreshFilter}
      />

      {/* Seller Awaiting Fee Payment Banner */}
      {isSeller && userOrders.some((o) => !isOrderCancelledOrRefunded(o) && isOrderSeller(o) && isPartyInspectionFeePending(o, true)) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100/70 border-2 border-orange-300 text-orange-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Wallet className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-orange-950 flex items-center gap-1.5">
                <span>{lang === 'vi' ? 'Cần Nộp Phí: Có đơn kiểm định chia phí đang chờ bạn thanh toán!' : 'Action Required: Inspection order awaiting your fee payment!'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-orange-600 text-white font-black uppercase tracking-wide">Chờ nộp phí</span>
              </div>
              <p className="text-[11px] text-orange-900 font-medium mt-0.5">
                {lang === 'vi'
                  ? 'Đơn hàng đang chờ thanh toán phí kiểm định theo tỷ lệ đã chốt. Vui lòng nộp phần phí kiểm định của người bán vào Escrow từ Ví SecondLife để điều phối kiểm định.'
                  : 'The inspection fee is due at the agreed split. Please pay your seller fee share into Escrow to proceed with inspection dispatch.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('all');
            }}
            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition shrink-0 cursor-pointer flex items-center justify-center gap-1"
          >
            <span>{lang === 'vi' ? 'Xem & Nộp Phí' : 'View & Pay Fee'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Seller Inspection Alert Banner */}
      {isSeller && inHubInspectionCount > 0 && activeTab !== 'inspecting' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-purple-950 flex items-center gap-1.5">
                <span>Thông báo kiểm định: Bạn có {inHubInspectionCount} đơn hàng yêu cầu kiểm định Hub!</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-600 text-white font-extrabold uppercase">Mới</span>
              </div>
              <p className="text-[11px] text-purple-800 font-medium mt-0.5">
                Người mua đã chọn gói kiểm định chất lượng qua Hub. Người bán vui lòng vào tab kiểm định để xem chi tiết và hẹn lịch KTV lấy máy.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('inspecting')}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-black shadow-xs transition shrink-0 cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Xem Đơn Kiểm Định</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Disputed Tab Arbitration Callout Banner */}
      {activeTab === 'disputed' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Scale className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-purple-950 flex items-center gap-1.5">
                <span>{lang === 'vi' ? 'Theo Dõi Trọng Tài & Hoàn Tiền Khiếu Nại' : 'Track Arbitration & Escrow Claims'}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-900 text-white font-extrabold uppercase">Escrow Live</span>
              </div>
              <p className="text-[11px] text-purple-800 font-medium mt-0.5">
                {lang === 'vi'
                  ? 'Xem toàn bộ hồ sơ bằng chứng, tiến trình thẩm định và phán quyết trách nhiệm của Trọng tài SecondLife.'
                  : 'View evidence timeline, responsibility verdict, and automated refunds at Disputes Center.'}
              </p>
            </div>
          </div>
          {onNavigateToDisputes && (
            <button
              onClick={onNavigateToDisputes}
              className="px-4 py-2 bg-purple-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-xs transition shrink-0 cursor-pointer flex items-center justify-center gap-1"
            >
              <span>{lang === 'vi' ? 'Mở Trung Tâm Khiếu Nại' : 'Go to Disputes Center'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {filterFailed && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span>{lang === 'vi' ? 'Không tải được danh sách đơn hàng.' : 'Unable to load orders.'}</span>
          <button type="button" onClick={onRefreshFilter} className="cursor-pointer rounded-md px-2 py-1 font-semibold underline">
            {lang === 'vi' ? 'Thử lại' : 'Try again'}
          </button>
        </div>
      )}
      {(searching || (isLoading && !filterResult)) ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4 animate-pulse">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-24 bg-slate-200 rounded-md"></div>
                  <div className="h-5 w-32 bg-slate-100 rounded-md"></div>
                </div>
                <div className="h-6 w-36 bg-slate-200 rounded-full"></div>
              </div>
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-slate-200 rounded-xl shrink-0"></div>
                <div className="flex-1 space-y-2.5">
                  <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                  <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
                  <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
                </div>
                <div className="w-28 space-y-2 text-right shrink-0">
                  <div className="h-4 w-16 bg-slate-100 rounded ml-auto"></div>
                  <div className="h-6 w-24 bg-slate-200 rounded ml-auto"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filterFailed && !filterResult ? null : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
          <Package aria-hidden="true" className="mx-auto mb-3 size-10 text-slate-400" />
          <h3 className="text-base font-bold text-slate-900">
            {lang === 'vi' ? 'Không tìm thấy đơn hàng' : 'No orders found'}
          </h3>
          {(filterQuery.q || activeTab !== 'all' || orderPerspective !== 'all') && (
            <button type="button" onClick={() => {
              setSearchQuery('');
              updateQuery({ filter: 'all', perspective: 'all', q: '', page: 0 });
            }} className="mt-3 cursor-pointer text-sm font-semibold text-[#ad432f] hover:underline">
              {lang === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4" aria-busy={isLoading}>
          {orders.map((ord) => {
            const orderIsSeller = isOrderSeller(ord);
            const payoutData = getOrderFinanceLookup(ord)
              ? payoutDataMap[ord.id]
              : getInspectionPayoutPreview(ord);
            const hasInspection = Boolean(
              ord.hasInspectionService ||
              (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) ||
              ord.inspectionCenterId ||
              ord.inspectionMethod ||
              (ord as any).inspectionStatus ||
              ord.escrowStatus === 'AWAITING_INSPECTION' ||
              ord.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
              ord.escrowStatus === 'INSPECTION_PASSED'
            );
            const buyerInspectionStage = orderIsSeller ? null : getBuyerInspectionStage(ord);
            const ordShipment = ord.inspectionMethod === 'AT_HOME' ? null : getOrderInboundShipment(ord);
            const inboundProgress = ordShipment ? getInboundShipmentProgress(ordShipment, lang) : null;
            const inboundLabel = inboundProgress?.label || getSellerInboundLabel(ord);
            const hasActiveShipment = isShipmentCreatedForOrder(ord) || Boolean(ordShipment);
            const hasInboundTracking = Boolean(orderIsSeller && ordShipment && isHubInboundInProgress(ord));
            const savedAppointment = getOrderAppointment(ord);
            return (
              <OrderCard
                key={ord.id}
                payoutData={payoutData}
                order={ord}
                orderIsSeller={orderIsSeller}
                hasInspection={hasInspection}
                lang={lang}
                savedAppointment={savedAppointment}
                ordShipment={ordShipment}
                buyerInspectionStage={buyerInspectionStage}
                state={{
                  getStatusBadge,
                  isOrderReceiptConfirmed,
                  isOrderCancelledOrRefunded,
                  isInspectorArrivedForOrder,
                  isOrderSellerConfirmed,
                }}
                actions={{
                  setSellerReviewsModalData,
                  setSchedulingOrder,
                  setSchedulingReadOnly,
                  handleSellerAcceptCounterAppointment,
                  setDetailModalOrder,
                }}
                cardActions={{
                  orderActionLoading,
                  inboundLabel,
                  hasActiveShipment,
                  hasInboundTracking,
                  loadingBankPaymentId,
                  confirmingReceiptIds,
                  reviewedOrderIds,
                  state: {
                    isOrderReceiptConfirmed,
                    isOrderCancelledOrRefunded,
                    isOrderSellerConfirmed,
                    isInspectorArrivedForOrder,
                    isPartyInspectionFeePending,
                    getPartyInspectionFee,
                    isPartyInspectionFeePaid,
                    isOrderPacked,
                    isOrderUnpaid,
                    getOrderAppointment,
                  },
                  actions: {
                    setDetailModalOrder,
                    onOpenChat,
                    renderInspectionDecision,
                    setTrackingOrder,
                    setSchedulingOrder,
                    setSchedulingReadOnly,
                    handleSellerConfirmOrder,
                    handlePromptRejectInspection,
                    onCancelOrder,
                    handlePromptCancelOrder,
                    onRefreshOrders,
                    handlePayInspectionFee,
                    setCreateShipmentOrder,
                    handlePromptCancelInspectionRequest,
                    setCertificateModalOrder,
                    handleSellerAcceptCounterAppointment,
                    handleOpenBankPaymentModal,
                    setConfirmDialog,
                    setConfirmingReceiptIds,
                    onConfirmReceipt,
                    setReviewModalOrder,
                  },
                }}
              />
            );
          })}
        </div>
      )}

      {!searching && filterResult && filterResult.totalPages > 1 && (
        <EscrowOrderPagination lang={lang} page={filterResult.page} size={filterResult.size}
          totalPages={filterResult.totalPages} total={filterResult.totalElements}
          onPage={(page) => updateQuery({ page })}
        />
      )}

      {detailModalOrder && (
        <OrderDetailModal
          onClose={() => setDetailModalOrder(null)}
          header={
            <OrderDetailHeader
              lang={lang}
              order={detailModalOrder}
              getStatusBadge={getStatusBadge}
              isOrderReceiptConfirmed={isOrderReceiptConfirmed}
              detailHasInspection={detailHasInspection}
              isOrderSeller={isOrderSeller}
              setDetailModalOrder={setDetailModalOrder}
            />
          }
          actions={
            <OrderDetailActions
              order={detailModalOrder}
              isOrderCancelledOrRefunded={isOrderCancelledOrRefunded}
              isOrderSeller={isOrderSeller}
              detailHasInspection={detailHasInspection}
              isOrderReceiptConfirmed={isOrderReceiptConfirmed}
              renderInspectionDecision={renderInspectionDecision}
              setDetailModalOrder={setDetailModalOrder}
              lang={lang}
              setTrackingOrder={setTrackingOrder}
              isOrderSellerConfirmed={isOrderSellerConfirmed}
              getOrderAppointment={getOrderAppointment}
              handleSellerAcceptCounterAppointment={handleSellerAcceptCounterAppointment}
              orderActionLoading={orderActionLoading}
              setSchedulingOrder={setSchedulingOrder}
              setSchedulingReadOnly={setSchedulingReadOnly}
              handleSellerConfirmOrder={handleSellerConfirmOrder}
              handlePromptRejectInspection={handlePromptRejectInspection}
              onCancelOrder={onCancelOrder}
              handlePromptCancelOrder={handlePromptCancelOrder}
              isPartyInspectionFeePending={isPartyInspectionFeePending}
              getPartyInspectionFee={getPartyInspectionFee}
              isPartyInspectionFeePaid={isPartyInspectionFeePaid}
              onRefreshOrders={onRefreshOrders}
              handlePayInspectionFee={handlePayInspectionFee}
              detailInboundLabel={detailInboundLabel}
              isOrderPacked={isOrderPacked}
              setCreateShipmentOrder={setCreateShipmentOrder}
              isInspectorArrivedForOrder={isInspectorArrivedForOrder}
              handlePromptCancelInspectionRequest={handlePromptCancelInspectionRequest}
              isShipmentCreatedForOrder={isShipmentCreatedForOrder}
              detailHasInboundTracking={detailHasInboundTracking}
              detailInboundProgress={detailInboundProgress}
              detailBuyerInspectionStage={detailBuyerInspectionStage}
              confirmingReceiptIds={confirmingReceiptIds}
              setConfirmDialog={setConfirmDialog}
              setConfirmingReceiptIds={setConfirmingReceiptIds}
              onConfirmReceipt={onConfirmReceipt}
              onOpenDispute={onOpenDispute}
              setReportingOrder={setReportingOrder}
            />
          }
        >
          <OrderDetailProduct
            isOrderCancelledOrRefunded={isOrderCancelledOrRefunded}
            order={detailModalOrder}
            lang={lang}
            detailHasInspection={detailHasInspection}
          />

          <OrderDetailDirectShipping
            detailHasInspection={detailHasInspection}
            order={detailModalOrder}
            detailInboundShipment={detailInboundShipment}
            lang={lang}
            isOrderCancelledOrRefunded={isOrderCancelledOrRefunded}
            isShipmentCreatedForOrder={isShipmentCreatedForOrder}
            detailInboundProgress={detailInboundProgress}
            setTrackingOrder={setTrackingOrder}
            detailBuyerInspectionStage={detailBuyerInspectionStage}
            isOrderSeller={isOrderSeller}
            setInspectionActionNotice={setInspectionActionNotice}
            setCreateShipmentOrder={setCreateShipmentOrder}
            isOrderSellerConfirmed={isOrderSellerConfirmed}
          />

          <OrderDeliveryJourney
            order={detailModalOrder}
            detailShipments={detailShipments}
            isOrderSellerConfirmed={isOrderSellerConfirmed}
            lang={lang}
            isOrderCancelledOrRefunded={isOrderCancelledOrRefunded}
            isOrderSeller={isOrderSeller}
            setInspectionActionNotice={setInspectionActionNotice}
            setCreateShipmentOrder={setCreateShipmentOrder}
            detailInboundShipment={detailInboundShipment}
            getOrderInboundShipment={getOrderInboundShipment}
            detailInspectionDto={detailInspectionDto}
            getOrderAppointment={getOrderAppointment}
            isInspectorArrivedForOrder={isInspectorArrivedForOrder}
            handleSellerAcceptCounterAppointment={handleSellerAcceptCounterAppointment}
            setSchedulingOrder={setSchedulingOrder}
            setSchedulingReadOnly={setSchedulingReadOnly}
            detailInboundLabel={detailInboundLabel}
            setTrackingShipmentId={setTrackingShipmentId}
            setTrackingOrder={setTrackingOrder}
            setExpandedDetailLeg1={setExpandedDetailLeg1}
            expandedDetailLeg1={expandedDetailLeg1}
            setExpandedDetailLeg2={setExpandedDetailLeg2}
            expandedDetailLeg2={expandedDetailLeg2}
          />

          <OrderDetailCertificate
            order={detailModalOrder}
            setVerifySealId={setVerifySealId}
            setIsVerifySealModalOpen={setIsVerifySealModalOpen}
            setPrintSealOrder={setPrintSealOrder}
          />

          <OrderDetailPhotos
            order={detailModalOrder}
            detailInspectionDto={detailInspectionDto}
            activePhotoStage={activePhotoStage}
            setActivePhotoStage={setActivePhotoStage}
            lang={lang}
          />

          <OrderFeeBreakdown
            order={detailModalOrder}
            detailInspectionDto={detailInspectionDto}
            getInspectionFeeSplit={getInspectionFeeSplit}
            detailShipments={detailShipments}
            lang={lang}
          />

          {financeResource && isOrderSeller(detailModalOrder) && (
            <OrderSettlement
              order={detailModalOrder}
              detailBuyerInspectionStage={detailBuyerInspectionStage}
              isOrderReceiptConfirmed={isOrderReceiptConfirmed}
              orderSettlement={displayedFinancialData?.settlement ?? null}
              isEscrowReleased={financeResource === 'settlement'}
              isLoadingSettlement={!displayedFinancialData}
              orderCommission={displayedFinancialData?.commission ?? null}
              isSeller={isOrderSeller(detailModalOrder)}
            />
          )}
        </OrderDetailModal>
      )}

      {/* Lalamove Order Tracking Modal */}
      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          isSeller={isOrderSeller(trackingOrder)}
          onClose={() => {
            setTrackingOrder(null);
            setTrackingShipmentId(undefined);
          }}
          lang={lang}
          onConfirmReceipt={onConfirmReceipt}
          onOpenLabelModal={(shipment) => setActiveLabelShipment({ order: trackingOrder, shipment })}
          onOrderUpdated={onRefreshOrders}
          onInboundShipmentLoaded={isOrderSeller(trackingOrder) ? saveSellerInboundShipment : undefined}
          initialShipmentId={trackingShipmentId}
        />
      )}

      {/* Lalamove Create Shipment Modal */}
      {createShipmentOrder && (
        <CreateShipmentModal
          order={createShipmentOrder}
          onClose={() => setCreateShipmentOrder(null)}
          lang={lang}
          onShipmentCreated={(shipment) => {
            setCreateShipmentOrder(null);
            onRefreshOrders?.();
            setActiveLabelShipment({ order: createShipmentOrder, shipment });
            setDetailShipments((prev) => [shipment, ...prev.filter((s) => s.shipmentId !== shipment.shipmentId)]);
            try {
              if (createShipmentOrder?.id) {
                const nowIso = new Date().toISOString();
                localStorage.setItem(`order_shipment_created_${createShipmentOrder.id}`, 'true');
                localStorage.setItem(`seller_ready_${createShipmentOrder.id}`, nowIso);
                localStorage.setItem(`order_packed_${createShipmentOrder.id}`, 'true');
                setLocalReadyOrderIds((prev) => new Set(prev).add(createShipmentOrder.id));
                if (detailModalOrder?.id === createShipmentOrder.id) {
                  setDetailModalOrder((prev) => (prev ? { ...prev, sellerReadyAt: nowIso } : null));
                }
                orderService.markReadyForPickup(createShipmentOrder.id).catch(() => { });
              }
            } catch { }
          }}
        />
      )}

      {/* Lalamove Official Shipping Label Modal */}
      {activeLabelShipment && (
        <ShippingLabelModal
          order={activeLabelShipment.order}
          shipment={activeLabelShipment.shipment}
          onClose={() => setActiveLabelShipment(null)}
          lang={lang}
        />
      )}

      {/* Product Review Modal for Customer (Requirement 1) */}
      {reviewModalOrder && (
        <ProductReviewModal
          order={reviewModalOrder}
          isOpen={!!reviewModalOrder}
          onClose={() => setReviewModalOrder(null)}
          onSubmitReview={handleReviewSubmit}
          lang={lang}
        />
      )}

      {/* Seller Reviews & Trust Modal for Buyer (Requirements 2 & 3) */}
      {sellerReviewsModalData && (
        <SellerReviewsModal
          sellerId={sellerReviewsModalData.sellerId}
          sellerName={sellerReviewsModalData.sellerName}
          isOpen={!!sellerReviewsModalData}
          onClose={() => setSellerReviewsModalData(null)}
          lang={lang}
        />
      )}
      {/* Digital Inspection Certificate Modal */}
      {certificateModalOrder && (
        <DigitalInspectionCertificateModal
          order={certificateModalOrder}
          onClose={() => setCertificateModalOrder(null)}
          lang={lang}
        />
      )}

      {/* Schedule Inspection Appointment Modal */}
      {schedulingOrder && (
        <ScheduleAppointmentModal
          orderId={schedulingOrder.inspectionOrderId || schedulingOrder.id}
          orderCode={schedulingOrder.id}
          linkedOrderId={schedulingOrder.linkedOrderId || schedulingOrder.id}
          inspectionOrderId={schedulingOrder.inspectionOrderId}
          isOpen={!!schedulingOrder}
          onClose={() => setSchedulingOrder(null)}
          onSuccess={() => {
            if (detailModalOrder && (detailModalOrder.id === schedulingOrder.id || (detailModalOrder as any).linkedOrderId === schedulingOrder.id || (detailModalOrder as any).inspectionOrderId === schedulingOrder.id)) {
              setDetailModalOrder((prev) => prev ? {
                ...prev,
                appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
                counterScheduledAt: null,
                counterShift: null,
                counterNote: null,
              } : null);
            }
            onRefreshOrders?.();
          }}
          lang={lang}
          readOnly={schedulingReadOnly}
          initialScheduledAt={getOrderAppointment(schedulingOrder)?.scheduledAt}
          initialNote={getOrderAppointment(schedulingOrder)?.note}
        />
      )}
      {confirmDialog?.isOpen && (
        <OrderActionDialog
          confirmDialog={confirmDialog}
          orderActionLoading={orderActionLoading}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {/* Modal Tra Cứu & Xác Thực Tem Niêm Phong */}
      <InspectionSealVerificationModal
        isOpen={isVerifySealModalOpen}
        onClose={() => setIsVerifySealModalOpen(false)}
        initialSealId={verifySealId}
      />

      {/* Modal In Tem Niêm Phong */}
      {printSealOrder && (
        <PrintTamperSealModal
          isOpen={!!printSealOrder}
          onClose={() => setPrintSealOrder(null)}
          tamperSealId={printSealOrder.inspectionReport?.tamperSealId || `SL-SEAL-${(printSealOrder.id || '').slice(0, 8).toUpperCase()}`}
          orderId={printSealOrder.id}
          productTitle={printSealOrder.listing?.title}
          conditionGrade={printSealOrder.listing?.conditionGrade || 'A'}
          conditionScore={printSealOrder.inspectionReport?.conditionScore || 95}
          inspectorName={printSealOrder.inspectionReport?.inspectorName || 'KTV SecondLife Center'}
        />
      )}

      {/* Modal In Tem Mã QR Kiểm Định Dán Sản Phẩm (Dành cho Người Bán sau khi xác nhận đơn) */}
      {printInspectionQrOrder && (
        <InspectionProductQRModal
          isOpen={!!printInspectionQrOrder}
          onClose={() => setPrintInspectionQrOrder(null)}
          order={printInspectionQrOrder}
          lang={lang}
        />
      )}

      {/* Modal Khiếu Nại Đơn Hàng (Bảo Vệ Người Dùng) */}
      {reportingOrder && (
        <UserReportModal
          isOpen={!!reportingOrder}
          onClose={() => setReportingOrder(null)}
          orderId={reportingOrder.id}
          itemTitle={reportingOrder.listing?.title}
          onNavigateToDisputes={onNavigateToDisputes}
          onSuccess={() => {
            setInspectionActionNotice(
              lang === 'vi'
                ? `Đã gửi khiếu nại thành công cho đơn hàng #${reportingOrder.id.slice(0, 8)}! Đơn hàng đã chuyển sang trạng thái tranh chấp & bảo lưu Escrow.`
                : `Dispute filed successfully for order #${reportingOrder.id.slice(0, 8)}! Funds are frozen in Escrow.`
            );
            setTimeout(() => setInspectionActionNotice(null), 8000);
            onRefreshOrders?.();
          }}
        />
      )}

      {/* Modal Quét Mã VietQR Ký Quỹ Đóng Băng Tiền */}
      {bankPaymentOrder && bankPaymentInfo && (
        <VietQrEscrowModal
          isOpen={Boolean(bankPaymentOrder && bankPaymentInfo)}
          onClose={() => {
            setBankPaymentOrder(null);
            setBankPaymentInfo(null);
          }}
          order={bankPaymentOrder}
          bankPaymentInfo={bankPaymentInfo}
          onPaymentSuccess={() => {
            setBankPaymentOrder(null);
            setBankPaymentInfo(null);
            onRefreshOrders?.();
          }}
          lang={lang}
        />
      )}
    </div>
  );
};
