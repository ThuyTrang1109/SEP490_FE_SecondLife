import type { InspectionOrderDto } from '../services/inspectorService';

export function getPreListingHomeIntakeStage(order?: Pick<InspectionOrderDto,
  'orderType' | 'status' | 'appointmentStatus' | 'appointmentScheduledAt' | 'inspectorId' | 'homeCheckedInAt'
>) {
  if (order?.orderType !== 'AT_HOME' || order.appointmentStatus !== 'CONFIRMED' ||
    !order.appointmentScheduledAt || order.homeCheckedInAt || !['SCHEDULED', 'DISPATCHED'].includes(order.status)) {
    return null;
  }
  return order.inspectorId ? 'ready' : 'awaiting_inspector';
}

export function getPreListingHomeAppointmentStage(order?: Pick<InspectionOrderDto,
  'orderType' | 'status' | 'appointmentStatus' | 'appointmentScheduledAt'
>) {
  if (order?.orderType !== 'AT_HOME' || !['CONFIRMED_PENDING_DISPATCH', 'SCHEDULED', 'DISPATCHED'].includes(order.status)) {
    return null;
  }

  switch (order.appointmentStatus) {
    case 'REJECTED':
      return 'awaiting_schedule';
    case 'COUNTERED_BY_CENTER':
      return 'countered';
    case 'PENDING_CENTER_CONFIRMATION':
    case 'PENDING_CONFIRMATION':
      return 'awaiting_center';
    default:
      return order.appointmentScheduledAt ? 'scheduled' : 'awaiting_schedule';
  }
}

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

export function hasInspectionResult(order?: {
  status?: string | null;
  conditionScore?: number | null;
  checklistResultJson?: string | null;
} | null): boolean {
  if (!order) return false;
  if (typeof order.conditionScore === 'number' || Boolean(order.checklistResultJson)) return true;
  if (getInspectionTaskStage(order.status) === 'completed') return true;
  const completedResultStatuses = new Set([
    'PASSED', 'FAILED', 'COMPLETED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER',
    'RETURNING_TO_SELLER', 'RETURNED_TO_SELLER', 'BUYER_REJECTED'
  ]);
  return completedResultStatuses.has(order.status || '');
}
