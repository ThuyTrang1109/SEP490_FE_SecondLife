import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionEvidenceErrors } from '../components/inspection/InspectionEvidenceErrors';
import { ApiError } from '../services/apiClient';
import {
  getInspectionBatchPhotoError,
  getInspectionEvidenceStepError,
  getInspectionPhotoUploadError,
  getInspectionPhotoSelectionErrors,
  getUploadedInspectionPhotoUrl,
} from '../utils/inspectionEvidencePhotos';

const photo = (size: number, name = 'canh-may.jpg', type = 'image/jpeg') => ({ name, size, type });

test('each selected inspection photo must be strictly under five MB', () => {
  assert.deepEqual(getInspectionPhotoSelectionErrors([photo(4_999_999)], 0), []);
  for (const size of [5_000_000, 5_000_001]) {
    assert.deepEqual(getInspectionPhotoSelectionErrors([photo(1, 'anh-hop-le.jpg'), photo(size)], 0), [
      '"canh-may.jpg" phải có dung lượng dưới 5 MB.',
    ]);
  }
});

test('the photo picker reports unsupported, empty and excess attachments', () => {
  assert.deepEqual(getInspectionPhotoSelectionErrors([
    photo(0, 'empty.jpg'), photo(20, 'clip.mp4', 'video/mp4'), photo(20, 'captured.webp', ''),
  ], 0), [
    '"empty.jpg" là tệp rỗng. Vui lòng chọn ảnh khác.',
    '"clip.mp4" phải là ảnh JPG, PNG hoặc WebP.',
  ]);
  assert.deepEqual(getInspectionPhotoSelectionErrors([photo(20)], 9), []);
  assert.match(getInspectionPhotoSelectionErrors([photo(20)], 10)[0], /Tối đa 10 ảnh/);
});

test('upload errors retain a fallback for transport errors and do not tag a retryable batch failure', () => {
  assert.equal(getInspectionPhotoUploadError(new Error('Mất kết nối.')), 'Mất kết nối.');
  assert.equal(getInspectionPhotoUploadError(new ApiError('Tải ảnh thất bại', 413, [
    { field: 'files', message: 'Hãy giảm dung lượng ảnh.' },
  ])), 'Hãy giảm dung lượng ảnh.');
  assert.equal(getInspectionBatchPhotoError(new ApiError('Máy chủ đang bận.', 503, [
    { field: 'files[0]', message: 'Thử lại sau.' },
  ]), 0), undefined);
});

test('the evidence alert shows the full backend error and the matching filename', () => {
  const reason = 'Ảnh có kích thước 7273 × 4854 px. Tối đa 16000 px/cạnh và 25000000 pixel.';
  const html = renderToStaticMarkup(createElement(InspectionEvidenceErrors, {
    selectionErrors: [],
    stepError: null,
    photos: [
      { id: 'good', file: { name: 'good.jpg' }, status: 'success' },
      { id: 'large', file: { name: 'wide-photo.jpg' }, status: 'error', errorMessage: reason },
    ],
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Ảnh #2 .*wide-photo\.jpg/);
  assert.ok(html.includes(reason));
  assert.doesNotMatch(html, /line-clamp|good\.jpg/);
});

test('proofs need a successfully uploaded image before the conclusion step', () => {
  assert.equal(getUploadedInspectionPhotoUrl('blob:https://example.test/preview.jpg'), '');
  assert.equal(getUploadedInspectionPhotoUrl('data:image/png;base64,test'), '');
  assert.equal(getUploadedInspectionPhotoUrl('https://example.test/proof.mp4'), '');
  assert.equal(getUploadedInspectionPhotoUrl(' https://example.test/proof.png '), 'https://example.test/proof.png');
  assert.match(getInspectionEvidenceStepError(0, false) ?? '', /ít nhất 1 ảnh/);
  assert.match(getInspectionEvidenceStepError(0, true) ?? '', /đang tải lên/);
  assert.match(getInspectionEvidenceStepError(1, true) ?? '', /đang tải lên/);
  assert.equal(getInspectionEvidenceStepError(1, false), null);
  assert.equal(getInspectionEvidenceStepError(10, false), null);
  assert.match(getInspectionEvidenceStepError(11, false) ?? '', /tối đa 10 ảnh/);
});
