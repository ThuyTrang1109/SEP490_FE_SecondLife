import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { shippingService } from '../../services/shippingService';
import type { ShipmentBackend } from '../../types';
import { canConfirmInspectionCash, inspectionCashConfirmedEvent, isInspectionCashShipment } from '../../utils/inspectionCashShipping';
import { formatVND } from '../../utils/translations';
import { InspectionCashShipmentStatus } from './InspectionCashShipmentStatus';
import { AdminInspectionFundsModal } from '../admin/AdminInspectionFundsModal';

type Confirmation = { paidAmount: number; receiptReference: string };

function CashShipmentReview({ shipment, onUpdate, onConfirmed }: {
  shipment: ShipmentBackend;
  onUpdate: (shipment: ShipmentBackend) => void;
  onConfirmed: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState(false);
  const [retryBody, setRetryBody] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const canConfirm = canConfirmInspectionCash(shipment);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canConfirm || inFlight.current || !checked) return;
    const body = retryBody ?? { paidAmount: Number(amount), receiptReference: receipt.trim() };
    if (!retryBody && (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || body.paidAmount !== shipment.actualFee || !body.receiptReference)) {
      setError('Nhập số tiền biên nhận khớp cước Lalamove và tham chiếu biên nhận.');
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await shippingService.confirmInspectionCashShipping(shipment.shipmentId, body);
      onUpdate(updated);
      setRetryBody(null);
      setReviewing(false);
      onConfirmed();
    } catch (cause) {
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 408;
      if (ambiguous) setRetryBody(body);
      else setRetryBody(null);
      setError(ambiguous
        ? 'Chưa nhận được kết quả xác nhận. Gửi lại cùng số tiền và tham chiếu biên nhận.'
        : cause instanceof ApiError && cause.status === 403
          ? 'Tài khoản thiếu quyền xác nhận chi cước.'
          : cause instanceof Error ? cause.message : 'Không xác nhận được cước.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const sync = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await shippingService.syncShipment(shipment.shipmentId);
      onUpdate(updated);
      if (!retryBody && updated.actualFee != null) setAmount(String(updated.actualFee));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đồng bộ được vận đơn.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <strong>{shipment.orderCode || 'Chưa có mã Lalamove'}</strong>
        <span>{shipment.leg === 'SELLER_TO_CENTER' ? 'Seller → Hub' : 'Hub → Seller'}</span>
      </div>
      <div className="text-xs text-slate-700">
        <p className="break-all">Người ứng: {shipment.leg === 'SELLER_TO_CENTER' ? 'Seller' : 'Hub'} · {shipment.cashPayerId}</p>
        <p>Cước thực tế: {shipment.actualFee == null ? 'Chưa cập nhật' : formatVND(shipment.actualFee)}</p>
      </div>
      <InspectionCashShipmentStatus shipment={shipment} />
      <div className="flex flex-wrap gap-2">
        {shipment.orderCode && !shipment.cashConfirmedAt && !retryBody && (
          <button type="button" disabled={busy} onClick={() => void sync()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Đồng bộ vận đơn
          </button>
        )}
        {canConfirm && !reviewing && (
          <button type="button" disabled={busy} onClick={() => { setAmount(String(shipment.actualFee)); setReviewing(true); }} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            Xác nhận chi cước mô phỏng
          </button>
        )}
      </div>
      {canConfirm && reviewing && (
        <form onSubmit={submit} className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">Số tiền biên nhận (₫)
              <input value={amount} inputMode="decimal" required disabled={busy || !!retryBody} onChange={(e) => setAmount(e.target.value)} className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5" />
            </label>
            <label className="grid gap-1">Tham chiếu biên nhận
              <input value={receipt} maxLength={255} required disabled={busy || !!retryBody} onChange={(e) => setReceipt(e.target.value)} className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5" />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={checked} disabled={busy || !!retryBody} onChange={(e) => setChecked(e.target.checked)} />
            Đã kiểm tra chứng từ mô phỏng Sandbox
          </label>
          <button disabled={!checked || busy} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {busy ? 'Đang xác nhận…' : retryBody ? 'Gửi lại xác nhận Sandbox' : 'Xác nhận hoàn ứng · Mô phỏng Sandbox'}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
    </article>
  );
}

export function InspectionCashReviewPanel({ onOpenFundsAudit }: { onOpenFundsAudit?: (orderId: string) => void } = {}) {
  const [input, setInput] = useState('');
  const [orderId, setOrderId] = useState('');
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [internalAuditOrderId, setInternalAuditOrderId] = useState<string | null>(null);
  const requestedOrder = useRef('');
  const requestVersion = useRef(0);
  const load = async (id: string) => {
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
      setError('Nhập mã UUID đầy đủ của đơn kiểm định.');
      return;
    }
    const version = ++requestVersion.current;
    requestedOrder.current = id;
    setLoading(true);
    setError('');
    try {
      const list = await shippingService.getInspectionShipments(id);
      if (requestVersion.current !== version) return;
      setOrderId(id);
      setShipments(list.filter(isInspectionCashShipment));
    } catch (cause) {
      if (requestVersion.current === version) setError(cause instanceof Error ? cause.message : 'Không tải được vận đơn kiểm định.');
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  };

  const handleOpenAudit = (id: string) => {
    if (onOpenFundsAudit) {
      onOpenFundsAudit(id);
    } else {
      setInternalAuditOrderId(id);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-slate-900">Hoàn ứng cước kiểm định · Mô phỏng Sandbox</h2>
        {orderId && (
          <button
            type="button"
            onClick={() => handleOpenAudit(orderId)}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Đối soát tiền kiểm định
          </button>
        )}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void load(input.trim()); }} className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold">Mã đơn kiểm định
          <input value={input} required onChange={(event) => setInput(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <button disabled={loading || !input.trim()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tra vận đơn</button>
      </form>
      {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
      {orderId && shipments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
          <p className="break-all text-xs text-slate-700">
            Đơn kiểm định: <strong className="font-mono text-slate-900">{orderId}</strong>
          </p>
          <button
            type="button"
            onClick={() => handleOpenAudit(orderId)}
            className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-3 h-3" />
            Đối soát tiền kiểm định
          </button>
        </div>
      )}
      {orderId && !loading && shipments.length === 0 && <p className="text-xs text-slate-600">Chưa có vận đơn Sandbox cho mã kiểm định này.</p>}
      {shipments.map((shipment) => (
        <CashShipmentReview key={shipment.shipmentId} shipment={shipment}
          onUpdate={(updated) => setShipments((list) => list.map((item) => item.shipmentId === updated.shipmentId ? updated : item))}
          onConfirmed={() => {
            if (requestedOrder.current === orderId) void load(orderId);
            window.dispatchEvent(new Event(inspectionCashConfirmedEvent));
            try { localStorage.setItem(inspectionCashConfirmedEvent, String(Date.now())); } catch { }
          }}
        />
      ))}
      {internalAuditOrderId && (
        <AdminInspectionFundsModal
          inspectionOrderId={internalAuditOrderId}
          isOpen={Boolean(internalAuditOrderId)}
          onClose={() => setInternalAuditOrderId(null)}
        />
      )}
    </section>
  );
}
