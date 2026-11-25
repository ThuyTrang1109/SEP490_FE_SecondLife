import type { InspectionOrderDto } from '../services/inspectorService';
import type { EscrowOrder, Language } from '../types';

type InspectionOrderState = Partial<Pick<EscrowOrder,
  'hasInspectionService' | 'inspectionMethod' | 'inspectionCenterId' | 'inspectionFeeVnd' |
  'inspectionStatus' | 'inspectionNote' | 'status' | 'backendStatus' | 'escrowStatus' |
  'finalPaymentPaidAt' | 'linkedOrderId' | 'inspectorId'>>;
type InspectionDetails = Pick<InspectionOrderDto, 'status' | 'note' | 'finalPaymentPaidAt' | 'linkedOrderId'>;
type PurchaseDecision = 'pending' | 'accepted' | 'rejected';
type BuyerInspectionStage = 'waiting' | 'inspecting' | 'decision' | 'rejected' | 'failed' | 'closed';

export function isExpiredInspectionPurchase(status?: string | null, note?: string | null) {
  const normStatus = String(status || '').toUpperCase();
  if (normStatus !== 'CANCELLED' && normStatus !== 'CANCELED') return false;
  const n = String(note || '');
  return (
    n.includes('Người mua không thanh toán tiền hàng trong vòng 6 giờ') ||
    n.includes('Người mua quá hạn đưa ra quyết định mua tiếp') ||
    extractInspectionRejectionDetails(n).isBuyerPurchaseExpired === true
  );
}

export interface InspectionRejectionDetails {
  inspectorNote: string;
  buyerRejectReason: string;
  isBuyerPurchaseRejected: boolean;
  isBuyerPurchaseExpired?: boolean;
}

export function extractInspectionRejectionDetails(note?: string | null): InspectionRejectionDetails {
  if (!note) return { inspectorNote: '', buyerRejectReason: '', isBuyerPurchaseRejected: false, isBuyerPurchaseExpired: false };
  const raw = String(note).trim();

  // 1. Quá hạn 6 giờ người mua không thanh toán / quyết định mua tiếp
  const timeoutMarkers = [
    'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
    'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn',
    'Người mua không thanh toán tiền hàng trong vòng 6 giờ',
    'Người mua quá hạn đưa ra quyết định mua tiếp sau khi sản phẩm đạt kiểm định.',
    'Người mua quá hạn đưa ra quyết định mua tiếp',
  ];
  for (const marker of timeoutMarkers) {
    const markerIndex = raw.indexOf(marker);
    if (markerIndex !== -1) {
      const inspectorPart = raw.slice(0, markerIndex).replace(/\|\s*$/, '').trim();
      const buyerPart = raw.slice(markerIndex).trim();
      return {
        inspectorNote: inspectorPart,
        buyerRejectReason: buyerPart || 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
        isBuyerPurchaseRejected: false,
        isBuyerPurchaseExpired: true,
      };
    }
  }

  // 2. Người mua chủ động từ chối mua tiếp
  const marker = 'Người mua từ chối mua tiếp sau kiểm định. Lý do:';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex !== -1) {
    const inspectorPart = raw.slice(0, markerIndex).replace(/\|\s*$/, '').trim();
    const buyerPart = raw.slice(markerIndex + marker.length).trim();
    return {
      inspectorNote: inspectorPart,
      buyerRejectReason: buyerPart || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân',
      isBuyerPurchaseRejected: true,
      isBuyerPurchaseExpired: false,
    };
  }

  const altMarker = 'Người mua từ chối mua tiếp sau kiểm định';
  const altIndex = raw.indexOf(altMarker);
  if (altIndex !== -1) {
    const inspectorPart = raw.slice(0, altIndex).replace(/\|\s*$/, '').trim();
    const buyerPart = raw.slice(altIndex + altMarker.length).replace(/^[:\s.\-Lý do]+/, '').trim();
    return {
      inspectorNote: inspectorPart,
      buyerRejectReason: buyerPart || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân',
      isBuyerPurchaseRejected: true,
      isBuyerPurchaseExpired: false,
    };
  }

  const bracketMarker = '[Từ chối mua tiếp sau kiểm định]';
  const bracketIndex = raw.indexOf(bracketMarker);
  if (bracketIndex !== -1) {
    const inspectorPart = raw.slice(0, bracketIndex).replace(/\|\s*$/, '').trim();
    const buyerPart = raw.slice(bracketIndex + bracketMarker.length).replace(/^[:\s.\-Lý do]+/, '').trim();
    return {
      inspectorNote: inspectorPart,
      buyerRejectReason: buyerPart || 'Thay đổi nhu cầu sử dụng / Lý do cá nhân',
      isBuyerPurchaseRejected: true,
      isBuyerPurchaseExpired: false,
    };
  }

  // Nếu chuỗi chứa dấu phân cách `|` và vế sau là lý do hủy / từ chối
  if (raw.includes('|')) {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const secondPart = parts.slice(1).join(' | ').trim();
      if (/không thanh toán|quá hạn|từ chối/i.test(secondPart)) {
        return {
          inspectorNote: parts[0],
          buyerRejectReason: secondPart,
          isBuyerPurchaseRejected: /từ chối/i.test(secondPart),
          isBuyerPurchaseExpired: /không thanh toán|quá hạn/i.test(secondPart),
        };
      }
    }
  }

  return {
    inspectorNote: raw,
    buyerRejectReason: raw,
    isBuyerPurchaseRejected: false,
    isBuyerPurchaseExpired: false,
  };
}

