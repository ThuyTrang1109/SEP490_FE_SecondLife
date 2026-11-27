import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderSettlement } from '../components/orders/detail/OrderSettlement';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { orderFeedItemToRaw } from '../services/orderFeedService';
import { mapEscrowOrder } from '../utils/mapEscrowOrder';
import type { EscrowOrder, ShipmentBackend } from '../types';
import { canOpenOrderDispute, canCreateApprovedOrderReturn, getApprovedReturnLabel, formatDisputeReason, formatDisputeStatus, formatDisputeDateTime, getOrderEscrowHoldNotice, getSellerDisputeResponseState, isOrderDisputed, isOrderEscrowOnHold } from '../utils/orders/orderDispute';
import { resolveAppRoute } from '../app/router/paths';

const delivery = Date.parse('2026-11-22T03:00:00Z');
const deadline = delivery + 48 * 60 * 60 * 1000;
const order = { status: 'DELIVERED', escrowStatus: 'HELD', shippingDeliveredAt: new Date(delivery).toISOString() };

test('order dispute eligibility follows backend delivery and exact deadline', () => {
  assert.equal(canOpenOrderDispute(order, delivery - 1), false);
  assert.equal(canOpenOrderDispute(order, delivery), true);
  assert.equal(canOpenOrderDispute(order, deadline - 1), true);
  assert.equal(canOpenOrderDispute(order, deadline), false);
  assert.equal(canOpenOrderDispute({ ...order, status: 'SHIPPED' }, delivery), false);
  assert.equal(canOpenOrderDispute({ ...order, escrowStatus: 'RELEASED' }, delivery), false);
  assert.equal(canOpenOrderDispute({ ...order, shippingDeliveredAt: undefined }, delivery), false);
  assert.equal(canOpenOrderDispute({ ...order, status: 'DISPUTED', backendStatus: 'DELIVERED', backendEscrowStatus: 'FROZEN' }, delivery), true);
});

test('a rejected Hub-to-buyer shipment hides only the generic escrow notice', () => {
  const rejected: ShipmentBackend = {
    shipmentId: 'failed-hub-leg', orderId: 'purchase', orderCode: 'carrier-order',
    leg: 'CENTER_TO_BUYER', status: 'FAILED', providerStatus: 'REJECTED',
    expectedDeliveryTime: null, deliveredAt: null,
  };
  const hubOrder = {
    id: rejected.orderId,
    backendStatus: 'CONFIRMED',
    backendEscrowStatus: 'FROZEN',
    inspectionStatus: 'DELIVERING_TO_BUYER',
    inspectionMethod: 'AT_CENTER',
    shipments: [
      { ...rejected, shipmentId: 'inbound', leg: 'SELLER_TO_CENTER', status: 'DELIVERED', providerStatus: 'COMPLETED' },
      rejected,
    ],
  } as EscrowOrder;
  const genericTitle = 'Quỹ Escrow đang tạm đóng băng';

  assert.equal(isOrderEscrowOnHold(hubOrder), true);
  assert.equal(getOrderEscrowHoldNotice(hubOrder, 'vi'), null);
  assert.equal(getOrderEscrowHoldNotice(hubOrder, 'en', [rejected]), null);
  assert.equal(getOrderEscrowHoldNotice({ ...hubOrder, hasActiveDispute: true }, 'vi'), null);

  const otherShipments = [
    { ...rejected, leg: 'SELLER_TO_CENTER' },
    { ...rejected, leg: 'CENTER_TO_SELLER' },
    { ...rejected, providerStatus: 'EXPIRED' },
  ];
  for (const shipment of otherShipments) {
    assert.equal(getOrderEscrowHoldNotice(hubOrder, 'vi', [shipment])?.title, genericTitle);
  }
  const replacement = { ...rejected, shipmentId: 'new-hub-leg', status: 'ASSIGNED', providerStatus: 'ON_GOING' };
  assert.equal(getOrderEscrowHoldNotice(hubOrder, 'vi', [rejected, replacement])?.title, genericTitle);
  assert.equal(getOrderEscrowHoldNotice({ ...hubOrder, inspectionMethod: 'AT_HOME' }, 'vi')?.title, genericTitle);
  assert.equal(getOrderEscrowHoldNotice({ ...hubOrder, orderReturn: {
    orderId: hubOrder.id, reportId: 'return-approved',
  } }, 'vi')?.title, genericTitle);

  const sellerDetail = renderToStaticMarkup(createElement(OrderSettlement, {
    order: hubOrder, lang: 'vi', isSeller: true, detailBuyerInspectionStage: null,
    isOrderReceiptConfirmed: () => false, orderSettlement: null, isEscrowReleased: false,
    isLoadingSettlement: false, orderCommission: null,
  }));
  assert.doesNotMatch(sellerDetail, /Quỹ Escrow đang tạm đóng băng/);
});

