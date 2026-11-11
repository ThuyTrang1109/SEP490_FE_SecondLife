import assert from 'node:assert/strict';
import test from 'node:test';
import { getInspectionTaskResult, getInspectionTaskStage } from '../utils/inspectionTaskStatus';

test('assigned and active inspection tasks do not receive a report from a null or draft score', () => {
  assert.equal(getInspectionTaskStage('DISPATCHED'), 'assigned');
  assert.equal(getInspectionTaskStage('SCHEDULED'), 'assigned');
  assert.equal(getInspectionTaskStage('INSPECTING'), 'inspecting');
  assert.equal(getInspectionTaskResult({ status: 'DISPATCHED', conditionScore: null }), null);
  assert.equal(getInspectionTaskResult({ status: 'INSPECTING', conditionScore: 91 }), null);
});

test('the inbound wait is limited to orders shipping to the Hub', () => {
  assert.equal(getInspectionTaskStage('SHIPPING_TO_CENTER'), 'inbound');
  assert.equal(getInspectionTaskStage('CONFIRMED_PENDING_DISPATCH'), 'pending');
  assert.equal(getInspectionTaskStage('RECEIVED_AT_CENTER'), 'assigned');
  assert.equal(getInspectionTaskStage('DELIVERING_TO_BUYER'), 'completed');
});

test('final inspection reports preserve the verdict, including a zero score', () => {
  assert.deepEqual(getInspectionTaskResult({ status: 'PASSED', conditionScore: 91 }), { verdict: 'PASS', conditionScore: 91 });
  assert.deepEqual(getInspectionTaskResult({ status: 'FAILED', conditionScore: 0 }), { verdict: 'FAIL', conditionScore: 0 });
  assert.deepEqual(getInspectionTaskResult({ status: 'DELIVERING_TO_BUYER', conditionScore: 91 }), { verdict: 'PASS', conditionScore: 91 });
  assert.equal(getInspectionTaskResult({ status: 'PASSED', conditionScore: null }), null);
  assert.equal(getInspectionTaskResult({ status: 'CANCELLED', conditionScore: null }), null);
  assert.deepEqual(getInspectionTaskResult({
    status: 'CANCELLED', conditionScore: 91, finalPaymentDeadline: '2026-11-09T16:00:00Z',
  }), { verdict: 'PASS', conditionScore: 91 });
});
