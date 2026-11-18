import assert from 'node:assert/strict';
import test from 'node:test';
import { orderFeedItemToRaw, type OrderFeedItem } from '../services/orderFeedService';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';
import { getCommissionPayout, getInspectionPayoutPreview, getOrderFinanceLookup, getSettlementPayout } from '../utils/orders/orderFinance';

const purchase: NonNullable<OrderFeedItem['order']> = {
  id: 'purchase-order',
  postId: 'post',
  postTitle: 'Nồi cơm điện',
  buyerId: 'buyer',
  sellerId: 'seller',
  finalPrice: 1_950_000,
  escrowStatus: 'HELD',
  status: 'PROCESSING',
  createdAt: '2026-11-16T13:00:00Z',
};

const inspection: NonNullable<OrderFeedItem['inspection']> = {
  id: 'inspection-order',
  postId: purchase.postId,
  postTitle: purchase.postTitle,
  buyerId: purchase.buyerId,
  sellerId: purchase.sellerId,
  status: 'PASSED',
  orderType: 'AT_HOME',
};

function fromFeed(
  order: OrderFeedItem['order'],
  inspectionOrder: OrderFeedItem['inspection'] = null,
  sellerCommissionPreview?: OrderFeedItem['sellerCommissionPreview'],
) {
  const raw = orderFeedItemToRaw({
    order,
    inspection: inspectionOrder,
    sellerCommissionPreview,
    buyerName: 'Người mua',
    sellerName: 'Người bán',
    postImageUrl: null,
    categoryId: null,
    itemId: null,
    itemCondition: null,
  });
  return mapEscrowOrder(raw, { currentListings: [], currentRole: 'buyer', authoritative: true });
}

test('buying after an inspection and receiving delivery do not trigger a settlement read while escrow is held', () => {
  const paidInspection = { ...inspection, linkedOrderId: purchase.id, finalPaymentPaidAt: purchase.createdAt };
  const paid = fromFeed(purchase, paidInspection);
  assert.equal(paid.linkedOrderId, purchase.id);
  assert.deepEqual(getOrderFinanceLookup(paid), { orderId: purchase.id, resource: 'commission' });

  const delivered = fromFeed({ ...purchase, status: 'DELIVERED', shippingDeliveredAt: purchase.createdAt }, paidInspection);
  assert.deepEqual(getOrderFinanceLookup(delivered), { orderId: purchase.id, resource: 'commission' });

  const locallyConfirmed = { ...delivered, escrowStatus: 'COMPLETED_RELEASED' as const, backendStatus: 'COMPLETED' as const };
  assert.deepEqual(getOrderFinanceLookup(locallyConfirmed), { orderId: purchase.id, resource: 'commission' });
});

test('released orders load final settlement with the purchase ID', () => {
  const released = { ...purchase, status: 'COMPLETED' as const, escrowStatus: 'RELEASED' as const };
  assert.deepEqual(getOrderFinanceLookup(fromFeed(released)), { orderId: purchase.id, resource: 'settlement' });
  assert.deepEqual(getOrderFinanceLookup(fromFeed(released, { ...inspection, status: 'COMPLETED' })),
    { orderId: purchase.id, resource: 'settlement' });
});

test('inspection-only, unpaid and refunded orders do not load purchase finance details', () => {
  assert.equal(getOrderFinanceLookup(fromFeed(null, inspection)), null);
  assert.equal(getOrderFinanceLookup(fromFeed(null, { ...inspection, status: 'COMPLETED' })), null);
  assert.equal(getOrderFinanceLookup(fromFeed({ ...purchase, status: 'PENDING_PAYMENT', escrowStatus: 'PENDING' })), null);
  assert.equal(getOrderFinanceLookup(fromFeed({ ...purchase, status: 'CANCELLED', escrowStatus: 'REFUNDED' })), null);
});

test('uses the commission snapshot for the specific order, including its actual fee', () => {
  assert.deepEqual(getCommissionPayout({ rate: 0.05, platformCommission: 25_000, sellerPayout: 475_000 }), {
    sellerPayout: 475_000, platformCommission: 25_000, ratePercent: 5, source: 'commission',
  });
  // The minimum fee can make the effective percentage differ from the configured rate.
  assert.equal(getCommissionPayout({ commissionBase: 100_000, ratePercent: 5, platformCommission: 10_000 }, 100_000)?.sellerPayout, 90_000);
  assert.equal(getCommissionPayout({ ratePercent: 5 }, 500_000), null);
});

test('shows the API preview while the seller is scheduling inspection before purchase', () => {
  const appointment = { ...inspection, status: 'CONFIRMED_PENDING_DISPATCH', finalItemPrice: 500_000 };
  const preview = { rate: 0.05, platformCommission: 25_000, sellerPayout: 475_000 };
  const unpurchased = fromFeed(null, appointment, preview);
  assert.equal(getOrderFinanceLookup(unpurchased), null);
  assert.deepEqual(getInspectionPayoutPreview(unpurchased), {
    ratePercent: 5, platformCommission: 25_000, sellerPayout: 475_000, source: 'preview',
  });
  const purchased = fromFeed(purchase, appointment, preview);
  assert.deepEqual(getOrderFinanceLookup(purchased), { orderId: purchase.id, resource: 'commission' });
  assert.equal(getInspectionPayoutPreview(purchased), undefined);
});

test('uses the settled payout without inferring a policy rate from the fee', () => {
  const payout = getSettlementPayout({
    commissionBase: 150_000, rawCommission: 7_500, platformCommission: 10_000,
    sellerPayout: 140_000, shippingFee: 0, currency: 'VND', settledAt: '2026-11-17T00:00:00Z',
  });
  assert.equal(payout?.sellerPayout, 140_000);
  assert.equal(payout?.ratePercent, undefined);
});
