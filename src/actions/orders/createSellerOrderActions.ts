import type { Dispatch, SetStateAction } from 'react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { inspectorService } from '../../services/inspectorService';
import { orderService } from '../../services/orderService';
import { shippingService } from '../../services/shippingService';
import { formatVND } from '../../utils/translations';
import { saveScopedLocalNotification } from '../../utils/notificationStorage';
import { translateSystemNotification } from '../../utils/systemNotificationTranslator';
import type { ConfirmDialogState } from '../../types/orders/orderTypes';

interface Options {
  lang: Language;
  detailModalOrder: EscrowOrder | null;
  setDetailModalOrder: Dispatch<SetStateAction<EscrowOrder | null>>;
  onRefreshOrders?: () => void;
  setInspectionActionNotice: (message: string | null) => void;
  setOrderActionLoading: (orderId: string | null) => void;
  findOrderForAction: (orderId: string) => EscrowOrder | null | undefined;
  getPartyInspectionFee: (order: EscrowOrder, isSeller: boolean) => number;
  handleRespondInspection: (orderId: string, action: 'ACCEPT' | 'REJECT', rejectReason?: string) => Promise<void>;
  getInspectionFeeSplit: (order: EscrowOrder) => NonNullable<EscrowOrder['inspectionFeeSplit']>;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  setLocalReadyOrderIds: Dispatch<SetStateAction<Set<string>>>;
  setDetailShipments: Dispatch<SetStateAction<ShipmentBackend[]>>;
}

