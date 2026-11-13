import { paths } from '../../app/router/paths';
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, X, Check, RefreshCw, AlertCircle, ShieldCheck, UserCheck, Sun, Sunset, Info } from 'lucide-react';
import { Language } from '../../types';
import { inspectorService } from '../../services/inspectorService';
import { saveScopedLocalNotification } from '../../utils/notificationStorage';

interface ScheduleAppointmentModalProps {
  orderId: string;
  orderCode?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  lang?: Language;
  readOnly?: boolean;
  initialScheduledAt?: string;
  initialNote?: string;
}

export type InspectionShift = 'MORNING' | 'AFTERNOON';

export const MORNING_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
export const AFTERNOON_SLOTS = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  orderId,
  orderCode,
  isOpen,
  onClose,
  onSuccess,
  lang = 'vi',
  readOnly = false,
  initialScheduledAt = '',
  initialNote = '',
}) => {
  // Form states
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<InspectionShift>('MORNING');
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const pad = (n: number) => String(n).padStart(2, '0');

    if (initDateStr) {
      try {
        const d = new Date(initDateStr);
        if (!isNaN(d.getTime())) {
          const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const hours = d.getHours();
          const minutes = d.getMinutes();
          const timePart = `${pad(hours)}:${pad(minutes)}`;

          // If date is in the past or today, push it forward to tomorrow
          if (datePart < tomorrowStr) {
            setSelectedDate(tomorrowStr);
            setSelectedShift('MORNING');
            setSelectedTime('09:00');
          } else {
            setSelectedDate(datePart);
            setSelectedTime(timePart);

            if (hours >= 13) {
              setSelectedShift('AFTERNOON');
            } else {
              setSelectedShift('MORNING');
            }
          }
        } else {
          setSelectedDate(tomorrowStr);
          setSelectedShift('MORNING');
          setSelectedTime('09:00');
        }
      } catch {
        setSelectedDate(tomorrowStr);
        setSelectedShift('MORNING');
        setSelectedTime('09:00');
      }
    } else {
      // Default to tomorrow morning
      setSelectedDate(tomorrowStr);
      setSelectedShift('MORNING');
      setSelectedTime('09:00');
    }

    setNote(initNoteStr || '');
    setErrorMessage(null);
  }, [isOpen, orderId, initialScheduledAt, initialNote, tomorrowStr]);

  if (!isOpen) return null;

  // Handle shift change
  const handleShiftSelect = (shift: InspectionShift) => {
    setSelectedShift(shift);
    if (shift === 'MORNING') {
      setSelectedTime('09:00');
    } else {
      setSelectedTime('14:00');
    }
    setErrorMessage(null);
  };

  const syncAppointmentToOrdersAndNotify = (scheduledDate: Date, noteText: string, shift: InspectionShift) => {
    const formattedDate = scheduledDate.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const shiftLabel = shift === 'MORNING' ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)';
    let buyerId: string | undefined;

    // 1. Cập nhật recent_placed_orders
    try {
      const raw = localStorage.getItem('recent_placed_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const updated = list.map((o: any) => {
            if (o.id === orderId) {
              buyerId = o.buyerId;
              return {
                ...o,
                appointmentScheduledAt: scheduledDate.toISOString(),
                appointmentNote: noteText,
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
            if (o.id === orderId) {
              return {
                ...o,
                appointmentScheduledAt: scheduledDate.toISOString(),
                appointmentNote: noteText,
              };
            }
            return o;
          });
          localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
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

    // STRICT BUSINESS HOURS VALIDATION:
    // Morning shift: 08:00 - 12:00
    // Afternoon shift: 13:00 - 17:00
    const hour = scheduledDate.getHours();
    const minute = scheduledDate.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    const morningStart = 8 * 60; // 08:00
    const morningEnd = 12 * 60; // 12:00
    const afternoonStart = 13 * 60; // 13:00
    const afternoonEnd = 17 * 60; // 17:00

    const isMorning = timeInMinutes >= morningStart && timeInMinutes <= morningEnd;
    const isAfternoon = timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd;

    if (!isMorning && !isAfternoon) {
      if (timeInMinutes > morningEnd && timeInMinutes < afternoonStart) {
        setErrorMessage('12:00 - 13:00 là thời gian nghỉ trưa của KTV. Vui lòng chọn Ca Sáng (08:00 - 12:00) hoặc Ca Chiều (13:00 - 17:00).');
      } else {
        setErrorMessage('Vui lòng chọn khung giờ hành chính: Ca Sáng (08:00 - 12:00) hoặc Ca Chiều (13:00 - 17:00).');
      }
      return;
    }

    const detectedShift: InspectionShift = isMorning ? 'MORNING' : 'AFTERNOON';

    setIsSubmitting(true);

    try {
      await inspectorService.scheduleAppointment(
        orderId,
        scheduledDate.toISOString(),
        note.trim() || undefined
      );

      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify({
        scheduledAt: scheduledDate.toISOString(),
        note: note.trim() || '',
        shift: detectedShift,
        assignedInspector: assignedInspector || undefined,
      }));

      syncAppointmentToOrdersAndNotify(scheduledDate, note.trim(), detectedShift);
      window.dispatchEvent(
        new CustomEvent('secondlife_appointment_scheduled', {
          detail: {
            orderId,
            scheduledAt: scheduledDate.toISOString(),
            note: note.trim(),
            shift: detectedShift,
          },
        })
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Backend schedule appointment error, fallback to local cache:', err);
      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify({
        scheduledAt: scheduledDate.toISOString(),
        note: note.trim() || '',
        shift: detectedShift,
        assignedInspector: assignedInspector || undefined,
      }));

      syncAppointmentToOrdersAndNotify(scheduledDate, note.trim(), detectedShift);
      window.dispatchEvent(
        new CustomEvent('secondlife_appointment_scheduled', {
          detail: {
            orderId,
            scheduledAt: scheduledDate.toISOString(),
            note: note.trim(),
            shift: detectedShift,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {readOnly
                  ? (lang === 'vi' ? 'Lịch Hẹn Kiểm Định (Người Bán Đã Đặt)' : 'Inspection Appointment (By Seller)')
                  : (lang === 'vi' ? 'Người Bán Hẹn Lịch Đón KTV' : 'Seller Inspection Appointment')}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'vi' ? 'Đơn hàng' : 'Order'} #{orderCode || orderId.slice(0, 8)} • {lang === 'vi' ? 'Kiểm định tận nơi' : 'At-Home Inspection'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Assigned Inspector Card */}
        {assignedInspector ? (
          <div className="p-3 bg-purple-50/80 rounded-2xl border border-purple-200/90 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-purple-900 flex items-center gap-1.5 flex-wrap">
                <span>KTV phụ trách:</span>
                <span className="text-purple-700 font-extrabold underline decoration-purple-300">
                  {assignedInspector.inspectorName || 'Kỹ thuật viên SecondLife'}
                </span>
              </div>
              <div className="text-[11px] text-purple-700 font-medium flex items-center gap-2 mt-0.5">
                {assignedInspector.inspectorPhone && <span>📞 {assignedInspector.inspectorPhone}</span>}
                {assignedInspector.inspectorEmail && <span>✉️ {assignedInspector.inspectorEmail}</span>}
                {!assignedInspector.inspectorPhone && !assignedInspector.inspectorEmail && (
                  <span>Được điều phối trực tiếp từ Trung tâm Kiểm định</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200/90 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-blue-900">
                Kỹ thuật viên phụ trách:
              </div>
              <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                Sau khi bạn chốt lịch hẹn, Trung tâm SecondLife sẽ xác nhận và phân công Kỹ thuật viên phù hợp đến tận nơi.
              </div>
            </div>
          </div>
        )}

        {/* Read-only view for Buyer */}
        {readOnly ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{lang === 'vi' ? 'Thời gian kỹ thuật viên đến kiểm định:' : 'Scheduled Inspection Time:'}</span>
              </div>
              <div className="text-base font-black text-slate-900">
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
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-600 block">
                  {lang === 'vi' ? 'Ghi chú đón KTV của người bán:' : 'Seller note:'}
                </span>
                <p className="text-xs text-slate-800">{note}</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                {lang === 'vi'
                  ? 'Kỹ thuật viên chuyên nghiệp của SecondLife sẽ có mặt tại địa chỉ của Người Bán đúng lịch hẹn trong khung giờ hành chính để kiểm tra máy và dán tem niêm phong.'
                  : 'SecondLife certified technician will inspect and seal the item at the seller location during business hours.'}
              </span>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đã Hiểu & Đóng' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          /* Form for Seller */
          <>
            {/* Business Hours & Advance Notice Info Banner */}
            <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px] leading-relaxed">
                <div className="font-bold text-amber-900">
                  {lang === 'vi' ? 'Quy Định Đặt Lịch Hẹn Kiểm Định Tận Nơi' : 'Appointment Rules & Business Hours'}
                </div>
                <p className="text-amber-800">
                  • <strong>Bắt buộc hẹn trước tối thiểu 1 ngày:</strong> Không nhận lịch trong ngày hôm nay hoặc quá khứ để kịp phân công KTV chuẩn bị thiết bị.
                  <br />• <strong>Khung giờ hành chính:</strong> Ca Sáng (08:00 - 12:00) hoặc Ca Chiều (13:00 - 17:00).
                  <br /><em>(Khung giờ nghỉ trưa 12:00 - 13:00 và ngoài 17:00 hệ thống không tiếp nhận).</em>
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Select Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <span>{lang === 'vi' ? '1. Chọn ngày hẹn kiểm định *' : '1. Select Inspection Date *'}</span>
                  </span>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                    {lang === 'vi' ? 'Hẹn trước tối thiểu 1 ngày' : 'Min 1 day in advance'}
                  </span>
                </label>
                <input
                  type="date"
                  min={tomorrowStr}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setErrorMessage(null);
                  }}
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden bg-gray-50/50"
                />
              </div>

              {/* Step 2: Select Shift */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{lang === 'vi' ? '2. Chọn ca hành chính *' : '2. Select Shift *'}</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleShiftSelect('MORNING')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${selectedShift === 'MORNING'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${selectedShift === 'MORNING' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Ca Sáng</div>
                      <div className="text-[11px] font-bold text-amber-700">08:00 - 12:00</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShiftSelect('AFTERNOON')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${selectedShift === 'AFTERNOON'
                      ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-400/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${selectedShift === 'AFTERNOON' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Sunset className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Ca Chiều</div>
                      <div className="text-[11px] font-bold text-orange-700">13:00 - 17:00</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 3: Quick time slots & Custom time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{lang === 'vi' ? '3. Khung giờ KTV dự kiến có mặt *' : '3. Estimated Arrival Time *'}</span>
                  <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                    Đã chọn: {selectedTime}
                  </span>
                </label>

                {/* Quick Slots */}
                <div className="grid grid-cols-4 gap-1.5">
                  {currentSlots.map((slot) => {
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setSelectedTime(slot);
                          setErrorMessage(null);
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>

                {/* Fine-tune custom time */}
                <div className="pt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium shrink-0">Hoặc chỉnh giờ chi tiết:</span>
                  <input
                    type="time"
                    min={selectedShift === 'MORNING' ? '08:00' : '13:00'}
                    max={selectedShift === 'MORNING' ? '12:00' : '17:00'}
                    value={selectedTime}
                    onChange={(e) => {
                      setSelectedTime(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
                  />
                  <span className="text-[10px] text-slate-400">
                    ({selectedShift === 'MORNING' ? '08:00 - 12:00' : '13:00 - 17:00'})
                  </span>
                </div>
              </div>

              {/* Note / Directions */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? '4. Ghi chú địa điểm / Chỉ dẫn đường đi (tùy chọn):' : '4. Location notes / directions (optional):'}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={lang === 'vi' ? 'Ví dụ: Chung cư phòng 402 lầu 4, vui lòng gọi trước khi đến 15 phút...' : 'E.g. Room 402, 4th floor, please call 15 mins before arrival...'}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  {lang === 'vi' ? 'Hủy Bỏ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{lang === 'vi' ? 'Xác Nhận Đặt Lịch Hẹn' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
