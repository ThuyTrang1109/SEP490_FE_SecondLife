import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderFeeBreakdown } from '../components/orders/detail/OrderFeeBreakdown';
import { orderFeedItemToRaw, type OrderFeedItem } from '../services/orderFeedService';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';

const purchase: NonNullable<OrderFeedItem['order']> = {
  id: 'purchase-order', postId: 'post', sellerId: 'seller', buyerId: 'buyer',
  status: 'PROCESSING', escrowStatus: 'HELD', createdAt: '2026-11-18T09:00:00Z',
  finalPrice: 420_000, shippingFee: 78_900, totalPaid: 498_900,
};
const inspection: NonNullable<OrderFeedItem['inspection']> = {
  id: 'inspection-order', postId: 'post', sellerId: 'seller', buyerId: 'buyer',
  orderType: 'AT_HOME', status: 'DELIVERING_TO_BUYER', finalPaymentPaidAt: purchase.createdAt,
  shippingFee: 0, inspectionFee: 200_000, travelFee: 811_800,
};

function renderBreakdown(order: typeof purchase, inspectionOrder = inspection) {
  const data = orderFeedItemToRaw({
    order, inspection: inspectionOrder, buyerName: null, sellerName: null, postImageUrl: null,
    categoryId: null, itemId: null, itemCondition: null,
  });
  return renderToStaticMarkup(createElement(OrderFeeBreakdown, {
    order: mapEscrowOrder(data, { currentListings: [], currentRole: 'seller', authoritative: true }),
    detailInspectionDto: null, detailShipments: [], getInspectionFeeSplit: () => 'BUYER_100' as const, lang: 'vi',
  }));
}

test('the paid at-home order shows the item and checkout delivery fee under its Escrow total', () => {
  const html = renderBreakdown(purchase);
  assert.match(html, /Tổng tiền:<\/span><span[^>]*>498\.900\s*₫/);
  assert.match(html, /Tiền hàng<\/dt><dd[^>]*>420\.000\s*₫/);
  assert.match(html, /Cước giao hàng \(Người bán → Người mua\)<\/dt><dd[^>]*>78\.900\s*₫/);
});

test('missing shipping data displays as unavailable while an explicit free delivery displays zero', () => {
  const missing = renderBreakdown({ ...purchase, shippingFee: undefined });
  assert.match(missing, /Cước giao hàng \(Người bán → Người mua\)<\/dt><dd[^>]*>Chưa có chi tiết/);

  const free = renderBreakdown({ ...purchase, totalPaid: 420_000 }, { ...inspection, finalShippingFee: 0 });
  assert.match(free, /Cước giao hàng \(Người bán → Người mua\)<\/dt><dd[^>]*>0\s*₫/);
});

test('unpaid inspection breakdown hides the redundant Phase 2 unpaid product price row', () => {
  const unpaidInspection: NonNullable<OrderFeedItem['inspection']> = {
    id: 'insp-unpaid', postId: 'post', sellerId: 'seller', buyerId: 'buyer',
    orderType: 'AT_CENTER', status: 'WAITING_SELLER_APPROVAL',
    shippingFee: 340_000, returnShippingReserveFee: 374_000, inspectionFee: 15_000,
    buyerFeePercent: 50,
  };
  const data = orderFeedItemToRaw({
    order: null, inspection: unpaidInspection, buyerName: null, sellerName: null, postImageUrl: null,
    categoryId: null, itemId: null, itemCondition: null,
  });
  const html = renderToStaticMarkup(createElement(OrderFeeBreakdown, {
    order: mapEscrowOrder(data, { currentListings: [], currentRole: 'seller', authoritative: true }),
    detailInspectionDto: unpaidInspection as any,
    detailShipments: [],
    getInspectionFeeSplit: () => 'SPLIT_50_50' as const,
    lang: 'vi',
  }));
  assert.doesNotMatch(html, /Giá sản phẩm · Chưa thanh toán|Chưa thanh toán \(Giai đoạn 2\)/);
  assert.match(html, /Phí kiểm định cơ sở:/);
});
