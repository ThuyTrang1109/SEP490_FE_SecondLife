import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MORNING_SLOTS, AFTERNOON_SLOTS } from '../components/modals/ScheduleAppointmentModal';
import { isInspectionTimeInShift } from '../utils/inspectionAppointmentTime';

/**
 * Helper to validate appointment date & advance notice rules:
 * - Cannot select date in the past
 * - Cannot select today (must be at least 1 day in advance)
 * - Must select from tomorrow onwards
 */
function validateAppointmentDate(selectedDate: string, todayStr: string, tomorrowStr: string): { valid: boolean; error?: string } {
  if (selectedDate < tomorrowStr) {
    if (selectedDate === todayStr) {
      return {
        valid: false,
        error: 'Không thể đặt lịch trong ngày hôm nay. Quy định bắt buộc phải hẹn trước tối thiểu 1 ngày để Trung tâm kịp sắp xếp KTV.',
      };
    }
    return {
      valid: false,
      error: 'Không thể chọn ngày trong quá khứ. Quy định bắt buộc phải hẹn trước tối thiểu 1 ngày (từ ngày mai trở đi).',
    };
  }
  return { valid: true };
}

describe('Schedule Appointment Advance Notice & Business Hours Validation', () => {
  const todayStr = '2026-11-12';
  const tomorrowStr = '2026-11-13';
  const nextWeekStr = '2026-11-20';
  const yesterdayStr = '2026-11-11';
  const pastYearStr = '2025-10-01';

  test('Past date is strictly rejected', () => {
    const res1 = validateAppointmentDate(yesterdayStr, todayStr, tomorrowStr);
    assert.strictEqual(res1.valid, false);
    assert.match(res1.error || '', /quá khứ/);

    const res2 = validateAppointmentDate(pastYearStr, todayStr, tomorrowStr);
    assert.strictEqual(res2.valid, false);
    assert.match(res2.error || '', /quá khứ/);
  });

  test('Today date is rejected (must schedule at least 1 day in advance)', () => {
    const res = validateAppointmentDate(todayStr, todayStr, tomorrowStr);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /hôm nay/);
    assert.match(res.error || '', /tối thiểu 1 ngày/);
  });

  test('Tomorrow date and future dates are strictly accepted', () => {
    const res1 = validateAppointmentDate(tomorrowStr, todayStr, tomorrowStr);
    assert.strictEqual(res1.valid, true);

    const res2 = validateAppointmentDate(nextWeekStr, todayStr, tomorrowStr);
    assert.strictEqual(res2.valid, true);
  });

  test('All default morning slots are valid within 08:00 - 12:00', () => {
    assert.strictEqual(MORNING_SLOTS.length, 8);
    for (const slot of MORNING_SLOTS) {
      assert.equal(isInspectionTimeInShift(slot, 'MORNING'), true, `Slot ${slot} should be valid`);
    }
  });

  test('All default afternoon slots are valid within 13:00 - 17:00', () => {
    assert.strictEqual(AFTERNOON_SLOTS.length, 8);
    for (const slot of AFTERNOON_SLOTS) {
      assert.equal(isInspectionTimeInShift(slot, 'AFTERNOON'), true, `Slot ${slot} should be valid`);
    }
  });

});