export function formatOrderCancellationReason(
  rawReason?: string | null,
  lang: Language = 'vi'
): string {
  if (!rawReason) return '';
  const rejection = extractInspectionRejectionDetails(rawReason);
  if (rejection.isBuyerPurchaseExpired) {
    return rejection.buyerRejectReason || (lang === 'vi' ? 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.' : 'Buyer defaulted on payment within 6 hours after inspection passed.');
  }
  if (rejection.isBuyerPurchaseRejected) {
    return rejection.buyerRejectReason || (lang === 'vi' ? 'Người mua từ chối mua tiếp sau kiểm định' : 'Buyer declined purchase after inspection');
  }

  let cleanReason = String(rawReason)
    .replace(/\[(Tem|Grade|Điểm|Bao bì|Phụ kiện|Photos):.*?\]/gi, '')
    .trim();

  if (cleanReason.includes('|')) {
    const parts = cleanReason.split('|').map(s => s.trim()).filter(Boolean);
    const afterPipe = parts.slice(1).join(' | ').trim();
    if (afterPipe) {
      const afterRejection = extractInspectionRejectionDetails(afterPipe);
      if (afterRejection.isBuyerPurchaseExpired || afterRejection.isBuyerPurchaseRejected) {
        return afterRejection.buyerRejectReason;
      }
      if (/người mua không thanh toán|quá hạn|từ chối|hết hạn/i.test(afterPipe)) {
        return afterPipe;
      }
    }
  }

  return cleanReason || String(rawReason).trim();
}

export interface ParsedInspectorVerdict {
  cleanText: string;
  packaging?: string;
  accessories?: string;
  grade?: string;
  score?: string;
}

// Some reports embed a JSON array of evidence URLs in the note.
export const INSPECTION_NOTE_PHOTO_TAG = /\[Photos:\s*(\[\s*(?:"(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")*)?\s*\])\s*\]/i;

