import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Truck, X } from 'lucide-react';
import { shippingService, type InspectionReturnQuote } from '../../services/shippingService';
import { formatVND } from '../../utils/translations';
import { formatLalamoveVehicle } from '../../utils/lalamoveVehicle';

interface InspectionReturnQuoteModalProps {
  orderId: string;
  title?: string;
  booking: boolean;
  cashShipping?: boolean;
  onClose: () => void;
  onBook: (maxReturnFee: number) => Promise<string | null>;
}

export function InspectionReturnQuoteModal({ orderId, title, booking, cashShipping, onClose, onBook }: InspectionReturnQuoteModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [quote, setQuote] = useState<InspectionReturnQuote | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [quoteAttempt, setQuoteAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    shippingService.getInspectionReturnQuote(orderId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result?.from || !result.to || !Number.isFinite(result.shippingFee) || !Number.isFinite(result.reserveFee)) {
        setError('Máy chủ chưa trả về đầy đủ địa chỉ, cước và khoản dự phòng.');
        return;
      }
      setQuote(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không lấy được báo giá Lalamove.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [orderId, quoteAttempt]);

  const refresh = () => {
    setQuote(null);
    setError('');
    setLoading(true);
    setQuoteAttempt((attempt) => attempt + 1);
  };

  const overReserve = Boolean(quote && quote.shippingFee > quote.reserveFee);
  const serviceType = quote?.serviceType?.trim();
  const vehicleName = serviceType ? formatLalamoveVehicle(serviceType).name : null;
  const confirm = async () => {
    if (!quote || overReserve || booking || loading) return;
    if (quote.expiresAt && Date.parse(quote.expiresAt) <= Date.now()) {
      setQuote(null);
      setError('Báo giá đã hết hạn. Vui lòng lấy lại cước trước khi đặt chuyến.');
      return;
    }
    const message = await onBook(quote.shippingFee);
    if (message) {
      setQuote(null);
      setError(message);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="return-quote-title"
      onCancel={(event) => { event.preventDefault(); if (!booking) onClose(); }}
      className="m-auto max-h-[90dvh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-2xl bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
    >
      <header className="flex items-start gap-3 border-b border-slate-200 p-5">
        <div className="rounded-lg bg-orange-50 p-2.5 text-orange-700"><Truck aria-hidden="true" className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 id="return-quote-title" className="text-lg font-extrabold">Trả hàng từ Hub về người bán</h2>
          <p className="mt-1 text-xs text-slate-600">{title} · #{orderId.slice(0, 8)}</p>
        </div>
        <button type="button" onClick={onClose} disabled={booking} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <div className="space-y-4 p-5">
        {cashShipping && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Mô phỏng Sandbox</strong> · Hệ thống hoàn ứng vào ví Hub sau khi Lalamove xác nhận giao hàng và cước thực tế.</p>}
        {loading && (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600">
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-orange-700" /> Đang lấy cước từ Lalamove…
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {quote && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { contact: quote.from, label: 'Lấy hàng tại Hub' },
                { contact: quote.to, label: 'Giao về người bán' },
              ].map(({ contact, label }) => (
                <section key={label} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <h3 className="mb-1 text-xs font-bold uppercase text-slate-500">{label}</h3>
                  <p className="font-bold">{contact.name}</p>
                  <p className="break-words text-slate-700">{contact.address}</p>
                  <p className="mt-1 text-slate-600">{contact.phone}</p>
                </section>
              ))}
            </div>
            <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Đơn vị vận chuyển</dt>
                <dd className="font-semibold">
                  {quote.carrier}{vehicleName && vehicleName !== serviceType && ` · ${vehicleName}`}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2"><dt>Cước báo giá hiện tại</dt><dd className="font-extrabold text-orange-700">{formatVND(quote.shippingFee)}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt>Dự phòng đã thu</dt><dd className="font-semibold">{formatVND(quote.reserveFee)}</dd></div>
              {overReserve && (
                <div className="flex flex-wrap justify-between gap-2"><dt>Cước vượt dự phòng</dt><dd className="font-bold text-rose-700">{formatVND(quote.shippingFee - quote.reserveFee)}</dd></div>
              )}
              {quote.expiresAt && (
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600"><dt>Báo giá hết hạn lúc</dt><dd>{new Date(quote.expiresAt).toLocaleString('vi-VN')}</dd></div>
              )}
            </dl>
            {overReserve && <p role="alert" className="text-sm text-rose-800">Cần xử lý phần cước chênh lệch trước khi đặt chuyến.</p>}
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 p-4">
        <button type="button" onClick={onClose} disabled={booking} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Hủy</button>
        <button type="button" onClick={refresh} disabled={loading || booking} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw aria-hidden="true" className="size-3.5" /> Lấy lại báo giá
        </button>
        <button type="button" onClick={() => void confirm()} disabled={!quote || overReserve || loading || booking} className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50">
          {booking ? 'Đang đặt chuyến…' : 'Xác nhận tạo vận đơn'}
        </button>
      </footer>
    </dialog>
  );
}
