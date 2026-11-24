import type { EscrowOrder, Language, OrderReturnInfo, ShipmentBackend } from '../../types';
import { getLalamoveInterruption, getLatestDirectShipment } from '../lalamoveTracking';
import { isOrderDeliveredToBuyer, isOrderWithInspection } from './orderReceipt';

const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isOrderDisputed(order?: Partial<EscrowOrder> | null): boolean {
  return Boolean(order?.hasActiveDispute || [
    order?.escrowStatus, order?.status, order?.backendStatus, order?.inspectionStatus,
  ].some((status) => status === 'DISPUTED'));
}

export function isOrderEscrowOnHold(order?: Partial<EscrowOrder> | null): boolean {
  return order?.backendEscrowStatus === 'FROZEN' ||
    String(order?.escrowStatus) === 'FROZEN' || isOrderDisputed(order);
}

export function getOrderEscrowHoldNotice(order: EscrowOrder, lang: Language, shipments: ShipmentBackend[] = order.shipments ?? []) {
  if (!isOrderEscrowOnHold(order)) return null;
  const vi = lang === 'vi';
  if (isOrderDisputed(order)) {
    return {
      title: vi ? 'Quỹ Escrow đang tạm đóng băng do khiếu nại / tranh chấp' : 'Escrow is frozen due to a dispute',
      description: vi ? 'SecondLife đang xem xét khiếu nại. Khoản thanh toán được bảo lưu trong Escrow.' : 'SecondLife is reviewing the dispute. The payment remains in Escrow.',
    };
  }
  if (!isOrderWithInspection(order) && !isOrderDeliveredToBuyer(order) && !order.orderReturn) {
    if (getLalamoveInterruption(getLatestDirectShipment(shipments))) {
      return null;
    }
    return {
      title: vi ? 'Khoản thanh toán đang được bảo lưu' : 'Payment is on hold',
      description: vi ? 'Tiền hàng vẫn được giữ trong Escrow.' : 'The payment remains in Escrow.',
    };
  }
  return {
    title: vi ? 'Quỹ Escrow đang tạm đóng băng' : 'Escrow is temporarily frozen',
    description: vi ? 'Khoản thanh toán được bảo lưu trong Escrow và chưa thể giải ngân.' : 'The payment remains in Escrow and cannot be released yet.',
  };
}

export function getSellerDisputeResponseState(
  report: { status: string; sellerRespondedAt?: string | null; sellerResponseDeadlineAt?: string | null },
  now = Date.now(),
): 'available' | 'expired' | 'closed' {
  if (report.status !== 'OPEN') return 'closed';
  if (!report.sellerRespondedAt && now >= Date.parse(report.sellerResponseDeadlineAt ?? '')) return 'expired';
  return 'available';
}

export function canOpenOrderDispute(
  order: {
    status?: string | null;
    backendStatus?: string | null;
    escrowStatus?: string | null;
    backendEscrowStatus?: string | null;
    shippingDeliveredAt?: string | null;
  },
  now = Date.now(),
): boolean {
  const deliveredAt = Date.parse(order.shippingDeliveredAt ?? '');
  const status = order.backendStatus ?? order.status;
  const escrow = order.backendEscrowStatus ?? order.escrowStatus;
  return status === 'DELIVERED' && (escrow === 'HELD' || escrow === 'FROZEN')
    && deliveredAt <= now && now < deliveredAt + DISPUTE_WINDOW_MS;
}

const activeShipmentStatuses = ['READY_TO_PICK', 'ASSIGNED', 'PENDING', 'PICKING'];
const inTransitShipmentStatuses = ['PICKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERING'];

export function getApprovedReturnLabel(orderReturn: OrderReturnInfo, lang: Language): string {
  const vi = lang === 'vi';
  if (orderReturn.refundedAt) return vi ? 'Đã hoàn tiền' : 'Refunded';
  if (!orderReturn.shipmentId) return vi ? 'Đã duyệt trả hàng · Chờ tạo vận đơn' : 'Return approved · Awaiting booking';
  switch (orderReturn.shipmentStatus) {
    case 'CREATING':
      return vi ? 'Đang tạo vận đơn hoàn' : 'Booking return shipment';
    case 'DELIVERED':
      return vi ? 'Hàng đã về người bán · Chờ hoàn tiền tự động' : 'Returned to seller · Automatic refund pending';
    case 'CANCELLED':
      return vi ? 'Đã hủy vận đơn hoàn · Chờ tạo lại' : 'Return shipment cancelled · Awaiting rebooking';
    case 'FAILED':
    case 'RETURNED':
    case 'CREATION_UNCERTAIN':
      return vi ? 'Vận đơn hoàn cần đối soát' : 'Return shipment needs review';
    default:
      if (inTransitShipmentStatuses.includes(orderReturn.shipmentStatus ?? '')) {
        return vi ? 'Đang giao hàng hoàn về người bán' : 'Return in transit to seller';
      }
      if (activeShipmentStatuses.includes(orderReturn.shipmentStatus ?? '')) {
        return vi ? 'Đã tạo vận đơn hoàn · Chờ lấy hàng' : 'Return booked · Awaiting pickup';
      }
      return vi ? 'Đang cập nhật vận đơn hoàn' : 'Updating return shipment';
  }
}

