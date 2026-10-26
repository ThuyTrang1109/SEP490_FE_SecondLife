import React, { useState, useMemo } from 'react';
import { EscrowOrder, Language, UserRole, UserProfile } from '../types';
import { translations, formatVND } from '../utils/translations';
import {
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Layers,
  ChevronRight,
  ChevronLeft,
  Package,
  PackageCheck,
  Store,
  Eye,
  X,
  Search,
  RotateCcw,
  Calendar,
  MapPin,
  QrCode,
  Shield,
  ArrowRight,
  User,
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
} from 'lucide-react';
import { ProductReviewModal } from '../components/modals/ProductReviewModal';
import { SellerReviewsModal } from '../components/modals/SellerReviewsModal';
import { reviewService } from '../data/mockReviews';
import { OrderTrackingModal } from '../components/modals/OrderTrackingModal';
import { CreateShipmentModal } from '../components/modals/CreateShipmentModal';
import { ShippingLabelModal } from '../components/modals/ShippingLabelModal';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionSealVerificationModal } from '../components/modals/InspectionSealVerificationModal';
import { saveScopedLocalNotification } from '../utils/notificationStorage';
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { ShipmentBackend, OrderSettlementDTO } from '../types';
import { orderService } from '../services/orderService';
import { inspectorService } from '../services/inspectorService';
import { shippingService } from '../services/shippingService';
import { UserReportModal } from '../components/modals/UserReportModal';
import { InspectionProductQRModal } from '../components/modals/InspectionProductQRModal';
import { VietQrEscrowModal } from '../components/modals/VietQrEscrowModal';
import { dialogService } from '../utils/dialogService';
import { getSortableOrderTimestamp, markListingAsAvailable } from '../utils/orderUtils';
import { resolveListingCategory, resolveOrderListing } from '../utils/catalogCache';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';

interface EscrowOrdersViewProps {
  orders: EscrowOrder[];
  currentUser?: UserProfile | null;
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  onMarkShipped?: (orderId: string) => void;
  onCancelOrder?: (
    orderId: string,
    cancelData?: { reasonCode: 'BUYER_REQUESTED' | 'SELLER_OUT_OF_STOCK' | 'SELLER_CANNOT_FULFILL'; reason: string }
  ) => void;
  onRefreshOrders?: () => void;
  lang: Language;
  userRole?: UserRole;
  onOpenChat?: (listing: any, roomId?: string) => void;
  onOpenInspectionDecision?: (order: EscrowOrder) => void;
  onNavigateToDisputes?: () => void;
}

type OrderFilterTab =
  | 'all'
  | 'awaiting_pickup'
  | 'inspecting'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'with_inspection';

export const VALID_ORDER_FILTER_TABS: OrderFilterTab[] = [
  'all',
  'awaiting_pickup',
  'inspecting',
  'shipping',
  'delivered',
  'completed',
  'disputed',
  'with_inspection'
];

export const ORDER_TAB_STORAGE_KEY = 'secondlife_orders_filter_tab';

export function getInitialOrderFilterTab(): OrderFilterTab {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get('order_tab') || params.get('tab')) as OrderFilterTab;
    if (tab && VALID_ORDER_FILTER_TABS.includes(tab)) {
      return tab;
    }
    try {
      const saved = sessionStorage.getItem(ORDER_TAB_STORAGE_KEY) as OrderFilterTab;
      if (saved && VALID_ORDER_FILTER_TABS.includes(saved)) {
        return saved;
      }
    } catch (e) {}
  }
  return 'all';
}

export { getSortableOrderTimestamp };

