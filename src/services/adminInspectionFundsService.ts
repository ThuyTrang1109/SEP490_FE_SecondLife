import { requestGet, ApiError } from './apiClient';
import type { AdminInspectionOrderFundsDTO } from '../types/adminInspectionFunds';

export function normalizeAdminInspectionFunds(raw: any): AdminInspectionOrderFundsDTO {
  if (!raw) return raw;

  const buyerData = raw.buyerPayment ?? raw.buyer;
  const buyerPayment = buyerData
    ? {
        amountDue: Number(buyerData.amountDue ?? 0),
        amountCollected: Number(buyerData.amountCollected ?? 0),
        paidAt: buyerData.paidAt || null,
      }
    : null;

  const sellerData = raw.sellerPayment ?? raw.seller;
  const sellerPayment = sellerData
    ? {
        amountDue: Number(sellerData.amountDue ?? 0),
        amountCollected: Number(sellerData.amountCollected ?? 0),
        paidAt: sellerData.paidAt || null,
      }
    : null;

  const fees = raw.fees ?? {
    inspectionFee: raw.inspectionFee !== undefined ? Number(raw.inspectionFee) : null,
    travelFee: raw.travelFee !== undefined ? Number(raw.travelFee) : null,
    shippingFee: raw.shippingFee !== undefined ? Number(raw.shippingFee) : null,
    buyerCommitmentDeposit: raw.buyerCommitmentDeposit !== undefined ? Number(raw.buyerCommitmentDeposit) : null,
    cashShippingSimulation: Boolean(raw.cashShippingSimulation),
    outboundCashPendingAmount: raw.outboundCashPendingAmount !== undefined ? Number(raw.outboundCashPendingAmount) : null,
  };

  return {
    ...raw,
    inspectionOrderId: String(raw.inspectionOrderId || raw.id || ''),
    totalCollected: Number(raw.totalCollected ?? 0),
    unsettledCollectedAmount: Number(raw.unsettledCollectedAmount ?? 0),
    collectionStatus: raw.collectionStatus || 'UNPAID',
    buyerPayment,
    sellerPayment,
    buyer: buyerPayment,
    seller: sellerPayment,
    fees,
    inspectionFee: fees.inspectionFee,
    travelFee: fees.travelFee,
    shippingFee: fees.shippingFee,
    buyerCommitmentDeposit: fees.buyerCommitmentDeposit,
    cashShippingSimulation: fees.cashShippingSimulation,
    outboundCashPendingAmount: fees.outboundCashPendingAmount,
    returnReserve: raw.returnReserve
      ? {
          plannedAmount: Number(raw.returnReserve.plannedAmount ?? 0),
          heldAmount: Number(raw.returnReserve.heldAmount ?? 0),
          status: raw.returnReserve.status,
        }
      : null,
    settlement: raw.settlement
      ? {
          centerPayoutAmount:
            raw.settlement.centerPayoutAmount !== undefined && raw.settlement.centerPayoutAmount !== null
              ? Number(raw.settlement.centerPayoutAmount)
              : null,
          buyerRefundAmount:
            raw.settlement.buyerRefundAmount !== undefined && raw.settlement.buyerRefundAmount !== null
              ? Number(raw.settlement.buyerRefundAmount)
              : null,
          sellerRefundAmount:
            raw.settlement.sellerRefundAmount !== undefined && raw.settlement.sellerRefundAmount !== null
              ? Number(raw.settlement.sellerRefundAmount)
              : null,
          sellerCompensationAmount:
            raw.settlement.sellerCompensationAmount !== undefined && raw.settlement.sellerCompensationAmount !== null
              ? Number(raw.settlement.sellerCompensationAmount)
              : null,
          platformRetainedAmount:
            raw.settlement.platformRetainedAmount !== undefined && raw.settlement.platformRetainedAmount !== null
              ? Number(raw.settlement.platformRetainedAmount)
              : null,
          settledAt: raw.settlement.settledAt || null,
        }
      : null,
    shipments: Array.isArray(raw.shipments)
      ? raw.shipments.map((s: any) => ({
          shipmentId: s.id || s.shipmentId,
          leg: s.leg,
          orderCode: s.orderCode,
          status: s.status,
          providerStatus: s.providerStatus,
          actualFee: s.actualFee !== undefined && s.actualFee !== null ? Number(s.actualFee) : null,
          cashPaidAmount: s.cashPaidAmount !== undefined && s.cashPaidAmount !== null ? Number(s.cashPaidAmount) : null,
          cashReimbursedAmount:
            s.cashReimbursedAmount !== undefined && s.cashReimbursedAmount !== null ? Number(s.cashReimbursedAmount) : null,
          cashConfirmedAt: s.cashConfirmedAt || null,
        }))
      : [],
  };
}

