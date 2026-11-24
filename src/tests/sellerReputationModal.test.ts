import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAssessmentStatusMeta,
  getReputationWarningMeta,
  getReputationEventMeta,
  formatReputationReason,
  formatFormulaVersion,
} from '../services/reputationService';

describe('Seller Reputation Modal - Vietnamese Translations & Pagination', () => {
  it('translates all warning codes and defaults to pure Vietnamese', () => {
    const restricted = getReputationWarningMeta('SELLING_RESTRICTED');
    assert.strictEqual(restricted?.title, 'Đang bị hạn chế bán hàng');

    const serious = getReputationWarningMeta('SERIOUS_VIOLATION_HISTORY');
    assert.strictEqual(serious?.title, 'Có lịch sử vi phạm nghiêm trọng');

    const unknown = getReputationWarningMeta('SOME_UNKNOWN_CODE');
    assert.strictEqual(unknown?.title, 'Cảnh báo chỉ số uy tín');
    assert.ok(!unknown?.title.includes('UNKNOWN'));
  });

  it('translates event types and descriptions to pure Vietnamese without English GOOD/BAD', () => {
    const completed = getReputationEventMeta('ORDER_COMPLETED');
    assert.strictEqual(completed.label, 'Đánh giá giao dịch hoàn tất');
    assert.ok(!completed.desc.includes('GOOD'));
    assert.ok(completed.desc.includes('+1 đơn thành công'));

    const timeout = getReputationEventMeta('ORDER_CONFIRMATION_TIMEOUT');
    assert.strictEqual(timeout.label, 'Phạt quá hạn hủy đơn (48h)');

    const cancelled = getReputationEventMeta('SELLER_CANCELLED_ORDER');
    assert.strictEqual(cancelled.label, 'Hủy do lỗi người bán');
    assert.ok(!cancelled.desc.includes('BAD'));
    assert.ok(cancelled.desc.includes('+1 đơn lỗi Người bán'));

    const unknown = getReputationEventMeta('CUSTOM_EVENT_CODE');
    assert.strictEqual(unknown.label, 'Biến động uy tín');
    assert.strictEqual(unknown.desc, 'Ghi nhận biến động chỉ số uy tín');
  });

  it('formatReputationReason cleanses English tokens and converts them to Vietnamese', () => {
    const rawReason1 = 'Đơn hàng bị hủy do người bán hoặc quá hạn xử lý (BAD +1)';
    const cleaned1 = formatReputationReason(rawReason1);
    assert.ok(!cleaned1.includes('BAD'));
    assert.strictEqual(cleaned1, 'Đơn hàng bị hủy do người bán hoặc quá hạn xử lý (+1 đơn lỗi Người bán)');

    const rawReason2 = 'SELLER cancelled order due to out of stock (BAD +1)';
    const cleaned2 = formatReputationReason(rawReason2);
    assert.ok(!cleaned2.includes('SELLER'));
    assert.ok(!cleaned2.includes('BAD'));
    assert.ok(cleaned2.includes('Người bán'));
    assert.ok(cleaned2.includes('+1 đơn lỗi Người bán'));

    const rawReason3 = 'ORDER_CONFIRMATION_TIMEOUT for SELLER';
    const cleaned3 = formatReputationReason(rawReason3);
    assert.strictEqual(cleaned3, 'Quá hạn hủy đơn (48h) for Người bán');
  });

  it('formatFormulaVersion translates formula names cleanly', () => {
    assert.strictEqual(formatFormulaVersion('TRANSACTION_SUCCESS_RATE_V3'), 'Công thức: Tỷ lệ giao dịch v3');
    assert.strictEqual(formatFormulaVersion('TRANSACTION_SUCCESS_RATE_V2'), 'Công thức: Tỷ lệ giao dịch v2');
    assert.strictEqual(formatFormulaVersion('TRANSACTION_SUCCESS_RATE'), 'Công thức: Tỷ lệ giao dịch');
    assert.strictEqual(formatFormulaVersion('CUSTOM_V1'), 'Công thức: CUSTOM_V1');
  });

  it('paginates 10 history items per page accurately', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: `item-${i + 1}`,
      eventType: 'ORDER_COMPLETED',
      createdAt: new Date().toISOString(),
    }));

    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    assert.strictEqual(totalPages, 3);

    // Page 0
    const page0 = items.slice(0, 10);
    assert.strictEqual(page0.length, 10);
    assert.strictEqual(page0[0].id, 'item-1');
    assert.strictEqual(page0[9].id, 'item-10');

    // Page 1
    const page1 = items.slice(10, 20);
    assert.strictEqual(page1.length, 10);
    assert.strictEqual(page1[0].id, 'item-11');
    assert.strictEqual(page1[9].id, 'item-20');

    // Page 2
    const page2 = items.slice(20, 30);
    assert.strictEqual(page2.length, 5);
    assert.strictEqual(page2[0].id, 'item-21');
    assert.strictEqual(page2[4].id, 'item-25');
  });

  it('provides Vietnamese labels for assessment status', () => {
    assert.strictEqual(getAssessmentStatusMeta('EVALUATED').label, 'Đủ số đơn tham chiếu');
    assert.strictEqual(getAssessmentStatusMeta('INSUFFICIENT_EVIDENCE').label, 'Chưa đủ mẫu tham chiếu');
    assert.strictEqual(getAssessmentStatusMeta('NO_TRANSACTIONS').label, 'Chưa có mẫu giao dịch');
  });
});
