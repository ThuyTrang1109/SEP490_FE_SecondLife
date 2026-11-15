import { AlertCircle, Calendar, CalendarSync, Check, Clock, Truck, UserCheck } from 'lucide-react';
import { AtHomeIntakeBarcode } from '../../inspection/AtHomeIntakeBarcode';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import { getOrderAppointmentRejection } from '../../../utils/orders/orderAppointments';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { buyerInspectionStageLabel, getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
import { getInboundShipmentProgress } from '../../../utils/inspectionCenterData';
import { getOrderAllShipments } from '../../../utils/orders/shipmentCache';

interface Props {
  orderIsSeller: boolean;
  hasInspection: boolean;
  order: EscrowOrder;
  savedAppointment: OrderAppointment | null;
  lang: Language;
  ordShipment: ShipmentBackend | null;
  state: {
    isOrderCancelledOrRefunded: OrderCheck;
    isOrderReceiptConfirmed: OrderCheck;
    isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
    isOrderSellerConfirmed: OrderCheck;
  };
  actions: {
    setSchedulingOrder: (order: EscrowOrder) => void;
    setSchedulingReadOnly: (readOnly: boolean) => void;
    handleSellerAcceptCounterAppointment: (orderId: string, appointment: OrderAppointment) => Promise<void>;
  };
}

export function OrderCardInspection({
  orderIsSeller, hasInspection, order: ord, savedAppointment, lang, ordShipment,
  state: { isOrderCancelledOrRefunded, isOrderReceiptConfirmed, isInspectorArrivedForOrder, isOrderSellerConfirmed },
  actions: { setSchedulingOrder, setSchedulingReadOnly, handleSellerAcceptCounterAppointment }
}: Props) {
  return (
    <>
      {/* Seller Inspection Request Alert Banner */}
      {orderIsSeller && hasInspection && !isOrderCancelledOrRefunded(ord) && !isOrderReceiptConfirmed(ord) && (
        <div className="mx-4 sm:mx-6 mb-3 p-3.5 rounded-2xl border text-xs shadow-2xs transition-all animate-fadeIn">
          {(ord.inspectionMethod === 'AT_HOME' || (ord as any).orderType === 'AT_HOME' || String(ord.inspectionMethod).toUpperCase() === 'AT_HOME' || String((ord as any).orderType).toUpperCase() === 'AT_HOME') ? (
            /* TRƯỜNG HỢP 1: KIỂM ĐỊNH TẬN NHÀ (KTV ĐẾN NHÀ) */
            (() => {
              const rejectionInfo = getOrderAppointmentRejection(ord);
              const isOrderCountered = Boolean(
                savedAppointment?.status === 'COUNTERED_BY_CENTER' ||
                savedAppointment?.counterScheduledAt ||
                (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
                (ord as any).counterScheduledAt ||
                (ord as any).status === 'WAITING_SELLER_APPROVAL' ||
                (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' ||
                String((ord as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL'
              );
              const assignedInspector = (() => {
                try {
                  const raw = localStorage.getItem(`order_assigned_inspector_${ord.id}`);
                  if (raw) return JSON.parse(raw);
                } catch { }
                if ((ord as any).inspectorName || ord.inspectorId) {
                  return {
                    inspectorId: ord.inspectorId,
                    inspectorName: (ord as any).inspectorName,
                    inspectorEmail: (ord as any).inspectorEmail,
                    inspectorPhone: (ord as any).inspectorPhone,
                  };
                }
                return null;
              })();

              return (
                <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-3.5 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs ${rejectionInfo && !savedAppointment?.scheduledAt ? 'bg-rose-600 text-white' : isOrderCountered ? 'bg-orange-600 text-white' : isInspectorArrivedForOrder(ord.id, ord) ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                        {rejectionInfo && !savedAppointment?.scheduledAt ? <AlertCircle className="w-3.5 h-3.5" /> : isOrderCountered ? <CalendarSync className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                        <span>{lang === 'vi' ? 'Kiểm Định Tận Nhà (KTV Đến Nhà)' : 'At-Home Inspection (Technician Visit)'}</span>
                      </span>
                      <span className={`text-xs font-bold ${rejectionInfo && !savedAppointment?.scheduledAt ? 'text-rose-700' : isOrderCountered ? 'text-orange-800' : isInspectorArrivedForOrder(ord.id, ord) ? 'text-emerald-800 font-black' : 'text-amber-900'}`}>
                        {rejectionInfo && !savedAppointment?.scheduledAt
                          ? (lang === 'vi' ? 'Lịch hẹn bị từ chối • Vui lòng hẹn lại' : 'Appointment Rejected • Please Reschedule')
                          : isInspectorArrivedForOrder(ord.id, ord)
                            ? (lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting')
                            : String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL'
                              ? (lang === 'vi' ? 'Đã gửi đề xuất lại • Chờ người mua phản hồi' : 'Counter-proposal sent • Awaiting buyer response')
                              : assignedInspector?.inspectorName
                                ? (lang === 'vi' ? `Đã phân công KTV ${assignedInspector.inspectorName}` : `KTV ${assignedInspector.inspectorName} Assigned`)
                                : isOrderCountered
                                  ? (lang === 'vi' ? 'Hub từ chối lịch cũ & đề xuất lịch mới • Cần phản hồi' : 'Center Proposed New Schedule • Action Needed')
                                  : savedAppointment?.scheduledAt
                                    ? (lang === 'vi' ? 'Đã hẹn lịch • Chờ Admin điều phối KTV' : 'Appointment Scheduled • Awaiting Dispatch')
                                    : (lang === 'vi' ? 'Chờ bạn hẹn lịch đón KTV' : 'Awaiting Appointment Schedule')}
                      </span>
                    </div>
                    {savedAppointment?.scheduledAt && !isOrderCountered && !isInspectorArrivedForOrder(ord.id, ord) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSchedulingOrder(ord);
                          setSchedulingReadOnly(false);
                        }}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                      >
                        {lang === 'vi' ? 'Đổi lịch hẹn khác' : 'Reschedule'}
                      </button>
                    )}
                  </div>

                  {/* Alert if appointment was rejected by Hub */}
                  {rejectionInfo && !savedAppointment?.scheduledAt && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 animate-fadeIn">
                      <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Lịch hẹn trước đó đã bị Trung tâm kiểm định từ chối</span>
                      </div>
                      <div className="p-2 bg-white/90 rounded-lg border border-rose-200 text-[11px] leading-relaxed">
                        <strong>Lý do từ chối:</strong> "{rejectionInfo.reason}"
                      </div>
                      <p className="text-[11px] text-rose-700">
                        Vui lòng bấm nút <strong>"Đặt Lại Lịch Hẹn KTV"</strong> bên dưới để chọn lại ngày giờ hẹn khác phù hợp hơn.
                      </p>
                    </div>
                  )}

                  {/* Assigned Technician Banner */}
                  {assignedInspector ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 bg-purple-50/90 px-3 py-1.5 rounded-xl border border-purple-200">
                      <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>
                        {lang === 'vi' ? 'Kỹ thuật viên phụ trách:' : 'Assigned Technician:'}{' '}
                        <strong className="text-purple-950 font-black">KTV {assignedInspector.inspectorName}</strong>
                        {assignedInspector.inspectorPhone ? ` • 📞 ${assignedInspector.inspectorPhone}` : ''}
                      </span>
                    </div>
                  ) : savedAppointment?.scheduledAt && !isOrderCountered ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900 bg-blue-50/90 px-3 py-1.5 rounded-xl border border-blue-200">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
                      <span>
                        {lang === 'vi' ? 'Kỹ thuật viên: Trung tâm SecondLife đang xác nhận lịch và phân công KTV theo ca' : 'Technician: SecondLife Hub is assigning technician'}
                      </span>
                    </div>
                  ) : null}

                  {isOrderCountered ? (() => {
                    const effectiveCounterTime =
                      savedAppointment?.counterScheduledAt ||
                      savedAppointment?.scheduledAt ||
                      (ord as any).counterScheduledAt ||
                      ord.appointmentScheduledAt ||
                      (ord as any).inspectionOrder?.counterScheduledAt ||
                      (ord as any).inspectionOrder?.appointmentScheduledAt;
                    const effectiveCounterShift =
                      savedAppointment?.counterShift ||
                      (ord as any).counterShift ||
                      (ord as any).inspectionOrder?.counterShift;
                    const effectiveCounterNote =
                      savedAppointment?.counterNote ||
                      (ord as any).counterNote ||
                      (ord as any).inspectionOrder?.counterNote;

                    const validCounterDate = effectiveCounterTime ? new Date(effectiveCounterTime) : null;
                    const isValidDate = Boolean(validCounterDate && !isNaN(validCounterDate.getTime()));

                    const counterApptPayload = savedAppointment || {
                      scheduledAt: effectiveCounterTime,
                      counterScheduledAt: effectiveCounterTime,
                      counterShift: effectiveCounterShift,
                      counterNote: effectiveCounterNote,
                      status: 'COUNTERED_BY_CENTER',
                    };

                    return (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-300 text-xs text-amber-950 space-y-2.5 shadow-xs animate-fadeIn">
                        <div className="flex items-center gap-2 text-orange-950 font-black">
                          <CalendarSync className="w-4 h-4 text-orange-600 animate-pulse shrink-0" />
                          <span>Trung tâm kiểm định đã từ chối lịch hẹn cũ &amp; đề xuất lịch mới:</span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900">📅 Thời gian đề xuất:</span>
                            <span className="font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                              {isValidDate && validCounterDate
                                ? validCounterDate.toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                                : 'Theo đề xuất của Trung tâm'}
                              {effectiveCounterShift ? ` (${effectiveCounterShift === 'MORNING' ? 'Ca Sáng: 08:00 - 12:00' : 'Ca Chiều: 13:00 - 17:00'})` : ''}
                            </span>
                          </div>
                          {effectiveCounterNote && (
                            <div className="text-[11px] text-amber-900 italic">
                              💬 <strong>Lý do từ Hub:</strong> "{effectiveCounterNote}"
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSellerAcceptCounterAppointment(ord.id, counterApptPayload)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Đồng Ý Lịch Này</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulingOrder(ord);
                              setSchedulingReadOnly(false);
                            }}
                            className="py-2 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Hẹn Lại Lịch Khác</span>
                          </button>
                        </div>
                      </div>
                    );
                  })() : savedAppointment?.scheduledAt ? (
                    <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-950">
                          📅 {lang === 'vi' ? 'Thời gian KTV đến nhà:' : 'Scheduled Arrival:'}
                        </span>
                        <span className="font-extrabold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                          {new Date(savedAppointment.scheduledAt).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold">📍 {lang === 'vi' ? 'Địa chỉ đón KTV:' : 'Address:'}</span>{' '}
                        <span>{ord.shippingLegs?.[0]?.origin || ord.listing?.location || 'Địa chỉ kho người bán'}</span>
                      </div>
                      {savedAppointment.note && (
                        <div className="italic text-amber-800/80">
                          💬 {lang === 'vi' ? 'Ghi chú đón KTV:' : 'Note:'} {savedAppointment.note}
                        </div>
                      )}

                      {/* Mã Vạch Tiếp Nhận & Mã Code tương ứng cho KTV quét khi đến (CHỈ HIỂN THỊ KHI ĐÃ ĐƯỢC CHỐT VÀ ĐÃ CÓ KTV) */}
                      {assignedInspector ? (
                        <div className="pt-1">
                          <AtHomeIntakeBarcode
                            orderId={ord.id}
                            isArrived={isInspectorArrivedForOrder(ord.id, ord)}
                            lang={lang}
                            appointmentTime={savedAppointment.scheduledAt}
                            inspectorName={assignedInspector?.inspectorName}
                          />
                        </div>
                      ) : (savedAppointment.status === 'PENDING_CENTER_CONFIRMATION' || savedAppointment.status === 'PENDING_CONFIRMATION') ? (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Đã gửi đề xuất lịch hẹn. Đang chờ Trung tâm kiểm định duyệt. Mã tiếp nhận KTV sẽ được tạo ngay khi KTV được phân công.</span>
                        </div>
                      ) : savedAppointment.status === 'CONFIRMED' && (savedAppointment.confirmedBy === 'CENTER' || assignedInspector) ? (
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Lịch hẹn đã được xác nhận! Trung tâm SecondLife đang phân công Kỹ thuật viên phụ trách.</span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Đã gửi đề xuất lịch hẹn. Đang chờ Trung tâm kiểm định duyệt. Mã tiếp nhận KTV sẽ được tạo ngay khi KTV được phân công.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-100/60 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                      👉 <strong>{lang === 'vi' ? 'Lưu ý người bán:' : 'Seller note:'}</strong>{' '}
                      {String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL'
                        ? (lang === 'vi'
                          ? 'Bạn đã gửi lại đề xuất thay đổi phương án chia phí kiểm định. Vui lòng chờ người mua xem và đồng ý trong phòng chat trước khi hẹn lịch đón KTV.'
                          : 'You have sent a counter-proposal. Please wait for the buyer to accept in chat before scheduling technician visit.')
                        : (lang === 'vi'
                          ? 'Khách mua đã đăng ký gói kiểm định tận nơi. Vui lòng bấm nút "Hẹn Lịch Đón KTV" bên dưới để chọn ngày giờ làm việc trong khung giờ hành chính (08:00 - 12:00 hoặc 13:00 - 17:00). Trung tâm SecondLife sẽ nhận thông tin để điều phối Kỹ thuật viên phù hợp.'
                          : 'Buyer opted for at-home inspection. Technician will visit your location. Please click "Schedule Visit" below to choose appointment date during business hours (08:00 - 12:00 or 13:00 - 17:00)!')}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* TRƯỜNG HỢP 2: ĐƯA QUA TRUNG TÂM KIỂM ĐỊNH (SHIP 2 CHẶNG) */
            (() => {
              const localInsp = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${ord.id}`) : null;
              const isInspFailed = ord.escrowStatus === 'INSPECTION_FAILED' || (ord as any).backendStatus === 'FAILED' || (ord as any).status === 'FAILED' || ord.inspectionReport?.status === 'FAILED' || localInsp === 'FAILED' || (ord as any).inspectionStatus === 'FAILED';
              const isInspPassed = ord.escrowStatus === 'INSPECTION_PASSED' || (ord as any).backendStatus === 'PASSED' || (ord as any).status === 'PASSED' || ord.inspectionReport?.status === 'PASSED' || localInsp === 'PASSED' || (ord as any).inspectionStatus === 'PASSED';
              const ordDecision = getInspectionPurchaseDecision(ord);
              const isPendingDecision = isInspPassed && ordDecision !== 'accepted' && ordDecision !== 'rejected';
              const isAccepted = isInspPassed && ordDecision === 'accepted';
              const isRejected = ordDecision === 'rejected';

              const ordAllShipments = getOrderAllShipments(ord.id);
              const leg2Shipment = isRejected || isInspFailed
                ? (ordAllShipments.find((s) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') || ordAllShipments.find((s) => s.leg === 'CENTER_TO_SELLER'))
                : (ordAllShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') || ordAllShipments.find((s) => s.leg === 'CENTER_TO_BUYER'));
              const isLeg2Delivered = leg2Shipment?.status === 'DELIVERED' || ord.escrowStatus === 'COMPLETED_RELEASED';
              const isLeg2InTransit = leg2Shipment?.status === 'IN_TRANSIT' || leg2Shipment?.status === 'SHIPPED' || leg2Shipment?.status === 'PICKED_UP';

              return (
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-3.5 rounded-xl border border-blue-200 text-blue-950 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                        <Truck className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Kiểm Định Qua Hub (Ship 2 Chặng)' : 'Hub Inspection (2-Leg Delivery)'}</span>
                      </span>
                      <span className="text-xs font-bold text-blue-900">
                        {isInspFailed
                          ? (lang === 'vi' ? 'Kiểm định không đạt chuẩn • Chờ hoàn trả' : 'Inspection Failed • Pending Return')
                          : isInspPassed
                            ? (isPendingDecision
                              ? (lang === 'vi' ? 'Đã kiểm định ĐẠT chuẩn • Chờ người mua quyết định' : 'Passed • Awaiting Buyer Decision')
                              : isRejected
                                ? (lang === 'vi' ? 'Người mua từ chối mua • Chờ hoàn trả' : 'Buyer Declined • Pending Return')
                                : isLeg2Delivered
                                  ? (lang === 'vi' ? 'Chặng 2: Đã giao thành công người mua' : 'Delivered to Buyer')
                                  : isLeg2InTransit
                                    ? (lang === 'vi' ? 'Đang thực hiện Chặng 2 đến Người mua' : 'Leg 2 In Progress to Buyer')
                                    : (lang === 'vi' ? 'Đã kiểm định ĐẠT • Chờ điều phối giao người mua' : 'Passed • Awaiting Dispatch'))
                            : ord.inspectionStatus === 'INSPECTING'
                              ? buyerInspectionStageLabel('inspecting', lang)
                              : ordShipment && getInboundShipmentProgress(ordShipment, lang).step === 3
                                ? (lang === 'vi' ? 'Kiện hàng đã đến Hub • Chờ kiểm định' : 'Delivered to Hub • Pending Inspection')
                                : isOrderSellerConfirmed(ord)
                                  ? (lang === 'vi' ? 'Đang thực hiện Chặng 1 đến Hub' : 'Leg 1 In Progress to Hub')
                                  : (lang === 'vi' ? 'Chờ người bán xác nhận gửi hàng Chặng 1' : 'Awaiting Seller Confirmation for Leg 1')}
                      </span>
                    </div>
                  </div>

                  {/* Visual 2-Leg Journey Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {/* Chặng 1 */}
                    <div className="p-2.5 rounded-lg bg-white/90 border border-blue-200 text-blue-950 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-blue-700">📦 {lang === 'vi' ? 'Chặng 1: Gửi Hàng Đến Hub' : 'Leg 1: Send to Hub'}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-extrabold">
                          {(() => {
                            if (ordShipment) {
                              const p = getInboundShipmentProgress(ordShipment, lang);
                              if (p.step === 3) return lang === 'vi' ? 'Đã đến Hub' : 'Delivered to Hub';
                              if (p.step === 2) return lang === 'vi' ? 'Đang giao Hub' : 'In Transit';
                              return lang === 'vi' ? 'Chờ lấy hàng' : 'Pickup Pending';
                            }
                            if (ord.inspectionStatus === 'INSPECTING') return lang === 'vi' ? 'Đã phân công KTV' : 'Technician assigned';
                            return isOrderSellerConfirmed(ord) ? (lang === 'vi' ? 'Đang chuẩn bị' : 'In Progress') : (lang === 'vi' ? 'Cần xác nhận' : 'Pending');
                          })()}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        {lang === 'vi'
                          ? 'Người bán dán tem QR kiểm định lên kiện hàng và bàn giao cho Lalamove vận chuyển đến Trung tâm kiểm định Hub SecondLife.'
                          : 'Seller packs item with QR tag and hands over to Lalamove courier to deliver to SecondLife Hub.'}
                      </div>
                    </div>

                    {/* Chặng 2 */}
                    <div className={`p-2.5 rounded-lg border space-y-1 ${isInspFailed || isRejected
                      ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                      : isPendingDecision
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : isInspPassed
                          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                          : 'bg-slate-50/90 border-slate-200 text-slate-700'
                      }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className={
                          isInspFailed || isRejected
                            ? 'text-rose-700'
                            : isPendingDecision
                              ? 'text-amber-700'
                              : isInspPassed
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                        }>
                          🚚 {isInspFailed || isRejected
                            ? (lang === 'vi' ? 'Chặng 2: Hoàn Trả Người Bán' : 'Leg 2: Return to Seller')
                            : (lang === 'vi' ? 'Chặng 2: Hub Giao Người Mua' : 'Leg 2: Hub to Buyer')}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${isInspFailed || isRejected
                          ? 'bg-rose-100 text-rose-800'
                          : isPendingDecision
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isInspPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                          {isInspFailed
                            ? (lang === 'vi' ? 'Không đạt • Hoàn trả' : 'Failed • Return')
                            : isRejected
                              ? (lang === 'vi' ? 'Từ chối mua • Hoàn trả' : 'Declined • Return')
                              : isPendingDecision
                                ? (lang === 'vi' ? 'Đã đạt • Chờ người mua quyết định' : 'Passed • Awaiting Buyer')
                                : isLeg2Delivered
                                  ? (lang === 'vi' ? 'Đã giao thành công' : 'Delivered')
                                  : isLeg2InTransit
                                    ? (lang === 'vi' ? 'Đang giao người mua' : 'In Transit')
                                    : isAccepted
                                      ? (lang === 'vi' ? 'Đã duyệt • Chờ giao' : 'Accepted • Awaiting Dispatch')
                                      : isInspPassed
                                        ? (lang === 'vi' ? 'Đã đạt' : 'Passed')
                                        : (lang === 'vi' ? 'Kích hoạt sau khi ĐẠT' : 'After Passed')}
                        </span>
                      </div>
                      <div className={
                        isInspFailed || isRejected
                          ? 'text-rose-800 text-[11px]'
                          : isPendingDecision
                            ? 'text-amber-800 text-[11px]'
                            : isInspPassed
                              ? 'text-emerald-800 text-[11px]'
                              : 'text-slate-500 text-[11px]'
                      }>
                        {isInspFailed
                          ? (lang === 'vi'
                            ? 'Kiểm định không đạt. Trung tâm xử lý chặng trả hàng về người bán.'
                            : 'Inspection failed. The center handles the return to the seller.')
                          : isRejected
                            ? (lang === 'vi'
                              ? 'Người mua từ chối mua sau kiểm định. Trung tâm xử lý chuyển hoàn kiện hàng về người bán.'
                              : 'Buyer declined purchase. Center handles return to seller.')
                            : isPendingDecision
                              ? (lang === 'vi'
                                ? 'KTV Hub kiểm định ĐẠT chuẩn và dán tem niêm phong. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                                : 'Inspection passed. Awaiting buyer review and decision.')
                              : isLeg2Delivered
                                ? (lang === 'vi'
                                  ? 'Chặng 2 đã giao kiện hàng thành công đến tận tay người mua.'
                                  : 'Leg 2 successfully delivered to buyer.')
                                : isLeg2InTransit
                                  ? (lang === 'vi'
                                    ? 'Hub đang thực hiện chuyển phát trực tiếp kiện hàng đã kiểm định đến tận tay người mua.'
                                    : 'Hub is delivering inspected item to buyer.')
                                  : isInspPassed
                                    ? (lang === 'vi'
                                      ? 'KTV Hub kiểm định ĐẠT chuẩn và dán tem niêm phong. Hub tiến hành chuyển phát trực tiếp đến người mua.'
                                      : 'Passed inspection with seal applied. Hub dispatches directly to buyer.')
                                    : (lang === 'vi'
                                      ? 'Sau khi KTV Hub kiểm định ĐẠT chuẩn 48 bước và dán tem niêm phong, Hub sẽ tự động chuyển phát tiếp đến tận tay người mua.'
                                      : 'Once item passes 48-step Hub inspection and seal is applied, Hub dispatches package directly to buyer.')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </>
  );
}
