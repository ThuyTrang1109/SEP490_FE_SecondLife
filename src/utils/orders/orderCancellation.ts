import type { EscrowOrder, Language } from '../../types';
import { formatOrderCancellationReason } from '../inspectionPurchase';

export const CANCELLATION_REASON_CODE_LABELS: Record<string, { vi: string; en: string }> = {
  BUYER_REQUESTED: {
    vi: 'Người mua yêu cầu hủy',
    en: 'Buyer Requested',
  },
  BUYER_CANCELLED: {
    vi: 'Người mua yêu cầu hủy',
    en: 'Buyer Cancelled',
  },
  SELLER_OUT_OF_STOCK: {
    vi: 'Người bán hủy đơn',
    en: 'Seller Out of Stock',
  },
  SELLER_CANNOT_FULFILL: {
    vi: 'Người bán không thể giao',
    en: 'Seller Cannot Fulfill',
  },
  SELLER_CANCELLED: {
    vi: 'Người bán hủy đơn',
    en: 'Seller Cancelled',
  },
  SELLER_CONFIRMATION_TIMEOUT: {
    vi: 'Quá hạn xác nhận',
    en: 'Confirmation Timeout',
  },
  PAYMENT_EXPIRED: {
    vi: 'Quá hạn thanh toán',
    en: 'Payment Expired',
  },
  INSPECTION_FAILED: {
    vi: 'Kiểm định không đạt',
    en: 'Inspection Failed',
  },
  SELLER_REJECTED_INSPECTION: {
    vi: 'Từ chối kiểm định',
    en: 'Inspection Rejected',
  },
  PASSED_BUYER_DEFAULTED: {
    vi: 'Quá hạn duyệt mua tiếp',
    en: 'Buyer Defaulted',
  },
};

export function formatCancellationReasonCode(code?: string | null, lang: Language = 'vi'): string {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  const labelObj = CANCELLATION_REASON_CODE_LABELS[cleanCode];
  if (labelObj) {
    return labelObj[lang] || labelObj.vi;
  }
  return code;
}

export function getCancellationReasonDisplay(ord: EscrowOrder | null | undefined, currentLang: Language = 'vi') {
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
    BUYER_CANCELLED: {
      vi: 'Người mua yêu cầu hủy đơn hàng.',
      en: 'Buyer requested cancellation.',
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
    PASSED_BUYER_DEFAULTED: {
      vi: 'Người mua quá hạn đưa ra quyết định mua tiếp sau khi sản phẩm đạt kiểm định.',
      en: 'Buyer defaulted on purchase decision after inspection passed.',
    },
  };

  const mapped = reasonCode ? dictionary[reasonCode] : null;
  const rawResolved = reasonText || (mapped ? mapped[currentLang] : (currentLang === 'vi' ? 'Đơn hàng đã được hủy và hoàn trả 100% tiền ký quỹ vào ví người mua.' : 'Order was cancelled and 100% refunded to buyer.'));
  const resolved = formatOrderCancellationReason(rawResolved, currentLang) || rawResolved;

  return {
    title: currentLang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded',
    reason: resolved,
    code: reasonCode ? formatCancellationReasonCode(reasonCode, currentLang) : '',
  };
}