export async function getAdminInspectionOrderFunds(
  inspectionOrderId: string
): Promise<AdminInspectionOrderFundsDTO> {
  if (!inspectionOrderId || !inspectionOrderId.trim()) {
    throw new Error('Mã đơn kiểm định không hợp lệ.');
  }

  const cleanId = inspectionOrderId.trim();

  try {
    const res = await requestGet<any>(
      `/admin/inspection/orders/${encodeURIComponent(cleanId)}/funds`,
      { requiresAuth: true }
    );
    const data = (res as any)?.data ?? res;
    return normalizeAdminInspectionFunds(data);
  } catch (error: any) {
    if (error instanceof ApiError || (error && typeof error.status === 'number')) {
      if (error.status === 403) {
        throw new Error('Bạn không có quyền xem đối soát');
      }
      if (error.status === 404) {
        // Fallback: If funds record not yet aggregated, query order directly from inspectorService
        try {
          const { inspectorService } = await import('./inspectorService');
          const insp = await inspectorService.getOrder(cleanId);
          if (insp && insp.id) {
            const bShare = Number(insp.buyerFeeShare ?? 0);
            const sShare = Number(insp.sellerFeeShare ?? 0);
            const deposit = Number(insp.buyerCommitmentDeposit ?? 0);
            const bCollected = insp.buyerPaidAt ? (bShare + deposit) : 0;
            const sCollected = insp.sellerPaidAt ? sShare : 0;
            const total = bCollected + sCollected;
            const reserve = Number(insp.returnShippingReserveFee ?? 408000);
            return normalizeAdminInspectionFunds({
              inspectionOrderId: insp.id,
              totalCollected: total,
              unsettledCollectedAmount: Boolean(insp.feeSettledAt) ? 0 : reserve,
              collectionStatus: total >= (bShare + sShare + deposit) ? 'PAID' : (total > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
              buyer: {
                amountDue: bShare + deposit,
                amountCollected: bCollected,
                paidAt: insp.buyerPaidAt || null,
              },
              seller: {
                amountDue: sShare,
                amountCollected: sCollected,
                paidAt: insp.sellerPaidAt || null,
              },
              inspectionFee: Number(insp.inspectionFee ?? 200000),
              travelFee: Number(insp.travelFee || (insp as any).travelFeeRoundTrip || 0),
              shippingFee: Number(insp.shippingFee ?? 340000),
              buyerCommitmentDeposit: deposit,
              cashShippingSimulation: Boolean(insp.cashShippingSimulation),
              outboundCashPendingAmount: 0,
              returnReserve: {
                plannedAmount: reserve,
                heldAmount: Boolean(insp.feeSettledAt) ? 0 : reserve,
                status: Boolean(insp.feeSettledAt) ? 'SETTLED' : 'HELD_PENDING_INSPECTION',
              },
              settlement: insp.feeSettledAt ? {
                centerPayoutAmount: Number(insp.centerPayoutAmount ?? 0),
                settledAt: insp.feeSettledAt,
              } : null,
              shipments: [],
            });
          }
        } catch {}
        throw new Error('Không tìm thấy đơn kiểm định');
      }
    }
    throw error;
  }
}

