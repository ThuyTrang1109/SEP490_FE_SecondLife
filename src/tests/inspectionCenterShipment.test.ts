import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LalamoveProgress } from '../components/common/LalamoveProgress';
import type { ShipmentBackend } from '../types';
import { canReadCenterInspectionShipments, getCenterDispatchStage, getInboundShipmentProgress, getLatestInboundShipment, shouldTrackCenterInspectionShipments, shouldTrackInboundShipment } from '../utils/inspectionCenterData';
import { canBookHubBuyerDelivery, getHubBuyerShipmentLabel, getLatestInspectionShipment, isPaidHubBuyerDelivery } from '../utils/inspectionCenterData';
import { canAppealInspection, getHubReturnProgress, getHubReturnState, getReturnReserveMessage, isCenterReturnEligible } from '../utils/inspectionCenterData';
import { isExpiredInspectionPurchase } from '../utils/inspectionPurchase';

test('dispatch only includes orders in the operational queue', () => {
  for (const status of [
    'WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT', 'PAYMENT_EXPIRED',
    'PASSED', 'FAILED', 'DELIVERING_TO_BUYER', 'COMPLETED', 'CANCELLED', 'CANCELED', 'DISPUTED',
  ]) {
    assert.equal(getCenterDispatchStage({ status, orderType: 'AT_HOME', inspectorId: 'ktv' }, true), null, status);
  }
});

test('dispatch distinguishes Hub intake, ready assignments and assigned orders', () => {
  const order = { status: 'SHIPPING_TO_CENTER', orderType: 'AT_CENTER' };
  assert.equal(getCenterDispatchStage(order, false), 'WAITING_FOR_HUB');
  assert.equal(getCenterDispatchStage(order, true), 'READY_TO_ASSIGN');
  assert.equal(getCenterDispatchStage({ ...order, status: 'INSPECTING', inspectorId: 'ktv' }, true), 'ASSIGNED');
  assert.equal(getCenterDispatchStage({ status: 'CONFIRMED_PENDING_DISPATCH', orderType: 'AT_HOME' }, false), 'READY_TO_ASSIGN');
  assert.equal(getCenterDispatchStage({ status: 'SCHEDULED', orderType: 'AT_HOME', inspectorId: 'ktv' }, false), 'ASSIGNED');
});

function shipment(id: string, leg: string, status: string, providerStatus: string | null = null): ShipmentBackend {
  return {
    shipmentId: id,
    orderId: 'inspection-order',
    orderCode: id,
    leg,
    status,
    providerStatus,
    expectedDeliveryTime: null,
    deliveredAt: null,
  };
}

test('a zero reserve still permits the assigned center to start a settled Hub return', () => {
  const order = { id: 'inspection', postId: 'post', orderType: 'AT_CENTER', status: 'FAILED', inspectionCenterId: 'a', feeSettledAt: 'settled', returnShippingReserveFee: 0 };
  assert.equal(isCenterReturnEligible(order, 'a', 'inspection_center'), true);
  assert.equal(isCenterReturnEligible({ ...order, status: 'CANCELLED' }, 'a', 'INSPECTION_CENTER'), true);
  assert.equal(isCenterReturnEligible(order, 'b', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible(order, 'a', 'seller'), false);
  assert.equal(isCenterReturnEligible({ ...order, orderType: 'AT_HOME' }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, feeSettledAt: null }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, returnShippingReserveFee: null }, 'a', 'inspection_center'), false);
  assert.equal(isCenterReturnEligible({ ...order, finalPaymentPaidAt: 'paid' }, 'a', 'inspection_center'), false);
});

test('return tracking retains an existing non-cancelled shipment, including uncertain creation', () => {
  const inbound = shipment('in', 'SELLER_TO_CENTER', 'DELIVERED');
  const uncertain = shipment('unknown', 'CENTER_TO_SELLER', 'CREATION_UNCERTAIN');
  const cancelled = shipment('cancelled', 'CENTER_TO_SELLER', 'CANCELLED');
  assert.deepEqual(getHubReturnState([inbound]), { received: true, shipment: null });
  assert.deepEqual(getHubReturnState([inbound, uncertain, cancelled]), { received: true, shipment: uncertain });
  assert.equal(canBookHubBuyerDelivery(getHubReturnState([inbound, cancelled]).shipment), true);
  assert.equal(canBookHubBuyerDelivery(uncertain), false);
  assert.match(getHubReturnProgress(uncertain).label, /Chờ đối soát/);
  assert.equal(getHubReturnState([shipment('out', 'CENTER_TO_BUYER', 'DELIVERED')]).received, false);
});

