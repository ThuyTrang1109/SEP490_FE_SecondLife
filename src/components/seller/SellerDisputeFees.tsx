import React, { useEffect, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Wallet
} from 'lucide-react';
import {
  returnShippingFeeService,
  type ReturnShippingDeduction,
  type ReturnShippingFeeResponse,
} from '../../services/returnShippingFeeService';
import { formatVND } from '../../utils/translations';

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING_FEE: {
    label: 'Chờ cước thực tế',
    className: 'bg-amber-50 text-amber-800 border-amber-300/80',
  },
  PAID: {
    label: 'Đã thu đủ',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300/80',
  },
  OUTSTANDING: {
    label: 'Còn nợ',
    className: 'bg-rose-50 text-rose-800 border-rose-300/80 font-black',
  },
};

interface Props {
  onOpenOrder?: (orderId: string) => void;
}

function FeeOrderLink({ orderId, onOpenOrder }: Props & { orderId: string }) {
  const shortId = '#' + orderId.slice(0, 8);
  if (!onOpenOrder) return <span className="font-mono font-bold text-slate-800">{shortId}</span>;

  return (
    <button
      type="button"
      onClick={() => onOpenOrder(orderId)}
      className="inline-flex items-center gap-1 font-mono font-bold text-xs text-[#c34c36] hover:text-[#a13c29] bg-orange-50/70 border border-orange-100 px-2 py-0.5 rounded-md hover:bg-orange-100/60 transition cursor-pointer"
      title="Xem chi tiết đơn hàng này"
    >
      <ShoppingBag className="h-3 w-3" />
      <span>{shortId}</span>
      <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-70" />
    </button>
  );
}

