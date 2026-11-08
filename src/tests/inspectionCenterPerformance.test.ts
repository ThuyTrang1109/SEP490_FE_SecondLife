import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCenterPricing } from '../services/inspectionCenterPricing';
import { getCenterTabDataNeeds } from '../utils/inspectionCenterData';
import type { InspectionFeeProposalResponse, PaginatedProposalResponse } from '../services/inspectorService';

type PricingSource = NonNullable<Parameters<typeof loadCenterPricing>[3]>;

const proposal = (id: string, status: string, complexityLevel?: 'L1' | 'L2' | 'L3' | 'L4'): InspectionFeeProposalResponse => ({
  id, status, complexityLevel, baseInspectionFee: 100000,
});

function historyPage(items: InspectionFeeProposalResponse[], totalElements = items.length, page = 0): PaginatedProposalResponse {
  return { items, totalElements, totalPages: Math.max(1, Math.ceil(totalElements / 10)), page, size: 10 };
}

function sourceFor(history = historyPage([]), pending: InspectionFeeProposalResponse[] = []) {
  const calls: { name: string; args: unknown[] }[] = [];
  const source: PricingSource = {
    async getTravelTiers() {
      calls.push({ name: 'tiers', args: [] });
      return [{ tierNumber: 1, name: '0–5 km', pricePerKm: 2000 }];
    },
    async getCurrentLevelFees() {
      calls.push({ name: 'fees', args: [] });
      return [proposal('current-L1', 'APPROVED', 'L1')];
    },
    async getTierProposals(...args) {
      calls.push({ name: 'history', args });
      return history;
    },
    async getCenterLevelFeeProposals(...args) {
      calls.push({ name: 'pending', args });
      return historyPage(pending);
    },
  };
  return { source, calls };
}

test('a complete first history page supplies pending level cards using three reads', async () => {
  const waitingL2 = proposal('waiting-L2', 'PENDING_APPROVAL', 'L2');
  const legacyWaitingL3 = proposal('waiting-L3', 'PENDING', 'L3');
  const page = historyPage([
    waitingL2, proposal('approved-L1', 'APPROVED', 'L1'),
    proposal('waiting-travel', 'PENDING_APPROVAL'), legacyWaitingL3,
  ]);
  const { source, calls } = sourceFor(page);

  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.deepEqual(calls.map((call) => call.name), ['tiers', 'fees', 'history']);
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waitingL2, legacyWaitingL3] });
  assert.deepEqual(result.history, { status: 'fulfilled', value: page });
});

test('an empty complete history page does not cause a redundant pending request', async () => {
  const { source, calls } = sourceFor();
  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.equal(calls.length, 3);
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [] });
});

test('an incomplete history page obtains pending cards independently of that page', async () => {
  const waitingL4 = proposal('older-waiting-L4', 'PENDING_APPROVAL', 'L4');
  const { source, calls } = sourceFor(
    historyPage([proposal('recent-approved-L1', 'APPROVED', 'L1')], 21),
    [waitingL4, proposal('waiting-travel', 'PENDING_APPROVAL')],
  );

  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.equal(calls.length, 4);
  const pendingCall = calls.find((call) => call.name === 'pending');
  assert.ok(pendingCall);
  assert.equal(pendingCall.args[0], 0);
  assert.equal(pendingCall.args[2], 'PENDING_APPROVAL');
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waitingL4] });
});

test('an approved-history filter does not erase pending level cards', async () => {
  const waitingL2 = proposal('waiting-L2', 'PENDING_APPROVAL', 'L2');
  const { source, calls } = sourceFor(historyPage([proposal('approved-L2', 'APPROVED', 'L2')]), [waitingL2]);

  const result = await loadCenterPricing(0, 'APPROVED', true, source);

  assert.deepEqual(calls.find((call) => call.name === 'history')?.args, ['APPROVED', 0, 10]);
  assert.equal(calls.filter((call) => call.name === 'pending').length, 1);
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waitingL2] });
});

