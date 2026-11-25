import { Truck } from 'lucide-react';
import type { Language, OrderReturnInfo } from '../../types';
import { getApprovedReturnLabel } from '../../utils/orders/orderDispute';

interface Props {
  orderReturn: OrderReturnInfo;
  lang: Language;
  orderIsSeller?: boolean;
  booking?: boolean;
  bookingError?: string;
  onBook?: () => void;
  onTrack?: () => void;
}

export function OrderReturnPanel({ orderReturn, lang, orderIsSeller, booking, bookingError, onBook, onTrack }: Props) {
  const vi = lang === 'vi';
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-extrabold text-sm">{getApprovedReturnLabel(orderReturn, lang)}</p>
          {orderReturn.orderCode && (
            <p className="break-words">
              {vi ? 'Mã vận đơn Lalamove:' : 'Lalamove tracking number:'}{' '}
              <strong className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-3xs">
                #{orderReturn.orderCode}
              </strong>
            </p>
          )}
          {bookingError && <p role="alert" className="text-rose-700 font-bold">{bookingError}</p>}
          {!orderReturn.refundedAt && (
            <p className="text-[11px] text-indigo-900/90">
              {orderIsSeller
                ? (vi
                  ? 'Kiện hàng đang được chuyển hoàn về kho của bạn. Khi nhận lại hàng, Quỹ Escrow sẽ đối soát và giải quyết hoàn tiền.'
                  : 'The package is returning to your warehouse. Once delivered, Escrow will finalize the refund.')
                : (vi
                  ? 'Tiền hàng đang được giữ an toàn trong Quỹ Escrow để chờ giao hoàn trả.'
                  : 'The payment remains protected in Escrow pending return delivery.')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onTrack && (orderReturn.orderCode || orderReturn.shipmentId) && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTrack();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition cursor-pointer"
          >
            <Truck className="h-3.5 w-3.5 text-indigo-600" />
            <span>{vi ? 'Theo dõi vận đơn hoàn' : 'Track return shipment'}</span>
          </button>
        )}
        {onBook && (
          <button
            type="button"
            disabled={booking}
            onClick={(event) => {
              event.stopPropagation();
              onBook();
            }}
            className="rounded-lg bg-indigo-700 px-3.5 py-1.5 font-bold text-white hover:bg-indigo-800 disabled:opacity-50 transition shadow-2xs cursor-pointer"
          >
            {booking ? (vi ? 'Đang tạo vận đơn…' : 'Booking return…') : (vi ? 'Tạo vận đơn hoàn' : 'Book return shipment')}
          </button>
        )}
      </div>
    </section>
  );
}
