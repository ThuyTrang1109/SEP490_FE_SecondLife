import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Truck } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { shippingService } from '../../services/shippingService';
import type { ShipmentBackend } from '../../types';
import {
  canConfirmInspectionCash,
  isDeliveredInspectionCashShipment,
  isInspectionCashShipment,
  notifyInspectionCashConfirmed,
} from '../../utils/inspectionCashShipping';
import { formatVND } from '../../utils/translations';
import { InspectionCashShipmentStatus } from './InspectionCashShipmentStatus';

type Confirmation = { paidAmount: number; receiptReference: string };

function CashShipmentReview({ shipment, allowManualConfirmation, onUpdate, onConfirmed }: {
  shipment: ShipmentBackend;
  allowManualConfirmation: boolean;
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
  const canConfirm = allowManualConfirmation && shipment.leg === 'SELLER_TO_CENTER' && canConfirmInspectionCash(shipment);

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
      if (!shipment.cashConfirmedAt && updated.cashConfirmedAt) notifyInspectionCashConfirmed();
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
      {isDeliveredInspectionCashShipment(shipment) && !shipment.cashConfirmedAt && !canConfirmInspectionCash(shipment) && (
        <p className="text-xs text-slate-600">
          {shipment.orderCode?.trim()
            ? 'Chờ cước thực tế từ Lalamove. Bấm Đồng bộ vận đơn để cập nhật.'
            : 'Vận đơn cần có mã Lalamove để xác nhận chi cước.'}
        </p>
      )}
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

export function InspectionCashReviewPanel({ allowManualConfirmation = true }: { allowManualConfirmation?: boolean }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ orderId: string; shipments: ShipmentBackend[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestedOrder = useRef('');
  const requestVersion = useRef(0);
  const inputOrderId = input.trim().replace(/^#/, '').trim().toLowerCase();
  const visibleResult = result?.orderId === inputOrderId ? result : null;
  const hubShipments = visibleResult?.shipments.filter(
    ({ leg }) => leg === 'SELLER_TO_CENTER' || leg === 'CENTER_TO_SELLER',
  ) ?? [];
  const cashShipments = hubShipments.filter(isInspectionCashShipment);

  const load = async (id: string) => {
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
      setError('Nhập mã UUID đầy đủ của đơn kiểm định.');
      return;
    }
    const version = ++requestVersion.current;
    requestedOrder.current = id;
    setResult((current) => current?.orderId === id ? current : null);
    setLoading(true);
    setError('');
    try {
      const list = await shippingService.getInspectionShipments(id);
      if (requestVersion.current !== version) return;
      setResult({ orderId: id, shipments: list });
    } catch (cause) {
      if (requestVersion.current === version) setError(cause instanceof Error ? cause.message : 'Không tải được vận đơn kiểm định.');
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-amber-50 p-2.5 text-amber-700">
          <Truck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-base font-extrabold text-slate-900">Hoàn ứng cước kiểm định</h2>

        </div>
      </div>
      <form
        onSubmit={(event) => { event.preventDefault(); if (!loading) void load(inputOrderId); }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-semibold text-slate-800">
          Mã đơn kiểm định
          <input
            value={input}
            required
            disabled={loading}
            placeholder="Nhập UUID của đơn kiểm định"
            onChange={(event) => { setInput(event.target.value); setError(''); }}
            className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm font-normal focus:border-slate-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !inputOrderId}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Đang tra vận đơn…' : 'Tra vận đơn'}
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
      {visibleResult && !loading && !error && cashShipments.length === 0 && (
        <p role="status" className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {hubShipments.length > 0
            ? 'Các vận đơn của đơn này dùng luồng cước thông thường. Xác nhận biên nhận áp dụng cho vận đơn ứng tiền mặt Sandbox.'
            : 'Đơn này chưa có vận đơn từ người bán đến Hub hoặc từ Hub trả về người bán.'}
        </p>
      )}
      {visibleResult && cashShipments.map((shipment) => (
        <CashShipmentReview key={shipment.shipmentId} shipment={shipment}
          allowManualConfirmation={allowManualConfirmation}
          onUpdate={(updated) => setResult((current) => {
            if (current?.orderId !== visibleResult.orderId) return current;
            return {
              ...current,
              shipments: current.shipments.map((item) => item.shipmentId === updated.shipmentId ? updated : item),
            };
          })}
          onConfirmed={() => {
            if (requestedOrder.current === visibleResult.orderId) void load(visibleResult.orderId);
            notifyInspectionCashConfirmed();
          }}
        />
      ))}
    </section>
  );
}
