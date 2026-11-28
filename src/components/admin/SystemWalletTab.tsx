import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wallet,
  TrendingUp,
  Truck,
  ShieldCheck,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Search,
  Filter,
  CheckCircle2,
  Building2,
  Layers,
  Eye,
  Zap,
} from 'lucide-react';
import {
  systemWalletService,
  orderService,
} from '../../services';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { AdminInspectionFundsModal } from './AdminInspectionFundsModal';
import { SystemWalletBalanceDialog } from './SystemWalletBalanceDialog';
import type { SystemWalletBalanceFund } from '../../services/systemWalletService';
import { isValidUUID } from '../../utils/negotiationHelper';
import {
  toSystemWalletHistoryItem,
  getSystemWalletBreakdownLines,
  isInternalCommissionTransfer,
} from '../../utils/systemWalletHistory';
import {
  SystemWalletData,
  SystemWalletFundCategory,
  SystemWalletTransaction,
  SystemWalletTransactionFilter,
  OrderSettlementDTO,
  OrderCommissionDTO,
} from '../../types';
import { formatVND } from '../../utils/translations';

export type SystemWalletFilterType =
  | 'ALL'
  | 'PRODUCT_ESCROW'
  | 'USER_SHIPPING'
  | 'HUB_PAYOUT'
  | 'COMMISSION'
  | 'PACKAGE_REVENUE'
  | 'SHIPPING'
  | 'PAYMENT_HOLD'
  | 'INSPECTION_HOLD'
  | 'SETTLEMENT'
  | 'REFUND'
  | 'RETURN_SHIPPING_FEE';

export type SystemWalletViewMode = 'ALL_UNIFIED' | 'ESCROW_ORDERS' | 'INSPECTION_ORDERS';

type UnifiedPlatformItem = ReturnType<typeof toSystemWalletHistoryItem> & { itemTitle?: string };

export interface SystemWalletTabProps {
  onOpenInspectionAudit?: (orderId: string) => void;
}

/**
 * Robust date parser supporting ISO, SQL timestamp, DD/MM/YYYY, epoch numbers, and Spring Jackson arrays.
 */
export const parseDateMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? 0 : t;
  }
  if (Array.isArray(val)) {
    const year = val[0] || 1970;
    const month = (val[1] || 1) - 1;
    const day = val[2] || 1;
    const hour = val[3] || 0;
    const min = val[4] || 0;
    const sec = val[5] || 0;
    return new Date(Date.UTC(year, month, day, hour, min, sec)).getTime();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('T')) {
      const t = Date.parse(trimmed);
      if (!isNaN(t)) return t;
    }
    const isoLike = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (isoLike) {
      const year = parseInt(isoLike[1], 10);
      const month = parseInt(isoLike[2], 10) - 1;
      const day = parseInt(isoLike[3], 10);
      const hour = isoLike[4] ? parseInt(isoLike[4], 10) : 0;
      const min = isoLike[5] ? parseInt(isoLike[5], 10) : 0;
      const sec = isoLike[6] ? parseInt(isoLike[6], 10) : 0;
      return new Date(year, month, day, hour, min, sec).getTime();
    }
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
      return new Date(year, month, day, hour, min, sec).getTime();
    }
    const t = Date.parse(trimmed);
    if (!isNaN(t)) return t;
  }
  return 0;
};