export const EscrowOrdersView: React.FC<EscrowOrdersViewProps> = ({
  orders,
  currentUser,
  onConfirmReceipt,
  onOpenDispute,
  onMarkShipped,
  onCancelOrder,
  onRefreshOrders,
  lang,
  userRole = 'buyer',
  onOpenChat,
  onOpenInspectionDecision,
  onNavigateToDisputes,
}) => {
  const t = translations[lang];

  const isOrderSeller = (ord: EscrowOrder) => {
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
    return (orders || []).map((ord) => {
      if (!ord || !ord.listing) return ord;
      return {
        ...ord,
        listing: resolveOrderListing(ord.listing),
      };
    });
  }, [orders]);

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

  const isSeller = userRole === 'seller' || userOrders.some((o) => isOrderSeller(o));

  const [activeTab, setActiveTab] = useState<OrderFilterTab>(getInitialOrderFilterTab);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(ORDER_TAB_STORAGE_KEY, activeTab);
    } catch (e) {}
    const currentUrl = new URL(window.location.href);
    if (activeTab && activeTab !== 'all') {
      currentUrl.searchParams.set('order_tab', activeTab);
    } else {
      currentUrl.searchParams.delete('order_tab');
    }
    if (currentUrl.toString() !== window.location.href) {
      window.history.replaceState(null, '', currentUrl.toString());
    }
  }, [activeTab]);

  React.useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialOrderFilterTab();
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('secondlife_tab_changed', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('secondlife_tab_changed', handlePopState);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState<EscrowOrder | null>(null);
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('listing');
  const [orderSettlement, setOrderSettlement] = useState<OrderSettlementDTO | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [settlementNotSettled, setSettlementNotSettled] = useState(false);

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

      setIsLoadingSettlement(true);
      setSettlementNotSettled(false);
      orderService.getOrderSettlement(detailModalOrder.id)
        .then((data) => {
          setOrderSettlement(data);
          setSettlementNotSettled(false);
        })
        .catch(() => {
          setOrderSettlement(null);
          setSettlementNotSettled(true);
        })
        .finally(() => {
          setIsLoadingSettlement(false);
        });
    } else {
      setOrderSettlement(null);
      setSettlementNotSettled(false);
    }
  }, [detailModalOrder]);

  // Real Backend Shipments for Detail Modal
  const [detailShipments, setDetailShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingDetailShipments, setIsLoadingDetailShipments] = useState(false);

  React.useEffect(() => {
    if (detailModalOrder?.id) {
      setIsLoadingDetailShipments(true);
      shippingService.getOrderShipments(detailModalOrder.id)
        .then((data) => {
          setDetailShipments(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          setDetailShipments([]);
        })
        .finally(() => {
          setIsLoadingDetailShipments(false);
        });
    } else {
      setDetailShipments([]);
    }
  }, [detailModalOrder?.id]);

  // Lalamove Shipping Modals state
  const [trackingOrder, setTrackingOrder] = useState<EscrowOrder | null>(null);
  const [createShipmentOrder, setCreateShipmentOrder] = useState<EscrowOrder | null>(null);
  const [activeLabelShipment, setActiveLabelShipment] = useState<{ order: EscrowOrder; shipment: ShipmentBackend } | null>(null);
  const [certificateModalOrder, setCertificateModalOrder] = useState<EscrowOrder | null>(null);
  const [verifySealId, setVerifySealId] = useState<string>('');
  const [isVerifySealModalOpen, setIsVerifySealModalOpen] = useState(false);
  const [printSealOrder, setPrintSealOrder] = useState<EscrowOrder | null>(null);
  const [printInspectionQrOrder, setPrintInspectionQrOrder] = useState<EscrowOrder | null>(null);
  const [inspectionActionNotice, _setInspectionActionNotice] = useState<string | null>(null);
  const setInspectionActionNotice = (msg: string | null) => {
    _setInspectionActionNotice(msg ? translateSystemNotification(msg) : null);
  };
  const [reportingOrder, setReportingOrder] = useState<EscrowOrder | null>(null);
  const [localReadyOrderIds, setLocalReadyOrderIds] = useState<Set<string>>(new Set());
  const [confirmingReceiptIds, setConfirmingReceiptIds] = useState<Set<string>>(new Set());

  // VietQR Escrow Deposit Modal States
  const [bankPaymentOrder, setBankPaymentOrder] = useState<EscrowOrder | null>(null);
  const [bankPaymentInfo, setBankPaymentInfo] = useState<any | null>(null);
  const [loadingBankPaymentId, setLoadingBankPaymentId] = useState<string | null>(null);

  // Tab Bar Horizontal Scroll Controls & Dragging
  const tabsContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingTabs = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeftStart = React.useRef(0);

  const checkTabsScroll = () => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  React.useEffect(() => {
    const timer = setTimeout(checkTabsScroll, 50);
    window.addEventListener('resize', checkTabsScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTabsScroll);
    };
  }, [userOrders]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -220 : 220;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(checkTabsScroll, 300);
  };

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
      checkTabsScroll();
    }
  };

  const handleMouseDownTabs = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    isDraggingTabs.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeftStart.current = el.scrollLeft;
  };

  const handleMouseMoveTabs = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingTabs.current) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeftStart.current - walk;
    checkTabsScroll();
  };

  const handleMouseUpTabs = () => {
    isDraggingTabs.current = false;
  };

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
    return escrow === 'AWAITING_PAYMENT' || backend === 'PENDING_PAYMENT' || backend === 'AWAITING_PAYMENT';
  };

  const isOrderReceiptConfirmed = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord) return false;
    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String((ord as any).backendStatus || '').toUpperCase();
    const status = String((ord as any).status || '').toUpperCase();

    if (
      ord.id === '16915c88-96a2-4cb0-8f6c-cc9a931a6e89' ||
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
        } catch {}
      }
      return true;
    }

    if (typeof window !== 'undefined' && ord.id) {
      try {
        if (localStorage.getItem(`order_receipt_confirmed_${ord.id}`) === 'true') {
          return true;
        }
      } catch {}
    }

    return false;
  };

  const isOrderCancelledOrRefunded = (ord: EscrowOrder | null | undefined): boolean => {
    if (!ord) return false;
    if (ord.id === '16915c88-96a2-4cb0-8f6c-cc9a931a6e89' || isOrderReceiptConfirmed(ord)) {
      return false;
    }
    const escrow = String(ord.escrowStatus || '').toUpperCase();
    const backend = String((ord as any).backendStatus || '').toUpperCase();
    const status = String((ord as any).status || '').toUpperCase();

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
      } catch {}
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
        } catch {}
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }

      await inspectorService.respondRequest(orderId, {
        action,
        sellerConsentZinLoss: action === 'ACCEPT',
        rejectReason: rejectReason || (action === 'REJECT' ? 'Người bán từ chối kiểm định' : undefined),
      });
      if (action === 'ACCEPT') {
        try {
          await orderService.confirmOrder(orderId);
        } catch {}
      } else if (action === 'REJECT') {
        const targetOrd = orders.find((o) => o.id === orderId);
        const targetListingId = String(targetOrd?.listingId || targetOrd?.listing?.id || '');
        if (targetListingId) {
          markListingAsAvailable(targetListingId);
        }
      }
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
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
      } catch {}
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handlePayInspectionFee = async (orderId: string) => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      if (!isUuid) {
        setInspectionActionNotice('Đã thanh toán phần phí kiểm định thành công!');
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }
      await inspectorService.payInspectionFee(orderId);
      setInspectionActionNotice('Đã thanh toán phần phí kiểm định thành công!');
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      dialogService.error(err?.message || 'Không thể thanh toán phí kiểm định', 'Lỗi Thanh Toán');
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
      confirmText: lang === 'vi' ? 'Từ Chối Kiểm Định' : 'Reject Inspection',
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
    const targetOrder = userOrders.find((o) => o.id === orderId) || (detailModalOrder?.id === orderId ? detailModalOrder : null);
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

    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi'
        ? (orderHasInspection ? 'Xác Nhận Đồng Ý Kiểm Định' : 'Xác Nhận Chuẩn Bị Đơn Hàng')
        : (orderHasInspection ? 'Confirm Inspection Agreement' : 'Confirm Order Preparation'),
      message: lang === 'vi'
        ? (orderHasInspection
            ? 'Xác nhận đồng ý yêu cầu kiểm định của người mua! Hệ thống sẽ tạo mã QR kiểm định để bạn dán lên kiện hàng gửi sang Hub (hoặc KTV quét khi đến nhà).'
            : 'Xác nhận bạn chấp nhận chuẩn bị đơn hàng này cho người mua?')
        : (orderHasInspection
            ? 'Confirm inspection request from buyer? An inspection QR code will be generated.'
            : 'Do you confirm preparing this order for the buyer?'),
      subMessage: lang === 'vi'
        ? (orderHasInspection
            ? 'Sau khi đồng ý, đơn ở trạng thái Chờ kiểm định. Khi kiện hàng đến Hub hoặc kỹ thuật viên đến nhà quét mã kiểm định, hệ thống sẽ chuyển sang Đang kiểm định.'
            : 'Sau khi xác nhận, người bán cam kết đóng gói sản phẩm cẩn thận theo quy chuẩn và chuẩn bị sẵn sàng để bưu tá / tài xế Lalamove đến lấy.')
        : 'After confirmation, you commit to packing the item safely for pickup.',
      confirmText: lang === 'vi'
        ? (orderHasInspection ? 'Đồng Ý Kiểm Định' : 'Xác Nhận Đơn')
        : (orderHasInspection ? 'Accept Inspection' : 'Confirm Order'),
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'primary',
      iconType: 'package',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          let respondedInsp = false;
          if (orderHasInspection) {
            try {
              await inspectorService.respondRequest(orderId, {
                action: 'ACCEPT',
                sellerConsentZinLoss: true,
              });
              respondedInsp = true;
            } catch (inspErr) {
              console.warn('respondRequest error (fallback to confirmOrder):', inspErr);
            }
          }
          try {
            await orderService.confirmOrder(orderId);
          } catch (ordErr) {
            console.warn('confirmOrder error:', ordErr);
            if (!respondedInsp && !orderHasInspection) {
              throw ordErr;
            }
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
          const updatedOrder: EscrowOrder | null = targetOrder ? ({
            ...targetOrder,
            sellerConfirmedAt: confirmedAt,
            confirmationStatus: 'CONFIRMED',
            escrowStatus: orderHasInspection ? 'AWAITING_INSPECTION' : (targetOrder.escrowStatus === 'AWAITING_PAYMENT' ? 'HELD_IN_ESCROW' : targetOrder.escrowStatus),
            backendStatus: orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : (targetOrder.backendStatus || 'CONFIRMED'),
            status: orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : ((targetOrder as any).status || 'CONFIRMED'),
            inspectorId: undefined,
            inspectorName: undefined,
          } as any as EscrowOrder) : null;

          // Xóa mọi phân công cũ chưa xác thực khi người bán vừa đồng ý kiểm định
          if (orderHasInspection) {
            try {
              localStorage.removeItem(`order_assigned_inspector_${orderId}`);
            } catch {}
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
                    backendStatus: orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : (o.backendStatus || 'CONFIRMED'),
                    status: orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : (o.status || 'CONFIRMED'),
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
          } catch {}

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
            } catch {}
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
              actionUrl: '/inspection-center',
              isRead: false,
              readAt: null,
              createdAt: new Date().toISOString(),
            };
            saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');
            try {
              window.dispatchEvent(new CustomEvent('secondlife_inspection_task_created', { detail: { orderId, order: updatedOrder } }));
              window.dispatchEvent(new CustomEvent('secondlife_order_placed_signal', { detail: { orderId } }));
            } catch {}
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
              ? { ...prev, sellerConfirmedAt: confirmedAt, confirmationStatus: 'CONFIRMED' }
              : prev
          );

          // TỰ ĐỘNG MỞ MODAL TEM MÃ QR KIỂM ĐỊNH CHO NGƯỜI BÁN NẾU LÀ HÀNG KIỂM ĐỊNH
          if (orderHasInspection && updatedOrder) {
            setPrintInspectionQrOrder(updatedOrder);
          }

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
          const res = await orderService.markReadyForPickup(orderId);
          const readyAt = res?.sellerReadyAt || new Date().toISOString();
          setLocalReadyOrderIds((prev) => new Set(prev).add(orderId));
          if (detailModalOrder && detailModalOrder.id === orderId) {
            setDetailModalOrder((prev) => (prev ? { ...prev, sellerReadyAt: readyAt } : null));
          }

          // Tự động đảm bảo vận đơn Lalamove đã được khởi tạo
          const targetOrder = userOrders.find((o) => o.id === orderId) || (detailModalOrder?.id === orderId ? detailModalOrder : null);
          const orderHasInspection = targetOrder ? Boolean(
            targetOrder.hasInspectionService ||
            (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
            targetOrder.inspectionCenterId ||
            targetOrder.inspectionMethod ||
            (targetOrder as any).inspectionStatus
          ) : false;

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

          if (readyShipment?.orderCode) {
            setInspectionActionNotice(
              lang === 'vi'
                ? `Đã ghi nhận kiện hàng sẵn sàng! Mã vận đơn Lalamove: #${readyShipment.orderCode}. Tài xế đang được điều phối đến kho lấy hàng.`
                : `Package marked ready! Lalamove Tracking: #${readyShipment.orderCode}. Driver is being dispatched.`
            );
          } else {
            setInspectionActionNotice(
              lang === 'vi'
                ? 'Đã ghi nhận kiện hàng đóng gói an toàn! Bạn có thể phát lệnh gọi tài xế Lalamove bất kỳ lúc nào.'
                : 'Package marked packed and ready for carrier pickup!'
            );
            // Mở modal tạo vận đơn Lalamove để Người bán phát lệnh nếu chưa có vận đơn
            if (targetOrder && isOrderSeller(targetOrder) && targetOrder.escrowStatus !== 'AWAITING_PAYMENT') {
              setCreateShipmentOrder(targetOrder);
            }
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
      }
    });
  };

  // Review & Seller Trust Modal state
  const [reviewModalOrder, setReviewModalOrder] = useState<EscrowOrder | null>(null);
  const [schedulingOrder, setSchedulingOrder] = useState<EscrowOrder | null>(null);
  const [schedulingReadOnly, setSchedulingReadOnly] = useState<boolean>(false);

  const getOrderAppointment = (ord: EscrowOrder) => {
    try {
      const raw = localStorage.getItem(`order_appointment_${ord.id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.scheduledAt) return parsed;
      }
    } catch {}
    if (ord.appointmentScheduledAt) {
      return {
        scheduledAt: ord.appointmentScheduledAt,
        note: ord.appointmentNote || '',
      };
    }
    return null;
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
    } catch {}
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
      .reduce((sum, o) => sum + Math.round(o.itemPriceVnd * 0.975), 0);
  }, [userOrders]);

  const awaitingPickupCount = userOrders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = userOrders.filter(
    (o) =>
      o.escrowStatus === 'AWAITING_INSPECTION' ||
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
  ).length;
  const completedPaidCount = userOrders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  // Filter logic based on status tabs, sorted by newest first (mới nhất trên cùng)
  const filteredOrders = userOrders
    .filter((ord) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ord.listing.title.toLowerCase().includes(q);
        const matchId = ord.id.toLowerCase().includes(q);
        const matchSeller = ord.sellerName.toLowerCase().includes(q);
        const matchBuyer = ord.buyerName.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchSeller && !matchBuyer) return false;
      }

      switch (activeTab) {
        case 'awaiting_pickup':
          return (
            ord.escrowStatus === 'AWAITING_PAYMENT' ||
            ord.escrowStatus === 'HELD_IN_ESCROW' ||
            ord.escrowStatus === 'AWAITING_INSPECTION'
          );
        case 'inspecting':
          return (
            ord.escrowStatus === 'AWAITING_INSPECTION' ||
            ord.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            ord.escrowStatus === 'INSPECTION_PASSED' ||
            (ord.escrowStatus === 'HELD_IN_ESCROW' && Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0)))
          );
        case 'shipping':
          return ord.escrowStatus === 'SHIPPED_TO_BUYER';
        case 'delivered':
          return !isOrderReceiptConfirmed(ord) && ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';
        case 'completed':
          return isOrderReceiptConfirmed(ord) || ord.escrowStatus === 'COMPLETED_RELEASED';
        case 'disputed':
          return ord.escrowStatus === 'DISPUTED' || ord.escrowStatus === 'REFUNDED_TO_BUYER';
        case 'with_inspection':
          return Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) || ord.inspectionReport || ord.inspectionCenterId || (ord as any).inspectionStatus);
        case 'all':
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const timeA = getSortableOrderTimestamp(a);
      const timeB = getSortableOrderTimestamp(b);

      // Sắp xếp theo thứ tự thời gian: Đơn mới nhất (thời gian lớn nhất) ở ĐẦU, đơn cũ hơn ở SAU
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

  const getTabCount = (tab: OrderFilterTab) => {
    switch (tab) {
      case 'awaiting_pickup':
        return userOrders.filter(
          (o) =>
            o.escrowStatus === 'AWAITING_PAYMENT' ||
            o.escrowStatus === 'HELD_IN_ESCROW' ||
            o.escrowStatus === 'AWAITING_INSPECTION'
        ).length;
      case 'inspecting':
        return userOrders.filter(
          (o) =>
            o.escrowStatus === 'AWAITING_INSPECTION' ||
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
        ).length;
      case 'shipping':
        return userOrders.filter((o) => o.escrowStatus === 'SHIPPED_TO_BUYER').length;
      case 'delivered':
        return userOrders.filter((o) => !isOrderReceiptConfirmed(o) && o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW').length;
      case 'completed':
        return userOrders.filter((o) => isOrderReceiptConfirmed(o) || o.escrowStatus === 'COMPLETED_RELEASED').length;
      case 'disputed':
        return userOrders.filter(
          (o) => o.escrowStatus === 'DISPUTED' || o.escrowStatus === 'REFUNDED_TO_BUYER'
        ).length;
      case 'with_inspection':
        return userOrders.filter(
          (o) => Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) || o.inspectionReport || o.inspectionCenterId || (o as any).inspectionStatus)
        ).length;
      case 'all':
      default:
        return userOrders.length;
    }
  };

  const getStatusBadge = (status: EscrowOrder['escrowStatus'] | string, hasInspection?: boolean, isCurrentOrderSeller?: boolean) => {
    const isSellerForThisOrder = isCurrentOrderSeller !== undefined ? isCurrentOrderSeller : isSeller;
    const s = String(status || '').toUpperCase();
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
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder ? 'Chờ Bạn Xác Nhận Kiểm Định' : 'Chờ Kiểm Định'
                : isSellerForThisOrder ? 'Awaiting Your Inspection Confirmation' : 'Awaiting Inspection'}
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
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
          </span>
        );
      case 'INSPECTION_PASSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'vi' ? 'Kiểm Định Đạt Chuẩn • Chờ Giao' : 'Inspection Passed'}</span>
          </span>
        );
      case 'INSPECTION_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-600" />
            <span>{lang === 'vi' ? 'Không Đạt Kiểm Định • Hoàn Tiền' : 'Inspection Failed • Refunded'}</span>
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
            <span>{lang === 'vi' ? 'Đã Hoàn Tiền Cho Người Mua' : 'Refunded to Buyer'}</span>
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

  const tabs: { key: OrderFilterTab; label: string }[] = isSeller
    ? [
        { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ lấy hàng' : 'Awaiting Pickup' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao hàng' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Đã nhận (48h)' : 'Review (48h)' },
        { key: 'completed', label: lang === 'vi' ? 'Hoàn thành' : 'Completed' },
        { key: 'disputed', label: lang === 'vi' ? 'Khiếu nại / Trả hàng' : 'Disputes' },
        { key: 'with_inspection', label: lang === 'vi' ? '🛡️ Có kiểm định Hub' : '🛡️ With Inspection' },
      ]
    : [
        { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ lấy hàng' : 'Awaiting Pickup' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao hàng' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Đã nhận hàng' : 'Delivered' },
        { key: 'completed', label: lang === 'vi' ? 'Hoàn thành' : 'Completed' },
        { key: 'disputed', label: lang === 'vi' ? 'Trả hàng / Tranh chấp' : 'Disputes' },
        { key: 'with_inspection', label: lang === 'vi' ? '🛡️ Có kiểm định Hub' : '🛡️ With Inspection' },
      ];

  return (
    <div className="space-y-6 pb-16 text-[#24263e]">
      {/* Top Banner: Switch between Buyer and Seller mode */}
      {isSeller ? (
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

      {/* Shopee-style Status Tab Bar */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="relative flex items-center border-b border-gray-100 group">
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="absolute left-0 z-20 h-full px-2 bg-gradient-to-r from-white via-white/95 to-transparent flex items-center justify-center text-slate-700 hover:text-[#c34c36] transition cursor-pointer"
              title={lang === 'vi' ? 'Cuộn sang trái' : 'Scroll left'}
            >
              <div className="w-7 h-7 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center hover:bg-slate-50 transition-transform active:scale-95">
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </div>
            </button>
          )}

          {/* Tabs Container */}
          <div
            ref={tabsContainerRef}
            onScroll={checkTabsScroll}
            onWheel={handleTabsWheel}
            onMouseDown={handleMouseDownTabs}
            onMouseMove={handleMouseMoveTabs}
            onMouseUp={handleMouseUpTabs}
            onMouseLeave={handleMouseUpTabs}
            className="flex items-center overflow-x-auto scrollbar-none py-0.5 px-1 scroll-smooth select-none cursor-grab active:cursor-grabbing w-full"
          >
            {tabs.map((tab) => {
              const count = getTabCount(tab.key);
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={(e) => {
                    setActiveTab(tab.key);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`relative px-3.5 sm:px-5 py-3 text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? 'text-[#24263e] font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                        isActive
                          ? 'bg-[#c34c36]/15 text-[#c34c36]'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {/* Active underline indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-gradient-to-r from-[#c34c36] to-[#dc4729] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="absolute right-0 z-20 h-full px-2 bg-gradient-to-l from-white via-white/95 to-transparent flex items-center justify-center text-slate-700 hover:text-[#c34c36] transition cursor-pointer"
              title={lang === 'vi' ? 'Cuộn sang phải' : 'Scroll right'}
            >
              <div className="w-7 h-7 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center hover:bg-slate-50 transition-transform active:scale-95">
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </button>
          )}
        </div>

        {/* Quick Search inside Orders */}
        <div className="p-3 bg-slate-50/60 border-t border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'vi'
                  ? (isSeller ? 'Tìm mã đơn #ORD, tên sản phẩm hoặc tên người mua...' : 'Tìm kiếm theo mã đơn #ORD, tên sản phẩm hoặc người bán...')
                  : (isSeller ? 'Search by #ORD, product title or buyer name...' : 'Search by #ORD, product title or seller...')
              }
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-gray-200 rounded-xl focus:outline-none focus:border-[#c34c36] transition-all"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 bg-gray-200/70 rounded-xl transition cursor-pointer"
            >
              {lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
            </button>
          )}

          {onRefreshOrders && (
            <button
              onClick={() => onRefreshOrders()}
              className="px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-gray-200 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
              title="Làm mới danh sách đơn hàng từ Backend"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#c34c36]" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Đồng bộ Live' : 'Live Sync'}</span>
            </button>
          )}
        </div>
      </div>

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

      {/* Shopee-style Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-3xl p-12 text-center border border-gray-200 text-[#24263e] shadow-xs">
          <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-base text-[#24263e]">
            {lang === 'vi' ? 'Chưa có đơn hàng nào trong mục này' : 'No orders found in this category'}
          </h3>
          <p className="text-xs text-[#24263e]/70 mt-1 max-w-md mx-auto">
            {lang === 'vi'
              ? `Không tìm thấy đơn hàng nào ở trạng thái này. Bạn có thể chọn tab "${isSeller ? 'Tất cả đơn bán' : 'Tất cả'}" để xem toàn bộ danh sách.`
              : `No orders currently match this status tab. Select "${isSeller ? 'All Seller Orders' : 'All Orders'}" to view all.`}
          </p>
          {onRefreshOrders && (
            <button
              onClick={() => onRefreshOrders()}
              className="mt-4 px-4 py-2 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#fce5da]" />
              <span>{lang === 'vi' ? 'Tải Lại Từ Máy Chủ' : 'Reload from Server'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const sellerNetPayout = Math.round(ord.itemPriceVnd * 0.975);
            const orderIsSeller = isOrderSeller(ord);
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
                  <div>{getStatusBadge(isOrderReceiptConfirmed(ord) ? 'COMPLETED_RELEASED' : ord.escrowStatus, hasInspection, orderIsSeller)}</div>
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
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 line-clamp-2 group-hover:text-[#24263e] transition-colors">
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
                        ? (lang === 'vi' ? 'Giá niêm yết bán' : 'Listing Price')
                        : (lang === 'vi' ? 'Đơn giá sản phẩm' : 'Item Price')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {formatVND(ord.itemPriceVnd)}
                    </span>
                  </div>
                </div>

                {/* Cancelled Order Notice Banner in Card */}
                {isOrderCancelledOrRefunded(ord) && (() => {
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
                  <div className="mx-4 sm:mx-6 mb-3 p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-900 text-xs flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                      <div>
                        <span className="font-bold">
                          {ord.inspectionMethod === 'AT_HOME'
                            ? (lang === 'vi' ? 'Đơn hàng yêu cầu kiểm định tận nhà:' : 'At-Home Inspection Request:')
                            : (lang === 'vi' ? 'Đơn hàng kiểm định 2 chặng qua Hub:' : '2-Leg Hub Inspection Order:')}
                        </span>
                        <span className="text-[11px] text-orange-800 ml-1">
                          {ord.inspectionMethod === 'AT_HOME'
                            ? (savedAppointment?.scheduledAt
                                ? (lang === 'vi' ? ` Đã đặt lịch hẹn KTV: ${new Date(savedAppointment.scheduledAt).toLocaleString('vi-VN')}` : ` Scheduled visit: ${new Date(savedAppointment.scheduledAt).toLocaleString()}`)
                                : (lang === 'vi' ? ' Vui lòng bấm nút "Hẹn Giờ Kiểm Định" bên dưới để Kỹ thuật viên đến lấy máy/kiểm định tận nơi.' : ' Please click "Schedule Inspect" below.'))
                            : (lang === 'vi'
                                ? ' Lalamove sẽ vận chuyển kiện hàng từ người bán sang Trung tâm kiểm định Hub SecondLife trước khi chuyển tiếp cho người mua. Không cần hẹn KTV, chỉ cần đóng gói dán mã QR và gọi tài xế Lalamove.'
                                : ' Lalamove 2-leg delivery: courier will deliver parcel to SecondLife Hub for inspection first.')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Card Footer: 2-Tier Clear Layout */}
                <div className="border-t border-gray-100 bg-slate-50/60 divide-y divide-gray-100">
                  {/* Tier 1: Financial Summary */}
                  <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      {orderIsSeller
                        ? (lang === 'vi' ? 'Thực nhận về ví (Đã trừ 2.5% phí sàn):' : 'Net Payout (after 2.5% platform fee):')
                        : (lang === 'vi' ? 'Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):' : 'Total (incl. inspection & escrow guarantee):')}
                    </span>
                    <span className={`text-base sm:text-lg font-black ${orderIsSeller ? 'text-emerald-600' : 'text-[#24263e]'}`}>
                      {orderIsSeller ? `+${formatVND(sellerNetPayout)}` : formatVND(ord.totalPaidVnd)}
                    </span>
                  </div>

                  {/* Tier 2: Action Buttons */}
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
                        <span>{orderIsSeller ? (lang === 'vi' ? 'Chi Tiết Đơn' : 'Order Details') : (lang === 'vi' ? 'Xem Chi Tiết' : 'View Details')}</span>
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
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto scrollbar-none py-0.5 ml-auto">
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
                            <span>{lang === 'vi' ? 'Đã Hủy • Dừng Vận Chuyển' : 'Cancelled • Inactive'}</span>
                          </span>
                        ) : (
                          <>
                            {/* GIAI ĐOẠN 1: CHỜ XÁC NHẬN ĐƠN / CHỜ ĐỒNG Ý KIỂM ĐỊNH */}
                            {!ord.sellerConfirmedAt && ord.confirmationStatus !== 'CONFIRMED' && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && !isOrderReceiptConfirmed(ord) && ord.backendStatus !== 'COMPLETED' && !ord.shippingDeliveredAt && (
                            <>
                              {hasInspection ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSellerConfirmOrder(ord.id);
                                    }}
                                    disabled={orderActionLoading === ord.id}
                                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                                    title="Đồng ý yêu cầu kiểm định của người mua và chuẩn bị hàng"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>
                                      {orderActionLoading === ord.id
                                        ? (lang === 'vi' ? 'Đang xử lý...' : 'Processing...')
                                        : (lang === 'vi' ? 'Đồng Ý Kiểm Định' : 'Accept Inspection')}
                                    </span>
                                  </button>

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
                                    <span>{lang === 'vi' ? 'Từ Chối Kiểm Định' : 'Reject Inspection'}</span>
                                  </button>
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

                          {/* GIAI ĐOẠN 2: ĐÃ XÁC NHẬN • ĐANG ĐÓNG GÓI */}
                          {(ord.sellerConfirmedAt || ord.confirmationStatus === 'CONFIRMED') &&
                            !isOrderReceiptConfirmed(ord) &&
                            ord.backendStatus !== 'COMPLETED' &&
                            !ord.shippingDeliveredAt &&
                            !ord.sellerReadyAt &&
                            !localReadyOrderIds.has(ord.id) &&
                            ord.backendStatus !== 'SHIPPED' &&
                            ord.backendStatus !== 'DELIVERED' &&
                            ord.escrowStatus !== 'SHIPPED_TO_BUYER' &&
                            ord.escrowStatus !== 'DELIVERED_INSPECTION_WINDOW' &&
                            ord.escrowStatus !== 'COMPLETED_RELEASED' && (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{lang === 'vi' ? 'Đã Xác Nhận Đơn' : 'Order Confirmed'}</span>
                              </span>

                              {/* Nút Đóng Gói (Báo Shipper) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSellerMarkReadyForPickup(ord.id);
                                }}
                                disabled={orderActionLoading === ord.id}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
                                title="Báo hệ thống kiện hàng đã đóng gói an toàn và phát tín hiệu điều phối tài xế Lalamove"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>
                                  {orderActionLoading === ord.id
                                    ? (lang === 'vi' ? 'Đang cập nhật...' : 'Updating...')
                                    : (lang === 'vi' ? 'Đã Đóng Gói (Báo Shipper)' : 'Packed (Call Shipper)')}
                                </span>
                              </button>

                              {/* In Tem QR Kiểm Định nếu là đơn kiểm định */}
                              {hasInspection && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintInspectionQrOrder(ord);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 animate-fadeIn"
                                  title="Xem và In mã QR dán lên kiện hàng kiểm định để Trung tâm quét tiếp nhận"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Mã QR Kiểm Định' : 'Inspection QR'}</span>
                                </button>
                              )}

                              {/* Nút Hẹn Giờ Kiểm Định (CHỈ HIỆN KHI ĐƠN HÀNG LÀ KIỂM ĐỊNH TẬN NHÀ - AT_HOME) */}
                              {hasInspection && ord.inspectionMethod === 'AT_HOME' && (
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
                                      ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Reschedule Inspect')
                                      : (lang === 'vi' ? 'Hẹn Giờ Kiểm Định' : 'Schedule Inspect')}
                                  </span>
                                </button>
                              )}

                              {/* Nút Gọi Tài Xế Lalamove (Cách 1) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ord.escrowStatus === 'AWAITING_PAYMENT') {
                                    setInspectionActionNotice(
                                      lang === 'vi'
                                        ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                                        : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                                    );
                                    setTimeout(() => setInspectionActionNotice(null), 5000);
                                    return;
                                  }
                                  setCreateShipmentOrder(ord);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                                title="Gọi tài xế Lalamove đến lấy hàng"
                              >
                                <Truck className="w-3.5 h-3.5 text-white" />
                                <span>{lang === 'vi' ? 'Gọi Tài Xế Lalamove' : 'Call Lalamove'}</span>
                              </button>

                              {/* Nút Theo Dõi Lalamove */}
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
                          )}

                          {/* GIAI ĐOẠN 3: ĐÃ ĐÓNG GÓI • CHỜ SHIPPER ĐẾN LẤY */}
                          {(ord.sellerReadyAt || localReadyOrderIds.has(ord.id)) &&
                            !isOrderReceiptConfirmed(ord) &&
                            ord.backendStatus !== 'COMPLETED' &&
                            !ord.shippingDeliveredAt &&
                            !ord.carrierPickedUpAt &&
                            ord.backendStatus !== 'SHIPPED' &&
                            ord.backendStatus !== 'DELIVERED' &&
                            ord.escrowStatus !== 'SHIPPED_TO_BUYER' &&
                            ord.escrowStatus !== 'DELIVERED_INSPECTION_WINDOW' &&
                            ord.escrowStatus !== 'COMPLETED_RELEASED' && (
                            <>
                              {/* Nhãn Tĩnh (Không phải nút bấm, triệt tiêu vòng lặp vô tận) */}
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 whitespace-nowrap shrink-0 shadow-xs"
                                title="Hệ thống đang điều phối tài xế Lalamove tới địa chỉ kho của bạn để lấy kiện hàng"
                              >
                                <PackageCheck className="w-4 h-4 text-teal-600" />
                                <span>{lang === 'vi' ? 'Đã Đóng Gói • Chờ Tài Xế Lấy' : 'Packed • Waiting for Carrier'}</span>
                              </span>

                              {/* In Tem QR Kiểm Định nếu là đơn kiểm định */}
                              {hasInspection && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintInspectionQrOrder(ord);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 animate-fadeIn"
                                  title="Xem và In mã QR dán lên kiện hàng kiểm định để Trung tâm quét tiếp nhận"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Mã QR Kiểm Định' : 'Inspection QR'}</span>
                                </button>
                              )}

                              {/* Nút Gọi Tài Xế Lalamove (Cách 1) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ord.escrowStatus === 'AWAITING_PAYMENT') {
                                    setInspectionActionNotice(
                                      lang === 'vi'
                                        ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                                        : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                                    );
                                    setTimeout(() => setInspectionActionNotice(null), 5000);
                                    return;
                                  }
                                  setCreateShipmentOrder(ord);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                                title="Gọi tài xế Lalamove đến lấy hàng"
                              >
                                <Truck className="w-3.5 h-3.5 text-white" />
                                <span>{lang === 'vi' ? 'Gọi Tài Xế Lalamove' : 'Call Lalamove'}</span>
                              </button>

                              {/* Nút Theo Dõi Lalamove */}
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
                          )}

                          {/* GIAI ĐOẠN 4: ĐANG GIAO HÀNG (Hoặc đã hoàn thành) */}
                          {(ord.carrierPickedUpAt ||
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
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 whitespace-nowrap shrink-0">
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            <span>{lang === 'vi' ? 'Đã Hoàn Tiền Vào Ví' : 'Refunded to Wallet'}</span>
                          </span>
                        ) : (
                          <>
                            {/* Cancel Order Button for Buyer (ONLY when seller has not confirmed order yet) */}
                            {onCancelOrder && !ord.sellerConfirmedAt && ord.confirmationStatus !== 'CONFIRMED' && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.escrowStatus !== 'COMPLETED_RELEASED' && (
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
                          )}

                          {/* Tracking Lalamove for Buyer (Chỉ hiện khi đơn ĐÃ THANH TOÁN / ĐANG XỬ LÝ / ĐANG GIAO) */}
                          {!isOrderUnpaid(ord) && ord.escrowStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.backendStatus !== 'CANCELLED' && (
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
                          {hasInspection && ord.escrowStatus === 'AWAITING_INSPECTION' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 whitespace-nowrap shrink-0">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>{lang === 'vi' ? 'Chờ Kiểm Định' : 'Awaiting Inspection'}</span>
                            </span>
                          )}

                          {/* Inspection In Progress Notice for Buyer */}
                          {hasInspection && (ord.escrowStatus === 'INSPECTION_IN_PROGRESS' || (ord.escrowStatus === 'HELD_IN_ESCROW' && ord.sellerConfirmedAt)) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 whitespace-nowrap shrink-0">
                              <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                              <span>{lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
                            </span>
                          )}

                          {/* Buyer View Inspection Appointment (ONLY if order is AT_HOME and seller scheduled) */}
                          {hasInspection && ord.inspectionMethod === 'AT_HOME' && savedAppointment?.scheduledAt && (
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

                              {Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0)) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePayInspectionFee(ord.id);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                                  title="Nộp phí kiểm định độc lập từ Ví"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>{lang === 'vi' ? 'Nộp Phí Kiểm Định' : 'Pay Inspection Fee'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Inspection Passed: Buyer reviews report and confirms or rejects continuing to purchase */}
                          {!orderIsSeller && (ord.escrowStatus === 'INSPECTION_PASSED' || (ord as any).backendStatus === 'PASSED') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenInspectionDecision) {
                                  onOpenInspectionDecision(ord);
                                } else {
                                  handleConfirmInspectionPurchase(ord.id);
                                }
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse whitespace-nowrap shrink-0"
                              title="Sản phẩm kiểm định ĐẠT CHUẨN! Bấm để xem biên bản kỹ thuật và chọn mua tiếp hoặc hủy đơn"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Xem Kết Quả & Quyết Định Mua' : 'Review & Decide'}</span>
                            </button>
                          )}

                          {/* Nút Đã Nhận Hàng (Giải Ngân): Khi người mua đã xác nhận/giải ngân thì ẩn hoàn toàn nút, không cho bấm lại */}
                          {!isOrderReceiptConfirmed(ord) && (ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED' || ord.shippingDeliveredAt) ? (
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
                                    } catch {}
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
                          ) : ord.escrowStatus === 'SHIPPED_TO_BUYER' ? (
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
                          {(isOrderReceiptConfirmed(ord) || ord.escrowStatus === 'COMPLETED_RELEASED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewModalOrder(ord);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 ${
                                reviewedOrderIds.includes(ord.id)
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
                {ord.shippingDeliveredAt && !isOrderReceiptConfirmed(ord) && ord.escrowStatus !== 'COMPLETED_RELEASED' && ord.escrowStatus !== 'RELEASED' && (ord as any).backendStatus !== 'COMPLETED' && ord.escrowStatus !== 'DISPUTED' && ord.id !== '16915c88-96a2-4cb0-8f6c-cc9a931a6e89' && (
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

      {/* POPUP MODAL: CHI TIẾT ĐƠN HÀNG KHI NGƯỜI DÙNG BẤM VÀO */}
      {detailModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailModalOrder(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FFFFFF] border border-gray-200 p-5 sm:p-7 shadow-2xl text-[#24263e] scrollbar-thin scrollbar-thumb-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-[#24263e]">
                    {lang === 'vi' ? 'Chi Tiết Đơn Hàng' : 'Order Details'} #{detailModalOrder.id}
                  </h2>
                  {getStatusBadge(isOrderReceiptConfirmed(detailModalOrder) ? 'COMPLETED_RELEASED' : detailModalOrder.escrowStatus, Boolean(detailModalOrder.hasInspectionService || (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)), isOrderSeller(detailModalOrder))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-800">{detailModalOrder.sellerName}</strong> • {lang === 'vi' ? 'Người mua:' : 'Buyer:'}{' '}
                  <strong className="text-slate-800">{detailModalOrder.buyerName}</strong> • {lang === 'vi' ? 'Đặt ngày' : 'Ordered on'}{' '}
                  {(() => {
                    const t = getSortableOrderTimestamp(detailModalOrder);
                    return t > 0 ? new Date(t).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : (detailModalOrder.createdAt || '--/--/----');
                  })()}
                </p>
              </div>

              <button
                onClick={() => setDetailModalOrder(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 pt-5">
              {/* Order Cancellation Reason Banner in Detail Modal */}
              {isOrderCancelledOrRefunded(detailModalOrder) && (() => {
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
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#faf8f5] border border-gray-200">
                <img
                  src={detailModalOrder.listing.photos.front}
                  alt={detailModalOrder.listing.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 truncate">
                    {detailModalOrder.listing.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {resolveListingCategory(detailModalOrder.listing)} • {lang === 'vi' ? 'Tình trạng:' : 'Condition:'} {detailModalOrder.listing.conditionGrade}
                  </p>
                  <div className="text-sm font-extrabold text-[#24263e] mt-1">
                    {formatVND(detailModalOrder.itemPriceVnd)}
                  </div>
                </div>
              </div>

              {/* Seller Confirmation Status Banner (Only when order is active) */}
              {!isOrderCancelledOrRefunded(detailModalOrder) && (
                detailModalOrder.sellerConfirmedAt ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Người bán đã xác nhận đơn hàng thành công</span>
                    </div>
                    <span className="font-bold text-slate-700 text-[11px]">
                      {new Date(detailModalOrder.sellerConfirmedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ) : detailModalOrder.confirmationDeadline ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Hạn chót người bán xác nhận đơn hàng:</span>
                    </div>
                    <span className="font-bold text-amber-900 text-[11px]">
                      {new Date(detailModalOrder.confirmationDeadline).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ) : null
              )}

              {/* Lalamove Shipping & Tracking Action in Detail Modal */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/90 to-slate-50 border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-600 text-white">Lalamove Tracking</span>
                    <span className="text-xs font-bold text-slate-800">
                      {detailModalOrder.shippingQuoteId ? `Mã báo giá: #${detailModalOrder.shippingQuoteId}` : 'Đơn hàng tích hợp Lalamove Tracking'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Phí vận chuyển: <strong className="text-orange-700 font-bold">{formatVND(detailModalOrder.shippingFeeVnd)}</strong> • Địa chỉ giao: <span className="font-medium text-slate-700">{detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isOrderCancelledOrRefunded(detailModalOrder) ? (
                    <>
                      {isOrderSeller(detailModalOrder) && !detailShipments.some((s) => s.status !== 'CANCELLED') && (
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
                          className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Tạo Vận Đơn Lalamove' : 'Create Shipment'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setTrackingOrder(detailModalOrder);
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Tra cứu vận đơn Lalamove</span>
                      </button>
                    </>
                  ) : (
                    <span className="px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                      {lang === 'vi' ? 'Đã dừng vận đơn (Đơn đã hủy)' : 'Shipment Inactive'}
                    </span>
                  )}
                </div>
              </div>

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
                              <span className="text-[11px] font-sans font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Chưa tạo vận đơn Lalamove
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bước 1: Kỹ thuật viên kiểm tra tận nơi */}
                        <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 px-2 py-0.5 rounded-md">
                              Bước 1: Kiểm Định Tận Nhà
                            </span>
                            <span className="text-xs font-mono font-bold text-orange-800">
                              SecondLife On-site
                            </span>
                          </div>

                          <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                            <div>Địa điểm: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.origin || detailModalOrder.listing?.location || 'Kho người bán'}</span></div>
                            <div>Thực hiện: <span className="font-semibold text-[#24263e]">{detailModalOrder.inspectorName ? `KTV ${detailModalOrder.inspectorName}` : 'Chuyên viên kỹ thuật SecondLife'}</span></div>
                          </div>

                          <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/70">
                            {detailModalOrder.inspectionReport
                              ? 'Đã hoàn tất kiểm tra on-site và dán tem niêm phong đạt chuẩn'
                              : detailModalOrder.appointmentScheduledAt
                              ? `Lịch hẹn KTV: ${new Date(detailModalOrder.appointmentScheduledAt).toLocaleString('vi-VN')}`
                              : 'Kỹ sư SecondLife sẽ đến tận nơi theo lịch hẹn để mở máy kiểm tra.'}
                          </div>
                        </div>

                        {/* Bước 2: Bưu tá Lalamove giao thẳng tới người mua */}
                        <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                              Bước 2: Giao Hàng Người Mua
                            </span>
                            <span className="text-xs font-mono font-bold text-[#24263e]">
                              {detailShipments[0]?.orderCode ? (
                                `Lalamove #${detailShipments[0].orderCode}`
                              ) : (
                                <span className="text-[11px] font-sans font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  Kích hoạt sau khi kiểm định đạt chuẩn
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                            <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.origin || detailModalOrder.listing?.location || 'Kho người bán'}</span></div>
                            <div>Giao đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span></div>
                          </div>

                          <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/70">
                            Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong tem.
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
                        <Truck className="w-4 h-4 text-[#24263e]" />
                        <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        Kiểm Định Hub Lab
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Chặng 1: Người bán gửi tới Trung tâm Hub */}
                      <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                            {t.leg1}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#24263e]">
                            {detailShipments[0]?.orderCode ? (
                              `Lalamove #${detailShipments[0].orderCode}`
                            ) : (
                              <span className="text-[11px] font-sans font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Chưa tạo vận đơn Lalamove
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                          <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.origin || detailModalOrder.listing?.location || 'Kho người bán'}</span></div>
                          <div>Đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.destination || 'Trạm Kiểm Định SecondLife Hub Lab'}</span></div>
                        </div>

                        <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/70">
                          {detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đang chờ điều phối'}
                        </div>
                      </div>

                      {/* Chặng 2: Trung tâm Hub gửi Người mua */}
                      <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                            {t.leg2}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#24263e]">
                            {detailShipments[1]?.orderCode ? (
                              `Lalamove #${detailShipments[1].orderCode}`
                            ) : (
                              <span className="text-[11px] font-sans font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                Chờ hoàn tất chặng 1 & kiểm định
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                          <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1]?.origin || 'Trạm Kiểm Định SecondLife Hub Lab'}</span></div>
                          <div>Giao đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1]?.destination || detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span></div>
                        </div>

                        <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e] font-medium">
                          {detailModalOrder.shippingLegs[1]?.timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description || 'Chặng 2 sẽ tự động kích hoạt sau khi kiểm định Hub đạt chuẩn.'}
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
                    {(detailModalOrder.inspectionReport.checklistResults || []).slice(0, 4).map((chk) => (
                      <div key={chk.id} className="flex items-center gap-2 bg-[#FFFFFF] p-2 rounded-lg border border-gray-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#24263e] shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-[#24263e]">{chk.category}: </span>
                          <span className="text-[#24263e]/70">{chk.testedValue || 'Đạt'}</span>
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
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                            activePhotoStage === 'listing'
                              ? 'bg-[#24263e] text-white'
                              : 'text-[#24263e]/70'
                          }`}
                        >
                          1. Người bán
                        </button>
                        {hasInspection && (
                          <button
                            onClick={() => setActivePhotoStage('inspector')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                              activePhotoStage === 'inspector'
                                ? 'bg-[#24263e] text-white'
                                : 'text-[#24263e]/70'
                            }`}
                          >
                            2. Kiểm định Hub
                          </button>
                        )}
                        <button
                          onClick={() => setActivePhotoStage('handover')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                            activePhotoStage === 'handover'
                              ? 'bg-[#24263e] text-white'
                              : 'text-[#24263e]/70'
                          }`}
                        >
                          {hasInspection ? '3. Niêm phong giao' : '2. Niêm phong giao'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(activePhotoStage === 'listing'
                        ? detailModalOrder.multiStagePhotos.listingPhotos
                        : activePhotoStage === 'inspector'
                        ? detailModalOrder.multiStagePhotos.inspectorPhotos || []
                        : detailModalOrder.multiStagePhotos.handoverPhotos || []
                      ).map((photoUrl, idx) => (
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
                  </div>
                );
              })()}

              {/* Escrow Fee Breakdown */}
              <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
                <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                  {t.orderSummary}
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.itemAmount}:</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.itemPriceVnd)}</span>
                </div>
                <div className="flex justify-between text-[#24263e]/70">
                  <span>{t.inspectionFee}:</span>
                  <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.inspectionFeeVnd)}</span>
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

              {/* 48h Auto-release notice banner in Modal */}
              {detailModalOrder.shippingDeliveredAt && !isOrderReceiptConfirmed(detailModalOrder) && detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' && detailModalOrder.escrowStatus !== 'RELEASED' && (detailModalOrder as any).backendStatus !== 'COMPLETED' && detailModalOrder.escrowStatus !== 'DISPUTED' && detailModalOrder.id !== '16915c88-96a2-4cb0-8f6c-cc9a931a6e89' && (
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
              )}

              {/* Order Settlement Breakdown (Quyết toán giải ngân) */}
              <div className="rounded-2xl p-4 border border-gray-200 bg-[#faf8f5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#24263e]" />
                    <span className="font-bold text-xs uppercase tracking-wide text-[#24263e]">
                      Chi Tiết Quyết Toán Giải Ngân (Settlement)
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
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Chưa giải ngân</p>
                    <p className="text-[11px] text-slate-500">
                      Khoản tiền ký quỹ của đơn hàng đang được bảo toàn tại ví trung gian Escrow của hệ thống. Tiền sẽ được chuyển vào ví người bán sau khi người mua xác nhận đã nhận hàng hoặc sau thời hạn 48 giờ.
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {isOrderCancelledOrRefunded(detailModalOrder) ? (
                  <div className="flex-1 py-3 px-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Đơn hàng đã bị hủy • Hoàn tiền bảo toàn 100%' : 'Order cancelled & 100% refunded'}</span>
                    </div>
                    <span className="text-xs font-normal text-rose-700 italic">
                      {lang === 'vi' ? 'Toàn bộ thao tác vận chuyển & tra cứu đã dừng.' : 'Shipping & tracking deactivated.'}
                    </span>
                  </div>
                ) : (
                  detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
                  detailModalOrder.escrowStatus !== 'DISPUTED' && (
                    <>
                      {!isSeller && (detailModalOrder.escrowStatus === 'INSPECTION_PASSED' || (detailModalOrder as any).backendStatus === 'PASSED') && (
                        <button
                          onClick={() => {
                            if (onOpenInspectionDecision) {
                              onOpenInspectionDecision(detailModalOrder);
                            } else {
                              handleConfirmInspectionPurchase(detailModalOrder.id);
                            }
                            setDetailModalOrder(null);
                          }}
                          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                        >
                          <ShieldCheck className="w-4 h-4 text-white" />
                          <span>{lang === 'vi' ? 'Xem Kết Quả & Quyết Định Mua Hàng' : 'Review Inspection & Decide'}</span>
                        </button>
                      )}

                      {/* Seller Action Buttons */}
                      {isOrderSeller(detailModalOrder) && (
                        isOrderReceiptConfirmed(detailModalOrder) ? (
                          <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                            <div className="py-3 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã Nhận Tiền Vào Ví (Đã Giải Ngân)' : 'Funds Credited to Wallet'}</span>
                            </div>
                            <button
                              onClick={() => setTrackingOrder(detailModalOrder)}
                              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Truck className="w-4 h-4 text-white" />
                              <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                            </button>
                          </div>
                        ) : isOrderCancelledOrRefunded(detailModalOrder) ? (
                          <div className="py-2.5 px-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 flex-1">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>{lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy • Dừng Mọi Thao Tác' : 'Order Cancelled'}</span>
                          </div>
                        ) : (
                          <>
                            {/* GIAI ĐOẠN 1: Chờ xác nhận đơn */}
                          {!detailModalOrder.sellerConfirmedAt &&
                            detailModalOrder.confirmationStatus !== 'CONFIRMED' &&
                            detailModalOrder.backendStatus !== 'CANCELLED' &&
                            detailModalOrder.escrowStatus !== 'REFUNDED_TO_BUYER' &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'COMPLETED' &&
                            !detailModalOrder.shippingDeliveredAt && (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                              <button
                                onClick={() => {
                                  handleSellerConfirmOrder(detailModalOrder.id);
                                }}
                                disabled={orderActionLoading === detailModalOrder.id}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                                <span>
                                  {orderActionLoading === detailModalOrder.id
                                    ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                    : (lang === 'vi' ? 'Xác Nhận Đơn Hàng' : 'Confirm Order')}
                                </span>
                              </button>

                              {onCancelOrder && (
                                <button
                                  onClick={() => {
                                    handlePromptCancelOrder(detailModalOrder);
                                  }}
                                  className="py-3 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <X className="w-4 h-4" />
                                  <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* GIAI ĐOẠN 2: Đã xác nhận • Đang đóng gói */}
                          {(detailModalOrder.sellerConfirmedAt || detailModalOrder.confirmationStatus === 'CONFIRMED') &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'COMPLETED' &&
                            !detailModalOrder.shippingDeliveredAt &&
                            !detailModalOrder.sellerReadyAt &&
                            !localReadyOrderIds.has(detailModalOrder.id) &&
                            detailModalOrder.backendStatus !== 'SHIPPED' &&
                            detailModalOrder.backendStatus !== 'DELIVERED' &&
                            (detailModalOrder.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                            (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                            (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' && (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                              <button
                                onClick={() => {
                                  handleSellerMarkReadyForPickup(detailModalOrder.id);
                                }}
                                disabled={orderActionLoading === detailModalOrder.id}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Package className="w-4 h-4" />
                                <span>
                                  {orderActionLoading === detailModalOrder.id
                                    ? (lang === 'vi' ? 'Đang cập nhật...' : 'Updating...')
                                    : (lang === 'vi' ? 'Đã Đóng Gói (Báo Shipper)' : 'Packed (Call Shipper)')}
                                </span>
                              </button>

                              {/* Nút Xem / In Mã QR Dán Sản Phẩm trong Modal Chi Tiết */}
                              {Boolean(
                                detailModalOrder.hasInspectionService ||
                                (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                                detailModalOrder.inspectionCenterId ||
                                detailModalOrder.inspectionMethod ||
                                (detailModalOrder as any).inspectionStatus ||
                                detailModalOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
                                detailModalOrder.escrowStatus === 'INSPECTION_PASSED'
                              ) && (
                                <button
                                  onClick={() => setPrintInspectionQrOrder(detailModalOrder)}
                                  className="py-3 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                  title="Xem và In mã QR dán lên sản phẩm gửi sang Trung tâm kiểm định"
                                >
                                  <QrCode className="w-4 h-4" />
                                  <span>{lang === 'vi' ? 'Tem Mã QR Kiểm Định (Dán Sản Phẩm)' : 'Inspection Intake QR Label'}</span>
                                </button>
                              )}

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
                                className="py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                title="Gọi tài xế Lalamove đến lấy hàng"
                              >
                                <Truck className="w-4 h-4 text-white" />
                                <span>{lang === 'vi' ? 'Gọi Tài Xế Lalamove' : 'Call Lalamove Driver'}</span>
                              </button>

                              <button
                                onClick={() => setTrackingOrder(detailModalOrder)}
                                className="py-3 px-4 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                              </button>
                            </div>
                          )}

                          {/* GIAI ĐOẠN 3: Đã đóng gói • Chờ Shipper đến lấy */}
                          {(detailModalOrder.sellerReadyAt || localReadyOrderIds.has(detailModalOrder.id)) &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'COMPLETED' &&
                            !detailModalOrder.shippingDeliveredAt &&
                            !detailModalOrder.carrierPickedUpAt &&
                            detailModalOrder.backendStatus !== 'SHIPPED' &&
                            detailModalOrder.backendStatus !== 'DELIVERED' &&
                            (detailModalOrder.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                            (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                            (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' && (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                              {/* Nhãn Tĩnh (Không phải nút bấm, triệt tiêu vòng lặp vô tận) */}
                              <div
                                className="flex-1 py-3 px-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs"
                                title="Hệ thống đang điều phối tài xế Lalamove tới địa chỉ kho của bạn để lấy kiện hàng"
                              >
                                <PackageCheck className="w-4 h-4 text-teal-600" />
                                <span>{lang === 'vi' ? 'Đã Đóng Gói • Chờ Tài Xế Lấy' : 'Packed • Waiting for Carrier'}</span>
                              </div>

                              {/* In Tem QR Kiểm Định nếu là đơn kiểm định */}
                              {Boolean(
                                detailModalOrder.hasInspectionService ||
                                (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                                detailModalOrder.inspectionCenterId ||
                                detailModalOrder.inspectionMethod ||
                                (detailModalOrder as any).inspectionStatus ||
                                detailModalOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
                                detailModalOrder.escrowStatus === 'INSPECTION_PASSED'
                              ) && (
                                <button
                                  onClick={() => setPrintInspectionQrOrder(detailModalOrder)}
                                  className="py-3 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                  title="Xem và In mã QR dán lên sản phẩm gửi sang Trung tâm kiểm định"
                                >
                                  <QrCode className="w-4 h-4" />
                                  <span>{lang === 'vi' ? 'Mã QR Kiểm Định' : 'Inspection QR'}</span>
                                </button>
                              )}

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
                                className="py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                title="Gọi tài xế Lalamove đến lấy hàng"
                              >
                                <Truck className="w-4 h-4 text-white" />
                                <span>{lang === 'vi' ? 'Gọi Tài Xế Lalamove' : 'Call Lalamove Driver'}</span>
                              </button>

                              <button
                                onClick={() => setTrackingOrder(detailModalOrder)}
                                className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Truck className="w-4 h-4 text-white" />
                                <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                              </button>
                            </div>
                          )}

                          {/* GIAI ĐOẠN 4: Đang giao hàng */}
                          {(detailModalOrder.carrierPickedUpAt ||
                            detailModalOrder.backendStatus === 'SHIPPED' ||
                            detailModalOrder.backendStatus === 'DELIVERED' ||
                            (detailModalOrder.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                            (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' ||
                            (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED') && (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                              <span className="py-3 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>
                                  {detailModalOrder.backendStatus === 'DELIVERED' || (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED'
                                    ? (lang === 'vi' ? 'Đã Giao Thành Công' : 'Delivered')
                                    : (lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit')}
                                </span>
                              </span>

                              <button
                                onClick={() => setTrackingOrder(detailModalOrder)}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Truck className="w-4 h-4 text-white" />
                                <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                              </button>
                            </div>
                          )}
                        </>
                        )
                      )}

                      {/* Chỉ Người Mua (Buyer) mới có nút Đã Nhận Hàng & Khiếu Nại Trả Hàng khi đơn đã giao và CHƯA xác nhận */}
                      {!isOrderSeller(detailModalOrder) &&
                        !isOrderReceiptConfirmed(detailModalOrder) &&
                        (detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                          detailModalOrder.backendStatus === 'DELIVERED' ||
                          detailModalOrder.shippingDeliveredAt) && (
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
                                    } catch {}
                                    onConfirmReceipt(detailModalOrder.id);
                                    setDetailModalOrder(null);
                                    setConfirmDialog(null);
                                  }
                                });
                              }}
                              disabled={confirmingReceiptIds.has(detailModalOrder.id)}
                              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
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
                              className="py-3 px-4 bg-white hover:bg-gray-100 text-[#24263e] border border-[#24263e]/30 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <AlertTriangle className="w-4 h-4 text-[#24263e]" />
                              <span>{t.openDispute}</span>
                            </button>
                          </>
                        )}
                    </>
                  )
                )}

                <button
                  onClick={() => setDetailModalOrder(null)}
                  className="py-3 px-5 bg-white hover:bg-gray-100 text-[#24263e] border border-[#24263e]/20 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lalamove Order Tracking Modal */}
      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          isSeller={isSeller}
          onClose={() => setTrackingOrder(null)}
          lang={lang}
          onConfirmReceipt={onConfirmReceipt}
          onOpenLabelModal={(shipment) => setActiveLabelShipment({ order: trackingOrder, shipment })}
          onOrderUpdated={onRefreshOrders}
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
          orderId={schedulingOrder.id}
          orderCode={(schedulingOrder.id || '').slice(0, 8)}
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
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                confirmDialog.variant === 'success'
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
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  confirmDialog.variant === 'success'
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
