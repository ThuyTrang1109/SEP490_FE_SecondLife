import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Truck,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  Info,
  Search,
  Calendar,
  X,
  ExternalLink,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { walletService } from '../../services/walletService';
import { isUserIdle } from '../../services/apiClient';
import { inspectionCashConfirmedEvent } from '../../utils/inspectionCashShipping';
import { formatVND } from '../../utils/translations';
import type {
  UserWallet,
  WalletTransaction,
  WalletTransactionType,
} from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Types
// ─────────────────────────────────────────────────────────────────────────────

function formatTxDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatTxFullDate(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • ${d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } catch {
    return ts;
  }
}

/**
 * Nhãn hiển thị cho giao dịch ví trung tâm kiểm định
 * Tuân thủ nghiêm ngặt quy định:
 * - EARNING + INSPECTION_ORDER: "Thu phí kiểm định"
 * - SHIPPING_REIMBURSE + SHIPMENT: "Hoàn ứng cước (Sandbox)"
 * - Còn lại: description từ BE
 */
export function resolveTxLabel(tx: { type: string; referenceType?: string | null; description?: string }): string {
  if (tx.type === 'EARNING' && tx.referenceType === 'INSPECTION_ORDER') {
    return 'Thu phí kiểm định';
  }
  if (tx.type === 'SHIPPING_REIMBURSE' && tx.referenceType === 'SHIPMENT') {
    return 'Hoàn ứng cước (Sandbox)';
  }
  return tx.description || '—';
}

const TX_TYPE_LABELS: Record<string, string> = {
  ALL: 'Tất cả loại giao dịch',
  EARNING: 'Thu phí kiểm định (EARNING)',
  SHIPPING_REIMBURSE: 'Hoàn ứng cước (SHIPPING_REIMBURSE)',
  DEPOSIT: 'Nạp tiền vào ví',
  WITHDRAW: 'Rút tiền khỏi ví',
  REFUND: 'Hoàn tiền',
  RETURN_SHIPPING_FEE: 'Phí ship hoàn hàng',
};

const TX_TYPES: Array<WalletTransactionType | ''> = [
  '',
  'EARNING',
  'SHIPPING_REIMBURSE',
  'DEPOSIT',
  'WITHDRAW',
  'REFUND',
  'RETURN_SHIPPING_FEE',
];
const WALLET_REFRESH_MS = 45_000;

