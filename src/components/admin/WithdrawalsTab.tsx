import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  CreditCard,
  Calendar,
  Check,
  X,
  Loader2,
  Upload,
  Copy,
  Eye,
  History,
  RotateCcw,
  ShieldAlert,
  Send,
  FileText,
  Smartphone,
} from 'lucide-react';
import { MobileEvidenceQrModal } from './MobileEvidenceQrModal';
import { WithdrawalStatusTimeline } from '../wallet/WithdrawalStatusTimeline';
import { withdrawalBanks } from '../../services/withdrawalBanks';
import {
  walletService,
  WalletWithdrawalResponseDto,
  WalletWithdrawalStatusHistoryItem,
  WITHDRAWAL_DISPUTE_TYPES,
  getDefaultWithdrawalEvidenceMaxBytes,
  formatEvidenceSizeLimit,
} from '../../services/walletService';
import { formatVND } from '../../utils/translations';
import { Language, UserProfile } from '../../types';

interface WithdrawalsTabProps {
  lang?: Language;
  onNotice?: (msg: string) => void;
  currentUser?: UserProfile | null;
  portalMode?: 'admin' | 'staff';
  onPendingCountChange?: (count: number) => void;
}

const ACTIONABLE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'TRANSFER_FAILED',
  'DISPUTED',
  'DISPUTE_PROCESSING',
];

