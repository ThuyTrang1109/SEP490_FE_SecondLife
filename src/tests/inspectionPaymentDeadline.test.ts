import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatInspectionDeadline,
  isInspectionPaymentExpired,
  calculateDeadlineTimeLeft,
} from '../utils/inspectionPaymentDeadline';

test('1. Đơn mới 12 giờ: tính toán countdown và chưa hết hạn', () => {
  const baseTime = new Date('2026-11-09T10:00:00+07:00');
  // BE cấp 12 giờ khi sang WAITING_FEE_PAYMENT
  const deadline12h = new Date(baseTime.getTime() + 12 * 60 * 60 * 1000).toISOString();

  // Kiểm tra trạng thái tại thời điểm tạo đơn
  assert.equal(isInspectionPaymentExpired(deadline12h, baseTime), false);

  const timeLeft = calculateDeadlineTimeLeft(deadline12h, baseTime, 'vi');
  assert.equal(timeLeft.isExpired, false);
  assert.equal(timeLeft.hours, 12);
  assert.equal(timeLeft.minutes, 0);
  assert.equal(timeLeft.totalSeconds, 12 * 3600);
  assert.equal(timeLeft.formattedRemaining, '12g 0p');

  // Sau 1 giờ (còn 11 giờ)
  const after1Hour = new Date(baseTime.getTime() + 1 * 60 * 60 * 1000);
  const timeLeftAfter1h = calculateDeadlineTimeLeft(deadline12h, after1Hour, 'vi');
  assert.equal(timeLeftAfter1h.hours, 11);
  assert.equal(timeLeftAfter1h.formattedRemaining, '11g 0p');
});

test('2. Đơn cũ có hạn đã lưu (6 giờ): đọc đúng từ paymentDeadline trong DB', () => {
  const baseTime = new Date('2026-11-09T08:00:00+07:00');
  // Đơn cũ mang hạn 6 giờ đã lưu trong DB
  const deadline6h = new Date(baseTime.getTime() + 6 * 60 * 60 * 1000).toISOString();

  assert.equal(isInspectionPaymentExpired(deadline6h, baseTime), false);

  const timeLeft = calculateDeadlineTimeLeft(deadline6h, baseTime, 'vi');
  assert.equal(timeLeft.isExpired, false);
  assert.equal(timeLeft.hours, 6);
  assert.equal(timeLeft.minutes, 0);
  assert.equal(timeLeft.formattedRemaining, '6g 0p');
});

test('3. Hạn qua nửa đêm: hiển thị rõ cả ngày và giờ theo múi giờ', () => {
  // Tạo đơn lúc 20:30 tối ngày 09/11/2026, hạn 12 giờ -> 08:30 sáng ngày 10/11/2026
  const eveningOrderTime = new Date('2026-11-09T20:30:00+07:00');
  const midnightCrossingDeadline = new Date(eveningOrderTime.getTime() + 12 * 60 * 60 * 1000).toISOString();

  const formattedVi = formatInspectionDeadline(midnightCrossingDeadline, 'vi');
  const formattedEn = formatInspectionDeadline(midnightCrossingDeadline, 'en');

  // Đảm bảo chứa cả giờ và ngày tháng năm để người dùng không bị nhầm lẫn khi qua ngày mới
  assert.match(formattedVi, /08:30/);
  assert.match(formattedVi, /10\/11\/2026/);

  assert.match(formattedEn, /08:30/);
  assert.match(formattedEn, /11\/10\/2026/);

  // Đang là 23:45 cùng ngày 09/11 (chưa qua nửa đêm), đếm ngược vẫn chính xác
  const beforeMidnight = new Date('2026-11-09T23:45:00+07:00');
  const timeLeft = calculateDeadlineTimeLeft(midnightCrossingDeadline, beforeMidnight, 'vi');
  assert.equal(timeLeft.isExpired, false);
  assert.equal(timeLeft.hours, 8);
  assert.equal(timeLeft.minutes, 45);
  assert.equal(timeLeft.formattedRemaining, '8g 45p');
});

test('4. Đơn đã hết hạn: phát hiện chính xác, khóa thanh toán', () => {
  const deadline = '2026-11-09T14:00:00+07:00';
  const afterDeadline = new Date('2026-11-09T14:05:00+07:00');

  assert.equal(isInspectionPaymentExpired(deadline, afterDeadline), true);

  const timeLeft = calculateDeadlineTimeLeft(deadline, afterDeadline, 'vi');
  assert.equal(timeLeft.isExpired, true);
  assert.equal(timeLeft.totalSeconds, 0);
  assert.equal(timeLeft.hours, 0);
  assert.equal(timeLeft.minutes, 0);
  assert.equal(timeLeft.formattedRemaining, '0p');
});

test('5. Xử lý dữ liệu biên: deadline rỗng hoặc không hợp lệ', () => {
  assert.equal(isInspectionPaymentExpired(null), false);
  assert.equal(isInspectionPaymentExpired(undefined), false);
  assert.equal(isInspectionPaymentExpired('invalid-date'), false);

  assert.equal(formatInspectionDeadline(null), '');
  assert.equal(formatInspectionDeadline('invalid'), '');

  const emptyTime = calculateDeadlineTimeLeft(null);
  assert.equal(emptyTime.isExpired, false);
  assert.equal(emptyTime.totalSeconds, 0);
});

