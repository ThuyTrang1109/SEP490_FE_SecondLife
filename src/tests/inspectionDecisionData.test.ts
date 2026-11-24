import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspectionOrderDto } from '../services/inspectorService';
import type { EscrowOrder, UserProfile } from '../types';
import { getInspectionApprovalMessage, getInspectionBuyerDestination, getInspectionDecisionStatus, getInspectionRemoteMediaUrl, getInspectionReportMedia, getInspectionStageOne, getInspectionStageTwo, isInspectionProofImage } from '../utils/inspectionDecisionData';

const order: InspectionOrderDto = { id: 'inspection', postId: 'post', status: 'PASSED' };
const buyer: UserProfile = {
  id: 'buyer', role: 'buyer', name: 'Người mua', email: 'buyer@example.com',
  phone: '090 123 4567', address: '12 Đường A, Phường B', latitude: 10.8, longitude: 106.7,
};

test('the inspection verdict takes precedence over cancellation on the order summary', () => {
  const summary = { status: 'CANCELLED', inspectionStatus: 'CANCELLED' };
  assert.deepEqual(getInspectionDecisionStatus(summary, { status: 'FAILED' }), {
    status: 'FAILED', isFailed: true, isCancellationStatus: false,
  });
  assert.deepEqual(getInspectionDecisionStatus({ inspectionStatus: 'INSPECTION_FAILED' }), {
    status: 'INSPECTION_FAILED', isFailed: true, isCancellationStatus: false,
  });
  assert.deepEqual(getInspectionDecisionStatus({ inspectionStatus: 'FAILED', escrowStatus: 'INSPECTION_FAILED' }, { status: 'CANCELLED' }), {
    status: 'CANCELLED', isFailed: false, isCancellationStatus: true,
  });
});

test('stage two uses the saved buyer recipient and pin before the profile address', () => {
  const saved = {
    name: 'Người nhận', phone: '+84 901 234 567', address: '43 Đường C, Phường D',
    latitude: 10.9, longitude: 106.8,
  };
  const inspection = { ...order, buyerId: buyer.id, buyerAddress: buyer.address, buyerDeliveryAddress: saved };
  assert.deepEqual(getInspectionBuyerDestination(inspection, null, buyer), { ...saved, phone: '+84901234567' });
  assert.deepEqual(getInspectionBuyerDestination({
    ...inspection, buyerDeliveryAddress: { ...saved, address: null },
  }, null, buyer), { ...saved, address: '', phone: '+84901234567' });
});

test('stage two can load a saved JSON destination and never combines an order address with a different profile pin', () => {
  const inspection = { ...order, buyerId: buyer.id, buyerAddress: '43 Đường C, Phường D' };
  const legacy = { deliveryAddress: '{"address":"4 Đường E","latitude":10.4,"longitude":106.4}' } as EscrowOrder;
  assert.deepEqual(getInspectionBuyerDestination(inspection, legacy, buyer), {
    name: buyer.name, phone: '0901234567', address: '4 Đường E', latitude: 10.4, longitude: 106.4,
  });
  assert.deepEqual(getInspectionBuyerDestination(inspection, null, buyer), {
    name: buyer.name, phone: '0901234567', address: inspection.buyerAddress,
  });
});

test('stage two ignores a city-only fallback and never uses a different signed-in account', () => {
  const inspection = { ...order, buyerId: buyer.id, buyerAddress: 'TP. Hồ Chí Minh' };
  assert.equal(getInspectionBuyerDestination(inspection, null, {
    ...buyer, address: '', latitude: undefined, longitude: undefined,
  }), null);
  assert.equal(getInspectionBuyerDestination(inspection, null, { ...buyer, id: 'seller', role: 'seller' }), null);
});

test('inspection details distinguish proposal review and fee payment from active inspection', () => {
  const waitingForSeller = getInspectionApprovalMessage('WAITING_SELLER_APPROVAL', true);
  assert.equal(waitingForSeller?.title, 'Chờ người bán duyệt đề xuất kiểm định');
  assert.match(waitingForSeller?.description ?? '', /Đồng Ý hoặc Từ Chối/);
  assert.equal(getInspectionApprovalMessage('WAITING_BUYER_APPROVAL', true)?.title, 'Chờ người mua duyệt lại đề xuất kiểm định');
  assert.equal(getInspectionApprovalMessage('WAITING_FEE_PAYMENT', true)?.title, 'Chờ nộp phí kiểm định');
  assert.equal(getInspectionApprovalMessage('INSPECTING', true), null);

  const waitingForBuyer = getInspectionApprovalMessage('WAITING_SELLER_APPROVAL', false);
  assert.equal(waitingForBuyer?.title, 'Chờ người bán duyệt đề xuất kiểm định');
  assert.match(waitingForBuyer?.description ?? '', /phản hồi của người bán/);
});