export function createSellerOrderActions({
  lang, detailModalOrder, setDetailModalOrder, onRefreshOrders, setInspectionActionNotice, setOrderActionLoading,
  findOrderForAction, getPartyInspectionFee, handleRespondInspection, getInspectionFeeSplit, setConfirmDialog,
  setLocalReadyOrderIds, setDetailShipments,
}: Options) {
  const handlePromptRejectInspection = (ord: EscrowOrder) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Từ Chối Yêu Cầu Kiểm Định' : 'Reject Inspection Request',
      message: lang === 'vi'
        ? 'Bạn có chắc chắn muốn từ chối yêu cầu kiểm định cho sản phẩm này? Đơn hàng sẽ bị hủy và tiền ký quỹ sẽ được hoàn trả cho người mua.'
        : 'Are you sure you want to reject the inspection request? The order will be cancelled and refunded.',
      subMessage: lang === 'vi'
        ? 'Sản phẩm sẽ được mở lại hiển thị trên sàn để người mua khác có thể tiếp tục xem và đặt mua.'
        : 'The listing will be reopened on the marketplace.',
      confirmText: lang === 'vi' ? 'Từ chối kiểm định' : 'Reject Inspection',
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'danger',
      iconType: 'alert',
      onConfirm: async () => {
        await handleRespondInspection(ord.id, 'REJECT', 'Người bán từ chối kiểm định');
        setConfirmDialog(null);
      }
    });
  };

  const handleSellerConfirmOrder = (orderId: string) => {
    const targetOrder = findOrderForAction(orderId);
    const orderHasInspection = targetOrder ? Boolean(
      targetOrder.hasInspectionService ||
      (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
      targetOrder.inspectionCenterId ||
      targetOrder.inspectionMethod ||
      (targetOrder as any).inspectionStatus ||
      targetOrder.escrowStatus === 'AWAITING_INSPECTION' ||
      targetOrder.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      targetOrder.escrowStatus === 'INSPECTION_PASSED'
    ) : false;

    const sellerFee = targetOrder ? getPartyInspectionFee(targetOrder, true) : 0;
    const isFeeSplit = targetOrder ? (getInspectionFeeSplit(targetOrder) === 'SPLIT_50_50' || sellerFee > 0) : false;

    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi'
        ? (orderHasInspection ? 'Xác nhận đồng ý kiểm định' : 'Xác Nhận Chuẩn Bị Đơn Hàng')
        : (orderHasInspection ? 'Confirm Inspection Agreement' : 'Confirm Order Preparation'),
      message: lang === 'vi'
        ? (orderHasInspection
          ? (isFeeSplit
            ? `Xác nhận đồng ý yêu cầu kiểm định! Bạn sẽ nộp phần phí ${formatVND(sellerFee)} từ Ví SecondLife vào Escrow.`
            : 'Xác nhận đồng ý yêu cầu kiểm định của người mua! Hệ thống sẽ tạo mã QR kiểm định để bạn dán lên kiện hàng gửi sang Hub (hoặc KTV quét khi đến nhà).')
          : 'Xác nhận bạn chấp nhận chuẩn bị đơn hàng này cho người mua?')
        : (orderHasInspection
          ? 'Confirm inspection request from buyer? An inspection QR code will be generated.'
          : 'Do you confirm preparing this order for the buyer?'),
      subMessage: lang === 'vi'
        ? (orderHasInspection
          ? 'Sau khi đồng ý, đơn ở trạng thái Chờ kiểm định. Khi trung tâm phân công kỹ thuật viên, đơn sẽ hiển thị Đang kiểm định.'
          : 'Sau khi xác nhận, người bán cam kết đóng gói sản phẩm cẩn thận theo quy chuẩn và chuẩn bị sẵn sàng để bưu tá / tài xế Lalamove đến lấy.')
        : 'After confirmation, you commit to packing the item safely for pickup.',
      confirmText: lang === 'vi'
        ? (orderHasInspection ? 'Đồng ý kiểm định' : 'Xác Nhận Đơn')
        : (orderHasInspection ? 'Accept Inspection' : 'Confirm Order'),
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'primary',
      iconType: 'package',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          let inspResp: any = null;
          if (orderHasInspection) {
            inspResp = await inspectorService.respondRequest(orderId, {
              action: 'ACCEPT',
              sellerConsentZinLoss: true,
            });
          } else {
            await orderService.confirmOrder(orderId);
          }

          // Tự động tạo vận đơn Lalamove ngay khi người bán xác nhận đơn hàng thông thường (chặng SELLER_TO_BUYER)
          let createdShipment: ShipmentBackend | null = null;
          let shipmentNotice: string | null = null;
          if (!orderHasInspection) {
            try {
              createdShipment = await shippingService.createShipment(orderId, {
                requestId: crypto.randomUUID(),
                leg: 'SELLER_TO_BUYER',
              });
              console.log('Lalamove shipment created successfully on order confirm:', createdShipment);
            } catch (shipErr: any) {
              console.warn('Auto create Lalamove shipment notice:', shipErr);
              shipmentNotice = shipErr?.response?.data?.message || shipErr?.message || '';
            }
          }

          const confirmedAt = new Date().toISOString();
          const nextBackendStatus = inspResp?.status
            || (orderHasInspection
              ? (String(targetOrder?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' || getPartyInspectionFee(targetOrder, true) > 0 ? 'WAITING_FEE_PAYMENT' : 'CONFIRMED_PENDING_DISPATCH')
              : (targetOrder?.backendStatus || 'CONFIRMED'));

          const updatedOrder: EscrowOrder | null = targetOrder ? ({
            ...targetOrder,
            sellerConfirmedAt: confirmedAt,
            confirmationStatus: 'CONFIRMED',
            escrowStatus: orderHasInspection ? 'AWAITING_INSPECTION' : (targetOrder.escrowStatus === 'AWAITING_PAYMENT' ? 'HELD_IN_ESCROW' : targetOrder.escrowStatus),
            backendStatus: nextBackendStatus as any,
            status: nextBackendStatus as any,
            paymentDeadline: inspResp?.paymentDeadline || targetOrder.paymentDeadline,
            sellerFeeShare: inspResp?.sellerFeeShare !== undefined ? Number(inspResp.sellerFeeShare) : targetOrder.sellerFeeShare,
            buyerFeeShare: inspResp?.buyerFeeShare !== undefined ? Number(inspResp.buyerFeeShare) : targetOrder.buyerFeeShare,
            cashShippingSimulation: inspResp?.cashShippingSimulation ?? targetOrder.cashShippingSimulation,
            buyerCommitmentDeposit: inspResp?.buyerCommitmentDeposit ?? targetOrder.buyerCommitmentDeposit,
            sellerPaidAt: inspResp?.sellerPaidAt || targetOrder.sellerPaidAt,
            buyerPaidAt: inspResp?.buyerPaidAt || targetOrder.buyerPaidAt,
            feePayer: inspResp?.feePayer || targetOrder.feePayer,
            buyerFeePercent: inspResp?.buyerFeePercent ?? targetOrder.buyerFeePercent,
            inspectorId: undefined,
            inspectorName: undefined,
          } as any as EscrowOrder) : null;

          // Xóa mọi phân công cũ chưa xác thực khi người bán vừa đồng ý kiểm định
          if (orderHasInspection) {
            try {
              localStorage.removeItem(`order_assigned_inspector_${orderId}`);
            } catch { }
          }

          // Cập nhật local storage recent_placed_orders
          try {
            const raw = localStorage.getItem('recent_placed_orders');
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            const exists = list.some((o: any) => o.id === orderId);
            if (exists) {
              list = list.map((o: any) => {
                if (o.id === orderId) {
                  return {
                    ...o,
                    sellerConfirmedAt: confirmedAt,
                    confirmationStatus: 'CONFIRMED',
                    escrowStatus: orderHasInspection ? 'AWAITING_INSPECTION' : (o.escrowStatus === 'AWAITING_PAYMENT' ? 'HELD_IN_ESCROW' : o.escrowStatus),
                    backendStatus: nextBackendStatus,
                    status: nextBackendStatus,
                    paymentDeadline: inspResp?.paymentDeadline || o.paymentDeadline,
                    sellerFeeShare: inspResp?.sellerFeeShare !== undefined ? Number(inspResp.sellerFeeShare) : o.sellerFeeShare,
                    buyerFeePercent: inspResp?.buyerFeePercent ?? o.buyerFeePercent,
                    buyerFeeShare: inspResp?.buyerFeeShare !== undefined ? Number(inspResp.buyerFeeShare) : o.buyerFeeShare,
                    cashShippingSimulation: inspResp?.cashShippingSimulation ?? o.cashShippingSimulation,
                    buyerCommitmentDeposit: inspResp?.buyerCommitmentDeposit ?? o.buyerCommitmentDeposit,
                    sellerPaidAt: inspResp?.sellerPaidAt || o.sellerPaidAt,
                    buyerPaidAt: inspResp?.buyerPaidAt || o.buyerPaidAt,
                    inspectorId: undefined,
                    inspectorName: undefined,
                  };
                }
                return o;
              });
            } else if (updatedOrder) {
              list.unshift(updatedOrder);
            }
            localStorage.setItem('recent_placed_orders', JSON.stringify(list));
          } catch { }

          // Lưu vào center_inspection_orders dành riêng cho Trung tâm điều phối
          if (orderHasInspection && updatedOrder) {
            try {
              const rawCenter = localStorage.getItem('center_inspection_orders');
              let centerList = rawCenter ? JSON.parse(rawCenter) : [];
              if (!Array.isArray(centerList)) centerList = [];
              const filteredCenter = centerList.filter((o: any) => o.id !== orderId);
              filteredCenter.unshift({
                ...updatedOrder,
                status: 'CONFIRMED_PENDING_DISPATCH',
                backendStatus: 'CONFIRMED_PENDING_DISPATCH',
                escrowStatus: 'AWAITING_INSPECTION',
                inspectorId: undefined,
                inspectorName: undefined,
              });
              localStorage.setItem('center_inspection_orders', JSON.stringify(filteredCenter));
            } catch { }
          }

          // Phát tín hiệu thông báo task cho Trung tâm kiểm định điều phối
          if (orderHasInspection) {
            const centerNotif = {
              id: `notif-center-task-${orderId}`,
              recipientRole: 'inspection_center',
              title: 'Nhiệm vụ kiểm định mới cần điều phối',
              message: `Người bán đã đồng ý kiểm định cho đơn #${orderId.slice(0, 8)}. Trung tâm vui lòng điều phối và phân công KTV!`,
              type: 'INSPECTION_TASK' as const,
              referenceId: orderId,
              referenceType: 'INSPECTION_ORDER',
              actionUrl: '/inspection-center/dispatch',
              isRead: false,
              readAt: null,
              createdAt: new Date().toISOString(),
            };
            saveScopedLocalNotification(centerNotif, undefined, 'inspection_center');
            try {
              window.dispatchEvent(new CustomEvent('secondlife_inspection_task_created', { detail: { orderId, order: updatedOrder } }));
              window.dispatchEvent(new CustomEvent('secondlife_order_placed_signal', { detail: { orderId } }));
            } catch { }
          }

          setInspectionActionNotice(
            orderHasInspection
              ? (lang === 'vi' ? 'Đã đồng ý kiểm định! Task đã chuyển sang Trung tâm điều phối.' : 'Inspection accepted! Task dispatched to Center.')
              : createdShipment?.orderCode
                ? (lang === 'vi'
                  ? `Đã xác nhận đơn hàng & tạo vận đơn Lalamove thành công! Mã vận đơn: #${createdShipment.orderCode}`
                  : `Order confirmed & Lalamove shipment created! #${createdShipment.orderCode}`)
                : shipmentNotice
                  ? (lang === 'vi'
                    ? `Đã xác nhận đơn hàng thành công. Lưu ý Lalamove: ${translateSystemNotification(shipmentNotice)}. Bạn có thể bấm "Tạo Vận Đơn Lalamove" để tạo lại.`
                    : `Order confirmed! (Lalamove note: ${shipmentNotice})`)
                  : (lang === 'vi' ? 'Đã xác nhận đơn hàng thành công! Vui lòng đóng gói và báo sẵn sàng giao.' : 'Order confirmed successfully!')
          );
          onRefreshOrders?.();
          setDetailModalOrder((prev) =>
            prev && prev.id === orderId
              ? ({
                ...prev,
                sellerConfirmedAt: confirmedAt,
                confirmationStatus: 'CONFIRMED',
                backendStatus: (orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : (prev.backendStatus || 'CONFIRMED')) as any,
                status: (orderHasInspection ? 'CONFIRMED_PENDING_DISPATCH' : ((prev as any).status || 'CONFIRMED')) as any,
              } as EscrowOrder)
              : prev
          );

          setTimeout(() => setInspectionActionNotice(null), 5000);
        } catch (err: any) {
          setInspectionActionNotice(translateSystemNotification(err?.message) || 'Không thể xác nhận đơn hàng');
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } finally {
          setOrderActionLoading(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleSellerMarkReadyForPickup = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác nhận đã đóng gói kiện hàng?' : 'Confirm Package Packed & Ready?',
      message: lang === 'vi'
        ? 'Kiện hàng đã được đóng gói an toàn theo quy chuẩn và sẵn sàng bàn giao?'
        : 'Has the package been securely packed according to standards and ready for handover?',
      subMessage: lang === 'vi'
        ? 'Sau khi bạn xác nhận, hệ thống sẽ ghi nhận mốc thời gian hoàn tất (SLA) và phát tín hiệu điều phối tài xế Lalamove đến địa chỉ kho lấy hàng.'
        : 'Upon confirmation, the system records SLA completion timestamp and signals Lalamove driver dispatch to your warehouse.',
      confirmText: lang === 'vi' ? '✓ Sẵn Sàng Giao' : '✓ Ready for Pickup',
      cancelText: lang === 'vi' ? 'Đóng' : 'Close',
      variant: 'primary',
      iconType: 'truck',
      onConfirm: async () => {
        try {
          setOrderActionLoading(orderId);
          const targetOrder = findOrderForAction(orderId);
          const orderHasInspection = targetOrder ? Boolean(
            targetOrder.hasInspectionService ||
            (targetOrder.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
            targetOrder.inspectionCenterId ||
            targetOrder.inspectionMethod ||
            (targetOrder as any).inspectionStatus
          ) : false;

          let readyAt = new Date().toISOString();
          if (!orderHasInspection) {
            try {
              const res = await orderService.markReadyForPickup(orderId);
              if (res?.sellerReadyAt) readyAt = res.sellerReadyAt;
            } catch (readyErr) {
              console.warn('markReadyForPickup error:', readyErr);
            }
          }
          setLocalReadyOrderIds((prev) => new Set(prev).add(orderId));
          try {
            localStorage.setItem(`seller_ready_${orderId}`, readyAt);
            localStorage.setItem(`order_packed_${orderId}`, 'true');
            if (orderHasInspection && targetOrder?.inspectionMethod !== 'AT_HOME') {
              localStorage.setItem(`seller_shipped_to_hub_${orderId}`, 'true');
              window.dispatchEvent(new CustomEvent('secondlife_seller_shipped_to_hub', { detail: { orderId } }));
            }
            window.dispatchEvent(new StorageEvent('storage', { key: `seller_ready_${orderId}`, newValue: readyAt }));

            const rawRecent = localStorage.getItem('recent_placed_orders');
            if (rawRecent) {
              const list = JSON.parse(rawRecent);
              if (Array.isArray(list)) {
                const updated = list.map((o: any) =>
                  o.id === orderId ? { ...o, sellerReadyAt: readyAt } : o
                );
                localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
              }
            }
          } catch { }
          if (detailModalOrder && detailModalOrder.id === orderId) {
            setDetailModalOrder((prev) => (prev ? { ...prev, sellerReadyAt: readyAt } : null));
          }

          let readyShipment: ShipmentBackend | null = null;
          try {
            const existing = await shippingService.getOrderShipments(orderId);
            const active = existing.find((s) => s.status !== 'CANCELLED');
            if (active) {
              readyShipment = active;
              setDetailShipments((prev) => [active, ...prev.filter((s) => s.shipmentId !== active.shipmentId)]);
            } else if (!orderHasInspection) {
              readyShipment = await shippingService.createShipment(orderId, {
                requestId: crypto.randomUUID(),
                leg: 'SELLER_TO_BUYER',
              });
              console.log('Lalamove shipment created on ready-for-pickup:', readyShipment);
              if (readyShipment) {
                setDetailShipments((prev) => [readyShipment!, ...prev]);
              }
            }
          } catch (shipErr: any) {
            console.warn('Lalamove shipment creation on mark ready notice:', shipErr);
          }

          const trackingCode = readyShipment?.orderCode || readyShipment?.shipmentId;
          if (trackingCode) {
            setInspectionActionNotice(
              lang === 'vi'
                ? `Đã ghi nhận kiện hàng sẵn sàng! Mã vận đơn Lalamove: #${trackingCode}. Tài xế đang được điều phối đến kho lấy hàng.`
                : `Package marked ready! Lalamove Tracking: #${trackingCode}. Driver is being dispatched.`
            );
          } else {
            setInspectionActionNotice(
              lang === 'vi'
                ? 'Đã ghi nhận kiện hàng đóng gói an toàn! Hệ thống đang phát tín hiệu điều phối tài xế Lalamove.'
                : 'Package marked packed and ready for carrier pickup!'
            );
          }
          onRefreshOrders?.();
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } catch (err: any) {
          setInspectionActionNotice(translateSystemNotification(err?.message) || 'Không thể cập nhật trạng thái sẵn sàng giao hàng');
          setTimeout(() => setInspectionActionNotice(null), 5000);
        } finally {
          setOrderActionLoading(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  return { handlePromptRejectInspection, handleSellerConfirmOrder, handleSellerMarkReadyForPickup };
}
