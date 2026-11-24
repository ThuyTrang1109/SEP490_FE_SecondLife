import type { BuyerInspectionStage, OrderCheck } from '../../../types/orders/orderTypes';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import type { getInboundShipmentProgress } from '../../../utils/inspectionCenterData';

export interface OrderDetailDirectShippingProps {
  detailHasInspection?: boolean;
  order?: EscrowOrder;
  detailInboundShipment?: ShipmentBackend | null;
  lang?: Language;
  isOrderCancelledOrRefunded?: OrderCheck;
  isShipmentCreatedForOrder?: OrderCheck;
  detailInboundProgress?: ReturnType<typeof getInboundShipmentProgress> | null;
  setTrackingOrder?: (order: EscrowOrder) => void;
  detailBuyerInspectionStage?: BuyerInspectionStage | null;
  isOrderSeller?: (order: EscrowOrder) => boolean;
  setInspectionActionNotice?: (message: string | null) => void;
  setCreateShipmentOrder?: (order: EscrowOrder) => void;
  isOrderSellerConfirmed?: OrderCheck;
}

export function OrderDetailDirectShipping(_props: OrderDetailDirectShippingProps) {
  // Đã bỏ khối Lalamove Tracking trực tiếp trùng lặp này cho cả buyer và seller khi mua trực tiếp
  // (Mọi thông tin vận chuyển, hành trình và nút tạo vận đơn / theo dõi đều đã có trong OrderDeliveryJourney và OrderDetailActions)
  return null;
}