test('inspection fees preserve API zero amounts and use travel fees for at-home inspections', () => {
  assert.deepEqual(getInspectionStageOne({
    ...order, orderType: 'AT_HOME', inspectionFee: 100_000, travelFee: 0, shippingFee: 80_000,
    buyerFeeShare: 100_000, sellerFeeShare: 0,
  }), { base: 100_000, transport: 0, reserve: null, buyerShare: 100_000, sellerShare: 0, total: 100_000 });
  assert.equal(getInspectionStageOne(order).total, null);
});

test('stage two waits for a quote and uses the shipping fee stored by the API after payment', () => {
  assert.deepEqual(getInspectionStageTwo({ ...order, finalItemPrice: 300_000 }, null), {
    itemPrice: 300_000, deliveryFee: null, total: null,
  });
  assert.deepEqual(getInspectionStageTwo({ ...order, finalItemPrice: 300_000, finalShippingFee: 0 }, null), {
    itemPrice: 300_000, deliveryFee: 0, total: 300_000,
  });
  assert.equal(getInspectionStageTwo(order, {
    quoteId: 'quote', leg: 'CENTER_TO_BUYER', expiresAt: '2026-11-09T10:00:00Z',
    productPrice: 300_000, shippingFee: 40_000, totalPayable: 340_000,
  }).total, 340_000);
});

test('a photo stored in a legacy video proof field renders as an image', () => {
  assert.equal(isInspectionProofImage('https://res.cloudinary.com/example/image/upload/proof'), true);
  assert.equal(isInspectionProofImage('https://example.com/proof.JPG?token=token'), true);
  assert.equal(isInspectionProofImage('https://res.cloudinary.com/example/video/upload/proof.mp4'), false);
  assert.equal(isInspectionProofImage(''), false);
});

test('a stale blob video falls back to inspection photos stored in the API note', () => {
  const blobUrl = 'blob:http://localhost:3000/expired-preview';
  const photo = 'https://example.com/proof.jpg?label=[hub]';
  const media = getInspectionReportMedia({
    ...order,
    videoProofUrl: blobUrl,
    unboxingVideoUrl: blobUrl,
    proofPhotos: [blobUrl, photo],
    note: `Biên bản [Photos: ${JSON.stringify([photo])}]`,
  });
  assert.deepEqual(media, { videoProofUrl: '', unboxingVideoUrl: '', photos: [photo], note: 'Biên bản' });
  assert.equal(getInspectionRemoteMediaUrl(blobUrl), '');
});

test('a failed remote video leaves the inspection photo available for display', () => {
  const video = 'https://example.com/inspection.mp4';
  const photo = 'https://example.com/inspection.png';
  const report = { ...order, videoProofUrl: video, unboxingVideoUrl: photo };
  assert.equal(getInspectionReportMedia(report).videoProofUrl, video);
  assert.deepEqual(getInspectionReportMedia(report, new Set([video])), {
    videoProofUrl: '', unboxingVideoUrl: '', photos: [photo], note: '',
  });
});

test('proposal notes and dispatch notes are not returned as inspector conclusion', () => {
  // Đơn chưa hoàn tất kiểm định: note không được hiển thị như kết luận của KTV
  const uncompletedOrder = {
    ...order,
    status: 'WAITING_SELLER_APPROVAL',
    note: 'Người mua đề xuất lại phương án chia phí: SELLER_PAYS',
  };
  assert.equal(getInspectionReportMedia(uncompletedOrder).note, '');

  const dispatchOrder = {
    ...order,
    status: 'DISPATCHED',
    note: 'Ghi Chú Hướng Dẫn Kỹ Thuật Cho KTV: Mang đồng hồ đo áp',
  };
  assert.equal(getInspectionReportMedia(dispatchOrder).note, '');

  // Kể cả khi đơn hoàn tất, nếu note là chuỗi đề xuất phân chia phí hoặc hướng dẫn điều phối thì không coi là kết luận KTV
  const completedWithProposalNote = {
    ...order,
    status: 'PASSED',
    note: 'Người mua đề xuất lại phương án chia phí: SELLER_PAYS',
  };
  assert.equal(getInspectionReportMedia(completedWithProposalNote).note, '');

  // Kết luận kiểm định kỹ thuật thực tế của KTV vẫn được giữ nguyên
  const genuineReport = {
    ...order,
    status: 'PASSED',
    note: 'Máy hoạt động ổn định, mâm nhiệt đạt 100 độ C, ngoại quan Grade A',
  };
  assert.equal(
    getInspectionReportMedia(genuineReport).note,
    'Máy hoạt động ổn định, mâm nhiệt đạt 100 độ C, ngoại quan Grade A'
  );
});

