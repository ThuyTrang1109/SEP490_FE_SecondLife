import React from 'react';
import { History, Loader2 } from 'lucide-react';
import {
  WalletWithdrawalStatusHistoryItem,
  WITHDRAWAL_DISPUTE_TYPES,
  WITHDRAWAL_STATUS_LABELS,
} from '../../services/walletService';

export function getWithdrawalStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'DISPUTE_RESOLVED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'TRANSFERRED_AWAITING_REVIEW':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'PROCESSING':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'DISPUTED':
    case 'DISPUTE_PROCESSING':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'REJECTED':
    case 'TRANSFER_FAILED':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

export function getWithdrawalStatusLabel(status?: string | null): string {
  if (!status) return 'Không xác định';
  return WITHDRAWAL_STATUS_LABELS[status] || status;
}

export function getWithdrawalHistoryActionLabel(action?: string | null): string {
  switch ((action || '').toUpperCase()) {
    case 'REQUESTED':
    case 'CREATED':
      return 'Gửi yêu cầu rút tiền';
    case 'CLAIM':
    case 'ACCEPT':
      return 'Nhân viên tiếp nhận xử lý';
    case 'UNCLAIM':
      return 'Trả lại hàng đợi chờ tiếp nhận';
    case 'REASSIGN':
      return 'Bàn giao cho nhân viên khác';
    case 'UPLOAD_EVIDENCE':
      return 'Tải lên ảnh biên lai chuyển khoản';
    case 'CONFIRM_TRANSFER':
    case 'APPROVE':
      return 'Xác nhận đã chuyển khoản';
    case 'TRANSFER_FAILED':
      return 'Ghi nhận chuyển khoản thất bại';
    case 'REJECT':
    case 'CANCEL':
      return 'Từ chối yêu cầu rút tiền';
    case 'USER_CANCEL':
      return 'Chủ ví hủy yêu cầu';
    case 'USER_CONFIRM_RECEIPT':
    case 'CONFIRM_RECEIPT':
    case 'OWNER_CONFIRMED':
      return 'Chủ ví xác nhận đã nhận tiền';
    case 'OWNER_CLOSED_DISPUTE_CONFIRMED':
      return 'Chủ ví đóng báo cáo và xác nhận đã nhận tiền';
    case 'USER_DISPUTE':
    case 'DISPUTED':
      return 'Chủ ví báo cáo sự cố';
    case 'START_DISPUTE_REVIEW':
      return 'Bắt đầu xác minh báo cáo sự cố';
    case 'RESOLVE_DISPUTE':
      return 'Giải quyết báo cáo sự cố';
    case 'USER_EXCEPTION_REQUEST':
      return 'Chủ ví gửi yêu cầu hỗ trợ ngoại lệ';
    case 'AUTO_COMPLETE':
      return 'Hệ thống tự động hoàn tất sau 48 giờ';
    default:
      return action || 'Cập nhật trạng thái';
  }
}

export function getWithdrawalTimelineDotClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'DISPUTE_RESOLVED':
      return 'bg-emerald-500 ring-emerald-100';
    case 'TRANSFERRED_AWAITING_REVIEW':
      return 'bg-indigo-500 ring-indigo-100';
    case 'PROCESSING':
      return 'bg-sky-500 ring-sky-100';
    case 'DISPUTED':
    case 'DISPUTE_PROCESSING':
      return 'bg-orange-500 ring-orange-100';
    case 'REJECTED':
    case 'TRANSFER_FAILED':
      return 'bg-rose-500 ring-rose-100';
    case 'CANCELLED':
      return 'bg-slate-400 ring-slate-100';
    default:
      return 'bg-amber-500 ring-amber-100';
  }
}

export function formatWithdrawalHistoryReason(reason?: string | null): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase();
  const matched = WITHDRAWAL_DISPUTE_TYPES.find((t) => t.code.toUpperCase() === normalized);
  return matched ? matched.label : trimmed;
}

interface WithdrawalStatusTimelineProps {
  events: WalletWithdrawalStatusHistoryItem[];
  loading?: boolean;
  title?: string;
  emptyText?: string;
  className?: string;
}

export const WithdrawalStatusTimeline: React.FC<WithdrawalStatusTimelineProps> = ({
  events,
  loading = false,
  title = 'Tiến trình xử lý lệnh rút tiền',
  emptyText = 'Chưa có nhật ký thay đổi trạng thái.',
  className = '',
}) => {
  const sortedEvents = React.useMemo(() => {
    return events
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        const tA = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
        const tB = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
        if (tB !== tA) return tB - tA;
        return b.originalIndex - a.originalIndex;
      })
      .map((entry) => entry.item);
  }, [events]);

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-600 shrink-0" />
          <span>{title}</span>
        </div>
        {sortedEvents.length > 0 && (
          <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">
            {sortedEvents.length} mốc cập nhật
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-2 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tải lịch sử...</span>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic">{emptyText}</div>
      ) : (
        <div className="relative pl-5 space-y-2.5">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"
            aria-hidden="true"
          />
          {sortedEvents.map((h, idx) => {
            const isLatest = idx === 0;
            const newLabel = getWithdrawalStatusLabel(h.newStatus);
            const oldLabel = h.oldStatus ? getWithdrawalStatusLabel(h.oldStatus) : null;
            const reasonText = formatWithdrawalHistoryReason(h.reason);

            return (
              <div key={`${h.createdAt}-${idx}`} className="relative">
                <span
                  className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full ring-4 ${getWithdrawalTimelineDotClass(
                    h.newStatus,
                  )}`}
                />
                <div
                  className={`p-3 rounded-xl border bg-white space-y-1.5 ${
                    isLatest ? 'border-[#24263e]/25 shadow-xs' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                      <span>{getWithdrawalHistoryActionLabel(h.action)}</span>
                      {isLatest && (
                        <span className="px-1.5 py-0.5 rounded bg-[#24263e] text-white text-[9.5px] font-bold">
                          Hiện tại
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-400 font-mono shrink-0">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {oldLabel && oldLabel !== newLabel && (
                      <>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500">
                          {oldLabel}
                        </span>
                        <span className="text-slate-400 text-[10px]">→</span>
                      </>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getWithdrawalStatusBadgeClass(
                        h.newStatus,
                      )}`}
                    >
                      {newLabel}
                    </span>
                  </div>

                  {reasonText && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      Ghi chú: {reasonText}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