interface FeePaginationProps {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

function FeePagination({ page, totalPages, loading, onPageChange }: FeePaginationProps) {
  if (totalPages <= 1) return null;
  const buttonClass = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold transition';

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
      <div>Trang <strong className="text-slate-800">{page + 1}</strong> trên{' '}
        <strong className="text-slate-800">{totalPages}</strong>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page === 0} className={buttonClass}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Trang trước
        </button>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page + 1 >= totalPages} className={buttonClass}>
          Trang sau
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SellerDisputeFees({ onOpenOrder }: Props) {
  const [rows, setRows] = useState<ReturnShippingFeeResponse[]>([]);
  const [debt, setDebt] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<ReturnShippingDeduction[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      returnShippingFeeService.getMyFees(page, outstandingOnly),
      returnShippingFeeService.getMyDebt(),
    ])
      .then(([fees, summary]) => {
        if (!active) return;
        setRows(fees.items);
        setTotalPages(fees.totalPages);
        setDebt(summary.outstandingDebt);
        setPage(Math.min(page, Math.max(0, fees.totalPages - 1)));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được phí hoàn hàng.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, outstandingOnly, refresh]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    returnShippingFeeService.getMyDeductions(historyPage, outstandingOnly)
      .then((result) => {
        if (!active) return;
        setDeductions(result.items);
        setHistoryTotalPages(result.totalPages);
        setHistoryPage(Math.min(historyPage, Math.max(0, result.totalPages - 1)));
      })
      .catch((err: unknown) => {
        if (active) setHistoryError(err instanceof Error ? err.message : 'Không tải được lịch sử trừ phí.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyPage, outstandingOnly, refresh]);

  return (
    <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs text-sm text-slate-800 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Phí hoàn hàng và công nợ
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi cước trả hàng sau khiếu nại, công nợ và từng lần trừ phí qua ví
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            disabled={loading || historyLoading}
            onClick={() => setRefresh((value) => value + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Financial Metric Card: Total Debt */}
      {debt !== null && (
        <div className="mt-4">
          {debt === 0 ? (
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-emerald-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-900">Tổng nợ cước hoàn</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-0.5">
                    {formatVND(0)}
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-xs font-bold self-start sm:self-auto shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Đã thanh toán đủ • Không phát sinh công nợ</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-amber-50/40 to-rose-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-900">Tổng nợ cước hoàn chưa thanh toán</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 mt-0.5">
                    {formatVND(debt)}
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-bold self-start sm:self-auto shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Hệ thống tự thu khi ví có số dư</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setPage(0);
            setHistoryPage(0);
            setOutstandingOnly(!outstandingOnly);
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            outstandingOnly
              ? 'bg-[#24263e] text-white border-[#24263e] shadow-2xs'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Filter className={`w-3.5 h-3.5 ${outstandingOnly ? 'text-amber-300' : 'text-slate-500'}`} />
          <span>Chỉ hiện khoản còn nợ</span>
          {outstandingOnly && (
            <span className="w-2 h-2 rounded-full bg-amber-400 ml-0.5 animate-pulse" />
          )}
        </button>

        <span className="text-xs text-slate-400">
          Hiển thị các đơn hàng phát sinh cước hoàn trả
        </span>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Đang tải danh sách cước hoàn hàng...</span>
        </div>
      ) : error ? (
        <div className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-xl bg-[#faf8f5]/80 border border-dashed border-slate-200 mt-4">
          <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 shadow-2xs">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-700">Chưa có khoản phí hoàn hàng phù hợp</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {outstandingOnly
              ? 'Không có khoản nợ cước nào chưa thanh toán.'
              : 'Hiện tại bạn chưa phát sinh khoản hoàn hàng nào cần đối soát.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="bg-[#faf8f5] border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Đơn hàng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Cước thực tế</th>
                  <th className="px-4 py-3">Còn nợ</th>
                  <th className="px-4 py-3">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((fee) => {
                  const statusInfo = statusLabels[fee.status] || {
                    label: fee.status,
                    className: 'bg-slate-100 text-slate-700',
                  };
                  const isDebt = (fee.debtAmount ?? 0) > 0;

                  return (
                    <tr key={fee.shipmentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <FeeOrderLink orderId={fee.orderId} onOpenOrder={onOpenOrder} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {fee.feeAmount == null ? (
                          <span className="text-slate-400 font-normal italic">Chờ cập nhật</span>
                        ) : (
                          formatVND(fee.feeAmount)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {fee.debtAmount == null || fee.debtAmount === 0 ? (
                          <span className="text-emerald-700">0 đ</span>
                        ) : (
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {formatVND(fee.debtAmount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(fee.lastCollectedAt ?? fee.assessedAt ?? fee.createdAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FeePagination page={page} totalPages={totalPages} loading={loading} onPageChange={setPage} />

      <section className="mt-6 border-t border-slate-100 pt-4" aria-labelledby="seller-return-shipping-deductions">
        <h4 id="seller-return-shipping-deductions" className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Wallet className="h-4 w-4 text-emerald-700" />
          Lịch sử trừ phí hoàn hàng
        </h4>
        {historyLoading ? (
          <p role="status" className="py-3 text-xs text-slate-500">Đang tải lịch sử trừ phí...</p>
        ) : historyError ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{historyError}</p>
        ) : deductions.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            {outstandingOnly ? 'Chưa có lần trừ phí nào cho các đơn còn nợ.' : 'Chưa có lần trừ phí hoàn hàng nào.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b border-slate-200 bg-[#faf8f5] text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Đơn hàng</th>
                  <th scope="col" className="px-4 py-3">Số tiền đã trừ</th>
                  <th scope="col" className="px-4 py-3">Thời điểm trừ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {deductions.map((deduction) => (
                  <tr key={deduction.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3"><FeeOrderLink orderId={deduction.orderId} onOpenOrder={onOpenOrder} /></td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-700">{formatVND(-deduction.amount)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <time dateTime={deduction.deductedAt}>{new Date(deduction.deductedAt).toLocaleString('vi-VN')}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <FeePagination page={historyPage} totalPages={historyTotalPages} loading={historyLoading} onPageChange={setHistoryPage} />
      </section>
    </section>
  );
}
