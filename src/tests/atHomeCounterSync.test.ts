import assert from 'node:assert/strict';
import test from 'node:test';
import { orderFeedItemToRaw } from '../services/orderFeedService';
import { readOrderAppointment } from '../utils/orders/orderAppointments';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import type { EscrowOrder } from '../types';

test('At-home appointment countered by center is correctly preserved, synced and rendered on seller side', async (t) => {
  await t.test('orderFeedItemToRaw preserves counter fields from inspection when order entity has stale fields', () => {
    const rawFeedItem: any = {
      order: {
        id: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
        status: 'CONFIRMED_PENDING_DISPATCH',
        appointmentStatus: 'PENDING_CENTER_CONFIRMATION', // stale on order table
        appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
        counterScheduledAt: null, // order table lacks counter fields
        counterShift: null,
        counterNote: null,
      },
      inspection: {
        id: 'insp-99cac9fc',
        linkedOrderId: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
        status: 'CONFIRMED_PENDING_DISPATCH',
        orderType: 'AT_HOME',
        appointmentStatus: 'COUNTERED_BY_CENTER',
        appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
        counterScheduledAt: '2026-11-19T13:30:00.000Z',
        counterShift: 'AFTERNOON',
        counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
      },
      buyerName: 'Nguyen Hieu Tuan',
      sellerName: 'Gian hàng thị thùy trang nguyễn',
    };

    const raw = orderFeedItemToRaw(rawFeedItem);
    assert.equal(raw.id, '99cac9fc-13f3-4316-bae1-6aa97f32be4e');
    assert.equal(raw.appointmentStatus, 'COUNTERED_BY_CENTER');
    assert.equal(raw.counterScheduledAt, '2026-11-19T13:30:00.000Z');
    assert.equal(raw.counterShift, 'AFTERNOON');
    assert.equal(raw.counterNote, 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
  });

  await t.test('readOrderAppointment resolves COUNTERED_BY_CENTER correctly from order with counterScheduledAt', () => {
    const orderItem: any = {
      id: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      status: 'CONFIRMED_PENDING_DISPATCH',
      appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-19T13:30:00.000Z',
      counterShift: 'AFTERNOON',
      counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
    };

    const appt = readOrderAppointment(orderItem as EscrowOrder, null);
    assert.ok(appt);
    assert.equal(appt.status, 'COUNTERED_BY_CENTER');
    assert.equal(appt.counterScheduledAt, '2026-11-19T13:30:00.000Z');
    assert.equal(appt.counterShift, 'AFTERNOON');
    assert.equal(appt.counterNote, 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
  });

  await t.test('OrderStatusBadge renders "Hub đề xuất lịch mới • Cần phản hồi" for seller when countered', () => {
    const orderItem: any = {
      id: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
      status: 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: 'CONFIRMED_PENDING_DISPATCH',
      inspectionStatus: 'CONFIRMED_PENDING_DISPATCH',
      appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
      appointmentStatus: 'COUNTERED_BY_CENTER',
      counterScheduledAt: '2026-11-19T13:30:00.000Z',
      counterShift: 'AFTERNOON',
      counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
    };

    const badgeProps: any = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      hasInspection: true,
      isCurrentOrderSeller: true,
      isSeller: true,
      orderItem: orderItem as EscrowOrder,
      lang: 'vi',
      isOrderCancelledOrRefunded: () => false,
      isOrderSellerConfirmed: () => true,
      getOrderInboundShipment: () => null,
      inboundLoadingOrders: new Set(),
      isInspectorArrivedForOrder: () => false,
      getOrderAppointment: () => ({
        status: 'COUNTERED_BY_CENTER',
        scheduledAt: '2026-11-19T08:30:00.000Z',
        counterScheduledAt: '2026-11-19T13:30:00.000Z',
        counterShift: 'AFTERNOON',
        counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
      }),
      autoPaidOrderIds: new Set(),
      isPartyInspectionFeePending: () => false,
      getPartyInspectionFee: () => 0,
      isPartyInspectionFeePaid: () => true,
    };

    const rendered = OrderStatusBadge(badgeProps) as any;
    assert.ok(rendered);
    const textChild = rendered.props.children[1].props.children;
    assert.equal(textChild, 'Hub đề xuất lịch mới • Cần phản hồi');
  });

  await t.test('order counter appointment proposal is active when inspection contains counter fields', () => {
    const rawFeedItem: any = {
      order: {
        id: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
        status: 'CONFIRMED_PENDING_DISPATCH',
        appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
      },
      inspection: {
        id: 'insp-99cac9fc',
        linkedOrderId: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
        status: 'CONFIRMED_PENDING_DISPATCH',
        orderType: 'AT_HOME',
        appointmentStatus: 'COUNTERED_BY_CENTER',
        appointmentScheduledAt: '2026-11-19T08:30:00.000Z',
        counterScheduledAt: '2026-11-19T06:30:00.000Z',
        counterShift: 'AFTERNOON',
        counterNote: 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.',
      },
      buyerName: 'Nguyen Hieu Tuan',
      sellerName: 'Gian hàng thị thùy trang nguyễn',
    };

    const raw = orderFeedItemToRaw(rawFeedItem);
    assert.equal(raw.id, '99cac9fc-13f3-4316-bae1-6aa97f32be4e');
    assert.equal(raw.appointmentStatus, 'COUNTERED_BY_CENTER');
    assert.equal(raw.counterScheduledAt, '2026-11-19T06:30:00.000Z');
    assert.equal(raw.counterShift, 'AFTERNOON');

    const appt = readOrderAppointment(raw as any, null);
    assert.ok(appt);
    assert.equal(appt.status, 'COUNTERED_BY_CENTER');
    assert.equal(appt.counterScheduledAt, '2026-11-19T06:30:00.000Z');
    assert.equal(appt.counterShift, 'AFTERNOON');
  });

  await t.test('When seller reschedules, appointment status returns to PENDING_CENTER_CONFIRMATION and clears counter state', () => {
    const rescheduledOrder: any = {
      id: '99cac9fc-13f3-4316-bae1-6aa97f32be4e',
      orderType: 'AT_HOME',
      inspectionMethod: 'AT_HOME',
      hasInspectionService: true,
      status: 'CONFIRMED_PENDING_DISPATCH',
      backendStatus: 'CONFIRMED_PENDING_DISPATCH',
      inspectionStatus: 'CONFIRMED_PENDING_DISPATCH',
      appointmentScheduledAt: '2026-11-20T09:00:00.000Z',
      appointmentStatus: 'PENDING_CENTER_CONFIRMATION',
      counterScheduledAt: null,
      counterShift: null,
      counterNote: null,
    };

    const badgeProps: any = {
      status: 'CONFIRMED_PENDING_DISPATCH',
      hasInspection: true,
      isCurrentOrderSeller: true,
      isSeller: true,
      orderItem: rescheduledOrder as EscrowOrder,
      lang: 'vi',
      isOrderCancelledOrRefunded: () => false,
      isOrderSellerConfirmed: () => true,
      getOrderInboundShipment: () => null,
      inboundLoadingOrders: new Set(),
      isInspectorArrivedForOrder: () => false,
      getOrderAppointment: () => ({
        status: 'PENDING_CENTER_CONFIRMATION',
        scheduledAt: '2026-11-20T09:00:00.000Z',
        counterScheduledAt: null,
      }),
      autoPaidOrderIds: new Set(),
      isPartyInspectionFeePending: () => false,
      getPartyInspectionFee: () => 0,
      isPartyInspectionFeePaid: () => true,
    };

    const rendered = OrderStatusBadge(badgeProps) as any;
    assert.ok(rendered);
    const textChild = rendered.props.children[1].props.children;
    assert.equal(textChild, 'Đã đề xuất lịch • Chờ Hub duyệt');
  });
});