export function canCreateApprovedOrderReturn(order: EscrowOrder, actorId?: string | null): boolean {
  const approval = order.orderReturn;
  return Boolean(actorId && order.buyerId === actorId && approval && !approval.refundedAt &&
    order.backendEscrowStatus === 'FROZEN' && (!approval.shipmentId || approval.shipmentStatus === 'CANCELLED'));
}

export const DISPUTE_REASON_MAP: Record<string, string> = {
  // Khiếu nại đơn hàng & yêu cầu hoàn hàng
  RETURN_NOT_AS_DESCRIBED: 'Hàng nhận được hư hỏng / Sai khác',
  MISLEADING_DESCRIPTION: 'Mô tả sai lệch / Che giấu lỗi',
  MISREPRESENTED: 'Mô tả sai lệch / Che giấu lỗi',
  COUNTERFEIT: 'Hàng giả / Hàng nhái',
  FRAUD: 'Dấu hiệu lừa đảo / Gian lận',
  ITEM_NOT_RECEIVED: 'Chưa nhận được hàng quá hạn',
  NOT_RECEIVED: 'Chưa nhận được hàng',
  WRONG_ITEM: 'Giao sai sản phẩm',
  DAMAGED: 'Hàng hóa bị hư hỏng',
  LATE_HANDOVER: 'Người bán chậm bàn giao hàng',
  SELLER_CANCELLATION: 'Người bán tự ý hủy đơn hàng',
  // Báo cáo tin đăng vi phạm
  DUPLICATE_LISTING: 'Tin đăng trùng lặp / Spam',
  PROHIBITED_ITEM: 'Hàng hóa cấm giao dịch',
  INAPPROPRIATE_CONTENT: 'Nội dung phản cảm / Không phù hợp',
  INCORRECT_CATEGORY: 'Sai danh mục sản phẩm',
  HARASSMENT: 'Quấy rối / Đe dọa',
  PRICE_MANIPULATION: 'Khai báo giá ảo / Thao túng giá',
  OTHER: 'Lý do khác',
};

export const RESPONSIBLE_PARTY_MAP: Record<string, string> = {
  SELLER: 'Người bán',
  BUYER: 'Người mua',
  CARRIER: 'Hãng vận chuyển (Đơn vị vận chuyển)',
  NONE: 'Không quy lỗi',
};

export const LALAMOVE_STATUS_MAP: Record<string, string> = {
  CREATING: 'Đang khởi tạo',
  CREATION_UNCERTAIN: 'Cần đối soát',
  ASSIGNING_DRIVER: 'Đang tìm tài xế',
  ON_GOING: 'Đang giao hàng',
  IN_TRANSIT: 'Đang giao hàng',
  DELIVERING: 'Đang giao hàng',
  PICKED_UP: 'Đã lấy hàng',
  DELIVERED: 'Đã giao thành công',
  COMPLETED: 'Đã giao thành công',
  CANCELLED: 'Đã hủy chuyến',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Đã hết hạn',
};

export function formatDisputeReason(code?: string | null, lang: Language = 'vi'): string {
  if (!code) return '';
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();
  if (lang === 'vi') {
    return DISPUTE_REASON_MAP[trimmed] || DISPUTE_REASON_MAP[upper] || trimmed;
  }
  const enMap: Record<string, string> = {
    RETURN_NOT_AS_DESCRIBED: 'Damaged / Different Item',
    MISLEADING_DESCRIPTION: 'Misleading Description',
    MISREPRESENTED: 'Misrepresented Item',
    COUNTERFEIT: 'Counterfeit Item',
    FRAUD: 'Fraudulent Activity',
    ITEM_NOT_RECEIVED: 'Item Not Received',
    NOT_RECEIVED: 'Not Received',
    WRONG_ITEM: 'Wrong Item Delivered',
    DAMAGED: 'Damaged Item',
    LATE_HANDOVER: 'Late Handover by Seller',
    SELLER_CANCELLATION: 'Seller Unilateral Cancellation',
    DUPLICATE_LISTING: 'Duplicate Listing',
    OTHER: 'Other Reason',
  };
  return enMap[upper] || trimmed;
}

export function formatDisputeStatus(status?: string | null, lang: Language = 'vi'): string {
  if (!status) return '';
  const upper = status.trim().toUpperCase();
  if (lang === 'vi') {
    switch (upper) {
      case 'OPEN':
      case 'PENDING':
        return 'Chờ xử lý';
      case 'IN_REVIEW':
        return 'Đang xem xét';
      case 'CONFIRMED':
      case 'RESOLVED':
        return 'Đã chấp thuận';
      case 'DISMISSED':
      case 'REJECTED':
        return 'Đã bác bỏ';
      default:
        return status;
    }
  }
  switch (upper) {
    case 'OPEN':
    case 'PENDING':
      return 'Pending Review';
    case 'IN_REVIEW':
      return 'In Review';
    case 'CONFIRMED':
    case 'RESOLVED':
      return 'Confirmed';
    case 'DISMISSED':
    case 'REJECTED':
      return 'Dismissed';
    default:
      return status;
  }
}

