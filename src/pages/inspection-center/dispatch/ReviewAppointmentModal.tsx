import { getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from './orderContacts';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Loader2,
  X,
  Check,
  Package,
  CalendarCheck,
  CalendarSync,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { formatVND } from '../../../utils/translations';
import type { useCenterAppointments } from './useCenterAppointments';

interface Props {
  reviewApptOrder: NonNullable<ReturnType<typeof useCenterAppointments>['reviewApptOrder']>;
  appointments: Pick<ReturnType<typeof useCenterAppointments>,
    | 'counterDate'
    | 'counterError'
    | 'counterNote'
    | 'counterShift'
    | 'counterTime'
    | 'handleConfirmAcceptAppointment'
    | 'handleConfirmSendCounter'
    | 'isSubmittingAccept'
    | 'isSubmittingCounter'
    | 'reviewMode'
    | 'setCounterDate'
    | 'setCounterError'
    | 'setCounterNote'
    | 'setCounterShift'
    | 'setCounterTime'
    | 'setRejectApptError'
    | 'setRejectApptModalOrder'
    | 'setRejectApptReason'
    | 'setReviewApptOrder'
    | 'setReviewMode'
  >;
}

export function ReviewAppointmentModal({ reviewApptOrder, appointments }: Props) {
  const {
    counterDate,
    counterError,
    counterNote,
    counterShift,
    counterTime,
    handleConfirmAcceptAppointment,
    handleConfirmSendCounter,
    isSubmittingAccept,
    isSubmittingCounter,
    reviewMode,
    setCounterDate,
    setCounterError,
    setCounterNote,
    setCounterShift,
    setCounterTime,
    setRejectApptError,
    setRejectApptModalOrder,
    setRejectApptReason,
    setReviewApptOrder,
    setReviewMode,
  } = appointments;

  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-center justify-center animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-amber-100 max-h-[90vh] overflow-y-auto my-auto relative subtle-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Duyệt Lịch Hẹn Kiểm Định Tại Nhà
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Đơn hàng #{reviewApptOrder.id.slice(0, 8)} • Thương lượng thời gian kiểm định với người bán
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReviewApptOrder(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông tin đơn hàng & Người bán */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-2.5">
            {reviewApptOrder.postImageUrls?.[0] ? (
              <img
                src={reviewApptOrder.postImageUrls[0]}
                alt=""
                className="w-11 h-11 rounded-lg object-cover border border-slate-200"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                <Package className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 truncate" title={reviewApptOrder.postTitle}>
                {reviewApptOrder.postTitle || 'Sản phẩm kiểm định'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span className="font-semibold text-rose-600">{formatVND(reviewApptOrder.postPrice || 0)}</span>
                <span>•</span>
                <span className="text-slate-600">Phí kiểm định: <strong>{formatVND(reviewApptOrder.inspectionFee || 200000)}</strong></span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700">
            <div className="min-w-0 break-words">
              👤 <strong>Người bán:</strong> {getOrderSellerName(reviewApptOrder)} ({getOrderSellerPhone(reviewApptOrder)})
            </div>
            <div className="min-w-0 break-words">
              📍 <strong>Địa chỉ đến:</strong> {getOrderSellerAddress(reviewApptOrder)}
            </div>
          </div>
        </div>

        {/* Thông tin lịch hẹn người bán đề xuất */}
        {(() => {
          let apptTime = reviewApptOrder.appointmentScheduledAt;
          let apptNote = reviewApptOrder.appointmentNote;
          let apptShift = 'MORNING';
          let existingCounterTime = reviewApptOrder.counterScheduledAt;
          let counterReason = reviewApptOrder.counterNote;
          let apptStatus = reviewApptOrder.appointmentStatus;

          const possibleIds = [reviewApptOrder.id, reviewApptOrder.linkedOrderId, (reviewApptOrder as any).orderId, (reviewApptOrder as any).inspectionOrderId].filter(Boolean) as string[];
          const idSet = new Set(possibleIds);

          for (const pid of possibleIds) {
            try {
              const raw = localStorage.getItem(`order_appointment_${pid}`);
              if (raw) {
                const p = JSON.parse(raw);
                if (p.scheduledAt) apptTime = p.scheduledAt;
                if (p.note) apptNote = p.note;
                if (p.shift) apptShift = p.shift;
                if (p.status === 'PENDING_CENTER_CONFIRMATION' && !p.counterScheduledAt) {
                  existingCounterTime = undefined;
                  counterReason = undefined;
                  apptStatus = 'PENDING_CENTER_CONFIRMATION';
                  break;
                } else if (p.counterScheduledAt) {
                  existingCounterTime = p.counterScheduledAt;
                  if (p.counterNote) counterReason = p.counterNote;
                  if (p.status) apptStatus = p.status;
                  break;
                }
              }
            } catch { }
          }

          if (apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
            try {
              const rawCenter = localStorage.getItem('center_inspection_orders');
              if (rawCenter) {
                const list = JSON.parse(rawCenter);
                if (Array.isArray(list)) {
                  const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
                  if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                    apptTime = m.appointmentScheduledAt || apptTime;
                    apptNote = m.appointmentNote || apptNote;
                    apptStatus = 'PENDING_CENTER_CONFIRMATION';
                    existingCounterTime = undefined;
                    counterReason = undefined;
                  }
                }
              }
            } catch {}
          }

          if (apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
            try {
              const rawSeller = localStorage.getItem('my_seller_inspection_orders');
              if (rawSeller) {
                const list = JSON.parse(rawSeller);
                if (Array.isArray(list)) {
                  const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
                  if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                    apptTime = m.appointmentScheduledAt || apptTime;
                    apptNote = m.appointmentNote || apptNote;
                    apptStatus = 'PENDING_CENTER_CONFIRMATION';
                    existingCounterTime = undefined;
                    counterReason = undefined;
                  }
                }
              }
            } catch {}
          }

          const isWaitingSellerCounter = Boolean(
            existingCounterTime &&
            apptStatus === 'COUNTERED_BY_CENTER' &&
            reviewApptOrder.status !== 'CONFIRMED'
          );

          const isMorning = apptShift === 'MORNING' || (apptTime && new Date(apptTime).getHours() < 12);
          const formattedDate = apptTime ? new Date(apptTime).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : 'Chưa xác định';

          return (
            <>
              <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    Lịch Hẹn Người Bán Yêu Cầu:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                    {isMorning ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)'}
                  </span>
                </div>

                <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{formattedDate}</span>
                </div>

                {apptNote && (
                  <div className="text-[11px] text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-200/80 italic">
                    💬 <strong>Ghi chú đón KTV:</strong> "{apptNote}"
                  </div>
                )}

                {/* Khi chọn Tab Đề Xuất Lịch Mới: Hiển thị cảnh báo tự động từ chối lịch cũ kèm lý do */}
                {reviewMode === 'COUNTER' && !isWaitingSellerCounter && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Yêu cầu lịch hẹn cũ này sẽ tự động bị từ chối khi gửi đề xuất mới:</span>
                    </div>
                    <div className="text-rose-700 bg-white/90 p-2 rounded-lg border border-rose-200/80 leading-relaxed italic">
                      💬 <strong>Lý do từ chối gửi cho Người bán:</strong> {counterNote.trim() ? `"${counterNote.trim()}"` : <span className="text-rose-400 not-italic">(Chưa có lý do - vui lòng nhập tại ô "4. Lý do đề xuất lại cho Người bán: *" bên dưới)</span>}
                    </div>
                  </div>
                )}

                {existingCounterTime && (
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 text-[11px] text-sky-950 space-y-1">
                    <div className="font-bold text-sky-950 flex items-center gap-1.5">
                      <CalendarSync className="w-3.5 h-3.5 text-sky-600" />
                      <span>Trung tâm đã gửi đề xuất mới trước đó:</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-sky-200">
                      <div>📅 <strong>Giờ đề xuất:</strong> {new Date(existingCounterTime).toLocaleString('vi-VN')}</div>
                      {counterReason && (
                        <div className="italic text-sky-800 mt-0.5">
                          💬 <strong>Lý do:</strong> "{counterReason}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Chọn hình thức phản hồi */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewMode('VIEW');
                      setCounterError(null);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewMode === 'VIEW'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>1. Chấp Nhận Lịch Hẹn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewMode('COUNTER');
                      setCounterError(null);
                      if (!counterNote.trim()) {
                        setCounterNote('KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
                      }
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewMode === 'COUNTER'
                        ? 'bg-white text-amber-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CalendarSync className="w-4 h-4 text-amber-600" />
                    <span>{isWaitingSellerCounter ? '2. Đề Xuất Lịch (Đã Gửi)' : '2. Đề Xuất Lịch Mới'}</span>
                  </button>
                </div>

                {/* MODE 1: CHẤP NHẬN LỊCH HẸN */}
                {reviewMode === 'VIEW' && (
                  isWaitingSellerCounter ? (
                    <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs space-y-2">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                        <span>Lịch hẹn gốc đã bị hủy để chờ thương lượng lịch mới</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Trung tâm đã gửi đề xuất dời lịch sang <strong>{new Date(existingCounterTime!).toLocaleString('vi-VN')}</strong>. Lịch hẹn ban đầu của người bán không còn hiệu lực. Vui lòng chờ người bán xác nhận lịch mới hoặc gửi lại yêu cầu khác.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs space-y-3">
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Đồng ý với lịch người bán đã chọn</span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Khi bấm xác nhận, hệ thống sẽ chốt lịch hẹn này, gửi thông báo cho Người bán và chuyển sang bước <strong>Giao task cho Kỹ thuật viên</strong>.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmAcceptAppointment}
                        disabled={isSubmittingAccept}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingAccept ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>Xác Nhận Chấp Nhận Lịch Hẹn</span>
                      </button>
                    </div>
                  )
                )}

                {/* MODE 2: ĐỀ XUẤT LỊCH MỚI (GỬI LẠI CHO SELLER) */}
                {reviewMode === 'COUNTER' && (
                  isWaitingSellerCounter ? (
                    <div className="p-4 bg-amber-50/90 rounded-2xl border-2 border-amber-300 text-xs space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                        <Clock className="w-5 h-5 text-amber-700 animate-spin" />
                        <span>Đã Gửi Đề Xuất • Đang Chờ Người Bán Phản Hồi</span>
                      </div>
                      <p className="text-amber-900 leading-relaxed">
                        Trung tâm đã gửi đề xuất dời lịch hẹn sang{' '}
                        <strong className="text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                          {new Date(existingCounterTime!).toLocaleString('vi-VN')}
                        </strong>
                        . Hệ thống đang chờ Người bán phản hồi (Đồng ý hoặc Hẹn lại). <strong>Phần gửi đề xuất đã được khóa tạm thời</strong> để tránh gửi trùng lặp cho đến khi Người bán phản hồi.
                      </p>
                      {counterReason && (
                        <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200 text-[11px] text-amber-900 italic">
                          💬 <strong>Lý do đã gửi cho Người bán:</strong> "{counterReason}"
                        </div>
                      )}
                      <div className="p-2.5 bg-white/70 rounded-xl border border-amber-200/80 text-[11px] text-slate-700 flex items-center justify-between flex-wrap gap-2">
                        <span>📞 Cần thay đổi gấp? Liên hệ người bán:</span>
                        <strong className="text-slate-900 font-bold">{getOrderSellerPhone(reviewApptOrder)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-3">
                      <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 space-y-1">
                        <div className="font-bold flex items-center gap-1 text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Quy trình đề xuất lịch hẹn mới:</span>
                        </div>
                        <p className="text-amber-900 leading-relaxed">
                          Khi gửi đề xuất mới, yêu cầu lịch hẹn cũ của người bán sẽ được hệ thống <strong>tự động chuyển thành từ chối</strong> kèm lý do tại mục <strong>4. Lý do đề xuất lại cho Người bán: *</strong> bên dưới. Người bán sẽ nhận được thông báo đề xuất lịch mới để bấm Xác nhận hoặc Hẹn lại.
                        </p>
                      </div>
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <CalendarSync className="w-4 h-4 text-amber-700" />
                        <span>Đề xuất ngày giờ mới gửi lại cho Người bán:</span>
                      </div>

                      {/* 1. Ngày hẹn mới */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>1. Ngày hẹn mới đề xuất: *</span>
                          <span className="text-[10px] text-amber-700 font-semibold">≥ 1 ngày</span>
                        </label>
                        <div
                          className="relative flex items-center justify-between p-2.5 bg-white border border-amber-300 rounded-xl cursor-pointer hover:border-amber-500 transition shadow-2xs group"
                        >
                          <div className="flex items-center gap-2 pointer-events-none">
                            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-bold text-slate-800 text-xs">
                              {(() => {
                                if (!counterDate) return 'Chọn ngày hẹn';
                                const [y, m, d] = counterDate.split('-');
                                return `${d}/${m}/${y}`;
                              })()}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium pointer-events-none">Bấm để đổi ngày 📅</span>
                          <input
                            id="reviewCounterDateInput"
                            type="date"
                            min={(() => {
                              const tom = new Date();
                              tom.setDate(tom.getDate() + 1);
                              const pad = (n: number) => String(n).padStart(2, '0');
                              return `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
                            })()}
                            value={counterDate}
                            onChange={(e) => setCounterDate(e.target.value)}
                            onClick={(e) => {
                              try {
                                (e.target as HTMLInputElement).showPicker?.();
                              } catch {}
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                          />
                        </div>
                      </div>

                      {/* 2. Ca làm việc */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">2. Ca làm việc: *</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCounterShift('MORNING');
                              const h = parseInt(counterTime?.slice(0, 2) || '', 10);
                              if (isNaN(h) || h < 8 || h >= 12) {
                                setCounterTime('09:00');
                              }
                              setCounterError(null);
                            }}
                            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              counterShift === 'MORNING'
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span>Ca Sáng (08:00 - 12:00)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCounterShift('AFTERNOON');
                              const h = parseInt(counterTime?.slice(0, 2) || '', 10);
                              if (isNaN(h) || h < 13 || h > 17) {
                                setCounterTime('14:00');
                              }
                              setCounterError(null);
                            }}
                            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              counterShift === 'AFTERNOON'
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span>Ca Chiều (13:00 - 17:00)</span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Khung giờ KTV có mặt */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-bold text-slate-700">3. Khung giờ KTV có mặt: *</label>
                          <span className="font-mono font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded text-[11px]">
                            Đã chọn: {counterTime?.slice(0, 5) || (counterShift === 'MORNING' ? '09:00' : '14:00')}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(counterShift === 'MORNING'
                            ? ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
                            : ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
                          ).map((slot) => {
                            const isSelected = (counterTime?.slice(0, 5) || '') === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  setCounterTime(slot);
                                  setCounterError(null);
                                }}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer text-center ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                        {/* Fine-tune custom time picker */}
                        <div className="pt-0.5 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium">Hoặc chỉnh giờ chi tiết:</span>
                            <input
                              type="time"
                              min={counterShift === 'MORNING' ? '08:00' : '13:00'}
                              max={counterShift === 'MORNING' ? '12:00' : '17:00'}
                              value={counterTime?.slice(0, 5) || (counterShift === 'MORNING' ? '09:00' : '14:00')}
                              onChange={(e) => {
                                setCounterTime(e.target.value);
                                setCounterError(null);
                              }}
                              className="px-2 py-0.5 rounded-lg border border-amber-300 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-500 outline-hidden bg-white cursor-pointer"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">
                            ({counterShift === 'MORNING' ? '08:00 - 12:00' : '13:00 - 17:00'})
                          </span>
                        </div>
                      </div>

                      {/* 4. Lý do / Ghi chú gửi người bán */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>4. Lý do đề xuất lại cho Người bán: *</span>
                          <span className="text-[10px] text-slate-400 font-normal">Hiển thị trực tiếp cho người bán</span>
                        </label>
                        <textarea
                          rows={2}
                          value={counterNote}
                          onChange={(e) => {
                            setCounterNote(e.target.value);
                            setCounterError(null);
                          }}
                          placeholder="Nhập lý do dời lịch (ví dụ: Ca sáng KTV đã kín lịch tại khu vực của bạn...)"
                          className="w-full p-2.5 bg-white rounded-xl border border-amber-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        />

                        {/* Quick suggestion chips */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gợi ý lý do nhanh:</span>
                          <div className="flex flex-wrap gap-1">
                            {[
                              'KTV đã kín lịch ca sáng, đề xuất chuyển sang ca chiều cùng ngày.',
                              'KTV khu vực này chỉ có mặt vào buổi chiều, mong người bán thông cảm.',
                              'Trùng lịch kiểm tra lưu động, đề xuất chuyển sang ngày tiếp theo.',
                              'Cần thời gian chuẩn bị thiết bị kiểm định chuyên dụng cho model này.',
                            ].map((hint, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCounterNote(hint)}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                              >
                                {hint}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {counterError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{counterError}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleConfirmSendCounter}
                        disabled={isSubmittingCounter}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingCounter ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarSync className="w-4 h-4" />
                        )}
                        <span>Xác Nhận &amp; Gửi Lại Lịch Cho Người Bán</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            </>
          );
        })()}

        {/* Footer: Nút Từ Chối & Nút Đóng */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              const ord = reviewApptOrder;
              setReviewApptOrder(null);
              setRejectApptModalOrder(ord);
              setRejectApptReason('');
              setRejectApptError(null);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
            title="Từ chối lịch hẹn nếu Trung tâm hoàn toàn không thể nhận đơn này"
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Từ Chối Lịch Hẹn</span>
          </button>

          <button
            type="button"
            onClick={() => setReviewApptOrder(null)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
