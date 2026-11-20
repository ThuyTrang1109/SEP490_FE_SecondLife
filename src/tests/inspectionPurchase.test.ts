import assert from 'node:assert/strict';
import test from 'node:test';
import { buyerInspectionStageLabel, extractInspectionRejectionDetails, formatOrderCancellationReason, getBuyerInspectionStage, getCustomerInspectionStatus, getInspectionPurchaseDecision, inspectionPurchaseDecisionLabel, parseInspectorVerdictNote, shouldReadSellerHubReturn } from '../utils/inspectionPurchase';

test('the buyer only sees inspection status while the item is on its way to the hub or being inspected', () => {
  const order = { inspectionStatus: 'SHIPPING_TO_CENTER', shippingDeliveredAt: '2026-11-09T08:00:00Z' };
  assert.equal(getBuyerInspectionStage(order), 'waiting');
  assert.equal(getBuyerInspectionStage({ ...order, inspectionStatus: 'INSPECTING' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ ...order, inspectionStatus: 'INSPECTING', backendStatus: 'COMPLETED' }), 'inspecting');
});

test('passing inspection opens the purchase decision and does not count as receipt', () => {
  const order = { inspectionStatus: 'PASSED' };
  assert.equal(getInspectionPurchaseDecision(order), 'pending');
  assert.equal(getBuyerInspectionStage(order), 'decision');
});

test('an assigned inspection is in progress for customers while retaining the dispatch status for operations', () => {
  assert.equal(getCustomerInspectionStatus('DISPATCHED', 'INSPECTING', 'ktv-1'), 'INSPECTING');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'DISPATCHED', inspectorId: 'ktv-1' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SCHEDULED', inspectorId: 'ktv-1' }), 'inspecting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SCHEDULED' }), 'waiting');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'SHIPPING_TO_CENTER', inspectorId: 'ktv-1' }), 'waiting');
  assert.equal(getCustomerInspectionStatus('PASSED', undefined, 'ktv-1'), 'PASSED');
});

test('a purchase accepted by the buyer uses final payment data, not inbound delivery', () => {
  const order = { inspectionStatus: 'DELIVERING_TO_BUYER' };
  assert.notEqual(getBuyerInspectionStage(order), null);
  const purchased = { ...order, finalPaymentPaidAt: '2026-11-09T09:00:00Z', linkedOrderId: 'final-order' };
  assert.equal(getInspectionPurchaseDecision(purchased), 'accepted');
  assert.equal(getBuyerInspectionStage(purchased), null);
});

test('the inspection response distinguishes a buyer rejection from other cancellations', () => {
  const cached = { inspectionStatus: 'PASSED' };
  const cancelled = { status: 'CANCELLED', note: 'Đã hết hạn thanh toán.' };
  assert.equal(getInspectionPurchaseDecision(cached, cancelled), null);
  const rejected = { ...cancelled, note: 'Biên bản đạt | Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý' };
  assert.equal(getInspectionPurchaseDecision(cached, rejected), 'rejected');
  assert.equal(getBuyerInspectionStage({ inspectionStatus: 'CANCELLED', inspectionNote: rejected.note }), 'rejected');
});

test('a direct purchase keeps the regular delivery flow', () => {
  assert.equal(getBuyerInspectionStage({ backendStatus: 'DELIVERED', hasInspectionService: false }), null);
});

test('a seller can load the return shipment after the buyer payment expires on a Hub inspection', () => {
  const order = {
    sellerId: 'seller', inspectionMethod: 'AT_CENTER' as const, inspectionStatus: 'CANCELLED',
    inspectionNote: 'Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
  };
  assert.equal(shouldReadSellerHubReturn(order, 'seller'), true);
  assert.equal(shouldReadSellerHubReturn({ ...order, inspectionNote: '', feeSettledAt: 'settled' }, 'seller'), true);
  assert.equal(shouldReadSellerHubReturn({ ...order, inspectionStatus: 'FAILED' }, 'seller'), true);
  assert.equal(shouldReadSellerHubReturn(order, 'buyer'), false);
  assert.equal(shouldReadSellerHubReturn({ ...order, inspectionMethod: 'AT_HOME' }, 'seller'), false);
  assert.equal(shouldReadSellerHubReturn({ ...order, inspectionStatus: 'PASSED' }, 'seller'), false);
  assert.equal(shouldReadSellerHubReturn({ ...order, linkedOrderId: 'purchase' }, 'seller'), false);
});

test('inspection purchase decision label is perspective-aware for buyer and seller', () => {
  // Buyer perspective (default / isSeller = false)
  assert.equal(inspectionPurchaseDecisionLabel('pending', 'vi', false), 'Chờ quyết định từ bạn');
  assert.equal(inspectionPurchaseDecisionLabel('pending', 'en', false), 'Awaiting your decision');
  assert.equal(inspectionPurchaseDecisionLabel('accepted', 'vi', false), 'Bạn đã xác nhận mua tiếp');
  assert.equal(inspectionPurchaseDecisionLabel('rejected', 'vi', false), 'Bạn đã từ chối mua tiếp');

  // Seller perspective (isSeller = true)
  assert.equal(inspectionPurchaseDecisionLabel('pending', 'vi', true), 'Chờ người mua quyết định');
  assert.equal(inspectionPurchaseDecisionLabel('pending', 'en', true), 'Awaiting buyer decision');
  assert.equal(inspectionPurchaseDecisionLabel('accepted', 'vi', true), 'Người mua đã mua tiếp');
  assert.equal(inspectionPurchaseDecisionLabel('rejected', 'vi', true), 'Người mua từ chối mua');

  // buyerInspectionStageLabel delegates to inspectionPurchaseDecisionLabel
  assert.equal(buyerInspectionStageLabel('decision', 'vi', false), 'Chờ quyết định từ bạn');
  assert.equal(buyerInspectionStageLabel('decision', 'vi', true), 'Chờ người mua quyết định');
  assert.equal(buyerInspectionStageLabel('failed', 'vi'), 'Kiểm định không đạt');
});

