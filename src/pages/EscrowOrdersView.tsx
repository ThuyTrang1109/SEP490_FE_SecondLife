import { useBrowserLocation, navigatePath } from '../app/router/browser';
import { resolveAppRoute, paths } from '../app/router/paths';
import React, { useState, useEffect, useMemo } from 'react';
import { EscrowOrder, Language, UserRole, UserProfile } from '../types';
import { EscrowOrderFilters, EscrowOrderPagination } from '../components/orders/EscrowOrderFilters';
import { ORDER_FILTER_TABS, orderFeedSearch, readOrderFeedQuery, type OrderFeedQuery, type OrderFilterTab, type OrderPerspective } from '../utils/escrowOrderFilters';
import type { OrderFeed } from '../services/orderFeedService';
import { translations, formatVND } from '../utils/translations';
import {
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  Layers,
  ChevronRight,
  ChevronDown,
  Package,
  PackageCheck,
  Store,
  Eye,
  X,
  RotateCcw,
  Calendar,
  CalendarCheck,
  CalendarSync,
  MapPin,
  QrCode,
  Shield,
  ArrowRight,
  User,
  UserCheck,
  Phone,
  Printer,
  MessageSquare,
  Wallet,
  Receipt,
  Check,
  Star,
  Award,
  XCircle,
  Scale,
  Wrench,
} from 'lucide-react';
import { ProductReviewModal } from '../components/modals/ProductReviewModal';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { reviewService } from '../data/mockReviews';
import { OrderTrackingModal } from '../components/modals/OrderTrackingModal';
import { CreateShipmentModal } from '../components/modals/CreateShipmentModal';
import { InspectionCashShipmentStatus } from '../components/inspection/InspectionCashShipmentStatus';
import { getCashInspectionFeeShares, isInspectionCashShipment } from '../utils/inspectionCashShipping';
import { ShippingLabelModal } from '../components/modals/ShippingLabelModal';
import { InspectionCountdownTimer } from '../components/inspection/InspectionCountdownTimer';
import { InspectionPenaltyPreviewCard } from '../components/inspection/InspectionPenaltyPreviewCard';
import { InspectionAppealModal } from '../components/inspection/InspectionAppealModal';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionSealVerificationModal } from '../components/modals/InspectionSealVerificationModal';
import { saveScopedLocalNotification } from '../utils/notificationStorage';
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { AtHomeIntakeBarcode } from '../components/inspection/AtHomeIntakeBarcode';
import { walletService, notifyWalletBalanceUpdated } from '../services/walletService';
import { ShipmentBackend, OrderSettlementDTO, OrderCommissionDTO } from '../types';
import { orderService } from '../services/orderService';
import { inspectorService, InspectionOrderDto } from '../services/inspectorService';
import { notificationWsClient } from '../services/notificationWsClient';
import { getInspectionReportMedia } from '../utils/inspectionDecisionData';
import { shippingService } from '../services/shippingService';
import { ApiError, isUserIdle } from '../services/apiClient';
import { UserReportModal } from '../components/modals/UserReportModal';
import { InspectionProductQRModal } from '../components/modals/InspectionProductQRModal';
import { VietQrEscrowModal } from '../components/modals/VietQrEscrowModal';
import { dialogService } from '../utils/dialogService';
import {
  formatInspectionDeadline,
  isInspectionPaymentExpired,
  calculateDeadlineTimeLeft
} from '../utils/inspectionPaymentDeadline';
import { getSortableOrderTimestamp, markListingAsAvailable, resolveInspectionCenter } from '../utils/orderUtils';
import { buyerInspectionStageLabel, getBuyerInspectionStage, getCustomerInspectionStatus, getInspectionPurchaseDecision, inspectionPurchaseDecisionLabel, isExpiredInspectionPurchase } from '../utils/inspectionPurchase';
import { getHubReturnProgress, getHubReturnState, getInboundShipmentProgress, getLatestInboundShipment, shouldTrackInboundShipment } from '../utils/inspectionCenterData';
import { resolveListingCategory, resolveOrderListing } from '../utils/catalogCache';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { LalamoveProgress } from '../components/common/LalamoveProgress';

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

