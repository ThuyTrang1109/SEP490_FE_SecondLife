import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import {
  adminCommissionService,
  type CommissionAuditResponse,
  type CommissionAuditSnapshot,
  type CommissionRuleResponse,
} from '../../services/adminCommissionService';
import type { PageResponse } from '../../services/apiClient';

const PAGE_SIZE = 10;
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 4 });
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const actionLabels: Partial<Record<string, string>> = {
  CREATE: 'Tạo quy tắc mới',
  UPDATE: 'Cập nhật quy tắc',
  DEACTIVATE: 'Tạm ngưng quy tắc',
};

function readStoredSnapshot(value?: string | null): CommissionAuditSnapshot | null {
  if (!value) return null;
  try {
    const snapshot = JSON.parse(value);
    return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

const fields: { label: string; format: (snapshot: CommissionAuditSnapshot | null) => string }[] = [
  { label: 'Tên chính sách', format: (snapshot) => snapshot?.name || '—' },
  { label: 'Tỷ lệ hoa hồng', format: (snapshot) => (snapshot?.rate == null ? '—' : percent.format(snapshot.rate)) },
  { label: 'Mức thu tối thiểu', format: (snapshot) => (snapshot?.minCommission == null ? '—' : money.format(snapshot.minCommission)) },
  {
    label: 'Trần hoa hồng',
    format: (snapshot) => (!snapshot ? '—' : snapshot.maxCommission == null ? 'Không giới hạn' : money.format(snapshot.maxCommission)),
  },
  { label: 'Trạng thái', format: (snapshot) => (snapshot?.active == null ? '—' : snapshot.active ? 'Đang dùng' : 'Tạm ngưng') },
  { label: 'Phiên bản', format: (snapshot) => (snapshot?.revision == null ? '—' : `r${snapshot.revision}`) },
];

function HistoryEntry({ audit }: { audit: CommissionAuditResponse }) {
  const before = audit.before ?? readStoredSnapshot(audit.oldValue);
  const after =
    audit.after ??
    readStoredSnapshot(audit.newValue) ??
    (audit.rate != null || audit.revision != null ? audit : null);
  const actorId = audit.actorId || audit.changedBy;
  const actorName = audit.actorName?.trim();
  const timestamp = audit.changedAt || audit.createdAt;
  const timeLabel = timestamp && Number.isFinite(Date.parse(timestamp)) ? dateTime.format(new Date(timestamp)) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
      <header className="space-y-1.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                audit.action === 'CREATE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : audit.action === 'DEACTIVATE'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {actionLabels[audit.action] || 'Thay đổi quy tắc'}
            </span>
            <span className="font-bold text-xs text-slate-800 font-mono">
              #{audit.id?.slice?.(0, 8) || audit.id}
            </span>
          </div>
          {timeLabel && (
            <time dateTime={timestamp} className="text-xs text-slate-500 font-medium">
              {timeLabel} (GMT+7)
            </time>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
          <div>
            <span className="font-medium text-slate-500">Người thực hiện:</span>{' '}
            <span className="font-bold text-slate-800">{actorName || 'Quản trị viên'}</span>
            {actorId && (
              <span className="ml-1 font-mono text-[11px] text-slate-400" title={`ID: ${actorId}`}>
                ({actorId.slice(0, 8)})
              </span>
            )}
          </div>
          {audit.reason && (
            <div>
              <span className="font-medium text-slate-500">Lý do:</span>{' '}
              <span className="font-medium text-slate-800 italic">"{audit.reason}"</span>
            </div>
          )}
        </div>
      </header>
      {before || after ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/40">
              <tr className="border-b border-slate-100">
                <th scope="col" className="w-[30%] px-4 py-2">Nội dung</th>
                <th scope="col" className="w-[35%] px-4 py-2">Trước thay đổi</th>
                <th scope="col" className="w-[35%] px-4 py-2">Sau thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map(({ label, format }) => {
                const oldText = format(before);
                const newText = format(after);
                const changed = before && after && oldText !== newText;
                return (
                  <tr key={label} className={changed ? 'bg-amber-50/30' : undefined}>
                    <td className="px-4 py-2 font-medium text-slate-600">{label}</td>
                    <td className="px-4 py-2 text-slate-600">{oldText}</td>
                    <td className={`px-4 py-2 ${changed ? 'font-bold text-[#ad432f]' : 'text-slate-800'}`}>
                      {newText}
                      {changed && <span className="ml-1.5 text-[10px] text-[#ad432f] font-normal">(Thay đổi)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-slate-500 italic">Chưa có dữ liệu cấu hình chi tiết cho bản ghi này.</p>
      )}
    </article>
  );
}

interface CommissionHistorySectionProps {
  rule: CommissionRuleResponse;
  allRules?: CommissionRuleResponse[];
  onSelectRule?: (rule: CommissionRuleResponse) => void;
}

export function CommissionHistorySection({ rule, allRules, onSelectRule }: CommissionHistorySectionProps) {
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PageResponse<CommissionAuditResponse> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset page when rule changes
  useEffect(() => {
    setPage(0);
  }, [rule.id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const data = await adminCommissionService.getCommissionRuleHistory(rule.id, page, PAGE_SIZE, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử hoa hồng.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [rule.id, page, attempt]);

  const requestPage = (nextPage: number) => {
    setLoading(true);
    setError(null);
    if (nextPage === page) setAttempt((previous) => previous + 1);
    else setPage(nextPage);
  };

  return (
    <div
      id="commission-history-section"
      aria-labelledby="commission-history-title"
      className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#c34c36]/10 text-[#ad432f]">
            <History aria-hidden="true" className="w-5 h-5" />
          </div>
          <div>
            <h3 id="commission-history-title" className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Lịch sử thay đổi quy tắc hoa hồng</span>
              {result?.totalElements !== undefined && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {result.totalElements} lần thay đổi
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Chính sách đang xem: <strong className="text-slate-800">{rule.name}</strong> (Phiên bản r{rule.revision})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {allRules && allRules.length > 1 && onSelectRule && (
            <select
              value={rule.id}
              onChange={(e) => {
                const selected = allRules.find((r) => r.id === e.target.value);
                if (selected) onSelectRule(selected);
              }}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:border-[#c34c36] cursor-pointer"
              title="Chọn chính sách để xem lịch sử"
            >
              {allRules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (r{r.revision}) {r.active ? '• Đang dùng' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => requestPage(page)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
            title="Tải lại lịch sử thay đổi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ad432f]' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin text-[#ad432f]" />
          <span>Đang tải lịch sử thay đổi...</span>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => requestPage(page)} className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer">
            Thử lại
          </button>
        </div>
      ) : result?.items.length ? (
        <div className="space-y-3">
          {result.items.map((audit) => (
            <HistoryEntry key={audit.id} audit={audit} />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-slate-400 space-y-2">
          <History className="w-8 h-8 mx-auto stroke-1 opacity-50 text-slate-400" />
          <p className="text-xs font-semibold text-slate-500">Chưa có bản ghi lịch sử thay đổi nào</p>
          <p className="text-[11px] text-slate-400">
            Mọi lần cập nhật hoặc tạm ngưng quy tắc này sẽ được lưu vết kiểm toán tại đây.
          </p>
        </div>
      )}

      {result && result.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="text-[11px] text-slate-500 font-medium">
            Hiển thị trang <strong className="text-slate-700">{page + 1}</strong> / <strong className="text-slate-700">{result.totalPages}</strong> ({result.totalElements} lần thay đổi)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => requestPage(page - 1)}
              disabled={loading || page === 0}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: result.totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => requestPage(i)}
                disabled={loading}
                className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  i === page
                    ? 'bg-[#24263e] text-white'
                    : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => requestPage(page + 1)}
              disabled={loading || page + 1 >= result.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