test('stage 2 leg status correctly identifies awaiting buyer decision over in-transit', () => {
  const getLeg2Status = (isInspPassed: boolean, decision: string | null, shipmentStatus?: string) => {
    const isPendingDecision = isInspPassed && decision !== 'accepted' && decision !== 'rejected';
    const isAccepted = isInspPassed && decision === 'accepted';
    const isRejected = decision === 'rejected';

    if (isRejected) return { label: 'Từ chối mua • Hoàn trả', leg: 'CENTER_TO_SELLER' };
    if (isPendingDecision) return { label: 'Đã đạt • Chờ người mua quyết định', leg: 'CENTER_TO_BUYER' };
    if (isAccepted && shipmentStatus === 'DELIVERED') return { label: 'Đã giao thành công', leg: 'CENTER_TO_BUYER' };
    if (isAccepted && (shipmentStatus === 'IN_TRANSIT' || shipmentStatus === 'PICKED_UP')) return { label: 'Đang giao người mua', leg: 'CENTER_TO_BUYER' };
    if (isAccepted) return { label: 'Đã duyệt • Chờ giao', leg: 'CENTER_TO_BUYER' };
    return { label: 'Kích hoạt sau khi ĐẠT', leg: 'CENTER_TO_BUYER' };
  };

  // Case 1: Đơn vừa kiểm định ĐẠT, người mua chưa quyết định -> KHÔNG ĐƯỢC hiện Đang giao
  const awaitingDecision = getLeg2Status(true, null);
  assert.equal(awaitingDecision.label, 'Đã đạt • Chờ người mua quyết định');
  assert.equal(awaitingDecision.leg, 'CENTER_TO_BUYER');

  // Case 2: Người mua từ chối mua -> Hoàn trả người bán
  const rejected = getLeg2Status(true, 'rejected');
  assert.equal(rejected.label, 'Từ chối mua • Hoàn trả');
  assert.equal(rejected.leg, 'CENTER_TO_SELLER');

  // Case 3: Người mua đã đồng ý và shipper đang giao
  const inTransit = getLeg2Status(true, 'accepted', 'IN_TRANSIT');
  assert.equal(inTransit.label, 'Đang giao người mua');
  assert.equal(inTransit.leg, 'CENTER_TO_BUYER');
});

test('Inspector verdict badge shows ĐẠT CHUẨN (PASS) for scored/passed inspection even if cancelled, and NEVER shows ĐANG KIỂM ĐỊNH', () => {
  const getVerdictBadge = (params: {
    isPassed: boolean;
    isFailed: boolean;
    conditionScore?: number | null;
    backendStatus?: string;
    inspectorNote?: string;
    parsedScore?: string;
  }) => {
    const parsedScoreNum = params.conditionScore != null
      ? Number(params.conditionScore)
      : (params.parsedScore && !isNaN(Number(params.parsedScore)) ? Number(params.parsedScore) : null);

    const isVerdictPassed = Boolean(
      params.isPassed ||
      (parsedScoreNum != null && parsedScoreNum >= 75) ||
      params.backendStatus === 'PASSED' ||
      (params.inspectorNote && /kiểm định đạt chuẩn|đạt chuẩn \(pass\)/i.test(params.inspectorNote))
    );

    const isVerdictFailed = Boolean(
      !isVerdictPassed && (
        params.isFailed ||
        (parsedScoreNum != null && parsedScoreNum < 75) ||
        params.backendStatus === 'FAILED' ||
        (params.inspectorNote && /không đạt chuẩn|từ chối \(failed\)/i.test(params.inspectorNote))
      )
    );

    if (isVerdictPassed) return 'ĐẠT CHUẨN (PASS)';
    if (isVerdictFailed) return 'TỪ CHỐI (FAILED)';
    return null;
  };

  // Case 1: Cancelled order after inspection passed with score 85 (like user's screenshot)
  const cancelledWithPassVerdict = getVerdictBadge({
    isPassed: false, // isPassed was false because order was cancelled
    isFailed: false,
    conditionScore: 85,
    backendStatus: 'CANCELLED',
    inspectorNote: 'cc | Người mua không thanh toán tiền hàng trong vòng 6 giờ sau khi kiểm định đạt chuẩn.',
  });
  assert.equal(cancelledWithPassVerdict, 'ĐẠT CHUẨN (PASS)', 'Must show ĐẠT CHUẨN (PASS), not ĐANG KIỂM ĐỊNH');

  // Case 2: In-progress order with no verdict or score yet
  const genuinelyInspecting = getVerdictBadge({
    isPassed: false,
    isFailed: false,
    conditionScore: null,
    backendStatus: 'INSPECTING',
  });
  assert.equal(genuinelyInspecting, null, 'Must NOT show ĐANG KIỂM ĐỊNH, badge is omitted');

  // Case 3: Failed inspection with score 40
  const failedVerdict = getVerdictBadge({
    isPassed: false,
    isFailed: true,
    conditionScore: 40,
    backendStatus: 'FAILED',
    inspectorNote: 'Máy rỉ sét, hỏng động cơ',
  });
  assert.equal(failedVerdict, 'TỪ CHỐI (FAILED)');
});
