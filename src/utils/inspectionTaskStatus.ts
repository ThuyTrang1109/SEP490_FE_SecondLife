import type { InspectionOrderDto } from '../services/inspectorService';

export function getInspectionTaskResult(order: Pick<InspectionOrderDto, 'status' | 'finalPaymentDeadline'> & {
  conditionScore?: number | null;
}) {
  const { conditionScore } = order;
  if (typeof conditionScore !== 'number') return null;

  switch (order.status) {
    case 'FAILED':
      return { verdict: 'FAIL' as const, conditionScore };
    case 'PASSED':
    case 'COMPLETED':
    case 'DELIVERING_TO_BUYER':
    case 'SHIPPED_TO_BUYER':
      return { verdict: 'PASS' as const, conditionScore };
    case 'CANCELLED':
      return order.finalPaymentDeadline ? { verdict: 'PASS' as const, conditionScore } : null;
    default:
      return null;
  }
}

export function getInspectionTaskStage(status?: string | null) {
  switch (status) {
    case 'CANCELLED':
    case 'CANCELED':
    case 'PAYMENT_EXPIRED':
      return 'cancelled';
    case 'DISPUTED':
      return 'disputed';
    case 'PASSED':
    case 'FAILED':
    case 'COMPLETED':
    case 'DELIVERING_TO_BUYER':
    case 'SHIPPED_TO_BUYER':
      return 'completed';
    case 'INSPECTING':
    case 'INSPECTION_IN_PROGRESS':
      return 'inspecting';
    case 'SHIPPING_TO_CENTER':
      return 'inbound';
    case 'DISPATCHED':
    case 'SCHEDULED':
    case 'RECEIVED_AT_CENTER':
    case 'AWAITING_INSPECTION':
      return 'assigned';
    default:
      return 'pending';
  }
}
