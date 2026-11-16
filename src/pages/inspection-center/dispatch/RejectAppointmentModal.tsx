import { getOrderSellerAddress, getOrderSellerName } from './orderContacts';
import { AlertCircle, Calendar, RefreshCw, X, XCircle } from 'lucide-react';
import type { useCenterAppointments } from './useCenterAppointments';

interface Props {
  rejectApptModalOrder: NonNullable<ReturnType<typeof useCenterAppointments>['rejectApptModalOrder']>;
  appointments: Pick<ReturnType<typeof useCenterAppointments>,
    | 'handleRejectAppointment'
    | 'isRejectingAppt'
    | 'rejectApptError'
    | 'rejectApptReason'
    | 'setRejectApptError'
    | 'setRejectApptModalOrder'
    | 'setRejectApptReason'
  >;
}

export function RejectAppointmentModal({ rejectApptModalOrder, appointments }: Props) {
  const {
    handleRejectAppointment,
    isRejectingAppt,
    rejectApptError,
    rejectApptReason,
    setRejectApptError,
    setRejectApptModalOrder,
    setRejectApptReason,
  } = appointments;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-rose-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">Từ Chối Lịch Hẹn Đón KTV</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Đơn hàng #{rejectApptModalOrder.id.slice(0, 8)} • Người bán: {getOrderSellerName(rejectApptModalOrder)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRejectApptModalOrder(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông tin lịch hẹn người bán đề xuất */}
        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1">
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Thời gian người bán yêu cầu đón KTV:</span>
          </div>
          <p className="font-extrabold text-slate-800">
            🕒 {rejectApptModalOrder.appointmentScheduledAt ? new Date(rejectApptModalOrder.appointmentScheduledAt).toLocaleString('vi-VN') : 'Chưa rõ'}
          </p>
          <p className="text-[11px] text-slate-600">
            📍 Địa chỉ: {getOrderSellerAddress(rejectApptModalOrder)}
          </p>
        </div>

        {/* Input lý do từ chối */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-800 flex items-center justify-between">
            <span>Lý do từ chối lịch hẹn: <strong className="text-rose-500">*</strong></span>
            <span className="text-[10px] text-slate-400 font-normal">Gửi trực tiếp đến người bán</span>
          </label>
          <textarea
            rows={3}
            value={rejectApptReason}
            onChange={(e) => {
              setRejectApptReason(e.target.value);
              setRejectApptError(null);
            }}
            placeholder="Nhập lý do cụ thể để người bán chọn lại lịch hẹn phù hợp..."
            className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
          />

          {/* Gợi ý nhanh */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gợi ý lý do nhanh:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'KTV đã kín lịch trong khung giờ này, vui lòng chọn ca khác.',
                'Địa chỉ ngoài phạm vi phục vụ trong khung giờ yêu cầu.',
                'Trùng lịch bảo trì định kỳ thiết bị đo kiểm lưu động.',
                'Vui lòng hẹn trước tối thiểu 1 ngày trong giờ hành chính.',
              ].map((quickReason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRejectApptReason(quickReason)}
                  className="text-[10px] font-medium px-2 py-1 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition border border-gray-200 cursor-pointer"
                >
                  {quickReason}
                </button>
              ))}
            </div>
          </div>

          {rejectApptError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{rejectApptError}</span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setRejectApptModalOrder(null)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-100 transition cursor-pointer"
          >
            Quay Lại
          </button>
          <button
            type="button"
            onClick={handleRejectAppointment}
            disabled={isRejectingAppt || !rejectApptReason.trim()}
            className="px-4.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {isRejectingAppt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>Xác Nhận Từ Chối</span>
          </button>
        </div>
      </div>
    </div>
  );
}
