import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { EscrowOrder, Language } from '../../../types';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import { formatConditionGrade, formatVND } from '../../../utils/translations';
import { getCancellationReasonDisplay } from '../../../utils/orders/orderCancellation';
import { resolveListingCategory } from '../../../utils/catalogCache';

interface Props {
  isOrderCancelledOrRefunded: OrderCheck;
  order: EscrowOrder;
  lang: Language;
  detailHasInspection: boolean;
}

export function OrderDetailProduct({
  isOrderCancelledOrRefunded,
  order: detailModalOrder,
  lang,
  detailHasInspection,
}: Props) {
  return (
    <>
      {/* Order Cancellation Reason Banner in Detail Modal */}
      {isOrderCancelledOrRefunded(detailModalOrder) && !detailModalOrder.inspectionStatus && (() => {
        const cancelInfo = getCancellationReasonDisplay(detailModalOrder, lang);
        return (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-rose-950">
                    {lang === 'vi' ? 'Đơn Hàng Đã Bị Hủy & Hoàn Tiền' : 'Order Cancelled & Refunded'}
                  </h4>
                  <p className="text-[11px] text-rose-700">
                    {lang === 'vi'
                      ? 'Tiền ký quỹ Escrow đã được bảo toàn và hoàn lại 100% về ví người mua'
                      : 'Escrow funds have been 100% refunded to buyer wallet'}
                  </p>
                </div>
              </div>
              {cancelInfo.code && (
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                  {cancelInfo.code}
                </span>
              )}
            </div>
            <div className="pt-2 border-t border-rose-200/80 text-xs">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-rose-950 whitespace-nowrap">
                  {lang === 'vi' ? 'Lý do hủy đơn:' : 'Cancellation Reason:'}
                </span>
                <span className="font-semibold text-rose-900">
                  {cancelInfo.reason}
                </span>
              </div>
              <p className="text-[11px] text-rose-600/90 mt-1 italic">
                {lang === 'vi'
                  ? '• Lưu ý: Các đơn đã bị hủy sẽ dừng toàn bộ hoạt động tra cứu vận đơn và không thể tạo mã vận đơn mới.'
                  : '• Note: Cancelled orders can no longer create shipments or track Lalamove routes.'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Product Info Card in Modal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 border border-gray-200">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <img
            src={detailModalOrder.listing.photos.front}
            alt={detailModalOrder.listing.title}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-white shadow-2xs"
          />
          <div className="min-w-0 space-y-1 flex-1">
            <h4 className="font-bold text-sm sm:text-base text-slate-900 break-words">
              {detailModalOrder.listing.title}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="bg-white px-2 py-0.5 rounded-md border border-gray-200 font-medium">
                {resolveListingCategory(detailModalOrder.listing)}
              </span>
              <span>•</span>
              <span>{lang === 'vi' ? 'Tình trạng:' : 'Condition:'} <strong className="text-slate-800">{formatConditionGrade(detailModalOrder.listing.conditionGrade || (detailModalOrder.listing as any).itemCondition, lang)}</strong></span>
              <span>•</span>
              <span>{lang === 'vi' ? 'Số lượng: 1' : 'Qty: 1'}</span>
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/80">
          <div className="text-[11px] text-slate-400 font-medium">{lang === 'vi' ? 'Đơn giá niêm yết' : 'Listing Price'}</div>
          <div className="text-base sm:text-lg font-black text-[#24263e]">
            {formatVND(detailModalOrder.itemPriceVnd)}
          </div>
        </div>
      </div>

      {/* Seller confirmation for direct purchases */}
      {!detailHasInspection && !isOrderCancelledOrRefunded(detailModalOrder) && (
        detailModalOrder.sellerConfirmedAt ? (
          <div className="px-4 py-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lang === 'vi' ? 'Người bán đã xác nhận đơn hàng thành công' : 'Seller has confirmed this order'}</span>
            </div>
            <span className="font-mono font-bold text-emerald-800 text-[11px] bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
              {new Date(detailModalOrder.sellerConfirmedAt).toLocaleString('vi-VN')}
            </span>
          </div>
        ) : detailModalOrder.confirmationDeadline ? (
          <div className="px-4 py-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{lang === 'vi' ? 'Hạn chót người bán xác nhận đơn hàng:' : 'Confirmation deadline:'}</span>
            </div>
            <span className="font-mono font-bold text-amber-900 text-[11px] bg-white/80 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
              {new Date(detailModalOrder.confirmationDeadline).toLocaleString('vi-VN')}
            </span>
          </div>
        ) : null
      )}
    </>
  );
}
