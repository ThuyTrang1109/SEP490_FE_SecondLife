import type { EscrowOrder, OrderCommissionDTO, OrderSettlementDTO } from '../../types';
import { isOrderWithInspection } from './orderReceipt';

const commissionStages = new Set<EscrowOrder['escrowStatus']>([
  'HELD_IN_ESCROW',
  'SHIPPED_TO_BUYER',
  'DELIVERED_INSPECTION_WINDOW',
  'DISPUTED',
]);

export function getOrderFinanceLookup(order: EscrowOrder | null | undefined) {
  if (!order) return null;
  const isInspectionOnly = isOrderWithInspection(order) &&
    (!order.inspectionOrderId || order.inspectionOrderId === order.id);
  const orderId = order.linkedOrderId || (isInspectionOnly ? null : order.id);
  if (!orderId) return null;

  if (order.backendEscrowStatus === 'RELEASED') return { orderId, resource: 'settlement' as const };
  if (order.backendEscrowStatus === 'HELD' || order.backendEscrowStatus === 'FROZEN' ||
    (!order.backendEscrowStatus && commissionStages.has(order.escrowStatus))) {
    return { orderId, resource: 'commission' as const };
  }
  return null;
}

export interface SellerPayoutData {
  sellerPayout: number;
  platformCommission: number;
  ratePercent?: number;
  source: 'settlement' | 'commission' | 'preview';
}

export function toCommissionRatePercent(rate: number): number {
  return Number((rate * 100).toFixed(8));
}

export function getCommissionPayout(commission: OrderCommissionDTO, fallbackBase?: number): SellerPayoutData | null {
  const platformCommission = commission.platformCommission;
  if (platformCommission == null || !Number.isFinite(platformCommission)) return null;

  const base = commission.commissionBase ?? fallbackBase;
  const sellerPayout = commission.sellerPayout ?? (base != null && Number.isFinite(base) ? base - platformCommission : null);

  if (sellerPayout == null || !Number.isFinite(sellerPayout)) return null;
  return {
    sellerPayout,
    platformCommission,
    ratePercent: commission.rate == null ? commission.ratePercent : toCommissionRatePercent(commission.rate),
    source: 'commission',
  };
}

export function getInspectionPayoutPreview(order: EscrowOrder): SellerPayoutData | undefined {
  if (order.linkedOrderId || order.backendEscrowStatus) return;
  const preview = order.sellerCommissionPreview;
  if (preview) {
    return {
      sellerPayout: preview.sellerPayout,
      platformCommission: preview.platformCommission,
      ratePercent: toCommissionRatePercent(preview.rate),
      source: 'preview',
    };
  }
}

export function getSettlementPayout(settlement: OrderSettlementDTO): SellerPayoutData | null {
  if (!Number.isFinite(settlement.sellerPayout) || !Number.isFinite(settlement.platformCommission)) return null;
  return { sellerPayout: settlement.sellerPayout, platformCommission: settlement.platformCommission, source: 'settlement' };
}
