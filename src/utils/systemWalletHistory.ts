import type { SystemWalletTransaction } from '../types';
import { formatVND } from './translations';

export interface SystemWalletBreakdownItem {
  label: string;
  delta: number;
  formattedText?: string;
}

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

export function parseMoneyString(valStr: string): number {
  if (!valStr) return 0;
  let s = valStr.trim();
  if (s.includes(',') && s.split(',')[1]?.length === 2) {
    s = s.split(',')[0].replace(/\./g, '');
  } else {
    const dotParts = s.split('.');
    if (dotParts.length === 2 && dotParts[1].length === 2) {
      s = dotParts[0].replace(/,/g, '');
    } else {
      s = s.replace(/[.,\s]/g, '');
    }
  }
  const num = Number(s);
  return isNaN(num) ? 0 : num;
}

export function parseBreakdownDescription(
  desc: string | null | undefined,
  signedDelta = 0
): SystemWalletBreakdownItem[] {
  if (!desc) return [];
  const items: SystemWalletBreakdownItem[] = [];

  const rawClauses = desc
    .split(/(?<=[.!?])\s+|;\s*|,\s+(?=[A-ZÀ-Ỹa-zà-ỹ])/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const rawClause of rawClauses) {
    const clause = rawClause.replace(/[.!?]+$/, '').trim();
    const matchEnd = clause.match(/^(.+?)\s+([\d.,]+)\s*(?:đ|₫|VND)?$/i);
    const matchMid = clause.match(/^(.+?)\s+([\d.,]+)\s*(?:đ|₫|VND)\s+(.+)$/i);

    if (matchEnd) {
      let rawLabel = matchEnd[1].trim();
      const amount = parseMoneyString(matchEnd[2]);
      rawLabel = rawLabel.replace(/^.*?[.!?]\s*/, '').trim();
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

      let delta = signedDelta > 0 ? amount : signedDelta < 0 ? -amount : amount;
      let formattedText: string;
      if (amount === 0) {
        delta = 0;
        formattedText = '0 đ';
      } else if (label.toLowerCase().startsWith('trừ ')) {
        formattedText = formatVND(amount);
      } else if (signedDelta > 0) {
        formattedText = `+${formatVND(amount)}`;
      } else {
        formattedText = formatVND(amount);
      }

      items.push({ label, delta, formattedText });
    } else if (matchMid) {
      const prefix = matchMid[1].trim();
      const amount = parseMoneyString(matchMid[2]);
      const suffix = matchMid[3].trim();
      const fullLabel = `${prefix} ${suffix}`.trim();
      const label = fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1);
      const delta = signedDelta > 0 ? amount : -amount;
      items.push({
        label,
        delta,
        formattedText: signedDelta > 0 ? `+${formatVND(amount)}` : formatVND(amount),
      });
    }
  }

  return items;
}

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
  const signedDelta = deltaAction === 'PLUS' ? totalDelta : deltaAction === 'MINUS' ? -totalDelta : 0;
  const typeLabel = isCommission ? 'Hoa hồng sàn'
    : fundCategory === 'HUB_PAYOUT' ? 'Thanh toán ví Hub' : transactionLabels[type] ?? type;

  const breakdownItems: SystemWalletBreakdownItem[] = [];
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

  // Parse breakdown from description if breakdownItems is empty (e.g. inspection transactions)
  if (breakdownItems.length === 0 && transaction.breakdownDescription) {
    const parsed = parseBreakdownDescription(transaction.breakdownDescription, signedDelta);
    if (parsed.length > 0) {
      breakdownItems.push(...parsed);
    }
  }

  // Fallback for inspection transactions with held/shipping amounts
  if (breakdownItems.length === 0 && isInspection) {
    if (heldDelta !== 0) {
      breakdownItems.push({
        label: type === 'INSPECTION_REFUND' ? 'Hoàn phí kiểm định' : 'Phí kiểm định & cọc',
        delta: heldDelta,
      });
    }
    if (shippingDelta !== 0) {
      breakdownItems.push({
        label: type === 'INSPECTION_REFUND' ? 'Hoàn cước & dự phòng' : 'Cước & dự phòng',
        delta: shippingDelta,
      });
    }
  }

  return {
    transaction, entryId, orderId, source, type, typeLabel, fundCategory, sellerPayout,
    signedDelta,
    displayId: orderId ? `${orderId.slice(0, 8)}...${orderId.slice(-4)}` : '—',
    actionLabel: isInspection ? 'Đối soát' : 'Xem chi tiết',
    breakdownSummary: transaction.breakdownDescription || typeLabel,
    breakdownItems,
    userShippingFee: transaction.userShippingFee ?? Math.abs(shippingDelta),
    isShipping: shippingDelta !== 0 || fundCategory === 'USER_SHIPPING',
    createdAt: transaction.createdAt,
  };
}
