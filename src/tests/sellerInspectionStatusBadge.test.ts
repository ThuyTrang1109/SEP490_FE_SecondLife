import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { OrderCardInspection } from '../components/orders/card/OrderCardInspection';
import type { EscrowOrder, ShipmentBackend } from '../types';

test('failed Hub inspection follows the return shipment on the seller order card', () => {
  const order = {
    id: 'failed-hub-inspection', inspectionMethod: 'AT_CENTER', hasInspectionService: true,
    status: 'FAILED', inspectionStatus: 'FAILED', escrowStatus: 'INSPECTION_FAILED',
  } as EscrowOrder;
  const shipment: ShipmentBackend = {
    orderId: order.id, shipmentId: 'return-shipment', leg: 'CENTER_TO_SELLER', orderCode: 'return-waybill',
    status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER', expectedDeliveryTime: null, deliveredAt: null,
  };
  const state = {
    isOrderCancelledOrRefunded: () => false, isOrderReceiptConfirmed: () => false,
    isOrderSellerConfirmed: () => true, isInspectorArrivedForOrder: () => false,
  };
  const renderBadge = (returnShipment: ShipmentBackend | null, isSeller = true) => renderToStaticMarkup(createElement(OrderStatusBadge, {
    status: 'FAILED', orderItem: { ...order, returnShipment }, hasInspection: true, isSeller, lang: 'vi', ...state,
    getOrderInboundShipment: () => null, inboundLoadingOrders: new Set<string>(), getOrderAppointment: () => null,
    autoPaidOrderIds: new Set<string>(), isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0, isPartyInspectionFeePaid: () => true,
  }));
  const renderInspection = (returnShipment: ShipmentBackend | null) => renderToStaticMarkup(createElement(OrderCardInspection, {
    order: { ...order, returnShipment }, orderIsSeller: true, hasInspection: true, lang: 'vi', ordShipment: null, state,
    savedAppointment: null,
    actions: { setSchedulingOrder: () => {}, setSchedulingReadOnly: () => {}, handleSellerAcceptCounterAppointment: async () => {} },
  }));

  for (const pending of [
    null,
    { ...shipment, leg: 'SELLER_TO_CENTER' },
    { ...shipment, status: 'CREATING', orderCode: null },
    { ...shipment, status: 'CANCELLED', providerStatus: 'CANCELED' },
  ]) {
    assert.match(renderBadge(pending), /Kiểm định không đạt • Chờ chuyển hoàn/);
    assert.match(renderInspection(pending), /Chờ hoàn trả/);
  }

  assert.match(renderBadge(shipment), /Kiểm định không đạt • Trung tâm đang hoàn hàng về cho bạn/);
  assert.match(renderInspection(shipment), /Đang hoàn hàng/);
  assert.doesNotMatch(renderInspection(shipment), /Chờ hoàn trả/);
  assert.match(renderBadge(shipment, false), /Kiểm định không đạt • Chờ chuyển hoàn/);

  const delivered = { ...shipment, status: 'DELIVERED', providerStatus: 'COMPLETED' };
  assert.match(renderBadge(delivered), /Kiểm định không đạt • Đã hoàn trả người bán/);
  assert.match(renderInspection(delivered), /Đã hoàn trả/);
});

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

