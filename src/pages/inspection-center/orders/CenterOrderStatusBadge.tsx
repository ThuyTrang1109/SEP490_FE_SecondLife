import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Truck,
  Package,
  PackageCheck,
  CalendarCheck,
  CalendarSync,
  CreditCard,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { InspectionOrderDto } from '../../../services';
import type { UserProfile } from '../../../types';
import { canBookHubBuyerDelivery, canReadCenterInspectionShipments, getHubBuyerShipmentLabel, getInboundShipmentProgress, isPaidHubBuyerDelivery, shouldTrackInboundShipment } from '../../../utils/inspectionCenterData';
import { hasLocalShipmentSignal } from './shipmentTrackingConfig';
import type { useCenterShipments } from './useCenterShipments';

interface Props {
  order: InspectionOrderDto;
  buyerShipments: ReturnType<typeof useCenterShipments>['buyerShipments'];
  currentUser: UserProfile | null | undefined;
  deniedShipmentOrders: ReturnType<typeof useCenterShipments>['deniedShipmentOrders'];
  inboundShipments: ReturnType<typeof useCenterShipments>['inboundShipments'];
  isOrderReceivedAtHub: ReturnType<typeof useCenterShipments>['isOrderReceivedAtHub'];
  showOrderShipments: boolean;
}

