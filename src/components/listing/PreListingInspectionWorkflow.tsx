
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Home,
  Building2,
  Truck,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Calendar,
  MapPin,
  Loader2,
  RefreshCw,
  Info,
  Package,
  X,
  Copy,
  Check,
  ExternalLink,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  inspectorService,
  PreListingInspectionQuoteResponse,
  InspectionOrderDto
} from '../../services/inspectorService';
import { postService } from '../../services/postService';
import { shippingService } from '../../services/shippingService';
import { formatVND } from '../../utils/translations';
import { getHubReturnProgress, getHubReturnState, getInboundShipmentProgress, getLatestInboundShipment } from '../../utils/inspectionCenterData';
import { InspectionCenterOption, ShipmentBackend, EscrowOrder } from '../../types';
import { OrderTrackingModal } from '../modals/OrderTrackingModal';
import { AtHomeIntakeBarcode } from '../inspection/AtHomeIntakeBarcode';
import { PreListingAppointmentCounter } from './PreListingAppointmentCounter';
import { MORNING_SLOTS, AFTERNOON_SLOTS } from '../modals/ScheduleAppointmentModal';
import { INSPECTION_SHIFT_HOURS, isInspectionTimeInShift } from '../../utils/inspectionAppointmentTime';
import { getPreListingHomeAppointmentStage, getPreListingHomeIntakeStage } from '../../utils/inspectionTaskStatus';
import { formatInspectionFailureReason } from '../../utils/inspectionPurchase';
import { notificationWsClient } from '../../services/notificationWsClient';

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
  } catch {
    return String(isoString);
  }
}

function getInspectionProgressLabel(order: InspectionOrderDto, inbound: ShipmentBackend | null) {
  const status = order.status.toUpperCase();
  if (status === 'PASSED' || status === 'COMPLETED') return 'Kiểm định đạt chuẩn';

  const inspecting = status === 'INSPECTING' || status === 'INSPECTION_IN_PROGRESS';
  if (order.orderType === 'AT_CENTER') {
    if (inspecting && order.inspectorConfirmed !== false) return 'Đang kiểm định tại trung tâm';

    const progress = inbound ? getInboundShipmentProgress(inbound) : null;
    if (inspecting || status === 'RECEIVED_AT_CENTER' || progress?.step === 3) {
      return 'Hàng đã đến trung tâm · Chờ kiểm định';
    }
    if (status === 'SHIPPING_TO_CENTER') return 'Đang giao hàng đến Hub';
    return progress?.label ?? 'Chờ gửi hàng đến trung tâm';
  }

  if (inspecting) return 'Đang kiểm định tại nhà';
  if (order.appointmentStatus === 'PENDING_CENTER_CONFIRMATION') return 'Chờ trung tâm xác nhận lịch hẹn';
  if (order.appointmentStatus === 'COUNTERED_BY_CENTER') return 'Trung tâm đã đề xuất lịch hẹn mới';
  return order.appointmentScheduledAt ? 'Đã đặt lịch kiểm định tại nhà' : 'Chờ đặt lịch kiểm định tại nhà';
}

function getStatusBadgeStyle(statusLabel: string) {
  const s = statusLabel.toLowerCase();
  if (s.includes('thành công') || s.includes('đã giao') || s.includes('hoàn tất') || s.includes('đạt')) {
    return {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500'
    };
  }
  if (s.includes('hủy') || s.includes('lỗi') || s.includes('thất bại') || s.includes('không đạt') || s.includes('từ chối')) {
    return {
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500'
    };
  }
  if (s.includes('đang') || s.includes('lấy') || s.includes('giao') || s.includes('tìm') || s.includes('chờ') || s.includes('điều phối')) {
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500 animate-pulse'
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    dot: 'bg-slate-400'
  };
}

