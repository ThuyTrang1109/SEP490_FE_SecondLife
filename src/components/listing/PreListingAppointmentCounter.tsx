import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import type { InspectionOrderDto } from '../../services/inspectorService';
import type { Language } from '../../types';

interface Props {
  order: Pick<InspectionOrderDto, 'counterScheduledAt' | 'counterNote'>;
  lang: Language;
  isSaving: boolean;
  isRefreshing: boolean;
  error: string | null;
  onAccept: () => void;
  onReschedule: () => void;
}

export function PreListingAppointmentCounter({ order, lang, isSaving, isRefreshing, error, onAccept, onReschedule }: Props) {
  const proposedAt = order.counterScheduledAt ? new Date(order.counterScheduledAt) : null;
  const formattedProposal = proposedAt && Number.isFinite(proposedAt.getTime())
    ? new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
    }).format(proposedAt)
    : null;

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-center gap-2 font-bold">
        <Calendar aria-hidden="true" className="size-4 text-amber-700" />
        <span>{lang === 'vi' ? 'Trung tâm đề xuất lịch hẹn mới' : 'The center proposed a new appointment'}</span>
      </div>
      <div className="space-y-1.5 rounded-xl border border-amber-200 bg-white p-3">
        <p className="font-bold">{formattedProposal || (lang === 'vi' ? 'Chưa có giờ đề xuất' : 'Proposed time unavailable')}</p>
        {order.counterNote && <p>{lang === 'vi' ? 'Lý do từ trung tâm' : 'Reason from the center'} · {order.counterNote}</p>}
      </div>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAccept} disabled={!formattedProposal || isSaving || isRefreshing}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          {isSaving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
          {lang === 'vi' ? 'Đồng ý lịch này' : 'Accept appointment'}
        </button>
        <button type="button" onClick={onReschedule} disabled={isSaving || isRefreshing}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold hover:bg-amber-100 disabled:opacity-50">
          {lang === 'vi' ? 'Hẹn lịch khác' : 'Suggest another time'}
        </button>
      </div>
    </div>
  );
}
