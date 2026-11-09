import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LalamoveProgress } from '../components/common/LalamoveProgress';
import type { ShipmentBackend } from '../types';
import { getInboundShipmentProgress, getLatestInboundShipment, shouldTrackInboundShipment } from '../utils/inspectionCenterData';
import { canBookHubBuyerDelivery, getHubBuyerShipmentLabel, getLatestInspectionShipment, isPaidHubBuyerDelivery } from '../utils/inspectionCenterData';

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

test('center tracks paid hub orders even before a driver picks up the parcel', () => {
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'CONFIRMED_PENDING_DISPATCH' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'SHIPPING_TO_CENTER' }), true);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_HOME', status: 'SCHEDULED' }), false);
  assert.equal(shouldTrackInboundShipment({ orderType: 'AT_CENTER', status: 'WAITING_FEE_PAYMENT' }), false);
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
