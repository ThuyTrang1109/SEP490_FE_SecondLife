import type { EscrowOrder, Language } from '../../types';
import type { OrderFilterTab } from '../../utils/escrowOrderFilters';
import type { CancelOrder, ConfirmDialogState } from '../../types/orders/orderTypes';

interface Options {
  lang: Language;
  isOrderSeller: (order: EscrowOrder) => boolean;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  onCancelOrder?: CancelOrder;
  detailModalOrder: EscrowOrder | null;
  setDetailModalOrder: (order: EscrowOrder | null) => void;
  setActiveTab: (filter: OrderFilterTab) => void;
}

export function createOrderCancellationActions({
  lang, isOrderSeller, setConfirmDialog, onCancelOrder, detailModalOrder, setDetailModalOrder, setActiveTab,
}: Options) {
  const handlePromptCancelOrder = (ord: EscrowOrder) => {
    const isSeller = isOrderSeller(ord);
    const hasInsp = Boolean(
      ord.hasInspectionService ||
      ord.inspectionMethod ||
      (ord.inspectionFeeVnd && ord.inspectionFeeVnd > 0) ||
      ord.inspectionCenterId ||
      ord.inspectionStatus
    );
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi'
        ? (hasInsp ? 'Xác Nhận Hủy Yêu Cầu Kiểm Định' : 'Xác Nhận Hủy Đơn Hàng')
        : (hasInsp ? 'Confirm Cancel Inspection Request' : 'Confirm Cancel Order'),
      message: lang === 'vi'
        ? (isSeller
          ? (hasInsp
            ? 'Bạn có chắc chắn muốn từ chối/hủy yêu cầu kiểm định này không?'
            : 'Bạn có chắc chắn muốn hủy đơn hàng này không? Tiền ký quỹ sẽ được hoàn lại 100% cho người mua.')
          : (hasInsp
            ? 'Người bán chưa xác nhận yêu cầu kiểm định này. Bạn có chắc chắn muốn hủy yêu cầu kiểm định không?'
            : 'Người bán chưa xác nhận đơn hàng này. Bạn có chắc chắn muốn hủy đơn và nhận lại toàn bộ tiền về ví Escrow không?'))
        : 'Are you sure you want to cancel? Escrow funds will be refunded.',
      subMessage: lang === 'vi'
        ? (hasInsp
          ? 'Yêu cầu kiểm định sẽ kết thúc và tiền ký quỹ (nếu có) sẽ được bảo toàn nguyên vẹn.'
          : (isSeller
            ? 'Lý do: Người bán tạm hết hàng hoặc không thể chuẩn bị đơn hàng này (Hệ thống sẽ cập nhật trạng thái đơn sang Đã Hủy).'
            : 'Đơn hàng sẽ được hủy ngay lập tức và bảo toàn số dư ví của bạn.'))
        : undefined,
      confirmText: lang === 'vi' ? (hasInsp ? 'Xác Nhận Hủy Yêu Cầu' : 'Xác Nhận Hủy') : 'Confirm Cancel',
      cancelText: lang === 'vi' ? (hasInsp ? 'Giữ Yêu Cầu' : 'Giữ Đơn') : 'Keep',
      variant: 'warning',
      iconType: 'alert',
      onConfirm: async () => {
        if (onCancelOrder) {
          const cancelPayload = isSeller ? {
            reasonCode: 'SELLER_OUT_OF_STOCK' as const,
            reason: 'Người bán hết hàng hoặc không thể chuẩn bị đơn hàng này.',
          } : {
            reasonCode: 'BUYER_REQUESTED' as const,
            reason: 'Người mua yêu cầu hủy đơn do người bán chưa xác nhận.',
          };
          onCancelOrder(ord.id, cancelPayload);
        }
        setConfirmDialog(null);
        if (detailModalOrder?.id === ord.id) {
          setDetailModalOrder(null);
        }
        setActiveTab('cancelled');
      }
    });
  };

  const handlePromptCancelInspectionRequest = (ord: EscrowOrder) => {
    const isSeller = isOrderSeller(ord);
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Xác Nhận Hủy Yêu Cầu Kiểm Định' : 'Confirm Cancel Inspection Request',
      message: lang === 'vi'
        ? (isSeller
          ? 'Bạn có chắc chắn muốn hủy yêu cầu kiểm định cho đơn hàng này không? Tiền hàng và các chi phí kiểm định tạm giữ sẽ được hoàn lại 100% cho người mua.'
          : 'Bạn có chắc chắn muốn hủy yêu cầu kiểm định cho đơn hàng này không? Toàn bộ số tiền tạm giữ (tiền hàng và phí kiểm định) sẽ được hoàn trả 100% vào Ví Escrow của bạn ngay lập tức.')
        : 'Are you sure you want to cancel this inspection request? All escrow funds will be refunded 100% to buyer.',
      subMessage: lang === 'vi'
        ? 'Sau khi hủy, KTV sẽ không đến kiểm tra máy nữa và lịch hẹn (nếu có) sẽ bị hủy bỏ.'
        : 'Technician visit will be cancelled and order status updated.',
      confirmText: lang === 'vi' ? 'Xác Nhận Hủy Kiểm Định' : 'Cancel Inspection',
      cancelText: lang === 'vi' ? 'Giữ Yêu Cầu' : 'Keep Request',
      variant: 'danger',
      iconType: 'alert',
      onConfirm: async () => {
        try {
          localStorage.removeItem(`order_appointment_${ord.id}`);
          localStorage.removeItem(`order_assigned_inspector_${ord.id}`);
          localStorage.removeItem(`order_intake_arrived_${ord.id}`);
          localStorage.setItem(`order_cancelled_${ord.id}`, 'true');
        } catch { }

        if (onCancelOrder) {
          const cancelPayload = isSeller ? {
            reasonCode: 'SELLER_CANNOT_FULFILL' as const,
            reason: 'Người bán hủy yêu cầu kiểm định trước khi KTV đến kiểm tra.',
          } : {
            reasonCode: 'BUYER_REQUESTED' as const,
            reason: 'Người mua chủ động hủy yêu cầu kiểm định trước khi KTV thực hiện đo kiểm.',
          };
          onCancelOrder(ord.id, cancelPayload);
        }

        try {
          window.dispatchEvent(new CustomEvent('secondlife_order_cancelled', { detail: { orderId: ord.id } }));
          window.dispatchEvent(new CustomEvent('secondlife_appointment_cancelled', { detail: { orderId: ord.id } }));
        } catch { }

        setConfirmDialog(null);
        if (detailModalOrder?.id === ord.id) {
          setDetailModalOrder(null);
        }
        setActiveTab('cancelled');
      }
    });
  };

  // Review & Seller Trust Modal state

  return { handlePromptCancelOrder, handlePromptCancelInspectionRequest };
}
