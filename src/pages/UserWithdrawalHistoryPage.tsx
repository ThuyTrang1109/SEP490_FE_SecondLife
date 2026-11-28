import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  History,
  Upload,
  Smartphone,
  X,
  Loader2,
  HelpCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  walletService,
  WalletWithdrawalResponseDto,
  WalletWithdrawalStatusHistoryItem,
  WITHDRAWAL_DISPUTE_TYPES,
  WITHDRAWAL_RESOLUTION_OUTCOMES,
  WITHDRAWAL_STATUS_LABELS,
} from '../services/walletService';
import { mediaService } from '../services/mediaService';
import { MobileEvidenceQrModal } from '../components/admin/MobileEvidenceQrModal';
import { WithdrawalStatusTimeline } from '../components/wallet/WithdrawalStatusTimeline';
import { formatVND } from '../utils/translations';
import { Language } from '../types';

interface UserWithdrawalHistoryPageProps {
  lang?: Language;
  initialWithdrawalId?: string | null;
  walletBalance: number;
  onWalletUpdated?: (newBalance: number) => void;
  onOpenCreateWithdrawal: () => void;
  onBack: () => void;
  showToast?: (msg: string) => void;
}

type FilterKey =
  | 'ALL'
  | 'PENDING'
  | 'PROCESSING'
  | 'TRANSFERRED_AWAITING_REVIEW'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CLOSED_NEGATIVE';

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'DISPUTE_RESOLVED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'TRANSFERRED_AWAITING_REVIEW':
      return 'bg-teal-50 text-teal-800 border-teal-200';
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

function getStatusLabel(status: string): string {
  return WITHDRAWAL_STATUS_LABELS[status] || status;
}

function computeRemainingSeconds(
  item: WalletWithdrawalResponseDto,
  fetchedAtMs: number,
  nowMs: number,
): number | null {
  if (item.status !== 'TRANSFERRED_AWAITING_REVIEW') return null;
  if (typeof item.remainingDisputeSeconds === 'number') {
    const elapsedSec = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
    return Math.max(0, item.remainingDisputeSeconds - elapsedSec);
  }
  if (!item.disputeDeadline) return null;
  const serverOffsetMs = item.serverTime
    ? new Date(item.serverTime).getTime() - fetchedAtMs
    : 0;
  const diffSec = Math.floor(
    (new Date(item.disputeDeadline).getTime() - (nowMs + serverOffsetMs)) / 1000,
  );
  return Math.max(0, diffSec);
}

