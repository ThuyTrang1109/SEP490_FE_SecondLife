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

export function isOrderPendingApprovalOrFee(ord: EscrowOrder | null | undefined): boolean {
  if (!ord) return false;
  const rawStatus = String(
    (ord as any).backendStatus ||
    (ord as any).inspectionStatus ||
    (ord as any).inspectionOrder?.status ||
    ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') ||
    ''
  ).toUpperCase();

  return (
    rawStatus === 'WAITING_SELLER_APPROVAL' ||
    rawStatus === 'WAITING_BUYER_APPROVAL' ||
    rawStatus === 'WAITING_FEE_PAYMENT' ||
    rawStatus === 'PENDING' ||
    ord.status === 'WAITING_SELLER_APPROVAL' ||
    ord.status === 'WAITING_BUYER_APPROVAL' ||
    ord.status === 'WAITING_FEE_PAYMENT' ||
    (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
    (ord as any).customerStatus === 'WAITING_BUYER_APPROVAL' ||
    (ord as any).customerStatus === 'WAITING_FEE_PAYMENT'
  );
}

export function readOrderAppointment(ord: EscrowOrder, detailInspectionDto: InspectionOrderDto | null): OrderAppointment | null {
  if (!ord) return null;
  if (isOrderPendingApprovalOrFee(ord)) return null;

  const possibleIds = [
    ord.id,
    (ord as any).inspectionOrderId,
    (ord as any).linkedOrderId,
    (ord as any).orderId,
    (ord as any).inspectionOrder?.id,
  ].filter(Boolean) as string[];

  const isOrderWaitingSeller = Boolean(
    (
      ord.status === 'WAITING_SELLER_APPROVAL' ||
      (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
      String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL'
    ) && (
      (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
      (detailInspectionDto as any)?.appointmentStatus === 'COUNTERED_BY_CENTER' ||
      Boolean((ord as any).counterScheduledAt) ||
      Boolean((detailInspectionDto as any)?.counterScheduledAt)
    )
  );

  let storedAppt: any = null;
  for (const id of possibleIds) {
    try {
      const raw = localStorage.getItem(`order_appointment_${id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed?.counterScheduledAt === '2026-11-19T13:30:00.000Z') {
          try { localStorage.removeItem(`order_appointment_${id}`); } catch {}
          continue;
        }
        if (parsed) {
          storedAppt = parsed;
          break;
        }
      }
    } catch { }
  }

  const isPendingCenter = Boolean(
    (storedAppt?.status === 'PENDING_CENTER_CONFIRMATION' && !storedAppt?.counterScheduledAt) ||
    (ord as any).appointmentStatus === 'PENDING_CENTER_CONFIRMATION' ||
    (detailInspectionDto as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
  );

  if (isPendingCenter && (storedAppt?.scheduledAt || ord.appointmentScheduledAt || (detailInspectionDto as any)?.appointmentScheduledAt)) {
    return {
      scheduledAt: storedAppt?.scheduledAt || ord.appointmentScheduledAt || (detailInspectionDto as any)?.appointmentScheduledAt,
      note: storedAppt?.note || ord.appointmentNote || (detailInspectionDto as any)?.appointmentNote || '',
      shift: storedAppt?.shift || (ord as any).appointmentShift || (detailInspectionDto as any)?.appointmentShift || 'MORNING',
      status: 'PENDING_CENTER_CONFIRMATION',
      counterScheduledAt: null,
      counterShift: null,
      counterNote: null,
    };
  }

  const isCountered = !isPendingCenter && (
    isOrderWaitingSeller || Boolean(
      (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
      (detailInspectionDto as any)?.appointmentStatus === 'COUNTERED_BY_CENTER' ||
      Boolean((ord as any).counterScheduledAt) ||
      Boolean((detailInspectionDto as any)?.counterScheduledAt)
    ) || (
      storedAppt && (
        (storedAppt.status === 'COUNTERED_BY_CENTER' && Boolean(storedAppt.counterScheduledAt)) ||
        Boolean(storedAppt.counterScheduledAt)
      )
    )
  );

  const rejection = !isCountered ? getOrderAppointmentRejection(ord) : null;
  const isRejected = !isCountered && (
    (ord as any).appointmentStatus === 'REJECTED' ||
    (detailInspectionDto as any)?.appointmentStatus === 'REJECTED' ||
    Boolean(rejection)
  );

  if (isRejected) {
    // Check if seller has scheduled a brand new appointment after rejection
    let newAppt: any = null;
    for (const id of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${id}`);
        if (raw && raw !== 'undefined' && raw !== 'null') {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.scheduledAt || parsed.counterScheduledAt) && parsed.status !== 'REJECTED') {
            newAppt = parsed;
            break;
          }
        }
      } catch { }
    }
    if (newAppt) {
      return newAppt;
    }
    return {
      scheduledAt: null,
      note: '',
      status: 'REJECTED',
    };
  }

  let apptData: any = null;

  for (const id of possibleIds) {
    try {
      const raw = localStorage.getItem(`order_appointment_${id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (parsed.status === 'COUNTERED_BY_CENTER' && !parsed.counterScheduledAt) {
            try {
              localStorage.removeItem(`order_appointment_${id}`);
            } catch { }
            continue;
          }
          if (parsed.scheduledAt || parsed.counterScheduledAt) {
            apptData = parsed;
            break;
          }
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
    if (schAt || cntAt) {
      apptData = {
        scheduledAt: schAt,
        note: ord.appointmentNote || '',
        status: (ord as any).appointmentStatus || (cntAt ? 'COUNTERED_BY_CENTER' : (ord.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
        counterScheduledAt: cntAt,
        counterShift: (ord as any).counterShift || (ord as any).inspectionOrder?.counterShift,
        counterNote: (ord as any).counterNote || (ord as any).inspectionOrder?.counterNote,
      };
    }
  }


  // 1. Ưu tiên cao nhất: Dữ liệu realtime từ API Backend (detailInspectionDto)
  if (detailInspectionDto && (
    detailInspectionDto.id === ord.id ||
    detailInspectionDto.linkedOrderId === ord.id ||
    detailInspectionDto.id === (ord as any).inspectionOrderId ||
    (ord as any).inspectionOrderId === detailInspectionDto.id ||
    (detailInspectionDto as any).orderId === ord.id ||
    (detailInspectionDto.postId && (detailInspectionDto.postId === ord.listingId || detailInspectionDto.postId === ord.listing?.id))
  )) {
    if (detailInspectionDto.counterScheduledAt || detailInspectionDto.appointmentScheduledAt) {
      const isCounter = !isPendingCenter && Boolean(
        detailInspectionDto.counterScheduledAt ||
        detailInspectionDto.appointmentStatus === 'COUNTERED_BY_CENTER'
      );
      return {
        scheduledAt: detailInspectionDto.appointmentScheduledAt || apptData?.scheduledAt,
        note: detailInspectionDto.appointmentNote || apptData?.note || '',
        shift: detailInspectionDto.appointmentShift || detailInspectionDto.counterShift || apptData?.shift || 'MORNING',
        status: isCounter ? 'COUNTERED_BY_CENTER' : (detailInspectionDto.appointmentStatus || (detailInspectionDto.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION')),
        counterScheduledAt: detailInspectionDto.counterScheduledAt || null,
        counterShift: detailInspectionDto.counterShift || null,
        counterNote: detailInspectionDto.counterNote || null,
      };
    }
  }

  // 2. Nếu đơn hàng có trường appointmentScheduledAt từ Backend (qua getMyBuyerOrders)
  if (ord.appointmentScheduledAt) {
    if (!apptData) {
      apptData = {
        scheduledAt: ord.appointmentScheduledAt,
        note: ord.appointmentNote || '',
        status: (ord as any).appointmentStatus || (ord.inspectorId ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION'),
        counterScheduledAt: (ord as any).counterScheduledAt,
        counterShift: (ord as any).counterShift,
        counterNote: (ord as any).counterNote,
      };
    } else {
      apptData.scheduledAt = ord.appointmentScheduledAt;
      if (ord.appointmentNote) apptData.note = ord.appointmentNote;
      if ((ord as any).appointmentStatus) {
        if ((ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' || (ord as any).appointmentStatus === 'CONFIRMED' || (ord as any).appointmentStatus === 'REJECTED' || apptData.status !== 'COUNTERED_BY_CENTER') {
          apptData.status = (ord as any).appointmentStatus;
        }
      }
      if ((ord as any).counterScheduledAt) {
        apptData.counterScheduledAt = (ord as any).counterScheduledAt;
        apptData.status = 'COUNTERED_BY_CENTER';
      }
      if ((ord as any).counterShift) apptData.counterShift = (ord as any).counterShift;
      if ((ord as any).counterNote) apptData.counterNote = (ord as any).counterNote;
    }
  }

  if (apptData?.status === 'PENDING_CENTER_CONFIRMATION' && !apptData?.counterScheduledAt) {
    return apptData;
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
  if (isOrderPendingApprovalOrFee(ord)) return null;

  const possibleIds = [
    ord.id,
    (ord as any).inspectionOrderId,
    (ord as any).linkedOrderId,
    (ord as any).orderId,
    (ord as any).inspectionOrder?.id,
  ].filter(Boolean) as string[];

  // 1. Nếu đơn đang ở trạng thái COUNTERED_BY_CENTER hoặc có đề xuất lịch mới thì KHÔNG PHẢI BỊ TỪ CHỐI
  let hasCounter = Boolean(
    (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
    Boolean((ord as any).counterScheduledAt) ||
    Boolean((ord as any).inspectionOrder?.counterScheduledAt)
  );

  if (!hasCounter) {
    for (const id of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${id}`);
        if (raw && raw !== 'undefined' && raw !== 'null') {
          const parsed = JSON.parse(raw);
          if (parsed && ((parsed.status === 'COUNTERED_BY_CENTER' && Boolean(parsed.counterScheduledAt)) || Boolean(parsed.counterScheduledAt))) {
            hasCounter = true;
            break;
          }
        }
      } catch { }
    }
  }

  if (hasCounter) {
    return null;
  }

  // 2. Kiểm tra nếu đơn hàng thực sự bị từ chối (REJECTED)
  if ((ord as any).appointmentStatus === 'REJECTED') {
    return {
      reason: (ord as any).appointmentRejectionReason || 'Trung tâm đã từ chối lịch hẹn này.',
      rejectedAt: (ord as any).appointmentRejectedAt || '',
    };
  }

  for (const id of possibleIds) {
    try {
      const raw = localStorage.getItem(`order_appointment_rejection_${id}`);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.reason && !parsed.replacedByCounter) {
          return parsed;
        }
      }
    } catch { }
  }

  if ((ord as any).appointmentRejectionReason && (ord as any).appointmentStatus !== 'CONFIRMED') {
    return {
      reason: (ord as any).appointmentRejectionReason,
      rejectedAt: (ord as any).appointmentRejectedAt || '',
    };
  }

  return null;
}
