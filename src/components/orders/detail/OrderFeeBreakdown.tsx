import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { buyerFeePercentFor, feePercentLabel, splitInspectionFee } from '../../../utils/inspectionFeePercent';
import type { EscrowOrder, Language, ShipmentBackend } from '../../../types';
import type { InspectionOrderDto } from '../../../services/inspectorService';
import { formatInspectionDeadline } from '../../../utils/inspectionPaymentDeadline';
import { formatVND, translations } from '../../../utils/translations';
import { getCancellationReasonDisplay } from '../../../utils/orders/orderCancellation';
import { getCashInspectionFeeShares, isInspectionCashShipment } from '../../../utils/inspectionCashShipping';
import { getInspectionPurchaseDecision, isExpiredInspectionPurchase } from '../../../utils/inspectionPurchase';

interface Props {
  order: EscrowOrder;
  detailInspectionDto: InspectionOrderDto | null;
  getInspectionFeeSplit: (order: EscrowOrder) => NonNullable<EscrowOrder['inspectionFeeSplit']>;
  detailShipments: ShipmentBackend[];
  lang: Language;
}

export function OrderFeeBreakdown({
  order: detailModalOrder,
  detailInspectionDto,
  getInspectionFeeSplit,
  detailShipments,
  lang,
}: Props) {
  const t = translations[lang];
  return (
    <>
      {/* Escrow Fee Breakdown */}
      {(() => {
        const isInspectionOrder = Boolean(
          detailModalOrder.hasInspectionService ||
          detailModalOrder.inspectionMethod ||
          (detailModalOrder as any).orderType ||
          detailInspectionDto ||
          (detailModalOrder as any).inspectionStatus ||
          (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0)
        );

        const inspectionMethod: 'AT_CENTER' | 'AT_HOME' =
          (detailInspectionDto?.orderType === 'AT_HOME' ||
            detailModalOrder.inspectionMethod === 'AT_HOME' ||
            (detailModalOrder as any).orderType === 'AT_HOME')
            ? 'AT_HOME'
            : 'AT_CENTER';
        const isAtCenter = inspectionMethod === 'AT_CENTER';
        const isAtHome = inspectionMethod === 'AT_HOME';

        const isCashShipping = false;

        const rawFeePayer =
          detailInspectionDto?.feePayer ||
          detailModalOrder.feePayer ||
          detailModalOrder.inspectionFeeSplit;
        const feePayerSplit: 'BUYER_100' | 'SELLER_100' | 'SPLIT_50_50' =
          rawFeePayer === 'SELLER_PAYS' || rawFeePayer === 'SELLER_100'
            ? 'SELLER_100'
            : rawFeePayer === 'SPLIT_50_50'
              ? 'SPLIT_50_50'
              : rawFeePayer === 'BUYER_PAYS' || rawFeePayer === 'BUYER_100'
                ? 'BUYER_100'
                : getInspectionFeeSplit(detailModalOrder);

        const buyerFeePercent = detailInspectionDto?.buyerFeePercent ?? detailModalOrder.buyerFeePercent
          ?? buyerFeePercentFor(feePayerSplit) ?? 100;

        const inspStatus = String(
          detailInspectionDto?.status ||
          detailModalOrder.inspectionStatus ||
          (detailModalOrder as any).backendStatus ||
          detailModalOrder.status ||
          ''
        ).toUpperCase();

        const isInspectionPassed =
          inspStatus === 'PASSED' ||
          inspStatus === 'INSPECTION_PASSED' ||
          detailModalOrder.escrowStatus === 'INSPECTION_PASSED';

        const isInspectionFailed =
          inspStatus === 'FAILED' ||
          inspStatus === 'INSPECTION_FAILED' ||
          detailModalOrder.escrowStatus === 'INSPECTION_FAILED';

        const isInspectionRejected =
          getInspectionPurchaseDecision(detailModalOrder, detailInspectionDto) === 'rejected';

        const isInspectionCancelled =
          ['CANCELLED', 'CANCELED', 'PAYMENT_EXPIRED', 'REFUNDED_TO_BUYER'].includes(inspStatus) ||
          detailModalOrder.escrowStatus === 'REFUNDED_TO_BUYER';

        const isPhase2Paid = Boolean(
          detailModalOrder.finalPaymentPaidAt ||
          detailInspectionDto?.finalPaymentPaidAt ||
          (detailModalOrder.linkedOrderId && !isInspectionPassed && inspStatus !== 'PASSED') ||
          detailModalOrder.escrowStatus === 'SHIPPED_TO_BUYER' ||
          detailModalOrder.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' ||
          (detailModalOrder.escrowStatus === 'COMPLETED_RELEASED' && (detailModalOrder as any).backendStatus !== 'CANCELLED')
        );

        // Sub-fees
        const baseInspectionFee = Number(
          detailInspectionDto?.inspectionFee ??
          (detailModalOrder as any)?.baseInspectionFee ??
          (isAtHome
            ? ((detailModalOrder.inspectionFeeVnd || 0) - ((detailModalOrder as any)?.travelFeeRoundTrip || (detailModalOrder as any)?.travelFee || 0))
            : ((detailModalOrder.inspectionFeeVnd || 0) - (detailModalOrder.shippingFeeVnd || (detailInspectionDto?.shippingFee || 0)) - (detailModalOrder.returnShippingReserveFee || (detailInspectionDto?.returnShippingReserveFee || 0))))
        ) || (detailInspectionDto?.inspectionFee ?? detailModalOrder.inspectionFeeVnd ?? 0);

        const shippingFeeToHub = isAtHome ? 0 : Number(
          detailInspectionDto?.shippingFee ??
          detailModalOrder.shippingFeeVnd ??
          0
        );

        const returnReserveFee = isAtHome ? 0 : Number(
          detailInspectionDto?.returnShippingReserveFee ??
          detailModalOrder.returnShippingReserveFee ??
          0
        );

        const travelFee = isAtHome ? Number(
          detailInspectionDto?.travelFeeRoundTrip ??
          detailInspectionDto?.travelFee ??
          (detailModalOrder as any)?.travelFeeRoundTrip ??
          (detailModalOrder as any)?.travelFee ??
          0
        ) : 0;

        const travelDistanceKm = isAtHome ? (
          detailInspectionDto?.travelDistanceKm ??
          (detailModalOrder as any)?.travelDistanceKm
        ) : undefined;

        const buyerCommitmentDeposit = Number(
          detailInspectionDto?.buyerCommitmentDeposit ??
          detailModalOrder.buyerCommitmentDeposit ??
          0
        );
        const purchaseItemPrice = detailInspectionDto?.finalItemPrice ?? detailModalOrder.itemPriceVnd;
        const purchaseDeliveryFee = detailInspectionDto?.finalShippingFee ?? detailModalOrder.finalShippingFee;
        const purchaseTotalBeforeDeposit = purchaseDeliveryFee == null ? null : purchaseItemPrice + purchaseDeliveryFee;
        const purchaseDeliveryLabel = isAtHome
          ? (lang === 'vi' ? 'Cước giao hàng (Người bán → Người mua)' : 'Delivery fee (Seller → Buyer)')
          : (lang === 'vi' ? 'Cước giao hàng (Hub → Người mua)' : 'Delivery fee (Hub → Buyer)');

        const totalInspectionCalculatedFee = isAtHome
          ? (baseInspectionFee + travelFee)
          : (baseInspectionFee + shippingFeeToHub + returnReserveFee);

        const fallbackShares = isCashShipping
          ? getCashInspectionFeeShares(
            totalInspectionCalculatedFee,
            shippingFeeToHub,
            feePayerSplit === 'SELLER_100' ? 'SELLER_PAYS' : feePayerSplit === 'SPLIT_50_50' ? 'SPLIT_50_50' : 'BUYER_PAYS'
          )
          : splitInspectionFee(totalInspectionCalculatedFee, buyerFeePercent);

        const buyerFeeShare = Number(
          detailInspectionDto?.buyerFeeShare ??
          detailModalOrder.buyerFeeShare ??
          fallbackShares.buyer
        );

        const sellerFeeShare = Number(
          detailInspectionDto?.sellerFeeShare ??
          detailModalOrder.sellerFeeShare ??
          fallbackShares.seller
        );

        const isBuyerInspectionPaid = Boolean(
          detailInspectionDto?.buyerPaidAt ||
          detailModalOrder.buyerPaidAt ||
          (detailModalOrder as any)?.buyer_paid_at
        );

        const isSellerInspectionPaid = Boolean(
          detailInspectionDto?.sellerPaidAt ||
          detailModalOrder.sellerPaidAt ||
          (detailModalOrder as any)?.seller_paid_at
        );
        const appliedPurchaseDeposit = isBuyerInspectionPaid && buyerCommitmentDeposit > 0 &&
          purchaseTotalBeforeDeposit != null && purchaseTotalBeforeDeposit - buyerCommitmentDeposit === detailModalOrder.totalPaidVnd
          ? buyerCommitmentDeposit : 0;

        const isBuyerShareFulfilled = (buyerFeeShare <= 0 && buyerCommitmentDeposit <= 0) || isBuyerInspectionPaid;
        const isSellerShareFulfilled = sellerFeeShare <= 0 || isSellerInspectionPaid;
        const isBothUpfrontPaid = isBuyerShareFulfilled && isSellerShareFulfilled;

        const modalBuyerShipment =
          detailShipments.find((s) => s.leg === 'CENTER_TO_BUYER' && s.status !== 'CANCELLED') ||
          detailShipments.find((s) => s.leg === 'CENTER_TO_BUYER');

        const hubToBuyerShippingFee = Number(
          modalBuyerShipment?.actualFee ??
          modalBuyerShipment?.quotedFee ??
          (detailInspectionDto as any)?.hubToBuyerShippingFee ??
          (detailInspectionDto as any)?.shippingFeeToBuyer ??
          (detailModalOrder as any)?.shippingFeeToBuyer ??
          0
        );

        const inboundCashShipment = isCashShipping
          ? detailShipments.find((s) => isInspectionCashShipment(s) || s.leg === 'SELLER_TO_CENTER')
          : null;

        const totalUpfrontRequired = (isCashShipping && feePayerSplit === 'SELLER_100')
          ? (baseInspectionFee + returnReserveFee)
          : (buyerFeeShare + sellerFeeShare + buyerCommitmentDeposit);

        const totalUpfrontCollected =
          (isBuyerInspectionPaid ? (buyerFeeShare + buyerCommitmentDeposit) : 0) +
          (isSellerInspectionPaid ? sellerFeeShare : 0);

        if (!isInspectionOrder) {
          return (
            <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
              <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                {t.orderSummary}
              </div>
              <div className="flex justify-between text-[#24263e]/70">
                <span>{t.itemAmount}:</span>
                <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.itemPriceVnd)}</span>
              </div>
              <div className="flex justify-between text-[#24263e]/70">
                <span>{t.shippingFee} (Vận chuyển Lalamove):</span>
                <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.shippingFeeVnd)}</span>
              </div>
              <div className="flex justify-between text-[#24263e]/70">
                <span>{t.platformFee}:</span>
                <span className="font-semibold text-[#24263e]">{formatVND(detailModalOrder.platformFeeVnd)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-[#24263e]">
                <span>{t.totalEscrow}:</span>
                <span className="font-extrabold text-[#24263e]">
                  {formatVND(detailModalOrder.totalPaidVnd)}
                </span>
              </div>
            </div>
          );
        }

        // Inspection Order UI
        return (
          <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#24263e] uppercase tracking-wider text-[11px]">
                {lang === 'vi' ? 'Chi Tiết Đơn Hàng Kiểm Định' : 'Inspection Order Summary'}
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800">
                {isAtHome
                  ? (lang === 'vi' ? 'Kiểm định tại nhà (AT_HOME)' : 'At-Home Inspection')
                  : (lang === 'vi' ? 'Kiểm định tại Hub (AT_CENTER)' : 'Hub Inspection')}
              </span>
            </div>

            {!isPhase2Paid && (
              <div className="flex justify-between items-center text-[#24263e]/80">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[#24263e]">
                    {lang === 'vi' ? 'Giá sản phẩm · Chưa thanh toán' : 'Product Price · Unpaid'}:
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    {lang === 'vi' ? 'Chưa thanh toán (GĐ 2)' : 'Phase 2 Unpaid'}
                  </span>
                </div>
                <span className="font-semibold text-slate-700">
                  {formatVND(detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0)}
                </span>
              </div>
            )}

            {/* Base inspection fee */}
            <div className="flex justify-between items-center text-[#24263e]/70">
              <span>{lang === 'vi' ? 'Phí kiểm định cơ sở:' : 'Base Inspection Fee:'}</span>
              <span className="font-semibold text-[#24263e]">{formatVND(baseInspectionFee)}</span>
            </div>

            {/* AT_CENTER fees: Seller -> Hub and return reserve */}
            {isAtCenter && (
              <>
                <div className="flex justify-between items-center text-[#24263e]/70">
                  <span>{lang === 'vi' ? 'Cước Seller → Hub (Lalamove):' : 'Seller → Hub Shipping (Lalamove):'}</span>
                  <div className="text-right">
                    <span className="font-semibold text-[#24263e]">{formatVND(shippingFeeToHub)}</span>
                    {isCashShipping && feePayerSplit === 'SELLER_100' ? (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {lang === 'vi' ? 'Seller trả trực tiếp cho tài xế' : 'Paid in cash to driver'}
                      </span>
                    ) : isCashShipping ? (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {lang === 'vi' ? 'Seller ứng cước khi gửi' : 'Seller advances cash'}
                      </span>
                    ) : null}
                  </div>
                </div>

                {returnReserveFee > 0 && (
                  <div className="flex justify-between items-center text-[#24263e]/70">
                    <span>{lang === 'vi' ? 'Dự phòng cước hoàn (Hub → Seller):' : 'Return Shipping Reserve (Hub → Seller):'}</span>
                    <div className="text-right">
                      <span className="font-semibold text-[#24263e]">{formatVND(returnReserveFee)}</span>
                      {isInspectionFailed || isInspectionRejected || isInspectionCancelled ? (
                        (() => {
                          const isReserveRefunded = Boolean(
                            (detailModalOrder as any).returnReserveRefundedAt ||
                            (detailInspectionDto as any)?.returnReserveRefundedAt ||
                            (detailModalOrder as any).returnReserveStatus === 'REFUNDED_UNUSED' ||
                            (detailInspectionDto as any)?.returnReserveStatus === 'REFUNDED_UNUSED' ||
                            (detailModalOrder as any).returnReserve?.status === 'REFUNDED_UNUSED' ||
                            (detailInspectionDto as any)?.returnReserve?.status === 'REFUNDED_UNUSED'
                          );
                          const isReturnShipped = Boolean(
                            detailShipments.some((s) => s.leg === 'CENTER_TO_SELLER' || s.leg === 'RETURN')
                          );
                          if (isReserveRefunded) {
                            return (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                                {lang === 'vi' ? 'Đã hoàn' : 'Refunded'}
                              </span>
                            );
                          }
                          if (isReturnShipped) {
                            return (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                                {lang === 'vi' ? 'Đã sử dụng' : 'Used'}
                              </span>
                            );
                          }
                          return (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {lang === 'vi' ? 'Đang giữ trong quỹ' : 'Held in Escrow'}
                            </span>
                          );
                        })()
                      ) : null}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* AT_HOME fee: Technician travel fee */}
            {isAtHome && travelFee > 0 && (
              <div className="flex justify-between items-center text-[#24263e]/70">
                <span>
                  {lang === 'vi' ? 'Phụ phí di chuyển kỹ thuật viên' : 'Technician Travel Fee'}
                  {travelDistanceKm ? ` (${travelDistanceKm} km)` : ''}:
                </span>
                <span className="font-semibold text-[#24263e]">{formatVND(travelFee)}</span>
              </div>
            )}

            {/* Buyer Commitment Deposit */}
            {buyerCommitmentDeposit > 0 && (
              <div className="flex justify-between items-center text-[#24263e]/70">
                <span>{lang === 'vi' ? 'Cọc cam kết của người mua:' : 'Buyer Commitment Deposit:'}</span>
                <div className="text-right">
                  <span className="font-semibold text-[#24263e]">{formatVND(buyerCommitmentDeposit)}</span>
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${isBuyerInspectionPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                    {isBuyerInspectionPaid ? (lang === 'vi' ? 'Đã thu' : 'Collected') : (lang === 'vi' ? 'Chưa nộp' : 'Pending')}
                  </span>
                </div>
              </div>
            )}

            {/* Fee split plan & individual shares */}
            <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{lang === 'vi' ? 'Phương án chia phí:' : 'Fee Split Plan:'}</span>
                </span>
                <span className="font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {feePercentLabel(buyerFeePercent, lang)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">• {lang === 'vi' ? 'Phần Người mua:' : 'Buyer Share:'}</span>
                <span className="font-semibold text-slate-800">
                  {formatVND(buyerFeeShare)}
                  <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-bold ${buyerFeeShare <= 0
                    ? 'bg-slate-100 text-slate-600'
                    : isBuyerInspectionPaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-orange-100 text-orange-800'
                    }`}>
                    {buyerFeeShare <= 0
                      ? (lang === 'vi' ? 'Không cần nộp' : 'No payment needed')
                      : isBuyerInspectionPaid
                        ? (lang === 'vi' ? 'Đã nộp' : 'Paid')
                        : (lang === 'vi' ? 'Chưa nộp' : 'Unpaid')}
                  </span>
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">• {lang === 'vi' ? 'Phần Người bán:' : 'Seller Share:'}</span>
                <span className="font-semibold text-slate-800">
                  {formatVND(sellerFeeShare)}
                  <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-bold ${sellerFeeShare <= 0
                    ? 'bg-slate-100 text-slate-600'
                    : isSellerInspectionPaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-orange-100 text-orange-800'
                    }`}>
                    {sellerFeeShare <= 0
                      ? (lang === 'vi' ? 'Không cần nộp' : 'No payment needed')
                      : isSellerInspectionPaid
                        ? (lang === 'vi' ? 'Đã nộp' : 'Paid')
                        : (lang === 'vi' ? 'Chưa nộp' : 'Unpaid')}
                  </span>
                </span>
              </div>

              {/* Cash advance reimbursement status if applicable */}
              {isCashShipping && feePayerSplit !== 'SELLER_100' && (
                <div className="pt-1.5 border-t border-gray-100 text-[10px] text-amber-900 bg-amber-50/70 p-1.5 rounded-lg flex items-center justify-between">
                  <span>
                    {lang === 'vi' ? 'Cước seller ứng cho tài xế:' : 'Seller cash advance to driver:'}{' '}
                    <strong>{formatVND(inboundCashShipment?.actualFee || shippingFeeToHub)}</strong>
                  </span>
                  <span>
                    {inboundCashShipment?.cashConfirmedAt
                      ? (lang === 'vi' ? `Đã hoàn ứng: ${formatVND(inboundCashShipment.cashReimbursedAmount || 0)}` : `Reimbursed: ${formatVND(inboundCashShipment.cashReimbursedAmount || 0)}`)
                      : (lang === 'vi' ? 'Chờ hoàn ứng sau khi giao Hub' : 'Pending reimbursement')}
                  </span>
                </div>
              )}

              {detailModalOrder.paymentDeadline && !isBothUpfrontPaid && String((detailModalOrder as any)?.backendStatus || '').toUpperCase() === 'WAITING_FEE_PAYMENT' && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-orange-800 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-600" />
                    <span>{lang === 'vi' ? 'Hạn nộp phí:' : 'Payment Deadline:'}</span>
                  </span>
                  <span className="font-bold">{formatInspectionDeadline(detailModalOrder.paymentDeadline, lang)}</span>
                </div>
              )}
            </div>

            {/* Phase 2 Hub -> Buyer shipping quote before payment */}
            {isInspectionPassed && !isPhase2Paid && hubToBuyerShippingFee > 0 && (
              <div className="flex justify-between items-center text-[#24263e]/70">
                <span>{lang === 'vi' ? 'Cước giao hàng tận tay (Hub → Buyer):' : 'Hub → Buyer Delivery Fee:'}</span>
                <div className="text-right">
                  <span className="font-semibold text-[#24263e]">{formatVND(hubToBuyerShippingFee)}</span>
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                    {lang === 'vi' ? 'Thanh toán khi mua tiếp' : 'Due upon purchase'}
                  </span>
                </div>
              </div>
            )}

            {/* Total Row */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center font-bold text-sm text-[#24263e]">
                <span>
                  {isPhase2Paid
                    ? (lang === 'vi' ? 'Tổng tiền phong tỏa Escrow:' : 'Total Escrow Held:')
                    : !isBothUpfrontPaid
                      ? (lang === 'vi' ? 'Tổng cần nộp trước (GĐ 1):' : 'Total Upfront Required (Phase 1):')
                      : (lang === 'vi' ? 'Tổng đã nộp trước (GĐ 1):' : 'Total Upfront Paid (Phase 1):')}
                </span>
                <span className="font-extrabold text-[#24263e]">
                  {formatVND(
                    isPhase2Paid
                      ? detailModalOrder.totalPaidVnd
                      : !isBothUpfrontPaid
                        ? totalUpfrontRequired
                        : totalUpfrontCollected
                  )}
                </span>
              </div>
              {isPhase2Paid ? (
                <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                  <dl className="space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <dt>{lang === 'vi' ? 'Tiền hàng' : 'Item price'}</dt>
                      <dd className="shrink-0 font-semibold text-[#24263e]">{formatVND(purchaseItemPrice)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>{purchaseDeliveryLabel}</dt>
                      <dd className="text-right font-semibold text-[#24263e]">
                        {purchaseDeliveryFee != null ? formatVND(purchaseDeliveryFee) : (lang === 'vi' ? 'Chưa có chi tiết' : 'Details unavailable')}
                      </dd>
                    </div>
                    {appliedPurchaseDeposit > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt>{lang === 'vi' ? 'Cọc cam kết đã khấu trừ' : 'Commitment deposit applied'}</dt>
                        <dd className="shrink-0 font-semibold text-[#24263e]">{formatVND(-appliedPurchaseDeposit)}</dd>
                      </div>
                    )}
                  </dl>
                  {purchaseTotalBeforeDeposit != null && purchaseTotalBeforeDeposit - appliedPurchaseDeposit !== detailModalOrder.totalPaidVnd && (
                    <p className="mt-1.5 text-slate-500">
                      {lang === 'vi' ? 'Các khoản trên chưa đối chiếu được với tổng thanh toán.' : 'These amounts do not reconcile with the payment total.'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-right mt-0.5">
                  {!isBothUpfrontPaid ? (
                    <span className="text-orange-700 font-medium">
                      {isBuyerInspectionPaid && !isSellerInspectionPaid
                        ? (lang === 'vi' ? 'Người mua đã nộp · Chờ người bán nộp' : 'Buyer paid · Awaiting seller payment')
                        : isSellerInspectionPaid && !isBuyerInspectionPaid
                          ? (lang === 'vi' ? 'Người bán đã nộp · Chờ người mua nộp' : 'Seller paid · Awaiting buyer payment')
                          : (lang === 'vi' ? 'Chưa bên nào nộp phí' : 'Neither party paid')}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Đã nộp đủ phí kiểm định GĐ 1' : 'Phase 1 inspection fee paid in full'}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Phase 2 purchase next step (when inspection passed and awaiting buyer payment) */}
            {isInspectionPassed && !isPhase2Paid && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-950 mt-2">
                <div className="font-bold flex items-center justify-between text-blue-900">
                  <span>{lang === 'vi' ? 'Thanh Toán Mua Tiếp Sản Phẩm (Giai đoạn 2)' : 'Phase 2 Product Purchase Payment'}</span>
                  <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {lang === 'vi' ? 'Chờ Người Mua Thanh Toán' : 'Awaiting Buyer Payment'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 text-[11px]">
                  <span>{lang === 'vi' ? 'Giá sản phẩm:' : 'Product Price:'}</span>
                  <span className="font-semibold">{formatVND(detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0)}</span>
                </div>
                {hubToBuyerShippingFee > 0 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span>{lang === 'vi' ? 'Cước giao hàng tận tay (Hub → Người mua):' : 'Hub → Buyer Delivery Fee:'}</span>
                    <span className="font-semibold">{formatVND(hubToBuyerShippingFee)}</span>
                  </div>
                )}
                {buyerCommitmentDeposit > 0 && (
                  <div className="flex justify-between text-emerald-700 text-[11px]">
                    <span>{lang === 'vi' ? 'Khấu trừ cọc cam kết đã nộp:' : 'Deduct Commitment Deposit:'}</span>
                    <span className="font-semibold">-{formatVND(buyerCommitmentDeposit)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-blue-200/80 flex justify-between font-bold text-xs text-blue-950">
                  <span>{lang === 'vi' ? 'Tổng thanh toán mua hàng GĐ 2:' : 'Total Phase 2 Payment Due:'}</span>
                  <span className="font-black text-blue-900">
                    {formatVND((detailModalOrder.itemPriceVnd || detailInspectionDto?.postPrice || 0) + hubToBuyerShippingFee - buyerCommitmentDeposit)}
                  </span>
                </div>
              </div>
            )}

            {/* Inspection Failed / Rejected / Cancelled Resolution */}
            {(isInspectionFailed || isInspectionRejected || isInspectionCancelled) && (
              (() => {
                const isPurchaseExpired = isExpiredInspectionPurchase(
                  inspStatus,
                  detailInspectionDto?.note || detailModalOrder.inspectionNote
                );
                const cancelReasonInfo = getCancellationReasonDisplay(detailModalOrder, lang);
                const orderNote = detailInspectionDto?.note || detailModalOrder.inspectionNote;
                const refundPartyLabel =
                  feePayerSplit === 'SELLER_100'
                    ? (lang === 'vi' ? 'người bán' : 'seller')
                    : feePayerSplit === 'BUYER_100'
                      ? (lang === 'vi' ? 'người mua' : 'buyer')
                      : (lang === 'vi' ? 'cả hai bên theo tỷ lệ đã chốt' : 'both parties at the agreed split');
                const feePayerDescription = feePercentLabel(buyerFeePercent, lang);
                return (
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-950 mt-2">
                    <div className="font-bold flex items-center justify-between text-rose-900">
                      <span>{lang === 'vi' ? 'Kết thúc' : 'Inspection Process Ended'}</span>
                      <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                        {isInspectionFailed
                          ? (lang === 'vi' ? 'Không Đạt Chuẩn' : 'Inspection Failed')
                          : isInspectionRejected
                            ? (lang === 'vi' ? 'Từ Chối Mua' : 'Purchase Declined')
                            : isPurchaseExpired
                              ? (lang === 'vi' ? 'Hết Hạn Thanh Toán' : 'Payment Expired')
                              : (lang === 'vi' ? 'Đã Hủy' : 'Cancelled')}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800/90 leading-relaxed">
                      {isInspectionFailed
                        ? (lang === 'vi'
                          ? 'Thiết bị không đạt yêu cầu kiểm định kỹ thuật của SecondLife. Quy trình mua bán dừng tại đây và thiết bị được chuyển hoàn về cho Người bán.'
                          : 'Device did not meet technical inspection standards. Purchase cancelled and item is scheduled for return to Seller.')
                        : isInspectionRejected
                          ? (lang === 'vi'
                            ? `Người mua đã từ chối tiếp tục mua sau khi xem biên bản kiểm định.${orderNote ? ` (${orderNote})` : ''} Thiết bị được chuyển hoàn về cho Người bán.`
                            : 'Buyer declined purchase after inspection report. Item is scheduled for return to Seller.')
                          : isPurchaseExpired
                            ? (lang === 'vi'
                              ? `Đơn hàng đã tự động hủy do người mua không thanh toán tiền hàng Giai đoạn 2 trong vòng 6 giờ sau khi kiểm định đạt chuẩn. Khoản dự phòng cước hoàn (${formatVND(returnReserveFee)}) đang được giữ trong quỹ và sẽ được hoàn trả về ví cho ${refundPartyLabel} (bên đã nộp) sau khi đối soát quyết toán.`
                              : `Order auto-cancelled as buyer did not complete Phase 2 payment within 6 hours of passing inspection. Return reserve (${formatVND(returnReserveFee)}) is held and will be refunded to ${refundPartyLabel} upon settlement reconciliation.`)
                            : (cancelReasonInfo.reason
                              ? `${lang === 'vi' ? 'Lý do hủy đơn: ' : 'Cancellation reason: '}${cancelReasonInfo.reason}`
                              : (orderNote || (lang === 'vi'
                                ? 'Đơn kiểm định đã kết thúc. Phí và tiền cọc được xử lý đối soát theo quy định.'
                                : 'Inspection order ended. Fees are handled according to policy.')))}
                    </p>
                    {isInspectionFailed && (
                      <p className="text-[11px] text-rose-800/90 leading-relaxed">
                        {lang === 'vi'
                          ? 'Phí kiểm định và vận chuyển được chia theo tỷ lệ đã thống nhất. Phần dư dự phòng cước trả hàng được hoàn theo tỷ lệ này sau khi trừ cước thực tế.'
                          : 'Inspection and shipping costs follow the agreed split. Any unused return reserve is refunded at that split after deducting the actual return shipping cost.'}
                      </p>
                    )}
                    {isAtCenter && returnReserveFee > 0 && (
                      <div className="pt-1.5 border-t border-rose-200/80 text-[11px] text-rose-900 flex items-center justify-between">
                        <span>{lang === 'vi' ? `Khoản dự phòng cước hoàn (${formatVND(returnReserveFee)} · ${feePayerDescription}):` : `Return shipping reserve (${formatVND(returnReserveFee)}):`}</span>
                        <div>
                          {Boolean(
                            (detailModalOrder as any).returnReserveRefundedAt ||
                            (detailInspectionDto as any)?.returnReserveRefundedAt ||
                            (detailModalOrder as any).returnReserveStatus === 'REFUNDED_UNUSED' ||
                            (detailInspectionDto as any)?.returnReserveStatus === 'REFUNDED_UNUSED' ||
                            (detailModalOrder as any).returnReserve?.status === 'REFUNDED_UNUSED' ||
                            (detailInspectionDto as any)?.returnReserve?.status === 'REFUNDED_UNUSED'
                          ) ? (
                            <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                              {lang === 'vi'
                                ? `Đã hoàn về ví ${feePayerSplit === 'SELLER_100' ? 'người bán' : feePayerSplit === 'BUYER_100' ? 'người mua' : 'hai bên theo tỷ lệ đã chốt'}`
                                : 'Refunded'}
                            </span>
                          ) : detailShipments.some((s) => s.leg === 'CENTER_TO_SELLER' || s.leg === 'RETURN') ? (
                            <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded text-[10px]">
                              {lang === 'vi' ? 'Đã sử dụng cho cước hoàn' : 'Used for return delivery'}
                            </span>
                          ) : (
                            <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px]">
                              {lang === 'vi' ? 'Đang giữ trong quỹ (Chờ đối soát)' : 'Held in Escrow (Pending reconciliation)'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        );
      })()}
    </>
  );
}
