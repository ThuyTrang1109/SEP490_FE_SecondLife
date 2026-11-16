import type { EscrowOrder, Language } from '../../../types';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { getSortableOrderTimestamp } from '../../../utils/orderUtils';

interface Props {
  lang: Language;
  order: EscrowOrder;
  getStatusBadge: (status: string, hasInspection?: boolean, isCurrentOrderSeller?: boolean, orderItem?: EscrowOrder) => ReactNode;
  isOrderReceiptConfirmed: OrderCheck;
  detailHasInspection: boolean;
  isOrderSeller: (order: EscrowOrder) => boolean;
  setDetailModalOrder: (order: EscrowOrder | null) => void;
}

export function OrderDetailHeader({
  lang,
  order: detailModalOrder,
  getStatusBadge,
  isOrderReceiptConfirmed,
  detailHasInspection,
  isOrderSeller,
  setDetailModalOrder,
}: Props) {
  return (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between gap-4 px-6 sm:px-7 py-4 sm:py-5 border-b border-gray-100 bg-white shrink-0 z-10">
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center flex-wrap gap-2.5">
            <h2 className="text-lg sm:text-xl font-black text-[#24263e] flex items-center flex-wrap gap-2">
              <span>{lang === 'vi' ? 'Chi tiết đơn hàng: ' : 'Order Details:'}</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 select-all break-all">#{detailModalOrder.id}</span>
            </h2>
            {getStatusBadge(
              isOrderReceiptConfirmed(detailModalOrder) ? 'COMPLETED_RELEASED' : detailModalOrder.escrowStatus,
              detailHasInspection,
              isOrderSeller(detailModalOrder),
              detailModalOrder
            )}
          </div>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{lang === 'vi' ? 'Người bán:' : 'Seller:'} <strong className="text-slate-800">{detailModalOrder.sellerName}</strong></span>
            <span>•</span>
            <span>{lang === 'vi' ? 'Người mua:' : 'Buyer:'} <strong className="text-slate-800">{detailModalOrder.buyerName}</strong></span>
            <span>•</span>
            <span>{lang === 'vi' ? 'Đặt ngày' : 'Ordered on'}{' '}
              <strong className="text-slate-700">
                {(() => {
                  const t = getSortableOrderTimestamp(detailModalOrder);
                  return t > 0 ? new Date(t).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : (detailModalOrder.createdAt || '--/--/----');
                })()}
              </strong>
            </span>
          </p>
        </div>

        <button
          onClick={() => setDetailModalOrder(null)}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}
