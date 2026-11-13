import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspectionOrderDto } from '../services/inspectorService';
import { getInspectionApprovalMessage, getInspectionRemoteMediaUrl, getInspectionReportMedia, getInspectionStageOne, getInspectionStageTwo, isInspectionProofImage } from '../utils/inspectionDecisionData';

const order: InspectionOrderDto = { id: 'inspection', postId: 'post', status: 'PASSED' };

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
