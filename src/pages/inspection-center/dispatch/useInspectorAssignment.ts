import { getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from './orderContacts';
import { useState, useEffect } from 'react';
import { paths } from '../../../app/router/paths';
import { inspectorService, InspectionOrderDto } from '../../../services';
import { getCenterDispatchStage, isInspectorAssignmentLocked } from '../../../utils/inspectionCenterData';
import { saveScopedLocalNotification } from '../../../utils/notificationStorage';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useCenterShipments } from '../orders/useCenterShipments';
import type { useCenterStaff } from '../staff/useCenterStaff';

interface Options {
  isOrderReceivedAtHub: ReturnType<typeof useCenterShipments>['isOrderReceivedAtHub'];
  orders: ReturnType<typeof useCenterOrders>['orders'];
  setOrders?: ReturnType<typeof useCenterOrders>['setOrders'];
  showNotice: (msg: string) => void;
  staffList: ReturnType<typeof useCenterStaff>['staffList'];
}

export function useInspectorAssignment({ isOrderReceivedAtHub, orders, setOrders, showNotice, staffList }: Options) {
  // --- Assign Modal State ---
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);

  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [assignNote, setAssignNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignModalOrder) return;
    setSelectedInspectorId((selected) => {
      if (staffList.some((staff) => staff.id === selected)) return selected;
      return staffList.find((staff) => staff.id === assignModalOrder.inspectorId)?.id ?? staffList[0]?.id ?? '';
    });
  }, [assignModalOrder, staffList]);

  const handleOpenAssign = (order: InspectionOrderDto) => {
    setAssignError(null);
    if (isInspectorAssignmentLocked(order)) {
      showNotice('Kỹ thuật viên đã xác nhận đơn hoặc đang tiến hành kiểm định. Quyền đổi KTV đã bị khóa.');
      return;
    }

    // Mở modal ngay lập tức (0ms latency), không chặn UI chờ mạng
    const resolvedAddr = getOrderSellerAddress(order);
    const resolvedPhone = getOrderSellerPhone(order);
    const resolvedName = getOrderSellerName(order);
    setAssignModalOrder({
      ...order,
      sellerAddress: resolvedAddr,
      sellerPhone: resolvedPhone,
      sellerName: resolvedName,
    });
    setSelectedInspectorId(staffList.find((staff) => staff.id === order.inspectorId)?.id ?? staffList[0]?.id ?? '');
    const savedDispatchNote = localStorage.getItem(`order_dispatch_note_${order.id}`) || '';
    setAssignNote(savedDispatchNote);

    // Kiểm tra chạy nền (non-blocking) để tự động đóng modal nếu KTV vừa ấn nhận đơn ở máy khác
    inspectorService.getOrder(order.id, { bypassCache: true }).then((latestOrder) => {
      if (latestOrder && isInspectorAssignmentLocked(latestOrder)) {
        if (setOrders) {
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? { ...o, ...latestOrder, inspectorConfirmed: true } : o))
          );
        }
        setAssignModalOrder(null);
        showNotice('Kỹ thuật viên đã xác nhận tiếp nhận đơn này. Quyền đổi KTV đã bị khóa!');
      }
    }).catch(() => {
      // Tiếp tục nếu mạng bận hoặc đơn giả lập
    });
  };

  // Action: Submit Assign Inspector
  const handleConfirmAssign = async () => {
    setAssignError(null);
    if (!assignModalOrder) return;

    const currentOrder = orders.find((order) => order.id === assignModalOrder.id);
    if (!currentOrder) {
      setAssignError('Đơn không còn trong danh sách điều phối của trung tâm.');
      return;
    }

    if (isInspectorAssignmentLocked(currentOrder)) {
      setAssignError('Kỹ thuật viên đã xác nhận đơn hoặc đang tiến hành kiểm định. Quyền đổi KTV đã bị khóa.');
      return;
    }

    if (!staffList.some((staff) => staff.id === selectedInspectorId)) {
      setAssignError('Vui lòng chọn kỹ thuật viên kiểm định từ danh sách trước khi xác nhận.');
      return;
    }

    const stage = getCenterDispatchStage(currentOrder, isOrderReceivedAtHub(currentOrder));
    if (!stage || stage === 'WAITING_HUB_RECEIPT') {
      setAssignError(stage === 'WAITING_HUB_RECEIPT'
        ? 'Chờ hàng đến Hub trước khi phân công kỹ thuật viên.'
        : 'Đơn kiểm định hiện không ở giai đoạn điều phối.');
      return;
    }

    setIsAssigning(true);
    // Tái kiểm tra với Backend ngay trước khi gửi lệnh điều phối
    try {
      const latestOrder = await inspectorService.getOrder(assignModalOrder.id, { bypassCache: true });
      if (latestOrder && isInspectorAssignmentLocked(latestOrder)) {
        if (setOrders) {
          setOrders((prev) =>
            prev.map((o) => (o.id === assignModalOrder.id ? { ...o, ...latestOrder, inspectorConfirmed: true } : o))
          );
        }
        setAssignError('Kỹ thuật viên đã xác nhận tiếp nhận đơn này. Quyền đổi KTV đã bị khóa!');
        setIsAssigning(false);
        return;
      }
    } catch {
      // Tiếp tục
    }
    try {
      const assignedOrder = await inspectorService.assignInspector(assignModalOrder.id, selectedInspectorId);

      const inspectorObj = staffList.find((s) => s.id === selectedInspectorId);
      const inspectorName = assignedOrder.inspectorName || inspectorObj?.fullName || 'Kỹ thuật viên';
      const inspectorEmail = inspectorObj?.email;
      const inspectorPhone = inspectorObj?.phone;

      // Extract and package seller details to send with the task assignment for inspector
      const resolvedSellerAddress = getOrderSellerAddress(assignModalOrder);
      const resolvedSellerPhone = getOrderSellerPhone(assignModalOrder);
      const resolvedSellerName = getOrderSellerName(assignModalOrder);

      // Persist assignment mapping and internal dispatch instructions for KTV
      const trimmedDispatchNote = assignNote.trim();
      if (trimmedDispatchNote) {
        localStorage.setItem(`order_dispatch_note_${assignModalOrder.id}`, trimmedDispatchNote);
      } else {
        localStorage.removeItem(`order_dispatch_note_${assignModalOrder.id}`);
      }

      // Xóa triệt để mọi cờ xác nhận KTV cũ đối với đơn này (cho mọi biến thể ID)
      const allTargetIds = [
        assignModalOrder.id,
        (assignModalOrder as any).orderId,
        (assignModalOrder as any).linkedOrderId,
        (assignModalOrder as any).inspectionOrderId,
      ].filter(Boolean) as string[];

      allTargetIds.forEach((id) => {
        localStorage.removeItem(`order_confirmed_by_inspector_${id}`);
        localStorage.removeItem(`order_confirmed_by_inspector_at_${id}`);
        localStorage.removeItem(`inspection_status_${id}`);
        localStorage.removeItem(`inspector_confirmed_order_${id}`);
      });

      localStorage.setItem(
        `order_assigned_inspector_${assignModalOrder.id}`,
        JSON.stringify({
          inspectorId: selectedInspectorId,
          inspectorName: inspectorName,
          inspectorEmail: inspectorEmail,
          inspectorPhone: inspectorPhone,
          sellerName: resolvedSellerName,
          sellerPhone: resolvedSellerPhone,
          sellerAddress: resolvedSellerAddress,
          dispatchNote: trimmedDispatchNote || undefined,
          appointmentScheduledAt: assignModalOrder.appointmentScheduledAt,
          appointmentNote: assignModalOrder.appointmentNote,
          assignedAt: new Date().toISOString(),
        })
      );

      // Update recent_placed_orders
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((o: any) => {
            if (allTargetIds.includes(o.id) || allTargetIds.includes(o.linkedOrderId) || allTargetIds.includes(o.inspectionOrderId)) {
              return {
                ...o,
                inspectorId: selectedInspectorId,
                inspectorName: inspectorName,
                inspectorEmail: inspectorEmail,
                sellerAddress: resolvedSellerAddress,
                sellerPhone: resolvedSellerPhone,
                sellerName: resolvedSellerName,
                inspectorConfirmed: false,
                status: assignedOrder.status || 'DISPATCHED',
                backendStatus: assignedOrder.status || 'DISPATCHED',
                inspectionStatus: 'DISPATCHED',
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }

      // Update center_inspection_orders with the assignment returned by BE.
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        let listCenter = rawCenter ? JSON.parse(rawCenter) : [];
        if (!Array.isArray(listCenter)) listCenter = [];
        const existingIdx = listCenter.findIndex((o: any) => allTargetIds.includes(o.id) || allTargetIds.includes(o.linkedOrderId) || allTargetIds.includes(o.inspectionOrderId));
        if (existingIdx >= 0) {
          listCenter[existingIdx] = {
            ...listCenter[existingIdx],
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            inspectorConfirmed: false,
            status: assignedOrder.status || 'DISPATCHED',
            backendStatus: assignedOrder.status || 'DISPATCHED',
            customerStatus: undefined,
          };
        } else {
          listCenter.unshift({
            ...assignModalOrder,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            inspectorConfirmed: false,
            status: assignedOrder.status || 'DISPATCHED',
            backendStatus: assignedOrder.status || 'DISPATCHED',
          });
        }
        localStorage.setItem('center_inspection_orders', JSON.stringify(listCenter));
      } catch { }

      // Cập nhật ngay vào state orders của Hub để CenterDispatch hiển thị nút "Đổi KTV" khả dụng
      if (setOrders) {
        setOrders((prev) => prev.map((ord) => {
          if (allTargetIds.includes(ord.id)) {
            return {
              ...ord,
              inspectorId: selectedInspectorId,
              inspectorName: inspectorName,
              inspectorEmail: inspectorEmail,
              inspectorConfirmed: false,
              status: assignedOrder.status || 'DISPATCHED',
              backendStatus: assignedOrder.status || 'DISPATCHED',
            };
          }
          return ord;
        }));
      }

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('secondlife_inspection_channel');
          bc.postMessage({ type: 'ORDER_ASSIGNED', orderId: assignModalOrder.id, inspectorId: selectedInspectorId });
          bc.close();
        }
      } catch { }

      // Send local scoped notification for the Seller and Inspector
      try {
        const isAtHome = assignModalOrder.orderType === 'AT_HOME';
        const sellerId = (assignModalOrder as any).sellerId || (assignModalOrder as any).listing?.sellerId;
        const codeDisplay = (assignModalOrder.id || '').slice(0, 8);

        // Seller notification
        const sellerNotif = {
          id: `notif-seller-assign-${assignModalOrder.id}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: isAtHome
            ? 'Trung tâm đã xác nhận lịch hẹn và phân công KTV kiểm định tận nơi'
            : 'Hub đã phân công KTV kiểm định đơn hàng',
          message: isAtHome
            ? `Trung tâm SecondLife đã xác nhận lịch hẹn và phân công KTV ${inspectorName} phụ trách kiểm định cho đơn #${codeDisplay}. Vui lòng chuẩn bị máy và đưa mã tiếp nhận cho KTV khi đến!`
            : `Đơn hàng #${codeDisplay} đã được phân công cho KTV ${inspectorName} kiểm định tại trạm Hub.`,
          type: 'INSPECTION' as const,
          referenceId: assignModalOrder.id,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', assignModalOrder.id) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');

        // Inspector notification with full seller address and contact details
        const formattedAppt = assignModalOrder.appointmentScheduledAt
          ? new Date(assignModalOrder.appointmentScheduledAt).toLocaleString('vi-VN')
          : 'Đã hẹn trước';
        const inspectorNotif = {
          id: `notif-inspector-task-${assignModalOrder.id}-${Date.now()}`,
          recipientId: selectedInspectorId,
          recipientRole: 'inspector',
          title: isAtHome
            ? `Nhiệm vụ mới: Kiểm định tại nhà khách (#${codeDisplay})`
            : `Nhiệm vụ mới: Đo kiểm tại Hub Lab (#${codeDisplay})`,
          message: isAtHome
            ? `Bạn được phân công kiểm định tại nhà cho thiết bị "${assignModalOrder.postTitle || 'Thiết bị'}".\n📍 Địa chỉ đến: ${resolvedSellerAddress}\n👤 Người bán: ${resolvedSellerName} (SĐT: ${resolvedSellerPhone})\n🕒 Lịch hẹn: ${formattedAppt}${trimmedDispatchNote ? `\n📝 Hướng dẫn từ Hub: ${trimmedDispatchNote}` : ''}`
            : `Bạn được phân công đo kiểm thiết bị "${assignModalOrder.postTitle || 'Thiết bị'}" tại trạm Hub.${trimmedDispatchNote ? ` Ghi chú: ${trimmedDispatchNote}` : ''}`,
          type: 'INSPECTION_TASK' as const,
          referenceId: assignModalOrder.id,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: `/inspector/inspections/${encodeURIComponent(assignModalOrder.id)}`,
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(inspectorNotif, selectedInspectorId, 'inspector');
      } catch { }

      // Notify other tabs and inspector workstation
      window.dispatchEvent(
        new CustomEvent('secondlife_order_assigned_signal', {
          detail: {
            orderId: assignModalOrder.id,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerName: resolvedSellerName,
            sellerPhone: resolvedSellerPhone,
            sellerAddress: resolvedSellerAddress,
            dispatchNote: trimmedDispatchNote || undefined,
          },
        })
      );

      showNotice(`Đã phân công đơn #${(assignModalOrder.id || '').slice(0, 8)} cho KTV ${inspectorName} thành công!`);

      setAssignModalOrder(null);
      setSelectedInspectorId('');
      setAssignNote('');
      setAssignError(null);
    } catch (err: any) {
      console.error('Lỗi khi phân công KTV:', err);
      // Xóa mapping local lưu tạm để tránh hiển thị sai lệch khi BE từ chối
      try {
        localStorage.removeItem(`order_assigned_inspector_${assignModalOrder.id}`);
      } catch { }
      const msg = err?.message || 'Giao task kiểm định thất bại. Vui lòng thử lại.';
      setAssignError(msg);
      if (
        msg.toLowerCase().includes('khóa') ||
        msg.toLowerCase().includes('tiếp nhận') ||
        msg.toLowerCase().includes('xác nhận') ||
        msg.toLowerCase().includes('locked') ||
        msg.toLowerCase().includes('conflict')
      ) {
        if (setOrders) {
          setOrders((prev) =>
            prev.map((o) => (o.id === assignModalOrder.id ? { ...o, inspectorConfirmed: true } : o))
          );
        }
      }
    } finally {
      setIsAssigning(false);
    }
  };

  return {
    assignError,
    assignModalOrder,
    assignNote,
    handleConfirmAssign,
    handleOpenAssign,
    isAssigning,
    selectedInspectorId,
    setAssignError,
    setAssignModalOrder,
    setAssignNote,
    setSelectedInspectorId,
  };
}
