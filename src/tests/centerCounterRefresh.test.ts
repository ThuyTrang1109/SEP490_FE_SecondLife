import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CenterOrderStatusBadge } from '../pages/inspection-center/orders/CenterOrderStatusBadge';
import type { InspectionOrderDto } from '../services/inspectorService';
import { getCenterDispatchStage } from '../utils/inspectionCenterData';

test('the center queue follows the saved proposal through a stale browser cache and a later seller response', (t) => {
  const sellerTime = '2026-11-20T02:00:00Z';
  const proposedTime = '2026-11-20T01:00:00Z';
  const originalOrder: InspectionOrderDto = {
    id: 'inspection', postId: 'post', orderType: 'AT_HOME', status: 'CONFIRMED_PENDING_DISPATCH',
    appointmentStatus: 'PENDING_CENTER_CONFIRMATION', appointmentScheduledAt: sellerTime,
  };
  const countered: InspectionOrderDto = {
    ...originalOrder, appointmentStatus: 'COUNTERED_BY_CENTER', counterScheduledAt: proposedTime,
  };
  const cache = new Map([
    ['order_appointment_inspection', JSON.stringify({ status: originalOrder.appointmentStatus, scheduledAt: sellerTime })],
    ['center_inspection_orders', JSON.stringify([originalOrder])],
    ['my_seller_inspection_orders', JSON.stringify([originalOrder])],
  ]);
  const localStorage = {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => cache.set(key, value),
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const renderBadge = (order: InspectionOrderDto) => {
    const props: ComponentProps<typeof CenterOrderStatusBadge> = {
      order, currentUser: null, buyerShipments: new Map(), inboundShipments: new Map(),
      deniedShipmentOrders: new Set(), showOrderShipments: false, isOrderReceivedAtHub: () => false,
    };
    return renderToStaticMarkup(createElement(CenterOrderStatusBadge, props));
  };

  assert.equal(getCenterDispatchStage(countered, false), 'WAITING_SELLER_APPROVAL');
  assert.match(renderBadge(countered), /Đã đề xuất lại • Chờ Seller/);
  assert.doesNotMatch(renderBadge(countered), /Chờ duyệt lịch hẹn/);

  cache.set('order_appointment_inspection', JSON.stringify({
    status: countered.appointmentStatus, scheduledAt: sellerTime, counterScheduledAt: proposedTime,
  }));
  const rescheduled = { ...originalOrder, appointmentScheduledAt: '2026-11-21T02:30:00Z' };
  assert.match(renderBadge(rescheduled), /Chờ duyệt lịch hẹn/);
  assert.equal(getCenterDispatchStage(rescheduled, false), 'WAITING_CENTER_APPROVAL');
});