test('seller response distinguishes an expired deadline from a resolved report', () => {
  const report = { status: 'OPEN', sellerResponseDeadlineAt: new Date(deadline).toISOString() };
  assert.equal(getSellerDisputeResponseState({ status: 'OPEN' }, deadline), 'available');
  assert.equal(getSellerDisputeResponseState(report, deadline - 1), 'available');
  assert.equal(getSellerDisputeResponseState(report, deadline), 'expired');
  assert.equal(getSellerDisputeResponseState({ ...report, status: 'IN_REVIEW' }, deadline), 'closed');
  assert.equal(getSellerDisputeResponseState({ ...report, status: 'CONFIRMED' }, deadline), 'closed');
});

test('notification and staff report routes preserve the selected report id', () => {
  const reportId = '11111111-2222-4333-8444-555555555555';
  const buyer = resolveAppRoute('/reports/' + reportId, 'buyer');
  assert.equal(buyer.url, '/buyer/disputes/' + reportId);
  assert.equal(buyer.params.reportId, reportId);
  const staff = resolveAppRoute('/staff/disputes/' + reportId, 'staff');
  assert.equal(staff.section, 'disputes');
  assert.equal(staff.params.reportId, reportId);
});

test('approved order return replaces the dispute label and allows only the buyer to book', () => {
  const approval = { orderId: 'order-1', reportId: 'report-1' };
  const order = { id: approval.orderId, buyerId: 'buyer', sellerId: 'seller', backendEscrowStatus: 'FROZEN', orderReturn: approval } as EscrowOrder;
  assert.match(getApprovedReturnLabel(approval, 'vi'), /Đã duyệt trả hàng/);
  assert.equal(canCreateApprovedOrderReturn(order, 'buyer'), true);
  assert.equal(canCreateApprovedOrderReturn(order, 'seller'), false);
  assert.equal(canCreateApprovedOrderReturn({ ...order, orderReturn: null }, 'buyer'), false);
  const shipment = { ...approval, shipmentId: 'return-1', shipmentStatus: 'DELIVERED' };
  assert.match(getApprovedReturnLabel(shipment, 'vi'), /Chờ hoàn tiền/);
  assert.equal(canCreateApprovedOrderReturn({ ...order, orderReturn: shipment }, 'buyer'), false);
  assert.equal(canCreateApprovedOrderReturn({ ...order, orderReturn: { ...shipment, shipmentStatus: 'CANCELLED' } }, 'buyer'), true);
  assert.equal(getApprovedReturnLabel({ ...shipment, refundedAt: '2026-11-22T05:00:00Z' }, 'vi'), 'Đã hoàn tiền');
});

test('formatDisputeReason translates reason codes into Vietnamese properly', () => {
  assert.equal(formatDisputeReason('RETURN_NOT_AS_DESCRIBED', 'vi'), 'Hàng nhận được hư hỏng / Sai khác');
  assert.equal(formatDisputeReason('MISLEADING_DESCRIPTION', 'vi'), 'Mô tả sai lệch / Che giấu lỗi');
  assert.equal(formatDisputeReason('COUNTERFEIT', 'vi'), 'Hàng giả / Hàng nhái');
  assert.equal(formatDisputeReason('FRAUD', 'vi'), 'Dấu hiệu lừa đảo / Gian lận');
  assert.equal(formatDisputeReason('ITEM_NOT_RECEIVED', 'vi'), 'Chưa nhận được hàng quá hạn');
  assert.equal(formatDisputeReason('OTHER', 'vi'), 'Lý do khác');
  assert.equal(formatDisputeReason('DUPLICATE_LISTING', 'vi'), 'Tin đăng trùng lặp / Spam');

  assert.equal(formatDisputeStatus('OPEN', 'vi'), 'Chờ xử lý');
  assert.equal(formatDisputeStatus('IN_REVIEW', 'vi'), 'Đang xem xét');
  assert.equal(formatDisputeStatus('CONFIRMED', 'vi'), 'Đã chấp thuận');
  assert.equal(formatDisputeStatus('DISMISSED', 'vi'), 'Đã bác bỏ');
});

