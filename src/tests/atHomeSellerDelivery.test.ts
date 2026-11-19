import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { OrderCardInspection } from '../components/orders/card/OrderCardInspection';
import type { EscrowOrder, ShipmentBackend } from '../types';

test('the seller card follows the Lalamove shipment after an at-home inspection purchase', (t) => {
  const storage = new Map<string, string>([
    ['order_packed_purchase-id', 'true'],
    ['order_shipment_created_purchase-id', 'true'],
    ['sl_order_shipments_purchase-id', '[]'],
  ]);
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null };
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else Reflect.deleteProperty(globalThis, 'window');
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const order = {
    id: 'purchase-id',
    inspectionOrderId: 'inspection-id',
    inspectionMethod: 'AT_HOME',
    hasInspectionService: true,
    inspectionStatus: 'DELIVERING_TO_BUYER',
    status: 'DELIVERING_TO_BUYER',
    escrowStatus: 'SHIPPED_TO_BUYER',
    finalPaymentPaidAt: '2026-11-18T09:00:00Z',
    sellerReadyAt: '2026-11-18T09:00:00Z',
    orderCode: 'purchase-reference',
  } as unknown as EscrowOrder;
  const state = {
    isOrderCancelledOrRefunded: () => false,
    isOrderReceiptConfirmed: () => false,
    isOrderSellerConfirmed: () => true,
    isInspectorArrivedForOrder: () => false,
  };
  const renderBadge = () => renderToStaticMarkup(createElement(OrderStatusBadge, {
    status: order.status ?? '', orderItem: order, hasInspection: true, isSeller: true, lang: 'vi', ...state,
    getOrderInboundShipment: () => null, inboundLoadingOrders: new Set<string>(), getOrderAppointment: () => null,
    autoPaidOrderIds: new Set<string>(), isPartyInspectionFeePending: () => false,
    getPartyInspectionFee: () => 0, isPartyInspectionFeePaid: () => true,
  }));
  const renderInspection = () => renderToStaticMarkup(createElement(OrderCardInspection, {
    order, orderIsSeller: true, hasInspection: true, lang: 'vi', ordShipment: null, state,
    savedAppointment: { scheduledAt: '2026-11-18T08:00:00Z', status: 'CONFIRMED', note: '', shift: 'MORNING' },
    actions: { setSchedulingOrder: () => {}, setSchedulingReadOnly: () => {}, handleSellerAcceptCounterAppointment: async () => {} },
  }));

  assert.match(renderBadge(), /Người mua đã mua tiếp • Chờ gửi hàng/);
  assert.match(renderInspection(), /Vui lòng đóng gói/);
  assert.doesNotMatch(renderInspection(), /Đã tạo vận đơn thành công/);

  const shipment: ShipmentBackend = {
    shipmentId: 'direct-shipment', orderId: order.id, leg: 'SELLER_TO_BUYER', orderCode: 'carrier-reference',
    status: 'READY_TO_PICK', providerStatus: 'ASSIGNING_DRIVER', expectedDeliveryTime: null, deliveredAt: null,
  };
  const saveShipments = (...shipments: ShipmentBackend[]) => storage.set('sl_order_shipments_inspection-id', JSON.stringify(shipments));
  saveShipments({ ...shipment, leg: 'SELLER_TO_CENTER' }, { ...shipment, status: 'CANCELLED' });
  assert.match(renderBadge(), /Chờ gửi hàng/);
  assert.doesNotMatch(renderInspection(), /Đã tạo vận đơn thành công/);

  saveShipments(shipment);
  assert.match(renderBadge(), /Đã tạo vận đơn • Chờ tài xế lấy hàng/);
  assert.match(renderInspection(), /Đã tạo vận đơn thành công/);

  saveShipments({ ...shipment, status: 'DELIVERING', providerStatus: 'PICKED_UP' });
  assert.match(renderBadge(), /Đang giao hàng • Lalamove/);
  assert.match(renderInspection(), /Tài xế Lalamove đã lấy hàng/);
});
