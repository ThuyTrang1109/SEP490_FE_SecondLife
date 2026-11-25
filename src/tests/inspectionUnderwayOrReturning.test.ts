import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isInspectionOrderUnderway,
  isInspectionReturningToSeller,
  isPostUnderInspectionOrReturning,
  getPostReturnStatus,
  isOrderCancelledOrRefunded,
  getBoughtListingIds,
} from '../utils/orderUtils';

test('isInspectionOrderUnderway correctly identifies active inspection orders', () => {
  assert.equal(isInspectionOrderUnderway({ status: 'WAITING_SELLER_APPROVAL' }), true);
  assert.equal(isInspectionOrderUnderway({ status: 'WAITING_FEE_PAYMENT' }), true);
  assert.equal(isInspectionOrderUnderway({ status: 'SHIPPING_TO_CENTER' }), true);
  assert.equal(isInspectionOrderUnderway({ status: 'INSPECTING' }), true);
  assert.equal(isInspectionOrderUnderway({ status: 'PASSED' }), true);
  assert.equal(isInspectionOrderUnderway({ status: 'COMPLETED' }), false);
  assert.equal(isInspectionOrderUnderway(null), false);
});

test('isInspectionReturningToSeller detects orders where item has not yet returned to seller', () => {
  // Case 1: Buyer rejected after inspection, at center
  const rejectedAfterInspection = {
    id: 'ord-reject-1',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    conditionScore: 90,
    note: 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Thay đổi nhu cầu sử dụng',
  };
  assert.equal(isInspectionReturningToSeller(rejectedAfterInspection), true);

  // Case 2: Inspection failed at center
  const failedInspection = {
    id: 'ord-fail-1',
    orderType: 'AT_CENTER',
    status: 'FAILED',
    note: 'Không đạt chuẩn kỹ thuật',
  };
  assert.equal(isInspectionReturningToSeller(failedInspection), true);

  // Case 3: Seller confirmed receiving the return
  const confirmedReturn = {
    ...rejectedAfterInspection,
    id: 'ord-reject-confirmed',
    sellerReturnConfirmedAt: '2026-11-24T15:00:00Z',
  };
  assert.equal(isInspectionReturningToSeller(confirmedReturn), false);

  // Case 4: Normal order cancelled before payment (item never left seller)
  const regularCancelled = {
    id: 'ord-regular-cancel',
    orderType: 'STANDARD',
    status: 'CANCELLED',
    note: 'Người mua hủy đơn chưa thanh toán',
  };
  assert.equal(isInspectionReturningToSeller(regularCancelled), false);
});

test('a rejected or failed at-home inspection leaves the item available to the seller', () => {
  const post = { id: 'home-inspection-post', status: 'ACTIVE', title: 'Máy xay sinh tố WMF Kult' };
  const rejected = {
    id: 'home-inspection',
    postId: post.id,
    orderType: 'AT_HOME',
    status: 'CANCELLED',
    hasInspectionService: true,
    inspectionCenterId: 'assigned-hub',
    conditionScore: 95,
    conditionGrade: 'Good',
    feeSettledAt: '2026-11-25T02:17:12Z',
    settlementOutcome: 'PASSED_BUYER_DEFAULTED',
    note: 'Người mua từ chối mua tiếp sau kiểm định',
  };
  const failed = {
    ...rejected,
    order_type: 'AT_HOME',
    orderType: undefined,
    status: 'FAILED',
    escrowStatus: 'REFUNDED',
    settlementOutcome: 'FAILED_INSPECTION',
  };
  for (const order of [rejected, failed, { ...rejected, orderType: undefined, inspectionMethod: 'AT_HOME' }]) {
    assert.equal(isInspectionReturningToSeller(order), false);
    assert.equal(isOrderCancelledOrRefunded(order), true);
    assert.equal(getPostReturnStatus(post, [order]), null);
    assert.equal(isPostUnderInspectionOrReturning(post, [order]), false);
  }
  const purchaseWithReturn = {
    ...rejected,
    status: 'DELIVERED',
    shipments: [{ leg: 'BUYER_TO_SELLER', status: 'IN_TRANSIT' }],
  };
  assert.equal(isInspectionReturningToSeller(purchaseWithReturn), true);
  assert.equal(getPostReturnStatus(post, [purchaseWithReturn])?.isReturning, true);
});

