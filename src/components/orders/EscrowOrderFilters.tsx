import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import type { Language } from '../../types';
import { ORDER_FILTER_TABS, type OrderFilterTab } from '../../utils/escrowOrderFilters';

interface Props {
  lang: Language;
  active: OrderFilterTab;
  counts?: Record<OrderFilterTab, number>;
  search: string;
  searching: boolean;
  seller: boolean;
  loading: boolean;
  onFilter: (filter: OrderFilterTab) => void;
  onSearch: (search: string) => void;
  onRefresh?: () => void;
}

export function EscrowOrderFilters({
  lang, active, counts, search, searching, seller, loading, onFilter, onSearch, onRefresh,
}: Props) {
  const vi = lang === 'vi';
  const labels: Record<OrderFilterTab, string> = vi ? {
    all: 'Tất cả', awaiting_pickup: 'Chờ lấy hàng', inspecting: 'Đang xử lý kiểm định',
    shipping: 'Đang giao hàng', delivered: seller ? 'Đã giao (48h)' : 'Đã nhận hàng',
    completed: 'Hoàn thành', cancelled: 'Đã đóng / Hủy', disputed: 'Trả hàng / Tranh chấp',
    with_inspection: 'Có kiểm định',
  } : {
    all: 'All', awaiting_pickup: 'Awaiting pickup', inspecting: 'Inspection in progress',
    shipping: 'In delivery', delivered: seller ? 'Delivered (48h)' : 'Delivered',
    completed: 'Completed', cancelled: 'Closed / Cancelled', disputed: 'Returns / Disputes',
    with_inspection: 'With inspection',
  };
  return (
    <section aria-label={vi ? 'Lọc đơn hàng' : 'Filter orders'} aria-busy={loading || searching}
      className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-900">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-[#ad432f]" />
          {vi ? 'Lọc đơn hàng' : 'Filter orders'}
        </div>
        <div className="relative order-last w-full sm:order-none sm:min-w-56 sm:flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input type="search" value={search} maxLength={150} onChange={(event) => onSearch(event.target.value)}
            aria-label={vi ? 'Tìm đơn hàng' : 'Search orders'}
            placeholder={vi ? 'Mã đơn, tên sản phẩm hoặc đối tác' : 'Order ID, product or customer'}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-[#ad432f] focus:bg-white focus:ring-2 focus:ring-[#ad432f]/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" onClick={() => onSearch('')} aria-label={vi ? 'Xóa tìm kiếm' : 'Clear search'}
              className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[#ad432f]">
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh} disabled={loading || searching}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#ad432f] enabled:cursor-pointer disabled:opacity-60">
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {vi ? 'Làm mới' : 'Refresh'}
          </button>
        )}
      </div>
      <div role="group" aria-label={vi ? 'Trạng thái đơn hàng' : 'Order status'}
        className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
        {ORDER_FILTER_TABS.map((tab) => (
          <button key={tab} type="button" aria-pressed={active === tab} onClick={() => onFilter(tab)}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ad432f] sm:px-3 sm:text-sm ${
              active === tab ? 'border-[#ad432f]/25 bg-[#ad432f]/10 text-[#963a29]'
                : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-slate-100'
            }`}>
            {tab === 'with_inspection' && <ShieldCheck aria-hidden="true" className="size-4" />}
            {labels[tab]}
            {counts && (
              <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums ${
                active === tab ? 'bg-white text-[#963a29]' : 'bg-white text-slate-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function EscrowOrderPagination({ lang, page, size, totalPages, total, onPage }: {
  lang: Language; page: number; size: number; totalPages: number; total: number; onPage: (page: number) => void;
}) {
  const vi = lang === 'vi';
  const range = `${page * size + 1}–${Math.min((page + 1) * size, total)} / ${total}`;
  return (
    <nav aria-label={vi ? 'Phân trang đơn hàng' : 'Order pagination'}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <span className="tabular-nums">{range} {vi ? 'đơn' : 'orders'}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0}
          aria-label={vi ? 'Trang trước' : 'Previous page'}
          className="grid size-9 place-items-center rounded-lg border border-slate-200 enabled:cursor-pointer enabled:hover:bg-slate-50 disabled:opacity-40">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <span className="px-1 tabular-nums">{vi ? 'Trang' : 'Page'} {page + 1} / {totalPages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages}
          aria-label={vi ? 'Trang sau' : 'Next page'}
          className="grid size-9 place-items-center rounded-lg border border-slate-200 enabled:cursor-pointer enabled:hover:bg-slate-50 disabled:opacity-40">
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </nav>
  );
}
