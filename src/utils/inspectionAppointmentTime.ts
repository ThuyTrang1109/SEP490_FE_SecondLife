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

  return {
    allowed: true,
    earliestCheckInTime,
    minutesUntilCheckIn: 0,
  };
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

