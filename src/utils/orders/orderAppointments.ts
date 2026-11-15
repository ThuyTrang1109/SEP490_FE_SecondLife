import type { EscrowOrder } from '../../types';
import type { InspectionOrderDto } from '../../services/inspectorService';

export interface OrderAppointment {
  scheduledAt?: string | null;
  note?: string | null;
  status?: string | null;
  counterScheduledAt?: string | null;
  counterShift?: string | null;
  counterNote?: string | null;
  shift?: string | null;
  confirmedBy?: string | null;
  inspectionOrderId?: string | null;
  linkedOrderId?: string | null;
}

export interface AppointmentRejection {
  reason: string;
  rejectedAt?: string | null;
}

export function readOrderAppointment(ord: EscrowOrder, detailInspectionDto: InspectionOrderDto | null): OrderAppointment | null {
  if (!ord) return null;
  const possibleIds = [
    ord.id,
    (ord as any).inspectionOrderId,
    (ord as any).linkedOrderId,
    (ord as any).orderId,
    (ord as any).inspectionOrder?.id,
  ].filter(Boolean) as string[];

  const isOrderWaitingSeller =
    ord.status === 'WAITING_SELLER_APPROVAL' ||
    (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
    String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL' ||
    (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER';

  let apptData: any = null;

  for (const id of possibleIds) {
    try {
      const raw = localStorage.getItem(`order_appointment_${id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.scheduledAt || parsed.counterScheduledAt)) {
          apptData = parsed;
          break;
        }
      }
    } catch { }
  }

  if (!apptData) {
    const idSet = new Set(possibleIds);
    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const centerList = JSON.parse(rawCenter);
        if (Array.isArray(centerList)) {
          const matched = centerList.find((co: any) => idSet.has(co.id) || idSet.has(co.linkedOrderId) || idSet.has(co.orderId));
          if (matched && (matched.appointmentScheduledAt || matched.counterScheduledAt)) {
            apptData = {
              scheduledAt: matched.appointmentScheduledAt,
              note: matched.appointmentNote || '',
              status: matched.appointmentStatus || (matched.counterScheduledAt ? 'COUNTERED_BY_CENTER' : (matched.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
              counterScheduledAt: matched.counterScheduledAt,
              counterShift: matched.counterShift,
              counterNote: matched.counterNote,
            };
          }
        }
      }
    } catch { }
  }

  if (!apptData) {
    const idSet = new Set(possibleIds);
    try {
      const rawRecent = localStorage.getItem('recent_placed_orders');
      if (rawRecent) {
        const recentList = JSON.parse(rawRecent);
        if (Array.isArray(recentList)) {
          const matched = recentList.find((ro: any) => idSet.has(ro.id) || idSet.has(ro.inspectionOrderId) || idSet.has(ro.linkedOrderId));
          if (matched && (matched.appointmentScheduledAt || matched.counterScheduledAt)) {
            apptData = {
              scheduledAt: matched.appointmentScheduledAt,
              note: matched.appointmentNote || '',
              status: matched.appointmentStatus || (matched.counterScheduledAt ? 'COUNTERED_BY_CENTER' : (matched.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
              counterScheduledAt: matched.counterScheduledAt,
              counterShift: matched.counterShift,
              counterNote: matched.counterNote,
            };
          }
        }
      }
    } catch { }
  }

  if (!apptData && (ord.appointmentScheduledAt || (ord as any).counterScheduledAt || isOrderWaitingSeller)) {
    const schAt = ord.appointmentScheduledAt || (ord as any).inspectionOrder?.appointmentScheduledAt;
    const cntAt = (ord as any).counterScheduledAt || (ord as any).inspectionOrder?.counterScheduledAt;
    apptData = {
      scheduledAt: schAt,
      note: ord.appointmentNote || '',
      status: (ord as any).appointmentStatus || (cntAt || isOrderWaitingSeller ? 'COUNTERED_BY_CENTER' : (ord.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
      counterScheduledAt: cntAt,
      counterShift: (ord as any).counterShift || (ord as any).inspectionOrder?.counterShift,
      counterNote: (ord as any).counterNote || (ord as any).inspectionOrder?.counterNote,
    };
  }

  if (apptData?.status === 'PENDING_CENTER_CONFIRMATION' && !apptData?.counterScheduledAt) {
    return apptData;
  }

  if (detailInspectionDto && (detailInspectionDto.id === ord.id || detailInspectionDto.linkedOrderId === ord.id)) {
    if (detailInspectionDto.counterScheduledAt || detailInspectionDto.appointmentScheduledAt) {
      const isCounter = Boolean(
        detailInspectionDto.counterScheduledAt ||
        detailInspectionDto.appointmentStatus === 'COUNTERED_BY_CENTER' ||
        detailInspectionDto.status === 'WAITING_SELLER_APPROVAL'
      );
      return {
        scheduledAt: detailInspectionDto.appointmentScheduledAt || apptData?.scheduledAt,
        note: detailInspectionDto.appointmentNote || apptData?.note || '',
        status: isCounter ? 'COUNTERED_BY_CENTER' : (detailInspectionDto.appointmentStatus || (detailInspectionDto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
        counterScheduledAt: detailInspectionDto.counterScheduledAt || apptData?.counterScheduledAt,
        counterShift: detailInspectionDto.counterShift || apptData?.counterShift,
        counterNote: detailInspectionDto.counterNote || apptData?.counterNote,
      };
    }
  }

  if (apptData) {
    if (apptData.status === 'PENDING_CENTER_CONFIRMATION' && !apptData.counterScheduledAt) {
      return apptData;
    }
    if (isOrderWaitingSeller || (ord as any).counterScheduledAt || apptData.counterScheduledAt) {
      apptData.status = 'COUNTERED_BY_CENTER';
      if (!apptData.counterScheduledAt && (ord as any).counterScheduledAt) {
        apptData.counterScheduledAt = (ord as any).counterScheduledAt;
      }
      if (!apptData.counterNote && (ord as any).counterNote) {
        apptData.counterNote = (ord as any).counterNote;
      }
      if (!apptData.counterShift && (ord as any).counterShift) {
        apptData.counterShift = (ord as any).counterShift;
      }
    }
    return apptData;
  }

  return null;
}

export function getOrderAppointmentRejection(ord: EscrowOrder): AppointmentRejection | null {
  if (!ord?.id) return null;
  if ((ord as any).appointmentRejectionReason) {
    return {
      reason: (ord as any).appointmentRejectionReason,
      rejectedAt: (ord as any).appointmentRejectedAt || '',
    };
  }
  const possibleIds = [
    ord.id,
    (ord as any).inspectionOrderId,
    (ord as any).linkedOrderId,
    (ord as any).orderId,
    (ord as any).inspectionOrder?.id,
  ].filter(Boolean) as string[];

  for (const id of possibleIds) {
    try {
      const raw = localStorage.getItem(`order_appointment_rejection_${id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.reason) return parsed;
      }
    } catch { }
  }
  return null;
}
