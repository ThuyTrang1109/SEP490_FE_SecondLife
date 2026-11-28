import { paths } from '../../app/router/paths';
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, X, Check, RefreshCw, AlertCircle, ShieldCheck, UserCheck, Sun, Sunset, Info } from 'lucide-react';
import { Language } from '../../types';
import { inspectorService } from '../../services/inspectorService';
import { saveScopedLocalNotification } from '../../utils/notificationStorage';
import { INSPECTION_SHIFT_HOURS, isInspectionTimeInShift, type InspectionShift } from '../../utils/inspectionAppointmentTime';

export interface RejectedAppointmentSlot {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  shift?: InspectionShift;
  isEntireShift?: boolean;
  reason?: string;
}

interface ScheduleAppointmentModalProps {
  orderId: string;
  orderCode?: string;
  linkedOrderId?: string;
  inspectionOrderId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  lang?: Language;
  readOnly?: boolean;
  initialScheduledAt?: string;
  initialNote?: string;
  order?: any;
  rejectedSlots?: RejectedAppointmentSlot[];
}

export type { InspectionShift } from '../../utils/inspectionAppointmentTime';

export const MORNING_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
export const AFTERNOON_SLOTS = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

export function extractRejectedSlots(
  orderId: string,
  linkedOrderId?: string,
  inspectionOrderId?: string,
  order?: any,
  passedRejectedSlots?: RejectedAppointmentSlot[]
): RejectedAppointmentSlot[] {
  const result: RejectedAppointmentSlot[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  const addSlot = (dateStr: string, timeStr?: string, shiftStr?: InspectionShift, isEntireShift?: boolean, reason?: string) => {
    if (!dateStr) return;
    const exists = result.some(
      (s) => s.date === dateStr &&
             (isEntireShift ? s.isEntireShift && s.shift === shiftStr : s.time === timeStr)
    );
    if (!exists) {
      result.push({
        date: dateStr,
        time: timeStr,
        shift: shiftStr,
        isEntireShift: Boolean(isEntireShift),
        reason: reason || undefined,
      });
    }
  };

  const toLocalSlot = (scheduledAt?: string | null) => {
    if (!scheduledAt) return undefined;
    const d = new Date(scheduledAt);
    if (isNaN(d.getTime())) return undefined;
    const shift: InspectionShift = d.getHours() >= 13 ? 'AFTERNOON' : 'MORNING';
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      shift,
    };
  };

  const addShiftsFromReason = (date: string, reason: string) => {
    if (/(?:kín\s*(?:lịch\s*)?ca\s*sáng|hết\s*(?:lịch\s*|chỗ\s*)?ca\s*sáng|bận\s*ca\s*sáng)/i.test(reason)) {
      addSlot(date, undefined, 'MORNING', true, reason);
    }
    if (/(?:kín\s*(?:lịch\s*)?ca\s*chiều|hết\s*(?:lịch\s*|chỗ\s*)?ca\s*chiều|bận\s*ca\s*chiều)/i.test(reason)) {
      addSlot(date, undefined, 'AFTERNOON', true, reason);
    }
  };

  const addRejectedTime = (scheduledAt?: string | null, reason?: string) => {
    const slot = toLocalSlot(scheduledAt);
    if (!slot) return;
    if (reason) addShiftsFromReason(slot.date, reason);
    addSlot(slot.date, slot.time, slot.shift, false, reason);
  };

  const inspection = order?.inspectionOrder;
  const appointmentStatus = order?.appointmentStatus || inspection?.appointmentStatus;
  const canUseCounter = !appointmentStatus || appointmentStatus === 'COUNTERED_BY_CENTER';
  let proposedSlot = canUseCounter ? toLocalSlot(order?.counterScheduledAt || inspection?.counterScheduledAt) : undefined;

  for (const slot of passedRejectedSlots ?? []) {
    if (!slot?.date) continue;
    if (slot.isEntireShift) addSlot(slot.date, undefined, slot.shift, true, slot.reason);
    if (slot.time) addSlot(slot.date, slot.time, slot.shift, false, slot.reason);
  }

  if (order) {
    const isCountered = appointmentStatus === 'COUNTERED_BY_CENTER' || Boolean(proposedSlot);
    const rejectionReason = order.appointmentRejectionReason || inspection?.appointmentRejectionReason;
    const isRejected = appointmentStatus === 'REJECTED' || Boolean(rejectionReason);
    if (isCountered || isRejected) {
      const reason = isCountered ? order.counterNote || inspection?.counterNote : rejectionReason;
      addRejectedTime(order.appointmentScheduledAt || inspection?.appointmentScheduledAt || order.scheduledAt, reason);
    }
  }

  if (typeof window !== 'undefined') {
    const targetIds = new Set([orderId, linkedOrderId, inspectionOrderId, order?.id, order?.linkedOrderId, inspection?.id].filter(Boolean));

    for (const tid of targetIds) {
      try {
        const rawList = localStorage.getItem(`order_rejected_slots_${tid}`);
        if (rawList) {
          const list = JSON.parse(rawList);
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              if (!item?.date) return;
              if (item.isEntireShift) {
                // Older entries stored the rejected appointment's shift, even if the note named another shift.
                if (item.time && item.reason) addShiftsFromReason(item.date, item.reason);
                else addSlot(item.date, undefined, item.shift, true, item.reason);
              }
              if (item.time) addSlot(item.date, item.time, item.shift, false, item.reason);
            });
          }
        }
      } catch {}

      try {
        const rawAppt = localStorage.getItem(`order_appointment_${tid}`);
        if (rawAppt) {
          const parsed = JSON.parse(rawAppt);
          if (canUseCounter && (parsed.status === 'COUNTERED_BY_CENTER' || parsed.counterScheduledAt)) {
            proposedSlot ??= toLocalSlot(parsed.counterScheduledAt);
            if (parsed.scheduledAt && parsed.scheduledAt !== parsed.counterScheduledAt) {
              addRejectedTime(parsed.scheduledAt, parsed.counterNote);
            }
          }
        }
      } catch {}

      try {
        const rawRej = localStorage.getItem(`order_appointment_rejection_${tid}`);
        if (rawRej) {
          const rej = JSON.parse(rawRej);
          if (rej.previousScheduledAt) {
            addRejectedTime(rej.previousScheduledAt, rej.reason);
          }
        }
      } catch {}
    }
  }

  // A current proposal confirms one slot in that shift. It overrides a full-shift flag
  // for the same date, while other individually rejected times remain blocked.
  if (!proposedSlot) return result;
  const { date, time, shift } = proposedSlot;
  return result.filter((slot) => slot.date !== date || (
    !(slot.isEntireShift && slot.shift === shift) && slot.time?.slice(0, 5) !== time
  ));
}

