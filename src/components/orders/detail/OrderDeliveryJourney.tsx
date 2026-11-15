import { AlertCircle, Calendar, CalendarSync, Check, ChevronDown, Clock, Package, ShieldCheck, Truck } from 'lucide-react';
import { AtHomeIntakeBarcode } from '../../inspection/AtHomeIntakeBarcode';
import type { Dispatch, SetStateAction } from 'react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import { InspectionCashShipmentStatus } from '../../inspection/InspectionCashShipmentStatus';
import type { InspectionOrderDto } from '../../../services/inspectorService';
import { LalamoveProgress } from '../../common/LalamoveProgress';
import { getOrderAppointmentRejection } from '../../../utils/orders/orderAppointments';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { getHubReturnProgress, getInboundShipmentProgress } from '../../../utils/inspectionCenterData';
import { getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
import { getOrderAllShipments } from '../../../utils/orders/shipmentCache';
import { resolveInspectionCenter } from '../../../utils/orderUtils';
import { translations } from '../../../utils/translations';

interface Props {
  order: EscrowOrder;
  detailShipments: ShipmentBackend[];
  isOrderSellerConfirmed: OrderCheck;
  lang: Language;
  isOrderCancelledOrRefunded: OrderCheck;
  isOrderSeller: (order: EscrowOrder) => boolean;
  setInspectionActionNotice: (message: string | null) => void;
  setCreateShipmentOrder: (order: EscrowOrder) => void;
  detailInboundShipment: ShipmentBackend | null;
  getOrderInboundShipment: (order?: EscrowOrder | null) => ShipmentBackend | null;
  detailInspectionDto: InspectionOrderDto | null;
  getOrderAppointment: (order: EscrowOrder) => OrderAppointment | null;
  isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
  handleSellerAcceptCounterAppointment: (orderId: string, appointment: OrderAppointment) => Promise<void>;
  setSchedulingOrder: (order: EscrowOrder) => void;
  setSchedulingReadOnly: (readOnly: boolean) => void;
  detailInboundLabel: string | null;
  setTrackingShipmentId: (shipmentId?: string) => void;
  setTrackingOrder: (order: EscrowOrder) => void;
  setExpandedDetailLeg1: Dispatch<SetStateAction<boolean>>;
  expandedDetailLeg1: boolean;
  setExpandedDetailLeg2: Dispatch<SetStateAction<boolean>>;
  expandedDetailLeg2: boolean;
}

export function OrderDeliveryJourney({
  order: detailModalOrder,
  detailShipments,
  isOrderSellerConfirmed,
  lang,
  isOrderCancelledOrRefunded,
  isOrderSeller,
  setInspectionActionNotice,
  setCreateShipmentOrder,
  detailInboundShipment,
  getOrderInboundShipment,
  detailInspectionDto,
  getOrderAppointment,
  isInspectorArrivedForOrder,
  handleSellerAcceptCounterAppointment,
  setSchedulingOrder,
  setSchedulingReadOnly,
  detailInboundLabel,
  setTrackingShipmentId,
  setTrackingOrder,
  setExpandedDetailLeg1,
  expandedDetailLeg1,
  setExpandedDetailLeg2,
  expandedDetailLeg2,
}: Props) {
  const t = translations[lang];
  return (
    <>
      {/* Shipping & Delivery Route Visualizer */}
      {(() => {
        const isAtHome = Boolean(
          detailModalOrder.inspectionMethod === 'AT_HOME' ||
          (detailModalOrder as any).orderType === 'AT_HOME'
        );
        const isHub = Boolean(
          (detailModalOrder.hasInspectionService ||
            (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
            detailModalOrder.inspectionCenterId) &&
          !isAtHome
        );

        if (!isHub && !isAtHome) {
          // TRƯỜNG HỢP 1: GIAO THẲNG TRỰC TIẾP (1 CHẶNG: SELLER -> BUYER)
          return (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Hành trình giao hàng trực tiếp (Người bán → Người mua)</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  1 Chặng Giao Thẳng
                </span>
              </div>

              <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 rounded-md">
                    Giao Thẳng Trực Tiếp
                  </span>
                  <span className="text-xs font-mono font-bold text-[#24263e]">
                    {detailShipments[0]?.orderCode ? (
                      `Lalamove #${detailShipments[0].orderCode}`
                    ) : (
                      <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isOrderSellerConfirmed(detailModalOrder)
                        ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>
                        {isOrderSellerConfirmed(detailModalOrder)
                          ? (lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch')
                          : (lang === 'vi' ? 'Chưa tạo vận đơn Lalamove' : 'Pending courier')}
                      </span>
                    )}
                  </span>
                </div>

                <div className="text-xs text-[#24263e]/70 space-y-1.5 pt-1">
                  <div>Từ (Kho người bán): <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.origin || detailModalOrder.listing?.location || 'Địa chỉ kho người bán'}</span></div>
                  <div>Đến (Địa chỉ nhận hàng): <span className="font-semibold text-[#24263e]">{detailModalOrder.shippingLegs[0]?.destination || detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span></div>
                </div>

                <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/80 flex items-center justify-between">
                  <span>
                    {detailShipments[0]?.status === 'COMPLETED' || detailModalOrder.backendStatus === 'DELIVERED'
                      ? 'Đã giao hàng thành công đến người mua'
                      : detailShipments[0]?.status === 'IN_TRANSIT' || detailModalOrder.backendStatus === 'SHIPPED'
                        ? 'Tài xế Lalamove đang trên đường giao hàng'
                        : detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đang chờ người bán đóng gói và điều phối bưu tá'}
                  </span>
                  {!isOrderCancelledOrRefunded(detailModalOrder) && isOrderSeller(detailModalOrder) && !detailShipments.some((s) => s.status !== 'CANCELLED') && (
                    <button
                      onClick={() => {
                        if (detailModalOrder.escrowStatus === 'AWAITING_PAYMENT') {
                          setInspectionActionNotice(
                            lang === 'vi'
                              ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                              : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                          );
                          setTimeout(() => setInspectionActionNotice(null), 5000);
                          return;
                        }
                        setCreateShipmentOrder(detailModalOrder);
                      }}
                      className="text-[11px] text-orange-600 hover:text-orange-700 font-bold underline cursor-pointer ml-2"
                    >
                      Tạo vận đơn ngay
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // CHUẨN HÓA DỮ LIỆU VẬN ĐƠN, ĐỊA CHỈ & KẾT QUẢ KIỂM ĐỊNH (ÁP DỤNG CHUNG CHO CẢ TẬN NHÀ VÀ QUA HUB)
        const allModalShipments = detailShipments.length > 0
          ? detailShipments
          : getOrderAllShipments(detailModalOrder.id);
        const modalInboundShipment =
          allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER' && s.status !== 'CANCELLED') ||
          allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER') ||
          detailInboundShipment ||
          getOrderInboundShipment(detailModalOrder);

        const modalLocalInsp = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${detailModalOrder.id}`) : null;
        const isModalInspFailed = detailModalOrder.escrowStatus === 'INSPECTION_FAILED' || (detailModalOrder as any).backendStatus === 'FAILED' || (detailModalOrder as any).status === 'FAILED' || detailModalOrder.inspectionReport?.status === 'FAILED' || modalLocalInsp === 'FAILED' || (detailModalOrder as any).inspectionStatus === 'FAILED';
        const isModalInspPassed = detailModalOrder.escrowStatus === 'INSPECTION_PASSED' || (detailModalOrder as any).backendStatus === 'PASSED' || (detailModalOrder as any).status === 'PASSED' || detailModalOrder.inspectionReport?.status === 'PASSED' || modalLocalInsp === 'PASSED' || (detailModalOrder as any).inspectionStatus === 'PASSED';
        const modalDecision = getInspectionPurchaseDecision(detailModalOrder) || ((detailInspectionDto as any)?.buyerDecision ? String((detailInspectionDto as any).buyerDecision).toLowerCase() : null);
        const isModalPendingDecision = isModalInspPassed && modalDecision !== 'accepted' && modalDecision !== 'rejected';
        const isModalAccepted = isModalInspPassed && modalDecision === 'accepted';
        const isModalRejected = modalDecision === 'rejected';

        const modalReturnShipment =
          allModalShipments.find((s) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') ||
          allModalShipments.find((s) => s.leg === 'CENTER_TO_SELLER');

        const modalBuyerShipment =
          allModalShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') ||
          allModalShipments.find((s) => s.leg === 'CENTER_TO_BUYER');

        const modalLeg2Shipment = (isModalInspFailed || isModalRejected) ? modalReturnShipment : modalBuyerShipment;

        const centerData = resolveInspectionCenter({
          ...detailModalOrder,
          inspectionCenterId: detailInspectionDto?.inspectionCenterId || detailModalOrder.inspectionCenterId,
          inspectionCenterName: (detailInspectionDto as any)?.inspectionCenterName || detailModalOrder.inspectionCenterName,
          inspectionCenterAddress: (detailInspectionDto as any)?.inspectionCenterAddress || detailModalOrder.inspectionCenterAddress,
        });

        const realSellerAddress =
          modalInboundShipment?.senderAddress ||
          ((isModalInspFailed || isModalRejected) && modalReturnShipment?.receiverAddress) ||
          detailInspectionDto?.sellerAddress ||
          (detailModalOrder as any).sellerAddress ||
          (detailModalOrder as any).sellerLocation ||
          detailModalOrder.listing?.sellerAddress ||
          (detailModalOrder.listing?.location && detailModalOrder.listing.location !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.listing.location : null) ||
          (detailModalOrder.shippingLegs[0]?.origin && detailModalOrder.shippingLegs[0].origin !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.shippingLegs[0].origin : null) ||
          'Kho người bán (Đang cập nhật địa chỉ)';

        const realHubAddress =
          modalInboundShipment?.receiverAddress ||
          modalLeg2Shipment?.senderAddress ||
          (detailInspectionDto as any)?.inspectionCenterAddress ||
          detailModalOrder.inspectionCenterAddress ||
          centerData.address ||
          'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh';

        const realBuyerAddress =
          (!isModalInspFailed && !isModalRejected && modalBuyerShipment?.receiverAddress) ||
          detailInspectionDto?.address ||
          (detailInspectionDto as any)?.buyerAddress ||
          detailModalOrder.buyerAddress ||
          (detailModalOrder as any).deliveryAddress ||
          (detailModalOrder.shippingLegs[1]?.destination && detailModalOrder.shippingLegs[1].destination !== 'Đà Nẵng, Việt Nam' ? detailModalOrder.shippingLegs[1].destination : null) ||
          'Địa chỉ nhận hàng của người mua';

        const modalInspStatus = String(
          (detailModalOrder as any)?.backendStatus ||
          (detailModalOrder as any)?.inspectionStatus ||
          (detailModalOrder as any)?.inspectionOrder?.status ||
          ((detailModalOrder as any)?.status !== 'AWAITING_INSPECTION' && (detailModalOrder as any)?.status !== 'AWAITING_PAYMENT' && (detailModalOrder as any)?.status !== 'HELD_IN_ESCROW' ? (detailModalOrder as any)?.status : '') ||
          ''
        ).toUpperCase();

        const isModalWaitingBuyerApproval = modalInspStatus === 'WAITING_BUYER_APPROVAL';
        const isModalWaitingSellerApproval = modalInspStatus === 'WAITING_SELLER_APPROVAL';
        const isModalWaitingFeePayment = modalInspStatus === 'WAITING_FEE_PAYMENT';
        const modalSavedAppointment = getOrderAppointment(detailModalOrder);
        const modalAppointmentScheduledAt = modalSavedAppointment?.scheduledAt || detailModalOrder.appointmentScheduledAt || (detailInspectionDto as any)?.appointmentScheduledAt;

        if (isAtHome) {
          // TRƯỜNG HỢP 2: KIỂM ĐỊNH TẠI NHÀ & GIAO HÀNG (ON-SITE VERIFY)
          return (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>Quy trình Kiểm định tại nhà & Giao hàng (On-Site Verify)</span>
                </div>
                <span className="text-[10px] font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                  Kiểm Định Tận Nhà
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                {/* Bước 1: Kỹ thuật viên kiểm tra tận nơi */}
                <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspPassed
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : isModalInspFailed
                    ? 'bg-rose-50/80 border-rose-200'
                    : 'bg-slate-50/80 border-slate-200'
                  }`}>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspPassed
                        ? 'bg-emerald-700'
                        : isModalInspFailed
                          ? 'bg-rose-700'
                          : 'bg-amber-600'
                        }`}>
                        <Calendar className="w-3 h-3" />
                        <span>Bước 1: Kiểm Định Tận Nhà</span>
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {isModalInspPassed ? (
                          <span className="text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                            ✓ Đã Đạt Chuẩn
                          </span>
                        ) : isModalInspFailed ? (
                          <span className="text-rose-700 font-bold bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300">
                            ✕ Không Đạt Chuẩn
                          </span>
                        ) : isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder) ? (
                          <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 animate-pulse">
                            KTV Đang Kiểm Tra
                          </span>
                        ) : (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' || modalSavedAppointment?.counterScheduledAt) ? (
                          <span className="text-amber-900 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                            Đang Thương Lượng Lịch Hẹn
                          </span>
                        ) : (modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION') ? (
                          <span className="text-blue-800 font-bold bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300">
                            Chờ Trung Tâm Duyệt Lịch
                          </span>
                        ) : modalAppointmentScheduledAt ? (
                          <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                            {(() => {
                              const modalAssignedInspector = (() => {
                                try {
                                  const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                                  if (raw) return JSON.parse(raw);
                                } catch { }
                                return null;
                              })();
                              const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;
                              return effectiveInspectorName ? 'Đã Phân Công KTV' : 'Đã Chốt Lịch • Chờ Giao KTV';
                            })()}
                          </span>
                        ) : isModalWaitingBuyerApproval ? (
                          <span className="text-purple-800 font-bold bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300">
                            Chờ Duyệt Đề Xuất
                          </span>
                        ) : isModalWaitingSellerApproval ? (
                          <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                            Chờ Người Bán Duyệt
                          </span>
                        ) : isModalWaitingFeePayment ? (
                          <span className="text-orange-800 font-bold bg-orange-100/90 px-2 py-0.5 rounded border border-orange-300">
                            Chờ Đóng Phí
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Chờ Người Bán Hẹn Lịch
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                      {(() => {
                        const detailRej = getOrderAppointmentRejection(detailModalOrder);
                        if (detailRej && !modalAppointmentScheduledAt) {
                          return (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                              <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Lịch hẹn bị Trung tâm từ chối</span>
                              </div>
                              <p className="text-[11px] leading-relaxed bg-white/90 p-1.5 rounded border border-rose-200">
                                <strong>Lý do:</strong> "{detailRej.reason}"
                              </p>
                              <p className="text-[10px] text-rose-700">
                                Vui lòng đặt lại lịch hẹn khác phù hợp hơn.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {(() => {
                        const detailAppt = getOrderAppointment(detailModalOrder);
                        const isDetailCountered = Boolean(
                          detailAppt?.status === 'COUNTERED_BY_CENTER' ||
                          detailAppt?.counterScheduledAt ||
                          (detailModalOrder as any).counterScheduledAt ||
                          (detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' ||
                          (detailModalOrder as any).status === 'WAITING_SELLER_APPROVAL' ||
                          String((detailModalOrder as any).backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL'
                        );
                        if (isDetailCountered) {
                          const detailCounterTime =
                            detailAppt?.counterScheduledAt ||
                            detailAppt?.scheduledAt ||
                            (detailModalOrder as any).counterScheduledAt ||
                            detailModalOrder.appointmentScheduledAt;
                          const detailCounterShift =
                            detailAppt?.counterShift ||
                            (detailModalOrder as any).counterShift;
                          const detailCounterNote =
                            detailAppt?.counterNote ||
                            (detailModalOrder as any).counterNote;
                          const validDate = detailCounterTime ? new Date(detailCounterTime) : null;
                          const hasValidDate = Boolean(validDate && !isNaN(validDate.getTime()));
                          const detailPayload = detailAppt || {
                            scheduledAt: detailCounterTime,
                            counterScheduledAt: detailCounterTime,
                            counterShift: detailCounterShift,
                            counterNote: detailCounterNote,
                            status: 'COUNTERED_BY_CENTER',
                          };

                          return (
                            <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-xs text-amber-950 space-y-2">
                              <div className="flex items-center gap-1.5 text-amber-900 font-extrabold">
                                <CalendarSync className="w-4 h-4 text-orange-600 animate-pulse" />
                                <span>Trung tâm đề xuất lịch hẹn mới:</span>
                              </div>
                              <div className="bg-white/90 p-2 rounded-lg border border-amber-200 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-amber-900">📅 Giờ mới:</span>
                                  <span className="font-extrabold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {hasValidDate && validDate
                                      ? validDate.toLocaleString('vi-VN')
                                      : 'Theo đề xuất của Trung tâm'}
                                    {detailCounterShift ? ` (${detailCounterShift === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều'})` : ''}
                                  </span>
                                </div>
                                {detailCounterNote && (
                                  <div className="text-[11px] text-amber-900 italic">
                                    💬 Lý do: "{detailCounterNote}"
                                  </div>
                                )}
                              </div>
                              {isOrderSeller(detailModalOrder) ? (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSellerAcceptCounterAppointment(detailModalOrder.id, detailPayload)}
                                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Đồng Ý Lịch Này</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSchedulingOrder(detailModalOrder);
                                      setSchedulingReadOnly(false);
                                    }}
                                    className="py-1.5 px-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>Hẹn Lại</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="text-[11px] text-amber-800 bg-amber-100/60 p-1.5 rounded-md font-medium text-center">
                                  Đang chờ Người bán xem xét và phản hồi đề xuất dời lịch này.
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold shrink-0">Địa điểm:</span>
                        <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                      </div>
                      {(() => {
                        const modalAssignedInspector = (() => {
                          try {
                            const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                            if (raw) return JSON.parse(raw);
                          } catch { }
                          return null;
                        })();
                        const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;
                        return (
                          <>
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold shrink-0">Thực hiện:</span>
                              <span className="font-semibold text-slate-800">
                                {effectiveInspectorName ? `KTV ${effectiveInspectorName}` : 'Chờ trung tâm điều phối KTV'}
                              </span>
                            </div>
                            {/* Mã Vạch Tiếp Nhận & Mã Code trong Modal Chi Tiết */}
                            {isOrderSeller(detailModalOrder) ? (
                              modalAppointmentScheduledAt && effectiveInspectorName && !isModalInspPassed && !isModalInspFailed && (
                                <div className="pt-2">
                                  <AtHomeIntakeBarcode
                                    orderId={detailModalOrder.id}
                                    isArrived={isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)}
                                    lang={lang}
                                    compact={true}
                                    appointmentTime={modalAppointmentScheduledAt}
                                    inspectorName={effectiveInspectorName}
                                  />
                                </div>
                              )
                            ) : (
                              modalAppointmentScheduledAt && effectiveInspectorName && !isModalInspPassed && !isModalInspFailed && (
                                <div className="pt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-bold">Lịch hẹn KTV tận nơi đã được xác nhận</div>
                                    <div className="text-[11px] text-amber-800">
                                      Kỹ thuật viên <strong>{effectiveInspectorName}</strong> sẽ đến nhà người bán theo lịch hẹn để mở máy kiểm định 5 bước ISO.
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">
                      {(() => {
                        const modalAssignedInspector = (() => {
                          try {
                            const raw = localStorage.getItem(`order_assigned_inspector_${detailModalOrder.id}`);
                            if (raw) return JSON.parse(raw);
                          } catch { }
                          return null;
                        })();
                        const effectiveInspectorName = detailModalOrder.inspectorName || (detailInspectionDto as any)?.inspectorName || modalAssignedInspector?.inspectorName;

                        if (detailModalOrder.inspectionReport) {
                          return 'Đã hoàn tất kiểm tra on-site và dán tem niêm phong đạt chuẩn.';
                        }
                        if (isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)) {
                          return 'Kỹ thuật viên đã đến và đang kiểm tra thiết bị tại nhà người bán.';
                        }
                        if (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' || modalSavedAppointment?.counterScheduledAt || (detailModalOrder as any).status === 'WAITING_SELLER_APPROVAL') {
                          const cTime = modalSavedAppointment?.counterScheduledAt || modalSavedAppointment?.scheduledAt || (detailModalOrder as any).counterScheduledAt || detailModalOrder.appointmentScheduledAt;
                          const cDate = cTime ? new Date(cTime) : null;
                          const formatted = cDate && !isNaN(cDate.getTime()) ? cDate.toLocaleString('vi-VN') : 'lịch mới';
                          return `Trung tâm đề xuất dời lịch sang ${formatted}. Đang chờ Người bán phản hồi thống nhất lịch mới.`;
                        }
                        if (modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION') {
                          return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. Đang chờ Trung tâm kiểm định xem và phê duyệt.`;
                        }
                        if (modalAppointmentScheduledAt) {
                          return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. ${effectiveInspectorName ? `KTV ${effectiveInspectorName} sẽ đến kiểm tra máy. Xuất trình mã tiếp nhận cho KTV khi đến.` : 'Trung tâm SecondLife đang xử lý và phân công KTV theo ca.'}`;
                        }
                        if (isModalWaitingBuyerApproval) {
                          return 'Người bán đã đề xuất lại phương án chia phí kiểm định. Chờ người mua duyệt trong phòng chat.';
                        }
                        if (isModalWaitingSellerApproval) {
                          return 'Đã gửi yêu cầu kiểm định tại nhà. Chờ người bán duyệt trong phòng chat.';
                        }
                        if (isModalWaitingFeePayment) {
                          return 'Hai bên đã thống nhất phương án. Chờ đóng phí kiểm định để KTV đến kiểm tra.';
                        }
                        return 'Chờ người bán hẹn lịch đón KTV trong khung giờ hành chính (8h-12h, 13h-17h).';
                      })()}
                    </span>
                  </div>
                </div>

                {/* Bước 2: Bưu tá Lalamove giao thẳng tới người mua */}
                <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspFailed || isModalRejected
                  ? 'bg-rose-50/80 border-rose-200'
                  : isModalPendingDecision
                    ? 'bg-amber-50/80 border-amber-200'
                    : isModalInspPassed
                      ? 'bg-emerald-50/80 border-emerald-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspFailed || isModalRejected
                        ? 'bg-rose-700'
                        : isModalPendingDecision
                          ? 'bg-amber-600'
                          : isModalInspPassed
                            ? 'bg-emerald-700'
                            : 'bg-emerald-700'
                        }`}>
                        <Truck className="w-3 h-3" />
                        <span>Bước 2: Giao Hàng Người Mua</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-[#24263e]">
                        {detailShipments[0]?.orderCode ? (
                          <span className="text-emerald-700 font-bold">Lalamove #{detailShipments[0].orderCode}</span>
                        ) : isModalInspFailed || isModalRejected ? (
                          <span className="text-[11px] font-sans font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            Không giao hàng
                          </span>
                        ) : isModalInspPassed ? (
                          <span className="text-[11px] font-sans font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            Sẵn sàng giao hàng
                          </span>
                        ) : (
                          <span className="text-[11px] font-sans font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Kích hoạt sau khi ĐẠT
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                        <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold shrink-0">Giao đến:</span>
                        <span className="font-semibold text-slate-800 break-words">{realBuyerAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">
                      {isModalInspFailed
                        ? 'Sản phẩm không đạt chuẩn kiểm định. Đơn hàng dừng lại tại nhà người bán, không phát hàng cho người mua.'
                        : isModalRejected
                          ? 'Người mua từ chối mua sản phẩm sau khi kiểm định. Đơn hàng kết thúc.'
                          : isModalPendingDecision
                            ? 'KTV đã kiểm định ĐẠT chuẩn. Đang chờ người mua xác nhận mua hàng trước khi điều phối bưu tá.'
                            : isModalInspPassed
                              ? 'Sản phẩm kiểm định ĐẠT chuẩn. Tài xế Lalamove sẽ nhận hàng từ người bán và phát thẳng đến người mua.'
                              : 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong tem.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // TRƯỜNG HỢP 3: KIỂM ĐỊNH QUA HUB (VERIFY THEN SHIP - 2 CHẶNG THỰC SỰ)
        return (
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
              </div>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Kiểm Định Hub Lab
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
              {/* Chặng 1: Người bán gửi tới Trung tâm Hub */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between h-full shadow-2xs space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-white bg-blue-700 px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      <span>{t.leg1}</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-[#24263e]">
                      {modalInboundShipment?.orderCode ? (
                        <span className="text-blue-700 font-bold">Lalamove #{modalInboundShipment.orderCode}</span>
                      ) : (
                        <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isOrderSellerConfirmed(detailModalOrder)
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>
                          {detailInboundLabel || (isOrderSellerConfirmed(detailModalOrder)
                            ? (lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch')
                            : (lang === 'vi' ? 'Chưa tạo vận đơn Lalamove' : 'Pending courier'))}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                      <span className="font-semibold text-slate-800 break-words">{realSellerAddress}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold shrink-0">Đến:</span>
                      <span className="font-semibold text-slate-800 break-words">{realHubAddress}</span>
                    </div>
                  </div>

                  {/* Action buttons & Tracking for Chặng 1 */}
                  {modalInboundShipment && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <InspectionCashShipmentStatus shipment={modalInboundShipment} />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {(() => {
                          const prog = getInboundShipmentProgress(modalInboundShipment, lang);
                          return (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {prog.label}
                            </span>
                          );
                        })()}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setTrackingShipmentId(modalInboundShipment.shipmentId);
                              setTrackingOrder(detailModalOrder);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-xs text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Chi tiết vận đơn</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="break-words leading-relaxed">
                    {detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || (lang === 'vi' ? 'Khởi tạo đơn hàng kiểm định Hub. Chờ bưu tá Lalamove chuyển kiện hàng về Hub.' : 'Hub inspection shipment created. Awaiting Lalamove pickup.')}
                  </span>
                </div>
              </div>

              {/* Chặng 2: Trung tâm Hub gửi Người mua HOẶC Hoàn trả người bán */}
              <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspFailed || isModalRejected
                ? 'bg-rose-50/80 border-rose-200'
                : isModalPendingDecision
                  ? 'bg-amber-50/80 border-amber-200'
                  : isModalInspPassed
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : 'bg-slate-50/80 border-slate-200'
                }`}>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspFailed || isModalRejected
                      ? 'bg-rose-700'
                      : isModalPendingDecision
                        ? 'bg-amber-600'
                        : isModalInspPassed
                          ? 'bg-emerald-700'
                          : 'bg-indigo-700'
                      }`}>
                      <Truck className="w-3 h-3" />
                      <span>
                        {isModalInspFailed
                          ? 'Chặng 2: Hoàn Trả Người Bán'
                          : isModalRejected
                            ? 'Chặng 2: Hoàn Trả Người Bán (Khách từ chối)'
                            : isModalPendingDecision
                              ? 'Chặng 2: Hub Giao Người Mua'
                              : isModalInspPassed
                                ? 'Chặng 2: Hub Giao Người Mua (Đạt Chuẩn)'
                                : t.leg2}
                      </span>
                    </span>
                    <span className="text-xs font-mono font-bold text-[#24263e]">
                      {modalLeg2Shipment?.orderCode ? (
                        <span className={isModalInspFailed || isModalRejected ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                          Lalamove #{modalLeg2Shipment.orderCode}
                        </span>
                      ) : (
                        <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isModalInspFailed || isModalRejected
                          ? 'text-rose-700 bg-rose-100 border-rose-200'
                          : isModalPendingDecision
                            ? 'text-amber-800 bg-amber-100 border-amber-300 font-bold'
                            : isModalInspPassed
                              ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                          }`}>
                          {isModalInspFailed
                            ? 'Kích hoạt hoàn trả'
                            : isModalRejected
                              ? 'Người mua từ chối • Hoàn trả'
                              : isModalPendingDecision
                                ? 'Chờ người mua quyết định'
                                : isModalInspPassed
                                  ? 'Đang điều phối giao'
                                  : 'Chờ hoàn tất chặng 1 & kiểm định'}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold shrink-0">Từ:</span>
                      <span className="font-semibold text-slate-800 break-words">{realHubAddress}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold shrink-0">
                        {isModalInspFailed || isModalRejected ? 'Hoàn trả về:' : 'Giao đến:'}
                      </span>
                      <span className="font-semibold text-slate-800 break-words">
                        {isModalInspFailed || isModalRejected ? realSellerAddress : realBuyerAddress}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons & Tracking for Chặng 2 */}
                  {modalLeg2Shipment && (
                    <div className={`pt-2 border-t space-y-2 ${isModalInspFailed || isModalRejected ? 'border-rose-200' : 'border-emerald-200'}`}>
                      <InspectionCashShipmentStatus shipment={modalLeg2Shipment} />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {(() => {
                          const prog = (isModalInspFailed || isModalRejected)
                            ? getHubReturnProgress(modalLeg2Shipment, lang)
                            : getInboundShipmentProgress(modalLeg2Shipment, lang);
                          return (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${isModalInspFailed || isModalRejected
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}>
                              {prog.label}
                            </span>
                          );
                        })()}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setTrackingShipmentId(modalLeg2Shipment.shipmentId);
                              setTrackingOrder(detailModalOrder);
                            }}
                            className={`inline-flex items-center gap-1 font-bold text-xs hover:underline cursor-pointer ${isModalInspFailed || isModalRejected ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'
                              }`}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Chi tiết vận đơn</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedDetailLeg2((prev) => !prev)}
                            className={`inline-flex items-center gap-1 font-bold text-xs hover:underline cursor-pointer ${isModalInspFailed || isModalRejected ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'
                              }`}
                          >
                            <span>{expandedDetailLeg2 ? 'Ẩn tiến trình' : 'Xem tiến trình'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedDetailLeg2 ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                      {expandedDetailLeg2 && (
                        <div className={`pt-2 border-t ${isModalInspFailed || isModalRejected ? 'border-rose-100' : 'border-emerald-100'}`}>
                          <LalamoveProgress
                            title={(isModalInspFailed || isModalRejected)
                              ? "Tiến trình vận chuyển hoàn trả Lalamove (Hub → Người bán)"
                              : "Tiến trình vận chuyển giao hàng Lalamove (Hub → Khách mua)"}
                            routeBadge={(isModalInspFailed || isModalRejected) ? "Chặng Hoàn Trả: Hub ➔ Seller" : "Chặng Giao Hàng: Hub ➔ Buyer"}
                            currentStep={(isModalInspFailed || isModalRejected)
                              ? getHubReturnProgress(modalLeg2Shipment, lang).step
                              : getInboundShipmentProgress(modalLeg2Shipment, lang).step}
                            completeCurrentStep={modalLeg2Shipment.status === 'DELIVERED' || ((isModalInspFailed || isModalRejected) && getHubReturnProgress(modalLeg2Shipment, lang).step === 3)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="break-words leading-relaxed">
                    {isModalInspFailed
                      ? 'Kiểm định không đạt. Trung tâm xử lý chặng trả hàng về người bán.'
                      : isModalRejected
                        ? 'Người mua từ chối nhận hàng sau kiểm định. Trung tâm xử lý hoàn trả kiện hàng về người bán.'
                        : isModalPendingDecision
                          ? 'Đã kiểm định ĐẠT CHUẨN. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                          : isModalInspPassed
                            ? 'Đã kiểm định ĐẠT CHUẨN. Hub chuyển phát an toàn đến tận tay người mua.'
                            : (detailModalOrder.shippingLegs[1]?.timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description || 'Chờ hoàn tất kiểm định tại Hub và niêm phong giao đến người mua.')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
