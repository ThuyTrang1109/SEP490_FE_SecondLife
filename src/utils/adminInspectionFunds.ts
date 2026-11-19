import type {
  AdminCollectionStatus,
  AdminReturnReserveStatus,
  AdminInspectionOrderFundsDTO,
  AdminFundShipmentDTO,
} from '../types/adminInspectionFunds';
import { formatVND } from './translations';
import { splitInspectionFee } from './inspectionFeePercent';

/**
 * Map collectionStatus to user-facing labels
 */
export function resolveCollectionStatusLabel(status?: AdminCollectionStatus | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'NOT_DUE':
      return 'Chưa đến bước thu phí';
    case 'NO_PAYMENT_REQUIRED':
      return 'Không cần nộp';
    case 'UNPAID':
      return 'Chưa nộp';
    case 'PARTIALLY_PAID':
      return 'Đã nộp một phần';
    case 'PAID':
      return 'Đã thu đủ';
    default:
      return 'Chưa xác định';
  }
}

export function getCollectionStatusBadgeStyle(status?: AdminCollectionStatus | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'PAID':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'PARTIALLY_PAID':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'UNPAID':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'NO_PAYMENT_REQUIRED':
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    case 'NOT_DUE':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Map returnReserve.status to user-facing labels
 */
export function resolveReturnReserveStatusLabel(status?: AdminReturnReserveStatus | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'NOT_REQUIRED':
      return 'Không áp dụng dự phòng';
    case 'NOT_COLLECTED':
      return 'Chưa thu dự phòng';
    case 'HELD_PENDING_INSPECTION':
      return 'Đang giữ dự phòng';
    case 'REFUNDED_UNUSED':
      return 'Đã hoàn dự phòng chưa sử dụng';
    case 'AWAITING_RETURN_SHIPMENT':
      return 'Chờ tạo chuyến hoàn';
    case 'RETURN_IN_PROGRESS':
      return 'Đang trả hàng';
    case 'AWAITING_ACTUAL_FEE':
      return 'Chờ cước thực tế';
    case 'AWAITING_CASH_CONFIRMATION':
      return 'Đã giao về seller · Chờ xác nhận chi cước';
    case 'AWAITING_RECONCILIATION':
      return 'Chờ đối soát cước';
    case 'EXCEEDS_RESERVE':
      return 'Cước thực tế vượt dự phòng';
    case 'SETTLED':
      return 'Đã quyết toán cước hoàn';
    default:
      return 'Chưa xác định';
  }
}

export function getReturnReserveBadgeStyle(status?: AdminReturnReserveStatus | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'SETTLED':
    case 'REFUNDED_UNUSED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'HELD_PENDING_INSPECTION':
    case 'AWAITING_RETURN_SHIPMENT':
    case 'RETURN_IN_PROGRESS':
    case 'AWAITING_ACTUAL_FEE':
    case 'AWAITING_RECONCILIATION':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'AWAITING_CASH_CONFIRMATION':
      return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' };
    case 'EXCEEDS_RESERVE':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'NOT_REQUIRED':
    case 'NOT_COLLECTED':
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Map shipments[].status to user-facing labels
 */
export function resolveShipmentStatusLabel(status?: string | null): string {
  if (!status) return 'Chưa xác định';
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Chờ xử lý';
    case 'ASSIGNING_DRIVER':
      return 'Đang tìm tài xế';
    case 'DRIVER_ASSIGNED':
      return 'Đã có tài xế';
    case 'PICKED_UP':
    case 'PICKED':
    case 'IN_TRANSIT':
      return 'Đang vận chuyển';
    case 'DELIVERED':
      return 'Đã giao hàng';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'FAILED':
      return 'Thất bại';
    default:
      return 'Chưa xác định';
  }
}