test('isOrderCancelledOrRefunded refuses to free up listing if item is returning or under inspection', () => {
  const rejectedAfterInspection = {
    id: 'ord-reject-2',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    conditionScore: 85,
    note: 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý',
    postId: 'post-hairdryer-1',
  };

  // Must NOT treat as cancelled/available because physical device hasn't reached seller yet
  assert.equal(isOrderCancelledOrRefunded(rejectedAfterInspection), false);

  // Regular cancelled order should still be treated as cancelled
  const normalCancel = {
    id: 'ord-norm-2',
    status: 'CANCELLED',
    orderType: 'STANDARD',
  };
  assert.equal(isOrderCancelledOrRefunded(normalCancel), true);
});

test('getBoughtListingIds keeps post locked while returning or under inspection', (t) => {
  const cache = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, val: string) => { cache.set(key, val); },
    removeItem: (key: string) => { cache.delete(key); },
  };

  for (const [name, value] of Object.entries({ window: { localStorage: localStorageMock }, localStorage: localStorageMock })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }

  const postUnderReturn = {
    id: 'ord-returning-post-1',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    conditionScore: 92,
    note: 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Không thích',
    postId: 'braun-hairdryer-1000',
  };

  cache.set('all_orders_cache', JSON.stringify([postUnderReturn]));

  const lockedIds = getBoughtListingIds([postUnderReturn]);
  assert.equal(lockedIds.has('braun-hairdryer-1000'), true);
  assert.equal(isPostUnderInspectionOrReturning('braun-hairdryer-1000', [postUnderReturn]), true);

  const closedHomeInspection = {
    id: 'home-inspection-closed',
    postId: 'wmf-kult-test-post',
    inspectionMethod: 'AT_HOME',
    hasInspectionService: true,
    backendStatus: 'CANCELLED',
    settlementOutcome: 'PASSED_BUYER_DEFAULTED',
  };
  cache.set('all_orders_cache', JSON.stringify([postUnderReturn, closedHomeInspection]));
  cache.set('recent_placed_orders', JSON.stringify([{ ...closedHomeInspection, backendStatus: 'PASSED' }]));
  cache.set('bought_listing_ids', JSON.stringify([closedHomeInspection.postId]));

  assert.equal(getPostReturnStatus(closedHomeInspection.postId), null);
  assert.equal(isPostUnderInspectionOrReturning(closedHomeInspection.postId), false);
  assert.equal(getBoughtListingIds().has(closedHomeInspection.postId), false);
  assert.equal(getBoughtListingIds().has(postUnderReturn.postId), true);
});

test('isInspectionReturningToSeller detects orders with active/failed CENTER_TO_SELLER shipments', () => {
  const orderWithFailedReturn = {
    id: '08007625',
    orderType: 'AT_CENTER',
    status: 'CANCELLED',
    postTitle: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    shipments: [
      {
        shipmentId: 'ship-failed-1',
        leg: 'CENTER_TO_SELLER',
        orderCode: 'LLM-3635704444',
        status: 'FAILED',
        providerStatus: 'REJECTED',
      },
    ],
  };

  assert.equal(isInspectionReturningToSeller(orderWithFailedReturn), true);

  const orderWithDeliveredReturn = {
    ...orderWithFailedReturn,
    shipments: [
      {
        shipmentId: 'ship-delivered-1',
        leg: 'CENTER_TO_SELLER',
        orderCode: 'LLM-3635704444',
        status: 'DELIVERED',
        deliveredAt: '2026-11-24T16:00:00Z',
      },
    ],
  };
  assert.equal(isInspectionReturningToSeller(orderWithDeliveredReturn), false);
});

