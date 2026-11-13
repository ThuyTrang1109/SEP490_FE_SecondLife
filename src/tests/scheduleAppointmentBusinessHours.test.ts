import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MORNING_SLOTS, AFTERNOON_SLOTS } from '../components/modals/ScheduleAppointmentModal';

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

/**
 * Helper to validate appointment time against business hours rules:
 * - Morning: 08:00 - 12:00
 * - Afternoon: 13:00 - 17:00
 * - Lunch break: 12:01 - 12:59 is rejected
 * - Outside 08:00 - 17:00 is rejected
 */
function validateAppointmentBusinessHours(hour: number, minute: number): { valid: boolean; error?: string } {
  const timeInMinutes = hour * 60 + minute;
  const morningStart = 8 * 60; // 08:00
  const morningEnd = 12 * 60; // 12:00
  const afternoonStart = 13 * 60; // 13:00
  const afternoonEnd = 17 * 60; // 17:00

  const isMorning = timeInMinutes >= morningStart && timeInMinutes <= morningEnd;
  const isAfternoon = timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd;

  if (!isMorning && !isAfternoon) {
    if (timeInMinutes > morningEnd && timeInMinutes < afternoonStart) {
      return {
        valid: false,
        error: '12:00 - 13:00 là thời gian nghỉ trưa của KTV. Vui lòng chọn Ca Sáng (08:00 - 12:00) hoặc Ca Chiều (13:00 - 17:00).',
      };
    }
    return {
      valid: false,
      error: 'Vui lòng chọn khung giờ hành chính: Ca Sáng (08:00 - 12:00) hoặc Ca Chiều (13:00 - 17:00).',
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
      const [h, m] = slot.split(':').map(Number);
      const res = validateAppointmentBusinessHours(h, m);
      assert.strictEqual(res.valid, true, `Slot ${slot} should be valid`);
    }
  });

  test('All default afternoon slots are valid within 13:00 - 17:00', () => {
    assert.strictEqual(AFTERNOON_SLOTS.length, 8);
    for (const slot of AFTERNOON_SLOTS) {
      const [h, m] = slot.split(':').map(Number);
      const res = validateAppointmentBusinessHours(h, m);
      assert.strictEqual(res.valid, true, `Slot ${slot} should be valid`);
    }
  });

  test('Boundary times 08:00, 12:00, 13:00, 17:00 are strictly valid', () => {
    assert.strictEqual(validateAppointmentBusinessHours(8, 0).valid, true);
    assert.strictEqual(validateAppointmentBusinessHours(12, 0).valid, true);
    assert.strictEqual(validateAppointmentBusinessHours(13, 0).valid, true);
    assert.strictEqual(validateAppointmentBusinessHours(17, 0).valid, true);
  });

  test('Lunch break times (12:01 to 12:59) are rejected with lunch break message', () => {
    const res1 = validateAppointmentBusinessHours(12, 1);
    assert.strictEqual(res1.valid, false);
    assert.match(res1.error || '', /nghỉ trưa/);

    const res2 = validateAppointmentBusinessHours(12, 30);
    assert.strictEqual(res2.valid, false);
    assert.match(res2.error || '', /nghỉ trưa/);

    const res3 = validateAppointmentBusinessHours(12, 59);
    assert.strictEqual(res3.valid, false);
    assert.match(res3.error || '', /nghỉ trưa/);
  });

  test('Early morning times (before 08:00) are rejected with outside business hours message', () => {
    const res1 = validateAppointmentBusinessHours(7, 59);
    assert.strictEqual(res1.valid, false);
    assert.match(res1.error || '', /khung giờ hành chính/);

    const res2 = validateAppointmentBusinessHours(6, 0);
    assert.strictEqual(res2.valid, false);
    assert.match(res2.error || '', /khung giờ hành chính/);

    const res3 = validateAppointmentBusinessHours(0, 0);
    assert.strictEqual(res3.valid, false);
    assert.match(res3.error || '', /khung giờ hành chính/);
  });

  test('Evening times (after 17:00) are rejected with outside business hours message', () => {
    const res1 = validateAppointmentBusinessHours(17, 1);
    assert.strictEqual(res1.valid, false);
    assert.match(res1.error || '', /khung giờ hành chính/);

    const res2 = validateAppointmentBusinessHours(18, 0);
    assert.strictEqual(res2.valid, false);
    assert.match(res2.error || '', /khung giờ hành chính/);

    const res3 = validateAppointmentBusinessHours(22, 30);
    assert.strictEqual(res3.valid, false);
    assert.match(res3.error || '', /khung giờ hành chính/);
  });
});
