import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInspectionReportFromDto } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionOrderDto } from '../services/inspectorService';

test('buildInspectionReportFromDto converts FAILED InspectionOrderDto accurately without mock data', () => {
  const dto: InspectionOrderDto = {
    id: 'ba005630-98bf-4e3c-9887-4eb5adb36a7a',
    postId: 'post-123',
    status: 'FAILED',
    conditionScore: 63,
    conditionGrade: 'POOR',
    inspectorName: 'Kiem Dinh Vien 1',
    note: 'Sản phẩm không đạt chuẩn kiểm định. Bếp từ nứt vỡ mặt kính.',
    evidencePhotoUrls: ['https://res.cloudinary.com/demo/image1.jpg'],
    checklistResultJson: JSON.stringify([
      { itemId: 'chk-1', itemTitle: 'Kiểm tra ngoại quan mặt kính', passed: false, inspectorNote: 'Kính nứt 5cm' },
      { itemId: 'chk-2', itemTitle: 'Kiểm tra mâm nhiệt', passed: true, inspectorNote: 'Hoạt động tốt' },
    ]),
  };

  const report = buildInspectionReportFromDto(dto);

  assert.equal(report.orderId, 'ba005630-98bf-4e3c-9887-4eb5adb36a7a');
  assert.equal(report.verdict, 'FAIL');
  assert.equal(report.status, 'FAILED');
  assert.equal(report.conditionScore, 63);
  assert.equal(report.inspectorName, 'Kiem Dinh Vien 1');
  assert.equal(report.summaryNotes, 'Sản phẩm không đạt chuẩn kiểm định. Bếp từ nứt vỡ mặt kính.');
  assert.equal(report.checklistResults.length, 2);
  assert.equal(report.checklistResults[0].passed, false);
  assert.equal(report.checklistResults[0].inspectorNote, 'Kính nứt 5cm');
  assert.equal(report.checklistResults[1].passed, true);
  assert.deepEqual(report.evidencePhotoUrls, ['https://res.cloudinary.com/demo/image1.jpg']);
});

test('buildInspectionReportFromDto returns empty checklist when checklistResultJson is not present (no mock data injection)', () => {
  const dto: InspectionOrderDto = {
    id: 'ba005630-98bf-4e3c-9887-4eb5adb36a7a',
    postId: 'post-123',
    status: 'FAILED',
    conditionScore: 50,
    note: 'Đơn từ chối kiểm định',
  };

  const report = buildInspectionReportFromDto(dto);

  assert.equal(report.verdict, 'FAIL');
  assert.equal(report.status, 'FAILED');
  assert.deepEqual(report.checklistResults, []);
});

test('buildInspectionReportFromDto handles PASSED InspectionOrderDto correctly', () => {
  const dto: any = {
    id: 'order-pass-123',
    postId: 'post-456',
    status: 'PASSED',
    conditionScore: 92,
    conditionGrade: 'EXCELLENT',
    inspectorName: 'KTV Nguyen Van A',
    checklistResults: [
      { itemId: '1', itemTitle: 'Ngoại quan', passed: true },
    ],
  };

  const report = buildInspectionReportFromDto(dto);

  assert.equal(report.verdict, 'PASS');
  assert.equal(report.status, 'PASSED');
  assert.equal(report.conditionScore, 92);
  assert.equal(report.checklistResults.length, 1);
});

test('center certificates preserve the published result after inspection', () => {
  const order = { id: 'order-1', postId: 'post-1' };

  for (const status of ['DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER', 'COMPLETED']) {
    const report = buildInspectionReportFromDto({ ...order, status, conditionScore: 92 });
    assert.equal(report.verdict, 'PASS');
    assert.equal(report.status, status);
  }

  const failed = buildInspectionReportFromDto({ ...order, status: 'FAILED', conditionScore: 0 });
  assert.equal(failed.verdict, 'FAIL');
  assert.equal(failed.conditionScore, 0);
});

