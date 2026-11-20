import type { BuyerInspectionStage, OrderCheck } from '../../../types/orders/orderTypes';
import { Clock, Receipt } from 'lucide-react';
import type { EscrowOrder, OrderCommissionDTO, OrderSettlementDTO } from '../../../types';
import { formatVND } from '../../../utils/translations';
import { getCommissionPayout } from '../../../utils/orders/orderFinance';

interface Props {
  order: EscrowOrder;
  detailBuyerInspectionStage: BuyerInspectionStage | null;
  isOrderReceiptConfirmed: OrderCheck;
  orderSettlement: OrderSettlementDTO | null;
  isEscrowReleased: boolean;
  isLoadingSettlement: boolean;
  orderCommission: OrderCommissionDTO | null;
  isSeller?: boolean;
}

export function OrderSettlement({
  order: detailModalOrder,
  detailBuyerInspectionStage,
  isOrderReceiptConfirmed,
  orderSettlement,
  isEscrowReleased,
  isLoadingSettlement,
  orderCommission,
  isSeller,
}: Props) {
  if (isSeller === false) return null;

  const commissionPayout = orderCommission && getCommissionPayout(orderCommission);
  return (
    <>
      {!isEscrowReleased && !detailBuyerInspectionStage && detailModalOrder.shippingDeliveredAt &&
        !isOrderReceiptConfirmed(detailModalOrder) && detailModalOrder.escrowStatus !== 'DISPUTED' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Quy Trình Tự Động Giải Ngân Sau 48 Giờ</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Đơn hàng đã được bưu tá xác nhận giao thành công vào lúc <strong>{new Date(detailModalOrder.shippingDeliveredAt).toLocaleString('vi-VN')}</strong>.
              Theo chính sách bảo vệ người mua của SecondLife, hệ thống sẽ tự động giải ngân cho người bán sau 48 giờ kể từ thời điểm này nếu không có khiếu nại phát sinh.
            </p>
          </div>
        )}

      <div className="rounded-2xl p-4 border border-gray-200 bg-[#faf8f5] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#24263e]" />
            <span className="font-bold text-xs uppercase tracking-wide text-[#24263e]">
              Chi Tiết Quyết Toán Giải Ngân
            </span>
          </div>
          {isEscrowReleased ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              {orderSettlement ? 'ĐÃ QUYẾT TOÁN' : 'ĐÃ GIẢI NGÂN'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              CHƯA GIẢI NGÂN
            </span>
          )}
        </div>

        {isLoadingSettlement ? (
          <div className="py-3 text-center text-xs text-slate-500 font-medium">
            {isEscrowReleased ? 'Đang tải chi tiết quyết toán…' : 'Đang tải thông tin hoa hồng…'}
          </div>
        ) : orderSettlement ? (
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-white border border-gray-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tiền người bán thực nhận:</span>
                <span className="text-sm font-black text-emerald-600">
                  {formatVND(orderSettlement.sellerPayout)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Hoa hồng sàn SecondLife:</span>
                <span className="font-bold text-[#c34c36]">
                  {formatVND(orderSettlement.platformCommission)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">

              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Giá cơ sở tính hoa hồng:</span>
                <span className="font-bold text-slate-800">
                  {formatVND(orderSettlement.commissionBase)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Mã quyết toán: <strong className="font-mono text-slate-700">#{orderSettlement.settlementId}</strong></span>
              <span>Thời điểm giải ngân: <strong>{new Date(orderSettlement.settledAt).toLocaleString('vi-VN')}</strong></span>
            </div>
          </div>
        ) : isEscrowReleased ? (
          <p className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-slate-600">
            Chưa tải được chi tiết quyết toán của đơn hàng.
          </p>
        ) : orderCommission && commissionPayout ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Chưa quyết toán giải ngân
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {orderCommission.ruleName || orderCommission.ruleCode || 'Biểu phí chuẩn'}
              </span>
            </div>
            <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
              <div className="flex justify-between items-center text-slate-700">
                <span>Ước tính thực nhận (khi hoàn tất):</span>
                <span className="text-sm font-black text-emerald-600">
                  {formatVND(commissionPayout.sellerPayout)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Phí hoa hồng sàn ({commissionPayout.ratePercent !== undefined ? `${commissionPayout.ratePercent}%` : 'tính theo biểu phí'}):</span>
                <span className="font-bold text-[#c34c36]">
                  -{formatVND(commissionPayout.platformCommission)}
                </span>
              </div>
              {orderCommission.commissionBase !== undefined && (
                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                  <span>Giá cơ sở tính hoa hồng:</span>
                  <span className="font-bold text-slate-800">
                    {formatVND(orderCommission.commissionBase)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Khoản tiền bán hàng đang được bảo toàn trong Quỹ Escrow. Tiền sẽ được khấu trừ hoa hồng theo biểu phí hệ thống và giải ngân về ví người bán sau khi giao dịch hoàn tất.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Chưa giải ngân</p>
            <p className="text-[11px] text-slate-500">
              Khoản tiền ký quỹ của đơn hàng đang được bảo toàn tại ví trung gian Escrow của hệ thống. Tiền sẽ được chuyển vào ví người bán sau khi người mua xác nhận đã nhận hàng hoặc sau thời hạn 48 giờ.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
