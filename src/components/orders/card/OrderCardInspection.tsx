import { AlertCircle, Calendar, CalendarCheck, CalendarSync, Check, CheckCircle2, Clock, Truck, UserCheck } from 'lucide-react';
import { AtHomeIntakeBarcode } from '../../inspection/AtHomeIntakeBarcode';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import { getOrderAppointmentRejection } from '../../../utils/orders/orderAppointments';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { buyerInspectionStageLabel, getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
import { getInboundShipmentProgress } from '../../../utils/inspectionCenterData';
import { getOrderAllShipments } from '../../../utils/orders/shipmentCache';
import { getOrderSellerAddress } from '../../../pages/inspection-center/dispatch/orderContacts';

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
              const rawInspectionStatus = String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') || '').toUpperCase();
              const isWaitingSellerApproval = !isOrderSellerConfirmed(ord) || rawInspectionStatus === 'WAITING_SELLER_APPROVAL' || rawInspectionStatus === 'PENDING' || (ord as any).customerStatus === 'WAITING_SELLER_APPROVAL' || ord.status === 'WAITING_SELLER_APPROVAL';
              const isWaitingBuyerApproval = rawInspectionStatus === 'WAITING_BUYER_APPROVAL' || (ord as any).customerStatus === 'WAITING_BUYER_APPROVAL' || ord.status === 'WAITING_BUYER_APPROVAL';
              const isWaitingFeePayment = rawInspectionStatus === 'WAITING_FEE_PAYMENT' || (ord as any).customerStatus === 'WAITING_FEE_PAYMENT' || ord.status === 'WAITING_FEE_PAYMENT';
              const isPendingApprovalOrFee = isWaitingSellerApproval || isWaitingBuyerApproval || isWaitingFeePayment;

              const isOrderCountered = !isPendingApprovalOrFee && Boolean(
                (
                  savedAppointment?.status === 'COUNTERED_BY_CENTER' ||
                  (ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
                  (ord as any).inspectionOrder?.appointmentStatus === 'COUNTERED_BY_CENTER'
                ) &&
                (
                  Boolean(savedAppointment?.counterScheduledAt) ||
                  Boolean((ord as any).counterScheduledAt) ||
                  Boolean((ord as any).inspectionOrder?.counterScheduledAt)
                )
              ) &&
                savedAppointment?.status !== 'PENDING_CENTER_CONFIRMATION' &&
                (ord as any).appointmentStatus !== 'PENDING_CENTER_CONFIRMATION';
              const rejectionInfo = !isOrderCountered && !isPendingApprovalOrFee ? getOrderAppointmentRejection(ord) : null;
              const isRejected = !isOrderCountered && !isPendingApprovalOrFee && Boolean(
                rejectionInfo ||
                (ord as any).appointmentStatus === 'REJECTED' ||
                savedAppointment?.status === 'REJECTED'
              );
              const isApptConfirmed = !isPendingApprovalOrFee && Boolean(
                (savedAppointment?.status === 'CONFIRMED' || (ord as any).appointmentStatus === 'CONFIRMED') &&
                !isRejected && !isOrderCountered
              );
              const isPurchaseAccepted = Boolean(
                getInspectionPurchaseDecision(ord) === 'accepted' ||
                ord.finalPaymentPaidAt ||
                (ord as any).inspectionDecision === 'accepted' ||
                (ord as any).buyerDecision === 'accepted' ||
                ord.linkedOrderId ||
                (ord as any).inspectionOrder?.finalPaymentPaidAt ||
                (ord as any).inspectionOrder?.orderId ||
                String((ord as any).backendStatus || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
                String((ord as any).status || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
                String((ord as any).inspectionStatus || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
                String((ord as any).inspectionOrder?.status || '').toUpperCase() === 'DELIVERING_TO_BUYER'
              );
              const isInspPassed = Boolean(
                isPurchaseAccepted ||
                ord.escrowStatus === 'INSPECTION_PASSED' ||
                (ord as any).backendStatus === 'PASSED' ||
                ord.status === 'PASSED' ||
                (ord as any).inspectionStatus === 'PASSED' ||
                Boolean(ord.tamperSealId) ||
                Boolean(ord.finalPaymentPaidAt)
              );
              const isInspFailed = Boolean(
                ord.escrowStatus === 'INSPECTION_FAILED' ||
                (ord as any).backendStatus === 'FAILED' ||
                ord.status === 'FAILED' ||
                (ord as any).inspectionStatus === 'FAILED'
              );
              const isAtHomeShipmentCreated = Boolean(
                ord.carrierPickedUpAt ||
                ord.sellerReadyAt ||
                (ord as any).orderShipmentCode ||
                (ord as any).orderCode ||
                (ord.escrowStatus as string) === 'DELIVERING_TO_BUYER' ||
                (ord as any).status === 'DELIVERING_TO_BUYER' ||
                (ord as any).backendStatus === 'DELIVERING_TO_BUYER' ||
                (typeof window !== 'undefined' && ord.id && (
                  localStorage.getItem(`order_shipment_created_${ord.id}`) === 'true' ||
                  localStorage.getItem(`order_packed_${ord.id}`) === 'true' ||
                  localStorage.getItem(`order_shipments_${ord.id}`) ||
                  localStorage.getItem(`sl_order_shipments_${ord.id}`) ||
                  ((ord as any).linkedOrderId && (
                    localStorage.getItem(`order_shipment_created_${(ord as any).linkedOrderId}`) === 'true' ||
                    localStorage.getItem(`order_packed_${(ord as any).linkedOrderId}`) === 'true' ||
                    localStorage.getItem(`order_shipments_${(ord as any).linkedOrderId}`) ||
                    localStorage.getItem(`sl_order_shipments_${(ord as any).linkedOrderId}`)
                  ))
                ))
              );
              const isCompletedOrReleased = Boolean(
                (ord as any).receiptConfirmedAt ||
                (typeof window !== 'undefined' && ord.id && localStorage.getItem(`order_receipt_confirmed_${ord.id}`) === 'true') ||
                ((ord as any).linkedOrderId && typeof window !== 'undefined' && localStorage.getItem(`order_receipt_confirmed_${(ord as any).linkedOrderId}`) === 'true') ||
                ord.escrowStatus === 'COMPLETED_RELEASED' ||
                (ord.escrowStatus as any) === 'RELEASED' ||
                (ord as any).backendStatus === 'COMPLETED' ||
                (ord as any).backendStatus === 'RELEASED' ||
                ord.status === 'COMPLETED'
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
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs ${isPurchaseAccepted ? 'bg-emerald-700 text-white' : isInspPassed ? 'bg-emerald-600 text-white' : isInspFailed ? 'bg-rose-600 text-white' : isRejected ? 'bg-rose-600 text-white' : isOrderCountered ? 'bg-orange-600 text-white' : isInspectorArrivedForOrder(ord.id, ord) ? 'bg-emerald-600 text-white' : isApptConfirmed ? 'bg-emerald-700 text-white' : 'bg-amber-600 text-white'}`}>
                        {isPurchaseAccepted || isInspPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : isInspFailed || isRejected ? <AlertCircle className="w-3.5 h-3.5" /> : isOrderCountered ? <CalendarSync className="w-3.5 h-3.5" /> : isApptConfirmed ? <CalendarCheck className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                        <span>{isInspPassed || isPurchaseAccepted ? (lang === 'vi' ? 'Kiểm Định Tận Nhà (Đạt Chuẩn)' : 'At-Home Inspection (Passed)') : isInspFailed ? (lang === 'vi' ? 'Kiểm Định Tận Nhà (Không Đạt)' : 'At-Home Inspection (Failed)') : (lang === 'vi' ? 'Kiểm Định Tận Nhà (KTV Đến Nhà)' : 'At-Home Inspection (Technician Visit)')}</span>
                      </span>
                      <span className={`text-xs font-bold ${isPurchaseAccepted || isInspPassed ? 'text-emerald-800 font-black' : isInspFailed ? 'text-rose-700 font-black' : isRejected ? 'text-rose-700' : isOrderCountered ? 'text-orange-800' : isInspectorArrivedForOrder(ord.id, ord) ? 'text-emerald-800 font-black' : isApptConfirmed ? 'text-emerald-800 font-extrabold' : 'text-amber-900'}`}>
                        {isCompletedOrReleased
                          ? (lang === 'vi' ? 'Giao dịch hoàn tất • Tiền đã chuyển về ví' : 'Transaction Completed • Payout Transferred')
                          : isPurchaseAccepted
                            ? (isAtHomeShipmentCreated
                              ? (lang === 'vi' ? 'KTV đã hoàn tất kiểm định • Đạt chuẩn SecondLife' : 'Technician completed inspection • Standard Met')
                              : (lang === 'vi' ? 'Người mua đã xác nhận mua • Vui lòng gửi hàng cho người mua' : 'Buyer confirmed purchase • Please ship to buyer'))
                            : isInspPassed
                              ? (lang === 'vi' ? 'KTV đã hoàn tất kiểm định • Đạt chuẩn SecondLife' : 'Technician completed inspection • Standard Met')
                              : isInspFailed
                                ? (lang === 'vi' ? 'KTV đã hoàn tất kiểm định • Không đạt chuẩn' : 'Technician completed inspection • Standard Not Met')
                                : isWaitingSellerApproval
                                  ? (lang === 'vi' ? 'Yêu Cầu Kiểm Định Mới • Chờ Bạn Xác Nhận' : 'New Inspection Request • Waiting Seller Approval')
                                  : isWaitingBuyerApproval
                                    ? (lang === 'vi' ? 'Đã gửi đề xuất lại • Chờ người mua phản hồi' : 'Counter-proposal sent • Awaiting buyer response')
                                    : isWaitingFeePayment
                                      ? (lang === 'vi' ? 'Chờ hai bên đóng phí kiểm định' : 'Waiting for inspection fee payment')
                                      : isRejected
                                        ? (lang === 'vi' ? 'Lịch hẹn bị từ chối • Vui lòng hẹn lại' : 'Appointment Rejected • Please Reschedule')
                                        : isInspectorArrivedForOrder(ord.id, ord)
                                          ? (lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting')
                                          : assignedInspector?.inspectorName
                                            ? (lang === 'vi' ? `Đã phân công KTV ${assignedInspector.inspectorName}` : `KTV ${assignedInspector.inspectorName} Assigned`)
                                            : isOrderCountered
                                              ? (lang === 'vi' ? 'Hub từ chối lịch cũ & đề xuất lịch mới • Cần phản hồi' : 'Center Proposed New Schedule • Action Needed')
                                              : isApptConfirmed
                                                ? (lang === 'vi' ? 'Đã chốt lịch • Chờ Trung tâm giao KTV' : 'Appointment Confirmed • Awaiting Dispatch')
                                                : savedAppointment?.scheduledAt
                                                  ? (lang === 'vi' ? 'Đã hẹn lịch • Chờ Admin điều phối KTV' : 'Appointment Scheduled • Awaiting Dispatch')
                                                  : (lang === 'vi' ? 'Chờ bạn hẹn lịch đón KTV' : 'Awaiting Appointment Schedule')}
                      </span>
                    </div>
                  </div>

                  {/* Alert if appointment was rejected by Hub */}
                  {isRejected && !isPendingApprovalOrFee && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 animate-fadeIn">
                      <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Lịch hẹn trước đó đã bị Trung tâm kiểm định từ chối</span>
                      </div>
                      <div className="p-2 bg-white/90 rounded-lg border border-rose-200 text-[11px] leading-relaxed">
                        <strong>Lý do từ chối:</strong> "{rejectionInfo?.reason || (ord as any).appointmentRejectionReason || (savedAppointment as any)?.rejectionReason || 'KTV đã kín lịch trong khung giờ này, vui lòng chọn ca khác.'}"
                      </div>
                      <p className="text-[11px] text-rose-700">
                        Vui lòng bấm nút <strong>"Đặt Lại Lịch Hẹn KTV"</strong> bên dưới để chọn lại ngày giờ hẹn khác phù hợp hơn.
                      </p>
                    </div>
                  )}

                  {/* Assigned Technician Banner */}
                  {assignedInspector && !isInspPassed && !isInspFailed && !isPendingApprovalOrFee ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 bg-purple-50/90 px-3 py-1.5 rounded-xl border border-purple-200">
                      <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>
                        {lang === 'vi' ? 'Kỹ thuật viên phụ trách:' : 'Assigned Technician:'}{' '}
                        <strong className="text-purple-950 font-black">KTV {assignedInspector.inspectorName}</strong>
                        {assignedInspector.inspectorPhone ? ` • 📞 ${assignedInspector.inspectorPhone}` : ''}
                      </span>
                    </div>
                  ) : savedAppointment?.scheduledAt && !isPendingApprovalOrFee && !isOrderCountered && !isRejected && !isInspPassed && !isInspFailed ? (
                    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border ${isApptConfirmed ? 'text-emerald-900 bg-emerald-50/90 border-emerald-200' : 'text-blue-900 bg-blue-50/90 border-blue-200'}`}>
                      {isApptConfirmed ? <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <Clock className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />}
                      <span>
                        {isApptConfirmed
                          ? (lang === 'vi' ? 'Kỹ thuật viên: Lịch hẹn đã chốt — Trung tâm đang phân công KTV theo ca' : 'Technician: Appointment confirmed — Hub is assigning technician')
                          : (lang === 'vi' ? 'Kỹ thuật viên: Trung tâm SecondLife đang xác nhận lịch và phân công KTV theo ca' : 'Technician: SecondLife Hub is assigning technician')}
                      </span>
                    </div>
                  ) : null}

                  {isOrderCountered && !isPendingApprovalOrFee ? (() => {
                    const effectiveCounterTime =
                      savedAppointment?.counterScheduledAt ||
                      (ord as any).counterScheduledAt ||
                      (ord as any).inspectionOrder?.counterScheduledAt ||
                      savedAppointment?.scheduledAt ||
                      ord.appointmentScheduledAt ||
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
                  })() : (isRejected && !isPendingApprovalOrFee) ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-relaxed">
                      👉 <strong>{lang === 'vi' ? 'Lưu ý người bán:' : 'Seller note:'}</strong>{' '}
                      {lang === 'vi'
                        ? 'Trung tâm SecondLife đã từ chối lịch hẹn trước đó. Vui lòng bấm nút "Đặt Lại Lịch Hẹn KTV" bên dưới để chọn ca hẹn mới phù hợp hơn!'
                        : 'SecondLife Hub has rejected the previous appointment. Please click "Reschedule Appointment" below to pick a different shift!'}
                    </div>
                  ) : (savedAppointment?.scheduledAt && !isPendingApprovalOrFee) ? (
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
                        <span>{getOrderSellerAddress(ord)}</span>
                      </div>
                      {savedAppointment.note && !savedAppointment.note.startsWith('[Tem:') && !savedAppointment.note.includes('[Photos:') && !savedAppointment.note.includes('[Grade:') && !savedAppointment.note.includes('[Điểm:') && (
                        <div className="italic text-amber-800/80">
                          💬 {lang === 'vi' ? 'Ghi chú đón KTV:' : 'Note:'} {savedAppointment.note}
                        </div>
                      )}

                      {/* Khi đã hoàn tất kiểm định (Đạt hoặc Không đạt): Hiện kết quả kiểm định hoàn tất, không hiện barcode hay KTV đang đo kiểm nữa */}
                      {isInspPassed ? (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5 mt-1.5 animate-fadeIn">
                          <div className="font-extrabold flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Kỹ thuật viên đã hoàn tất kiểm định tại nhà (Đạt chuẩn)</span>
                          </div>
                          <div className="text-[11px] text-emerald-900 leading-relaxed">
                            {assignedInspector?.inspectorName ? `KTV ${assignedInspector.inspectorName}` : 'Kỹ thuật viên'} đã hoàn thành quy trình đo kiểm các bước thành công.
                            {/* {ord.tamperSealId && <span> Mã tem niêm phong: <strong className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-950 font-bold">{ord.tamperSealId}</strong></span>} */}
                            {ord.conditionGrade && <span> • Tình trạng máy: <strong className="bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-950 font-bold">{ord.conditionGrade} {ord.conditionScore ? `(${ord.conditionScore}/100)` : ''}</strong></span>}
                          </div>
                          {isPurchaseAccepted ? (
                            isCompletedOrReleased ? (
                              <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                                🎉 {lang === 'vi'
                                  ? 'Đơn hàng đã hoàn tất và tiền bán hàng đã được giải ngân về ví của bạn thành công.'
                                  : 'Order completed and funds have been released to your wallet successfully.'}
                              </p>
                            ) : Boolean(ord.shippingDeliveredAt || (ord.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' || (ord as any).backendStatus === 'DELIVERED') ? (
                              <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                                🎉 {lang === 'vi'
                                  ? 'Tài xế đã giao kiện hàng thành công tới người mua. Khách mua có 48 giờ để dùng thử và kiểm tra đối soát trước khi hệ thống tự động giải ngân vào ví của bạn.'
                                  : 'Package delivered to buyer successfully. Buyer has 48 hours inspection window before escrow is released to your wallet.'}
                              </p>
                            ) : isAtHomeShipmentCreated ? (
                              <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                                🎉 {lang === 'vi'
                                  ? 'Đã tạo vận đơn thành công. Vui lòng bàn giao kiện hàng cho tài xế Lalamove khi tài xế đến nhận.'
                                  : 'Lalamove shipment created successfully. Please keep the tamper seal intact and hand over the parcel to the Lalamove driver upon arrival.'}
                              </p>
                            ) : (
                              <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                                🎉 {lang === 'vi'
                                  ? 'Người mua đã xác nhận mua hàng thành công. Khách mua đã thanh toán đơn hàng. Vui lòng đóng gói cẩn thận (giữ nguyên tem niêm phong) và bấm nút "Đã gói hàng • Tạo đơn vận chuyển" bên dưới để bàn giao cho tài xế.'
                                  : 'Buyer has confirmed the purchase! Order is paid. Please pack carefully (keep the tamper seal intact) and click "Packed • Create Shipping Order" below to hand over to carrier.'}
                              </p>
                            )
                          ) : (
                            <p className="text-[11px] text-emerald-700 italic">
                              {lang === 'vi'
                                ? 'Đang chờ người mua xác nhận mua hàng trước khi điều phối bưu tá đến lấy hàng.'
                                : 'Waiting for buyer to confirm purchase before dispatching courier.'}
                            </p>
                          )}
                        </div>
                      ) : isInspFailed ? (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1.5 mt-1.5 animate-fadeIn">
                          <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Kỹ thuật viên đã hoàn tất kiểm định: Thiết bị không đạt chuẩn</span>
                          </div>
                          <div className="text-[11px] text-rose-900 leading-relaxed">
                            Thiết bị không đáp ứng tiêu chuẩn SecondLife. Đơn hàng đang được xử lý hoàn tiền cho người mua.
                          </div>
                        </div>
                      ) : assignedInspector ? (
                        <div className="pt-1">
                          <AtHomeIntakeBarcode
                            orderId={ord.id}
                            isArrived={isInspectorArrivedForOrder(ord.id, ord)}
                            lang={lang}
                            appointmentTime={savedAppointment.scheduledAt}
                            inspectorName={assignedInspector?.inspectorName}
                          />
                        </div>
                      ) : isApptConfirmed ? (
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2 mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {lang === 'vi'
                              ? 'Lịch hẹn đã được xác nhận thành công! Trung tâm SecondLife đang phân công Kỹ thuật viên phụ trách đến kiểm tra thiết bị.'
                              : 'Appointment confirmed! SecondLife Hub is assigning technician to conduct on-site inspection.'}
                          </span>
                        </div>
                      ) : (savedAppointment.status === 'PENDING_CENTER_CONFIRMATION' || savedAppointment.status === 'PENDING_CONFIRMATION') ? (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            {lang === 'vi'
                              ? 'Đã gửi đề xuất lịch hẹn. Đang chờ Trung tâm kiểm định duyệt. Mã tiếp nhận KTV sẽ được tạo ngay khi KTV được phân công.'
                              : 'Appointment proposed. Awaiting Center approval. Intake code will be generated once technician is assigned.'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-100/60 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                      👉 <strong>{lang === 'vi' ? 'Lưu ý người bán:' : 'Seller note:'}</strong>{' '}
                      {isWaitingBuyerApproval
                        ? (lang === 'vi'
                          ? 'Bạn đã gửi lại đề xuất thay đổi phương án chia phí kiểm định. Vui lòng chờ người mua xem và đồng ý trong phòng chat trước khi hẹn lịch đón KTV.'
                          : 'You have sent a counter-proposal. Please wait for the buyer to accept in chat before scheduling technician visit.')
                        : isWaitingSellerApproval
                          ? (lang === 'vi'
                            ? 'Khách mua đã đăng ký gói kiểm định tận nơi. Vui lòng bấm nút "Đồng Ý Kiểm Định" bên dưới để tiếp tục quy trình hoặc trao đổi trong phòng chat.'
                            : 'Buyer opted for at-home inspection. Please click "Accept Inspection" below to proceed or negotiate in chat.')
                          : isWaitingFeePayment
                            ? (lang === 'vi'
                              ? 'Yêu cầu kiểm định đã được xác nhận. Vui lòng hoàn tất đóng phí kiểm định (hoặc chờ người mua đóng phí) để mở tính năng hẹn lịch đón KTV.'
                              : 'Inspection request accepted. Please complete inspection fee payment to proceed with appointment scheduling.')
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
