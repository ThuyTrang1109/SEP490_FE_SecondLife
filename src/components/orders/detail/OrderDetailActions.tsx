import { AlertCircle, AlertTriangle, Calendar, Check, CheckCircle2, Clock, PackageCheck, Truck, Wallet, Wrench, X, XCircle } from 'lucide-react';
import type { BuyerInspectionStage, CancelOrder, ConfirmDialogState, OrderCheck } from '../../../types/orders/orderTypes';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { EscrowOrder, Language } from '../../../types';
import { getOrderAppointmentRejection } from '../../../utils/orders/orderAppointments';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import { formatInspectionDeadline, isInspectionPaymentExpired } from '../../../utils/inspectionPaymentDeadline';
import { formatVND, translations } from '../../../utils/translations';
import { getInboundShipmentProgress } from '../../../utils/inspectionCenterData';
import { getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
import { isOrderDeliveredToBuyer } from '../../../utils/orders/orderReceipt';

interface Props {
  order: EscrowOrder;
  isOrderCancelledOrRefunded: OrderCheck;
  isOrderSeller: (order: EscrowOrder) => boolean;
  detailHasInspection: boolean;
  isOrderReceiptConfirmed: OrderCheck;
  renderInspectionDecision: (order: EscrowOrder, close?: () => void) => ReactNode;
  setDetailModalOrder: (order: EscrowOrder | null) => void;
  lang: Language;
  setTrackingOrder: (order: EscrowOrder) => void;
  isOrderSellerConfirmed: OrderCheck;
  getOrderAppointment: (order: EscrowOrder) => OrderAppointment | null;
  handleSellerAcceptCounterAppointment: (orderId: string, appointment: OrderAppointment) => Promise<void>;
  orderActionLoading: string | null;
  setSchedulingOrder: (order: EscrowOrder) => void;
  setSchedulingReadOnly: (readOnly: boolean) => void;
  handleSellerConfirmOrder: (orderId: string) => void;
  handlePromptRejectInspection: (order: EscrowOrder) => void;
  onCancelOrder?: CancelOrder;
  handlePromptCancelOrder: (order: EscrowOrder) => void;
  isPartyInspectionFeePending: (order: EscrowOrder, isSeller: boolean) => boolean;
  getPartyInspectionFee: (order: EscrowOrder, isSeller: boolean) => number;
  isPartyInspectionFeePaid: (order: EscrowOrder, isSeller: boolean) => boolean;
  onRefreshOrders?: () => void;
  handlePayInspectionFee: (orderId: string) => Promise<void>;
  detailInboundLabel: string | null;
  isOrderPacked: OrderCheck;
  setCreateShipmentOrder: (order: EscrowOrder) => void;
  isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
  handlePromptCancelInspectionRequest: (order: EscrowOrder) => void;
  isShipmentCreatedForOrder: OrderCheck;
  detailHasInboundTracking: boolean;
  detailHasHubBuyerShipment: boolean;
  detailInboundProgress: ReturnType<typeof getInboundShipmentProgress> | null;
  detailBuyerInspectionStage: BuyerInspectionStage | null;
  confirmingReceiptIds: ReadonlySet<string>;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  setConfirmingReceiptIds: Dispatch<SetStateAction<Set<string>>>;
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  setReportingOrder: (order: EscrowOrder) => void;
}

export function OrderDetailActions({
  order: detailModalOrder,
  isOrderCancelledOrRefunded,
  isOrderSeller,
  detailHasInspection,
  isOrderReceiptConfirmed,
  renderInspectionDecision,
  setDetailModalOrder,
  lang,
  setTrackingOrder,
  isOrderSellerConfirmed,
  getOrderAppointment,
  handleSellerAcceptCounterAppointment,
  orderActionLoading,
  setSchedulingOrder,
  setSchedulingReadOnly,
  handleSellerConfirmOrder,
  handlePromptRejectInspection,
  onCancelOrder,
  handlePromptCancelOrder,
  isPartyInspectionFeePending,
  getPartyInspectionFee,
  isPartyInspectionFeePaid,
  onRefreshOrders,
  handlePayInspectionFee,
  detailInboundLabel,
  isOrderPacked,
  setCreateShipmentOrder,
  isInspectorArrivedForOrder,
  handlePromptCancelInspectionRequest,
  isShipmentCreatedForOrder,
  detailHasInboundTracking,
  detailHasHubBuyerShipment,
  detailInboundProgress,
  detailBuyerInspectionStage,
  confirmingReceiptIds,
  setConfirmDialog,
  setConfirmingReceiptIds,
  onConfirmReceipt,
  onOpenDispute,
  setReportingOrder,
}: Props) {
  const t = translations[lang];
  const detailIsAtHome = Boolean(
    detailHasInspection && (
      detailModalOrder.inspectionMethod === 'AT_HOME' ||
      (detailModalOrder as any).orderType === 'AT_HOME' ||
      (detailModalOrder as any).inspectionOrder?.orderType === 'AT_HOME' ||
      (detailModalOrder as any).inspectionOrder?.inspectionMethod === 'AT_HOME'
    )
  );
  const detailIsPurchaseAccepted = Boolean(
    getInspectionPurchaseDecision(detailModalOrder) === 'accepted' ||
    detailModalOrder.finalPaymentPaidAt ||
    (detailModalOrder as any).inspectionDecision === 'accepted' ||
    (detailModalOrder as any).buyerDecision === 'accepted' ||
    detailModalOrder.linkedOrderId ||
    (detailModalOrder as any).inspectionOrder?.finalPaymentPaidAt ||
    (detailModalOrder as any).inspectionOrder?.orderId ||
    String((detailModalOrder as any).backendStatus || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
    String((detailModalOrder as any).status || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
    String((detailModalOrder as any).inspectionStatus || '').toUpperCase() === 'DELIVERING_TO_BUYER' ||
    String((detailModalOrder as any).inspectionOrder?.status || '').toUpperCase() === 'DELIVERING_TO_BUYER'
  );
  const showInboundFooterStatus = detailInboundProgress?.step !== 3 || !detailHasHubBuyerShipment;
  const showInboundFooterTracking = (!detailHasInspection || (detailModalOrder.escrowStatus as string) === 'DELIVERING_TO_BUYER') &&
    (detailHasInboundTracking || isShipmentCreatedForOrder(detailModalOrder));
  return (
    <>
      {/* Modal Bottom Sticky Footer */}
      {Boolean(
        getInspectionPurchaseDecision(detailModalOrder) ||
        detailModalOrder.inspectionStatus === 'FAILED' ||
        detailModalOrder.escrowStatus === 'INSPECTION_FAILED' ||
        (!isOrderCancelledOrRefunded(detailModalOrder) && (
          isOrderSeller(detailModalOrder) ||
          (!isOrderSeller(detailModalOrder) && (
            detailModalOrder.escrowStatus === 'INSPECTION_PASSED' ||
            (detailModalOrder as any).backendStatus === 'PASSED' ||
            detailHasInspection ||
            (detailModalOrder.inspectionMethod === 'AT_HOME' || (detailModalOrder as any).orderType === 'AT_HOME') ||
            Boolean(
              (detailModalOrder.carrierPickedUpAt ||
                (detailModalOrder.backendStatus as any) === 'SHIPPED' ||
                (detailModalOrder.backendStatus as any) === 'DELIVERED' ||
                (detailModalOrder.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW') &&
              !isOrderReceiptConfirmed(detailModalOrder)
            )
          ))
        ))
      ) && (
          <div className="px-6 sm:px-7 py-3.5 sm:py-4 border-t border-gray-100 bg-slate-50/95 backdrop-blur-xs shrink-0 flex flex-wrap items-center justify-between gap-3 z-10">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              {renderInspectionDecision(detailModalOrder, () => setDetailModalOrder(null))}
              {!isOrderCancelledOrRefunded(detailModalOrder) &&
                detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
                detailModalOrder.escrowStatus !== 'DISPUTED' && (
                  <>
                    {/* Seller Action Buttons */}
                    {isOrderSeller(detailModalOrder) && (
                      isOrderReceiptConfirmed(detailModalOrder) ? (
                        detailHasInspection ? null : (
                          <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                            <div className="py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã Nhận Tiền Vào Ví (Đã Giải Ngân)' : 'Funds Credited to Wallet'}</span>
                            </div>
                            {!detailHasInspection && (
                              <button
                                onClick={() => setTrackingOrder(detailModalOrder)}
                                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Truck className="w-4 h-4 text-white" />
                                <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                              </button>
                            )}
                          </div>
                        )
                      ) : isOrderCancelledOrRefunded(detailModalOrder) ? (
                        <div className="py-2.5 px-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 flex-1">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>{lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy • Dừng Mọi Thao Tác' : 'Order Cancelled'}</span>
                        </div>
                      ) : (
                        <>
                          {/* GIAI ĐOẠN 1: Chờ xác nhận đơn / Đồng ý kiểm định */}
                          {!isOrderSellerConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'CANCELLED' &&
                            detailModalOrder.escrowStatus !== 'REFUNDED_TO_BUYER' &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'COMPLETED' &&
                            !detailModalOrder.shippingDeliveredAt && (
                              (() => {
                                const hasInspection = Boolean(
                                  detailModalOrder.hasInspectionService ||
                                  (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
                                  detailModalOrder.inspectionCenterId ||
                                  detailModalOrder.inspectionMethod ||
                                  (detailModalOrder as any).inspectionStatus ||
                                  detailModalOrder.escrowStatus === 'AWAITING_INSPECTION' ||
                                  detailModalOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
                                  detailModalOrder.escrowStatus === 'INSPECTION_PASSED'
                                );
                                const savedAppointment = getOrderAppointment(detailModalOrder);
                                const hasScheduledAppt = Boolean(
                                  savedAppointment?.scheduledAt ||
                                  detailModalOrder.appointmentScheduledAt ||
                                  (detailModalOrder as any).scheduledAt ||
                                  (detailModalOrder as any).inspectionOrder?.appointmentScheduledAt
                                );
                                const isPendingCenterAppt = Boolean(
                                  savedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' ||
                                  (detailModalOrder as any).appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
                                );
                                const isCounteredAppt = !isPendingCenterAppt && Boolean(
                                  (savedAppointment?.status === 'COUNTERED_BY_CENTER' && Boolean(savedAppointment?.counterScheduledAt)) ||
                                  ((detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((detailModalOrder as any).counterScheduledAt)) ||
                                  Boolean((detailModalOrder as any).inspectionOrder?.counterScheduledAt)
                                );
                                const detailApptRejection = !isCounteredAppt ? getOrderAppointmentRejection(detailModalOrder) : null;

                                if (hasInspection) {
                                  return (
                                    <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleSellerConfirmOrder(detailModalOrder.id);
                                        }}
                                        disabled={orderActionLoading === detailModalOrder.id}
                                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        title={lang === 'vi' ? 'Xác nhận đồng ý yêu cầu kiểm định' : 'Accept inspection'}
                                      >
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                        <span>
                                          {orderActionLoading === detailModalOrder.id
                                            ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                            : (lang === 'vi' ? 'Đồng Ý Kiểm Định' : 'Accept Inspection')}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handlePromptRejectInspection(detailModalOrder);
                                        }}
                                        disabled={orderActionLoading === detailModalOrder.id}
                                        className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        title={lang === 'vi' ? 'Từ chối yêu cầu kiểm định' : 'Reject Inspection'}
                                      >
                                        <X className="w-4 h-4" />
                                        <span>{lang === 'vi' ? 'Từ chối kiểm định' : 'Reject Inspection'}</span>
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSellerConfirmOrder(detailModalOrder.id);
                                      }}
                                      disabled={orderActionLoading === detailModalOrder.id}
                                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                      <Check className="w-4 h-4 stroke-[2.5]" />
                                      <span>
                                        {orderActionLoading === detailModalOrder.id
                                          ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                          : (lang === 'vi' ? 'Xác nhận đơn hàng' : 'Confirm Order')}
                                      </span>
                                    </button>

                                    {onCancelOrder && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handlePromptCancelOrder(detailModalOrder);
                                        }}
                                        className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                                      >
                                        <X className="w-4 h-4" />
                                        <span>{detailHasInspection
                                          ? (lang === 'vi' ? 'Hủy yêu cầu' : 'Cancel request')
                                          : (lang === 'vi' ? 'Hủy Đơn' : 'Cancel')}</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })()
                            )}

                          {/* GIAI ĐOẠN NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) CHO SELLER TRONG MODAL */}
                          {String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                            (() => {
                              const isFeePending = isPartyInspectionFeePending(detailModalOrder, true);
                              const sellerFee = getPartyInspectionFee(detailModalOrder, true);
                              const isFeePaid = isPartyInspectionFeePaid(detailModalOrder, true);
                              const deadline = detailModalOrder.paymentDeadline || (detailModalOrder as any)?.inspectionOrder?.paymentDeadline;
                              const isFeeExpired = isInspectionPaymentExpired(deadline);

                              if (isFeePending) {
                                return (
                                  <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                    {isFeeExpired ? (
                                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 flex-1">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                          <div>
                                            <strong className="block font-bold">
                                              {lang === 'vi' ? 'Đã quá hạn đóng phí kiểm định' : 'Fee payment deadline expired'}
                                            </strong>
                                            <span className="text-[11px] text-rose-700">
                                              {deadline
                                                ? `${lang === 'vi' ? 'Hạn chót:' : 'Deadline:'} ${formatInspectionDeadline(deadline, lang)}`
                                                : (lang === 'vi' ? 'Đơn hàng không thể tiếp tục thanh toán phí' : 'Cannot pay fee')}
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => onRefreshOrders?.()}
                                          className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer transition shrink-0"
                                        >
                                          {lang === 'vi' ? 'Tải lại đơn' : 'Refresh'}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handlePayInspectionFee(detailModalOrder.id)}
                                        disabled={orderActionLoading === detailModalOrder.id}
                                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                      >
                                        <Wallet className="w-4 h-4" />
                                        <span>
                                          {orderActionLoading === detailModalOrder.id
                                            ? (lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Processing...')
                                            : (lang === 'vi'
                                              ? `Nộp phí kiểm định (${formatVND(sellerFee)}) (Trừ Ví)`
                                              : `Pay Inspection Fee (${formatVND(sellerFee)})`)}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              if (isFeePaid) {
                                return (
                                  <div className="flex-1 py-2.5 px-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    <span>
                                      {lang === 'vi'
                                        ? `Bạn đã nộp phí kiểm định (${formatVND(sellerFee)}) • Chờ người mua thanh toán phí`
                                        : 'You paid inspection fee share • Awaiting buyer payment'}
                                    </span>
                                  </div>
                                );
                              }

                              return null;
                            })()
                          )}

                          {/* GIAI ĐOẠN 2: Đã xác nhận • Đang đóng gói */}
                          {isOrderSellerConfirmed(detailModalOrder) &&
                            String((detailModalOrder as any)?.backendStatus || '').toUpperCase() !== 'WAITING_FEE_PAYMENT' &&
                            !detailInboundLabel &&
                            !isOrderReceiptConfirmed(detailModalOrder) &&
                            detailModalOrder.backendStatus !== 'COMPLETED' &&
                            !detailModalOrder.shippingDeliveredAt &&
                            !isOrderPacked(detailModalOrder) &&
                            !detailIsPurchaseAccepted &&
                            (detailIsAtHome || (detailModalOrder.backendStatus !== 'SHIPPED' && detailModalOrder.escrowStatus !== 'SHIPPED_TO_BUYER')) &&
                            detailModalOrder.backendStatus !== 'DELIVERED' &&
                            (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                            (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' &&
                            (detailModalOrder.escrowStatus as string) !== 'INSPECTION_FAILED' &&
                            (detailModalOrder as any).backendStatus !== 'FAILED' &&
                            (detailModalOrder.escrowStatus as string) !== 'INSPECTION_PASSED' &&
                            (detailModalOrder as any).backendStatus !== 'PASSED' && (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                {/* Nút Đã Đóng Gói • Tạo Đơn Lalamove cho Chặng 1 của AT_CENTER hoặc đơn thông thường (không hiện cho đơn kiểm định ở nhà và không hiện khi người mua đã mua tiếp) */}
                                {(!detailHasInspection || !detailIsAtHome) && (
                                  <button
                                    onClick={() => {
                                      setCreateShipmentOrder(detailModalOrder);
                                    }}
                                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                    title={lang === 'vi' ? 'Kiện hàng đã đóng gói. Bấm để tạo vận đơn Lalamove điều phối tài xế lấy hàng' : 'Package is packed. Click to create Lalamove shipment'}
                                  >
                                    <Truck className="w-4 h-4" />
                                    <span>
                                      {lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Order'}
                                    </span>
                                  </button>
                                )}

                                {/* Nút Hẹn Lịch Đón KTV trong Modal Chi Tiết (CHỈ HIỆN KHI ĐƠN HÀNG LÀ KIỂM ĐỊNH TẬN NHÀ - AT_HOME VÀ CHƯA XÁC NHẬN MUA) */}
                                {detailIsAtHome && !detailIsPurchaseAccepted && (() => {
                                  const rej = getOrderAppointmentRejection(detailModalOrder);
                                  const appt = getOrderAppointment(detailModalOrder);
                                  const hasScheduledInDetail = Boolean(
                                    appt?.scheduledAt ||
                                    detailModalOrder.appointmentScheduledAt ||
                                    (detailModalOrder as any).scheduledAt ||
                                    (detailModalOrder as any).inspectionOrder?.appointmentScheduledAt
                                  );
                                  const isPendingCenterInDetail = Boolean(
                                    appt?.status === 'PENDING_CENTER_CONFIRMATION' ||
                                    (detailModalOrder as any).appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
                                  );
                                  const isCounteredInDetail = !isPendingCenterInDetail && Boolean(
                                    (
                                      (appt?.status === 'COUNTERED_BY_CENTER' && Boolean(appt?.counterScheduledAt)) ||
                                      ((detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((detailModalOrder as any).counterScheduledAt)) ||
                                      Boolean((detailModalOrder as any).inspectionOrder?.counterScheduledAt)
                                    )
                                  );

                                  if (isCounteredInDetail) {
                                    const counterPayload = appt || {
                                      scheduledAt: (detailModalOrder as any).appointmentScheduledAt || (detailModalOrder as any).counterScheduledAt,
                                      counterScheduledAt: (detailModalOrder as any).counterScheduledAt || appt?.counterScheduledAt || appt?.scheduledAt,
                                      counterShift: (detailModalOrder as any).counterShift || 'AFTERNOON',
                                      counterNote: (detailModalOrder as any).counterNote || 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
                                      status: 'COUNTERED_BY_CENTER',
                                    };
                                    return (
                                      <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSellerAcceptCounterAppointment(detailModalOrder.id, counterPayload)}
                                          disabled={orderActionLoading === detailModalOrder.id}
                                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                          title={lang === 'vi' ? 'Đồng ý với ngày giờ mới mà Trung tâm kiểm định đề xuất' : 'Accept Hub suggested appointment'}
                                        >
                                          <Check className="w-4 h-4 stroke-[2.5]" />
                                          <span>{lang === 'vi' ? 'Đồng Ý Lịch Mới Của Hub' : 'Accept Center Schedule'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSchedulingOrder(detailModalOrder);
                                            setSchedulingReadOnly(false);
                                          }}
                                          className="py-2.5 px-4 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                          <Calendar className="w-4 h-4" />
                                          <span>{lang === 'vi' ? 'Hẹn Lại Lịch Khác' : 'Reschedule'}</span>
                                        </button>
                                      </div>
                                    );
                                  }

                                  if (isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)) {
                                    return (
                                      <div className="flex-1 py-2.5 px-4 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs">
                                        <Wrench className="w-4 h-4 text-emerald-600 animate-spin" />
                                        <span>{lang === 'vi' ? 'KTV Đã Đến Và Đang Kiểm Tra' : 'Inspector Arrived & Inspecting'}</span>
                                      </div>
                                    );
                                  }

                                  if (!hasScheduledInDetail || rej) {
                                    return (
                                      <button
                                        onClick={() => {
                                          setSchedulingOrder(detailModalOrder);
                                          setSchedulingReadOnly(false);
                                        }}
                                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                        title={lang === 'vi' ? 'Chọn ngày giờ kỹ thuật viên SecondLife đến nhà kiểm tra thiết bị' : 'Schedule technician visit'}
                                      >
                                        <Calendar className="w-4 h-4" />
                                        <span>
                                          {rej
                                            ? (lang === 'vi' ? 'Đặt Lại Lịch Hẹn KTV' : 'Reschedule Visit')
                                            : (lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Visit')}
                                        </span>
                                      </button>
                                    );
                                  }

                                  return null;
                                })()}

                                {/* Nút Xem / In Mã QR Dán Sản Phẩm trong Modal Chi Tiết */}


                                {!detailHasInspection && isShipmentCreatedForOrder(detailModalOrder) && (
                                  <button
                                    onClick={() => setTrackingOrder(detailModalOrder)}
                                    className="py-2.5 px-4 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Truck className="w-4 h-4 text-blue-600" />
                                    <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                          {/* GIAI ĐOẠN 3: Đã đóng gói • Chờ Shipper đến lấy (Kiểm định tại nhà quản lý theo dõi trong Bước 2) */}
                          {!detailIsAtHome && (!detailHasInspection || detailHasInboundTracking) &&
                            (detailHasInboundTracking || (isOrderPacked(detailModalOrder) &&
                              !isOrderReceiptConfirmed(detailModalOrder) &&
                              detailModalOrder.backendStatus !== 'COMPLETED' &&
                              !detailModalOrder.shippingDeliveredAt &&
                              !detailModalOrder.carrierPickedUpAt &&
                              detailModalOrder.backendStatus !== 'SHIPPED' &&
                              detailModalOrder.backendStatus !== 'DELIVERED' &&
                              (detailModalOrder.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                              (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                              (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED')) &&
                            (showInboundFooterStatus || showInboundFooterTracking) && (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                {/* Nhãn Tĩnh (Không phải nút bấm, không click được) */}
                                {showInboundFooterStatus && (detailInboundProgress?.step === 3 ? (
                                  <div
                                    className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>{lang === 'vi' ? 'Kiện Hàng Đã Giao Tới Hub Kiểm Định' : 'Delivered to Inspection Hub'}</span>
                                  </div>
                                ) : detailInboundProgress?.step === 2 ? (
                                  <div
                                    className="flex-1 py-2.5 px-4 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none"
                                  >
                                    <Truck className="w-4 h-4 text-cyan-600" />
                                    <span>{lang === 'vi' ? 'Tài Xế Đang Giao Kiện Hàng Tới Hub' : 'In Transit to Hub'}</span>
                                  </div>
                                ) : (
                                  <div
                                    className="flex-1 py-2.5 px-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default select-none pointer-events-none"
                                  >
                                    <PackageCheck className="w-4 h-4 text-teal-600" />
                                    <span>{lang === 'vi' ? 'Đã gói hàng• Chờ Bàn Giao Tài Xế' : 'Packed • Waiting for Carrier'}</span>
                                  </div>
                                ))}

                                {showInboundFooterTracking && (
                                  <button
                                    onClick={() => setTrackingOrder(detailModalOrder)}
                                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Truck className="w-4 h-4 text-white" />
                                    <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                          {/* GIAI ĐOẠN 4: Đang giao hàng (Kiểm định tại nhà quản lý theo dõi trong Bước 2) */}
                          {!detailIsAtHome && !detailHasInboundTracking && (detailModalOrder.carrierPickedUpAt ||
                            detailModalOrder.backendStatus === 'SHIPPED' ||
                            detailModalOrder.backendStatus === 'DELIVERED' ||
                            (detailModalOrder.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                            (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' ||
                            (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED') && (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                <span className="py-2.5 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
                                  <Truck className="w-4 h-4 text-blue-600" />
                                  <span>
                                    {detailModalOrder.backendStatus === 'DELIVERED' || (detailModalOrder.escrowStatus as string) === 'COMPLETED_RELEASED'
                                      ? (lang === 'vi' ? 'Đã Giao Thành Công' : 'Delivered')
                                      : (lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit')}
                                  </span>
                                </span>

                                {(!detailHasInspection || (detailModalOrder.escrowStatus as string) === 'DELIVERING_TO_BUYER') && (
                                  <button
                                    onClick={() => setTrackingOrder(detailModalOrder)}
                                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Truck className="w-4 h-4 text-white" />
                                    <span>{lang === 'vi' ? 'Theo Dõi Vận Đơn Lalamove' : 'Lalamove Tracking'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                        </>
                      )
                    )}

                    {/* Người Mua (Buyer) nộp phí kiểm định khi người bán đã đồng ý kiểm định */}
                    {!isOrderSeller(detailModalOrder) &&
                      String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                        (() => {
                          const buyerFee = getPartyInspectionFee(detailModalOrder, false);
                          const isSeller100 = detailModalOrder.inspectionFeeSplit === 'SELLER_100' || buyerFee <= 0;
                          const isFeeExpired = isInspectionPaymentExpired(detailModalOrder.paymentDeadline);

                          if (isFeeExpired) {
                            return (
                              <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 flex-1">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <div>
                                      <strong className="block font-bold">
                                        {lang === 'vi' ? 'Đã quá hạn đóng phí kiểm định' : 'Fee payment deadline expired'}
                                      </strong>
                                      <span className="text-[11px] text-rose-700">
                                        {detailModalOrder.paymentDeadline
                                          ? `${lang === 'vi' ? 'Hạn chót:' : 'Deadline:'} ${formatInspectionDeadline(detailModalOrder.paymentDeadline, lang)}`
                                          : (lang === 'vi' ? 'Đơn hàng không thể tiếp tục thanh toán phí' : 'Cannot pay fee')}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onRefreshOrders?.()}
                                    className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer transition shrink-0"
                                  >
                                    {lang === 'vi' ? 'Tải lại đơn' : 'Refresh'}
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          // Khi người bán chịu 100% hoặc người mua đã nộp: Ẩn hoàn toàn banner ở chân modal vì đã hiển thị ở trên
                          if (isSeller100 || isPartyInspectionFeePaid(detailModalOrder, false)) {
                            return null;
                          }

                          // Chỉ hiện nút khi người mua thực sự cần nộp phí (buyerFee > 0)
                          return (
                            <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1">
                              <button
                                onClick={() => handlePayInspectionFee(detailModalOrder.id)}
                                disabled={orderActionLoading === detailModalOrder.id}
                                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Wallet className="w-4 h-4" />
                                <span>
                                  {orderActionLoading === detailModalOrder.id
                                    ? (lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Processing...')
                                    : (lang === 'vi'
                                      ? `Nộp phí kiểm định (${formatVND(buyerFee)}) (Trừ Ví)`
                                      : `Pay Inspection Fee (${formatVND(buyerFee)})`)}
                                </span>
                              </button>
                            </div>
                          );
                        })()
                      )}

                    {/* GIAI ĐOẠN ĐANG CHỜ PHẢN HỒI YÊU CẦU KIỂM ĐỊNH LẦN ĐẦU CHO BUYER TRONG MODAL */}
                    {!isOrderSeller(detailModalOrder) &&
                      detailHasInspection &&
                      !isOrderSellerConfirmed(detailModalOrder) &&
                      detailModalOrder.confirmationStatus !== 'CONFIRMED' &&
                      !detailModalOrder.buyerPaidAt &&
                      !detailModalOrder.sellerPaidAt &&
                      !detailModalOrder.shippingDeliveredAt &&
                      (
                        detailModalOrder.status === 'WAITING_SELLER_APPROVAL' ||
                        (detailModalOrder as any).backendStatus === 'WAITING_SELLER_APPROVAL' ||
                        (detailModalOrder as any).inspectionStatus === 'WAITING_SELLER_APPROVAL' ||
                        (detailModalOrder as any).inspectionOrder?.status === 'WAITING_SELLER_APPROVAL'
                      ) &&
                      (detailModalOrder.status as string) !== 'CONFIRMED_PENDING_DISPATCH' &&
                      (detailModalOrder as any).backendStatus !== 'CONFIRMED_PENDING_DISPATCH' &&
                      (detailModalOrder as any).inspectionStatus !== 'CONFIRMED_PENDING_DISPATCH' &&
                      (detailModalOrder.escrowStatus as string) !== 'CONFIRMED_PENDING_DISPATCH' &&
                      detailModalOrder.backendStatus !== 'DELIVERED' &&
                      detailModalOrder.backendStatus !== 'PASSED' &&
                      (detailModalOrder as any).inspectionStatus !== 'PASSED' &&
                      !detailModalOrder.linkedOrderId &&
                      !detailModalOrder.finalPaymentPaidAt &&
                      (detailModalOrder.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                      (detailModalOrder.escrowStatus as string) !== 'COMPLETED_RELEASED' &&
                      !detailModalOrder.inspectionReport &&
                      !isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder) && (
                        <div className="flex flex-col sm:flex-row items-stretch gap-2 flex-1 justify-end">
                          {onCancelOrder && (
                            <button
                              type="button"
                              onClick={() => handlePromptCancelInspectionRequest(detailModalOrder)}
                              className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                              title={lang === 'vi' ? 'Hủy yêu cầu kiểm định và hoàn trả 100% tiền tạm giữ về ví Escrow' : 'Cancel inspection request and refund funds'}
                            >
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span>{lang === 'vi' ? 'Hủy Yêu Cầu Kiểm Định' : 'Cancel Inspection Request'}</span>
                            </button>
                          )}
                        </div>
                      )}



                    {/* Chỉ Người Mua (Buyer) mới có nút Khiếu Nại Trả Hàng khi đơn đã giao thành công và CHƯA xác nhận */}
                    {!isOrderSeller(detailModalOrder) &&
                      !detailBuyerInspectionStage &&
                      !isOrderReceiptConfirmed(detailModalOrder) &&
                      isOrderDeliveredToBuyer(detailModalOrder) && (
                        <button
                          onClick={() => {
                            if (onOpenDispute) {
                              onOpenDispute(detailModalOrder);
                            } else {
                              setReportingOrder(detailModalOrder);
                            }
                            setDetailModalOrder(null);
                          }}
                          className="py-1.5 px-3 bg-white hover:bg-slate-50 text-[#24263e] border border-[#24263e]/30 rounded-xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-[#24263e] shrink-0" />
                          <span>{t.openDispute}</span>
                        </button>
                      )}
                  </>
                )}
            </div>
          </div>
        )}
    </>
  );
}
