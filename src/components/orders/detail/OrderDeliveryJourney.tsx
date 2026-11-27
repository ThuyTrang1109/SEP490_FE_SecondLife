import { AlertCircle, Calendar, CalendarSync, Check, ChevronDown, Clock, Package, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { AtHomeIntakeBarcode } from '../../inspection/AtHomeIntakeBarcode';
import { useState, type Dispatch, type SetStateAction } from 'react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import { InspectionCashShipmentStatus } from '../../inspection/InspectionCashShipmentStatus';
import type { InspectionOrderDto } from '../../../services/inspectorService';
import { getOrderAppointmentRejection } from '../../../utils/orders/orderAppointments';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { getBuyerDeliveryProgress, getHubReturnProgress, getInboundShipmentProgress, getLatestReturnShipment, getLatestBuyerDeliveryShipment } from '../../../utils/inspectionCenterData';
import { getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
import { getOrderAllShipments } from '../../../utils/orders/shipmentCache';
import { getDirectShipmentInterruptionLabel, getLatestDirectShipment } from '../../../utils/lalamoveTracking';
import { isOrderEscrowOnHold } from '../../../utils/orders/orderDispute';
import { getRebookableDirectShipment } from '../../../utils/orders/directShipment';
import { resolveInspectionCenter } from '../../../utils/orderUtils';
import { translations } from '../../../utils/translations';
import { getOrderSellerAddress, getOrderBuyerAddress } from '../../../pages/inspection-center/dispatch/orderContacts';
import { span } from 'motion/react-client';

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
          const isDirectCancelled = isOrderCancelledOrRefunded(detailModalOrder) ||
            detailModalOrder.status === 'CANCELLED' ||
            (detailModalOrder as any).backendStatus === 'CANCELLED' ||
            (detailModalOrder as any).escrowStatus === 'REFUNDED_TO_BUYER';

          const isDirectSellerConfirmed = isOrderSellerConfirmed(detailModalOrder);
          const latestDirectShip = getLatestDirectShipment(detailShipments);
          const rebookableShipment = getRebookableDirectShipment(detailModalOrder, detailShipments);
          const directOutboundShipment = isDirectSellerConfirmed ? latestDirectShip : null;
          const interruptionLabel = getDirectShipmentInterruptionLabel(directOutboundShipment, lang);

          const hasApprovedReturn = Boolean(
            (detailModalOrder as any).orderReturn &&
            ((detailModalOrder as any).orderReturn.reportId ||
              (detailModalOrder as any).escrowStatus === 'DISPUTED' || (detailModalOrder as any).backendEscrowStatus === 'FROZEN')
          );

          const directOrigin =
            (directOutboundShipment?.senderAddress && directOutboundShipment.senderAddress !== 'Địa chỉ kho người bán' ? directOutboundShipment.senderAddress : null) ||
            detailModalOrder.sellerAddress ||
            getOrderSellerAddress(detailModalOrder) ||
            detailModalOrder.shippingLegs?.[0]?.origin ||
            detailModalOrder.listing?.location ||
            'Địa chỉ kho người bán';

          const directDestination =
            (directOutboundShipment?.receiverAddress && directOutboundShipment.receiverAddress !== 'Địa chỉ người mua' ? directOutboundShipment.receiverAddress : null) ||
            detailModalOrder.buyerAddress ||
            getOrderBuyerAddress(detailModalOrder) ||
            detailModalOrder.shippingLegs?.[0]?.destination ||
            'Địa chỉ người mua';

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
                  {!isDirectCancelled && (
                    <span className="text-xs font-mono font-bold text-[#24263e]">
                      {interruptionLabel ? (
                        <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded border text-rose-700 bg-rose-50 border-rose-200">
                          {interruptionLabel}
                        </span>
                      ) : !isDirectSellerConfirmed ? (
                        <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded border text-amber-700 bg-amber-50 border-amber-200">
                          {lang === 'vi' ? 'Chờ người bán xác nhận đơn' : 'Awaiting confirmation'}
                        </span>
                      ) : !directOutboundShipment?.orderCode ? (
                        <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded border text-blue-700 bg-blue-50 border-blue-200">
                          {lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch'}
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>

                <div className="text-xs text-[#24263e]/70 space-y-1.5 pt-1">
                  <div>Từ (Kho người bán): <span className="font-semibold text-[#24263e]">{directOrigin}</span></div>
                  <div>Đến (Địa chỉ nhận hàng): <span className="font-semibold text-[#24263e]">{directDestination}</span></div>
                </div>

                <div className="pt-2 border-t border-gray-200 text-[11px] text-[#24263e]/80 flex items-center justify-between">
                  {!isDirectCancelled && !interruptionLabel ? (
                    <span>
                      {directOutboundShipment?.status === 'COMPLETED' || detailModalOrder.backendStatus === 'DELIVERED'
                        ? 'Đã giao hàng thành công đến người mua'
                        : directOutboundShipment?.status === 'IN_TRANSIT' || detailModalOrder.backendStatus === 'SHIPPED'
                          ? 'Tài xế Lalamove đang trên đường giao hàng'
                          : !isDirectSellerConfirmed
                            ? (lang === 'vi' ? 'Đang chờ người bán xác nhận đơn hàng trước khi tạo vận đơn' : 'Awaiting seller order confirmation')
                            : detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || ''}
                    </span>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-2">
                    {isDirectSellerConfirmed && !isDirectCancelled && Boolean(directOutboundShipment?.orderCode || directOutboundShipment?.shipmentId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrackingOrder(detailModalOrder);
                          setTrackingShipmentId(directOutboundShipment?.shipmentId);
                        }}
                        className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        {lang === 'vi' ? 'Xem hành trình Lalamove' : 'Track Lalamove'}
                      </button>
                    )}
                    {!isDirectCancelled && isDirectSellerConfirmed && isOrderSeller(detailModalOrder) &&
                      (rebookableShipment || (!latestDirectShip && !isOrderEscrowOnHold(detailModalOrder))) && (
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
                          {rebookableShipment
                            ? (lang === 'vi' ? 'Tạo lại vận đơn' : 'Rebook shipment')
                            : (lang === 'vi' ? 'Tạo vận đơn ngay' : 'Create shipment')}
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {/* Chặng hoàn hàng trực tiếp Người Mua -> Người Bán nếu có */}
              {(() => {
                if (!hasApprovedReturn) return null;
                const directReturnShipment = detailShipments.find((s) => s.leg === 'BUYER_TO_SELLER' || s.leg === 'CENTER_TO_SELLER') ||
                  getOrderAllShipments(detailModalOrder.id, (detailModalOrder as any).linkedOrderId).find((s) => s.leg === 'BUYER_TO_SELLER' || s.leg === 'CENTER_TO_SELLER') ||
                  (detailModalOrder as any).returnShipment;
                if (!directReturnShipment) return null;
                return (
                  <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-2xl p-4 border border-indigo-200 space-y-3 mt-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 shadow-2xs">
                        <RotateCcw className="w-3.5 h-3.5 text-white" />
                        Chặng Hoàn Trả (Người Mua ➔ Người Bán)
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-950">
                        {directReturnShipment.orderCode ? (
                          `Lalamove #${directReturnShipment.orderCode}`
                        ) : (
                          <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded border text-indigo-700 bg-indigo-50 border-indigo-200">
                            Đã tạo vận đơn hoàn hàng
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-indigo-950/80 space-y-1.5 pt-1">
                      <div>Từ (Người mua gửi trả): <span className="font-semibold text-indigo-950">{directReturnShipment.senderAddress || detailModalOrder.buyerAddress || 'Địa chỉ người mua'}</span></div>
                      <div>Đến (Kho nhận hàng người bán): <span className="font-semibold text-indigo-950">{directReturnShipment.receiverAddress || detailModalOrder.sellerAddress || 'Địa chỉ kho người bán'}</span></div>
                    </div>

                    <div className="pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-950/90 flex items-center justify-between">
                      {/* <span className="font-medium">
                        {directReturnShipment.status === 'DELIVERED'
                          ? 'Đã giao lại kiện hàng cho người bán thành công'
                          : directReturnShipment.status === 'IN_TRANSIT' || directReturnShipment.status === 'DELIVERING'
                            ? 'Tài xế Lalamove đang trên đường giao trả về người bán'
                            : directReturnShipment.status === 'PICKED_UP'
                              ? 'Tài xế đã nhận kiện hàng từ người mua'
                              : 'Đang điều phối tài xế Lalamove đến lấy hàng hoàn'}
                      </span> */}
                      <button
                        type="button"
                        onClick={() => {
                          setTrackingOrder(detailModalOrder);
                          setTrackingShipmentId(directReturnShipment.shipmentId);
                        }}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer ml-2 flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5 text-indigo-600" />
                        Xem hành trình Lalamove
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        }

        // CHUẨN HÓA DỮ LIỆU VẬN ĐƠN, ĐỊA CHỈ & KẾT QUẢ KIỂM ĐỊNH (ÁP DỤNG CHUNG CHO CẢ TẬN NHÀ VÀ QUA HUB)
        const allModalShipments = detailShipments.length > 0
          ? detailShipments
          : getOrderAllShipments(detailModalOrder.id, (detailModalOrder as any).linkedOrderId);
        const modalDirectShipment =
          allModalShipments.find((s) => (s.leg === 'SELLER_TO_BUYER' || s.leg === 'DELIVERY') && s.status !== 'CANCELLED') ||
          allModalShipments.find((s) => s.leg === 'SELLER_TO_BUYER' || s.leg === 'DELIVERY') ||
          detailShipments.find((s) => (s.leg === 'SELLER_TO_BUYER' || s.leg === 'DELIVERY') && s.status !== 'CANCELLED') ||
          detailShipments[0];
        const modalInboundShipment =
          allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER' && s.status !== 'CANCELLED') ||
          allModalShipments.find((s) => s.leg === 'SELLER_TO_CENTER') ||
          detailInboundShipment ||
          getOrderInboundShipment(detailModalOrder);

        const modalLocalInsp = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${detailModalOrder.id}`) : null;
        const modalDecision = getInspectionPurchaseDecision(detailModalOrder, detailInspectionDto) || ((detailInspectionDto as any)?.buyerDecision ? String((detailInspectionDto as any).buyerDecision).toLowerCase() : null) || (detailModalOrder as any)?.buyerDecision || (detailModalOrder as any)?.inspectionDecision;
        const isModalInspFailed = detailModalOrder.escrowStatus === 'INSPECTION_FAILED' || (detailModalOrder as any).backendStatus === 'FAILED' || (detailModalOrder as any).status === 'FAILED' || detailModalOrder.inspectionReport?.status === 'FAILED' || modalLocalInsp === 'FAILED' || (detailModalOrder as any).inspectionStatus === 'FAILED' || detailInspectionDto?.status === 'FAILED';
        const isModalInspPassed = detailModalOrder.escrowStatus === 'INSPECTION_PASSED' || (detailModalOrder as any).backendStatus === 'PASSED' || (detailModalOrder as any).status === 'PASSED' || detailModalOrder.inspectionReport?.status === 'PASSED' || modalLocalInsp === 'PASSED' || (detailModalOrder as any).inspectionStatus === 'PASSED' || detailInspectionDto?.status === 'PASSED' || modalDecision === 'accepted' || Boolean(detailModalOrder.finalPaymentPaidAt) || Boolean(detailInspectionDto?.finalPaymentPaidAt) || Boolean(detailModalOrder.linkedOrderId);
        const isModalAccepted = isModalInspPassed && (modalDecision === 'accepted' || Boolean(detailModalOrder.finalPaymentPaidAt) || Boolean(detailInspectionDto?.finalPaymentPaidAt) || Boolean(detailModalOrder.linkedOrderId));
        const isModalRejected = modalDecision === 'rejected';
        const isModalPendingDecision = isModalInspPassed && !isModalAccepted && !isModalRejected;

        const modalReturnShipment = getLatestReturnShipment(allModalShipments);

        const modalBuyerShipment = getLatestBuyerDeliveryShipment(allModalShipments);

        const modalLeg2Shipment = (isModalInspFailed || isModalRejected) ? modalReturnShipment : modalBuyerShipment;

        const centerData = resolveInspectionCenter({
          ...detailModalOrder,
          inspectionCenterId: detailInspectionDto?.inspectionCenterId || detailModalOrder.inspectionCenterId,
          inspectionCenterName: (detailInspectionDto as any)?.inspectionCenterName || detailModalOrder.inspectionCenterName,
          inspectionCenterAddress: (detailInspectionDto as any)?.inspectionCenterAddress || detailModalOrder.inspectionCenterAddress,
        });

        const isBadSellerAddr = (addr?: string | null) => {
          if (!addr || typeof addr !== 'string') return true;
          const l = addr.trim().toLowerCase();
          return (
            !l ||
            l.includes('đang cập nhật') ||
            l.includes('kho người bán') ||
            l.includes('địa chỉ kho') ||
            l.includes('địa chỉ người bán') ||
            l.includes('địa chỉ nhà') ||
            l === 'đà nẵng, việt nam' ||
            l.includes('123 nguyễn văn cừ') ||
            l.includes('ngã tư công lý') ||
            l.includes('hội đồng nhân dân') ||
            l.includes('123 đường cầu giấy') ||
            l.includes('số 123 đường cầu giấy')
          );
        };

        const resolvedOrderSellerAddress = getOrderSellerAddress(detailModalOrder);
        const isTrangSeller =
          detailModalOrder.sellerId === '2f271a3c-b77a-4bed-ad75-bc3a35535594' ||
          (detailInspectionDto as any)?.sellerId === '2f271a3c-b77a-4bed-ad75-bc3a35535594' ||
          String(detailModalOrder.sellerName || '').toLowerCase().includes('thùy trang') ||
          String(detailModalOrder.sellerName || '').toLowerCase().includes('thuy trang');

        const trangWarehouse = 'Student Station Coffee, Đường Quảng Trường Sáng Tạo, Phường Đông Hòa, Thành phố Dĩ An, BI 00084, Việt Nam';

        const pendingWarehouseAddress = lang === 'vi' ? 'Kho người bán (Đang cập nhật địa chỉ)' : 'Seller warehouse (address pending)';
        const realSellerAddress = isAtHome
          ? (!isBadSellerAddr(resolvedOrderSellerAddress) ? resolvedOrderSellerAddress : null) ||
          (!isBadSellerAddr(detailInspectionDto?.sellerAddress) ? detailInspectionDto?.sellerAddress : null) ||
          (!isBadSellerAddr(detailModalOrder.sellerAddress) ? detailModalOrder.sellerAddress : null) ||
          ((isModalInspFailed || isModalRejected) && !isBadSellerAddr(modalReturnShipment?.receiverAddress) ? modalReturnShipment?.receiverAddress : null) ||
          (!isBadSellerAddr((detailModalOrder as any).sellerLocation) ? (detailModalOrder as any).sellerLocation : null) ||
          (!isBadSellerAddr(detailModalOrder.listing?.sellerAddress) ? detailModalOrder.listing?.sellerAddress : null) ||
          (isTrangSeller ? trangWarehouse : pendingWarehouseAddress)
          : modalInboundShipment?.senderAddress?.trim() || detailInspectionDto?.sellerAddress?.trim() || pendingWarehouseAddress;

        const realHubAddress =
          modalInboundShipment?.receiverAddress ||
          modalLeg2Shipment?.senderAddress ||
          (detailInspectionDto as any)?.inspectionCenterAddress ||
          detailModalOrder.inspectionCenterAddress ||
          centerData.address ||
          'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh';

        const realBuyerAddress =
          detailInspectionDto?.buyerAddress ||
          detailInspectionDto?.address ||
          detailModalOrder.buyerAddress ||
          getOrderBuyerAddress(detailModalOrder) ||
          (!isModalInspFailed && !isModalRejected && modalBuyerShipment?.receiverAddress) ||
          (detailModalOrder as any).deliveryAddress ||
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
        const isPendingApprovalOrFeeInModal = isModalWaitingSellerApproval || isModalWaitingBuyerApproval || isModalWaitingFeePayment || !isOrderSellerConfirmed(detailModalOrder);
        const modalSavedAppointment = getOrderAppointment(detailModalOrder);
        const rawModalApptTime = (detailInspectionDto as any)?.appointmentScheduledAt || modalSavedAppointment?.scheduledAt || detailModalOrder.appointmentScheduledAt;
        const hasValidScheduledAppt = Boolean(
          rawModalApptTime &&
          rawModalApptTime !== 'null' &&
          rawModalApptTime !== 'undefined' &&
          !isNaN(new Date(rawModalApptTime).getTime())
        );
        const modalAppointmentScheduledAt = hasValidScheduledAppt ? rawModalApptTime : null;

        const isModalReceiptConfirmed = Boolean(
          (detailModalOrder as any).receiptConfirmedAt ||
          (typeof window !== 'undefined' && detailModalOrder.id && localStorage.getItem(`order_receipt_confirmed_${detailModalOrder.id}`) === 'true') ||
          ((detailModalOrder as any).linkedOrderId && typeof window !== 'undefined' && localStorage.getItem(`order_receipt_confirmed_${(detailModalOrder as any).linkedOrderId}`) === 'true')
        );

        const isModalCompletedOrReleased = Boolean(
          isModalReceiptConfirmed ||
          detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' ||
          (detailModalOrder.escrowStatus as any) === 'RELEASED' ||
          (detailModalOrder as any).backendStatus === 'COMPLETED' ||
          (detailModalOrder as any).backendStatus === 'RELEASED' ||
          detailModalOrder.status === 'COMPLETED'
        );

        const isModalCancelled = isOrderCancelledOrRefunded(detailModalOrder) ||
          detailModalOrder.status === 'CANCELLED' ||
          (detailModalOrder as any).backendStatus === 'CANCELLED' ||
          (detailModalOrder as any).escrowStatus === 'REFUNDED_TO_BUYER';

        if (isAtHome) {
          // TRƯỜNG HỢP 2: KIỂM ĐỊNH TẠI NHÀ & GIAO HÀNG (ON-SITE VERIFY)
          return (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>Quy trình Kiểm định tại nhà & Giao hàng</span>
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
                    : isModalCancelled
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspPassed
                        ? 'bg-emerald-700'
                        : isModalInspFailed
                          ? 'bg-rose-700'
                          : isModalCancelled
                            ? 'bg-rose-700'
                            : 'bg-amber-600'
                        }`}>
                        <Calendar className="w-3 h-3" />
                        <span>Bước 1: Kiểm Định Tận Nhà</span>
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {isModalCancelled && !isModalInspPassed && !isModalInspFailed ? (
                          <span className="text-rose-700 font-bold bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300">
                            Đã Hủy Kiểm Định
                          </span>
                        ) : isModalInspPassed ? (
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
                        ) : isModalWaitingBuyerApproval ? (
                          <span className="text-purple-800 font-bold bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300">
                            Chờ Duyệt Đề Xuất
                          </span>
                        ) : isModalWaitingSellerApproval ? (
                          <span className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                            {isOrderSeller(detailModalOrder) ? 'Chờ Bạn Xác Nhận' : 'Chờ Người Bán Duyệt'}
                          </span>
                        ) : isModalWaitingFeePayment ? (
                          <span className="text-orange-800 font-bold bg-orange-100/90 px-2 py-0.5 rounded border border-orange-300">
                            Chờ Đóng Phí
                          </span>
                        ) : (
                          modalSavedAppointment?.status !== 'PENDING_CENTER_CONFIRMATION' &&
                          (detailModalOrder as any).appointmentStatus !== 'PENDING_CENTER_CONFIRMATION' &&
                          (
                            (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' && Boolean(modalSavedAppointment?.counterScheduledAt)) ||
                            ((detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((detailModalOrder as any).counterScheduledAt))
                          )
                        ) ? (
                          <span className="text-amber-900 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                            {isOrderSeller(detailModalOrder) ? 'Hub Đề Xuất Lịch Mới' : (modalAppointmentScheduledAt ? 'Đang Chờ KTV' : (isOrderSeller(detailModalOrder) ? 'Chờ Bạn Hẹn Lịch' : 'Chờ Người Bán Hẹn Lịch'))}
                          </span>
                        ) : (Boolean(getOrderAppointmentRejection(detailModalOrder)) || (detailModalOrder as any).appointmentStatus === 'REJECTED' || modalSavedAppointment?.status === 'REJECTED') ? (
                          <span className="text-rose-800 font-bold bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300">
                            Lịch Hẹn Bị Từ Chối
                          </span>
                        ) : (modalSavedAppointment?.status === 'CONFIRMED' || (detailModalOrder as any).appointmentStatus === 'CONFIRMED') ? (
                          <span className="text-emerald-800 font-bold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
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
                        ) : ((modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION' || detailModalOrder.appointmentStatus === 'PENDING_CENTER_CONFIRMATION') && Boolean(modalAppointmentScheduledAt)) ? (
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
                        ) : (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {isOrderSeller(detailModalOrder) ? '' : 'Chờ Người Bán Hẹn Lịch'}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                      {(() => {
                        const detailAppt = getOrderAppointment(detailModalOrder);
                        const isDetailCountered = !isPendingApprovalOrFeeInModal && Boolean(
                          (
                            (detailAppt?.status === 'COUNTERED_BY_CENTER' && Boolean(detailAppt?.counterScheduledAt)) ||
                            Boolean(detailAppt?.counterScheduledAt) ||
                            Boolean((detailModalOrder as any).counterScheduledAt) ||
                            ((detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((detailModalOrder as any).counterScheduledAt))
                          ) &&
                          detailAppt?.status !== 'PENDING_CENTER_CONFIRMATION' &&
                          detailModalOrder.appointmentStatus !== 'PENDING_CENTER_CONFIRMATION' &&
                          detailModalOrder.status !== 'CONFIRMED_PENDING_DISPATCH'
                        );
                        if (isDetailCountered && isOrderSeller(detailModalOrder)) {
                          const detailCounterTime =
                            detailAppt?.counterScheduledAt ||
                            (detailModalOrder as any).counterScheduledAt ||
                            detailAppt?.scheduledAt ||
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
                                  <span className="font-bold text-amber-900">Giờ mới:</span>
                                  <span className="font-extrabold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {hasValidDate && validDate
                                      ? validDate.toLocaleString('vi-VN')
                                      : 'Theo đề xuất của Trung tâm'}
                                    {detailCounterShift ? ` (${detailCounterShift === 'MORNING' ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)'})` : ''}
                                  </span>
                                </div>
                                {detailCounterNote && (
                                  <div className="text-[11px] text-amber-900 italic">
                                    Lý do: "{detailCounterNote}"
                                  </div>
                                )}
                              </div>
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
                            </div>
                          );
                        }

                        const detailRej = !isDetailCountered && !isPendingApprovalOrFeeInModal ? getOrderAppointmentRejection(detailModalOrder) : null;
                        const isDetailRejected = !isDetailCountered && !isPendingApprovalOrFeeInModal && Boolean(
                          detailRej ||
                          (detailModalOrder as any).appointmentStatus === 'REJECTED' ||
                          modalSavedAppointment?.status === 'REJECTED'
                        );
                        if (isDetailRejected) {
                          return (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                              <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Lịch hẹn bị Trung tâm từ chối</span>
                              </div>
                              <p className="text-[11px] leading-relaxed bg-white/90 p-1.5 rounded border border-rose-200">
                                <strong>Lý do:</strong> "{detailRej?.reason || (detailModalOrder as any).appointmentRejectionReason || (modalSavedAppointment as any)?.rejectionReason || 'KTV đã kín lịch trong khung giờ này, vui lòng chọn ca khác.'}"
                              </p>
                              <p className="text-[10px] text-rose-700">
                                Vui lòng bấm "Đặt Lại Lịch Hẹn" để chọn lại ca làm việc phù hợp hơn.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {modalAppointmentScheduledAt && !isPendingApprovalOrFeeInModal && !Boolean(getOrderAppointmentRejection(detailModalOrder) || (detailModalOrder as any).appointmentStatus === 'REJECTED' || modalSavedAppointment?.status === 'REJECTED') && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-bold shrink-0">Lịch hẹn KTV:</span>
                          <span className="font-extrabold text-slate-800">
                            {new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      )}
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
                                      Kỹ thuật viên <strong>{effectiveInspectorName}</strong> sẽ đến nhà người bán theo lịch hẹn để kiểm định.
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

                        if (isModalInspPassed || detailModalOrder.inspectionReport || Boolean(detailModalOrder.tamperSealId)) {
                          return 'Đã hoàn tất kiểm tra';
                        }
                        if (isModalInspFailed) {
                          return 'Kỹ thuật viên đã hoàn tất kiểm tra: Thiết bị không đạt chuẩn.';
                        }
                        if (isInspectorArrivedForOrder(detailModalOrder.id, detailModalOrder)) {
                          return 'Kỹ thuật viên đã đến và đang kiểm tra thiết bị tại nhà người bán.';
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
                        if (
                          modalSavedAppointment?.status !== 'PENDING_CENTER_CONFIRMATION' &&
                          (detailModalOrder as any).appointmentStatus !== 'PENDING_CENTER_CONFIRMATION' &&
                          (
                            (modalSavedAppointment?.status === 'COUNTERED_BY_CENTER' && Boolean(modalSavedAppointment?.counterScheduledAt)) ||
                            ((detailModalOrder as any).appointmentStatus === 'COUNTERED_BY_CENTER' && Boolean((detailModalOrder as any).counterScheduledAt))
                          )
                        ) {
                          if (isOrderSeller(detailModalOrder)) {
                            const cTime = modalSavedAppointment?.counterScheduledAt || modalSavedAppointment?.scheduledAt || (detailModalOrder as any).counterScheduledAt || detailModalOrder.appointmentScheduledAt;
                            const cDate = cTime ? new Date(cTime) : null;
                            const formatted = cDate && !isNaN(cDate.getTime()) ? cDate.toLocaleString('vi-VN') : 'lịch mới';
                            return `Trung tâm đề xuất dời lịch sang ${formatted}. Đang chờ Người bán phản hồi thống nhất lịch mới.`;
                          }
                          return modalAppointmentScheduledAt
                            ? `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. Đang chờ Trung tâm kiểm định xem và phê duyệt.`
                            : 'Chờ người bán hẹn lịch đón KTV trong khung giờ hành chính (8h-12h, 13h-17h).';
                        }
                        if ((modalSavedAppointment?.status === 'PENDING_CENTER_CONFIRMATION' || modalSavedAppointment?.status === 'PENDING_CONFIRMATION') && modalAppointmentScheduledAt) {
                          return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. Đang chờ Trung tâm kiểm định xem và phê duyệt.`;
                        }
                        if (modalAppointmentScheduledAt) {
                          return `Lịch hẹn KTV: ${new Date(modalAppointmentScheduledAt).toLocaleString('vi-VN')} tại nhà người bán. ${effectiveInspectorName ? `KTV ${effectiveInspectorName} sẽ đến kiểm tra máy. Xuất trình mã tiếp nhận cho KTV khi đến.` : 'Trung tâm SecondLife đang xử lý và phân công KTV theo ca.'}`;
                        }
                        if (isModalCancelled && !isModalInspPassed && !isModalInspFailed) {
                          return 'Đơn hàng đã bị hủy. Lịch hẹn và quy trình kiểm định đã kết thúc.';
                        }
                        return isOrderSeller(detailModalOrder)
                          ? 'Vui lòng bấm nút "Hẹn Lịch Đón KTV" bên dưới để chọn ngày giờ làm việc trong khung giờ hành chính (8h-12h, 13h-17h).'
                          : 'Chờ người bán hẹn lịch đón KTV trong khung giờ hành chính (8h-12h, 13h-17h).';
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
                      : isModalCancelled
                        ? 'bg-rose-50/40 border-rose-200'
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
                            : isModalCancelled
                              ? 'bg-rose-700'
                              : 'bg-emerald-700'
                        }`}>
                        <Truck className="w-3 h-3" />
                        <span>Bước 2: Giao Hàng Người Mua</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-[#24263e]">
                        {isModalCompletedOrReleased ? (
                          <span className="text-[11px] font-sans font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Giao dịch hoàn tất
                          </span>
                        ) : Boolean(detailModalOrder.shippingDeliveredAt || (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' || (detailModalOrder as any).backendStatus === 'DELIVERED') ? (
                          <span className="text-[11px] font-sans font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            Đã giao hàng (48h)
                          </span>
                        ) : modalDirectShipment?.orderCode ? (
                          <span className="text-[11px] font-sans font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                            Đang giao hàng
                          </span>
                        ) : isModalInspFailed || isModalRejected || isModalCancelled ? (
                          <span className="text-[11px] font-sans font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            Không giao hàng
                          </span>
                        ) : isModalInspPassed ? (
                          <span className="text-[11px] font-sans font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            Sẵn sàng giao hàng
                          </span>
                        ) : (
                          <span></span>

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

                    {/* Action buttons & Tracking for Bước 2 (Giao Hàng Trực Tiếp Lalamove) */}
                    {modalDirectShipment && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <InspectionCashShipmentStatus shipment={modalDirectShipment} />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {(() => {
                            const prog = getBuyerDeliveryProgress(modalDirectShipment, lang);
                            return (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {prog.label}
                              </span>
                            );
                          })()}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setTrackingShipmentId(modalDirectShipment.shipmentId || (modalDirectShipment as any).id);
                                setTrackingOrder(detailModalOrder);
                              }}
                              className="inline-flex items-center gap-1 font-bold text-xs text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
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
                      {isModalCompletedOrReleased
                        ? 'Giao dịch đã hoàn tất thành công. Người mua đã nhận hàng và tiền hàng đã được giải ngân về ví người bán.'
                        : Boolean(detailModalOrder.shippingDeliveredAt || (detailModalOrder.escrowStatus as string) === 'DELIVERED_INSPECTION_WINDOW' || (detailModalOrder as any).backendStatus === 'DELIVERED')
                          ? 'Kiện hàng đã được tài xế Lalamove giao thành công tới người mua (Giai đoạn đối soát 48 giờ).'
                          : modalDirectShipment?.orderCode
                            ? `Đã tạo vận đơn Lalamove (#${modalDirectShipment.orderCode}).`
                            : isModalInspFailed
                              ? 'Sản phẩm không đạt chuẩn kiểm định. Đơn hàng dừng lại tại nhà người bán, không phát hàng cho người mua.'
                              : isModalRejected
                                ? 'Người mua từ chối mua sản phẩm sau khi kiểm định. Đơn hàng kết thúc.'
                                : isModalCancelled
                                  ? 'Đơn hàng đã bị hủy. Hệ thống không tạo vận đơn giao hàng.'
                                  : isModalPendingDecision
                                    ? 'KTV đã kiểm định ĐẠT chuẩn. Đang chờ người mua xác nhận mua hàng trước khi điều phối bưu tá.'
                                    : isModalInspPassed
                                      ? 'Sản phẩm kiểm định ĐẠT chuẩn. Tài xế Lalamove sẽ nhận hàng từ người bán và phát thẳng đến người mua.'
                                      : 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua.'}
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
                <span>Hành trình giao nhận 2 chặng</span>
              </div>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Kiểm định tại trung tâm
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
                        <span ></span>
                      ) : (
                        <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isModalWaitingFeePayment || isModalWaitingSellerApproval || isModalWaitingBuyerApproval
                          ? 'text-amber-800 bg-amber-50 border-amber-300 font-semibold'
                          : isOrderSellerConfirmed(detailModalOrder)
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>
                          {detailInboundLabel || (
                            isModalCancelled && !isModalInspPassed && !isModalInspFailed
                              ? (lang === 'vi' ? 'Đã hủy đơn' : 'Cancelled')
                              : isModalWaitingFeePayment
                                ? (lang === 'vi' ? 'Chờ hoàn tất nộp phí kiểm định' : 'Awaiting inspection fee')
                                : isModalWaitingSellerApproval || isModalWaitingBuyerApproval
                                  ? (lang === 'vi' ? 'Chờ xác nhận yêu cầu' : 'Pending approval')
                                  : isOrderSellerConfirmed(detailModalOrder)
                                    ? (lang === 'vi' ? 'Đang chuẩn bị điều phối vận chuyển' : 'Preparing dispatch')
                                    : (lang === 'vi' ? 'Chưa tạo vận đơn Lalamove' : 'Pending courier')
                          )}
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
                      <div className="flex items-center justify-end gap-2 flex-wrap">
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

                  <span className="break-words leading-relaxed">
                    {isModalCancelled && !isModalInspPassed && !isModalInspFailed
                      ? (lang === 'vi'
                        ? 'Đơn hàng đã bị hủy. Hoạt động kiểm định và vận chuyển qua Hub đã dừng lại.'
                        : 'Order was cancelled. Inspection and shipment to Hub have ended.')
                      : isModalWaitingFeePayment
                        ? (lang === 'vi'
                          ? 'Đang chờ các bên nộp phí kiểm định. Vận đơn Lalamove Chặng 1 sẽ được điều phối sau khi hoàn tất nộp phí.'
                          : 'Awaiting fee payment. Leg 1 courier dispatch will be arranged once all fees are settled.')
                        : isModalWaitingSellerApproval || isModalWaitingBuyerApproval
                          ? (lang === 'vi'
                            ? 'Đang chờ xác nhận yêu cầu kiểm định từ các bên.'
                            : 'Awaiting approval from parties.')
                          : (detailModalOrder.shippingLegs[0]?.timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description ||
                            (lang === 'vi' ? '' : 'Hub inspection shipment created. Awaiting Lalamove pickup.'))}
                  </span>
                </div>
              </div>

              {/* Chặng 2: Trung tâm Hub gửi Người mua HOẶC Hoàn trả người bán */}
              <div className={`rounded-2xl p-4 border flex flex-col justify-between h-full shadow-2xs space-y-3 ${isModalInspFailed || isModalRejected || (isModalCancelled && !isModalInspPassed)
                ? 'bg-rose-50/80 border-rose-200'
                : isModalPendingDecision
                  ? 'bg-amber-50/80 border-amber-200'
                  : isModalInspPassed
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : 'bg-slate-50/80 border-slate-200'
                }`}>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1 ${isModalInspFailed || isModalRejected || (isModalCancelled && !isModalInspPassed)
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
                            : isModalCancelled && !isModalInspPassed
                              ? 'Chặng 2: Không Giao Hàng'
                              : isModalPendingDecision
                                ? 'Chặng 2: Hub Giao Người Mua (Chờ Quyết Định)'
                                : isModalAccepted
                                  ? 'Chặng 2: Hub Giao Người Mua (Đã Duyệt Mua)'
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
                        <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${isModalInspFailed || isModalRejected || (isModalCancelled && !isModalInspPassed)
                          ? 'text-rose-700 bg-rose-100 border-rose-200'
                          : isModalPendingDecision
                            ? 'text-amber-800 bg-amber-100 border-amber-300 font-bold'
                            : isModalAccepted
                              ? 'text-emerald-700 bg-emerald-100 border-emerald-300 font-bold'
                              : isModalInspPassed
                                ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                          }`}>
                          {isModalInspFailed
                            ? 'Đơn kiểm định không đạt'
                            : isModalRejected
                              ? ''
                              : (isModalCancelled && !isModalInspPassed)
                                ? 'Đã hủy đơn • Không giao hàng'
                                : isModalPendingDecision
                                  ? ''
                                  : isModalAccepted
                                    ? 'Đã duyệt mua • Đang chuẩn bị giao'
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
                        {isModalInspFailed || isModalRejected
                          ? modalReturnShipment?.receiverAddress?.trim() || realSellerAddress
                          : realBuyerAddress}
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
                            : getBuyerDeliveryProgress(modalLeg2Shipment, lang);
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
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-1">

                  <span className="break-words leading-relaxed">
                    {isModalInspFailed
                      ? 'Kiểm định không đạt. Trung tâm xử lý chặng trả hàng về người bán.'
                      : isModalRejected
                        ? 'Người mua từ chối nhận hàng sau kiểm định. Trung tâm xử lý hoàn trả kiện hàng về người bán.'
                        : isModalPendingDecision
                          ? 'Đã kiểm định ĐẠT CHUẨN. Đang chờ người mua xem kết quả và quyết định tiếp tục mua hàng.'
                          : isModalAccepted
                            ? ''
                            : isModalInspPassed
                              ? 'Đã kiểm định ĐẠT CHUẨN. Hub chuyển phát an toàn đến tận tay người mua.'
                              : (detailModalOrder.shippingLegs[1]?.timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description || '')}
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
