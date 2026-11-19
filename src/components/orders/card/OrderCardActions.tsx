import { Award, Calendar, Check, CheckCircle2, Clock, Eye, MessageSquare, PackageCheck, QrCode, Star, Truck, Wallet, Wrench, X, XCircle } from 'lucide-react';
import type { BuyerInspectionStage, CancelOrder, ConfirmDialogState, OrderCheck } from '../../../types/orders/orderTypes';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { EscrowOrder, Language, Listing } from '../../../types';
import { getOrderAppointmentRejection, type OrderAppointment } from '../../../utils/orders/orderAppointments';
import { dialogService } from '../../../utils/dialogService';
import { formatInspectionDeadline, isInspectionPaymentExpired } from '../../../utils/inspectionPaymentDeadline';
import { formatVND } from '../../../utils/translations';
import { isOrderDeliveredToBuyer, isOrderInTransitToBuyer } from '../../../utils/orders/orderReceipt';
import { getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';

export interface OrderCardActionsProps {
  order: EscrowOrder;
  orderIsSeller: boolean;
  lang: Language;
  hasInspection: boolean;
  orderActionLoading: string | null;
  savedAppointment: OrderAppointment | null;
  inboundLabel: string | null;
  hasActiveShipment: boolean;
  hasInboundTracking: boolean;
  buyerInspectionStage: BuyerInspectionStage | null;
  loadingBankPaymentId: string | null;
  confirmingReceiptIds: ReadonlySet<string>;
  reviewedOrderIds: readonly string[];
  state: {
    isOrderReceiptConfirmed: OrderCheck;
    isOrderCancelledOrRefunded: OrderCheck;
    isOrderSellerConfirmed: OrderCheck;
    isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
    isPartyInspectionFeePending: (order: EscrowOrder, isSeller: boolean) => boolean;
    getPartyInspectionFee: (order: EscrowOrder, isSeller: boolean) => number;
    isPartyInspectionFeePaid: (order: EscrowOrder, isSeller: boolean) => boolean;
    isOrderPacked: OrderCheck;
    isOrderUnpaid: (order: EscrowOrder) => boolean;
    getOrderAppointment: (order: EscrowOrder) => OrderAppointment | null;
  };
  actions: {
    setDetailModalOrder: (order: EscrowOrder | null) => void;
    onOpenChat?: (listing: Listing) => void;
    renderInspectionDecision: (order: EscrowOrder, close?: () => void) => ReactNode;
    setTrackingOrder: (order: EscrowOrder) => void;
    setSchedulingOrder: (order: EscrowOrder) => void;
    setSchedulingReadOnly: (readOnly: boolean) => void;
    handleSellerConfirmOrder: (orderId: string) => void;
    handlePromptRejectInspection: (order: EscrowOrder) => void;
    onCancelOrder?: CancelOrder;
    handlePromptCancelOrder: (order: EscrowOrder) => void;
    onRefreshOrders?: () => void;
    handlePayInspectionFee: (orderId: string) => Promise<void>;
    setCreateShipmentOrder: (order: EscrowOrder) => void;
    handlePromptCancelInspectionRequest: (order: EscrowOrder) => void;
    setCertificateModalOrder: (order: EscrowOrder) => void;
    handleSellerAcceptCounterAppointment: (orderId: string, appointment: OrderAppointment) => Promise<void>;
    handleOpenBankPaymentModal: (order: EscrowOrder) => Promise<void>;
    setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
    setConfirmingReceiptIds: Dispatch<SetStateAction<Set<string>>>;
    onConfirmReceipt: (orderId: string) => void;
    setReviewModalOrder: (order: EscrowOrder) => void;
  };
}

export function OrderCardActions({
  order: ord, orderIsSeller, lang, hasInspection, orderActionLoading, savedAppointment, inboundLabel, hasActiveShipment, hasInboundTracking, buyerInspectionStage, loadingBankPaymentId, confirmingReceiptIds, reviewedOrderIds,
  state: { isOrderReceiptConfirmed, isOrderCancelledOrRefunded, isOrderSellerConfirmed, isInspectorArrivedForOrder, isPartyInspectionFeePending, getPartyInspectionFee, isPartyInspectionFeePaid, isOrderPacked, isOrderUnpaid, getOrderAppointment },
  actions: { setDetailModalOrder, onOpenChat, renderInspectionDecision, setTrackingOrder, setSchedulingOrder, setSchedulingReadOnly, handleSellerConfirmOrder, handlePromptRejectInspection, onCancelOrder, handlePromptCancelOrder, onRefreshOrders, handlePayInspectionFee, setCreateShipmentOrder, handlePromptCancelInspectionRequest, setCertificateModalOrder, handleSellerAcceptCounterAppointment, handleOpenBankPaymentModal, setConfirmDialog, setConfirmingReceiptIds, onConfirmReceipt, setReviewModalOrder }
}: OrderCardActionsProps) {
  const isPendingApprovalOrFeeInAction = Boolean(
    !isOrderSellerConfirmed(ord) ||
    ['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING'].includes(
      String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' && (ord as any).status !== 'AWAITING_PAYMENT' && (ord as any).status !== 'HELD_IN_ESCROW' ? (ord as any).status : '') || '').toUpperCase()
    )
  );
  const hasScheduledAppointment = !isPendingApprovalOrFeeInAction && Boolean(
    savedAppointment?.scheduledAt ||
    ord.appointmentScheduledAt ||
    (ord as any).scheduledAt ||
    (ord as any).inspectionOrder?.appointmentScheduledAt
  );
  const isCounteredAppointment = !isPendingApprovalOrFeeInAction && Boolean(
    (
      (savedAppointment?.status === 'COUNTERED_BY_CENTER' && Boolean(savedAppointment?.counterScheduledAt)) ||
      ((ord as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((ord as any).counterScheduledAt)) ||
      Boolean((ord as any).inspectionOrder?.counterScheduledAt)
    ) &&
    savedAppointment?.status !== 'PENDING_CENTER_CONFIRMATION' &&
    (ord as any).appointmentStatus !== 'PENDING_CENTER_CONFIRMATION' &&
    ord.status !== 'CONFIRMED_PENDING_DISPATCH'
  );
  const appointmentRejection = !isCounteredAppointment && !isPendingApprovalOrFeeInAction ? getOrderAppointmentRejection(ord) : null;
  const isAtHome = Boolean(
    hasInspection && (
      ord.inspectionMethod === 'AT_HOME' ||
      (ord as any).orderType === 'AT_HOME' ||
      (ord as any).inspectionOrder?.orderType === 'AT_HOME' ||
      (ord as any).inspectionOrder?.inspectionMethod === 'AT_HOME'
    )
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

  return (
    <div className="px-4 sm:px-6 py-2.5 bg-white flex flex-wrap items-center justify-between gap-2.5">
      {/* Left: View Details & Chat */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetailModalOrder(ord);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-white border border-gray-300 hover:border-[#c34c36] text-slate-700 hover:text-[#24263e] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{orderIsSeller ? (lang === 'vi' ? 'Chi tiết đơn ' : 'Order Details') : (lang === 'vi' ? 'Xem Chi Tiết' : 'View Details')}</span>
        </button>

        {onOpenChat && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat(ord.listing);
            }}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0 flex items-center justify-center"
            title={orderIsSeller ? (lang === 'vi' ? 'Nhắn tin với người mua' : 'Chat with buyer') : (lang === 'vi' ? 'Nhắn tin với người bán' : 'Chat with seller')}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right: Operational Actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end py-0.5 ml-auto">
        {renderInspectionDecision(ord)}
        {/* Seller Actions */}
        {orderIsSeller ? (
          isOrderReceiptConfirmed(ord) ? (
            hasInspection ? null : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'vi' ? 'Đã Nhận Tiền Vào Ví' : 'Funds Credited to Wallet'}</span>
              </span>
            )
          ) : isOrderCancelledOrRefunded(ord) ? (
            null
          ) : (
            <>
              {/* GIAI ĐOẠN 1: CHỜ XÁC NHẬN ĐƠN / CHỜ ĐỒNG Ý KIỂM ĐỊNH */}
              {!isOrderSellerConfirmed(ord) && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && !isOrderReceiptConfirmed(ord) && ord.backendStatus !== 'COMPLETED' && !ord.shippingDeliveredAt && (
                <>
                  {hasInspection ? (
                    <>
                      {String((ord as any).backendStatus || (ord as any).inspectionStatus || (ord as any).inspectionOrder?.status || ((ord as any).status !== 'AWAITING_INSPECTION' ? (ord as any).status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL' ? (
                        onOpenChat ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(ord.listing);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                            title={lang === 'vi' ? 'Xem trao đổi trong phòng chat' : 'View chat'}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                            <span>{lang === 'vi' ? 'Đang Chờ Người Mua Duyệt' : 'Awaiting Buyer Approval'}</span>
                          </button>
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold whitespace-nowrap shrink-0">
                            {lang === 'vi' ? 'Đang Chờ Người Mua Duyệt' : 'Awaiting Buyer Approval'}
                          </span>
                        )
                      ) : (
                        <>
                          {ord.inspectionMethod === 'AT_HOME' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSellerConfirmOrder(ord.id);
                              }}
                              disabled={orderActionLoading === ord.id}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                              title={lang === 'vi' ? 'Xác nhận đồng ý kiểm định tận nhà' : 'Accept at-home inspection'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>
                                {orderActionLoading === ord.id
                                  ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                  : (lang === 'vi' ? 'Đồng Ý Kiểm Định' : 'Accept Inspection')}
                              </span>
                            </button>
                          ) : (
                            /* Nút Xác Nhận Đồng Ý Kiểm Định & Gửi Hub (Chặng 1) */
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSellerConfirmOrder(ord.id);
                              }}
                              disabled={orderActionLoading === ord.id}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                              title="Xác nhận đồng ý kiểm định và chuẩn bị gửi hàng Chặng 1 đến Trung tâm Hub SecondLife"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>
                                {orderActionLoading === ord.id
                                  ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                                  : (lang === 'vi' ? ' Đồng ý kiểm định' : 'Accept Inspection')}
                              </span>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromptRejectInspection(ord);
                            }}
                            disabled={orderActionLoading === ord.id}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                            title="Từ chối yêu cầu kiểm định"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Từ chối' : 'Reject Inspection'}</span>
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSellerConfirmOrder(ord.id);
                        }}
                        disabled={orderActionLoading === ord.id}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 animate-pulse whitespace-nowrap shrink-0"
                        title="Người bán kiểm tra còn hàng và cam kết chuẩn bị hàng theo hạn chót SLA"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {orderActionLoading === ord.id
                            ? (lang === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                            : (lang === 'vi' ? 'Xác Nhận Đơn Hàng' : 'Confirm Order')}
                        </span>
                      </button>

                      {onCancelOrder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePromptCancelOrder(ord);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="Hủy đơn hàng nếu hết hàng hoặc không thể đáp ứng"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{Boolean(hasInspection || ord.hasInspectionService || (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) || ord.inspectionCenterId || ord.inspectionStatus)
                            ? (lang === 'vi' ? 'Từ chối yêu cầu' : 'Decline request')
                            : (lang === 'vi' ? 'Hủy Đơn' : 'Cancel')}</span>
                        </button>
                      )}
                    </>
                  )}
                </>
              )}

              {/* GIAI ĐOẠN NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) CHO SELLER */}
              {['WAITING_FEE_PAYMENT'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ord.status || '').toUpperCase()) && (
                (() => {
                  const isFeePending = isPartyInspectionFeePending(ord, true);
                  const sellerFee = getPartyInspectionFee(ord, true);
                  const isFeePaid = isPartyInspectionFeePaid(ord, true);
                  const deadline = ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline;
                  const isFeeExpired = isInspectionPaymentExpired(deadline);

                  if (isFeePending) {
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isFeeExpired) {
                              dialogService.error(
                                lang === 'vi'
                                  ? `Đơn hàng đã quá hạn nộp phí kiểm định (${formatInspectionDeadline(deadline, lang)}). Vui lòng tải lại đơn hàng.`
                                  : `Inspection fee payment deadline has expired (${formatInspectionDeadline(deadline, lang)}).`,
                                'Đã Hết Hạn'
                              );
                              onRefreshOrders?.();
                              return;
                            }
                            handlePayInspectionFee(ord.id);
                          }}
                          disabled={orderActionLoading === ord.id || isFeeExpired}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 ${isFeeExpired
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                            : 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-700 hover:to-amber-800 text-white cursor-pointer'
                            }`}
                          title={isFeeExpired
                            ? (lang === 'vi' ? `Đã quá hạn đóng phí kiểm định (${formatInspectionDeadline(deadline, lang)})` : 'Fee payment deadline expired')
                            : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(sellerFee)}) từ Ví SecondLife` : 'Pay inspection fee from wallet')}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>
                            {orderActionLoading === ord.id
                              ? (lang === 'vi' ? 'Đang nộp...' : 'Processing...')
                              : isFeeExpired
                                ? (lang === 'vi' ? 'Đã Hết Hạn Đóng Phí' : 'Fee Payment Expired')
                                : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(sellerFee)})` : `Pay Inspection Fee (${formatVND(sellerFee)})`)}
                          </span>
                        </button>
                      </div>
                    );
                  }

                  if (isFeePaid) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 whitespace-nowrap shrink-0">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {lang === 'vi'
                            ? `Đã nộp phí (${formatVND(sellerFee)}) • Chờ người mua thanh toán`
                            : 'Fee paid • Awaiting buyer payment'}
                        </span>
                      </span>
                    );
                  }

                  return null;
                })()
              )}

              {/* GIAI ĐOẠN 2: ĐÃ XÁC NHẬN • ĐANG ĐÓNG GÓI */}
              {isOrderSellerConfirmed(ord) &&
                !isPendingApprovalOrFeeInAction &&
                !['WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PENDING', 'INSPECTION_FAILED', 'FAILED'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ord.status || '').toUpperCase()) &&
                (ord.status as string) !== 'WAITING_SELLER_APPROVAL' &&
                (ord as any).backendStatus !== 'WAITING_SELLER_APPROVAL' &&
                (ord as any).inspectionStatus !== 'WAITING_SELLER_APPROVAL' &&
                (ord as any).customerStatus !== 'WAITING_SELLER_APPROVAL' &&
                !inboundLabel &&
                !isOrderReceiptConfirmed(ord) &&
                ord.backendStatus !== 'COMPLETED' &&
                !ord.shippingDeliveredAt &&
                !isOrderPacked(ord) &&
                (isAtHome || (ord.backendStatus !== 'SHIPPED' && ord.escrowStatus !== 'SHIPPED_TO_BUYER')) &&
                ord.backendStatus !== 'DELIVERED' &&
                ord.escrowStatus !== 'DELIVERED_INSPECTION_WINDOW' &&
                ord.escrowStatus !== 'COMPLETED_RELEASED' &&
                ord.escrowStatus !== 'INSPECTION_FAILED' &&
                (ord as any).backendStatus !== 'FAILED' &&
                (
                  (!['INSPECTION_PASSED', 'PASSED', 'INSPECTION_FAILED', 'FAILED'].includes(ord.escrowStatus || '') && (ord as any).backendStatus !== 'PASSED' && (ord as any).backendStatus !== 'FAILED') ||
                  (isAtHome && isPurchaseAccepted)
                ) && (
                  <>
                    {/* Nút Đã Đóng Gói • Tạo Đơn Lalamove cho Chặng 1 hoặc đơn thông thường hoặc đơn AT_HOME sau khi người mua chốt mua */}
                    {(!hasInspection || !isAtHome || (isAtHome && isPurchaseAccepted && !isOrderPacked(ord))) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateShipmentOrder(ord);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                        title={lang === 'vi' ? 'Kiện hàng đã đóng gói. Bấm để tạo vận đơn Lalamove điều phối tài xế lấy hàng' : 'Package is packed. Click to create Lalamove shipment'}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'vi' ? 'Đã gói hàng • Tạo đơn vận chuyển' : 'Packed • Create Lalamove Order'}
                        </span>
                      </button>
                    )}

                    {/* Nút Hẹn Giờ Kiểm Định (CHỈ HIỆN KHI ĐƠN HÀNG LÀ KIỂM ĐỊNH TẬN NHÀ - AT_HOME VÀ CHƯA XÁC NHẬN MUA) */}
                    {isAtHome && !isPurchaseAccepted && (
                      !isInspectorArrivedForOrder(ord.id, ord) ? (
                        (!hasScheduledAppointment || appointmentRejection) && !isCounteredAppointment ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSchedulingOrder(ord);
                              setSchedulingReadOnly(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                            title={lang === 'vi' ? 'Người bán lên lịch hẹn ngày giờ kỹ thuật viên đến kiểm định tại nhà' : 'Schedule inspection appointment with Hub technician at home'}
                          >
                            <Calendar className="w-3.5 h-3.5 text-orange-600" />
                            <span>
                              {appointmentRejection
                                ? (lang === 'vi' ? 'Đặt Lại Lịch Hẹn KTV' : 'Reschedule Visit')
                                : (lang === 'vi' ? 'Hẹn Lịch Đón KTV' : 'Schedule Visit')}
                            </span>
                          </button>
                        ) : null
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
                          <Wrench className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                          <span>{lang === 'vi' ? 'KTV Đang Kiểm Tra Máy' : 'Inspecting Device'}</span>
                        </span>
                      )
                    )}
                  </>
                )}

              {/* GIAI ĐOẠN 3: ĐÃ ĐÓNG GÓI • CHỜ SHIPPER ĐẾN LẤY (CHỈ DÀNH CHO ĐƠN TRỰC TIẾP KHÔNG KIỂM ĐỊNH) */}
              {!isPendingApprovalOrFeeInAction &&
                !hasInspection &&
                !isAtHome &&
                isOrderPacked(ord) &&
                !isOrderReceiptConfirmed(ord) &&
                ord.backendStatus !== 'COMPLETED' &&
                !ord.shippingDeliveredAt &&
                !ord.carrierPickedUpAt &&
                ord.backendStatus !== 'SHIPPED' &&
                ord.backendStatus !== 'DELIVERED' &&
                (ord.escrowStatus as string) !== 'SHIPPED_TO_BUYER' &&
                (ord.escrowStatus as string) !== 'DELIVERED_INSPECTION_WINDOW' &&
                (ord.escrowStatus as string) !== 'COMPLETED_RELEASED' && (
                  <>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 whitespace-nowrap shrink-0 shadow-xs cursor-default select-none pointer-events-none"
                    >
                      <PackageCheck className="w-4 h-4 text-teal-600" />
                      <span>{lang === 'vi' ? 'Đã Đóng Gói • Chờ Tài Xế Lấy' : 'Packed • Waiting for Carrier'}</span>
                    </span>
                    {(hasActiveShipment || isOrderPacked(ord)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackingOrder(ord);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                      >
                        <Truck className="w-3.5 h-3.5 text-white" />
                        <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                      </button>
                    )}
                  </>
                )}

              {/* GIAI ĐOẠN 4: ĐANG GIAO HÀNG (Hoặc đã hoàn thành) (CHỈ DÀNH CHO ĐƠN TRỰC TIẾP KHÔNG KIỂM ĐỊNH) */}
              {!isPendingApprovalOrFeeInAction &&
                !hasInspection &&
                !isAtHome &&
                (ord.carrierPickedUpAt ||
                ord.backendStatus === 'SHIPPED' ||
                ord.backendStatus === 'DELIVERED' ||
                (ord.escrowStatus as string) === 'SHIPPED_TO_BUYER' ||
                (ord.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' ||
                (ord.escrowStatus as string) === 'COMPLETED_RELEASED') && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 whitespace-nowrap shrink-0">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {ord.backendStatus === 'DELIVERED' || (ord.escrowStatus as string) === 'COMPLETED_RELEASED'
                          ? (lang === 'vi' ? 'Đã Giao Thành Công' : 'Delivered')
                          : (lang === 'vi' ? 'Đang Giao Hàng' : 'In Transit')}
                      </span>
                    </span>

                    {(hasActiveShipment || isOrderPacked(ord)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackingOrder(ord);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                      >
                        <Truck className="w-3.5 h-3.5 text-white" />
                        <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                      </button>
                    )}
                  </>
                )}



              {/* Completed: Escrow released notice */}
              {!hasInspection && ord.escrowStatus === 'COMPLETED_RELEASED' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Đã Giải Ngân Vào Ví' : 'Funds Credited to Wallet'}</span>
                </span>
              )}
            </>
          )
        ) : (
          /* Buyer Actions */
          isOrderCancelledOrRefunded(ord) ? (
            null
          ) : (
            <>
              {/* Cancel Order / Inspection Request Button for Buyer */}
              {onCancelOrder && ord.backendStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.escrowStatus !== 'COMPLETED_RELEASED' && (
                (() => {
                  const isCounterOrder = Boolean(
                    (ord as any).note?.toLowerCase().includes('đề xuất lại') ||
                    (ord as any).note?.toLowerCase().includes('counter') ||
                    (ord as any).note?.toLowerCase().includes('thương lượng') ||
                    (ord as any).inspectionNote?.toLowerCase().includes('đề xuất lại') ||
                    (ord as any).inspectionNote?.toLowerCase().includes('counter') ||
                    (ord as any).inspectionNote?.toLowerCase().includes('thương lượng')
                  );
                  // Đơn có kiểm định: Chỉ xuất hiện lần đầu tiên khi người mua gửi yêu cầu
                  // Từ lần thương lượng thứ 2 hoặc khi đã xác nhận/nộp phí thì KHÔNG cho hủy
                  if (hasInspection) {
                    if (
                      isCounterOrder ||
                      ord.sellerConfirmedAt ||
                      ord.confirmationStatus === 'CONFIRMED' ||
                      isOrderSellerConfirmed(ord) ||
                      (ord as any).backendStatus === 'WAITING_FEE_PAYMENT' ||
                      (ord as any).inspectionStatus === 'WAITING_FEE_PAYMENT' ||
                      ord.status === 'CONFIRMED_PENDING_DISPATCH' ||
                      (ord as any).backendStatus === 'CONFIRMED_PENDING_DISPATCH' ||
                      (ord as any).inspectionStatus === 'CONFIRMED_PENDING_DISPATCH' ||
                      (ord.escrowStatus as string) === 'CONFIRMED_PENDING_DISPATCH' ||
                      Boolean((ord as any).buyerPaidAt) ||
                      Boolean((ord as any).sellerPaidAt)
                    ) {
                      return null;
                    }
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromptCancelOrder(ord);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                        title={lang === 'vi' ? 'Hủy yêu cầu kiểm định' : 'Cancel inspection request'}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Hủy yêu cầu' : 'Cancel request'}</span>
                      </button>
                    );
                  }

                  // Đơn hàng thông thường không kiểm định
                  if (!ord.sellerConfirmedAt && ord.confirmationStatus !== 'CONFIRMED') {
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromptCancelOrder(ord);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs"
                        title={lang === 'vi' ? 'Hủy đơn hàng (Chỉ khả dụng khi người bán chưa xác nhận đơn)' : 'Cancel order (Available while seller has not confirmed)'}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Hủy Đơn' : 'Cancel'}</span>
                      </button>
                    );
                  }

                  return null;
                })()
              )}

              {/* Buyer tracking is available outside the inspection and purchase-decision stages, or when inspection order is passed and shipment is created */}
              {!isAtHome && (!hasInspection || ord.carrierPickedUpAt || (ord.escrowStatus as string) === 'DELIVERING_TO_BUYER' || (ord as any).backendStatus === 'SHIPPED') &&
                isOrderPacked(ord) && !buyerInspectionStage && !isOrderUnpaid(ord) && ord.escrowStatus !== 'CANCELLED' && ord.escrowStatus !== 'REFUNDED_TO_BUYER' && ord.backendStatus !== 'CANCELLED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackingOrder(ord);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                >
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{lang === 'vi' ? 'Theo Dõi Lalamove' : 'Lalamove Tracking'}</span>
                </button>
              )}

              {/* Inspection Certificate Button for Buyer (ONLY when inspection passed and already decided/completed) */}
              {hasInspection && (ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.escrowStatus === 'SHIPPED_TO_BUYER' || ord.escrowStatus === 'COMPLETED_RELEASED') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCertificateModalOrder(ord);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                  title="Xem Giấy Chứng Nhận & Biên Bản Nghiệm Thu Kỹ Thuật Số"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>{lang === 'vi' ? 'Xem Chứng Nhận Kiểm Định' : 'Inspection Certificate'}</span>
                </button>
              )}

              {/* Buyer: Người bán đề xuất lại phương án kiểm định */}
              {hasInspection && String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ((ord as any)?.status !== 'AWAITING_INSPECTION' ? (ord as any)?.status : '') || '').toUpperCase() === 'WAITING_BUYER_APPROVAL' && onOpenChat && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat(ord.listing);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                  title={lang === 'vi' ? 'Vào phòng chat để xem và phản hồi đề xuất mới của người bán' : 'Open chat to review seller counter-proposal'}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                  <span>{lang === 'vi' ? 'Vào Chat Xem Đề Xuất Mới' : 'Review Proposal in Chat'}</span>
                </button>
              )}

              {/* Inspection Appointment Action for Seller */}
              {hasInspection && orderIsSeller && (ord.inspectionMethod === 'AT_HOME' || (ord as any).orderType === 'AT_HOME') && isCounteredAppointment && (
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleSellerAcceptCounterAppointment(ord.id, savedAppointment)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    title={lang === 'vi' ? 'Đồng ý với lịch hẹn đề xuất mới từ Trung tâm kiểm định' : 'Accept proposed appointment time'}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{lang === 'vi' ? 'Đồng Ý Lịch Mới' : 'Accept New Time'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSchedulingOrder(ord);
                      setSchedulingReadOnly(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    title={lang === 'vi' ? 'Chọn lại khung giờ hoặc ngày khác gửi lại cho Hub' : 'Reschedule to another time'}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'vi' ? 'Hẹn Lại Lịch Khác' : 'Reschedule'}</span>
                  </button>
                </div>
              )}

              {/* Buyer Bank Transfer Escrow Deposit (CHỈ HIỆN KHI ĐƠN HÀNG CHƯA THANH TOÁN TIỀN HÀNG ESCROW BAN ĐẦU) */}
              {!orderIsSeller && isOrderUnpaid(ord) && !['WAITING_FEE_PAYMENT'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ord.status || '').toUpperCase()) && ord.inspectionFeeSplit !== 'SELLER_100' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBankPaymentModal(ord);
                    }}
                    disabled={loadingBankPaymentId === ord.id}
                    className="px-3 py-1.5 rounded-xl bg-[#24263e] hover:bg-[#1a1c2e] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    title="Quét mã VietQR để nạp tiền ký quỹ Escrow đóng băng bảo vệ đơn hàng"
                  >
                    {loadingBankPaymentId === ord.id ? (
                      <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{lang === 'vi' ? 'Quét Mã VietQR Ký Quỹ' : 'VietQR Escrow Deposit'}</span>
                  </button>
                </div>
              )}

              {/* GIAI ĐOẠN NỘP PHÍ KIỂM ĐỊNH (WAITING_FEE_PAYMENT) CHO BUYER (Chỉ hiện khi Người Mua có nghĩa vụ đóng phí > 0) */}
              {!orderIsSeller && ['WAITING_FEE_PAYMENT'].includes(String((ord as any)?.backendStatus || (ord as any)?.inspectionStatus || (ord as any)?.inspectionOrder?.status || ord.status || '').toUpperCase()) && (
                (() => {
                  const buyerFee = getPartyInspectionFee(ord, false);
                  if (buyerFee <= 0 || ord.inspectionFeeSplit === 'SELLER_100') return null;
                  if (isPartyInspectionFeePaid(ord, false)) return null;
                  const isFeeExpired = isInspectionPaymentExpired(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline);
                  return (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isFeeExpired) {
                            dialogService.error(
                              lang === 'vi'
                                ? `Đơn hàng đã quá hạn nộp phí kiểm định (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)}). Vui lòng tải lại đơn hàng.`
                                : `Inspection fee payment deadline has expired (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)}).`,
                              'Đã Hết Hạn'
                            );
                            onRefreshOrders?.();
                            return;
                          }
                          handlePayInspectionFee(ord.id);
                        }}
                        disabled={orderActionLoading === ord.id || isFeeExpired}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 ${isFeeExpired
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                          : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white cursor-pointer'
                          }`}
                        title={isFeeExpired
                          ? (lang === 'vi' ? `Đã quá hạn đóng phí kiểm định (${formatInspectionDeadline(ord.paymentDeadline || (ord as any)?.inspectionOrder?.paymentDeadline, lang)})` : 'Fee payment deadline expired')
                          : (lang === 'vi' ? `Nộp phí kiểm định (${formatVND(buyerFee)}) từ Ví SecondLife` : 'Pay inspection fee from wallet')}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>
                          {orderActionLoading === ord.id
                            ? (lang === 'vi' ? 'Đang nộp...' : 'Processing...')
                            : isFeeExpired
                              ? (lang === 'vi' ? 'Đã Hết Hạn Đóng Phí' : 'Fee Payment Expired')
                              : (lang === 'vi' ? `Nộp Phí Kiểm Định (${formatVND(buyerFee)})` : `Pay Fee (${formatVND(buyerFee)})`)}
                        </span>
                      </button>
                    </div>
                  );
                })()
              )}

              {/* Nút Đã Nhận Hàng (Giải Ngân): Chỉ hiện khi đơn đã thực sự giao thành công đến Người mua và chưa xác nhận */}
              {!buyerInspectionStage && !isOrderReceiptConfirmed(ord) && isOrderDeliveredToBuyer(ord) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmingReceiptIds.has(ord.id) || isOrderReceiptConfirmed(ord)) return;
                    setConfirmDialog({
                      isOpen: true,
                      title: lang === 'vi' ? 'Xác Nhận Đã Nhận Hàng' : 'Confirm Delivery Receipt',
                      message: lang === 'vi'
                        ? 'Xác nhận bạn đã nhận hàng đầy đủ và nghiệm thu sản phẩm?'
                        : 'Confirm you have received and inspected the item?',
                      subMessage: lang === 'vi'
                        ? 'Tiền ký quỹ trong Escrow sẽ được giải ngân an toàn cho người bán. Hành động này không thể hoàn tác.'
                        : 'Escrow funds will be released to the seller immediately.',
                      confirmText: lang === 'vi' ? 'Đã Nhận Hàng' : 'Confirm Receipt',
                      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
                      variant: 'success',
                      iconType: 'check',
                      onConfirm: () => {
                        setConfirmingReceiptIds((prev) => new Set(prev).add(ord.id));
                        try {
                          if (typeof window !== 'undefined') {
                            localStorage.setItem(`order_receipt_confirmed_${ord.id}`, 'true');
                          }
                        } catch { }
                        onConfirmReceipt(ord.id);
                        setConfirmDialog(null);
                      }
                    });
                  }}
                  disabled={confirmingReceiptIds.has(ord.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse whitespace-nowrap shrink-0"
                  title="Xác nhận đã nhận máy an toàn"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{confirmingReceiptIds.has(ord.id) ? (lang === 'vi' ? 'Đang xử lý...' : 'Processing...') : (lang === 'vi' ? 'Đã Nhận Hàng' : 'Confirm Delivery')}</span>
                </button>
              ) : !buyerInspectionStage && !isOrderReceiptConfirmed(ord) && !isAtHome && isOrderInTransitToBuyer(ord) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackingOrder(ord);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Bưu tá đang giao hàng, bạn có thể kiểm tra định vị bưu kiện"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>{lang === 'vi' ? 'Kiểm Tra Giao Hàng' : 'In Transit'}</span>
                </button>
              ) : null}

              {/* Leave Product Review button for delivered / completed orders */}
              {!buyerInspectionStage && (isOrderReceiptConfirmed(ord) || ord.escrowStatus === 'COMPLETED_RELEASED' || ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' || ord.backendStatus === 'DELIVERED') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewModalOrder(ord);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 ${reviewedOrderIds.includes(ord.id)
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white'
                    }`}
                  title="Đánh giá chất lượng sản phẩm & mức độ uy tín người bán"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {reviewedOrderIds.includes(ord.id)
                      ? (lang === 'vi' ? 'Xem / Sửa Đánh Giá' : 'Edit Review')
                      : (lang === 'vi' ? 'Đánh Giá Sản Phẩm' : 'Write Review')}
                  </span>
                </button>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
