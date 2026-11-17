import type { SystemWalletTransaction } from '../types';

const transactionLabels: Record<string, string> = {
  OPENING_BALANCE: 'Số dư ban đầu',
  PAYMENT_HOLD: 'Nhận ký quỹ',
  SETTLEMENT: 'Giải ngân',
  REFUND: 'Hoàn tiền',
  RETURN_SHIPPING_FEE: 'Thu cước trả hàng',
  INSPECTION_HOLD: 'Thu phí kiểm định',
  INSPECTION_SETTLEMENT: 'Quyết toán kiểm định',
  INSPECTION_REFUND: 'Hoàn phí kiểm định',
  INSPECTION_RETURN_SHIPPING: 'Cước trả hàng kiểm định',
};

export function toSystemWalletHistoryItem(transaction: SystemWalletTransaction) {
  const { heldDelta, shippingDelta, revenueDelta, type, inspectionOrderId } = transaction;
  const isInspection = Boolean(inspectionOrderId) || type.startsWith('INSPECTION_');
  const source = isInspection ? 'INSPECTION' as const : 'ESCROW' as const;
  const orderId = inspectionOrderId || transaction.orderId || '';
  const entryId = transaction.entryId || String(transaction.id);
  const fundCategory = transaction.fundCategory ?? (
    revenueDelta !== 0 && (heldDelta === 0 || heldDelta === -revenueDelta) && shippingDelta === 0 ? 'COMMISSION'
      : isInspection || (heldDelta === 0 && shippingDelta !== 0) ? 'USER_SHIPPING' : 'PRODUCT_ESCROW'
  );
  const isCommission = fundCategory === 'COMMISSION';
  const sellerPayout = source === 'ESCROW' && type === 'SETTLEMENT' && !isCommission
    ? Math.max(0, -(transaction.entryId ? heldDelta : heldDelta + revenueDelta))
    : null;
  const ledgerDelta = isCommission ? revenueDelta : heldDelta + shippingDelta + revenueDelta;
  const totalDelta = transaction.totalDelta ?? Math.abs(ledgerDelta);
  const deltaAction = transaction.deltaAction ?? (ledgerDelta > 0 ? 'PLUS' : ledgerDelta < 0 ? 'MINUS' : 'ZERO');
  const typeLabel = isCommission ? 'Hoa hồng sàn'
    : fundCategory === 'HUB_PAYOUT' ? 'Thanh toán ví Hub' : transactionLabels[type] ?? type;

  const breakdownItems = [];
  if (sellerPayout) {
    breakdownItems.push({ label: 'Thực trả người bán', delta: -sellerPayout });
  } else if (!isCommission && !isInspection && heldDelta !== 0) {
    breakdownItems.push({ label: 'Tiền hàng', delta: heldDelta });
  }
  if (!isInspection && shippingDelta !== 0) {
    breakdownItems.push({ label: 'Cước vận chuyển', delta: shippingDelta });
  }
  if (revenueDelta !== 0) {
    breakdownItems.push({ label: 'Hoa hồng sàn', delta: revenueDelta });
  }

  return {
    transaction, entryId, orderId, source, type, typeLabel, fundCategory, sellerPayout,
    signedDelta: deltaAction === 'PLUS' ? totalDelta : deltaAction === 'MINUS' ? -totalDelta : 0,
    displayId: orderId ? `${orderId.slice(0, 8)}...${orderId.slice(-4)}` : '—',
    actionLabel: isInspection ? 'Đối soát' : 'Xem chi tiết',
    breakdownSummary: transaction.breakdownDescription || typeLabel,
    breakdownItems,
    userShippingFee: transaction.userShippingFee ?? Math.abs(shippingDelta),
    isShipping: shippingDelta !== 0 || fundCategory === 'USER_SHIPPING',
    createdAt: transaction.createdAt,
  };
}
