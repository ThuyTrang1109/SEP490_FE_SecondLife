
import {
  AlertCircle, AlertTriangle, Calendar, CalendarCheck, CalendarSync, CheckCircle2, Clock,
  ShieldCheck, Truck, UserCheck, Wrench, XCircle,
} from 'lucide-react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { formatInspectionDeadline, isInspectionPaymentExpired } from '../../utils/inspectionPaymentDeadline';
import { buyerInspectionStageLabel, getCustomerInspectionStatus, getInspectionPurchaseDecision } from '../../utils/inspectionPurchase';
import { getHubReturnProgress, getHubReturnState, getInboundShipmentProgress } from '../../utils/inspectionCenterData';
import { formatVND } from '../../utils/translations';
import { getOrderAppointmentRejection, type OrderAppointment } from '../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../types/orders/orderTypes';
import { getOrderAllShipments, isHubInboundInProgress } from '../../utils/orders/shipmentCache';
import { getAtHomeDeliveryStage, isOrderDeliveredToBuyer } from '../../utils/orders/orderReceipt';

export interface OrderStatusBadgeOptions {
  lang: Language;
  isSeller: boolean;
  isOrderCancelledOrRefunded: OrderCheck;
  isOrderSellerConfirmed: OrderCheck;
  getOrderInboundShipment: (order: EscrowOrder) => ShipmentBackend | null;
  inboundLoadingOrders: ReadonlySet<string>;
  isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
  getOrderAppointment: (order: EscrowOrder) => OrderAppointment | null;
  autoPaidOrderIds: ReadonlySet<string>;
  isPartyInspectionFeePending: (order: EscrowOrder, isSeller: boolean) => boolean;
  getPartyInspectionFee: (order: EscrowOrder, isSeller: boolean) => number;
  isPartyInspectionFeePaid: (order: EscrowOrder, isSeller: boolean) => boolean;
}

interface Props extends OrderStatusBadgeOptions {
  status: string;
  hasInspection?: boolean;
  isCurrentOrderSeller?: boolean;
  orderItem?: EscrowOrder;
}