test('isPostUnderInspectionOrReturning matches by title and bracket tags like [TEST MUA 03]', () => {
  const orderTest03 = {
    id: '08007625',
    postId: 'post-test-03-different-id',
    postTitle: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    orderType: 'AT_CENTER',
    settlementOutcome: 'PASSED_BUYER_DEFAULTED',
    conditionScore: 95,
    note: 'Người mua từ chối mua tiếp sau kiểm định',
  };

  // Match by exact title
  assert.equal(
    isPostUnderInspectionOrReturning('[TEST MUA 03] Máy sấy tóc Braun Silencio 1000', [orderTest03]),
    true
  );

  // Match by post object with different postId but identical title
  const postFromMarketplace = {
    postId: '6492a04c-ff38-4e0d-8012-3f',
    title: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    itemCondition: 'USED_GOOD',
  };
  assert.equal(isPostUnderInspectionOrReturning(postFromMarketplace, [orderTest03]), true);

  // Unrelated post should not match
  const unrelatedPost = {
    postId: 'unrelated-uuid',
    title: '[TEST MUA 04] Máy may mini Double Stitch',
  };
  assert.equal(isPostUnderInspectionOrReturning(unrelatedPost, [orderTest03]), false);
});

test('buyer return due to seller error marks post as returning/returned and NEVER as sold', () => {
  const postTest03 = {
    id: '62b04865-f9a1-4389-9801-b51d3822df34',
    title: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    status: 'sold',
    backendStatus: 'SOLD',
  };

  const sellerDispute = {
    id: 'report-64b298f3',
    orderId: 'c9c26d03-35aa-4ee2-ac0b-058c6a27512c',
    postId: '62b04865-f9a1-4389-9801-b51d3822df34',
    postTitle: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    resolutionAction: 'RETURN_AND_REFUND',
    responsibleParty: 'SELLER',
    status: 'IN_REVIEW',
    returnShipment: {
      leg: 'BUYER_TO_SELLER',
      status: 'IN_TRANSIT',
    },
  };

  // 1. Khi đang trong quá trình hoàn trả do lỗi người bán
  const retActive = getPostReturnStatus(postTest03, [], [sellerDispute]);
  assert.notEqual(retActive, null);
  assert.equal(retActive?.isReturning, true);
  assert.equal(retActive?.isReturned, false);
  assert.equal(retActive?.responsibleParty, 'SELLER');
  assert.equal(retActive?.orderId, 'c9c26d03-35aa-4ee2-ac0b-058c6a27512c');

  // isPostUnderInspectionOrReturning must also be true while returning
  assert.equal(isPostUnderInspectionOrReturning(postTest03, [], [sellerDispute]), true);

  // 2. Khi hoàn tất trả hàng / hoàn tiền cho người mua
  const resolvedDispute = {
    ...sellerDispute,
    status: 'RESOLVED',
    refundedAt: '2026-11-24T18:00:00Z',
    returnShipment: {
      leg: 'BUYER_TO_SELLER',
      status: 'DELIVERED',
      deliveredAt: '2026-11-24T18:00:00Z',
    },
  };

  const retCompleted = getPostReturnStatus(postTest03, [], [resolvedDispute]);
  assert.notEqual(retCompleted, null);
  assert.equal(retCompleted?.isReturning, false);
  assert.equal(retCompleted?.isReturned, true);

  // 3. Khớp bằng OrderReturnInfo trên EscrowOrder
  const orderWithReturn = {
    id: 'c9c26d03-35aa-4ee2-ac0b-058c6a27512c',
    postId: '62b04865-f9a1-4389-9801-b51d3822df34',
    postTitle: '[TEST MUA 03] Máy sấy tóc Braun Silencio 1000',
    orderReturn: {
      orderId: 'c9c26d03-35aa-4ee2-ac0b-058c6a27512c',
      reportId: 'report-64b298f3',
      shipmentStatus: 'IN_TRANSIT',
    },
  };

  const retFromOrder = getPostReturnStatus(postTest03, [orderWithReturn]);
  assert.notEqual(retFromOrder, null);
  assert.equal(retFromOrder?.isReturning, true);
  assert.equal(retFromOrder?.isReturned, false);
});

