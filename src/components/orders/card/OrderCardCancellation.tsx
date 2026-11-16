import type { EscrowOrder, Language } from '../../../types';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { XCircle } from 'lucide-react';
import { getCancellationReasonDisplay } from '../../../utils/orders/orderCancellation';

interface Props {
  order: EscrowOrder;
  lang: Language;
  state: {
    isOrderCancelledOrRefunded: OrderCheck;
  };
}

export function OrderCardCancellation({
  order: ord, lang,
  state: { isOrderCancelledOrRefunded }
}: Props) {
  return (
    <>
      {/* Cancelled Order Notice Banner in Card */}
      {isOrderCancelledOrRefunded(ord) && !ord.inspectionStatus && (() => {
        const cancelInfo = getCancellationReasonDisplay(ord, lang);
        return (
          <div className="mx-4 sm:mx-6 mb-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs shadow-2xs space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-rose-950">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded'}</span>
              </div>
              {cancelInfo.code && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                  {cancelInfo.code}
                </span>
              )}
            </div>
            <p className="text-xs text-rose-900 pl-6">
              <span className="font-bold text-rose-950">{lang === 'vi' ? 'Lý do hủy đơn: ' : 'Cancellation Reason: '}</span>
              {cancelInfo.reason}
            </p>
            <p className="text-[11px] text-rose-600 pl-6 italic">
              {lang === 'vi' ? 'Toàn bộ tiền ký quỹ Escrow đã hoàn trả cho người mua. Vận chuyển Lalamove đã dừng.' : 'Escrow funds refunded. Carrier dispatch deactivated.'}
            </p>
          </div>
        );
      })()}
    </>
  );
}
