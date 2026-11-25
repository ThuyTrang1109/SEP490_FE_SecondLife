export type ReportPeriod =
  | { kind: 'ALL' | '7D' | '30D' | '90D' }
  | { kind: 'MONTH'; month: string }
  | { kind: 'QUARTER'; quarter: number; year: string }
  | { kind: 'CUSTOM'; from: string; to: string };

interface ReportBounds {
  start: number;
  endExclusive: number;
}

export type ReportGrouping = 'day' | 'week' | 'month';

const dayMs = 86_400_000;
const vietnamOffsetMs = 7 * 60 * 60 * 1000;
const midnight = (year: number, monthIndex: number, day: number) => Date.UTC(year, monthIndex, day) - vietnamOffsetMs;

export function reportDateKey(timestamp: number): string {
  return new Date(timestamp + vietnamOffsetMs).toISOString().slice(0, 10);
}

function parseDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = midnight(year, month - 1, day);
  return reportDateKey(timestamp) === value ? timestamp : NaN;
}

// Undefined is all time. Null represents incomplete or invalid input.
export function reportPeriodBounds(period: ReportPeriod, now: number): ReportBounds | null | undefined {
  switch (period.kind) {
    case 'ALL': return undefined;
    case 'MONTH': {
      const start = parseDay(`${period.month}-01`);
      if (!Number.isFinite(start)) return null;
      const [year, month] = period.month.split('-').map(Number);
      return { start, endExclusive: midnight(year, month, 1) };
    }
    case 'QUARTER': {
      const { quarter } = period;
      if (!/^\d{4}$/.test(period.year) || Number(period.year) < 1000 || ![1, 2, 3, 4].includes(quarter)) return null;
      const year = Number(period.year);
      const monthIndex = (quarter - 1) * 3;
      return { start: midnight(year, monthIndex, 1), endExclusive: midnight(year, monthIndex + 3, 1) };
    }
    case 'CUSTOM': {
      const start = parseDay(period.from);
      const lastDay = parseDay(period.to);
      if (!Number.isFinite(start) || !Number.isFinite(lastDay) || lastDay < start) return null;
      return { start, endExclusive: lastDay + dayMs };
    }
    default: {
      const days = Number(period.kind.slice(0, -1));
      const endExclusive = parseDay(reportDateKey(now)) + dayMs;
      return { start: endExclusive - days * dayMs, endExclusive };
    }
  }
}

export function formatReportBounds(bounds: ReportBounds): string {
  const format = (ts: number) => reportDateKey(ts).split('-').reverse().join('/');
  return `${format(bounds.start)} – ${format(bounds.endExclusive - 1)}`;
}

export function isInReportPeriod(timestamp: number, bounds: ReportBounds | undefined): boolean {
  return !bounds || (timestamp >= bounds.start && timestamp < bounds.endExclusive);
}

export function reportGrouping(bounds: ReportBounds | undefined): ReportGrouping {
  if (!bounds) return 'day';
  const days = (bounds.endExclusive - bounds.start) / dayMs;
  return days <= 14 ? 'day' : days <= 56 ? 'week' : 'month';
}

export function reportBucket(timestamp: number, grouping: ReportGrouping) {
  const date = reportDateKey(timestamp);
  if (grouping === 'month') {
    return { sortKey: date.slice(0, 7), label: `${date.slice(5, 7)}/${date.slice(0, 4)}` };
  }
  const midnightMs = parseDay(date);
  const weekday = new Date(midnightMs + vietnamOffsetMs).getUTCDay();
  const sortKey = grouping === 'week' ? reportDateKey(midnightMs - ((weekday + 6) % 7) * dayMs) : date;
  return { sortKey, label: `${sortKey.slice(8, 10)}/${sortKey.slice(5, 7)}` };
}