test('extractInspectionRejectionDetails correctly separates inspector evaluation note from buyer reject reason', () => {
  const compositeNote = '[Bao bì: Trầy xước nhẹ] Tôi thấy sản phẩm ổn và đẹp | Người mua từ chối mua tiếp sau kiểm định. Lý do: Thay đổi nhu cầu sử dụng / Lý do cá nhân';
  const parsed = extractInspectionRejectionDetails(compositeNote);
  assert.equal(parsed.isBuyerPurchaseRejected, true);
  assert.equal(parsed.inspectorNote, '[Bao bì: Trầy xước nhẹ] Tôi thấy sản phẩm ổn và đẹp');
  assert.equal(parsed.buyerRejectReason, 'Thay đổi nhu cầu sử dụng / Lý do cá nhân');

  // Case with standard format without inspector note
  const onlyBuyer = 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Đổi ý không mua nữa';
  const parsedOnlyBuyer = extractInspectionRejectionDetails(onlyBuyer);
  assert.equal(parsedOnlyBuyer.isBuyerPurchaseRejected, true);
  assert.equal(parsedOnlyBuyer.inspectorNote, '');
  assert.equal(parsedOnlyBuyer.buyerRejectReason, 'Đổi ý không mua nữa');

  // Case with regular cancellation / negotiation note
  const normalCancel = 'Người bán từ chối đề xuất kiểm định';
  const parsedNormal = extractInspectionRejectionDetails(normalCancel);
  assert.equal(parsedNormal.isBuyerPurchaseRejected, false);
  assert.equal(parsedNormal.buyerRejectReason, 'Người bán từ chối đề xuất kiểm định');

  // getInspectionPurchaseDecision returns rejected for composite note
  const orderWithCompositeNote = {
    inspectionStatus: 'CANCELLED',
    inspectionNote: compositeNote,
  };
  assert.equal(getInspectionPurchaseDecision(orderWithCompositeNote), 'rejected');
});

test('formatOrderCancellationReason cleans composite notes for outer order cards', () => {
  const compositeNote = '[Bao bì: Trầy xước nhẹ] Tôi thấy sản phẩm ổn và đẹp | Người mua từ chối mua tiếp sau kiểm định. Lý do: Thay đổi nhu cầu sử dụng / Lý do cá nhân';
  assert.equal(formatOrderCancellationReason(compositeNote, 'vi'), 'Thay đổi nhu cầu sử dụng / Lý do cá nhân');

  const withTagsOnly = '[Bao bì: Rách mép] [Phụ kiện: Thiếu cáp] Hàng không đạt yêu cầu';
  assert.equal(formatOrderCancellationReason(withTagsOnly, 'vi'), 'Hàng không đạt yêu cầu');

  const standardRejection = 'Người mua từ chối mua tiếp sau kiểm định. Lý do: Tìm được máy khác giá tốt hơn';
  assert.equal(formatOrderCancellationReason(standardRejection, 'vi'), 'Tìm được máy khác giá tốt hơn');
});

test('buyer-rejected inspection order continues tracking return shipment from Hub', () => {
  const rejectedOrder: any = {
    id: 'ord-rejected-123',
    status: 'CANCELLED',
    backendStatus: 'CANCELLED',
    inspectionMethod: 'AT_CENTER',
    hasInspectionService: true,
    inspectionStatus: 'CANCELLED',
    inspectionNote: 'Đạt chuẩn | Người mua từ chối mua tiếp sau kiểm định. Lý do: Chán rồi nhé',
  };

  assert.equal(getInspectionPurchaseDecision(rejectedOrder), 'rejected');
});

test('parseInspectorVerdictNote removes Tem tag and cleans up verdict note', () => {
  const rawNote = '[Tem: SL-SEAL-1333420][Grade: Good][Điểm: 100/100][Bao bì: Rách nặng / Móp méo] [Phụ kiện: OK] SẢN PHẨM ĐẠT CHUẨN';
  const parsed = parseInspectorVerdictNote(rawNote);

  assert.equal(parsed.cleanText, 'SẢN PHẨM ĐẠT CHUẨN');
  assert.equal(parsed.packaging, 'Rách nặng / Móp méo');
  assert.equal(parsed.accessories, 'OK');
  assert.equal(parsed.grade, 'Good');
  assert.equal(parsed.score, '100/100');

  // Verify empty fallback
  assert.equal(parseInspectorVerdictNote('').cleanText, '');
  assert.equal(parseInspectorVerdictNote(null).cleanText, '');
});