interface CenterWalletTabProps {
  lang?: 'vi' | 'en';
  onNavigateToOrder?: (orderId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CenterWalletTab({ lang: _lang = 'vi', onNavigateToOrder }: CenterWalletTabProps) {
  // --- Wallet balance ---
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // --- Transactions ---
  const [txItems, setTxItems] = useState<WalletTransaction[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(0);
  const [txTotalElements, setTxTotalElements] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const walletRequest = useRef<AbortController | null>(null);
  const transactionRequest = useRef<AbortController | null>(null);
  const activeQuery = useRef<{ page: number; type: WalletTransactionType | ''; from: string; to: string }>({
    page: 0, type: '', from: '', to: '',
  });

  // --- Filters ---
  const [filterType, setFilterType] = useState<WalletTransactionType | ''>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // --- Detail Modal ---
  const [detailModalTx, setDetailModalTx] = useState<WalletTransaction | null>(null);

  // --- Clipboard feedback ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // ── Load balance ────────────────────────────────────────────────────────────
  const loadWallet = useCallback(async (isBackground = false) => {
    if (isBackground && walletRequest.current) return;
    walletRequest.current?.abort();
    const controller = new AbortController();
    walletRequest.current = controller;
    if (!isBackground) {
      setWalletLoading(true);
      setWalletError(null);
    }
    try {
      const data = await walletService.getMyWallet({ signal: controller.signal, isBackground });
      if (controller.signal.aborted) return;
      setWallet(data);
      setWalletError(null);
    } catch (err: any) {
      if (!isBackground && !controller.signal.aborted) {
        setWalletError(err?.message || 'Không tải được số dư ví trung tâm');
      }
    } finally {
      if (walletRequest.current === controller) {
        walletRequest.current = null;
        setWalletLoading(false);
      }
    }
  }, []);

  // ── Load transactions ───────────────────────────────────────────────────────
  const loadTransactions = useCallback(
    async (page: number, type: WalletTransactionType | '', from: string, to: string, isBackground = false) => {
      if (isBackground && transactionRequest.current) return;
      transactionRequest.current?.abort();
      const controller = new AbortController();
      transactionRequest.current = controller;
      activeQuery.current = { page, type, from, to };
      if (!isBackground) {
        setTxLoading(true);
        setTxError(null);
      }
      try {
        const result = await walletService.getTransactions({
          page,
          size: PAGE_SIZE,
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
        }, controller.signal, { isBackground });
        if (controller.signal.aborted) return;
        setTxItems(result.items);
        setTxPage(result.page);
        setTxTotalPages(result.totalPages);
        setTxTotalElements(result.totalElements ?? result.items.length);
        setTxError(null);
      } catch (err: any) {
        if (!isBackground && !controller.signal.aborted) {
          setTxError(err?.message || 'Không tải được lịch sử giao dịch ví');
        }
      } finally {
        if (transactionRequest.current === controller) {
          transactionRequest.current = null;
          setTxLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const refresh = (isBackground = false) => {
      const { page, type, from, to } = activeQuery.current;
      void loadWallet(isBackground);
      void loadTransactions(page, type, from, to, isBackground);
    };
    const refreshVisibleWallet = () => {
      if (!document.hidden && !isUserIdle()) refresh(true);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === inspectionCashConfirmedEvent) refreshVisibleWallet();
    };

    refresh();
    const timer = window.setInterval(refreshVisibleWallet, WALLET_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshVisibleWallet);
    window.addEventListener('focus', refreshVisibleWallet);
    window.addEventListener(inspectionCashConfirmedEvent, refreshVisibleWallet);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisibleWallet);
      window.removeEventListener('focus', refreshVisibleWallet);
      window.removeEventListener(inspectionCashConfirmedEvent, refreshVisibleWallet);
      window.removeEventListener('storage', handleStorage);
      walletRequest.current?.abort();
      transactionRequest.current?.abort();
      walletRequest.current = null;
      transactionRequest.current = null;
    };
  }, [loadWallet, loadTransactions]);

  // ── Filter Actions ───────────────────────────────────────────────────────────
  const handleApplyFilter = () => {
    void loadTransactions(0, filterType, filterFrom, filterTo);
  };

  const handleSelectQuickFilter = (type: WalletTransactionType | '') => {
    setFilterType(type);
    void loadTransactions(0, type, filterFrom, filterTo);
  };

  const handleResetFilter = () => {
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
    setSearchKeyword('');
    void loadTransactions(0, '', '', '');
  };

  const handleRefreshAll = () => {
    void loadWallet();
    void loadTransactions(0, filterType, filterFrom, filterTo);
  };

  // ── Pagination ───────────────────────────────────────────────────────────────
  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < txTotalPages) {
      void loadTransactions(newPage, filterType, filterFrom, filterTo);
    }
  };