export const SystemWalletTab: React.FC<SystemWalletTabProps> = ({ onOpenInspectionAudit }) => {
  const [wallet, setWallet] = useState<SystemWalletData | null>(null);
  const [transactions, setTransactions] = useState<SystemWalletTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historyRequest = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inspection Funds Integration state
  const [inspectionOrders, setInspectionOrders] = useState<InspectionOrderDto[]>([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<SystemWalletViewMode>('ALL_UNIFIED');
  const [inspectionSearchQuery, setInspectionSearchQuery] = useState('');
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<'ALL' | 'HELD' | 'SETTLED'>('ALL');
  const [localAuditOrderId, setLocalAuditOrderId] = useState<string | null>(null);

  // Filters state for transactions
  const [activeFilter, setActiveFilter] = useState<SystemWalletFilterType>('ALL');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [directAuditId, setDirectAuditId] = useState('');
  const [balanceFund, setBalanceFund] = useState<SystemWalletBalanceFund | null>(null);
  const viewingShippingHistory = activeFilter === 'SHIPPING' || activeFilter === 'USER_SHIPPING';

  // Selected Order Detail Modal (when clicking orderId for Escrow)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<UnifiedPlatformItem | null>(null);
  const [settlementData, setSettlementData] = useState<OrderSettlementDTO | null>(null);
  const [commissionData, setCommissionData] = useState<OrderCommissionDTO | null>(null);
  const [isLoadingOrderInfo, setIsLoadingOrderInfo] = useState(false);
  const [orderInfoError, setOrderInfoError] = useState<string | null>(null);
  const orderInfoRequest = useRef(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchOrderId.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchOrderId]);

  const fetchWallet = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await systemWalletService.getSystemWallet();
      setWallet(data);
    } catch (err: any) {
      console.error('Error fetching system wallet:', err);
      setErrorMessage(err?.message || 'Không thể tải số dư ví hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInspectionOrders = useCallback(async () => {
    setIsLoadingInspection(true);
    try {
      const res = await inspectorService.getAllOrders(undefined, 0, 100);
      const extracted = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
      const list: InspectionOrderDto[] = Array.isArray(extracted) ? [...extracted] : [];
      setInspectionOrders(list);

      // Đồng bộ danh sách đơn kiểm định vào cache
      try {
        localStorage.setItem('all_inspection_orders_cache', JSON.stringify(list));
      } catch { }
    } catch (err: any) {
      console.warn('Could not fetch inspection orders in SystemWalletTab:', err);
      setInspectionOrders([]);
    } finally {
      setIsLoadingInspection(false);
    }
  }, []);

  const fetchTransactions = useCallback(
    async (page = 0, filterType = activeFilter, orderQuery = debouncedSearch) => {
      const request = ++historyRequest.current;
      setIsLoadingHistory(true);
      setHistoryError(false);
      try {
        const filter: SystemWalletTransactionFilter = {
          page,
          size: pageSize,
        };

        if (filterType === 'PACKAGE_REVENUE' || filterType === 'COMMISSION' || filterType === 'PRODUCT_ESCROW') {
          filter.fundCategory = filterType;
        }
        if (filterType === 'SHIPPING' || filterType === 'USER_SHIPPING') {
          filter.hasShipping = true;
        }

        if (isValidUUID(orderQuery)) {
          filter.orderId = orderQuery;
        }

        const res = await systemWalletService.getTransactions(filter);
        if (request !== historyRequest.current) return;
        setTransactions(res.items);
        setCurrentPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err: any) {
        console.error('Error fetching system transactions:', err);
        if (request === historyRequest.current) {
          setTransactions([]);
          setTotalPages(1);
          setHistoryError(true);
        }
      } finally {
        if (request === historyRequest.current) setIsLoadingHistory(false);
      }
    },
    [activeFilter, debouncedSearch, pageSize]
  );

  useEffect(() => {
    fetchWallet();
    fetchInspectionOrders();
  }, [fetchWallet, fetchInspectionOrders]);

  useEffect(() => {
    fetchTransactions(0, activeFilter, debouncedSearch);
  }, [debouncedSearch, fetchTransactions]);

  const handleRefreshAll = () => {
    fetchWallet();
    fetchInspectionOrders();
    fetchTransactions(currentPage, activeFilter, debouncedSearch);
  };

  const handleFilterChange = (type: SystemWalletFilterType) => {
    if (activeViewMode === 'INSPECTION_ORDERS') {
      setActiveViewMode('ALL_UNIFIED');
    }
    setActiveFilter(type);
    setCurrentPage(0);
  };

  const handleResetFilters = () => {
    setActiveFilter('ALL');
    setSearchOrderId('');
    setCurrentPage(0);
  };

  // Metrics for Inspection Funds
  const inspectionMetrics = useMemo(() => {
    let heldReserveTotal = 0;
    let inspectionShippingHeld = 0;
    let inspectionFeesAwaitingSettlement = 0;
    let totalInspectionCollected = 0;
    let activeInspectionOrdersCount = 0;
    let settledInspectionOrdersCount = 0;

    inspectionOrders.forEach((ord) => {
      const isSettled = Boolean(ord.feeSettledAt);
      const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);
      const reserve = Number(ord.returnShippingReserveFee || 0);
      const shipping = Number(ord.shippingFee || 0);
      const fee = Number(ord.inspectionFee || (ord as any).inspectionFeeVnd || 0);
      const deposit = Number(ord.buyerCommitmentDeposit || 0);

      const collected =
        (ord.sellerPaidAt ? (ord.sellerFeeShare || 0) : 0) +
        (ord.buyerPaidAt ? (ord.buyerFeeShare || 0) : 0) +
        deposit;

      totalInspectionCollected += collected;

      if (isSettled) {
        settledInspectionOrdersCount++;
      } else if (isPaid) {
        activeInspectionOrdersCount++;
        heldReserveTotal += reserve;
        inspectionShippingHeld += shipping;
        inspectionFeesAwaitingSettlement += fee;
      }
    });

    return {
      heldReserveTotal,
      inspectionShippingHeld,
      inspectionFeesAwaitingSettlement,
      totalInspectionCollected,
      activeInspectionOrdersCount,
      settledInspectionOrdersCount,
      totalInspectionHeld: heldReserveTotal + inspectionShippingHeld + inspectionFeesAwaitingSettlement,
    };
  }, [inspectionOrders]);

  // 0. Ví tổng hệ thống (Total System Balance) - lấy trực tiếp từ Database
  const totalSystemBalance = Number(wallet?.totalBalance ?? 0);

  // Grand Total of all managed funds - lấy trực tiếp từ Database
  const grandTotalHeld =
    Number(wallet?.heldBalance ?? 0) +
    Number(wallet?.shippingBalance ?? 0) +
    Number(wallet?.inspectionHeldBalance ?? 0);

  // 1. Tổng tiền hàng đang giữ (Product Escrow) - lấy trực tiếp từ Database
  const totalProductHeld = Number(wallet?.heldBalance ?? 0);

  // 2. Tổng tiền kiểm định đang giữ (Inspection Escrow) - lấy trực tiếp từ Database
  const totalInspectionHeld = Number(wallet?.inspectionHeldBalance ?? 0);

  // 3. Tổng tiền ship đã thu của người dùng (All User Shipping Held) - lấy trực tiếp từ Database
  const totalUserShippingHeld = Number(wallet?.shippingBalance ?? 0);

  // 4. Tổng tiền đã thanh toán cho bên Hub (All Hub Payouts) - lấy trực tiếp từ Database
  const totalHubPaid = Number(wallet?.totalHubPaid ?? 0);

  // 5. Tổng tiền hoa hồng sàn (All Revenue Balance) - lấy trực tiếp từ Database
  const packageRevenue = Number(wallet?.packageRevenueBalance ?? 0);
  const commissionRevenue = Number(wallet?.revenueBalance ?? 0) - packageRevenue;

  const getTransactionBadgeClass = (type: string, category: SystemWalletFundCategory) => {
    if (category === 'PACKAGE_REVENUE') return 'bg-violet-100 text-violet-800 border-violet-200';
    if (category === 'COMMISSION') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (category === 'HUB_PAYOUT') return 'bg-purple-100 text-purple-800 border-purple-300';
    switch (type) {
      case 'PAYMENT_HOLD':
      case 'INSPECTION_HOLD':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SETTLEMENT':
      case 'INSPECTION_SETTLEMENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REFUND':
      case 'INSPECTION_REFUND':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'RETURN_SHIPPING_FEE':
      case 'INSPECTION_RETURN_SHIPPING':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const unifiedTransactions = useMemo(() => {
    const titles = new Map(inspectionOrders.map((order) => [order.id, order.postTitle]));
    return transactions.map((transaction) => {
      const item = toSystemWalletHistoryItem(transaction);
      return { ...item, itemTitle: item.source === 'INSPECTION' ? titles.get(item.orderId) : undefined };
    }).sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt) || b.transaction.id - a.transaction.id);
  }, [transactions, inspectionOrders]);

  const displayedUnifiedItems = useMemo(() => {
    let list = unifiedTransactions;

    if (activeFilter === 'PRODUCT_ESCROW') {
      list = list.filter((item) => item.fundCategory === 'PRODUCT_ESCROW');
    } else if (activeFilter === 'HUB_PAYOUT') {
      list = list.filter((item) =>
        item.fundCategory === 'HUB_PAYOUT' ||
        item.typeLabel === 'Thanh toán ví Hub'
      );
    } else if (activeFilter === 'COMMISSION' || activeFilter === 'PACKAGE_REVENUE') {
      list = list.filter((item) => item.fundCategory === activeFilter);
    } else if (activeFilter === 'USER_SHIPPING' || activeFilter === 'SHIPPING') {
      list = list.filter((item) => Number(item.transaction.shippingDelta) !== 0);
    } else if (activeFilter === 'PAYMENT_HOLD') {
      list = list.filter((item) =>
        item.typeLabel === 'Nhận ký quỹ' ||
        (item.type === 'PAYMENT_HOLD' && item.typeLabel !== 'Thu phí kiểm định')
      );
    } else if (activeFilter === 'INSPECTION_HOLD') {
      list = list.filter((item) =>
        item.typeLabel === 'Thu phí kiểm định' ||
        item.type === 'INSPECTION_HOLD'
      );
    } else if (activeFilter === 'SETTLEMENT') {
      list = list.filter((item) =>
        item.typeLabel === 'Giải ngân' ||
        (
          (item.type === 'SETTLEMENT' || item.type === 'INSPECTION_SETTLEMENT') &&
          item.fundCategory !== 'COMMISSION' &&
          item.fundCategory !== 'HUB_PAYOUT' &&
          item.typeLabel !== 'Hoa hồng sàn' &&
          item.typeLabel !== 'Thanh toán ví Hub'
        )
      );
    } else if (activeFilter === 'REFUND') {
      list = list.filter((item) =>
        item.type === 'REFUND' ||
        item.type === 'INSPECTION_REFUND' ||
        item.typeLabel === 'Hoàn tiền' ||
        item.typeLabel === 'Hoàn phí kiểm định'
      );
    } else if (activeFilter === 'RETURN_SHIPPING_FEE') {
      list = list.filter((item) =>
        item.type === 'RETURN_SHIPPING_FEE' ||
        item.type === 'INSPECTION_RETURN_SHIPPING' ||
        item.typeLabel === 'Thu cước trả hàng' ||
        item.typeLabel === 'Cước trả hàng kiểm định'
      );
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase().trim();
      const cleanQuery = query.replace(/^#/, '');
      list = list.filter((item) =>
        item.referenceId.toLowerCase().includes(cleanQuery) ||
        item.displayId.toLowerCase().includes(query) ||
        item.itemTitle?.toLowerCase().includes(query) ||
        item.entryId.toLowerCase().includes(cleanQuery) ||
        String(item.transaction.id).includes(cleanQuery) ||
        item.typeLabel.toLowerCase().includes(query)
      );
    }

    return list;
  }, [unifiedTransactions, activeFilter, debouncedSearch]);

  const escrowItems = useMemo(() => unifiedTransactions.filter((item) => item.source === 'ESCROW'), [unifiedTransactions]);
  const displayedTransactions = useMemo(
    () => displayedUnifiedItems.filter((item) => item.source === 'ESCROW'),
    [displayedUnifiedItems],
  );

  // Filtered Inspection Orders for display (Mới nhất lên trên)
  const displayedInspectionOrders = useMemo(() => {
    const filtered = inspectionOrders.filter((ord) => {
      const query = (inspectionSearchQuery || debouncedSearch).trim().toLowerCase();
      if (
        query &&
        !ord.id.toLowerCase().includes(query) &&
        !(ord.postTitle || '').toLowerCase().includes(query) &&
        !(ord.buyerName || '').toLowerCase().includes(query) &&
        !(ord.sellerName || '').toLowerCase().includes(query)
      ) {
        return false;
      }

      const isSettled = Boolean(ord.feeSettledAt);
      if (inspectionStatusFilter === 'HELD' && isSettled) return false;
      if (inspectionStatusFilter === 'SETTLED' && !isSettled) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const timeA = parseDateMs(a.feeSettledAt || a.sellerPaidAt || a.buyerPaidAt || a.createdAt);
      const timeB = parseDateMs(b.feeSettledAt || b.sellerPaidAt || b.buyerPaidAt || b.createdAt);
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    return filtered;
  }, [inspectionOrders, inspectionSearchQuery, debouncedSearch, inspectionStatusFilter]);

  const handleOpenInspectionAudit = (orderId: string) => {
    if (onOpenInspectionAudit) {
      onOpenInspectionAudit(orderId);
    } else {
      setLocalAuditOrderId(orderId);
    }
  };

  const handleOpenOrderDetail = async (item: UnifiedPlatformItem) => {
    const { orderId } = item;
    if (!orderId) return;

    if (item.source === 'INSPECTION') {
      handleOpenInspectionAudit(orderId);
      return;
    }

    const request = ++orderInfoRequest.current;
    const settlementRecorded = escrowItems.some((row) => row.orderId === orderId && row.type === 'SETTLEMENT');
    setSelectedOrderId(orderId);
    setSelectedItem(item);
    setSettlementData(null);
    setCommissionData(null);
    setOrderInfoError(null);
    setIsLoadingOrderInfo(true);

    try {
      const [commRes, setRes] = await Promise.allSettled([
        orderService.getOrderCommission(orderId),
        settlementRecorded ? orderService.getOrderSettlement(orderId) : Promise.resolve(null),
      ]);
      if (request !== orderInfoRequest.current) return;

      if (commRes.status === 'fulfilled') {
        setCommissionData(commRes.value);
      }
      if (setRes.status === 'fulfilled') {
        setSettlementData(setRes.value);
      } else {
        setSettlementData(null);
      }
      if (commRes.status === 'rejected' && (setRes.status === 'rejected' || setRes.value === null)) {
        setOrderInfoError('Chưa tải được thông tin tài chính của đơn hàng.');
      }
    } finally {
      if (request === orderInfoRequest.current) setIsLoadingOrderInfo(false);
    }
  };

  const closeOrderDetail = () => {
    orderInfoRequest.current++;
    setSelectedOrderId(null);
    setSelectedItem(null);
  };

  const selectedRevenue = settlementData?.platformCommission ?? selectedItem?.transaction.revenueDelta ?? 0;
  const selectedSellerPayout = settlementData?.sellerPayout ?? selectedItem?.sellerPayout ?? null;
  const selectedBreakdownLines = useMemo(
    () => getSystemWalletBreakdownLines(selectedItem),
    [selectedItem]
  );

  const formatDelta = (val: number) => {
    if (val === 0) return <span className="text-slate-400 font-mono">0 đ</span>;
    if (val > 0) {
      return (
        <span className="text-emerald-700 font-mono font-bold flex items-center gap-0.5 justify-end">
          <ArrowUpRight className="w-3 h-3 text-emerald-600 inline" />
          +{formatVND(val)}
        </span>
      );
    }
    return (
      <span className="text-rose-700 font-mono font-bold flex items-center gap-0.5 justify-end">
        <ArrowDownLeft className="w-3 h-3 text-rose-600 inline" />
        {formatVND(val)}
      </span>
    );
  };

  const formatUnifiedDelta = (item: UnifiedPlatformItem | null | undefined) => {
    if (!item) return formatDelta(0);
    if (isInternalCommissionTransfer(item)) {
      return (
        <div className="flex flex-col items-end">
          <span className="text-emerald-700 font-mono font-bold">
            {formatVND(item.transaction.revenueDelta)}
          </span>
          <span className="text-[10px] text-slate-500 font-normal">
            Trích từ tiền ký quỹ
          </span>
        </div>
      );
    }
    return formatDelta(item.signedDelta);
  };

  const renderDetailButton = (item: UnifiedPlatformItem) => item.orderId && (
    <button
      type="button"
      onClick={() => void handleOpenOrderDetail(item)}
      className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 mx-auto ${item.source === 'ESCROW'
        ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
        : 'bg-amber-500 text-white shadow-2xs hover:bg-amber-600'}`}
    >
      <Eye className="w-3 h-3" />
      <span>{item.actionLabel}</span>
    </button>
  );

  const historyPagination = (
    <div className="flex items-center gap-1.5">
      <span>Trang <strong>{currentPage + 1}</strong> / <strong>{totalPages}</strong></span>
      <button
        type="button"
        onClick={() => void fetchTransactions(currentPage - 1)}
        disabled={currentPage === 0 || isLoadingHistory}
        className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
        aria-label="Trang trước"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void fetchTransactions(currentPage + 1)}
        disabled={currentPage >= totalPages - 1 || isLoadingHistory}
        className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
        aria-label="Trang tiếp"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col min-h-0 space-y-2">
      {/* 1. Header toolbar - Compact 1-line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
            Ví hệ thống &amp; kế toán đối soát
          </h2>


        </div>

        <div className="flex items-center gap-2">
          {/* Direct Inspection Audit Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (directAuditId.trim()) handleOpenInspectionAudit(directAuditId.trim());
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={directAuditId}
              onChange={(e) => setDirectAuditId(e.target.value)}
              placeholder="Mã đơn kiểm định..."
              className="w-32 sm:w-44 text-[11px] py-1 px-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
            <button
              type="submit"
              disabled={!directAuditId.trim()}
              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-[10px] transition cursor-pointer"
            >
              Đối soát
            </button>
          </form>

          {wallet?.updatedAt && (
            <span className="hidden lg:flex text-[10px] text-slate-400 items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              <span>{new Date(wallet.updatedAt).toLocaleTimeString('vi-VN')}</span>
            </span>
          )}

          <button
            onClick={handleRefreshAll}
            disabled={isLoading || isLoadingHistory || isLoadingInspection}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu từ server"
          >
            <RefreshCw
              className={`w-3 h-3 text-[#c34c36] ${isLoading || isLoadingHistory || isLoadingInspection ? 'animate-spin' : ''
                }`}
            />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-semibold shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Wallet summary cards - 6 Balanced System Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
        {/* 1. Ví tổng hệ thống (Total System Balance) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange('ALL');
          }}
          className={`flex min-h-32 flex-col gap-2.5 rounded-xl border px-3.5 py-4 shadow-2xs transition cursor-pointer ${activeFilter === 'ALL'
            ? 'border-indigo-500 ring-2 ring-indigo-400 bg-indigo-50/25'
            : 'border-slate-200 hover:border-indigo-300 bg-white'
            }`}
          title="Bấm để xem tất cả giao dịch trong ví hệ thống"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ví tổng hệ thống</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-indigo-100 text-indigo-800">
                Toàn sàn
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-950 font-mono">
            {formatVND(totalSystemBalance)}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <span>Tổng dòng tiền đang lưu ký &amp; vận hành</span>
            <span className="text-indigo-700 font-bold">{activeFilter === 'ALL' ? '✓ Đang xem' : 'Xem ví tổng →'}</span>
          </div>
        </div>

        {/* 2. Tổng tiền hàng đang giữ (Product Escrow - heldBalance) */}
        <button
          type="button"
          onClick={() => setBalanceFund('PRODUCT_ESCROW')}
          className="flex min-h-32 cursor-pointer flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-4 text-left shadow-2xs transition hover:border-blue-400 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-blue-500"
          title="Xem từng đơn còn giữ tiền trong Escrow"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tiền hàng đang giữ</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-blue-100 text-blue-800">
                Ký quỹ sàn
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-blue-900 font-mono">
            {wallet ? formatVND(totalProductHeld) : '---'}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <span>Tiền mua hàng bảo chứng chưa trả người bán</span>
            <span className="text-blue-700 font-bold">Xem đơn đang giữ tiền →</span>
          </div>
        </button>

        {/* 3. Tiền kiểm định đang giữ (Inspection Escrow) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'INSPECTION_HOLD' ? 'ALL' : 'INSPECTION_HOLD');
          }}
          className={`flex min-h-32 flex-col gap-2.5 rounded-xl border px-3.5 py-4 shadow-2xs transition cursor-pointer ${activeFilter === 'INSPECTION_HOLD'
            ? 'border-cyan-500 ring-2 ring-cyan-400 bg-cyan-50/25'
            : 'border-slate-200 hover:border-cyan-300 bg-white'
            }`}
          title="Bấm để lọc các khoản thu phí kiểm định đang giữ ký quỹ cho Hub"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span>Tiền kiểm định đang giữ</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-cyan-100 text-cyan-800">
                Ký quỹ Hub
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-cyan-950 font-mono">
            {formatVND(totalInspectionHeld)}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <span>Phí kiểm định đang giữ bảo chứng cho Hub</span>
            <span className="text-cyan-700 font-bold">{activeFilter === 'INSPECTION_HOLD' ? '✓ Đang lọc' : 'Lọc phí KĐ →'}</span>
          </div>
        </div>

        {/* 4. Tiền ship đã thu của người dùng (shippingBalance) */}
        <button
          type="button"
          onClick={() => setBalanceFund('SHIPPING')}
          className="flex min-h-32 cursor-pointer flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-4 text-left shadow-2xs transition hover:border-amber-400 hover:bg-amber-50/30 focus-visible:outline-2 focus-visible:outline-amber-500"
          title="Xem số dư cước và các khoản cộng, trừ theo từng đơn"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
              <span>Số dư quỹ cước vận chuyển</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-amber-100 text-amber-800">
                Cước ròng
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-900 font-mono">
            {formatVND(totalUserShippingHeld)}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <span>Các khoản cộng vào quỹ sau khi trừ các bút toán giảm.</span>
            <span className="text-amber-700 font-bold">Xem đối soát cước →</span>
          </div>
        </button>

        {/* 5. Tổng tiền đã thanh toán cho bên Hub */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'HUB_PAYOUT' ? 'ALL' : 'HUB_PAYOUT');
          }}
          className={`flex min-h-32 flex-col gap-2.5 rounded-xl border px-3.5 py-4 shadow-2xs transition cursor-pointer ${activeFilter === 'HUB_PAYOUT'
            ? 'border-purple-500 ring-2 ring-purple-400 bg-purple-50/25'
            : 'border-slate-200 hover:border-purple-300 bg-white'
            }`}
          title="Bấm để lọc lịch sử tiền đã thanh toán cho các Trung tâm Hub"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Đã thanh toán cho Hub</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-purple-100 text-purple-800">
                Chi trả Hub
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-purple-900 font-mono">
            {formatVND(totalHubPaid)}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <span>Tiền công kiểm định đã chi trả vào ví các Hub</span>
            <span className="text-purple-700 font-bold">{activeFilter === 'HUB_PAYOUT' ? '✓ Đang xem' : 'Lọc trả Hub →'}</span>
          </div>
        </div>

        {/* 6. Tổng tiền hoa hồng sàn (revenueBalance) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'COMMISSION' ? 'ALL' : 'COMMISSION');
          }}
          className={`flex min-h-32 flex-col gap-2.5 rounded-xl border px-3.5 py-4 shadow-2xs transition cursor-pointer ${activeFilter === 'COMMISSION'
            ? 'border-emerald-500 ring-2 ring-emerald-400 bg-emerald-50/25'
            : 'border-slate-200 hover:border-emerald-300 bg-white'
            }`}
          title="Bấm để lọc lịch sử hoa hồng sàn đã thu"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Hoa hồng sàn đã thu</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-emerald-100 text-emerald-800">
                Doanh thu
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
            {wallet ? formatVND(commissionRevenue) : '---'}
          </div>
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-500">
            <button
              type="button"
              className="font-bold text-violet-700 hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                handleFilterChange(activeFilter === 'PACKAGE_REVENUE' ? 'ALL' : 'PACKAGE_REVENUE');
              }}
            >
              Bán gói: {wallet ? formatVND(packageRevenue) : '---'}
            </button>
            <span className="text-emerald-700 font-bold">{activeFilter === 'COMMISSION' ? '✓ Đang xem' : 'Lọc hoa hồng →'}</span>
          </div>
        </div>
      </div>

      {/* 3. View Mode Tabs & Filter Toolbar - Single consolidated compact row */}
      <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-xs shrink-0">
        {/* Switcher View Mode */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveViewMode('ALL_UNIFIED')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${activeViewMode === 'ALL_UNIFIED'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Lịch sử toàn hệ thống</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('ESCROW_ORDERS')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${activeViewMode === 'ESCROW_ORDERS'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Wallet className="w-3 h-3" />
            <span>Đơn mua bán sàn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('INSPECTION_ORDERS')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${activeViewMode === 'INSPECTION_ORDERS'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Đơn kiểm định Hub ({inspectionOrders.length})</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-[10px] font-bold text-slate-400 mr-0.5 flex items-center gap-0.5">
            <Filter className="w-2.5 h-2.5" />
            <span>Bộ lọc:</span>
          </span>

          <button
            type="button"
            onClick={() => handleFilterChange('ALL')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
          >
            Tất cả
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('SHIPPING')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer flex items-center gap-1 border ${activeFilter === 'SHIPPING' || activeFilter === 'USER_SHIPPING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
              : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
              }`}
            title="Lọc tất cả các giao dịch giữ/hoàn/thu cước vận chuyển"
          >
            <Truck className="w-3 h-3" />
            <span>Tiền vận chuyển (Cước ship)</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('PAYMENT_HOLD')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'PAYMENT_HOLD'
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
              : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
              }`}
          >
            Nhận ký quỹ
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('INSPECTION_HOLD')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'INSPECTION_HOLD'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
              : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-50'
              }`}
          >
            Thu phí kiểm định
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('SETTLEMENT')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'SETTLEMENT'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
              }`}
          >
            Giải ngân
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('HUB_PAYOUT')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'HUB_PAYOUT'
              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-50'
              }`}
          >
            Chi trả Hub
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('COMMISSION')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'COMMISSION'
              ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
              : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-50'
              }`}
          >
            Hoa hồng sàn
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('PACKAGE_REVENUE')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'PACKAGE_REVENUE'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-violet-800 border-violet-200 hover:bg-violet-50'
              }`}
          >
            Doanh thu bán gói
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('REFUND')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'REFUND'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-50'
              }`}
          >
            Hoàn tiền
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('RETURN_SHIPPING_FEE')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'RETURN_SHIPPING_FEE'
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50'
              }`}
          >
            Thu cước trả hàng
          </button>

          {activeFilter !== 'ALL' && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] text-rose-600 hover:underline font-bold ml-1 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Search by Order ID */}
        <div className="relative">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
          <input
            type="text"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            placeholder="Tìm theo Order ID..."
            className="w-32 sm:w-44 text-[11px] pl-6 pr-6 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono shadow-2xs"
          />
          {searchOrderId && (
            <button
              type="button"
              onClick={() => setSearchOrderId('')}
              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Table Container - Fills remaining screen space with internal scrolling */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* ==================================================================== */}
        {/* VIEW 1: TOÀN BỘ HỆ THỐNG HỢP NHẤT (ALL UNIFIED TRANSACTIONS)         */}
        {/* ==================================================================== */}
        {activeViewMode === 'ALL_UNIFIED' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 shadow-2xs">
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-3.5">Mã GD</th>
                    <th className="py-3 px-3.5">Phân hệ</th>
                    <th className="py-3 px-3.5">Mã đơn hàng (Order ID)</th>
                    <th className="py-3 px-3.5">Phân loại</th>
                    <th className="py-3 px-3.5 text-right min-w-[210px]">
                      <div>{viewingShippingHistory ? 'Biến động quỹ cước' : 'Số tiền biến động'}</div>

                    </th>
                    <th className="py-3 px-3.5 text-center">Thời gian</th>
                    <th className="py-3 px-3.5 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c34c36] mb-2" />
                        <span>Đang tải lịch sử giao dịch toàn hệ thống...</span>
                      </td>
                    </tr>
                  ) : historyError ? (
                    <tr><td colSpan={7} className="py-10 text-center text-rose-700">Không tải được lịch sử giao dịch. Hãy thử Làm mới.</td></tr>
                  ) : displayedUnifiedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                        {activeFilter !== 'ALL' || searchOrderId
                          ? 'Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.'
                          : 'Chưa có giao dịch nào được ghi nhận.'}
                      </td>
                    </tr>
                  ) : (
                    displayedUnifiedItems.map((item) => (
                      <tr
                        key={item.entryId}
                        className={`hover:bg-slate-50/80 transition ${activeFilter === 'SHIPPING' && item.isShipping ? 'bg-amber-50/20' : ''
                          }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 font-bold whitespace-nowrap">
                          #{item.entryId}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {item.source === 'PACKAGE' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-800 border border-violet-200">
                              Gói dịch vụ
                            </span>
                          ) : item.source === 'ESCROW' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Wallet className="w-3 h-3 text-blue-500" />
                              <span>Sàn (Escrow)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              <span>Hub (Kiểm định)</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          {item.source === 'PACKAGE' ? (
                            <span className="font-mono text-[11px] text-violet-800" title={item.referenceId}>
                              {item.displayId}
                            </span>
                          ) : !item.orderId ? (
                            <span className="text-slate-400">—</span>
                          ) : item.source === 'ESCROW' ? (
                            <button
                              onClick={() => handleOpenOrderDetail(item)}
                              className="font-mono text-[11px] text-blue-700 hover:text-blue-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              title="Xem chi tiết đơn hàng sàn"
                            >
                              <span>{item.displayId}</span>
                              <ExternalLink className="w-3 h-3 text-blue-500" />
                            </button>
                          ) : (
                            <div>
                              <button
                                onClick={() => handleOpenInspectionAudit(item.orderId)}
                                className="font-mono text-[11px] text-amber-800 hover:text-amber-950 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                title="Bấm để mở bảng đối soát tiền kiểm định chi tiết"
                              >
                                <span>{item.displayId}</span>
                                <ExternalLink className="w-3 h-3 text-amber-600" />
                              </button>
                              {item.itemTitle && (
                                <span className="text-[10px] text-slate-500 truncate block max-w-[160px]">
                                  {item.itemTitle}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${getTransactionBadgeClass(item.type, item.fundCategory)}`}
                          >
                            {item.typeLabel}
                          </span>
                        </td>

                        {/* GOM THÀNH 1 CỘT: Số Tiền Biến Động (Cộng / Trừ) */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap font-medium">
                          {viewingShippingHistory ? formatDelta(Number(item.transaction.shippingDelta)) : formatUnifiedDelta(item)}
                        </td>

                        <td className="py-3 px-3.5 text-center text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {renderDetailButton(item)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pinned Footer for View 1 */}
            <div className="shrink-0 py-1.5 px-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <div>
                Hiển thị <strong>{displayedUnifiedItems.length}</strong> dòng trong trang
              </div>
              {historyPagination}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: ĐƠN HÀNG MUA BÁN SÀN (ESCROW ORDERS TRANSACTIONS)           */}
        {/* ==================================================================== */}
        {activeViewMode === 'ESCROW_ORDERS' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Escrow Transactions Table */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 shadow-2xs">
                  <tr className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-3.5">Mã GD</th>
                    <th className="py-3 px-3.5">Mã đơn hàng (Order ID)</th>
                    <th className="py-3 px-3.5">Phân loại</th>
                    <th className="py-3 px-3.5 text-right">Biến động ký quỹ</th>
                    <th
                      className={`py-3 px-3.5 text-right transition ${activeFilter === 'SHIPPING' ? 'bg-amber-100/70 text-amber-900 font-black' : ''
                        }`}
                    >
                      Biến động phí ship
                    </th>
                    <th className="py-3 px-3.5 text-right">Biến động hoa hồng</th>
                    <th className="py-3 px-3.5 text-right">Số dư sau GD</th>
                    <th className="py-3 px-3.5 text-center">Thời gian</th>
                    <th className="py-3 px-3.5 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c34c36] mb-2" />
                        <span>Đang tải lịch sử giao dịch ví hệ thống...</span>
                      </td>
                    </tr>
                  ) : displayedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                        {activeFilter !== 'ALL' || searchOrderId
                          ? 'Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.'
                          : 'Chưa có giao dịch nào được ghi nhận trong ví hệ thống.'}
                      </td>
                    </tr>
                  ) : (
                    displayedTransactions.map((item) => (
                      <tr
                        key={item.entryId}
                        className={`hover:bg-slate-50/80 transition ${activeFilter === 'SHIPPING' && item.isShipping ? 'bg-amber-50/20' : ''
                          }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 font-bold">
                          #{item.entryId}
                        </td>

                        <td className="py-3 px-3.5">
                          {item.orderId ? (
                            <button
                              onClick={() => void handleOpenOrderDetail(item)}
                              className="font-mono text-[11px] text-blue-700 hover:text-blue-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              title="Xem chi tiết đơn hàng sàn"
                            >
                              <span>
                                {item.displayId}
                              </span>
                              <ExternalLink className="w-3 h-3 text-blue-500" />
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">---</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTransactionBadgeClass(item.type, item.fundCategory)}`}
                          >
                            {item.typeLabel}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {formatDelta(item.transaction.heldDelta)}
                        </td>

                        <td
                          className={`py-3 px-3.5 text-right whitespace-nowrap ${activeFilter === 'SHIPPING' || item.transaction.shippingDelta !== 0
                            ? 'font-bold bg-amber-50/40'
                            : ''
                            }`}
                        >
                          {formatDelta(item.transaction.shippingDelta)}
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {formatDelta(item.transaction.revenueDelta)}
                        </td>

                        <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          <div>
                            Ký quỹ: <strong>{formatVND(item.transaction.heldBalanceAfter)}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Doanh thu: {formatVND(item.transaction.revenueBalanceAfter)}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {renderDetailButton(item)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls for Escrow */}
            <div className="shrink-0 py-1.5 px-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 bg-slate-50">
              <span>Hiển thị <strong>{displayedTransactions.length}</strong> dòng Sàn trong trang</span>
              {historyPagination}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: ĐƠN KIỂM ĐỊNH HUB (INSPECTION ORDERS FUNDS AUDIT)             */}
        {/* ==================================================================== */}
        {activeViewMode === 'INSPECTION_ORDERS' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Filter Toolbar for Inspection - Compact single line */}
            <div className="shrink-0 p-1.5 border-b border-slate-100 bg-amber-50/40 flex flex-wrap items-center justify-between gap-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] font-bold text-amber-900 mr-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-amber-700" />
                  <span>Quỹ kiểm định:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setInspectionStatusFilter('ALL')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer border ${inspectionStatusFilter === 'ALL'
                    ? 'bg-amber-800 text-white border-amber-800 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  Tất cả ({inspectionOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionStatusFilter('HELD')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 border ${inspectionStatusFilter === 'HELD'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Đang giữ cước &amp; dự phòng ({inspectionMetrics.activeInspectionOrdersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionStatusFilter('SETTLED')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 border ${inspectionStatusFilter === 'SETTLED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đã quyết toán cước ({inspectionMetrics.settledInspectionOrdersCount})</span>
                </button>
              </div>

              {/* Search input for Inspection */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={inspectionSearchQuery}
                  onChange={(e) => setInspectionSearchQuery(e.target.value)}
                  placeholder="Tìm đơn KĐ, sản phẩm..."
                  className="w-36 sm:w-48 pl-6 pr-6 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-600 transition shadow-2xs font-mono"
                />
                {inspectionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInspectionSearchQuery('')}
                    className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Inspection Orders Table */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-amber-50/95 backdrop-blur-xs z-10 border-b border-amber-200/80 shadow-2xs">
                  <tr className="bg-amber-50/70 border-b border-amber-200/80 text-amber-950 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-2.5 px-3">Mã đơn kiểm định</th>
                    <th className="py-2.5 px-3">Sản Phẩm &amp; Đối Tác</th>
                    <th className="py-2.5 px-3 text-right">Phí kiểm định</th>
                    <th className="py-2.5 px-3 text-right">Cước gửi Hub</th>
                    <th className="py-2.5 px-3 text-right">Dự phòng hoàn</th>
                    <th className="py-2.5 px-3 text-right">Tổng đã thu</th>
                    <th className="py-2.5 px-3 text-center">Trạng thái quỹ</th>
                    <th className="py-2.5 px-3 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingInspection ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                        <span>Đang tải danh sách quỹ đơn kiểm định...</span>
                      </td>
                    </tr>
                  ) : displayedInspectionOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                        Không tìm thấy đơn kiểm định nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    displayedInspectionOrders.map((ord) => {
                      const isSettled = Boolean(ord.feeSettledAt);
                      const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);
                      const reserve = Number(ord.returnShippingReserveFee || 0);
                      const shipping = Number(ord.shippingFee || 0);
                      const inspFee = Number(ord.inspectionFee || (ord as any).inspectionFeeVnd || 0);
                      const collected =
                        (ord.sellerPaidAt ? (ord.sellerFeeShare || 0) : 0) +
                        (ord.buyerPaidAt ? (ord.buyerFeeShare || 0) : 0) +
                        Number(ord.buyerCommitmentDeposit || 0);

                      return (
                        <tr key={ord.id} className="hover:bg-amber-50/30 transition">
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => handleOpenInspectionAudit(ord.id)}
                              className="font-mono text-[11px] text-amber-800 hover:text-amber-950 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              title="Bấm để mở bảng đối soát tiền kiểm định chi tiết"
                            >
                              <span>
                                #{ord.id.slice(0, 8)}...{ord.id.slice(-4)}
                              </span>
                              <ExternalLink className="w-3 h-3 text-amber-600" />
                            </button>
                            {ord.orderType && (
                              <span className="text-[10px] text-slate-400 block font-sans">
                                {ord.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Lab Hub'}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 max-w-[200px]">
                            <span className="font-bold text-slate-900 block truncate" title={ord.postTitle}>
                              {ord.postTitle}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Bán: {ord.sellerName} · Mua: {ord.buyerName}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatVND(inspFee)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatVND(shipping)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                            {formatVND(reserve)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                            {formatVND(collected)}
                          </td>

                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isSettled ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Đã quyết toán
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                Đang giữ quỹ
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Chưa nộp đủ
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenInspectionAudit(ord.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Đối soát</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pinned Footer for View 3 */}
            <div className="shrink-0 py-1.5 px-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <div>
                Hiển thị <strong>{displayedInspectionOrders.length}</strong> / <strong>{inspectionOrders.length}</strong> đơn kiểm định Hub
              </div>
              <span className="text-[10px] text-slate-400">
                Đồng bộ quỹ kiểm định và dự phòng cước hoàn từ API Hub
              </span>
            </div>
          </div>
        )}
      </div>

      {balanceFund && (
        <SystemWalletBalanceDialog
          key={balanceFund}
          fund={balanceFund}
          onClose={() => setBalanceFund(null)}
          onViewHistory={(orderId) => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(balanceFund);
            setSearchOrderId(orderId ?? '');
            setDebouncedSearch(orderId ?? '');
            setBalanceFund(null);
          }}
        />
      )}

      {/* Order Settlement & Commission Inspection Modal (for Escrow order) */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl sm:max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 text-sm text-[#24263e] space-y-5 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-900">
                      Chi tiết đơn hàng sàn
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                      {selectedItem?.typeLabel || 'Quyết toán'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    Mã đơn hàng: <strong className="text-slate-800">#{selectedOrderId}</strong>
                    {selectedItem && (
                      <span className="ml-2 text-slate-500">| Mã GD: #{selectedItem.entryId}</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={closeOrderDetail}
                className="p-2 rounded-xl hover:bg-gray-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {isLoadingOrderInfo ? (
              <div className="py-14 text-center text-slate-400 space-y-2.5">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="font-semibold text-sm">Đang tải chi tiết đơn hàng…</p>
              </div>
            ) : orderInfoError && !selectedItem ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-semibold text-sm">
                {orderInfoError}
              </div>
            ) : (
              <div className="space-y-5">
                {orderInfoError && <p role="status" className="text-xs text-amber-800">{orderInfoError}</p>}
                {/* 3 KPI Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Card 1: Tổng tiền biến động */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                        Biến động giao dịch
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-1">
                        {formatUnifiedDelta(selectedItem)}
                      </div>
                    </div>

                    {selectedBreakdownLines.length > 0 ? (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1">
                        {selectedBreakdownLines.map((line, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-slate-600 font-medium truncate">• {line.label}:</span>
                            <span className="font-mono font-bold text-slate-800 shrink-0">
                              {line.formattedText}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-1.5 break-words font-medium leading-relaxed">
                        {selectedItem?.breakdownSummary || 'Ghi nhận qua ví hệ thống'}
                      </div>
                    )}
                  </div>

                  {/* Card 2: Thực trả người bán */}
                  <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col justify-between">
                    <div className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">
                      Thực trả người bán
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono mt-1">
                      {selectedSellerPayout === null ? '—' : formatVND(selectedSellerPayout)}
                    </div>
                    <div className="text-xs text-blue-700 mt-1.5 break-words font-medium leading-relaxed">
                      {selectedSellerPayout === null ? 'Chưa có trong chi tiết này' : 'Đã giải ngân người bán'}
                    </div>
                  </div>

                  {/* Card 3: Hoa hồng sàn thực thu */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col justify-between">
                    <div className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">
                      Hoa hồng sàn thực thu
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-1">
                      {selectedRevenue > 0 ? formatVND(selectedRevenue) : formatDelta(selectedRevenue)}
                    </div>
                    <div className="text-xs text-emerald-700 mt-1.5 break-words font-medium leading-relaxed">
                      {commissionData?.ratePercent
                        ? `Trích ${commissionData.ratePercent}% doanh thu sàn`
                        : 'Doanh thu hoa hồng'}
                    </div>
                  </div>
                </div>

                {/* Chi tiết phân bổ tài chính */}
                <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                  <h5 className="font-extrabold text-sm text-slate-900 flex items-center justify-between border-b border-slate-200 pb-2">
                    <span>Phân bổ dòng tiền</span>
                    <span className="text-xs text-slate-500 font-normal">
                      Căn cứ dữ liệu ví hệ thống & quyết toán đơn
                    </span>
                  </h5>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Giá trị sản phẩm (Cơ sở hoa hồng):</span>
                      <strong className="font-mono text-slate-900 text-sm font-bold">
                        {commissionData?.commissionBase != null || settlementData?.commissionBase != null
                          ? formatVND(settlementData?.commissionBase ?? commissionData?.commissionBase ?? 0)
                          : '—'}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Hoa hồng sàn trích thu:</span>
                      <strong className="font-mono text-emerald-700 text-sm font-extrabold">
                        {selectedRevenue > 0 ? formatVND(selectedRevenue) : formatDelta(selectedRevenue)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Cước vận chuyển (Lalamove):</span>
                      <strong className="font-mono text-slate-900 text-sm font-bold">
                        {formatVND(settlementData?.shippingFee ?? selectedItem?.userShippingFee ?? 0)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-2.5 font-bold pt-2 text-slate-900 bg-blue-50/80 px-3.5 rounded-xl border border-blue-100 mt-2">
                      <span className="text-blue-950 font-bold">Người bán thực nhận:</span>
                      <strong className="font-mono text-blue-900 text-base sm:text-lg font-black">
                        {selectedSellerPayout === null ? '—' : formatVND(selectedSellerPayout)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={closeOrderDetail}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer shadow-xs transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback Local Inspection Funds Modal */}
      {localAuditOrderId && (
        <AdminInspectionFundsModal
          inspectionOrderId={localAuditOrderId}
          isOpen={Boolean(localAuditOrderId)}
          onClose={() => setLocalAuditOrderId(null)}
        />
      )}
    </div>
  );
};
