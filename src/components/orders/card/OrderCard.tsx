import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { BuyerInspectionStage, OrderCheck } from '../../../types/orders/orderTypes';
import { AlertTriangle, Clock } from 'lucide-react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import type { ReactNode } from 'react';
import { formatVND } from '../../../utils/translations';
import type { SellerPayoutData } from '../../../utils/orders/orderFinance';
import { OrderCardActions, type OrderCardActionsProps } from './OrderCardActions';
import { OrderCardCancellation } from './OrderCardCancellation';
import { OrderCardInspection } from './OrderCardInspection';
import { OrderCardSummary } from './OrderCardSummary';
import { OrderReturnPanel } from '../OrderReturnPanel';
import { getOrderEscrowHoldNotice, isOrderEscrowOnHold } from '../../../utils/orders/orderDispute';

interface Props {
  order: EscrowOrder;
  payoutData?: SellerPayoutData;
  onBookOrderReturn?: () => void;
  onTrackReturnShipment?: () => void;
  bookingReturn?: boolean;
  returnBookingError?: string;
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
  payoutData, cardActions, onBookOrderReturn, onTrackReturnShipment, bookingReturn, returnBookingError,
  order: ord, orderIsSeller, hasInspection, lang, savedAppointment, ordShipment, buyerInspectionStage,
  state: { getStatusBadge, isOrderReceiptConfirmed, isOrderCancelledOrRefunded, isInspectorArrivedForOrder, isOrderSellerConfirmed },
  actions: { setSellerReviewsModalData, setSchedulingOrder, setSchedulingReadOnly, handleSellerAcceptCounterAppointment, setDetailModalOrder }
}: Props) {
  const escrowNotice = getOrderEscrowHoldNotice(ord, lang);
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
        {(orderIsSeller ? !ord.orderReturn : !hasInspection) && (
          <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {orderIsSeller
                ? (lang === 'vi'
                  ? (payoutData?.source === 'settlement' ? 'Thực nhận về ví:' : `Dự kiến thực nhận (phí sàn${payoutData?.ratePercent != null ? ` ${payoutData.ratePercent}%` : ''}):`)
                  : (payoutData?.source === 'settlement' ? 'Net payout:' : `Estimated payout (platform fee${payoutData?.ratePercent != null ? ` ${payoutData.ratePercent}%` : ''}):`))
                : (hasInspection
                  ? (lang === 'vi' ? 'Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):' : 'Total (incl. inspection & escrow guarantee):')
                  : (lang === 'vi' ? 'Thành tiền (đã bao gồm cước vận chuyển & bảo lãnh Escrow):' : 'Total (incl. shipping & escrow guarantee):'))}
            </span>
            <span className={`text-base sm:text-lg font-black ${orderIsSeller ? 'text-emerald-600' : 'text-[#24263e]'}`}>
              {orderIsSeller
                ? (payoutData ? `+${formatVND(payoutData.sellerPayout)}` : (lang === 'vi' ? 'Chưa có dữ liệu' : 'Unavailable'))
                : formatVND(ord.totalPaidVnd)}
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
      {ord.orderReturn && Boolean(ord.orderReturn.reportId || ord.escrowStatus === 'DISPUTED' || ord.backendEscrowStatus === 'FROZEN') ? (
        <div className="mx-4 my-3 sm:mx-6">
          <OrderReturnPanel
            orderReturn={ord.orderReturn}
            lang={lang}
            orderIsSeller={orderIsSeller}
            booking={bookingReturn}
            bookingError={returnBookingError}
            onBook={onBookOrderReturn}
            onTrack={onTrackReturnShipment}
          />
        </div>
      ) : (() => {
        if (escrowNotice) {
          return (
            <div className="mt-3 mx-4 sm:mx-6 mb-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  {escrowNotice.title}
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {escrowNotice.description}
                </p>
              </div>
            </div>
          );
        }

        {/* 48h Auto-release notice banner on the order card */ }
        if (
          !buyerInspectionStage &&
          ord.shippingDeliveredAt &&
          !isOrderReceiptConfirmed(ord) &&
          !isOrderEscrowOnHold(ord) &&
          !isOrderCancelledOrRefunded(ord) &&
          ord.escrowStatus !== 'COMPLETED_RELEASED' &&
          (ord.escrowStatus as any) !== 'RELEASED' &&
          (ord as any).backendStatus !== 'COMPLETED'
        ) {
          return (
            <div className="mt-3 mx-4 sm:mx-6 mb-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  Đã giao thành công lúc {new Date(ord.shippingDeliveredAt).toLocaleString('vi-VN')}
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {orderIsSeller ? (
                    <>
                      Người mua có <strong>48 giờ để gửi khiếu nại</strong> kể từ lúc giao thành công, trước khi hệ thống tự động giải ngân.
                    </>
                  ) : (
                    <>
                      Người mua có <strong>48 giờ để gửi khiếu nại</strong> kể từ lúc giao thành công, khi tiền còn trong Escrow. Nhấn <strong>"Đã nhận hàng"</strong> để xác nhận và giải ngân.
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        }

        return null;
      })()}
    </div>
  );
}
