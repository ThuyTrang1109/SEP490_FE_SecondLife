import assert from 'node:assert/strict';
import test from 'node:test';
import { getBuyerInspectionStage, getCustomerInspectionStatus, getInspectionPurchaseDecision } from '../utils/inspectionPurchase';

test('the buyer only sees inspection status while the item is on its way to the hub or being inspected', () => {
  const order = { inspectionStatus: 'SHIPPING_TO_CENTER', shippingDeliveredAt: '2026-11-09T08:00:00Z' };
  assert.equal(getBuyerInspectionStage(order), 'waiting');
  assert.equal(getBuyerInspectionStage({ ...order, inspectionStatus: 'INSPECTING' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ ...order, inspectionStatus: 'INSPECTING', backendStatus: 'COMPLETED' }), 'inspecting');
});

test('passing inspection opens the purchase decision and does not count as receipt', () => {
  const order = { inspectionStatus: 'PASSED' };
  assert.equal(getInspectionPurchaseDecision(order), 'pending');
  assert.equal(getBuyerInspectionStage(order), 'decision');
});

test('an assigned inspection is in progress for customers while retaining the dispatch status for operations', () => {
  assert.equal(getCustomerInspectionStatus('DISPATCHED', 'INSPECTING', 'ktv-1'), 'INSPECTING');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'DISPATCHED', inspectorId: 'ktv-1' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SCHEDULED', inspectorId: 'ktv-1' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SCHEDULED' }), 'waiting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SHIPPING_TO_CENTER', inspectorId: 'ktv-1' }), 'waiting');
  assert.equal(getCustomerInspectionStatus('PASSED', undefined, 'ktv-1'), 'PASSED');
});

test('a purchase accepted by the buyer uses final payment data, not inbound delivery', () => {
  const order = { inspectionStatus: 'DELIVERING_TO_BUYER' };
  assert.notEqual(getBuyerInspectionStage(order), null);
  const purchased = { ...order, finalPaymentPaidAt: '2026-11-09T09:00:00Z', linkedOrderId: 'final-order' };
  assert.equal(getInspectionPurchaseDecision(purchased), 'accepted');
  assert.equal(getBuyerInspectionStage(purchased), null);
});

test('the inspection response distinguishes a buyer rejection from other cancellations', () => {
  const cached = { inspectionStatus: 'PASSED' };
  const cancelled = { status: 'CANCELLED', note: 'Đã hết hạn thanh toán.' };
  assert.equal(getInspectionPurchaseDecision(cached, cancelled), null);
  const rejected = { ...cancelled, note: 'Biên bản đạt | Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý' };
  assert.equal(getInspectionPurchaseDecision(cached, rejected), 'rejected');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'CANCELLED', inspectionNote: rejected.note }), 'rejected');
});

test('a direct purchase keeps the regular delivery flow', () => {
  assert.equal(getBuyerInspectionStage({ backendStatus: 'DELIVERED', hasInspectionService: false }), null);
});
