import React, { useState } from 'react';
import { Calendar, Clock, MapPin, X, Check, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
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
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      let initDate = initialScheduledAt;
      let initNote = initialNote;
      try {
        const raw = localStorage.getItem(`order_appointment_${orderId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt && !initDate) initDate = parsed.scheduledAt;
          if (parsed.note && !initNote) initNote = parsed.note;
        }
      } catch {}

      if (initDate) {
        try {
          const d = new Date(initDate);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setScheduledAt(localStr);
          } else {
            setScheduledAt(initDate.slice(0, 16));
          }
        } catch {
          setScheduledAt(initDate.slice(0, 16));
        }
      } else {
        setScheduledAt('');
      }
      setNote(initNote || '');
      setErrorMessage(null);
    }
  }, [isOpen, orderId, initialScheduledAt, initialNote]);

  if (!isOpen) return null;

  // Set min datetime to now + 2 hours
  const minDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const syncAppointmentToOrdersAndNotify = (scheduledDate: Date, noteText: string) => {
    const formattedDate = scheduledDate.toLocaleString('vi-VN');
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

    // 2. Gửi thông báo cho Người mua
    const buyerNotif = {
      id: `notif-buyer-appt-${orderId}-${Date.now()}`,
      recipientId: buyerId,
      recipientRole: 'buyer',
      title: 'Người bán đã hẹn lịch đón KTV kiểm định tại nhà',
      message: `Người bán đã lên lịch hẹn đón KTV SecondLife đến thẩm định máy vào ${formattedDate}. Đơn hàng #${orderCode || orderId.slice(0, 8)} đang được tiến hành kiểm tra!`,
      type: 'INSPECTION' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: '/orders?order_tab=inspecting',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(buyerNotif, buyerId, 'buyer');

    // 3. Gửi thông báo cho Trung tâm kiểm định / KTV
    const centerNotif = {
      id: `notif-center-appt-${orderId}-${Date.now()}`,
      recipientRole: 'inspection_center',
      title: `Đã có lịch hẹn kiểm định tại nhà (#${orderCode || orderId.slice(0, 8)})`,
      message: `Người bán đã hẹn đón KTV vào ${formattedDate}. Trung tâm vui lòng phân công KTV đến đúng giờ! Ghi chú: ${noteText || 'Không có'}`,
      type: 'INSPECTION_TASK' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: '/inspection-center',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');

    try {
      window.dispatchEvent(new CustomEvent('secondlife_appointment_scheduled', {
        detail: { orderId, scheduledAt: scheduledDate.toISOString(), note: noteText }
      }));
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      setErrorMessage('Vui lòng chọn ngày và giờ hẹn kiểm định');
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate.getTime() <= Date.now()) {
      setErrorMessage('Lịch hẹn kiểm định phải ở thời điểm tương lai');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await inspectorService.scheduleAppointment(
        orderId,
        scheduledDate.toISOString(),
        note.trim() || undefined
      );
      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify({
        scheduledAt: scheduledDate.toISOString(),
        note: note.trim() || ''
      }));
      syncAppointmentToOrdersAndNotify(scheduledDate, note.trim());
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Backend schedule appointment error, fallback to local cache:', err);
      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify({
        scheduledAt: scheduledDate.toISOString(),
        note: note.trim() || ''
      }));
      syncAppointmentToOrdersAndNotify(scheduledDate, note.trim());
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5">
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
                  : (lang === 'vi' ? 'Người Bán Hẹn Lịch Kiểm Định' : 'Seller Inspection Appointment')}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'vi' ? 'Đơn hàng' : 'Order'} #{orderCode || orderId.slice(0, 8)} • {lang === 'vi' ? 'Kiểm định chất lượng' : 'Inspection Package'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-only view for Buyer */}
        {readOnly ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{lang === 'vi' ? 'Thời gian kỹ thuật viên đến kiểm định:' : 'Scheduled Inspection Time:'}</span>
              </div>
              <div className="text-base font-black text-slate-900">
                {scheduledAt ? (
                  new Date(scheduledAt).toLocaleString('vi-VN', {
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
                  {lang === 'vi' ? 'Ghi chú của người bán:' : 'Seller note:'}
                </span>
                <p className="text-xs text-slate-800">{note}</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                {lang === 'vi'
                  ? 'Kỹ thuật viên chuyên nghiệp của SecondLife sẽ có mặt tại kho/địa chỉ của Người Bán đúng lịch hẹn để kiểm tra toàn diện và niêm phong kiện hàng.'
                  : 'SecondLife certified technician will inspect and seal the item at the seller location according to this schedule.'}
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
            {/* Error Alert */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{lang === 'vi' ? 'Thời gian kỹ thuật viên đến kiểm định *' : 'Inspection Time *'}</span>
                </label>
                <input
                  type="datetime-local"
                  min={minDate}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <p className="text-[11px] text-slate-400">
                  {lang === 'vi'
                    ? 'Kỹ thuật viên sẽ có mặt tại địa chỉ của Người Bán trong khung giờ này để tiến hành niêm phong và chấm điểm checklist.'
                    : 'The certified inspector will arrive at your address during this time slot.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {lang === 'vi' ? 'Ghi chú địa điểm / Chỉ dẫn đường đi (tùy chọn):' : 'Location notes / directions (optional):'}
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={lang === 'vi' ? 'Ví dụ: Chung cư tầng 5, gọi điện trước khi đến 15 phút...' : 'E.g. 5th floor, please call 15 mins before arrival...'}
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{lang === 'vi' ? 'Xác Nhận Lịch Hẹn' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
