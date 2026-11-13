import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeListingTitle,
  isOrderInspectionVerdictPassed,
  isListingInspectionPassed,
  markListingInspectionPassed,
  invalidateInspectedRegistry,
} from '../utils/listingInspection';

test('normalizeListingTitle strips prefix, trims and lowercases', () => {
  assert.equal(normalizeListingTitle('  Tiêu đề: Máy Hút Bụi Philips  '), 'máy hút bụi philips');
  assert.equal(normalizeListingTitle('Bàn ủi Rowenta'), 'bàn ủi rowenta');
  assert.equal(normalizeListingTitle(''), '');
  assert.equal(normalizeListingTitle(null), '');
  assert.equal(normalizeListingTitle(undefined), '');
});

test('isOrderInspectionVerdictPassed detects passed inspections correctly', () => {
  // Direct PASSED
  assert.equal(isOrderInspectionVerdictPassed({ status: 'PASSED' }), true);
  assert.equal(isOrderInspectionVerdictPassed({ status: 'INSPECTION_PASSED' }), true);
  assert.equal(isOrderInspectionVerdictPassed({ escrowStatus: 'INSPECTION_PASSED' }), true);
  assert.equal(isOrderInspectionVerdictPassed({ inspectionReport: { verdict: 'PASS' } }), true);

  // Expired / cancelled after passing inspection (Order #17e67687)
  const expiredOrder = {
    id: '17e67687-13fd-411c-8c70-be3e02b69ea9',
    status: 'CANCELLED',
    note: 'Đơn hàng đã tự động hủy do người mua không thanh toán tiền hàng Giai đoạn 2 trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
  };
  assert.equal(isOrderInspectionVerdictPassed(expiredOrder), true);

  // Delivery from center
  assert.equal(isOrderInspectionVerdictPassed({ status: 'DELIVERING_TO_BUYER', orderType: 'AT_CENTER' }), true);

  // FAILED inspections must NEVER be marked as passed
  assert.equal(isOrderInspectionVerdictPassed({ status: 'FAILED' }), false);
  assert.equal(isOrderInspectionVerdictPassed({ inspectionStatus: 'FAILED' }), false);
  assert.equal(isOrderInspectionVerdictPassed({ escrowStatus: 'INSPECTION_FAILED' }), false);
  assert.equal(isOrderInspectionVerdictPassed({ inspectionReport: { verdict: 'FAIL' } }), false);
  assert.equal(isOrderInspectionVerdictPassed({ verdict: 'FAIL', note: 'Sản phẩm không đạt kiểm định' }), false);

  // Pending / unrelated orders
  assert.equal(isOrderInspectionVerdictPassed({ status: 'PENDING' }), false);
  assert.equal(isOrderInspectionVerdictPassed({ status: 'CANCELLED', note: 'Người mua tự hủy' }), false);
  assert.equal(isOrderInspectionVerdictPassed(null), false);
  assert.equal(isOrderInspectionVerdictPassed(undefined), false);
});

test('isListingInspectionPassed matches items by flag, id, and orders list', () => {
  invalidateInspectedRegistry();

  // 1. Direct item flags
  assert.equal(isListingInspectionPassed({ id: 'item-1', isInspected: true }), true);
  assert.equal(isListingInspectionPassed({ id: 'item-2', inspectionPassed: true }), true);
  assert.equal(isListingInspectionPassed({ id: 'item-3', inspectionStatus: 'PASSED' }), true);
  assert.equal(isListingInspectionPassed({ id: 'item-4', tamperSealId: 'SEAL-9988' }), true);

  // 2. Uninspected item
  assert.equal(isListingInspectionPassed({ id: 'item-5', title: 'Nồi Cơm Điện Sharp' }), false);

  // 3. Matched via in-memory orders argument
  const orders = [
    {
      id: 'ord-101',
      postId: 'post-101',
      postTitle: 'Máy Hút Bụi Cầm Tay Philips 1000W-1600W - Dùng Gia Đình Nguyên Zin Lực Mạnh',
      status: 'CANCELLED',
      note: 'Đơn hàng đã tự động hủy do người mua không thanh toán tiền hàng Giai đoạn 2 trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
    },
    {
      id: 'ord-102',
      postId: 'post-102',
      postTitle: 'Bàn ủi Rowenta Khô Cầm Tay',
      status: 'FAILED',
      note: 'Thiết bị không đạt yêu cầu kiểm định kỹ thuật',
    },
  ];

  // Matched by postId
  assert.equal(isListingInspectionPassed({ id: 'post-101', title: 'Máy Hút Bụi' }, orders), true);

  // Matched by title (Philips vacuum cleaner)
  assert.equal(
    isListingInspectionPassed(
      {
        id: 'some-other-listing-id',
        title: 'Máy Hút Bụi Cầm Tay Philips 1000W-1600W - Dùng Gia Đình Nguyên Zin Lực Mạnh',
      },
      orders
    ),
    true
  );

  // Failed inspection must NOT pass
  assert.equal(
    isListingInspectionPassed(
      {
        id: 'post-102',
        title: 'Bàn ủi Rowenta Khô Cầm Tay',
      },
      orders
    ),
    false
  );

  // Title truncated with ellipsis (e.g. from UI truncation)
  assert.equal(
    isListingInspectionPassed(
      {
        id: 'item-philips-truncated',
        title: 'Máy Hút Bụi Cầm Tay Philips 1000W-1600W...',
      },
      orders
    ),
    true
  );
});

test('markListingInspectionPassed registers item and notifies listeners', () => {
  invalidateInspectedRegistry();
  const testId = 'test-pass-999';
  const testTitle = 'Tủ Lạnh Panasonic Inverter 300L';

  assert.equal(isListingInspectionPassed({ id: testId, title: testTitle }), false);

  markListingInspectionPassed(testId, testTitle);

  assert.equal(isListingInspectionPassed({ id: testId }), true);
  assert.equal(isListingInspectionPassed({ id: 'other-id', title: testTitle }), true);
});
