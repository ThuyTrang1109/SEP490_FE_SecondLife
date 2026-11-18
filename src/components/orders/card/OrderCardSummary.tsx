import { CheckCircle2, Clock, ShieldCheck, Store, Truck, User } from 'lucide-react';
import type { EscrowOrder, Language } from '../../../types';
import type { OrderAppointment } from '../../../utils/orders/orderAppointments';
import type { OrderCheck } from '../../../types/orders/orderTypes';
import type { ReactNode } from 'react';
import { formatVND } from '../../../utils/translations';
import { getSortableOrderTimestamp } from '../../../utils/orderUtils';
import { resolveListingCategory } from '../../../utils/catalogCache';
import { formatOrderCancellationReason } from '../../../utils/inspectionPurchase';

interface Props {
  orderIsSeller: boolean;
  lang: Language;
  order: EscrowOrder;
  hasInspection: boolean;
  savedAppointment: OrderAppointment | null;
  state: {
    getStatusBadge: (status: string, hasInspection?: boolean, isCurrentOrderSeller?: boolean, orderItem?: EscrowOrder) => ReactNode;
    isOrderReceiptConfirmed: OrderCheck;
    isOrderCancelledOrRefunded: OrderCheck;
  };
  actions: {
    setSellerReviewsModalData: (seller: { sellerId: string; sellerName: string }) => void;
  };
}

export function OrderCardSummary({
  orderIsSeller, lang, order: ord, hasInspection, savedAppointment,
  state: { getStatusBadge, isOrderReceiptConfirmed, isOrderCancelledOrRefunded },
  actions: { setSellerReviewsModalData }
}: Props) {
  return (
    <>
      {/* Order Top Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2">
          {orderIsSeller ? (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Store className="w-3 h-3 text-indigo-600" />
                <span>{lang === 'vi' ? 'Đơn Bạn Bán' : 'Your Sale'}</span>
              </span>
              <User className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">
                {lang === 'vi' ? 'Khách mua:' : 'Buyer:'} {ord.buyerName}
              </span>
              {ord.buyerPhone ? (
                <span className="text-[11px] text-slate-400">({ord.buyerPhone})</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <User className="w-3 h-3 text-blue-600" />
                <span>{lang === 'vi' ? 'Đơn Bạn Mua' : 'Your Purchase'}</span>
              </span>
              <Store className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-900">{ord.sellerName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSellerReviewsModalData({
                    sellerId: ord.sellerId,
                    sellerName: ord.sellerName
                  });
                }}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                title={lang === 'vi' ? 'Xem điểm uy tín & đánh giá người bán' : 'View seller trust & reviews'}
              >
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                {/* <span>98đ uy tín</span> */}
              </button>
            </>
          )}
          <span className="text-[11px] font-mono text-slate-400">#{ord.id}</span>
          <span className="hidden sm:inline-block text-[11px] text-slate-400">
            • {(() => {
              const t = getSortableOrderTimestamp(ord);
              return t > 0 ? new Date(t).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : (ord.createdAt || '--/--/----');
            })()}
          </span>
        </div>
        <div>{getStatusBadge(isOrderReceiptConfirmed(ord) ? 'COMPLETED_RELEASED' : ord.escrowStatus, hasInspection, orderIsSeller, ord)}</div>
      </div>

      {/* Order Main Body: Product Snippet */}
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <img
            src={ord.listing.photos.front}
            alt={ord.listing.title}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-gray-200 shrink-0 bg-slate-100 group-hover:scale-102 transition-transform"
          />
          <div className="space-y-1.5">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 break-words group-hover:text-[#24263e] transition-colors">
              {ord.listing.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                {resolveListingCategory(ord.listing)}
              </span>
              <span>•</span>
              <span>
                {lang === 'vi' ? 'Tình trạng:' : 'Condition:'}{' '}
                <strong className="text-slate-800">{ord.listing.conditionGrade}</strong>
              </span>
              <span>•</span>
              <span>{lang === 'vi' ? 'Số lượng: 1' : 'Qty: 1'}</span>
            </div>

            {!isOrderCancelledOrRefunded(ord) ? (
              orderIsSeller ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lang === 'vi' ? 'Tài xế: Lalamove (Lấy tại kho Seller)' : 'Courier: Lalamove (Pickup at Seller)'}</span>
                  </span>
                  {ord.sellerConfirmedAt ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Đã xác nhận đơn' : 'Confirmed'}</span>
                    </span>
                  ) : ord.confirmationDeadline ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>{lang === 'vi' ? 'Hạn xác nhận: ' : 'Confirm before: '}{new Date(ord.confirmationDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {hasInspection
                      ? (lang === 'vi' ? 'Bảo Đảm Kép: Escrow + Kiểm Định Hub' : 'Dual Protection: Escrow + Hub Inspected')
                      : (lang === 'vi' ? 'Bảo Vệ Người Mua (Escrow)' : 'Buyer Protection (Escrow)')}
                  </span>
                </div>
              )
            ) : (
              Boolean((ord as any).note || (ord as any).inspectionNote || ord.cancellationReason) && (() => {
                const displayReason = formatOrderCancellationReason(
                  (ord as any).note || (ord as any).inspectionNote || ord.cancellationReason,
                  lang
                );
                if (!displayReason) return null;
                return (
                  <p className="text-[11px] text-rose-600 font-medium mt-0.5 line-clamp-2">
                    <span className="font-semibold">{lang === 'vi' ? 'Lý do: ' : 'Reason: '}</span>
                    {displayReason}
                  </p>
                );
              })()
            )}

            {/* Inspection Method & Fee Sharing Badge */}
            {hasInspection && !isOrderCancelledOrRefunded(ord) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  <span>
                    {ord.inspectionMethod === 'AT_HOME'
                      ? (lang === 'vi' ? 'Kiểm Định Tận Nhà' : 'At-Home Inspection')
                      : (lang === 'vi' ? 'Kiểm Định Tại Hub SecondLife' : 'Hub Inspection')}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span>
                    {ord.inspectionFeeSplit === 'SPLIT_50_50'
                      ? (lang === 'vi' ? 'Chia đôi phí 50/50' : 'Split 50/50')
                      : ord.inspectionFeeSplit === 'SELLER_100'
                        ? (lang === 'vi' ? 'Người bán 100%' : 'Seller 100%')
                        : (lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%')}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Price Tag */}
        <div className="text-left sm:text-right shrink-0">
          <span className="text-xs text-slate-400 block">
            {orderIsSeller
              ? (lang === 'vi' ? 'Giá bán' : 'Listing Price')
              : (lang === 'vi' ? 'Đơn giá sản phẩm' : 'Item Price')}
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900">
            {formatVND(ord.itemPriceVnd)}
          </span>
        </div>
      </div>
    </>
  );
}
