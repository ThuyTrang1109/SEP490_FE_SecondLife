import type { EscrowOrder, ShipmentBackend } from '../../types';
import { getOrderAllShipments } from './shipmentCache';
import { getInspectionPurchaseDecision } from '../inspectionPurchase';

/**
 * Kiểm tra xem đơn hàng có phải là đơn có dịch vụ kiểm định hay không.
 */
export function isOrderWithInspection(order: Partial<EscrowOrder>): boolean {
  if (!order) return false;
  return Boolean(
    order.hasInspectionService ||
    (order.inspectionFeeVnd && order.inspectionFeeVnd > 0) ||
    order.inspectionCenterId ||
    order.inspectionMethod ||
    (order as any).inspectionStatus ||
    order.escrowStatus === 'AWAITING_INSPECTION' ||
    order.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
    order.escrowStatus === 'INSPECTION_PASSED'
  );
}

/**
 * Lấy vận đơn chặng giao cho Người Mua (Chặng 2: Hub -> Buyer hoặc Chặng giao thẳng Seller -> Buyer sau kiểm định).
 */
export function getBuyerDeliveryShipment(
  order: EscrowOrder,
  customShipments?: ShipmentBackend[]
): ShipmentBackend | null {
  const shipments = (customShipments && customShipments.length > 0)
    ? customShipments
    : getOrderAllShipments(order.id);
  const linkedShipments = order.linkedOrderId ? getOrderAllShipments(order.linkedOrderId) : [];

  const all = [...shipments, ...linkedShipments];
  // Ưu tiên vận đơn CENTER_TO_BUYER hoặc SELLER_TO_BUYER chưa bị hủy
  const active = all.find((s) => (s.leg === 'CENTER_TO_BUYER' || s.leg === 'SELLER_TO_BUYER') && s.status !== 'CANCELLED');
  if (active) return active;

  return all.find((s) => s.leg === 'CENTER_TO_BUYER' || s.leg === 'SELLER_TO_BUYER') || null;
}

/**
 * Kiểm tra xem kiện hàng đã thực sự được giao thành công đến tay Người Mua hay chưa.
 * Đơn hàng kiểm định: BẮT BUỘC Hub/Hệ thống đã tạo vận đơn giao người mua VÀ bưu tá đã phát thành công (DELIVERED/COMPLETED).
 * Nếu trung tâm chưa tạo vận đơn -> FALSE (hàng vẫn ở Hub, không bao giờ được hiện nút Đã Nhận Hàng).
 */
export function isOrderDeliveredToBuyer(
  order: EscrowOrder,
  customShipments?: ShipmentBackend[]
): boolean {
  if (!order) return false;

  const hasInspection = isOrderWithInspection(order);

  if (hasInspection) {
    // Nếu kiểm định không đạt hoặc người mua đã từ chối mua tiếp -> hàng trả về seller, không giao buyer
    const decision = getInspectionPurchaseDecision(order);
    if (decision === 'rejected') return false;
    const inspStatus = String((order as any).inspectionStatus || order.backendStatus || order.status || '').toUpperCase();
    if (inspStatus === 'FAILED' || order.escrowStatus === 'INSPECTION_FAILED') return false;

    // Vận đơn chặng giao người mua
    const leg2 = getBuyerDeliveryShipment(order, customShipments);

    // Bắt buộc phải có vận đơn VÀ vận đơn đã giao thành công,
    // HOẶC backendStatus/escrowStatus đã xác nhận giao thành công có mốc shippingDeliveredAt
    const isLeg2Delivered = Boolean(
      leg2 && (
        leg2.status === 'DELIVERED' ||
        leg2.status === 'COMPLETED' ||
        leg2.providerStatus === 'COMPLETED'
      )
    );

    const isSystemDelivered = Boolean(
      order.shippingDeliveredAt ||
      (order.backendStatus === 'DELIVERED' && order.escrowStatus !== 'AWAITING_INSPECTION') ||
      order.escrowStatus === 'DELIVERED_INSPECTION_WINDOW'
    );

    // Đối với đơn kiểm định: Nếu trung tâm CHƯA tạo vận đơn (leg2 == null),
    // trừ khi hệ thống có mốc thời gian giao hàng thực tế hợp lệ (shippingDeliveredAt),
    // còn không thì tuyệt đối coi như chưa giao hàng.
    if (!leg2 && !order.shippingDeliveredAt) {
      return false;
    }

    return isLeg2Delivered || isSystemDelivered;
  }

  // Đơn hàng thông thường không kiểm định (Giao thẳng trực tiếp 1 chặng)
  return Boolean(
    order.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
    order.backendStatus === 'DELIVERED' ||
    order.shippingDeliveredAt
  );
}

/**
 * Kiểm tra xem kiện hàng đang trên đường vận chuyển tới Người Mua hay chưa (đang giao hàng).
 */
export function isOrderInTransitToBuyer(
  order: EscrowOrder,
  customShipments?: ShipmentBackend[]
): boolean {
  if (!order) return false;
  if (isOrderDeliveredToBuyer(order, customShipments)) return false;

  const hasInspection = isOrderWithInspection(order);

  if (hasInspection) {
    const leg2 = getBuyerDeliveryShipment(order, customShipments);
    // Chỉ coi là đang giao khi ĐÃ TẠO VẬN ĐƠN và vận đơn chưa bị hủy
    return Boolean(leg2 && leg2.status !== 'CANCELLED');
  }

  return Boolean(
    order.escrowStatus === 'SHIPPED_TO_BUYER' ||
    order.backendStatus === 'SHIPPED'
  );
}
