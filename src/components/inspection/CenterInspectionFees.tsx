import { CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';
import type { InspectionOrderDto } from '../../services/inspectorService';
import type { CenterFeeCollection } from '../../utils/inspectionCenterFees';
import { formatVND } from '../../utils/translations';

function FeeLine({ label, amount, note }: { label: string; amount?: number | null; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-slate-700">
        {label}
        {note && <div className="mt-0.5 text-[11px] text-slate-500">{note}</div>}
      </dt>
      <dd className="font-semibold text-slate-900">{amount == null ? '—' : formatVND(amount)}</dd>
    </div>
  );
}

function formatPaymentDate(timestamp: string) {
  return new Date(timestamp).toLocaleString('vi-VN');
}

function partyPaymentNote(payment: CenterFeeCollection['buyer'], collectionClosed: boolean, notDue: boolean) {
  if (payment.amount == null) return 'Chưa có dữ liệu';
  if (payment.amount === 0) return 'Không cần nộp';
  if (payment.paidAt) return `Đã nộp · ${formatPaymentDate(payment.paidAt)}`;
  if (collectionClosed) return 'Chưa nộp · Đã dừng thu phí';
  return notDue ? 'Chưa đến bước thu phí' : 'Chưa nộp';
}

/** Ánh xạ trạng thái thu phí thành badge text cho cột "Thanh toán kiểm định" */
export function CenterInspectionFeeStatus({ fees, collectionClosed, isReturning, hasResult }: {
  fees: CenterFeeCollection;
  collectionClosed: boolean;
  isReturning: boolean;
  hasResult: boolean;
}) {
  if (collectionClosed) return <span className="text-slate-600">{isReturning ? 'Xử lý hoàn hàng' : 'Đã dừng thu phí'}</span>;
  if (fees.settledAt) return <span className="font-bold text-emerald-800">Đã quyết toán</span>;
  switch (fees.collection) {
    case 'not_due': return <span className="text-slate-600">Chưa đến bước thu phí</span>;
    case 'unknown': return <span className="text-slate-600">Chưa có dữ liệu</span>;
    case 'collected':
      return hasResult ? <span className="text-slate-600">Chờ quyết toán</span> : null;
    case 'partial':
      return <span className="font-semibold text-amber-900">Đã nộp một phần</span>;
    case 'waiting': {
      return <span className="font-semibold text-amber-900">Chờ nộp phí</span>;
    }
  }
}

/** Hiển thị quyết toán cho trung tâm (Hub) dựa trên centerPayoutAmount và feeSettledAt */
function CenterPayoutSection({ order, fees }: { order: InspectionOrderDto; fees: CenterFeeCollection }) {
  const payout = order.centerPayoutAmount;
  const settledAt = order.feeSettledAt ?? fees.settledAt;

  // centerPayoutAmount có giá trị rõ ràng
  if (payout != null) {
    if (payout > 0) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <dt className="font-semibold text-slate-800">Quyết toán cho trung tâm</dt>
          <dd className="font-semibold text-emerald-700">
            Đã cộng vào ví · {formatVND(payout)}
            {settledAt && (
              <div className="text-[11px] text-slate-500 font-normal">{formatPaymentDate(settledAt)}</div>
            )}
          </dd>
        </div>
      );
    }
    // payout === 0
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <dt className="font-semibold text-slate-800">Quyết toán cho trung tâm</dt>
        <dd className="text-slate-600">Đã quyết toán · Không có khoản chi</dd>
      </div>
    );
  }

  // centerPayoutAmount thiếu nhưng có feeSettledAt
  if (settledAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <dt className="font-semibold text-slate-800">Quyết toán cho trung tâm</dt>
        <dd className="text-amber-700 text-[11px]">Đã quyết toán phí · Chưa có dữ liệu ghi có cho Hub</dd>
      </div>
    );
  }

  // Thiếu cả hai: suy ra từ trạng thái đơn
  const isEarlyStage = ['PENDING', 'WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT',
    'CONFIRMED_PENDING_DISPATCH', 'DISPATCHED', 'INSPECTING'].includes(order.status);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <dt className="font-semibold text-slate-800">Quyết toán cho trung tâm</dt>
      <dd className="text-slate-600">
        {isEarlyStage ? 'Chưa đến bước quyết toán' : 'Chờ quyết toán'}
      </dd>
    </div>
  );
}

export function CenterInspectionFees({ order, fees, collectionClosed }: {
  order: InspectionOrderDto;
  fees: CenterFeeCollection;
  collectionClosed: boolean;
}) {
  const isAtHome = order.orderType === 'AT_HOME';
  const cashShipping = !isAtHome && order.cashShippingSimulation === true;
  const travelFee = order.travelFee ?? order.travelFeeRoundTrip;
  const notDue = fees.collection === 'not_due';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs" aria-label="Thu phí và quyết toán">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CreditCard aria-hidden="true" className="size-4 text-slate-600" />
        <h4 className="text-sm font-bold text-slate-900">Thu phí &amp; quyết toán</h4>
        {cashShipping && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Mô phỏng Sandbox</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cột trái: Phí kiểm định cơ sở + phụ phí AT_HOME */}
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <h5 className="pt-1 font-bold text-slate-900">Các khoản phí kiểm định</h5>
          <dl className="divide-y divide-slate-200">
            <FeeLine label="Phí kiểm định cơ sở" amount={order.inspectionFee} />
            {isAtHome && travelFee != null && travelFee > 0 && (
              <FeeLine label="Phụ phí di chuyển KTV" amount={travelFee} />
            )}
          </dl>
        </div>

        {/* Cột phải: Quyết toán cho trung tâm */}
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <h5 className="pt-1 font-bold text-slate-900">Quyết toán cho trung tâm</h5>
          <dl className="divide-y divide-slate-200">
            {/* Phần nộp trước theo từng bên - rút gọn chỉ hiện badge trạng thái */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <dt className="text-slate-700">Người mua</dt>
              <dd className="text-[11px] text-slate-500">{partyPaymentNote(fees.buyer, collectionClosed, notDue)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <dt className="text-slate-700">Người bán</dt>
              <dd className="text-[11px] text-slate-500">{partyPaymentNote(fees.seller, collectionClosed, notDue)}</dd>
            </div>
            <CenterPayoutSection order={order} fees={fees} />
          </dl>
        </div>
      </div>
    </section>
  );
}