test('a later history page is not treated as the complete pending-card snapshot', async () => {
  const waitingL1 = proposal('waiting-on-first-page', 'PENDING_APPROVAL', 'L1');
  const { source, calls } = sourceFor(historyPage([], 0, 2), [waitingL1]);

  const result = await loadCenterPricing(2, 'ALL', true, source);

  assert.equal(calls.filter((call) => call.name === 'pending').length, 1);
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waitingL1] });
});

test('changing the history filter or page makes only one history request', async () => {
  const page = historyPage([proposal('rejected', 'REJECTED', 'L4')], 41, 3);
  const { source, calls } = sourceFor(page);

  const result = await loadCenterPricing(3, 'REJECTED', false, source);

  assert.deepEqual(calls, [{ name: 'history', args: ['REJECTED', 3, 10] }]);
  assert.equal(result.pending, null, 'The caller must retain its existing pending-card snapshot.');
  assert.deepEqual(result.tiers, { status: 'fulfilled', value: null });
  assert.deepEqual(result.fees, { status: 'fulfilled', value: null });
  assert.deepEqual(result.history, { status: 'fulfilled', value: page });
});

test('a failed tier read preserves successful fees, history and pending cards', async () => {
  const error = new Error('Travel tiers temporarily unavailable');
  const waiting = proposal('waiting', 'PENDING_APPROVAL', 'L2');
  const { source } = sourceFor(historyPage([waiting]));
  source.getTravelTiers = async () => { throw error; };

  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.deepEqual(result.tiers, { status: 'rejected', reason: error });
  assert.equal(result.fees.status, 'fulfilled');
  assert.equal(result.history.status, 'fulfilled');
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waiting] });
});

test('a failed history read still loads the summary and independent pending cards', async () => {
  const error = new Error('History unavailable');
  const waiting = proposal('waiting', 'PENDING_APPROVAL', 'L3');
  const { source, calls } = sourceFor(historyPage([]), [waiting]);
  source.getTierProposals = async () => { throw error; };

  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.deepEqual(result.history, { status: 'rejected', reason: error });
  assert.equal(result.tiers.status, 'fulfilled');
  assert.equal(result.fees.status, 'fulfilled');
  assert.equal(calls.filter((call) => call.name === 'pending').length, 1);
  assert.deepEqual(result.pending, { status: 'fulfilled', value: [waiting] });
});

test('a failed pending-card read is reported separately from a successful history page', async () => {
  const error = new Error('Pending summary unavailable');
  const page = historyPage([proposal('approved', 'APPROVED', 'L1')], 20);
  const { source } = sourceFor(page);
  source.getCenterLevelFeeProposals = async () => { throw error; };

  const result = await loadCenterPricing(0, 'ALL', true, source);

  assert.deepEqual(result.pending, { status: 'rejected', reason: error });
  assert.deepEqual(result.history, { status: 'fulfilled', value: page });
  assert.equal(result.fees.status, 'fulfilled');
});

test('tiers, current fees and history start concurrently', async () => {
  const started: string[] = [];
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  const { source } = sourceFor();
  source.getTravelTiers = async () => { started.push('tiers'); await ready; return []; };
  source.getCurrentLevelFees = async () => { started.push('fees'); await ready; return []; };
  source.getTierProposals = async () => { started.push('history'); await ready; return historyPage([]); };

  const loading = loadCenterPricing(0, 'ALL', true, source);
  assert.deepEqual(started, ['tiers', 'fees', 'history']);
  release();
  await loading;
});

test('pricing and checklist tabs do not require operational order or staff reads', () => {
  for (const tab of ['pricing', 'checklists']) {
    assert.deepEqual(getCenterTabDataNeeds(tab), { orders: false, staff: false }, tab);
  }
});

test('operational tabs retain the data required for assignments and workload counts', () => {
  for (const tab of ['overview', 'dispatch', 'staff', 'orders']) {
    assert.deepEqual(getCenterTabDataNeeds(tab), { orders: true, staff: true }, tab);
  }
  assert.deepEqual(getCenterTabDataNeeds('appeals'), { orders: true, staff: false });
});
