import React, { useState } from 'react';
import { Calendar, Clock, MapPin, X, Check, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { Language } from '../../types';
import { inspectorService } from '../../services/inspectorService';

interface ScheduleAppointmentModalProps {
  orderId: string;
  orderCode?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  lang?: Language;
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  orderId,
  orderCode,
  isOpen,
  onClose,
  onSuccess,
  lang = 'vi',
}) => {
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Set min datetime to now + 2 hours
  const minDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

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
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lên lịch hẹn kiểm định thất bại. Vui lòng thử lại.');
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
                Lên Lịch Hẹn Kiểm Định Tại Nhà
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Đơn hàng #{orderCode || orderId.slice(0, 8)} • Gói AT_HOME
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

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Thời gian kỹ thuật viên đến kiểm định *</span>
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
              Kỹ thuật viên sẽ có mặt tại địa chỉ của Người bán trong khung giờ này để tiến hành niêm phong và chấm điểm checklist.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Ghi chú địa điểm / Chỉ dẫn đường đi (tùy chọn):
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Chung cư tầng 5, gọi điện trước khi đến 15 phút..."
              className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 transition"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Xác Nhận Lịch Hẹn</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
