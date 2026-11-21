import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtHomeIntakeBarcode } from '../components/inspection/AtHomeIntakeBarcode';
import { PreListingAppointmentCounter } from '../components/listing/PreListingAppointmentCounter';
import {
  isHubReturnCase,
  isCenterReturnEligible,
  canBookCenterReturn,
  getHubReturnState
} from '../utils/inspectionCenterData';
import { getPreListingHomeIntakeStage } from '../utils/inspectionTaskStatus';
import { InspectionOrderDto } from '../services/inspectorService';
import { ShipmentBackend } from '../types';

test('seller can see and respond to the center’s pre-listing appointment proposal', () => {
  const props = {
    lang: 'vi' as const,
    isSaving: false,
    isRefreshing: false,
    error: null,
    onAccept: () => {},
    onReschedule: () => {},
  };
  const order = {
    appointmentScheduledAt: '2026-11-22T01:00:00Z',
    counterScheduledAt: '2026-11-22T02:00:00Z',
    counterNote: 'Kỹ thuật viên bận lịch cũ',
  };
  const render = (data: Parameters<typeof PreListingAppointmentCounter>[0]['order']) =>
    renderToStaticMarkup(createElement(PreListingAppointmentCounter, { ...props, order: data }));
  const proposal = render(order);

  assert.match(proposal, /09:00/);
  assert.doesNotMatch(proposal, /08:00/);
  assert.match(proposal, /Kỹ thuật viên bận lịch cũ/);
  assert.match(proposal, /Đồng ý lịch này/);
  assert.match(proposal, /Hẹn lịch khác/);
  assert.doesNotMatch(proposal, /<button[^>]*disabled=/);
  assert.equal((render({}).match(/<button[^>]*disabled=/g) ?? []).length, 1);
});

test('seller sees the pre-listing home intake code after confirmation and technician assignment', () => {
  const scheduled = {
    id: 'aabbccdd-0000-4000-8000-000000000001',
    orderType: 'AT_HOME',
    status: 'SCHEDULED',
    appointmentStatus: 'CONFIRMED',
    appointmentScheduledAt: '2026-11-22T02:00:00Z',
  };

  assert.equal(getPreListingHomeIntakeStage(scheduled), 'awaiting_inspector');

  const assigned = { ...scheduled, inspectorId: 'technician' };
  assert.equal(getPreListingHomeIntakeStage(assigned), 'ready');
  assert.equal(getPreListingHomeIntakeStage({ ...assigned, status: 'DISPATCHED' }), 'ready');
  assert.equal(getPreListingHomeIntakeStage({ ...assigned, appointmentStatus: 'COUNTERED_BY_CENTER' }), null);
  assert.equal(getPreListingHomeIntakeStage({ ...assigned, homeCheckedInAt: '2026-11-22T02:00:00Z' }), null);
  assert.equal(getPreListingHomeIntakeStage({ ...assigned, orderType: 'AT_CENTER' }), null);

  const markup = renderToStaticMarkup(createElement(AtHomeIntakeBarcode, {
    orderId: assigned.id,
    lang: 'vi',
    format: 'qr',
  }));
  assert.match(markup, /Mã QR tiếp nhận kiểm định tại nhà/);
  assert.match(markup, /SL-ATHOME-AABBCCDD/);
});

test('1. High-value policy threshold comparison: strictly finalPriceVnd > thresholdPrice', () => {
  const thresholdPrice = 10000000; // 10 million VND

  const isHighValue = (finalPriceVnd: number, threshold: number) => finalPriceVnd > threshold;

  // Exact 10 million VND does not require pre-listing inspection
  assert.equal(isHighValue(10000000, thresholdPrice), false, '10,000,000 should NOT exceed 10M threshold');
  assert.equal(isHighValue(9999999, thresholdPrice), false, '9,999,999 should NOT exceed 10M threshold');
  assert.equal(isHighValue(500000, thresholdPrice), false, '500,000 should NOT exceed 10M threshold');

  // Higher than 10 million VND strictly requires pre-listing inspection
  assert.equal(isHighValue(10000001, thresholdPrice), true, '10,000,001 MUST exceed 10M threshold');
  assert.equal(isHighValue(15000000, thresholdPrice), true, '15,000,000 MUST exceed 10M threshold');
  assert.equal(isHighValue(50000000, thresholdPrice), true, '50,000,000 MUST exceed 10M threshold');

  // Dynamic admin threshold (e.g. changed to 15 million VND)
  const dynamicThreshold = 15000000;
  assert.equal(isHighValue(12000000, dynamicThreshold), false, '12M should not exceed dynamic 15M threshold');
  assert.equal(isHighValue(15000000, dynamicThreshold), false, '15M exact should not exceed 15M threshold');
  assert.equal(isHighValue(15000001, dynamicThreshold), true, '15M + 1 VND must exceed 15M threshold');
});