export function parseInspectorVerdictNote(rawNote?: string | null): ParsedInspectorVerdict {
  if (!rawNote) return { cleanText: '' };

  let text = String(rawNote).replace(INSPECTION_NOTE_PHOTO_TAG, ' ').trim();

  // Tách bỏ phần lý do hủy / từ chối / quá hạn thanh toán nếu bị nối vào note sau kiểm định
  const rejection = extractInspectionRejectionDetails(text);
  if (rejection.isBuyerPurchaseRejected || rejection.isBuyerPurchaseExpired) {
    text = rejection.inspectorNote;
  }

  // Extract Packaging: [Bao bì: ...]
  let packaging: string | undefined;
  const pkgMatch = text.match(/\[Bao bì:\s*([^\]]+)\]/i);
  if (pkgMatch) {
    packaging = pkgMatch[1].trim();
    text = text.replace(pkgMatch[0], '').trim();
  }

  // Extract Accessories: [Phụ kiện: ...]
  let accessories: string | undefined;
  const accMatch = text.match(/\[Phụ kiện:\s*([^\]]+)\]/i);
  if (accMatch) {
    accessories = accMatch[1].trim();
    text = text.replace(accMatch[0], '').trim();
  }

  // Extract Grade: [Grade: ...]
  let grade: string | undefined;
  const gradeMatch = text.match(/\[Grade:\s*([^\]]+)\]/i);
  if (gradeMatch) {
    grade = gradeMatch[1].trim();
    text = text.replace(gradeMatch[0], '').trim();
  }

  // Extract Score: [Điểm: ...]
  let score: string | undefined;
  const scoreMatch = text.match(/\[Điểm:\s*([^\]]+)\]/i);
  if (scoreMatch) {
    score = scoreMatch[1].trim();
    text = text.replace(scoreMatch[0], '').trim();
  }

  // Remove remaining report tags, including older single-value photo tags.
  text = text.replace(/\[(Tem|Grade|Điểm|Bao bì|Phụ kiện|Photos):[^\]]*\]/gi, '').trim();
  text = text.replace(/\[\s*\]/g, '').trim();

  return {
    cleanText: text,
    packaging,
    accessories,
    grade,
    score,
  };
}

export function formatInspectionFailureReason(rawNote?: string | null, lang: Language = 'vi'): string {
  const { cleanText, packaging, accessories } = parseInspectorVerdictNote(rawNote);
  return [
    cleanText.replace(/^Kiểm định chất lượng đầu vào không đạt:\s*/i, ''),
    packaging && `${lang === 'vi' ? 'Bao bì' : 'Packaging'}: ${packaging}`,
    accessories && `${lang === 'vi' ? 'Phụ kiện' : 'Accessories'}: ${accessories}`,
  ].filter(Boolean).join(' · ');
}

export function getCustomerInspectionStatus(status?: string | null, customerStatus?: string | null, inspectorId?: string | null) {
  if (customerStatus) return customerStatus.toUpperCase();
  const current = (status || '').toUpperCase();
  return inspectorId && ['DISPATCHED', 'SCHEDULED'].includes(current) ? 'INSPECTING' : current;
}

function inspectionStatus(order?: InspectionOrderState | null, details?: InspectionDetails | null) {
  return (details?.status || order?.inspectionStatus || order?.backendStatus || order?.status || order?.escrowStatus || '').toUpperCase();
}

export function getInspectionPurchaseDecision(
  order?: InspectionOrderState | null,
  details?: InspectionDetails | null,
): PurchaseDecision | null {
  const status = inspectionStatus(order, details);
  const payment = details ?? order;
  if (
    payment?.finalPaymentPaidAt ||
    payment?.linkedOrderId ||
    (order as any)?.finalPaymentPaidAt ||
    (details as any)?.finalPaymentPaidAt ||
    (order as any)?.inspectionDecision === 'accepted' ||
    (order as any)?.buyerDecision === 'accepted'
  ) return 'accepted';

  // The inspection API records an explicit rejection in the note and also uses CANCELLED for other reasons.
  const note = details?.note || order?.inspectionNote || (order as any)?.note;
  if (status === 'CANCELLED' && (
    (order as any)?.cancellationReasonCode === 'PASSED_BUYER_DEFAULTED' ||
    (order as any)?.settlementOutcome === 'PASSED_BUYER_DEFAULTED' ||
    (order as any)?.inspectionDecision === 'rejected' ||
    (order as any)?.buyerDecision === 'rejected' ||
    (details as any)?.inspectionDecision === 'rejected' ||
    Boolean(note?.includes('Người mua từ chối mua tiếp sau kiểm định')) ||
    Boolean(note?.includes('Từ chối mua tiếp sau kiểm định')) ||
    extractInspectionRejectionDetails(note).isBuyerPurchaseRejected ||
    extractInspectionRejectionDetails(note).isBuyerPurchaseExpired ||
    isExpiredInspectionPurchase(status, note)
  )) return 'rejected';
  if (status === 'PASSED' || status === 'INSPECTION_PASSED' ||
      (!details?.status && !order?.inspectionStatus && order?.escrowStatus === 'INSPECTION_PASSED')) return 'pending';
  return null;
}

