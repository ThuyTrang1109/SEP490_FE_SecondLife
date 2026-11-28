import React from 'react';
import { History, ArrowRight } from 'lucide-react';
import { BankAccountHistoryItem } from '../../services/walletService';

interface ActionMeta {
  label: string;
  badgeClass: string;
  dotClass: string;
}

function getBankHistoryActionMeta(action?: string | null): ActionMeta {
  switch ((action || '').trim().toUpperCase()) {
    case 'CREATED':
      return {
        label: 'Thiết lập lần đầu',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 ring-emerald-100',
      };
    case 'REPLACED':
      return {
        label: 'Đổi sang tài khoản mới',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
        dotClass: 'bg-sky-500 ring-sky-100',
      };
    case 'UPDATED':
      return {
        label: 'Cập nhật tài khoản',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dotClass: 'bg-indigo-500 ring-indigo-100',
      };
    case 'DELETED':
      return {
        label: 'Xóa tài khoản',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500 ring-rose-100',
      };
    case 'MIGRATION_BACKFILL':
      return {
        label: 'Đồng bộ từ lịch sử rút tiền',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400 ring-slate-100',
      };
    default:
      return {
        label: action || 'Cập nhật tài khoản',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400 ring-slate-100',
      };
  }
}

interface BankAccountHistoryTimelineProps {
  items: BankAccountHistoryItem[];
  onCollapse?: () => void;
  maxHeightClass?: string;
}

export const BankAccountHistoryTimeline: React.FC<BankAccountHistoryTimelineProps> = ({
  items,
  onCollapse,
  maxHeightClass = 'max-h-64',
}) => {
  const sortedItems = React.useMemo(() => {
    return items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        const tA = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
        const tB = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
        if (tB !== tA) return tB - tA;
        return a.originalIndex - b.originalIndex;
      })
      .map((entry) => entry.item);
  }, [items]);

  if (sortedItems.length === 0) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <History className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="text-xs font-extrabold text-slate-900 truncate">
            Lịch sử thay đổi tài khoản ngân hàng
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-bold shrink-0">
            {sortedItems.length}
          </span>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
          >
            Thu gọn
          </button>
        )}
      </div>

      <div className={`${maxHeightClass} overflow-y-auto pr-1`}>
        <div className="relative pl-5 space-y-2.5">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"
            aria-hidden="true"
          />
          {sortedItems.map((h, idx) => {
            const meta = getBankHistoryActionMeta(h.action);
            const isLatest = idx === 0;
            const hasPrev = Boolean(h.previousAccountNumber);
            const hasNext = Boolean(h.accountNumber);

            return (
              <div key={h.id || `${h.createdAt}-${idx}`} className="relative">
                <span
                  className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full ring-4 ${meta.dotClass}`}
                />
                <div
                  className={`p-3 rounded-xl bg-white border space-y-2 ${
                    isLatest ? 'border-[#24263e]/25 shadow-2xs' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      {isLatest && (
                        <span className="px-1.5 py-0.5 rounded bg-[#24263e] text-white text-[9.5px] font-bold">
                          Mới nhất
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] font-mono text-slate-400 shrink-0">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    {hasPrev && (
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 space-y-0.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          Tài khoản cũ
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600">
                          <span className="font-bold text-slate-700">
                            {h.previousBankName || h.previousBankCode}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {h.previousAccountNumber}
                          </span>
                        </div>
                        {h.previousAccountHolderName && (
                          <div className="text-[10.5px] text-slate-500 uppercase font-medium">
                            {h.previousAccountHolderName}
                          </div>
                        )}
                      </div>
                    )}

                    {hasPrev && hasNext && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 pl-1">
                        <ArrowRight className="w-3 h-3 text-emerald-600" />
                        <span>Chuyển sang</span>
                      </div>
                    )}

                    {hasNext && (
                      <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-0.5">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                          Tài khoản áp dụng
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-emerald-950">
                          <span className="font-extrabold">
                            {h.bankName || h.bankCode}
                          </span>
                          <span className="text-emerald-300">·</span>
                          <span className="font-mono font-black">
                            {h.accountNumber}
                          </span>
                        </div>
                        {h.accountHolderName && (
                          <div className="text-[10.5px] text-emerald-900 uppercase font-bold">
                            {h.accountHolderName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
