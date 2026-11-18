import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInspectionTimeInShift,
  canInspectorCheckIn,
  CHECKIN_ADVANCE_WINDOW_MINUTES
} from '../utils/inspectionAppointmentTime';

describe('inspection appointment time for the selected shift', () => {
  test('accepts the start, last minute and custom minutes within each shift', () => {
    for (const time of ['08:00', '09:17', '11:59']) {
      assert.equal(isInspectionTimeInShift(time, 'MORNING'), true, time);
    }
    for (const time of ['13:00', '15:47', '16:59']) {
      assert.equal(isInspectionTimeInShift(time, 'AFTERNOON'), true, time);
    }
  });

  test('rejects times outside the selected shift, including the other shift', () => {
    for (const time of ['07:59', '12:00', '12:01', '13:00', '20:00']) {
      assert.equal(isInspectionTimeInShift(time, 'MORNING'), false, time);
    }
    for (const time of ['02:00', '08:00', '12:59', '17:00', '17:01', '20:00']) {
      assert.equal(isInspectionTimeInShift(time, 'AFTERNOON'), false, time);
    }
  });

  test('rejects empty, malformed and impossible times', () => {
    for (const time of ['', '9:00', '09:60', '24:00', '09:00:30']) {
      assert.equal(isInspectionTimeInShift(time, 'MORNING'), false, time);
    }
  });
});

describe('Inspector Check-in 30-minute Advance Rule', () => {
  const scheduledTime = '2026-11-18T08:30:00.000Z';
  const scheduledDate = new Date(scheduledTime);

  test('Advance window constant is exactly 30 minutes', () => {
    assert.equal(CHECKIN_ADVANCE_WINDOW_MINUTES, 30);
  });

  test('Check-in is blocked more than 30 minutes before appointment (e.g. 31 minutes before)', () => {
    // 31 minutes before 08:30 is 07:59
    const nowTime = new Date(scheduledDate.getTime() - 31 * 60 * 1000);
    const result = canInspectorCheckIn(scheduledTime, nowTime);

    assert.equal(result.allowed, false);
    assert.equal(result.minutesUntilCheckIn, 1);
    assert.ok(result.reason?.includes('Chưa đến giờ tiếp nhận đơn'));
    assert.ok(result.reason?.includes('tối đa 30 phút'));
  });

  test('Check-in is blocked hours or days before appointment (e.g. 24 hours before)', () => {
    const nowTime = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000);
    const result = canInspectorCheckIn(scheduledTime, nowTime);

    assert.equal(result.allowed, false);
    assert.ok(result.minutesUntilCheckIn > 1000);
    assert.ok(result.reason?.includes('Chưa đến giờ tiếp nhận đơn'));
  });

  test('Check-in is allowed exactly 30 minutes before appointment', () => {
    // Exactly 30 minutes before 08:30 is 08:00
    const nowTime = new Date(scheduledDate.getTime() - 30 * 60 * 1000);
    const result = canInspectorCheckIn(scheduledTime, nowTime);

    assert.equal(result.allowed, true);
    assert.equal(result.minutesUntilCheckIn, 0);
  });

  test('Check-in is allowed within 30 minutes window (e.g. 15 minutes before)', () => {
    const nowTime = new Date(scheduledDate.getTime() - 15 * 60 * 1000);
    const result = canInspectorCheckIn(scheduledTime, nowTime);

    assert.equal(result.allowed, true);
    assert.equal(result.minutesUntilCheckIn, 0);
  });

  test('Check-in is allowed at the scheduled appointment time or later', () => {
    const onTime = new Date(scheduledDate.getTime());
    assert.equal(canInspectorCheckIn(scheduledTime, onTime).allowed, true);

    const afterTime = new Date(scheduledDate.getTime() + 15 * 60 * 1000);
    assert.equal(canInspectorCheckIn(scheduledTime, afterTime).allowed, true);
  });

  test('Check-in is rejected when appointment is missing or invalid', () => {
    assert.equal(canInspectorCheckIn(null).allowed, false);
    assert.equal(canInspectorCheckIn(undefined).allowed, false);
    assert.equal(canInspectorCheckIn('').allowed, false);
    assert.equal(canInspectorCheckIn('not-a-date').allowed, false);
  });
});
