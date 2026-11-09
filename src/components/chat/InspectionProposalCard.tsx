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
import { Listing, Language, UserRole } from '../../types';
import { formatVND } from '../../utils/translations';
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
  currentUserId?: string;
  isSeller: boolean;
  isBuyer: boolean;
  currentRole: UserRole;
  lang: Language;
  onOrderUpdated: (updatedOrder: InspectionOrderDto) => void;
  onViewDetails?: (orderId: string) => void;
}

export const InspectionProposalCard: React.FC<InspectionProposalCardProps> = ({
  order,
  listing,
  currentUserId,
  isSeller,
  isBuyer,
  currentRole,
  lang,
  onOrderUpdated,
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

  // Status flags
  const status = order.status;
  const isWaitingSellerApproval = status === 'WAITING_SELLER_APPROVAL';
  const isWaitingBuyerApproval = status === 'WAITING_BUYER_APPROVAL';
  const isWaitingFeePayment = status === 'WAITING_FEE_PAYMENT';
  const isConfirmedPendingDispatch = status === 'CONFIRMED_PENDING_DISPATCH';
  const isPassed = status === 'PASSED';
  const isFailed = status === 'FAILED';
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';

  // Resolve prefill data from sessionStorage if order fields are missing
  const prefill = useMemo(() => {
    try {
      const postId = order.postId || listing?.id;
      if (!postId) return null;
      const raw = sessionStorage.getItem(`secondlife_inspection_prefill_${postId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [order.postId, listing?.id]);

  // Center Name
  const [centerName, setCenterName] = useState<string>(() => {
    return (order as any).centerName || (order as any).inspectionCenterName || prefill?.centerName || '';
  });

  useEffect(() => {
    if (centerName) return;
    const centerId = order.inspectionCenterId || (order as any).centerId || prefill?.centerId;
    if (centerId) {
      inspectorService.getInspectionCenters().then((centers) => {
        const found = centers.find((c) => c.id === centerId || c.id.toLowerCase() === centerId.toLowerCase());
        if (found?.name) {
          setCenterName(found.name);
        } else {
          setCenterName('Trung Tâm Kiểm Định Chính Thành phố Hồ Chí Minh');
        }
      }).catch(() => {
        setCenterName('Trung Tâm Kiểm Định Chính Thành phố Hồ Chí Minh');
      });
    } else {
      setCenterName('Trung Tâm Kiểm Định Chính Thành phố Hồ Chí Minh');
    }
  }, [order.inspectionCenterId, centerName, prefill?.centerId]);

  // Sub-fees
  const baseInspectionFee = order.inspectionFee || (order as any).baseInspectionFee || prefill?.baseInspectionFee || 166000;
  const shippingFeeToHub = order.shippingFee || (order as any).shippingToCenterFee || prefill?.shippingToCenterFee || 340000;
  const returnReserveFee = order.returnShippingReserveFee || (order as any).returnReserveFee || prefill?.returnShippingReserveFee || 391000;
  const calculatedTotalFee = baseInspectionFee + shippingFeeToHub + returnReserveFee;
  const totalFee =
    order.inspectionFee !== undefined && order.shippingFee !== undefined && order.returnShippingReserveFee !== undefined && (order.inspectionFee + order.shippingFee + order.returnShippingReserveFee) > 0
      ? order.inspectionFee + order.shippingFee + order.returnShippingReserveFee
      : (order.inspectionFee && order.inspectionFee > 0 ? order.inspectionFee : calculatedTotalFee);

  const buyerFeeShare = order.buyerFeeShare ?? (order.feePayer === 'BUYER_PAYS' ? totalFee : order.feePayer === 'SELLER_PAYS' ? 0 : Math.round(totalFee / 2));
  const sellerFeeShare = order.sellerFeeShare ?? (totalFee - buyerFeeShare);
  const buyerCommitmentDeposit = order.buyerCommitmentDeposit || 0;

  // Payment role checks
  const myFeeToPay = isSeller ? sellerFeeShare : buyerFeeShare + buyerCommitmentDeposit;
  const isMyPaymentDone = isSeller ? Boolean(order.sellerPaidAt) : Boolean(order.buyerPaidAt);

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
        inspectorService.getOrder(order.id)
          .then((fresh) => {
            if (fresh) onOrderUpdated(fresh);
          })
          .catch((err) => console.warn('Could not refresh order after deadline expired:', err));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.paymentDeadline, order.id, isWaitingFeePayment, lang, onOrderUpdated]);

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

  // 5. Pay Fee via Wallet
  const handlePayFee = async () => {
    if (isPaymentDeadlinePassed) {
      setActionError(
        lang === 'vi'
          ? `Đã hết hạn đóng phí kiểm định (${formatInspectionDeadline(order.paymentDeadline, lang)}). Đơn hàng không thể thanh toán tiếp.`
          : `Inspection fee payment deadline has expired (${formatInspectionDeadline(order.paymentDeadline, lang)}).`
      );
      setShowPayConfirmModal(false);
      inspectorService.getOrder(order.id)
        .then((fresh) => {
          if (fresh) onOrderUpdated(fresh);
        })
        .catch(() => {});
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await inspectorService.payInspectionFee(order.id);
      const fresh = await inspectorService.getOrder(order.id);
      try {
        await walletService.getMyWallet();
      } catch {}
      setShowPayConfirmModal(false);
      onOrderUpdated(fresh);
    } catch (err: any) {
      console.warn('Failed to pay inspection fee:', err);
      const msg =
        err?.message ||
        (lang === 'vi' ? 'Không thể thanh toán phí kiểm định từ ví. Vui lòng kiểm tra số dư ví.' : 'Failed to pay fee from wallet.');
      setActionError(msg);
      // Nếu API thanh toán báo quá hạn, dùng thông báo BE và cập nhật đơn
      inspectorService.getOrder(order.id)
        .then((fresh) => {
          if (fresh) onOrderUpdated(fresh);
        })
        .catch(() => {});
    } finally {
      setActionLoading(false);
    }
  };

  // Preview numbers for Seller Counter option
  let previewBuyerShare = 0;
  let previewSellerShare = 0;
  if (counterFeePayer === 'BUYER_PAYS') {
    previewBuyerShare = totalFee;
    previewSellerShare = 0;
  } else if (counterFeePayer === 'SELLER_PAYS') {
    previewBuyerShare = 0;
    previewSellerShare = totalFee;
  } else {
    previewBuyerShare = Math.round(totalFee / 2);
    previewSellerShare = totalFee - previewBuyerShare;
  }

  return (
    <div className="flex justify-center my-3 animate-fadeIn w-full">
      <div
        className={`max-w-lg w-full rounded-2xl border p-4 shadow-sm text-left transition-all relative overflow-hidden ${
          isPassed || isConfirmedPendingDispatch
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
                {lang === 'vi' ? 'Đề Xuất Kiểm Định Tại Trung Tâm' : 'Center Inspection Proposal'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Mã đơn: #{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
              isWaitingSellerApproval
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
            {isWaitingSellerApproval && (lang === 'vi' ? '⏳ Chờ Người Bán Duyệt' : 'Waiting Seller')}
            {isWaitingBuyerApproval && (lang === 'vi' ? '⏳ Chờ Người Mua Duyệt Lại' : 'Waiting Buyer')}
            {isWaitingFeePayment && (lang === 'vi' ? '💳 Chờ Nạp Phí Kiểm Định' : 'Waiting Payment')}
            {isConfirmedPendingDispatch && (lang === 'vi' ? '🚚 Đã Thu Đủ Phí - Chờ Gửi Hàng' : 'Ready For Dispatch')}
            {isPassed && (lang === 'vi' ? '✅ Kiểm Định Đạt Chuẩn' : 'Passed')}
            {isFailed && (lang === 'vi' ? '❌ Không Đạt Chuẩn' : 'Failed')}
            {isRejected && (lang === 'vi' ? '🚫 Đã Từ Chối' : 'Rejected')}
            {isCancelled && (lang === 'vi' ? 'Đã Hủy' : 'Cancelled')}
          </span>
        </div>

        {/* PRODUCT & CENTER INFO */}
        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-3 text-xs space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={order.postImageUrl || listing.photos?.front || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt={order.postTitle || listing.title}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h5 className="font-extrabold text-slate-900 truncate text-[11px] sm:text-xs">
                {order.postTitle || listing.title}
              </h5>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-[#c34c36]">
                  {formatVND(order.postPrice || listing.priceVnd)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">| Tiền sản phẩm</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {centerName || 'Trung Tâm Kiểm Định Chính Thành phố Hồ Chí Minh'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-[10px] pl-5">
              <span>Hình thức:</span>
              <strong className="text-slate-700">Đưa đến trung tâm kiểm định Hub (Lalamove 2 chiều)</strong>
            </div>
          </div>
        </div>

        {/* FEE BREAKDOWN GRID */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-2.5 text-xs mb-3 shadow-2xs">
          <div className="flex justify-between items-center text-slate-700 font-bold border-b border-slate-100 pb-2">
            <span className="text-xs">{lang === 'vi' ? 'Chi tiết các khoản phí kiểm định:' : 'Inspection fee breakdown:'}</span>
            <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {order.feePayer === 'BUYER_PAYS' || (order as any).feeSplit === 'BUYER_100'
                ? 'Người mua chịu 100%'
                : order.feePayer === 'SELLER_PAYS' || (order as any).feeSplit === 'SELLER_100'
                ? 'Người bán chịu 100%'
                : 'Chia đôi 50% - 50%'}
            </span>
          </div>

          {/* Sub-fees */}
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="flex justify-between items-center">
              <span>• Phí kiểm định cơ sở:</span>
              <span className="font-semibold text-slate-800">{formatVND(baseInspectionFee)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>• Cước Lalamove giao Hub:</span>
              <span className="font-semibold text-slate-800">{formatVND(shippingFeeToHub)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>• Dự phòng hoàn hàng (hoàn lại nếu Đạt):</span>
              <span className="font-semibold text-slate-800">{formatVND(returnReserveFee)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-black">
            <span className="text-slate-800 text-xs">• {lang === 'vi' ? 'Tổng phí kiểm định:' : 'Total fee:'}</span>
            <strong className="text-blue-900 font-black text-sm sm:text-base">{formatVND(totalFee)}</strong>
          </div>

          {/* Split cards */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <span className="text-[10px] text-slate-500 block">{lang === 'vi' ? 'Người mua trả:' : 'Buyer pays:'}</span>
              <span className="font-black text-xs sm:text-sm text-[#c34c36]">{formatVND(buyerFeeShare)}</span>
              {buyerCommitmentDeposit > 0 && (
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  + Cọc: <strong>{formatVND(buyerCommitmentDeposit)}</strong>
                </span>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 block">{lang === 'vi' ? 'Người bán chịu:' : 'Seller share:'}</span>
              <span className="font-black text-xs sm:text-sm text-slate-800">{formatVND(sellerFeeShare)}</span>
            </div>
          </div>

          {/* 2-Stage Payment Roadmap */}
          <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 1 (Thu trước):</span>
              <span className="font-bold text-slate-800">Phí kiểm định {formatVND(buyerFeeShare)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Giai đoạn 2 (Sau khi máy ĐẠT):</span>
              <span className="font-bold text-emerald-800">Tiền sản phẩm {formatVND(order.postPrice || listing.priceVnd)}</span>
            </div>
          </div>

          {/* Zin loss notice */}
          <div className="text-[10px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 leading-snug">
            ✓ <strong>Quy trình tháo máy:</strong> Đã đồng ý mở máy kiểm tra chuyên sâu (sẽ mất trạng thái tem zin của NSX).
          </div>

          {/* Reserve Refund Notice */}
          <div className="text-[10px] text-slate-500 italic pt-0.5 leading-snug">
            ℹ️ {lang === 'vi'
              ? 'Khoản dự phòng cước trả về sẽ được hoàn nếu Buyer mua tiếp hoặc hoàn phần dư sau khi đối soát cước trả hàng.'
              : 'Return reserve is refunded if Buyer completes purchase or residual balance refunded after reconciliation.'}
          </div>
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
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng Ý' : 'Accept'}</span>}
                  </button>

                  {/* Đề xuất lại */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCounterDrawer(!showCounterDrawer);
                      setShowRejectModal(false);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="flex-1 min-w-[110px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Đề Xuất Lại' : 'Counter'}</span>
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
                    <span>{lang === 'vi' ? 'Từ Chối' : 'Reject'}</span>
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
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                          counterFeePayer === 'BUYER_PAYS'
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
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                          counterFeePayer === 'SPLIT_50_50'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div>Chia 50/50</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatVND(Math.round(totalFee / 2))}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCounterFeePayer('SELLER_PAYS')}
                        className={`p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                          counterFeePayer === 'SELLER_PAYS'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div>Seller 100%</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{formatVND(totalFee)}</div>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span>Người bán (Bạn) chịu: <strong>{formatVND(previewSellerShare)}</strong></span>
                      <span>Người mua chịu: <strong>{formatVND(previewBuyerShare)}</strong></span>
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
                        <span>Xác Nhận Đề Xuất Lại</span>
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

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBuyerAccept}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'vi' ? 'Đồng Ý Phương Án Mới' : 'Accept Counter'}</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(true);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="py-2.5 px-4 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>{lang === 'vi' ? 'Từ Chối' : 'Reject'}</span>
                  </button>
                </div>
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
            <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
              isPaymentDeadlinePassed
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="font-bold flex items-center justify-between flex-wrap gap-1">
                <span>{lang === 'vi' ? 'Đã thống nhất phương án chia phí!' : 'Fee split agreed!'}</span>
                {order.paymentDeadline && (
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                    isPaymentDeadlinePassed ? 'text-rose-700' : 'text-amber-800'
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
              ) : isMyPaymentDone ? (
                <p className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Bạn đã thanh toán phí kiểm định thành công.' : 'You have completed your fee payment.'}</span>
                </p>
              ) : myFeeToPay === 0 ? (
                <p className="text-slate-700 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{lang === 'vi' ? 'Phần của bạn là 0 đ — Không cần thanh toán.' : 'Your share is 0 VND — No payment needed.'}</span>
                </p>
              ) : (
                <p className="text-amber-900 text-[11px]">
                  {lang === 'vi' ? 'Số tiền bạn cần nộp vào Escrow:' : 'Amount to pay into Escrow:'}{' '}
                  <strong className="text-[#c34c36] font-black text-sm">{formatVND(myFeeToPay)}</strong>
                </p>
              )}
            </div>

            {/* Nút thanh toán nếu tôi chưa trả */}
            {!isMyPaymentDone && myFeeToPay > 0 && (
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
                      ? `Thanh Toán Phí Kiểm Định (${formatVND(myFeeToPay)})`
                      : `Pay Inspection Fee (${formatVND(myFeeToPay)})`}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {/* 4. STATUS: CONFIRMED_PENDING_DISPATCH */}
        {isConfirmedPendingDispatch && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-teal-700" />
              <span>{lang === 'vi' ? 'Đã thu đủ phí kiểm định' : 'Fees collected'}</span>
            </div>
            <p className="text-[11px] text-teal-800">
              {lang === 'vi'
                ? 'Đã thu đủ phí, chờ gửi hàng đến trung tâm kiểm định tiếp nhận.'
                : 'All fees collected. Proceeding with dispatch to inspection center.'}
            </p>
          </div>
        )}

        {/* 5. STATUS: PASSED / FAILED / REJECTED */}
        {isPassed && (
          <p className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{lang === 'vi' ? 'Sản phẩm đã kiểm định ĐẠT CHUẨN. Người mua có thể mua tiếp.' : 'Passed inspection.'}</span>
          </p>
        )}
        {isFailed && (
          <p className="text-xs text-rose-800 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{lang === 'vi' ? 'Sản phẩm kiểm định KHÔNG ĐẠT. Đang tiến hành trả hàng.' : 'Inspection failed. Returning item.'}</span>
          </p>
        )}
        {isRejected && (
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-xl">
            🚫 {lang === 'vi' ? 'Đề xuất kiểm định đã bị từ chối.' : 'Proposal was rejected.'}
          </p>
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
                  <span>Xác Nhận Từ Chối</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XÁC NHẬN NỘP PHÍ QUA VÍ */}
        {showPayConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 animate-scaleIn">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-orange-600" />
                <span>{lang === 'vi' ? 'Xác nhận nộp phí kiểm định' : 'Confirm fee payment'}</span>
              </h4>
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">{lang === 'vi' ? 'Số tiền nộp:' : 'Amount:'}</span>
                  <strong className="text-[#c34c36] font-black text-sm">{formatVND(myFeeToPay)}</strong>
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
                  <span>{isPaymentDeadlinePassed ? (lang === 'vi' ? 'Đã Hết Hạn' : 'Expired') : (lang === 'vi' ? 'Xác Nhận Thanh Toán' : 'Confirm Payment')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

