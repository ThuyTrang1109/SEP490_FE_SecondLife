import type { BuyerInspectionStage, OrderCheck } from '../../../types/orders/orderTypes';
import { Clock, MapPin, Truck } from 'lucide-react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import { buyerInspectionStageLabel } from '../../../utils/inspectionPurchase';
import { formatVND } from '../../../utils/translations';
import { getInboundShipmentProgress } from '../../../utils/inspectionCenterData';
import { resolveInspectionCenter } from '../../../utils/orderUtils';

interface Props {
  detailHasInspection: boolean;
  order: EscrowOrder;
  detailInboundShipment: ShipmentBackend | null;
  lang: Language;
  isOrderCancelledOrRefunded: OrderCheck;
  isShipmentCreatedForOrder: OrderCheck;
  detailInboundProgress: ReturnType<typeof getInboundShipmentProgress> | null;
  setTrackingOrder: (order: EscrowOrder) => void;
  detailBuyerInspectionStage: BuyerInspectionStage | null;
  isOrderSeller: (order: EscrowOrder) => boolean;
  setInspectionActionNotice: (message: string | null) => void;
  setCreateShipmentOrder: (order: EscrowOrder) => void;
  isOrderSellerConfirmed?: OrderCheck;
}

export function OrderDetailDirectShipping({
  detailHasInspection,
  order: detailModalOrder,
  detailInboundShipment,
  lang,
  isOrderCancelledOrRefunded,
  isShipmentCreatedForOrder,
  detailInboundProgress,
  setTrackingOrder,
  detailBuyerInspectionStage,
  isOrderSeller,
  setInspectionActionNotice,
  setCreateShipmentOrder,
  isOrderSellerConfirmed,
}: Props) {
  return (
    <>
      {/* Lalamove Shipping & Tracking Action in Detail Modal (Ẩn khi đơn hàng có kiểm định tại nhà hoặc tại Hub vì đã có khối hành trình chuyên biệt phía dưới) */}
      {(() => {
        const isDetailInspection = Boolean(
          detailHasInspection ||
          detailModalOrder.hasInspectionService ||
          (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
          detailModalOrder.inspectionCenterId ||
          (detailModalOrder as any).inspectionStatus ||
          detailModalOrder.inspectionMethod === 'AT_CENTER' ||
          detailModalOrder.inspectionMethod === 'AT_HOME' ||
          (detailModalOrder as any).orderType === 'AT_HOME' ||
          (detailModalOrder as any).orderType === 'AT_CENTER'
        );
        if (isDetailInspection) return null;

        const hasActiveShipment = isShipmentCreatedForOrder(detailModalOrder) || Boolean(detailInboundShipment);
        const sellerConfirmed = isOrderSellerConfirmed ? isOrderSellerConfirmed(detailModalOrder) : Boolean(detailModalOrder.sellerConfirmedAt);

        // Với đơn mua trực tiếp: Người bán PHẢI ấn "Xác nhận đơn hàng" trước thì mới bắt đầu điều phối / tạo vận đơn Lalamove
        if (!hasActiveShipment && !sellerConfirmed) {
          return null;
        }

        return (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-slate-50 border border-orange-200/90 shadow-2xs space-y-3">
            {/* Top Row: Left has Tracking Badge + Order Code, Right has Driver Status Badge + Tracking Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-600 text-white shadow-2xs shrink-0">
                  Lalamove Tracking
                </span>
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                  {detailInboundShipment?.orderCode ? (
                    <>
                      <span>{lang === 'vi' ? 'Mã vận đơn:' : 'Tracking #:'}</span>
                      <strong className="font-mono text-orange-950 font-bold select-all bg-orange-100/70 px-2 py-0.5 rounded-md border border-orange-200">
                        #{detailInboundShipment.orderCode}
                      </strong>
                    </>
                  ) : detailModalOrder.shippingQuoteId ? (
                    <>
                      <span>{lang === 'vi' ? 'Mã báo giá:' : 'Quote #:'}</span>
                      <strong className="font-mono text-orange-950 font-bold select-all bg-orange-100/70 px-2 py-0.5 rounded-md border border-orange-200">
                        #{detailModalOrder.shippingQuoteId}
                      </strong>
                    </>
                  ) : (
                    <span className="font-bold text-slate-800">
                      {lang === 'vi' ? 'Đơn hàng tích hợp Lalamove Tracking' : 'Integrated Lalamove Tracking'}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
                {!isOrderCancelledOrRefunded(detailModalOrder) ? (
                  (() => {
                    const hasActiveShipment = isShipmentCreatedForOrder(detailModalOrder) || Boolean(detailInboundShipment);

                    if (hasActiveShipment) {
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          {detailInboundProgress && (
                            <span className={`rounded-xl border px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs ${detailInboundProgress.step === 3
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : detailInboundProgress.step === 2
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                              <Truck className="w-3.5 h-3.5" />
                              <span>{detailInboundProgress.label}</span>
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setTrackingOrder(detailModalOrder);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Tra cứu vận đơn Lalamove' : 'Track Shipment'}</span>
                          </button>
                        </div>
                      );
                    }

                    if (detailBuyerInspectionStage) {
                      return (
                        <span className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                          {buyerInspectionStageLabel(detailBuyerInspectionStage, lang)}
                        </span>
                      );
                    }

                    if (isOrderSeller(detailModalOrder)) {
                      return (
                        <button
                          onClick={() => {
                            if (detailModalOrder.escrowStatus === 'AWAITING_PAYMENT') {
                              setInspectionActionNotice(
                                lang === 'vi'
                                  ? 'Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể phát lệnh gọi bưu tá Lalamove sau khi tiền đã được giữ trong Escrow.'
                                  : 'Order is awaiting buyer escrow deposit before driver dispatch.'
                              );
                              setTimeout(() => setInspectionActionNotice(null), 5000);
                              return;
                            }
                            setCreateShipmentOrder(detailModalOrder);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Tạo Vận Đơn Lalamove' : 'Create Shipment'}</span>
                        </button>
                      );
                    }

                    return (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 shrink-0 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{lang === 'vi' ? 'Chờ người bán tạo đơn Lalamove' : 'Awaiting Seller Dispatch'}</span>
                      </span>
                    );
                  })()
                ) : (
                  <span className="px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                    {lang === 'vi' ? 'Đã dừng vận đơn (Đơn đã hủy)' : 'Shipment Inactive'}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Row: Shipping Fee & Destination separated by subtle line */}
            <div className="pt-2.5 border-t border-orange-200/70 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>{lang === 'vi' ? 'Phí vận chuyển:' : 'Shipping fee:'}</span>
                <strong className="text-orange-700 font-bold">{formatVND(detailModalOrder.shippingFeeVnd || 21000)}</strong>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="break-words">
                  {detailModalOrder.hasInspectionService || detailModalOrder.inspectionCenterId
                    ? `${lang === 'vi' ? 'Điểm đến:' : 'Destination:'} ${resolveInspectionCenter(detailModalOrder)?.name || 'Trạm Kiểm Định SecondLife Hub'}`
                    : `${lang === 'vi' ? 'Địa chỉ giao:' : 'Deliver to:'} ${detailModalOrder.buyerAddress || 'Địa chỉ người mua'}`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
