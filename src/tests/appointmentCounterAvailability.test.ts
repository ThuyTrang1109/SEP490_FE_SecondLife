import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRejectedSlots, isSlotRejected } from '../components/modals/ScheduleAppointmentModal';

test('a morning counterproposal overrides conflicting notes and cached rejections for that shift', (t) => {
  const date = '2026-11-20';
  const reason = 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.';
  const order = {
    id: 'inspection-id',
    appointmentStatus: 'COUNTERED_BY_CENTER',
    appointmentScheduledAt: `${date}T08:30:00`,
    counterScheduledAt: `${date}T09:00:00`,
    counterNote: reason,
  };
  const cache = new Map([
    ['order_rejected_slots_linked-id', JSON.stringify([
      { date, time: '08:30', shift: 'MORNING', isEntireShift: true, reason },
      { date, time: '09:00', shift: 'MORNING' },
      { date: '2026-11-21', time: '08:00', shift: 'MORNING', isEntireShift: true, reason },
    ])],
    ['order_appointment_linked-id', JSON.stringify({
      status: 'COUNTERED_BY_CENTER', scheduledAt: order.appointmentScheduledAt,
      counterScheduledAt: `${date}T14:00:00`, counterNote: reason,
    })],
  ]);
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (key: string) => cache.get(key) ?? null }, configurable: true,
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const slots = extractRejectedSlots(order.id, 'linked-id', undefined, order);
  assert.equal(slots.some((slot) => slot.date === date && slot.isEntireShift && slot.shift === 'MORNING'), false);
  assert.equal(isSlotRejected(date, '08:30', 'MORNING', slots).rejected, true);
  assert.equal(isSlotRejected(date, '09:00', 'MORNING', slots).rejected, false);
  assert.equal(isSlotRejected(date, '10:30', 'MORNING', slots).rejected, false);
  assert.equal(isSlotRejected('2026-11-21', '10:30', 'MORNING', slots).rejected, true);
});
