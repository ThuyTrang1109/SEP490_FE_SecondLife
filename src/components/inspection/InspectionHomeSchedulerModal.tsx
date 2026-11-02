import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';

interface InspectionHomeSchedulerModalProps {
  order: InspectionOrderDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: InspectionOrderDto) => void;
  isInspector?: boolean;
}

export const InspectionHomeSchedulerModal: React.FC<InspectionHomeSchedulerModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
  isInspector = false,
}) => {
  // Default to tomorrow 09:00
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(9, 0, 0, 0);

  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  const formatDatetimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [datetimeStr, setDatetimeStr] = useState<string>(
    order.appointmentScheduledAt
      ? formatDatetimeLocal(new Date(order.appointmentScheduledAt))
      : formatDatetimeLocal(defaultDate)
  );
  const [note, setNote] = useState<string>(
    isInspector ? 'Kỹ thuật viên sẽ liên hệ trước 30 phút khi đến nhà.' : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datetimeStr) {
      setErrorMessage('Vui lòng chọn ngày và giờ hẹn kiểm định.');
      return;
    }

    const selectedDate = new Date(datetimeStr);
    if (selectedDate.getTime() <= Date.now()) {
      setErrorMessage('Lịch hẹn kiểm định phải ở thời điểm tương lai.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await inspectorService.scheduleAppointment(
        order.id,
        selectedDate.toISOString(),
        note.trim() || undefined
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lên lịch hẹn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {isInspector ? 'Lên Lịch Hẹn Kiểm Định Tại Nhà' : 'Thống Nhất Giờ Hẹn Kiểm Định'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gói Kiểm định tại nhà (AT_HOME)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Location info card */}
          <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-2 text-xs sm:text-sm">
            <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Địa chỉ kiểm định:</span>{' '}
                <span>{order.sellerAddress || order.address || 'Địa chỉ nhà người bán'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{order.sellerName || 'Người bán'}</span>
              </div>
              {order.sellerPhone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.sellerPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Datetime picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Chọn ngày và giờ hẹn <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                required
                value={datetimeStr}
                onChange={(e) => setDatetimeStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Khuyến nghị chọn trong giờ hành chính từ 08:30 đến 18:00 các ngày trong tuần.
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Ghi chú cho cuộc hẹn
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Gọi trước khi đến, chung cư cần thẻ thang máy, mang sẵn bộ dụng cụ mở máy..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !datetimeStr}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu lịch...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Giờ Hẹn</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