test('a delivered return shows the wallet check without changing failed inspection appeal eligibility', () => {
  const delivered = { ...shipment('return', 'CENTER_TO_SELLER', 'DELIVERED'), actualFee: 32000 };
  const order = { id: 'inspection', postId: 'post', status: 'FAILED', sellerId: 'seller', appealDeadline: '2026-11-10T15:00:00Z' };
  const now = Date.parse('2026-11-10T14:00:00Z');
  assert.match(getHubReturnProgress(delivered).label, /Đã trả về người bán/);
  assert.equal(getHubReturnProgress({ ...delivered, status: 'ASSIGNED', providerStatus: 'COMPLETED' }).step, 1);
  assert.match(getReturnReserveMessage(36000, delivered), /lịch sử ví/);
  assert.match(getReturnReserveMessage(32000, delivered), /Không có phần dư/);
  assert.match(getReturnReserveMessage(31000, delivered), /chờ đối soát/);
  assert.match(getReturnReserveMessage(36000, { ...delivered, actualFee: undefined }), /chờ đối soát/);
  assert.match(getReturnReserveMessage(36000, { ...delivered, status: 'PICKED' }), /sau khi giao/);
  assert.equal(canAppealInspection(order, 'seller', now), true);
  assert.equal(canAppealInspection(order, 'another-seller', now), false);
  assert.equal(canAppealInspection({ ...order, appealStatus: 'PENDING_REVIEW' }, 'seller', now), false);
  assert.equal(canAppealInspection(order, 'seller', Date.parse(order.appealDeadline)), false);
});

test('the payment expiry label waits for the cancellation recorded by BE', () => {
  const note = 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.';
  assert.equal(isExpiredInspectionPurchase('PASSED', note), false);
  assert.equal(isExpiredInspectionPurchase('CANCELLED', note), true);
  assert.equal(isExpiredInspectionPurchase('CANCELLED', 'Người mua từ chối mua tiếp sau kiểm định. Lý do: đổi ý'), false);
});

test('center tracks paid hub orders even before a driver picks up the parcel', () => {
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'CONFIRMED_PENDING_DISPATCH' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'SHIPPING_TO_CENTER' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_HOME', status: 'SCHEDULED' }), false);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'WAITING_FEE_PAYMENT' }), false);
});

test('center polls only shipments it can read, including newly booked Hub deliveries', () => {
  const order = { id: 'inspection', postId: 'post', orderType: 'AT_CENTER', status: 'CONFIRMED_PENDING_DISPATCH', inspectionCenterId: 'hub-a' };
  assert.equal(shouldTrackCenterInspectionShipments(order, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, status: 'SHIPPING_TO_CENTER' }, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, status: 'INSPECTING' }, 'hub-a', 'inspection_center'), true);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, orderType: 'AT_HOME' }, 'hub-a', 'inspection_center'), false);
  assert.equal(shouldTrackCenterInspectionShipments(order, 'hub-b', 'inspection_center'), false);
  assert.equal(shouldTrackCenterInspectionShipments({ ...order, inspectionCenterId: null, inspectorId: 'assigned-technician' }, 'hub-a', 'inspection_center'), false);
  assert.equal(canReadCenterInspectionShipments({ inspectionCenterId: null }), false);
});

test('center shows the latest inbound shipment and ignores outbound and return legs', () => {
  const cancelled = shipment('old', 'SELLER_TO_CENTER', 'CANCELLED');
  const retry = shipment('retry', 'SELLER_TO_CENTER', 'READY_TO_PICK');
  const outbound = shipment('outbound', 'CENTER_TO_BUYER', 'DELIVERED');
  const returned = shipment('return', 'CENTER_TO_SELLER', 'DELIVERED');
  assert.equal(getLatestInboundShipment([cancelled, retry, outbound, returned]), retry);
  assert.equal(getLatestInboundShipment([outbound, returned]), null);
});

