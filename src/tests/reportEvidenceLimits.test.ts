import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReportEvidenceFiles } from '../utils/reportEvidenceLimits';

const image = (size: number) => new File([new Uint8Array(size)], 'package.jpg', { type: 'image/jpeg' });
const video = (size: number) => new File([new Uint8Array(size)], 'packing.mp4', { type: 'video/mp4' });

test('evidence accepts exactly five attachments and requires photos below 5 MB', async () => {
  await validateReportEvidenceFiles([image(4_999_999)], 4, true);
  await assert.rejects(validateReportEvidenceFiles([image(1)], 5, true), /tối đa 5 tệp/);
  await assert.rejects(validateReportEvidenceFiles([image(5_000_000)], 0, true), /package\.jpg.*dưới 5 MB/);
});

test('evidence rejects a video at the 10 MB limit before reading metadata', async () => {
  await assert.rejects(validateReportEvidenceFiles([video(10_000_000)], 0, true), /packing\.mp4.*dưới 10 MB/);
});

test('evidence accepts video below 90 seconds and rejects video at 90 seconds', async (t) => {
  let duration = 89.9;
  const mockDocument = {
    createElement() {
      return {
        get duration() { return duration; },
        onloadedmetadata: null as (() => void) | null,
        removeAttribute() {},
        set src(_url: string) { queueMicrotask(() => this.onloadedmetadata?.()); },
      };
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: mockDocument });
  t.after(() => Reflect.deleteProperty(globalThis, 'document'));

  const evidence = video(9_999_999);
  await validateReportEvidenceFiles([evidence], 4, true);

  const [movWithoutMimeType, mp4WithGenericMimeType] = await validateReportEvidenceFiles([
    new File(['clip'], 'packing.MOV'),
    new File(['clip'], 'packing.mp4', { type: 'application/octet-stream' }),
  ], 3, true);
  assert.equal(movWithoutMimeType.type, 'video/quicktime');
  assert.equal(mp4WithGenericMimeType.type, 'video/mp4');
  await assert.rejects(validateReportEvidenceFiles([movWithoutMimeType], 0, false), /định dạng không được hỗ trợ/);

  duration = 90;
  await assert.rejects(validateReportEvidenceFiles([evidence], 4, true), /packing\.mp4.*ngắn hơn 90 giây/);
  await assert.rejects(validateReportEvidenceFiles([movWithoutMimeType], 4, true), /packing\.MOV.*ngắn hơn 90 giây/);
});
