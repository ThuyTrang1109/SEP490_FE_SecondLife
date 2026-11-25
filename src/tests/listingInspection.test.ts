import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOrderInspectionVerdictPassed,
  isListingInspectionPassed,
  resolveSellerListingInspectionState,
  getListingInspectionBadgeText,
} from '../utils/listingInspection';

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

test('listing badges require a positive inspection result from the marketplace API', () => {
  const failedListing = {
    isInspected: false,
    inspectionPassed: true,
    tamperSealId: 'EXAMPLE-SEAL',
    conditionGrade: 'Fair',
  };
  assert.equal(isListingInspectionPassed(failedListing), false);
  assert.equal(isListingInspectionPassed({ ...failedListing, isInspected: undefined }), false);
  assert.equal(isListingInspectionPassed({ isInspected: true }), true);
  assert.equal(isListingInspectionPassed(undefined), false);
});

test('resolveSellerListingInspectionState shows at-home passed badge strictly when post passed inspection', () => {
  const wmfPost = {
    id: '541f5d0a-61aa-40b6-bea6-4270532fdcdd',
    isInspected: false,
  };

  // No passed inspection -> false
  assert.deepEqual(resolveSellerListingInspectionState(wmfPost, null, []), { passed: false });

  // Pending or failed order -> false
  assert.deepEqual(
    resolveSellerListingInspectionState(wmfPost, null, [
      { id: 'ord-pending', postId: wmfPost.id, inspectionMethod: 'AT_HOME', status: 'DISPATCHED' },
      { id: 'ord-fail', postId: wmfPost.id, inspectionMethod: 'AT_HOME', inspectionStatus: 'FAILED', updatedAt: '2026-11-25T08:00:00Z' },
    ]),
    { passed: false },
  );

  // Passed AT_HOME inspection for exact postId -> passed with AT_HOME method
  assert.deepEqual(
    resolveSellerListingInspectionState(wmfPost, null, [
      {
        id: 'ord-pass-home',
        postId: wmfPost.id,
        inspectionMethod: 'AT_HOME',
        inspectionStatus: 'PASSED',
        updatedAt: '2026-11-25T09:00:00Z',
      },
    ]),
    { passed: true, method: 'AT_HOME' },
  );

  // Older pass followed by a newer failed inspection -> must NOT show passed badge
  assert.deepEqual(
    resolveSellerListingInspectionState(wmfPost, null, [
      {
        id: 'ord-pass-old',
        postId: wmfPost.id,
        inspectionMethod: 'AT_HOME',
        inspectionStatus: 'PASSED',
        updatedAt: '2026-11-24T09:00:00Z',
      },
      {
        id: 'ord-fail-new',
        postId: wmfPost.id,
        inspectionMethod: 'AT_HOME',
        inspectionStatus: 'FAILED',
        updatedAt: '2026-11-25T09:00:00Z',
      },
    ]),
    { passed: false },
  );

  // Order for a different postId must never match
  assert.deepEqual(
    resolveSellerListingInspectionState(wmfPost, null, [
      {
        id: 'ord-other-post',
        postId: 'other-post-id',
        inspectionMethod: 'AT_HOME',
        inspectionStatus: 'PASSED',
      },
    ]),
    { passed: false },
  );
});

test('getListingInspectionBadgeText formats AT_HOME, AT_CENTER, and generic inspected labels cleanly', () => {
  assert.equal(getListingInspectionBadgeText('AT_HOME', 'vi'), 'Đã đạt kiểm định tại nhà');
  assert.equal(getListingInspectionBadgeText('AT_CENTER', 'vi'), 'Đã đạt kiểm định tại Hub');
  assert.equal(getListingInspectionBadgeText(undefined, 'vi'), 'Đã đạt kiểm định');
  assert.equal(getListingInspectionBadgeText('AT_HOME', 'en', true), 'Home Inspected');
});
