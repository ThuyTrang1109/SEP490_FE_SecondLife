import { getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from './orderContacts';
import { useState, useEffect } from 'react';
import { paths } from '../../../app/router/paths';
import { inspectorService, InspectionOrderDto } from '../../../services';
import { getCenterDispatchStage } from '../../../utils/inspectionCenterData';
import { saveScopedLocalNotification } from '../../../utils/notificationStorage';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useCenterShipments } from '../orders/useCenterShipments';
import type { useCenterStaff } from '../staff/useCenterStaff';

interface Options {
  isOrderReceivedAtHub: ReturnType<typeof useCenterShipments>['isOrderReceivedAtHub'];
  orders: ReturnType<typeof useCenterOrders>['orders'];
  showNotice: (msg: string) => void;
  staffList: ReturnType<typeof useCenterStaff>['staffList'];
}

export function useInspectorAssignment({ isOrderReceivedAtHub, orders, showNotice, staffList }: Options) {
  // --- Assign Modal State ---
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);

  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [assignNote, setAssignNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Auto-select first inspector if none selected when modal is open
  useEffect(() => {
    if (assignModalOrder && !selectedInspectorId && staffList.length > 0) {
      setSelectedInspectorId(assignModalOrder.inspectorId || staffList[0].id);
    }
  }, [assignModalOrder, selectedInspectorId, staffList]);

  const handleOpenAssign = (order: InspectionOrderDto) => {
    setAssignError(null);
    const resolvedAddr = getOrderSellerAddress(order);
    const resolvedPhone = getOrderSellerPhone(order);
    const resolvedName = getOrderSellerName(order);
    setAssignModalOrder({
      ...order,
      sellerAddress: resolvedAddr,
      sellerPhone: resolvedPhone,
      sellerName: resolvedName,
    });
    setSelectedInspectorId(order.inspectorId || staffList[0]?.id || '');
    const savedDispatchNote = localStorage.getItem(`order_dispatch_note_${order.id}`) || '';
    setAssignNote(savedDispatchNote);
  };

  // Action: Submit Assign Inspector
  const handleConfirmAssign = async () => {
    setAssignError(null);
    if (!assignModalOrder) return;

    if (!selectedInspectorId) {
      setAssignError('Vui lòng chọn kỹ thuật viên kiểm định từ danh sách trước khi xác nhận.');
      return;
    }

    const currentOrder = orders.find((order) => order.id === assignModalOrder.id) ?? assignModalOrder;
    const stage = getCenterDispatchStage(currentOrder, isOrderReceivedAtHub(currentOrder));
    if (!stage) {
      setAssignError('Đơn kiểm định hiện không ở giai đoạn điều phối.');
      return;
    }
    if (stage === 'WAITING_FOR_HUB') {
      setAssignError('Hub cần xác nhận đã nhận kiện hàng trước khi giao task cho KTV.');
      return;
    }

    setIsAssigning(true);
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
            if (o.id === assignModalOrder.id) {
              return {
                ...o,
                inspectorId: selectedInspectorId,
                inspectorName: inspectorName,
                inspectorEmail: inspectorEmail,
                sellerAddress: resolvedSellerAddress,
                sellerPhone: resolvedSellerPhone,
                sellerName: resolvedSellerName,
                status: assignedOrder.status,
                backendStatus: assignedOrder.status,
                inspectionStatus: assignedOrder.customerStatus || assignedOrder.status,
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
        const existingIdx = listCenter.findIndex((o: any) => o.id === assignModalOrder.id);
        if (existingIdx >= 0) {
          listCenter[existingIdx] = {
            ...listCenter[existingIdx],
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            status: assignedOrder.status,
            backendStatus: assignedOrder.status,
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
            status: assignedOrder.status,
            backendStatus: assignedOrder.status,
          });
        }
        localStorage.setItem('center_inspection_orders', JSON.stringify(listCenter));
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