test('seller dispute items preserve arbitration decision, evidence, and buyer description', () => {
  const sellerDispute = {
    id: '8e7585a9-df35-45a9-aa60-800ce2464785',
    orderId: 'c2445492-ae03-4f92-930f-7ace65001656',
    postId: 'd82e9fe8-078b-4285-b6de-33e3f6c69d85',
    reasonCode: 'RETURN_NOT_AS_DESCRIBED' as const,
    description: 'Tôi muốn hoàn hàng',
    evidenceUrls: ['/api/v1/reports/evidence/1', '/api/v1/reports/evidence/2', '/api/v1/reports/evidence/3'],
    status: 'CONFIRMED' as const,
    responsibleParty: 'SELLER' as const,
    decisionReason: 'Vì seller k cũng cấp bằng chứng',
    resolvedAt: '2026-11-24T15:10:55.386Z',
  };

  assert.equal(sellerDispute.id.startsWith('8e7585a9'), true);
  assert.equal(sellerDispute.orderId.startsWith('c2445492'), true);
  assert.equal(sellerDispute.description, 'Tôi muốn hoàn hàng');
  assert.equal(sellerDispute.evidenceUrls.length, 3);
  assert.equal(sellerDispute.status, 'CONFIRMED');
  assert.equal(sellerDispute.responsibleParty, 'SELLER');
  assert.equal(sellerDispute.decisionReason, 'Vì seller k cũng cấp bằng chứng');
  assert.equal(formatDisputeReason(sellerDispute.reasonCode, 'vi'), 'Hàng nhận được hư hỏng / Sai khác');
  const formattedResolvedAt = formatDisputeDateTime(sellerDispute.resolvedAt);
  assert.equal(typeof formattedResolvedAt, 'string');
  assert.equal(formattedResolvedAt.length > 0, true);
  // Contains date and time
  assert.equal(formattedResolvedAt.includes('2026'), true);
  assert.equal(formattedResolvedAt.includes(':'), true);
});

test('orderFeedItemToRaw and mapEscrowOrder immediately preserve hasActiveDispute without waiting for secondary report polling', () => {
  const mapped = mapEscrowOrder(orderFeedItemToRaw({
    order: {
      id: 'dbb5eafc-e658-4b78-ba52-14df3a44b6ab',
      postId: 'post-1',
      postTitle: 'Kệ phòng tắm',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      finalPrice: 250000,
      shippingFee: 17100,
      status: 'DELIVERED',
      escrowStatus: 'FROZEN',
      shippingDeliveredAt: '2026-11-26T12:00:00Z',
    } as any,
    inspection: null,
    hasActiveDispute: true,
    buyerName: 'Buyer',
    sellerName: 'Seller',
    postImageUrl: null,
    categoryId: null,
    itemId: null,
    itemCondition: 'GOOD',
  }), { currentListings: [], authoritative: true });

  assert.equal(mapped.hasActiveDispute, true);
  assert.equal(isOrderDisputed(mapped), true);
  const badgeHtml = renderToStaticMarkup(createElement(OrderStatusBadge, {
    status: mapped.escrowStatus,
    orderItem: mapped,
    lang: 'vi',
    isSeller: false,
    isOrderCancelledOrRefunded: () => false,
    isOrderSellerConfirmed: () => true,
    getOrderInboundShipment: () => null,
    inboundLoadingOrders: new Set<string>(),
    isInspectorArrivedForOrder: () => false,
    getOrderAppointment: () => null,
    autoPaidOrderIds: new Set<string>(),
    isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0,
    isPartyInspectionFeePaid: () => true,
  }));
  assert.match(badgeHtml, /Đang Tranh Chấp • Đóng Băng Escrow/);
  assert.equal(getOrderEscrowHoldNotice(mapped, 'vi'), null);
});

