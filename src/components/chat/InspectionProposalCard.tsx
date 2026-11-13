import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Coins,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  Check,
  X,
  RotateCcw,
  Wallet,
  ExternalLink,
  Truck
} from 'lucide-react';
import {
  inspectorService,
  InspectionOrderDto
} from '../../services/inspectorService';
import { walletService } from '../../services/walletService';
import { shippingService } from '../../services/shippingService';
import { Listing, Language, UserRole, EscrowOrder } from '../../types';
import { formatVND } from '../../utils/translations';
import { getCashInspectionFeeShares } from '../../utils/inspectionCashShipping';
import { getChatInspectionFees } from '../../utils/chatInspection';
import { CHAT_PRODUCT_PLACEHOLDER } from '../../utils/chatProduct';
import { getCustomerInspectionStatus } from '../../utils/inspectionPurchase';
import { CreateShipmentModal } from '../modals/CreateShipmentModal';
import {
  formatInspectionDeadline,
  isInspectionPaymentExpired,
  calculateDeadlineTimeLeft
} from '../../utils/inspectionPaymentDeadline';
import { paths } from '../../app/router/paths';
import { navigatePath } from '../../app/router/browser';

interface InspectionProposalCardProps {
  order: InspectionOrderDto;
  listing: Listing;
  isSeller: boolean;
  isBuyer: boolean;
  currentRole: UserRole;
  lang: Language;
  onOrderUpdated: (updatedOrder: InspectionOrderDto) => void;
  onRefreshOrder: (orderId: string) => Promise<void>;
  onViewDetails?: (orderId: string) => void;
}

const formatFee = (value?: number | null) => value == null ? '—' : formatVND(value);

