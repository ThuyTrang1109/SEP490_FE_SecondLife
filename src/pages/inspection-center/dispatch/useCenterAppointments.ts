import { useState } from 'react';
import { paths } from '../../../app/router/paths';
import { InspectionShift } from '../../../components/modals/ScheduleAppointmentModal';
import { inspectorService, InspectionOrderDto } from '../../../services';
import { saveScopedLocalNotification } from '../../../utils/notificationStorage';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useInspectorAssignment } from './useInspectorAssignment';

interface Options {
  handleOpenAssign: ReturnType<typeof useInspectorAssignment>['handleOpenAssign'];
  setAssignModalOrder: ReturnType<typeof useInspectorAssignment>['setAssignModalOrder'];
  setOrders: ReturnType<typeof useCenterOrders>['setOrders'];
  showNotice: (msg: string) => void;
}

export function useCenterAppointments({ handleOpenAssign, setAssignModalOrder, setOrders, showNotice }: Options) {
  // --- Review / Negotiate Appointment Modal State ---
  const [reviewApptOrder, setReviewApptOrder] = useState<InspectionOrderDto | null>(null);
  const [reviewMode, setReviewMode] = useState<'VIEW' | 'COUNTER'>('VIEW');
  const [counterDate, setCounterDate] = useState<string>('');
  const [counterShift, setCounterShift] = useState<InspectionShift>('AFTERNOON');
  const [counterTime, setCounterTime] = useState<string>('14:00');
  const [counterNote, setCounterNote] = useState<string>('');
  const [counterError, setCounterError] = useState<string | null>(null);
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  const [rejectApptModalOrder, setRejectApptModalOrder] = useState<InspectionOrderDto | null>(null);
  const [rejectApptReason, setRejectApptReason] = useState<string>('');
  const [rejectApptError, setRejectApptError] = useState<string | null>(null);
  const [isRejectingAppt, setIsRejectingAppt] = useState(false);

  // Action: Open Review Appointment Modal (Giai đoạn thương lượng lịch hẹn 2 bên)
  const handleOpenReviewAppointment = (order: InspectionOrderDto) => {
    let resolvedApptTime = order.appointmentScheduledAt;
    let resolvedApptNote = order.appointmentNote;
    let resolvedApptStatus = order.appointmentStatus;
    let resolvedCounterTime = order.counterScheduledAt;
    let resolvedCounterShift = order.counterShift;
    let resolvedCounterNote = order.counterNote;

    setReviewMode('VIEW');
    setCounterError(null);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    let initialDate = tomorrowStr;
    let initialShift: InspectionShift = 'AFTERNOON';
    let initialTime = '14:00';
    let initialNote = '';

    const possibleIds = [order.id, order.linkedOrderId, (order as any).orderId, (order as any).inspectionOrderId].filter(Boolean) as string[];
    const idSet = new Set(possibleIds);

    for (const pid of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${pid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) resolvedApptTime = parsed.scheduledAt;
          if (parsed.note) resolvedApptNote = parsed.note;
          if (parsed.status) resolvedApptStatus = parsed.status;
          if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && !parsed.counterScheduledAt) {
            resolvedCounterTime = undefined;
            resolvedCounterShift = undefined;
            resolvedCounterNote = undefined;
            setReviewMode('VIEW');
            if (parsed.scheduledAt) {
              const sd = new Date(parsed.scheduledAt);
              if (!isNaN(sd.getTime())) {
                initialDate = `${sd.getFullYear()}-${pad(sd.getMonth() + 1)}-${pad(sd.getDate())}`;
                initialShift = parsed.shift === 'MORNING' ? 'AFTERNOON' : 'MORNING';
                initialTime = initialShift === 'AFTERNOON' ? '14:00' : '09:00';
              }
            }
            break;
          } else if (parsed.counterScheduledAt) {
            resolvedCounterTime = parsed.counterScheduledAt;
            resolvedCounterShift = parsed.counterShift;
            resolvedCounterNote = parsed.counterNote;
            const cd = new Date(parsed.counterScheduledAt);
            if (!isNaN(cd.getTime())) {
              initialDate = `${cd.getFullYear()}-${pad(cd.getMonth() + 1)}-${pad(cd.getDate())}`;
              initialTime = `${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
              initialShift = parsed.counterShift || (cd.getHours() >= 13 ? 'AFTERNOON' : 'MORNING');
            }
            if (parsed.counterNote) initialNote = parsed.counterNote;
            setReviewMode('COUNTER');
            break;
          } else if (parsed.scheduledAt) {
            const sd = new Date(parsed.scheduledAt);
            if (!isNaN(sd.getTime())) {
              initialDate = `${sd.getFullYear()}-${pad(sd.getMonth() + 1)}-${pad(sd.getDate())}`;
              initialShift = parsed.shift === 'MORNING' ? 'AFTERNOON' : 'MORNING';
              initialTime = initialShift === 'AFTERNOON' ? '14:00' : '09:00';
            }
          }
        }
      } catch { }
    }

    // Nếu bộ nhớ cache order_appointment_${pid} bị ghi đè, kiểm tra tiếp center_inspection_orders và my_seller_inspection_orders
    if (resolvedApptStatus !== 'PENDING_CENTER_CONFIRMATION') {
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const list = JSON.parse(rawCenter);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
              resolvedApptTime = m.appointmentScheduledAt || resolvedApptTime;
              resolvedApptNote = m.appointmentNote || resolvedApptNote;
              resolvedApptStatus = 'PENDING_CENTER_CONFIRMATION';
              resolvedCounterTime = undefined;
              resolvedCounterShift = undefined;
              resolvedCounterNote = undefined;
            }
          }
        }
      } catch {}
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller && resolvedApptStatus !== 'PENDING_CENTER_CONFIRMATION') {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
            if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && !m.counterScheduledAt) {
              resolvedApptTime = m.appointmentScheduledAt || resolvedApptTime;
              resolvedApptNote = m.appointmentNote || resolvedApptNote;
              resolvedApptStatus = 'PENDING_CENTER_CONFIRMATION';
              resolvedCounterTime = undefined;
              resolvedCounterShift = undefined;
              resolvedCounterNote = undefined;
            }
          }
        }
      } catch {}
    }

    if (resolvedApptStatus === 'PENDING_CENTER_CONFIRMATION') {
      resolvedCounterTime = undefined;
      resolvedCounterShift = undefined;
      resolvedCounterNote = undefined;
      setReviewMode('VIEW');

      // Tự động chữa lành order_appointment_${pid} để modal render đồng bộ hoàn toàn
      possibleIds.forEach((pid) => {
        try {
          localStorage.setItem(`order_appointment_${pid}`, JSON.stringify({
            scheduledAt: resolvedApptTime,
            note: resolvedApptNote || '',
            shift: initialShift,
            status: 'PENDING_CENTER_CONFIRMATION',
            counterScheduledAt: undefined,
            counterShift: undefined,
            counterNote: undefined,
          }));
        } catch {}
      });
    } else if (!initialNote && (order as any).counterScheduledAt) {
      const cd = new Date((order as any).counterScheduledAt);
      if (!isNaN(cd.getTime())) {
        initialDate = `${cd.getFullYear()}-${pad(cd.getMonth() + 1)}-${pad(cd.getDate())}`;
        initialTime = `${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
        initialShift = (order as any).counterShift || (cd.getHours() >= 13 ? 'AFTERNOON' : 'MORNING');
      }
      if ((order as any).counterNote) initialNote = (order as any).counterNote;
      setReviewMode('COUNTER');
    }

    const resolvedOrder: InspectionOrderDto = {
      ...order,
      appointmentScheduledAt: resolvedApptTime,
      appointmentNote: resolvedApptNote,
      appointmentStatus: resolvedApptStatus,
      counterScheduledAt: resolvedCounterTime,
      counterShift: resolvedCounterShift,
      counterNote: resolvedCounterNote,
    };
    setReviewApptOrder(resolvedOrder);

    // Đảm bảo initialTime luôn đúng định dạng HH:mm và nằm trong khung giờ của Ca làm việc
    const parsedInitialHour = parseInt(initialTime.slice(0, 2), 10);
    if (initialShift === 'MORNING' && (isNaN(parsedInitialHour) || parsedInitialHour < 8 || parsedInitialHour >= 12)) {
      initialTime = '09:00';
    } else if (initialShift === 'AFTERNOON' && (isNaN(parsedInitialHour) || parsedInitialHour < 13 || parsedInitialHour > 17)) {
      initialTime = '14:00';
    }

    setCounterDate(initialDate);
    setCounterShift(initialShift);
    setCounterTime(initialTime.slice(0, 5));
    setCounterNote(initialNote || 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
  };

  // Action: Accept Seller's Appointment
  const handleConfirmAcceptAppointment = async () => {
    if (!reviewApptOrder) return;
    setIsSubmittingAccept(true);
    try {
      const orderId = reviewApptOrder.id;

      try {
        await inspectorService.confirmAppointment(orderId);
      } catch (e) {
        console.warn('Backend confirm appointment fallback:', e);
      }

      let apptTime = reviewApptOrder.appointmentScheduledAt;
      let apptNote = reviewApptOrder.appointmentNote || '';
      let apptShift: InspectionShift = 'MORNING';

      try {
        const raw = localStorage.getItem(`order_appointment_${orderId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
          if (parsed.note) apptNote = parsed.note;
          if (parsed.shift) apptShift = parsed.shift;
        }
      } catch { }

      const updatedAppointment = {
        scheduledAt: apptTime,
        note: apptNote,
        shift: apptShift,
        status: 'CONFIRMED' as const,
        confirmedAt: new Date().toISOString(),
        confirmedBy: 'CENTER' as const,
      };
      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify(updatedAppointment));

      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentStatus: 'CONFIRMED',
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
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentStatus: 'CONFIRMED',
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const listSeller = JSON.parse(rawSeller);
          if (Array.isArray(listSeller)) {
            const updatedSeller = listSeller.map((o: any) => {
              if (o.id === orderId || o.linkedOrderId === orderId || o.orderId === orderId) {
                return {
                  ...o,
                  appointmentStatus: 'CONFIRMED',
                };
              }
              return o;
            });
            localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updatedSeller));
          }
        }
      } catch { }

      try {
        const sellerId = (reviewApptOrder as any).sellerId || (reviewApptOrder as any).listing?.sellerId;
        const codeDisplay = (reviewApptOrder.id || '').slice(0, 8);
        const formattedAppt = apptTime ? new Date(apptTime).toLocaleString('vi-VN') : 'lịch đã chọn';
        const sellerNotif = {
          id: `notif-seller-accept-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Lịch hẹn kiểm định tại nhà #${codeDisplay} đã được chấp nhận`,
          message: `Trung tâm SecondLife đã chấp nhận lịch hẹn vào ${formattedAppt}. Trạm đang điều phối KTV phụ trách đến kiểm tra thiết bị!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', orderId) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      const confirmedOrder: InspectionOrderDto = {
        ...reviewApptOrder,
        appointmentStatus: 'CONFIRMED',
      };

      setOrders((prev) => prev.map((o) => o.id === orderId ? confirmedOrder : o));

      window.dispatchEvent(new CustomEvent('secondlife_appointment_confirmed', {
        detail: { orderId, scheduledAt: apptTime, status: 'CONFIRMED' },
      }));
      window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId } }));

      showNotice(`Đã chấp nhận lịch hẹn #${(orderId || '').slice(0, 8)} thành công! Bạn có thể giao task cho KTV ngay.`);
      setReviewApptOrder(null);

      // Mở ngay modal Phân công KTV
      setTimeout(() => {
        handleOpenAssign(confirmedOrder);
      }, 300);
    } catch (err: any) {
      showNotice(err?.message || 'Không thể chấp nhận lịch hẹn. Vui lòng thử lại.');
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  // Action: Send Counter-Proposal to Seller
  const handleConfirmSendCounter = async () => {
    if (!reviewApptOrder) return;

    let existingCounter = reviewApptOrder.counterScheduledAt;
    try {
      const checkIds = [reviewApptOrder.id, reviewApptOrder.linkedOrderId, (reviewApptOrder as any).orderId].filter(Boolean);
      for (const tid of checkIds) {
        const raw = localStorage.getItem(`order_appointment_${tid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.counterScheduledAt) {
            existingCounter = parsed.counterScheduledAt;
            break;
          }
        }
      }
    } catch { }

    if (existingCounter || reviewApptOrder.appointmentStatus === 'COUNTERED_BY_CENTER' || reviewApptOrder.status === 'WAITING_SELLER_APPROVAL') {
      setCounterError('Trung tâm đã gửi đề xuất lịch mới trước đó. Đang chờ người bán phản hồi (Đồng ý hoặc Hẹn lại), không thể gửi tiếp đề xuất lần 2.');
      return;
    }

    if (!counterDate) {
      setCounterError('Vui lòng chọn ngày đề xuất mới');
      return;
    }
    if (!counterTime) {
      setCounterError('Vui lòng chọn giờ KTV có mặt');
      return;
    }
    if (!counterNote.trim()) {
      setCounterError('Vui lòng nhập lý do/ghi chú đề xuất lại cho người bán');
      return;
    }

    const timePart = counterTime?.includes(':') ? counterTime.slice(0, 5) : '14:00';
    const scheduledDate = new Date(`${counterDate}T${timePart}:00`);
    if (isNaN(scheduledDate.getTime())) {
      setCounterError('Ngày giờ đề xuất không hợp lệ');
      return;
    }

    setIsSubmittingCounter(true);
    setCounterError(null);
    try {
      const orderId = reviewApptOrder.id;
      const linkedId = reviewApptOrder.linkedOrderId || (reviewApptOrder as any).orderId;
      const targetIds = new Set<string>([orderId]);
      if (linkedId) targetIds.add(linkedId);

      try {
        await inspectorService.counterAppointment(
          orderId,
          scheduledDate.toISOString(),
          counterNote.trim(),
          counterShift
        );
      } catch (e: any) {
        if (e?.status === 409 || e?.message?.includes('không còn ở trạng thái cho phép thao tác')) {
          setCounterError('Lịch hẹn hiện không còn ở trạng thái cho phép gửi đề xuất mới (đang chờ người bán phản hồi).');
        } else {
          console.warn('Backend counter appointment fallback:', e);
        }
      }

      let prevScheduledAt = reviewApptOrder.appointmentScheduledAt;
      let prevNote = reviewApptOrder.appointmentNote;
      try {
        const raw = localStorage.getItem(`order_appointment_${orderId}`) || (linkedId ? localStorage.getItem(`order_appointment_${linkedId}`) : null);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) prevScheduledAt = parsed.scheduledAt;
          if (parsed.note) prevNote = parsed.note;
        }
      } catch { }

      const counterRecord = {
        scheduledAt: prevScheduledAt,
        note: prevNote,
        status: 'COUNTERED_BY_CENTER' as const,
        counterScheduledAt: scheduledDate.toISOString(),
        counterShift,
        counterNote: counterNote.trim(),
        counteredAt: new Date().toISOString(),
        linkedOrderId: linkedId,
      };

      const rejectionRecord = {
        reason: counterNote.trim(),
        rejectedAt: new Date().toISOString(),
        replacedByCounter: true,
      };

      targetIds.forEach((id) => {
        try {
          localStorage.setItem(`order_appointment_${id}`, JSON.stringify(counterRecord));
          localStorage.setItem(`order_appointment_rejection_${id}`, JSON.stringify(rejectionRecord));
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
                  appointmentStatus: 'COUNTERED_BY_CENTER',
                  counterScheduledAt: scheduledDate.toISOString(),
                  counterShift,
                  counterNote: counterNote.trim(),
                  appointmentRejectionReason: counterNote.trim(),
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
                  appointmentStatus: 'COUNTERED_BY_CENTER',
                  counterScheduledAt: scheduledDate.toISOString(),
                  counterShift,
                  counterNote: counterNote.trim(),
                  appointmentRejectionReason: counterNote.trim(),
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const listSeller = JSON.parse(rawSeller);
          if (Array.isArray(listSeller)) {
            const updatedSeller = listSeller.map((o: any) => {
              if (targetIds.has(o.id) || targetIds.has(o.linkedOrderId) || targetIds.has(o.orderId)) {
                return {
                  ...o,
                  appointmentStatus: 'COUNTERED_BY_CENTER',
                  counterScheduledAt: scheduledDate.toISOString(),
                  counterShift,
                  counterNote: counterNote.trim(),
                  appointmentRejectionReason: counterNote.trim(),
                };
              }
              return o;
            });
            localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updatedSeller));
          }
        }
      } catch { }

      try {
        const sellerId = (reviewApptOrder as any).sellerId || (reviewApptOrder as any).listing?.sellerId;
        const codeDisplay = (reviewApptOrder.id || '').slice(0, 8);
        const formattedDate = scheduledDate.toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const shiftLabel = counterShift === 'MORNING' ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)';
        const sellerNotif = {
          id: `notif-seller-counter-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Trung tâm kiểm định đề xuất lịch hẹn mới: #${codeDisplay}`,
          message: `Trung tâm SecondLife đề xuất dời lịch hẹn sang ${formattedDate} (${shiftLabel}). Lý do: "${counterNote.trim()}". Vui lòng vào trang đơn hàng để xem và xác nhận!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', orderId) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      setOrders((prev) => prev.map((o) => o.id === orderId ? {
        ...o,
        appointmentStatus: 'COUNTERED_BY_CENTER',
        counterScheduledAt: scheduledDate.toISOString(),
        counterShift,
        counterNote: counterNote.trim(),
      } : o));

      window.dispatchEvent(new CustomEvent('secondlife_appointment_countered', {
        detail: {
          orderId,
          linkedOrderId: linkedId,
          counterScheduledAt: scheduledDate.toISOString(),
          counterShift,
          counterNote: counterNote.trim(),
        }
      }));
      window.dispatchEvent(new CustomEvent('secondlife_appointment_rejected', {
        detail: {
          orderId,
          linkedOrderId: linkedId,
          reason: counterNote.trim(),
          replacedByCounter: true,
        }
      }));
      window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId, linkedOrderId: linkedId } }));

      showNotice(`Đã gửi đề xuất lịch mới cho người bán đơn #${(orderId || '').slice(0, 8)} thành công!`);
      setReviewApptOrder(null);
    } catch (err: any) {
      setCounterError(err?.message || 'Không thể gửi đề xuất lịch hẹn');
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  // Action: Reject Appointment for AT_HOME Order
  const handleRejectAppointment = async () => {
    if (!rejectApptModalOrder) return;
    const reason = rejectApptReason.trim();
    if (!reason) {
      setRejectApptError('Vui lòng nhập lý do từ chối lịch hẹn để người bán nắm rõ thông tin.');
      return;
    }

    setIsRejectingAppt(true);
    setRejectApptError(null);
    try {
      const orderId = rejectApptModalOrder.id;

      // 1. Lưu thông tin từ chối vào localStorage
      const rejectionRecord = {
        orderId,
        rejectedAt: new Date().toISOString(),
        reason,
        previousScheduledAt: rejectApptModalOrder.appointmentScheduledAt,
      };
      localStorage.setItem(`order_appointment_rejection_${orderId}`, JSON.stringify(rejectionRecord));
      localStorage.removeItem(`order_appointment_${orderId}`);
      localStorage.removeItem(`order_assigned_inspector_${orderId}`);

      // 2. Cập nhật recent_placed_orders
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentScheduledAt: null,
                  appointmentStatus: 'REJECTED',
                  appointmentRejectionReason: reason,
                  inspectorId: null,
                  inspectorName: null,
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      // 3. Cập nhật center_inspection_orders
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const listCenter = JSON.parse(rawCenter);
          if (Array.isArray(listCenter)) {
            const updatedCenter = listCenter.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentScheduledAt: null,
                  appointmentStatus: 'REJECTED',
                  appointmentRejectionReason: reason,
                  inspectorId: null,
                  inspectorName: null,
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      // 4. Gửi thông báo cho Seller
      try {
        const sellerId = (rejectApptModalOrder as any).sellerId || (rejectApptModalOrder as any).listing?.sellerId;
        const codeDisplay = (rejectApptModalOrder.id || '').slice(0, 8);
        const sellerNotif = {
          id: `notif-seller-reject-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Lịch hẹn kiểm định tại nhà #${codeDisplay} đã bị từ chối`,
          message: `Trung tâm SecondLife đã từ chối lịch hẹn của bạn. Lý do: "${reason}". Vui lòng vào trang Đơn Hàng để đặt lại lịch hẹn phù hợp hơn!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: `/orders/seller?search=${encodeURIComponent(orderId)}`,
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      // 5. Cập nhật state danh sách đơn trong Hub
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
              ...o,
              appointmentScheduledAt: undefined,
              appointmentStatus: 'REJECTED',
              appointmentRejectionReason: reason,
              inspectorId: undefined,
              inspectorName: undefined,
            }
            : o
        )
      );

      // 6. Phát tín hiệu realtime
      window.dispatchEvent(
        new CustomEvent('secondlife_appointment_rejected', {
          detail: { orderId, reason },
        })
      );
      window.dispatchEvent(
        new CustomEvent('secondlife_order_assigned_signal', {
          detail: { orderId },
        })
      );

      setRejectApptModalOrder(null);
      setRejectApptReason('');
      setAssignModalOrder(null);
    } catch (err: any) {
      setRejectApptError(err?.message || 'Có lỗi xảy ra khi từ chối lịch hẹn.');
    } finally {
      setIsRejectingAppt(false);
    }
  };

  return {
    counterDate,
    counterError,
    counterNote,
    counterShift,
    counterTime,
    handleConfirmAcceptAppointment,
    handleConfirmSendCounter,
    handleOpenReviewAppointment,
    handleRejectAppointment,
    isRejectingAppt,
    isSubmittingAccept,
    isSubmittingCounter,
    rejectApptError,
    rejectApptModalOrder,
    rejectApptReason,
    reviewApptOrder,
    reviewMode,
    setCounterDate,
    setCounterError,
    setCounterNote,
    setCounterShift,
    setCounterTime,
    setRejectApptError,
    setRejectApptModalOrder,
    setRejectApptReason,
    setReviewApptOrder,
    setReviewMode,
  };
}
