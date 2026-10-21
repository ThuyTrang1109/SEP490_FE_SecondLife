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
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { ScheduleAppointmentModal } from '../components/modals/ScheduleAppointmentModal';
import { ShipmentBackend, OrderSettlementDTO } from '../types';
import { orderService } from '../services/orderService';
import { inspectorService } from '../services/inspectorService';
import { UserReportModal } from '../components/modals/UserReportModal';
import { InspectionProductQRModal } from '../components/modals/InspectionProductQRModal';
import { VietQrEscrowModal } from '../components/modals/VietQrEscrowModal';
import { dialogService } from '../utils/dialogService';
import { getSortableOrderTimestamp } from '../utils/orderUtils';

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
      if (ord.buyerId && String(ord.buyerId) === String(currentUser.id)) return false;
    }
    return userRole === 'seller';
  };

  const isSeller = userRole === 'seller' || orders.some((o) => isOrderSeller(o));

  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState<EscrowOrder | null>(null);
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('inspector');
  const [orderSettlement, setOrderSettlement] = useState<OrderSettlementDTO | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [settlementNotSettled, setSettlementNotSettled] = useState(false);

  React.useEffect(() => {
    if (detailModalOrder?.id) {
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

  // Lalamove Shipping Modals state
  const [trackingOrder, setTrackingOrder] = useState<EscrowOrder | null>(null);
  const [createShipmentOrder, setCreateShipmentOrder] = useState<EscrowOrder | null>(null);
  const [activeLabelShipment, setActiveLabelShipment] = useState<{ order: EscrowOrder; shipment: ShipmentBackend } | null>(null);
  const [certificateModalOrder, setCertificateModalOrder] = useState<EscrowOrder | null>(null);
  const [verifySealId, setVerifySealId] = useState<string>('');
  const [isVerifySealModalOpen, setIsVerifySealModalOpen] = useState(false);
  const [printSealOrder, setPrintSealOrder] = useState<EscrowOrder | null>(null);
  const [printInspectionQrOrder, setPrintInspectionQrOrder] = useState<EscrowOrder | null>(null);
  const [inspectionActionNotice, setInspectionActionNotice] = useState<string | null>(null);
  const [reportingOrder, setReportingOrder] = useState<EscrowOrder | null>(null);
  const [localReadyOrderIds, setLocalReadyOrderIds] = useState<Set<string>>(new Set());

  // VietQR Escrow Deposit Modal States
  const [bankPaymentOrder, setBankPaymentOrder] = useState<EscrowOrder | null>(null);
  const [bankPaymentInfo, setBankPaymentInfo] = useState<any | null>(null);
  const [loadingBankPaymentId, setLoadingBankPaymentId] = useState<string | null>(null);

  const handleOpenBankPaymentModal = async (ord: EscrowOrder) => {
    setLoadingBankPaymentId(ord.id);
    try {
      const payRes = await orderService.getOrderPayment(ord.id);
      setBankPaymentOrder(ord);
      setBankPaymentInfo(payRes);
    } catch (e) {
      console.warn('Could not fetch bank payment details:', e);
      if (ord.bankPaymentDetails) {
        setBankPaymentOrder(ord);
        setBankPaymentInfo(ord.bankPaymentDetails);
      }
    } finally {
      setLoadingBankPaymentId(null);
    }
  };

  const handleRespondInspection = async (orderId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      // Kiểm tra định dạng UUID (Backend yêu cầu @PathVariable UUID orderId)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

      if (!isUuid) {
        // Đơn hàng local/mock do đặt hàng offline hoặc fallback: cập nhật trực tiếp local state
        setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'chấp nhận' : 'từ chối'} đề xuất kiểm định thành công!`);
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
                  escrowStatus: action === 'ACCEPT' ? 'INSPECTION_IN_PROGRESS' : 'REFUNDED_TO_BUYER',
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
        sellerConsentZinLoss: true,
      });
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'chấp nhận' : 'từ chối'} đề xuất kiểm định thành công!`);
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      dialogService.error(err?.message || 'Không thể phản hồi yêu cầu kiểm định', 'Lỗi Kiểm Định');
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

  const handleSellerConfirmOrder = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId) || (detailModalOrder?.id === orderId ? detailModalOrder : null);
    const orderHasInspection = targetOrder ? Boolean(
      targetOrder.hasInspectionService ||
      (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
      targetOrder.inspectionCenterId ||
      targetOrder.inspectionMethod ||
      (targetOrder as any).inspectionStatus ||
      targetOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      targetOrder.escrowStatus === 'INSPECTION_PASSED'
    ) : false;

    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác Nhận Chuẩn Bị Đơn Hàng' : 'Confirm Order Preparation',
      message: lang === 'vi'
        ? (orderHasInspection
            ? 'Xác nhận đơn hàng có kiểm định chất lượng! Hệ thống sẽ tạo mã QR kiểm định để bạn dán lên sản phẩm gửi sang Trung tâm kiểm định.'
            : 'Xác nhận bạn chấp nhận chuẩn bị đơn hàng này cho người mua?')
        : 'Do you confirm preparing this order for the buyer?',
      subMessage: lang === 'vi'
        ? (orderHasInspection
            ? 'Sau khi xác nhận, vui lòng in hoặc dán mã QR kiểm định lên mặt ngoài kiện hàng. Kỹ thuật viên Hub sẽ quét mã QR này khi tiếp nhận sản phẩm.'
            : 'Sau khi xác nhận, người bán cam kết đóng gói sản phẩm cẩn thận theo quy chuẩn và chuẩn bị sẵn sàng để bưu tá / tài xế Lalamove đến lấy.')
        : 'After confirmation, you commit to packing the item safely for pickup.',
      confirmText: lang === 'vi' ? 'Xác Nhận Đơn' : 'Confirm Order',
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'primary',
      iconType: 'package',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          await orderService.confirmOrder(orderId);
          const confirmedAt = new Date().toISOString();
          const updatedOrder: EscrowOrder | null = targetOrder ? {
            ...targetOrder,
            sellerConfirmedAt: confirmedAt,
            confirmationStatus: 'CONFIRMED'
          } : null;

          setInspectionActionNotice(
            orderHasInspection
              ? (lang === 'vi' ? 'Đã xác nhận đơn hàng! Mã QR kiểm định dán sản phẩm đã sẵn sàng.' : 'Order confirmed! Inspection QR label is ready.')
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

          setTimeout(() => setInspectionActionNotice(null), 4000);
        } catch (err: any) {
          setInspectionActionNotice(err?.message || 'Không thể xác nhận đơn hàng');
          setTimeout(() => setInspectionActionNotice(null), 4000);
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
          setInspectionActionNotice(
            lang === 'vi'
              ? 'Đã ghi nhận kiện hàng sẵn sàng! Tài xế Lalamove đang được điều phối đến kho lấy hàng.'
              : 'Package marked ready! Lalamove driver is being dispatched to your warehouse.'
          );
          onRefreshOrders?.();
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } catch (err: any) {
          setInspectionActionNotice(err?.message || 'Không thể cập nhật trạng thái sẵn sàng giao hàng');
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
      if (raw) {
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
  const [pickupConfirmedNotice, setPickupConfirmedNotice] = useState<string | null>(null);
  const [shippingLabelOrder, setShippingLabelOrder] = useState<EscrowOrder | null>(null);

  const handleConfirmCourierPickup = (orderId: string) => {
    setPickupConfirmedNotice(`Đã lên lịch thành công! Tài xế Lalamove sẽ đến địa chỉ kho lấy máy #${orderId} giao về Hub trong hôm nay.`);
    setTimeout(() => setPickupConfirmedNotice(null), 5000);
  };

  // Seller metrics
  const pendingEscrowTotal = useMemo(() => {
    return orders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => sum + Math.round(o.itemPriceVnd * 0.975), 0);
  }, [orders]);

  const awaitingPickupCount = orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = orders.filter(
    (o) =>
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
  ).length;
  const completedPaidCount = orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  // Filter logic based on status tabs, sorted by newest first (mới nhất trên cùng)
  const filteredOrders = orders
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
          return ord.escrowStatus === 'AWAITING_PAYMENT';
        case 'inspecting':
          return (
            ord.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            ord.escrowStatus === 'INSPECTION_PASSED' ||
            (ord.escrowStatus === 'HELD_IN_ESCROW' && Boolean(ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0)))
          );
        case 'shipping':
          return ord.escrowStatus === 'SHIPPED_TO_BUYER';
        case 'delivered':
          return ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';
        case 'completed':
          return ord.escrowStatus === 'COMPLETED_RELEASED';
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
        return orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
      case 'inspecting':
        return orders.filter(
          (o) =>
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            (o.escrowStatus === 'HELD_IN_ESCROW' && Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0)))
        ).length;
      case 'shipping':
        return orders.filter((o) => o.escrowStatus === 'SHIPPED_TO_BUYER').length;
      case 'delivered':
        return orders.filter((o) => o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW').length;
      case 'completed':
        return orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;
      case 'disputed':
        return orders.filter(
          (o) => o.escrowStatus === 'DISPUTED' || o.escrowStatus === 'REFUNDED_TO_BUYER'
        ).length;
      case 'with_inspection':
        return orders.filter(
          (o) => Boolean(o.hasInspectionService || (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) || o.inspectionReport || o.inspectionCenterId || (o as any).inspectionStatus)
        ).length;
      case 'all':
      default:
        return orders.length;
    }
  };

  const getStatusBadge = (status: EscrowOrder['escrowStatus'], hasInspection?: boolean, isCurrentOrderSeller?: boolean) => {
    const isSellerForThisOrder = isCurrentOrderSeller !== undefined ? isCurrentOrderSeller : isSeller;
    switch (status) {
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
      case 'HELD_IN_ESCROW':
        return hasInspection ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{lang === 'vi' ? 'Đang Chờ Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
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
                ? isSeller ? 'Đang Giao Tới Người Mua' : 'Đang Giao Hàng Tới Bạn'
                : isSeller ? 'Delivering to Buyer' : 'Delivering to You'}
            </span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Khách Đang Kiểm Máy (48h)' : 'Đã Giao • 48h Kiểm Tra Đối Soát'
                : isSeller ? 'Buyer Review (48h Window)' : 'Delivered • 48h Inspection Window'}
            </span>
          </span>
        );
      case 'COMPLETED_RELEASED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {lang === 'vi'
                ? isSeller ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'
                : isSeller ? 'Payout Transferred to Wallet' : 'Completed • Escrow Released'}
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
        { key: 'all', label: lang === 'vi' ? 'Tất cả đơn bán' : 'All Seller Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ ký quỹ / Giao bưu tá' : 'Awaiting Escrow / Courier' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao người mua' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Chờ nghiệm thu (48h)' : 'Review (48h)' },
        { key: 'completed', label: lang === 'vi' ? 'Đã nhận tiền' : 'Funds Released' },
        { key: 'disputed', label: lang === 'vi' ? 'Đơn bị khiếu nại' : 'Disputed Orders' },
        { key: 'with_inspection', label: lang === 'vi' ? '🛡️ Có kiểm định Hub' : '🛡️ With Inspection' },
      ]
    : [
        { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All Orders' },
        { key: 'awaiting_pickup', label: lang === 'vi' ? 'Chờ ký quỹ / Lấy hàng' : 'Awaiting Escrow / Pickup' },
        { key: 'inspecting', label: lang === 'vi' ? 'Đang kiểm định Hub' : 'Hub Inspection' },
        { key: 'shipping', label: lang === 'vi' ? 'Đang giao hàng' : 'Delivering' },
        { key: 'delivered', label: lang === 'vi' ? 'Đã nhận hàng' : 'Delivered' },
        { key: 'completed', label: lang === 'vi' ? 'Hoàn thành' : 'Completed' },
        { key: 'disputed', label: lang === 'vi' ? 'Trả hàng / Tranh chấp' : 'Disputes / Refunds' },
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
              <span>{pickupConfirmedNotice}</span>
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
              ? 'Theo dõi hành trình 2 chặng: Người bán → Trung tâm kiểm định → Người mua, biên bản nghiệm thu và ảnh 3 giai đoạn.'
              : 'Multi-leg tracking: Seller → Certified Inspection Hub → Buyer, digital inspection reports, and 3-stage photo logs.'}
          </p>
        </div>
      )}

      {inspectionActionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{inspectionActionNotice}</span>
        </div>
      )}

      {/* Shopee-style Status Tab Bar */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none border-b border-gray-100">
          {tabs.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-[#24263e] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive
                        ? 'bg-[#c34c36]/10 text-[#24263e]'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {/* Active underline indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#c34c36] to-[#fce5da] rounded-t-full" />
                )}
              </button>
            );
          })}
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
                  <div>{getStatusBadge(ord.escrowStatus, hasInspection, orderIsSeller)}</div>
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
                          {ord.listing.category}
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
                          {savedAppointment?.scheduledAt && (
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

                {/* Seller Inspection Request Alert Banner */}
                {orderIsSeller && hasInspection && (
                  <div className="mx-4 sm:mx-6 mb-3 p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-900 text-xs flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                      <div>
                        <span className="font-bold">Đơn hàng có yêu cầu kiểm định Hub:</span>
                        <span className="text-[11px] text-orange-800 ml-1">
                          {ord.inspectionMethod === 'AT_HOME' ? 'Kiểm định tận nhà người bán' : 'Kiểm định tại Hub SecondLife'}.
                          {savedAppointment?.scheduledAt
                            ? ` Đã hẹn lịch KTV: ${new Date(savedAppointment.scheduledAt).toLocaleString('vi-VN')}`
                            : ' Vui lòng bấm nút "Hẹn Giờ Kiểm Định" bên dưới để Kỹ thuật viên Hub đến lấy máy/kiểm định.'}
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
                        <>
                          {/* GIAI ĐOẠN 1: CHỜ XÁC NHẬN ĐƠN */}
                          {!ord.sellerConfirmedAt && ord.confirmationStatus !== 'CONFIRMED' && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && (
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

                          {/* GIAI ĐOẠN 2: ĐÃ XÁC NHẬN • ĐANG ĐÓNG GÓI */}
                          {(ord.sellerConfirmedAt || ord.confirmationStatus === 'CONFIRMED') &&
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

                              {/* Nút Hẹn Giờ Kiểm Định (nếu có kiểm định tận nơi) */}
                              {hasInspection && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSchedulingOrder(ord);
                                    setSchedulingReadOnly(false);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                  title={lang === 'vi' ? 'Người bán lên lịch hẹn ngày giờ kỹ thuật viên đến kiểm định' : 'Schedule inspection appointment with Hub technician'}
                                >
                                  <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                  <span>
                                    {savedAppointment?.scheduledAt
                                      ? (lang === 'vi' ? 'Đổi Lịch Hẹn KTV' : 'Reschedule Inspect')
                                      : (lang === 'vi' ? 'Hẹn Giờ Kiểm Định' : 'Schedule Inspect')}
                                  </span>
                                </button>
                              )}

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

                          {/* Seller Accept / Reject Inspection Proposal */}
                          {hasInspection && (ord.escrowStatus === 'AWAITING_PAYMENT' || !ord.sellerConfirmedAt) && ord.confirmationStatus !== 'CONFIRMED' && (
                            <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRespondInspection(ord.id, 'ACCEPT');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                                title="Đồng ý đề xuất kiểm định của người mua"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{lang === 'vi' ? 'Đồng Ý Kiểm Định' : 'Accept Inspect'}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRespondInspection(ord.id, 'REJECT');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 border border-slate-200"
                                title="Từ chối đề xuất kiểm định"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Từ Chối' : 'Reject'}</span>
                              </button>
                            </div>
                          )}

                          {/* Completed: Escrow released notice */}
                          {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã Giải Ngân Vào Ví' : 'Funds Credited to Wallet'}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        /* Buyer Actions */
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

                          {/* Tracking Lalamove for Buyer */}
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

                          {/* Inspection In Progress Notice for Buyer */}
                          {hasInspection && (ord.escrowStatus === 'INSPECTION_IN_PROGRESS' || ord.escrowStatus === 'HELD_IN_ESCROW') && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 whitespace-nowrap shrink-0">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                              <span>{lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection'}</span>
                            </span>
                          )}

                          {/* Buyer View Inspection Appointment (ONLY if order actually has inspection AND seller has scheduled) */}
                          {hasInspection && savedAppointment?.scheduledAt && (
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

                          {/* Buyer Pay Inspection Fee or Bank Transfer Escrow Deposit */}
                          {ord.escrowStatus === 'AWAITING_PAYMENT' && !orderIsSeller && (
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

                          {(ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED' || ord.shippingDeliveredAt) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
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
                                    onConfirmReceipt(ord.id);
                                    setConfirmDialog(null);
                                  }
                                });
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse whitespace-nowrap shrink-0"
                              title="Xác nhận đã nhận máy an toàn và giải ngân Escrow cho người bán"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Đã Nhận Hàng (Giải Ngân)' : 'Confirm Delivery'}</span>
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
                          {(ord.escrowStatus === 'COMPLETED_RELEASED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED') && (
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
                      )}
                    </div>
                  </div>
                </div>

                {/* 48h Auto-release notice banner on the order card */}
                {ord.shippingDeliveredAt && ord.escrowStatus !== 'COMPLETED_RELEASED' && ord.escrowStatus !== 'DISPUTED' && (
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
                  {getStatusBadge(detailModalOrder.escrowStatus, Boolean(detailModalOrder.hasInspectionService || (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)), isOrderSeller(detailModalOrder))}
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
                    {detailModalOrder.listing.category} • {lang === 'vi' ? 'Tình trạng:' : 'Condition:'} {detailModalOrder.listing.conditionGrade}
                  </p>
                  <div className="text-sm font-extrabold text-[#24263e] mt-1">
                    {formatVND(detailModalOrder.itemPriceVnd)}
                  </div>
                </div>
              </div>

              {/* Seller Confirmation Status Banner */}
              {detailModalOrder.sellerConfirmedAt ? (
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
              ) : null}

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
                <button
                  onClick={() => {
                    setTrackingOrder(detailModalOrder);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Tra cứu vận đơn Lalamove</span>
                </button>
              </div>

              {/* 2-Leg Shipping Visualizer */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#24263e]" />
                  <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Leg 1: Seller to Center */}
                  {detailModalOrder.shippingLegs[0] ? (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                          {t.leg1}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#24263e]">
                          {detailModalOrder.shippingLegs[0].carrier} #{detailModalOrder.shippingLegs[0].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0].origin}</span></div>
                        <div>Đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/70">
                        {detailModalOrder.shippingLegs[0].timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đã bàn giao bưu tá'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500">
                      Chặng 1 đang chờ bưu tá phân phối lấy hàng từ nhà người bán.
                    </div>
                  )}

                  {/* Leg 2: Center to Buyer */}
                  {detailModalOrder.shippingLegs[1] ? (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#c34c36] to-[#fce5da] px-2 py-0.5 rounded-md">
                          {t.leg2}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#24263e]">
                          {detailModalOrder.shippingLegs[1].carrier} #{detailModalOrder.shippingLegs[1].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#24263e]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1].origin}</span></div>
                        <div>Giao đến: <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[1].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e] font-medium">
                        {detailModalOrder.shippingLegs[1].timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500 flex items-center justify-center">
                      Chặng 2 sẽ tự động kích hoạt sau khi kiểm định Hub đạt chuẩn.
                    </div>
                  )}
                </div>
              </div>

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

              {/* 3-Stage Multi-Version Photo Audit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#24263e]" />
                    <span>{t.multiStageTitle}</span>
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
                    <button
                      onClick={() => setActivePhotoStage('handover')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        activePhotoStage === 'handover'
                          ? 'bg-[#24263e] text-white'
                          : 'text-[#24263e]/70'
                      }`}
                    >
                      3. Niêm phong giao
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
                        {activePhotoStage === 'listing' && 'Ảnh rao bán'}
                        {activePhotoStage === 'inspector' && 'Ảnh soi Hub'}
                        {activePhotoStage === 'handover' && 'Ảnh dán tem NFC'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
              {detailModalOrder.shippingDeliveredAt && detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' && detailModalOrder.escrowStatus !== 'DISPUTED' && (
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
                {detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
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
                        <>
                          {/* GIAI ĐOẠN 1: Chờ xác nhận đơn */}
                          {!detailModalOrder.sellerConfirmedAt &&
                            detailModalOrder.confirmationStatus !== 'CONFIRMED' &&
                            detailModalOrder.backendStatus !== 'CANCELLED' &&
                            detailModalOrder.escrowStatus !== 'REFUNDED_TO_BUYER' && (
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
                      )}

                      {/* Chỉ Người Mua (Buyer) mới có nút Đã Nhận Hàng & Khiếu Nại Trả Hàng khi đơn đã giao */}
                      {!isOrderSeller(detailModalOrder) &&
                        (detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
                          detailModalOrder.backendStatus === 'DELIVERED' ||
                          detailModalOrder.shippingDeliveredAt) && (
                          <>
                            <button
                              onClick={() => {
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
                                    onConfirmReceipt(detailModalOrder.id);
                                    setDetailModalOrder(null);
                                    setConfirmDialog(null);
                                  }
                                });
                              }}
                              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t.confirmReceipt}</span>
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
