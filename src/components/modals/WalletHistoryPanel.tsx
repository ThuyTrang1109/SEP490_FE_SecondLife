import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Wallet,
  Coins,
  RefreshCw,
  ShoppingBag,
  Truck,
  Search,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Info,
  Sparkles,
  Clock,
  Calendar,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  WalletTransaction,
  WalletTransactionType,
  TopupPackagePurchaseResponse,
} from '../../types';
import { walletService } from '../../services/walletService';
import { topupService } from '../../services/topupService';
import {
  formatWalletMoney,
  walletDateRange,
  walletReferenceLabel,
  walletTransactionLabel,
} from '../../utils/walletTransactions';

export interface WalletHistoryPanelProps {
  lang?: string;
  refreshKey?: number;
  onClose?: () => void;
  purchases?: TopupPackagePurchaseResponse[];
  onRefresh?: () => void;
}

export const WalletHistoryPanel: React.FC<WalletHistoryPanelProps> = ({
  lang = 'vi',
  refreshKey = 0,
  purchases: initialPurchases = [],
  onRefresh,
}) => {
  // Filters & Pagination State
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [isLast, setIsLast] = useState<boolean>(true);

  // List of package purchases to enrich package transactions
  const [packagePurchases, setPackagePurchases] = useState<TopupPackagePurchaseResponse[]>(initialPurchases);

  const [selectedType, setSelectedType] = useState<WalletTransactionType | ''>('');
  const [fromInput, setFromInput] = useState<string>('');
  const [toInput, setToInput] = useState<string>('');
  const [dateFilterError, setDateFilterError] = useState<string | null>(null);

  // Active query applied to list
  const [appliedQuery, setAppliedQuery] = useState<{
    type: WalletTransactionType | '';
    from?: string;
    to?: string;
  }>({
    type: '',
  });

  // Transaction Detail Modal State
  const [detailModalTx, setDetailModalTx] = useState<WalletTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  // Sync package purchases
  useEffect(() => {
    if (initialPurchases && initialPurchases.length > 0) {
      setPackagePurchases(initialPurchases);
    } else {
      topupService.getPurchases(0, 100).then((res) => {
        const list = res?.items || (Array.isArray(res) ? res : []);
        setPackagePurchases(list);
      }).catch(() => {});
    }
  }, [initialPurchases, refreshKey]);

  // Load Transactions List
  const loadTransactions = useCallback(
    async (targetPage = page) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const pageData = await walletService.getTransactions(
          {
            page: targetPage,
            size: pageSize,
            sort: 'createdAt,desc',
            type: appliedQuery.type || undefined,
            from: appliedQuery.from,
            to: appliedQuery.to,
          },
          controller.signal
        );

        setItems(pageData.items);
        setPage(pageData.page);
        setTotalPages(pageData.totalPages);
        setTotalElements(pageData.totalElements);
        setIsLast(pageData.isLast);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return;
        }
        console.error('Lỗi tải danh sách giao dịch ví:', err);
        setError(err.message || 'Không thể tải lịch sử giao dịch ví. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    },
    [appliedQuery, page, pageSize]
  );

  // Trigger loading when applied filters change or when external refreshKey changes
  useEffect(() => {
    loadTransactions(0);
  }, [appliedQuery, refreshKey]);

  // Auto search when user changes type or enters/changes dates
  useEffect(() => {
    setDateFilterError(null);
    let fromIso: string | undefined;
    let toIso: string | undefined;

    if (fromInput || toInput) {
      if (fromInput && toInput) {
        const range = walletDateRange(fromInput, toInput);
        if (range.error) {
          setDateFilterError(range.error);
          return;
        }
        fromIso = range.from;
        toIso = range.to;
      } else {
        const range = walletDateRange(fromInput || undefined, toInput || undefined);
        fromIso = range.from;
        toIso = range.to;
      }
    }

    const timer = setTimeout(() => {
      setAppliedQuery({
        type: selectedType,
        from: fromIso,
        to: toIso,
      });
      setPage(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedType, fromInput, toInput]);

  // Apply Filter Handler
  const handleApplyFilter = () => {
    setDateFilterError(null);
    let fromIso: string | undefined;
    let toIso: string | undefined;

    if (fromInput || toInput) {
      if (fromInput && toInput) {
        const range = walletDateRange(fromInput, toInput);
        if (range.error) {
          setDateFilterError(range.error);
          return;
        }
        fromIso = range.from;
        toIso = range.to;
      } else {
        const range = walletDateRange(fromInput || undefined, toInput || undefined);
        fromIso = range.from;
        toIso = range.to;
      }
    }

    setAppliedQuery({
      type: selectedType,
      from: fromIso,
      to: toIso,
    });
    setPage(0);
  };

  // Reset / Clear Filters
  const handleClearFilter = () => {
    setSelectedType('');
    setFromInput('');
    setToInput('');
    setDateFilterError(null);
    setAppliedQuery({
      type: '',
    });
    setPage(0);
  };

  // Open Transaction Detail Popup
  const handleOpenDetail = async (tx: WalletTransaction) => {
    setDetailModalTx(tx);
    setDetailLoading(true);
    setDetailError(null);

    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;

    try {
      const fullDetail = await walletService.getTransactionDetail(tx.id, controller.signal);
      setDetailModalTx(fullDetail);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        return;
      }
      console.warn('Không thể nạp chi tiết bổ sung từ API detail, giữ dữ liệu từ list:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Find matching package purchase for a transaction
  const findMatchingPurchase = useCallback(
    (tx: WalletTransaction): TopupPackagePurchaseResponse | null => {
      if (!packagePurchases || packagePurchases.length === 0) return null;

      // 1. Check exact referenceId match
      if (tx.referenceId) {
        const match = packagePurchases.find(
          (p) =>
            p.id === tx.referenceId ||
            p.id.toLowerCase().startsWith(tx.referenceId!.toLowerCase()) ||
            (p.requestId && p.requestId === tx.referenceId)
        );
        if (match) return match;
      }

      // 2. Check by package payment type, amount and timestamp
      const isPkgType =
        tx.type === 'PAYMENT' &&
        (tx.referenceType === 'CREDIT_PURCHASE' ||
          tx.referenceType === 'TOPUP_PACKAGE' ||
          tx.referenceType === 'PACKAGE_PURCHASE' ||
          tx.description?.toLowerCase().includes('mua gói') ||
          tx.description?.toLowerCase().includes('quyền sử dụng'));

      if (isPkgType) {
        const txTime = new Date(tx.createdAt).getTime();
        const match = packagePurchases.find((p) => {
          const pTime = new Date(p.createdAt).getTime();
          const priceMatch = Math.abs(tx.amount) === p.price;
          const timeDiff = Math.abs(txTime - pTime);
          return priceMatch && timeDiff < 180000; // within 3 minutes
        });
        if (match) return match;
      }

      return null;
    },
    [packagePurchases]
  );

  // Resolve clear title, purpose (Làm gì), and time (Dùng khi nào)
  const resolveTxInfo = useCallback(
    (tx: WalletTransaction) => {
      const matchingPurchase = findMatchingPurchase(tx);

      // 1. Dùng khi nào: Định dạng thời gian rõ ràng, đầy đủ ngày giờ
      const txDate = new Date(tx.createdAt);
      const timeFormatted = !isNaN(txDate.getTime())
        ? `${txDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • ${txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : '—';
      const timeDetailed = !isNaN(txDate.getTime())
        ? `${txDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - ${txDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : '—';

      // 2. Làm gì: Tiêu đề rõ ràng, mô tả mục đích chi tiết
      let title = walletTransactionLabel(tx.type);
      let purpose = tx.description || 'Giao dịch biến động số dư ví';
      let rightsBadge: string | null = null;
      let isPackage = false;

      if (matchingPurchase) {
        isPackage = true;
        title = `Mua Gói ${matchingPurchase.packageName}`;
        const rightsArr: string[] = [];
        if (matchingPurchase.postCredits) rightsArr.push(`+${matchingPurchase.postCredits} tin đăng`);
        if (matchingPurchase.chatCredits) rightsArr.push(`+${matchingPurchase.chatCredits} chat AI`);
        if (matchingPurchase.valuationCredits) rightsArr.push(`+${matchingPurchase.valuationCredits} định giá AI`);
        rightsBadge = rightsArr.join(' • ');
        purpose = `Trừ ví mua gói ${matchingPurchase.packageName} (phiên bản v${matchingPurchase.packageVersion}). Quyền lợi đã cấp: ${rightsBadge || 'Đã kích hoạt vào tài khoản'}.`;
      } else if (
        tx.type === 'PAYMENT' &&
        (tx.referenceType === 'CREDIT_PURCHASE' ||
          tx.referenceType === 'TOPUP_PACKAGE' ||
          tx.referenceType === 'PACKAGE_PURCHASE' ||
          tx.description?.toLowerCase().includes('mua gói') ||
          tx.description?.toLowerCase().includes('quyền sử dụng'))
      ) {
        isPackage = true;
        title = 'Mua Gói Quyền Sử Dụng Dịch Vụ';
        rightsBadge = 'Lượt đăng tin & tính năng AI';
        purpose = 'Trừ tiền ví để mua gói quyền sử dụng lượt đăng tin và tính năng AI SecondLife.';
      } else if (tx.type === 'DEPOSIT') {
        title = 'Nạp Tiền Vào Ví (VietQR)';
        rightsBadge = 'Nạp qua VietQR SePay';
        purpose = 'Nạp tiền tự động qua cổng VietQR SePay, tiền đã được cộng trực tiếp vào số dư ví khả dụng.';
      } else if (tx.type === 'EARNING') {
        title = 'Nhận Tiền Bán Hàng (Escrow)';
        rightsBadge = tx.referenceId ? `Đơn hàng #${tx.referenceId.slice(0, 8).toUpperCase()}` : 'Giải ngân Escrow';
        purpose = tx.referenceId
          ? `Người mua đã xác nhận nhận hàng cho đơn #${tx.referenceId.slice(0, 8).toUpperCase()}, Quỹ Escrow giải ngân tiền về ví.`
          : 'Quỹ Escrow giải ngân tiền bán hàng vào ví thành công.';
      } else if (tx.type === 'REFUND') {
        title = 'Hoàn Tiền Vào Ví';
        rightsBadge = tx.referenceType === 'WITHDRAWAL' ? 'Hoàn tiền rút' : 'Hoàn tiền bảo lãnh';
        purpose =
          tx.referenceType === 'WITHDRAWAL'
            ? 'Hoàn trả lại số tiền vào ví do lệnh rút tiền về ngân hàng bị hủy bỏ hoặc từ chối.'
            : tx.referenceId
            ? `Hoàn tiền bảo lãnh cho đơn hàng #${tx.referenceId.slice(0, 8).toUpperCase()} theo chính sách giao dịch an toàn.`
            : 'Hoàn trả tiền vào ví theo chính sách hoàn trả của SecondLife.';
      } else if (tx.type === 'WITHDRAW') {
        title = 'Rút Tiền Về Ngân Hàng';
        rightsBadge = 'Rút tiền tài khoản';
        purpose = 'Khấu trừ tiền ví để thực hiện lệnh chuyển khoản rút tiền về tài khoản ngân hàng của bạn.';
      } else if (tx.type === 'RETURN_SHIPPING_FEE') {
        title = 'Phí Vận Chuyển Hoàn Hàng';
        rightsBadge = tx.referenceId ? `Đơn #${tx.referenceId.slice(0, 8).toUpperCase()}` : 'Phí ship hoàn';
        purpose = tx.referenceId
          ? `Khấu trừ chi phí vận chuyển chiều hoàn của đơn hàng #${tx.referenceId.slice(0, 8).toUpperCase()} theo quy định hoàn hàng.`
          : 'Khấu trừ chi phí vận chuyển chiều hoàn hàng.';
      } else if (tx.type === 'PAYMENT') {
        title = 'Thanh Toán Đơn Hàng';
        rightsBadge = tx.referenceId ? `Đơn #${tx.referenceId.slice(0, 8).toUpperCase()}` : 'Thanh toán ví';
        purpose = tx.referenceId
          ? `Trừ tiền ví thanh toán cho đơn hàng #${tx.referenceId.slice(0, 8).toUpperCase()}, tiền được tạm giữ trong Quỹ Escrow an toàn.`
          : (tx.description || 'Thanh toán dịch vụ trên hệ thống SecondLife.');
      }

      return {
        title,
        purpose,
        timeFormatted,
        timeDetailed,
        rightsBadge,
        isPackage,
        matchingPurchase,
      };
    },
    [findMatchingPurchase]
  );

  // Render Icon according to transaction type
  const renderTransactionIcon = (type: string, isPackage = false) => {
    if (isPackage) return <Sparkles className="w-5 h-5 text-purple-600" />;
    switch (type) {
      case 'DEPOSIT':
        return <Wallet className="w-5 h-5 text-emerald-600" />;
      case 'WITHDRAW':
        return <ArrowUpRight className="w-5 h-5 text-amber-600" />;
      case 'PAYMENT':
        return <ShoppingBag className="w-5 h-5 text-rose-600" />;
      case 'EARNING':
        return <Coins className="w-5 h-5 text-teal-600" />;
      case 'REFUND':
        return <RefreshCw className="w-5 h-5 text-blue-600" />;
      case 'RETURN_SHIPPING_FEE':
        return <Truck className="w-5 h-5 text-orange-600" />;
      default:
        return <Wallet className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIconBg = (type: string, isPackage = false) => {
    if (isPackage) return 'bg-purple-100';
    switch (type) {
      case 'DEPOSIT':
        return 'bg-emerald-100';
      case 'WITHDRAW':
        return 'bg-amber-100';
      case 'PAYMENT':
        return 'bg-rose-100';
      case 'EARNING':
        return 'bg-teal-100';
      case 'REFUND':
        return 'bg-blue-100';
      case 'RETURN_SHIPPING_FEE':
        return 'bg-orange-100';
      default:
        return 'bg-slate-100';
    }
  };

  // Check if any item in current page has missing balance (null balanceAfter)
  const hasUnrecordedBalance = items.some((item) => item.balanceAfter === null);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2">
      {/* 1. THANH BỘ LỌC CÂN XỨNG & ĐỒNG BỘ CHIỀU CAO (h-9) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
          {/* Loại giao dịch */}
          <div className="flex-1 min-w-[170px]">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 whitespace-nowrap">
              Loại giao dịch:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as WalletTransactionType | '')}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#c34c36]/30 cursor-pointer transition"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="DEPOSIT">Nạp tiền (DEPOSIT)</option>
              <option value="PAYMENT">Thanh toán & Mua gói (PAYMENT)</option>
              <option value="EARNING">Nhận tiền bán (EARNING)</option>
              <option value="REFUND">Hoàn tiền (REFUND)</option>
              <option value="WITHDRAW">Rút tiền (WITHDRAW)</option>
              <option value="RETURN_SHIPPING_FEE">Phí ship hoàn hàng</option>
            </select>
          </div>

          {/* Từ ngày */}
          <div className="w-full sm:w-36 md:w-40 shrink-0">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 whitespace-nowrap">
              Từ ngày:
            </label>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#c34c36]/30 transition"
            />
          </div>

          {/* Đến ngày */}
          <div className="w-full sm:w-36 md:w-40 shrink-0">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 whitespace-nowrap">
              Đến ngày:
            </label>
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#c34c36]/30 transition"
            />
          </div>

          {/* Duy nhất 1 nút làm mới toàn bộ */}
          <div className="flex items-center shrink-0 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => {
                if (onRefresh) onRefresh();
                loadTransactions(page);
              }}
              disabled={loading}
              title="Làm mới toàn bộ dữ liệu"
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-[#c34c36] transition flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {dateFilterError && (
          <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{dateFilterError}</span>
          </div>
        )}
      </div>

      {/* 2. GHI CHÚ GỌN GÀNG (Tiết kiệm diện tích hiển thị) */}
      {hasUnrecordedBalance && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-1.5 truncate">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              Ghi chú: Một số giao dịch cũ chưa có số dư tại thời điểm phát sinh.
            </span>
          </div>
          <span className="text-[10px] text-amber-700 font-bold shrink-0 bg-amber-100 px-1.5 py-0.5 rounded-md">
            V60 Update
          </span>
        </div>
      )}

      {/* 3. DANH SÁCH LỊCH SỬ GIAO DỊCH VÍ & GÓI DỊCH VỤ GỘP CHUNG */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex-1 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="w-8 h-8 text-[#c34c36] animate-spin" />
            <span className="text-sm font-bold text-slate-500">Đang tải lịch sử giao dịch ví...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <span className="text-sm font-black text-slate-800">Không thể tải dữ liệu giao dịch</span>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadTransactions(page)}
              className="mt-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 gap-3 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
              <Search className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <span className="text-sm sm:text-base font-black text-slate-800">Chưa có giao dịch phù hợp</span>
              <p className="text-xs text-slate-500">
                Không tìm thấy biến động số dư nào phù hợp với bộ lọc hiện tại. Hãy thử thay đổi loại hoặc khoảng thời gian.
              </p>
            </div>
            {(appliedQuery.type || appliedQuery.from || appliedQuery.to) && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="mt-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-slate-100">
            {items.map((tx) => {
              const isIncome = tx.amount > 0 || tx.direction === 'CREDIT';
              const absAmount = Math.abs(tx.amount);
              const info = resolveTxInfo(tx);
              const balanceText =
                tx.balanceAfter == null ? 'Chưa được ghi nhận' : formatWalletMoney(tx.balanceAfter, lang);
              const balanceBeforeText =
                tx.balanceBefore != null ? formatWalletMoney(tx.balanceBefore, lang) : null;

              return (
                <div
                  key={tx.id}
                  onClick={() => handleOpenDetail(tx)}
                  className="p-3 sm:p-3.5 hover:bg-slate-50/90 transition flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Icon giao dịch */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${getIconBg(
                        tx.type,
                        info.isPackage
                      )}`}
                    >
                      {renderTransactionIcon(tx.type, info.isPackage)}
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* Tiêu đề rõ ràng + Badge quyền lợi */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-[#c34c36] transition-colors leading-tight">
                          {info.title}
                        </span>
                        {info.rightsBadge && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            {info.rightsBadge}
                          </span>
                        )}
                      </div>

                      {/* Mục đích giao dịch chi tiết (Làm gì) */}
                      <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-snug line-clamp-2">
                        {info.purpose}
                      </p>

                      {/* Dùng khi nào (Thời gian chi tiết) & Mã tham chiếu */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap font-medium">
                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          {info.timeFormatted}
                        </span>
                        {tx.referenceId && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-slate-400">
                              Mã GD: #{tx.referenceId.slice(0, 8).toUpperCase()}
                            </span>
                          </>
                        )}
                        {tx.referenceType && tx.referenceType !== 'UNKNOWN' && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 text-[10px]">
                              {walletReferenceLabel(tx.referenceType)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Biến động số dư ví (Trước -> Sau) */}
                      <div className="text-[11px] text-slate-500 font-mono pt-0.5">
                        {balanceBeforeText ? (
                          <span>
                            Số dư ví: <strong className="text-slate-700">{balanceBeforeText}</strong> &rarr;{' '}
                            <strong className="text-slate-900">{balanceText}</strong>
                          </span>
                        ) : (
                          <span>
                            Số dư sau: <strong className="text-slate-800">{balanceText}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Số tiền biến động & Nút xem chi tiết */}
                  <div className="text-right shrink-0 space-y-1.5">
                    <div
                      className={`font-mono font-black text-sm sm:text-base ${
                        isIncome ? 'text-emerald-600' : 'text-[#c34c36]'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatWalletMoney(absAmount, lang)}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(tx);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 ml-auto shadow-2xs hover:shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Chi tiết</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. THANH PHÂN TRANG GỌN GÀNG */}
        {totalPages > 1 && (
          <div className="p-2.5 sm:p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 shrink-0">
            <span className="font-semibold">
              Trang <strong className="text-slate-900">{page + 1}</strong> / {totalPages} ({totalElements} giao dịch)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 0 || loading}
                onClick={() => loadTransactions(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isLast || page + 1 >= totalPages || loading}
                onClick={() => loadTransactions(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                title="Trang kế tiếp"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL CHI TIẾT GIAO DỊCH VÍ (Ghi chi tiết Làm gì & Dùng khi nào) */}
      {detailModalTx && (() => {
        const modalInfo = resolveTxInfo(detailModalTx);
        const isIncome = detailModalTx.amount > 0 || detailModalTx.direction === 'CREDIT';
        const absAmount = Math.abs(detailModalTx.amount);

        return (
          <div
            onClick={() => setDetailModalTx(null)}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 text-[#24263e] space-y-4 max-h-[92vh] overflow-y-auto animate-scaleUp"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${getIconBg(
                      detailModalTx.type,
                      modalInfo.isPackage
                    )}`}
                  >
                    {renderTransactionIcon(detailModalTx.type, modalInfo.isPackage)}
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                      Chi Tiết Giao Dịch Ví
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {modalInfo.title} • Mã #{detailModalTx.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalTx(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5">
                  <Loader2 className="w-7 h-7 text-[#c34c36] animate-spin" />
                  <span className="text-xs font-bold text-slate-500">Đang tải chi tiết giao dịch từ máy chủ...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Không tìm thấy giao dịch</span>
                  </div>
                  <p>{detailError}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(detailModalTx)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <>
                  {/* Số tiền biến động & Chiều giao dịch */}
                  <div className="text-center py-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                      Số tiền biến động
                    </span>
                    <div
                      className={`font-mono font-black text-2xl sm:text-3xl ${
                        isIncome ? 'text-emerald-600' : 'text-[#c34c36]'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatWalletMoney(absAmount, lang)}
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isIncome
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isIncome ? 'Cộng tiền vào ví' : 'Trừ tiền khỏi ví'}
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        Thành công
                      </span>
                    </div>
                  </div>

                  {/* THẺ ĐẶC BIỆT NẾU LÀ MUA GÓI DỊCH VỤ (Quyền lợi, version, snapshot) */}
                  {modalInfo.matchingPurchase && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 via-purple-50/50 to-amber-50/40 border border-purple-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="font-black text-slate-900 text-sm">
                            Gói Dịch Vụ: {modalInfo.matchingPurchase.packageName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold">
                            v{modalInfo.matchingPurchase.packageVersion}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Đã Kích Hoạt
                        </span>
                      </div>

                      {/* Chi tiết 3 quyền lợi */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                          <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Tin Đăng</span>
                          <span className="font-mono font-black text-sm sm:text-base text-purple-700">
                            +{modalInfo.matchingPurchase.postCredits}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                          <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Chat AI</span>
                          <span className="font-mono font-black text-sm sm:text-base text-purple-700">
                            +{modalInfo.matchingPurchase.chatCredits}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                          <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Định Giá AI</span>
                          <span className="font-mono font-black text-sm sm:text-base text-purple-700">
                            +{modalInfo.matchingPurchase.valuationCredits}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* THÔNG TIN CHI TIẾT: LÀM GÌ, DÙNG KHI NÀO, BIẾN ĐỘNG SỐ DƯ */}
                  <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                    {/* 1. LÀM GÌ */}
                    <div className="pb-2 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold block text-[11px] mb-0.5">
                        Mục đích giao dịch (Làm gì):
                      </span>
                      <p className="font-bold text-slate-900 leading-snug">
                        {modalInfo.purpose}
                      </p>
                    </div>

                    {/* 2. DÙNG KHI NÀO */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-slate-500">Thời điểm thực hiện:</span>
                      <span className="font-bold text-slate-900 text-right">
                        {modalInfo.timeDetailed}
                      </span>
                    </div>

                    {/* 3. BIẾN ĐỘNG SỐ DƯ VÍ */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-slate-500">Số dư ví trước:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {detailModalTx.balanceBefore == null
                          ? 'Chưa được ghi nhận'
                          : formatWalletMoney(detailModalTx.balanceBefore, lang)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-slate-700 font-bold">Số dư ví sau:</span>
                      <span className="font-mono font-black text-emerald-700 text-sm sm:text-base">
                        {detailModalTx.balanceAfter == null
                          ? 'Chưa được ghi nhận'
                          : formatWalletMoney(detailModalTx.balanceAfter, lang)}
                      </span>
                    </div>

                    {/* NGUỒN THAM CHIẾU */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-slate-500">Nguồn tham chiếu:</span>
                      <span className="font-bold text-indigo-700">
                        {walletReferenceLabel(detailModalTx.referenceType)}
                      </span>
                    </div>

                    {/* MÃ THAM CHIẾU */}
                    {detailModalTx.referenceId && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="text-slate-500">Mã tham chiếu:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 truncate max-w-[190px]" title={detailModalTx.referenceId}>
                            {detailModalTx.referenceId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(detailModalTx.referenceId!, 'refId')}
                            className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                            title="Sao chép mã tham chiếu"
                          >
                            {copiedKey === 'refId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MÃ GIAO DỊCH ID */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Mã giao dịch ví (ID):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-600 truncate max-w-[190px]" title={detailModalTx.id}>
                          {detailModalTx.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(detailModalTx.id, 'txId')}
                          className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                          title="Sao chép mã giao dịch"
                        >
                          {copiedKey === 'txId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chú thích nếu có số dư chưa ghi nhận */}
                  {(detailModalTx.balanceBefore == null || detailModalTx.balanceAfter == null) && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Số dư tại thời điểm phát sinh giao dịch này chưa được ghi nhận trên hệ thống cũ.</span>
                    </div>
                  )}

                  {detailModalTx.type === 'WITHDRAW' && (
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Đây là khoản tiền đã trừ khỏi ví cho yêu cầu rút tiền. Vui lòng xem yêu cầu rút tiền để biết trạng thái chuyển khoản ngân hàng.
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setDetailModalTx(null)}
                      className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm transition cursor-pointer shadow-sm"
                    >
                      Đóng Chi Tiết
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
