import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspectionOrderDto } from '../services/inspectorService';
import { getInspectionRemoteMediaUrl, getInspectionReportMedia, getInspectionStageOne, getInspectionStageTwo, isInspectionProofImage } from '../utils/inspectionDecisionData';

const order: InspectionOrderDto = { id: 'inspection', postId: 'post', status: 'PASSED' };

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
