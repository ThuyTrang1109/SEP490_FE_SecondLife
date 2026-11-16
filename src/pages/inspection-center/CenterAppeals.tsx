import { CheckCircle2, Clock, Search, ShieldAlert, XCircle } from 'lucide-react';
import React, { type Dispatch, type SetStateAction } from 'react';
import { InspectionOrderDto } from '../../services';
import type { useCenterDispatchQueue } from './dispatch/useCenterDispatchQueue';
import type { useCenterOrders } from './orders/useCenterOrders';

interface Props {
  appealFilter: "PENDING_REVIEW" | "UPHELD" | "OVERTURNED" | "ALL";
  appealSearchTerm: string;
  orders: ReturnType<typeof useCenterOrders>['orders'];
  setAppealFilter: React.Dispatch<React.SetStateAction<"PENDING_REVIEW" | "UPHELD" | "OVERTURNED" | "ALL">>;
  setAppealSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setReviewingAppealOrder: React.Dispatch<React.SetStateAction<InspectionOrderDto | null>>;
  stats: ReturnType<typeof useCenterDispatchQueue>['stats'];
}

export function CenterAppeals({
  appealFilter,
  appealSearchTerm,
  orders,
  setAppealFilter,
  setAppealSearchTerm,
  setReviewingAppealOrder,
  stats,
}: Props) {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Quản Lý Khiếu Nại Kiểm Định Của Người Bán</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Xét duyệt các đơn khiếu nại kết quả FAILED trong thời hạn 24h. Bác bỏ (UPHELD) để giữ nguyên phạt hoặc Chấp thuận (OVERTURNED) để miễn trừ phạt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            {stats.pendingAppeals} Đơn Chờ Xét Duyệt
          </span>
        </div>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase">Tổng Khiếu Nại</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats.totalAppeals}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="text-xs font-bold text-amber-700 uppercase">Chờ Xét Duyệt</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.pendingAppeals}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-red-200 bg-red-50/30 shadow-xs">
          <div className="text-xs font-bold text-red-700 uppercase">Đã Bác Bỏ (UPHELD)</div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {orders.filter((o) => o.appealStatus === 'UPHELD').length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase">Chấp Thuận (OVERTURNED)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {orders.filter((o) => o.appealStatus === 'OVERTURNED').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING_REVIEW', 'UPHELD', 'OVERTURNED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setAppealFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${appealFilter === st
                ? 'bg-[#24263e] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {st === 'ALL'
                ? 'Tất Cả'
                : st === 'PENDING_REVIEW'
                  ? 'Chờ Duyệt'
                  : st === 'UPHELD'
                    ? 'Đã Bác Bỏ'
                    : 'Đã Chấp Thuận'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={appealSearchTerm}
            onChange={(e) => setAppealSearchTerm(e.target.value)}
            placeholder="Tìm theo sản phẩm, mã đơn..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#24263e]"
          />
        </div>
      </div>

      {/* Appeals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Đơn Hàng & Sản Phẩm</th>
                <th className="py-3 px-4">Người Bán</th>
                <th className="py-3 px-4">KTV & Đánh Giá</th>
                <th className="py-3 px-4">Lý Do Khiếu Nại</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {orders
                .filter((o) => {
                  const hasAppeal = (o.appealStatus && o.appealStatus !== 'NONE') || o.status === 'FAILED';
                  if (!hasAppeal) return false;
                  if (appealFilter !== 'ALL' && o.appealStatus !== appealFilter) return false;
                  if (appealSearchTerm) {
                    const term = appealSearchTerm.toLowerCase();
                    const matchTitle = (o.postTitle || '').toLowerCase().includes(term);
                    const matchId = (o.id || '').toLowerCase().includes(term);
                    const matchSeller = (o.sellerName || '').toLowerCase().includes(term);
                    return matchTitle || matchId || matchSeller;
                  }
                  return true;
                })
                .map((ord) => {
                  const isPending = ord.appealStatus === 'PENDING_REVIEW';
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ord.postTitle || 'Sản phẩm kiểm định'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">#{ord.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{ord.sellerName || 'Người bán'}</div>
                        {ord.sellerPhone && (
                          <div className="text-[11px] text-slate-400">{ord.sellerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800">{ord.inspectorName || 'KTV trạm'}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                          Score: {ord.conditionScore ?? 0}/100 ({ord.conditionGrade || 'POOR'})
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-600">
                          {ord.appealReason || (ord.status === 'FAILED' ? 'Chưa nộp đơn khiếu nại' : '-')}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {ord.appealStatus === 'PENDING_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 animate-spin" />
                            Chờ Xét Duyệt
                          </span>
                        ) : ord.appealStatus === 'UPHELD' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                            <XCircle className="w-3 h-3" />
                            Đã Bác Bỏ
                          </span>
                        ) : ord.appealStatus === 'OVERTURNED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã Chấp Thuận
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            {ord.status === 'FAILED' ? 'Chưa Khiếu Nại' : ord.appealStatus || 'Không có'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => setReviewingAppealOrder(ord)}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            Xét Duyệt Phán Quyết
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReviewingAppealOrder(ord)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                          >
                            Xem Chi Tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
