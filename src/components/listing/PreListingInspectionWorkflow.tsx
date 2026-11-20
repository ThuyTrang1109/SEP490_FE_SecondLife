
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ExternalLink
} from 'lucide-react';
import {
  inspectorService,
  PreListingInspectionQuoteResponse,
  InspectionOrderDto
} from '../../services/inspectorService';
import { postService, PostSubmitResponse } from '../../services/postService';
import { shippingService } from '../../services/shippingService';
import { formatVND } from '../../utils/translations';
import { InspectionCenterOption, ShipmentBackend } from '../../types';

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
  | 'POST_ACTIVE'
  | 'INSPECTION_FAILED';

export const PreListingInspectionWorkflow: React.FC<PreListingInspectionWorkflowProps> = ({
  postId,
  postTitle = 'Sản phẩm giá trị cao',
  postPrice = 0,
  initialInspectionOrderId = null,
  initialNextAction = null,
  onClose,
  onPostActivated,
  lang = 'vi'
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('INITIALIZING');
  const [postStatus, setPostStatus] = useState<string>('PENDING_INSPECTION');
  const [order, setOrder] = useState<InspectionOrderDto | null>(null);
  const [orderType, setOrderType] = useState<'AT_HOME' | 'AT_CENTER'>('AT_HOME');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('AUTO');
  const [availableCenters, setAvailableCenters] = useState<InspectionCenterOption[]>([]);
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);

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
  const [appointmentNote, setAppointmentNote] = useState<string>('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);

  // AT_CENTER Shipment State
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isBookingShipment, setIsBookingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // General Loading & Status check
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. Initial State Check / Resume from DB
  // ---------------------------------------------------------------------------
  const checkCurrentProgress = useCallback(async () => {
    if (!postId) return;
    setIsRefreshing(true);
    try {
      // 1. Check current Post status
      const postDetail = await postService.getMyPostDetail(postId).catch(() => null);
      if (postDetail) {
        setPostStatus(postDetail.status);
        if (postDetail.status === 'ACTIVE') {
          setCurrentStep('POST_ACTIVE');
          if (onPostActivated) onPostActivated();
          setIsRefreshing(false);
          return;
        }
      }

      // 2. Find latest PRE_LISTING inspection order for this post
      let targetOrder: InspectionOrderDto | null = null;
      if (initialInspectionOrderId) {
        targetOrder = await inspectorService.getOrderById(initialInspectionOrderId).catch(() => null);
      }

      if (!targetOrder) {
        const sellerOrdersRes = await inspectorService.getMySellerOrders(0, 50).catch(() => null);
        const allOrders: InspectionOrderDto[] =
          (sellerOrdersRes as any)?.content ||
          (sellerOrdersRes as any)?.items ||
          (sellerOrdersRes as any)?.data ||
          (Array.isArray(sellerOrdersRes) ? sellerOrdersRes : []);

        targetOrder = allOrders.find(
          (o) => o.postId === postId && (o.inspectionScope === 'PRE_LISTING' || !o.buyerId)
        ) || null;
      }

      if (targetOrder) {
        setOrder(targetOrder);
        if (targetOrder.orderType) {
          setOrderType(targetOrder.orderType as any);
        }

        // Determine step from order status
        const st = (targetOrder.status || '').toUpperCase();
        if (st === 'WAITING_FEE_PAYMENT' || st === 'PENDING_PAYMENT') {
          setCurrentStep('PAY_FEE');
        } else if (targetOrder.orderType === 'AT_HOME') {
          if (!targetOrder.appointmentScheduledAt || targetOrder.appointmentStatus === 'REJECTED') {
            setCurrentStep('SCHEDULE_HOME');
          } else if (st === 'COMPLETED' || st === 'PASSED') {
            setCurrentStep('POST_ACTIVE');
            if (onPostActivated) onPostActivated();
          } else if (st === 'FAILED' || st === 'REJECTED') {
            setCurrentStep('INSPECTION_FAILED');
          } else {
            setCurrentStep('TRACK_INSPECTION');
          }
        } else if (targetOrder.orderType === 'AT_CENTER') {
          if (st === 'COMPLETED') {
            // AT_CENTER COMPLETED means inspection passed, now device is being returned to seller
            setCurrentStep('TRACK_RETURN');
          } else if (st === 'FAILED' || st === 'REJECTED') {
            setCurrentStep('INSPECTION_FAILED');
          } else {
            setCurrentStep('TRACK_INSPECTION');
          }
          // Fetch shipments for center orders
          loadOrderShipments(targetOrder.id);
        }
      } else {
        // No pre-listing order yet: Start at Method Selection
        if (initialNextAction === 'WAIT_FOR_LISTING_REVIEW') {
          // Handled externally or wait for review
          setCurrentStep('SELECT_METHOD');
        } else {
          setCurrentStep('SELECT_METHOD');
        }
      }
    } catch (err) {
      console.warn('[PreListingInspectionWorkflow] Progress check error:', err);
      setCurrentStep('SELECT_METHOD');
    } finally {
      setIsRefreshing(false);
    }
  }, [postId, initialInspectionOrderId, initialNextAction, onPostActivated]);

  useEffect(() => {
    checkCurrentProgress();
  }, [checkCurrentProgress]);

  // Load available inspection centers
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCenters(true);
    inspectorService
      .getAvailableCenters()
      .then((centers) => {
        if (isMounted) setAvailableCenters(centers);
      })
      .catch((err) => console.warn('Failed to load centers:', err))
      .finally(() => {
        if (isMounted) setIsLoadingCenters(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Quote Request Logic (Debounced / Triggered on method or center change)
  // ---------------------------------------------------------------------------
  const fetchQuote = useCallback(async (type: 'AT_HOME' | 'AT_CENTER', centerId: string) => {
    if (!postId) return;
    setIsLoadingQuote(true);
    setQuoteError(null);
    setQuoteData(null); // Clear displayed quote when method/center changes as required
    setSellerConsentZin(false);

    try {
      const payload = {
        orderType: type,
        inspectionCenterId: type === 'AT_CENTER' ? centerId : undefined
      };
      const res = await inspectorService.getPreListingQuote(postId, payload);
      setQuoteData(res);
    } catch (err: any) {
      console.warn('Failed to fetch pre-listing quote:', err);
      setQuoteError(
        err?.message ||
        (lang === 'vi'
          ? 'Không thể lấy báo giá kiểm định. Vui lòng thử lại sau.'
          : 'Failed to fetch inspection quote.')
      );
    } finally {
      setIsLoadingQuote(false);
    }
  }, [postId, lang]);

  // Fetch quote when entering SELECT_METHOD or changing selection
  useEffect(() => {
    if (currentStep === 'SELECT_METHOD') {
      fetchQuote(orderType, selectedCenterId);
    }
  }, [currentStep, orderType, selectedCenterId, fetchQuote]);

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
        setTimeout(() => fetchQuote(orderType, selectedCenterId), 1500);
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
        setTimeout(checkCurrentProgress, 1200);
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
  const handleScheduleAppointment = async () => {
    if (!order) return;
    if (!appointmentDate) {
      setSchedulingError(lang === 'vi' ? 'Vui lòng chọn ngày hẹn kiểm định.' : 'Please choose an appointment date.');
      return;
    }

    setIsScheduling(true);
    setSchedulingError(null);

    try {
      const isoDateTime = `${appointmentDate}T${appointmentShift === 'MORNING' ? '09:00:00' : '14:00:00'}Z`;
      const updated = await inspectorService.scheduleAppointment(
        order.id,
        isoDateTime,
        appointmentNote.trim() || undefined,
        appointmentShift
      );
      setOrder(updated);
      setCurrentStep('TRACK_INSPECTION');
    } catch (err: any) {
      console.warn('Schedule appointment error:', err);
      setSchedulingError(
        err?.message || (lang === 'vi' ? 'Không thể đặt lịch kiểm định.' : 'Failed to schedule appointment.')
      );
    } finally {
      setIsScheduling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. AT_CENTER Shipment Tracking & Creation
  // ---------------------------------------------------------------------------
  const loadOrderShipments = async (orderId: string) => {
    setIsLoadingShipments(true);
    try {
      const data = await shippingService.getInspectionShipments(orderId).catch(() => []);
      setShipments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load inspection shipments:', err);
    } finally {
      setIsLoadingShipments(false);
    }
  };

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

  const inboundShipment = useMemo(
    () => shipments.find((s) => s.leg === 'SELLER_TO_CENTER' && s.status !== 'CANCELLED'),
    [shipments]
  );

  const returnShipment = useMemo(
    () => shipments.find((s) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED'),
    [shipments]
  );

  // ---------------------------------------------------------------------------
  // Render Steps
  // ---------------------------------------------------------------------------
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-2xl w-full mx-auto animate-fadeIn text-slate-800">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-[#24263e] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Kiểm định bắt buộc trước khi đăng
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                PRE_LISTING
              </span>
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
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-300' : ''}`} />
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

      {/* Main Body */}
      <div className="p-6 space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-100 pb-3">
          <span
            className={`flex items-center gap-1.5 ${
              currentStep === 'SELECT_METHOD' ? 'text-cyan-700 font-black' : ''
            }`}
          >
            1. Chọn hình thức & Báo giá
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 ${
              currentStep === 'PAY_FEE' ? 'text-cyan-700 font-black' : ''
            }`}
          >
            2. Thanh toán phí (Ví)
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 ${
              ['SCHEDULE_HOME', 'TRACK_INSPECTION', 'TRACK_RETURN', 'POST_ACTIVE'].includes(currentStep)
                ? 'text-cyan-700 font-black'
                : ''
            }`}
          >
            3. Theo dõi & Lên sàn
          </span>
        </div>

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
                  Sản phẩm có giá trị cao hơn ngưỡng bắt buộc phải được kiểm định chất lượng phần cứng và tính năng
                  trước khi niêm yết công khai. <strong>Người bán chịu 100% chi phí kiểm định</strong>.
                </span>
              </div>
            </div>

            {/* Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setOrderType('AT_HOME')}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  orderType === 'AT_HOME'
                    ? 'border-cyan-600 bg-cyan-50/70 shadow-sm ring-2 ring-cyan-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold">
                    <Home className="w-5 h-5" />
                  </div>
                  {orderType === 'AT_HOME' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-700 text-white">
                      Đang chọn
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Kiểm định tại nhà (AT_HOME)</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Kỹ thuật viên của SecondLife sẽ đến tận địa chỉ của bạn để kiểm định máy thực tế.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('AT_CENTER')}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  orderType === 'AT_CENTER'
                    ? 'border-cyan-600 bg-cyan-50/70 shadow-sm ring-2 ring-cyan-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  {orderType === 'AT_CENTER' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-700 text-white">
                      Đang chọn
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Tại Trung tâm Hub (AT_CENTER)</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gửi máy qua Lalamove tới SecondLife Hub. Trung tâm kiểm định chuyên sâu và gửi trả lại bạn.
                  </p>
                </div>
              </button>
            </div>

            {/* If AT_CENTER: Select Center */}
            {orderType === 'AT_CENTER' && (
              <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 animate-fadeIn text-xs">
                <label className="font-bold text-slate-700 block">
                  Chọn Trung tâm Kiểm định SecondLife Hub:
                </label>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600 cursor-pointer"
                >
                  <option value="AUTO">Tự động chọn Hub gần nhất (Hệ thống điều phối tối ưu)</option>
                  {availableCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.address ? `(${c.address})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 italic">
                  Báo giá vận chuyển sẽ dùng địa chỉ lấy hàng đã lưu của bạn.
                </p>
              </div>
            )}

            {/* Quote Breakdown Display */}
            {isLoadingQuote ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
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
                  onClick={() => fetchQuote(orderType, selectedCenterId)}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : feeDetails ? (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-cyan-700" />
                    <span>Chi tiết báo giá kiểm định (Seller trả 100%)</span>
                  </span>
                  {quoteData?.expiresAt && (
                    <span className="text-[11px] text-slate-500">
                      Hiệu lực đến: <strong>{new Date(quoteData.expiresAt).toLocaleTimeString('vi-VN')}</strong>
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
                        <span>Cước vận chuyển tới Hub (Lalamove):</span>
                        <span className="font-bold text-slate-900">
                          {formatVND((feeDetails as any).shippingToCenter)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Dự phòng cước trả hàng về cho Seller:</span>
                        <span className="font-bold text-slate-900">
                          {formatVND((feeDetails as any).returnReserve)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                    <span className="font-black text-slate-900">Tổng phí thanh toán từ Ví:</span>
                    <span className="font-black text-cyan-700 text-base">
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
                      className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 leading-relaxed">
                      Tôi xác nhận là chủ sở hữu thiết bị và <strong>đồng ý cho Kỹ thuật viên mở máy</strong> để
                      kiểm định linh kiện zin bên trong (màn hình, bo mạch, pin, chống nước).
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

            {/* Confirm Action Button */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleConfirmQuote}
                disabled={!quoteData || !sellerConsentZin || isConfirmingQuote}
                className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isConfirmingQuote && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận phương án & Sang bước thanh toán</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: PAY INSPECTION FEE (FROM WALLET)                             */}
        {/* =================================================================== */}
        {currentStep === 'PAY_FEE' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block font-bold">Mã đơn kiểm định</span>
                <span className="font-black text-cyan-950 font-mono text-sm">#{order.id.slice(0, 13)}</span>
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
                  {order.orderType === 'AT_HOME' ? 'Kiểm định tại nhà (AT_HOME)' : 'Tại Trung tâm (AT_CENTER)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Khoản phí người bán cần nộp:</span>
                <span className="font-black text-cyan-700 text-base">
                  {formatVND(order.sellerFeeShare || order.inspectionFee || 0)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                Số tiền sẽ được trích từ Ví SecondLife của bạn và tạm giữ trong Quỹ Escrow cho tới khi hoàn tất
                kiểm định.
              </p>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('SELECT_METHOD');
                  setOrder(null);
                }}
                disabled={isPaying}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Đổi phương án khác
              </button>

              <button
                type="button"
                onClick={handlePayFee}
                disabled={isPaying}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isPaying && <Loader2 className="w-4 h-4 animate-spin" />}
                <CreditCard className="w-4 h-4" />
                <span>Nộp phí từ Ví vào Escrow ({formatVND(order.sellerFeeShare || 0)})</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3A: SCHEDULE AT_HOME APPOINTMENT                               */}
        {/* =================================================================== */}
        {currentStep === 'SCHEDULE_HOME' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Thanh toán phí kiểm định thành công!</span>
                <span>Vui lòng đặt lịch hẹn để Kỹ thuật viên sắp xếp đến kiểm tra thiết bị tận nơi.</span>
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn ca làm việc *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAppointmentShift('MORNING')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer ${
                      appointmentShift === 'MORNING'
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Ca Sáng (08:00 - 12:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentShift('AFTERNOON')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer ${
                      appointmentShift === 'AFTERNOON'
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Ca Chiều (13:00 - 17:00)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú thêm cho KTV (tùy chọn)</label>
                <textarea
                  rows={2}
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  placeholder="Ví dụ: Gọi trước khi đến 15 phút, nhà có chuông bên trái cổng..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-cyan-600"
                />
              </div>
            </div>

            {schedulingError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{schedulingError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleScheduleAppointment}
                disabled={isScheduling || !appointmentDate}
                className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isScheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                <Calendar className="w-4 h-4" />
                <span>Xác nhận lịch hẹn kiểm định</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3B: TRACK INSPECTION (IN PROGRESS)                             */}
        {/* =================================================================== */}
        {currentStep === 'TRACK_INSPECTION' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-cyan-900 block">
                  Đang tiến hành kiểm định ({order.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại trung tâm'})
                </span>
                <span className="text-[11px] text-cyan-800">
                  Trạng thái: <strong>{order.status}</strong>
                </span>
              </div>
              <span className="px-3 py-1 bg-cyan-600 text-white rounded-full text-[10px] font-black uppercase">
                {order.status}
              </span>
            </div>

            {/* AT_HOME Tracking Details */}
            {order.orderType === 'AT_HOME' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Thời gian hẹn kiểm định:</span>
                  <span className="font-bold text-slate-900">
                    {order.appointmentScheduledAt
                      ? formatDateTime(order.appointmentScheduledAt)
                      : 'Chưa đặt lịch'}
                  </span>
                </div>
                {order.inspectorName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Kỹ thuật viên phụ trách:</span>
                    <span className="font-bold text-slate-900">{order.inspectorName}</span>
                  </div>
                )}
                {order.homeCheckedInAt && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Kỹ thuật viên đã check-in tại nhà bạn lúc {formatDateTime(order.homeCheckedInAt)}</span>
                  </div>
                )}
              </div>
            )}

            {/* AT_CENTER Tracking Details */}
            {order.orderType === 'AT_CENTER' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Trung tâm kiểm định:</span>
                  <span className="font-bold text-slate-900">
                    {order.inspectionCenterName || 'SecondLife Hub'}
                  </span>
                </div>

                {/* Inbound Shipment (SELLER_TO_CENTER) */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-cyan-600" />
                      <span>Chặng 1: Gửi máy tới Hub (Lalamove)</span>
                    </span>
                    {inboundShipment && (
                      <span className="font-mono text-[11px] font-black text-cyan-700">
                        #{inboundShipment.orderCode || inboundShipment.shipmentId.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  {!inboundShipment ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Chưa tạo vận đơn Lalamove để giao máy tới Hub.</span>
                      <button
                        type="button"
                        onClick={handleCreateInboundShipment}
                        disabled={isBookingShipment}
                        className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        {isBookingShipment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Gọi tài xế Lalamove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Tiến trình vận đơn:</span>
                        <span className="font-bold text-emerald-700">{inboundShipment.status}</span>
                      </div>
                      {(inboundShipment.shareLink || (inboundShipment as any).trackingUrl) && (
                        <a
                          href={inboundShipment.shareLink || (inboundShipment as any).trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-700 hover:underline flex items-center gap-1 font-bold pt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Xem định vị tài xế Lalamove trực tiếp</span>
                        </a>
                      )}
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

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 italic">
                Sau khi Kỹ thuật viên kiểm định đạt chuẩn, bài đăng sẽ tự động lên sàn.
              </span>
              <button
                type="button"
                onClick={checkCurrentProgress}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Kiểm tra tiến độ</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3C: TRACK RETURN SHIPMENT (AT_CENTER ONLY)                    */}
        {/* =================================================================== */}
        {currentStep === 'TRACK_RETURN' && order && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-sm uppercase">Thiết bị đã kiểm định Đạt chuẩn! (COMPLETED)</h4>
                <p className="mt-1">
                  Kỹ thuật viên tại Hub đã hoàn tất quy trình niêm phong và dán tem kiểm định SecondLife. Thiết bị đang
                  được giao hoàn trả về địa chỉ của bạn.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Chặng 2: Hub gửi trả máy về cho bạn (CENTER_TO_SELLER)</span>
              </span>

              {returnShipment ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Mã vận đơn trả:</span>
                    <span className="font-mono font-bold text-slate-900">
                      #{returnShipment.orderCode || returnShipment.shipmentId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Trạng thái vận chuyển:</span>
                    <span className="font-bold text-purple-700">{returnShipment.status}</span>
                  </div>
                  {(returnShipment.shareLink || (returnShipment as any).trackingUrl) && (
                    <a
                      href={returnShipment.shareLink || (returnShipment as any).trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-700 hover:underline flex items-center gap-1 font-bold pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Xem hành trình tài xế giao trả</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  Trung tâm đang đóng gói kiện hàng và điều phối tài xế Lalamove trả hàng...
                </p>
              )}

              <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                Ngay khi bạn nhận lại thiết bị thành công (DELIVERED), bài đăng sẽ chính thức chuyển sang trạng thái
                ACTIVE trên sàn.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={checkCurrentProgress}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Cập nhật trạng thái</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: POST ACTIVE (SUCCESS)                                      */}
        {/* =================================================================== */}
        {currentStep === 'POST_ACTIVE' && (
          <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-3xl text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-lg font-black text-emerald-950 uppercase">
                Bài đăng đã lên sàn thành công! (ACTIVE)
              </h4>
              <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                Sản phẩm của bạn đã hoàn tất kiểm định và gắn huy hiệu <strong>Đã Kiểm Định</strong> uy tín nhất sàn.
                Người mua có thể tìm kiếm và đặt mua ngay bây giờ.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onPostActivated) onPostActivated();
                  if (onClose) onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-md transition cursor-pointer"
              >
                Về quản lý tin đăng
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 5: INSPECTION FAILED                                          */}
        {/* =================================================================== */}
        {currentStep === 'INSPECTION_FAILED' && (
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-3xl text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-base font-black text-rose-950 uppercase">
                Kiểm định không đạt chuẩn (FAILED)
              </h4>
              <p className="text-xs text-rose-800 mt-1 max-w-md mx-auto">
                Sản phẩm không đáp ứng được tiêu chuẩn chất lượng hoặc phát hiện linh kiện không zin. Bài đăng không thể
                xuất bản lên sàn.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
