import { withdrawalBanks as SUPPORTED_BANKS } from '../../services/withdrawalBanks';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  CreditCard,
  User,
  History,
  Info,
  Loader2,
  ShieldCheck,
  Eye,
  ChevronDown,
  ChevronUp,
  Edit3,
  Lock,
  Upload,
  Smartphone,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  walletService,
  WalletWithdrawalResponseDto,
  WalletWithdrawalStatusHistoryItem,
  CreateWithdrawalRequestDto,
  SavedBankAccount,
  BankAccountHistoryItem,
  OFFICIAL_BANK_WARNING_TEXT,
  WITHDRAWAL_PROCESSING_NOTICE,
  WITHDRAWAL_SUBMITTED_NOTICE,
  WITHDRAWAL_DISPUTE_TYPES,
  WITHDRAWAL_RESOLUTION_OUTCOMES,
  WITHDRAWAL_STATUS_LABELS,
} from '../../services/walletService';
import { mediaService } from '../../services/mediaService';
import { BankSearchSelect } from '../wallet/BankSearchSelect';
import { BankAccountHistoryTimeline } from '../wallet/BankAccountHistoryTimeline';
import { WithdrawalStatusTimeline } from '../wallet/WithdrawalStatusTimeline';
import { MobileEvidenceQrModal } from '../admin/MobileEvidenceQrModal';
import { formatVND } from '../../utils/translations';
import {
  formatVndInput,
  cleanVndInput,
  handleVndInputChange,
  handleVndInputKeyDown,
} from '../../utils/numberToWords';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  reservedBalance?: number;
  initialBankName?: string;
  initialAccountNumber?: string;
  initialAccountHolder?: string;
  initialTab?: 'create' | 'history';
  initialWithdrawalId?: string | null;
  onSuccess?: () => void;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'DISPUTE_RESOLVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'TRANSFERRED_AWAITING_REVIEW':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'DISPUTED':
    case 'DISPUTE_PROCESSING':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'REJECTED':
    case 'TRANSFER_FAILED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-700 border-slate-300';
    default:
      return 'bg-amber-100 text-amber-800 border-amber-200';
  }
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