  // ── Filtered items by local search keyword (referenceId / ID / description) ──
  const displayItems = useMemo(() => {
    if (!searchKeyword.trim()) return txItems;
    const q = searchKeyword.trim().toLowerCase();
    return txItems.filter((tx) => {
      const ref = (tx.referenceId || '').toLowerCase();
      const id = (tx.id || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const label = resolveTxLabel(tx).toLowerCase();
      return ref.includes(q) || id.includes(q) || desc.includes(q) || label.includes(q);
    });
  }, [txItems, searchKeyword]);

  // ── Stats calculation from loaded items ──────────────────────────────────────
  const stats = useMemo(() => {
    let totalEarnings = 0;
    let countEarnings = 0;
    let totalReimburses = 0;
    let countReimburses = 0;

    txItems.forEach((tx) => {
      if (tx.type === 'EARNING') {
        totalEarnings += Math.abs(tx.amount);
        countEarnings++;
      } else if (tx.type === 'SHIPPING_REIMBURSE') {
        totalReimburses += Math.abs(tx.amount);
        countReimburses++;
      }
    });

    return { totalEarnings, countEarnings, totalReimburses, countReimburses };
  }, [txItems]);
  const hasTransactionFilters = Boolean(activeQuery.current.type || activeQuery.current.from || activeQuery.current.to);

  // ── Styling helpers ──────────────────────────────────────────────────────────
  function isCredit(tx: WalletTransaction): boolean {
    return tx.direction === 'CREDIT' || tx.amount > 0;
  }

  function getBadgeConfig(tx: WalletTransaction) {
    if (tx.type === 'EARNING' && tx.referenceType === 'INSPECTION_ORDER') {
      return {
        label: 'Thu phí kiểm định',
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: TrendingUp,
        iconColor: 'text-emerald-600',
      };
    }
    if (tx.type === 'SHIPPING_REIMBURSE' && tx.referenceType === 'SHIPMENT') {
      return {
        label: 'Hoàn ứng cước (Sandbox)',
        bg: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: Truck,
        iconColor: 'text-blue-600',
      };
    }
    if (tx.type === 'DEPOSIT') {
      return {
        label: 'Nạp tiền',
        bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        icon: ArrowDownLeft,
        iconColor: 'text-indigo-600',
      };
    }
    if (tx.type === 'WITHDRAW') {
      return {
        label: 'Rút tiền',
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: ArrowUpRight,
        iconColor: 'text-amber-600',
      };
    }
    if (tx.type === 'REFUND') {
      return {
        label: 'Hoàn tiền',
        bg: 'bg-purple-50 border-purple-200 text-purple-800',
        icon: RefreshCw,
        iconColor: 'text-purple-600',
      };
    }
    return {
      label: TX_TYPE_LABELS[tx.type] || tx.type,
      bg: 'bg-slate-100 border-slate-200 text-slate-800',
      icon: Receipt,
      iconColor: 'text-slate-600',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── 1. Page Header & Quick Actions ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#24263e] text-white flex items-center justify-center shrink-0 shadow-sm border border-slate-700">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#24263e] tracking-tight uppercase">
                Ví Trung Tâm Kiểm Định
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Hub Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý số dư khả dụng, doanh thu quyết toán phí kiểm định và hoàn ứng vận chuyển
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={walletLoading || txLoading}
            className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-2 border border-slate-200 shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Đồng bộ dữ liệu ví và lịch sử giao dịch mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c34c36] ${walletLoading || txLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới ví</span>
          </button>
        </div>
      </div>

      {/* ── 2. Top Stats Overview (4 Cards Grid) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Số dư ví khả dụng (Hero Card) */}
        <div className="bg-gradient-to-br from-[#24263e] via-[#2a2c48] to-[#181928] text-white rounded-2xl p-5 shadow-sm border border-slate-800 relative overflow-hidden flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Số dư ví trung tâm
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Khả dụng
            </span>
          </div>

          <div>
            {walletLoading ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <span className="text-slate-400 text-sm font-medium">Đang tải số dư…</span>
              </div>
            ) : walletError ? (
              <div className="text-rose-300 text-xs py-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{walletError}</span>
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono">
                {wallet ? formatVND(wallet.balance) : '0 ₫'}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {wallet?.updatedAt ? `Cập nhật: ${formatTxDate(wallet.updatedAt)}` : 'Sẵn sàng ghi nhận'}
            </span>
            {wallet?.id && (
              <button
                type="button"
                onClick={() => copyToClipboard(wallet.id, 'wallet-id')}
                className="hover:text-white transition flex items-center gap-1 cursor-pointer font-mono"
                title="Sao chép ID ví"
              >
                <span>ID: {wallet.id.substring(0, 6)}…</span>
                {copiedKey === 'wallet-id' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Thu phí kiểm định */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Thu phí kiểm định
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {formatVND(stats.totalEarnings)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.countEarnings} giao dịch quyết toán trang này
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Tự động cộng khi đơn hoàn thành</span>
          </div>
        </div>

        {/* Card 3: Hoàn ứng cước vận chuyển */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Hoàn ứng cước (Sandbox)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {formatVND(stats.totalReimburses)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.countReimburses} giao dịch hoàn cước trang này
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-blue-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>Đối soát hoàn cước vận chuyển Hub</span>
          </div>
        </div>

        {/* Card 4: Tổng số giao dịch */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {hasTransactionFilters ? 'Giao dịch theo bộ lọc' : 'Tổng giao dịch ghi nhận'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#24263e] tracking-tight font-mono">
              {txTotalElements.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Biến động số dư được lưu trữ
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Phân trang {PAGE_SIZE} mục / trang</span>
          </div>
        </div>
      </div>

      {/* ── 3. Internal Policy Notice ────────────────────────────────────────── */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-900 flex items-start gap-3 shadow-2xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p>
            Phí kiểm định được ghi có khi hệ thống quyết toán đơn. Cước Sandbox do Hub ứng sẽ xuất hiện trong ví sau khi được hoàn ứng. Cước trả hàng thanh toán từ dự phòng được theo dõi ở chi tiết vận đơn.
          </p>
          <p className="text-[11px] text-blue-800">
            Bạn có thể bấm vào mã tham chiếu đơn kiểm định (<span className="font-semibold">Mã đơn #...</span>) trong bảng để kiểm tra nhanh chi tiết đơn kiểm định gốc.
          </p>
        </div>
      </div>

      {/* ── 4. Filter Toolbar & Search ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mr-1">
            Bộ lọc nhanh:
          </span>
          <button
            type="button"
            onClick={() => handleSelectQuickFilter('')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === ''
                ? 'bg-[#24263e] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả{hasTransactionFilters ? '' : ` (${txTotalElements})`}
          </button>
          <button
            type="button"
            onClick={() => handleSelectQuickFilter('EARNING')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'EARNING'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            Thu phí kiểm định
          </button>
          <button
            type="button"
            onClick={() => handleSelectQuickFilter('SHIPPING_REIMBURSE')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'SHIPPING_REIMBURSE'
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Truck className="w-3 h-3" />
            Hoàn ứng cước
          </button>
          <button
            type="button"
            onClick={() => handleSelectQuickFilter('DEPOSIT')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'DEPOSIT'
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Nạp tiền
          </button>
          <button
            type="button"
            onClick={() => handleSelectQuickFilter('WITHDRAW')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'WITHDRAW'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Rút tiền
          </button>
        </div>

        {/* Form controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Dropdown Type */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
              <span>Loại giao dịch</span>
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as WalletTransactionType | '')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none transition"
            >
              {TX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TX_TYPE_LABELS[t || 'ALL'] ?? t}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Từ ngày</span>
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-[#c34c36] outline-none font-mono"
            />
          </div>

          {/* To date */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Đến ngày</span>
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-[#c34c36] outline-none font-mono"
            />
          </div>

          {/* Search by reference or keyword */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Tìm mã tham chiếu / nội dung</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="VD: mã đơn, vận đơn, ID..."
                className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-[#c34c36] outline-none"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={txLoading}
              className="flex-1 py-2 px-3.5 rounded-xl bg-[#24263e] hover:bg-[#1a1b2d] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <span>Lọc</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              disabled={txLoading}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              title="Đặt lại toàn bộ bộ lọc"
            >
              Đặt lại
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Transactions Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-[#faf8f5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#c34c36]" />
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
              LỊCH SỬ GIAO DỊCH VÍ TRUNG TÂM
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200/80 text-slate-700">
              {displayItems.length} {searchKeyword ? `/ ${txItems.length}` : ''} giao dịch
            </span>
          </div>

          {txLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c34c36]" />
              <span>Đang tải dữ liệu…</span>
            </div>
          )}
        </div>

        {/* Error state */}
        {txError ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">Không thể tải lịch sử giao dịch</p>
              <p className="text-xs text-rose-600">{txError}</p>
            </div>
            <button
              type="button"
              onClick={handleRefreshAll}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition"
            >
              Thử tải lại
            </button>
          </div>
        ) : displayItems.length === 0 && !txLoading ? (
          /* Empty state */
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
              <Receipt className="w-8 h-8 text-slate-300" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-bold text-slate-800">
                {activeQuery.current.type === 'SHIPPING_REIMBURSE' && !txTotalElements
                  ? 'Chưa có giao dịch hoàn ứng trong khoảng đã chọn'
                  : 'Chưa ghi nhận giao dịch nào'}
              </h4>
              <p className="text-xs text-slate-500">
                {searchKeyword || filterType || filterFrom || filterTo
                  ? 'Không có giao dịch nào khớp với bộ lọc tìm kiếm hiện tại.'
                  : 'Các khoản thu phí kiểm định và hoàn ứng vận chuyển sẽ tự động hiển thị tại đây khi phát sinh giao dịch.'}
              </p>
            </div>
            {(filterType || filterFrom || filterTo || searchKeyword) && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            )}
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600">
                  <th className="py-3 px-4 text-left font-extrabold whitespace-nowrap">
                    Thời gian
                  </th>
                  <th className="py-3 px-4 text-left font-extrabold min-w-[220px]">
                    Nội dung & Phân loại
                  </th>
                  <th className="py-3 px-4 text-right font-extrabold whitespace-nowrap">
                    Số tiền biến động
                  </th>
                  <th className="py-3 px-4 text-right font-extrabold whitespace-nowrap">
                    Số dư sau giao dịch
                  </th>
                  <th className="py-3 px-4 text-left font-extrabold whitespace-nowrap">
                    Mã tham chiếu
                  </th>
                  <th className="py-3 px-4 text-center font-extrabold whitespace-nowrap">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayItems.map((tx) => {
                  const credit = isCredit(tx);
                  const badge = getBadgeConfig(tx);
                  const displayTitle = resolveTxLabel(tx);
                  const isInspectionRef = tx.referenceType === 'INSPECTION_ORDER' && Boolean(tx.referenceId);
                  const isShipmentRef = tx.referenceType === 'SHIPMENT' && Boolean(tx.referenceId);

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setDetailModalTx(tx)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* 1. Thời gian */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap align-top font-mono">
                        <div className="font-semibold text-slate-700">{formatTxDate(tx.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">ID: {tx.id.substring(0, 8)}…</div>
                      </td>

                      {/* 2. Nội dung & Loại giao dịch */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 group-hover:text-[#c34c36] transition flex items-center gap-1.5 flex-wrap">
                            <span>{displayTitle}</span>
                            {/* Category badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}
                            >
                              <badge.icon className={`w-3 h-3 ${badge.iconColor}`} />
                              {badge.label}
                            </span>
                          </div>

                          {/* Secondary description if different */}
                          {tx.description && tx.description !== displayTitle && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {tx.description}
                            </div>
                          )}

                          {/* Direction Indicator */}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {credit ? (
                              <span className="text-emerald-700 font-medium">Ghi có vào ví (CREDIT)</span>
                            ) : (
                              <span className="text-rose-700 font-medium">Ghi nợ từ ví (DEBIT)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Số tiền */}
                      <td className="py-3 px-4 text-right whitespace-nowrap align-top font-mono">
                        <div
                          className={`text-sm font-black flex items-center justify-end gap-1 ${
                            credit ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {credit ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 rotate-180 shrink-0 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          )}
                          <span>
                            {credit ? '+' : '-'} {formatVND(Math.abs(tx.amount))}
                          </span>
                        </div>
                        {tx.currency && (
                          <div className="text-[10px] text-slate-400 font-semibold">{tx.currency}</div>
                        )}
                      </td>

                      {/* 4. Số dư sau giao dịch */}
                      <td className="py-3 px-4 text-right whitespace-nowrap align-top font-mono">
                        {tx.balanceAfter == null ? (
                          <span className="text-slate-400 italic font-medium">Chưa có dữ liệu</span>
                        ) : (
                          <div>
                            <div className="font-extrabold text-slate-800">
                              {formatVND(tx.balanceAfter)}
                            </div>
                            {tx.balanceBefore != null && (
                              <div className="text-[10px] text-slate-400">
                                Trước: {formatVND(tx.balanceBefore)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Mã tham chiếu */}
                      <td
                        className="py-3 px-4 align-top"
                        onClick={(e) => {
                          // Prevent modal open when clicking reference action
                          if (isInspectionRef && onNavigateToOrder) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {tx.referenceId ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                                  isInspectionRef
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : isShipmentRef
                                      ? 'bg-blue-50 text-blue-900 border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {isInspectionRef && <FileText className="w-3 h-3 text-amber-700" />}
                                {isShipmentRef && <Truck className="w-3 h-3 text-blue-700" />}
                                <span>#{tx.referenceId}</span>
                              </span>

                              {/* Copy button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(tx.referenceId!, `ref-${tx.id}`);
                                }}
                                className="p-1 hover:bg-slate-200/80 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                title="Sao chép mã tham chiếu"
                              >
                                {copiedKey === `ref-${tx.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Direct link to order if Inspection Order */}
                            {isInspectionRef && onNavigateToOrder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToOrder(tx.referenceId!);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#c34c36] hover:underline cursor-pointer"
                              >
                                <span>Xem đơn kiểm định</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* 6. Thao tác */}
                      <td className="py-3 px-4 text-center align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalTx(tx);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#24263e] hover:text-white text-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                          title="Xem toàn bộ thông tin chi tiết giao dịch"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {txTotalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-[#faf8f5] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-600 font-medium">
              Trang <span className="font-bold text-slate-900">{txPage + 1}</span> /{' '}
              <span className="font-bold text-slate-900">{txTotalPages}</span> (Tổng{' '}
              <span className="font-bold text-slate-900">{txTotalElements}</span> giao dịch)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={txPage === 0 || txLoading}
                onClick={() => handlePageChange(0)}
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Về trang đầu"
              >
                Đầu
              </button>
              <button
                type="button"
                disabled={txPage === 0 || txLoading}
                onClick={() => handlePageChange(txPage - 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800">
                {txPage + 1}
              </span>

              <button
                type="button"
                disabled={txPage >= txTotalPages - 1 || txLoading}
                onClick={() => handlePageChange(txPage + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang kế tiếp"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={txPage >= txTotalPages - 1 || txLoading}
                onClick={() => handlePageChange(txTotalPages - 1)}
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Đến trang cuối"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Transaction Detail Modal ───────────────────────────────────────── */}
      {detailModalTx && (
        <div
          onClick={() => setDetailModalTx(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs text-[#24263e] animate-scaleUp max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#24263e] text-white">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 uppercase">
                    Chi Tiết Giao Dịch Ví
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {detailModalTx.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalTx(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prominent Amount Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Số tiền biến động
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  isCredit(detailModalTx) ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isCredit(detailModalTx) ? '+' : '-'} {formatVND(Math.abs(detailModalTx.amount))}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    getBadgeConfig(detailModalTx).bg
                  }`}
                >
                  {getBadgeConfig(detailModalTx).label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Thành công
                </span>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-2.5 divide-y divide-slate-100 pt-1">
              {/* Nội dung */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <span className="text-slate-500 font-medium">Nội dung hiển thị:</span>
                <span className="font-bold text-slate-900 text-right">
                  {resolveTxLabel(detailModalTx)}
                </span>
              </div>

              {/* Ghi chú backend */}
              {detailModalTx.description && (
                <div className="flex items-start justify-between gap-4 pt-2">
                  <span className="text-slate-500 font-medium">Diễn giải hệ thống:</span>
                  <span className="text-slate-700 text-right max-w-[260px]">
                    {detailModalTx.description}
                  </span>
                </div>
              )}

              {/* Thời gian */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <span className="text-slate-500 font-medium">Thời gian giao dịch:</span>
                <span className="font-mono text-slate-800 text-right">
                  {formatTxFullDate(detailModalTx.createdAt)}
                </span>
              </div>

              {/* Loại giao dịch */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <span className="text-slate-500 font-medium">Loại giao dịch (Type):</span>
                <span className="font-mono font-bold text-slate-800">
                  {detailModalTx.type}
                </span>
              </div>

              {/* Mã tham chiếu */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <span className="text-slate-500 font-medium">Mã tham chiếu (Ref):</span>
                <div className="text-right space-y-1">
                  {detailModalTx.referenceId ? (
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                        #{detailModalTx.referenceId}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(detailModalTx.referenceId!, 'modal-ref')}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="Sao chép mã tham chiếu"
                      >
                        {copiedKey === 'modal-ref' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Không có</span>
                  )}
                  {detailModalTx.referenceType && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Loại: {detailModalTx.referenceType}
                    </div>
                  )}
                </div>
              </div>

              {/* Đối soát số dư */}
              <div className="pt-2 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Đối soát số dư ví
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-[10px] text-slate-400">Số dư trước GD:</div>
                    <div className="font-mono font-bold text-slate-700">
                      {detailModalTx.balanceBefore != null
                        ? formatVND(detailModalTx.balanceBefore)
                        : 'Chưa có dữ liệu'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Số dư sau GD:</div>
                    <div className="font-mono font-bold text-slate-900">
                      {detailModalTx.balanceAfter != null
                        ? formatVND(detailModalTx.balanceAfter)
                        : 'Chưa có dữ liệu'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
              {detailModalTx.referenceType === 'INSPECTION_ORDER' &&
                detailModalTx.referenceId &&
                onNavigateToOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = detailModalTx.referenceId!;
                      setDetailModalTx(null);
                      onNavigateToOrder(id);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>Mở đơn kiểm định #{detailModalTx.referenceId}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

              <button
                type="button"
                onClick={() => setDetailModalTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