function formatRemaining48h(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return 'Đã hết thời hạn báo cáo 48 giờ';
  const totalMins = Math.floor(seconds / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `Còn ${hours} giờ ${mins} phút để kiểm tra và báo lỗi`;
}

export const UserWithdrawalHistoryPage: React.FC<UserWithdrawalHistoryPageProps> = ({
  initialWithdrawalId = null,
  walletBalance,
  onWalletUpdated,
  onOpenCreateWithdrawal,
  onBack,
  showToast,
}) => {
  const [items, setItems] = useState<WalletWithdrawalResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);

  const [availableBalance, setAvailableBalance] = useState<number>(walletBalance);
  const [reservedBalance, setReservedBalance] = useState<number>(0);

  const [statusFilter, setStatusFilter] = useState<FilterKey>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fetchedAtMs, setFetchedAtMs] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [expandedId, setExpandedId] = useState<string | null>(initialWithdrawalId);
  const [historyById, setHistoryById] = useState<
    Record<string, WalletWithdrawalStatusHistoryItem[]>
  >({});
  const [evidenceBlobById, setEvidenceBlobById] = useState<Record<string, string>>({});
  const [zoomedEvidenceUrl, setZoomedEvidenceUrl] = useState<string | null>(null);

  // Action dialogs
  const [cancellingItem, setCancellingItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [confirmingReceiptItem, setConfirmingReceiptItem] =
    useState<WalletWithdrawalResponseDto | null>(null);
  const [disputingItem, setDisputingItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [disputeType, setDisputeType] = useState<string>(WITHDRAWAL_DISPUTE_TYPES[0].code);
  const [disputeDesc, setDisputeDesc] = useState<string>('');
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [uploadingDisputePhoto, setUploadingDisputePhoto] = useState<boolean>(false);
  const [showNotReceivedWarning, setShowNotReceivedWarning] = useState<boolean>(false);

  const [exceptionItem, setExceptionItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [exceptionReason, setExceptionReason] = useState<string>('');
  const [exceptionEvidenceUrls, setExceptionEvidenceUrls] = useState<string[]>([]);
  const [uploadingExceptionPhoto, setUploadingExceptionPhoto] = useState<boolean>(false);
  const [mobileQrTarget, setMobileQrTarget] = useState<'dispute' | 'exception' | null>(null);

  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const notify = useCallback(
    (msg: string) => {
      if (showToast) showToast(msg);
    },
    [showToast],
  );

  const loadItemExtras = useCallback((item: WalletWithdrawalResponseDto) => {
    walletService
      .getWithdrawalHistory(item.id)
      .then((rows) => {
        setHistoryById((prev) => ({ ...prev, [item.id]: rows }));
      })
      .catch(() => { });

    if (item.evidenceUrl) {
      walletService
        .fetchWithdrawalEvidenceBlobUrl(item.evidenceUrl)
        .then((blobUrl) => {
          setEvidenceBlobById((prev) => ({ ...prev, [item.id]: blobUrl }));
        })
        .catch(() => { });
    }
  }, []);

  const loadData = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const [wdRes, walletRes] = await Promise.all([
          walletService.getMyWithdrawals(targetPage, 20),
          walletService.getMyWallet({ isBackground: true }).catch(() => null),
        ]);

        let list = wdRes.items || [];
        if (
          initialWithdrawalId &&
          targetPage === 0 &&
          !list.some((row) => row.id === initialWithdrawalId)
        ) {
          try {
            const focused = await walletService.getWithdrawalDetail(initialWithdrawalId);
            if (focused?.id) {
              list = [focused, ...list];
            }
          } catch {
            // Ignore if ID is invalid or belongs to another account
          }
        }

        setItems(list);
        setPage(wdRes.page ?? targetPage);
        setTotalPages(Math.max(1, wdRes.totalPages ?? 1));
        setTotalElements(wdRes.totalElements ?? list.length);
        setFetchedAtMs(Date.now());
        setNowMs(Date.now());

        if (walletRes) {
          const nextBal = Number((walletRes as any).balance ?? walletBalance);
          const nextRes = Number(
            (walletRes as any).reservedBalance ?? (walletRes as any).pendingBalance ?? 0,
          );
          setAvailableBalance(nextBal);
          setReservedBalance(nextRes);
          if (onWalletUpdated) onWalletUpdated(nextBal);
        }

        if (initialWithdrawalId) {
          const matched = list.find((row) => row.id === initialWithdrawalId);
          if (matched) {
            setExpandedId(matched.id);
            loadItemExtras(matched);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Không thể tải lịch sử rút tiền. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    },
    [page, initialWithdrawalId, walletBalance, onWalletUpdated, loadItemExtras],
  );

  useEffect(() => {
    void loadData(0);
  }, [initialWithdrawalId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onWalletRefresh = () => {
      void loadData(page);
    };
    window.addEventListener('secondlife_wallet_updated', onWalletRefresh);
    window.addEventListener('wallet_balance_updated', onWalletRefresh);
    return () => {
      window.removeEventListener('secondlife_wallet_updated', onWalletRefresh);
      window.removeEventListener('wallet_balance_updated', onWalletRefresh);
    };
  }, [loadData, page]);

  const toggleExpand = (item: WalletWithdrawalResponseDto) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    loadItemExtras(item);
  };

  const counts = useMemo(() => {
    return {
      ALL: items.length,
      PENDING: items.filter((i) => i.status === 'PENDING').length,
      PROCESSING: items.filter((i) => ['PROCESSING', 'TRANSFER_FAILED'].includes(i.status)).length,
      TRANSFERRED_AWAITING_REVIEW: items.filter((i) => i.status === 'TRANSFERRED_AWAITING_REVIEW')
        .length,
      DISPUTED: items.filter((i) => ['DISPUTED', 'DISPUTE_PROCESSING'].includes(i.status)).length,
      COMPLETED: items.filter((i) => ['COMPLETED', 'DISPUTE_RESOLVED'].includes(i.status)).length,
      CLOSED_NEGATIVE: items.filter((i) => ['REJECTED', 'CANCELLED'].includes(i.status)).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (statusFilter === 'PENDING') {
      list = list.filter((i) => i.status === 'PENDING');
    } else if (statusFilter === 'PROCESSING') {
      list = list.filter((i) => ['PROCESSING', 'TRANSFER_FAILED'].includes(i.status));
    } else if (statusFilter === 'TRANSFERRED_AWAITING_REVIEW') {
      list = list.filter((i) => i.status === 'TRANSFERRED_AWAITING_REVIEW');
    } else if (statusFilter === 'DISPUTED') {
      list = list.filter((i) => ['DISPUTED', 'DISPUTE_PROCESSING'].includes(i.status));
    } else if (statusFilter === 'COMPLETED') {
      list = list.filter((i) => ['COMPLETED', 'DISPUTE_RESOLVED'].includes(i.status));
    } else if (statusFilter === 'CLOSED_NEGATIVE') {
      list = list.filter((i) => ['REJECTED', 'CANCELLED'].includes(i.status));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (i) =>
          (i.requestCode && i.requestCode.toLowerCase().includes(term)) ||
          (i.bankCode && i.bankCode.toLowerCase().includes(term)) ||
          (i.bankName && i.bankName.toLowerCase().includes(term)) ||
          (i.accountNumber && i.accountNumber.toLowerCase().includes(term)) ||
          (i.accountHolderName && i.accountHolderName.toLowerCase().includes(term)) ||
          (i.id && i.id.toLowerCase().includes(term)),
      );
    }
    return list;
  }, [items, statusFilter, searchTerm]);

  const handleConfirmCancel = async () => {
    if (!cancellingItem) return;
    setActionBusy(true);
    setDialogError(null);
    try {
      await walletService.cancelWithdrawal(cancellingItem.id);
      notify(
        `Đã hủy yêu cầu rút tiền #${cancellingItem.requestCode || cancellingItem.id.slice(0, 8)} và hoàn tiền về số dư khả dụng.`,
      );
      setCancellingItem(null);
      await loadData(page);
    } catch (err: any) {
      setDialogError(err?.message || 'Không thể hủy yêu cầu rút tiền lúc này.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!confirmingReceiptItem) return;
    const closingDispute = ['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status);
    setActionBusy(true);
    setDialogError(null);
    try {
      await walletService.confirmReceipt(confirmingReceiptItem.id);
      notify(
        closingDispute
          ? `Đã đóng báo cáo sự cố và xác nhận nhận đủ tiền cho lệnh #${confirmingReceiptItem.requestCode || confirmingReceiptItem.id.slice(0, 8)}.`
          : `Đã xác nhận nhận đủ tiền cho lệnh #${confirmingReceiptItem.requestCode || confirmingReceiptItem.id.slice(0, 8)}.`,
      );
      setConfirmingReceiptItem(null);
      await loadData(page);
    } catch (err: any) {
      setDialogError(err?.message || 'Không thể xác nhận đã nhận tiền lúc này.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitDispute = async (skipBankWarning = false) => {
    if (!disputingItem) return;
    if (!disputeDesc.trim()) {
      setDialogError('Vui lòng nhập mô tả chi tiết sự cố gặp phải.');
      return;
    }
    if (!skipBankWarning && disputeType === 'NOT_RECEIVED') {
      setDialogError(null);
      setShowNotReceivedWarning(true);
      return;
    }
    setShowNotReceivedWarning(false);
    setActionBusy(true);
    setDialogError(null);
    try {
      await walletService.reportWithdrawalIssue(
        disputingItem.id,
        disputeType,
        disputeDesc.trim(),
        disputeEvidenceUrls,
      );
      notify(
        `Đã gửi báo cáo sự cố cho lệnh #${disputingItem.requestCode || disputingItem.id.slice(0, 8)}.`,
      );
      setDisputingItem(null);
      setDisputeDesc('');
      setDisputeEvidenceUrls([]);
      await loadData(page);
    } catch (err: any) {
      setDialogError(err?.message || 'Không thể gửi báo cáo sự cố. Vui lòng thử lại.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitException = async () => {
    if (!exceptionItem) return;
    if (!exceptionReason.trim()) {
      setDialogError('Vui lòng nhập lý do yêu cầu hỗ trợ ngoại lệ.');
      return;
    }
    setActionBusy(true);
    setDialogError(null);
    try {
      await walletService.requestWithdrawalException(
        exceptionItem.id,
        exceptionReason.trim(),
        exceptionEvidenceUrls,
      );
      notify(
        `Đã gửi yêu cầu hỗ trợ ngoại lệ cho lệnh #${exceptionItem.requestCode || exceptionItem.id.slice(0, 8)}.`,
      );
      setExceptionItem(null);
      setExceptionReason('');
      setExceptionEvidenceUrls([]);
      await loadData(page);
    } catch (err: any) {
      setDialogError(err?.message || 'Không thể gửi yêu cầu hỗ trợ ngoại lệ.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUploadPhoto = async (
    file: File | undefined,
    target: 'dispute' | 'exception',
  ) => {
    if (!file) return;
    if (target === 'dispute') setUploadingDisputePhoto(true);
    else setUploadingExceptionPhoto(true);
    setDialogError(null);
    try {
      const folder =
        target === 'dispute'
          ? 'secondlife/withdrawals/disputes'
          : 'secondlife/withdrawals/exceptions';
      const uploaded = await mediaService.uploadImage(file, folder);
      const url = uploaded?.url || (uploaded as any)?.secureUrl || '';
      if (!url) throw new Error('Không nhận được đường dẫn ảnh từ máy chủ.');
      if (target === 'dispute') {
        setDisputeEvidenceUrls((prev) => [...prev.slice(0, 2), url]);
      } else {
        setExceptionEvidenceUrls((prev) => [...prev.slice(0, 2), url]);
      }
    } catch (err: any) {
      setDialogError(err?.message || 'Tải ảnh minh chứng thất bại.');
    } finally {
      if (target === 'dispute') setUploadingDisputePhoto(false);
      else setUploadingExceptionPhoto(false);
    }
  };

  const totalBalance = availableBalance + reservedBalance;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#24263e] tracking-tight">
              Lịch sử rút tiền về ngân hàng
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tiến độ chuyển khoản, xem ảnh biên lai, xác nhận nhận tiền hoặc báo cáo sự cố trong 48 giờ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void loadData(page)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateWithdrawal}
            className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Tạo yêu cầu rút tiền</span>
          </button>
        </div>
      </div>

      {/* Wallet Balance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#24263e] text-white shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-white/75 font-semibold">
            <span>Số dư khả dụng</span>
            <Wallet className="w-4 h-4 text-[#fce5da]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1.5">
            {formatVND(availableBalance)}
          </div>
          <div className="text-[11px] text-white/70 mt-1">
            Có thể rút về tài khoản ngân hàng ngay
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Đang tạm giữ / chờ chuyển</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-800 mt-1.5">
            {formatVND(reservedBalance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tiền của các lệnh rút đang chờ nhân viên xử lý
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Tổng số dư ví</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-[#24263e] mt-1.5">
            {formatVND(totalBalance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng số yêu cầu rút tiền: <strong>{totalElements}</strong>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {(
            [
              { id: 'ALL', label: `Tất cả (${counts.ALL})` },
              { id: 'PENDING', label: `Chờ tiếp nhận (${counts.PENDING})` },
              { id: 'PROCESSING', label: `Đang chuyển (${counts.PROCESSING})` },
              {
                id: 'TRANSFERRED_AWAITING_REVIEW',
                label: `Chờ xác nhận 48h (${counts.TRANSFERRED_AWAITING_REVIEW})`,
              },
              { id: 'DISPUTED', label: `Báo cáo sự cố (${counts.DISPUTED})` },
              { id: 'COMPLETED', label: `Hoàn tất (${counts.COMPLETED})` },
              { id: 'CLOSED_NEGATIVE', label: `Từ chối / Hủy (${counts.CLOSED_NEGATIVE})` },
            ] as { id: FilterKey; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${statusFilter === tab.id
                ? 'bg-[#24263e] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm mã lệnh, ngân hàng, STK..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#24263e]/20 focus:border-[#24263e]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#c34c36]" />
          <span className="text-xs font-semibold">Đang tải danh sách yêu cầu rút tiền...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-2.5">
          <Wallet className="w-10 h-10 text-slate-300" />
          <div className="text-sm font-bold text-slate-700">Chưa có yêu cầu rút tiền nào</div>
          <p className="text-xs text-slate-500 max-w-md">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Không có yêu cầu rút tiền nào khớp với bộ lọc hiện tại.'
              : 'Bạn có thể tạo yêu cầu rút số dư khả dụng về tài khoản ngân hàng bất kỳ lúc nào.'}
          </p>
          <button
            type="button"
            onClick={onOpenCreateWithdrawal}
            className="mt-1 px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold transition cursor-pointer"
          >
            Tạo yêu cầu rút tiền ngay
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const remainingSecs = computeRemainingSeconds(item, fetchedAtMs, nowMs);
            const isWithin48h =
              item.status === 'TRANSFERRED_AWAITING_REVIEW' &&
              remainingSecs !== null &&
              remainingSecs > 0;
            const remainingLabel = formatRemaining48h(remainingSecs);
            const historyEvents = historyById[item.id] || [];
            const evidenceSrc = evidenceBlobById[item.id];
            const outcomeLabel = item.disputeResolutionOutcome
              ? WITHDRAWAL_RESOLUTION_OUTCOMES.find(
                (o) => o.code === item.disputeResolutionOutcome,
              )?.label || item.disputeResolutionOutcome
              : null;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
              >
                <div className="p-4 sm:p-5 space-y-3">
                  {/* Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#24263e]">
                        #{item.requestCode || item.id.slice(0, 8)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(
                          item.status,
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString('vi-VN')
                          : '—'}
                      </span>
                    </div>

                    <div className="text-lg font-black font-mono text-[#c34c36]">
                      {formatVND(item.amount)}
                    </div>
                  </div>

                  {/* Bank Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-start gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">
                          {item.bankName || item.bankCode} ({item.bankCode})
                        </div>
                        <div className="text-slate-600 font-mono text-[11px] mt-0.5">
                          STK: <strong>{item.accountNumber}</strong> · Chủ TK:{' '}
                          <strong className="uppercase">{item.accountHolderName}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(item)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1 self-start sm:self-center cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Contextual Notices */}
                  {isWithin48h && remainingLabel && (
                    <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>
                        {remainingLabel}. Vui lòng kiểm tra tài khoản ngân hàng và xác nhận nếu đã nhận đủ tiền.
                      </span>
                    </div>
                  )}

                  {item.adminNote && (
                    <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">Ghi chú xử lý:</span>{' '}
                      {item.adminNote}
                    </div>
                  )}

                  {item.exceptionRequestedAt && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs space-y-1">
                      <div className="font-bold">
                        Đã gửi yêu cầu hỗ trợ ngoại lệ (
                        {new Date(item.exceptionRequestedAt).toLocaleString('vi-VN')})
                      </div>
                      {item.exceptionReason && <div>{item.exceptionReason}</div>}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {item.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDialogError(null);
                          setCancellingItem(item);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
                      >
                        Hủy yêu cầu rút tiền
                      </button>
                    )}

                    {isWithin48h && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDialogError(null);
                            setDisputeType(WITHDRAWAL_DISPUTE_TYPES[0].code);
                            setDisputeDesc('');
                            setDisputeEvidenceUrls([]);
                            setDisputingItem(item);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition cursor-pointer"
                        >
                          Báo cáo sự cố
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDialogError(null);
                            setConfirmingReceiptItem(item);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          Xác nhận đã nhận tiền
                        </button>
                      </>
                    )}

                    {['DISPUTED', 'DISPUTE_PROCESSING'].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDialogError(null);
                          setConfirmingReceiptItem(item);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Đóng báo cáo & đã nhận tiền
                      </button>
                    )}

                    {item.status === 'COMPLETED' && !item.exceptionRequestedAt && (
                      <button
                        type="button"
                        onClick={() => {
                          setDialogError(null);
                          setExceptionReason('');
                          setExceptionEvidenceUrls([]);
                          setExceptionItem(item);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Hỗ trợ ngoại lệ</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 text-xs">
                    {item.disputeType && (
                      <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 space-y-1">
                        <div className="font-bold text-orange-900">
                          Báo cáo sự cố:{' '}
                          {WITHDRAWAL_DISPUTE_TYPES.find((t) => t.code === item.disputeType)
                            ?.label || item.disputeType}
                        </div>
                        {item.disputeDescription && (
                          <div className="text-orange-950">{item.disputeDescription}</div>
                        )}
                        {outcomeLabel && (
                          <div className="pt-1.5 border-t border-orange-200 text-emerald-900 font-semibold">
                            Kết quả xử lý: {outcomeLabel}
                            {item.disputeResolution ? ` — ${item.disputeResolution}` : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {item.evidenceUrl && (
                      <div className="space-y-2">
                        <div className="font-bold text-slate-800">
                          Ảnh minh chứng chuyển khoản từ SecondLife:
                        </div>
                        {evidenceSrc ? (
                          <button
                            type="button"
                            onClick={() => setZoomedEvidenceUrl(evidenceSrc)}
                            className="group relative rounded-xl overflow-hidden border border-slate-300 bg-white cursor-pointer"
                          >
                            <img
                              src={evidenceSrc}
                              alt="Ảnh minh chứng chuyển khoản"
                              className="max-h-56 object-contain"
                            />
                            <span className="block bg-slate-900/75 text-white text-[10px] font-bold py-1 text-center">
                              Bấm để phóng to ảnh biên lai
                            </span>
                          </button>
                        ) : (
                          <div className="text-slate-400 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang tải ảnh minh chứng...</span>
                          </div>
                        )}
                      </div>
                    )}

                    <WithdrawalStatusTimeline events={historyEvents} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500 font-medium">
                Trang {page + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0 || loading}
                  onClick={() => void loadData(page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages || loading}
                  onClick={() => void loadData(page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Dialog */}
      {cancellingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              Xác nhận hủy yêu cầu rút tiền?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Yêu cầu rút{' '}
              <strong>{formatVND(cancellingItem.amount)}</strong> (#
              {cancellingItem.requestCode || cancellingItem.id.slice(0, 8)}) sẽ bị hủy và số tiền sẽ
              được hoàn trả ngay về số dư khả dụng của ví.
            </p>
            {dialogError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {dialogError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setCancellingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleConfirmCancel()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận hủy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Receipt / Close Dispute Dialog */}
      {confirmingReceiptItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              {['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status)
                ? 'Đóng báo cáo và xác nhận đã nhận tiền?'
                : 'Xác nhận đã nhận đủ tiền?'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status) ? (
                <>
                  Bạn đã nhận được đủ{' '}
                  <strong>{formatVND(confirmingReceiptItem.amount)}</strong> vào tài khoản{' '}
                  <strong>
                    {confirmingReceiptItem.bankName || confirmingReceiptItem.bankCode} (
                    {confirmingReceiptItem.accountNumber})
                  </strong>{' '}
                  và muốn đóng báo cáo sự cố để hoàn tất yêu cầu rút tiền này?
                </>
              ) : (
                <>
                  Bạn xác nhận đã nhận đủ{' '}
                  <strong>{formatVND(confirmingReceiptItem.amount)}</strong> vào tài khoản{' '}
                  <strong>
                    {confirmingReceiptItem.bankName || confirmingReceiptItem.bankCode} (
                    {confirmingReceiptItem.accountNumber})
                  </strong>
                  ? Sau khi xác nhận, lệnh rút tiền sẽ chuyển sang Hoàn tất.
                </>
              )}
            </p>
            {dialogError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {dialogError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmingReceiptItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleConfirmReceipt()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status)
                    ? 'Đóng báo cáo & xác nhận'
                    : 'Xác nhận đã nhận tiền'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Dispute Dialog */}
      {disputingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                Báo cáo sự cố chuyển khoản
              </h3>
              <button
                type="button"
                onClick={() => setDisputingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại sự cố:</label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  {WITHDRAWAL_DISPUTE_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mô tả chi tiết (Bắt buộc):
                </label>
                <textarea
                  rows={3}
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  placeholder="Mô tả rõ vấn đề gặp phải (không nhập mật khẩu hay mã OTP ngân hàng)..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1.5">
                  Ảnh minh chứng sao kê (tối đa 3 ảnh, không bắt buộc):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {disputeEvidenceUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <img
                        src={url}
                        alt={`Bằng chứng ${idx + 1}`}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDisputeEvidenceUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {disputeEvidenceUrls.length < 3 && (
                    <>
                      <label className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
                        {uploadingDisputePhoto ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingDisputePhoto}
                          className="hidden"
                          onChange={(e) => {
                            void handleUploadPhoto(e.target.files?.[0], 'dispute');
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setMobileQrTarget('dispute')}
                        className="px-3 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tải từ điện thoại (QR)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {dialogError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {dialogError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDisputingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={actionBusy || uploadingDisputePhoto}
                onClick={() => void handleSubmitDispute()}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi báo cáo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Dispute Bank Processing Warning Popup */}
      {showNotReceivedWarning && disputingItem && (
        <div className="fixed inset-0 z-[55] bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-slate-900">
                  Lưu ý thời gian xử lý giao dịch ngân hàng
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Có thể ngân hàng đang xử lý giao dịch, vui lòng chờ thêm hoặc xác nhận báo cáo lỗi.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setShowNotReceivedWarning(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Chờ thêm
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleSubmitDispute(true)}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận báo cáo lỗi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Support Dialog */}
      {exceptionItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                Yêu cầu hỗ trợ ngoại lệ
              </h3>
              <button
                type="button"
                onClick={() => setExceptionItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Áp dụng cho giao dịch đã hoàn tất nhưng cần đối soát thủ công bổ sung với ngân hàng.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lý do cần hỗ trợ ngoại lệ (Bắt buộc):
              </label>
              <textarea
                rows={3}
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="Nhập chi tiết vấn đề cần bộ phận vận hành hỗ trợ..."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <div className="font-bold text-slate-700 mb-1.5">
                Ảnh minh chứng bổ sung (tối đa 3 ảnh, không bắt buộc):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {exceptionEvidenceUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative">
                    <img
                      src={url}
                      alt={`Ảnh ngoại lệ ${idx + 1}`}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExceptionEvidenceUrls((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {exceptionEvidenceUrls.length < 3 && (
                  <>
                    <label className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
                      {uploadingExceptionPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Thêm ảnh</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadingExceptionPhoto}
                        className="hidden"
                        onChange={(e) => {
                          void handleUploadPhoto(e.target.files?.[0], 'exception');
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setMobileQrTarget('exception')}
                      className="px-3 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Tải từ điện thoại (QR)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {dialogError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {dialogError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setExceptionItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={actionBusy || uploadingExceptionPhoto}
                onClick={() => void handleSubmitException()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi yêu cầu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile QR Evidence Upload Modal */}
      {mobileQrTarget &&
        (mobileQrTarget === 'dispute' ? disputingItem : exceptionItem) && (
          <MobileEvidenceQrModal
            withdrawal={(mobileQrTarget === 'dispute' ? disputingItem : exceptionItem)!}
            mode="user"
            purpose={mobileQrTarget === 'dispute' ? 'USER_DISPUTE' : 'USER_EXCEPTION'}
            maxFiles={Math.max(
              1,
              3 -
              (mobileQrTarget === 'dispute'
                ? disputeEvidenceUrls.length
                : exceptionEvidenceUrls.length),
            )}
            onClose={() => setMobileQrTarget(null)}
            onImagesSync={(newUrls) => {
              if (!newUrls.length) return;
              const merge = (prev: string[]) => {
                const next = [...prev];
                for (const url of newUrls) {
                  if (url && !next.includes(url) && next.length < 3) {
                    next.push(url);
                  }
                }
                return next;
              };
              if (mobileQrTarget === 'dispute') {
                setDisputeEvidenceUrls(merge);
              } else {
                setExceptionEvidenceUrls(merge);
              }
            }}
            onUploaded={(_url, urls) => {
              if (urls && urls.length > 0) {
                const merge = (prev: string[]) => {
                  const next = [...prev];
                  for (const url of urls) {
                    if (url && !next.includes(url) && next.length < 3) {
                      next.push(url);
                    }
                  }
                  return next;
                };
                if (mobileQrTarget === 'dispute') {
                  setDisputeEvidenceUrls(merge);
                } else {
                  setExceptionEvidenceUrls(merge);
                }
              }
              setMobileQrTarget(null);
              notify('Đã nhận ảnh minh chứng từ điện thoại.');
            }}
          />
        )}

      {/* Zoomed Evidence Lightbox */}
      {zoomedEvidenceUrl && (
        <div
          onClick={() => setZoomedEvidenceUrl(null)}
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setZoomedEvidenceUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedEvidenceUrl}
              alt="Ảnh minh chứng chuyển khoản phóng to"
              className="max-w-full max-h-[84vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