function formatRemainingFromSeconds(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return 'Đã hết thời hạn báo cáo 48 giờ';
  const totalMins = Math.floor(seconds / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `Còn ${hours} giờ ${mins} phút để kiểm tra & báo lỗi`;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance: propAvailableBalance,
  reservedBalance: propReservedBalance = 0,
  initialBankName,
  initialAccountNumber,
  initialAccountHolder,
  initialTab = 'create',
  initialWithdrawalId = null,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>(initialTab);

  const [liveAvailable, setLiveAvailable] = useState<number | null>(null);
  const [liveReserved, setLiveReserved] = useState<number | null>(null);

  const availableBalance = liveAvailable ?? propAvailableBalance;
  const reservedBalance = liveReserved ?? propReservedBalance;
  const totalWalletBalance = availableBalance + reservedBalance;

  // Bank & Form State (Locked by default when saved bank exists)
  const [bankCode, setBankCode] = useState('VCB');
  const [savedBanks, setSavedBanks] = useState<SavedBankAccount[]>([]);
  const [bankHistory, setBankHistory] = useState<BankAccountHistoryItem[]>([]);
  const [showBankHistory, setShowBankHistory] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [manualBank, setManualBank] = useState('');
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber || '');
  const [accountHolderName, setAccountHolderName] = useState(initialAccountHolder || '');
  const [amountStr, setAmountStr] = useState('');

  // Bank warning & summary confirmation flow (Step 3 & Step 4)
  const [bankInfoConfirmed, setBankInfoConfirmed] = useState(false);
  const [showBankWarningPopup, setShowBankWarningPopup] = useState(false);
  const [pendingProfileSaveOnly, setPendingProfileSaveOnly] = useState(false);
  const [showSummaryConfirmModal, setShowSummaryConfirmModal] = useState(false);
  const [warningMeta, setWarningMeta] = useState<{ version: string; text: string }>({
    version: 'withdrawal-bank-warning-v1',
    text: OFFICIAL_BANK_WARNING_TEXT,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  // History & Detail State
  const [historyList, setHistoryList] = useState<WalletWithdrawalResponseDto[]>([]);
  const [historyFetchedAtMs, setHistoryFetchedAtMs] = useState<number>(() => Date.now());
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusHistoryById, setStatusHistoryById] = useState<
    Record<string, WalletWithdrawalStatusHistoryItem[]>
  >({});
  const [evidenceBlobById, setEvidenceBlobById] = useState<Record<string, string>>({});

  // Cancel, Dispute & Exception Modals
  const [cancellingItem, setCancellingItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [confirmingReceiptItem, setConfirmingReceiptItem] =
    useState<WalletWithdrawalResponseDto | null>(null);
  const [disputingItem, setDisputingItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [disputeType, setDisputeType] = useState<string>(WITHDRAWAL_DISPUTE_TYPES[0].code);
  const [disputeDesc, setDisputeDesc] = useState<string>('');
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [uploadingDisputePhoto, setUploadingDisputePhoto] = useState(false);
  const [showNotReceivedWarning, setShowNotReceivedWarning] = useState(false);

  const [exceptionItem, setExceptionItem] = useState<WalletWithdrawalResponseDto | null>(null);
  const [exceptionReason, setExceptionReason] = useState<string>('');
  const [exceptionEvidenceUrls, setExceptionEvidenceUrls] = useState<string[]>([]);
  const [uploadingExceptionPhoto, setUploadingExceptionPhoto] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [mobileQrTarget, setMobileQrTarget] = useState<'dispute' | 'exception' | null>(null);

  const applySavedBank = useCallback((bank: SavedBankAccount) => {
    const matched = SUPPORTED_BANKS.find(
      (b) => b.code === bank.bankCode || b.bin === bank.bankCode || b.name === bank.bankName,
    );
    if (matched) {
      setBankCode(matched.code);
      setManualBank('');
    } else {
      setBankCode('MANUAL');
      setManualBank(bank.bankName);
    }
    setAccountNumber(bank.accountNumber);
    setAccountHolderName(bank.accountHolderName.toUpperCase());
    setIsEditingBank(false);
    setBankInfoConfirmed(false);
    setIdempotencyKey(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    walletService
      .getMyWallet({ isBackground: true })
      .then((w: any) => {
        if (!active || !w) return;
        setLiveAvailable(Number(w.balance ?? propAvailableBalance));
        setLiveReserved(Number(w.reservedBalance ?? w.pendingBalance ?? propReservedBalance));
      })
      .catch(() => {});

    walletService
      .getWithdrawalBankConfirmation()
      .then((meta) => {
        if (active && meta?.version) {
          const rawText = meta.text?.trim() || '';
          const isInvalidOrEnglish =
            /^please verify the bank/i.test(rawText) || /Ã|Â|á»|Æ°/.test(rawText);
          setWarningMeta({
            version: meta.version,
            text: rawText && !isInvalidOrEnglish ? rawText : OFFICIAL_BANK_WARNING_TEXT,
          });
        }
      })
      .catch(() => {});

    Promise.all([
      walletService.savedBankAccounts(),
      walletService.getBankAccountHistory().catch(() => []),
    ])
      .then(async ([rows, hist]) => {
        if (!active) return;
        setSavedBanks(rows);
        setBankHistory(hist);
        if (rows.length > 0) {
          const defaultId = walletService.getDefaultBankAccountId();
          const preferred =
            rows.find((r) => r.isPrimary) || rows.find((r) => r.id === defaultId) || rows[0];
          applySavedBank(preferred);
        } else {
          // Fallback to latest withdrawal bank info if user_bank_accounts is not backfilled yet
          const recent = await walletService.getMyWithdrawals(0, 1).catch(() => null);
          if (!active) return;
          const latestWd = recent?.items?.[0];
          if (latestWd?.accountNumber && latestWd?.accountHolderName) {
            applySavedBank({
              id: '',
              bankCode: latestWd.bankCode,
              bankName: latestWd.bankName || latestWd.bankCode,
              accountNumber: latestWd.accountNumber,
              accountHolderName: latestWd.accountHolderName,
            });
          } else {
            setIsEditingBank(false);
          }
        }
      })
      .catch(() => {
        if (active) {
          setSavedBanks([]);
          setIsEditingBank(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, propAvailableBalance, propReservedBalance, applySavedBank]);

  useEffect(() => {
    if (savedBanks.length > 0) return;
    if (initialBankName) {
      const cleanInit = initialBankName.toLowerCase().replace(/\s+/g, '');
      const match = SUPPORTED_BANKS.find((b) => {
        const cleanCode = b.code.toLowerCase();
        const cleanName = b.name.toLowerCase().replace(/\s+/g, '');
        return (
          cleanInit.includes(cleanCode) ||
          cleanInit.includes(cleanName) ||
          cleanName.includes(cleanInit)
        );
      });
      if (match) setBankCode(match.code);
    }
    if (initialAccountNumber) setAccountNumber(initialAccountNumber);
    if (initialAccountHolder) setAccountHolderName(initialAccountHolder.toUpperCase());
  }, [initialBankName, initialAccountNumber, initialAccountHolder, savedBanks.length]);

  const fetchHistory = useCallback(async (page = 0) => {
    setIsLoadingHistory(true);
    try {
      const res = await walletService.getMyWithdrawals(page, 20);
      setHistoryList(res.items);
      setHistoryPage(res.page);
      setHistoryFetchedAtMs(Date.now());
      setNowTickMs(Date.now());
    } catch (err) {
      console.warn('Lỗi lấy lịch sử rút tiền:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'history') return;
    const timer = window.setInterval(() => setNowTickMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [isOpen, initialTab, initialWithdrawalId]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'history' || !initialWithdrawalId || historyList.length === 0) return;
    const matched = historyList.find((row) => row.id === initialWithdrawalId);
    if (!matched) return;
    setExpandedId(matched.id);
    walletService
      .getWithdrawalHistory(matched.id)
      .then((rows) => setStatusHistoryById((prev) => ({ ...prev, [matched.id]: rows })))
      .catch(() => {});
    if (matched.evidenceUrl) {
      walletService
        .fetchWithdrawalEvidenceBlobUrl(matched.evidenceUrl)
        .then((blobUrl) => setEvidenceBlobById((prev) => ({ ...prev, [matched.id]: blobUrl })))
        .catch(() => {});
    }
  }, [isOpen, activeTab, initialWithdrawalId, historyList]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      if (activeTab === 'history') {
        void fetchHistory(0);
      }
    }
  }, [isOpen, activeTab, fetchHistory]);

  const parsedAmount = useMemo(() => {
    const clean = cleanVndInput(amountStr);
    if (!clean) return 0;
    const num = Number(clean);
    return Number.isFinite(num) ? Math.floor(num) : 0;
  }, [amountStr]);

  const amountValidationMessage = useMemo(() => {
    if (!amountStr.trim()) return null;
    if (parsedAmount < 10000) {
      return 'Số tiền rút tối thiểu là 10.000 VND.';
    }
    if (parsedAmount > availableBalance) {
      return `Số dư khả dụng không đủ (Hiện có: ${formatVND(availableBalance)}).`;
    }
    return null;
  }, [amountStr, parsedAmount, availableBalance]);

  const isAmountValid = parsedAmount >= 10000 && parsedAmount <= availableBalance;
  const projectedRemainingBalance = isAmountValid ? availableBalance - parsedAmount : null;

  const resolvedBankName = useMemo(() => {
    if (bankCode === 'MANUAL') return manualBank.trim();
    return SUPPORTED_BANKS.find((b) => b.code === bankCode)?.name || bankCode;
  }, [bankCode, manualBank]);

  const isBankFormValid =
    Boolean(resolvedBankName) &&
    /^[0-9]{6,30}$/.test(accountNumber.trim()) &&
    accountHolderName.trim().length >= 2;

  if (!isOpen) return null;

  const handleQuickAmount = (ratio: number) => {
    const val = Math.floor(availableBalance * ratio);
    setAmountStr(String(Math.max(0, val)));
    setIdempotencyKey(null);
  };

  const handleBankFieldMutated = () => {
    setBankInfoConfirmed(false);
    setIdempotencyKey(null);
  };

  const handleOpenBankWarning = (profileSaveOnly: boolean) => {
    setErrorMessage(null);
    if (!isBankFormValid) {
      setErrorMessage(
        'Vui lòng kiểm tra đầy đủ ngân hàng, số tài khoản (6–30 chữ số) và tên chủ tài khoản trước khi xác nhận.',
      );
      return;
    }
    setPendingProfileSaveOnly(profileSaveOnly);
    setShowBankWarningPopup(true);
  };

  const handleConfirmBankWarning = async () => {
    setShowBankWarningPopup(false);
    setBankInfoConfirmed(true);
    if (pendingProfileSaveOnly || isEditingBank) {
      try {
        const newId = await walletService.saveBankAccount({
          bankCode,
          bankName: resolvedBankName,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim().toUpperCase(),
        });
        if (newId) walletService.setDefaultBankAccountId(newId);
        const [rows, hist] = await Promise.all([
          walletService.savedBankAccounts(),
          walletService.getBankAccountHistory().catch(() => []),
        ]);
        setSavedBanks(rows);
        setBankHistory(hist);
        setIsEditingBank(false);
        if (pendingProfileSaveOnly) {
          setSuccessMessage(
            'Đã lưu tài khoản ngân hàng mới và ghi nhận tài khoản cũ vào lịch sử truy vết.',
          );
          return;
        }
      } catch {
        if (pendingProfileSaveOnly) {
          setErrorMessage('Không thể lưu tài khoản vào hồ sơ. Vui lòng kiểm tra lại thông tin.');
          return;
        }
      }
    }
    if (!pendingProfileSaveOnly && isAmountValid) {
      setShowSummaryConfirmModal(true);
    }
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isAmountValid) {
      setErrorMessage(amountValidationMessage || 'Số tiền rút tối thiểu là 10.000 VND.');
      return;
    }
    if (!isBankFormValid) {
      setErrorMessage(
        'Vui lòng cung cấp hợp lệ tên ngân hàng, số tài khoản (6–30 chữ số) và tên chủ tài khoản.',
      );
      return;
    }
    setBankInfoConfirmed(true);
    setShowSummaryConfirmModal(true);
  };

  const executeSubmitWithdrawal = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const confirmation = await walletService
        .getWithdrawalBankConfirmation()
        .catch(() => warningMeta);

      const payload: CreateWithdrawalRequestDto = {
        amount: parsedAmount,
        bankCode,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
        bankName: resolvedBankName,
        warningVersion: confirmation.version,
      };

      const requestKey =
        idempotencyKey ||
        (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      setIdempotencyKey(requestKey);

      const created = await walletService.requestWithdrawal(payload, requestKey);
      setIdempotencyKey(null);
      setShowSummaryConfirmModal(false);

      if (created?.availableBalance != null) {
        setLiveAvailable(Number(created.availableBalance));
      } else {
        setLiveAvailable(Math.max(0, availableBalance - parsedAmount));
      }
      if (created?.reservedBalance != null) {
        setLiveReserved(Number(created.reservedBalance));
      } else {
        setLiveReserved(reservedBalance + parsedAmount);
      }

      setSuccessMessage(WITHDRAWAL_SUBMITTED_NOTICE);
      setAmountStr('');
      onSuccess?.();
      await fetchHistory(0);
      setActiveTab('history');
    } catch (err: any) {
      setShowSummaryConfirmModal(false);
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể tạo yêu cầu rút tiền. Vui lòng thử lại sau.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpandItem = async (item: WalletWithdrawalResponseDto) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (!statusHistoryById[item.id]) {
      walletService
        .getWithdrawalHistory(item.id)
        .then((rows) => setStatusHistoryById((prev) => ({ ...prev, [item.id]: rows })))
        .catch(() => {});
    }
    if (item.evidenceUrl && !evidenceBlobById[item.id]) {
      walletService
        .fetchWithdrawalEvidenceBlobUrl(item.evidenceUrl)
        .then((blobUrl) => setEvidenceBlobById((prev) => ({ ...prev, [item.id]: blobUrl })))
        .catch(() => {});
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingItem || actionBusy) return;
    setActionBusy(true);
    try {
      await walletService.cancelWithdrawal(cancellingItem.id);
      setCancellingItem(null);
      await fetchHistory(historyPage);
      const w: any = await walletService.getMyWallet({ isBackground: true }).catch(() => null);
      if (w) {
        setLiveAvailable(Number(w.balance ?? 0));
        setLiveReserved(Number(w.reservedBalance ?? w.pendingBalance ?? 0));
      }
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Chỉ yêu cầu đang chờ tiếp nhận mới có thể hủy.');
      setCancellingItem(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!confirmingReceiptItem || actionBusy) return;
    setActionBusy(true);
    try {
      await walletService.confirmReceipt(confirmingReceiptItem.id);
      setConfirmingReceiptItem(null);
      await fetchHistory(historyPage);
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể xác nhận đã nhận tiền lúc này.');
      setConfirmingReceiptItem(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleUploadDisputePhoto = async (file?: File) => {
    if (!file || disputeEvidenceUrls.length >= 3) return;
    setUploadingDisputePhoto(true);
    setErrorMessage(null);
    try {
      const uploaded = await mediaService.uploadImage(file, 'secondlife/withdrawals/disputes');
      if (uploaded?.url) {
        setDisputeEvidenceUrls((prev) => [...prev, uploaded.url]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải ảnh minh chứng lên lúc này.');
    } finally {
      setUploadingDisputePhoto(false);
    }
  };

  const handleUploadExceptionPhoto = async (file?: File) => {
    if (!file || exceptionEvidenceUrls.length >= 3) return;
    setUploadingExceptionPhoto(true);
    setErrorMessage(null);
    try {
      const uploaded = await mediaService.uploadImage(file, 'secondlife/withdrawals/exceptions');
      if (uploaded?.url) {
        setExceptionEvidenceUrls((prev) => [...prev, uploaded.url]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải ảnh minh chứng lên lúc này.');
    } finally {
      setUploadingExceptionPhoto(false);
    }
  };

  const submitDisputeNow = async () => {
    if (!disputingItem || actionBusy) return;
    setShowNotReceivedWarning(false);
    setActionBusy(true);
    try {
      await walletService.reportWithdrawalIssue(
        disputingItem.id,
        disputeType,
        disputeDesc.trim(),
        disputeEvidenceUrls,
      );
      setDisputingItem(null);
      setDisputeDesc('');
      setDisputeEvidenceUrls([]);
      setSuccessMessage('Báo cáo vấn đề đã được ghi nhận và đang chờ bộ phận phụ trách xử lý.');
      await fetchHistory(historyPage);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể gửi báo cáo vấn đề lúc này.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingItem || actionBusy) return;
    if (!disputeDesc.trim()) {
      setErrorMessage('Vui lòng nhập mô tả chi tiết vấn đề gặp phải.');
      return;
    }
    if (disputeType === 'NOT_RECEIVED') {
      setShowNotReceivedWarning(true);
      return;
    }
    await submitDisputeNow();
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionItem || actionBusy) return;
    if (!exceptionReason.trim()) {
      setErrorMessage('Vui lòng mô tả chi tiết lý do cần hỗ trợ ngoại lệ.');
      return;
    }
    setActionBusy(true);
    try {
      await walletService.requestWithdrawalException(
        exceptionItem.id,
        exceptionReason.trim(),
        exceptionEvidenceUrls,
      );
      setExceptionItem(null);
      setExceptionReason('');
      setExceptionEvidenceUrls([]);
      setSuccessMessage(
        'Yêu cầu hỗ trợ ngoại lệ đã được ghi nhận để Admin/Manager xem xét. Giao dịch không tự động hoàn tiền trong thời gian xác minh.',
      );
      await fetchHistory(historyPage);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể gửi yêu cầu hỗ trợ ngoại lệ lúc này.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl text-[#24263e] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#c34c36]/10 text-[#c34c36] flex items-center justify-center font-black">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#24263e]">Rút tiền về ngân hàng</h3>
              <p className="text-[11px] text-slate-500">{WITHDRAWAL_PROCESSING_NOTICE}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-[#24263e] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-[#c34c36]" />
            <span>Tạo yêu cầu rút tiền</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#24263e] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Lịch sử &amp; đối soát</span>
          </button>
        </div>

        {/* Step 1: Wallet Balances Overview */}
        <div className="bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200/80 space-y-2 shrink-0">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Tổng số dư ví</span>
              <strong className="text-sm font-black text-slate-900">
                {formatVND(totalWalletBalance)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 font-semibold block">
                Số dư khả dụng
              </span>
              <strong className="text-sm font-black text-emerald-700">
                {formatVND(availableBalance)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-amber-700 block">Đang chờ xử lý</span>
              <strong className="text-sm font-bold text-amber-800">
                {formatVND(reservedBalance)}
              </strong>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
            <span>
              Rút tối thiểu: <strong>10.000 VND</strong>
            </span>
            <span>
              Xử lý dự kiến: <strong>1–3 ngày làm việc</strong>
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab 1: Create Withdrawal */}
        {activeTab === 'create' && (
          <form
            onSubmit={handleStartSubmit}
            className="space-y-4 flex-1 overflow-y-auto pr-1"
          >
            {/* Step 2: Amount Input + Live Remaining Balance */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>
                  Bước 1: Số tiền muốn rút (VND nguyên) <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-slate-500">Tối thiểu 10.000₫</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={amountStr ? formatVndInput(amountStr) : ''}
                  onChange={(e) =>
                    handleVndInputChange(e, (_num, raw) => {
                      setAmountStr(raw);
                      setIdempotencyKey(null);
                    })
                  }
                  onKeyDown={(e) => handleVndInputKeyDown(e, (_num, raw) => setAmountStr(raw))}
                  placeholder="Nhập số tiền muốn rút..."
                  className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-black text-base text-[#c34c36]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  VND
                </span>
              </div>

              {amountValidationMessage && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">
                  {amountValidationMessage}
                </p>
              )}

              {projectedRemainingBalance !== null && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between">
                  <span className="text-emerald-900 font-medium">
                    Số dư khả dụng dự kiến còn lại:
                  </span>
                  <strong className="font-mono font-black text-emerald-800">
                    {formatVND(projectedRemainingBalance)}
                  </strong>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {[
                  { label: '25%', ratio: 0.25 },
                  { label: '50%', ratio: 0.5 },
                  { label: '75%', ratio: 0.75 },
                  { label: 'Tất cả (100%)', ratio: 1 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleQuickAmount(chip.ratio)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Locked Bank Card + Top-Right Edit Icon */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Bước 2: Tài khoản ngân hàng nhận tiền *</span>
                </span>
                <div className="flex items-center gap-2">
                  {bankHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBankHistory((v) => !v)}
                      className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>TK cũ ({bankHistory.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {!isEditingBank ? (
                /* Chế độ Khóa (Read-Only) mặc định kèm nút Chỉnh sửa góc trên bên phải */
                <div className="relative p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setIsEditingBank(true)}
                    title="Chỉnh sửa thông tin tài khoản ngân hàng"
                    className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>Chỉnh sửa</span>
                  </button>

                  {isBankFormValid ? (
                    <div className="pr-24 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Lock className="w-2.5 h-2.5" />
                          Đã khóa
                        </span>
                        <span className="text-xs font-black text-slate-900">
                          {resolvedBankName} ({bankCode})
                        </span>
                      </div>
                      <div className="text-xs font-mono font-black text-slate-800">
                        STK: {accountNumber}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 uppercase">
                        Chủ TK: {accountHolderName}
                      </div>
                    </div>
                  ) : (
                    <div className="pr-24 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Lock className="w-2.5 h-2.5" />
                        Chưa thiết lập
                      </span>
                      <p className="text-xs font-semibold text-slate-700">
                        Chưa có thông tin tài khoản ngân hàng nhận tiền.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Nhấn nút <strong>Chỉnh sửa</strong> ở góc trên bên phải để thêm tài khoản ngân hàng.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Chế độ Chỉnh sửa / Nhập tài khoản mới (có ô Tìm kiếm ngân hàng không văng modal) */
                <div className="p-3.5 rounded-xl bg-white border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      {savedBanks.length > 0 || isBankFormValid
                        ? 'Cập Nhật / Lưu Tài Khoản Ngân Hàng Mới'
                        : 'Nhập Thông Tin Tài Khoản Ngân Hàng Nhận Tiền'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (savedBanks.length > 0) {
                          applySavedBank(savedBanks[0]);
                        } else {
                          setIsEditingBank(false);
                        }
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Hủy sửa
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tìm &amp; chọn ngân hàng thụ hưởng *
                    </label>
                    <BankSearchSelect
                      value={bankCode}
                      onChange={(code) => {
                        setBankCode(code);
                        handleBankFieldMutated();
                      }}
                      manualBankName={manualBank}
                      onManualBankNameChange={(val) => {
                        setManualBank(val);
                        handleBankFieldMutated();
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        <span>Số tài khoản *</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => {
                          setAccountNumber(e.target.value.replace(/\D/g, ''));
                          handleBankFieldMutated();
                        }}
                        placeholder="Nhập 6 - 30 chữ số"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Tên chủ tài khoản (VIẾT HOA) *</span>
                      </label>
                      <input
                        type="text"
                        value={accountHolderName}
                        onChange={(e) => {
                          setAccountHolderName(e.target.value.toUpperCase());
                          handleBankFieldMutated();
                        }}
                        placeholder="VD: NGUYEN VAN A"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-slate-500">
                      Thông tin tài khoản cũ vẫn được giữ trong lịch sử truy vết giao dịch.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenBankWarning(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Lưu tài khoản mới
                    </button>
                  </div>
                </div>
              )}

              {showBankHistory && bankHistory.length > 0 && (
                <BankAccountHistoryTimeline
                  items={bankHistory}
                  onCollapse={() => setShowBankHistory(false)}
                />
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isAmountValid || !isBankFormValid || isEditingBank}
                title={
                  isEditingBank ? 'Vui lòng bấm Lưu tài khoản mới hoặc Hủy sửa trước khi gửi' : undefined
                }
                className="px-5 py-2.5 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi yêu cầu rút tiền</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: History & 48h Reconciliation */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="text-slate-500 font-bold text-[11px]">
                {historyList.length} yêu cầu rút tiền
              </span>
              <button
                type="button"
                onClick={() => void fetchHistory(historyPage)}
                disabled={isLoadingHistory}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#24263e] mb-2" />
                <span>Đang tải lịch sử rút tiền...</span>
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <Info className="w-6 h-6 mx-auto text-slate-300" />
                <p>Bạn chưa gửi yêu cầu rút tiền nào.</p>
              </div>
            ) : (
              historyList.map((item) => {
                const isExpanded = expandedId === item.id;
                const statusLabel = WITHDRAWAL_STATUS_LABELS[item.status] || item.status;
                const remainingSecs = computeRemainingSeconds(item, historyFetchedAtMs, nowTickMs);
                const within48h =
                  item.status === 'TRANSFERRED_AWAITING_REVIEW' &&
                  remainingSecs !== null &&
                  remainingSecs > 0;
                const remainingLabel =
                  item.status === 'TRANSFERRED_AWAITING_REVIEW'
                    ? formatRemainingFromSeconds(remainingSecs)
                    : null;
                const historyEvents = statusHistoryById[item.id] || [];
                const evidenceSrc = evidenceBlobById[item.id];
                const outcomeLabel = item.disputeResolutionOutcome
                  ? WITHDRAWAL_RESOLUTION_OUTCOMES.find(
                      (o) => o.code === item.disputeResolutionOutcome,
                    )?.label || item.disputeResolutionOutcome
                  : null;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        #{item.requestCode || item.id.slice(0, 8)} •{' '}
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadgeClass(
                          item.status,
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-black text-[#c34c36] text-base font-mono">
                          {formatVND(item.amount)}
                        </div>
                        <div className="text-[11px] text-slate-700 font-semibold">
                          {item.bankName || item.bankCode} • STK {item.accountNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 uppercase">
                          Chủ TK: {item.accountHolderName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleExpandItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Chi tiết</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {item.status === 'PENDING' && (
                      <div className="space-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Xử lý dự kiến: 1–3 ngày làm việc</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Thông tin ngân hàng đã được cố định cho lệnh này. Muốn đổi tài khoản nhận, vui lòng hủy lệnh và tạo yêu cầu mới.
                        </div>
                      </div>
                    )}

                    {remainingLabel && (
                      <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-[11px] text-teal-900 font-semibold">
                        {remainingLabel} (Hạn cuối:{' '}
                        {item.disputeDeadline
                          ? new Date(item.disputeDeadline).toLocaleString('vi-VN')
                          : '—'}
                        )
                      </div>
                    )}

                    {item.adminNote && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700">
                        <strong>Ghi chú xử lý:</strong> {item.adminNote}
                      </div>
                    )}

                    {item.disputeType && (
                      <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-[11px] text-orange-900 space-y-1.5">
                        <div>
                          <strong>Báo cáo vấn đề:</strong>{' '}
                          {WITHDRAWAL_DISPUTE_TYPES.find((t) => t.code === item.disputeType)
                            ?.label || item.disputeType}
                        </div>
                        {item.disputeDescription && <div>Mô tả: {item.disputeDescription}</div>}
                        {Array.isArray(item.disputeEvidenceUrls) &&
                          item.disputeEvidenceUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.disputeEvidenceUrls.map((url, idx) => (
                                <a
                                  key={`${url}-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={url}
                                    alt={`Ảnh báo cáo ${idx + 1}`}
                                    className="w-16 h-16 object-cover rounded-lg border border-orange-200 bg-white"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        {outcomeLabel && (
                          <div className="text-emerald-900 font-bold">
                            Phương án xử lý: {outcomeLabel}
                          </div>
                        )}
                        {item.disputeResolution && (
                          <div className="text-emerald-800 font-semibold">
                            Kết quả giải quyết: {item.disputeResolution}
                          </div>
                        )}
                        {item.disputeResolutionEvidenceUrl && (
                          <a
                            href={item.disputeResolutionEvidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-[10px] font-bold text-indigo-700 underline"
                          >
                            Xem minh chứng đối chiếu từ Staff
                          </a>
                        )}
                      </div>
                    )}

                    {item.exceptionRequestedAt && (
                      <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-950 space-y-1">
                        <div className="font-bold">
                          Yêu cầu hỗ trợ ngoại lệ (sau 48h) •{' '}
                          {new Date(item.exceptionRequestedAt).toLocaleString('vi-VN')}
                        </div>
                        {item.exceptionReason && <div>Lý do: {item.exceptionReason}</div>}
                        <div className="text-[10px] text-indigo-700">
                          Đang chờ Admin/Manager xem xét thủ công (không tự động hoàn tiền).
                        </div>
                        {Array.isArray(item.exceptionEvidenceUrls) &&
                          item.exceptionEvidenceUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.exceptionEvidenceUrls.map((url, idx) => (
                                <a
                                  key={`${url}-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    src={url}
                                    alt={`Ảnh ngoại lệ ${idx + 1}`}
                                    className="w-16 h-16 object-cover rounded-lg border border-indigo-200 bg-white"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5 text-[11px]">
                        {item.transferredAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Thời điểm xác nhận CK:</span>
                            <strong>{new Date(item.transferredAt).toLocaleString('vi-VN')}</strong>
                          </div>
                        )}
                        {evidenceSrc && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 block">
                              Ảnh minh chứng giao dịch chuyển khoản:
                            </span>
                            <img
                              src={evidenceSrc}
                              alt="Ảnh minh chứng chuyển khoản"
                              className="max-h-56 rounded-xl border border-slate-200 object-contain"
                            />
                          </div>
                        )}
                        <WithdrawalStatusTimeline events={historyEvents} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      {item.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => setCancellingItem(item)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                        >
                          Hủy yêu cầu
                        </button>
                      )}
                      {within48h && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDisputingItem(item);
                              setDisputeType(WITHDRAWAL_DISPUTE_TYPES[0].code);
                              setDisputeDesc('');
                              setDisputeEvidenceUrls([]);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold cursor-pointer"
                          >
                            Báo cáo vấn đề
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingReceiptItem(item)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Đã nhận đủ tiền
                          </button>
                        </>
                      )}
                      {['DISPUTED', 'DISPUTE_PROCESSING'].includes(item.status) && (
                        <button
                          type="button"
                          onClick={() => setConfirmingReceiptItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Đóng báo cáo & đã nhận tiền
                        </button>
                      )}
                      {item.status === 'COMPLETED' && !item.exceptionRequestedAt && (
                        <button
                          type="button"
                          onClick={() => {
                            setExceptionItem(item);
                            setExceptionReason('');
                            setExceptionEvidenceUrls([]);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Yêu cầu hỗ trợ ngoại lệ</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Popup Cảnh báo trách nhiệm thông tin ngân hàng */}
      {showBankWarningPopup && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Cảnh Báo Kiểm Tra Thông Tin Ngân Hàng
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {warningMeta.text || OFFICIAL_BANK_WARNING_TEXT}
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Ngân hàng:</span>
                <strong>
                  {resolvedBankName} ({bankCode})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số tài khoản:</span>
                <strong className="font-mono">{accountNumber.trim()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tên chủ tài khoản:</span>
                <strong className="uppercase">{accountHolderName.trim().toUpperCase()}</strong>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBankWarningPopup(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmBankWarning()}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bước 4: Màn hình xác nhận tổng hợp trước khi gửi yêu cầu */}
      {showSummaryConfirmModal && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-black text-slate-900">
              Xác Nhận Tổng Hợp Yêu Cầu Rút Tiền
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Số tiền yêu cầu rút:</span>
                <strong className="text-base font-black text-[#c34c36] font-mono">
                  {formatVND(parsedAmount)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số dư khả dụng còn lại:</span>
                <strong className="font-mono text-emerald-700">
                  {formatVND(Math.max(0, availableBalance - parsedAmount))}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngân hàng nhận tiền:</span>
                <strong>
                  {resolvedBankName} ({bankCode})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số tài khoản:</span>
                <strong className="font-mono">{accountNumber.trim()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tên chủ tài khoản:</span>
                <strong className="uppercase">{accountHolderName.trim().toUpperCase()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian xử lý dự kiến:</span>
                <strong>1–3 ngày làm việc</strong>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-[11px] text-amber-900 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{warningMeta.text || OFFICIAL_BANK_WARNING_TEXT}</p>
                <p className="text-amber-800">
                  Số tiền yêu cầu rút sẽ được phong tỏa trong thời gian chờ xử lý.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSummaryConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void executeSubmitWithdrawal()}
                className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-[#1a1c2e] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận gửi yêu cầu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hủy yêu cầu (PENDING) */}
      {cancellingItem && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-black text-slate-900">Hủy Yêu Cầu Rút Tiền?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Yêu cầu rút <strong>{formatVND(cancellingItem.amount)}</strong> đang chờ tiếp nhận sẽ được hủy và hoàn lại ngay vào số dư khả dụng của bạn.
            </p>
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
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận đã nhận tiền */}
      {confirmingReceiptItem && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-black text-slate-900">
              {['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status)
                ? 'Đóng Báo Cáo & Xác Nhận Đã Nhận Tiền'
                : 'Xác Nhận Đã Nhận Đủ Tiền'}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {['DISPUTED', 'DISPUTE_PROCESSING'].includes(confirmingReceiptItem.status) ? (
                <>
                  Bạn đã nhận đủ <strong>{formatVND(confirmingReceiptItem.amount)}</strong> vào tài khoản{' '}
                  <strong>{confirmingReceiptItem.accountNumber}</strong> và muốn đóng báo cáo sự cố để hoàn tất yêu cầu rút tiền này?
                </>
              ) : (
                <>
                  Bạn xác nhận đã nhận đủ <strong>{formatVND(confirmingReceiptItem.amount)}</strong> vào tài khoản{' '}
                  <strong>{confirmingReceiptItem.accountNumber}</strong>? Sau khi hoàn tất, yêu cầu sẽ đóng đối soát.
                </>
              )}
            </p>
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận đã nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh báo chờ ngân hàng trước khi báo cáo chưa nhận tiền */}
      {showNotReceivedWarning && disputingItem && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-amber-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">
                  Lưu ý thời gian xử lý giao dịch ngân hàng
                </h4>
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
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Chờ thêm
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void submitDisputeNow()}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận báo cáo lỗi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Báo cáo vấn đề trong 48 giờ */}
      {disputingItem && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={handleSubmitDispute}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
          >
            <h4 className="text-sm font-black text-slate-900">
              Báo Cáo Vấn Đề Chuyển Khoản (#{disputingItem.requestCode || disputingItem.id.slice(0, 8)})
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại vấn đề gặp phải *</label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  {WITHDRAWAL_DISPUTE_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả chi tiết *</label>
                <textarea
                  rows={4}
                  required
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  placeholder="Mô tả rõ tình trạng giao dịch bạn kiểm tra trên sao kê ngân hàng..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Tuyệt đối không nhập mật khẩu hoặc mã OTP ngân hàng.
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ảnh minh chứng sao kê / giao dịch (tối đa 3 ảnh, không bắt buộc)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {disputeEvidenceUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <img
                        src={url}
                        alt={`Minh chứng ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
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
                      <label className="px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                        {uploadingDisputePhoto ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingDisputePhoto}
                          onChange={(ev) => {
                            void handleUploadDisputePhoto(ev.target.files?.[0]);
                            ev.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setMobileQrTarget('dispute')}
                        className="px-3 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tải từ điện thoại (QR)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDisputingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={actionBusy || uploadingDisputePhoto}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi báo cáo lỗi</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Yêu cầu hỗ trợ ngoại lệ sau 48 giờ (COMPLETED) */}
      {exceptionItem && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={handleSubmitException}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl"
          >
            <h4 className="text-sm font-black text-slate-900">
              Yêu Cầu Hỗ Trợ Ngoại Lệ (#{exceptionItem.requestCode || exceptionItem.id.slice(0, 8)})
            </h4>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              Giao dịch này đã hoàn tất sau thời hạn đối soát 48 giờ. Yêu cầu ngoại lệ sẽ được chuyển đến Admin/Manager xác minh thủ công và không tự động hoàn tiền.
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do và tình trạng đối soát *
                </label>
                <textarea
                  rows={4}
                  required
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Mô tả chi tiết lý do cần hỗ trợ ngoại lệ (sao kê ngân hàng, mã tra soát...)..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ảnh minh chứng bổ sung (tối đa 3 ảnh, không bắt buộc)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {exceptionEvidenceUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <img
                        src={url}
                        alt={`Ngoại lệ ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
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
                      <label className="px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                        {uploadingExceptionPhoto ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingExceptionPhoto}
                          onChange={(ev) => {
                            void handleUploadExceptionPhoto(ev.target.files?.[0]);
                            ev.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setMobileQrTarget('exception')}
                        className="px-3 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tải từ điện thoại (QR)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setExceptionItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={actionBusy || uploadingExceptionPhoto}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Gửi yêu cầu ngoại lệ</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Quét QR tải ảnh minh chứng từ điện thoại */}
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
            }}
          />
        )}
    </div>
  );
};
