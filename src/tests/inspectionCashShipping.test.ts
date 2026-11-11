import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionCashShipmentStatus } from '../components/inspection/InspectionCashShipmentStatus';
import type { ShipmentBackend, UserProfile } from '../types';
import { canConfirmInspectionCash, canReviewInspectionCash, getCashInspectionFeeShares } from '../utils/inspectionCashShipping';

test('Sandbox fee previews mirror the three upfront payment splits', () => {
  assert.deepEqual(getCashInspectionFeeShares(450_000, 340_000, 'BUYER_PAYS'), { buyer: 450_000, seller: 0 });
  assert.deepEqual(getCashInspectionFeeShares(450_000, 340_000, 'SELLER_PAYS'), { buyer: 0, seller: 110_000 });
  assert.deepEqual(getCashInspectionFeeShares(450_000, 340_000, 'SPLIT_50_50'), { buyer: 225_000, seller: 55_000 });
  assert.deepEqual(getCashInspectionFeeShares(10.02, 5.01, 'SPLIT_50_50'), { buyer: 5.02, seller: 2.5 });
});

const delivered: ShipmentBackend = {
  shipmentId: 'internal-id', orderId: 'inspection-id', leg: 'SELLER_TO_CENTER', orderCode: 'carrier-id',
  status: 'DELIVERED', providerStatus: 'COMPLETED', cashPayerId: 'seller-id', actualFee: 340_000,
  expectedDeliveryTime: null, deliveredAt: null,
};

test('only completed cash inspection legs with known cước can be confirmed', () => {
  assert.equal(canConfirmInspectionCash(delivered), true);
  assert.equal(canConfirmInspectionCash({ ...delivered, actualFee: 0 }), true);
  assert.equal(canConfirmInspectionCash({ ...delivered, actualFee: undefined }), false);
  assert.equal(canConfirmInspectionCash({ ...delivered, providerStatus: 'ON_GOING' }), false);
  assert.equal(canConfirmInspectionCash({ ...delivered, orderCode: null }), false);
  assert.equal(canConfirmInspectionCash({ ...delivered, cashPayerId: null }), false);
  assert.equal(canConfirmInspectionCash({ ...delivered, leg: 'CENTER_TO_BUYER' }), false);
  assert.equal(canConfirmInspectionCash({ ...delivered, cashConfirmedAt: '2026-11-11T02:00:00Z' }), false);
});

test('confirmed cash status renders an explicit zero reimbursement', () => {
  const markup = renderToStaticMarkup(createElement(InspectionCashShipmentStatus, {
    shipment: { ...delivered, cashConfirmedAt: '2026-11-11T02:00:00Z', cashPaidAmount: 340_000, cashReimbursedAmount: 0 },
  }));
  assert.match(markup, /Đã quyết toán cước \(Sandbox\)/);
  assert.match(markup, /Hoàn ứng 0/);
});

test('cash review requires the permission for the corresponding role', () => {
  const staff: UserProfile = { id: 'reviewer', name: 'Reviewer', email: 'reviewer@example.test', role: 'staff' };
  assert.equal(canReviewInspectionCash(staff), false);
  assert.equal(canReviewInspectionCash({ ...staff, permissions: ['STAFF_DISPUTE_REVIEW'] }), true);
  assert.equal(canReviewInspectionCash({ ...staff, permissions: ['ADMIN_RBAC_MANAGE'] }), false);
  assert.equal(canReviewInspectionCash({ ...staff, role: 'admin', permissions: ['ADMIN_RBAC_MANAGE'] }), true);
});