export function CenterOrderStatusBadge({ order, buyerShipments, currentUser, deniedShipmentOrders, inboundShipments, isOrderReceivedAtHub, showOrderShipments }: Props) {
  const rawStatus = order.status || '';
  const status = String(rawStatus).toUpperCase();

  const isCancelled = status === 'CANCELLED' || status === 'CANCELED' || order?.status === 'CANCELLED' || order?.status === 'CANCELED';
  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap shadow-2xs">
        <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Đã Hủy</span>
      </span>
    );
  }

  if (status === 'PASSED' || status === 'COMPLETED' || status === 'INSPECTION_PASSED' || order?.status === 'PASSED' || order?.status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Đạt Nghiệm Thu</span>
      </span>
    );
  }

  if (status === 'FAILED' || status === 'REJECTED' || status === 'INSPECTION_FAILED' || order?.status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap shadow-2xs">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>Từ Chối / Fail</span>
      </span>
    );
  }

  if (status === 'WAITING_SELLER_APPROVAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
        <span>Chờ Bán Duyệt</span>
      </span>
    );
  }

  if (status === 'WAITING_BUYER_APPROVAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
        <span>Chờ Mua Duyệt</span>
      </span>
    );
  }

  if (status === 'WAITING_FEE_PAYMENT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
        <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>Chờ Đóng Phí KĐ</span>
      </span>
    );
  }

  if (status === 'PAYMENT_EXPIRED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap shadow-2xs">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Hết Hạn Nộp Phí</span>
      </span>
    );
  }

  if (status === 'DELIVERING_TO_BUYER') {
    const delivery = buyerShipments.get(order?.id);
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-300 whitespace-nowrap shadow-2xs">
        <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span>{order && isPaidHubBuyerDelivery(order)
          ? canBookHubBuyerDelivery(delivery) ? 'Chờ tạo vận đơn giao người mua'
            : delivery ? getHubBuyerShipmentLabel(delivery) : 'Đã thanh toán · Đang kiểm tra vận đơn'
          : 'Đang Giao Cho Người Mua'}</span>
      </span>
    );
  }

  if (status === 'DISPUTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 whitespace-nowrap shadow-2xs">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
        <span>Đang Khiếu Nại</span>
      </span>
    );
  }

  // --- PHÂN HÓA RÕ ĐƠN KIỂM ĐỊNH TẠI NHÀ VS TẠI HUB ---
  const isAtHome = order?.orderType === 'AT_HOME';
  const hasInspector = Boolean(order?.inspectorId);

  if (isAtHome) {
    // 1. Kiểm định tại nhà khách
    let apptTime = order?.appointmentScheduledAt;
    let apptStatus = (order as any)?.appointmentStatus;
    let counterTime = (order as any)?.counterScheduledAt;
    let counterNote = (order as any)?.counterNote;

    if (typeof window !== 'undefined') {
      const possibleIds = [
        order?.id,
        (order as any)?.linkedOrderId,
        (order as any)?.orderId,
        (order as any)?.inspectionOrderId,
      ].filter(Boolean) as string[];

      for (const id of possibleIds) {
        try {
          const raw = localStorage.getItem(`order_appointment_${id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
            if (parsed.status) apptStatus = parsed.status;
            if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
              counterTime = undefined;
              counterNote = undefined;
            } else {
              if (parsed.counterScheduledAt) counterTime = parsed.counterScheduledAt;
              if (parsed.counterNote) counterNote = parsed.counterNote;
            }
            break;
          }
        } catch {}
      }

      if (apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
        const idSet = new Set(possibleIds);
        try {
          const rawCenter = localStorage.getItem('center_inspection_orders');
          if (rawCenter) {
            const listCenter = JSON.parse(rawCenter);
            if (Array.isArray(listCenter)) {
              const m = listCenter.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
              if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                apptStatus = 'PENDING_CENTER_CONFIRMATION';
                counterTime = undefined;
              }
            }
          }
        } catch {}
        try {
          const rawSeller = localStorage.getItem('my_seller_inspection_orders');
          if (rawSeller && apptStatus !== 'PENDING_CENTER_CONFIRMATION') {
            const listSeller = JSON.parse(rawSeller);
            if (Array.isArray(listSeller)) {
              const m = listSeller.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
              if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                apptStatus = 'PENDING_CENTER_CONFIRMATION';
                counterTime = undefined;
              }
            }
          }
        } catch {}
      }
    }

    if (
      apptStatus !== 'PENDING_CENTER_CONFIRMATION' &&
      (
        (counterTime && !hasInspector) ||
        order?.status === 'WAITING_SELLER_APPROVAL' ||
        (order as any)?.customerStatus === 'WAITING_SELLER_APPROVAL' ||
        String((order as any)?.backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL' ||
        apptStatus === 'COUNTERED_BY_CENTER'
      )
    ) {
      apptStatus = 'COUNTERED_BY_CENTER';
    }

    if (!apptTime || apptStatus === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          <span>Chờ Người Bán Hẹn Lịch</span>
        </span>
      );
    }

    const formattedAppt = new Date(apptTime).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

    // 1. Chờ Trung tâm duyệt đề xuất của Người bán
    if (apptStatus === 'PENDING_CENTER_CONFIRMATION' || apptStatus === 'PENDING_CONFIRMATION') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 whitespace-nowrap shadow-2xs" title={`Người bán đề xuất: ${formattedAppt} • Chờ Trung tâm xem và duyệt`}>
          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Đề Xuất {formattedAppt} • Chờ Duyệt</span>
        </span>
      );
    }

    // 2. Trung tâm đã gửi lại đề xuất mới, chờ Seller phản hồi
    if (apptStatus === 'COUNTERED_BY_CENTER' || Boolean(counterTime)) {
      const formattedCounter = counterTime ? new Date(counterTime).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }) : formattedAppt;
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-950 border border-sky-300 whitespace-nowrap shadow-2xs" title={`Trung tâm đã gửi đề xuất: ${formattedCounter} • Chờ người bán đồng ý`}>
          <CalendarSync className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          <span>Đã Gửi Lịch {formattedCounter} • Chờ Seller</span>
        </span>
      );
    }

    // 3. Lịch đã chốt (CONFIRMED) nhưng chưa giao KTV
    if (!hasInspector) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-950 border border-orange-300 animate-pulse whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt} • Cần phân công KTV`}>
          <CalendarCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
          <span>Đã Chốt {formattedAppt} • Cần Giao KTV</span>
        </span>
      );
    }

    // 4. Đã phân công KTV
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt}`}>
        <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Đã Phân Công KTV ({formattedAppt})</span>
      </span>
    );
  }

  // 2. Kiểm định tại Lab Hub (AT_CENTER)
  const isHubReceived = isOrderReceivedAtHub(order);
  if (!isHubReceived) {
    const shipment = showOrderShipments ? inboundShipments.get(order?.id) : undefined;
    const isShipping = status === 'SHIPPING_TO_CENTER' ||
      (!showOrderShipments && hasLocalShipmentSignal(order));
    if (shipment || isShipping) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 whitespace-nowrap shadow-2xs">
          <Truck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          <span>{shipment ? getInboundShipmentProgress(shipment).label : 'Đang giao hàng về Hub'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
        <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>{showOrderShipments && order && shouldTrackInboundShipment(order) &&
          (!canReadCenterInspectionShipments(order, currentUser?.id) || deniedShipmentOrders.has(order.id))
          ? 'Chưa xem được vận đơn' : 'Chờ Người Bán Gửi Hub'}</span>
      </span>
    );
  }

  // Kiện hàng ĐÃ VỀ HUB:
  if (!hasInspector) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse whitespace-nowrap shadow-2xs">
        <PackageCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
        <span>Đã Nhận Hàng • Chờ Giao KTV</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap shadow-2xs">
      <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      <span>Đang trong quá trình kiểm định</span>
    </span>
  );
}