const getInitialCommissionRate = (): number => {
  try {
    const saved = localStorage.getItem('platform_commission_rate');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch { }
  return 5.0;
};

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

function isHubInboundInProgress(order: EscrowOrder) {
  return shouldTrackInboundShipment({
    orderType: order.inspectionMethod,
    status: order.inspectionStatus || order.backendStatus || order.status || '',
  });
}

export const VALID_ORDER_FILTER_TABS = ORDER_FILTER_TABS;
export const ORDER_TAB_STORAGE_KEY = 'secondlife_orders_filter_tab';
export function getInitialOrderFilterTab(): OrderFilterTab {
  return typeof window === 'undefined' ? 'all' : readOrderFeedQuery(window.location.href).filter;
}

export { getSortableOrderTimestamp };

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
  const t = translations[lang];

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

  const routeLocation = useBrowserLocation();
  const orderRoute = resolveAppRoute(routeLocation, currentUser?.role || userRole);
  const activeTab = filterQuery.filter;
  const updateQuery = (changes: Partial<OrderFeedQuery>) => {
    const { pathname, search } = window.location;
    navigatePath(pathname + orderFeedSearch(search, { ...filterQuery, ...changes }));
  };
  const setActiveTab = (filter: OrderFilterTab) => updateQuery({ filter, page: 0, q: searchQuery.trim() });
  const setOrderPerspective = (perspective: OrderPerspective) => updateQuery({ perspective, page: 0, q: searchQuery.trim() });

  const [searchQuery, setSearchQuery] = useState(filterQuery.q);
  useEffect(() => setSearchQuery(filterQuery.q), [filterQuery.q]);
  const searching = searchQuery.trim() !== filterQuery.q;
  useEffect(() => {
    if (!searching) return;
    const timer = window.setTimeout(() => {
      const { pathname, search } = window.location;
      navigatePath(pathname + orderFeedSearch(search, {
        ...readOrderFeedQuery(window.location.href), q: searchQuery.trim(), page: 0,
      }), { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searching, filterQuery.q, routeLocation]);

  const [detailModalOrder, setDetailModalOrderState] = useState<EscrowOrder | null>(null);
  const findOrderForAction = (id: string) =>
    orders.find((order) => order.id === id) ??
    (detailModalOrder?.id === id ? detailModalOrder : userOrders.find((order) => order.id === id));
  const setDetailModalOrder = (value: React.SetStateAction<EscrowOrder | null>) => {
    setDetailModalOrderState(value);
    if (typeof value === 'function') return;
    navigatePath(paths.orders(orderRoute.role || userRole, value?.id) + window.location.search);
  };
  useEffect(() => {
    const id = orderRoute.params.orderId;
    if (!id) {
      setDetailModalOrderState(null);
      return;
    }
    const found = routeOrder ?? orders.find((order) => order.id === id);
    setDetailModalOrderState((previous) => found ?? (isLoading && previous?.id === id ? previous : null));
  }, [orderRoute.params.orderId, routeOrder, orders, isLoading]);
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

      if (isBuyer && hasInsp && bStatus === 'WAITING_FEE_PAYMENT' && !isFeeExpired && !autoPaidOrderIdsRef.current.has(ord.id)) {
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
  const [orderSettlement, setOrderSettlement] = useState<OrderSettlementDTO | null>(null);
  const [orderCommission, setOrderCommission] = useState<OrderCommissionDTO | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [settlementNotSettled, setSettlementNotSettled] = useState(false);

  // Map of payout and commission data fetched from backend API per order
  const [payoutDataMap, setPayoutDataMap] = useState<Record<string, {
    sellerPayout: number;
    platformCommission: number;
    ratePercent?: number;
    source: 'settlement' | 'commission' | 'order' | 'fallback';
  }>>({});

  // Global platform commission rate initialized from cache / standard 5%
  const [platformCommissionRate, setPlatformCommissionRate] = useState<number>(getInitialCommissionRate);

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
        } catch {}
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
      if (e?.detail?.orderId && e?.detail?.counterScheduledAt) {
        const d = e.detail;
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
          } catch {}
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
    if (detailModalOrder?.id) {
      const hasInsp = Boolean(
        detailModalOrder.hasInspectionService ||
        (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
        detailModalOrder.inspectionCenterId ||
        detailModalOrder.inspectionMethod ||
        (detailModalOrder as any).inspectionStatus
      );
      if (!hasInsp && activePhotoStage === 'inspector') {
        setActivePhotoStage('listing');
      }

      const isInsp = Boolean(
        detailModalOrder.hasInspectionService ||
        detailModalOrder.inspectionMethod ||
        (detailModalOrder as any).inspectionStatus
      );
      const isPhase2Paid = Boolean(
        detailModalOrder.finalPaymentPaidAt ||
        (detailModalOrder.linkedOrderId && (detailModalOrder as any).backendStatus !== 'PASSED' && detailModalOrder.escrowStatus !== 'INSPECTION_PASSED') ||
        detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
        detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
        (detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' && (detailModalOrder as any).backendStatus !== 'CANCELLED')
      );
      if (isInsp && !isPhase2Paid) {
        setOrderSettlement(null);
        setOrderCommission(null);
        setSettlementNotSettled(false);
        setIsLoadingSettlement(false);
      } else {
        setIsLoadingSettlement(true);
        setSettlementNotSettled(false);
        const targetOrderId = detailModalOrder.linkedOrderId || detailModalOrder.id;
        orderService.getOrderSettlement(targetOrderId)
          .then((data) => {
            setOrderSettlement(data);
            setSettlementNotSettled(false);
            if (data?.sellerPayout !== undefined) {
              const rate = data.commissionBase > 0
                ? Math.round((data.platformCommission / data.commissionBase) * 1000) / 10
                : undefined;
              setPayoutDataMap((prev) => ({
                ...prev,
                [detailModalOrder.id]: {
                  sellerPayout: data.sellerPayout,
                  platformCommission: data.platformCommission,
                  ratePercent: rate,
                  source: 'settlement',
                },
              }));
            }
          })
          .catch(async () => {
            setOrderSettlement(null);
            setSettlementNotSettled(true);
            try {
              const comm = await orderService.getOrderCommission(targetOrderId);
              if (comm) {
                setOrderCommission(comm);
                if (comm.platformCommission !== undefined) {
                  const base = comm.commissionBase ?? detailModalOrder.itemPriceVnd;
                  setPayoutDataMap((prev) => ({
                    ...prev,
                    [detailModalOrder.id]: {
                      sellerPayout: base - comm.platformCommission!,
                      platformCommission: comm.platformCommission!,
                      ratePercent: comm.ratePercent,
                      source: 'commission',
                    },
                  }));
                }
              } else {
                setOrderCommission(null);
              }
            } catch {
              setOrderCommission(null);
            }
          })
          .finally(() => {
            setIsLoadingSettlement(false);
          });
      }
    } else {
      setOrderSettlement(null);
      setOrderCommission(null);
      setSettlementNotSettled(false);
    }
  }, [detailModalOrder]);

  // Fetch platform commission rate from backend API exactly ONCE for all orders
  const hasFetchedCommissionRateRef = React.useRef(false);
  React.useEffect(() => {
    if (hasFetchedCommissionRateRef.current || !currentUser) return;

    const firstSellerOrder = userOrders.find((o) => isOrderSeller(o));
    if (!firstSellerOrder) return;

    hasFetchedCommissionRateRef.current = true;

    const fetchRateOnce = async () => {
      try {
        const targetId = firstSellerOrder.linkedOrderId || firstSellerOrder.id;
        const comm = await orderService.getOrderCommission(targetId).catch(() => null);
        if (comm?.ratePercent !== undefined && comm.ratePercent > 0) {
          setPlatformCommissionRate(comm.ratePercent);
          try {
            localStorage.setItem('platform_commission_rate', String(comm.ratePercent));
          } catch { }
          return;
        }

        const settlement = await orderService.getOrderSettlement(targetId).catch(() => null);
        if (settlement && settlement.commissionBase > 0) {
          const rate = Math.round((settlement.platformCommission / settlement.commissionBase) * 1000) / 10;
          if (rate > 0) {
            setPlatformCommissionRate(rate);
            try {
              localStorage.setItem('platform_commission_rate', String(rate));
            } catch { }
          }
        }
      } catch {
        // keep initial default 5.0%
      }
    };

    fetchRateOnce();
  }, [userOrders, currentUser]);

  // Real Backend Shipments for Detail Modal
  const detailOrderId = detailModalOrder?.id;
  const detailIsInspection = Boolean(detailModalOrder?.inspectionStatus || detailModalOrder?.hasInspectionService);
  const detailHasInspection = detailIsInspection || Boolean(
    detailModalOrder?.inspectionMethod ||
    detailModalOrder?.inspectionCenterId ||
    (detailModalOrder && detailModalOrder.inspectionFeeVnd > 0)
  );
  const [detailShipments, setDetailShipments] = useState<ShipmentBackend[]>(() =>
    detailOrderId ? getOrderAllShipments(detailOrderId) : []
  );
  const [isLoadingDetailShipments, setIsLoadingDetailShipments] = useState(false);
  const [detailInspectionDto, setDetailInspectionDto] = useState<InspectionOrderDto | null>(null);
  const [expandedDetailLeg1, setExpandedDetailLeg1] = useState(false);
  const [expandedDetailLeg2, setExpandedDetailLeg2] = useState(false);
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!detailOrderId) {
      setDetailShipments([]);
      setDetailInspectionDto(null);
      setIsLoadingDetailShipments(false);
      setExpandedDetailLeg1(false);
      setExpandedDetailLeg2(false);
      return;
    }

    const cachedShipments = getOrderAllShipments(detailOrderId);
    if (cachedShipments.length > 0) {
      setDetailShipments(cachedShipments);
    } else {
      setDetailShipments([]);
    }
    setDetailInspectionDto(null);
    let active = true;
    setIsLoadingDetailShipments(true);

    if (detailIsInspection) {
      inspectorService.getOrder(detailOrderId)
        .then((dto) => {
          if (active && dto) {
            setDetailInspectionDto(dto);
            if (dto.counterScheduledAt || dto.appointmentScheduledAt) {
              const ids = [dto.id, dto.linkedOrderId, detailOrderId].filter(Boolean) as string[];
              const isLocallyRescheduled = ids.some((id) => {
                try {
                  const raw = localStorage.getItem(`order_appointment_${id}`);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
                      return true;
                    }
                  }
                } catch {}
                return false;
              });

              if (!isLocallyRescheduled) {
                const isCounter = Boolean(dto.counterScheduledAt || dto.appointmentStatus === 'COUNTERED_BY_CENTER' || dto.status === 'WAITING_SELLER_APPROVAL');
                const apptRecord = {
                  scheduledAt: dto.appointmentScheduledAt,
                  note: dto.appointmentNote || '',
                  shift: dto.counterShift || 'MORNING',
                  status: isCounter ? 'COUNTERED_BY_CENTER' : (dto.appointmentStatus || (dto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
                  counterScheduledAt: dto.counterScheduledAt,
                  counterShift: dto.counterShift,
                  counterNote: dto.counterNote,
                };
                ids.forEach(id => {
                  try {
                    localStorage.setItem(`order_appointment_${id}`, JSON.stringify(apptRecord));
                  } catch {}
                });
                setApptTick(t => t + 1);
              }
            }
          }
        })
        .catch(() => {
          if (active) setDetailInspectionDto(null);
        });
    }

    const read = detailIsInspection
      ? shippingService.getInspectionShipments(detailOrderId)
      : shippingService.getOrderShipments(detailOrderId);
    read
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setDetailShipments(list);
        if (list.length > 0) {
          try {
            localStorage.setItem(`sl_order_shipments_${detailOrderId}`, JSON.stringify(list));
            localStorage.setItem(`order_shipments_${detailOrderId}`, JSON.stringify(list));
          } catch { }
        }
        if (list.some((s) => s.status !== 'CANCELLED')) {
          try {
            localStorage.setItem(`order_shipment_created_${detailOrderId}`, 'true');
          } catch { }
        }
      })
      .catch(() => {
        // Keep cached shipments if API fails
      })
      .finally(() => {
        if (active) setIsLoadingDetailShipments(false);
      });
    return () => { active = false; };
  }, [detailOrderId, detailIsInspection]);

  // Lalamove Shipping Modals state
  const [trackingSelection, setTrackingOrder] = useState<EscrowOrder | null>(null);
  const trackingOrder = orders.find((order) => order.id === trackingSelection?.id) ?? trackingSelection;
  const detailBuyerInspectionStage = detailModalOrder && !isOrderSeller(detailModalOrder)
    ? getBuyerInspectionStage(detailModalOrder)
    : null;
  const [createShipmentOrder, setCreateShipmentOrder] = useState<EscrowOrder | null>(null);
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

  const sellerInboundOrderKey = currentUser?.id
    ? userOrders
      .filter((order) => order.id !== trackingOrder?.id && order.id !== createShipmentOrder?.id &&
        isHubInboundInProgress(order))
      .map((order) => order.id).sort().join(',')
    : '';

  const prevUserIdForInboundRef = React.useRef<string | null>(currentUser?.id || null);
  React.useEffect(() => {
    const currentId = currentUser?.id || null;
    if (prevUserIdForInboundRef.current && currentId && prevUserIdForInboundRef.current !== currentId) {
      setSellerInboundShipments(new Map());
    }
    prevUserIdForInboundRef.current = currentId;
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (!sellerInboundOrderKey) {
      setInboundLoadingOrders(new Set());
      return;
    }
    const orderIds = sellerInboundOrderKey.split(',');
    setInboundLoadingOrders((prev) => {
      const pendingIds = orderIds.filter((id) => !sellerInboundShipments.has(id));
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
        while (!controller.signal.aborted && !document.hidden && nextIndex < orderIds.length) {
          const orderId = orderIds[nextIndex++];
          try {
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
            }
          } catch (error) {
            if (!controller.signal.aborted && error instanceof ApiError && [403, 404].includes(error.status)) {
              saveSellerInboundShipment(orderId, null);
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
        await Promise.all(Array.from({ length: Math.min(3, orderIds.length) }, read));
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    // Khi WebSocket đang active: poll dự phòng thưa (60s). Khi mất kết nối: 30s.
    const intervalMs = notificationWsClient.isConnected() ? 60_000 : 30_000;
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener('visibilitychange', refresh);

    // Lắng nghe sự kiện cập nhật đơn hàng/vận đơn qua WebSocket để refresh ngay lập tức
    const unsubWs = notificationWsClient.subscribeListener((notification) => {
      const ref = String(notification.referenceType || '').toUpperCase();
      if (!ref || ref === 'SHIPMENT' || ref === 'INSPECTION_ORDER' || ref === 'ORDER') {
        void refresh();
      }
    });

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      unsubWs();
    };
  }, [currentUser?.id, sellerInboundOrderKey, saveSellerInboundShipment]);

  const getOrderInboundShipment = React.useCallback((order: EscrowOrder | null | undefined): ShipmentBackend | null => {
    if (!order?.id) return null;
    const fromMap = sellerInboundShipments.get(order.id);
    if (fromMap) return fromMap;
    if (detailModalOrder?.id === order.id && detailShipments.length > 0) {
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
  }, [sellerInboundShipments, detailModalOrder?.id, detailShipments]);

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
    if (status === 'SHIPPING_TO_CENTER') return lang === 'vi' ? 'Đang giao hàng về Hub' : 'On the way to Hub';
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

  // VietQR Escrow Deposit Modal States
  const [bankPaymentOrder, setBankPaymentOrder] = useState<EscrowOrder | null>(null);
  const [bankPaymentInfo, setBankPaymentInfo] = useState<any | null>(null);
  const [loadingBankPaymentId, setLoadingBankPaymentId] = useState<string | null>(null);

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

    // CHỈ coi là chưa thanh toán khi đang chờ thanh toán
    return escrow === 'AWAITING_PAYMENT' || backend === 'PENDING_PAYMENT' || backend === 'AWAITING_PAYMENT' || backend === 'WAITING_FEE_PAYMENT';
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
    if (sellerInboundShipments.has(ord.id) && isHubInboundInProgress(ord)) {
      return Boolean(sellerInboundShipments.get(ord.id));
    }
    if (ord.carrierPickedUpAt || (ord.backendStatus as any) === 'SHIPPED' || (ord.backendStatus as any) === 'DELIVERED') return true;
    if (ord.shippingLegs?.some((leg) => leg.status === 'IN_TRANSIT' || leg.status === 'COMPLETED' || Boolean((leg as any).trackingCode))) return true;
    if (detailModalOrder?.id === ord.id && detailShipments.some((s) => s.status !== 'CANCELLED')) {
      return true;
    }
    try {
      if (typeof window !== 'undefined') {
        if (localStorage.getItem(`order_shipment_created_${ord.id}`) === 'true') return true;
        if (localStorage.getItem(`order_shipments_${ord.id}`)) return true;
        if (localStorage.getItem(`sl_order_shipments_${ord.id}`)) return true;
        if (localStorage.getItem(`sl_insp_shipments_${ord.id}`)) return true;
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
      status === 'CANCELLED' ||
      status === 'CANCELED'
    );
  };

  const getCancellationReasonDisplay = (ord: EscrowOrder | null | undefined, currentLang: Language = 'vi') => {
    if (!ord) return { title: '', reason: '', code: '' };
    let reasonCode = ord.cancellationReasonCode || (ord as any).cancelReasonCode;
    let reasonText = ord.cancellationReason || (ord as any).cancelReason;

    if (!reasonCode || !reasonText) {
      try {
        const raw = localStorage.getItem(`order_cancellation_info_${ord.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!reasonCode) reasonCode = parsed.reasonCode;
          if (!reasonText) reasonText = parsed.reason;
        }
      } catch { }
    }

    const dictionary: Record<string, { vi: string; en: string }> = {
      SELLER_OUT_OF_STOCK: {
        vi: 'Người bán tạm hết hàng hoặc sản phẩm gặp sự cố không thể chuẩn bị giao.',
        en: 'Seller is out of stock or item is unavailable for delivery.',
      },
      SELLER_CANNOT_FULFILL: {
        vi: 'Người bán không thể đáp ứng thời gian hoặc điều kiện giao hàng.',
        en: 'Seller cannot fulfill delivery terms for this order.',
      },
      BUYER_REQUESTED: {
        vi: 'Người mua yêu cầu hủy đơn hàng do người bán chưa xác nhận đơn.',
        en: 'Buyer requested cancellation before seller confirmation.',
      },
      SELLER_CONFIRMATION_TIMEOUT: {
        vi: 'Hết hạn xác nhận: Người bán không xác nhận đơn trong hạn định (Hệ thống tự động hủy & hoàn tiền 100%).',
        en: 'Confirmation timeout: Seller did not confirm in time (Auto-cancelled & 100% refunded).',
      },
      PAYMENT_EXPIRED: {
        vi: 'Hết hạn thanh toán: Người mua chưa hoàn tất nộp tiền ký quỹ Escrow đúng hạn quy định.',
        en: 'Payment expired: Escrow deposit was not completed within time limit.',
      },
      INSPECTION_FAILED: {
        vi: 'Kiểm định không đạt: Sản phẩm không đúng mô tả hoặc không vượt qua quy chuẩn kiểm định tại Hub.',
        en: 'Inspection failed: Item did not match description or failed Hub inspection.',
      },
      SELLER_REJECTED_INSPECTION: {
        vi: 'Người bán từ chối yêu cầu kiểm định sản phẩm.',
        en: 'Seller declined the inspection request.',
      },
    };

    const mapped = reasonCode ? dictionary[reasonCode] : null;
    const resolved = reasonText || (mapped ? mapped[currentLang] : (currentLang === 'vi' ? 'Đơn hàng đã được hủy và hoàn trả 100% tiền ký quỹ vào ví người mua.' : 'Order was cancelled and 100% refunded to buyer.'));

    return {
      title: currentLang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded',
      reason: resolved,
      code: reasonCode || '',
    };
  };

  const handleOpenBankPaymentModal = async (ord: EscrowOrder) => {
    setLoadingBankPaymentId(ord.id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ord.id);
    let paymentInfo: any = null;

    if (isUuid) {
      try {
        paymentInfo = await orderService.getOrderPayment(ord.id);
      } catch (e) {
        console.warn('Could not fetch bank payment details from backend:', e);
      }
    }

    // Nếu backend chưa có hoặc đơn mock/offline (không phải UUID hoặc backend lỗi):
    // Tự tạo fallback thông tin thanh toán VietQR SePay chuẩn xác
    if (!paymentInfo) {
      const remainingAmount = ord.totalPaidVnd || ord.itemPriceVnd || (ord.listing?.priceVnd ?? 0) + (ord.shippingFeeVnd ?? 0) || 600000;
      paymentInfo = ord.bankPaymentDetails || {
        orderId: ord.id,
        bankName: 'MB',
        bankAccountNumber: '0388907604',
        bankAccountName: 'SECONDLIFE ESCROW',
        totalAmount: remainingAmount,
        paidAmount: 0,
        remainingAmount: remainingAmount,
        status: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
        transferContent: `SECONDLIFE ${ord.id}`,
        qrCodeUrl: `https://img.vietqr.io/image/MB-0388907604-compact2.png?amount=${remainingAmount}&addInfo=${encodeURIComponent(`SECONDLIFE ${ord.id}`)}&accountName=SECONDLIFE%20ESCROW`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        qrExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        sepayTransactionId: null,
        paymentMethod: 'BANK_TRANSFER'
      };
    }

    setBankPaymentOrder(ord);
    setBankPaymentInfo(paymentInfo);
    setLoadingBankPaymentId(null);
  };

  const handleAcceptFailedInspection = async (orderId: string) => {
    const ok = await dialogService.confirm(
      'Bạn xác nhận đồng ý với kết quả kiểm định KHÔNG ĐẠT. Hệ thống sẽ áp dụng khấu trừ điểm uy tín theo quy định và giải tỏa tiền ký quỹ hoàn lại cho người mua. Thao tác này không thể hoàn tác.',
      {
        title: 'Xác Nhận Chấp Nhận Kết Quả Kiểm Định',
        confirmText: 'Chấp Nhận & Trừ Điểm',
        cancelText: 'Xem Lại',
      }
    );
    if (!ok) return;

    try {
      setOrderActionLoading(orderId);
      await inspectorService.acceptFailedResult(orderId);
      setInspectionActionNotice('Đã xác nhận chấp nhận kết quả kiểm định. Điểm uy tín đã được cập nhật.');
      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => prev ? { ...prev, appealStatus: 'UPHELD', reputationPenaltyApplied: true } : null);
      }
    } catch (e: any) {
      setInspectionActionNotice(`Lỗi: ${e.message || 'Không thể chấp nhận kết quả'}`);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRespondInspection = async (orderId: string, action: 'ACCEPT' | 'REJECT', rejectReason?: string) => {
    try {
      setOrderActionLoading(orderId);
      // Kiểm tra định dạng UUID (Backend yêu cầu @PathVariable UUID orderId)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

      if (!isUuid) {
        // Đơn hàng local/mock do đặt hàng offline hoặc fallback: cập nhật trực tiếp local state
        setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
        try {
          const raw = localStorage.getItem('recent_placed_orders');
          if (raw) {
            const list = JSON.parse(raw);
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
                  confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
                  escrowStatus: action === 'ACCEPT' ? 'AWAITING_INSPECTION' : 'REFUNDED_TO_BUYER',
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        } catch { }
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }

      await inspectorService.respondRequest(orderId, {
        action,
        sellerConsentZinLoss: action === 'ACCEPT',
        rejectReason: rejectReason || (action === 'REJECT' ? 'Người bán từ chối kiểm định' : undefined),
      });
      if (action === 'REJECT') {
        const targetOrd = orders.find((o) => o.id === orderId);
        const targetListingId = String(targetOrd?.listingId || targetOrd?.listing?.id || '');
        if (targetListingId) {
          markListingAsAvailable(targetListingId);
        }
      }
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => (prev ? ({
          ...prev,
          sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
          confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
          backendStatus: (action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED') as any,
          status: (action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED') as any,
        } as EscrowOrder) : null));
      }
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      console.warn('Backend respondRequest fallback to local state:', err);
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((o: any) => {
            if (o.id === orderId) {
              return {
                ...o,
                sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
                confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
                escrowStatus: action === 'ACCEPT' ? 'AWAITING_INSPECTION' : 'REFUNDED_TO_BUYER',
                backendStatus: action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED',
                status: action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED',
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handlePayInspectionFee = async (orderId: string) => {
    try {
      setOrderActionLoading(orderId);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      if (!isUuid) {
        setInspectionActionNotice('Đã thanh toán phần phí kiểm định thành công!');
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }
      const res = await inspectorService.payInspectionFee(orderId);

      const targetOrder = findOrderForAction(orderId);
      const isSellerUser = targetOrder ? isOrderSeller(targetOrder) : isSeller;
      const isBothPaid = res?.status !== 'WAITING_FEE_PAYMENT';
      const nowIso = new Date().toISOString();

      // Cập nhật giảm ngay số dư trên Header để thấy realtime
      const feeToDeduct = targetOrder ? (isSellerUser ? getPartyInspectionFee(targetOrder, true) : getPartyInspectionFee(targetOrder, false)) : 0;
      if (feeToDeduct > 0) {
        notifyWalletBalanceUpdated(undefined, feeToDeduct);
      }
      try {
        await walletService.getMyWallet();
      } catch { }

      if (isBothPaid) {
        setInspectionActionNotice(
          lang === 'vi'
            ? 'Đã nộp phí kiểm định vào Escrow thành công! Đơn chuyển sang trạng thái Sẵn Sàng Giao KTV / Hub.'
            : 'Inspection fee paid into Escrow successfully! Ready for Hub/Technician dispatch.'
        );
      } else {
        setInspectionActionNotice(
          lang === 'vi'
            ? 'Đã nộp phần phí kiểm định của bạn thành công! Đang chờ đối phương hoàn tất phí kiểm định.'
            : 'Your inspection fee share was paid successfully! Awaiting counterparty fee payment.'
        );
      }

      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => (prev ? ({
          ...prev,
          backendStatus: (res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : prev.backendStatus)) as any,
          status: (res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : prev.status)) as any,
          buyerPaidAt: isSellerUser ? prev.buyerPaidAt : (res?.buyerPaidAt || nowIso),
          sellerPaidAt: isSellerUser ? (res?.sellerPaidAt || nowIso) : prev.sellerPaidAt,
          sellerFeeShare: res?.sellerFeeShare !== undefined ? Number(res.sellerFeeShare) : prev.sellerFeeShare,
          buyerFeeShare: res?.buyerFeeShare !== undefined ? Number(res.buyerFeeShare) : prev.buyerFeeShare,
          cashShippingSimulation: res?.cashShippingSimulation ?? prev.cashShippingSimulation,
          buyerCommitmentDeposit: res?.buyerCommitmentDeposit ?? prev.buyerCommitmentDeposit,
        } as EscrowOrder) : null));
      }

      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                const isSellerO = isOrderSeller(o);
                return {
                  ...o,
                  backendStatus: res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : o.backendStatus),
                  status: res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : o.status),
                  sellerPaidAt: isSellerO ? (res?.sellerPaidAt || nowIso) : o.sellerPaidAt,
                  buyerPaidAt: !isSellerO ? (res?.buyerPaidAt || nowIso) : o.buyerPaidAt,
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  backendStatus: res?.status || o.backendStatus,
                  status: res?.status || o.status,
                  sellerPaidAt: res?.sellerPaidAt || nowIso,
                };
              }
              return o;
            });
            localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Không thể thanh toán phí kiểm định';
      if (msg.includes('đã thanh toán') || msg.includes('không ở trạng thái chờ')) {
        setInspectionActionNotice('Đơn kiểm định đã được nộp phí thành công!');
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
      } else {
        dialogService.error(msg, 'Lỗi Thanh Toán');
        onRefreshOrders?.();
      }
    } finally {
      setOrderActionLoading(null);
    }
  };

  interface ConfirmDialogState {
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'success' | 'warning' | 'danger';
    iconType?: 'check' | 'package' | 'truck' | 'alert';
    onConfirm: () => void | Promise<void>;
  }

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  const handleConfirmInspectionPurchase = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Nghiệm Thu & Mua Hàng' : 'Confirm Purchase',
      message: lang === 'vi'
        ? 'Xác nhận sản phẩm kiểm định đạt chuẩn và tiến hành thanh toán tiền hàng cuối cùng?'
        : 'Confirm passed inspection and proceed with final payment?',
      subMessage: lang === 'vi'
        ? 'Tiền hàng sẽ được giữ an toàn trong Escrow và đơn hàng sẽ được chuyển sang khâu giao hàng cho bạn.'
        : 'Funds will be securely held in Escrow and dispatched to the courier.',
      confirmText: lang === 'vi' ? 'Xác Nhận Mua' : 'Confirm',
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'success',
      iconType: 'check',
      onConfirm: async () => {
        try {
          await inspectorService.confirmPurchase(orderId);
          setInspectionActionNotice('Đã xác nhận mua hàng & thanh toán thành công! Đơn hàng sẽ được chuyển sang giao bưu tá.');
          onRefreshOrders?.();
          setTimeout(() => setInspectionActionNotice(null), 4000);
        } catch (err: any) {
          setInspectionActionNotice(err?.message || 'Không thể xác nhận mua hàng');
          setTimeout(() => setInspectionActionNotice(null), 4000);
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const renderInspectionDecision = (order: EscrowOrder, close?: () => void) => {
    const isInsideDetailModal = Boolean(close);
    const decision = getInspectionPurchaseDecision(order);
    const failed = order.inspectionStatus === 'FAILED' || order.escrowStatus === 'INSPECTION_FAILED';
    const expired = isExpiredInspectionPurchase(order.inspectionStatus, order.inspectionNote);
    if (!decision && !failed && !expired) return null;
    const canDecide = decision === 'pending' && !isOrderSeller(order) && !isOrderCancelledOrRefunded(order);
    const returnShipment = detailOrderId === order.id && close
      ? getHubReturnState(detailShipments.length > 0 ? detailShipments : getOrderAllShipments(order.id)).shipment
      : null;

    // Trong modal Xem Chi Tiết: Luôn hiển thị nút xem kết quả kiểm định / quyết định mua nếu có handler
    // Ngoài giao diện chính (danh sách thẻ đơn): Bỏ nút tra cứu kết quả "Xem kết quả kiểm định", chỉ hiện nút nếu đang chờ người mua quyết định mua
    const shouldShowButton = isInsideDetailModal
      ? Boolean(onOpenInspectionDecision || canDecide)
      : canDecide;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {!isInsideDetailModal && (
          <span className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${failed ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}>
            {failed ? buyerInspectionStageLabel('failed', lang) : expired
              ? (lang === 'vi' ? 'Đã hủy do hết hạn thanh toán' : 'Cancelled after payment expired')
              : decision && inspectionPurchaseDecisionLabel(decision, lang)}
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

  const handlePromptRejectInspection = (ord: EscrowOrder) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Từ Chối Yêu Cầu Kiểm Định' : 'Reject Inspection Request',
      message: lang === 'vi'
        ? 'Bạn có chắc chắn muốn từ chối yêu cầu kiểm định cho sản phẩm này? Đơn hàng sẽ bị hủy và tiền ký quỹ sẽ được hoàn trả cho người mua.'
        : 'Are you sure you want to reject the inspection request? The order will be cancelled and refunded.',
      subMessage: lang === 'vi'
        ? 'Sản phẩm sẽ được mở lại hiển thị trên sàn để người mua khác có thể tiếp tục xem và đặt mua.'
        : 'The listing will be reopened on the marketplace.',
      confirmText: lang === 'vi' ? 'Từ chối kiểm định' : 'Reject Inspection',
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'danger',
      iconType: 'alert',
      onConfirm: async () => {
        await handleRespondInspection(ord.id, 'REJECT', 'Người bán từ chối kiểm định');
        setConfirmDialog(null);
      }
    });
  };

  const handleSellerConfirmOrder = (orderId: string) => {
    const targetOrder = findOrderForAction(orderId);
    const orderHasInspection = targetOrder ? Boolean(
      targetOrder.hasInspectionService ||
      (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
      targetOrder.inspectionCenterId ||
      targetOrder.inspectionMethod ||
      (targetOrder as any).inspectionStatus ||
      targetOrder.escrowStatus === 'AWAITING_INSPECTION' ||
      targetOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      targetOrder.escrowStatus === 'INSPECTION_PASSED'
    ) : false;

    const sellerFee = targetOrder ? getPartyInspectionFee(targetOrder, true) : 0;
    const isFeeSplit = targetOrder ? (getInspectionFeeSplit(targetOrder) === 'SPLIT_50_50' || sellerFee > 0) : false;

    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi'
        ? (orderHasInspection ? 'Xác nhận đồng ý kiểm định' : 'Xác Nhận Chuẩn Bị Đơn Hàng')
        : (orderHasInspection ? 'Confirm Inspection Agreement' : 'Confirm Order Preparation'),
      message: lang === 'vi'
        ? (orderHasInspection
          ? (isFeeSplit
            ? `Xác nhận đồng ý yêu cầu kiểm định! Đơn hàng áp dụng chia phí (50/50), bạn sẽ nộp phần phí ${formatVND(sellerFee)} từ Ví SecondLife vào Escrow.`
            : 'Xác nhận đồng ý yêu cầu kiểm định của người mua! Hệ thống sẽ tạo mã QR kiểm định để bạn dán lên kiện hàng gửi sang Hub (hoặc KTV quét khi đến nhà).')
          : 'Xác nhận bạn chấp nhận chuẩn bị đơn hàng này cho người mua?')
        : (orderHasInspection
          ? 'Confirm inspection request from buyer? An inspection QR code will be generated.'
          : 'Do you confirm preparing this order for the buyer?'),
      subMessage: lang === 'vi'
        ? (orderHasInspection
          ? 'Sau khi đồng ý, đơn ở trạng thái Chờ kiểm định. Khi trung tâm phân công kỹ thuật viên, đơn sẽ hiển thị Đang kiểm định.'
          : 'Sau khi xác nhận, người bán cam kết đóng gói sản phẩm cẩn thận theo quy chuẩn và chuẩn bị sẵn sàng để bưu tá / tài xế Lalamove đến lấy.')
        : 'After confirmation, you commit to packing the item safely for pickup.',
      confirmText: lang === 'vi'
        ? (orderHasInspection ? 'Đồng ý kiểm định' : 'Xác Nhận Đơn')
        : (orderHasInspection ? 'Accept Inspection' : 'Confirm Order'),
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'primary',
      iconType: 'package',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          let inspResp: any = null;
          if (orderHasInspection) {
            inspResp = await inspectorService.respondRequest(orderId, {
              action: 'ACCEPT',
              sellerConsentZinLoss: true,
            });
          } else {
            await orderService.confirmOrder(orderId);
          }

          // Tự động tạo vận đơn Lalamove ngay khi người bán xác nhận đơn hàng thông thường (chặng SELLER_TO_BUYER)
          let createdShipment: ShipmentBackend | null = null;
          let shipmentNotice: string | null = null;
          if (!orderHasInspection) {
            try {
              createdShipment = await shippingService.createShipment(orderId, {
                requestId: crypto.randomUUID(),
                leg: 'SELLER_TO_BUYER',
              });
              console.log('Lalamove shipment created successfully on order confirm:', createdShipment);
            } catch (shipErr: any) {
              console.warn('Auto create Lalamove shipment notice:', shipErr);
              shipmentNotice = shipErr?.response?.data?.message || shipErr?.message || '';
            }
          }

          const confirmedAt = new Date().toISOString();
          const nextBackendStatus = inspResp?.status
            || (orderHasInspection
              ? (String(targetOrder?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' || getPartyInspectionFee(targetOrder, true) > 0 ? 'WAITING_FEE_PAYMENT' : 'CONFIRMED_PENDING_DISPATCH')
              : (targetOrder?.backendStatus || 'CONFIRMED'));

          const updatedOrder: EscrowOrder | null = targetOrder ? ({
            ...targetOrder,
            sellerConfirmedAt: confirmedAt,
            confirmationStatus: 'CONFIRMED',
            escrowStatus: orderHasInspection ? 'AWAITING_INSPECTION' : (targetOrder.escrowStatus === 'AWAITING_PAYMENT' ? 'HELD_IN_ESCROW' : targetOrder.escrowStatus),
            backendStatus: nextBackendStatus as any,
            status: nextBackendStatus as any,
            paymentDeadline: inspResp?.paymentDeadline || targetOrder.paymentDeadline,
            sellerFeeShare: inspResp?.sellerFeeShare !== undefined ? Number(inspResp.sellerFeeShare) : targetOrder.sellerFeeShare,
            buyerFeeShare: inspResp?.buyerFeeShare !== undefined ? Number(inspResp.buyerFeeShare) : targetOrder.buyerFeeShare,
            cashShippingSimulation: inspResp?.cashShippingSimulation ?? targetOrder.cashShippingSimulation,
            buyerCommitmentDeposit: inspResp?.buyerCommitmentDeposit ?? targetOrder.buyerCommitmentDeposit,
            sellerPaidAt: inspResp?.sellerPaidAt || targetOrder.sellerPaidAt,
            buyerPaidAt: inspResp?.buyerPaidAt || targetOrder.buyerPaidAt,
            feePayer: inspResp?.feePayer || targetOrder.feePayer,
            inspectorId: undefined,
            inspectorName: undefined,
          } as any as EscrowOrder) : null;

          // Xóa mọi phân công cũ chưa xác thực khi người bán vừa đồng ý kiểm định
          if (orderHasInspection) {
            try {
              localStorage.removeItem(`order_assigned_inspector_${orderId}`);
            } catch { }
          }

          // Cập nhật local storage recent_placed_orders
          try {
            const raw = localStorage.getItem('recent_placed_orders');
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            const exists = list.some((o: any) => o.id === orderId);
            if (exists) {
              list = list.map((o: any) => {
                if (o.id === orderId) {
                  return {
                    ...o,
                    sellerConfirmedAt: confirmedAt,
                    confirmationStatus: 'CONFIRMED',
                    escrowStatus: orderHasInspection ? 'AWAITING_INSPECTION' : (o.escrowStatus === 'AWAITING_PAYMENT' ? 'HELD_IN_ESCROW' : o.escrowStatus),
                    backendStatus: nextBackendStatus,
                    status: nextBackendStatus,
                    paymentDeadline: inspResp?.paymentDeadline || o.paymentDeadline,
                    sellerFeeShare: inspResp?.sellerFeeShare !== undefined ? Number(inspResp.sellerFeeShare) : o.sellerFeeShare,
                    buyerFeeShare: inspResp?.buyerFeeShare !== undefined ? Number(inspResp.buyerFeeShare) : o.buyerFeeShare,
                    cashShippingSimulation: inspResp?.cashShippingSimulation ?? o.cashShippingSimulation,
                    buyerCommitmentDeposit: inspResp?.buyerCommitmentDeposit ?? o.buyerCommitmentDeposit,
                    sellerPaidAt: inspResp?.sellerPaidAt || o.sellerPaidAt,
                    buyerPaidAt: inspResp?.buyerPaidAt || o.buyerPaidAt,
                    inspectorId: undefined,
                    inspectorName: undefined,
                  };
                }
                return o;
              });
            } else if (updatedOrder) {
              list.unshift(updatedOrder);
            }
            localStorage.setItem('recent_placed_orders', JSON.stringify(list));
          } catch { }

          // Lưu vào center_inspection_orders dành riêng cho Trung tâm điều phối
          if (orderHasInspection && updatedOrder) {
            try {
              const rawCenter = localStorage.getItem('center_inspection_orders');
              let centerList = rawCenter ? JSON.parse(rawCenter) : [];
              if (!Array.isArray(centerList)) centerList = [];
              const filteredCenter = centerList.filter((o: any) => o.id !== orderId);
              filteredCenter.unshift({
                ...updatedOrder,
                status: 'CONFIRMED_PENDING_DISPATCH',
                backendStatus: 'CONFIRMED_PENDING_DISPATCH',
                escrowStatus: 'AWAITING_INSPECTION',
                inspectorId: undefined,
                inspectorName: undefined,
              });
              localStorage.setItem('center_inspection_orders', JSON.stringify(filteredCenter));
            } catch { }
          }

          // Phát tín hiệu thông báo task cho Trung tâm kiểm định điều phối
          if (orderHasInspection) {
            const centerNotif = {
              id: `notif-center-task-${orderId}`,
              recipientRole: 'inspection_center',
              title: 'Nhiệm vụ kiểm định mới cần điều phối',
              message: `Người bán đã đồng ý kiểm định cho đơn #${orderId.slice(0, 8)}. Trung tâm vui lòng điều phối và phân công KTV!`,
              type: 'INSPECTION_TASK' as const,
              referenceId: orderId,
              referenceType: 'INSPECTION_ORDER',
              actionUrl: '/inspection-center/dispatch',
              isRead: false,
              readAt: null,
              createdAt: new Date().toISOString(),
            };
            saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');
            try {
              window.dispatchEvent(new CustomEvent('secondlife_inspection_task_created', { detail: { orderId, order: updatedOrder } }));
              window.dispatchEvent(new CustomEvent('secondlife_order_placed_signal', { detail: { orderId } }));
            } catch { }
          }

          setInspectionActionNotice(
            orderHasInspection
              ? (lang === 'vi' ? 'Đã đồng ý kiểm định! Task đã chuyển sang Trung tâm điều phối.' : 'Inspection accepted! Task dispatched to Center.')
              : createdShipment?.orderCode
                ? (lang === 'vi'
                  ? `Đã xác nhận đơn hàng & tạo vận đơn Lalamove thành công! Mã vận đơn: #${createdShipment.orderCode}`
                  : `Order confirmed & Lalamove shipment created! #${createdShipment.orderCode}`)
                : shipmentNotice
                  ? (lang === 'vi'
                    ? `Đã xác nhận đơn hàng thành công. Lưu ý Lalamove: ${translateSystemNotification(shipmentNotice)}. Bạn có thể bấm "Tạo Vận Đơn Lalamove" để tạo lại.`
                    : `Order confirmed! (Lalamove note: ${shipmentNotice})`)
                  : (lang === 'vi' ? 'Đã xác nhận đơn hàng thành công! Vui lòng đóng gói và báo sẵn sàng giao.' : 'Order confirmed successfully!')
          );
          onRefreshOrders?.();
          setDetailModalOrder((prev) =>
            prev && prev.id === orderId
              ? ({
                ...prev,
                sellerConfirmedAt: confirmedAt,
                confirmationStatus: 'CONFIRMED',
                backendStatus: (orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : (prev.backendStatus || 'CONFIRMED')) as any,
                status: (orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : ((prev as any).status || 'CONFIRMED')) as any,
              } as EscrowOrder)
              : prev
          );

          setTimeout(() => setInspectionActionNotice(null), 5000);
        } catch (err: any) {
          setInspectionActionNotice(translateSystemNotification(err?.message) || 'Không thể xác nhận đơn hàng');
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } finally {
          setOrderActionLoading(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleSellerMarkReadyForPickup = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác nhận đã đóng gói kiện hàng?' : 'Confirm Package Packed & Ready?',
      message: lang === 'vi'
        ? 'Kiện hàng đã được đóng gói an toàn theo quy chuẩn và sẵn sàng bàn giao?'
        : 'Has the package been securely packed according to standards and ready for handover?',
      subMessage: lang === 'vi'
        ? 'Sau khi bạn xác nhận, hệ thống sẽ ghi nhận mốc thời gian hoàn tất (SLA) và phát tín hiệu điều phối tài xế Lalamove đến địa chỉ kho lấy hàng.'
        : 'Upon confirmation, the system records SLA completion timestamp and signals Lalamove driver dispatch to your warehouse.',
      confirmText: lang === 'vi' ? '✓ Sẵn Sàng Giao' : '✓ Ready for Pickup',
      cancelText: lang === 'vi' ? 'Đóng' : 'Close',
      variant: 'primary',
      iconType: 'truck',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          const targetOrder = findOrderForAction(orderId);
          const orderHasInspection = targetOrder ? Boolean(
            targetOrder.hasInspectionService ||
            (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
            targetOrder.inspectionCenterId ||
            targetOrder.inspectionMethod ||
            (targetOrder as any).inspectionStatus
          ) : false;

          let readyAt = new Date().toISOString();
          if (!orderHasInspection) {
            try {
              const res = await orderService.markReadyForPickup(orderId);
              if (res?.sellerReadyAt) readyAt = res.sellerReadyAt;
            } catch (readyErr) {
              console.warn('markReadyForPickup error:', readyErr);
            }
          }
          setLocalReadyOrderIds((prev) => new Set(prev).add(orderId));
          try {
            localStorage.setItem(`seller_ready_${orderId}`, readyAt);
            localStorage.setItem(`order_packed_${orderId}`, 'true');
            if (orderHasInspection && targetOrder?.inspectionMethod !== 'AT_HOME') {
              localStorage.setItem(`seller_shipped_to_hub_${orderId}`, 'true');
              window.dispatchEvent(new CustomEvent('secondlife_seller_shipped_to_hub', { detail: { orderId } }));
            }
            window.dispatchEvent(new StorageEvent('storage', { key: `seller_ready_${orderId}`, newValue: readyAt }));

            const rawRecent = localStorage.getItem('recent_placed_orders');
            if (rawRecent) {
              const list = JSON.parse(rawRecent);
              if (Array.isArray(list)) {
                const updated = list.map((o: any) =>
                  o.id === orderId ? { ...o, sellerReadyAt: readyAt } : o
                );
                localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
              }
            }
          } catch { }
          if (detailModalOrder && detailModalOrder.id === orderId) {
            setDetailModalOrder((prev) => (prev ? { ...prev, sellerReadyAt: readyAt } : null));
          }

          let readyShipment: ShipmentBackend | null = null;
          try {
            const existing = await shippingService.getOrderShipments(orderId);
            const active = existing.find((s) => s.status !== 'CANCELLED');
            if (active) {
              readyShipment = active;
              setDetailShipments((prev) => [active, ...prev.filter((s) => s.shipmentId !== active.shipmentId)]);
            } else if (!orderHasInspection) {
              readyShipment = await shippingService.createShipment(orderId, {
                requestId: crypto.randomUUID(),
                leg: 'SELLER_TO_BUYER',
              });
              console.log('Lalamove shipment created on ready-for-pickup:', readyShipment);
              if (readyShipment) {
                setDetailShipments((prev) => [readyShipment!, ...prev]);
              }
            }
          } catch (shipErr: any) {
            console.warn('Lalamove shipment creation on mark ready notice:', shipErr);
          }

          const trackingCode = readyShipment?.orderCode || readyShipment?.shipmentId;
          if (trackingCode) {
            setInspectionActionNotice(
              lang === 'vi'
                ? `Đã ghi nhận kiện hàng sẵn sàng! Mã vận đơn Lalamove: #${trackingCode}. Tài xế đang được điều phối đến kho lấy hàng.`
                : `Package marked ready! Lalamove Tracking: #${trackingCode}. Driver is being dispatched.`
            );
          } else {
            setInspectionActionNotice(
              lang === 'vi'
                ? 'Đã ghi nhận kiện hàng đóng gói an toàn! Hệ thống đang phát tín hiệu điều phối tài xế Lalamove.'
                : 'Package marked packed and ready for carrier pickup!'
            );
          }
          onRefreshOrders?.();
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } catch (err: any) {
          setInspectionActionNotice(translateSystemNotification(err?.message) || 'Không thể cập nhật trạng thái sẵn sàng giao hàng');
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } finally {
          setOrderActionLoading(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handlePromptCancelOrder = (ord: EscrowOrder) => {
    const isSeller = isOrderSeller(ord);
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác Nhận Hủy Đơn Hàng' : 'Confirm Cancel Order',
      message: lang === 'vi'
        ? (isSeller
          ? 'Bạn có chắc chắn muốn hủy đơn hàng này không? Tiền ký quỹ sẽ được hoàn lại 100% cho người mua.'
          : 'Người bán chưa xác nhận đơn hàng này. Bạn có chắc chắn muốn hủy đơn và nhận lại toàn bộ tiền về ví Escrow không?')
        : 'Are you sure you want to cancel this order? Escrow funds will be refunded.',
      subMessage: lang === 'vi'
        ? (isSeller
          ? 'Lý do: Người bán tạm hết hàng hoặc không thể chuẩn bị đơn hàng này (Hệ thống sẽ cập nhật trạng thái đơn sang Đã Hủy).'
          : 'Đơn hàng sẽ được hủy ngay lập tức và bảo toàn số dư ví của bạn.')
        : undefined,
      confirmText: lang === 'vi' ? 'Xác Nhận Hủy' : 'Cancel Order',
      cancelText: lang === 'vi' ? 'Giữ Đơn' : 'Keep Order',
      variant: 'warning',
      iconType: 'alert',
      onConfirm: async () => {
        if (onCancelOrder) {
          const cancelPayload = isSeller ? {
            reasonCode: 'SELLER_OUT_OF_STOCK' as const,
            reason: 'Người bán hết hàng hoặc không thể chuẩn bị đơn hàng này.',
          } : {
            reasonCode: 'BUYER_REQUESTED' as const,
            reason: 'Người mua yêu cầu hủy đơn do người bán chưa xác nhận.',
          };
          onCancelOrder(ord.id, cancelPayload);
        }
        setConfirmDialog(null);
        if (detailModalOrder?.id === ord.id) {
          setDetailModalOrder(null);
        }
        setActiveTab('cancelled');
      }
    });
  };

  const handlePromptCancelInspectionRequest = (ord: EscrowOrder) => {
    const isSeller = isOrderSeller(ord);
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác Nhận Hủy Yêu Cầu Kiểm Định' : 'Confirm Cancel Inspection Request',
      message: lang === 'vi'
        ? (isSeller
          ? 'Bạn có chắc chắn muốn hủy yêu cầu kiểm định cho đơn hàng này không? Tiền hàng và các chi phí kiểm định tạm giữ sẽ được hoàn lại 100% cho người mua.'
          : 'Bạn có chắc chắn muốn hủy yêu cầu kiểm định cho đơn hàng này không? Toàn bộ số tiền tạm giữ (tiền hàng và phí kiểm định) sẽ được hoàn trả 100% vào Ví Escrow của bạn ngay lập tức.')
        : 'Are you sure you want to cancel this inspection request? All escrow funds will be refunded 100% to buyer.',
      subMessage: lang === 'vi'
        ? 'Sau khi hủy, KTV sẽ không đến kiểm tra máy nữa và lịch hẹn (nếu có) sẽ bị hủy bỏ.'
        : 'Technician visit will be cancelled and order status updated.',
      confirmText: lang === 'vi' ? 'Xác Nhận Hủy Kiểm Định' : 'Cancel Inspection',
      cancelText: lang === 'vi' ? 'Giữ Yêu Cầu' : 'Keep Request',
      variant: 'danger',
      iconType: 'alert',
      onConfirm: async () => {
        try {
          localStorage.removeItem(`order_appointment_${ord.id}`);
          localStorage.removeItem(`order_assigned_inspector_${ord.id}`);
          localStorage.removeItem(`order_intake_arrived_${ord.id}`);
          localStorage.setItem(`order_cancelled_${ord.id}`, 'true');
        } catch { }

        if (onCancelOrder) {
          const cancelPayload = isSeller ? {
            reasonCode: 'SELLER_CANNOT_FULFILL' as const,
            reason: 'Người bán hủy yêu cầu kiểm định trước khi KTV đến kiểm tra.',
          } : {
            reasonCode: 'BUYER_REQUESTED' as const,
            reason: 'Người mua chủ động hủy yêu cầu kiểm định trước khi KTV thực hiện đo kiểm.',
          };
          onCancelOrder(ord.id, cancelPayload);
        }

        try {
          window.dispatchEvent(new CustomEvent('secondlife_order_cancelled', { detail: { orderId: ord.id } }));
          window.dispatchEvent(new CustomEvent('secondlife_appointment_cancelled', { detail: { orderId: ord.id } }));
        } catch { }

        setConfirmDialog(null);
        if (detailModalOrder?.id === ord.id) {
          setDetailModalOrder(null);
        }
        setActiveTab('cancelled');
      }
    });
  };

  // Review & Seller Trust Modal state
  const [reviewModalOrder, setReviewModalOrder] = useState<EscrowOrder | null>(null);
  const [schedulingOrder, setSchedulingOrder] = useState<EscrowOrder | null>(null);
  const [schedulingReadOnly, setSchedulingReadOnly] = useState<boolean>(false);

  const getOrderAppointment = (ord: EscrowOrder) => {
    if (!ord) return null;
    const possibleIds = [
      ord.id,
      (ord as any).inspectionOrderId,
      (ord as any).linkedOrderId,
      (ord as any).orderId,
      (ord as any).inspectionOrder?.id,
    ].filter(Boolean) as string[];

    const isOrderWaitingSeller =
      ord.status === 'WAITING_SELLER_APPROVAL' ||
      (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
      String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL' ||
      (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER';

    let apptData: any = null;

    for (const id of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${id}`);
        if (raw && raw !== 'undefined' && raw !== 'null') {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.scheduledAt || parsed.counterScheduledAt)) {
            apptData = parsed;
            break;
          }
        }
      } catch { }
    }

    if (!apptData) {
      const idSet = new Set(possibleIds);
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const centerList = JSON.parse(rawCenter);
          if (Array.isArray(centerList)) {
            const matched = centerList.find((co: any) => idSet.has(co.id) || idSet.has(co.linkedOrderId) || idSet.has(co.orderId));
            if (matched && (matched.appointmentScheduledAt || matched.counterScheduledAt)) {
              apptData = {
                scheduledAt: matched.appointmentScheduledAt,
                note: matched.appointmentNote || '',
                status: matched.appointmentStatus || (matched.counterScheduledAt ? 'COUNTERED_BY_CENTER' : (matched.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
                counterScheduledAt: matched.counterScheduledAt,
                counterShift: matched.counterShift,
                counterNote: matched.counterNote,
              };
            }
          }
        }
      } catch { }
    }

    if (!apptData) {
      const idSet = new Set(possibleIds);
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const recentList = JSON.parse(rawRecent);
          if (Array.isArray(recentList)) {
            const matched = recentList.find((ro: any) => idSet.has(ro.id) || idSet.has(ro.inspectionOrderId) || idSet.has(ro.linkedOrderId));
            if (matched && (matched.appointmentScheduledAt || matched.counterScheduledAt)) {
              apptData = {
                scheduledAt: matched.appointmentScheduledAt,
                note: matched.appointmentNote || '',
                status: matched.appointmentStatus || (matched.counterScheduledAt ? 'COUNTERED_BY_CENTER' : (matched.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
                counterScheduledAt: matched.counterScheduledAt,
                counterShift: matched.counterShift,
                counterNote: matched.counterNote,
              };
            }
          }
        }
      } catch { }
    }

    if (!apptData && (ord.appointmentScheduledAt || (ord as any).counterScheduledAt || isOrderWaitingSeller)) {
      const schAt = ord.appointmentScheduledAt || (ord as any).inspectionOrder?.appointmentScheduledAt;
      const cntAt = (ord as any).counterScheduledAt || (ord as any).inspectionOrder?.counterScheduledAt;
      apptData = {
        scheduledAt: schAt,
        note: ord.appointmentNote || '',
        status: (ord as any).appointmentStatus || (cntAt || isOrderWaitingSeller ? 'COUNTERED_BY_CENTER' : (ord.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
        counterScheduledAt: cntAt,
        counterShift: (ord as any).counterShift || (ord as any).inspectionOrder?.counterShift,
        counterNote: (ord as any).counterNote || (ord as any).inspectionOrder?.counterNote,
      };
    }

    if (apptData?.status === 'PENDING_CENTER_CONFIRMATION' && !apptData?.counterScheduledAt) {
      return apptData;
    }

    if (detailInspectionDto && (detailInspectionDto.id === ord.id || detailInspectionDto.linkedOrderId === ord.id)) {
      if (detailInspectionDto.counterScheduledAt || detailInspectionDto.appointmentScheduledAt) {
        const isCounter = Boolean(
          detailInspectionDto.counterScheduledAt ||
          detailInspectionDto.appointmentStatus === 'COUNTERED_BY_CENTER' ||
          detailInspectionDto.status === 'WAITING_SELLER_APPROVAL'
        );
        return {
          scheduledAt: detailInspectionDto.appointmentScheduledAt || apptData?.scheduledAt,
          note: detailInspectionDto.appointmentNote || apptData?.note || '',
          status: isCounter ? 'COUNTERED_BY_CENTER' : (detailInspectionDto.appointmentStatus || (detailInspectionDto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
          counterScheduledAt: detailInspectionDto.counterScheduledAt || apptData?.counterScheduledAt,
          counterShift: detailInspectionDto.counterShift || apptData?.counterShift,
          counterNote: detailInspectionDto.counterNote || apptData?.counterNote,
        };
      }
    }

    if (apptData) {
      if (apptData.status === 'PENDING_CENTER_CONFIRMATION' && !apptData.counterScheduledAt) {
        return apptData;
      }
      if (isOrderWaitingSeller || (ord as any).counterScheduledAt || apptData.counterScheduledAt) {
        apptData.status = 'COUNTERED_BY_CENTER';
        if (!apptData.counterScheduledAt && (ord as any).counterScheduledAt) {
          apptData.counterScheduledAt = (ord as any).counterScheduledAt;
        }
        if (!apptData.counterNote && (ord as any).counterNote) {
          apptData.counterNote = (ord as any).counterNote;
        }
        if (!apptData.counterShift && (ord as any).counterShift) {
          apptData.counterShift = (ord as any).counterShift;
        }
      }
      return apptData;
    }

    return null;
  };

  const getOrderAppointmentRejection = (ord: EscrowOrder) => {
    if (!ord?.id) return null;
    if ((ord as any).appointmentRejectionReason) {
      return {
        reason: (ord as any).appointmentRejectionReason,
        rejectedAt: (ord as any).appointmentRejectedAt || '',
      };
    }
    const possibleIds = [
      ord.id,
      (ord as any).inspectionOrderId,
      (ord as any).linkedOrderId,
      (ord as any).orderId,
      (ord as any).inspectionOrder?.id,
    ].filter(Boolean) as string[];

    for (const id of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_rejection_${id}`);
        if (raw && raw !== 'undefined' && raw !== 'null') {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.reason) return parsed;
        }
      } catch { }
    }
    return null;
  };

  const handleSellerAcceptCounterAppointment = async (orderId: string, appointment: any) => {
    const finalScheduledAt = appointment?.counterScheduledAt || appointment?.scheduledAt;
    const finalShift = appointment?.counterShift || appointment?.shift || 'MORNING';

    // 1. Đồng bộ lên Backend bằng endpoint acceptAppointmentCounter
    const targetInspectionId = appointment?.inspectionOrderId || orderId;
    try {
      await inspectorService.acceptAppointmentCounter(targetInspectionId);
    } catch {
      try {
        if (targetInspectionId !== orderId) {
          await inspectorService.acceptAppointmentCounter(orderId);
        } else if (finalScheduledAt) {
          await inspectorService.scheduleAppointment(orderId, finalScheduledAt, 'Người bán đã đồng ý lịch hẹn đề xuất từ Trung tâm');
        }
      } catch (e) {
        console.warn('Backend accept counter fallback:', e);
      }
    }

    const updatedAppointment = {
      ...appointment,
      scheduledAt: finalScheduledAt,
      shift: finalShift,
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      confirmedBy: 'SELLER',
      counterScheduledAt: undefined,
      counterShift: undefined,
      counterNote: undefined,
    };

    const targetIds = new Set<string>([orderId]);
    if (appointment?.linkedOrderId) targetIds.add(appointment.linkedOrderId);

    targetIds.forEach((id) => {
      try {
        localStorage.setItem(`order_appointment_${id}`, JSON.stringify(updatedAppointment));
        localStorage.removeItem(`order_appointment_rejection_${id}`);
      } catch { }
    });

    try {
      const raw = localStorage.getItem('recent_placed_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const updated = list.map((o: any) => {
            if (targetIds.has(o.id) || targetIds.has(o.inspectionOrderId) || targetIds.has(o.linkedOrderId)) {
              return {
                ...o,
                appointmentScheduledAt: finalScheduledAt,
                appointmentStatus: 'CONFIRMED',
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                appointmentRejectionReason: undefined,
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      }
    } catch { }

    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const listCenter = JSON.parse(rawCenter);
        if (Array.isArray(listCenter)) {
          const updatedCenter = listCenter.map((o: any) => {
            if (targetIds.has(o.id) || targetIds.has(o.linkedOrderId) || targetIds.has(o.orderId)) {
              return {
                ...o,
                appointmentScheduledAt: finalScheduledAt,
                appointmentStatus: 'CONFIRMED',
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                appointmentRejectionReason: undefined,
              };
            }
            return o;
          });
          localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
        }
      }
    } catch { }

    setApptTick((t) => t + 1);

    const formattedTime = new Date(finalScheduledAt).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const centerNotif = {
      id: `notif-center-accept-appt-${orderId}-${Date.now()}`,
      recipientRole: 'inspection_center',
      title: `Người bán đã đồng ý lịch hẹn đề xuất: #${orderId.slice(0, 8)}`,
      message: `Người bán đã đồng ý lịch hẹn mới vào ${formattedTime}. Lịch hẹn đã được chốt, sẵn sàng giao task cho KTV!`,
      type: 'INSPECTION_TASK' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: '/inspection-center/dispatch',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');

    window.dispatchEvent(new CustomEvent('secondlife_appointment_confirmed', {
      detail: {
        orderId,
        scheduledAt: finalScheduledAt,
        status: 'CONFIRMED',
      }
    }));
    window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId } }));

    setInspectionActionNotice(`Bạn đã đồng ý lịch hẹn mới (${formattedTime}) thành công! Trung tâm sẽ điều phối KTV đến kiểm tra đúng giờ.`);
    setTimeout(() => setInspectionActionNotice(null), 5000);
    onRefreshOrders?.();
  };
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('secondlife_reviewed_order_ids');
      if (saved && saved !== 'undefined' && saved !== 'null' && saved.trim() !== '') {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  const handleReviewSubmit = (reviewData: { rating: number; comment: string; tags: string[]; photos: string[] }) => {
    if (!reviewModalOrder) return;
    reviewService.addReview({
      orderId: reviewModalOrder.id,
      listingId: reviewModalOrder.listingId,
      productName: reviewModalOrder.listing.title,
      sellerId: reviewModalOrder.sellerId,
      sellerName: reviewModalOrder.sellerName,
      buyerId: reviewModalOrder.buyerId,
      buyerName: reviewModalOrder.buyerName,
      rating: reviewData.rating,
      comment: reviewData.comment,
      tags: reviewData.tags,
      photos: reviewData.photos,
      isVerifiedPurchase: true,
      conditionGrade: reviewModalOrder.listing.conditionGrade
    });

    const nextReviewed = Array.from(new Set([...reviewedOrderIds, reviewModalOrder.id]));
    setReviewedOrderIds(nextReviewed);
    try {
      localStorage.setItem('secondlife_reviewed_order_ids', JSON.stringify(nextReviewed));
    } catch { }
    setReviewModalOrder(null);
  };

  // Seller specific state
  const [pickupConfirmedNotice, _setPickupConfirmedNotice] = useState<string | null>(null);
  const setPickupConfirmedNotice = (msg: string | null) => {
    _setPickupConfirmedNotice(msg ? translateSystemNotification(msg) : null);
  };
  const [shippingLabelOrder, setShippingLabelOrder] = useState<EscrowOrder | null>(null);

  const handleConfirmCourierPickup = (orderId: string) => {
    setPickupConfirmedNotice(`Đã lên lịch thành công! Tài xế Lalamove sẽ đến địa chỉ kho lấy máy #${orderId} giao về Hub trong hôm nay.`);
    setTimeout(() => setPickupConfirmedNotice(null), 5000);
  };

  // Seller metrics
  const pendingEscrowTotal = useMemo(() => {
    return userOrders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => {
        const payout = payoutDataMap[o.id]?.sellerPayout ?? (
          (o as any).sellerPayout ??
          (o.platformFeeVnd && o.platformFeeVnd > 0
            ? (o.itemPriceVnd - o.platformFeeVnd)
            : Math.round(o.itemPriceVnd * (1 - platformCommissionRate / 100)))
        );
        return sum + payout;
      }, 0);
  }, [userOrders, payoutDataMap, platformCommissionRate]);

  const awaitingPickupCount = userOrders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = userOrders.filter(
    (o) =>
      o.escrowStatus === 'AWAITING_INSPECTION' ||
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
  ).length;
  const completedPaidCount = userOrders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  const getStatusBadge = (status: EscrowOrder['escrowStatus'] | string, hasInspection?: boolean, isCurrentOrderSeller?: boolean, orderItem?: EscrowOrder) => {
    const isInspectionOrder = Boolean(
      hasInspection ||
      orderItem?.hasInspectionService ||
      (orderItem?.inspectionFeeVnd && orderItem.inspectionFeeVnd > 0) ||
      orderItem?.inspectionCenterId ||
      orderItem?.inspectionStatus
    );

    if (orderItem && orderItem.inspectionStatus !== 'FAILED' && isOrderCancelledOrRefunded(orderItem)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          <span>{isInspectionOrder
            ? (lang === 'vi' ? 'Đã đóng giao dịch' : 'Transaction closed')
            : (lang === 'vi' ? 'Đã Hủy • Hoàn Tiền' : 'Cancelled & Refunded')}</span>
        </span>
      );
    }
    const isSellerForThisOrder = isCurrentOrderSeller !== undefined ? isCurrentOrderSeller : isSeller;
    const s = String(status || '').toUpperCase();
    const bStatus = String(
      (orderItem as any)?.backendStatus ||
      (orderItem as any)?.inspectionStatus ||
      (orderItem as any)?.inspectionOrder?.status ||
      ((orderItem as any)?.status !== 'AWAITING_INSPECTION' && (orderItem as any)?.status !== 'AWAITING_PAYMENT' && (orderItem as any)?.status !== 'HELD_IN_ESCROW' ? (orderItem as any)?.status : '') ||
      ''
    ).toUpperCase();
    const sellerConfirmed = Boolean(orderItem && isOrderSellerConfirmed(orderItem));
    const inbound = orderItem && getOrderInboundShipment(orderItem);
    const inspectionStatus = orderItem?.inspectionStatus || bStatus;
    const customerStatus = getCustomerInspectionStatus(inspectionStatus, undefined, orderItem?.inspectorId);
    if (customerStatus === 'INSPECTING' || customerStatus === 'INSPECTION_IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          <Clock className="h-3.5 w-3.5" />
          <span>{buyerInspectionStageLabel('inspecting', lang)}</span>
        </span>
      );
    }
    if (orderItem && inbound && inspectionStatus !== 'INSPECTING' && isHubInboundInProgress(orderItem)) {
      const progress = getInboundShipmentProgress(inbound, lang);
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${progress.step === 3 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700'
          }`}>
          <Truck className="h-3.5 w-3.5" />
          <span>
            {progress.step === 3
              ? (lang === 'vi' ? 'Đã Đến Hub Kiểm Định' : 'Delivered to Hub')
              : (lang === 'vi' ? 'Đang vận chuyển về trung tâm kiểm định' : 'Shipping to Hub')}
          </span>
        </span>
      );
    }

    if (orderItem && isHubInboundInProgress(orderItem) && !inbound && inboundLoadingOrders.has(orderItem.id)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 animate-pulse">
          <Truck className="h-3.5 w-3.5 text-slate-400" />
          <span>{lang === 'vi' ? 'Đang cập nhật vận đơn Hub...' : 'Updating Hub shipment...'}</span>
        </span>
      );
    }

    if (bStatus === 'WAITING_SELLER_APPROVAL' || (s === 'AWAITING_INSPECTION' && bStatus === 'WAITING_SELLER_APPROVAL')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Yêu Cầu Kiểm Định Mới • Chờ Bạn Xác Nhận' : 'Đã Gửi Yêu Cầu • Chờ Người Bán Xác Nhận'
              : isSellerForThisOrder ? 'New Inspection Request • Awaiting Your Approval' : 'Inspection Requested • Awaiting Seller Approval'}
          </span>
        </span>
      );
    }

    if (bStatus === 'WAITING_BUYER_APPROVAL' || (s === 'AWAITING_INSPECTION' && bStatus === 'WAITING_BUYER_APPROVAL')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-800 border border-purple-500/30">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Đã Đề Xuất Lại • Chờ Người Mua Phản Hồi' : 'Người Bán Đã Đề Xuất Lại • Chờ Bạn Xác Nhận'
              : isSellerForThisOrder ? 'Counter-proposal Sent • Awaiting Buyer Approval' : 'Seller Counter-proposed • Awaiting Your Response'}
          </span>
        </span>
      );
    }
    if (inspectionStatus === 'CONFIRMED_PENDING_DISPATCH') {
      const isAtHome = orderItem?.inspectionMethod === 'AT_HOME' || (orderItem as any)?.orderType === 'AT_HOME';
      const isArrived = orderItem?.id ? isInspectorArrivedForOrder(orderItem.id, orderItem) : false;
      if (isAtHome && isArrived) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Wrench className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            <span>
              {lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting'}
            </span>
          </span>
        );
      }
      if (isAtHome) {
        const appt = orderItem ? getOrderAppointment(orderItem) : null;
        const hasAppt = Boolean(appt?.scheduledAt || orderItem?.appointmentScheduledAt);
        const isCountered =
          appt?.status === 'COUNTERED_BY_CENTER' ||
          Boolean(appt?.counterScheduledAt) ||
          bStatus === 'WAITING_SELLER_APPROVAL' ||
          orderItem?.status === 'WAITING_SELLER_APPROVAL' ||
          (orderItem as any)?.customerStatus === 'WAITING_SELLER_APPROVAL' ||
          (orderItem as any)?.appointmentStatus === 'COUNTERED_BY_CENTER';
        const isPendingApproval = appt?.status === 'PENDING_CENTER_CONFIRMATION' || appt?.status === 'PENDING_CONFIRMATION';

        let hasInsp = Boolean(orderItem?.inspectorId || (orderItem as any)?.inspectorName);
        if (!hasInsp && orderItem?.id && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(`order_assigned_inspector_${orderItem.id}`);
            if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
          } catch { }
        }
        if (hasInsp) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>{lang === 'vi' ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Inspector Assigned • Pending Survey'}</span>
            </span>
          );
        }
        if (isCountered) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
              <CalendarSync className="w-3.5 h-3.5 text-amber-700" />
              <span>{lang === 'vi' ? (isSellerForThisOrder ? 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi' : 'Hub Đề Xuất Lịch Mới • Chờ Seller Phản Hồi') : (isSellerForThisOrder ? 'Hub Proposed New Time • Response Needed' : 'Hub Proposed New Time • Awaiting Seller')}</span>
            </span>
          );
        }
        if (isPendingApproval) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
            </span>
          );
        }
        if (appt?.status === 'CONFIRMED') {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'}</span>
            </span>
          );
        }
        if (hasAppt) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'vi' ? (isSellerForThisOrder ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Chờ Người Bán Hẹn Lịch KTV') : 'Awaiting Schedule Visit'}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>
            {lang === 'vi' ? 'Chờ người bán gửi hàng đến Hub' : 'Awaiting seller shipment to Hub'}
          </span>
        </span>
      );
    }
    if (sellerConfirmed || bStatus === 'WAITING_FEE_PAYMENT' || bStatus === 'DISPATCHED' || bStatus === 'SHIPPING_TO_CENTER') {
      if (bStatus === 'WAITING_FEE_PAYMENT') {
        const isAutoPaying = Boolean(orderItem?.id && autoPaidOrderIdsRef.current.has(orderItem.id));
        const deadline = orderItem?.paymentDeadline || (orderItem as any)?.inspectionOrder?.paymentDeadline;
        const isExpired = isInspectionPaymentExpired(deadline);
        const formattedDeadline = formatInspectionDeadline(deadline, lang);

        const myPending = orderItem ? isPartyInspectionFeePending(orderItem, isSellerForThisOrder) : false;
        const myFee = orderItem ? getPartyInspectionFee(orderItem, isSellerForThisOrder) : 0;
        const myPaid = orderItem ? isPartyInspectionFeePaid(orderItem, isSellerForThisOrder) : false;

        let statusText = '';
        if (isExpired) {
          statusText = lang === 'vi' ? 'Quá hạn đóng phí kiểm định' : 'Fee payment expired';
        } else if (isAutoPaying) {
          statusText = lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Depositing Fee to Escrow...';
        } else if (myPending) {
          statusText = lang === 'vi'
            ? `Chờ bạn nộp phí kiểm định (${formatVND(myFee)})`
            : `Awaiting your fee payment (${formatVND(myFee)})`;
        } else if (myFee === 0) {
          statusText = lang === 'vi'
            ? (isSellerForThisOrder ? 'Chờ người mua nộp phí kiểm định' : 'Chờ người bán nộp phí kiểm định')
            : (isSellerForThisOrder ? 'Awaiting buyer fee payment' : 'Awaiting seller fee payment');
        } else if (myPaid) {
          statusText = lang === 'vi'
            ? (isSellerForThisOrder ? 'Đã nộp phí • Chờ người mua nộp phí' : 'Đã nộp phí • Chờ người bán nộp phí')
            : (isSellerForThisOrder ? 'Fee paid • Awaiting buyer payment' : 'Fee paid • Awaiting seller payment');
        } else {
          statusText = lang === 'vi' ? 'Chờ đóng phí kiểm định' : 'Awaiting inspection fee payment';
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isExpired
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : myPending
              ? 'bg-orange-500/15 text-orange-800 border border-orange-500/30'
              : 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
            }`}>
            <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-600' : 'text-orange-600'} ${isAutoPaying ? 'animate-spin' : ''}`} />
            <span>
              {statusText}
              {formattedDeadline && (
                <span className="font-normal opacity-90 ml-1">
                  • {lang === 'vi' ? 'Hạn:' : 'Due:'} {formattedDeadline}
                </span>
              )}
            </span>
          </span>
        );
      }
      if (bStatus === 'DISPATCHED') {
        const isAtCenter = orderItem?.inspectionMethod === 'AT_CENTER';
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{lang === 'vi' ? (isAtCenter ? 'Đã Điều Phối Vận Chuyển Hub' : 'Đã Điều Phối KTV / Hub') : 'Dispatched'}</span>
          </span>
        );
      }
      if (bStatus === 'SHIPPING_TO_CENTER') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Truck className="w-3.5 h-3.5 text-cyan-600" />
            <span>{lang === 'vi' ? 'Đang Ship Về Hub Kiểm Định' : 'Shipping to Hub'}</span>
          </span>
        );
      }
      if (s === 'AWAITING_INSPECTION' || s === 'HELD_IN_ESCROW') {
        const isAtHome = orderItem?.inspectionMethod === 'AT_HOME' || (orderItem as any)?.orderType === 'AT_HOME';
        const isArrived = orderItem?.id ? isInspectorArrivedForOrder(orderItem.id, orderItem) : false;
        if (isAtHome && isArrived) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Wrench className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>
                {lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting'}
              </span>
            </span>
          );
        }
        if (isAtHome) {
          const appt = orderItem ? getOrderAppointment(orderItem) : null;
          const hasAppt = Boolean(appt?.scheduledAt || orderItem?.appointmentScheduledAt);
          const isCountered =
          appt?.status === 'COUNTERED_BY_CENTER' ||
          Boolean(appt?.counterScheduledAt) ||
          bStatus === 'WAITING_SELLER_APPROVAL' ||
          orderItem?.status === 'WAITING_SELLER_APPROVAL' ||
          (orderItem as any)?.customerStatus === 'WAITING_SELLER_APPROVAL' ||
          (orderItem as any)?.appointmentStatus === 'COUNTERED_BY_CENTER';
          const isPendingApproval = appt?.status === 'PENDING_CENTER_CONFIRMATION' || appt?.status === 'PENDING_CONFIRMATION';

          let hasInsp = Boolean(orderItem?.inspectorId || (orderItem as any)?.inspectorName);
          if (!hasInsp && orderItem?.id && typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem(`order_assigned_inspector_${orderItem.id}`);
              if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
            } catch { }
          }
          if (hasInsp) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === 'vi' ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Inspector Assigned • Pending Survey'}</span>
              </span>
            );
          }
          if (isCountered) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                <CalendarSync className="w-3.5 h-3.5 text-amber-700" />
                <span>{lang === 'vi' ? (isSellerForThisOrder ? 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi' : 'Hub Đề Xuất Lịch Mới • Chờ Seller Phản Hồi') : (isSellerForThisOrder ? 'Hub Proposed New Time • Response Needed' : 'Hub Proposed New Time • Awaiting Seller')}</span>
              </span>
            );
          }
          if (isPendingApproval) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
              </span>
            );
          }
          if (appt?.status === 'CONFIRMED') {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'}</span>
              </span>
            );
          }
          if (hasAppt) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'vi' ? (isSellerForThisOrder ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Chờ Người Bán Hẹn Lịch KTV') : 'Awaiting Schedule Visit'}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder
                  ? 'Đã Xác Nhận • Đang Chuẩn Bị Gửi Hub'
                  : 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub'
                : isSellerForThisOrder
                  ? 'Confirmed • Preparing Hub Dispatch'
                  : 'Seller Confirmed • Dispatching to Hub'}
            </span>
          </span>
        );
      }
    }
    switch (s) {
      case 'AWAITING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Chờ Khách Ký Quỹ Escrow' : 'Chờ Chuyển Khoản Ký Quỹ Escrow'
                : isSellerForThisOrder ? 'Awaiting Buyer Escrow Deposit' : 'Awaiting Escrow Deposit'}
            </span>
          </span>
        );
      case 'AWAITING_INSPECTION':
        if (sellerConfirmed) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {lang === 'vi'
                  ? isSellerForThisOrder ? 'Đã Xác Nhận • Đang Chuẩn Bị Gửi Hub' : 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub'
                  : isSellerForThisOrder ? 'Confirmed • Preparing Hub Dispatch' : 'Seller Confirmed • Dispatching to Hub'}
              </span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Chờ Bạn Xác Nhận Kiểm Định' : 'Đã Gửi Yêu Cầu • Chờ Người Bán Xác Nhận'
                : isSellerForThisOrder ? 'Awaiting Your Inspection Confirmation' : 'Inspection Requested • Awaiting Seller'}
            </span>
          </span>
        );
      case 'HELD_IN_ESCROW':
        return hasInspection ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Chờ Bạn Xác Nhận Kiểm Định' : 'Chờ Kiểm Định'
                : isSellerForThisOrder ? 'Awaiting Your Inspection Confirmation' : 'Awaiting Inspection'}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Đã Ký Quỹ Escrow • Chờ Bạn Giao Hàng' : 'Đã Ký Quỹ Escrow • Chờ Người Bán Giao'
                : 'Escrow Protected • Awaiting Shipping'}
            </span>
          </span>
        );
      case 'INSPECTION_IN_PROGRESS':
        {
          const isAtHomeProg = orderItem?.inspectionMethod === 'AT_HOME' || (orderItem as any)?.orderType === 'AT_HOME';
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs">
              <Wrench className="w-3.5 h-3.5 animate-bounce" />
              <span>
                {isAtHomeProg
                  ? (lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting')
                  : (lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection')}
              </span>
            </span>
          );
        }
      case 'INSPECTION_PASSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'vi' ? 'Kiểm định đạt chuẩn' : 'Inspection Passed'}</span>
          </span>
        );
      case 'INSPECTION_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-600" />
            <span>{lang === 'vi' ? 'Đã đóng giao dịch' : 'Transaction closed'}</span>
          </span>
        );
      case 'SHIPPED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
            <Truck className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Đang Giao Tới Người Mua' : 'Đang Giao Hàng Tới Bạn'
                : isSellerForThisOrder ? 'Delivering to Buyer' : 'Delivering to You'}
            </span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Khách Đang Kiểm Máy (48h)' : 'Đã Giao • 48h Kiểm Tra Đối Soát'
                : isSellerForThisOrder ? 'Buyer Review (48h Window)' : 'Delivered • 48h Inspection Window'}
            </span>
          </span>
        );
      case 'COMPLETED_RELEASED':
      case 'RELEASED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'
                : isSellerForThisOrder ? 'Payout Transferred to Wallet' : 'Completed • Escrow Released'}
            </span>
          </span>
        );
      case 'REFUNDED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>
              {isInspectionOrder
                ? (lang === 'vi' ? 'Đã đóng giao dịch' : 'Transaction closed')
                : (lang === 'vi' ? (isSellerForThisOrder ? 'Đã Hoàn Tiền Cho Người Mua' : 'Đã Hoàn Tiền Vào Ví') : 'Refunded')}
            </span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Đang Tranh Chấp • Đóng Băng Escrow' : 'Disputed • Escrow Frozen'}</span>
          </span>
        );
      case 'CANCELLED':
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'vi' ? 'Đã Hủy Đơn' : 'Cancelled'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            <span>{status}</span>
          </span>
        );
    }
  };

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
                    ? 'Theo dõi lịch bưu tá đến kho lấy hàng chuyển về Hub, kết quả kiểm định kỹ thuật và đối soát tiền giải ngân vào ví người bán.'
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
                  {formatVND(pendingEscrowTotal)}
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
                  ? 'Đơn hàng mua kèm kiểm định theo phương án chia đôi phí (50/50). Vui lòng nộp phần phí kiểm định của người bán vào Escrow từ Ví SecondLife để điều phối kiểm định.'
                  : 'Inspection fee is split 50/50. Please pay your seller fee share into Escrow to proceed with inspection dispatch.'}
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
            const payoutData = payoutDataMap[ord.id];
            const orderRatePercent = payoutData?.ratePercent ?? (
              ord.platformFeeVnd && ord.platformFeeVnd > 0 && ord.itemPriceVnd > 0
                ? Math.round((ord.platformFeeVnd / ord.itemPriceVnd) * 1000) / 10
                : platformCommissionRate
            );
            const sellerCommissionFee = payoutData?.platformCommission ?? (
              ord.platformFeeVnd && ord.platformFeeVnd > 0
                ? ord.platformFeeVnd
                : Math.round(ord.itemPriceVnd * (orderRatePercent / 100))
            );
            const sellerNetPayout = payoutData?.sellerPayout ?? (
              (ord as any).sellerPayout ?? (ord.itemPriceVnd - sellerCommissionFee)
            );
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
            const ordShipment = getOrderInboundShipment(ord);
            const inboundProgress = ordShipment ? getInboundShipmentProgress(ordShipment, lang) : null;
            const inboundLabel = inboundProgress?.label || getSellerInboundLabel(ord);
            const hasActiveShipment = isShipmentCreatedForOrder(ord) || Boolean(ordShipment);
            const hasInboundTracking = Boolean(orderIsSeller && ordShipment && isHubInboundInProgress(ord));
            const savedAppointment = getOrderAppointment(ord);
            return (
              <div
                key={ord.id}
                onClick={() => setDetailModalOrder(ord)}
                className="bg-[#FFFFFF] rounded-2xl border border-gray-200 hover:border-[#c34c36]/50 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                {/* Order Top Bar */}
                <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {orderIsSeller ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Store className="w-3 h-3 text-indigo-600" />
                          <span>{lang === 'vi' ? 'Đơn Bạn Bán' : 'Your Sale'}</span>
                        </span>
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">
                          {lang === 'vi' ? 'Khách mua:' : 'Buyer:'} {ord.buyerName}
                        </span>
                        {ord.buyerPhone ? (
                          <span className="text-[11px] text-slate-400">({ord.buyerPhone})</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <User className="w-3 h-3 text-blue-600" />
                          <span>{lang === 'vi' ? 'Đơn Bạn Mua' : 'Your Purchase'}</span>
                        </span>
                        <Store className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-900">{ord.sellerName}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSellerReviewsModalData({
                              sellerId: ord.sellerId,
                              sellerName: ord.sellerName
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                          title={lang === 'vi' ? 'Xem điểm uy tín & đánh giá người bán' : 'View seller trust & reviews'}
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>98đ uy tín</span>
                        </button>
                      </>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">#{ord.id}</span>
                    <span className="hidden sm:inline-block text-[11px] text-slate-400">
                      • {(() => {
                        const t = getSortableOrderTimestamp(ord);
                        return t > 0 ? new Date(t).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : (ord.createdAt || '--/--/----');
                      })()}
                    </span>
                  </div>
                  <div>{getStatusBadge(isOrderReceiptConfirmed(ord) ? 'COMPLETED_RELEASED' : ord.escrowStatus, hasInspection, orderIsSeller, ord)}</div>
                </div>

                {/* Order Main Body: Product Snippet */}
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={ord.listing.photos.front}
                      alt={ord.listing.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-gray-200 shrink-0 bg-slate-100 group-hover:scale-102 transition-transform"
                    />
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 break-words group-hover:text-[#24263e] transition-colors">
                        {ord.listing.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {resolveListingCategory(ord.listing)}
                        </span>
                        <span>•</span>
                        <span>
                          {lang === 'vi' ? 'Tình trạng:' : 'Condition:'}{' '}
                          <strong className="text-slate-800">{ord.listing.conditionGrade}</strong>
                        </span>
                        <span>•</span>
                        <span>{lang === 'vi' ? 'Số lượng: 1' : 'Qty: 1'}</span>
                      </div>

                      {orderIsSeller ? (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lang === 'vi' ? 'Tài xế: Lalamove (Lấy tại kho Seller)' : 'Courier: Lalamove (Pickup at Seller)'}</span>
                          </span>
                          {ord.sellerConfirmedAt ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã xác nhận đơn' : 'Confirmed'}</span>
                            </span>
                          ) : ord.confirmationDeadline ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{lang === 'vi' ? 'Hạn xác nhận: ' : 'Confirm before: '}{new Date(ord.confirmationDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>
                            {hasInspection
                              ? (lang === 'vi' ? 'Bảo chứng Escrow & Kiểm định Hub' : 'Escrow Protection & Hub Inspected')
                              : (lang === 'vi' ? 'Bảo chứng Quỹ Escrow An Toàn' : 'Escrow Protected')}
                          </span>
                        </div>
                      )}

                      {/* Inspection Method & Fee Sharing Badge */}
                      {hasInspection && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            <span>
                              {ord.inspectionMethod === 'AT_HOME'
                                ? (lang === 'vi' ? 'Kiểm Định Tận Nhà' : 'At-Home Inspection')
                                : (lang === 'vi' ? 'Kiểm Định Tại Hub SecondLife' : 'Hub Inspection')}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span>
                              {ord.inspectionFeeSplit === 'SPLIT_50_50'
                                ? (lang === 'vi' ? 'Chia đôi phí 50/50' : 'Split 50/50')
                                : ord.inspectionFeeSplit === 'SELLER_100'
                                  ? (lang === 'vi' ? 'Người bán 100%' : 'Seller 100%')
                                  : (lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%')}
                            </span>
                          </span>
                          {hasInspection && ord.inspectionMethod === 'AT_HOME' && savedAppointment?.scheduledAt && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                              <Calendar className="w-3 h-3 text-orange-600" />
                              <span>
                                {lang === 'vi'
                                  ? `Lịch hẹn KTV: ${new Date(savedAppointment.scheduledAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                                  : `Inspect: ${new Date(savedAppointment.scheduledAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Tag */}
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs text-slate-400 block">
                      {orderIsSeller
                        ? (lang === 'vi' ? 'Giá bán' : 'Listing Price')
                        : (lang === 'vi' ? 'Đơn giá sản phẩm' : 'Item Price')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {formatVND(ord.itemPriceVnd)}
                    </span>
                  </div>
                </div>

                {/* Cancelled Order Notice Banner in Card */}
                {isOrderCancelledOrRefunded(ord) && !ord.inspectionStatus && (() => {
                  const cancelInfo = getCancellationReasonDisplay(ord, lang);
                  return (
                    <div className="mx-4 sm:mx-6 mb-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs shadow-2xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-bold text-rose-950">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded'}</span>
                        </div>
                        {cancelInfo.code && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                            {cancelInfo.code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-900 pl-6">
                        <span className="font-bold text-rose-950">{lang === 'vi' ? 'Lý do hủy đơn: ' : 'Cancellation Reason: '}</span>
                        {cancelInfo.reason}
                      </p>
                      <p className="text-[11px] text-rose-600 pl-6 italic">
                        {lang === 'vi' ? 'Toàn bộ tiền ký quỹ Escrow đã hoàn trả cho người mua. Vận chuyển Lalamove đã dừng.' : 'Escrow funds refunded. Carrier dispatch deactivated.'}
                      </p>
                    </div>
                  );
                })()}

                {/* Seller Inspection Request Alert Banner */}
                {orderIsSeller && hasInspection && !isOrderCancelledOrRefunded(ord) && !isOrderReceiptConfirmed(ord) && (
                  <div className="mx-4 sm:mx-6 mb-3 p-3.5 rounded-2xl border text-xs shadow-2xs transition-all animate-fadeIn">
                    {(ord.inspectionMethod === 'AT_HOME' || (ord as any).orderType === 'AT_HOME' || String(ord.inspectionMethod).toUpperCase() === 'AT_HOME' || String((ord as any).orderType).toUpperCase() === 'AT_HOME') ? (
                      /* TRƯỜNG HỢP 1: KIỂM ĐỊNH TẬN NHÀ (KTV ĐẾN NHÀ) */
                      (() => {
                        const rejectionInfo = getOrderAppointmentRejection(ord);
                        const isOrderCountered = Boolean(
                          savedAppointment?.status === 'COUNTERED_BY_CENTER' ||
                          savedAppointment?.counterScheduledAt ||
                          (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
                          (ord as any).counterScheduledAt ||
                          (ord as any).status === 'WAITING_SELLER_APPROVAL' ||
                          (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
                          String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL'
                        );
                        const assignedInspector = (() => {
                          try {
                            const raw = localStorage.getItem(`order_assigned_inspector_${ord.id}`);
                            if (raw) return JSON.parse(raw);
                          } catch { }
                          if ((ord as any).inspectorName || ord.inspectorId) {
                            return {
                              inspectorId: ord.inspectorId,
                              inspectorName: (ord as any).inspectorName,
                              inspectorEmail: (ord as any).inspectorEmail,
                              inspectorPhone: (ord as any).inspectorPhone,
                            };
                          }
                          return null;
                        })();

                        return (
                          <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-3.5 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs ${rejectionInfo && !savedAppointment?.scheduledAt ? 'bg-rose-600 text-white' : isOrderCountered ? 'bg-orange-600 text-white' : isInspectorArrivedForOrder(ord.id, ord) ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                                  {rejectionInfo && !savedAppointment?.scheduledAt ? <AlertCircle className="w-3.5 h-3.5" /> : isOrderCountered ? <CalendarSync className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                                  <span>{lang === 'vi' ? 'Kiểm Định Tận Nhà (KTV Đến Nhà)' : 'At-Home Inspection (Technician Visit)'}</span>
                                </span>
                                <span className={`text-xs font-bold ${rejectionInfo && !savedAppointment?.scheduledAt ? 'text-rose-700' : isOrderCountered ? 'text-orange-800' : isInspectorArrivedForOrder(ord.id, ord) ? 'text-emerald-800 font-black' : 'text-amber-900'}`}>
                                  {rejectionInfo && !savedAppointment?.scheduledAt
                                    ? (lang === 'vi' ? 'Lịch hẹn bị từ chối • Vui lòng hẹn lại' : 'Appointment Rejected • Please Reschedule')
                                    : isInspectorArrivedForOrder(ord.id, ord)
                                      ? (lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting')
                                      : String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL'
                                        ? (lang === 'vi' ? 'Đã gửi đề xuất lại • Chờ người mua phản hồi' : 'Counter-proposal sent • Awaiting buyer response')
                                        : assignedInspector?.inspectorName
                                          ? (lang === 'vi' ? `Đã phân công KTV ${assignedInspector.inspectorName}` : `KTV ${assignedInspector.inspectorName} Assigned`)
                                          : isOrderCountered
                                            ? (lang === 'vi' ? 'Hub từ chối lịch cũ & đề xuất lịch mới • Cần phản hồi' : 'Center Proposed New Schedule • Action Needed')
                                            : savedAppointment?.scheduledAt
                                              ? (lang === 'vi' ? 'Đã hẹn lịch • Chờ Admin điều phối KTV' : 'Appointment Scheduled • Awaiting Dispatch')
                                              : (lang === 'vi' ? 'Chờ bạn hẹn lịch đón KTV' : 'Awaiting Appointment Schedule')}
                                </span>
                              </div>
                              {savedAppointment?.scheduledAt && !isOrderCountered && !isInspectorArrivedForOrder(ord.id, ord) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSchedulingOrder(ord);
                                    setSchedulingReadOnly(false);
                                  }}
                                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                                >
                                  {lang === 'vi' ? 'Đổi lịch hẹn khác' : 'Reschedule'}
                                </button>
                              )}
                            </div>

                            {/* Alert if appointment was rejected by Hub */}
                            {rejectionInfo && !savedAppointment?.scheduledAt && (
                              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 animate-fadeIn">
                                <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                  <span>Lịch hẹn trước đó đã bị Trung tâm kiểm định từ chối</span>
                                </div>
                                <div className="p-2 bg-white/90 rounded-lg border border-rose-200 text-[11px] leading-relaxed">
                                  <strong>Lý do từ chối:</strong> "{rejectionInfo.reason}"
                                </div>
                                <p className="text-[11px] text-rose-700">
                                  Vui lòng bấm nút <strong>"Đặt Lại Lịch Hẹn KTV"</strong> bên dưới để chọn lại ngày giờ hẹn khác phù hợp hơn.
                                </p>
                              </div>
                            )}

                            {/* Assigned Technician Banner */}
                            {assignedInspector ? (
                              <div className="flex items-center gap-2 text-xs font-bold text-purple-900 bg-purple-50/90 px-3 py-1.5 rounded-xl border border-purple-200">
                                <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
                                <span>
                                  {lang === 'vi' ? 'Kỹ thuật viên phụ trách:' : 'Assigned Technician:'}{' '}
                                  <strong className="text-purple-950 font-black">KTV {assignedInspector.inspectorName}</strong>
                                  {assignedInspector.inspectorPhone ? ` • 📞 ${assignedInspector.inspectorPhone}` : ''}
                                </span>
                              </div>
                            ) : savedAppointment?.scheduledAt && !isOrderCountered ? (
                              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 bg-blue-50/90 px-3 py-1.5 rounded-xl border border-blue-200">
                                <Clock className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
                                <span>
                                  {lang === 'vi' ? 'Kỹ thuật viên: Trung tâm SecondLife đang xác nhận lịch và phân công KTV theo ca' : 'Technician: SecondLife Hub is assigning technician'}
                                </span>
                              </div>
                            ) : null}

                            {isOrderCountered ? (() => {
                              const effectiveCounterTime =
                                savedAppointment?.counterScheduledAt ||
                                savedAppointment?.scheduledAt ||
                                (ord as any).counterScheduledAt ||
                                ord.appointmentScheduledAt ||
                                (ord as any).inspectionOrder?.counterScheduledAt ||
                                (ord as any).inspectionOrder?.appointmentScheduledAt;
                              const effectiveCounterShift =
                                savedAppointment?.counterShift ||
                                (ord as any).counterShift ||
                                (ord as any).inspectionOrder?.counterShift;
                              const effectiveCounterNote =
                                savedAppointment?.counterNote ||
                                (ord as any).counterNote ||
                                (ord as any).inspectionOrder?.counterNote;

                              const validCounterDate = effectiveCounterTime ? new Date(effectiveCounterTime) : null;
                              const isValidDate = Boolean(validCounterDate && !isNaN(validCounterDate.getTime()));

                              const counterApptPayload = savedAppointment || {
                                scheduledAt: effectiveCounterTime,
                                counterScheduledAt: effectiveCounterTime,
                                counterShift: effectiveCounterShift,
                                counterNote: effectiveCounterNote,
                                status: 'COUNTERED_BY_CENTER',
                              };

                              return (
                                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-300 text-xs text-amber-950 space-y-2.5 shadow-xs animate-fadeIn">
                                  <div className="flex items-center gap-2 text-orange-950 font-black">
                                    <CalendarSync className="w-4 h-4 text-orange-600 animate-pulse shrink-0" />
                                    <span>Trung tâm kiểm định đã từ chối lịch hẹn cũ &amp; đề xuất lịch mới:</span>
                                  </div>
                                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-amber-900">📅 Thời gian đề xuất:</span>
                                      <span className="font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                                        {isValidDate && validCounterDate
                                          ? validCounterDate.toLocaleString('vi-VN', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: 'numeric',
                                            })
                                          : 'Theo đề xuất của Trung tâm'}
                                        {effectiveCounterShift ? ` (${effectiveCounterShift === 'MORNING' ? 'Ca Sáng: 08:00 - 12:00' : 'Ca Chiều: 13:00 - 17:00'})` : ''}
                                      </span>
                                    </div>
                                    {effectiveCounterNote && (
                                      <div className="text-[11px] text-amber-900 italic">
                                        💬 <strong>Lý do từ Hub:</strong> "{effectiveCounterNote}"
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSellerAcceptCounterAppointment(ord.id, counterApptPayload)}
                                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Đồng Ý Lịch Này</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSchedulingOrder(ord);
                                        setSchedulingReadOnly(false);
                                      }}
                                      className="py-2 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>Hẹn Lại Lịch Khác</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })() : savedAppointment?.scheduledAt ? (
                              <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-950">
                                    📅 {lang === 'vi' ? 'Thời gian KTV đến nhà:' : 'Scheduled Arrival:'}
                                  </span>
                                  <span className="font-extrabold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                                    {new Date(savedAppointment.scheduledAt).toLocaleString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-bold">📍 {lang === 'vi' ? 'Địa chỉ đón KTV:' : 'Address:'}</span>{' '}
                                  <span>{ord.shippingLegs?.[0]?.origin || ord.listing?.location || 'Địa chỉ kho người bán'}</span>
                                </div>
                                {savedAppointment.note && (
                                  <div className="italic text-amber-800/80">
                                    💬 {lang === 'vi' ? 'Ghi chú đón KTV:' : 'Note:'} {savedAppointment.note}
                                  </div>
                                )}

                                {/* Mã Vạch Tiếp Nhận & Mã Code tương ứng cho KTV quét khi đến (CHỈ HIỂN THỊ KHI ĐÃ ĐƯỢC CHỐT VÀ ĐÃ CÓ KTV) */}
                                {assignedInspector ? (
                                  <div className="pt-1">
                                    <AtHomeIntakeBarcode
                                      orderId={ord.id}
                                      isArrived={isInspectorArrivedForOrder(ord.id, ord)}
                                      lang={lang}
                                      appointmentTime={savedAppointment.scheduledAt}
                                      inspectorName={assignedInspector?.inspectorName}
                                    />
                                  </div>
                                ) : (savedAppointment.status === 'PENDING_CENTER_CONFIRMATION' || savedAppointment.status === 'PENDING_CONFIRMATION') ? (
                                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2 mt-1">
                                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Đã gửi đề xuất lịch hẹn. Đang chờ Trung tâm kiểm định duyệt. Mã tiếp nhận KTV sẽ được tạo ngay khi KTV được phân công.</span>
                                  </div>
                                ) : savedAppointment.status === 'CONFIRMED' && (savedAppointment.confirmedBy === 'CENTER' || assignedInspector) ? (
                                   <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2 mt-1">
                                     <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                     <span>Lịch hẹn đã được xác nhận! Trung tâm SecondLife đang phân công Kỹ thuật viên phụ trách.</span>
                                   </div>
                                 ) : (
                                   <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2 mt-1">
                                     <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                     <span>Đã gửi đề xuất lịch hẹn. Đang chờ Trung tâm kiểm định duyệt. Mã tiếp nhận KTV sẽ được tạo ngay khi KTV được phân công.</span>
                                   </div>
                                 )}
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-lg bg-amber-100/60 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                                👉 <strong>{lang === 'vi' ? 'Lưu ý người bán:' : 'Seller note:'}</strong>{' '}
                                {String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL'
                                  ? (lang === 'vi'
                                    ? 'Bạn đã gửi lại đề xuất thay đổi phương án chia phí kiểm định. Vui lòng chờ người mua xem và đồng ý trong phòng chat trước khi hẹn lịch đón KTV.'
                                    : 'You have sent a counter-proposal. Please wait for the buyer to accept in chat before scheduling technician visit.')
                                  : (lang === 'vi'
                                    ? 'Khách mua đã đăng ký gói kiểm định tận nơi. Vui lòng bấm nút "Hẹn Lịch Đón KTV" bên dưới để chọn ngày giờ làm việc trong khung giờ hành chính (08:00 - 12:00 hoặc 13:00 - 17:00). Trung tâm SecondLife sẽ nhận thông tin để điều phối Kỹ thuật viên phù hợp.'
                                    : 'Buyer opted for at-home inspection. Technician will visit your location. Please click "Schedule Visit" below to choose appointment date during business hours (08:00 - 12:00 or 13:00 - 17:00)!')}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      /* TRƯỜNG HỢP 2: ĐƯA QUA TRUNG TÂM KIỂM ĐỊNH (SHIP 2 CHẶNG) */
                      (() => {
                        const localInsp = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${ord.id}`) : null;
                        const isInspFailed = ord.escrowStatus === 'INSPECTION_FAILED' || (ord as any).backendStatus === 'FAILED' || (ord as any).status === 'FAILED' || ord.inspectionReport?.status === 'FAILED' || localInsp === 'FAILED' || (ord as any).inspectionStatus === 'FAILED';
                        const isInspPassed = ord.escrowStatus === 'INSPECTION_PASSED' || (ord as any).backendStatus === 'PASSED' || (ord as any).status === 'PASSED' || ord.inspectionReport?.status === 'PASSED' || localInsp === 'PASSED' || (ord as any).inspectionStatus === 'PASSED';
                        const ordDecision = getInspectionPurchaseDecision(ord);
                        const isPendingDecision = isInspPassed && ordDecision !== 'accepted' && ordDecision !== 'rejected';
                        const isAccepted = isInspPassed && ordDecision === 'accepted';
                        const isRejected = ordDecision === 'rejected';

                        const ordAllShipments = getOrderAllShipments(ord.id);
                        const leg2Shipment = isRejected || isInspFailed
                          ? (ordAllShipments.find((s) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') || ordAllShipments.find((s) => s.leg === 'CENTER_TO_SELLER'))
                          : (ordAllShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') || ordAllShipments.find((s) => s.leg === 'CENTER_TO_BUYER'));
                        const isLeg2Delivered = leg2Shipment?.status === 'DELIVERED' || ord.escrowStatus === 'COMPLETED_RELEASED';
                        const isLeg2InTransit = leg2Shipment?.status === 'IN_TRANSIT' || leg2Shipment?.status === 'SHIPPED' || leg2Shipment?.status === 'PICKED_UP';

                        return (
                          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-3.5 rounded-xl border border-blue-200 text-blue-950 space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Kiểm Định Qua Hub (Ship 2 Chặng)' : 'Hub Inspection (2-Leg Delivery)'}</span>
                                </span>
                                <span className="text-xs font-bold text-blue-900">
                                  {isInspFailed
                                    ? (lang === 'vi' ? 'Kiểm định không đạt chuẩn • Chờ hoàn trả' : 'Inspection Failed • Pending Return')
                                    : isInspPassed
                                      ? (isPendingDecision
                                        ? (lang === 'vi' ? 'Đã kiểm định ĐẠT chuẩn • Chờ người mua quyết định' : 'Passed • Awaiting Buyer Decision')
                                        : isRejected
                                          ? (lang === 'vi' ? 'Người mua từ chối mua • Chờ hoàn trả' : 'Buyer Declined • Pending Return')
                                          : isLeg2Delivered
                                            ? (lang === 'vi' ? 'Chặng 2: Đã giao thành công người mua' : 'Delivered to Buyer')
                                            : isLeg2InTransit
                                              ? (lang === 'vi' ? 'Đang thực hiện Chặng 2 đến Người mua' : 'Leg 2 In Progress to Buyer')
                                              : (lang === 'vi' ? 'Đã kiểm định ĐẠT • Chờ điều phối giao người mua' : 'Passed • Awaiting Dispatch'))
                                      : ord.inspectionStatus === 'INSPECTING'
                                        ? buyerInspectionStageLabel('inspecting', lang)
                                        : ordShipment && getInboundShipmentProgress(ordShipment, lang).step === 3
                                          ? (lang === 'vi' ? 'Kiện hàng đã đến Hub • Chờ kiểm định' : 'Delivered to Hub • Pending Inspection')
                                          : isOrderSellerConfirmed(ord)
                                            ? (lang === 'vi' ? 'Đang thực hiện Chặng 1 đến Hub' : 'Leg 1 In Progress to Hub')
                                            : (lang === 'vi' ? 'Chờ người bán xác nhận gửi hàng Chặng 1' : 'Awaiting Seller Confirmation for Leg 1')}
                                </span>
                              </div>
                            </div>

                            {/* Visual 2-Leg Journey Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {/* Chặng 1 */}
                              <div className="p-2.5 rounded-lg bg-white/90 border border-blue-200 text-blue-950 space-y-1">
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-blue-700">📦 {lang === 'vi' ? 'Chặng 1: Gửi Hàng Đến Hub' : 'Leg 1: Send to Hub'}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-extrabold">
                                    {(() => {
                                      if (ordShipment) {
                                        const p = getInboundShipmentProgress(ordShipment, lang);
                                        if (p.step === 3) return lang === 'vi' ? 'Đã đến Hub' : 'Delivered to Hub';
                                        if (p.step === 2) return lang === 'vi' ? 'Đang giao Hub' : 'In Transit';
                                        return lang === 'vi' ? 'Chờ lấy hàng' : 'Pickup Pending';
                                      }
                                      if (ord.inspectionStatus === 'INSPECTING') return lang === 'vi' ? 'Đã phân công KTV' : 'Technician assigned';
                                      return isOrderSellerConfirmed(ord) ? (lang === 'vi' ? 'Đang chuẩn bị' : 'In Progress') : (lang === 'vi' ? 'Cần xác nhận' : 'Pending');
                                    })()}
                                  </span>
                                </div>
                                <div className="text-slate-600">
                                  {lang === 'vi'
                                    ? 'Người bán dán tem QR kiểm định lên kiện hàng và bàn giao cho Lalamove vận chuyển đến Trung tâm kiểm định Hub SecondLife.'
                                    : 'Seller packs item with QR tag and hands over to Lalamove courier to deliver to SecondLife Hub.'}
                                </div>
                              </div>

                              {/* Chặng 2 */}
                              <div className={`p-2.5 rounded-lg border space-y-1 ${isInspFailed || isRejected
                                ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                                : isPendingDecision
                                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                                  : isInspPassed
                                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                                    : 'bg-slate-50/90 border-slate-200 text-slate-700'
                                }`}>
                                <div className="flex items-center justify-between font-bold">
                                  <span className={
                                    isInspFailed || isRejected
                                      ? 'text-rose-700'
                                      : isPendingDecision
                                        ? 'text-amber-700'
                                        : isInspPassed
                                          ? 'text-emerald-700'
                                          : 'text-slate-700'
                                  }>
                                    🚚 {isInspFailed || isRejected
                                      ? (lang === 'vi' ? 'Chặng 2: Hoàn Trả Người Bán' : 'Leg 2: Return to Seller')
                                      : (lang === 'vi' ? 'Chặng 2: Hub Giao Người Mua' : 'Leg 2: Hub to Buyer')}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${isInspFailed || isRejected
                                    ? 'bg-rose-100 text-rose-800'
                                    : isPendingDecision
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : isInspPassed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}>
                                    {isInspFailed
                                      ? (lang === 'vi' ? 'Không đạt • Hoàn trả' : 'Failed • Return')
                                      : isRejected
                                        ? (lang === 'vi' ? 'Từ chối mua • Hoàn trả' : 'Declined • Return')
                                        : isPendingDecision
                                          ? (lang === 'vi' ? 'Đã đạt • Chờ người mua quyết định' : 'Passed • Awaiting Buyer')
                                          : isLeg2Delivered
                                            ? (lang === 'vi' ? 'Đã giao thành công' : 'Delivered')
                                            : isLeg2InTransit
                                              ? (lang === 'vi' ? 'Đang giao người mua' : 'In Transit')
                                              : isAccepted
                                                ? (lang === 'vi' ? 'Đã duyệt • Chờ giao' : 'Accepted • Awaiting Dispatch')
                                                : isInspPassed
                                                  ? (lang === 'vi' ? 'Đã đạt' : 'Passed')
                                                  : (lang === 'vi' ? 'Kích hoạt sau khi ĐẠT' : 'After Passed')}
                                  </span>
                                </div>
                                <div className={
                                  isInspFailed || isRejected
                                    ? 'text-rose-800 text-[11px]'
                                    : isPendingDecision
                                      ? 'text-amber-800 text-[11px]'
                                      : isInspPassed
                                        ? 'text-emerald-800 text-[11px]'
                                        : 'text-slate-500 text-[11px]'
                                }>
                                  {isInspFailed
                                    ? (lang === 'vi'
                                      ? 'Kiểm định không đạt. Trung tâm xử lý chặng trả hàng về người bán.'
                                      : 'Inspection failed. The center handles the return to the seller.')
                                    : isRejected
                                      ? (lang === 'vi'
                                        ? 'Người mua từ chối mua sau kiểm định. Trung tâm xử lý chuyển hoàn kiện hàng về người bán.'
                                        : 'Buyer declined purchase. Center handles return to seller.')
                                      : isPendingDecision
                                        ? (lang === 'vi'
                                          ? 'KTV Hub kiểm định ĐẠT chuẩn và dán tem niêm phong. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                                          : 'Inspection passed. Awaiting buyer review and decision.')
                                        : isLeg2Delivered
                                          ? (lang === 'vi'
                                            ? 'Chặng 2 đã giao kiện hàng thành công đến tận tay người mua.'
                                            : 'Leg 2 successfully delivered to buyer.')
                                          : isLeg2InTransit
                                            ? (lang === 'vi'
                                              ? 'Hub đang thực hiện chuyển phát trực tiếp kiện hàng đã kiểm định đến tận tay người mua.'
                                              : 'Hub is delivering inspected item to buyer.')
                                            : isInspPassed
                                              ? (lang === 'vi'
                                                ? 'KTV Hub kiểm định ĐẠT chuẩn và dán tem niêm phong. Hub tiến hành chuyển phát trực tiếp đến người mua.'
                                                : 'Passed inspection with seal applied. Hub dispatches directly to buyer.')
                                              : (lang === 'vi'
                                                ? 'Sau khi KTV Hub kiểm định ĐẠT chuẩn 48 bước và dán tem niêm phong, Hub sẽ tự động chuyển phát tiếp đến tận tay người mua.'
                                                : 'Once item passes 48-step Hub inspection and seal is applied, Hub dispatches package directly to buyer.')}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* Order Card Footer */}
                <div className="border-t border-gray-100 bg-slate-50/60 divide-y divide-gray-100">
                  {(orderIsSeller || !hasInspection) && (
                    <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        {orderIsSeller
                          ? (lang === 'vi'
                            ? `Thực nhận về ví (Đã trừ ${orderRatePercent}% phí sàn):`
                            : `Net Payout (after ${orderRatePercent}% platform fee):`)
                          : (lang === 'vi' ? 'Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):' : 'Total (incl. inspection & escrow guarantee):')}
                      </span>
                      <span className={`text-base sm:text-lg font-black ${orderIsSeller ? 'text-emerald-600' : 'text-[#24263e]'}`}>
                        {orderIsSeller ? `+${formatVND(sellerNetPayout)}` : formatVND(ord.totalPaidVnd)}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="px-4 sm:px-6 py-2.5 bg-white flex flex-wrap items-center justify-between gap-2.5">
                    {/* Left: View Details & Chat */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModalOrder(ord);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-gray-300 hover:border-[#c34c36] text-slate-700 hover:text-[#24263e] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{orderIsSeller ? (lang === 'vi' ? 'Chi tiết đơn ' : 'Order Details') : (lang === 'vi' ? 'Xem Chi Tiết' : 'View Details')}</span>
                      </button>

                      {onOpenChat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChat(ord.listing);
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0 flex items-center justify-center"
                          title={orderIsSeller ? (lang === 'vi' ? 'Nhắn tin với người mua' : 'Chat with buyer') : (lang === 'vi' ? 'Nhắn tin với người bán' : 'Chat with seller')}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Right: Operational Actions */}
                    <div className="flex items-center gap-2 flex-wrap justify-end py-0.5 ml-auto">
                      {renderInspectionDecision(ord)}
                      {/* Seller Actions */}
                      {orderIsSeller ? (
                        isOrderReceiptConfirmed(ord) ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã Nhận Tiền Vào Ví' : 'Funds Credited to Wallet'}</span>
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackingOrder(ord);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                            >
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                            </button>
                          </>
                        ) : isOrderCancelledOrRefunded(ord) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 whitespace-nowrap shrink-0">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{Boolean(hasInspection || ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) || ord.inspectionCenterId || ord.inspectionStatus)
                              ? (lang === 'vi' ? 'Đã đóng giao dịch' : 'Transaction closed')
                              : (lang === 'vi' ? 'Đã Hủy • Dừng Vận Chuyển' : 'Cancelled • Inactive')}</span>
                          </span>
                        ) : (
                          <>
                            {/* GIAI ĐOẠN 1: CHỜ XÁC NHẬN ĐƠN / CHỜ ĐỒNG Ý KIỂM ĐỊNH */}
                            {!isOrderSellerConfirmed(ord) && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && !isOrderReceiptConfirmed(ord) && ord.backendStatus !== 'COMPLETED' && !ord.shippingDeliveredAt && (
                              <>
                                {hasInspection ? (
                                  <>
                                    {String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL' ? (
                                      onOpenChat ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenChat(ord.listing);
                                          }}
                                          className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                          title={lang === 'vi' ? 'Xem trao đổi trong phòng chat' : 'View chat'}
                                        >
                                          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                          <span>{lang === 'vi' ? 'Đang Chờ Người Mua Duyệt' : 'Awaiting Buyer Approval'}</span>
                                        </button>
                                      ) : (
                                        <span className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold whitespace-nowrap shrink-0">
                                          {lang === 'vi' ? 'Đang Chờ Người Mua Duyệt' : 'Awaiting Buyer Approval'}
                                        </span>
                                      )
                                    ) : (
                                      <>
                                        {ord.inspectionMethod === 'AT_HOME' ? (
                                          !isInspectorArrivedForOrder(ord.id, ord) ? (
                                            /* Nút Hẹn Lịch Tiếp Đón KTV (Kiểm định tại nhà) */
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSchedulingOrder(ord);
                                                setSchedulingReadOnly(false);
                                              }}
                                              disabled={orderActionLoading === ord.id}
                                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                                              title="Chọn ngày giờ kỹ thuật viên SecondLife đến nhà kiểm tra thiết bị"
                                            >
                                              <Calendar className="w-3.5 h-3.5" />
                                              <span>
                                                {savedAppointment?.scheduledAt
                                                  ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Reschedule Visit')
                                                  : (lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Visit')}
                                              </span>
                                            </button>
                                          ) : (
                                            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
                                              <Wrench className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                              <span>{lang === 'vi' ? 'KTV Đang Kiểm Tra Máy' : 'Inspecting Device'}</span>
                                            </span>
                                          )
                                        ) : (
                                          /* Nút Xác Nhận Đồng Ý Kiểm Định & Gửi Hub (Chặng 1) */
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSellerConfirmOrder(ord.id);
                                            }}
                                            disabled={orderActionLoading === ord.id}
                                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                                            title="Xác nhận đồng ý kiểm định và chuẩn bị gửi hàng Chặng 1 đến Trung tâm Hub SecondLife"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>
                                              {orderActionLoading === ord.id
                                                ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                                : (lang === 'vi' ? ' Đồng ý kiểm định' : 'Accept Inspection')}
                                            </span>
                                          </button>
                                        )}

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePromptRejectInspection(ord);
                                          }}
                                          disabled={orderActionLoading === ord.id}
                                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                                          title="Từ chối yêu cầu kiểm định"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                          <span>{lang === 'vi' ? 'Từ chối' : 'Reject Inspection'}</span>
                                        </button>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSellerConfirmOrder(ord.id);
                                      }}
                                      disabled={orderActionLoading === ord.id}
                                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 animate-pulse whitespace-nowrap shrink-0"
                                      title="Người bán kiểm tra còn hàng và cam kết chuẩn bị hàng theo hạn chót SLA"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>
                                        {orderActionLoading === ord.id
                                          ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                          : (lang === 'vi' ? 'Xác Nhận Đơn Hàng' : 'Confirm Order')}
                                      </span>
                                    </button>

                                    {onCancelOrder && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePromptCancelOrder(ord);
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                                        title="Hủy đơn hàng nếu hết hàng hoặc không thể đáp ứng"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}

                            {/* GIAI ĐOẠN NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) CHO SELLER */}
                            {String((ord as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                              (() => {
                                const isFeePending = isPartyInspectionFeePending(ord, true);
                                const sellerFee = getPartyInspectionFee(ord, true);
                                const isFeePaid = isPartyInspectionFeePaid(ord, true);
                                const deadline = ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline;
                                const isFeeExpired = isInspectionPaymentExpired(deadline);

                                if (isFeePending) {
                                  return (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isFeeExpired) {
                                            dialogService.error(
                                              lang === 'vi'
                                                ? `Đơn hàng đã quá hạn nộp phí kiểm định (${formatInspectionDeadline(deadline, lang)}). Vui lòng tải lại đơn hàng.`
                                                : `Inspection fee payment deadline has expired (${formatInspectionDeadline(deadline, lang)}).`,
                                              'Đã Hết Hạn'
                                            );
                                            onRefreshOrders?.();
                                            return;
                                          }
                                          handlePayInspectionFee(ord.id);
                                        }}
                                        disabled={orderActionLoading === ord.id || isFeeExpired}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 ${isFeeExpired
                                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                                          : 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white cursor-pointer'
                                          }`}
                                        title={isFeeExpired
                                          ? (lang === 'vi' ? `Đã quá hạn đóng phí kiểm định (${formatInspectionDeadline(deadline, lang)})` : 'Fee payment deadline expired')
                                          : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(sellerFee)}) từ Ví SecondLife` : 'Pay inspection fee from wallet')}
                                      >
                                        <Wallet className="w-3.5 h-3.5" />
                                        <span>
                                          {orderActionLoading === ord.id
                                            ? (lang === 'vi' ? 'Đang nộp...' : 'Processing...')
                                            : isFeeExpired
                                              ? (lang === 'vi' ? 'Đã Hết Hạn Đóng Phí' : 'Fee Payment Expired')
                                              : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(sellerFee)})` : `Pay Inspection Fee (${formatVND(sellerFee)})`)}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                }

                                if (isFeePaid) {
                                  return (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 whitespace-nowrap shrink-0">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>
                                        {lang === 'vi'
                                          ? `Đã nộp phí (${formatVND(sellerFee)}) • Chờ người mua thanh toán`
                                          : 'Fee paid • Awaiting buyer payment'}
                                      </span>
                                    </span>
                                  );
                                }

                                return null;
                              })()
                            )}

                            {/* GIAI ĐOẠN 2: ĐÃ XÁC NHẬN • ĐANG ĐÓNG GÓI */}
                            {isOrderSellerConfirmed(ord) &&
                              !['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || '').toUpperCase()) &&
                              !inboundLabel &&
                              !isOrderReceiptConfirmed(ord) &&
                              ord.backendStatus !== 'COMPLETED' &&
                              !ord.shippingDeliveredAt &&
                              !isOrderPacked(ord) &&
                              ord.backendStatus !== 'SHIPPED' &&
                              ord.backendStatus !== 'DELIVERED' &&
                              ord.escrowStatus !== 'SHIPPED_TO_BUYER' &&
                              ord.escrowStatus !== 'DELIVERED_INSPECTION_WINDOW' &&
                              ord.escrowStatus !== 'COMPLETED_RELEASED' &&
                              ord.escrowStatus !== 'INSPECTION_PASSED' &&
                              (ord as any).backendStatus !== 'PASSED' && (
                                <>
                                  {/* Nút Đã Đóng Gói • Tạo Đơn Lalamove cho Chặng 1 hoặc đơn thông thường */}
                                  {(!hasInspection || (ord.inspectionMethod !== 'AT_HOME' && (ord as any).orderType !== 'AT_HOME')) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCreateShipmentOrder(ord);
                                      }}
                                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                                      title={lang === 'vi' ? 'Kiện hàng đã đóng gói. Bấm để tạo vận đơn Lalamove điều phối tài xế lấy hàng' : 'Package is packed. Click to create Lalamove shipment'}
                                    >
                                      <Truck className="w-3.5 h-3.5" />
                                      <span>
                                        {lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Order'}
                                      </span>
                                    </button>
                                  )}



                                  {/* Nút Hẹn Giờ Kiểm Định (CHỈ HIỆN KHI ĐƠN HÀNG LÀ KIỂM ĐỊNH TẬN NHÀ - AT_HOME) */}
                                  {hasInspection && (ord.inspectionMethod === 'AT_HOME' || (ord as any).orderType === 'AT_HOME') && (
                                    !isInspectorArrivedForOrder(ord.id, ord) ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSchedulingOrder(ord);
                                          setSchedulingReadOnly(false);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                        title={lang === 'vi' ? 'Người bán lên lịch hẹn ngày giờ kỹ thuật viên đến kiểm định tại nhà' : 'Schedule inspection appointment with Hub technician at home'}
                                      >
                                        <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                        <span>
                                          {savedAppointment?.scheduledAt
                                            ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Reschedule Visit')
                                            : (lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Visit')}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
                                        <Wrench className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                        <span>{lang === 'vi' ? 'KTV Đang Kiểm Tra Máy' : 'Inspecting Device'}</span>
                                      </span>
                                    )
                                  )}

                                  {/* Nút Hủy Yêu Cầu Kiểm Định Cho Seller (Khi KTV chưa đến nơi) */}
                                  {hasInspection && onCancelOrder && !ord.inspectionReport && !isInspectorArrivedForOrder(ord.id, ord) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePromptCancelInspectionRequest(ord);
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                                      title={lang === 'vi' ? 'Hủy yêu cầu kiểm định cho đơn hàng này' : 'Cancel inspection request'}
                                    >
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>{lang === 'vi' ? 'Hủy Kiểm Định' : 'Cancel'}</span>
                                    </button>
                                  )}
                                </>
                              )}

                            {/* GIAI ĐOẠN 3: ĐÃ ĐÓNG GÓI • CHỜ SHIPPER ĐẾN LẤY (Chỉ hiển thị khi đơn chưa có Lalamove Tracking box) */}
                            {!hasActiveShipment && (!hasInspection || (ord.inspectionMethod !== 'AT_HOME' && (ord as any).orderType !== 'AT_HOME')) && (hasInboundTracking || (isOrderPacked(ord) &&
                              !isOrderReceiptConfirmed(ord) &&
                              ord.backendStatus !== 'COMPLETED' &&
                              !ord.shippingDeliveredAt &&
                              !ord.carrierPickedUpAt &&
                              ord.backendStatus !== 'SHIPPED' &&
                              ord.backendStatus !== 'DELIVERED' &&
                              ord.escrowStatus !== 'SHIPPED_TO_BUYER' &&
                              ord.escrowStatus !== 'DELIVERED_INSPECTION_WINDOW' &&
                              ord.escrowStatus !== 'COMPLETED_RELEASED')) && (
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 whitespace-nowrap shrink-0 shadow-xs cursor-default select-none pointer-events-none"
                                >
                                  <PackageCheck className="w-4 h-4 text-teal-600" />
                                  <span>{lang === 'vi' ? 'Đã Đóng Gói • Chờ Tài Xế Lấy' : 'Packed • Waiting for Carrier'}</span>
                                </span>
                              )}

                            {/* GIAI ĐOẠN 4: ĐANG GIAO HÀNG (Hoặc đã hoàn thành) */}
                            {!hasInboundTracking && (ord.carrierPickedUpAt ||
                              ord.backendStatus === 'SHIPPED' ||
                              ord.backendStatus === 'DELIVERED' ||
                              ord.escrowStatus === 'SHIPPED_TO_BUYER' ||
                              ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                              ord.escrowStatus === 'COMPLETED_RELEASED') && (
                                <>
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 whitespace-nowrap shrink-0">
                                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                                    <span>
                                      {ord.backendStatus === 'DELIVERED' || ord.escrowStatus === 'COMPLETED_RELEASED'
                                        ? (lang === 'vi' ? 'Đã Giao Thành Công' : 'Delivered')
                                        : (lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit')}
                                    </span>
                                  </span>

                                  {!hasActiveShipment && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTrackingOrder(ord);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                    >
                                      <Truck className="w-3.5 h-3.5 text-white" />
                                      <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                                    </button>
                                  )}
                                </>
                              )}



                            {/* Completed: Escrow released notice */}
                            {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{lang === 'vi' ? 'Đã Giải Ngân Vào Ví' : 'Funds Credited to Wallet'}</span>
                              </span>
                            )}
                          </>
                        )
                      ) : (
                        /* Buyer Actions */
                        isOrderCancelledOrRefunded(ord) ? (
                          getInspectionPurchaseDecision(ord) !== 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 whitespace-nowrap shrink-0">
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              <span>{Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) || ord.inspectionCenterId || ord.inspectionStatus)
                                ? (lang === 'vi' ? 'Đã đóng giao dịch' : 'Transaction closed')
                                : (lang === 'vi' ? 'Đã Hoàn Tiền Vào Ví' : 'Refunded to Wallet')}</span>
                            </span>
                          )
                        ) : (
                          <>
                            {/* Cancel Order / Inspection Request Button for Buyer */}
                            {onCancelOrder && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.escrowStatus !== 'COMPLETED_RELEASED' && (
                              (!ord.sellerConfirmedAt && ord.confirmationStatus !== 'CONFIRMED') ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePromptCancelOrder(ord);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                                  title={lang === 'vi' ? 'Hủy đơn hàng (Chỉ khả dụng khi người bán chưa xác nhận đơn)' : 'Cancel order (Available while seller has not confirmed)'}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                                </button>
                              ) : (
                                Boolean(hasInspection && !ord.inspectionReport && !isInspectorArrivedForOrder(ord.id, ord) && !isOrderReceiptConfirmed(ord)) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePromptCancelInspectionRequest(ord);
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                                    title={lang === 'vi' ? 'Hủy yêu cầu kiểm định và hoàn trả tiền về ví' : 'Cancel inspection request'}
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>{lang === 'vi' ? 'Hủy Yêu Cầu Kiểm Định' : 'Cancel Inspection'}</span>
                                  </button>
                                )
                              )
                            )}

                            {/* Buyer tracking is available outside the inspection and purchase-decision stages. */}
                            {!hasActiveShipment && !buyerInspectionStage && !isOrderUnpaid(ord) && ord.escrowStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.backendStatus !== 'CANCELLED' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrackingOrder(ord);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                              >
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                              </button>
                            )}

                            {/* Inspection Certificate Button for Buyer (ONLY when inspection passed) */}
                            {hasInspection && (ord.escrowStatus === 'INSPECTION_PASSED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.escrowStatus === 'SHIPPED_TO_BUYER' || ord.escrowStatus === 'COMPLETED_RELEASED') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCertificateModalOrder(ord);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                title="Xem Giấy Chứng Nhận & Biên Bản Nghiệm Thu Kỹ Thuật Số"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-600" />
                                <span>{lang === 'vi' ? 'Xem Chứng Nhận Kiểm Định' : 'Inspection Certificate'}</span>
                              </button>
                            )}

                            {/* Inspection Status Badge for Buyer */}
                            {hasInspection && ord.escrowStatus === 'AWAITING_INSPECTION' && isOrderSellerConfirmed(ord) && !['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'PENDING'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || '').toUpperCase()) && (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border whitespace-nowrap shrink-0 ${String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || '').toUpperCase() === 'WAITING_FEE_PAYMENT'
                                ? 'text-orange-800 bg-orange-50 border-orange-200'
                                : 'text-blue-800 bg-blue-50 border-blue-200'
                                }`}>
                                {String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || '').toUpperCase() === 'WAITING_FEE_PAYMENT' ? (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-orange-600" />
                                    <span>
                                      {isInspectionPaymentExpired(ord.paymentDeadline)
                                        ? (lang === 'vi' ? 'Quá hạn đóng phí kiểm định' : 'Fee payment expired')
                                        : isPartyInspectionFeePaid(ord, false)
                                          ? (lang === 'vi' ? 'Đã nộp phí • Chờ người bán nộp phí' : 'Fee paid • Awaiting seller payment')
                                          : isPartyInspectionFeePending(ord, false)
                                            ? (lang === 'vi' ? `Chờ bạn nộp phí (${formatVND(getPartyInspectionFee(ord, false))})` : `Awaiting your fee payment (${formatVND(getPartyInspectionFee(ord, false))})`)
                                            : (lang === 'vi' ? 'Chờ đóng phí kiểm định' : 'Awaiting inspection fee payment')}
                                      {ord.paymentDeadline && (
                                        <span className="font-normal opacity-85 ml-1">
                                          ({formatInspectionDeadline(ord.paymentDeadline, lang)})
                                        </span>
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                    <span>
                                      {(() => {
                                        if (ord.inspectionMethod === 'AT_HOME') {
                                          const atHomeAppt = getOrderAppointment(ord);
                                          const isAtHomeCountered =
                                            atHomeAppt?.status === 'COUNTERED_BY_CENTER' ||
                                            Boolean(atHomeAppt?.counterScheduledAt) ||
                                            ord.status === 'WAITING_SELLER_APPROVAL' ||
                                            (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
                                            String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL' ||
                                            (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER';
                                          const isAtHomePendingAppr = atHomeAppt?.status === 'PENDING_CENTER_CONFIRMATION' || atHomeAppt?.status === 'PENDING_CONFIRMATION';
                                          const hasAtHomeInsp = Boolean(ord.inspectorId || (ord as any).inspectorName);

                                          if (isAtHomeCountered) {
                                            return lang === 'vi' ? 'Trung tâm đề xuất lịch mới • Đang thương lượng' : 'Center Proposed New Time • Negotiating';
                                          }
                                          if (isAtHomePendingAppr) {
                                            return lang === 'vi' ? 'Đã đề xuất lịch hẹn • Chờ Trung tâm duyệt' : 'Appointment Proposed • Awaiting Approval';
                                          }
                                          if (hasAtHomeInsp) {
                                            return lang === 'vi' ? 'Đã phân công KTV • Chờ đến kiểm tra' : 'Inspector Assigned • Awaiting Inspection';
                                          }
                                          if (atHomeAppt?.status === 'CONFIRMED') {
                                            return lang === 'vi' ? 'Đã chốt lịch hẹn • Đang xếp KTV' : 'Schedule Confirmed • Dispatching Inspector';
                                          }
                                          return lang === 'vi' ? 'Người bán đã đồng ý • Chờ chốt lịch hẹn KTV' : 'Seller Confirmed • Awaiting Schedule';
                                        }
                                        return lang === 'vi' ? 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub' : 'Seller Confirmed • Hub Dispatching';
                                      })()}
                                    </span>
                                  </>
                                )}
                              </span>
                            )}

                            {/* Buyer: Người bán đề xuất lại phương án kiểm định */}
                            {hasInspection && String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ((ord as any)?.status !== 'AWAITING_INSPECTION' ? (ord as any)?.status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL' && onOpenChat && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenChat(ord.listing);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                title={lang === 'vi' ? 'Vào phòng chat để xem và phản hồi đề xuất mới của người bán' : 'Open chat to review seller counter-proposal'}
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                <span>{lang === 'vi' ? 'Vào Chat Xem Đề Xuất Mới' : 'Review Proposal in Chat'}</span>
                              </button>
                            )}

                            {/* Inspection In Progress Notice for Buyer */}
                            {hasInspection && (ord.escrowStatus === 'INSPECTION_IN_PROGRESS' || (ord.escrowStatus === 'HELD_IN_ESCROW' && ord.sellerConfirmedAt)) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 whitespace-nowrap shrink-0">
                                <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                <span>{lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
                              </span>
                            )}

                            {/* Inspection Appointment Action for Seller and Buyer */}
                            {hasInspection && (ord.inspectionMethod === 'AT_HOME' || (ord as any).orderType === 'AT_HOME') && (savedAppointment?.scheduledAt || savedAppointment?.counterScheduledAt) && (
                              orderIsSeller ? (
                                (savedAppointment?.status === 'COUNTERED_BY_CENTER' || Boolean(savedAppointment?.counterScheduledAt)) ? (
                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleSellerAcceptCounterAppointment(ord.id, savedAppointment)}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                                      title={lang === 'vi' ? 'Đồng ý với lịch hẹn đề xuất mới từ Trung tâm kiểm định' : 'Accept proposed appointment time'}
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>{lang === 'vi' ? 'Đồng Ý Lịch Mới' : 'Accept New Time'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSchedulingOrder(ord);
                                        setSchedulingReadOnly(false);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                                      title={lang === 'vi' ? 'Chọn lại khung giờ hoặc ngày khác gửi lại cho Hub' : 'Reschedule to another time'}
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{lang === 'vi' ? 'Hẹn Lại Lịch Khác' : 'Reschedule'}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSchedulingOrder(ord);
                                      setSchedulingReadOnly(false);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                    title={lang === 'vi' ? 'Xem hoặc đổi lịch hẹn đón KTV' : 'View or change appointment'}
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                    <span>{lang === 'vi' ? 'Xem / Đổi Lịch Hẹn KTV' : 'View / Change Appointment'}</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSchedulingOrder(ord);
                                    setSchedulingReadOnly(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                  title={lang === 'vi' ? 'Xem lịch hẹn kiểm định do người bán đã đặt' : 'View inspection appointment scheduled by seller'}
                                >
                                  <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                  <span>{lang === 'vi' ? 'Xem Lịch Hẹn KTV' : 'View Appointment'}</span>
                                </button>
                              )
                            )}

                            {/* Buyer Pay Inspection Fee or Bank Transfer Escrow Deposit (CHỈ HIỆN KHI ĐƠN HÀNG CHƯA THANH TOÁN) */}
                            {isOrderUnpaid(ord) && !orderIsSeller && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenBankPaymentModal(ord);
                                  }}
                                  disabled={loadingBankPaymentId === ord.id}
                                  className="px-3 py-1.5 rounded-xl bg-[#24263e] hover:bg-[#1a1c2e] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                                  title="Quét mã VietQR để nạp tiền ký quỹ Escrow đóng băng bảo vệ đơn hàng"
                                >
                                  {loadingBankPaymentId === ord.id ? (
                                    <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  ) : (
                                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                  <span>{lang === 'vi' ? 'Quét Mã VietQR Ký Quỹ' : 'VietQR Escrow Deposit'}</span>
                                </button>

                                {Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0)) && !isPartyInspectionFeePaid(ord, false) && (
                                  (() => {
                                    const buyerFee = getPartyInspectionFee(ord, false);
                                    if (buyerFee <= 0) return null;
                                    const isFeeExpired = isInspectionPaymentExpired(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline);
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isFeeExpired) {
                                            dialogService.error(
                                              lang === 'vi'
                                                ? `Đơn hàng đã quá hạn nộp phí kiểm định (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)}). Vui lòng tải lại đơn hàng.`
                                                : `Inspection fee payment deadline has expired (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)}).`,
                                              'Đã Hết Hạn'
                                            );
                                            onRefreshOrders?.();
                                            return;
                                          }
                                          handlePayInspectionFee(ord.id);
                                        }}
                                        disabled={orderActionLoading === ord.id || isFeeExpired}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 ${isFeeExpired
                                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                                          : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white cursor-pointer'
                                          }`}
                                        title={isFeeExpired
                                          ? (lang === 'vi' ? `Đã quá hạn đóng phí kiểm định (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)})` : 'Fee payment deadline expired')
                                          : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(buyerFee)}) từ Ví SecondLife` : 'Pay inspection fee from wallet')}
                                      >
                                        <Wallet className="w-3.5 h-3.5" />
                                        <span>
                                          {orderActionLoading === ord.id
                                            ? (lang === 'vi' ? 'Đang nộp...' : 'Processing...')
                                            : isFeeExpired
                                              ? (lang === 'vi' ? 'Đã Hết Hạn Đóng Phí' : 'Fee Payment Expired')
                                              : (lang === 'vi' ? `Nộp Phí Kiểm Định (${formatVND(buyerFee)})` : `Pay Fee (${formatVND(buyerFee)})`)}
                                        </span>
                                      </button>
                                    );
                                  })()
                                )}
                              </div>
                            )}

                            {/* Nút Đã Nhận Hàng (Giải Ngân): Khi người mua đã xác nhận/giải ngân thì ẩn hoàn toàn nút, không cho bấm lại */}
                            {!buyerInspectionStage && !isOrderReceiptConfirmed(ord) && (
                              ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                              ord.backendStatus === 'DELIVERED' ||
                              ord.shippingDeliveredAt ||
                              ord.escrowStatus === 'SHIPPED_TO_BUYER' ||
                              (ord as any).inspectionStatus === 'DELIVERING_TO_BUYER' ||
                              (ord as any).inspectionStatus === 'PASSED'
                            ) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirmingReceiptIds.has(ord.id) || isOrderReceiptConfirmed(ord)) return;
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: lang === 'vi' ? 'Xác Nhận Đã Nhận Hàng' : 'Confirm Delivery Receipt',
                                    message: lang === 'vi'
                                      ? 'Xác nhận bạn đã nhận hàng đầy đủ và nghiệm thu sản phẩm?'
                                      : 'Confirm you have received and inspected the item?',
                                    subMessage: lang === 'vi'
                                      ? 'Tiền ký quỹ trong Escrow sẽ được giải ngân an toàn cho người bán. Hành động này không thể hoàn tác.'
                                      : 'Escrow funds will be released to the seller immediately.',
                                    confirmText: lang === 'vi' ? 'Đã Nhận Hàng (Giải Ngân)' : 'Confirm Receipt',
                                    cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
                                    variant: 'success',
                                    iconType: 'check',
                                    onConfirm: () => {
                                      setConfirmingReceiptIds((prev) => new Set(prev).add(ord.id));
                                      try {
                                        if (typeof window !== 'undefined') {
                                          localStorage.setItem(`order_receipt_confirmed_${ord.id}`, 'true');
                                        }
                                      } catch { }
                                      onConfirmReceipt(ord.id);
                                      setConfirmDialog(null);
                                    }
                                  });
                                }}
                                disabled={confirmingReceiptIds.has(ord.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse whitespace-nowrap shrink-0"
                                title="Xác nhận đã nhận máy an toàn và giải ngân Escrow cho người bán"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{confirmingReceiptIds.has(ord.id) ? (lang === 'vi' ? 'Đang giải ngân...' : 'Processing...') : (lang === 'vi' ? 'Đã Nhận Hàng (Giải Ngân)' : 'Confirm Delivery')}</span>
                              </button>
                            ) : !buyerInspectionStage && ord.escrowStatus === 'SHIPPED_TO_BUYER' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrackingOrder(ord);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                                title="Bưu tá đang giao hàng, bạn có thể kiểm tra định vị bưu kiện"
                              >
                                <Truck className="w-3.5 h-3.5 text-amber-600" />
                                <span>{lang === 'vi' ? 'Kiểm Tra Giao Hàng' : 'In Transit'}</span>
                              </button>
                            ) : null}

                            {/* Leave Product Review button for delivered / completed orders */}
                            {!buyerInspectionStage && (isOrderReceiptConfirmed(ord) || ord.escrowStatus === 'COMPLETED_RELEASED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewModalOrder(ord);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 ${reviewedOrderIds.includes(ord.id)
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white'
                                  }`}
                                title="Đánh giá chất lượng sản phẩm & mức độ uy tín người bán"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>
                                  {reviewedOrderIds.includes(ord.id)
                                    ? (lang === 'vi' ? 'Xem / Sửa Đánh Giá' : 'Edit Review')
                                    : (lang === 'vi' ? 'Đánh Giá Sản Phẩm' : 'Write Review')}
                                </span>
                              </button>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* 48h Auto-release notice banner on the order card */}
                {!buyerInspectionStage && ord.shippingDeliveredAt && !isOrderReceiptConfirmed(ord) && ord.escrowStatus !== 'COMPLETED_RELEASED' && (ord.escrowStatus as any) !== 'RELEASED' && (ord as any).backendStatus !== 'COMPLETED' && ord.escrowStatus !== 'DISPUTED' && (
                  <div className="mt-3 mx-4 sm:mx-6 mb-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        Đã giao thành công lúc {new Date(ord.shippingDeliveredAt).toLocaleString('vi-VN')}
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Hệ thống sẽ <strong>tự động giải ngân</strong> cho người bán sau 48 giờ kể từ khi giao thành công. Người mua có thể nhấn <strong>"Đã Nhận Hàng"</strong> để giải ngân ngay lập tức, hoặc gửi khiếu nại nếu sản phẩm có sai sót.
                      </p>
                    </div>
                  </div>
                )}
              </div>
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

      {/* POPUP MODAL: CHI TIẾT ĐƠN HÀNG KHI NGƯỜI DÙNG BẤM VÀO */}
      {detailModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailModalOrder(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-[#FFFFFF] border border-gray-200 shadow-2xl text-[#24263e] flex flex-col overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 px-6 sm:px-7 py-4 sm:py-5 border-b border-gray-100 bg-white shrink-0 z-10">
              <div className="min-w-0 space-y-1 flex-1">
                <div className="flex items-center flex-wrap gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-[#24263e] flex items-center flex-wrap gap-2">
                    <span>{lang === 'vi' ? 'Chi tiết đơn hàng: ' : 'Order Details:'}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 select-all break-all">#{detailModalOrder.id}</span>
                  </h2>
                  {getStatusBadge(
                    isOrderReceiptConfirmed(detailModalOrder) ? 'COMPLETED_RELEASED' : detailModalOrder.escrowStatus,
                    detailHasInspection,
                    isOrderSeller(detailModalOrder),
                    detailModalOrder
                  )}
                </div>
                <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-800">{detailModalOrder.sellerName}</strong></span>
                  <span>•</span>
                  <span>{lang === 'vi' ? 'Người mua:' : 'Buyer:'} <strong className="text-slate-800">{detailModalOrder.buyerName}</strong></span>
                  <span>•</span>
                  <span>{lang === 'vi' ? 'Đặt ngày' : 'Ordered on'}{' '}
                    <strong className="text-slate-700">
                      {(() => {
                        const t = getSortableOrderTimestamp(detailModalOrder);
                        return t > 0 ? new Date(t).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : (detailModalOrder.createdAt || '--/--/----');
                      })()}
                    </strong>
                  </span>
                </p>
              </div>

              <button
                onClick={() => setDetailModalOrder(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 space-y-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {/* Order Cancellation Reason Banner in Detail Modal */}
              {isOrderCancelledOrRefunded(detailModalOrder) && !detailModalOrder.inspectionStatus && (() => {
                const cancelInfo = getCancellationReasonDisplay(detailModalOrder, lang);
                return (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                          <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-rose-950">
                            {lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded'}
                          </h4>
                          <p className="text-[11px] text-rose-700">
                            {lang === 'vi'
                              ? 'Tiền ký quỹ Escrow đã được bảo toàn và hoàn lại 100% về ví người mua'
                              : 'Escrow funds have been 100% refunded to buyer wallet'}
                          </p>
                        </div>
                      </div>
                      {cancelInfo.code && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                          {cancelInfo.code}
                        </span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-rose-200/80 text-xs">
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-rose-950 whitespace-nowrap">
                          {lang === 'vi' ? 'Lý do hủy đơn:' : 'Cancellation Reason:'}
                        </span>
                        <span className="font-semibold text-rose-900">
                          {cancelInfo.reason}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-600/90 mt-1 italic">
                        {lang === 'vi'
                          ? '• Lưu ý: Các đơn đã bị hủy sẽ dừng toàn bộ hoạt động tra cứu vận đơn và không thể tạo mã vận đơn mới.'
                          : '• Note: Cancelled orders can no longer create shipments or track Lalamove routes.'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Product Info Card in Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 border border-gray-200">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <img
                    src={detailModalOrder.listing.photos.front}
                    alt={detailModalOrder.listing.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-white shadow-2xs"
                  />
                  <div className="min-w-0 space-y-1 flex-1">
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 break-words">
                      {detailModalOrder.listing.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="bg-white px-2 py-0.5 rounded-md border border-gray-200 font-medium">
                        {resolveListingCategory(detailModalOrder.listing)}
                      </span>
                      <span>•</span>
                      <span>{lang === 'vi' ? 'Tình trạng:' : 'Condition:'} <strong className="text-slate-800">{detailModalOrder.listing.conditionGrade}</strong></span>
                      <span>•</span>
                      <span>{lang === 'vi' ? 'Số lượng: 1' : 'Qty: 1'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/80">
                  <div className="text-[11px] text-slate-400 font-medium">{lang === 'vi' ? 'Đơn giá niêm yết' : 'Listing Price'}</div>
                  <div className="text-base sm:text-lg font-black text-[#24263e]">
                    {formatVND(detailModalOrder.itemPriceVnd)}
                  </div>
                </div>
              </div>

              {/* Seller confirmation for direct purchases */}
              {!detailHasInspection && !isOrderCancelledOrRefunded(detailModalOrder) && (
                detailModalOrder.sellerConfirmedAt ? (
                  <div className="px-4 py-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Người bán đã xác nhận đơn hàng thành công' : 'Seller has confirmed this order'}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 text-[11px] bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
                      {new Date(detailModalOrder.sellerConfirmedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ) : detailModalOrder.confirmationDeadline ? (
                  <div className="px-4 py-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Hạn chót người bán xác nhận đơn hàng:' : 'Confirmation deadline:'}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-900 text-[11px] bg-white/80 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
                      {new Date(detailModalOrder.confirmationDeadline).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ) : null
              )}

              {/* Lalamove Shipping & Tracking Action in Detail Modal (Ẩn khi đơn hàng có kiểm định tại nhà hoặc tại Hub vì đã có khối hành trình chuyên biệt phía dưới) */}
              {(() => {
                const isDetailInspection = Boolean(
                  detailHasInspection ||
                  detailModalOrder.hasInspectionService ||
                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                  detailModalOrder.inspectionCenterId ||
                  (detailModalOrder as any).inspectionStatus ||
                  detailModalOrder.inspectionMethod === 'AT_CENTER' ||
                  detailModalOrder.inspectionMethod === 'AT_HOME' ||
                  (detailModalOrder as any).orderType === 'AT_HOME' ||
                  (detailModalOrder as any).orderType === 'AT_CENTER'
                );
                if (isDetailInspection) return null;

                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-slate-50 border border-orange-200/90 shadow-2xs space-y-3">
                    {/* Top Row: Left has Tracking Badge + Order Code, Right has Driver Status Badge + Tracking Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-600 text-white shadow-2xs shrink-0">
                          Lalamove Tracking
                        </span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                          {detailInboundShipment?.orderCode ? (
                            <>
                              <span>{lang === 'vi' ? 'Mã vận đơn:' : 'Tracking #:'}</span>
                              <strong className="font-mono text-orange-950 font-bold select-all bg-orange-100/70 px-2 py-0.5 rounded-md border border-orange-200">
                                #{detailInboundShipment.orderCode}
                              </strong>
                            </>
                          ) : detailModalOrder.shippingQuoteId ? (
                            <>
                              <span>{lang === 'vi' ? 'Mã báo giá:' : 'Quote #:'}</span>
                              <strong className="font-mono text-orange-950 font-bold select-all bg-orange-100/70 px-2 py-0.5 rounded-md border border-orange-200">
                                #{detailModalOrder.shippingQuoteId}
                              </strong>
                            </>
                          ) : (
                            <span className="font-bold text-slate-800">
                              {lang === 'vi' ? 'Đơn hàng tích hợp Lalamove Tracking' : 'Integrated Lalamove Tracking'}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
                        {!isOrderCancelledOrRefunded(detailModalOrder) ? (
                          (() => {
                            const hasActiveShipment = isShipmentCreatedForOrder(detailModalOrder) || Boolean(detailInboundShipment);

                            if (hasActiveShipment) {
                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {detailInboundProgress && (
                                    <span className={`rounded-xl border px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs ${detailInboundProgress.step === 3
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : detailInboundProgress.step === 2
                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                      <Truck className="w-3.5 h-3.5" />
                                      <span>{detailInboundProgress.label}</span>
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setTrackingOrder(detailModalOrder);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>{lang === 'vi' ? 'Tra cứu vận đơn Lalamove' : 'Track Shipment'}</span>
                                  </button>
                                </div>
                              );
                            }

                            if (detailBuyerInspectionStage) {
                              return (
                                <span className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                                  {buyerInspectionStageLabel(detailBuyerInspectionStage, lang)}
                                </span>
                              );
                            }

                            if (isOrderSeller(detailModalOrder)) {
                              return (
                                <button
                                  onClick={() => {
                                    if (detailModalOrder.escrowStatus === 'AWAITING_PAYMENT') {
                                      setInspectionActionNotice(
                                        lang === 'vi'
                                          ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                                          : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                                      );
                                      setTimeout(() => setInspectionActionNotice(null), 5000);
                                      return;
                                    }
                                    setCreateShipmentOrder(detailModalOrder);
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Tạo Vận Đơn Lalamove' : 'Create Shipment'}</span>
                                </button>
                              );
                            }

                            return (
                              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 shrink-0 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>{lang === 'vi' ? 'Chờ người bán tạo đơn Lalamove' : 'Awaiting Seller Dispatch'}</span>
                              </span>
                            );
                          })()
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                            {lang === 'vi' ? 'Đã dừng vận đơn (Đơn đã hủy)' : 'Shipment Inactive'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Shipping Fee & Destination separated by subtle line */}
                    <div className="pt-2.5 border-t border-orange-200/70 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span>{lang === 'vi' ? 'Phí vận chuyển:' : 'Shipping fee:'}</span>
                        <strong className="text-orange-700 font-bold">{formatVND(detailModalOrder.shippingFeeVnd || 21000)}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span className="break-words">
                          {detailModalOrder.hasInspectionService || detailModalOrder.inspectionCenterId
                            ? `${lang === 'vi' ? 'Điểm đến:' : 'Destination:'} ${resolveInspectionCenter(detailModalOrder)?.name || 'Trạm Kiểm Định SecondLife Hub'}`
                            : `${lang === 'vi' ? 'Địa chỉ giao:' : 'Deliver to:'} ${detailModalOrder.buyerAddress || 'Địa chỉ người mua'}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Shipping & Delivery Route Visualizer */}
              {(() => {
                const isAtHome = Boolean(
                  detailModalOrder.inspectionMethod === 'AT_HOME' ||
                  (detailModalOrder as any).orderType === 'AT_HOME'
                );
                const isHub = Boolean(
                  (detailModalOrder.hasInspectionService ||
                    (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                    detailModalOrder.inspectionCenterId) &&
                  !isAtHome
                );

                if (!isHub && !isAtHome) {
                  // TRƯỜNG HỢP 1: GIAO THẲNG TRỰC TIẾP (1 CHẶNG: SELLER -> BUYER)
                  return (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Hành trình giao hàng trực tiếp (Người bán → Người mua)</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          1 Chặng Giao Thẳng
                        </span>
                      </div>

                      <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 rounded-md">
                            Giao Thẳng Trực Tiếp
                          </span>
                          <span className="text-xs font-mono font-bold text-[#24263e]">
                            {detailShipments[0]?.orderCode ? (
                              `Lalamove #${detailShipments[0].orderCode}`
                            ) : (
                              <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isOrderSellerConfirmed(detailModalOrder)
                                ? 'text-blue-700 bg-blue-50 border-blue-200'
                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                }`}>
                                {isOrderSellerConfirmed(detailModalOrder)
                                  ? (lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch')
                                  : (lang === 'vi' ? 'Chưa tạo vận đơn Lalamove' : 'Pending courier')}
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="text-xs text-[#24263e]/70 space-y-1.5 pt-1">
                          <div>Từ (Kho người bán): <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.origin || detailModalOrder.listing?.location || 'Địa chỉ kho người bán'}</span></div>
                          <div>Đến (Địa chỉ nhận hàng): <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.destination || detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span></div>
                        </div>

                        <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/80 flex items-center justify-between">
                          <span>
                            {detailShipments[0]?.status === 'COMPLETED' || detailModalOrder.backendStatus === 'DELIVERED'
                              ? 'Đã giao hàng thành công đến người mua'
                              : detailShipments[0]?.status === 'IN_TRANSIT' || detailModalOrder.backendStatus === 'SHIPPED'
                                ? 'Tài xế Lalamove đang trên đường giao hàng'
                                : detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đang chờ người bán đóng gói và điều phối bưu tá'}
                          </span>
                          {!isOrderCancelledOrRefunded(detailModalOrder) && isOrderSeller(detailModalOrder) && !detailShipments.some((s) => s.status !== 'CANCELLED') && (
                            <button
                              onClick={() => {
                                if (detailModalOrder.escrowStatus === 'AWAITING_PAYMENT') {
                                  setInspectionActionNotice(
                                    lang === 'vi'
                                      ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                                      : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                                  );
                                  setTimeout(() => setInspectionActionNotice(null), 5000);
                                  return;
                                }
                                setCreateShipmentOrder(detailModalOrder);
                              }}
                              className="text-[11px] text-orange-600 hover:text-orange-700 font-bold underline cursor-pointer ml-2"
                            >
                              Tạo vận đơn ngay
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // CHUẨN HÓA DỮ LIỆU VẬN ĐƠN, ĐỊA CHỈ & KẾT QUẢ KIỂM ĐỊNH (ÁP DỤNG CHUNG CHO CẢ TẬN NHÀ VÀ QUA HUB)
                const allModalShipments = detailShipments.length > 0
                  ? detailShipments
                  : getOrderAllShipments(detailModalOrder.id);
                const modalInboundShipment =
                  allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER' && s.status !== 'CANCELLED') ||
                  allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER') ||
                  detailInboundShipment ||
                  getOrderInboundShipment(detailModalOrder);

                const modalLocalInsp = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${detailModalOrder.id}`) : null;
                const isModalInspFailed = detailModalOrder.escrowStatus === 'INSPECTION_FAILED' || (detailModalOrder as any).backendStatus === 'FAILED' || (detailModalOrder as any).status === 'FAILED' || detailModalOrder.inspectionReport?.status === 'FAILED' || modalLocalInsp === 'FAILED' || (detailModalOrder as any).inspectionStatus === 'FAILED';
                const isModalInspPassed = detailModalOrder.escrowStatus === 'INSPECTION_PASSED' || (detailModalOrder as any).backendStatus === 'PASSED' || (detailModalOrder as any).status === 'PASSED' || detailModalOrder.inspectionReport?.status === 'PASSED' || modalLocalInsp === 'PASSED' || (detailModalOrder as any).inspectionStatus === 'PASSED';
                const modalDecision = getInspectionPurchaseDecision(detailModalOrder) || ((detailInspectionDto as any)?.buyerDecision ? String((detailInspectionDto as any).buyerDecision).toLowerCase() : null);
                const isModalPendingDecision = isModalInspPassed && modalDecision !== 'accepted' && modalDecision !== 'rejected';
                const isModalAccepted = isModalInspPassed && modalDecision === 'accepted';
                const isModalRejected = modalDecision === 'rejected';

                const modalReturnShipment =
                  allModalShipments.find((s) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') ||
                  allModalShipments.find((s) => s.leg === 'CENTER_TO_SELLER');

                const modalBuyerShipment =
                  allModalShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') ||
                  allModalShipments.find((s) => s.leg === 'CENTER_TO_BUYER');

                const modalLeg2Shipment = (isModalInspFailed || isModalRejected) ? modalReturnShipment : modalBuyerShipment;

                const centerData = resolveInspectionCenter({
                  ...detailModalOrder,
                  inspectionCenterId: detailInspectionDto?.inspectionCenterId || detailModalOrder.inspectionCenterId,
                  inspectionCenterName: (detailInspectionDto as any)?.inspectionCenterName || detailModalOrder.inspectionCenterName,
                  inspectionCenterAddress: (detailInspectionDto as any)?.inspectionCenterAddress || detailModalOrder.inspectionCenterAddress,
                });

                const realSellerAddress =
                  modalInboundShipment?.senderAddress ||
                  ((isModalInspFailed || isModalRejected) && modalReturnShipment?.receiverAddress) ||
                  detailInspectionDto?.sellerAddress ||
                  (detailModalOrder as any).sellerAddress ||
                  (detailModalOrder as any).sellerLocation ||
                  detailModalOrder.listing?.sellerAddress ||
                  (detailModalOrder.listing?.location && detailModalOrder.listing.location !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.listing.location : null) ||
                  (detailModalOrder.shippingLegs[0]?.origin && detailModalOrder.shippingLegs[0].origin !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.shippingLegs[0].origin : null) ||
                  'Kho người bán (Đang cập nhật địa chỉ)';

                const realHubAddress =
                  modalInboundShipment?.receiverAddress ||
                  modalLeg2Shipment?.senderAddress ||
                  (detailInspectionDto as any)?.inspectionCenterAddress ||
                  detailModalOrder.inspectionCenterAddress ||
                  centerData.address ||
                  'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh';

                const realBuyerAddress =
                  (!isModalInspFailed && !isModalRejected && modalBuyerShipment?.receiverAddress) ||
                  detailInspectionDto?.address ||
                  (detailInspectionDto as any)?.buyerAddress ||
                  detailModalOrder.buyerAddress ||
                  (detailModalOrder as any).deliveryAddress ||
                  (detailModalOrder.shippingLegs[1]?.destination && detailModalOrder.shippingLegs[1].destination !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.shippingLegs[1].destination : null) ||
                  'Địa chỉ nhận hàng của người mua';

                const modalInspStatus = String(
                  (detailModalOrder as any)?.backendStatus ||
                  (detailModalOrder as any)?.inspectionStatus ||
                  (detailModalOrder as any)?.inspectionOrder?.status ||
                  ((detailModalOrder as any)?.status !== 'AWAITING_INSPECTION' && (detailModalOrder as any)?.status !== 'AWAITING_PAYMENT' && (detailModalOrder as any)?.status !== 'HELD_IN_ESCROW' ? (detailModalOrder as any)?.status : '') ||
                  ''
                ).toUpperCase();

                const isModalWaitingBuyerApproval = modalInspStatus === 'WAITING_BUYER_APPROVAL';
                const isModalWaitingSellerApproval = modalInspStatus === 'WAITING_SELLER_APPROVAL';
                const isModalWaitingFeePayment = modalInspStatus === 'WAITING_FEE_PAYMENT';
                const modalSavedAppointment = getOrderAppointment(detailModalOrder);
                const modalAppointmentScheduledAt = modalSavedAppointment?.scheduledAt || detailModalOrder.appointmentScheduledAt || (detailInspectionDto as any)?.appointmentScheduledAt;

                if (isAtHome) {
                  // TRƯỜNG HỢP 2: KIỂM ĐỊNH TẠI NHÀ & GIAO HÀNG (ON-SITE VERIFY)
                  return (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-orange-600" />
                          <span>Quy trình Kiểm định tại nhà & Giao hàng (On-Site Verify)</span>
                        </div>
                        <span className="text-[10px] font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                          Kiểm Định Tận Nhà
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                        {/* Bước 1: Kỹ thuật viên kiểm tra tận nơi */}
                        <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspPassed
                          ? 'bg-emerald-50/80 border-emerald-200'
                          : isModalInspFailed
                            ? 'bg-rose-50/80 border-rose-200'
                            : 'bg-slate-50/80 border-slate-200'
                          }`}>
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspPassed
                                ? 'bg-emerald-700'
                                : isModalInspFailed
                                  ? 'bg-rose-700'
                                  : 'bg-amber-600'
                                }`}>
                                <Calendar className="w-3 h-3" />
                                <span>Bước 1: Kiểm Định Tận Nhà</span>
                              </span>
                              <span className="text-xs font-mono font-bold">
                                {isModalInspPassed ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                                    ✓ Đã Đạt Chuẩn
                                  </span>
                                ) : isModalInspFailed ? (
                                  <span className="text-rose-700 font-bold bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300">
                                    ✕ Không Đạt Chuẩn
                                  </span>
                                ) : isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder) ? (
                                  <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 animate-pulse">
                                    KTV Đang Kiểm Tra
                                  </span>
                                ) : (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' || modalSavedAppointment?.counterScheduledAt) ? (
                                  <span className="text-amber-900 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                                    Đang Thương Lượng Lịch Hẹn
                                  </span>
                                ) : (modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION') ? (
                                  <span className="text-blue-800 font-bold bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300">
                                    Chờ Trung Tâm Duyệt Lịch
                                  </span>
                                ) : modalAppointmentScheduledAt ? (
                                  <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                                    {(() => {
                                      const modalAssignedInspector = (() => {
                                        try {
                                          const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                                          if (raw) return JSON.parse(raw);
                                        } catch { }
                                        return null;
                                      })();
                                      const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;
                                      return effectiveInspectorName ? 'Đã Phân Công KTV' : 'Đã Chốt Lịch • Chờ Giao KTV';
                                    })()}
                                  </span>
                                ) : isModalWaitingBuyerApproval ? (
                                  <span className="text-purple-800 font-bold bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300">
                                    Chờ Duyệt Đề Xuất
                                  </span>
                                ) : isModalWaitingSellerApproval ? (
                                  <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                                    Chờ Người Bán Duyệt
                                  </span>
                                ) : isModalWaitingFeePayment ? (
                                  <span className="text-orange-800 font-bold bg-orange-100/90 px-2 py-0.5 rounded border border-orange-300">
                                    Chờ Đóng Phí
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Chờ Người Bán Hẹn Lịch
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                              {(() => {
                                const detailRej = getOrderAppointmentRejection(detailModalOrder);
                                if (detailRej && !modalAppointmentScheduledAt) {
                                  return (
                                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                                      <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Lịch hẹn bị Trung tâm từ chối</span>
                                      </div>
                                      <p className="text-[11px] leading-relaxed bg-white/90 p-1.5 rounded border border-rose-200">
                                        <strong>Lý do:</strong> "{detailRej.reason}"
                                      </p>
                                      <p className="text-[10px] text-rose-700">
                                        Vui lòng đặt lại lịch hẹn khác phù hợp hơn.
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {(() => {
                                const detailAppt = getOrderAppointment(detailModalOrder);
                                const isDetailCountered = Boolean(
                                  detailAppt?.status === 'COUNTERED_BY_CENTER' ||
                                  detailAppt?.counterScheduledAt ||
                                  (detailModalOrder as any).counterScheduledAt ||
                                  (detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
                                  (detailModalOrder as any).status === 'WAITING_SELLER_APPROVAL' ||
                                  String((detailModalOrder as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL'
                                );
                                if (isDetailCountered) {
                                  const detailCounterTime =
                                    detailAppt?.counterScheduledAt ||
                                    detailAppt?.scheduledAt ||
                                    (detailModalOrder as any).counterScheduledAt ||
                                    detailModalOrder.appointmentScheduledAt;
                                  const detailCounterShift =
                                    detailAppt?.counterShift ||
                                    (detailModalOrder as any).counterShift;
                                  const detailCounterNote =
                                    detailAppt?.counterNote ||
                                    (detailModalOrder as any).counterNote;
                                  const validDate = detailCounterTime ? new Date(detailCounterTime) : null;
                                  const hasValidDate = Boolean(validDate && !isNaN(validDate.getTime()));
                                  const detailPayload = detailAppt || {
                                    scheduledAt: detailCounterTime,
                                    counterScheduledAt: detailCounterTime,
                                    counterShift: detailCounterShift,
                                    counterNote: detailCounterNote,
                                    status: 'COUNTERED_BY_CENTER',
                                  };

                                  return (
                                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-xs text-amber-950 space-y-2">
                                      <div className="flex items-center gap-1.5 text-amber-900 font-extrabold">
                                        <CalendarSync className="w-4 h-4 text-orange-600 animate-pulse" />
                                        <span>Trung tâm đề xuất lịch hẹn mới:</span>
                                      </div>
                                      <div className="bg-white/90 p-2 rounded-lg border border-amber-200 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-amber-900">📅 Giờ mới:</span>
                                          <span className="font-extrabold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded text-[11px]">
                                            {hasValidDate && validDate
                                              ? validDate.toLocaleString('vi-VN')
                                              : 'Theo đề xuất của Trung tâm'}
                                            {detailCounterShift ? ` (${detailCounterShift === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều'})` : ''}
                                          </span>
                                        </div>
                                        {detailCounterNote && (
                                          <div className="text-[11px] text-amber-900 italic">
                                            💬 Lý do: "{detailCounterNote}"
                                          </div>
                                        )}
                                      </div>
                                      {isOrderSeller(detailModalOrder) ? (
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => handleSellerAcceptCounterAppointment(detailModalOrder.id, detailPayload)}
                                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                                          >
                                            <Check className="w-3 h-3 stroke-[2.5]" />
                                            <span>Đồng Ý Lịch Này</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSchedulingOrder(detailModalOrder);
                                              setSchedulingReadOnly(false);
                                            }}
                                            className="py-1.5 px-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                                          >
                                            <Calendar className="w-3 h-3" />
                                            <span>Hẹn Lại</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="text-[11px] text-amber-800 bg-amber-100/60 p-1.5 rounded-md font-medium text-center">
                                          Đang chờ Người bán xem xét và phản hồi đề xuất dời lịch này.
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              <div className="flex items-start gap-1.5">
                                <span className="text-slate-400 font-bold shrink-0">Địa điểm:</span>
                                <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                              </div>
                              {(() => {
                                const modalAssignedInspector = (() => {
                                  try {
                                    const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                                    if (raw) return JSON.parse(raw);
                                  } catch { }
                                  return null;
                                })();
                                const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;
                                return (
                                  <>
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-slate-400 font-bold shrink-0">Thực hiện:</span>
                                      <span className="font-semibold text-slate-800">
                                        {effectiveInspectorName ? `KTV ${effectiveInspectorName}` : 'Chờ trung tâm điều phối KTV'}
                                      </span>
                                    </div>
                                    {/* Mã Vạch Tiếp Nhận & Mã Code trong Modal Chi Tiết */}
                                    {isOrderSeller(detailModalOrder) ? (
                                      modalAppointmentScheduledAt && effectiveInspectorName && !isModalInspPassed && !isModalInspFailed && (
                                        <div className="pt-2">
                                          <AtHomeIntakeBarcode
                                            orderId={detailModalOrder.id}
                                            isArrived={isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)}
                                            lang={lang}
                                            compact={true}
                                            appointmentTime={modalAppointmentScheduledAt}
                                            inspectorName={effectiveInspectorName}
                                          />
                                        </div>
                                      )
                                    ) : (
                                      modalAppointmentScheduledAt && effectiveInspectorName && !isModalInspPassed && !isModalInspFailed && (
                                        <div className="pt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                                          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                          <div>
                                            <div className="font-bold">Lịch hẹn KTV tận nơi đã được xác nhận</div>
                                            <div className="text-[11px] text-amber-800">
                                              Kỹ thuật viên <strong>{effectiveInspectorName}</strong> sẽ đến nhà người bán theo lịch hẹn để mở máy kiểm định 5 bước ISO.
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="break-words leading-relaxed">
                              {(() => {
                                const modalAssignedInspector = (() => {
                                  try {
                                    const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                                    if (raw) return JSON.parse(raw);
                                  } catch { }
                                  return null;
                                })();
                                const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;

                                if (detailModalOrder.inspectionReport) {
                                  return 'Đã hoàn tất kiểm tra on-site và dán tem niêm phong đạt chuẩn.';
                                }
                                if (isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)) {
                                  return 'Kỹ thuật viên đã đến và đang kiểm tra thiết bị tại nhà người bán.';
                                }
                                if (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' || modalSavedAppointment?.counterScheduledAt || (detailModalOrder as any).status === 'WAITING_SELLER_APPROVAL') {
                                  const cTime = modalSavedAppointment?.counterScheduledAt || modalSavedAppointment?.scheduledAt || (detailModalOrder as any).counterScheduledAt || detailModalOrder.appointmentScheduledAt;
                                  const cDate = cTime ? new Date(cTime) : null;
                                  const formatted = cDate && !isNaN(cDate.getTime()) ? cDate.toLocaleString('vi-VN') : 'lịch mới';
                                  return `Trung tâm đề xuất dời lịch sang ${formatted}. Đang chờ Người bán phản hồi thống nhất lịch mới.`;
                                }
                                if (modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION') {
                                  return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. Đang chờ Trung tâm kiểm định xem và phê duyệt.`;
                                }
                                if (modalAppointmentScheduledAt) {
                                  return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. ${effectiveInspectorName ? `KTV ${effectiveInspectorName} sẽ đến kiểm tra máy. Xuất trình mã tiếp nhận cho KTV khi đến.` : 'Trung tâm SecondLife đang xử lý và phân công KTV theo ca.'}`;
                                }
                                if (isModalWaitingBuyerApproval) {
                                  return 'Người bán đã đề xuất lại phương án chia phí kiểm định. Chờ người mua duyệt trong phòng chat.';
                                }
                                if (isModalWaitingSellerApproval) {
                                  return 'Đã gửi yêu cầu kiểm định tại nhà. Chờ người bán duyệt trong phòng chat.';
                                }
                                if (isModalWaitingFeePayment) {
                                  return 'Hai bên đã thống nhất phương án. Chờ đóng phí kiểm định để KTV đến kiểm tra.';
                                }
                                return 'Chờ người bán hẹn lịch đón KTV trong khung giờ hành chính (8h-12h, 13h-17h).';
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Bước 2: Bưu tá Lalamove giao thẳng tới người mua */}
                        <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspFailed || isModalRejected
                          ? 'bg-rose-50/80 border-rose-200'
                          : isModalPendingDecision
                            ? 'bg-amber-50/80 border-amber-200'
                            : isModalInspPassed
                              ? 'bg-emerald-50/80 border-emerald-200'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}>
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspFailed || isModalRejected
                                ? 'bg-rose-700'
                                : isModalPendingDecision
                                  ? 'bg-amber-600'
                                  : isModalInspPassed
                                    ? 'bg-emerald-700'
                                    : 'bg-emerald-700'
                                }`}>
                                <Truck className="w-3 h-3" />
                                <span>Bước 2: Giao Hàng Người Mua</span>
                              </span>
                              <span className="text-xs font-mono font-bold text-[#24263e]">
                                {detailShipments[0]?.orderCode ? (
                                  <span className="text-emerald-700 font-bold">Lalamove #{detailShipments[0].orderCode}</span>
                                ) : isModalInspFailed || isModalRejected ? (
                                  <span className="text-[11px] font-sans font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                    Không giao hàng
                                  </span>
                                ) : isModalInspPassed ? (
                                  <span className="text-[11px] font-sans font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                    Sẵn sàng giao hàng
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-sans font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    Kích hoạt sau khi ĐẠT
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                              <div className="flex items-start gap-1.5">
                                <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                                <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="text-slate-400 font-bold shrink-0">Giao đến:</span>
                                <span className="font-semibold text-slate-800 break-words">{realBuyerAddress}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="break-words leading-relaxed">
                              {isModalInspFailed
                                ? 'Sản phẩm không đạt chuẩn kiểm định. Đơn hàng dừng lại tại nhà người bán, không phát hàng cho người mua.'
                                : isModalRejected
                                  ? 'Người mua từ chối mua sản phẩm sau khi kiểm định. Đơn hàng kết thúc.'
                                  : isModalPendingDecision
                                    ? 'KTV đã kiểm định ĐẠT chuẩn. Đang chờ người mua xác nhận mua hàng trước khi điều phối bưu tá.'
                                    : isModalInspPassed
                                      ? 'Sản phẩm kiểm định ĐẠT chuẩn. Tài xế Lalamove sẽ nhận hàng từ người bán và phát thẳng đến người mua.'
                                      : 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong tem.'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // TRƯỜNG HỢP 3: KIỂM ĐỊNH QUA HUB (VERIFY THEN SHIP - 2 CHẶNG THỰC SỰ)
                return (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        Kiểm Định Hub Lab
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                      {/* Chặng 1: Người bán gửi tới Trung tâm Hub */}
                      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between h-full shadow-2xs space-y-3">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-white bg-blue-700 px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              <span>{t.leg1}</span>
                            </span>
                            <span className="text-xs font-mono font-bold text-[#24263e]">
                              {modalInboundShipment?.orderCode ? (
                                <span className="text-blue-700 font-bold">Lalamove #{modalInboundShipment.orderCode}</span>
                              ) : (
                                <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isOrderSellerConfirmed(detailModalOrder)
                                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                                  : 'text-amber-700 bg-amber-50 border-amber-200'
                                  }`}>
                                  {detailInboundLabel || (isOrderSellerConfirmed(detailModalOrder)
                                    ? (lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch')
                                    : (lang === 'vi' ? 'Chưa tạo vận đơn Lalamove' : 'Pending courier'))}
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                              <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold shrink-0">Đến:</span>
                              <span className="font-semibold text-slate-800 break-words">{realHubAddress}</span>
                            </div>
                          </div>

                          {/* Action buttons & Tracking for Chặng 1 */}
                          {modalInboundShipment && (
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                              <InspectionCashShipmentStatus shipment={modalInboundShipment} />
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {(() => {
                                  const prog = getInboundShipmentProgress(modalInboundShipment, lang);
                                  return (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      {prog.label}
                                    </span>
                                  );
                                })()}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTrackingShipmentId(modalInboundShipment.shipmentId);
                                      setTrackingOrder(detailModalOrder);
                                    }}
                                    className="inline-flex items-center gap-1 font-bold text-xs text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Chi tiết vận đơn</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDetailLeg1((prev) => !prev)}
                                    className="inline-flex items-center gap-1 font-bold text-xs text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                                  >
                                    <span>{expandedDetailLeg1 ? 'Ẩn tiến trình' : 'Xem tiến trình'}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedDetailLeg1 ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>
                              {expandedDetailLeg1 && (
                                <div className="pt-2 border-t border-blue-100">
                                  <LalamoveProgress
                                    title="Tiến trình vận chuyển Lalamove (Người bán → Hub)"
                                    routeBadge="Chặng 1: Seller ➔ Hub"
                                    currentStep={getInboundShipmentProgress(modalInboundShipment, lang).step}
                                    completeCurrentStep={getInboundShipmentProgress(modalInboundShipment, lang).step === 3 || modalInboundShipment.status === 'DELIVERED'}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed">
                            {detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || (lang === 'vi' ? 'Khởi tạo đơn hàng kiểm định Hub. Chờ bưu tá Lalamove chuyển kiện hàng về Hub.' : 'Hub inspection shipment created. Awaiting Lalamove pickup.')}
                          </span>
                        </div>
                      </div>

                      {/* Chặng 2: Trung tâm Hub gửi Người mua HOẶC Hoàn trả người bán */}
                      <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspFailed || isModalRejected
                        ? 'bg-rose-50/80 border-rose-200'
                        : isModalPendingDecision
                          ? 'bg-amber-50/80 border-amber-200'
                          : isModalInspPassed
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : 'bg-slate-50/80 border-slate-200'
                        }`}>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspFailed || isModalRejected
                              ? 'bg-rose-700'
                              : isModalPendingDecision
                                ? 'bg-amber-600'
                                : isModalInspPassed
                                  ? 'bg-emerald-700'
                                  : 'bg-indigo-700'
                              }`}>
                              <Truck className="w-3 h-3" />
                              <span>
                                {isModalInspFailed
                                  ? 'Chặng 2: Hoàn Trả Người Bán'
                                  : isModalRejected
                                    ? 'Chặng 2: Hoàn Trả Người Bán (Khách từ chối)'
                                    : isModalPendingDecision
                                      ? 'Chặng 2: Hub Giao Người Mua'
                                      : isModalInspPassed
                                        ? 'Chặng 2: Hub Giao Người Mua (Đạt Chuẩn)'
                                        : t.leg2}
                              </span>
                            </span>
                            <span className="text-xs font-mono font-bold text-[#24263e]">
                              {modalLeg2Shipment?.orderCode ? (
                                <span className={isModalInspFailed || isModalRejected ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                                  Lalamove #{modalLeg2Shipment.orderCode}
                                </span>
                              ) : (
                                <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isModalInspFailed || isModalRejected
                                  ? 'text-rose-700 bg-rose-100 border-rose-200'
                                  : isModalPendingDecision
                                    ? 'text-amber-800 bg-amber-100 border-amber-300 font-bold'
                                    : isModalInspPassed
                                      ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                                      : 'text-slate-500 bg-slate-100 border-slate-200'
                                  }`}>
                                  {isModalInspFailed
                                    ? 'Kích hoạt hoàn trả'
                                    : isModalRejected
                                      ? 'Người mua từ chối • Hoàn trả'
                                      : isModalPendingDecision
                                        ? 'Chờ người mua quyết định'
                                        : isModalInspPassed
                                          ? 'Đang điều phối giao'
                                          : 'Chờ hoàn tất chặng 1 & kiểm định'}
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                              <span className="font-semibold text-slate-800 break-words">{realHubAddress}</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold shrink-0">
                                {isModalInspFailed || isModalRejected ? 'Hoàn trả về:' : 'Giao đến:'}
                              </span>
                              <span className="font-semibold text-slate-800 break-words">
                                {isModalInspFailed || isModalRejected ? realSellerAddress : realBuyerAddress}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons & Tracking for Chặng 2 */}
                          {modalLeg2Shipment && (
                            <div className={`pt-2 border-t space-y-2 ${isModalInspFailed || isModalRejected ? 'border-rose-200' : 'border-emerald-200'}`}>
                              <InspectionCashShipmentStatus shipment={modalLeg2Shipment} />
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {(() => {
                                  const prog = (isModalInspFailed || isModalRejected)
                                    ? getHubReturnProgress(modalLeg2Shipment, lang)
                                    : getInboundShipmentProgress(modalLeg2Shipment, lang);
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${isModalInspFailed || isModalRejected
                                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      }`}>
                                      {prog.label}
                                    </span>
                                  );
                                })()}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTrackingShipmentId(modalLeg2Shipment.shipmentId);
                                      setTrackingOrder(detailModalOrder);
                                    }}
                                    className={`inline-flex items-center gap-1 font-bold text-xs hover:underline cursor-pointer ${isModalInspFailed || isModalRejected ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'
                                      }`}
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Chi tiết vận đơn</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDetailLeg2((prev) => !prev)}
                                    className={`inline-flex items-center gap-1 font-bold text-xs hover:underline cursor-pointer ${isModalInspFailed || isModalRejected ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'
                                      }`}
                                  >
                                    <span>{expandedDetailLeg2 ? 'Ẩn tiến trình' : 'Xem tiến trình'}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedDetailLeg2 ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>
                              {expandedDetailLeg2 && (
                                <div className={`pt-2 border-t ${isModalInspFailed || isModalRejected ? 'border-rose-100' : 'border-emerald-100'}`}>
                                  <LalamoveProgress
                                    title={(isModalInspFailed || isModalRejected)
                                      ? "Tiến trình vận chuyển hoàn trả Lalamove (Hub → Người bán)"
                                      : "Tiến trình vận chuyển giao hàng Lalamove (Hub → Khách mua)"}
                                    routeBadge={(isModalInspFailed || isModalRejected) ? "Chặng Hoàn Trả: Hub ➔ Seller" : "Chặng Giao Hàng: Hub ➔ Buyer"}
                                    currentStep={(isModalInspFailed || isModalRejected)
                                      ? getHubReturnProgress(modalLeg2Shipment, lang).step
                                      : getInboundShipmentProgress(modalLeg2Shipment, lang).step}
                                    completeCurrentStep={modalLeg2Shipment.status === 'DELIVERED' || ((isModalInspFailed || isModalRejected) && getHubReturnProgress(modalLeg2Shipment, lang).step === 3)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed">
                            {isModalInspFailed
                              ? 'Kiểm định không đạt. Trung tâm xử lý chặng trả hàng về người bán.'
                              : isModalRejected
                                ? 'Người mua từ chối nhận hàng sau kiểm định. Trung tâm xử lý hoàn trả kiện hàng về người bán.'
                                : isModalPendingDecision
                                  ? 'Đã kiểm định ĐẠT CHUẨN. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                                  : isModalInspPassed
                                    ? 'Đã kiểm định ĐẠT CHUẨN. Hub chuyển phát an toàn đến tận tay người mua.'
                                    : (detailModalOrder.shippingLegs[1]?.timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description || 'Chờ hoàn tất kiểm định tại Hub và niêm phong giao đến người mua.')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Inspection Certificate & Tamper Seal Section */}
              {detailModalOrder.inspectionReport && (
                <div className="rounded-2xl bg-[#faf8f5] p-5 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#24263e] text-white flex items-center justify-center">
                        <FileCheck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#24263e]">
                          Biên Bản Giám Định Xác Thực #{detailModalOrder.inspectionReport.id}
                        </h4>
                        <p className="text-xs text-[#24263e]/70">
                          {detailModalOrder.inspectionReport.centerName} • {detailModalOrder.inspectionReport.inspectorName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-[#24263e] text-white">
                        {detailModalOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#24263e] border border-gray-200">
                        Mã Tem: {detailModalOrder.inspectionReport.tamperSealId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifySealId(detailModalOrder.inspectionReport?.tamperSealId || '');
                          setIsVerifySealModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition cursor-pointer shadow-xs"
                        title="Quét và tra cứu chứng thực tem từ Backend SecondLife"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Xác Thực Tem (BE)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintSealOrder(detailModalOrder)}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#c34c36] hover:bg-[#a83b27] text-white flex items-center gap-1 transition cursor-pointer shadow-xs"
                        title="Tạo mã in tem niêm phong chuẩn"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>In Tem QR</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#24263e] bg-[#FFFFFF] p-3 rounded-xl border border-gray-200 italic">
                    "{detailModalOrder.inspectionReport.summaryNotes}"
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(detailModalOrder.inspectionReport.checklistResults || []).map((chk) => (
                      <div key={chk.id} className="flex items-start gap-2 bg-[#FFFFFF] p-2.5 rounded-lg border border-gray-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="break-words leading-snug">
                          <span className="font-semibold text-[#24263e]">{chk.category}: </span>
                          <span className="text-[#24263e]/80">{chk.testedValue || 'Đạt'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Stage Photo Audit */}
              {(() => {
                const hasInspection = Boolean(
                  detailModalOrder.hasInspectionService ||
                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                  detailModalOrder.inspectionCenterId ||
                  detailModalOrder.inspectionMethod ||
                  (detailModalOrder as any).inspectionStatus
                );

                const stageTitle = hasInspection ? t.multiStageTitle : t.multiStageTitle2Stage;

                // 1. Listing photos (Giai đoạn 1 - Người bán)
                const rawListingPhotos: string[] = [];
                if (detailInspectionDto?.postImageUrls && Array.isArray(detailInspectionDto.postImageUrls)) {
                  rawListingPhotos.push(...detailInspectionDto.postImageUrls);
                }
                if (detailInspectionDto?.postImageUrl) {
                  rawListingPhotos.push(detailInspectionDto.postImageUrl);
                }
                if ((detailModalOrder as any).postImageUrls && Array.isArray((detailModalOrder as any).postImageUrls)) {
                  rawListingPhotos.push(...(detailModalOrder as any).postImageUrls);
                }
                if (detailModalOrder.listing?.photoGallery && Array.isArray(detailModalOrder.listing.photoGallery)) {
                  rawListingPhotos.push(...detailModalOrder.listing.photoGallery);
                }
                if (detailModalOrder.listing?.photos) {
                  const p = detailModalOrder.listing.photos;
                  if (p.front) rawListingPhotos.push(p.front);
                  if (p.back) rawListingPhotos.push(p.back);
                  if (p.screenOrDetails) rawListingPhotos.push(p.screenOrDetails);
                  if (p.accessoriesOrBox) rawListingPhotos.push(p.accessoriesOrBox);
                  if (p.serialOrReceipt) rawListingPhotos.push(p.serialOrReceipt);
                }
                if (detailModalOrder.multiStagePhotos?.listingPhotos && Array.isArray(detailModalOrder.multiStagePhotos.listingPhotos)) {
                  rawListingPhotos.push(...detailModalOrder.multiStagePhotos.listingPhotos);
                }
                const listingPhotos = Array.from(new Set(
                  rawListingPhotos
                    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                    .map((u) => u.trim())
                ));

                // 2. Hub Inspector photos (Giai đoạn 2 - Kiểm định Hub)
                const rawInspectorPhotos: string[] = [];
                if (detailInspectionDto) {
                  const reportMedia = getInspectionReportMedia(detailInspectionDto);
                  if (reportMedia.photos && reportMedia.photos.length > 0) {
                    rawInspectorPhotos.push(...reportMedia.photos);
                  }
                  if (detailInspectionDto.inspectorPhotos && Array.isArray(detailInspectionDto.inspectorPhotos)) {
                    rawInspectorPhotos.push(...detailInspectionDto.inspectorPhotos);
                  }
                  if (detailInspectionDto.proofPhotos && Array.isArray(detailInspectionDto.proofPhotos)) {
                    rawInspectorPhotos.push(...detailInspectionDto.proofPhotos);
                  }
                  if (detailInspectionDto.evidenceUrls && Array.isArray(detailInspectionDto.evidenceUrls)) {
                    rawInspectorPhotos.push(...detailInspectionDto.evidenceUrls);
                  }
                }
                if (detailModalOrder.inspectionReport?.inspectorPhotos && Array.isArray(detailModalOrder.inspectionReport.inspectorPhotos)) {
                  rawInspectorPhotos.push(...detailModalOrder.inspectionReport.inspectorPhotos);
                }
                if ((detailModalOrder as any).inspectorPhotos && Array.isArray((detailModalOrder as any).inspectorPhotos)) {
                  rawInspectorPhotos.push(...(detailModalOrder as any).inspectorPhotos);
                }
                if (detailModalOrder.multiStagePhotos?.inspectorPhotos && Array.isArray(detailModalOrder.multiStagePhotos.inspectorPhotos)) {
                  rawInspectorPhotos.push(...detailModalOrder.multiStagePhotos.inspectorPhotos);
                }
                if (typeof window !== 'undefined') {
                  try {
                    const rawStored = localStorage.getItem(`inspection_report_${detailModalOrder.id}`);
                    if (rawStored) {
                      const parsed = JSON.parse(rawStored);
                      if (parsed?.inspectorPhotos && Array.isArray(parsed.inspectorPhotos)) {
                        rawInspectorPhotos.push(...parsed.inspectorPhotos);
                      }
                    }
                  } catch { }
                }
                const inspectorPhotos = Array.from(new Set(
                  rawInspectorPhotos
                    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                    .map((u) => u.trim())
                ));

                // 3. Handover photos (Giai đoạn 3 - Niêm phong giao)
                const rawHandoverPhotos: string[] = [];
                if (detailModalOrder.multiStagePhotos?.handoverPhotos && Array.isArray(detailModalOrder.multiStagePhotos.handoverPhotos)) {
                  rawHandoverPhotos.push(...detailModalOrder.multiStagePhotos.handoverPhotos);
                }
                if ((detailModalOrder as any).handoverPhotos && Array.isArray((detailModalOrder as any).handoverPhotos)) {
                  rawHandoverPhotos.push(...(detailModalOrder as any).handoverPhotos);
                }
                if ((detailInspectionDto as any)?.tamperSealPhoto) {
                  rawHandoverPhotos.push((detailInspectionDto as any).tamperSealPhoto);
                }
                if ((detailModalOrder as any).tamperSealPhoto) {
                  rawHandoverPhotos.push((detailModalOrder as any).tamperSealPhoto);
                }
                if (typeof window !== 'undefined') {
                  try {
                    const rawSealPhoto = localStorage.getItem(`tamper_seal_photo_${detailModalOrder.id}`);
                    if (rawSealPhoto) rawHandoverPhotos.push(rawSealPhoto);
                  } catch { }
                }
                const handoverPhotos = Array.from(new Set(
                  rawHandoverPhotos
                    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                    .map((u) => u.trim())
                ));

                const currentPhotos = activePhotoStage === 'listing'
                  ? listingPhotos
                  : activePhotoStage === 'inspector'
                    ? inspectorPhotos
                    : handoverPhotos;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#24263e]" />
                        <span>{stageTitle}</span>
                      </div>

                      <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-xl text-xs border border-gray-200">
                        <button
                          onClick={() => setActivePhotoStage('listing')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'listing'
                            ? 'bg-[#24263e] text-white'
                            : 'text-[#24263e]/70'
                            }`}
                        >
                          1. Người bán{listingPhotos.length > 0 ? ` (${listingPhotos.length})` : ''}
                        </button>
                        {hasInspection && (
                          <button
                            onClick={() => setActivePhotoStage('inspector')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'inspector'
                              ? 'bg-[#24263e] text-white'
                              : 'text-[#24263e]/70'
                              }`}
                          >
                            2. Kiểm định Hub{inspectorPhotos.length > 0 ? ` (${inspectorPhotos.length})` : ''}
                          </button>
                        )}
                        <button
                          onClick={() => setActivePhotoStage('handover')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'handover'
                            ? 'bg-[#24263e] text-white'
                            : 'text-[#24263e]/70'
                            }`}
                        >
                          {hasInspection ? '3. Niêm phong giao' : '2. Niêm phong giao'}{handoverPhotos.length > 0 ? ` (${handoverPhotos.length})` : ''}
                        </button>
                      </div>
                    </div>

                    {currentPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {currentPhotos.map((photoUrl, idx) => (
                          <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#faf8f5] border border-gray-200 group">
                            <img
                              src={photoUrl}
                              alt="Stage audit"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute bottom-1.5 left-1.5 bg-[#24263e]/85 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded border border-white/20 font-bold">
                              {activePhotoStage === 'listing' && (lang === 'vi' ? 'Ảnh rao bán' : 'Listing Photo')}
                              {activePhotoStage === 'inspector' && (lang === 'vi' ? 'Ảnh soi Hub' : 'Hub Inspect Photo')}
                              {activePhotoStage === 'handover' && (lang === 'vi' ? 'Ảnh niêm phong giao' : 'Handover Seal Photo')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      (() => {
                        if (activePhotoStage === 'inspector') {
                          return (
                            <div className="py-7 px-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 flex flex-col items-center justify-center text-center">
                              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
                                <Clock className="w-4 h-4 animate-pulse" />
                              </div>
                              <p className="text-xs font-bold text-amber-900">
                                {lang === 'vi' ? 'Chưa có ảnh kiểm định tại Hub' : 'Hub inspection photos pending'}
                              </p>
                              <p className="text-[11px] text-amber-700/80 max-w-sm mt-0.5">
                                {lang === 'vi'
                                  ? 'Kỹ thuật viên phòng Lab sẽ chụp ảnh chi tiết ngoại quan, bo mạch và thông số kỹ thuật khi tiếp nhận máy kiểm định.'
                                  : 'Lab technicians will capture detailed photos of cosmetic condition, motherboard, and component metrics during inspection.'}
                              </p>
                            </div>
                          );
                        }

                        if (activePhotoStage === 'handover') {
                          const sealId = detailInspectionDto?.tamperSealId ||
                            detailModalOrder.inspectionReport?.tamperSealId ||
                            (typeof window !== 'undefined' ? localStorage.getItem(`inspection_seal_${detailModalOrder.id}`) : null);

                          if (sealId) {
                            return (
                              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                                      <span>{lang === 'vi' ? 'Mã tem niêm phong:' : 'Tamper Seal ID:'}</span>
                                      <span className="font-mono text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 font-extrabold">{sealId}</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-800/80">
                                      {lang === 'vi'
                                        ? 'Tem bảo mật NFC chống bóc tách, gắn kèm mã QR bảo đảm kiện hàng nguyên vẹn đến tay người mua.'
                                        : 'Anti-tamper NFC security seal with encoded QR ensures the parcel remains intact to the buyer.'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="py-7 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
                              <div className="w-9 h-9 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-500 mb-2">
                                <Shield className="w-4 h-4" />
                              </div>
                              <p className="text-xs font-bold text-slate-700">
                                {lang === 'vi' ? 'Chưa bước vào giai đoạn niêm phong giao' : 'Handover & packaging stage pending'}
                              </p>
                              <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                                {lang === 'vi'
                                  ? 'Sau khi kiểm định ĐẠT CHUẨN, Hub sẽ dán tem niêm phong công nghệ cao và chụp ảnh kiện hàng trước khi bàn giao cho tài xế.'
                                  : 'Upon passing inspection, Hub will apply the anti-tamper seal and record packaging photos prior to handover.'}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                            {lang === 'vi' ? 'Chưa có hình ảnh người bán cung cấp' : 'No listing photos available'}
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })()}

              {/* Escrow Fee Breakdown */}
              {(() => {
                const isInspectionOrder = Boolean(
                  detailModalOrder.hasInspectionService ||
                  detailModalOrder.inspectionMethod ||
                  (detailModalOrder as any).orderType ||
                  detailInspectionDto ||
                  (detailModalOrder as any).inspectionStatus ||
                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)
                );

                const inspectionMethod: 'AT_CENTER' | 'AT_HOME' =
                  (detailInspectionDto?.orderType === 'AT_HOME' ||
                    detailModalOrder.inspectionMethod === 'AT_HOME' ||
                    (detailModalOrder as any).orderType === 'AT_HOME')
                    ? 'AT_HOME'
                    : 'AT_CENTER';
                const isAtCenter = inspectionMethod === 'AT_CENTER';
                const isAtHome = inspectionMethod === 'AT_HOME';

                const isCashShipping = Boolean(
                  detailInspectionDto?.cashShippingSimulation ??
                  detailModalOrder.cashShippingSimulation
                );

                const rawFeePayer =
                  detailInspectionDto?.feePayer ||
                  detailModalOrder.feePayer ||
                  detailModalOrder.inspectionFeeSplit;
                const feePayerSplit: 'BUYER_100' | 'SELLER_100' | 'SPLIT_50_50' =
                  rawFeePayer === 'SELLER_PAYS' || rawFeePayer === 'SELLER_100'
                    ? 'SELLER_100'
                    : rawFeePayer === 'SPLIT_50_50'
                      ? 'SPLIT_50_50'
                      : rawFeePayer === 'BUYER_PAYS' || rawFeePayer === 'BUYER_100'
                        ? 'BUYER_100'
                        : getInspectionFeeSplit(detailModalOrder);

                const inspStatus = String(
                  detailInspectionDto?.status ||
                  detailModalOrder.inspectionStatus ||
                  (detailModalOrder as any).backendStatus ||
                  detailModalOrder.status ||
                  ''
                ).toUpperCase();

                const isInspectionPassed =
                  inspStatus === 'PASSED' ||
                  inspStatus === 'INSPECTION_PASSED' ||
                  detailModalOrder.escrowStatus === 'INSPECTION_PASSED';

                const isInspectionFailed =
                  inspStatus === 'FAILED' ||
                  inspStatus === 'INSPECTION_FAILED' ||
                  detailModalOrder.escrowStatus === 'INSPECTION_FAILED';

                const isInspectionRejected =
                  getInspectionPurchaseDecision(detailModalOrder, detailInspectionDto) === 'rejected';

                const isInspectionCancelled =
                  ['CANCELLED', 'CANCELED', 'PAYMENT_EXPIRED', 'REFUNDED_TO_BUYER'].includes(inspStatus) ||
                  detailModalOrder.escrowStatus === 'REFUNDED_TO_BUYER';

                const isPhase2Paid = Boolean(
                  detailModalOrder.finalPaymentPaidAt ||
                  detailInspectionDto?.finalPaymentPaidAt ||
                  (detailModalOrder.linkedOrderId && !isInspectionPassed && inspStatus !== 'PASSED') ||
                  detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
                  detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                  (detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' && (detailModalOrder as any).backendStatus !== 'CANCELLED')
                );

                // Sub-fees
                const baseInspectionFee = Number(
                  detailInspectionDto?.inspectionFee ??
                  (detailModalOrder as any)?.baseInspectionFee ??
                  (isAtHome
                    ? ((detailModalOrder.inspectionFeeVnd || 0) - ((detailModalOrder as any)?.travelFeeRoundTrip || (detailModalOrder as any)?.travelFee || 0))
                    : ((detailModalOrder.inspectionFeeVnd || 0) - (detailModalOrder.shippingFeeVnd || (detailInspectionDto?.shippingFee || 0)) - (detailModalOrder.returnShippingReserveFee || (detailInspectionDto?.returnShippingReserveFee || 0))))
                ) || (detailInspectionDto?.inspectionFee ?? detailModalOrder.inspectionFeeVnd ?? 0);

                const shippingFeeToHub = isAtHome ? 0 : Number(
                  detailInspectionDto?.shippingFee ??
                  detailModalOrder.shippingFeeVnd ??
                  0
                );

                const returnReserveFee = isAtHome ? 0 : Number(
                  detailInspectionDto?.returnShippingReserveFee ??
                  detailModalOrder.returnShippingReserveFee ??
                  0
                );

                const travelFee = isAtHome ? Number(
                  detailInspectionDto?.travelFeeRoundTrip ??
                  detailInspectionDto?.travelFee ??
                  (detailModalOrder as any)?.travelFeeRoundTrip ??
                  (detailModalOrder as any)?.travelFee ??
                  0
                ) : 0;

                const travelDistanceKm = isAtHome ? (
                  detailInspectionDto?.travelDistanceKm ??
                  (detailModalOrder as any)?.travelDistanceKm
                ) : undefined;

                const buyerCommitmentDeposit = Number(
                  detailInspectionDto?.buyerCommitmentDeposit ??
                  detailModalOrder.buyerCommitmentDeposit ??
                  0
                );

                const totalInspectionCalculatedFee = isAtHome
                  ? (baseInspectionFee + travelFee)
                  : (baseInspectionFee + shippingFeeToHub + returnReserveFee);

                const fallbackShares = isCashShipping
                  ? getCashInspectionFeeShares(
                    totalInspectionCalculatedFee,
                    shippingFeeToHub,
                    feePayerSplit === 'SELLER_100' ? 'SELLER_PAYS' : feePayerSplit === 'SPLIT_50_50' ? 'SPLIT_50_50' : 'BUYER_PAYS'
                  )
                  : {
                    buyer: feePayerSplit === 'BUYER_100' ? totalInspectionCalculatedFee : feePayerSplit === 'SELLER_100' ? 0 : Math.round(totalInspectionCalculatedFee / 2),
                    seller: feePayerSplit === 'SELLER_100' ? totalInspectionCalculatedFee : feePayerSplit === 'BUYER_100' ? 0 : Math.round(totalInspectionCalculatedFee / 2),
                  };

                const buyerFeeShare = Number(
                  detailInspectionDto?.buyerFeeShare ??
                  detailModalOrder.buyerFeeShare ??
                  fallbackShares.buyer
                );

                const sellerFeeShare = Number(
                  detailInspectionDto?.sellerFeeShare ??
                  detailModalOrder.sellerFeeShare ??
                  fallbackShares.seller
                );

                const isBuyerInspectionPaid = Boolean(
                  detailInspectionDto?.buyerPaidAt ||
                  detailModalOrder.buyerPaidAt ||
                  (detailModalOrder as any)?.buyer_paid_at
                );

                const isSellerInspectionPaid = Boolean(
                  detailInspectionDto?.sellerPaidAt ||
                  detailModalOrder.sellerPaidAt ||
                  (detailModalOrder as any)?.seller_paid_at
                );

                const isBuyerShareFulfilled = (buyerFeeShare <= 0 && buyerCommitmentDeposit <= 0) || isBuyerInspectionPaid;
                const isSellerShareFulfilled = sellerFeeShare <= 0 || isSellerInspectionPaid;
                const isBothUpfrontPaid = isBuyerShareFulfilled && isSellerShareFulfilled;

                const modalBuyerShipment =
                  detailShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') ||
                  detailShipments.find((s) => s.leg === 'CENTER_TO_BUYER');

                const hubToBuyerShippingFee = Number(
                  modalBuyerShipment?.actualFee ??
                  modalBuyerShipment?.quotedFee ??
                  (detailInspectionDto as any)?.hubToBuyerShippingFee ??
                  (detailInspectionDto as any)?.shippingFeeToBuyer ??
                  (detailModalOrder as any)?.shippingFeeToBuyer ??
                  0
                );

                const inboundCashShipment = isCashShipping
                  ? detailShipments.find((s) => isInspectionCashShipment(s) || s.leg === 'SELLER_TO_CENTER')
                  : null;

                const totalUpfrontRequired = (isCashShipping && feePayerSplit === 'SELLER_100')
                  ? (baseInspectionFee + returnReserveFee)
                  : (buyerFeeShare + sellerFeeShare + buyerCommitmentDeposit);

                const totalUpfrontCollected =
                  (isBuyerInspectionPaid ? (buyerFeeShare + buyerCommitmentDeposit) : 0) +
                  (isSellerInspectionPaid ? sellerFeeShare : 0);

                if (!isInspectionOrder) {
                  return (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
                      <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                        {t.orderSummary}
                      </div>
                      <div className="flex justify-between text-[#24263e]/70">
                        <span>{t.itemAmount}:</span>
                        <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.itemPriceVnd)}</span>
                      </div>
                      <div className="flex justify-between text-[#24263e]/70">
                        <span>{t.shippingFee} (Vận chuyển Lalamove):</span>
                        <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.shippingFeeVnd)}</span>
                      </div>
                      <div className="flex justify-between text-[#24263e]/70">
                        <span>{t.platformFee}:</span>
                        <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.platformFeeVnd)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-[#24263e]">
                        <span>{t.totalEscrow}:</span>
                        <span className="font-extrabold text-[#24263e]">
                          {formatVND(detailModalOrder.totalPaidVnd)}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Inspection Order UI
                return (
                  <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                        {lang === 'vi' ? 'Chi Tiết Đơn Hàng Kiểm Định' : 'Inspection Order Summary'}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800">
                        {isAtHome
                          ? (lang === 'vi' ? 'Kiểm định tại nhà (AT_HOME)' : 'At-Home Inspection')
                          : (lang === 'vi' ? 'Kiểm định tại Hub (AT_CENTER)' : 'Hub Inspection')}
                      </span>
                    </div>

                    {/* Product price row */}
                    <div className="flex justify-between items-center text-[#24263e]/80">
                      {isPhase2Paid ? (
                        <>
                          <span className="font-medium">
                            {lang === 'vi' ? 'Tiền hàng đang giữ trong Escrow:' : 'Item Price (Held in Escrow):'}
                          </span>
                          <span className="font-semibold text-[#24263e]">
                            {formatVND(detailModalOrder.itemPriceVnd)}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[#24263e]">
                              {lang === 'vi' ? 'Giá sản phẩm · Chưa thanh toán' : 'Product Price · Unpaid'}:
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {lang === 'vi' ? 'Chưa thanh toán (GĐ 2)' : 'Phase 2 Unpaid'}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-700">
                            {formatVND(detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Base inspection fee */}
                    <div className="flex justify-between items-center text-[#24263e]/70">
                      <span>{lang === 'vi' ? 'Phí kiểm định cơ sở:' : 'Base Inspection Fee:'}</span>
                      <span className="font-semibold text-[#24263e]">{formatVND(baseInspectionFee)}</span>
                    </div>

                    {/* AT_CENTER fees: Seller -> Hub and return reserve */}
                    {isAtCenter && (
                      <>
                        <div className="flex justify-between items-center text-[#24263e]/70">
                          <span>{lang === 'vi' ? 'Cước Seller → Hub (Lalamove):' : 'Seller → Hub Shipping (Lalamove):'}</span>
                          <div className="text-right">
                            <span className="font-semibold text-[#24263e]">{formatVND(shippingFeeToHub)}</span>
                            {isCashShipping && feePayerSplit === 'SELLER_100' ? (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {lang === 'vi' ? 'Seller trả trực tiếp cho tài xế' : 'Paid in cash to driver'}
                              </span>
                            ) : isCashShipping ? (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {lang === 'vi' ? 'Seller ứng cước khi gửi' : 'Seller advances cash'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {returnReserveFee > 0 && (
                          <div className="flex justify-between items-center text-[#24263e]/70">
                            <span>{lang === 'vi' ? 'Dự phòng cước hoàn (Hub → Seller):' : 'Return Shipping Reserve (Hub → Seller):'}</span>
                            <div className="text-right">
                              <span className="font-semibold text-[#24263e]">{formatVND(returnReserveFee)}</span>
                              {isInspectionFailed || isInspectionRejected || isInspectionCancelled ? (
                                (() => {
                                  const isReserveRefunded = Boolean(
                                    (detailModalOrder as any).returnReserveRefundedAt ||
                                    (detailInspectionDto as any)?.returnReserveRefundedAt ||
                                    (detailModalOrder as any).returnReserveStatus === 'REFUNDED_UNUSED' ||
                                    (detailInspectionDto as any)?.returnReserveStatus === 'REFUNDED_UNUSED' ||
                                    (detailModalOrder as any).returnReserve?.status === 'REFUNDED_UNUSED' ||
                                    (detailInspectionDto as any)?.returnReserve?.status === 'REFUNDED_UNUSED'
                                  );
                                  const isReturnShipped = Boolean(
                                    detailShipments.some((s) => s.leg === 'CENTER_TO_SELLER' || s.leg === 'RETURN')
                                  );
                                  if (isReserveRefunded) {
                                    return (
                                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                                        {lang === 'vi' ? 'Đã hoàn' : 'Refunded'}
                                      </span>
                                    );
                                  }
                                  if (isReturnShipped) {
                                    return (
                                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                                        {lang === 'vi' ? 'Đã sử dụng' : 'Used'}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      {lang === 'vi' ? 'Đang giữ trong quỹ' : 'Held in Escrow'}
                                    </span>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* AT_HOME fee: Technician travel fee */}
                    {isAtHome && travelFee > 0 && (
                      <div className="flex justify-between items-center text-[#24263e]/70">
                        <span>
                          {lang === 'vi' ? 'Phụ phí di chuyển kỹ thuật viên' : 'Technician Travel Fee'}
                          {travelDistanceKm ? ` (${travelDistanceKm} km)` : ''}:
                        </span>
                        <span className="font-semibold text-[#24263e]">{formatVND(travelFee)}</span>
                      </div>
                    )}

                    {/* Buyer Commitment Deposit */}
                    {buyerCommitmentDeposit > 0 && (
                      <div className="flex justify-between items-center text-[#24263e]/70">
                        <span>{lang === 'vi' ? 'Cọc cam kết của người mua:' : 'Buyer Commitment Deposit:'}</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#24263e]">{formatVND(buyerCommitmentDeposit)}</span>
                          <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${isBuyerInspectionPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                            {isBuyerInspectionPaid ? (lang === 'vi' ? 'Đã thu' : 'Collected') : (lang === 'vi' ? 'Chưa nộp' : 'Pending')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Fee split plan & individual shares */}
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{lang === 'vi' ? 'Phương án chia phí:' : 'Fee Split Plan:'}</span>
                        </span>
                        <span className="font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {feePayerSplit === 'SPLIT_50_50'
                            ? (lang === 'vi' ? 'Chia đôi phí 50/50' : 'Split 50/50')
                            : feePayerSplit === 'SELLER_100'
                              ? (lang === 'vi' ? 'Người bán 100%' : 'Seller 100%')
                              : (lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">• {lang === 'vi' ? 'Phần Người mua:' : 'Buyer Share:'}</span>
                        <span className="font-semibold text-slate-800">
                          {formatVND(buyerFeeShare)}
                          <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-bold ${buyerFeeShare <= 0
                            ? 'bg-slate-100 text-slate-600'
                            : isBuyerInspectionPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-orange-100 text-orange-800'
                            }`}>
                            {buyerFeeShare <= 0
                              ? (lang === 'vi' ? 'Không cần nộp' : 'No payment needed')
                              : isBuyerInspectionPaid
                                ? (lang === 'vi' ? 'Đã nộp' : 'Paid')
                                : (lang === 'vi' ? 'Chưa nộp' : 'Unpaid')}
                          </span>
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">• {lang === 'vi' ? 'Phần Người bán:' : 'Seller Share:'}</span>
                        <span className="font-semibold text-slate-800">
                          {formatVND(sellerFeeShare)}
                          <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-bold ${sellerFeeShare <= 0
                            ? 'bg-slate-100 text-slate-600'
                            : isSellerInspectionPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-orange-100 text-orange-800'
                            }`}>
                            {sellerFeeShare <= 0
                              ? (lang === 'vi' ? 'Không cần nộp' : 'No payment needed')
                              : isSellerInspectionPaid
                                ? (lang === 'vi' ? 'Đã nộp' : 'Paid')
                                : (lang === 'vi' ? 'Chưa nộp' : 'Unpaid')}
                          </span>
                        </span>
                      </div>

                      {/* Cash advance reimbursement status if applicable */}
                      {isCashShipping && feePayerSplit !== 'SELLER_100' && (
                        <div className="pt-1.5 border-t border-gray-100 text-[10px] text-amber-900 bg-amber-50/70 p-1.5 rounded-lg flex items-center justify-between">
                          <span>
                            {lang === 'vi' ? 'Cước seller ứng cho tài xế:' : 'Seller cash advance to driver:'}{' '}
                            <strong>{formatVND(inboundCashShipment?.actualFee || shippingFeeToHub)}</strong>
                          </span>
                          <span>
                            {inboundCashShipment?.cashConfirmedAt
                              ? (lang === 'vi' ? `Đã hoàn ứng: ${formatVND(inboundCashShipment.cashReimbursedAmount || 0)}` : `Reimbursed: ${formatVND(inboundCashShipment.cashReimbursedAmount || 0)}`)
                              : (lang === 'vi' ? 'Chờ hoàn ứng sau khi giao Hub' : 'Pending reimbursement')}
                          </span>
                        </div>
                      )}

                      {detailModalOrder.paymentDeadline && !isBothUpfrontPaid && String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                        <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-orange-800 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span>{lang === 'vi' ? 'Hạn nộp phí:' : 'Payment Deadline:'}</span>
                          </span>
                          <span className="font-bold">{formatInspectionDeadline(detailModalOrder.paymentDeadline, lang)}</span>
                        </div>
                      )}
                    </div>

                    {/* Phase 2 Hub -> Buyer shipping quote (only when inspection passed or Phase 2 paid) */}
                    {(isInspectionPassed || isPhase2Paid) && hubToBuyerShippingFee > 0 && (
                      <div className="flex justify-between items-center text-[#24263e]/70">
                        <span>{lang === 'vi' ? 'Cước giao hàng tận tay (Hub → Buyer):' : 'Hub → Buyer Delivery Fee:'}</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#24263e]">{formatVND(hubToBuyerShippingFee)}</span>
                          <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${isPhase2Paid ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                            {isPhase2Paid
                              ? (lang === 'vi' ? 'Đã thanh toán (GĐ 2)' : 'Paid (Phase 2)')
                              : (lang === 'vi' ? 'Thanh toán khi mua tiếp' : 'Due upon purchase')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Total Row */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center font-bold text-sm text-[#24263e]">
                        <span>
                          {isPhase2Paid
                            ? (lang === 'vi' ? 'Tổng tiền phong tỏa Escrow:' : 'Total Escrow Held:')
                            : !isBothUpfrontPaid
                              ? (lang === 'vi' ? 'Tổng cần nộp trước (GĐ 1):' : 'Total Upfront Required (Phase 1):')
                              : (lang === 'vi' ? 'Tổng đã nộp trước (GĐ 1):' : 'Total Upfront Paid (Phase 1):')}
                        </span>
                        <span className="font-extrabold text-[#24263e]">
                          {formatVND(
                            isPhase2Paid
                              ? detailModalOrder.totalPaidVnd
                              : !isBothUpfrontPaid
                                ? totalUpfrontRequired
                                : totalUpfrontCollected
                          )}
                        </span>
                      </div>
                      {!isPhase2Paid && (
                        <div className="text-[11px] text-right mt-0.5">
                          {!isBothUpfrontPaid ? (
                            <span className="text-orange-700 font-medium">
                              {isBuyerInspectionPaid && !isSellerInspectionPaid
                                ? (lang === 'vi' ? 'Người mua đã nộp · Chờ người bán nộp' : 'Buyer paid · Awaiting seller payment')
                                : isSellerInspectionPaid && !isBuyerInspectionPaid
                                  ? (lang === 'vi' ? 'Người bán đã nộp · Chờ người mua nộp' : 'Seller paid · Awaiting buyer payment')
                                  : (lang === 'vi' ? 'Chưa bên nào nộp phí' : 'Neither party paid')}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã nộp đủ phí kiểm định GĐ 1' : 'Phase 1 inspection fee paid in full'}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Phase 2 purchase next step (when inspection passed and awaiting buyer payment) */}
                    {isInspectionPassed && !isPhase2Paid && (
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-950 mt-2">
                        <div className="font-bold flex items-center justify-between text-blue-900">
                          <span>{lang === 'vi' ? 'Thanh Toán Mua Tiếp Sản Phẩm (Giai đoạn 2)' : 'Phase 2 Product Purchase Payment'}</span>
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {lang === 'vi' ? 'Chờ Người Mua Thanh Toán' : 'Awaiting Buyer Payment'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-700 text-[11px]">
                          <span>{lang === 'vi' ? 'Giá sản phẩm:' : 'Product Price:'}</span>
                          <span className="font-semibold">{formatVND(detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0)}</span>
                        </div>
                        {hubToBuyerShippingFee > 0 && (
                          <div className="flex justify-between text-slate-700 text-[11px]">
                            <span>{lang === 'vi' ? 'Cước giao hàng tận tay (Hub → Người mua):' : 'Hub → Buyer Delivery Fee:'}</span>
                            <span className="font-semibold">{formatVND(hubToBuyerShippingFee)}</span>
                          </div>
                        )}
                        {buyerCommitmentDeposit > 0 && (
                          <div className="flex justify-between text-emerald-700 text-[11px]">
                            <span>{lang === 'vi' ? 'Khấu trừ cọc cam kết đã nộp:' : 'Deduct Commitment Deposit:'}</span>
                            <span className="font-semibold">-{formatVND(buyerCommitmentDeposit)}</span>
                          </div>
                        )}
                        <div className="pt-1.5 border-t border-blue-200/80 flex justify-between font-bold text-xs text-blue-950">
                          <span>{lang === 'vi' ? 'Tổng thanh toán mua hàng GĐ 2:' : 'Total Phase 2 Payment Due:'}</span>
                          <span className="font-black text-blue-900">
                            {formatVND((detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0) + hubToBuyerShippingFee - buyerCommitmentDeposit)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Inspection Failed / Rejected / Cancelled Resolution */}
                    {(isInspectionFailed || isInspectionRejected || isInspectionCancelled) && (
                      (() => {
                        const isPurchaseExpired = isExpiredInspectionPurchase(
                          inspStatus,
                          detailInspectionDto?.note || detailModalOrder.inspectionNote
                        );
                        const cancelReasonInfo = getCancellationReasonDisplay(detailModalOrder, lang);
                        const orderNote = detailInspectionDto?.note || detailModalOrder.inspectionNote;
                        const refundPartyLabel =
                          feePayerSplit === 'SELLER_100'
                            ? (lang === 'vi' ? 'người bán' : 'seller')
                            : feePayerSplit === 'BUYER_100'
                              ? (lang === 'vi' ? 'người mua' : 'buyer')
                              : (lang === 'vi' ? 'cả hai bên theo tỷ lệ 50/50' : 'both parties (50/50)');
                        const feePayerDescription =
                          feePayerSplit === 'SELLER_100'
                            ? (lang === 'vi' ? 'Người bán nộp 100%' : 'Seller 100%')
                            : feePayerSplit === 'BUYER_100'
                              ? (lang === 'vi' ? 'Người mua nộp 100%' : 'Buyer 100%')
                              : (lang === 'vi' ? 'Chia 50/50' : 'Split 50/50');

                        return (
                          <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-950 mt-2">
                            <div className="font-bold flex items-center justify-between text-rose-900">
                              <span>{lang === 'vi' ? 'Kết Thúc Luồng Kiểm Định' : 'Inspection Process Ended'}</span>
                              <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                                {isInspectionFailed
                                  ? (lang === 'vi' ? 'Không Đạt Chuẩn' : 'Inspection Failed')
                                  : isInspectionRejected
                                    ? (lang === 'vi' ? 'Từ Chối Mua' : 'Purchase Declined')
                                    : isPurchaseExpired
                                      ? (lang === 'vi' ? 'Hết Hạn Thanh Toán' : 'Payment Expired')
                                      : (lang === 'vi' ? 'Đã Hủy' : 'Cancelled')}
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-800/90 leading-relaxed">
                              {isInspectionFailed
                                ? (lang === 'vi'
                                  ? 'Thiết bị không đạt yêu cầu kiểm định kỹ thuật của SecondLife. Quy trình mua bán dừng tại đây và thiết bị được chuyển hoàn về cho Người bán.'
                                  : 'Device did not meet technical inspection standards. Purchase cancelled and item is scheduled for return to Seller.')
                                : isInspectionRejected
                                  ? (lang === 'vi'
                                    ? `Người mua đã từ chối tiếp tục mua sau khi xem biên bản kiểm định.${orderNote ? ` (${orderNote})` : ''} Thiết bị được chuyển hoàn về cho Người bán.`
                                    : 'Buyer declined purchase after inspection report. Item is scheduled for return to Seller.')
                                  : isPurchaseExpired
                                    ? (lang === 'vi'
                                      ? `Đơn hàng đã tự động hủy do người mua không thanh toán tiền hàng Giai đoạn 2 trong vòng 6 giờ sau khi kiểm định đạt chuẩn. Khoản dự phòng cước hoàn (${formatVND(returnReserveFee)}) đang được giữ trong quỹ và sẽ được hoàn trả về ví cho ${refundPartyLabel} (bên đã nộp) sau khi đối soát quyết toán.`
                                      : `Order auto-cancelled as buyer did not complete Phase 2 payment within 6 hours of passing inspection. Return reserve (${formatVND(returnReserveFee)}) is held and will be refunded to ${refundPartyLabel} upon settlement reconciliation.`)
                                    : (cancelReasonInfo.reason
                                      ? `${lang === 'vi' ? 'Lý do hủy đơn: ' : 'Cancellation reason: '}${cancelReasonInfo.reason}`
                                      : (orderNote || (lang === 'vi'
                                        ? 'Đơn kiểm định đã kết thúc. Phí và tiền cọc được xử lý đối soát theo quy định.'
                                        : 'Inspection order ended. Fees are handled according to policy.')))}
                            </p>
                            {isAtCenter && returnReserveFee > 0 && (
                              <div className="pt-1.5 border-t border-rose-200/80 text-[11px] text-rose-900 flex items-center justify-between">
                                <span>{lang === 'vi' ? `Khoản dự phòng cước hoàn (${formatVND(returnReserveFee)} · ${feePayerDescription}):` : `Return shipping reserve (${formatVND(returnReserveFee)}):`}</span>
                                <div>
                                  {Boolean(
                                    (detailModalOrder as any).returnReserveRefundedAt ||
                                    (detailInspectionDto as any)?.returnReserveRefundedAt ||
                                    (detailModalOrder as any).returnReserveStatus === 'REFUNDED_UNUSED' ||
                                    (detailInspectionDto as any)?.returnReserveStatus === 'REFUNDED_UNUSED' ||
                                    (detailModalOrder as any).returnReserve?.status === 'REFUNDED_UNUSED' ||
                                    (detailInspectionDto as any)?.returnReserve?.status === 'REFUNDED_UNUSED'
                                  ) ? (
                                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                                      {lang === 'vi'
                                        ? `Đã hoàn về ví ${feePayerSplit === 'SELLER_100' ? 'người bán' : feePayerSplit === 'BUYER_100' ? 'người mua' : '(tỷ lệ 50/50)'}`
                                        : 'Refunded'}
                                    </span>
                                  ) : detailShipments.some((s) => s.leg === 'CENTER_TO_SELLER' || s.leg === 'RETURN') ? (
                                    <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded text-[10px]">
                                      {lang === 'vi' ? 'Đã sử dụng cho cước hoàn' : 'Used for return delivery'}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px]">
                                      {lang === 'vi' ? 'Đang giữ trong quỹ (Chờ đối soát)' : 'Held in Escrow (Pending reconciliation)'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })()}

              {/* 48h Auto-release notice banner in Modal */}
              {(() => {
                const isInspectionOrder = Boolean(
                  detailModalOrder.hasInspectionService ||
                  detailModalOrder.inspectionMethod ||
                  (detailModalOrder as any).orderType ||
                  detailInspectionDto ||
                  (detailModalOrder as any).inspectionStatus ||
                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)
                );
                const isPhase2Paid = Boolean(
                  detailModalOrder.finalPaymentPaidAt ||
                  detailInspectionDto?.finalPaymentPaidAt ||
                  (detailModalOrder.linkedOrderId && (detailModalOrder as any).backendStatus !== 'PASSED' && detailModalOrder.escrowStatus !== 'INSPECTION_PASSED') ||
                  detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
                  detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                  (detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' && (detailModalOrder as any).backendStatus !== 'CANCELLED')
                );

                if (isInspectionOrder && !isPhase2Paid) {
                  return null;
                }

                if (!detailBuyerInspectionStage && detailModalOrder.shippingDeliveredAt && !isOrderReceiptConfirmed(detailModalOrder) && detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' && (detailModalOrder.escrowStatus as any) !== 'RELEASED' && (detailModalOrder as any).backendStatus !== 'COMPLETED' && detailModalOrder.escrowStatus !== 'DISPUTED') {
                  return (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Quy Trình Tự Động Giải Ngân Sau 48 Giờ</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Đơn hàng đã được bưu tá xác nhận giao thành công vào lúc <strong>{new Date(detailModalOrder.shippingDeliveredAt).toLocaleString('vi-VN')}</strong>.
                        Theo chính sách bảo vệ người mua của SecondLife, hệ thống sẽ tự động giải ngân cho người bán sau 48 giờ kể từ thời điểm này nếu không có khiếu nại phát sinh.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Order Settlement Breakdown (Quyết toán giải ngân) */}
              {(() => {
                const isInspectionOrder = Boolean(
                  detailModalOrder.hasInspectionService ||
                  detailModalOrder.inspectionMethod ||
                  (detailModalOrder as any).orderType ||
                  detailInspectionDto ||
                  (detailModalOrder as any).inspectionStatus ||
                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)
                );
                const isPhase2Paid = Boolean(
                  detailModalOrder.finalPaymentPaidAt ||
                  detailInspectionDto?.finalPaymentPaidAt ||
                  (detailModalOrder.linkedOrderId && (detailModalOrder as any).backendStatus !== 'PASSED' && detailModalOrder.escrowStatus !== 'INSPECTION_PASSED') ||
                  detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
                  detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                  (detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' && (detailModalOrder as any).backendStatus !== 'CANCELLED')
                );

                if (isInspectionOrder && !isPhase2Paid) {
                  return null;
                }

                return (
                  <div className="rounded-2xl p-4 border border-gray-200 bg-[#faf8f5] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#24263e]" />
                        <span className="font-bold text-xs uppercase tracking-wide text-[#24263e]">
                          Chi Tiết Quyết Toán Giải Ngân
                        </span>
                      </div>
                      {orderSettlement ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          ĐÃ QUYẾT TOÁN
                        </span>
                      ) : settlementNotSettled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          CHƯA GIẢI NGÂN
                        </span>
                      ) : null}
                    </div>

                    {isLoadingSettlement ? (
                      <div className="py-3 text-center text-xs text-slate-500 font-medium">
                        Đang tải dữ liệu quyết toán từ hệ thống...
                      </div>
                    ) : orderSettlement ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-xl bg-white border border-gray-200 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Tiền người bán thực nhận:</span>
                            <span className="text-sm font-black text-emerald-600">
                              {formatVND(orderSettlement.sellerPayout)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>Hoa hồng sàn SecondLife:</span>
                            <span className="font-bold text-[#c34c36]">
                              {formatVND(orderSettlement.platformCommission)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>Cước vận chuyển:</span>
                            <span className="font-bold text-slate-800">
                              {formatVND(orderSettlement.shippingFee)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>Giá cơ sở tính hoa hồng:</span>
                            <span className="font-bold text-slate-800">
                              {formatVND(orderSettlement.commissionBase)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Mã quyết toán: <strong className="font-mono text-slate-700">#{orderSettlement.settlementId}</strong></span>
                          <span>Thời điểm giải ngân: <strong>{new Date(orderSettlement.settledAt).toLocaleString('vi-VN')}</strong></span>
                        </div>
                      </div>
                    ) : orderCommission ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Chưa quyết toán giải ngân
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {orderCommission.ruleCode || 'Biểu phí chuẩn'}
                          </span>
                        </div>
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
                          <div className="flex justify-between items-center text-slate-700">
                            <span>Ước tính thực nhận (khi hoàn tất):</span>
                            <span className="text-sm font-black text-emerald-600">
                              {formatVND((orderCommission.commissionBase ?? detailModalOrder.itemPriceVnd) - (orderCommission.platformCommission ?? 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>Phí hoa hồng sàn ({orderCommission.ratePercent !== undefined ? `${orderCommission.ratePercent}%` : 'tính theo biểu phí'}):</span>
                            <span className="font-bold text-[#c34c36]">
                              -{formatVND(orderCommission.platformCommission ?? 0)}
                            </span>
                          </div>
                          {orderCommission.commissionBase !== undefined && (
                            <div className="flex justify-between items-center text-slate-600 text-[11px]">
                              <span>Giá cơ sở tính hoa hồng:</span>
                              <span className="font-bold text-slate-800">
                                {formatVND(orderCommission.commissionBase)}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 pt-1">
                          Khoản tiền bán hàng đang được bảo toàn trong Quỹ Escrow. Tiền sẽ được khấu trừ hoa hồng theo biểu phí hệ thống và giải ngân về ví người bán sau khi giao dịch hoàn tất.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-800">Chưa giải ngân</p>
                        <p className="text-[11px] text-slate-500">
                          Khoản tiền ký quỹ của đơn hàng đang được bảo toàn tại ví trung gian Escrow của hệ thống. Tiền sẽ được chuyển vào ví người bán sau khi người mua xác nhận đã nhận hàng hoặc sau thời hạn 48 giờ.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Bottom Sticky Footer */}
            {Boolean(
              getInspectionPurchaseDecision(detailModalOrder) ||
              detailModalOrder.inspectionStatus === 'FAILED' ||
              detailModalOrder.escrowStatus === 'INSPECTION_FAILED' ||
              (!isOrderCancelledOrRefunded(detailModalOrder) && (
                isOrderSeller(detailModalOrder) ||
                (!isOrderSeller(detailModalOrder) && (
                  detailModalOrder.escrowStatus === 'INSPECTION_PASSED' ||
                  (detailModalOrder as any).backendStatus === 'PASSED' ||
                  detailHasInspection ||
                  (detailModalOrder.inspectionMethod === 'AT_HOME' || (detailModalOrder as any).orderType === 'AT_HOME') ||
                  Boolean(
                    (detailModalOrder.carrierPickedUpAt ||
                      (detailModalOrder.backendStatus as any) === 'SHIPPED' ||
                      (detailModalOrder.backendStatus as any) === 'DELIVERED' ||
                      (detailModalOrder.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                      (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW') &&
                    !isOrderReceiptConfirmed(detailModalOrder)
                  )
                ))
              ))
            ) && (
                <div className="px-6 sm:px-7 py-3.5 sm:py-4 border-t border-gray-100 bg-slate-50/95 backdrop-blur-xs shrink-0 flex flex-wrap items-center justify-between gap-3 z-10">
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    {renderInspectionDecision(detailModalOrder, () => setDetailModalOrder(null))}
                    {!isOrderCancelledOrRefunded(detailModalOrder) &&
                      detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
                      detailModalOrder.escrowStatus !== 'DISPUTED' && (
                        <>
                          {/* Seller Action Buttons */}
                          {isOrderSeller(detailModalOrder) && (
                            isOrderReceiptConfirmed(detailModalOrder) ? (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                <div className="py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>{lang === 'vi' ? 'Đã Nhận Tiền Vào Ví (Đã Giải Ngân)' : 'Funds Credited to Wallet'}</span>
                                </div>
                                {!detailHasInspection && (
                                  <button
                                    onClick={() => setTrackingOrder(detailModalOrder)}
                                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Truck className="w-4 h-4 text-white" />
                                    <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                                  </button>
                                )}
                              </div>
                            ) : isOrderCancelledOrRefunded(detailModalOrder) ? (
                              <div className="py-2.5 px-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 flex-1">
                                <XCircle className="w-4 h-4 text-rose-600" />
                                <span>{lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy • Dừng Mọi Thao Tác' : 'Order Cancelled'}</span>
                              </div>
                            ) : (
                              <>
                                {/* GIAI ĐOẠN 1: Chờ xác nhận đơn / Đồng ý kiểm định */}
                                {!isOrderSellerConfirmed(detailModalOrder) &&
                                  detailModalOrder.backendStatus !== 'CANCELLED' &&
                                  detailModalOrder.escrowStatus !== 'REFUNDED_TO_BUYER' &&
                                  !isOrderReceiptConfirmed(detailModalOrder) &&
                                  detailModalOrder.backendStatus !== 'COMPLETED' &&
                                  !detailModalOrder.shippingDeliveredAt && (
                                    (() => {
                                      const hasInspection = Boolean(
                                        detailModalOrder.hasInspectionService ||
                                        (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                                        detailModalOrder.inspectionCenterId ||
                                        detailModalOrder.inspectionMethod ||
                                        (detailModalOrder as any).inspectionStatus ||
                                        detailModalOrder.escrowStatus === 'AWAITING_INSPECTION' ||
                                        detailModalOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
                                        detailModalOrder.escrowStatus === 'INSPECTION_PASSED'
                                      );
                                      const savedAppointment = getOrderAppointment(detailModalOrder);

                                      if (hasInspection) {
                                        return (
                                          <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                            {(detailModalOrder.inspectionMethod === 'AT_HOME' || (detailModalOrder as any).orderType === 'AT_HOME') ? (
                                              savedAppointment?.status === 'COUNTERED_BY_CENTER' || savedAppointment?.counterScheduledAt ? (
                                                <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSellerAcceptCounterAppointment(detailModalOrder.id, savedAppointment)}
                                                    disabled={orderActionLoading === detailModalOrder.id}
                                                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                                    title="Đồng ý với ngày giờ mới mà Trung tâm kiểm định đề xuất"
                                                  >
                                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                                    <span>Đồng Ý Lịch Mới Của Hub</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSchedulingOrder(detailModalOrder);
                                                      setSchedulingReadOnly(false);
                                                    }}
                                                    className="py-2.5 px-4 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                                  >
                                                    <Calendar className="w-4 h-4" />
                                                    <span>Hẹn Lại Lịch Khác</span>
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSchedulingOrder(detailModalOrder);
                                                    setSchedulingReadOnly(false);
                                                  }}
                                                  disabled={orderActionLoading === detailModalOrder.id}
                                                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                                  title="Chọn ngày giờ kỹ thuật viên SecondLife đến nhà kiểm tra thiết bị"
                                                >
                                                  <Calendar className="w-4 h-4" />
                                                  <span>
                                                    {(() => {
                                                      const rej = getOrderAppointmentRejection(detailModalOrder);
                                                      if (rej && !savedAppointment?.scheduledAt) {
                                                        return lang === 'vi' ? 'Đặt Lại Lịch Hẹn KTV' : 'Reschedule Visit';
                                                      }
                                                      return savedAppointment?.scheduledAt
                                                        ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Reschedule Visit')
                                                        : (lang === 'vi' ? 'Xác Nhận & Hẹn Lịch Đón KTV' : 'Confirm & Schedule Visit');
                                                    })()}
                                                  </span>
                                                </button>
                                              )
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleSellerConfirmOrder(detailModalOrder.id);
                                                }}
                                                disabled={orderActionLoading === detailModalOrder.id}
                                                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                                title={lang === 'vi' ? 'Xác nhận đồng ý kiểm định và chuẩn bị gửi hàng Chặng 1 đến Trung tâm Hub SecondLife' : 'Confirm inspection agreement'}
                                              >
                                                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                                <span>
                                                  {orderActionLoading === detailModalOrder.id
                                                    ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                                    : (lang === 'vi' ? 'Đồng ý kiểm định' : 'Accept Inspection')}
                                                </span>
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                handlePromptRejectInspection(detailModalOrder);
                                              }}
                                              disabled={orderActionLoading === detailModalOrder.id}
                                              className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                              title={lang === 'vi' ? 'Từ chối yêu cầu kiểm định' : 'Reject Inspection'}
                                            >
                                              <X className="w-4 h-4" />
                                              <span>{lang === 'vi' ? 'Từ chối kiểm định' : 'Reject Inspection'}</span>
                                            </button>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleSellerConfirmOrder(detailModalOrder.id);
                                            }}
                                            disabled={orderActionLoading === detailModalOrder.id}
                                            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                          >
                                            <Check className="w-4 h-4 stroke-[2.5]" />
                                            <span>
                                              {orderActionLoading === detailModalOrder.id
                                                ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                                : (lang === 'vi' ? 'Xác nhận đơn hàng' : 'Confirm Order')}
                                            </span>
                                          </button>

                                          {onCancelOrder && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handlePromptCancelOrder(detailModalOrder);
                                              }}
                                              className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                              <X className="w-4 h-4" />
                                              <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()
                                  )}

                                {/* GIAI ĐOẠN NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) CHO SELLER TRONG MODAL */}
                                {String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                                  (() => {
                                    const isFeePending = isPartyInspectionFeePending(detailModalOrder, true);
                                    const sellerFee = getPartyInspectionFee(detailModalOrder, true);
                                    const isFeePaid = isPartyInspectionFeePaid(detailModalOrder, true);
                                    const deadline = detailModalOrder.paymentDeadline || (detailModalOrder as any)?.inspectionOrder?.paymentDeadline;
                                    const isFeeExpired = isInspectionPaymentExpired(deadline);

                                    if (isFeePending) {
                                      return (
                                        <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                          {isFeeExpired ? (
                                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 flex-1">
                                              <div className="flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                                <div>
                                                  <strong className="block font-bold">
                                                    {lang === 'vi' ? 'Đã quá hạn đóng phí kiểm định' : 'Fee payment deadline expired'}
                                                  </strong>
                                                  <span className="text-[11px] text-rose-700">
                                                    {deadline
                                                      ? `${lang === 'vi' ? 'Hạn chót:' : 'Deadline:'} ${formatInspectionDeadline(deadline, lang)}`
                                                      : (lang === 'vi' ? 'Đơn hàng không thể tiếp tục thanh toán phí' : 'Cannot pay fee')}
                                                  </span>
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => onRefreshOrders?.()}
                                                className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer transition shrink-0"
                                              >
                                                {lang === 'vi' ? 'Tải lại đơn' : 'Refresh'}
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => handlePayInspectionFee(detailModalOrder.id)}
                                              disabled={orderActionLoading === detailModalOrder.id}
                                              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                            >
                                              <Wallet className="w-4 h-4" />
                                              <span>
                                                {orderActionLoading === detailModalOrder.id
                                                  ? (lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Processing...')
                                                  : (lang === 'vi'
                                                    ? `Nộp phí kiểm định (${formatVND(sellerFee)}) (Trừ Ví)`
                                                    : `Pay Inspection Fee (${formatVND(sellerFee)})`)}
                                              </span>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (isFeePaid) {
                                      return (
                                        <div className="flex-1 py-2.5 px-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                          <Clock className="w-4 h-4 text-amber-600" />
                                          <span>
                                            {lang === 'vi'
                                              ? `Bạn đã nộp phí kiểm định (${formatVND(sellerFee)}) • Chờ người mua thanh toán phí`
                                              : 'You paid inspection fee share • Awaiting buyer payment'}
                                          </span>
                                        </div>
                                      );
                                    }

                                    return null;
                                  })()
                                )}

                                {/* GIAI ĐOẠN 2: Đã xác nhận • Đang đóng gói */}
                                {isOrderSellerConfirmed(detailModalOrder) &&
                                  String((detailModalOrder as any)?.backendStatus || '').toUpperCase() !== 'WAITING_FEE_PAYMENT' &&
                                  !detailInboundLabel &&
                                  !isOrderReceiptConfirmed(detailModalOrder) &&
                                  detailModalOrder.backendStatus !== 'COMPLETED' &&
                                  !detailModalOrder.shippingDeliveredAt &&
                                  !isOrderPacked(detailModalOrder) &&
                                  detailModalOrder.backendStatus !== 'SHIPPED' &&
                                  detailModalOrder.backendStatus !== 'DELIVERED' &&
                                  (detailModalOrder.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                                  (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                                  (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' &&
                                  (detailModalOrder.escrowStatus as string) !== 'INSPECTION_PASSED' &&
                                  (detailModalOrder as any).backendStatus !== 'PASSED' && (
                                    <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                      {/* Nút Đã Đóng Gói • Tạo Đơn Lalamove cho Chặng 1 hoặc đơn thông thường (KHÔNG HIỂN THỊ KHI LÀ AT_HOME) */}
                                      {(!detailHasInspection || (detailModalOrder.inspectionMethod !== 'AT_HOME' && (detailModalOrder as any).orderType !== 'AT_HOME')) && (
                                        <button
                                          onClick={() => {
                                            setCreateShipmentOrder(detailModalOrder);
                                          }}
                                          className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                          title={lang === 'vi' ? 'Kiện hàng đã đóng gói. Bấm để tạo vận đơn Lalamove điều phối tài xế lấy hàng' : 'Package is packed. Click to create Lalamove shipment'}
                                        >
                                          <Truck className="w-4 h-4" />
                                          <span>
                                            {lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Order'}
                                          </span>
                                        </button>
                                      )}

                                      {/* Nút Hẹn Lịch Đón KTV trong Modal Chi Tiết (CHỈ HIỆN KHI ĐƠN HÀNG LÀ KIỂM ĐỊNH TẬN NHÀ - AT_HOME) */}
                                      {detailHasInspection && (detailModalOrder.inspectionMethod === 'AT_HOME' || (detailModalOrder as any).orderType === 'AT_HOME') && (() => {
                                        const rej = getOrderAppointmentRejection(detailModalOrder);
                                        const appt = getOrderAppointment(detailModalOrder);
                                        const isCountered = appt?.status === 'COUNTERED_BY_CENTER' || !!appt?.counterScheduledAt;

                                        if (isCountered) {
                                          return (
                                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                              <button
                                                type="button"
                                                onClick={() => handleSellerAcceptCounterAppointment(detailModalOrder.id, appt)}
                                                disabled={orderActionLoading === detailModalOrder.id}
                                                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                                title={lang === 'vi' ? 'Đồng ý với ngày giờ mới mà Trung tâm kiểm định đề xuất' : 'Accept Hub suggested appointment'}
                                              >
                                                <Check className="w-4 h-4 stroke-[2.5]" />
                                                <span>{lang === 'vi' ? 'Đồng Ý Lịch Mới Của Hub' : 'Accept Center Schedule'}</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSchedulingOrder(detailModalOrder);
                                                  setSchedulingReadOnly(false);
                                                }}
                                                className="py-2.5 px-4 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                              >
                                                <Calendar className="w-4 h-4" />
                                                <span>{lang === 'vi' ? 'Hẹn Lại Lịch Khác' : 'Reschedule'}</span>
                                              </button>
                                            </div>
                                          );
                                        }

                                        if (isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)) {
                                          return (
                                            <div className="flex-1 py-2.5 px-4 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs">
                                              <Wrench className="w-4 h-4 text-emerald-600 animate-spin" />
                                              <span>{lang === 'vi' ? 'KTV Đã Đến Và Đang Kiểm Tra' : 'Inspector Arrived & Inspecting'}</span>
                                            </div>
                                          );
                                        }

                                        return (
                                          <button
                                            onClick={() => {
                                              setSchedulingOrder(detailModalOrder);
                                              setSchedulingReadOnly(false);
                                            }}
                                            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                            title={lang === 'vi' ? 'Chọn ngày giờ kỹ thuật viên SecondLife đến nhà kiểm tra thiết bị' : 'Schedule technician visit'}
                                          >
                                            <Calendar className="w-4 h-4" />
                                            <span>
                                              {rej && !appt?.scheduledAt
                                                ? (lang === 'vi' ? 'Đặt Lại Lịch Hẹn KTV' : 'Reschedule Visit')
                                                : appt?.scheduledAt
                                                  ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Hẹn Lịch Đón KTV')
                                                  : (lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Visit')}
                                            </span>
                                          </button>
                                        );
                                      })()}

                                      {/* Nút Hủy Yêu Cầu Kiểm Định Cho Seller (Khi KTV chưa đến nhà) */}
                                      {detailHasInspection &&
                                        onCancelOrder &&
                                        !detailModalOrder.inspectionReport &&
                                        !isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder) && (
                                          <button
                                            type="button"
                                            onClick={() => handlePromptCancelInspectionRequest(detailModalOrder)}
                                            className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                                            title={lang === 'vi' ? 'Hủy yêu cầu kiểm định cho đơn hàng này' : 'Cancel inspection request'}
                                          >
                                            <XCircle className="w-4 h-4 text-rose-600" />
                                            <span>{lang === 'vi' ? 'Hủy Yêu Cầu Kiểm Định' : 'Cancel Inspection Request'}</span>
                                          </button>
                                        )}

                                      {/* Nút Xem / In Mã QR Dán Sản Phẩm trong Modal Chi Tiết */}


                                      {!detailHasInspection && isShipmentCreatedForOrder(detailModalOrder) && (
                                        <button
                                          onClick={() => setTrackingOrder(detailModalOrder)}
                                          className="py-2.5 px-4 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                          <Truck className="w-4 h-4 text-blue-600" />
                                          <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                {/* GIAI ĐOẠN 3: Đã đóng gói • Chờ Shipper đến lấy */}
                                {(!detailHasInspection || (detailModalOrder.inspectionMethod !== 'AT_HOME' && (detailModalOrder as any).orderType !== 'AT_HOME')) &&
                                  (detailHasInboundTracking || (isOrderPacked(detailModalOrder) &&
                                    !isOrderReceiptConfirmed(detailModalOrder) &&
                                    detailModalOrder.backendStatus !== 'COMPLETED' &&
                                    !detailModalOrder.shippingDeliveredAt &&
                                    !detailModalOrder.carrierPickedUpAt &&
                                    detailModalOrder.backendStatus !== 'SHIPPED' &&
                                    detailModalOrder.backendStatus !== 'DELIVERED' &&
                                    (detailModalOrder.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                                    (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                                    (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED')) && (
                                    <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                      {/* Nhãn Tĩnh (Không phải nút bấm, không click được) */}
                                      {detailInboundProgress?.step === 3 ? (
                                        <div
                                          className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none"
                                        >
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                          <span>{lang === 'vi' ? 'Kiện Hàng Đã Giao Tới Hub Kiểm Định' : 'Delivered to Inspection Hub'}</span>
                                        </div>
                                      ) : detailInboundProgress?.step === 2 ? (
                                        <div
                                          className="flex-1 py-2.5 px-4 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none"
                                        >
                                          <Truck className="w-4 h-4 text-cyan-600" />
                                          <span>{lang === 'vi' ? 'Tài Xế Đang Giao Kiện Hàng Tới Hub' : 'In Transit to Hub'}</span>
                                        </div>
                                      ) : (
                                        <div
                                          className="flex-1 py-2.5 px-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none pointer-events-none"
                                        >
                                          <PackageCheck className="w-4 h-4 text-teal-600" />
                                          <span>{lang === 'vi' ? 'Đã gói hàng• Chờ Bàn Giao Tài Xế' : 'Packed • Waiting for Carrier'}</span>
                                        </div>
                                      )}

                                      {!detailHasInspection && (detailHasInboundTracking || isShipmentCreatedForOrder(detailModalOrder)) && (
                                        <button
                                          onClick={() => setTrackingOrder(detailModalOrder)}
                                          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                          <Truck className="w-4 h-4 text-white" />
                                          <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                {/* GIAI ĐOẠN 4: Đang giao hàng */}
                                {!detailHasInboundTracking && (detailModalOrder.carrierPickedUpAt ||
                                  detailModalOrder.backendStatus === 'SHIPPED' ||
                                  detailModalOrder.backendStatus === 'DELIVERED' ||
                                  (detailModalOrder.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                                  (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' ||
                                  (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED') && (
                                    <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                      <span className="py-2.5 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                        <Truck className="w-4 h-4 text-blue-600" />
                                        <span>
                                          {detailModalOrder.backendStatus === 'DELIVERED' || (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED'
                                            ? (lang === 'vi' ? 'Đã Giao Thành Công' : 'Delivered')
                                            : (lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit')}
                                        </span>
                                      </span>

                                      {!detailHasInspection && (
                                        <button
                                          onClick={() => setTrackingOrder(detailModalOrder)}
                                          className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                          <Truck className="w-4 h-4 text-white" />
                                          <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                              </>
                            )
                          )}

                          {/* Người Mua (Buyer) nộp phí kiểm định khi người bán đã đồng ý kiểm định */}
                          {!isOrderSeller(detailModalOrder) &&
                            String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                {isInspectionPaymentExpired(detailModalOrder.paymentDeadline) ? (
                                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 flex-1">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                      <div>
                                        <strong className="block font-bold">
                                          {lang === 'vi' ? 'Đã quá hạn đóng phí kiểm định' : 'Fee payment deadline expired'}
                                        </strong>
                                        <span className="text-[11px] text-rose-700">
                                          {detailModalOrder.paymentDeadline
                                            ? `${lang === 'vi' ? 'Hạn chót:' : 'Deadline:'} ${formatInspectionDeadline(detailModalOrder.paymentDeadline, lang)}`
                                            : (lang === 'vi' ? 'Đơn hàng không thể tiếp tục thanh toán phí' : 'Cannot pay fee')}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => onRefreshOrders?.()}
                                      className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer transition shrink-0"
                                    >
                                      {lang === 'vi' ? 'Tải lại đơn' : 'Refresh'}
                                    </button>
                                  </div>
                                ) : isPartyInspectionFeePaid(detailModalOrder, false) ? (
                                  <div className="flex-1 py-2.5 px-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    <span>
                                      {lang === 'vi'
                                        ? `Bạn đã nộp phí kiểm định (${formatVND(getPartyInspectionFee(detailModalOrder, false))}) • Đang chờ người bán thanh toán phí`
                                        : 'You paid fee share • Awaiting seller payment'}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handlePayInspectionFee(detailModalOrder.id)}
                                    disabled={orderActionLoading === detailModalOrder.id}
                                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                  >
                                    <Wallet className="w-4 h-4" />
                                    <span>
                                      {orderActionLoading === detailModalOrder.id
                                        ? (lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Processing...')
                                        : (lang === 'vi'
                                          ? `Nộp phí kiểm định (${formatVND(getPartyInspectionFee(detailModalOrder, false))}) (Trừ Ví)`
                                          : `Pay Inspection Fee (${formatVND(getPartyInspectionFee(detailModalOrder, false))})`)}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}

                          {/* GIAI ĐOẠN ĐANG KIỂM ĐỊNH / CHỜ KIỂM ĐỊNH CHO BUYER TRONG MODAL */}
                          {!isOrderSeller(detailModalOrder) &&
                            detailHasInspection &&
                            !detailModalOrder.shippingDeliveredAt &&
                            detailModalOrder.backendStatus !== 'DELIVERED' &&
                            (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                            (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' &&
                            !detailModalOrder.inspectionReport &&
                            !isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder) && (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1 justify-end">
                                {onCancelOrder && (
                                  <button
                                    type="button"
                                    onClick={() => handlePromptCancelInspectionRequest(detailModalOrder)}
                                    className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                                    title={lang === 'vi' ? 'Hủy yêu cầu kiểm định và hoàn trả 100% tiền tạm giữ về ví Escrow' : 'Cancel inspection request and refund funds'}
                                  >
                                    <XCircle className="w-4 h-4 text-rose-600" />
                                    <span>{lang === 'vi' ? 'Hủy Yêu Cầu Kiểm Định' : 'Cancel Inspection Request'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                          {/* Chỉ Người Mua (Buyer) mới có nút Đã Nhận Hàng & Khiếu Nại Trả Hàng khi đơn đã giao và CHƯA xác nhận */}
                          {!isOrderSeller(detailModalOrder) &&
                            !detailBuyerInspectionStage &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            (detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                              detailModalOrder.backendStatus === 'DELIVERED' ||
                              detailModalOrder.shippingDeliveredAt ||
                              detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
                              (detailModalOrder as any).inspectionStatus === 'DELIVERING_TO_BUYER' ||
                              (detailModalOrder as any).inspectionStatus === 'PASSED') && (
                              <>
                                <button
                                  onClick={() => {
                                    if (confirmingReceiptIds.has(detailModalOrder.id) || isOrderReceiptConfirmed(detailModalOrder)) return;
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: lang === 'vi' ? 'Xác Nhận Đã Nhận Hàng' : 'Confirm Delivery Receipt',
                                      message: lang === 'vi'
                                        ? 'Xác nhận bạn đã nhận hàng đầy đủ và nghiệm thu sản phẩm?'
                                        : 'Confirm you have received and inspected the item?',
                                      subMessage: lang === 'vi'
                                        ? 'Tiền ký quỹ trong Escrow sẽ được giải ngân an toàn cho người bán. Hành động này không thể hoàn tác.'
                                        : 'Escrow funds will be released to the seller immediately.',
                                      confirmText: lang === 'vi' ? 'Đã Nhận Hàng (Giải Ngân)' : 'Confirm Receipt',
                                      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
                                      variant: 'success',
                                      iconType: 'check',
                                      onConfirm: () => {
                                        setConfirmingReceiptIds((prev) => new Set(prev).add(detailModalOrder.id));
                                        try {
                                          if (typeof window !== 'undefined') {
                                            localStorage.setItem(`order_receipt_confirmed_${detailModalOrder.id}`, 'true');
                                          }
                                        } catch { }
                                        onConfirmReceipt(detailModalOrder.id);
                                        setDetailModalOrder(null);
                                        setConfirmDialog(null);
                                      }
                                    });
                                  }}
                                  disabled={confirmingReceiptIds.has(detailModalOrder.id)}
                                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{confirmingReceiptIds.has(detailModalOrder.id) ? (lang === 'vi' ? 'Đang giải ngân...' : 'Processing...') : t.confirmReceipt}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (onOpenDispute) {
                                      onOpenDispute(detailModalOrder);
                                    } else {
                                      setReportingOrder(detailModalOrder);
                                    }
                                    setDetailModalOrder(null);
                                  }}
                                  className="py-2.5 px-4 bg-white hover:bg-gray-100 text-[#24263e] border border-[#24263e]/30 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <AlertTriangle className="w-4 h-4 text-[#24263e]" />
                                  <span>{t.openDispute}</span>
                                </button>
                              </>
                            )}
                        </>
                      )}
                  </div>
                </div>
              )}
          </div>
        </div>
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
            onRefreshOrders?.();
          }}
          lang={lang}
          readOnly={schedulingReadOnly}
          initialScheduledAt={getOrderAppointment(schedulingOrder)?.scheduledAt}
          initialNote={getOrderAppointment(schedulingOrder)?.note}
        />
      )}
      {/* System Action Confirmation Modal (Replaces raw window.confirm) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4 text-[#24263e] animate-scaleUp">
            <div className="flex items-start gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${confirmDialog.variant === 'success'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : confirmDialog.variant === 'warning'
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                {confirmDialog.iconType === 'truck' ? (
                  <Truck className="w-6 h-6 text-blue-600" />
                ) : confirmDialog.iconType === 'package' ? (
                  <Package className="w-6 h-6 text-blue-600" />
                ) : confirmDialog.iconType === 'alert' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-base text-[#24263e]">{confirmDialog.title}</h4>
                <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">{confirmDialog.message}</p>
                {confirmDialog.subMessage && (
                  <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-normal">
                    {confirmDialog.subMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                {confirmDialog.cancelText || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                disabled={!!orderActionLoading}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${confirmDialog.variant === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : confirmDialog.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800'
                  }`}
              >
                {orderActionLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{confirmDialog.confirmText || 'Xác Nhận'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