function ShipmentStatusDetails({
  shipment,
  statusLabel,
  onOpenTracking,
  lang = 'vi'
}: {
  shipment: ShipmentBackend;
  statusLabel: string;
  onOpenTracking?: () => void;
  lang?: 'vi' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const orderCode = shipment.orderCode?.trim() || '';
  const badgeStyle = getStatusBadgeStyle(statusLabel);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!orderCode) return;
    navigator.clipboard?.writeText(orderCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {lang === 'vi' ? 'Mã vận đơn Lalamove:' : 'Lalamove Tracking Code:'}
          </span>
          <span className="font-mono font-black text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {orderCode || (lang === 'vi' ? 'Chưa có mã' : 'No code')}
          </span>
          {orderCode && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={lang === 'vi' ? 'Sao chép mã vận đơn' : 'Copy code'}
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </button>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${badgeStyle.badge}`}>
          <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-500">
          {lang === 'vi'
            ? 'Theo dõi trực tiếp lộ trình xe và lịch sử sự kiện Lalamove:'
            : 'Track driver delivery progress in real-time:'}
        </span>
        <button
          type="button"
          onClick={onOpenTracking}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs px-3.5 py-1.5 shadow-xs transition cursor-pointer"
          title={lang === 'vi' ? 'Mở cửa sổ Quá trình giao hàng Lalamove' : 'Open Delivery Progress Tracking'}
        >
          <Truck className="size-3.5 text-white" />
          <span>{lang === 'vi' ? 'Xem quá trình giao hàng' : 'View Delivery Progress'}</span>
          <ExternalLink className="size-3 text-orange-200" />
        </button>
      </div>
    </div>
  );
}

function InspectionOrderFeeDetails({
  order,
  feeDetails,
  lang = 'vi',
}: {
  order: InspectionOrderDto;
  feeDetails: any;
  lang?: 'vi' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const isAtCenter = order.orderType === 'AT_CENTER';
  const baseFee = Number(order.inspectionFee || feeDetails?.baseFee || 0);
  const shippingFee = Number(order.shippingFee || (feeDetails as any)?.shippingToCenter || (isAtCenter ? 35000 : 0));
  const returnReserve = Number(order.returnShippingReserveFee || (feeDetails as any)?.returnReserve || (isAtCenter ? 35000 : 0));
  const travelFee = Number(order.travelFeeRoundTrip || order.travelFee || (feeDetails as any)?.travelFee || (!isAtCenter ? 50000 : 0));

  const calculatedTotal = isAtCenter ? (baseFee + shippingFee + returnReserve) : (baseFee + travelFee);
  const totalPaid = Number(order.sellerFeeShare) > 0 ? Number(order.sellerFeeShare) : calculatedTotal;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.id) return;
    navigator.clipboard?.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const vi = lang === 'vi';
  const paidTime = order.sellerPaidAt || order.feeSettledAt || (order as any)?.paidAt || (
    order.status !== 'WAITING_FEE_PAYMENT' && order.status !== 'PENDING_PAYMENT'
      ? (order as any)?.updatedAt || (order as any)?.createdAt
      : undefined
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3">
      {/* Top row: Mã đơn kiểm định & Huy hiệu thanh toán */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {vi ? 'Mã đơn kiểm định:' : 'Inspection Order:'}
          </span>
          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
            #{order.id}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title={vi ? 'Sao chép mã đơn' : 'Copy code'}
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="size-3 text-emerald-600" />
            <span>{vi ? 'Đã thanh toán qua Ví' : 'Paid via Wallet'}</span>
          </span>
        </div>
      </div>

      {/* Chi tiết tiền đã đóng */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 font-bold text-slate-900 text-xs hover:text-[#c34c36] transition cursor-pointer"
          >
            <Receipt className="size-3.5 text-[#c34c36]" />
            <span>{vi ? 'Chi tiết tiền đã đóng' : 'Fee Breakdown'}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({isExpanded ? (vi ? 'Thu gọn' : 'Collapse') : (vi ? 'Xem chi tiết' : 'Expand')})
            </span>
          </button>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 mr-1.5">{vi ? 'Tổng đã thanh toán:' : 'Total paid:'}</span>
            <span className="font-black text-sm sm:text-base text-[#c34c36]">{formatVND(totalPaid)}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span>{vi ? '• Phí kiểm định kỹ thuật:' : '• Technical inspection fee:'}</span>
              <span className="font-bold text-slate-800">{formatVND(baseFee)}</span>
            </div>

            {isAtCenter ? (
              <>
                <div className="flex items-center justify-between">
                  <span>{vi ? '• Cước Lalamove chặng 1 (Kho người bán ➔ Hub):' : '• Leg 1 Lalamove courier (to Hub):'}</span>
                  <span className="font-bold text-slate-800">{formatVND(shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>
                    {vi
                      ? '• Phí dự phòng hoàn trả Chặng 2 (Hoàn 100% khi bán được):'
                      : '• Leg 2 return reserve (100% refundable on sale):'}
                  </span>
                  <span className="font-bold text-slate-800">{formatVND(returnReserve)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span>{vi ? '• Phụ phí di chuyển kỹ thuật viên:' : '• Inspector travel fee:'}</span>
                <span className="font-bold text-slate-800">{formatVND(travelFee)}</span>
              </div>
            )}

            {paidTime && (
              <div className="pt-1.5 mt-1 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>{vi ? 'Thời gian thanh toán:' : 'Paid at:'}</span>
                <span className="font-medium text-slate-600">{formatDateTime(paidTime)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface PreListingInspectionWorkflowProps {
  postId: string;
  postTitle?: string;
  postPrice?: number;
  initialInspectionOrderId?: string | null;
  initialNextAction?: string | null;
  onClose?: () => void;
  onPostActivated?: () => void;
  lang?: 'vi' | 'en';
}

type WorkflowStep =
  | 'INITIALIZING'
  | 'SELECT_METHOD'
  | 'PAY_FEE'
  | 'SCHEDULE_HOME'
  | 'TRACK_INSPECTION'
  | 'TRACK_RETURN'
  | 'READY_TO_PUBLISH'
  | 'POST_ACTIVE'
  | 'REQUEST_CLOSED'
  | 'INSPECTION_FAILED';

export const PreListingInspectionWorkflow: React.FC<PreListingInspectionWorkflowProps> = ({
  postId,
  postTitle = 'Sản phẩm giá trị cao',
  postPrice = 0,
  initialInspectionOrderId = null,
  onClose,
  onPostActivated,
  lang = 'vi'
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('INITIALIZING');
  const [isReadyToPublish, setIsReadyToPublish] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [order, setOrder] = useState<InspectionOrderDto | null>(null);
  const [orderType, setOrderType] = useState<'AT_HOME' | 'AT_CENTER'>('AT_HOME');
  const [availableCenters, setAvailableCenters] = useState<InspectionCenterOption[]>([]);

  // Quote State
  const [quoteData, setQuoteData] = useState<PreListingInspectionQuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [sellerConsentZin, setSellerConsentZin] = useState(false);

  // Confirm State
  const [isConfirmingQuote, setIsConfirmingQuote] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Payment State
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentDeadlineRemaining, setPaymentDeadlineRemaining] = useState<string>('');

  // AT_HOME Scheduling State
  const [appointmentDate, setAppointmentDate] = useState<string>('');
  const [appointmentShift, setAppointmentShift] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [appointmentTime, setAppointmentTime] = useState<string>('09:00');
  const [appointmentNote, setAppointmentNote] = useState<string>('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  const [isEditingCounter, setIsEditingCounter] = useState(false);
  const appointmentWrite = useRef(false);
  const hasCounter = getPreListingHomeAppointmentStage(order ?? undefined) === 'countered';
  const isRescheduling = currentStep === 'TRACK_INSPECTION' && hasCounter && isEditingCounter;

  const handleShiftChange = (shift: 'MORNING' | 'AFTERNOON') => {
    setAppointmentShift(shift);
    if (shift === 'MORNING') {
      if (!isInspectionTimeInShift(appointmentTime, 'MORNING')) {
        setAppointmentTime('09:00');
      }
    } else {
      if (!isInspectionTimeInShift(appointmentTime, 'AFTERNOON')) {
        setAppointmentTime('14:00');
      }
    }
    setSchedulingError(null);
  };

  // AT_CENTER Shipment State
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [shipmentLoadFailed, setShipmentLoadFailed] = useState(false);
  const [isBookingShipment, setIsBookingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // Lalamove Tracking Modal State (Ảnh 1)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | null>(null);
  const [postRejectionReason, setPostRejectionReason] = useState<string | null>(null);

  // General Loading & Status check
  const [isRefreshing, setIsRefreshing] = useState(false);
  const progressRequest = useRef<AbortController | null>(null);
  const quoteRequest = useRef<AbortController | null>(null);
  const onPostActivatedRef = useRef(onPostActivated);

  useEffect(() => {
    onPostActivatedRef.current = onPostActivated;
  }, [onPostActivated]);

  const loadOrderShipments = useCallback(async (orderId: string) => {
    setIsLoadingShipments(true);
    setShipmentLoadFailed(false);
    try {
      setShipments(await shippingService.getInspectionShipments(orderId));
    } catch (err) {
      console.warn('Failed to load inspection shipments:', err);
      setShipmentLoadFailed(true);
    } finally {
      setIsLoadingShipments(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 1. Initial State Check / Resume from DB
  // ---------------------------------------------------------------------------
  const checkCurrentProgress = useCallback(async () => {
    if (!postId || progressRequest.current || appointmentWrite.current) return;
    const controller = new AbortController();
    progressRequest.current = controller;
    const { signal } = controller;
    setIsRefreshing(true);
    try {
      // 1. Check current Post status
      const postDetail = await postService.getMyPostDetail(postId, signal).catch(() => null);
      if (signal.aborted) return;
      const isPostActive = postDetail?.status === 'ACTIVE';
      const readyToPublish = postDetail?.status === 'READY_TO_PUBLISH';
      setIsReadyToPublish(readyToPublish);
      if (postDetail?.rejectionReason) {
        setPostRejectionReason(postDetail.rejectionReason);
      }

      // 2. Find latest PRE_LISTING inspection order for this post
      let targetOrder: InspectionOrderDto | null = null;
      if (initialInspectionOrderId) {
        targetOrder = await inspectorService.getOrderById(initialInspectionOrderId, {
          signal, bypassCache: true,
        }).catch(() => null);
        if (signal.aborted) return;
      }

      if (!targetOrder) {
        const sellerOrdersRes = await inspectorService.getMySellerOrders(0, 50).catch(() => null);
        if (signal.aborted) return;
        const allOrders: InspectionOrderDto[] =
          (sellerOrdersRes as any)?.content ||
          (sellerOrdersRes as any)?.items ||
          (sellerOrdersRes as any)?.data ||
          (Array.isArray(sellerOrdersRes) ? sellerOrdersRes : []);

        targetOrder = allOrders.find(
          (o) => (o.postId === postId || (o as any).listingId === postId || (o as any).listing?.id === postId) &&
            ((o.inspectionScope || '').toUpperCase() === 'PRE_LISTING' || (o as any).type === 'PRE_LISTING')
        ) || null;

        if (!targetOrder) {
          try {
            const raw = localStorage.getItem('my_seller_inspection_orders');
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                targetOrder = list.find(
                  (o: any) => (o.postId === postId || o.listingId === postId || o.listing?.id === postId)
                ) || null;
              }
            }
          } catch { }
        }
      }

      if (targetOrder) {
        setOrder(targetOrder);
        if (targetOrder.orderType) {
          setOrderType(targetOrder.orderType as any);
        }
        if (targetOrder.orderType !== 'AT_HOME') {
          await loadOrderShipments(targetOrder.id);
        }
      }

      // If post is already active, stay on POST_ACTIVE and retain full order & shipments details
      if (isPostActive) {
        setCurrentStep('POST_ACTIVE');
        onPostActivatedRef.current?.();
        return;
      }

      if (readyToPublish) {
        setCurrentStep(targetOrder?.orderType === 'AT_CENTER' ? 'TRACK_RETURN' : 'READY_TO_PUBLISH');
        return;
      }

      if (targetOrder) {
        // Determine step from order status
        const st = (targetOrder.status || '').toUpperCase();
        if (st === 'WAITING_FEE_PAYMENT' || st === 'PENDING_PAYMENT') {
          setCurrentStep('PAY_FEE');
        } else if (st === 'CANCELLED' || st === 'PAYMENT_EXPIRED') {
          setCurrentStep('REQUEST_CLOSED');
        } else if (st === 'FAILED' || st === 'REJECTED' || st === 'INSPECTION_FAILED') {
          setCurrentStep('INSPECTION_FAILED');
        } else if (targetOrder.orderType === 'AT_HOME') {
          const appointmentStage = getPreListingHomeAppointmentStage(targetOrder);
          if (appointmentStage !== 'countered') setIsEditingCounter(false);
          if (st === 'COMPLETED' || st === 'PASSED' || appointmentStage === 'countered') {
            setCurrentStep('TRACK_INSPECTION');
          } else if (!targetOrder.appointmentScheduledAt || targetOrder.appointmentStatus === 'REJECTED') {
            if (targetOrder.appointmentScheduledAt) {
              try {
                const d = new Date(targetOrder.appointmentScheduledAt);
                if (!isNaN(d.getTime())) {
                  const pad = (n: number) => String(n).padStart(2, '0');
                  setAppointmentDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                  const shift = d.getHours() >= 13 ? 'AFTERNOON' : 'MORNING';
                  setAppointmentShift(shift);
                  setAppointmentTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }
              } catch { }
            }
            setCurrentStep('SCHEDULE_HOME');
          } else {
            setCurrentStep('TRACK_INSPECTION');
          }
        } else if (targetOrder.orderType === 'AT_CENTER') {
          if (st === 'COMPLETED') {
            // AT_CENTER COMPLETED means inspection passed, now device is being returned to seller
            setCurrentStep('TRACK_RETURN');
          } else {
            setCurrentStep('TRACK_INSPECTION');
          }
        } else {
          setCurrentStep('SELECT_METHOD');
        }
      } else {
        setCurrentStep('SELECT_METHOD');
      }
    } catch (err) {
      if (!signal.aborted) {
        console.warn('[PreListingInspectionWorkflow] Progress check error:', err);
        setCurrentStep('SELECT_METHOD');
      }
    } finally {
      if (progressRequest.current === controller) {
        progressRequest.current = null;
        setIsRefreshing(false);
      }
    }
  }, [postId, initialInspectionOrderId, loadOrderShipments]);

  const handlePublish = async () => {
    if (!isReadyToPublish || isPublishing || isRefreshing) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      await postService.publishInspectedPost(postId);
      setIsReadyToPublish(false);
      setCurrentStep('POST_ACTIVE');
      onPostActivatedRef.current?.();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : (lang === 'vi' ? 'Không thể đăng bán sản phẩm.' : 'Could not publish the listing.'));
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(checkCurrentProgress, 0);
    return () => {
      window.clearTimeout(timer);
      progressRequest.current?.abort();
      progressRequest.current = null;
    };
  }, [checkCurrentProgress]);

  const homeOrderId = order?.orderType === 'AT_HOME' ? order.id : undefined;
  const homeIntakeStage = getPreListingHomeIntakeStage(order ?? undefined);
  useEffect(() => {
    if (!homeOrderId) return;
    return notificationWsClient.subscribeListener((notification) => {
      if (notification.referenceType === 'INSPECTION_ORDER' && notification.referenceId === homeOrderId) {
        void checkCurrentProgress();
      }
    });
  }, [homeOrderId, checkCurrentProgress]);

  // Load available inspection centers
  useEffect(() => {
    let isMounted = true;
    inspectorService
      .getAvailableCenters()
      .then((centers) => {
        if (isMounted) setAvailableCenters(centers);
      })
      .catch((err) => console.warn('Failed to load centers:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Quote Request Logic (Debounced / Triggered on method or center change)
  // ---------------------------------------------------------------------------
  const fetchQuote = useCallback(async (type: 'AT_HOME' | 'AT_CENTER') => {
    if (!postId) return;
    quoteRequest.current?.abort();
    const controller = new AbortController();
    quoteRequest.current = controller;
    const { signal } = controller;
    setIsLoadingQuote(true);
    setQuoteError(null);
    setQuoteData(null); // Clear displayed quote when method/center changes as required
    setSellerConsentZin(false);

    try {
      const res = await inspectorService.getPreListingQuote(postId, { orderType: type }, signal);
      if (!signal.aborted) setQuoteData(res);
    } catch (err: any) {
      if (signal.aborted) return;
      console.warn('Failed to fetch pre-listing quote:', err);
      setQuoteError(
        err?.message ||
        (lang === 'vi'
          ? 'Không thể lấy báo giá kiểm định. Vui lòng thử lại sau.'
          : 'Failed to fetch inspection quote.')
      );
    } finally {
      if (quoteRequest.current === controller) {
        quoteRequest.current = null;
        setIsLoadingQuote(false);
      }
    }
  }, [postId, lang]);

  // Start after mount so StrictMode cleanup can cancel the initial request.
  useEffect(() => {
    if (currentStep !== 'SELECT_METHOD') return;
    const timer = window.setTimeout(() => fetchQuote(orderType), 0);
    return () => {
      window.clearTimeout(timer);
      quoteRequest.current?.abort();
      quoteRequest.current = null;
    };
  }, [currentStep, orderType, fetchQuote]);

  const selectInspectionMethod = (type: 'AT_HOME' | 'AT_CENTER') => {
    if (type === orderType) return;
    setQuoteData(null);
    setOrderType(type);
  };

  const centerQuote = quoteData?.orderType === 'AT_CENTER' ? quoteData.quote : null;
  const quotedCenter = availableCenters.find((center) => center.id === centerQuote?.inspectionCenterId);
  const quotedCenterName = centerQuote?.inspectionCenterName || quotedCenter?.name;
  const confirmedCenterAddress = order?.inspectionCenterAddress
    || (order?.inspectionCenterId === quotedCenter?.id ? quotedCenter?.address : undefined);

  const trackingEscrowOrder = useMemo<EscrowOrder | null>(() => {
    if (!order) return null;
    const centerName = order.inspectionCenterName || quotedCenterName || 'Trung tâm kiểm định secondLife';
    const centerAddress = confirmedCenterAddress || order.inspectionCenterAddress || 'Khu Công nghệ cao Hòa Lạc, Hà Nội';
    const centerPhone = (quotedCenter as any)?.phone || (order as any).inspectionCenterPhone || '0908123456';
    const sellerAddr = (order as any).sellerAddress || (order as any).pickupAddress || '';
    const sellerPhone = (order as any).sellerPhone || '';
    return {
      id: order.id,
      listingId: postId,
      listing: {
        id: postId,
        title: postTitle || 'Sản phẩm kiểm định',
        priceVnd: postPrice || 0,
        photos: {
          front: (order as any).productPhoto || (order as any).imageUrl || order.postImageUrl || '/favicon.ico',
          back: '',
          left: '',
          right: '',
          top: '',
          bottom: ''
        },
        condition: 'USED',
        status: 'pending',
        backendStatus: 'PENDING_INSPECTION',
        category: 'Đồ gia dụng',
        brand: 'SecondLife',
        seller: {
          id: order.sellerId || '',
          name: order.sellerName || 'Người bán',
          email: order.sellerEmail || '',
          phone: sellerPhone,
          address: sellerAddr
        }
      } as any,
      buyerId: '',
      buyerName: centerName,
      buyerPhone: centerPhone,
      buyerAddress: centerAddress,
      sellerId: order.sellerId || '',
      sellerName: order.sellerName || 'Người bán',
      sellerPhone: sellerPhone,
      sellerAddress: sellerAddr,
      itemPriceVnd: postPrice || 0,
      inspectionFeeVnd: Number(order.inspectionFee || 0),
      shippingFeeVnd: Number(order.shippingFee || 0),
      platformFeeVnd: 0,
      totalPaidVnd: Number(order.sellerFeeShare || 0),
      escrowStatus: 'ESCROW_HOLDING' as any,
      hasInspectionService: true,
      inspectionCenterId: order.inspectionCenterId || undefined,
      inspectionCenterName: centerName,
      inspectionCenterAddress: centerAddress,
      inspectionCenterPhone: centerPhone,
      inspectionMethod: 'AT_CENTER',
      shippingLegs: [],
      createdAt: new Date().toISOString(),
      multiStagePhotos: {} as any
    } as EscrowOrder;
  }, [order, postId, postTitle, postPrice, confirmedCenterAddress, quotedCenterName, quotedCenter?.id]);

  // ---------------------------------------------------------------------------
  // 3. Confirm Quote Logic
  // ---------------------------------------------------------------------------
  const handleConfirmQuote = async () => {
    if (!quoteData || !quoteData.quoteId) {
      setConfirmError(lang === 'vi' ? 'Chưa có thông tin báo giá hợp lệ.' : 'Invalid quote data.');
      return;
    }
    if (!sellerConsentZin) {
      setConfirmError(
        lang === 'vi'
          ? 'Vui lòng xác nhận đồng ý mở máy kiểm định zin để tiếp tục.'
          : 'Please consent to opening the device for inspection.'
      );
      return;
    }

    setIsConfirmingQuote(true);
    setConfirmError(null);

    try {
      const confirmedOrder = await inspectorService.confirmPreListingQuote(postId, {
        quoteId: quoteData.quoteId,
        sellerConsentZin: true
      });
      setOrder(confirmedOrder);
      setCurrentStep('PAY_FEE');
    } catch (err: any) {
      console.warn('Confirm quote error:', err);
      const msg = err?.message || '';
      if (err?.status === 409 || msg.toLowerCase().includes('hết hạn') || msg.toLowerCase().includes('expired')) {
        setConfirmError(
          lang === 'vi'
            ? 'Báo giá đã hết hạn hoặc thông tin địa chỉ/cước phí đã thay đổi. Đang tải báo giá mới...'
            : 'Quote expired. Fetching fresh quote...'
        );
        void fetchQuote(orderType);
      } else {
        setConfirmError(
          msg || (lang === 'vi' ? 'Không thể chốt báo giá kiểm định.' : 'Failed to confirm inspection quote.')
        );
      }
    } finally {
      setIsConfirmingQuote(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Payment Countdown & Payment Logic
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep !== 'PAY_FEE' || !order?.paymentDeadline) return;

    const deadline = new Date(order.paymentDeadline).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = deadline - now;
      if (diff <= 0) {
        setPaymentDeadlineRemaining(lang === 'vi' ? 'Hết hạn thanh toán' : 'Payment expired');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setPaymentDeadlineRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentStep, order?.paymentDeadline, lang]);

  const handlePayFee = async () => {
    if (!order) return;
    setIsPaying(true);
    setPaymentError(null);

    try {
      const updated = await inspectorService.payInspectionFee(
        order.id,
        order.preListingQuoteId || undefined
      );
      setOrder(updated);

      if (updated.orderType === 'AT_HOME') {
        setCurrentStep('SCHEDULE_HOME');
      } else {
        setCurrentStep('TRACK_INSPECTION');
        loadOrderShipments(updated.id);
      }
    } catch (err: any) {
      console.warn('Pay inspection fee error:', err);
      if (err?.status === 409) {
        setPaymentError(
          lang === 'vi'
            ? 'Đơn kiểm định đã thay đổi trạng thái hoặc hết hạn. Đang đồng bộ lại...'
            : 'Order state updated or expired. Reloading...'
        );
        void checkCurrentProgress();
      } else {
        setPaymentError(
          err?.message ||
          (lang === 'vi'
            ? 'Không thể thanh toán phí kiểm định từ Ví. Vui lòng kiểm tra số dư ví khả dụng.'
            : 'Payment failed. Please check your wallet balance.')
        );
      }
    } finally {
      setIsPaying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. AT_HOME Appointment Scheduling
  // ---------------------------------------------------------------------------
  const saveHomeAppointment = async (save: () => Promise<InspectionOrderDto>, fallbackError: string) => {
    if (appointmentWrite.current || progressRequest.current) return;
    appointmentWrite.current = true;
    setIsScheduling(true);
    setSchedulingError(null);

    try {
      const updated = await save();
      setOrder(updated);
      setIsEditingCounter(false);
      setCurrentStep('TRACK_INSPECTION');
    } catch (error) {
      setSchedulingError(error instanceof Error ? error.message : fallbackError);
    } finally {
      appointmentWrite.current = false;
      setIsScheduling(false);
    }
  };

  const handleAcceptCounter = () => {
    if (!hasCounter || !order?.counterScheduledAt) return;
    void saveHomeAppointment(
      () => inspectorService.acceptAppointmentCounter(order.id),
      lang === 'vi' ? 'Không thể đồng ý lịch đề xuất.' : 'Could not accept the proposed appointment.',
    );
  };

  const handleScheduleAppointment = () => {
    if (!order) return;
    if (!appointmentDate) {
      setSchedulingError(lang === 'vi' ? 'Vui lòng chọn ngày hẹn kiểm định.' : 'Please choose an appointment date.');
      return;
    }
    if (!appointmentTime) {
      setSchedulingError(lang === 'vi' ? 'Vui lòng chọn khung giờ hẹn cụ thể.' : 'Please select an appointment time.');
      return;
    }

    if (!isInspectionTimeInShift(appointmentTime, appointmentShift)) {
      const { min, max } = INSPECTION_SHIFT_HOURS[appointmentShift];
      setSchedulingError(
        lang === 'vi'
          ? `Vui lòng chọn giờ trong ca đã chọn (${min} - ${max}).`
          : `Please choose a time within the selected shift (${min} - ${max}).`
      );
      return;
    }

    const scheduledDate = new Date(`${appointmentDate}T${appointmentTime}:00`);
    if (isNaN(scheduledDate.getTime())) {
      setSchedulingError(lang === 'vi' ? 'Thời gian hẹn không hợp lệ. Vui lòng kiểm tra lại.' : 'Invalid appointment time.');
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      setSchedulingError(lang === 'vi' ? 'Lịch hẹn kiểm định phải ở thời điểm tương lai.' : 'Appointment must be in the future.');
      return;
    }

    void saveHomeAppointment(
      () => inspectorService.scheduleAppointment(
        order.id,
        scheduledDate.toISOString(),
        appointmentNote.trim() || undefined,
        appointmentShift,
      ),
      lang === 'vi' ? 'Không thể đặt lịch kiểm định.' : 'Failed to schedule appointment.',
    );
  };

  // ---------------------------------------------------------------------------
  // 6. AT_CENTER Shipment Tracking & Creation
  // ---------------------------------------------------------------------------
  const handleCreateInboundShipment = async () => {
    if (!order) return;
    setIsBookingShipment(true);
    setShipmentError(null);

    try {
      await shippingService.createInspectionShipment(order.id, {
        leg: 'SELLER_TO_CENTER',
        requestId: crypto.randomUUID()
      });
      await loadOrderShipments(order.id);
    } catch (err: any) {
      console.warn('Failed to create inbound shipment:', err);
      setShipmentError(
        err?.message ||
        (lang === 'vi'
          ? 'Không thể tạo vận đơn gửi tới Trung tâm. Vui lòng thử lại.'
          : 'Failed to create shipment to center.')
      );
    } finally {
      setIsBookingShipment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helper Details
  // ---------------------------------------------------------------------------
  const feeDetails = useMemo(() => {
    if (!quoteData?.quote) return null;
    const q = quoteData.quote;
    if (orderType === 'AT_HOME') {
      const baseFee = Number(q.baseInspectionFee || (q as any).baseFee || 0);
      const travelFee = Number(q.travelFeeRoundTrip || 0);
      const totalFee = Number(q.atHomeTotalFee || baseFee + travelFee);
      return { baseFee, travelFee, totalFee, distanceKm: q.travelDistanceKm };
    } else {
      const baseFee = Number(q.baseInspectionFee || (q as any).baseFee || 0);
      const shippingToCenter = Number(q.shippingToCenterFee || 0);
      const returnReserve = Number(q.returnShippingReserveFee || 0);
      const totalFee = Number(q.atCenterTotalFee || baseFee + shippingToCenter + returnReserve);
      return { baseFee, shippingToCenter, returnReserve, totalFee };
    }
  }, [quoteData, orderType]);

  const inboundShipment = getLatestInboundShipment(shipments);
  const { shipment: returnShipment } = getHubReturnState(shipments);
  const canBookInbound = !isLoadingShipments && !shipmentLoadFailed &&
    (!inboundShipment || inboundShipment.status === 'CANCELLED') &&
    ['CONFIRMED_PENDING_DISPATCH', 'DISPATCHED', 'SCHEDULED'].includes(order?.status ?? '');
  const shipmentLoadNotice = isLoadingShipments
    ? 'Đang tải trạng thái vận chuyển…'
    : shipmentLoadFailed ? 'Chưa cập nhật được trạng thái vận chuyển. Vui lòng kiểm tra tiến độ lại.' : null;
  const failureReason = currentStep === 'INSPECTION_FAILED'
    ? formatInspectionFailureReason(order?.note, lang) ||
    formatInspectionFailureReason((order as any)?.cancellationReason, lang) ||
    formatInspectionFailureReason((order as any)?.rejectionReason, lang) ||
    formatInspectionFailureReason(postRejectionReason, lang)
    : '';

  // ---------------------------------------------------------------------------
  // Render Steps
  // ---------------------------------------------------------------------------
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col mx-auto animate-fadeIn text-slate-800">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-[#24263e] text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Kiểm định bắt buộc trước khi đăng
              </h3>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-md">
              {postTitle} • <strong className="text-amber-400">{formatVND(postPrice)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkCurrentProgress}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-300' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Step Indicator (Pinned Sub-Header) */}
      <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span
            className={`flex items-center gap-1.5 ${currentStep === 'SELECT_METHOD' ? 'text-[#c34c36] font-black' : ''}`}
          >
            1. Chọn hình thức & Báo giá
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 ${currentStep === 'PAY_FEE' ? 'text-[#c34c36] font-black' : ''}`}
          >
            2. Thanh toán phí (Ví)
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 ${['SCHEDULE_HOME', 'TRACK_INSPECTION', 'TRACK_RETURN', 'READY_TO_PUBLISH', 'POST_ACTIVE', 'INSPECTION_FAILED'].includes(currentStep)
              ? 'text-[#c34c36] font-black'
              : ''}`}
          >
            3. {currentStep === 'INSPECTION_FAILED' ? 'Thủ tục hoàn hàng' : 'Theo dõi & Lên sàn'}
          </span>
        </div>
      </div>

      {/* Main Body (Scrollable) */}
      <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto subtle-scrollbar min-h-0">

        {currentStep === 'INITIALIZING' && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#c34c36]" />
            <span className="text-xs font-medium">{lang === 'vi' ? 'Đang tải thông tin kiểm định...' : 'Loading inspection details...'}</span>
          </div>
        )}

        {isReadyToPublish && (
          <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold">{lang === 'vi' ? 'Đã đạt kiểm định · Sẵn sàng đăng bán' : 'Inspection passed · Ready to publish'}</h4>
              {/* <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isPublishing || isRefreshing}
                className="flex items-center gap-2 rounded-xl bg-[#c34c36] px-4 py-2 text-xs font-bold text-white hover:bg-[#ad432f] cursor-pointer disabled:opacity-60"
              >
                {isPublishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {lang === 'vi' ? 'Đăng bán' : 'Publish listing'}
              </button> */}
            </div>
            {publishError && <p role="alert" className="text-xs text-rose-700">{publishError}</p>}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 1: SELECT METHOD & QUOTE                                       */}
        {/* =================================================================== */}
        {currentStep === 'SELECT_METHOD' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Chính sách bảo vệ sản phẩm giá trị cao:</span>
                <span>
                  Sản phẩm có giá trị cao hơn ngưỡng bắt buộc phải được kiểm định chất lượng sản phẩm và tính năng
                  trước khi đăng bán công khai. <strong>Bạn chịu 100% chi phí kiểm định</strong>.
                </span>
              </div>
            </div>

            {/* Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => selectInspectionMethod('AT_HOME')}
                disabled={isConfirmingQuote}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${orderType === 'AT_HOME'
                  ? 'border-[#c34c36] bg-orange-50/70 shadow-sm ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#c34c36] flex items-center justify-center font-bold">
                    <Home className="w-5 h-5" />
                  </div>
                  {orderType === 'AT_HOME' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#c34c36] text-white">
                      Đang chọn
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Kiểm định tại nhà</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Kỹ thuật viên của SecondLife sẽ đến tận địa chỉ của bạn để kiểm định máy thực tế.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => selectInspectionMethod('AT_CENTER')}
                disabled={isConfirmingQuote}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${orderType === 'AT_CENTER'
                  ? 'border-[#c34c36] bg-orange-50/70 shadow-sm ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  {orderType === 'AT_CENTER' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#c34c36] text-white">
                      Đang chọn
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Tại trung tâm HUB</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gửi máy qua Lalamove tới SecondLife Hub. Trung tâm kiểm định chuyên sâu và gửi trả lại bạn.
                  </p>
                </div>
              </button>
            </div>

            {orderType === 'AT_CENTER' && (
              <section aria-label="Hub hệ thống chỉ định" className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#c34c36]" />
                <div className="min-w-0 space-y-1">
                  <h4 className="font-bold text-slate-700">Hub hệ thống chỉ định</h4>
                  {quotedCenterName ? (
                    <>
                      <p className="font-bold text-slate-900">{quotedCenterName}</p>
                      {quotedCenter?.address && <p className="text-slate-700">{quotedCenter.address}</p>}
                      {centerQuote?.distanceKm != null && (
                        <p className="text-slate-500">
                          Cách địa chỉ lấy hàng {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(centerQuote.distanceKm)} km.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-600">Hệ thống chọn Hub gần nhất đủ điều kiện theo địa chỉ lấy hàng của bạn.</p>
                  )}
                </div>
              </section>
            )}

            {/* Quote Breakdown Display */}
            {isLoadingQuote ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                <span>Đang tính toán cước phí và biểu phí kiểm định...</span>
              </div>
            ) : quoteError ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{quoteError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchQuote(orderType)}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : feeDetails ? (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#c34c36]" />
                    <span>Chi tiết báo giá kiểm định (Người bán trả 100%)</span>
                  </span>
                  {quoteData?.expiresAt && (
                    <span className="text-[11px] text-slate-500">

                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Phí kiểm định thiết bị cơ sở:</span>
                    <span className="font-bold text-slate-900">{formatVND(feeDetails.baseFee)}</span>
                  </div>

                  {orderType === 'AT_HOME' ? (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Phí kỹ thuật viên di chuyển (2 chiều):</span>
                      <span className="font-bold text-slate-900">
                        {formatVND((feeDetails as any).travelFee)}
                        {(feeDetails as any).distanceKm && (
                          <span className="text-[11px] text-slate-500 ml-1">
                            (~{(feeDetails as any).distanceKm} km)
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Cước vận chuyển tới trung tâm kiểm định:</span>
                        <span className="font-bold text-slate-900">
                          {formatVND((feeDetails as any).shippingToCenter)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Dự phòng cước trả hàng về cho người bạn:</span>
                        <span className="font-bold text-slate-900">
                          {formatVND((feeDetails as any).returnReserve)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                    <span className="font-black text-slate-900">Tổng phí thanh toán từ Ví:</span>
                    <span className="font-black text-[#c34c36] text-base">
                      {formatVND(feeDetails.totalFee)}
                    </span>
                  </div>
                </div>

                {/* Consent Zin */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sellerConsentZin}
                      onChange={(e) => {
                        setSellerConsentZin(e.target.checked);
                        if (confirmError) setConfirmError(null);
                      }}
                      className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 leading-relaxed">
                      Tôi xác nhận là chủ sở hữu thiết bị và <strong>đồng ý cho Kỹ thuật viên mở máy</strong> để
                      kiểm định linh kiện zin bên trong (màn hình, bo mạch, pin, chống nước...).
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {confirmError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{confirmError}</span>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: PAY INSPECTION FEE (FROM WALLET)                             */}
        {/* =================================================================== */}
        {currentStep === 'PAY_FEE' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block font-bold">Mã đơn kiểm định</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-black text-slate-900 font-mono text-sm">#{order.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (order.id) navigator.clipboard?.writeText(order.id);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    title={lang === 'vi' ? 'Sao chép mã đơn' : 'Copy code'}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[11px] block font-bold">Thời hạn nộp phí (12h)</span>
                <span className="font-black text-rose-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {paymentDeadlineRemaining || 'Đang đếm ngược...'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Hình thức kiểm định:</span>
                <span className="font-bold text-slate-900">
                  {order.orderType === 'AT_HOME' ? 'Kiểm định tại nhà' : 'Tại trung tâm'}
                </span>
              </div>
              {order.orderType === 'AT_CENTER' && confirmedCenterAddress && (
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{order.inspectionCenterName || quotedCenterName || 'SecondLife Hub'}</p>
                  <p className="text-slate-600">{confirmedCenterAddress}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Khoản phí người bán cần nộp:</span>
                <span className="font-black text-[#c34c36] text-base">
                  {formatVND(order.sellerFeeShare || order.inspectionFee || 0)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                Số tiền sẽ được trích từ Ví SecondLife của bạn và tạm giữ trong quỹ ký quỹ cho tới khi hoàn tất
                kiểm định.
              </p>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3A: SCHEDULE AT_HOME APPOINTMENT                               */}
        {/* =================================================================== */}
        {(currentStep === 'SCHEDULE_HOME' || isRescheduling) && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <InspectionOrderFeeDetails order={order} feeDetails={feeDetails} lang={lang} />

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">{isRescheduling ? 'Đề xuất lịch kiểm định khác' : 'Thanh toán phí kiểm định thành công!'}</span>
                <span>{isRescheduling ? 'Chọn ngày và giờ mới để gửi trung tâm xác nhận.' : 'Vui lòng đặt lịch hẹn để Kỹ thuật viên sắp xếp đến kiểm tra thiết bị tận nơi.'}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn ngày hẹn kiểm định *</label>
                <input
                  type="date"
                  value={appointmentDate}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn ca làm việc *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleShiftChange('MORNING')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer ${appointmentShift === 'MORNING'
                      ? 'bg-[#c34c36] text-white border-[#c34c36] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Ca sáng (08:00 - 12:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftChange('AFTERNOON')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer ${appointmentShift === 'AFTERNOON'
                      ? 'bg-[#c34c36] text-white border-[#c34c36] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Ca chiều (13:00 - 17:00)
                  </button>
                </div>
              </div>

              {/* Step: Specific Arrival Time Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Khung giờ KTV có mặt cụ thể *' : 'Specific Inspection Time *'}</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[#c34c36] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/80">
                    {lang === 'vi' ? 'Đã chọn:' : 'Selected:'} {appointmentTime || '--:--'}
                  </span>
                </div>

                {/* Quick Time Slots (8 slots in 4 columns) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(appointmentShift === 'MORNING' ? MORNING_SLOTS : AFTERNOON_SLOTS).map((slot) => {
                    const isSelected = appointmentTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setAppointmentTime(slot);
                          setSchedulingError(null);
                        }}
                        className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${isSelected
                            ? 'bg-[#c34c36] text-white border-[#c34c36] shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>

                {/* Fine-tune custom time picker */}
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">
                      {lang === 'vi' ? 'Hoặc chỉnh giờ chi tiết:' : 'Or custom time:'}
                    </span>
                    <input
                      type="time"
                      min={INSPECTION_SHIFT_HOURS[appointmentShift].min}
                      max={INSPECTION_SHIFT_HOURS[appointmentShift].max}
                      value={appointmentTime}
                      onChange={(e) => {
                        setAppointmentTime(e.target.value);
                        setSchedulingError(null);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:border-[#c34c36] outline-none bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    ({INSPECTION_SHIFT_HOURS[appointmentShift].min} - {INSPECTION_SHIFT_HOURS[appointmentShift].max})
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú thêm cho KTV (tùy chọn)</label>
                <textarea
                  rows={2}
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  placeholder="Ví dụ: Gọi trước khi đến 15 phút, nhà có chuông bên trái cổng..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            {schedulingError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{schedulingError}</span>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3B: TRACK INSPECTION (IN PROGRESS)                             */}
        {/* =================================================================== */}
        {currentStep === 'TRACK_INSPECTION' && !isRescheduling && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <InspectionOrderFeeDetails order={order} feeDetails={feeDetails} lang={lang} />

            {/* AT_HOME Tracking Details */}
            {order.orderType === 'AT_HOME' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {hasCounter ? (lang === 'vi' ? 'Lịch bạn đã đề xuất' : 'Your proposed appointment') : (lang === 'vi' ? 'Thời gian hẹn kiểm định' : 'Inspection appointment time')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {order.appointmentScheduledAt
                      ? formatDateTime(order.appointmentScheduledAt)
                      : 'Chưa đặt lịch'}
                  </span>
                </div>
                {order.appointmentStatus === 'CONFIRMED' && (
                  <p className="font-semibold text-emerald-700">{lang === 'vi' ? 'Lịch hẹn đã xác nhận' : 'Appointment confirmed'}</p>
                )}
                {homeIntakeStage === 'awaiting_inspector' && (
                  <p className="text-slate-600">{lang === 'vi' ? 'Mã QR sẽ hiển thị khi trung tâm phân công kỹ thuật viên.' : 'The QR code will appear once the center assigns a technician.'}</p>
                )}
                {order.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && (
                  <p className="font-semibold text-amber-800">{lang === 'vi' ? 'Chờ trung tâm xác nhận lịch hẹn' : 'Awaiting center approval'}</p>
                )}
                {order.inspectorName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Kỹ thuật viên phụ trách:</span>
                    <span className="font-bold text-slate-900">{order.inspectorName}</span>
                  </div>
                )}
                {order.homeCheckedInAt && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Kỹ thuật viên đã xác nhận có mặt lúc {formatDateTime(order.homeCheckedInAt)}</span>
                  </div>
                )}
              </div>
            )}

            {homeIntakeStage === 'ready' && (
              <AtHomeIntakeBarcode orderId={order.id} lang={lang} compact format="qr" />
            )}

            {hasCounter && (
              <PreListingAppointmentCounter
                order={order} lang={lang} error={schedulingError}
                isSaving={isScheduling} isRefreshing={isRefreshing}
                onAccept={handleAcceptCounter}
                onReschedule={() => {
                  setAppointmentDate('');
                  setSchedulingError(null);
                  setIsEditingCounter(true);
                }}
              />
            )}

            {/* AT_CENTER Tracking Details */}
            {order.orderType === 'AT_CENTER' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Trung tâm kiểm định:</span>
                  <span className="font-bold text-slate-900">
                    {order.inspectionCenterName || quotedCenterName || 'SecondLife Hub'}
                  </span>
                </div>
                {confirmedCenterAddress && <p className="text-slate-600">{confirmedCenterAddress}</p>}

                <div className="space-y-2 border-t border-slate-200 pt-2">
                  <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Truck aria-hidden="true" className="size-4 text-orange-600" />
                    Chặng 1 · Gửi hàng tới Hub qua Lalamove
                  </h4>

                  {inboundShipment && (
                    <ShipmentStatusDetails
                      shipment={inboundShipment}
                      statusLabel={getInboundShipmentProgress(inboundShipment).label}
                      onOpenTracking={() => {
                        setTrackingShipmentId(inboundShipment.shipmentId);
                        setIsTrackingModalOpen(true);
                      }}
                      lang={lang}
                    />
                  )}
                  {shipmentLoadNotice && <p className="text-slate-600">{shipmentLoadNotice}</p>}
                  {canBookInbound && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-600">
                        {inboundShipment ? 'Bạn có thể tạo vận đơn mới.' : 'Chưa tạo vận đơn gửi hàng tới Hub.'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCreateInboundShipment}
                        disabled={isBookingShipment}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 px-3.5 py-1.5 font-bold text-white transition disabled:opacity-60"
                      >
                        {isBookingShipment && <Loader2 className="size-3.5 animate-spin" />}
                        <span>Gọi tài xế Lalamove</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {shipmentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{shipmentError}</span>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3C: TRACK RETURN SHIPMENT (AT_CENTER ONLY)                    */}
        {/* =================================================================== */}
        {currentStep === 'TRACK_RETURN' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <InspectionOrderFeeDetails order={order} feeDetails={feeDetails} lang={lang} />

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-sm uppercase">Thiết bị đã kiểm định đạt chuẩn</h4>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Chặng 2 · Hub gửi trả hàng cho bạn</span>
              </span>

              {returnShipment && (
                <ShipmentStatusDetails
                  shipment={returnShipment}
                  statusLabel={getHubReturnProgress(returnShipment).label}
                  onOpenTracking={() => {
                    setTrackingShipmentId(returnShipment.shipmentId);
                    setIsTrackingModalOpen(true);
                  }}
                  lang={lang}
                />
              )}
              {returnShipment && getHubReturnProgress(returnShipment).step === 3 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hàng đã được giao trả về bạn thành công! Bài đăng đã hoàn tất kiểm định và đủ điều kiện lên sàn.</span>
                  </div>
                </div>
              )}
              {shipmentLoadNotice && <p className="text-slate-600">{shipmentLoadNotice}</p>}
              {!returnShipment && !shipmentLoadNotice && (
                <p className="text-slate-600">Chờ trung tâm tạo vận đơn gửi trả hàng.</p>
              )}

              <p className="border-t border-slate-200 pt-1 text-[11px] text-slate-600">
                Sau khi hàng được giao trả, bạn có thể bấm Đăng bán để đưa tin lên sàn.
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: POST ACTIVE (SUCCESS)                                      */}
        {/* =================================================================== */}
        {currentStep === 'POST_ACTIVE' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            {/* Success Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-2xl flex items-start sm:items-center gap-3.5 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    Bài đăng đã lên sàn thành công
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5 leading-snug">
                  Sản phẩm của bạn đã hoàn tất kiểm định và gắn huy hiệu <strong>Đã kiểm định</strong> uy tín nhất sàn. Người mua có thể tìm kiếm và đặt mua ngay bây giờ.
                </p>
              </div>
            </div>

            {/* Chi tiết đơn kiểm định & quá trình giao nhận (không ẩn đi) */}
            {order && (
              <>
                <InspectionOrderFeeDetails order={order} feeDetails={feeDetails} lang={lang} />
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-slate-800">Quá trình vận chuyển & trung tâm kiểm định</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        Kiểm định đạt chuẩn
                      </span>
                    </div>
                  </div>

                  {/* AT_CENTER: Chặng 1 & Chặng 2 Lalamove */}
                  {order.orderType === 'AT_CENTER' && (
                    <div className="space-y-3 pt-0.5">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-600">Trung tâm kiểm định:</span>
                        <span className="font-bold text-slate-900">
                          {order.inspectionCenterName || quotedCenterName || 'SecondLife Hub'}
                        </span>
                      </div>

                      {/* Chặng 1: Gửi tới Hub */}
                      <div className="space-y-2 border-t border-slate-200 pt-2.5">
                        <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Truck aria-hidden="true" className="size-4 text-orange-600" />
                          Chặng 1 · Gửi hàng tới Hub qua Lalamove
                        </h4>
                        {inboundShipment ? (
                          <ShipmentStatusDetails
                            shipment={inboundShipment}
                            statusLabel={getInboundShipmentProgress(inboundShipment).label}
                            onOpenTracking={() => {
                              setTrackingShipmentId(inboundShipment.shipmentId);
                              setIsTrackingModalOpen(true);
                            }}
                            lang={lang}
                          />
                        ) : (
                          <p className="text-slate-500 italic text-[11px]">Đã hoàn tất gửi hàng đến Hub</p>
                        )}
                      </div>

                      {/* Chặng 2: Hub gửi trả hàng về Seller */}
                      <div className="space-y-2 border-t border-slate-200 pt-2.5">
                        <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
                          <RotateCcw aria-hidden="true" className="size-4 text-purple-600" />
                          Chặng 2 · Hub gửi trả hàng cho bạn
                        </h4>
                        {returnShipment ? (
                          <ShipmentStatusDetails
                            shipment={returnShipment}
                            statusLabel={getHubReturnProgress(returnShipment).label}
                            onOpenTracking={() => {
                              setTrackingShipmentId(returnShipment.shipmentId);
                              setIsTrackingModalOpen(true);
                            }}
                            lang={lang}
                          />
                        ) : (
                          <p className="text-slate-500 italic text-[11px]">Đã giao trả hàng về lại cho bạn thành công</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AT_HOME: Thông tin kiểm định tại nhà */}
                  {order.orderType === 'AT_HOME' && (
                    <div className="space-y-2 pt-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Hình thức kiểm định:</span>
                        <span className="font-bold text-slate-900">Kiểm định tại nhà (AT_HOME)</span>
                      </div>
                      {order.inspectorName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Kỹ thuật viên phụ trách:</span>
                          <span className="font-bold text-slate-900">{order.inspectorName}</span>
                        </div>
                      )}
                      {order.appointmentScheduledAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Thời gian hẹn kiểm định:</span>
                          <span className="font-bold text-slate-900">{formatDateTime(order.appointmentScheduledAt)}</span>
                        </div>
                      )}
                      {order.homeCheckedInAt && (
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Kỹ thuật viên đã kiểm định và dán tem niêm phong thiết bị tại nhà bạn</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 5: INSPECTION FAILED                                          */}
        {/* =================================================================== */}
        {currentStep === 'REQUEST_CLOSED' && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            {order?.status === 'PAYMENT_EXPIRED' ? 'Yêu cầu đã hết hạn thanh toán.' : 'Yêu cầu kiểm định đã hủy.'}
          </div>
        )}

        {currentStep === 'INSPECTION_FAILED' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            {/* Failed Banner */}
            <div className="p-4 bg-gradient-to-r from-rose-50 via-pink-50 to-rose-50 border border-rose-300 rounded-2xl flex items-start sm:items-center gap-3.5 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                    Sản phẩm không đạt tiêu chuẩn kiểm định
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                    FAILED
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5 leading-snug">
                  Sản phẩm của bạn không đáp ứng tiêu chuẩn kiểm định kỹ thuật tại SecondLife Hub. Thiết bị sẽ được Hub đóng gói hoàn trả về địa chỉ của bạn.
                </p>
                {failureReason && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-rose-200 text-rose-900 font-semibold text-[11px] leading-snug break-words">
                    <span className="font-bold text-rose-700">Lý do không đạt: </span>
                    <span>{failureReason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chi tiết đơn kiểm định & Quá trình giao nhận hoàn hàng */}
            {order && <InspectionOrderFeeDetails order={order} feeDetails={feeDetails} lang={lang} />}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <span className="font-bold text-slate-800">Quá trình hoàn trả thiết bị</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-[11px] font-bold">
                    <AlertTriangle className="size-3 text-rose-600" />
                    Kiểm định không đạt chuẩn
                  </span>
                </div>
              </div>

              {/* AT_CENTER: Chặng 1 & Chặng 2 Lalamove */}
              {order?.orderType !== 'AT_HOME' && (
                <div className="space-y-3 pt-0.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-600">Trung tâm kiểm định:</span>
                    <span className="font-bold text-slate-900">
                      {order?.inspectionCenterName || quotedCenterName || 'SecondLife Hub'}
                    </span>
                  </div>

                  {/* Chặng 1: Gửi tới Hub */}
                  <div className="space-y-2 border-t border-slate-200 pt-2.5">
                    <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Truck aria-hidden="true" className="size-4 text-orange-600" />
                      Chặng 1 · Gửi hàng tới Hub qua Lalamove
                    </h4>
                    {inboundShipment ? (
                      <ShipmentStatusDetails
                        shipment={inboundShipment}
                        statusLabel={getInboundShipmentProgress(inboundShipment).label}
                        onOpenTracking={() => {
                          setTrackingShipmentId(inboundShipment.shipmentId);
                          setIsTrackingModalOpen(true);
                        }}
                        lang={lang}
                      />
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">Đã hoàn tất gửi hàng đến Hub</p>
                    )}
                  </div>

                  {/* Chặng 2: Hub gửi trả hàng về Seller */}
                  <div className="space-y-2 border-t border-slate-200 pt-2.5">
                    <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
                      <RotateCcw aria-hidden="true" className="size-4 text-purple-600" />
                      Chặng 2 · Hub gửi trả hàng cho bạn
                    </h4>
                    {returnShipment ? (
                      <ShipmentStatusDetails
                        shipment={returnShipment}
                        statusLabel={getHubReturnProgress(returnShipment).label}
                        onOpenTracking={() => {
                          setTrackingShipmentId(returnShipment.shipmentId);
                          setIsTrackingModalOpen(true);
                        }}
                        lang={lang}
                      />
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">
                        Hub đang chuẩn bị đóng gói và điều phối tài xế Lalamove gửi hoàn trả thiết bị về địa chỉ của bạn.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* AT_HOME */}
              {order?.orderType === 'AT_HOME' && (
                <div className="space-y-2 pt-0.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Hình thức kiểm định:</span>
                    <span className="font-bold text-slate-900">Kiểm định tại nhà (AT_HOME)</span>
                  </div>
                  {order.inspectorName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Kỹ thuật viên phụ trách:</span>
                      <span className="font-bold text-slate-900">{order.inspectorName}</span>
                    </div>
                  )}
                  {order.appointmentScheduledAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Thời gian kiểm định:</span>
                      <span className="font-bold text-slate-900">{formatDateTime(order.appointmentScheduledAt)}</span>
                    </div>
                  )}
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Kỹ thuật viên đã kiểm tra thiết bị trực tiếp tại nhà và đánh giá không đạt tiêu chuẩn niêm yết sàn.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Footer Actions */}
      {currentStep !== 'INITIALIZING' && (
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-between gap-3 text-xs">
          {/* Step 1: SELECT_METHOD */}
          {currentStep === 'SELECT_METHOD' && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {lang === 'vi'
                  ? 'Bước 1: Chọn hình thức kiểm định & xác nhận báo giá.'
                  : 'Step 1: Choose inspection method & confirm quote.'}
              </span>
              <button
                type="button"
                onClick={handleConfirmQuote}
                disabled={!quoteData || !sellerConsentZin || isConfirmingQuote}
                className="px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a83c28] text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isConfirmingQuote && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{lang === 'vi' ? 'Xác nhận & Sang bước thanh toán' : 'Confirm & Proceed to Payment'}</span>
              </button>
            </>
          )}

          {/* Step 2: PAY_FEE */}
          {currentStep === 'PAY_FEE' && order && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('SELECT_METHOD');
                  setOrder(null);
                }}
                disabled={isPaying}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đổi phương án khác' : 'Change method'}
              </button>
              <button
                type="button"
                onClick={handlePayFee}
                disabled={isPaying}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isPaying && <Loader2 className="w-4 h-4 animate-spin" />}
                <CreditCard className="w-4 h-4" />
                <span>
                  {lang === 'vi'
                    ? `Thanh toán phí từ ví (${formatVND(order.sellerFeeShare || 0)})`
                    : `Pay fee from wallet (${formatVND(order.sellerFeeShare || 0)})`}
                </span>
              </button>
            </>
          )}

          {/* Step 3A: SCHEDULE_HOME or Rescheduling */}
          {(currentStep === 'SCHEDULE_HOME' || isRescheduling) && order && (
            <>
              {isRescheduling ? (
                <button
                  type="button"
                  disabled={isScheduling}
                  onClick={() => {
                    setIsEditingCounter(false);
                    setSchedulingError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                >
                  {lang === 'vi' ? 'Quay lại đề xuất' : 'Back to proposal'}
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  {lang === 'vi' ? 'Chọn ngày & giờ để KTV qua kiểm định.' : 'Select date & time for technician visit.'}
                </span>
              )}
              <button
                type="button"
                onClick={handleScheduleAppointment}
                disabled={isScheduling || isRefreshing || !appointmentDate || !appointmentTime}
                className="px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a83c28] text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isScheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                <Calendar className="w-4 h-4" />
                <span>
                  {isRescheduling
                    ? (lang === 'vi' ? 'Gửi lịch hẹn mới' : 'Send new appointment')
                    : (lang === 'vi' ? 'Xác nhận lịch hẹn kiểm định' : 'Confirm appointment')}
                </span>
              </button>
            </>
          )}

          {/* Step 3B: TRACK_INSPECTION */}
          {currentStep === 'TRACK_INSPECTION' && !isRescheduling && order && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {order.orderType === 'AT_CENTER'
                  ? (lang === 'vi' ? 'Bài được đăng sau khi kiểm định đạt, được duyệt và hàng đã giao trả cho bạn.' : 'Published after passing inspection and device returned.')
                  : (lang === 'vi' ? 'Bài được đăng sau khi kiểm định đạt và được duyệt.' : 'Published after inspection passed.')}
              </span>
              <button
                type="button"
                onClick={checkCurrentProgress}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Kiểm tra tiến độ' : 'Check progress'}</span>
              </button>
            </>
          )}

          {/* Step 3C / READY_TO_PUBLISH: TRACK_RETURN */}
          {(currentStep === 'TRACK_RETURN' || currentStep === 'READY_TO_PUBLISH') && order && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {lang === 'vi'
                  ? 'Sau khi hàng được giao trả, bạn có thể bấm Đăng bán để đưa tin lên sàn.'
                  : 'Once returned, you can publish listing.'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={checkCurrentProgress}
                  disabled={isRefreshing}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{lang === 'vi' ? 'Cập nhật trạng thái' : 'Update status'}</span>
                </button>
                {isReadyToPublish && (
                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={isPublishing || isRefreshing}
                    className="flex items-center gap-1.5 rounded-xl bg-[#c34c36] hover:bg-[#ad432f] px-4 py-2 text-xs font-black text-white shadow-md cursor-pointer disabled:opacity-60 transition"
                  >
                    {isPublishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{lang === 'vi' ? 'Đăng bán' : 'Publish listing'}</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Step 4: POST_ACTIVE */}
          {currentStep === 'POST_ACTIVE' && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {lang === 'vi'
                  ? 'Bài đăng đã có mặt trên Sàn đồ cũ với huy hiệu Xác thực bởi SecondLife.'
                  : 'Listing is now active with Verified badge.'}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-md transition cursor-pointer shrink-0"
              >
                {lang === 'vi' ? 'Về quản lý tin đăng' : 'Back to listings'}
              </button>
            </>
          )}

          {/* Step 5: INSPECTION_FAILED */}
          {currentStep === 'INSPECTION_FAILED' && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {lang === 'vi'
                  ? 'Bài đăng không thể xuất bản lên sàn. Vui lòng theo dõi quá trình hoàn trả thiết bị.'
                  : 'Cannot publish listing. Follow return progress.'}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-md transition cursor-pointer shrink-0"
              >
                {lang === 'vi' ? 'Về quản lý tin đăng' : 'Back to listings'}
              </button>
            </>
          )}

          {/* REQUEST_CLOSED */}
          {currentStep === 'REQUEST_CLOSED' && (
            <>
              <span className="text-[11px] text-slate-500 italic">
                {order?.status === 'PAYMENT_EXPIRED'
                  ? (lang === 'vi' ? 'Yêu cầu đã hết hạn thanh toán.' : 'Payment expired.')
                  : (lang === 'vi' ? 'Yêu cầu kiểm định đã hủy.' : 'Request canceled.')}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-black text-white text-xs font-bold transition cursor-pointer shrink-0"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Cửa sổ Quá Trình Giao Hàng Lalamove (Ảnh 1) */}
      {isTrackingModalOpen && trackingEscrowOrder && (
        <OrderTrackingModal
          order={trackingEscrowOrder}
          isSeller={true}
          onClose={() => {
            setIsTrackingModalOpen(false);
            setTrackingShipmentId(null);
            if (order?.id) loadOrderShipments(order.id);
          }}
          lang={lang}
          initialShipmentId={trackingShipmentId || undefined}
          onOrderUpdated={() => {
            if (order?.id) loadOrderShipments(order.id);
            void checkCurrentProgress();
          }}
        />
      )}
    </div>
  );
};