export function isSlotRejected(
  date: string,
  time: string,
  shift: InspectionShift,
  rejectedSlots: RejectedAppointmentSlot[]
): { rejected: boolean; reason?: string } {
  if (!date || !time) return { rejected: false };
  const normalizedTime = time.slice(0, 5);

  for (const r of rejectedSlots) {
    if (r.date === date) {
      if (r.isEntireShift && r.shift === shift) {
        return {
          rejected: true,
          reason: r.reason || `Ca ${shift === 'MORNING' ? 'sáng' : 'chiều'} ngày này đã kín lịch KTV`,
        };
      }
      if (r.time && r.time.slice(0, 5) === normalizedTime) {
        return {
          rejected: true,
          reason: r.reason || 'Khung giờ này đã bị Trung tâm kiểm định từ chối trước đó',
        };
      }
    }
  }
  return { rejected: false };
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  orderId,
  orderCode,
  linkedOrderId,
  inspectionOrderId,
  isOpen,
  onClose,
  onSuccess,
  lang = 'vi',
  readOnly = false,
  initialScheduledAt = '',
  initialNote = '',
  order,
  rejectedSlots,
}) => {
  // Form states
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<InspectionShift>('MORNING');
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allRejectedSlots, setAllRejectedSlots] = useState<RejectedAppointmentSlot[]>([]);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const formatDateDisplayVN = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    return `${d}/${m}/${y}`;
  };

  // Assigned inspector info
  const [assignedInspector, setAssignedInspector] = useState<{
    inspectorId?: string;
    inspectorName?: string;
    inspectorEmail?: string;
    inspectorPhone?: string;
    dispatchNote?: string;
  } | null>(null);

  // Minimum date is tomorrow (must schedule at least 1 day in advance, no past or today)
  const { todayStr, tomorrowStr } = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const tToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tTomorrow = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;

    return { todayStr: tToday, tomorrowStr: tTomorrow };
  })();

  useEffect(() => {
    if (!isOpen) return;

    // Load assigned inspector info from localStorage
    try {
      const rawInsp = localStorage.getItem(`order_assigned_inspector_${orderId}`);
      if (rawInsp) {
        const parsedInsp = JSON.parse(rawInsp);
        if (parsedInsp && (parsedInsp.inspectorName || parsedInsp.inspectorId)) {
          setAssignedInspector(parsedInsp);
        }
      }
    } catch {}

    let initDateStr = initialScheduledAt;
    let initNoteStr = initialNote;

    try {
      const raw = localStorage.getItem(`order_appointment_${orderId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.scheduledAt && !initDateStr) initDateStr = parsed.scheduledAt;
        if (parsed.note && !initNoteStr) initNoteStr = parsed.note;
      }
    } catch {}

    const extractedRejected = extractRejectedSlots(orderId, linkedOrderId, inspectionOrderId, order, rejectedSlots);
    setAllRejectedSlots(extractedRejected);

    const pad = (n: number) => String(n).padStart(2, '0');

    let resolvedDate = tomorrowStr;
    let resolvedShift: InspectionShift = 'MORNING';
    let resolvedTime = '09:00';

    if (initDateStr) {
      try {
        const d = new Date(initDateStr);
        if (!isNaN(d.getTime())) {
          const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const hours = d.getHours();
          const minutes = d.getMinutes();
          const timePart = `${pad(hours)}:${pad(minutes)}`;

          if (datePart < tomorrowStr) {
            resolvedDate = tomorrowStr;
            resolvedShift = 'MORNING';
            resolvedTime = '09:00';
          } else {
            resolvedDate = datePart;
            resolvedTime = timePart;
            resolvedShift = hours >= 13 ? 'AFTERNOON' : 'MORNING';
          }
        }
      } catch {}
    }

    // Validation: Không cho chọn lại những giờ đã bị từ chối của ngày hôm đó!
    if (isSlotRejected(resolvedDate, resolvedTime, resolvedShift, extractedRejected).rejected) {
      const shiftsToTry: InspectionShift[] = [resolvedShift, resolvedShift === 'MORNING' ? 'AFTERNOON' : 'MORNING'];
      let found: { shift: InspectionShift; time: string } | null = null;
      for (const s of shiftsToTry) {
        const slots = s === 'MORNING' ? MORNING_SLOTS : AFTERNOON_SLOTS;
        for (const slot of slots) {
          if (!isSlotRejected(resolvedDate, slot, s, extractedRejected).rejected) {
            found = { shift: s, time: slot };
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        resolvedShift = found.shift;
        resolvedTime = found.time;
      }
    }

    setSelectedDate(resolvedDate);
    setSelectedShift(resolvedShift);
    setSelectedTime(resolvedTime);
    setNote(initNoteStr || '');
    setErrorMessage(null);
  }, [isOpen, orderId, linkedOrderId, inspectionOrderId, initialScheduledAt, initialNote, tomorrowStr, order, rejectedSlots]);

  if (!isOpen) return null;

  // Handle shift change - tự động bỏ qua các giờ đã bị từ chối
  const handleShiftSelect = (shift: InspectionShift) => {
    setSelectedShift(shift);
    const slots = shift === 'MORNING' ? MORNING_SLOTS : AFTERNOON_SLOTS;
    const defaultTime = shift === 'MORNING' ? '09:00' : '14:00';
    if (!isSlotRejected(selectedDate, defaultTime, shift, allRejectedSlots).rejected) {
      setSelectedTime(defaultTime);
    } else {
      const firstAvail = slots.find((slot) => !isSlotRejected(selectedDate, slot, shift, allRejectedSlots).rejected);
      if (firstAvail) {
        setSelectedTime(firstAvail);
      } else {
        setSelectedTime(defaultTime);
      }
    }
    setErrorMessage(null);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setErrorMessage(null);
    if (isSlotRejected(newDate, selectedTime, selectedShift, allRejectedSlots).rejected) {
      const shiftsToTry: InspectionShift[] = [selectedShift, selectedShift === 'MORNING' ? 'AFTERNOON' : 'MORNING'];
      let found: { shift: InspectionShift; time: string } | null = null;
      for (const s of shiftsToTry) {
        const slots = s === 'MORNING' ? MORNING_SLOTS : AFTERNOON_SLOTS;
        for (const slot of slots) {
          if (!isSlotRejected(newDate, slot, s, allRejectedSlots).rejected) {
            found = { shift: s, time: slot };
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        setSelectedShift(found.shift);
        setSelectedTime(found.time);
      }
    }
  };

  const syncAppointmentToOrdersAndNotify = (scheduledDate: Date, noteText: string, shift: InspectionShift) => {
    const formattedDate = scheduledDate.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const shiftLabel = shift === 'MORNING' ? 'Ca sáng (08:00 - 12:00)' : 'Ca chiều (13:00 - 17:00)';
    let buyerId: string | undefined;

    // Clear previous rejection if rescheduling
    const allTargetIds = [orderId, linkedOrderId, inspectionOrderId].filter(Boolean) as string[];
    allTargetIds.forEach((tid) => {
      try {
        localStorage.removeItem(`order_appointment_rejection_${tid}`);
      } catch {}
    });

    const isMatch = (o: any) => {
      if (!o) return false;
      return allTargetIds.some((tid) =>
        o.id === tid ||
        o.linkedOrderId === tid ||
        o.inspectionOrderId === tid ||
        o.orderId === tid
      );
    };

    // 1. Cập nhật recent_placed_orders
    try {
      const raw = localStorage.getItem('recent_placed_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const updated = list.map((o: any) => {
            if (isMatch(o)) {
              buyerId = o.buyerId;
              return {
                ...o,
                appointmentScheduledAt: scheduledDate.toISOString(),
                appointmentNote: noteText,
                appointmentShift: shift,
                appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
                appointmentRejectionReason: undefined,
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                sellerConfirmedAt: o.sellerConfirmedAt || new Date().toISOString(),
                confirmationStatus: 'CONFIRMED',
                escrowStatus: 'AWAITING_INSPECTION',
                backendStatus: 'CONFIRMED_PENDING_DISPATCH',
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      }
    } catch {}

    // 2. Cập nhật center_inspection_orders
    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const listCenter = JSON.parse(rawCenter);
        if (Array.isArray(listCenter)) {
          const updatedCenter = listCenter.map((o: any) => {
            if (isMatch(o)) {
              return {
                ...o,
                appointmentScheduledAt: scheduledDate.toISOString(),
                appointmentNote: noteText,
                appointmentShift: shift,
                appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
                appointmentRejectionReason: undefined,
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                sellerAddress: o.sellerAddress || o.listing?.sellerAddress || o.listing?.location,
                sellerPhone: o.sellerPhone || o.seller?.phone,
                sellerName: o.sellerName || o.seller?.fullName,
              };
            }
            return o;
          });
          localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
        }
      }
    } catch {}

    // 2.1. Cập nhật my_seller_inspection_orders
    try {
      const rawSeller = localStorage.getItem('my_seller_inspection_orders');
      if (rawSeller) {
        const listSeller = JSON.parse(rawSeller);
        if (Array.isArray(listSeller)) {
          const updatedSeller = listSeller.map((o: any) => {
            if (isMatch(o)) {
              return {
                ...o,
                appointmentScheduledAt: scheduledDate.toISOString(),
                appointmentNote: noteText,
                appointmentShift: shift,
                appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
                appointmentRejectionReason: undefined,
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
              };
            }
            return o;
          });
          localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updatedSeller));
        }
      }
    } catch {}

    // 3. Gửi thông báo cho Người mua
    const buyerNotif = {
      id: `notif-buyer-appt-${orderId}-${Date.now()}`,
      recipientId: buyerId,
      recipientRole: 'buyer',
      title: 'Người bán đã hẹn lịch đón KTV kiểm định tại nhà',
      message: `Người bán đã lên lịch hẹn đón KTV SecondLife đến kiểm tra máy vào ${formattedDate} (${shiftLabel}). Đơn hàng #${orderCode || orderId.slice(0, 8)} đang được tiến hành!`,
      type: 'INSPECTION' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: paths.orders('buyer', orderId) + '?filter=inspecting',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(buyerNotif, buyerId, 'buyer');

    // 4. Gửi thông báo cho Trung tâm kiểm định Hub
    const centerNotif = {
      id: `notif-center-appt-${orderId}-${Date.now()}`,
      recipientRole: 'inspection_center',
      title: `Người bán đã đặt lịch hẹn kiểm định tại nhà: #${orderCode || orderId.slice(0, 8)}`,
      message: `Người bán đã chọn lịch đón KTV vào ${formattedDate} (${shiftLabel}). Vui lòng vào hàng đợi điều phối để xác nhận lịch và phân công KTV phụ trách! Ghi chú: ${noteText || 'Không có'}`,
      type: 'INSPECTION_TASK' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: '/inspection-center/dispatch',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');

    // 5. Gửi thông báo trực tiếp cho Kỹ thuật viên (KTV)
    if (assignedInspector?.inspectorId) {
      const inspectorNotif = {
        id: `notif-inspector-appt-${orderId}-${Date.now()}`,
        recipientId: assignedInspector.inspectorId,
        recipientRole: 'inspector',
        title: `Lịch hẹn kiểm định tận nơi: #${orderCode || orderId.slice(0, 8)}`,
        message: `Người bán đã hẹn đón bạn đến thẩm định máy vào ${formattedDate} (${shiftLabel}). Ghi chú: ${noteText || 'Không có'}`,
        type: 'INSPECTION_TASK' as const,
        referenceId: orderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: `/inspector/inspections/${encodeURIComponent(orderId)}`,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(inspectorNotif, assignedInspector.inspectorId, 'inspector');
    }

    try {
      window.dispatchEvent(new CustomEvent('secondlife_appointment_scheduled', {
        detail: {
          orderId,
          scheduledAt: scheduledDate.toISOString(),
          note: noteText,
          shift,
          inspectorId: assignedInspector?.inspectorId,
          inspectorName: assignedInspector?.inspectorName,
        }
      }));
      window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', {
        detail: { orderId }
      }));
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedDate || !selectedTime) {
      setErrorMessage('Vui lòng chọn ngày và giờ hẹn kiểm định');
      return;
    }

    // STRICT DATE VALIDATION: Cannot be in the past or today (must be at least 1 day in advance)
    if (selectedDate < tomorrowStr) {
      setErrorMessage(
        selectedDate === todayStr
          ? 'Không thể đặt lịch trong ngày hôm nay. Quy định bắt buộc phải hẹn trước tối thiểu 1 ngày để Trung tâm kịp sắp xếp KTV.'
          : 'Không thể chọn ngày trong quá khứ. Quy định bắt buộc phải hẹn trước tối thiểu 1 ngày (từ ngày mai trở đi).'
      );
      return;
    }

    const scheduledDate = new Date(`${selectedDate}T${selectedTime}`);
    if (isNaN(scheduledDate.getTime())) {
      setErrorMessage('Thời gian hẹn không hợp lệ. Vui lòng kiểm tra lại');
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      setErrorMessage('Lịch hẹn kiểm định phải ở thời điểm tương lai');
      return;
    }

    if (!isInspectionTimeInShift(selectedTime, selectedShift)) {
      const { min, max } = INSPECTION_SHIFT_HOURS[selectedShift];
      setErrorMessage(`Vui lòng chọn giờ trong ca đã chọn (${min} - ${max}).`);
      return;
    }

    // Validation: Chặn không cho chọn lại những giờ đã bị Trung tâm từ chối của ngày hôm đó!
    const slotCheck = isSlotRejected(selectedDate, selectedTime, selectedShift, allRejectedSlots);
    if (slotCheck.rejected) {
      setErrorMessage(
        lang === 'vi'
          ? `Khung giờ ${selectedTime} ngày ${formatDateDisplayVN(selectedDate)} đã bị Trung tâm kiểm định từ chối trước đó (${slotCheck.reason || 'KTV không thể tiếp nhận'}). Vui lòng chọn khung giờ hoặc ngày khác!`
          : `Time slot ${selectedTime} on ${formatDateDisplayVN(selectedDate)} was previously rejected. Please select another time!`
      );
      return;
    }

    const detectedShift = selectedShift;

    setIsSubmitting(true);

    const targetInspectionId = inspectionOrderId || orderId;
    const targetIds = new Set<string>([orderId]);
    if (linkedOrderId) targetIds.add(linkedOrderId);
    if (inspectionOrderId) targetIds.add(inspectionOrderId);

    try {
      let apiSuccess = false;
      let lastApiError: any = null;

      try {
        console.log('[ScheduleAppointmentModal] Calling inspectorService.scheduleAppointment:', {
          targetInspectionId,
          scheduledAt: scheduledDate.toISOString(),
          note: note.trim() || undefined,
          detectedShift,
        });
        await inspectorService.scheduleAppointment(
          targetInspectionId,
          scheduledDate.toISOString(),
          note.trim() || undefined,
          detectedShift
        );
        apiSuccess = true;
      } catch (err: any) {
        lastApiError = err;
        console.warn('[ScheduleAppointmentModal] Primary schedule appointment call failed:', err);
        if (targetInspectionId !== orderId) {
          try {
            console.log('[ScheduleAppointmentModal] Retrying with orderId fallback:', orderId);
            await inspectorService.scheduleAppointment(
              orderId,
              scheduledDate.toISOString(),
              note.trim() || undefined,
              detectedShift
            );
            apiSuccess = true;
          } catch (e2) {
            lastApiError = e2;
            console.warn('[ScheduleAppointmentModal] Fallback schedule appointment call failed:', e2);
          }
        }
      }

      // If backend call failed with an actual API error (400, 403, 404, 409, 500), display the error to user!
      if (!apiSuccess && lastApiError) {
        const isNetworkDown = lastApiError.message?.includes('Không thể kết nối đến Backend Server');
        if (!isNetworkDown) {
          setErrorMessage(lastApiError.message || 'Lỗi gửi lịch hẹn lên máy chủ. Vui lòng kiểm tra lại quyền hoặc trạng thái đơn.');
          return;
        }
      }

      const appointmentRecord = {
        scheduledAt: scheduledDate.toISOString(),
        note: note.trim() || '',
        shift: detectedShift,
        status: 'PENDING_CENTER_CONFIRMATION',
        assignedInspector: assignedInspector || undefined,
        counterScheduledAt: undefined,
        counterShift: undefined,
        counterNote: undefined,
      };

      targetIds.forEach((tid) => {
        try {
          localStorage.setItem(`order_appointment_${tid}`, JSON.stringify(appointmentRecord));
          localStorage.removeItem(`order_appointment_rejection_${tid}`);
        } catch {}
      });

      syncAppointmentToOrdersAndNotify(scheduledDate, note.trim(), detectedShift);
      window.dispatchEvent(
        new CustomEvent('secondlife_appointment_scheduled', {
          detail: {
            orderId,
            inspectionOrderId: targetInspectionId,
            scheduledAt: scheduledDate.toISOString(),
            note: note.trim(),
            shift: detectedShift,
            status: 'PENDING_CENTER_CONFIRMATION',
          },
        })
      );
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSlots = selectedShift === 'MORNING' ? MORNING_SLOTS : AFTERNOON_SLOTS;
  const shiftHours = INSPECTION_SHIFT_HOURS[selectedShift];
  const isSelectedTimeValid = isInspectionTimeInShift(selectedTime, selectedShift);
  const rejectedTimesOnSelectedDate = allRejectedSlots.filter((r) => r.date === selectedDate);
  const isMorningFullOnDate = rejectedTimesOnSelectedDate.some((r) => r.isEntireShift && r.shift === 'MORNING');
  const isAfternoonFullOnDate = rejectedTimesOnSelectedDate.some((r) => r.isEntireShift && r.shift === 'AFTERNOON');
  const isCurrentTimeRejected = isSlotRejected(selectedDate, selectedTime, selectedShift, allRejectedSlots).rejected;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl sm:max-w-xl lg:max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Fixed Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 font-bold shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {readOnly
                  ? (lang === 'vi' ? 'Lịch hẹn kiểm định' : 'Inspection Appointment')
                  : (lang === 'vi' ? 'Người bán hẹn lịch đón KTV' : 'Seller Inspection Appointment')}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {lang === 'vi' ? 'Đơn hàng' : 'Order'} #{orderCode || orderId.slice(0, 8)} • {lang === 'vi' ? 'Kiểm định tận nơi' : 'At-Home Inspection'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-only view for Buyer */}
        {readOnly ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 subtle-scrollbar">
            {assignedInspector && (
              <div className="p-2.5 bg-purple-50/80 rounded-xl border border-purple-200/90 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-purple-900 flex items-center gap-1.5 flex-wrap">
                    <span>KTV phụ trách:</span>
                    <span className="text-purple-700 font-extrabold underline decoration-purple-300">
                      {assignedInspector.inspectorName || 'Kỹ thuật viên SecondLife'}
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-700 font-medium flex items-center gap-2 mt-0.5">
                    {assignedInspector.inspectorPhone && <span>{assignedInspector.inspectorPhone}</span>}
                    {assignedInspector.inspectorEmail && <span>✉️ {assignedInspector.inspectorEmail}</span>}
                  </div>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{lang === 'vi' ? 'Thời gian kỹ thuật viên đến kiểm định:' : 'Scheduled Inspection Time:'}</span>
              </div>
              <div className="text-sm font-black text-slate-900">
                {selectedDate && selectedTime ? (
                  new Date(`${selectedDate}T${selectedTime}`).toLocaleString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                ) : (
                  <span className="text-slate-500 italic">
                    {lang === 'vi' ? 'Chưa xác định thời gian cụ thể' : 'Time not specified'}
                  </span>
                )}
              </div>
            </div>

            {note && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-600 block">
                  {lang === 'vi' ? 'Ghi chú đón KTV của người bán:' : 'Seller note:'}
                </span>
                <p className="text-xs text-slate-800">{note}</p>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">
                {lang === 'vi'
                  ? 'Kỹ thuật viên chuyên nghiệp của SecondLife sẽ có mặt tại địa chỉ của Người Bán đúng lịch hẹn trong khung giờ hành chính để kiểm tra máy và dán tem niêm phong.'
                  : 'SecondLife certified technician will inspect and seal the item at the seller location during business hours.'}
              </span>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đã hiểu & đóng' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          /* Form for Seller */
          <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Scrollable Body - fits comfortably in one screen without overflow */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 subtle-scrollbar">
              {/* Compact Unified Rules & Inspector Info Banner */}
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-amber-500/10 text-amber-700 shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 leading-snug">
                  <div className="font-bold text-amber-900 flex items-center justify-between flex-wrap gap-1">
                    <span>Hẹn trước ≥ 1 ngày • Giờ hành chính</span>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/60 px-1.5 py-0.2 rounded">
                      Nghỉ trưa 12h - 13h
                    </span>
                  </div>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    {assignedInspector ? (
                      <>
                        KTV phụ trách: <strong className="text-purple-900 font-bold">{assignedInspector.inspectorName || 'KTV SecondLife'}</strong>
                        {assignedInspector.inspectorPhone && <span className="ml-1 text-slate-600">{assignedInspector.inspectorPhone}</span>}
                      </>
                    ) : (
                      'Sau khi chốt lịch, Trung tâm sẽ điều phối KTV đến tận nơi kiểm tra máy.'
                    )}
                  </p>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1 & 2: Date + Shift side-by-side */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Step 1: Select Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === 'vi' ? '1. Ngày hẹn *' : '1. Date *'}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded">
                      ≥ 1 ngày
                    </span>
                  </label>
                  <div className="relative w-full h-9 group">
                    <div className="absolute inset-0 px-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 bg-gray-50/50 flex items-center justify-between pointer-events-none group-focus-within:ring-2 group-focus-within:ring-amber-500 group-focus-within:border-amber-500 transition">
                      <span className="font-mono">
                        {selectedDate ? (
                          formatDateDisplayVN(selectedDate)
                        ) : (
                          <span className="text-slate-400 font-normal font-sans">dd/mm/yyyy</span>
                        )}
                      </span>
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <input
                      ref={dateInputRef}
                      type="date"
                      min={tomorrowStr}
                      value={selectedDate}
                      onChange={(e) => {
                        handleDateChange(e.target.value);
                      }}
                      onClick={(e) => {
                        try {
                          (e.target as HTMLInputElement).showPicker?.();
                        } catch {}
                      }}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>
                </div>

                {/* Step 2: Select Shift */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'vi' ? '2. Ca làm việc *' : '2. Shift *'}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 h-9">
                    <button
                      type="button"
                      onClick={() => handleShiftSelect('MORNING')}
                      className={`h-full px-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col justify-center items-center ${
                        selectedShift === 'MORNING'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-slate-700'
                      }`}
                    >
                      <span className="text-[11px] font-black leading-none flex items-center gap-1">
                        <span>Ca sáng</span>
                        {isMorningFullOnDate && <span className="text-[9px] text-rose-500 font-bold">(Kín)</span>}
                      </span>
                      <span className={`text-[10px] font-medium leading-none mt-1 ${selectedShift === 'MORNING' ? 'text-amber-100' : 'text-slate-400'}`}>
                        08h - 12h
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShiftSelect('AFTERNOON')}
                      className={`h-full px-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col justify-center items-center ${
                        selectedShift === 'AFTERNOON'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-slate-700'
                      }`}
                    >
                      <span className="text-[11px] font-black leading-none flex items-center gap-1">
                        <span>Ca chiều</span>
                        {isAfternoonFullOnDate && <span className="text-[9px] text-rose-500 font-bold">(Kín)</span>}
                      </span>
                      <span className={`text-[10px] font-medium leading-none mt-1 ${selectedShift === 'AFTERNOON' ? 'text-orange-100' : 'text-slate-400'}`}>
                        13h - 17h
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Thông báo các khung giờ / ca đã bị từ chối của ngày đã chọn */}
              {rejectedTimesOnSelectedDate.length > 0 && (
                <div className="p-2.5 rounded-xl bg-orange-50/90 border border-orange-200 text-xs text-orange-950 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <span className="font-bold">Lưu ý ngày {formatDateDisplayVN(selectedDate)}:</span>{' '}
                    <span>
                      {isMorningFullOnDate
                        ? 'Trung tâm kiểm định đã thông báo KTV kín lịch ca sáng. Vui lòng chọn ca chiều hoặc ngày khác.'
                        : isAfternoonFullOnDate
                          ? 'Trung tâm kiểm định đã thông báo KTV kín lịch ca chiều. Vui lòng chọn ca sáng hoặc ngày khác.'
                          : `Các khung giờ đã bị từ chối (${rejectedTimesOnSelectedDate.map((r) => r.time).filter(Boolean).join(', ')}) không thể chọn lại. Vui lòng chọn khung giờ khác còn trống.`}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Quick time slots & Custom time */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    {lang === 'vi' ? '3. Khung giờ KTV có mặt *' : '3. Estimated Arrival Time *'}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                    {isSelectedTimeValid && !isCurrentTimeRejected ? 'Đã chọn' : isCurrentTimeRejected ? 'Đã bị từ chối' : 'Giờ không hợp lệ'}: {selectedTime?.slice(0, 5) || '--:--'}
                  </span>
                </div>

                {/* Quick Slots - 8 slots in 4 columns */}
                <div className="grid grid-cols-4 gap-1.5">
                  {currentSlots.map((slot) => {
                    const isSelected = selectedTime?.slice(0, 5) === slot;
                    const { rejected: isRejectedSlot, reason: slotRejReason } = isSlotRejected(
                      selectedDate,
                      slot,
                      selectedShift,
                      allRejectedSlots
                    );
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isRejectedSlot}
                        onClick={() => {
                          if (isRejectedSlot) return;
                          setSelectedTime(slot);
                          setErrorMessage(null);
                        }}
                        title={isRejectedSlot ? slotRejReason || 'Khung giờ này đã bị từ chối cho ngày này' : undefined}
                        className={`py-1 px-1.5 rounded-lg text-xs font-bold border transition text-center relative ${
                          isRejectedSlot
                            ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed opacity-60'
                            : isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs cursor-pointer'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                        }`}
                      >
                        <span>{slot}</span>
                        {isRejectedSlot && (
                          <span className="block text-[8px] text-rose-500 font-bold no-underline leading-none">
                            Từ chối
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Fine-tune custom time */}
                <div className="pt-0.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Hoặc chỉnh giờ chi tiết:</span>
                    <input
                      type="time"
                      min={shiftHours.min}
                      max={shiftHours.max}
                      value={selectedTime}
                      aria-label={lang === 'vi' ? 'Chỉnh giờ chi tiết' : 'Custom appointment time'}
                      aria-invalid={!isSelectedTimeValid || isCurrentTimeRejected}
                      aria-describedby={!isSelectedTimeValid || isCurrentTimeRejected ? 'appointment-time-error' : undefined}
                      onChange={(e) => {
                        setSelectedTime(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="px-2 py-0.5 rounded-lg border border-gray-200 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-500 outline-hidden bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    ({shiftHours.min} - {shiftHours.max})
                  </span>
                </div>
                {isCurrentTimeRejected && (
                  <p role="alert" className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Khung giờ {selectedTime} ngày {formatDateDisplayVN(selectedDate)} đã bị Trung tâm kiểm định từ chối trước đó.
                    </span>
                  </p>
                )}
                {!isSelectedTimeValid && (
                  <p id="appointment-time-error" role="alert" className="text-[11px] font-medium text-rose-700">
                    {lang === 'vi'
                      ? `Vui lòng chọn giờ trong ca đã chọn (${shiftHours.min} - ${shiftHours.max}).`
                      : `Choose a time within the selected shift (${shiftHours.min} - ${shiftHours.max}).`}
                  </p>
                )}
              </div>

              {/* Step 4: Note / Directions */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? '4. Ghi chú địa điểm / Chỉ dẫn đường đi (tùy chọn):' : '4. Location notes / directions (optional):'}
                </label>
                <textarea
                  rows={1}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={lang === 'vi' ? 'Ví dụ: Căn hộ 402 lầu 4, vui lòng gọi trước khi đến 15 phút...' : 'E.g. Room 402, 4th floor, please call 15 mins before arrival...'}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden min-h-[38px] max-h-[70px] resize-y"
                />
              </div>
            </div>

            {/* Fixed Footer Buttons */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-100 bg-white transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isSelectedTimeValid || isCurrentTimeRejected}
                className="px-4.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{lang === 'vi' ? 'Xác nhận đặt lịch hẹn' : 'Confirm Appointment'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
