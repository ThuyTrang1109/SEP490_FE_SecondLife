import type { InspectionOrderDto } from '../services/inspectorService';
import type { EscrowOrder, Language } from '../types';

type InspectionOrderState = Partial<Pick<EscrowOrder,
  'hasInspectionService' | 'inspectionMethod' | 'inspectionCenterId' | 'inspectionFeeVnd' |
  'inspectionStatus' | 'inspectionNote' | 'status' | 'backendStatus' | 'escrowStatus' |
  'finalPaymentPaidAt' | 'linkedOrderId'>>;
type InspectionDetails = Pick<InspectionOrderDto, 'status' | 'note' | 'finalPaymentPaidAt' | 'linkedOrderId'>;
type PurchaseDecision = 'pending' | 'accepted' | 'rejected';
type BuyerInspectionStage = 'waiting' | 'inspecting' | 'decision' | 'rejected' | 'failed' | 'closed';

function inspectionStatus(order?: InspectionOrderState | null, details?: InspectionDetails | null) {
  return (details?.status || order?.inspectionStatus || order?.backendStatus || order?.status || order?.escrowStatus || '').toUpperCase();
}

export function getInspectionPurchaseDecision(
  order?: InspectionOrderState | null,
  details?: InspectionDetails | null,
): PurchaseDecision | null {
  const status = inspectionStatus(order, details);
  const payment = details ?? order;
  if (payment?.finalPaymentPaidAt || payment?.linkedOrderId) return 'accepted';

  // The inspection API records an explicit rejection in the note and also uses CANCELLED for other reasons.
  const note = details ? details.note : order?.inspectionNote;
  if (status === 'CANCELLED' && note?.includes('Người mua từ chối mua tiếp sau kiểm định. Lý do:')) return 'rejected';
  if (status === 'PASSED' || status === 'INSPECTION_PASSED' ||
      (!details?.status && !order?.inspectionStatus && order?.escrowStatus === 'INSPECTION_PASSED')) return 'pending';
  return null;
}

export function getBuyerInspectionStage(order: InspectionOrderState): BuyerInspectionStage | null {
  const status = inspectionStatus(order);
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

export function inspectionPurchaseDecisionLabel(decision: PurchaseDecision, lang: Language) {
  const labels = {
    pending: ['Chờ người mua quyết định', 'Awaiting buyer decision'],
    accepted: ['Người mua đã mua tiếp', 'Buyer continued with purchase'],
    rejected: ['Người mua từ chối mua', 'Buyer declined the purchase'],
  };
  return labels[decision][lang === 'vi' ? 0 : 1];
}

export function buyerInspectionStageLabel(stage: BuyerInspectionStage, lang: Language) {
  if (stage === 'decision') return inspectionPurchaseDecisionLabel('pending', lang);
  if (stage === 'rejected') return inspectionPurchaseDecisionLabel('rejected', lang);
  const labels = {
    waiting: ['Đang chờ kiểm định', 'Awaiting inspection'],
    inspecting: ['Đang kiểm định', 'Inspection in progress'],
    failed: ['Kiểm định không đạt', 'Inspection failed'],
    closed: ['Đơn kiểm định đã kết thúc', 'Inspection order closed'],
  };
  return labels[stage][lang === 'vi' ? 0 : 1];
}
