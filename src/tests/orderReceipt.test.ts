import test from 'node:test';
import assert from 'node:assert/strict';
import { isOrderDeliveredToBuyer, isOrderInTransitToBuyer, isOrderWithInspection } from '../utils/orders/orderReceipt';
import type { EscrowOrder, ShipmentBackend } from '../types';

test('isOrderWithInspection identifies inspection orders properly', () => {
  assert.equal(isOrderWithInspection({ hasInspectionService: true } as EscrowOrder), true);
  assert.equal(isOrderWithInspection({ inspectionFeeVnd: 500000 } as EscrowOrder), true);
  assert.equal(isOrderWithInspection({ inspectionCenterId: 'hub-1' } as EscrowOrder), true);
  assert.equal(isOrderWithInspection({ inspectionMethod: 'AT_CENTER' } as EscrowOrder), true);
  assert.equal(isOrderWithInspection({ hasInspectionService: false, inspectionFeeVnd: 0 } as EscrowOrder), false);
});

test('Hub inspection order: when center has NOT created Leg 2 shipment, buyer cannot confirm receipt and order is not in transit', () => {
  const hubOrder: EscrowOrder = {
    id: 'order-hub-1',
    hasInspectionService: true,
    inspectionMethod: 'AT_CENTER',
    inspectionCenterId: 'hub-1',
    inspectionFeeVnd: 250000,
    escrowStatus: 'AWAITING_INSPECTION',
    backendStatus: 'PASSED' as any,
    inspectionStatus: 'PASSED',
    finalPaymentPaidAt: '2026-11-16T08:00:00Z',
    linkedOrderId: 'purchase-order-1',
  } as any;

  // No Leg 2 shipment exists
  const inboundOnly: ShipmentBackend = {
    shipmentId: 'ship-leg1',
    orderId: 'order-hub-1',
    leg: 'SELLER_TO_CENTER',
    status: 'DELIVERED',
  } as any;

  assert.equal(isOrderDeliveredToBuyer(hubOrder, [inboundOnly]), false);
  assert.equal(isOrderInTransitToBuyer(hubOrder, [inboundOnly]), false);
});

test('Hub inspection order: when center creates Leg 2 shipment, order is in transit to buyer but not yet delivered', () => {
  const hubOrder: EscrowOrder = {
    id: 'order-hub-1',
    hasInspectionService: true,
    inspectionMethod: 'AT_CENTER',
    inspectionCenterId: 'hub-1',
    inspectionFeeVnd: 250000,
    escrowStatus: 'SHIPPED_TO_BUYER',
    backendStatus: 'DELIVERING_TO_BUYER' as any,
    inspectionStatus: 'DELIVERING_TO_BUYER',
    finalPaymentPaidAt: '2026-11-16T08:00:00Z',
    linkedOrderId: 'purchase-order-1',
  } as any;

  const leg2Shipment: ShipmentBackend = {
    shipmentId: 'ship-leg2',
    orderId: 'order-hub-1',
    leg: 'CENTER_TO_BUYER',
    status: 'IN_TRANSIT',
  } as any;

  assert.equal(isOrderDeliveredToBuyer(hubOrder, [leg2Shipment]), false);
  assert.equal(isOrderInTransitToBuyer(hubOrder, [leg2Shipment]), true);
});

test('Hub inspection order: when Leg 2 shipment is DELIVERED, buyer can confirm receipt', () => {
  const hubOrder: EscrowOrder = {
    id: 'order-hub-1',
    hasInspectionService: true,
    inspectionMethod: 'AT_CENTER',
    inspectionCenterId: 'hub-1',
    inspectionFeeVnd: 250000,
    escrowStatus: 'SHIPPED_TO_BUYER',
    backendStatus: 'DELIVERING_TO_BUYER' as any,
    inspectionStatus: 'DELIVERING_TO_BUYER',
    finalPaymentPaidAt: '2026-11-16T08:00:00Z',
    linkedOrderId: 'purchase-order-1',
  } as any;

  const deliveredLeg2: ShipmentBackend = {
    shipmentId: 'ship-leg2',
    orderId: 'order-hub-1',
    leg: 'CENTER_TO_BUYER',
    status: 'DELIVERED',
  } as any;

  assert.equal(isOrderDeliveredToBuyer(hubOrder, [deliveredLeg2]), true);
  assert.equal(isOrderInTransitToBuyer(hubOrder, [deliveredLeg2]), false);
});

test('Direct non-inspection order: in transit when SHIPPED_TO_BUYER, delivered when DELIVERED', () => {
  const directOrder: EscrowOrder = {
    id: 'order-direct-1',
    hasInspectionService: false,
    escrowStatus: 'SHIPPED_TO_BUYER',
    backendStatus: 'SHIPPED' as any,
  } as any;

  assert.equal(isOrderDeliveredToBuyer(directOrder), false);
  assert.equal(isOrderInTransitToBuyer(directOrder), true);

  const deliveredDirect: EscrowOrder = {
    ...directOrder,
    escrowStatus: 'DELIVERED_INSPECTION_WINDOW',
    backendStatus: 'DELIVERED' as any,
    shippingDeliveredAt: '2026-11-16T10:00:00Z',
  };

  assert.equal(isOrderDeliveredToBuyer(deliveredDirect), true);
  assert.equal(isOrderInTransitToBuyer(deliveredDirect), false);
});
