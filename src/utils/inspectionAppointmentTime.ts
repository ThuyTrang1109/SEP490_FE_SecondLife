export type InspectionShift = 'MORNING' | 'AFTERNOON';

// The backend excludes the end of each shift. These are the last selectable minutes.
export const INSPECTION_SHIFT_HOURS: Record<InspectionShift, { min: string; max: string }> = {
  MORNING: { min: '08:00', max: '11:59' },
  AFTERNOON: { min: '13:00', max: '16:59' },
};

export function isInspectionTimeInShift(time: string, shift: InspectionShift): boolean {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const { min, max } = INSPECTION_SHIFT_HOURS[shift];
  return time >= min && time <= max;
}

export const CHECKIN_ADVANCE_WINDOW_MINUTES = 30;

export interface InspectorCheckInEligibility {
  allowed: boolean;
  expired?: boolean;
  earliestCheckInTime: Date | null;
  minutesUntilCheckIn: number;
  reason?: string;
}

export function canInspectorCheckIn(
  scheduledAt: string | Date | null | undefined,
  nowTime: number | Date = Date.now()
): InspectorCheckInEligibility {
  if (!scheduledAt) {
    return {
      allowed: false,
      earliestCheckInTime: null,
      minutesUntilCheckIn: 0,
      reason: 'Đơn hàng chưa có lịch hẹn đón KTV',
    };
  }

  const apptDate = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  if (isNaN(apptDate.getTime())) {
    return {
      allowed: false,
      earliestCheckInTime: null,
      minutesUntilCheckIn: 0,
      reason: 'Lịch hẹn kiểm định không hợp lệ',
    };
  }

  const nowMs = typeof nowTime === 'number' ? nowTime : nowTime.getTime();
  const earliestCheckInMs = apptDate.getTime() - CHECKIN_ADVANCE_WINDOW_MINUTES * 60 * 1000;
  const earliestCheckInTime = new Date(earliestCheckInMs);

  if (nowMs < earliestCheckInMs) {
    const diffMs = earliestCheckInMs - nowMs;
    const minutesUntilCheckIn = Math.ceil(diffMs / 60000);
    const timeStr = earliestCheckInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = earliestCheckInTime.toLocaleDateString('vi-VN');
    return {
      allowed: false,
      earliestCheckInTime,
      minutesUntilCheckIn,
      reason: `Chưa đến giờ tiếp nhận đơn. Kỹ thuật viên chỉ được ấn xác nhận đơn trước giờ hẹn tối đa 30 phút (từ ${timeStr} ngày ${dateStr}).`,
    };
  }

  const latestCheckInMs = apptDate.getTime() + CHECKIN_ADVANCE_WINDOW_MINUTES * 60 * 1000;
  if (nowMs > latestCheckInMs) {
    return {
      allowed: false,
      expired: true,
      earliestCheckInTime,
      minutesUntilCheckIn: 0,
      reason: 'Đã quá 30 phút sau giờ hẹn. Trung tâm kiểm định cần hẹn lại với người bán.',
    };
  }

  return {
    allowed: true,
    earliestCheckInTime,
    minutesUntilCheckIn: 0,
  };
}

export function isMissedHomeInspectionAppointment(order: {
  orderType?: string | null;
  inspectionMethod?: string | null;
  status?: string | null;
  backendStatus?: string | null;
  inspectionStatus?: string | null;
  appointmentStatus?: string | null;
  appointmentScheduledAt?: string | null;
  scheduledAt?: string | null;
  homeCheckedInAt?: string | null;
  inspectorArrivedAt?: string | null;
  inspectorConfirmed?: boolean | null;
}, nowTime = Date.now()): boolean {
  if (!order) return false;

  const isAtHome = (
    order.orderType === 'AT_HOME' ||
    order.inspectionMethod === 'AT_HOME' ||
    String(order.orderType).toUpperCase() === 'AT_HOME' ||
    String(order.inspectionMethod).toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionOrder?.orderType).toUpperCase() === 'AT_HOME' ||
    String((order as any).inspectionOrder?.inspectionMethod).toUpperCase() === 'AT_HOME'
  );
  if (!isAtHome) return false;

  const isCheckedIn = Boolean(
    order.homeCheckedInAt ||
    order.inspectorArrivedAt ||
    (order as any).home_checked_in_at ||
    (order as any).inspector_arrived_at
  );
  if (isCheckedIn) return false;

  const rawStatus = String(
    order.status ||
    order.backendStatus ||
    order.inspectionStatus ||
    (order as any).inspectionOrder?.status ||
    ''
  ).toUpperCase();

  if (['INSPECTING', 'INSPECTION_IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER'].includes(rawStatus)) {
    return false;
  }

  const apptStatus = String(
    order.appointmentStatus ||
    (order as any).savedAppointment?.status ||
    (order as any).inspectionOrder?.appointmentStatus ||
    ''
  ).toUpperCase();

  // If already countered or proposed new time by center, seller is deciding on counter
  if (apptStatus === 'COUNTERED_BY_CENTER') return false;

  // If explicitly marked as missed/expired/cancelled appointment by BE
  if (['MISSED', 'EXPIRED', 'RESCHEDULE_REQUIRED', 'CHECKIN_EXPIRED'].includes(apptStatus)) {
    return true;
  }

  const apptTime = order.appointmentScheduledAt ||
    order.scheduledAt ||
    (order as any).savedAppointment?.scheduledAt ||
    (order as any).inspectionOrder?.appointmentScheduledAt ||
    getOrderScheduledAppointmentTime(order);

  // If confirmed or has an appointment time
  const isApptActive = apptStatus === 'CONFIRMED' ||
    apptStatus === 'SCHEDULED' ||
    apptStatus === 'DISPATCHED' ||
    apptStatus === 'CONFIRMED_PENDING_DISPATCH' ||
    Boolean((order as any).inspectorId || (order as any).inspectorName) ||
    Boolean(apptTime);

  if (isApptActive && apptTime) {
    return canInspectorCheckIn(apptTime, nowTime).expired === true;
  }

  return false;
}

export function getOrderScheduledAppointmentTime(order: any): string | null {
  if (!order) return null;
  if (order.appointmentScheduledAt) return order.appointmentScheduledAt;
  if (order.scheduledAt) return order.scheduledAt;
  if (order.inspectionOrder?.appointmentScheduledAt) return order.inspectionOrder.appointmentScheduledAt;

  const targetIds = [
    order.id,
    order.linkedOrderId,
    order.orderId,
    order.inspectionOrderId,
    order.inspectionOrder?.id,
  ].filter(Boolean);

  if (typeof window !== 'undefined') {
    for (const id of targetIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.scheduledAt) return parsed.scheduledAt;
        }
      } catch { }
    }
  }
  return null;
}

