import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReportBounds, isInReportPeriod, reportBucket, reportGrouping, reportPeriodBounds } from '../utils/adminReportPeriod';

const now = Date.parse('2026-11-23T18:00:00Z');

test('a month uses midnight in Vietnam at both bounds and includes leap day', () => {
  const bounds = reportPeriodBounds({ kind: 'MONTH', month: '2024-02' }, now);
  assert.ok(bounds);
  assert.equal(formatReportBounds(bounds), '01/02/2024 – 29/02/2024');
  assert.equal(isInReportPeriod(Date.parse('2024-01-31T16:59:59.999Z'), bounds), false);
  assert.equal(isInReportPeriod(Date.parse('2024-01-31T17:00:00Z'), bounds), true);
  assert.equal(isInReportPeriod(Date.parse('2024-02-29T16:59:59.999Z'), bounds), true);
  assert.equal(isInReportPeriod(Date.parse('2024-02-29T17:00:00Z'), bounds), false);
});

test('a quarter includes its three calendar months and can cross the year boundary', () => {
  const bounds = reportPeriodBounds({ kind: 'QUARTER', quarter: 4, year: '2026' }, now);
  assert.ok(bounds);
  assert.equal(formatReportBounds(bounds), '01/10/2026 – 31/12/2026');
  assert.equal(reportGrouping(bounds), 'month');
  assert.equal(isInReportPeriod(Date.parse('2026-12-31T17:00:00Z'), bounds), false);
});

test('custom selection includes the end date and rejects invalid or reversed days', () => {
  const bounds = reportPeriodBounds({ kind: 'CUSTOM', from: '2026-11-24', to: '2026-11-24' }, now);
  assert.ok(bounds);
  assert.equal(isInReportPeriod(now, bounds), true);
  assert.equal(isInReportPeriod(Date.parse('2026-11-24T17:00:00Z'), bounds), false);
  assert.equal(isInReportPeriod(0, bounds), false);
  assert.equal(reportPeriodBounds({ kind: 'CUSTOM', from: '2026-11-25', to: '2026-11-24' }, now), null);
  assert.equal(reportPeriodBounds({ kind: 'CUSTOM', from: '2026-02-30', to: '2026-03-01' }, now), null);
});

test('rolling days include today in Vietnam even if it is still yesterday in UTC', () => {
  const bounds = reportPeriodBounds({ kind: '7D' }, now);
  assert.ok(bounds);
  assert.equal(formatReportBounds(bounds), '18/11/2026 – 24/11/2026');
  assert.equal(reportPeriodBounds({ kind: 'ALL' }, now), undefined);
});

test('trend groups use the same timezone for day, Monday week, and month buckets', () => {
  const ts = Date.parse('2026-11-30T17:00:00Z');
  assert.deepEqual(reportBucket(ts, 'day'), { sortKey: '2026-12-01', label: '01/12' });
  assert.deepEqual(reportBucket(ts, 'week'), { sortKey: '2026-11-30', label: '30/11' });
  assert.deepEqual(reportBucket(ts, 'month'), { sortKey: '2026-12', label: '12/2026' });
});