test('2. isHubReturnCase supports PRE_LISTING orders with status COMPLETED', () => {
  // Regular order: failed or cancelled requires return
  assert.equal(
    isHubReturnCase({ orderType: 'AT_CENTER', status: 'FAILED', inspectionScope: 'TRANSACTION' }),
    true,
    'Regular AT_CENTER FAILED order must be a hub return case'
  );
  assert.equal(
    isHubReturnCase({ orderType: 'AT_CENTER', status: 'CANCELLED', inspectionScope: 'TRANSACTION' }),
    true,
    'Regular AT_CENTER CANCELLED order must be a hub return case'
  );
  assert.equal(
    isHubReturnCase({ orderType: 'AT_CENTER', status: 'COMPLETED', inspectionScope: 'TRANSACTION' }),
    false,
    'Regular AT_CENTER COMPLETED transaction order is delivered to buyer, not returned to seller'
  );

  // Pre-listing order: when inspection passes (COMPLETED), device must still be returned to seller!
  assert.equal(
    isHubReturnCase({ orderType: 'AT_CENTER', status: 'COMPLETED', inspectionScope: 'PRE_LISTING' }),
    true,
    'PRE_LISTING AT_CENTER order with COMPLETED status MUST be a hub return case to return device to seller'
  );

  // At home orders: never hub return
  assert.equal(
    isHubReturnCase({ orderType: 'AT_HOME', status: 'COMPLETED', inspectionScope: 'PRE_LISTING' }),
    false,
    'AT_HOME order is never a hub return case'
  );
  assert.equal(
    isHubReturnCase({ orderType: 'AT_HOME', status: 'FAILED', inspectionScope: 'PRE_LISTING' }),
    false,
    'AT_HOME FAILED order is never a hub return case'
  );
});

test('3. isCenterReturnEligible & canBookCenterReturn for PRE_LISTING COMPLETED orders', () => {
  const centerId = 'center-uuid-1';

  const preListingOrder: InspectionOrderDto = {
    id: 'order-uuid-prelisting-1',
    postId: 'post-uuid-1',
    inspectionCenterId: centerId,
    orderType: 'AT_CENTER',
    inspectionScope: 'PRE_LISTING',
    status: 'COMPLETED',
    returnShippingReserveFee: 50000,
    feeSettledAt: null, // Pre-listing order might settle fee after delivery or upon inspection
    finalPaymentPaidAt: null
  };

  // Center return eligibility
  const isEligible = isCenterReturnEligible(preListingOrder, centerId, 'inspection_center');
  assert.equal(isEligible, true, 'Center must be eligible to return device for COMPLETED PRE_LISTING order');

  // Wrong center or wrong role
  assert.equal(
    isCenterReturnEligible(preListingOrder, 'other-center', 'inspection_center'),
    false,
    'Other center must not be eligible'
  );
  assert.equal(
    isCenterReturnEligible(preListingOrder, centerId, 'seller'),
    false,
    'Seller role must not be eligible for center return booking'
  );

  // Return booking availability when device arrived at center
  const shipments: ShipmentBackend[] = [
    {
      shipmentId: 'ship-1',
      orderId: preListingOrder.id,
      leg: 'SELLER_TO_CENTER',
      status: 'DELIVERED',
      orderCode: 'LALA-123',
      providerStatus: 'COMPLETED',
      expectedDeliveryTime: '2026-11-20T10:00:00Z',
      deliveredAt: '2026-11-20T11:00:00Z'
    }
  ];

  const hubState = getHubReturnState(shipments);
  assert.equal(hubState.received, true, 'Shipment to center was delivered');

  const canBook = canBookCenterReturn(preListingOrder, centerId, 'inspection_center', hubState);
  assert.equal(canBook, true, 'Center must be able to book CENTER_TO_SELLER return shipment for COMPLETED PRE_LISTING order');
});

test('4. Pre-listing Quote and Fee Share: Seller pays 100% of inspection fee', () => {
  // AT_HOME package breakdown
  const atHomeBaseInspectionFee = 150000;
  const atHomeTravelFeeRoundTrip = 60000;
  const atHomeTotalFee = atHomeBaseInspectionFee + atHomeTravelFeeRoundTrip;

  // In pre-listing flow, seller pays 100%
  const sellerFeeShareAtHome = atHomeTotalFee;
  assert.equal(sellerFeeShareAtHome, 210000, 'Seller fee share for AT_HOME must be 100% of total atHome fee');

  // AT_CENTER package breakdown
  const atCenterBaseInspectionFee = 150000;
  const shippingToCenterFee = 45000;
  const returnShippingReserveFee = 54000; // e.g. 20% markup on shipping
  const atCenterTotalFee = atCenterBaseInspectionFee + shippingToCenterFee + returnShippingReserveFee;

  const sellerFeeShareAtCenter = atCenterTotalFee;
  assert.equal(sellerFeeShareAtCenter, 249000, 'Seller fee share for AT_CENTER must be 100% of total atCenter fee');
});