function getStatusMeta(status: string) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Chờ tiếp nhận',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'PROCESSING':
      return {
        label: 'Đang xử lý chuyển khoản',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      };
    case 'TRANSFER_FAILED':
      return {
        label: 'Chuyển khoản thất bại',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'TRANSFERRED_AWAITING_REVIEW':
      return {
        label: 'Đã chuyển - chờ đối soát',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      };
    case 'DISPUTED':
      return {
        label: 'Có báo cáo lỗi',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
      };
    case 'DISPUTE_PROCESSING':
      return {
        label: 'Đang xác minh báo cáo',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    case 'DISPUTE_RESOLVED':
      return {
        label: 'Đã giải quyết báo cáo',
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
      };
    case 'COMPLETED':
      return {
        label: 'Hoàn tất',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'REJECTED':
      return {
        label: 'Đã từ chối',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'CANCELLED':
      return {
        label: 'Người dùng đã hủy',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      };
    default:
      return {
        label: status || 'Không xác định',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

function getDisputeTypeLabel(code?: string | null) {
  if (!code) return '—';
  const normalized = code.trim().toUpperCase();
  const matched = WITHDRAWAL_DISPUTE_TYPES.find((t) => t.code.toUpperCase() === normalized);
  return matched ? matched.label : code;
}

function getDisputeOutcomeLabel(outcome?: string | null) {
  switch (outcome) {
    case 'RESOLVED_VALID_TRANSFER':
      return 'Xác minh chuyển khoản hợp lệ';
    case 'RESOLVED_RETRY_TRANSFER':
      return 'Chấp nhận chuyển khoản lại';
    case 'RESOLVED_REFUND_TO_WALLET':
      return 'Hoàn tiền về số dư khả dụng';
    default:
      return outcome || '—';
  }
}

function getOwnerRoleLabel(role?: string | null) {
  switch ((role || '').toUpperCase()) {
    case 'BUYER':
      return 'Người mua';
    case 'SELLER':
      return 'Người bán';
    case 'INSPECTION_CENTER':
      return 'Trung tâm kiểm định';
    case 'INSPECTOR':
      return 'Kỹ thuật viên';
    default:
      return role || 'Thành viên';
  }
}

function buildVietQrUrl(item: WalletWithdrawalResponseDto): string | null {
  const matched = withdrawalBanks.find(
    (b) =>
      b.code.toUpperCase() === (item.bankCode || '').toUpperCase() ||
      b.bin === item.bankCode,
  );
  if (!matched) return null;
  const bankId = matched.bin || matched.code;
  const addInfo = item.requestCode || item.id;
  return `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(
    item.accountNumber,
  )}-compact2.png?amount=${encodeURIComponent(String(Math.round(Number(item.amount) || 0)))}&addInfo=${encodeURIComponent(
    addInfo,
  )}&accountName=${encodeURIComponent(item.accountHolderName || '')}`;
}

export const WithdrawalsTab: React.FC<WithdrawalsTabProps> = ({
  lang = 'vi',
  onNotice,
  currentUser,
  portalMode = 'admin',
  onPendingCountChange,
}) => {
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawalResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [listError, setListError] = useState<string | null>(null);

  // Detail & processing modal state
  const [detailItem, setDetailItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [detailHistory, setDetailHistory] = useState<WalletWithdrawalStatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [evidenceBlobUrl, setEvidenceBlobUrl] = useState<string | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState<boolean>(false);
  const [uploadingEvidence, setUploadingEvidence] = useState<boolean>(false);
  const [zoomedEvidenceUrl, setZoomedEvidenceUrl] = useState<string | null>(null);
  const [showMobileQrModal, setShowMobileQrModal] = useState<boolean>(false);
  const [evidenceRefreshKey, setEvidenceRefreshKey] = useState<number>(0);
  const [maxEvidenceFileSizeBytes, setMaxEvidenceFileSizeBytes] = useState<number>(() =>
    getDefaultWithdrawalEvidenceMaxBytes(),
  );

  // Action form state inside modal
  const [actionNote, setActionNote] = useState<string>('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const actionNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const [transferConfirmedCheck, setTransferConfirmedCheck] = useState<boolean>(false);
  const [disputeOutcome, setDisputeOutcome] = useState<
    'RESOLVED_VALID_TRANSFER' | 'RESOLVED_RETRY_TRANSFER' | 'RESOLVED_REFUND_TO_WALLET'
  >('RESOLVED_VALID_TRANSFER');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const notify = useCallback(
    (msg: string) => {
      if (onNotice) onNotice(msg);
    },
    [onNotice],
  );

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await walletService.getAdminWithdrawals('ALL', 0, 200);
      const items = res.items || [];
      setWithdrawals(items);
      if (onPendingCountChange) {
        const actionable = items.filter((w) => ACTIONABLE_STATUSES.includes(w.status)).length;
        onPendingCountChange(actionable);
      }
      setDetailItem((prev) => {
        if (!prev) return null;
        return items.find((row) => row.id === prev.id) || prev;
      });
    } catch (err: any) {
      console.error('Failed to load withdrawals:', err);
      const message =
        err?.message || 'Không thể tải danh sách yêu cầu rút tiền từ máy chủ.';
      setListError(message);
      notify(message);
    } finally {
      setLoading(false);
    }
  }, [notify, onPendingCountChange]);

  useEffect(() => {
    void fetchWithdrawals();
  }, [fetchWithdrawals]);

  useEffect(() => {
    let cancelled = false;
    walletService
      .getMobileUploadNetworkInfo()
      .then((info) => {
        if (
          !cancelled &&
          typeof info?.maxEvidenceFileSizeBytes === 'number' &&
          info.maxEvidenceFileSizeBytes > 0
        ) {
          setMaxEvidenceFileSizeBytes(info.maxEvidenceFileSizeBytes);
        }
      })
      .catch(() => {
        // Fallback to VITE_WITHDRAWAL_EVIDENCE_MAX_FILE_SIZE_BYTES / default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load status history and evidence image when detailItem changes
  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;

    if (!detailItem) {
      setDetailHistory([]);
      setEvidenceBlobUrl(null);
      return;
    }

    setLoadingHistory(true);
    walletService
      .getAdminWithdrawalHistory(detailItem.id)
      .then((history) => {
        if (!cancelled) setDetailHistory(history);
      })
      .catch(() => {
        if (!cancelled) setDetailHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    if (detailItem.evidenceUrl) {
      setLoadingEvidence(true);
      walletService
        .fetchWithdrawalEvidenceBlobUrl(detailItem.evidenceUrl)
        .then((blobUrl) => {
          if (cancelled) {
            URL.revokeObjectURL(blobUrl);
            return;
          }
          createdBlobUrl = blobUrl;
          setEvidenceBlobUrl(blobUrl);
        })
        .catch(() => {
          if (!cancelled) setEvidenceBlobUrl(null);
        })
        .finally(() => {
          if (!cancelled) setLoadingEvidence(false);
        });
    } else {
      setEvidenceBlobUrl(null);
      setLoadingEvidence(false);
    }

    return () => {
      cancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [detailItem?.id, detailItem?.evidenceUrl, detailItem?.status, evidenceRefreshKey]);

  const openDetailModal = (item: WalletWithdrawalResponseDto) => {
    setDetailItem(item);
    setActionNote('');
    setNoteError(null);
    setTransferConfirmedCheck(false);
    setDisputeOutcome('RESOLVED_VALID_TRANSFER');
    setModalError(null);
  };

  const closeDetailModal = () => {
    setDetailItem(null);
    setModalError(null);
    setNoteError(null);
    setTransferConfirmedCheck(false);
    setZoomedEvidenceUrl(null);
    setShowMobileQrModal(false);
  };

  const handleCopy = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField((prev) => (prev === label ? null : prev)), 1800);
    } catch {
      notify('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  // Stats across all loaded withdrawals
  const pendingItems = useMemo(
    () => withdrawals.filter((w) => w.status === 'PENDING'),
    [withdrawals],
  );
  const processingItems = useMemo(
    () => withdrawals.filter((w) => w.status === 'PROCESSING'),
    [withdrawals],
  );
  const transferFailedItems = useMemo(
    () => withdrawals.filter((w) => w.status === 'TRANSFER_FAILED'),
    [withdrawals],
  );
  const awaitingReviewItems = useMemo(
    () => withdrawals.filter((w) => w.status === 'TRANSFERRED_AWAITING_REVIEW'),
    [withdrawals],
  );
  const disputedItems = useMemo(
    () =>
      withdrawals.filter((w) =>
        ['DISPUTED', 'DISPUTE_PROCESSING'].includes(w.status),
      ),
    [withdrawals],
  );
  const completedItems = useMemo(
    () =>
      withdrawals.filter((w) =>
        ['COMPLETED', 'DISPUTE_RESOLVED'].includes(w.status),
      ),
    [withdrawals],
  );
  const rejectedItems = useMemo(
    () => withdrawals.filter((w) => w.status === 'REJECTED'),
    [withdrawals],
  );

  const pendingAmount = useMemo(
    () =>
      [...pendingItems, ...processingItems, ...transferFailedItems].reduce(
        (sum, w) => sum + (Number(w.amount) || 0),
        0,
      ),
    [pendingItems, processingItems, transferFailedItems],
  );

  const filteredWithdrawals = useMemo(() => {
    let list = withdrawals;
    if (statusFilter !== 'ALL') {
      list = list.filter((w) => w.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (w) =>
          (w.requestCode && w.requestCode.toLowerCase().includes(term)) ||
          (w.userEmail && w.userEmail.toLowerCase().includes(term)) ||
          (w.ownerRole && w.ownerRole.toLowerCase().includes(term)) ||
          (w.accountNumber && w.accountNumber.toLowerCase().includes(term)) ||
          (w.accountHolderName && w.accountHolderName.toLowerCase().includes(term)) ||
          (w.bankCode && w.bankCode.toLowerCase().includes(term)) ||
          (w.bankName && w.bankName.toLowerCase().includes(term)) ||
          (w.id && w.id.toLowerCase().includes(term)),
      );
    }
    return list;
  }, [withdrawals, statusFilter, searchTerm]);

  const executeAction = async (
    item: WalletWithdrawalResponseDto,
    action: string,
    options?: {
      note?: string;
      disputeResolutionOutcome?: string;
      openDetailAfter?: boolean;
      successMessage?: string;
    },
  ) => {
    setSubmittingAction(action);
    setModalError(null);
    setListError(null);
    try {
      const updated = await walletService.reviewWithdrawal(
        item.id,
        action,
        options?.note ?? actionNote.trim(),
        options?.disputeResolutionOutcome
          ? { disputeResolutionOutcome: options.disputeResolutionOutcome }
          : undefined,
      );
      setWithdrawals((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      if (options?.openDetailAfter || detailItem?.id === updated.id) {
        setDetailItem(updated);
        setActionNote('');
        setTransferConfirmedCheck(false);
      }
      if (options?.successMessage) {
        notify(options.successMessage);
      }
      await fetchWithdrawals();
    } catch (err: any) {
      const message =
        err?.message || 'Không thể thực hiện thao tác xử lý lệnh rút tiền.';
      setModalError(message);
      if (!detailItem) {
        setListError(message);
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleEvidenceUpload = async (
    item: WalletWithdrawalResponseDto,
    file?: File,
  ) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setModalError('Chỉ hỗ trợ ảnh minh chứng định dạng JPEG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > maxEvidenceFileSizeBytes) {
      setModalError(
        `Ảnh minh chứng không được vượt quá ${formatEvidenceSizeLimit(maxEvidenceFileSizeBytes)}.`,
      );
      return;
    }
    setUploadingEvidence(true);
    setModalError(null);
    try {
      const saved = await walletService.uploadWithdrawalEvidence(item.id, file);
      setWithdrawals((current) =>
        current.map((row) => (row.id === item.id ? saved : row)),
      );
      setDetailItem(saved);
      notify(
        `Đã tải ảnh minh chứng chuyển khoản cho lệnh #${saved.requestCode || saved.id.slice(0, 8)}.`,
      );
    } catch (err: any) {
      setModalError(err?.message || 'Tải ảnh minh chứng thất bại.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleConfirmTransfer = async (item: WalletWithdrawalResponseDto) => {
    if (!item.evidenceUrl) {
      setModalError(
        'Vui lòng tải ảnh biên lai/minh chứng chuyển khoản trước khi xác nhận.',
      );
      return;
    }
    if (!transferConfirmedCheck) {
      setModalError(
        'Vui lòng tích chọn xác nhận đã đối chiếu đúng thông tin ngân hàng và số tiền chuyển.',
      );
      return;
    }
    await executeAction(item, 'CONFIRM_TRANSFER', {
      note: actionNote.trim() || 'Đã chuyển khoản thủ công thành công',
      successMessage: `Đã xác nhận chuyển khoản ${formatVND(item.amount)} cho lệnh #${item.requestCode || item.id.slice(0, 8)}.`,
    });
  };

  const focusRequiredNote = (message: string) => {
    setNoteError(message);
    setModalError(message);
    window.requestAnimationFrame(() => {
      actionNoteRef.current?.focus();
      actionNoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleMarkTransferFailed = async (item: WalletWithdrawalResponseDto) => {
    if (!actionNote.trim()) {
      focusRequiredNote('Vui lòng nhập nguyên nhân chuyển khoản thất bại vào ô ghi chú.');
      return;
    }
    setNoteError(null);
    await executeAction(item, 'TRANSFER_FAILED', {
      note: actionNote.trim(),
      successMessage: `Đã ghi nhận chuyển khoản thất bại cho lệnh #${item.requestCode || item.id.slice(0, 8)}.`,
    });
  };

  const handleReject = async (item: WalletWithdrawalResponseDto) => {
    if (!actionNote.trim()) {
      focusRequiredNote('Vui lòng nhập lý do từ chối yêu cầu rút tiền vào ô ghi chú.');
      return;
    }
    setNoteError(null);
    await executeAction(item, 'REJECT', {
      note: actionNote.trim(),
      successMessage: `Đã từ chối lệnh #${item.requestCode || item.id.slice(0, 8)} và hoàn tiền về số dư khả dụng.`,
    });
  };

  const handleResolveDispute = async (item: WalletWithdrawalResponseDto) => {
    if (!actionNote.trim()) {
      focusRequiredNote('Vui lòng nhập kết luận đối soát khi giải quyết báo cáo lỗi.');
      return;
    }
    setNoteError(null);
    await executeAction(item, 'RESOLVE_DISPUTE', {
      note: actionNote.trim(),
      disputeResolutionOutcome: disputeOutcome,
      successMessage: `Đã xử lý báo cáo lỗi cho lệnh #${item.requestCode || item.id.slice(0, 8)}.`,
    });
  };

  const isAssignedToAnotherStaff = (item: WalletWithdrawalResponseDto) => {
    if (portalMode === 'admin') return false;
    if (!item.acceptedBy || !currentUser?.id) return false;
    return item.acceptedBy !== currentUser.id;
  };

  const qrUrl = detailItem ? buildVietQrUrl(detailItem) : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#24263e] to-[#c34c36] text-white flex items-center justify-center shadow-xs shrink-0">
            <Send className="w-5 h-5 text-[#fce5da]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {portalMode === 'staff'
                ? lang === 'vi'
                  ? 'XỬ LÝ CHUYỂN KHOẢN RÚT TIỀN VÍ'
                  : 'STAFF WITHDRAWAL TRANSFER PROCESSING'
                : lang === 'vi'
                  ? 'QUẢN LÝ & PHÊ DUYỆT RÚT TIỀN VÍ'
                  : 'WALLET WITHDRAWAL REQUESTS'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'vi'
                ? 'Tiếp nhận yêu cầu, đối chiếu tài khoản ngân hàng, quét VietQR, tải ảnh biên lai và xác nhận chuyển khoản thủ công'
                : 'Claim requests, verify beneficiary bank info, upload transfer proof, and confirm manual bank transfers'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchWithdrawals()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              Chờ tiếp nhận
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-200/60 text-amber-900 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-2 font-mono">
            {pendingItems.length}
          </div>
          <div className="text-[11px] font-semibold text-amber-800/80 mt-1">
            Tổng tiền chờ chuyển:{' '}
            <strong className="text-amber-950">{formatVND(pendingAmount)}</strong>
          </div>
        </div>

        <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">
              Đang xử lý / Lỗi CK
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-200/60 text-sky-900 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-950 mt-2 font-mono">
            {processingItems.length + transferFailedItems.length}
          </div>
          <div className="text-[11px] font-semibold text-sky-800/80 mt-1">
            Đang CK: <strong>{processingItems.length}</strong> · Lỗi CK:{' '}
            <strong className="text-rose-700">{transferFailedItems.length}</strong>
          </div>
        </div>

        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">
              Chờ đối soát / Báo cáo
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-200/60 text-orange-900 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-orange-950 mt-2 font-mono">
            {awaitingReviewItems.length + disputedItems.length}
          </div>
          <div className="text-[11px] font-semibold text-orange-800/80 mt-1">
            Chờ 48h: <strong>{awaitingReviewItems.length}</strong> · Khiếu nại:{' '}
            <strong className="text-rose-700">{disputedItems.length}</strong>
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              Đã hoàn tất / Từ chối
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-200/60 text-emerald-900 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2 font-mono">
            {completedItems.length}
          </div>
          <div className="text-[11px] font-semibold text-emerald-800/80 mt-1">
            Từ chối: <strong className="text-rose-700">{rejectedItems.length}</strong> · Tổng:{' '}
            <strong>{withdrawals.length}</strong>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'ALL', label: `Tất cả (${withdrawals.length})` },
            { id: 'PENDING', label: `Chờ nhận (${pendingItems.length})` },
            { id: 'PROCESSING', label: `Đang chuyển (${processingItems.length})` },
            {
              id: 'TRANSFER_FAILED',
              label: `Lỗi CK (${transferFailedItems.length})`,
            },
            {
              id: 'TRANSFERRED_AWAITING_REVIEW',
              label: `Chờ đối soát (${awaitingReviewItems.length})`,
            },
            { id: 'DISPUTED', label: `Có báo cáo (${withdrawals.filter((w) => w.status === 'DISPUTED').length})` },
            {
              id: 'DISPUTE_PROCESSING',
              label: `Đang xác minh (${withdrawals.filter((w) => w.status === 'DISPUTE_PROCESSING').length})`,
            },
            { id: 'COMPLETED', label: `Hoàn tất (${withdrawals.filter((w) => w.status === 'COMPLETED').length})` },
            { id: 'REJECTED', label: `Từ chối (${rejectedItems.length})` },
          ].map((tab) => (
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

        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm mã lệnh, email, tên chủ TK, STK, ngân hàng..."
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

      {listError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{listError}</span>
        </div>
      )}

      {/* Withdrawals Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden min-w-0">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#c34c36]" />
            <span className="text-xs font-semibold">
              Đang tải danh sách yêu cầu rút tiền...
            </span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Wallet className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-bold text-slate-600">
              Không tìm thấy yêu cầu rút tiền nào
            </span>
            <span className="text-[11px] text-slate-400">
              {searchTerm
                ? 'Thử tìm kiếm bằng từ khóa khác'
                : 'Chưa có yêu cầu rút tiền phù hợp với bộ lọc hiện tại'}
            </span>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[10.5px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Mã lệnh / Ngày tạo</th>
                  <th className="py-3 px-3">Chủ ví</th>
                  <th className="py-3 px-3">Số tiền</th>
                  <th className="py-3 px-3">Tài khoản nhận</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3">Ghi chú</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.map((item) => {
                  const statusMeta = getStatusMeta(item.status);
                  const canQuickClaim =
                    item.status === 'PENDING' || item.status === 'TRANSFER_FAILED';
                  const assignedOther = isAssignedToAnotherStaff(item);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition align-top">
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          #{item.requestCode || item.id?.substring(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString('vi-VN')
                              : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 max-w-[170px]">
                        <div
                          className="font-semibold text-slate-900 truncate"
                          title={item.userEmail || ''}
                        >
                          {item.userEmail || 'Chưa có email'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-indigo-700 font-bold">
                            {getOwnerRoleLabel(item.ownerRole)}
                          </span>
                          {item.exceptionRequestedAt && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                              Ngoại lệ
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-sm font-black text-[#c34c36] font-mono">
                          {formatVND(item.amount)}
                        </div>
                      </td>

                      <td className="py-3 px-3 max-w-[175px]">
                        <div className="font-bold text-slate-900 uppercase flex items-center gap-1 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={item.bankName || item.bankCode}>
                            {item.bankName || item.bankCode}
                          </span>
                        </div>
                        <div className="font-mono text-slate-700 text-[11px] font-semibold truncate" title={item.accountNumber}>
                          STK: {item.accountNumber}
                        </div>
                        <div
                          className="text-[10.5px] text-slate-500 font-medium uppercase truncate"
                          title={item.accountHolderName}
                        >
                          {item.accountHolderName}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${statusMeta.badgeClass}`}
                        >
                          <span>{statusMeta.label}</span>
                        </span>
                        {item.status === 'PROCESSING' && (
                          <div className="text-[10px] mt-1 font-medium text-slate-500">
                            {assignedOther
                              ? 'NV khác đang xử lý'
                              : item.evidenceUrl
                                ? 'Đã có ảnh biên lai'
                                : 'Chưa tải biên lai'}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 max-w-[140px]">
                        <div
                          className="text-[11px] text-slate-600 truncate"
                          title={item.adminNote || item.disputeDescription || ''}
                        >
                          {item.adminNote ||
                            item.disputeDescription || (
                              <span className="text-slate-300 italic">Không có</span>
                            )}
                        </div>
                        {item.status === 'TRANSFERRED_AWAITING_REVIEW' &&
                          item.disputeDeadline && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              Tự hoàn tất lúc:{' '}
                              {new Date(item.disputeDeadline).toLocaleString('vi-VN')}
                            </div>
                          )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canQuickClaim && (
                            <button
                              type="button"
                              disabled={submittingAction !== null}
                              onClick={() =>
                                void executeAction(item, 'CLAIM', {
                                  note: '',
                                  openDetailAfter: true,
                                  successMessage: `Đã tiếp nhận xử lý lệnh #${item.requestCode || item.id.slice(0, 8)}.`,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition inline-flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
                            >
                              <Check className="w-3 h-3 shrink-0" />
                              <span>
                                {item.status === 'TRANSFER_FAILED'
                                  ? 'Chuyển lại'
                                  : 'Tiếp nhận'}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openDetailModal(item)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${item.status === 'PROCESSING' ||
                              item.status === 'DISPUTED' ||
                              item.status === 'DISPUTE_PROCESSING'
                              ? 'bg-[#24263e] hover:bg-[#c34c36] text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                          >
                            <Eye className="w-3 h-3 shrink-0" />
                            <span>
                              {item.status === 'PROCESSING'
                                ? 'Chuyển khoản'
                                : item.status === 'DISPUTED' ||
                                  item.status === 'DISPUTE_PROCESSING'
                                  ? 'Xử lý lỗi'
                                  : 'Chi tiết'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL & TRANSFER PROCESSING MODAL */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#24263e] text-white flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                    Xử lý lệnh rút tiền #{detailItem.requestCode || detailItem.id.slice(0, 8)}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusMeta(detailItem.status).badgeClass
                      }`}
                  >
                    {getStatusMeta(detailItem.status).label}
                  </span>
                </div>
                <p className="text-[11px] text-white/75 mt-0.5">
                  Tạo lúc:{' '}
                  {detailItem.createdAt
                    ? new Date(detailItem.createdAt).toLocaleString('vi-VN')
                    : '—'}{' '}
                  · Chủ ví: {detailItem.userEmail} ({getOwnerRoleLabel(detailItem.ownerRole)})
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="p-1.5 rounded-lg hover:bg-white/15 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pinned Error Banner (always visible regardless of scroll) */}
            {modalError && (
              <div className="px-4 sm:px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setNoteError(null);
                  }}
                  className="p-1 rounded-md hover:bg-rose-100 text-rose-600 cursor-pointer shrink-0"
                  title="Ẩn thông báo lỗi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">

              {/* Beneficiary Bank Details & VietQR */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                    <span className="text-slate-500 font-semibold">Số tiền cần chuyển</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-[#c34c36] font-mono">
                        {formatVND(detailItem.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy('amount', String(Math.round(Number(detailItem.amount) || 0)))
                        }
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedField === 'amount' ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Ngân hàng thụ hưởng</span>
                    <span className="font-bold text-slate-900 text-right">
                      {detailItem.bankName || detailItem.bankCode} ({detailItem.bankCode})
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-slate-900 text-sm">
                        {detailItem.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy('account', detailItem.accountNumber)}
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedField === 'account' ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Tên chủ tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 uppercase text-right">
                        {detailItem.accountHolderName}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy('holder', detailItem.accountHolderName)}
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedField === 'holder' ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80">
                    <span className="text-slate-500 font-semibold">Nội dung CK đề xuất</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">
                        {detailItem.requestCode || detailItem.id.slice(0, 12)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            'memo',
                            detailItem.requestCode || detailItem.id.slice(0, 12),
                          )
                        }
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedField === 'memo' ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  {detailItem.walletStatus && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-semibold">Trạng thái ví</span>
                      <span className="font-bold text-slate-700">{detailItem.walletStatus}</span>
                    </div>
                  )}
                </div>

                {/* VietQR Box */}
                <div className="md:col-span-5 p-4 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Mã VietQR chuyển khoản nhanh
                  </div>
                  {qrUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setZoomedEvidenceUrl(qrUrl)}
                        title="Bấm để phóng to mã QR"
                        className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-[#24263e]/40 bg-white p-1.5 transition cursor-zoom-in shadow-2xs"
                      >
                        <img
                          src={qrUrl}
                          alt="Mã QR chuyển khoản VietQR"
                          className="w-44 h-44 object-contain rounded-lg bg-white transition-transform group-hover:scale-[1.02]"
                        />
                        <span className="mt-1 inline-flex items-center justify-center gap-1 w-full py-1 rounded-md bg-slate-100 group-hover:bg-[#24263e] group-hover:text-white text-[10px] font-bold text-slate-700 transition">
                          <Eye className="w-3 h-3" />
                          <span>Bấm để phóng to mã QR</span>
                        </span>
                      </button>
                      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        Quét bằng ứng dụng ngân hàng và kiểm tra lại đúng tên chủ tài khoản trước khi xác nhận chuyển.
                      </p>
                    </>
                  ) : (
                    <div className="py-6 px-3 text-slate-500 space-y-1.5">
                      <CreditCard className="w-8 h-8 mx-auto text-slate-300" />
                      <div className="font-bold text-slate-700">Chuyển khoản thủ công</div>
                      <p className="text-[11px]">
                        Ngân hàng chưa có mã VietQR tự động. Vui lòng sao chép số tài khoản và chuyển thủ công.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Exception request alert if present */}
              {detailItem.exceptionRequestedAt && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                  <div className="font-extrabold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Người dùng đã gửi yêu cầu hỗ trợ ngoại lệ</span>
                  </div>
                  <div className="text-rose-700">
                    Thời gian: {new Date(detailItem.exceptionRequestedAt).toLocaleString('vi-VN')}
                  </div>
                  {detailItem.exceptionReason && (
                    <div className="text-rose-900 font-medium">
                      Nội dung: {detailItem.exceptionReason}
                    </div>
                  )}
                </div>
              )}

              {/* Dispute info block */}
              {(detailItem.disputeType || detailItem.disputeDescription) && (
                <div className="p-4 rounded-xl bg-orange-50/80 border border-orange-200 space-y-1.5">
                  <div className="font-extrabold text-orange-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Thông tin báo cáo lỗi giao dịch từ người dùng</span>
                  </div>
                  {detailItem.disputeType && (
                    <div className="text-orange-900">
                      Loại sự cố: <strong>{getDisputeTypeLabel(detailItem.disputeType)}</strong>
                    </div>
                  )}
                  {detailItem.disputeDescription && (
                    <div className="text-orange-950 whitespace-pre-wrap">
                      Mô tả: {detailItem.disputeDescription}
                    </div>
                  )}
                  {detailItem.disputeEvidenceUrls && detailItem.disputeEvidenceUrls.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="text-[11px] font-bold text-orange-900">
                        Ảnh bằng chứng từ người dùng:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detailItem.disputeEvidenceUrls.map((url, idx) => (
                          <button
                            key={`${url}-${idx}`}
                            type="button"
                            onClick={() => setZoomedEvidenceUrl(url)}
                            className="rounded-lg overflow-hidden border border-orange-200 bg-white cursor-zoom-in"
                          >
                            <img
                              src={url}
                              alt={`Bằng chứng người dùng ${idx + 1}`}
                              className="w-16 h-16 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailItem.disputeResolutionOutcome && (
                    <div className="pt-1.5 border-t border-orange-200 text-teal-900 font-semibold">
                      Kết luận đã xử lý: {getDisputeOutcomeLabel(detailItem.disputeResolutionOutcome)}
                      {detailItem.disputeResolution ? ` — ${detailItem.disputeResolution}` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Evidence Upload & Preview Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#24263e]" />
                      <span>Ảnh minh chứng chuyển khoản (Biên lai ngân hàng)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bắt buộc tải ảnh giao dịch thành công trước khi bấm Xác nhận đã chuyển khoản.
                    </p>
                  </div>

                  {detailItem.status === 'PROCESSING' && !isAssignedToAnotherStaff(detailItem) && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowMobileQrModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-[#24263e] border border-[#24263e]/25 text-xs font-bold transition cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#c34c36]" />
                        <span>Tải từ điện thoại (QR)</span>
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold transition cursor-pointer">
                        {uploadingEvidence ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {detailItem.evidenceUrl ? 'Tải lại từ máy tính' : 'Tải từ máy tính'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingEvidence}
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void handleEvidenceUpload(detailItem, file);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {loadingEvidence ? (
                  <div className="py-4 flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải ảnh minh chứng...</span>
                  </div>
                ) : evidenceBlobUrl ? (
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setZoomedEvidenceUrl(evidenceBlobUrl)}
                      className="group relative rounded-xl overflow-hidden border border-slate-300 bg-white cursor-pointer"
                    >
                      <img
                        src={evidenceBlobUrl}
                        alt="Ảnh minh chứng chuyển khoản"
                        className="w-36 h-36 object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] font-bold py-1 text-center opacity-90 group-hover:opacity-100">
                        Bấm để phóng to
                      </span>
                    </button>
                    <div className="text-[11px] text-emerald-700 font-semibold space-y-1">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đã lưu ảnh minh chứng chuyển khoản trên hệ thống</span>
                      </div>
                      {detailItem.transferredAt && (
                        <div className="text-slate-500 font-normal">
                          Xác nhận chuyển lúc:{' '}
                          {new Date(detailItem.transferredAt).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">
                    Chưa có ảnh minh chứng chuyển khoản.
                  </div>
                )}
              </div>

              {/* Action Controls by Status */}
              {['PENDING', 'TRANSFER_FAILED'].includes(detailItem.status) && (
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="font-extrabold text-slate-900">
                    Thao tác xử lý yêu cầu
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ghi chú (Bắt buộc nếu từ chối yêu cầu):
                    </label>
                    <textarea
                      ref={actionNoteRef}
                      value={actionNote}
                      onChange={(e) => {
                        setActionNote(e.target.value);
                        if (noteError) setNoteError(null);
                        if (modalError) setModalError(null);
                      }}
                      rows={2}
                      placeholder="Nhập ghi chú đối chiếu hoặc lý do từ chối (VD: Sai thông tin chủ tài khoản)..."
                      className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition ${noteError
                        ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-200 focus:border-rose-500'
                        : 'border-slate-300 focus:ring-[#24263e]/20 focus:border-[#24263e]'
                        }`}
                    />
                    {noteError && (
                      <p className="mt-1.5 text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{noteError}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() =>
                        void executeAction(detailItem, 'CLAIM', {
                          note: actionNote.trim(),
                          successMessage: `Đã tiếp nhận lệnh #${detailItem.requestCode || detailItem.id.slice(0, 8)} để chuyển khoản.`,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {submittingAction === 'CLAIM' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {detailItem.status === 'TRANSFER_FAILED'
                          ? 'Tiếp nhận chuyển khoản lại'
                          : 'Tiếp nhận xử lý chuyển khoản'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void handleReject(detailItem)}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {submittingAction === 'REJECT' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Từ chối & hoàn tiền về ví</span>
                    </button>
                  </div>
                </div>
              )}

              {detailItem.status === 'PROCESSING' && (
                <div className="p-4 rounded-xl bg-white border border-sky-200 space-y-3.5">
                  <div className="font-extrabold text-slate-900">
                    Xác nhận kết quả chuyển khoản
                  </div>

                  {isAssignedToAnotherStaff(detailItem) ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                      Yêu cầu này hiện đang được nhân viên khác tiếp nhận xử lý. Chỉ nhân viên phụ trách hoặc quản trị viên mới có thể cập nhật kết quả chuyển khoản.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Ghi chú giao dịch / Mã tham chiếu ngân hàng (hoặc lý do lỗi / từ chối):
                        </label>
                        <textarea
                          ref={actionNoteRef}
                          value={actionNote}
                          onChange={(e) => {
                            setActionNote(e.target.value);
                            if (noteError) setNoteError(null);
                            if (modalError) setModalError(null);
                          }}
                          rows={2}
                          placeholder="Ví dụ: Đã chuyển khoản thành công qua Vietcombank mã FT2611280012..."
                          className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition ${noteError
                            ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-200 focus:border-rose-500'
                            : 'border-slate-300 focus:ring-[#24263e]/20 focus:border-[#24263e]'
                            }`}
                        />
                        {noteError && (
                          <p className="mt-1.5 text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{noteError}</span>
                          </p>
                        )}
                      </div>

                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={transferConfirmedCheck}
                          onChange={(e) => setTransferConfirmedCheck(e.target.checked)}
                          className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-semibold text-emerald-950 leading-relaxed">
                          Tôi xác nhận đã đối chiếu chính xác người thụ hưởng{' '}
                          <strong className="uppercase">{detailItem.accountHolderName}</strong>, STK{' '}
                          <strong className="font-mono">{detailItem.accountNumber}</strong> tại{' '}
                          <strong>{detailItem.bankName || detailItem.bankCode}</strong> và đã chuyển thành công{' '}
                          <strong>{formatVND(detailItem.amount)}</strong>.
                        </span>
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            submittingAction !== null ||
                            !detailItem.evidenceUrl ||
                            !transferConfirmedCheck
                          }
                          onClick={() => void handleConfirmTransfer(detailItem)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingAction === 'CONFIRM_TRANSFER' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Xác nhận đã chuyển khoản</span>
                        </button>

                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => void handleMarkTransferFailed(detailItem)}
                          className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {submittingAction === 'TRANSFER_FAILED' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>Chuyển khoản thất bại</span>
                        </button>

                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() =>
                            void executeAction(detailItem, 'UNCLAIM', {
                              note: actionNote.trim() || 'Trả lại hàng đợi xử lý',
                              successMessage: `Đã trả lệnh #${detailItem.requestCode || detailItem.id.slice(0, 8)} về hàng đợi chờ tiếp nhận.`,
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {submittingAction === 'UNCLAIM' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Trả lại hàng đợi</span>
                        </button>

                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => void handleReject(detailItem)}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {submittingAction === 'REJECT' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Từ chối & hoàn tiền</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detailItem.status === 'TRANSFERRED_AWAITING_REVIEW' && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium">
                  Đã chuyển khoản. Hệ thống đang chờ chủ ví xác nhận đã nhận tiền
                  {detailItem.disputeDeadline ? (
                    <>
                      ; lệnh sẽ tự động hoàn tất vào lúc{' '}
                      <strong>
                        {new Date(detailItem.disputeDeadline).toLocaleString('vi-VN')}
                      </strong>{' '}
                      nếu không có báo cáo từ người rút.
                    </>
                  ) : (
                    ' (tự động hoàn tất sau 48 giờ nếu không có báo cáo từ người rút).'
                  )}
                </div>
              )}

              {['DISPUTED', 'DISPUTE_PROCESSING'].includes(detailItem.status) && (
                <div className="p-4 rounded-xl bg-white border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-extrabold text-slate-900">
                      Giải quyết báo cáo lỗi chuyển khoản
                    </div>
                    {detailItem.status === 'DISPUTED' && (
                      <button
                        type="button"
                        disabled={submittingAction !== null}
                        onClick={() =>
                          void executeAction(detailItem, 'START_DISPUTE_REVIEW', {
                            note: 'Nhân viên bắt đầu xác minh báo cáo lỗi rút tiền',
                            successMessage: `Đã chuyển lệnh #${detailItem.requestCode || detailItem.id.slice(0, 8)} sang trạng thái Đang xác minh báo cáo.`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        Bắt đầu xác minh
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Phương án xử lý báo cáo:
                    </label>
                    <select
                      value={disputeOutcome}
                      onChange={(e) =>
                        setDisputeOutcome(
                          e.target.value as
                          | 'RESOLVED_VALID_TRANSFER'
                          | 'RESOLVED_RETRY_TRANSFER'
                          | 'RESOLVED_REFUND_TO_WALLET',
                        )
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#24263e]/20 focus:border-[#24263e]"
                    >
                      <option value="RESOLVED_VALID_TRANSFER">
                        Xác minh giao dịch chuyển khoản hợp lệ (Đóng báo cáo)
                      </option>
                      <option value="RESOLVED_RETRY_TRANSFER">
                        Chấp nhận chuyển khoản lại (Đưa về Chuyển khoản thất bại để xử lý lại)
                      </option>
                      <option value="RESOLVED_REFUND_TO_WALLET">
                        Hoàn tiền về số dư khả dụng ví người dùng
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kết luận đối soát ngân hàng (Bắt buộc):
                    </label>
                    <textarea
                      ref={actionNoteRef}
                      value={actionNote}
                      onChange={(e) => {
                        setActionNote(e.target.value);
                        if (noteError) setNoteError(null);
                        if (modalError) setModalError(null);
                      }}
                      rows={2}
                      placeholder="Nhập chi tiết kết quả đối soát với ngân hàng và hướng xử lý..."
                      className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition ${noteError
                        ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-200 focus:border-rose-500'
                        : 'border-slate-300 focus:ring-[#24263e]/20 focus:border-[#24263e]'
                        }`}
                    />
                    {noteError && (
                      <p className="mt-1.5 text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{noteError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={submittingAction !== null}
                    onClick={() => void handleResolveDispute(detailItem)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {submittingAction === 'RESOLVE_DISPUTE' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Xác nhận giải quyết báo cáo</span>
                  </button>
                </div>
              )}

              {/* Audit Status History */}
              <WithdrawalStatusTimeline
                events={detailHistory}
                loading={loadingHistory}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={closeDetailModal}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile QR Evidence Upload Handoff Modal */}
      {showMobileQrModal && detailItem && (
        <MobileEvidenceQrModal
          withdrawal={detailItem}
          onClose={() => {
            setShowMobileQrModal(false);
            setEvidenceRefreshKey((k) => k + 1);
            void fetchWithdrawals();
          }}
          onUploaded={(evidenceUrl) => {
            const targetId = detailItem.id;
            const nextUrl =
              evidenceUrl ||
              detailItem.evidenceUrl ||
              `/api/v1/wallets/withdrawals/evidence/${targetId}`;
            setShowMobileQrModal(false);
            setDetailItem((prev) =>
              prev && prev.id === targetId ? { ...prev, evidenceUrl: nextUrl } : prev,
            );
            setWithdrawals((prev) =>
              prev.map((w) => (w.id === targetId ? { ...w, evidenceUrl: nextUrl } : w)),
            );
            setEvidenceRefreshKey((k) => k + 1);
            notify(
              `Đã nhận ảnh biên lai chuyển khoản từ điện thoại cho lệnh #${detailItem.requestCode || detailItem.id.slice(0, 8)}.`,
            );
            void fetchWithdrawals();
          }}
        />
      )}

      {/* Zoomed Evidence Preview Lightbox */}
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
              alt="Xem phóng to"
              className="max-w-[88vw] max-h-[84vh] min-w-[280px] sm:min-w-[420px] object-contain rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
