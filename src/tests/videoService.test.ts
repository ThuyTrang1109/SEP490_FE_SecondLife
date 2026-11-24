import assert from 'node:assert/strict';
import test from 'node:test';
import { videoService, type VideoSignatureResponse } from '../services/videoService';

const signedUpload: VideoSignatureResponse = {
  uploadId: '35b86fe6-d4bf-4021-8351-b8d2886edc63',
  publicId: 'report-evidence/videos/35b86fe6-d4bf-4021-8351-b8d2886edc63',
  signature: 'test-signature',
  apiKey: 'test-key',
  parameters: {
    timestamp: '1795300000',
    upload_preset: 'signed-video',
    public_id: 'report-evidence/videos/35b86fe6-d4bf-4021-8351-b8d2886edc63',
    overwrite: 'false',
    type: 'authenticated',
  },
  uploadUrl: 'https://api.cloudinary.com/v1_1/example/video/upload',
  expiresAt: '2099-11-22T00:00:00Z',
  maxBytes: 100,
  chunkSizeBytes: 4,
};

test('video uploads send the BE signature and API key with every chunk', async (t) => {
  const file = new File(['12345678'], 'evidence.mp4', { type: 'video/mp4' });
  t.mock.method(videoService, 'getUploadSignature', async () => signedUpload);
  const complete = t.mock.method(videoService, 'completeUpload', async () => ({
    evidenceId: signedUpload.uploadId,
    evidenceUrl: '/api/v1/reports/evidence/' + signedUpload.uploadId,
    contentType: 'video/mp4',
    size: file.size,
    mediaType: 'VIDEO' as const,
  }));
  const uploadIds: string[] = [];
  const ranges: string[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, signedUpload.uploadUrl);
    assert.equal(init.method, 'POST');
    assert.ok(init.body instanceof FormData);
    for (const [name, value] of Object.entries(signedUpload.parameters)) {
      assert.deepEqual(init.body.getAll(name), [value]);
    }
    assert.deepEqual(init.body.getAll('api_key'), [signedUpload.apiKey]);
    assert.deepEqual(init.body.getAll('signature'), [signedUpload.signature]);
    const chunk = init.body.get('file');
    assert.ok(chunk instanceof File);
    assert.equal(chunk.name, 'evidence.mp4');
    assert.equal(chunk.type, 'video/mp4');
    assert.equal(chunk.size, 4);
    const headers = new Headers(init.headers);
    assert.equal(headers.has('Authorization'), false);
    uploadIds.push(headers.get('X-Unique-Upload-Id') ?? '');
    ranges.push(headers.get('Content-Range') ?? '');
    return Response.json({ done: ranges.length === 2 });
  });

  const evidence = await videoService.uploadVideoChunked(file);
  assert.equal(evidence.evidenceId, signedUpload.uploadId);
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.deepEqual(ranges, ['bytes 0-3/8', 'bytes 4-7/8']);
  assert.ok(uploadIds[0]);
  assert.equal(uploadIds[0], uploadIds[1]);
  assert.equal(complete.mock.callCount(), 1);
  assert.deepEqual(complete.mock.calls[0].arguments[0], {
    uploadId: signedUpload.uploadId, publicId: signedUpload.publicId, bytes: file.size,
  });
});

test('video uploads stop before contacting Cloudinary if BE returns no API key', async (t) => {
  t.mock.method(videoService, 'getUploadSignature', async () => ({ ...signedUpload, apiKey: '' }));
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected upload without a signature');
  });
  await assert.rejects(
    () => videoService.uploadVideoChunked(new File(['video'], 'evidence.mp4')),
    /Backend chưa trả đủ thông tin xác thực/,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

