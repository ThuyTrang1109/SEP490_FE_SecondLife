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
  RotateCcw,
} from 'lucide-react';
import type { InspectionOrderDto } from '../../../services';
import type { UserProfile } from '../../../types';
import { canBookHubBuyerDelivery, canReadCenterInspectionShipments, getHubBuyerShipmentLabel, getInboundShipmentProgress, hasCenterCounterProposal, isPaidHubBuyerDelivery, shouldTrackInboundShipment, isOrderConfirmedByInspector } from '../../../utils/inspectionCenterData';
import { isExpiredInspectionPurchase, extractInspectionRejectionDetails, getInspectionPurchaseDecision } from '../../../utils/inspectionPurchase';
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
    const isExpired = isExpiredInspectionPurchase(status, order.note || (order as any).rejectionReason);
    const isBuyerReject = getInspectionPurchaseDecision(null, order) === 'rejected' ||
      extractInspectionRejectionDetails(order.note || (order as any).rejectionReason).isBuyerPurchaseRejected;
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Hết hạn mua (Chờ trả hàng)</span>
        </span>
      );
    }
    if (isBuyerReject) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap shadow-2xs">
          <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Khách từ chối mua (Chờ trả hàng)</span>
        </span>
      );
    }
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
    if (order?.orderType === 'AT_HOME' || (order as any)?.inspectionMethod === 'AT_HOME') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Đạt Nghiệm Thu • Người Bán Tự Giao</span>
        </span>
      );
    }
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

    const isBackendConfirmed = (apptStatus === 'CONFIRMED' || order?.status === 'SCHEDULED' || (order as any)?.backendStatus === 'SCHEDULED') && !counterTime;
    const isBackendPendingCenter = apptStatus === 'PENDING_CENTER_CONFIRMATION' && !counterTime;
    if (isBackendConfirmed) {
      counterTime = undefined;
      counterNote = undefined;
      apptStatus = 'CONFIRMED';
    } else if (isBackendPendingCenter) {
      counterTime = undefined;
      counterNote = undefined;
    }

    if (!hasCenterCounterProposal(order) && typeof window !== 'undefined') {
      const possibleIds = [
        order?.id,
        (order as any)?.linkedOrderId,
        (order as any)?.orderId,
        (order as any)?.inspectionOrderId,
      ].filter(Boolean) as string[];

      if (isBackendConfirmed || isBackendPendingCenter) {
        for (const id of possibleIds) {
          try {
            const raw = localStorage.getItem(`order_appointment_${id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.counterScheduledAt || (isBackendConfirmed && parsed.status !== 'CONFIRMED')) {
                delete parsed.counterScheduledAt;
                delete parsed.counterShift;
                delete parsed.counterNote;
                parsed.status = isBackendConfirmed ? 'CONFIRMED' : 'PENDING_CENTER_CONFIRMATION';
                if (order?.appointmentScheduledAt) parsed.scheduledAt = order.appointmentScheduledAt;
                localStorage.setItem(`order_appointment_${id}`, JSON.stringify(parsed));
              }
            }
          } catch { }
        }
      } else {
        for (const id of possibleIds) {
          try {
            const raw = localStorage.getItem(`order_appointment_${id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.status === 'CONFIRMED' || apptStatus === 'CONFIRMED') {
                apptStatus = 'CONFIRMED';
                if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
                counterTime = undefined;
                counterNote = undefined;
              } else if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
                apptStatus = 'PENDING_CENTER_CONFIRMATION';
                if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
                counterTime = undefined;
                counterNote = undefined;
              } else if (parsed.counterScheduledAt) {
                counterTime = parsed.counterScheduledAt;
                if (parsed.counterNote) counterNote = parsed.counterNote;
                apptStatus = 'COUNTERED_BY_CENTER';
              } else {
                if (parsed.scheduledAt && !apptTime) apptTime = parsed.scheduledAt;
                if (parsed.status && !apptStatus) apptStatus = parsed.status;
              }
              break;
            }
          } catch { }
        }
      }

      if (apptStatus !== 'PENDING_CENTER_CONFIRMATION' && apptStatus !== 'CONFIRMED') {
        const idSet = new Set(possibleIds);
        try {
          const rawCenter = localStorage.getItem('center_inspection_orders');
          if (rawCenter) {
            const listCenter = JSON.parse(rawCenter);
            if (Array.isArray(listCenter)) {
              const m = listCenter.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
              if (m) {
                if (m.appointmentStatus === 'CONFIRMED') {
                  apptStatus = 'CONFIRMED';
                  if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                  counterTime = undefined;
                  counterNote = undefined;
                } else if (m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                  if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                  apptStatus = 'PENDING_CENTER_CONFIRMATION';
                  counterTime = undefined;
                  counterNote = undefined;
                }
              }
            }
          }
        } catch { }
        try {
          const rawRecent = localStorage.getItem('recent_placed_orders');
          if (rawRecent && apptStatus !== 'CONFIRMED') {
            const listRecent = JSON.parse(rawRecent);
            if (Array.isArray(listRecent)) {
              const m = listRecent.find((ro: any) => idSet.has(ro.id) || idSet.has(ro.linkedOrderId) || idSet.has(ro.orderId) || idSet.has(ro.inspectionOrderId));
              if (m && m.appointmentStatus === 'CONFIRMED') {
                apptStatus = 'CONFIRMED';
                if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                counterTime = undefined;
                counterNote = undefined;
              }
            }
          }
        } catch { }
        try {
          const rawSeller = localStorage.getItem('my_seller_inspection_orders');
          if (rawSeller && apptStatus !== 'PENDING_CENTER_CONFIRMATION' && apptStatus !== 'CONFIRMED') {
            const listSeller = JSON.parse(rawSeller);
            if (Array.isArray(listSeller)) {
              const m = listSeller.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
              if (m) {
                if (m.appointmentStatus === 'CONFIRMED') {
                  apptStatus = 'CONFIRMED';
                  if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                  counterTime = undefined;
                  counterNote = undefined;
                } else if (m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
                  if (m.appointmentScheduledAt) apptTime = m.appointmentScheduledAt;
                  apptStatus = 'PENDING_CENTER_CONFIRMATION';
                  counterTime = undefined;
                  counterNote = undefined;
                }
              }
            }
          }
        } catch { }
      }
    }

    if (
      apptStatus !== 'CONFIRMED' &&
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

    if ((!apptTime && !counterTime) || apptStatus === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          <span>Chờ Người Bán Hẹn Lịch</span>
        </span>
      );
    }

    const formattedAppt = new Date(apptTime || counterTime).toLocaleString('vi-VN', {
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
          <span>Chờ Duyệt Lịch Hẹn</span>
        </span>
      );
    }

    // 2. Trung tâm đã gửi lại đề xuất mới, chờ Seller phản hồi
    if (apptStatus !== 'CONFIRMED' && (apptStatus === 'COUNTERED_BY_CENTER' || Boolean(counterTime))) {
      const formattedCounter = counterTime ? new Date(counterTime).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }) : formattedAppt;
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-950 border border-sky-300 whitespace-nowrap shadow-2xs" title={`Trung tâm đã gửi đề xuất: ${formattedCounter} • Chờ người bán đồng ý`}>
          <CalendarSync className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          <span>Đã Đề Xuất Lại • Chờ Seller</span>
        </span>
      );
    }

    // 3. Lịch đã chốt (CONFIRMED) nhưng chưa giao KTV
    if (!hasInspector) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-950 border border-orange-300 animate-pulse whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt} • Cần phân công KTV`}>
          <CalendarCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
          <span>Đã Chốt Lịch • Cần Giao KTV</span>
        </span>
      );
    }

    // 4. Đã phân công KTV
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt}`}>
        <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Đã Phân Công KTV</span>
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
          <span>{shipment ? getInboundShipmentProgress(shipment).label : 'Đang giao hàng đến Hub'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
        <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>{showOrderShipments && order && shouldTrackInboundShipment(order) &&
          (!canReadCenterInspectionShipments(order, currentUser?.id) || deniedShipmentOrders.has(order.id))
          ? 'Chưa xem được vận đơn' : 'Chờ người bán gửi hàng đến Hub'}</span>
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

  const isConfirmed = isOrderConfirmedByInspector(order);
  if (!isConfirmed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Đã Phân Công • Chờ KTV Nhận Đơn</span>
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