export function OrderStatusBadge({
  status, hasInspection, isCurrentOrderSeller, orderItem,
  lang, isSeller, isOrderCancelledOrRefunded, isOrderSellerConfirmed, getOrderInboundShipment, inboundLoadingOrders,
  isInspectorArrivedForOrder, getOrderAppointment, autoPaidOrderIds,
  isPartyInspectionFeePending, getPartyInspectionFee, isPartyInspectionFeePaid,
}: Props) {
  const isInspectionOrder = Boolean(
    hasInspection ||
    orderItem?.hasInspectionService ||
    (orderItem?.inspectionFeeVnd && orderItem.inspectionFeeVnd > 0) ||
    orderItem?.inspectionCenterId ||
    orderItem?.inspectionStatus
  );

  const isAtHomeOrderCheck = (item: any): boolean => {
    if (!item) return false;
    const m = String(item.inspectionMethod || item.inspection_method || '').toUpperCase();
    const ot = String(item.orderType || item.order_type || item.inspectionOrder?.orderType || item.inspectionOrder?.order_type || '').toUpperCase();
    if (m === 'AT_HOME' || ot === 'AT_HOME') return true;
    if (typeof window !== 'undefined' && item.id) {
      if (localStorage.getItem(`order_method_${item.id}`) === 'AT_HOME') return true;
    }
    return false;
  };

  const isSellerForThisOrder = isCurrentOrderSeller !== undefined ? isCurrentOrderSeller : isSeller;
  const s = String(status || '').toUpperCase();
  const bStatus = String(
    (orderItem as any)?.backendStatus ||
    (orderItem as any)?.inspectionStatus ||
    (orderItem as any)?.inspectionOrder?.status ||
    ((orderItem as any)?.status !== 'AWAITING_INSPECTION' && (orderItem as any)?.status !== 'AWAITING_PAYMENT' && (orderItem as any)?.status !== 'HELD_IN_ESCROW' ? (orderItem as any)?.status : '') ||
    ''
  ).toUpperCase();
  const sellerConfirmed = Boolean(orderItem && isOrderSellerConfirmed(orderItem));
  const inbound = orderItem && getOrderInboundShipment(orderItem);
  const inspectionStatus = orderItem?.inspectionStatus || bStatus;

  const isFailedInsp =
    s === 'FAILED' ||
    s === 'INSPECTION_FAILED' ||
    inspectionStatus === 'FAILED' ||
    orderItem?.escrowStatus === 'INSPECTION_FAILED' ||
    bStatus === 'FAILED' ||
    String((orderItem as any)?.status || '').toUpperCase() === 'FAILED' ||
    String((orderItem as any)?.inspectionStatus || '').toUpperCase() === 'FAILED';

  const purchaseDecision = orderItem ? getInspectionPurchaseDecision(orderItem) : null;
  const isBuyerPurchaseRejected = purchaseDecision === 'rejected';

  if (orderItem && !isFailedInsp && !isBuyerPurchaseRejected && isOrderCancelledOrRefunded(orderItem)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        <span>{isInspectionOrder
          ? (lang === 'vi' ? 'Giao dịch đã bị hủy' : 'Transaction cancelled')
          : (lang === 'vi' ? 'Đã Hủy • Hoàn Tiền' : 'Cancelled & Refunded')}</span>
      </span>
    );
  }

  // 1. Kiểm tra đơn hàng đã hoàn tất / đã giải ngân
  const isReceiptConfirmed = Boolean(
    orderItem && (
      (orderItem as any).receiptConfirmedAt ||
      (typeof window !== 'undefined' && orderItem.id && localStorage.getItem(`order_receipt_confirmed_${orderItem.id}`) === 'true')
    )
  );

  const isCompletedOrReleased = Boolean(
    isReceiptConfirmed ||
    s === 'COMPLETED_RELEASED' ||
    s === 'COMPLETED' ||
    s === 'RELEASED' ||
    bStatus === 'COMPLETED' ||
    bStatus === 'RELEASED' ||
    (orderItem?.escrowStatus as any) === 'COMPLETED_RELEASED' ||
    (orderItem?.escrowStatus as any) === 'RELEASED'
  );
  if (isCompletedOrReleased) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          {lang === 'vi'
            ? isSellerForThisOrder ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'
            : isSellerForThisOrder ? 'Payout Transferred to Wallet' : 'Completed • Escrow Released'}
        </span>
      </span>
    );
  }

  // 1.5. Kiểm tra đơn hàng đã giao thành công đến người mua (48h kiểm tra đối soát)
  const atHomeDeliveryStage = orderItem && isAtHomeOrderCheck(orderItem) ? getAtHomeDeliveryStage(orderItem) : null;
  const isDeliveredToBuyer = Boolean(
    atHomeDeliveryStage === 'delivered' ||
    (orderItem && isOrderDeliveredToBuyer(orderItem)) ||
    orderItem?.shippingDeliveredAt ||
    orderItem?.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
    bStatus === 'DELIVERED_INSPECTION_WINDOW' ||
    bStatus === 'DELIVERED' ||
    (orderItem as any)?.backendStatus === 'DELIVERED' ||
    s === 'DELIVERED_INSPECTION_WINDOW' ||
    s === 'DELIVERED' ||
    (() => {
      if (!orderItem?.id) return false;
      const ships = getOrderAllShipments(orderItem.id, (orderItem as any).linkedOrderId);
      return ships.some(
        (sh) =>
          (sh.leg === 'SELLER_TO_BUYER' || sh.leg === 'CENTER_TO_BUYER' || sh.leg === 'DELIVERY') &&
          (sh.status === 'DELIVERED' || sh.status === 'COMPLETED' || sh.providerStatus === 'COMPLETED')
      );
    })()
  );

  if (isDeliveredToBuyer) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          {lang === 'vi'
            ? isSellerForThisOrder
              ? 'Đã giao hàng • Chờ đối soát (48h)'
              : 'Đã giao • 48h kiểm tra đối soát'
            : isSellerForThisOrder
              ? 'Delivered • Buyer Review (48h)'
              : 'Delivered • 48h Inspection Window'}
        </span>
      </span>
    );
  }

  // 2. Quyết định mua hàng sau khi kiểm định ĐẠT
  const isPurchaseAccepted = Boolean(
    purchaseDecision === 'accepted' ||
    orderItem?.finalPaymentPaidAt ||
    (orderItem as any)?.inspectionDecision === 'accepted' ||
    (orderItem as any)?.buyerDecision === 'accepted' ||
    orderItem?.linkedOrderId ||
    (orderItem as any)?.inspectionOrder?.finalPaymentPaidAt ||
    (orderItem as any)?.inspectionOrder?.orderId ||
    bStatus === 'DELIVERING_TO_BUYER' ||
    (orderItem as any)?.status === 'DELIVERING_TO_BUYER' ||
    (orderItem?.escrowStatus as any) === 'DELIVERING_TO_BUYER' ||
    (orderItem?.escrowStatus as any) === 'SHIPPED_TO_BUYER'
  );

  if (isPurchaseAccepted) {
    const isAtHomeOrder = (() => {
      if (
        orderItem?.inspectionMethod === 'AT_HOME' ||
        (orderItem as any)?.orderType === 'AT_HOME' ||
        (orderItem as any)?.inspectionScope === 'AT_HOME' ||
        (orderItem as any)?.inspectionOrder?.orderType === 'AT_HOME' ||
        (orderItem as any)?.inspectionOrder?.inspectionMethod === 'AT_HOME'
      ) return true;

      if (orderItem?.id && typeof window !== 'undefined') {
        const oid = orderItem.id;
        const linkedId = (orderItem as any).linkedOrderId || (orderItem as any).inspectionOrderId;
        const targetIds = [oid, linkedId].filter(Boolean);
        for (const storageKey of ['recent_placed_orders', 'center_inspection_orders', 'my_seller_inspection_orders']) {
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const found = list.find((o: any) => targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId));
                if (found && (found.orderType === 'AT_HOME' || found.inspectionMethod === 'AT_HOME')) {
                  return true;
                }
              }
            }
          } catch { }
        }
      }
      return false;
    })();

    // 1. Gói qua Hub (AT_CENTER):
    // Người bán ĐÃ gửi hàng đến Hub ở Chặng 1, người mua ĐÃ thanh toán mua tiếp
    // -> Trạng thái chuẩn hiển thị cho cả hai bên (Seller & Buyer) là "Người mua đã mua tiếp"
    if (!isAtHomeOrder) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{lang === 'vi' ? 'Người mua đã mua tiếp' : 'Purchase Confirmed'}</span>
        </span>
      );
    }

    const deliveryStage = atHomeDeliveryStage ?? (orderItem && getAtHomeDeliveryStage(orderItem));
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
        <Truck className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          {deliveryStage === 'in_transit'
            ? (lang === 'vi' ? 'Đang giao hàng • Lalamove' : 'Delivering • Lalamove')
            : deliveryStage === 'awaiting_pickup'
              ? (lang === 'vi' ? 'Đã tạo vận đơn • Chờ tài xế lấy hàng' : 'Shipment Created • Awaiting Driver Pickup')
              : isSellerForThisOrder
                ? (lang === 'vi' ? 'Người mua đã mua tiếp • Chờ gửi hàng' : 'Purchase Confirmed • Please Ship')
                : (lang === 'vi' ? 'Đã xác nhận mua • Chờ người bán gửi hàng' : 'Purchase Confirmed • Waiting for Seller to Ship')}
        </span>
      </span>
    );
  }

  if (purchaseDecision === 'pending' || orderItem?.escrowStatus === 'INSPECTION_PASSED' || inspectionStatus === 'PASSED' || bStatus === 'PASSED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          {lang === 'vi'
            ? isSellerForThisOrder
              ? 'Kiểm định ĐẠT • Chờ người mua quyết định'
              : 'Kiểm định ĐẠT • Chờ bạn quyết định mua'
            : isSellerForThisOrder
              ? 'Passed • Awaiting Buyer Decision'
              : 'Passed • Awaiting Your Decision'}
        </span>
      </span>
    );
  }

  if (purchaseDecision === 'rejected') {
    const allOrderShipments = (orderItem as any)?.shipments?.length
      ? (orderItem as any).shipments
      : (orderItem?.id ? getOrderAllShipments(orderItem.id, (orderItem as any).linkedOrderId) : []);
    const returnShipment = (orderItem as any)?.returnShipment ||
      allOrderShipments.find((s: any) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') ||
      allOrderShipments.find((s: any) => s.leg === 'CENTER_TO_SELLER');
    const isReturnDelivered = returnShipment?.status === 'DELIVERED' || returnShipment?.status === 'COMPLETED' || (returnShipment && getHubReturnProgress(returnShipment, lang).step === 3);
    const isReturnInTransit = returnShipment && (returnShipment.status === 'IN_TRANSIT' || returnShipment.status === 'SHIPPED' || returnShipment.status === 'PICKED_UP' || getHubReturnProgress(returnShipment, lang).step === 2);

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        <span>
          {lang === 'vi'
            ? isReturnDelivered
              ? (isSellerForThisOrder ? 'Người mua từ chối mua • Đã hoàn trả hàng' : 'Đã từ chối mua tiếp • Đã hoàn trả người bán')
              : isReturnInTransit
                ? (isSellerForThisOrder ? 'Người mua từ chối mua • Đang chuyển hoàn về Seller' : 'Đã từ chối mua tiếp • Đang chuyển hoàn')
                : (isSellerForThisOrder ? 'Người mua từ chối mua • Chờ trung tâm hoàn hàng' : 'Đã từ chối mua tiếp • Chờ trung tâm hoàn hàng')
            : isReturnDelivered
              ? 'Buyer Declined • Returned to Seller'
              : isReturnInTransit
                ? 'Buyer Declined • Returning to Seller'
                : 'Buyer Declined • Pending Return'}
        </span>
      </span>
    );
  }

  if (isFailedInsp) {
    const allOrderShipments = (orderItem as any)?.shipments?.length
      ? (orderItem as any).shipments
      : (orderItem?.id ? getOrderAllShipments(orderItem.id, (orderItem as any).linkedOrderId) : []);
    const returnShipment = (orderItem as any)?.returnShipment ||
      allOrderShipments.find((s: any) => s.leg === 'CENTER_TO_SELLER' && s.status !== 'CANCELLED') ||
      allOrderShipments.find((s: any) => s.leg === 'CENTER_TO_SELLER');
    const isReturnDelivered = returnShipment?.status === 'DELIVERED' || returnShipment?.status === 'COMPLETED' || (returnShipment && getHubReturnProgress(returnShipment, lang).step === 3);
    const isReturnInTransit = returnShipment && (returnShipment.status === 'IN_TRANSIT' || returnShipment.status === 'SHIPPED' || returnShipment.status === 'PICKED_UP' || getHubReturnProgress(returnShipment, lang).step === 2);

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        <span>
          {lang === 'vi'
            ? isReturnDelivered
              ? 'Kiểm định không đạt • Đã hoàn trả người bán'
              : isReturnInTransit
                ? 'Kiểm định không đạt • Đang chuyển hoàn'
                : 'Kiểm định không đạt • Chờ chuyển hoàn'
            : isReturnDelivered
              ? 'Inspection Failed • Returned to Seller'
              : isReturnInTransit
                ? 'Inspection Failed • Returning to Seller'
                : 'Inspection Failed • Pending Return'}
        </span>
      </span>
    );
  }

  const customerStatus = getCustomerInspectionStatus(inspectionStatus, undefined, orderItem?.inspectorId);
  if (customerStatus === 'INSPECTING' || customerStatus === 'INSPECTION_IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
        <Clock className="h-3.5 w-3.5" />
        <span>{buyerInspectionStageLabel('inspecting', lang)}</span>
      </span>
    );
  }
  if (orderItem && inbound && inspectionStatus !== 'INSPECTING' && isHubInboundInProgress(orderItem)) {
    const progress = getInboundShipmentProgress(inbound, lang);
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${progress.step === 3 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700'
        }`}>
        <Truck className="h-3.5 w-3.5" />
        <span>
          {progress.step === 3
            ? (lang === 'vi' ? 'Đã Đến Hub Kiểm Định' : 'Delivered to Hub')
            : (lang === 'vi' ? 'Đang vận chuyển đến trung tâm kiểm định' : 'Shipping to Hub')}
        </span>
      </span>
    );
  }

  if (orderItem && isHubInboundInProgress(orderItem) && !inbound && inboundLoadingOrders.has(orderItem.id)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 animate-pulse">
        <Truck className="h-3.5 w-3.5 text-slate-400" />
        <span>{lang === 'vi' ? 'Đang cập nhật vận đơn Hub...' : 'Updating Hub shipment...'}</span>
      </span>
    );
  }

  if (bStatus === 'WAITING_SELLER_APPROVAL' || (s === 'AWAITING_INSPECTION' && bStatus === 'WAITING_SELLER_APPROVAL')) {
    const isAtHome = isAtHomeOrderCheck(orderItem);
    const appt = orderItem ? getOrderAppointment(orderItem) : null;
    const isPendingCenter1 = Boolean(
      appt?.status === 'PENDING_CENTER_CONFIRMATION' ||
      (orderItem as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
    );
    const isCountered = isAtHome && !isPendingCenter1 && Boolean(
      (appt?.status === 'COUNTERED_BY_CENTER' || (orderItem as any)?.appointmentStatus === 'COUNTERED_BY_CENTER' || (orderItem as any)?.inspectionOrder?.appointmentStatus === 'COUNTERED_BY_CENTER') &&
      (Boolean(appt?.counterScheduledAt) || Boolean((orderItem as any)?.counterScheduledAt) || Boolean((orderItem as any)?.inspectionOrder?.counterScheduledAt))
    );
    if (!isCountered) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Yêu Cầu Kiểm Định Mới • Chờ Bạn Xác Nhận' : 'Đã Gửi Yêu Cầu • Chờ Người Bán Xác Nhận'
              : isSellerForThisOrder ? 'New Inspection Request • Awaiting Your Approval' : 'Inspection Requested • Awaiting Seller Approval'}
          </span>
        </span>
      );
    }
  }

  if (bStatus === 'WAITING_BUYER_APPROVAL' || (s === 'AWAITING_INSPECTION' && bStatus === 'WAITING_BUYER_APPROVAL')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-800 border border-purple-500/30">
        <Clock className="w-3.5 h-3.5 text-purple-600" />
        <span>
          {lang === 'vi'
            ? isSellerForThisOrder ? 'Đã Đề Xuất Lại • Chờ Người Mua Phản Hồi' : 'Người Bán Đã Đề Xuất Lại • Chờ Bạn Xác Nhận'
            : isSellerForThisOrder ? 'Counter-proposal Sent • Awaiting Buyer Approval' : 'Seller Counter-proposed • Awaiting Your Response'}
        </span>
      </span>
    );
  }
  if (inspectionStatus === 'CONFIRMED_PENDING_DISPATCH') {
    const isAtHome = isAtHomeOrderCheck(orderItem);
    const isArrived = orderItem?.id ? isInspectorArrivedForOrder(orderItem.id, orderItem) : false;
    if (isAtHome && isArrived) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <Wrench className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
          <span>
            {lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting'}
          </span>
        </span>
      );
    }
    if (isAtHome) {
      const appt = orderItem ? getOrderAppointment(orderItem) : null;
      const isPendingCenter2 = Boolean(
        appt?.status === 'PENDING_CENTER_CONFIRMATION' ||
        (orderItem as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
      );
      const isCountered = !isPendingCenter2 && Boolean(
        (appt?.status === 'COUNTERED_BY_CENTER' || (orderItem as any)?.appointmentStatus === 'COUNTERED_BY_CENTER' || (orderItem as any)?.inspectionOrder?.appointmentStatus === 'COUNTERED_BY_CENTER') &&
        (Boolean(appt?.counterScheduledAt) || Boolean((orderItem as any)?.counterScheduledAt) || Boolean((orderItem as any)?.inspectionOrder?.counterScheduledAt))
      );
      const rejection = !isCountered && orderItem ? getOrderAppointmentRejection(orderItem) : null;
      const isRejected = !isCountered && (
        (orderItem as any)?.appointmentStatus === 'REJECTED' ||
        appt?.status === 'REJECTED' ||
        Boolean(rejection)
      );
      const isPendingApproval = !isRejected && !isCountered && (appt?.status === 'PENDING_CENTER_CONFIRMATION' || appt?.status === 'PENDING_CONFIRMATION');
      const hasAppt = !isRejected && !isCountered && Boolean(appt?.scheduledAt || orderItem?.appointmentScheduledAt);

      let hasInsp = Boolean(orderItem?.inspectorId || (orderItem as any)?.inspectorName);
      if (!hasInsp && orderItem?.id && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`order_assigned_inspector_${orderItem.id}`);
          if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
        } catch { }
      }
      if (hasInsp && !isRejected) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{lang === 'vi' ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Inspector Assigned • Pending Survey'}</span>
          </span>
        );
      }
      if (appt?.status === 'CONFIRMED' && !isRejected) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'}</span>
          </span>
        );
      }
      if (isSellerForThisOrder) {
        if (isRejected) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{lang === 'vi' ? 'Lịch Hẹn Bị Từ Chối • Cần Hẹn Lại' : 'Appointment Rejected • Please Reschedule'}</span>
            </span>
          );
        }
        if (isCountered) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
              <CalendarSync className="w-3.5 h-3.5 text-amber-700" />
              <span>{lang === 'vi' ? 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi' : 'Hub Proposed New Time • Response Needed'}</span>
            </span>
          );
        }
        if (isPendingApproval || hasAppt) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'vi' ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Awaiting Schedule Visit'}</span>
          </span>
        );
      }
      // Phía Buyer: Chỉ hiển thị lịch đầu tiên / trạng thái chờ KTV, không hiện các trạng thái đề xuất/đổi lịch nội bộ giữa Seller và Hub
      if (isRejected) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'vi' ? 'Chờ Người Bán Hẹn Lại Lịch KTV' : 'Awaiting Seller Reschedule Visit'}</span>
          </span>
        );
      }
      if (hasAppt || isPendingApproval) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'vi' ? 'Đã Hẹn Lịch • Chờ KTV Khảo Sát' : 'Visit Scheduled • Awaiting Inspector'}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <Calendar className="w-3.5 h-3.5 text-amber-600" />
          <span>{lang === 'vi' ? 'Chờ Người Bán Hẹn Lịch Đón KTV' : 'Awaiting Seller Schedule Visit'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="w-3.5 h-3.5 text-blue-600" />
        <span>
          {lang === 'vi' ? 'Chờ người bán gửi hàng đến Hub' : 'Awaiting seller shipment to Hub'}
        </span>
      </span>
    );
  }
  if (sellerConfirmed || bStatus === 'WAITING_FEE_PAYMENT' || bStatus === 'DISPATCHED' || bStatus === 'SHIPPING_TO_CENTER') {
    if (bStatus === 'WAITING_FEE_PAYMENT') {
      const isAutoPaying = Boolean(orderItem?.id && autoPaidOrderIds.has(orderItem.id));
      const deadline = orderItem?.paymentDeadline || (orderItem as any)?.inspectionOrder?.paymentDeadline;
      const isExpired = isInspectionPaymentExpired(deadline);
      const formattedDeadline = formatInspectionDeadline(deadline, lang);

      const myPending = orderItem ? isPartyInspectionFeePending(orderItem, isSellerForThisOrder) : false;
      const myFee = orderItem ? getPartyInspectionFee(orderItem, isSellerForThisOrder) : 0;
      const myPaid = orderItem ? isPartyInspectionFeePaid(orderItem, isSellerForThisOrder) : false;
      const isSeller100 = orderItem?.inspectionFeeSplit === 'SELLER_100';

      let statusText = '';
      if (isExpired) {
        statusText = lang === 'vi' ? 'Quá hạn đóng phí kiểm định' : 'Fee payment expired';
      } else if (!isSellerForThisOrder && (isSeller100 || myFee === 0)) {
        statusText = lang === 'vi' ? 'Chờ người bán nộp phí kiểm định' : 'Awaiting seller fee payment';
      } else if (isSellerForThisOrder && myFee === 0) {
        statusText = lang === 'vi' ? 'Chờ người mua nộp phí kiểm định' : 'Awaiting buyer fee payment';
      } else if (isAutoPaying && myFee > 0) {
        statusText = lang === 'vi' ? 'Đang nộp phí kiểm định...' : 'Depositing Fee to Escrow...';
      } else if (myPending) {
        statusText = lang === 'vi'
          ? `Chờ bạn nộp phí kiểm định (${formatVND(myFee)})`
          : `Awaiting your fee payment (${formatVND(myFee)})`;
      } else if (myPaid) {
        statusText = lang === 'vi'
          ? (isSellerForThisOrder ? 'Đã nộp phí • Chờ người mua nộp phí' : 'Đã nộp phí • Chờ người bán nộp phí')
          : (isSellerForThisOrder ? 'Fee paid • Awaiting buyer payment' : 'Fee paid • Awaiting seller payment');
      } else {
        statusText = lang === 'vi' ? 'Chờ đóng phí kiểm định' : 'Awaiting inspection fee payment';
      }

      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isExpired
          ? 'bg-rose-50 text-rose-800 border border-rose-200'
          : myPending
            ? 'bg-orange-500/15 text-orange-800 border border-orange-500/30'
            : 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
          }`}>
          <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-600' : 'text-orange-600'} ${isAutoPaying ? 'animate-spin' : ''}`} />
          <span>
            {statusText}
            {formattedDeadline && (
              <span className="font-normal opacity-90 ml-1">
                • {lang === 'vi' ? 'Hạn:' : 'Due:'} {formattedDeadline}
              </span>
            )}
          </span>
        </span>
      );
    }
    if (bStatus === 'DISPATCHED') {
      const isAtCenter = orderItem?.inspectionMethod === 'AT_CENTER';
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>{lang === 'vi' ? (isAtCenter ? 'Đã Điều Phối Vận Chuyển Hub' : 'Đã Điều Phối KTV / Hub') : 'Dispatched'}</span>
        </span>
      );
    }
    if (bStatus === 'SHIPPING_TO_CENTER') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
          <Truck className="w-3.5 h-3.5 text-cyan-600" />
          <span>{lang === 'vi' ? 'Đang giao đến Hub kiểm định' : 'Shipping to Hub'}</span>
        </span>
      );
    }
    if (s === 'AWAITING_INSPECTION' || s === 'HELD_IN_ESCROW') {
      const isAtHome = isAtHomeOrderCheck(orderItem);
      const isArrived = orderItem?.id ? isInspectorArrivedForOrder(orderItem.id, orderItem) : false;
      if (isAtHome && isArrived) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Wrench className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            <span>
              {lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting'}
            </span>
          </span>
        );
      }
      if (isAtHome) {
        const appt = orderItem ? getOrderAppointment(orderItem) : null;
        const isPendingCenter3 = Boolean(
          appt?.status === 'PENDING_CENTER_CONFIRMATION' ||
          (orderItem as any)?.appointmentStatus === 'PENDING_CENTER_CONFIRMATION'
        );
        const isCountered = !isPendingCenter3 && Boolean(
          (appt?.status === 'COUNTERED_BY_CENTER' || (orderItem as any)?.appointmentStatus === 'COUNTERED_BY_CENTER' || (orderItem as any)?.inspectionOrder?.appointmentStatus === 'COUNTERED_BY_CENTER') &&
          (Boolean(appt?.counterScheduledAt) || Boolean((orderItem as any)?.counterScheduledAt) || Boolean((orderItem as any)?.inspectionOrder?.counterScheduledAt))
        );
        const rejection = !isCountered && orderItem ? getOrderAppointmentRejection(orderItem) : null;
        const isRejected = !isCountered && (
          (orderItem as any)?.appointmentStatus === 'REJECTED' ||
          appt?.status === 'REJECTED' ||
          Boolean(rejection)
        );
        const isPendingApproval = !isRejected && !isCountered && (appt?.status === 'PENDING_CENTER_CONFIRMATION' || appt?.status === 'PENDING_CONFIRMATION');
        const hasAppt = !isRejected && !isCountered && Boolean(appt?.scheduledAt || orderItem?.appointmentScheduledAt);

        let hasInsp = Boolean(orderItem?.inspectorId || (orderItem as any)?.inspectorName);
        if (!hasInsp && orderItem?.id && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(`order_assigned_inspector_${orderItem.id}`);
            if (raw && JSON.parse(raw).inspectorName) hasInsp = true;
          } catch { }
        }
        if (hasInsp && !isRejected) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>{lang === 'vi' ? 'Đã Phân Công KTV • Chờ Khảo Sát' : 'Inspector Assigned • Pending Survey'}</span>
            </span>
          );
        }
        if (appt?.status === 'CONFIRMED' && !isRejected) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Đã Chốt Lịch • Chờ Giao KTV' : 'Visit Confirmed • Awaiting Dispatch'}</span>
            </span>
          );
        }
        if (isSellerForThisOrder) {
          if (isRejected) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{lang === 'vi' ? 'Lịch Hẹn Bị Từ Chối • Cần Hẹn Lại' : 'Appointment Rejected • Please Reschedule'}</span>
              </span>
            );
          }
          if (isCountered) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                <CalendarSync className="w-3.5 h-3.5 text-amber-700" />
                <span>{lang === 'vi' ? 'Hub Đề Xuất Lịch Mới • Cần Phản Hồi' : 'Hub Proposed New Time • Response Needed'}</span>
              </span>
            );
          }
          if (isPendingApproval || hasAppt) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? 'Đã Đề Xuất Lịch • Chờ Hub Duyệt' : 'Visit Proposed • Awaiting Hub Approval'}</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'vi' ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Awaiting Schedule Visit'}</span>
            </span>
          );
        }
        // Phía Buyer: Chỉ hiển thị lịch đầu tiên / trạng thái chờ KTV, không hiện các trạng thái đề xuất/đổi lịch nội bộ giữa Seller và Hub
        if (isRejected) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'vi' ? 'Chờ Người Bán Hẹn Lại Lịch KTV' : 'Awaiting Seller Reschedule Visit'}</span>
            </span>
          );
        }
        if (hasAppt || isPendingApproval) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Đã Hẹn Lịch • Chờ KTV Khảo Sát' : 'Visit Scheduled • Awaiting Inspector'}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'vi' ? 'Chờ Người Bán Hẹn Lịch Đón KTV' : 'Awaiting Seller Schedule Visit'}</span>
          </span>
        );
      }
      const isSellerPaysAll = orderItem?.inspectionFeeSplit === 'SELLER_100' || (orderItem ? getPartyInspectionFee(orderItem, false) <= 0 : false);
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder
                ? 'Đã Xác Nhận • Đang Chuẩn Bị Gửi Hub'
                : (isSellerPaysAll ? 'Chờ người bán gửi hàng đến Hub' : 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub')
              : isSellerForThisOrder
                ? 'Confirmed • Preparing Hub Dispatch'
                : (isSellerPaysAll ? 'Awaiting seller shipment to Hub' : 'Seller Confirmed • Dispatching to Hub')}
          </span>
        </span>
      );
    }
  }
  switch (s) {
    case 'AWAITING_PAYMENT':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Chờ Khách Ký Quỹ Escrow' : 'Chờ Chuyển Khoản Ký Quỹ Escrow'
              : isSellerForThisOrder ? 'Awaiting Buyer Escrow Deposit' : 'Awaiting Escrow Deposit'}
          </span>
        </span>
      );
    case 'AWAITING_INSPECTION':
      if (sellerConfirmed) {
        const isAtHomeAwaiting = isAtHomeOrderCheck(orderItem);
        if (isAtHomeAwaiting) {
          const appt = orderItem ? getOrderAppointment(orderItem) : null;
          const hasAppt = Boolean(appt?.scheduledAt || orderItem?.appointmentScheduledAt);
          if (isSellerForThisOrder) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>{lang === 'vi' ? 'Chờ Bạn Hẹn Lịch Đón KTV' : 'Awaiting Schedule Visit'}</span>
              </span>
            );
          }
          if (hasAppt) {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? 'Đã Hẹn Lịch • Chờ KTV Đến' : 'Visit Scheduled • Awaiting Inspector'}</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'vi' ? 'Chờ Người Bán Hẹn Lịch Đón KTV' : 'Awaiting Seller Schedule Visit'}</span>
            </span>
          );
        }
        const isSellerPaysAll = orderItem?.inspectionFeeSplit === 'SELLER_100' || (orderItem ? getPartyInspectionFee(orderItem, false) <= 0 : false);
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {lang === 'vi'
                ? isSellerForThisOrder
                  ? 'Đã Xác Nhận • Đang Chuẩn Bị Gửi Hub'
                  : (isSellerPaysAll ? 'Chờ người bán gửi hàng đến Hub' : 'Người Bán Đã Đồng Ý • Đang Điều Phối Hub')
                : isSellerForThisOrder
                  ? 'Confirmed • Preparing Hub Dispatch'
                  : (isSellerPaysAll ? 'Awaiting seller shipment to Hub' : 'Seller Confirmed • Dispatching to Hub')}
            </span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Chờ Bạn Xác Nhận Kiểm Định' : 'Đã Gửi Yêu Cầu • Chờ Người Bán Xác Nhận'
              : isSellerForThisOrder ? 'Awaiting Your Inspection Confirmation' : 'Inspection Requested • Awaiting Seller'}
          </span>
        </span>
      );
    case 'HELD_IN_ESCROW':
      return hasInspection ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Chờ Bạn Xác Nhận Kiểm Định' : 'Chờ Kiểm Định'
              : isSellerForThisOrder ? 'Awaiting Your Inspection Confirmation' : 'Awaiting Inspection'}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {lang === 'vi'
              ? sellerConfirmed
                ? (isSellerForThisOrder ? 'Đã Ký Quỹ Escrow • Chờ Bạn Giao Hàng' : 'Đã Ký Quỹ Escrow • Chờ Người Bán Giao')
                : (isSellerForThisOrder ? 'Đã Ký Quỹ Escrow • Chờ Bạn Xác Nhận' : 'Đã Ký Quỹ Escrow • Chờ Người Bán Xác Nhận')
              : sellerConfirmed
                ? 'Escrow Protected • Awaiting Shipping'
                : 'Escrow Protected • Awaiting Confirmation'}
          </span>
        </span>
      );
    case 'INSPECTION_IN_PROGRESS':
      {
        const isAtHomeProg = orderItem?.inspectionMethod === 'AT_HOME' || (orderItem as any)?.orderType === 'AT_HOME';
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs">
            <Wrench className="w-3.5 h-3.5 animate-bounce" />
            <span>
              {isAtHomeProg
                ? (lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting')
                : (lang === 'vi' ? 'Đang Kiểm Định Tại Hub' : 'In Hub Inspection')}
            </span>
          </span>
        );
      }
    case 'INSPECTION_PASSED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{lang === 'vi' ? 'Kiểm định đạt chuẩn' : 'Inspection Passed'}</span>
        </span>
      );
    case 'INSPECTION_FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>{lang === 'vi' ? 'Giao dịch đã bị hủy' : 'Transaction cancelled'}</span>
        </span>
      );
    case 'SHIPPED_TO_BUYER':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
          <Truck className="w-3.5 h-3.5" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Đang Giao Tới Người Mua' : 'Đang Giao Hàng Tới Bạn'
              : isSellerForThisOrder ? 'Delivering to Buyer' : 'Delivering to You'}
          </span>
        </span>
      );
    case 'DELIVERED_INSPECTION_WINDOW':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Khách Đang Kiểm Máy (48h)' : 'Đã Giao • 48h Kiểm Tra Đối Soát'
              : isSellerForThisOrder ? 'Buyer Review (48h Window)' : 'Delivered • 48h Inspection Window'}
          </span>
        </span>
      );
    case 'COMPLETED_RELEASED':
    case 'RELEASED':
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {lang === 'vi'
              ? isSellerForThisOrder ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'
              : isSellerForThisOrder ? 'Payout Transferred to Wallet' : 'Completed • Escrow Released'}
          </span>
        </span>
      );
    case 'REFUNDED_TO_BUYER':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>
            {isInspectionOrder
              ? (lang === 'vi' ? 'Giao dịch đã bị hủy' : 'Transaction cancelled')
              : (lang === 'vi' ? (isSellerForThisOrder ? 'Đã Hoàn Tiền Cho Người Mua' : 'Đã Hoàn Tiền Vào Ví') : 'Refunded')}
          </span>
        </span>
      );
    case 'DISPUTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Đang Tranh Chấp • Đóng Băng Escrow' : 'Disputed • Escrow Frozen'}</span>
        </span>
      );
    case 'CANCELLED':
    case 'CANCELED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>{isInspectionOrder
            ? (lang === 'vi' ? 'Giao dịch đã bị hủy' : 'Transaction cancelled')
            : (lang === 'vi' ? 'Đã Hủy Đơn' : 'Cancelled')}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
          <span>{status}</span>
        </span>
      );
  }
}
