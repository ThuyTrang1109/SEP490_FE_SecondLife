import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import type { EscrowOrder } from '../types';

test('OrderStatusBadge renders "Người mua đã mua tiếp" for seller on AT_CENTER order when purchase is accepted', () => {
  const atCenterOrder: any = {
    id: 'af9c494a-7839-4f3b-bec6-aa1abb97ae91',
    listingId: 'post-123',
    sellerId: 'seller-me',
    buyerId: 'buyer-001',
    itemPriceVnd: 1000000,
    totalPaidVnd: 1000000,
    escrowStatus: 'SHIPPED_TO_BUYER',
    status: 'DELIVERING_TO_BUYER',
    backendStatus: 'DELIVERING_TO_BUYER',
    inspectionStatus: 'DELIVERING_TO_BUYER',
    inspectionMethod: 'AT_CENTER',
    hasInspectionService: true,
    inspectionFeeVnd: 200000,
    createdAt: '2026-11-18T10:00:00Z',
    shippingLegs: [
      { leg: 'SELLER_TO_HUB', status: 'DELIVERED' } as any,
    ],
  };

  const badgeProps: any = {
    status: 'DELIVERING_TO_BUYER',
    hasInspection: true,
    isCurrentOrderSeller: true,
    isSeller: true,
    orderItem: atCenterOrder as EscrowOrder,
    lang: 'vi',
    isOrderCancelledOrRefunded: () => false,
    isOrderSellerConfirmed: () => true,
    getOrderInboundShipment: () => null,
    inboundLoadingOrders: new Set(),
    isInspectorArrivedForOrder: () => false,
    getOrderAppointment: () => null,
    autoPaidOrderIds: new Set(),
    isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0,
    isPartyInspectionFeePaid: () => true,
  };

  const rendered = OrderStatusBadge(badgeProps) as any;
  assert.ok(rendered, 'Badge should render element');
  const textChild = rendered.props.children[1].props.children;
  assert.equal(textChild, 'Người mua đã mua tiếp');
});

test('OrderStatusBadge renders "Người mua đã mua tiếp" for buyer on AT_CENTER order when purchase is accepted', () => {
  const atCenterOrder: any = {
    id: 'af9c494a-7839-4f3b-bec6-aa1abb97ae91',
    listingId: 'post-123',
    sellerId: 'seller-trang',
    buyerId: 'buyer-me',
    itemPriceVnd: 1000000,
    totalPaidVnd: 1000000,
    escrowStatus: 'SHIPPED_TO_BUYER',
    status: 'DELIVERING_TO_BUYER',
    backendStatus: 'DELIVERING_TO_BUYER',
    inspectionStatus: 'DELIVERING_TO_BUYER',
    inspectionMethod: 'AT_CENTER',
    hasInspectionService: true,
    inspectionFeeVnd: 200000,
    createdAt: '2026-11-18T10:00:00Z',
    shippingLegs: [
      { leg: 'SELLER_TO_HUB', status: 'DELIVERED' } as any,
    ],
  };

  const badgeProps: any = {
    status: 'DELIVERING_TO_BUYER',
    hasInspection: true,
    isCurrentOrderSeller: false,
    isSeller: false,
    orderItem: atCenterOrder as EscrowOrder,
    lang: 'vi',
    isOrderCancelledOrRefunded: () => false,
    isOrderSellerConfirmed: () => true,
    getOrderInboundShipment: () => null,
    inboundLoadingOrders: new Set(),
    isInspectorArrivedForOrder: () => false,
    getOrderAppointment: () => null,
    autoPaidOrderIds: new Set(),
    isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0,
    isPartyInspectionFeePaid: () => true,
  };

  const rendered = OrderStatusBadge(badgeProps) as any;
  assert.ok(rendered, 'Badge should render element');
  const textChild = rendered.props.children[1].props.children;
  assert.equal(textChild, 'Người mua đã mua tiếp');
});

test('OrderStatusBadge renders "Người mua đã mua tiếp" when order has finalPaymentPaidAt (seller perspective)', () => {
  const atCenterOrder: any = {
    id: 'af9c494a-7839-4f3b-bec6-aa1abb97ae91',
    listingId: 'post-123',
    sellerId: 'seller-me',
    buyerId: 'buyer-001',
    itemPriceVnd: 1000000,
    totalPaidVnd: 1000000,
    escrowStatus: 'AWAITING_INSPECTION',
    status: 'PASSED',
    finalPaymentPaidAt: '2026-11-18T11:00:00Z',
    inspectionMethod: 'AT_CENTER',
    hasInspectionService: true,
    createdAt: '2026-11-18T10:00:00Z',
  };

  const badgeProps: any = {
    status: 'PASSED',
    hasInspection: true,
    isCurrentOrderSeller: true,
    isSeller: true,
    orderItem: atCenterOrder as EscrowOrder,
    lang: 'vi',
    isOrderCancelledOrRefunded: () => false,
    isOrderSellerConfirmed: () => true,
    getOrderInboundShipment: () => null,
    inboundLoadingOrders: new Set(),
    isInspectorArrivedForOrder: () => false,
    getOrderAppointment: () => null,
    autoPaidOrderIds: new Set(),
    isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0,
    isPartyInspectionFeePaid: () => true,
  };

  const rendered = OrderStatusBadge(badgeProps) as any;
  assert.ok(rendered);
  const textChild = rendered.props.children[1].props.children;
  assert.equal(textChild, 'Người mua đã mua tiếp');
});