export function getShipmentStatusBadgeStyle(status?: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'DELIVERED':
    case 'COMPLETED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'IN_TRANSIT':
    case 'PICKED_UP':
    case 'PICKED':
    case 'DRIVER_ASSIGNED':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    case 'PENDING':
    case 'ASSIGNING_DRIVER':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'CANCELLED':
    case 'FAILED':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

/**
 * Resolve leg display label
 */
export function resolveShipmentLegLabel(leg?: string | null): string {
  if (!leg) return 'Chuyến vận chuyển';
  const norm = leg.toUpperCase();
  switch (norm) {
    case 'SELLER_TO_CENTER':
    case 'SELLER_TO_HUB':
      return 'Chặng 1: Người bán → Hub';
    case 'CENTER_TO_SELLER':
    case 'HUB_TO_SELLER':
      return 'Chặng hoàn: Hub → Người bán';
    case 'CENTER_TO_BUYER':
    case 'HUB_TO_BUYER':
      return 'Chặng 2: Hub → Người mua';
    case 'BUYER_TO_CENTER':
    case 'BUYER_TO_HUB':
      return 'Người mua → Hub';
    default:
      return leg;
  }
}

/**
 * Resolves inspection order ID according to the requirement:
 * "Dùng ID đơn kiểm định. Nếu đối tượng FE có cả id và linkedOrderId, lấy id của đơn kiểm định."
 */
export function resolveInspectionOrderId(order: any): string {
  if (!order) return '';
  if (typeof order === 'string') return order.trim();
  if (order.id && order.linkedOrderId) {
    return String(order.id).trim();
  }
  if (order.inspectionOrderId) {
    return String(order.inspectionOrderId).trim();
  }
  return order.id ? String(order.id).trim() : '';
}

/**
 * Format date time cleanly
 */
export function formatAuditDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export interface FeeSplitPlanInfo {
  code: string;
  label: string;
  buyerPercent: number;
  sellerPercent: number;
}

/**
 * Resolves the inspection fee split plan (e.g. 50/50, buyer 100%, seller 100%)
 */
export function resolveFeeSplitPlan(funds?: AdminInspectionOrderFundsDTO | null): FeeSplitPlanInfo {
  if (!funds) {
    return { code: 'SPLIT_50_50', label: 'Chia đôi 50% - 50%', buyerPercent: 50, sellerPercent: 50 };
  }

  if (funds.buyerFeePercent != null && ![0, 50, 100].includes(funds.buyerFeePercent)) {
    const buyerPercent = funds.buyerFeePercent;
    const sellerPercent = 100 - buyerPercent;
    return { code: 'CUSTOM', label: `Người mua ${buyerPercent}% / Người bán ${sellerPercent}%`, buyerPercent, sellerPercent };
  }

  const rawSplit = (
    funds.inspectionFeeSplit ||
    funds.feeSplit ||
    (funds as any).feePayer ||
    (funds as any).order?.inspectionFeeSplit ||
    (funds as any).order?.feePayer ||
    (funds as any).inspectionOrder?.feePayer ||
    (funds as any).inspectionOrder?.inspectionFeeSplit ||
    ''
  ).toUpperCase();

  if (rawSplit === 'BUYER_100' || rawSplit === 'BUYER_PAYS') {
    return { code: 'BUYER_100', label: 'Người mua chịu 100%', buyerPercent: 100, sellerPercent: 0 };
  }
  if (rawSplit === 'SELLER_100' || rawSplit === 'SELLER_PAYS') {
    return { code: 'SELLER_100', label: 'Người bán chịu 100%', buyerPercent: 0, sellerPercent: 100 };
  }
  if (rawSplit === 'SPLIT_50_50') {
    return { code: 'SPLIT_50_50', label: 'Chia đôi 50% - 50%', buyerPercent: 50, sellerPercent: 50 };
  }

  // Infer from amountDue & collected of buyer & seller if not specified explicitly
  const buyerDue = Number(funds.buyerPayment?.amountDue ?? funds.buyer?.amountDue ?? (funds as any).buyerFeeShare ?? 0);
  const sellerDue = Number(funds.sellerPayment?.amountDue ?? funds.seller?.amountDue ?? (funds as any).sellerFeeShare ?? 0);
  const buyerCollected = Number(funds.buyerPayment?.amountCollected ?? funds.buyer?.amountCollected ?? 0);
  const sellerCollected = Number(funds.sellerPayment?.amountCollected ?? funds.seller?.amountCollected ?? 0);

  if ((buyerDue > 0 || buyerCollected > 0) && sellerDue === 0 && sellerCollected === 0) {
    return { code: 'BUYER_100', label: 'Người mua chịu 100%', buyerPercent: 100, sellerPercent: 0 };
  }
  if ((sellerDue > 0 || sellerCollected > 0) && buyerDue === 0 && buyerCollected === 0) {
    return { code: 'SELLER_100', label: 'Người bán chịu 100%', buyerPercent: 0, sellerPercent: 100 };
  }
  if (buyerDue > 0 && sellerDue > 0) {
    if (Math.abs(buyerDue - sellerDue) < 1000) {
      return { code: 'SPLIT_50_50', label: 'Chia đôi 50% - 50%', buyerPercent: 50, sellerPercent: 50 };
    }
    const totalDue = buyerDue + sellerDue;
    const buyerPercent = Math.round((buyerDue / totalDue) * 100);
    const sellerPercent = 100 - buyerPercent;
    return {
      code: 'CUSTOM',
      label: `Tỷ lệ ${buyerPercent}% (Mua) - ${sellerPercent}% (Bán)`,
      buyerPercent,
      sellerPercent,
    };
  }

  return { code: 'SPLIT_50_50', label: 'Chia đôi 50% - 50%', buyerPercent: 50, sellerPercent: 50 };
}

export interface ReturnReserveDetails {
  plannedAmount: number;
  heldAmount: number;
  returnShipment: AdminFundShipmentDTO | null;
  actualReturnFee: number;
  hasActualReturnFee: boolean;
  returnShipmentCode: string | null;
  returnShipmentStatus: string | null;
  splitPlan: FeeSplitPlanInfo;
  surplusAmount: number;
  buyerSurplusShare: number;
  sellerSurplusShare: number;
  refundAmountsRecorded: boolean;
  refundStatus: 'SETTLED' | 'REFUNDED_UNUSED' | 'AWAITING_CONFIRMATION' | 'PROCESSING' | 'PENDING' | 'EXCEEDS_RESERVE';
  refundStatusLabel: string;
  refundStatusBadge: { bg: string; text: string; border: string };
  refundDescription: string;
}

/**
 * Computes return reserve breakdown:
 * - Actual return shipping fee from Hub/Center to Seller
 * - Order fee split ratio
 * - Remaining surplus amount allocated to buyer and seller
 * - Detailed refund status explanation
 */
export function resolveReturnReserveDetails(funds?: AdminInspectionOrderFundsDTO | null): ReturnReserveDetails {
  const plannedAmount = Number(funds?.returnReserve?.plannedAmount ?? 0);
  const heldAmount = Number(funds?.returnReserve?.heldAmount ?? 0);
  const status = (funds?.returnReserve?.status || '').toUpperCase();

  // Find return shipment: leg CENTER_TO_SELLER or HUB_TO_SELLER
  const returnShipment =
    funds?.shipments?.find((s) => {
      const leg = (s.leg || '').toUpperCase();
      return leg === 'CENTER_TO_SELLER' || leg === 'HUB_TO_SELLER';
    }) || null;

  const hasActualReturnFee = returnShipment?.actualFee != null && returnShipment.actualFee >= 0;
  const actualReturnFee = hasActualReturnFee ? Number(returnShipment!.actualFee) : 0;
  const returnShipmentCode = returnShipment?.orderCode || null;
  const returnShipmentStatus = returnShipment?.status || null;

  const splitPlan = resolveFeeSplitPlan(funds);

  // If actual fee exceeds planned amount, surplus is 0
  const surplusAmount = Math.max(0, plannedAmount - actualReturnFee);

  let { buyer: buyerSurplusShare, seller: sellerSurplusShare } =
    splitInspectionFee(surplusAmount, splitPlan.buyerPercent);

  // Determine refund status and explanation
  const isSettled = status === 'SETTLED' || Boolean(funds?.settlement?.returnShippingSettledAt);
  const settlement = funds?.settlement;
  const refundAmountsRecorded = isSettled &&
    ['FAILED_INSPECTION', 'PASSED_BUYER_DEFAULTED'].includes(settlement?.outcome || '') &&
    settlement?.buyerRefundAmount != null && settlement?.sellerRefundAmount != null;
  const buyerDeposit = Number(funds?.fees?.buyerCommitmentDeposit ?? funds?.buyerCommitmentDeposit ?? 0);
  const buyerRefundBeforeReturn = settlement?.outcome === 'FAILED_INSPECTION' ? buyerDeposit : 0;
  const isLegacySellerSettlement = settlement?.outcome === 'FAILED_INSPECTION' && (
    Number(settlement.sellerAdditionalCollected ?? 0) > 0 ||
    Number(settlement.sellerOutstandingAmount ?? 0) > 0 ||
    Math.round(Number(settlement.buyerRefundAmount ?? 0) * 100) >
      Math.round((buyerRefundBeforeReturn + buyerSurplusShare) * 100)
  );
  if (refundAmountsRecorded) {
    buyerSurplusShare = isLegacySellerSettlement
      ? 0 : Math.max(0, Math.round((Number(settlement.buyerRefundAmount) - buyerRefundBeforeReturn) * 100)) / 100;
    sellerSurplusShare = Number(settlement.sellerRefundAmount);
  }
  const isUnused = status === 'REFUNDED_UNUSED';
  const isAwaitingConfirmation = status === 'AWAITING_CASH_CONFIRMATION';
  const isExceeded = status === 'EXCEEDS_RESERVE' || (hasActualReturnFee && actualReturnFee > plannedAmount);
  const isProcessing =
    status === 'RETURN_IN_PROGRESS' ||
    status === 'AWAITING_ACTUAL_FEE' ||
    status === 'AWAITING_RECONCILIATION' ||
    (returnShipment != null && !isSettled && !isUnused && !isExceeded);

  let refundStatus: ReturnReserveDetails['refundStatus'] = 'PENDING';
  let refundStatusLabel = 'Đang giữ bảo chứng';
  let refundStatusBadge = { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
  let refundDescription = '';

  if (isSettled) {
    refundStatus = 'SETTLED';
    refundStatusLabel = refundAmountsRecorded && buyerSurplusShare + sellerSurplusShare > 0
      ? 'Đã hoàn tất quyết toán & hoàn ví' : 'Đã quyết toán cước hoàn';
    refundStatusBadge = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    const returnSettledAt = funds?.settlement?.returnShippingSettledAt;
    const settledTimeStr = returnSettledAt ? ` vào lúc ${formatAuditDateTime(returnSettledAt)}` : '';
    refundDescription = refundAmountsRecorded
      ? `Đã đối soát xong cước hoàn${settledTimeStr}. Phần dư đã được tự động hoàn vào ví Người mua (${formatVND(buyerSurplusShare)}) và ví Người bán (${formatVND(sellerSurplusShare)}) theo số tiền hạch toán.`
      : `Đã đối soát xong cước hoàn${settledTimeStr}. Phân bổ ${formatVND(buyerSurplusShare)} cho Người mua và ${formatVND(sellerSurplusShare)} cho Người bán được tính theo tỷ lệ đã chốt. Chưa có dữ liệu hạch toán khoản hoàn để xác nhận tiền vào ví.`;
    if (refundAmountsRecorded && isLegacySellerSettlement) {
      refundDescription += ` Đơn này đã quyết toán theo quy tắc cũ: Người mua được hoàn ${formatVND(Number(settlement.buyerRefundAmount))} trước khi đối soát cước hoàn, phần dư được xử lý cho Người bán.`;
    }
  } else if (isUnused) {
    refundStatus = 'REFUNDED_UNUSED';
    refundStatusLabel = 'Đã hoàn toàn bộ tiền dự phòng (Không trả hàng)';
    refundStatusBadge = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    refundDescription = `Sản phẩm không phát sinh chuyển hoàn về người bán. Toàn bộ tiền dự phòng ${formatVND(plannedAmount)} đã được hoàn trả lại cho Người mua (${formatVND(buyerSurplusShare)}) và Người bán (${formatVND(sellerSurplusShare)}) theo tỷ lệ ${splitPlan.label}.`;
  } else if (isExceeded) {
    refundStatus = 'EXCEEDS_RESERVE';
    refundStatusLabel = 'Cước thực tế vượt dự phòng';
    refundStatusBadge = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    refundDescription = `Cước hoàn thực tế (${formatVND(actualReturnFee)}) vượt mức dự phòng kế hoạch (${formatVND(plannedAmount)}). Không còn tiền dư hoàn lại cho các bên.`;
  } else if (isAwaitingConfirmation) {
    refundStatus = 'AWAITING_CONFIRMATION';
    refundStatusLabel = 'Đã giao về Seller · Chờ xác nhận cước';
    refundStatusBadge = { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' };
    refundDescription = `Kiện hàng đã giao thành công về cho người bán. Đang chờ xác nhận chi cước hoàn thực tế trước khi tự động giải ngân tiền dư ${formatVND(surplusAmount)} về ví của các bên.`;
  } else if (isProcessing) {
    refundStatus = 'PROCESSING';
    refundStatusLabel = 'Đang chuyển hoàn · Chờ quyết toán';
    refundStatusBadge = { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' };
    refundDescription = `Đơn hoàn đang được vận chuyển về người bán. Sau khi đối soát cước thực tế${hasActualReturnFee ? ` (${formatVND(actualReturnFee)})` : ''}, số tiền dư dự kiến ${formatVND(surplusAmount)} sẽ được chia hoàn theo tỷ lệ ${splitPlan.label}.`;
  } else {
    refundStatus = 'PENDING';
    refundStatusLabel = 'Đang tạm giữ dự phòng cước hoàn';
    refundStatusBadge = { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    refundDescription = `Khoản dự phòng cước hoàn ${formatVND(heldAmount || plannedAmount)} đang được giữ an toàn tại ví ký quỹ Escrow. Nếu phát sinh trả hàng, cước thực tế sẽ được trừ tại đây và số tiền dư chia trả theo đúng tỷ lệ ${splitPlan.label}.`;
  }

  return {
    plannedAmount,
    heldAmount,
    returnShipment,
    actualReturnFee,
    hasActualReturnFee,
    returnShipmentCode,
    returnShipmentStatus,
    splitPlan,
    surplusAmount,
    buyerSurplusShare,
    sellerSurplusShare,
    refundAmountsRecorded,
    refundStatus,
    refundStatusLabel,
    refundStatusBadge,
    refundDescription,
  };
}