export const InspectionProposalCard: React.FC<InspectionProposalCardProps> = ({
  order,
  listing,
  isSeller,
  isBuyer,
  currentRole,
  lang,
  onOrderUpdated,
  onRefreshOrder,
  onViewDetails,
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Seller Counter Drawer State
  const [showCounterDrawer, setShowCounterDrawer] = useState(false);
  const [counterFeePayer, setCounterFeePayer] = useState<'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50'>('BUYER_PAYS');

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Payment Confirmation State
  const [showPayConfirmModal, setShowPayConfirmModal] = useState(false);

  const status = order.status;
  const isWaitingSellerApproval = status === 'WAITING_SELLER_APPROVAL';
  const isWaitingBuyerApproval = status === 'WAITING_BUYER_APPROVAL';
  const isWaitingFeePayment = status === 'WAITING_FEE_PAYMENT';
  const isConfirmedPendingDispatch = status === 'CONFIRMED_PENDING_DISPATCH';
  const isPassed = status === 'PASSED';
  const isFailed = status === 'FAILED';
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';
  const customerStatus = getCustomerInspectionStatus(status, order.customerStatus, order.inspectorId);
  const isInspecting = ['INSPECTING', 'INSPECTION_IN_PROGRESS'].includes(customerStatus);
  const isAtHome = order.orderType === 'AT_HOME';
  const isAtCenter = order.orderType === 'AT_CENTER';

  const centerId = order.inspectionCenterId;
  const [centerResult, setCenterResult] = useState<{ id: string; name?: string } | null>(null);
  const centerName = order.inspectionCenterName || (centerResult?.id === centerId ? centerResult?.name : undefined);
  useEffect(() => {
    if (!centerId || order.inspectionCenterName) return;
    let active = true;
    void inspectorService.getAvailableCenters().then((centers) => {
      if (active) setCenterResult({ id: centerId, name: centers.find((center) => center.id === centerId)?.name });
    });
    return () => { active = false; };
  }, [centerId, order.inspectionCenterName]);

  const cashShipping = isAtCenter && order.cashShippingSimulation === true;
  const { inspection: baseInspectionFee, travel: travelFeeRoundTrip, shipping: shippingFeeToHub,
    reserve: returnReserveFee, total: totalFee } = getChatInspectionFees(order);
  const buyerFeeShare = order.buyerFeeShare;
  const sellerFeeShare = order.sellerFeeShare;
  const buyerCommitmentDeposit = order.buyerCommitmentDeposit ?? 0;
  const buyerAmount = buyerFeeShare == null ? undefined : buyerFeeShare + buyerCommitmentDeposit;
  const itemPrice = order.finalItemPrice ?? order.postPrice;
  const feePayerLabel = order.feePayer === 'BUYER_PAYS' ? 'Người mua chịu 100%'
    : order.feePayer === 'SELLER_PAYS' ? 'Người bán chịu 100%'
      : order.feePayer === 'SPLIT_50_50' ? 'Chia đôi 50% - 50%' : null;

  const myFeeToPay = isSeller ? sellerFeeShare : buyerAmount;
  const otherFeeToPay = isSeller ? buyerAmount : sellerFeeShare;
  const canPay = myFeeToPay != null && myFeeToPay > 0;
  const isMyPaymentDone = canPay && Boolean(isSeller ? order.sellerPaidAt : order.buyerPaidAt);
  const isOtherPartyPaid = otherFeeToPay === 0 || Boolean(isSeller ? order.buyerPaidAt : order.sellerPaidAt);

  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shipmentState, setShipmentState] = useState<'checking' | 'created' | 'none' | 'unavailable'>('checking');
  const [shipmentRetry, setShipmentRetry] = useState(0);
  useEffect(() => {
    if (!isSeller || !isAtCenter || !isConfirmedPendingDispatch) return;
    let active = true;
    setShipmentState('checking');
    void shippingService.getInspectionShipments(order.id, { isBackground: true }).then((shipments) => {
      if (active) setShipmentState(shipments.some((shipment) => shipment.leg === 'SELLER_TO_CENTER'
        && shipment.status !== 'CANCELLED') ? 'created' : 'none');
    }).catch(() => {
      if (active) setShipmentState('unavailable');
    });
    return () => { active = false; };
  }, [order.id, order.updatedAt, isSeller, isAtCenter, isConfirmedPendingDispatch, shipmentRetry]);

  const escrowOrderForShipment = useMemo<EscrowOrder>(() => {
    return {
      id: order.id,
      orderType: (order.orderType as any) || (isAtHome ? 'AT_HOME' : 'AT_CENTER'),
      inspectionMethod: (order.orderType as any) || (isAtHome ? 'AT_HOME' : 'AT_CENTER'),
      hasInspectionService: true,
      inspectionFeeVnd: totalFee ?? 0,
      inspectionCenterId: order.inspectionCenterId || (order as any).centerId,
      inspectionCenterName: centerName,
      listing: listing as any,
      sellerId: order.sellerId || (listing as any)?.seller?.id || (listing as any)?.sellerId,
      sellerName: order.sellerName || (listing as any)?.seller?.name || 'Người bán',
      sellerPhone: (order as any).sellerPhone,
      buyerId: order.buyerId,
      buyerName: order.buyerName || 'Người mua',
      buyerPhone: (order as any).buyerPhone,
      totalAmount: (itemPrice ?? 0) + (totalFee ?? 0),
      itemTitle: order.postTitle || listing?.title || 'Sản phẩm',
      status: (order.status as any) || 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: (order.status as any) || 'CONFIRMED_PENDING_DISPATCH',
      escrowStatus: 'CONFIRMED_PENDING_DISPATCH',
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
    } as unknown as EscrowOrder;
  }, [order, listing, isAtHome, totalFee, itemPrice, centerName]);

  // Dynamic countdown timer based on paymentDeadline
  const [timeLeft, setTimeLeft] = useState(() => calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang));
  const hasRefreshedAfterExpireRef = React.useRef(false);

  useEffect(() => {
    setTimeLeft(calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang));
    hasRefreshedAfterExpireRef.current = false;
  }, [order.paymentDeadline, lang]);

  useEffect(() => {
    if (!order.paymentDeadline || !isWaitingFeePayment) return;

    const tick = () => {
      const remaining = calculateDeadlineTimeLeft(order.paymentDeadline, Date.now(), lang);
      setTimeLeft(remaining);
      if (remaining.isExpired && !hasRefreshedAfterExpireRef.current) {
        hasRefreshedAfterExpireRef.current = true;
        // Tải lại trạng thái đơn từ BE khi tới hạn
        void onRefreshOrder(order.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.paymentDeadline, order.id, isWaitingFeePayment, lang, onRefreshOrder]);

  const isPaymentDeadlinePassed = timeLeft.isExpired || isInspectionPaymentExpired(order.paymentDeadline);

  // Navigate to decision / order detail
  const handleOpenDetail = () => {
    if (onViewDetails) {
      onViewDetails(order.id);
    } else {
      navigatePath(paths.decision(currentRole, order.id));
    }
  };

  // 1. Seller Accept
  const handleSellerAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.respondRequest(order.id, {
        action: 'ACCEPT',
        sellerConsentZin: true,
      });
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to accept inspection proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể chấp nhận đề xuất.' : 'Failed to accept proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Seller Counter
  const handleSellerCounter = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.respondRequest(order.id, {
        action: 'COUNTER',
        counterFeePayer: counterFeePayer,
      });
      setShowCounterDrawer(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to counter inspection proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể gửi đề xuất lại.' : 'Failed to send counter proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Seller or Buyer Reject
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setActionError(lang === 'vi' ? 'Vui lòng nhập lý do từ chối.' : 'Please enter rejection reason.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      let res: InspectionOrderDto;
      if (isSeller) {
        res = await inspectorService.respondRequest(order.id, {
          action: 'REJECT',
          rejectionReason: rejectReason.trim(),
        });
      } else {
        res = await inspectorService.buyerRespondRequest(order.id, {
          action: 'REJECT',
          note: rejectReason.trim(),
        });
      }
      if (!res?.note && rejectReason.trim()) {
        res = {
          ...res,
          note: isSeller ? `Người bán từ chối: ${rejectReason.trim()}` : `Người mua từ chối đề xuất: ${rejectReason.trim()}`,
        };
      }
      setShowRejectModal(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to reject proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể từ chối đề xuất.' : 'Failed to reject proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Buyer Accept Counter
  const handleBuyerAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.buyerRespondRequest(order.id, {
        action: 'ACCEPT',
        buyerConsentZin: true,
      });
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to accept counter proposal:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể chấp thuận đề xuất.' : 'Failed to accept proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 4.5 Buyer Counter
  const handleBuyerCounter = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await inspectorService.buyerRespondRequest(order.id, {
        action: 'COUNTER',
        counterFeePayer: counterFeePayer,
      });
      setShowCounterDrawer(false);
      onOrderUpdated(res);
    } catch (err: any) {
      console.warn('Failed to counter inspection proposal as buyer:', err);
      setActionError(err?.message || (lang === 'vi' ? 'Không thể gửi đề xuất lại.' : 'Failed to send counter proposal.'));
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Pay Fee via Wallet
  const handlePayFee = async () => {
    if (!isWaitingFeePayment || !canPay || isMyPaymentDone) return;
    if (isPaymentDeadlinePassed) {
      setActionError(
        lang === 'vi'
          ? `Đã hết hạn đóng phí kiểm định (${formatInspectionDeadline(order.paymentDeadline, lang)}). Đơn hàng không thể thanh toán tiếp.`
          : `Inspection fee payment deadline has expired (${formatInspectionDeadline(order.paymentDeadline, lang)}).`
      );
      setShowPayConfirmModal(false);
      void onRefreshOrder(order.id);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const fresh = await inspectorService.payInspectionFee(order.id);
      setShowPayConfirmModal(false);
      onOrderUpdated(fresh);
      try {
        await walletService.getMyWallet();
      } catch { }
    } catch (err: any) {
      console.warn('Failed to pay inspection fee:', err);
      const msg =
        err?.message ||
        (lang === 'vi' ? 'Không thể thanh toán phí kiểm định từ ví. Vui lòng kiểm tra số dư ví.' : 'Failed to pay fee from wallet.');
      setActionError(msg);
      // Nếu API thanh toán báo quá hạn, dùng thông báo BE và cập nhật đơn
      void onRefreshOrder(order.id);
    } finally {
      setActionLoading(false);
    }
  };

  // Preview numbers for Seller Counter option
  const shippingPaidDirectly = cashShipping ? shippingFeeToHub : 0;
  const preview = totalFee != null && shippingPaidDirectly != null
    ? getCashInspectionFeeShares(totalFee, shippingPaidDirectly, counterFeePayer) : null;
  const previewHalf = totalFee != null && shippingPaidDirectly != null
    ? getCashInspectionFeeShares(totalFee, shippingPaidDirectly, 'SPLIT_50_50') : null;
  const sellerOnlyPreview = totalFee != null && shippingPaidDirectly != null ? totalFee - shippingPaidDirectly : undefined;

  return (
    <div className="flex justify-center my-3 animate-fadeIn w-full">
      <div
        className={`max-w-lg w-full rounded-2xl border p-4 shadow-sm text-left transition-all relative overflow-hidden ${isPassed || isConfirmedPendingDispatch
          ? 'bg-gradient-to-b from-emerald-50/70 to-white border-emerald-300'
          : isRejected || isCancelled
            ? 'bg-gradient-to-b from-rose-50/70 to-white border-rose-200'
            : isWaitingFeePayment
              ? 'bg-gradient-to-b from-amber-50/80 to-white border-amber-300'
              : 'bg-gradient-to-b from-blue-50/70 via-[#fbfdff] to-white border-blue-200'
          }`}
      >
        {/* TOP STATUS BAR */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block">
                {lang === 'vi' ? 'Đề xuất kiểm định' : 'Inspection proposal'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Mã đơn: #{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${isWaitingSellerApproval
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : isWaitingBuyerApproval
                ? 'bg-purple-100 text-purple-800 border-purple-300'
                : isWaitingFeePayment
                  ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  : isConfirmedPendingDispatch
                    ? 'bg-teal-100 text-teal-900 border-teal-300'
                    : isPassed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isFailed || isRejected || isCancelled
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}
          >
            {isWaitingSellerApproval && (lang === 'vi' ? (isSeller ? 'Chờ bạn duyệt đề xuất' : 'Chờ người bán duyệt') : (isSeller ? 'Awaiting your approval' : 'Waiting for seller approval'))}
            {isWaitingBuyerApproval && (lang === 'vi' ? (isBuyer ? 'Chờ bạn phản hồi đề xuất' : 'Chờ người mua duyệt lại') : (isBuyer ? 'Awaiting your response' : 'Waiting for buyer approval'))}
            {isWaitingFeePayment && (lang === 'vi' ? 'Chờ nộp phí kiểm định' : 'Waiting for payment')}
            {isConfirmedPendingDispatch && (lang === 'vi' ? 'Đã thu đủ phí' : 'Fees collected')}
            {isInspecting && (lang === 'vi' ? 'Đang kiểm định' : 'Inspection in progress')}
            {status === 'SHIPPING_TO_CENTER' && (lang === 'vi' ? 'Đang gửi hàng đến Hub' : 'Shipping to Hub')}
            {isPassed && (lang === 'vi' ? 'Kiểm định đạt chuẩn' : 'Passed')}
            {isFailed && (lang === 'vi' ? 'Không đạt chuẩn' : 'Failed')}
            {isRejected && (lang === 'vi' ? 'Đã từ chối' : 'Rejected')}
            {isCancelled && (lang === 'vi' ? 'Đã hủy' : 'Cancelled')}
            {status === 'PAYMENT_EXPIRED' && (lang === 'vi' ? 'Hết hạn nộp phí' : 'Payment expired')}
            {status === 'DELIVERING_TO_BUYER' && (lang === 'vi' ? 'Đã thanh toán tiền hàng' : 'Product payment received')}
            {status === 'COMPLETED' && (lang === 'vi' ? 'Đã hoàn thành' : 'Completed')}
          </span>
        </div>

        {/* PRODUCT & CENTER INFO */}
        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-3 text-xs space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={order.postImageUrl || order.postImageUrls?.[0] || listing.photos?.front || CHAT_PRODUCT_PLACEHOLDER}
              alt={order.postTitle || listing.title}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h5 className="font-extrabold text-slate-900 truncate text-[11px] sm:text-xs">
                {order.postTitle || listing.title}
              </h5>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-[#c34c36]">
                  {formatFee(itemPrice)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">| Tiền sản phẩm</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {centerName || (centerId && centerResult?.id !== centerId
                  ? (lang === 'vi' ? 'Đang tải tên trung tâm…' : 'Loading center name…')
                  : (lang === 'vi' ? 'Chưa có tên trung tâm' : 'Center name unavailable'))}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-[10px] pl-5">
              <span>Hình thức:</span>
              <strong className="text-slate-700">
                {isAtHome ? 'Kiểm định tại nhà' : isAtCenter ? 'Đưa đến trung tâm kiểm định Hub' : 'Chưa có thông tin'}
              </strong>
            </div>
          </div>
        </div>

        {/* FEE BREAKDOWN GRID */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-2.5 text-xs mb-3 shadow-2xs">
          <div className="flex justify-between items-center text-slate-700 font-bold border-b border-slate-100 pb-2">
            <span className="text-xs">{lang === 'vi' ? 'Chi tiết các khoản phí kiểm định:' : 'Inspection fee breakdown:'}</span>
            {feePayerLabel && <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{feePayerLabel}</span>}
          </div>

          {/* Sub-fees */}
          <div className="space-y-1.5 text-[11px] text-slate-600">
            {isAtHome ? (
              <>
                <div className="flex justify-between items-center">
                  <span>• {lang === 'vi' ? 'Phí kiểm định cơ sở:' : 'Base inspection fee:'}</span>
                  <span className="font-semibold text-slate-800">{formatFee(baseInspectionFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• {lang === 'vi' ? 'Phí di chuyển KTV đến nhà:' : 'Technician travel fee:'}</span>
                  <span className="font-semibold text-slate-800">{formatFee(travelFeeRoundTrip)}</span>
                </div>
              </>
            ) : isAtCenter ? (
              <>
                <div className="flex justify-between items-center">
                  <span>• Phí kiểm định cơ sở:</span>
                  <span className="font-semibold text-slate-800">{formatFee(baseInspectionFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Cước Lalamove giao Hub:</span>
                  <span className="font-semibold text-slate-800">{formatFee(shippingFeeToHub)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Dự phòng hoàn hàng (hoàn lại nếu Đạt):</span>
                  <span className="font-semibold text-slate-800">{formatFee(returnReserveFee)}</span>
                </div>
                <div className="text-[10px] text-slate-500 italic bg-blue-50/50 p-1.5 rounded-lg border border-blue-100/70 leading-snug">
                  ℹ️ {lang === 'vi'
                    ? 'Khoản dự phòng cước trả về sẽ được hoàn nếu Buyer mua tiếp hoặc hoàn phần dư sau khi đối soát cước trả hàng.'
                    : 'Return reserve is refunded if Buyer completes purchase or residual balance refunded after reconciliation.'}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-black">
            <span className="text-slate-800 text-xs">• {cashShipping ? 'Tổng dự toán' : lang === 'vi' ? 'Tổng phí kiểm định:' : 'Total fee:'}</span>
            <strong className="text-blue-900 font-black text-sm sm:text-base">{formatFee(totalFee)}</strong>
          </div>

          {cashShipping && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              <strong>Mô phỏng Sandbox</strong> · Cước seller ứng khi giao {formatFee(shippingFeeToHub)} (dự kiến)
            </p>
          )}
          {/* Split cards */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <span className="text-[10px] text-slate-500 block">{cashShipping ? 'Buyer nộp trước' : lang === 'vi' ? 'Người mua trả:' : 'Buyer pays:'}</span>
              <span className="font-black text-xs sm:text-sm text-[#c34c36]">{formatFee(buyerFeeShare)}</span>
              {buyerCommitmentDeposit > 0 && (
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  + Cọc: <strong>{formatFee(buyerCommitmentDeposit)}</strong>
                </span>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block">{cashShipping ? 'Seller nộp trước' : lang === 'vi' ? 'Người bán chịu:' : 'Seller share:'}</span>
              <span className="font-black text-xs sm:text-sm text-slate-800">{formatFee(sellerFeeShare)}</span>
            </div>
          </div>

          {/* 2-Stage Payment Roadmap */}
          <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 1 (Thu trước):</span>
              <span className="font-bold text-slate-800">Buyer nộp trước {formatFee(buyerAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 2 (Sau khi máy ĐẠT):</span>
              <span className="font-bold text-emerald-800">Tiền sản phẩm {formatFee(itemPrice)}</span>
            </div>
          </div>

          {/* Zin loss notice */}
          {order.buyerConsentZin === true && <div className="text-[10px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 leading-snug">
            ✓ <strong>Quy trình tháo máy:</strong> Đã đồng ý mở máy kiểm tra chuyên sâu sẽ mất trạng thái tem zin của nhà sản xuất (Nếu có).
          </div>}
        </div>

        {/* ACTION / NOTIFICATION AREA BASED ON STATUS */}
        {actionError && (
          <div className="p-2.5 mb-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
          </div>
        )}

        {/* 1. STATUS: WAITING_SELLER_APPROVAL */}
        {isWaitingSellerApproval && (
          <div className="space-y-2 pt-1">
            {isSeller ? (
              <>
                <p className="text-[11px] text-slate-700 font-medium">
                  {lang === 'vi'
                    ? 'Người mua đề xuất kiểm định sản phẩm trước khi chốt đơn. Bạn có đồng ý với phương án chia phí này không?'
                    : 'Buyer proposed inspecting item before final purchase. Do you agree with this fee split?'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Đồng ý */}
                  <button
                    type="button"
                    onClick={handleSellerAccept}
                    disabled={actionLoading}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng ý' : 'Accept'}</span>}
                  </button>

                  {/* Đề xuất lại */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !showCounterDrawer;
                      setShowCounterDrawer(nextOpen);
                      if (nextOpen) {
                        if (order.feePayer === 'SPLIT_50_50') {
                          setCounterFeePayer('BUYER_PAYS');
                        } else if (order.feePayer === 'BUYER_PAYS') {
                          setCounterFeePayer('SPLIT_50_50');
                        } else {
                          setCounterFeePayer('SPLIT_50_50');
                        }
                      }
                      setShowRejectModal(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="flex-1 min-w-[110px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Đề xuất lại' : 'Counter'}</span>
                  </button>

                  {/* Từ chối */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(true);
                      setShowCounterDrawer(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Từ chối' : 'Reject'}</span>
                  </button>
                </div>

                {/* Seller Counter Drawer */}
                {showCounterDrawer && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-indigo-950">
                        {lang === 'vi' ? 'Chọn phương án chia phí muốn đề xuất lại:' : 'Choose counter fee split:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('BUYER_PAYS')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'BUYER_PAYS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Buyer 100%</div>
                        <div className="text-[9px] opacity-80 mt-0.5">0 đ</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('SPLIT_50_50')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'SPLIT_50_50'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Chia 50/50</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatFee(previewHalf?.seller)}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('SELLER_PAYS')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'SELLER_PAYS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Seller 100%</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatFee(sellerOnlyPreview)}</div>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span>{cashShipping ? 'Seller nộp trước' : 'Người bán (Bạn) chịu:'} <strong>{formatFee(preview?.seller)}</strong></span>
                      <span>{cashShipping ? 'Buyer nộp trước' : 'Người mua chịu:'} <strong>{formatFee(preview?.buyer)}</strong></span>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSellerCounter}
                        disabled={actionLoading}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Xác nhận đề xuất lại </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-blue-800 font-medium bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{lang === 'vi' ? 'Đã gửi đề xuất cho người bán, đang chờ phản hồi...' : 'Proposal sent, waiting for seller response...'}</span>
              </p>
            )}
          </div>
        )}

        {/* 2. STATUS: WAITING_BUYER_APPROVAL */}
        {isWaitingBuyerApproval && (
          <div className="space-y-2 pt-1">
            {isBuyer ? (
              <>
                <p className="text-[11px] text-purple-900 font-medium">
                  {lang === 'vi'
                    ? 'Người bán đã đề xuất lại phương án chia phí kiểm định. Bạn có đồng ý với phương án này không?'
                    : 'Seller countered the fee split proposal. Do you accept this counter offer?'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Đồng ý */}
                  <button
                    type="button"
                    onClick={handleBuyerAccept}
                    disabled={actionLoading}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng ý ' : 'Accept Counter'}</span>}
                  </button>

                  {/* Đề xuất lại */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !showCounterDrawer;
                      setShowCounterDrawer(nextOpen);
                      if (nextOpen) {
                        if (order.feePayer === 'SPLIT_50_50') {
                          setCounterFeePayer('BUYER_PAYS');
                        } else if (order.feePayer === 'BUYER_PAYS') {
                          setCounterFeePayer('SPLIT_50_50');
                        } else {
                          setCounterFeePayer('SPLIT_50_50');
                        }
                      }
                      setShowRejectModal(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Đề xuất lại' : 'Counter'}</span>
                  </button>

                  {/* Từ chối */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(true);
                      setShowCounterDrawer(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Từ chối' : 'Reject'}</span>
                  </button>
                </div>

                {/* Buyer Counter Drawer */}
                {showCounterDrawer && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-indigo-950">
                        {lang === 'vi' ? 'Chọn phương án chia phí muốn đề xuất lại:' : 'Choose counter fee split:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('BUYER_PAYS')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'BUYER_PAYS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Buyer 100%</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatFee(totalFee)}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('SPLIT_50_50')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'SPLIT_50_50'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Chia 50/50</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatFee(previewHalf?.buyer)}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('SELLER_PAYS')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${counterFeePayer === 'SELLER_PAYS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                      >
                        <div>Seller 100%</div>
                        <div className="text-[9px] opacity-80 mt-0.5">0 đ</div>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span>{cashShipping ? 'Buyer nộp trước' : 'Người mua (Bạn) trả:'} <strong>{formatFee(preview?.buyer)}</strong></span>
                      <span>{cashShipping ? 'Seller nộp trước' : 'Người bán chịu:'} <strong>{formatFee(preview?.seller)}</strong></span>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCounterDrawer(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBuyerCounter}
                        disabled={actionLoading}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{lang === 'vi' ? 'Xác nhận đề xuất lại' : 'Confirm Counter'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-purple-900 font-medium bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{lang === 'vi' ? 'Đã gửi đề xuất lại chia phí, đang chờ người mua xác nhận...' : 'Counter proposal sent, waiting for buyer response...'}</span>
              </p>
            )}
          </div>
        )}

        {/* 3. STATUS: WAITING_FEE_PAYMENT */}
        {isWaitingFeePayment && (
          <div className="space-y-2.5 pt-1">
            <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${isPaymentDeadlinePassed
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
              <div className="font-bold flex items-center justify-between flex-wrap gap-1">
                <span>{lang === 'vi' ? 'Đã thống nhất phương án chia phí!' : 'Fee split agreed!'}</span>
                {order.paymentDeadline && (
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${isPaymentDeadlinePassed ? 'text-rose-700' : 'text-amber-800'
                    }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'vi' ? 'Hạn:' : 'Due:'} {formatInspectionDeadline(order.paymentDeadline, lang)}
                    </span>
                    {!isPaymentDeadlinePassed && timeLeft.formattedRemaining && (
                      <span className="font-bold text-[#c34c36] bg-amber-100/80 px-1.5 py-0.5 rounded text-[10px]">
                        (còn {timeLeft.formattedRemaining})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {isPaymentDeadlinePassed ? (
                <div className="p-2 rounded-lg bg-rose-100/70 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {lang === 'vi'
                      ? `Đã hết hạn đóng phí kiểm định (${formatInspectionDeadline(order.paymentDeadline, lang)}). Đơn hàng không thể thanh toán tiếp.`
                      : `Inspection fee payment deadline has expired (${formatInspectionDeadline(order.paymentDeadline, lang)}).`}
                  </span>
                </div>
              ) : myFeeToPay == null ? (
                <p className="text-slate-700">{lang === 'vi' ? 'Chưa có số tiền phải nộp từ hệ thống.' : 'Payment amount unavailable.'}</p>
              ) : myFeeToPay === 0 ? (
                <div className="space-y-1">
                  <p className="text-blue-700 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? `Phần phí của bạn là 0 ₫ (${isSeller ? 'Người mua' : 'Người bán'} chịu 100% phí kiểm định)`
                        : `Your share is 0 VND (${isSeller ? 'Buyer' : 'Seller'} covers 100% inspection fee)`}
                    </span>
                  </p>
                  {!isOtherPartyPaid && otherFeeToPay != null && (
                    <p className="text-amber-800 text-[11px] flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                      <span>
                        {lang === 'vi'
                          ? `Đang chờ ${isSeller ? 'người mua' : 'người bán'} nộp ${formatFee(otherFeeToPay)} vào Escrow.`
                          : `Awaiting ${isSeller ? 'buyer' : 'seller'} to pay ${formatFee(otherFeeToPay)} into Escrow.`}
                      </span>
                    </p>
                  )}
                </div>
              ) : isMyPaymentDone ? (
                <div className="space-y-1">
                  <p className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? `Bạn đã thanh toán phí kiểm định (${formatFee(myFeeToPay)}) thành công.`
                        : `You have completed your fee payment (${formatFee(myFeeToPay)}).`}
                    </span>
                  </p>
                  {!isOtherPartyPaid && otherFeeToPay != null && (
                    <p className="text-amber-800 text-[11px] flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                      <span>
                        {lang === 'vi'
                          ? `Đang chờ ${isSeller ? 'người mua' : 'người bán'} nộp phần phí còn lại (${formatFee(otherFeeToPay)}).`
                          : `Awaiting ${isSeller ? 'buyer' : 'seller'} to pay remaining fee (${formatFee(otherFeeToPay)}).`}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-amber-900 text-[11px]">
                  {lang === 'vi' ? 'Số tiền bạn cần nộp vào Escrow:' : 'Amount to pay into Escrow:'}{' '}
                  <strong className="text-[#c34c36] font-black text-sm">{formatFee(myFeeToPay)}</strong>
                </p>
              )}
            </div>

            {/* Nút thanh toán nếu tôi chưa trả */}
            {!isMyPaymentDone && canPay && (
              isPaymentDeadlinePassed ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-300 cursor-not-allowed"
                >
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span>{lang === 'vi' ? 'Đã Hết Hạn Đóng Phí Kiểm Định' : 'Payment Deadline Expired'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPayConfirmModal(true)}
                  disabled={actionLoading || isPaymentDeadlinePassed}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-[#c34c36] hover:opacity-95 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-md cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {lang === 'vi'
                      ? `Thanh toán phí kiểm định (${formatFee(myFeeToPay)})`
                      : `Pay Inspection Fee (${formatFee(myFeeToPay)})`}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {/* 4. STATUS: CONFIRMED_PENDING_DISPATCH */}
        {isConfirmedPendingDispatch && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-teal-700" />
              <span>{lang === 'vi' ? 'Đã thu đủ phí kiểm định' : 'Fees collected'}</span>
            </div>
            <p className="text-[11px] text-teal-800 leading-relaxed">
              {isAtHome
                ? (lang === 'vi' ? 'Chờ trung tâm điều phối kỹ thuật viên.' : 'Waiting for technician dispatch.')
                : (lang === 'vi' ? 'Chờ điều phối vận chuyển đến trung tâm kiểm định.' : 'Waiting for shipment to the inspection center.')}
            </p>

            {/* Nút Tạo Vận Đơn Lalamove dành cho Người bán */}
            {isSeller && isAtCenter && (
              shipmentState === 'created' ? (
                <div className="mt-2 py-2 px-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-800 font-bold text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{lang === 'vi' ? 'Đã tạo vận đơn Lalamove' : 'Lalamove shipment created'}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded-md border border-emerald-200">
                    {lang === 'vi' ? 'Chặng 1' : 'Leg 1'}
                  </span>
                </div>
              ) : shipmentState === 'none' ? (
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(true)}
                  className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Truck className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Shipment'}</span>
                </button>
              ) : (
                <p role="status" className="mt-2 text-[11px] text-slate-600">
                  {shipmentState === 'checking'
                    ? (lang === 'vi' ? 'Đang tải vận đơn…' : 'Loading shipment…')
                    : (lang === 'vi' ? 'Chưa tải được vận đơn' : 'Shipment unavailable')}
                  {shipmentState === 'unavailable' && (
                    <button type="button" className="ml-2 font-semibold underline" onClick={() => setShipmentRetry((previous) => previous + 1)}>
                      {lang === 'vi' ? 'Thử lại' : 'Retry'}
                    </button>
                  )}
                </p>
              )
            )}
          </div>
        )}

        {/* 5. STATUS: PASSED / FAILED / REJECTED */}
        {isPassed && (
          <p className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{lang === 'vi' ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Bạn có thể mua tiếp.' : 'Passed inspection.'}</span>
          </p>
        )}
        {isFailed && (
          <p className="text-xs text-rose-800 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{lang === 'vi' ? 'Sản phẩm kiểm định không đạt.' : 'Inspection failed.'}</span>
          </p>
        )}
        {(isRejected || isCancelled) && (
          <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900 animate-fadeIn">
            <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isCancelled
                  ? (lang === 'vi' ? 'Đề xuất kiểm định đã bị hủy' : 'Inspection proposal cancelled')
                  : (lang === 'vi' ? 'Đề xuất kiểm định đã bị từ chối' : 'Inspection proposal rejected')}
              </span>
            </div>
            {(order.note || (order as any).rejectionReason || (order as any).rejectReason) ? (
              <div className="text-[11px] text-rose-800 bg-white/90 p-2 rounded-lg border border-rose-200/80 leading-relaxed font-medium">
                <strong>{lang === 'vi' ? 'Lý do:' : 'Reason:'}</strong>{' '}
                {order.note || (order as any).rejectionReason || (order as any).rejectReason}
              </div>
            ) : (
              <p className="text-[11px] text-rose-600 italic">
                {lang === 'vi' ? '(Không có lý do chi tiết)' : '(No reason specified)'}
              </p>
            )}
          </div>
        )}

        {/* FOOTER: NÚT XEM CHI TIẾT KIỂM ĐỊNH */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">SecondLife Inspection Hub</span>
          <button
            type="button"
            onClick={handleOpenDetail}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition hover:underline"
          >
            <span>{lang === 'vi' ? 'Xem chi tiết kiểm định' : 'View Inspection Details'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODAL NHẬP LÝ DO TỪ CHỐI */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{lang === 'vi' ? 'Từ chối đề xuất kiểm định' : 'Reject Inspection Proposal'}</span>
              </h4>
              <p className="text-xs text-slate-600 leading-snug">
                {lang === 'vi'
                  ? 'Vui lòng cung cấp lý do bạn từ chối đề xuất này để thông báo cho đối phương:'
                  : 'Please state the reason for rejecting this proposal:'}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={lang === 'vi' ? 'Nhập lý do từ chối...' : 'Enter rejection reason...'}
                rows={3}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-rose-500 bg-slate-50"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Xác nhận từ chối</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XÁC NHẬN NỘP PHÍ QUA VÍ */}
        {showPayConfirmModal && isWaitingFeePayment && canPay && !isMyPaymentDone && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-orange-600" />
                <span>{lang === 'vi' ? 'Xác nhận nộp phí kiểm định' : 'Confirm fee payment'}</span>
              </h4>
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">{lang === 'vi' ? 'Số tiền nộp:' : 'Amount:'}</span>
                  <strong className="text-[#c34c36] font-black text-sm">{formatFee(myFeeToPay)}</strong>
                </div>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  {lang === 'vi' ? 'Phương thức: Trừ tiền tự động từ Ví khả dụng SecondLife' : 'Method: Auto-deduct from SecondLife Wallet'}
                </div>
                {order.paymentDeadline && (
                  <div className={`text-[10px] pt-0.5 font-medium ${isPaymentDeadlinePassed ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                    {lang === 'vi' ? 'Hạn thanh toán:' : 'Payment deadline:'} {formatInspectionDeadline(order.paymentDeadline, lang)}
                    {isPaymentDeadlinePassed && (lang === 'vi' ? ' (Đã quá hạn)' : ' (Expired)')}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                {isPaymentDeadlinePassed
                  ? (lang === 'vi'
                    ? 'Đơn hàng này đã quá thời hạn nộp phí kiểm định. Không thể tiếp tục trừ ví.'
                    : 'Payment deadline has expired for this inspection order.')
                  : (lang === 'vi'
                    ? 'Số tiền sẽ được ký quỹ Escrow an toàn. Bạn có muốn tiến hành thanh toán ngay?'
                    : 'The amount will be held in Escrow safely. Do you wish to proceed?')}
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPayConfirmModal(false)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isPaymentDeadlinePassed ? (lang === 'vi' ? 'Đóng' : 'Close') : (lang === 'vi' ? 'Hủy' : 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handlePayFee}
                  disabled={actionLoading || isPaymentDeadlinePassed}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-[#c34c36] hover:opacity-95 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{isPaymentDeadlinePassed ? (lang === 'vi' ? 'Đã Hết Hạn' : 'Expired') : (lang === 'vi' ? 'Xác nhận thanh toán' : 'Confirm Payment')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tạo Vận Đơn Vận Chuyển Lalamove (dành cho Người bán) */}
        {showShipmentModal && isConfirmedPendingDispatch && isSeller && isAtCenter && (
          <CreateShipmentModal
            order={escrowOrderForShipment}
            onClose={() => setShowShipmentModal(false)}
            onShipmentCreated={() => {
              setShowShipmentModal(false);
              setShipmentState('created');
              void onRefreshOrder(order.id);
            }}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
};

