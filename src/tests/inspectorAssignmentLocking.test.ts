import assert from 'node:assert/strict';
import test from 'node:test';
import { isOrderConfirmedByInspector, isInspectorAssignmentLocked } from '../utils/inspectionCenterData';

test('isOrderConfirmedByInspector returns true when backend sends inspectorConfirmed = true even for DISPATCHED / SCHEDULED', () => {
  const orderDispatched = {
    id: 'ord-123',
    inspectorId: 'insp-001',
    status: 'DISPATCHED',
    inspectorConfirmed: true,
  };
  assert.equal(isOrderConfirmedByInspector(orderDispatched), true);
  assert.equal(isInspectorAssignmentLocked(orderDispatched), true);

  const orderScheduled = {
    id: 'ord-456',
    inspectorId: 'insp-002',
    status: 'SCHEDULED',
    inspectorConfirmed: true,
  };
  assert.equal(isOrderConfirmedByInspector(orderScheduled), true);
  assert.equal(isInspectorAssignmentLocked(orderScheduled), true);
});

test('isOrderConfirmedByInspector returns true when backend sends assignmentLocked or inspectorConfirmedAt', () => {
  const orderWithLock = {
    id: 'ord-789',
    inspectorId: 'insp-001',
    status: 'DISPATCHED',
    assignmentLocked: true,
  };
  assert.equal(isOrderConfirmedByInspector(orderWithLock as any), true);
  assert.equal(isInspectorAssignmentLocked(orderWithLock as any), true);

  const orderWithTimestamp = {
    id: 'ord-101',
    inspectorId: 'insp-001',
    status: 'SCHEDULED',
    inspectorConfirmedAt: '2026-11-18T10:00:00Z',
  };
  assert.equal(isOrderConfirmedByInspector(orderWithTimestamp as any), true);
  assert.equal(isInspectorAssignmentLocked(orderWithTimestamp as any), true);
});

test('isOrderConfirmedByInspector returns false when inspector is assigned but has NOT yet confirmed and not locked', () => {
  const orderPending = {
    id: 'ord-202',
    inspectorId: 'insp-001',
    status: 'DISPATCHED',
    inspectorConfirmed: false,
  };
  assert.equal(isOrderConfirmedByInspector(orderPending), false);
  assert.equal(isInspectorAssignmentLocked(orderPending), false);
});

test('isOrderConfirmedByInspector returns true for inspection in progress or completed statuses', () => {
  assert.equal(isOrderConfirmedByInspector({ id: 'ord-301', inspectorId: 'insp-1', status: 'INSPECTING' }), true);
  assert.equal(isOrderConfirmedByInspector({ id: 'ord-302', inspectorId: 'insp-1', status: 'INSPECTION_IN_PROGRESS' }), true);
  assert.equal(isOrderConfirmedByInspector({ id: 'ord-303', inspectorId: 'insp-1', status: 'PASSED' }), true);
  assert.equal(isOrderConfirmedByInspector({ id: 'ord-304', inspectorId: 'insp-1', status: 'FAILED' }), true);
  assert.equal(isOrderConfirmedByInspector({ id: 'ord-305', inspectorId: 'insp-1', status: 'COMPLETED' }), true);
});