test('OrderStatusBadge renders "Người mua từ chối mua" for seller on AT_HOME order when buyer rejects purchase', () => {
  const atHomeOrder: any = {
    id: 'd0d4e119-362d-41ca-a2a4-4f8d977923e1',
    listingId: 'post-123',
    sellerId: 'seller-trang',
    buyerId: 'buyer-tuan',
    itemPriceVnd: 280000,
    totalPaidVnd: 280000,
    escrowStatus: 'CANCELLED',
    status: 'CANCELLED',
    backendStatus: 'CANCELLED',
    inspectionStatus: 'CANCELLED',
    inspectionMethod: 'AT_HOME',
    orderType: 'AT_HOME',
    hasInspectionService: true,
    inspectionFeeVnd: 50000,
    inspectionNote: '[Từ chối mua tiếp sau kiểm định] Lý do: Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng',
    createdAt: '2026-11-19T10:00:00Z',
  };

  const badgeProps: any = {
    status: 'CANCELLED',
    hasInspection: true,
    isCurrentOrderSeller: true,
    isSeller: true,
    orderItem: atHomeOrder as EscrowOrder,
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
  assert.equal(textChild, 'Người mua từ chối mua');
  assert.ok(!textChild.includes('Chờ trung tâm hoàn hàng'), 'Should not include "Chờ trung tâm hoàn hàng" for AT_HOME orders');
});

test('OrderStatusBadge renders "Đã từ chối mua tiếp" for buyer on AT_HOME order when buyer rejects purchase', () => {
  const atHomeOrder: any = {
    id: 'd0d4e119-362d-41ca-a2a4-4f8d977923e1',
    listingId: 'post-123',
    sellerId: 'seller-trang',
    buyerId: 'buyer-tuan',
    itemPriceVnd: 280000,
    totalPaidVnd: 280000,
    escrowStatus: 'CANCELLED',
    status: 'CANCELLED',
    backendStatus: 'CANCELLED',
    inspectionStatus: 'CANCELLED',
    inspectionMethod: 'AT_HOME',
    orderType: 'AT_HOME',
    hasInspectionService: true,
    inspectionFeeVnd: 50000,
    inspectionNote: '[Từ chối mua tiếp sau kiểm định] Lý do: Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng',
    createdAt: '2026-11-19T10:00:00Z',
  };

  const badgeProps: any = {
    status: 'CANCELLED',
    hasInspection: true,
    isCurrentOrderSeller: false,
    isSeller: false,
    orderItem: atHomeOrder as EscrowOrder,
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
  assert.equal(textChild, 'Đã từ chối mua tiếp');
  assert.ok(!textChild.includes('Chờ trung tâm hoàn hàng'), 'Should not include "Chờ trung tâm hoàn hàng" for AT_HOME orders');
});

test('OrderStatusBadge keeps "Người mua từ chối mua • Chờ trung tâm hoàn hàng" for seller on AT_CENTER order when buyer rejects purchase', () => {
  const atCenterOrder: any = {
    id: 'center-order-rejected-001',
    listingId: 'post-456',
    sellerId: 'seller-trang',
    buyerId: 'buyer-tuan',
    itemPriceVnd: 280000,
    totalPaidVnd: 280000,
    escrowStatus: 'CANCELLED',
    status: 'CANCELLED',
    backendStatus: 'CANCELLED',
    inspectionStatus: 'CANCELLED',
    inspectionMethod: 'AT_CENTER',
    orderType: 'AT_CENTER',
    hasInspectionService: true,
    inspectionFeeVnd: 50000,
    inspectionNote: '[Từ chối mua tiếp sau kiểm định] Lý do: Sản phẩm có vết trầy xước và hao mòn nhiều hơn kỳ vọng',
    createdAt: '2026-11-19T10:00:00Z',
    shipments: [],
  };

  const badgeProps: any = {
    status: 'CANCELLED',
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
  assert.equal(textChild, 'Người mua từ chối mua • Chờ trung tâm hoàn hàng');
});

test('OrderStatusBadge renders "Đang Tranh Chấp • Đóng Băng Escrow" when delivered order is disputed for both seller and buyer', () => {
  const disputedOrder: any = {
    id: '4de60c8a-64cd-4c74-89bf-63b4cafc9500',
    listingId: 'post-999',
    sellerId: 'seller-trang',
    buyerId: 'buyer-tuan',
    status: 'DELIVERED',
    backendStatus: 'DELIVERED',
    escrowStatus: 'DISPUTED',
    shippingDeliveredAt: '2026-11-20T12:00:00.000Z',
  };

  const baseProps: any = {
    status: 'DISPUTED',
    hasInspection: false,
    orderItem: disputedOrder as EscrowOrder,
    lang: 'vi',
    isOrderCancelledOrRefunded: () => false,
    isOrderReceiptConfirmed: () => false,
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

  // 1. Seller view
  const sellerBadge = OrderStatusBadge({ ...baseProps, isSeller: true, isCurrentOrderSeller: true }) as any;
  assert.ok(sellerBadge);
  const sellerText = sellerBadge.props.children[1].props.children;
  assert.equal(sellerText, 'Đang Tranh Chấp • Đóng Băng Escrow');

  // 2. Buyer view
  const buyerBadge = OrderStatusBadge({ ...baseProps, isSeller: false, isCurrentOrderSeller: false }) as any;
  assert.ok(buyerBadge);
  const buyerText = buyerBadge.props.children[1].props.children;
  assert.equal(buyerText, 'Đang Tranh Chấp • Đóng Băng Escrow');
});
