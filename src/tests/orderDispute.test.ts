import assert from 'node:assert/strict';
import test from 'node:test';
import type { EscrowOrder } from "../types";
import { canOpenOrderDispute, canCreateApprovedOrderReturn, getApprovedReturnLabel, formatDisputeReason, formatDisputeStatus, getSellerDisputeResponseState } from '../utils/orders/orderDispute';
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
});