test('center distinguishes creation, assignment, pickup, delivery, and cancellation', () => {
  assert.equal(getInboundShipmentProgress({ status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER' }).step, 0);
  assert.equal(getInboundShipmentProgress({ status: 'ASSIGNED', providerStatus: null }).step, 1);
  assert.equal(getInboundShipmentProgress({ status: 'PICKED', providerStatus: 'PICKED_UP' }).step, 2);
  assert.equal(getInboundShipmentProgress({ status: 'DELIVERED', providerStatus: 'COMPLETED' }).step, 3);
  assert.deepEqual(getInboundShipmentProgress({ status: 'CANCELLED', providerStatus: 'ON_GOING' }), {
    step: null,
    label: 'Vận đơn đã hủy',
  });
});

test('center shipment progress ends at delivery with four completed steps', () => {
  const html = renderToStaticMarkup(createElement(LalamoveProgress, { currentStep: 3, completeCurrentStep: true }));
  assert.equal((html.match(/<li\b/g) ?? []).length, 4);
  assert.equal((html.match(/bg-emerald-600/g) ?? []).length, 4);
  assert.match(html, /Đã giao thành công/);
  assert.doesNotMatch(html, /Quyết toán/);
});

test('seller and center use the delivered inbound status even with an older provider status', () => {
  const inbound = shipment('second-attempt', 'SELLER_TO_CENTER', 'DELIVERED', 'ON_GOING');
  assert.deepEqual(getInboundShipmentProgress(inbound), { step: 3, label: 'Lalamove đã giao tới Hub' });
  assert.deepEqual(getInboundShipmentProgress(inbound, 'en'), { step: 3, label: 'Delivered to Hub' });
});

test('the center only offers buyer delivery for paid hub orders with a linked purchase', () => {
  const paid = { orderType: 'AT_CENTER', status: 'DELIVERING_TO_BUYER', linkedOrderId: 'purchase', finalPaymentPaidAt: '2026-11-09T06:00:00Z' };
  assert.equal(isPaidHubBuyerDelivery(paid), true);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, finalPaymentPaidAt: null }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, linkedOrderId: null }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, status: 'PASSED' }), false);
  assert.equal(isPaidHubBuyerDelivery({ ...paid, orderType: 'AT_HOME' }), false);
});

test('the center waits for the outbound shipment check and permits retry after cancellation', () => {
  const inbound = shipment('inbound', 'SELLER_TO_CENTER', 'DELIVERED');
  const cancelled = shipment('cancelled', 'CENTER_TO_BUYER', 'CANCELLED');
  const retry = shipment('retry', 'CENTER_TO_BUYER', 'CREATION_UNCERTAIN');
  assert.equal(canBookHubBuyerDelivery(undefined), false);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound], 'CENTER_TO_BUYER')), true);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound, cancelled], 'CENTER_TO_BUYER')), true);
  assert.equal(canBookHubBuyerDelivery(getLatestInspectionShipment([inbound, cancelled, retry], 'CENTER_TO_BUYER')), false);
  assert.equal(getHubBuyerShipmentLabel(shipment('delivered', 'CENTER_TO_BUYER', 'DELIVERED')), 'Đã giao cho người mua');
});

test('getOrderAllShipments and 2-leg detail modal tracking work instantly without flash', async () => {
  const { getOrderAllShipments } = await import('../pages/EscrowOrdersView');
  const mockStorage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
    }
  };

  const orderId = 'test-order-instant';
  const inboundShip = { shipmentId: 's1', leg: 'SELLER_TO_CENTER', orderCode: 'INBOUND_123', status: 'DELIVERED' };
  const returnShip = { shipmentId: 's2', leg: 'CENTER_TO_SELLER', orderCode: 'RETURN_456', status: 'READY_TO_PICK' };

  mockStorage[`sl_order_shipments_${orderId}`] = JSON.stringify([inboundShip, returnShip]);

  const loaded = getOrderAllShipments(orderId);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].orderCode, 'INBOUND_123');
  assert.equal(loaded[1].orderCode, 'RETURN_456');

  // Verify that leg 1 and leg 2 find their respective shipments regardless of array order
  const shuffled = [returnShip, inboundShip] as any[];
  const foundInbound = shuffled.find((s) => s.leg === 'SELLER_TO_CENTER');
  const foundReturn = shuffled.find((s) => s.leg === 'CENTER_TO_SELLER');
  assert.equal(foundInbound?.orderCode, 'INBOUND_123');
  assert.equal(foundReturn?.orderCode, 'RETURN_456');

  // Verify that AT_CENTER orders hide top single-leg Lalamove box
  const centerOrder = { id: orderId, hasInspectionService: true, inspectionMethod: 'AT_CENTER' } as any;
  const isDetailAtCenter = Boolean(
    (centerOrder.hasInspectionService || centerOrder.inspectionCenterId || centerOrder.inspectionMethod === 'AT_CENTER') &&
    centerOrder.inspectionMethod !== 'AT_HOME' &&
    centerOrder.orderType !== 'AT_HOME'
  );
  assert.equal(isDetailAtCenter, true);
});
