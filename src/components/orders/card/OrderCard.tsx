import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { BuyerInspectionStage, OrderCheck } from '../../../types/orders/orderTypes';
import { Clock } from 'lucide-react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import type { ReactNode } from 'react';
import { formatVND } from '../../../utils/translations';
import { OrderCardActions, type OrderCardActionsProps } from './OrderCardActions';
import { OrderCardCancellation } from './OrderCardCancellation';
import { OrderCardInspection } from './OrderCardInspection';
import { OrderCardSummary } from './OrderCardSummary';

interface Props {
  order: EscrowOrder;
  orderRatePercent: number;
  sellerNetPayout: number;
  cardActions: Omit<OrderCardActionsProps, 'order' | 'orderIsSeller' | 'lang' | 'hasInspection' | 'savedAppointment' | 'buyerInspectionStage'>;
  orderIsSeller: boolean;
  hasInspection: boolean;
  lang: Language;
  savedAppointment: OrderAppointment | null;
  ordShipment: ShipmentBackend | null;
  buyerInspectionStage: BuyerInspectionStage | null;
  state: {
    getStatusBadge: (status: string, hasInspection?: boolean, isCurrentOrderSeller?: boolean, orderItem?: EscrowOrder) => ReactNode;
    isOrderReceiptConfirmed: OrderCheck;
    isOrderCancelledOrRefunded: OrderCheck;
    isInspectorArrivedForOrder: (orderId: string, order?: EscrowOrder) => boolean;
    isOrderSellerConfirmed: OrderCheck;
  };
  actions: {
    setSellerReviewsModalData: (seller: { sellerId: string; sellerName: string }) => void;
    setSchedulingOrder: (order: EscrowOrder) => void;
    setSchedulingReadOnly: (readOnly: boolean) => void;
    handleSellerAcceptCounterAppointment: (orderId: string, appointment: OrderAppointment) => Promise<void>;
    setDetailModalOrder: (order: EscrowOrder | null) => void;
  };
}

export function OrderCard({
  orderRatePercent, sellerNetPayout, cardActions,
  order: ord, orderIsSeller, hasInspection, lang, savedAppointment, ordShipment, buyerInspectionStage,
  state: { getStatusBadge, isOrderReceiptConfirmed, isOrderCancelledOrRefunded, isInspectorArrivedForOrder, isOrderSellerConfirmed },
  actions: { setSellerReviewsModalData, setSchedulingOrder, setSchedulingReadOnly, handleSellerAcceptCounterAppointment, setDetailModalOrder }
}: Props) {
  return (
    <div
      onClick={() => setDetailModalOrder(ord)}
      className="bg-[#FFFFFF] rounded-2xl border border-gray-200 hover:border-[#c34c36]/50 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
    >
      <OrderCardSummary
        orderIsSeller={orderIsSeller}
        lang={lang}
        order={ord}
        hasInspection={hasInspection}
        savedAppointment={savedAppointment}
        state={{
          getStatusBadge,
          isOrderReceiptConfirmed,
          isOrderCancelledOrRefunded,
        }}
        actions={{
          setSellerReviewsModalData,
        }}
      />
      <OrderCardCancellation
        order={ord}
        lang={lang}
        state={{
          isOrderCancelledOrRefunded,
        }}
      />
      <OrderCardInspection
        orderIsSeller={orderIsSeller}
        hasInspection={hasInspection}
        order={ord}
        savedAppointment={savedAppointment}
        lang={lang}
        ordShipment={ordShipment}
        state={{
          isOrderCancelledOrRefunded,
          isOrderReceiptConfirmed,
          isInspectorArrivedForOrder,
          isOrderSellerConfirmed,
        }}
        actions={{
          setSchedulingOrder,
          setSchedulingReadOnly,
          handleSellerAcceptCounterAppointment,
        }}
      />
      {/* Order Card Footer */}
      <div className="border-t border-gray-100 bg-slate-50/60 divide-y divide-gray-100">
        {(orderIsSeller || !hasInspection) && (
          <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {orderIsSeller
                ? (lang === 'vi'
                  ? `Thực nhận về ví (Đã trừ ${orderRatePercent}% phí sàn):`
                  : `Net Payout (after ${orderRatePercent}% platform fee):`)
                : (lang === 'vi' ? 'Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):' : 'Total (incl. inspection & escrow guarantee):')}
            </span>
            <span className={`text-base sm:text-lg font-black ${orderIsSeller ? 'text-emerald-600' : 'text-[#24263e]'}`}>
              {orderIsSeller ? `+${formatVND(sellerNetPayout)}` : formatVND(ord.totalPaidVnd)}
            </span>
          </div>
        )}
        <OrderCardActions
          {...cardActions}
          order={ord}
          orderIsSeller={orderIsSeller}
          lang={lang}
          hasInspection={hasInspection}
          savedAppointment={savedAppointment}
          buyerInspectionStage={buyerInspectionStage}
        />
      </div>
      {/* 48h Auto-release notice banner on the order card */}
      {!buyerInspectionStage && ord.shippingDeliveredAt && !isOrderReceiptConfirmed(ord) && ord.escrowStatus !== 'COMPLETED_RELEASED' && (ord.escrowStatus as any) !== 'RELEASED' && (ord as any).backendStatus !== 'COMPLETED' && ord.escrowStatus !== 'DISPUTED' && (
        <div className="mt-3 mx-4 sm:mx-6 mb-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              Đã giao thành công lúc {new Date(ord.shippingDeliveredAt).toLocaleString('vi-VN')}
            </span>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Hệ thống sẽ <strong>tự động giải ngân</strong> cho người bán sau 48 giờ kể từ khi giao thành công. Người mua có thể nhấn <strong>"Đã Nhận Hàng"</strong> để giải ngân ngay lập tức, hoặc gửi khiếu nại nếu sản phẩm có sai sót.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
