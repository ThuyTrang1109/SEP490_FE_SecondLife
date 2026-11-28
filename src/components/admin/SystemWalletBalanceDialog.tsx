import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  systemWalletService,
  type SystemWalletBalanceDetails,
  type SystemWalletBalanceFund,
} from '../../services/systemWalletService';
import { formatVND } from '../../utils/translations';

interface Props {
  fund: SystemWalletBalanceFund;
  onClose: () => void;
  onViewHistory: (orderId?: string) => void;
}

export function SystemWalletBalanceDialog({ fund, onClose, onViewHistory }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const [details, setDetails] = useState<SystemWalletBalanceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const isShipping = fund === 'SHIPPING';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDetails(null);
    setError(null);
    systemWalletService.getBalanceDetails(fund, page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(0, result.entries.totalPages - 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setDetails(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Không tải được chi tiết đối soát số dư.');
      });
    return () => controller.abort();
  }, [fund, page, retry]);

  const figures = details && [
    { label: 'Số dư ví hệ thống', amount: details.balance },
    ...(isShipping ? [
      { label: 'Cộng vào quỹ cước', amount: details.credited ?? 0 },
      { label: 'Trừ khỏi quỹ cước', amount: details.debited ?? 0 },
    ] : []),
    { label: isShipping ? 'Tổng cước ròng theo sổ' : 'Tổng tiền còn giữ theo đơn', amount: details.recordsTotal },
  ];
  const difference = details ? Number(details.balance) - Number(details.recordsTotal) : 0;
  const controlStyle = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="wallet-balance-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-5xl overflow-auto rounded-2xl bg-white text-slate-800 shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 id="wallet-balance-title" className="text-base font-bold text-slate-950">
            {isShipping ? 'Đối soát số dư quỹ cước' : 'Đối soát tiền hàng đang giữ'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {isShipping
              ? 'Cước ròng bằng tổng bút toán cộng vào quỹ trừ tổng bút toán trừ khỏi quỹ, gồm đơn mua bán và đơn kiểm định.'
              : 'Cộng số tiền hàng còn giữ trong Escrow của từng đơn mua bán.'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng đối soát" className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm text-rose-700">
          {error}
          <button type="button" onClick={() => setRetry((value) => value + 1)} className={controlStyle}>Thử lại</button>
        </div>
      ) : !details ? (
        <p role="status" className="p-5 text-sm text-slate-500">Đang tải dữ liệu đối soát…</p>
      ) : (
        <div className="space-y-4 p-5">
          <dl className={'grid grid-cols-2 gap-2 ' + (isShipping ? 'sm:grid-cols-4' : '')}>
            {figures?.map(({ label, amount }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs font-semibold text-slate-600">{label}</dt>
                <dd className="mt-1 font-mono text-sm font-bold text-slate-900 sm:text-base">{formatVND(amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <p className={difference === 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
              {difference === 0 ? 'Khớp số dư ví · Chênh lệch 0 ₫' : 'Chênh lệch giữa số dư ví và dữ liệu theo đơn ' + formatVND(difference)}
            </p>
            <p className="text-slate-500">Ví cập nhật lúc {new Date(details.updatedAt).toLocaleString('vi-VN')}</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Mã đơn</th>
                  {isShipping && <th scope="col" className="px-3 py-3">Phân hệ</th>}
                  {isShipping && <th scope="col" className="px-3 py-3 text-right">Cộng</th>}
                  {isShipping && <th scope="col" className="px-3 py-3 text-right">Trừ</th>}
                  <th scope="col" className="px-3 py-3 text-right">{isShipping ? 'Cước ròng' : 'Tiền hàng còn giữ'}</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Lịch sử giao dịch</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {details.entries.items.map((entry) => {
                  const orderId = entry.orderId ?? entry.inspectionOrderId;
                  return (
                    <tr key={(entry.orderId ?? '') + '/' + (entry.inspectionOrderId ?? '')}>
                      <td className="px-3 py-3 font-mono" title={orderId ?? undefined}>
                        {orderId ? orderId.slice(0, 8) + '…' + orderId.slice(-4) : '—'}
                      </td>
                      {isShipping && <td className="px-3 py-3">{entry.inspectionOrderId ? 'Kiểm định Hub' : 'Mua bán sàn'}</td>}
                      {isShipping && <td className="px-3 py-3 text-right font-mono text-emerald-700">{formatVND(entry.credited ?? 0)}</td>}
                      {isShipping && <td className="px-3 py-3 text-right font-mono text-rose-700">{formatVND(entry.debited ?? 0)}</td>}
                      <td className="px-3 py-3 text-right font-mono font-semibold">{formatVND(entry.amount)}</td>
                      <td className="px-3 py-3 text-right">
                        {orderId && (
                          <button type="button" onClick={() => onViewHistory(orderId)} className="font-semibold text-blue-700 hover:underline">
                            Xem bút toán
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {details.entries.items.length === 0 && (
                  <tr><td colSpan={isShipping ? 6 : 3} className="p-5 text-center text-slate-500">Chưa có khoản nào trong quỹ này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>{details.entries.totalElements} đơn</span>
            {details.entries.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className={controlStyle}>Trang trước</button>
                <span>Trang {page + 1} / {details.entries.totalPages}</span>
                <button type="button" disabled={details.entries.isLast} onClick={() => setPage(page + 1)} className={controlStyle}>Trang sau</button>
              </div>
            )}
            <button type="button" onClick={() => onViewHistory()} className="font-semibold text-blue-700 hover:underline">
              Mở lịch sử giao dịch
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
