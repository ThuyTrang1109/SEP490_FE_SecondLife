import { ChevronRight, Package } from 'lucide-react';
import type { InspectionOrderDto } from '../../services/inspectorService';
import type { Language } from '../../types';
import { formatVND } from '../../utils/translations';

interface Props {
  inspection: InspectionOrderDto;
  imageUrl: string | null;
  lang: Language;
  onOpen: () => void;
}

const statusLabels: Partial<Record<string, [string, string]>> = {
  PENDING: ['Chờ chọn hình thức kiểm định', 'Choose an inspection method'],
  WAITING_FEE_PAYMENT: ['Chờ thanh toán phí kiểm định', 'Awaiting inspection payment'],
  CONFIRMED_PENDING_DISPATCH: ['Chờ điều phối', 'Awaiting dispatch'],
  SCHEDULED: ['Đã hẹn lịch kiểm định', 'Inspection scheduled'],
  SHIPPING_TO_CENTER: ['Đang chuyển đến trung tâm', 'In transit to the center'],
  INSPECTING: ['Đang kiểm định', 'Inspection in progress'],
  PASSED: ['Kiểm định đạt', 'Inspection passed'],
  COMPLETED: ['Kiểm định đạt', 'Inspection passed'],
  FAILED: ['Kiểm định không đạt', 'Inspection failed'],
  REJECTED: ['Đã từ chối', 'Rejected'],
  CANCELLED: ['Đã hủy', 'Cancelled'],
  PAYMENT_EXPIRED: ['Đã hết hạn thanh toán', 'Payment expired'],
};

export function PreListingInspectionOrderCard({ inspection, imageUrl, lang, onOpen }: Props) {
  const vi = lang === 'vi';
  const status = statusLabels[inspection.status] ?? ['Đang xử lý kiểm định', 'Inspection being processed'];
  const method = inspection.orderType === 'AT_HOME'
    ? (vi ? 'Kiểm định tại nhà' : 'Home inspection')
    : inspection.orderType === 'AT_CENTER' ? (vi ? 'Kiểm định tại trung tâm' : 'Center inspection') : null;
  const image = inspection.postImageUrls?.[0] ?? imageUrl;
  const action = inspection.status === 'PENDING'
    ? (vi ? 'Chọn hình thức kiểm định' : 'Choose inspection method')
    : inspection.status === 'WAITING_FEE_PAYMENT'
      ? (vi ? 'Xem phí và thanh toán' : 'Review fee and pay')
      : (vi ? 'Xem tiến độ' : 'View progress');

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {image ? (
          <img src={image} alt="" className="size-16 shrink-0 rounded-xl bg-slate-100 object-cover sm:size-20" />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400 sm:size-20">
            <Package aria-hidden="true" className="size-7" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="break-words font-bold text-slate-900">{inspection.postTitle || (vi ? 'Bài đăng sản phẩm' : 'Product listing')}</h3>
          <p className="text-sm font-semibold text-[#ad432f]">{status[vi ? 0 : 1]}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            {inspection.postPrice != null && <span>{formatVND(inspection.postPrice)}</span>}
            {method && <span>{method}</span>}
          </p>
          <p className="break-all font-mono text-xs text-slate-500">#{inspection.id}</p>
        </div>
      </div>
      <button type="button" onClick={onOpen}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#24263e] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24263e]">
        {action}
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </article>
  );
}
