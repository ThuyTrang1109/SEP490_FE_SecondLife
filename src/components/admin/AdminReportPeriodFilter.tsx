import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Language } from '../../types';
import { reportDateKey, reportPeriodBounds, type ReportPeriod } from '../../utils/adminReportPeriod';

interface Props {
  lang: Language;
  now: number;
  appliedLabel: string;
  onApply: (period: ReportPeriod) => void;
}

const quarters = [1, 2, 3, 4];
const options = [
  ['ALL', 'Toàn thời gian', 'All time'],
  ['7D', '7 ngày gần nhất', 'Last 7 days'],
  ['30D', '30 ngày gần nhất', 'Last 30 days'],
  ['90D', '90 ngày gần nhất', 'Last 90 days'],
  ['MONTH', 'Theo tháng', 'By month'],
  ['QUARTER', 'Theo quý', 'By quarter'],
  ['CUSTOM', 'Khoảng ngày', 'Date range'],
] as const;

const fieldClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:border-[#c34c36] focus:outline-none';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-slate-600';

export function AdminReportPeriodFilter({ lang, now, appliedLabel, onApply }: Props) {
  const [draft, setDraft] = useState<ReportPeriod>({ kind: 'ALL' });
  const vi = lang === 'vi';
  const invalid = reportPeriodBounds(draft, now) === null;

  function selectKind(kind: ReportPeriod['kind']) {
    const today = reportDateKey(now);
    const month = today.slice(0, 7);
    switch (kind) {
      case 'MONTH':
        setDraft({ kind, month });
        break;
      case 'QUARTER':
        setDraft({ kind, year: today.slice(0, 4), quarter: Math.ceil(Number(today.slice(5, 7)) / 3) });
        break;
      case 'CUSTOM':
        setDraft({ kind, from: `${month}-01`, to: today });
        break;
      default:
        setDraft({ kind });
    }
  }

  return (
    <form
      aria-label={vi ? 'Lọc báo cáo theo thời gian' : 'Filter report by date'}
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onApply(draft);
      }}
      className="flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-slate-100 pt-3"
    >
      <label className={labelClass}>
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {vi ? 'Kỳ báo cáo' : 'Reporting period'}
        </span>
        <select value={draft.kind} onChange={(event) => selectKind(event.target.value as ReportPeriod['kind'])} className={fieldClass}>
          {options.map(([kind, viLabel, enLabel]) => <option key={kind} value={kind}>{vi ? viLabel : enLabel}</option>)}
        </select>
      </label>
      {draft.kind === 'MONTH' && (
        <label className={labelClass}>
          {vi ? 'Tháng' : 'Month'}
          <input type="month" required value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} className={fieldClass} />
        </label>
      )}
      {draft.kind === 'QUARTER' && (
        <>
          <label className={labelClass}>
            {vi ? 'Quý' : 'Quarter'}
            <select value={draft.quarter} onChange={(event) => setDraft({ ...draft, quarter: Number(event.target.value) })} className={fieldClass}>
              {quarters.map((quarter) => <option value={quarter} key={quarter}>{vi ? 'Quý' : 'Q'} {quarter}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            {vi ? 'Năm' : 'Year'}
            <input type="number" min={1000} max={9999} step={1} required value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} className={`${fieldClass} w-24`} />
          </label>
        </>
      )}
      {draft.kind === 'CUSTOM' && (
        <>
          <label className={labelClass}>
            {vi ? 'Từ ngày' : 'From'}
            <input type="date" required value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className={fieldClass} />
          </label>
          <label className={labelClass}>
            {vi ? 'Đến ngày' : 'To'}
            <input type="date" required value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className={fieldClass} />
          </label>
        </>
      )}
      <button type="submit" disabled={invalid} className="h-9 rounded-lg bg-[#24263e] px-3 text-xs font-bold text-white hover:bg-black disabled:opacity-50">
        {vi ? 'Áp dụng' : 'Apply'}
      </button>
      <p className="pb-2 text-xs text-slate-600" aria-live="polite">{vi ? 'Đang xem' : 'Showing'} <strong>{appliedLabel}</strong></p>
      {invalid && (
        <p role="alert" className="basis-full text-xs font-semibold text-rose-700">
          {vi ? 'Chọn kỳ hợp lệ. Ngày kết thúc phải từ ngày bắt đầu trở đi.' : 'Choose a valid period. The end date must be on or after the start date.'}
        </p>
      )}
    </form>
  );
}