export function shouldReadSellerHubReturn(
  order: InspectionOrderState & Pick<EscrowOrder, 'sellerId' | 'feeSettledAt'>,
  sellerId?: string,
) {
  if (!sellerId || sellerId !== order.sellerId || order.inspectionMethod !== 'AT_CENTER' ||
      order.finalPaymentPaidAt || order.linkedOrderId) return false;
  const status = inspectionStatus(order);
  if (status === 'FAILED' || status === 'INSPECTION_FAILED') return true;
  return ['CANCELLED', 'CANCELED', 'REFUNDED_TO_BUYER'].includes(status) && Boolean(
    order.feeSettledAt || isExpiredInspectionPurchase(status, order.inspectionNote) || getInspectionPurchaseDecision(order) === 'rejected'
  );
}

export function getBuyerInspectionStage(order: InspectionOrderState): BuyerInspectionStage | null {
  const status = getCustomerInspectionStatus(inspectionStatus(order), undefined, order.inspectorId);
  const escrow = order.escrowStatus;
  const hasInspection = Boolean(order.hasInspectionService || order.inspectionStatus || order.inspectionMethod ||
    order.inspectionCenterId || order.inspectionFeeVnd || escrow === 'AWAITING_INSPECTION' ||
    escrow === 'INSPECTION_IN_PROGRESS' || escrow === 'INSPECTION_PASSED' || escrow === 'INSPECTION_FAILED');
  if (!hasInspection) return null;

  const decision = getInspectionPurchaseDecision(order);
  if (decision === 'accepted') return null;
  if (decision === 'pending') return 'decision';
  if (decision === 'rejected') return 'rejected';
  if (status === 'FAILED' || status === 'INSPECTION_FAILED') return 'failed';
  if (['CANCELLED', 'CANCELED', 'PAYMENT_EXPIRED', 'REFUNDED_TO_BUYER', 'DISPUTED'].includes(status)) return 'closed';
  if (order.inspectionStatus && status === 'COMPLETED') return 'closed';
  if (['INSPECTING', 'INSPECTION_IN_PROGRESS'].includes(status) ||
      (!order.inspectionStatus && escrow === 'INSPECTION_IN_PROGRESS')) return 'inspecting';
  // Older cached records did not carry the inspection response fields.
  if (!order.inspectionStatus && ['DELIVERING_TO_BUYER', 'DELIVERED', 'COMPLETED', 'COMPLETED_RELEASED'].includes(status)) return null;
  return 'waiting';
}

export function inspectionPurchaseDecisionLabel(
  decision: PurchaseDecision,
  lang: Language,
  isSeller: boolean = false,
) {
  if (decision === 'pending') {
    if (isSeller) {
      return lang === 'vi' ? 'Chờ người mua quyết định' : 'Awaiting buyer decision';
    }
    return lang === 'vi' ? 'Chờ quyết định từ bạn' : 'Awaiting your decision';
  }
  const labels = {
    accepted: isSeller
      ? ['Người mua đã mua tiếp', 'Buyer continued with purchase']
      : ['Bạn đã xác nhận mua tiếp', 'You continued with purchase'],
    rejected: isSeller
      ? ['Người mua từ chối mua', 'Buyer declined the purchase']
      : ['Bạn đã từ chối mua tiếp', 'You declined the purchase'],
  };
  return labels[decision][lang === 'vi' ? 0 : 1];
}

export function buyerInspectionStageLabel(stage: BuyerInspectionStage, lang: Language, isSeller: boolean = false) {
  if (stage === 'decision') return inspectionPurchaseDecisionLabel('pending', lang, isSeller);
  if (stage === 'rejected') return inspectionPurchaseDecisionLabel('rejected', lang, isSeller);
  const labels = {
    waiting: ['Đang chờ kiểm định', 'Awaiting inspection'],
    inspecting: ['Đang kiểm định', 'Inspection in progress'],
    failed: ['Kiểm định không đạt', 'Inspection failed'],
    closed: ['Đơn kiểm định đã kết thúc', 'Inspection order closed'],
  };
  return labels[stage][lang === 'vi' ? 0 : 1];
}
