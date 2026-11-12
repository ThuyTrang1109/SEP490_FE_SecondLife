import type { InspectionOrderDto } from '../services/inspectorService';

export const centerFeeFilters = {
  waiting: 'Chờ nộp phí',
  partial: 'Đã nộp một phần',
  collected: 'Đã thu đủ',
  settled: 'Đã quyết toán',
} as const;

export type CenterFeeFilter = keyof typeof centerFeeFilters;
type CollectionStatus = Exclude<CenterFeeFilter, 'settled'> | 'not_due' | 'unknown';

function getPartyPayment(amount: number | undefined, paidAt?: string | null) {
  const paid = amount != null && amount > 0 && Boolean(paidAt);
  return { amount, paid, paidAt: paid ? paidAt : undefined };
}

export function getCenterFeeCollection(order: InspectionOrderDto) {
  const buyerAmount = order.buyerFeeShare == null ? undefined
    : order.buyerFeeShare + (order.buyerCommitmentDeposit ?? 0);
  const buyer = getPartyPayment(buyerAmount, order.buyerPaidAt);
  const seller = getPartyPayment(order.sellerFeeShare ?? undefined, order.sellerPaidAt);
  const totalCollected = (buyer.paid ? buyer.amount ?? 0 : 0) + (seller.paid ? seller.amount ?? 0 : 0);
  const hasAmounts = buyer.amount != null && seller.amount != null;
  let collection: CollectionStatus = 'waiting';
  if (['PENDING', 'WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL'].includes(order.status)) collection = 'not_due';
  else if (!hasAmounts) collection = 'unknown';
  else if ((buyer.amount === 0 || buyer.paid) && (seller.amount === 0 || seller.paid)) collection = 'collected';
  else if (buyer.paid || seller.paid) collection = 'partial';
  return { buyer, seller, totalCollected, hasAmounts, collection, settledAt: order.feeSettledAt };
}

export type CenterFeeCollection = ReturnType<typeof getCenterFeeCollection>;

export function isCenterFeeCollectionClosed(status: string) {
  return ['CANCELLED', 'CANCELED', 'PAYMENT_EXPIRED'].includes(status);
}

export function matchesCenterFeeFilter(fees: CenterFeeCollection, filter: CenterFeeFilter, collectionClosed: boolean) {
  if (filter === 'settled') return Boolean(fees.settledAt);
  if (filter === 'collected') return fees.collection === 'collected';
  return !collectionClosed && fees.collection === filter;
}
