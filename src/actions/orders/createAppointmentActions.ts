import type { Dispatch, SetStateAction } from 'react';
import { inspectorService } from '../../services/inspectorService';
import { saveScopedLocalNotification } from '../../utils/notificationStorage';
import type { OrderAppointment } from '../../utils/orders/orderAppointments';

interface Options {
  setApptTick: Dispatch<SetStateAction<number>>;
  setInspectionActionNotice: (message: string | null) => void;
  onRefreshOrders?: () => void;
}

export function createAppointmentActions({
  setApptTick, setInspectionActionNotice, onRefreshOrders,
}: Options) {
  const handleSellerAcceptCounterAppointment = async (orderId: string, appointment: OrderAppointment) => {
    const finalScheduledAt = appointment?.counterScheduledAt || appointment?.scheduledAt;
    const finalShift = appointment?.counterShift || appointment?.shift || 'MORNING';

    // 1. Đồng bộ lên Backend bằng endpoint acceptAppointmentCounter
    const targetInspectionId = appointment?.inspectionOrderId || orderId;
    try {
      await inspectorService.acceptAppointmentCounter(targetInspectionId);
    } catch {
      try {
        if (targetInspectionId !== orderId) {
          await inspectorService.acceptAppointmentCounter(orderId);
        } else if (finalScheduledAt) {
          await inspectorService.scheduleAppointment(
            orderId,
            finalScheduledAt,
            'Người bán đã đồng ý lịch hẹn đề xuất từ Trung tâm',
            finalShift
          );
        }
      } catch (e) {
        console.warn('Backend accept counter fallback:', e);
      }
    }

    const updatedAppointment = {
      ...appointment,
      scheduledAt: finalScheduledAt,
      shift: finalShift,
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      confirmedBy: 'SELLER',
      counterScheduledAt: undefined,
      counterShift: undefined,
      counterNote: undefined,
    };

    const targetIds = new Set<string>([orderId]);
    if (appointment?.linkedOrderId) targetIds.add(appointment.linkedOrderId);

    targetIds.forEach((id) => {
      try {
        localStorage.setItem(`order_appointment_${id}`, JSON.stringify(updatedAppointment));
        localStorage.removeItem(`order_appointment_rejection_${id}`);
      } catch { }
    });

    try {
      const raw = localStorage.getItem('recent_placed_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const updated = list.map((o: any) => {
            if (targetIds.has(o.id) || targetIds.has(o.inspectionOrderId) || targetIds.has(o.linkedOrderId)) {
              return {
                ...o,
                appointmentScheduledAt: finalScheduledAt,
                appointmentStatus: 'CONFIRMED',
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                appointmentRejectionReason: undefined,
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      }
    } catch { }

    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const listCenter = JSON.parse(rawCenter);
        if (Array.isArray(listCenter)) {
          const updatedCenter = listCenter.map((o: any) => {
            if (targetIds.has(o.id) || targetIds.has(o.linkedOrderId) || targetIds.has(o.orderId)) {
              return {
                ...o,
                appointmentScheduledAt: finalScheduledAt,
                appointmentStatus: 'CONFIRMED',
                counterScheduledAt: undefined,
                counterShift: undefined,
                counterNote: undefined,
                appointmentRejectionReason: undefined,
              };
            }
            return o;
          });
          localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
        }
      }
    } catch { }

    setApptTick((t) => t + 1);

    const formattedTime = new Date(finalScheduledAt).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const centerNotif = {
      id: `notif-center-accept-appt-${orderId}-${Date.now()}`,
      recipientRole: 'inspection_center',
      title: `Người bán đã đồng ý lịch hẹn đề xuất: #${orderId.slice(0, 8)}`,
      message: `Người bán đã đồng ý lịch hẹn mới vào ${formattedTime}. Lịch hẹn đã được chốt, sẵn sàng giao task cho KTV!`,
      type: 'INSPECTION_TASK' as const,
      referenceId: orderId,
      referenceType: 'INSPECTION_ORDER',
      actionUrl: '/inspection-center/dispatch',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');

    window.dispatchEvent(new CustomEvent('secondlife_appointment_confirmed', {
      detail: {
        orderId,
        scheduledAt: finalScheduledAt,
        status: 'CONFIRMED',
      }
    }));
    window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId } }));

    setInspectionActionNotice(`Bạn đã đồng ý lịch hẹn mới (${formattedTime}) thành công! Trung tâm sẽ điều phối KTV đến kiểm tra đúng giờ.`);
    setTimeout(() => setInspectionActionNotice(null), 5000);
    onRefreshOrders?.();
  };

  return { handleSellerAcceptCounterAppointment };
}
