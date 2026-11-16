import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { markListingInspectionPassed, isOrderInspectionVerdictPassed } from '../../utils/listingInspection';
import {
  SystemWalletData,
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
  | 'SHIPPING'
  | 'PAYMENT_HOLD'
  | 'SETTLEMENT'
  | 'REFUND'
  | 'RETURN_SHIPPING_FEE';

export type SystemWalletViewMode = 'ALL_UNIFIED' | 'ESCROW_ORDERS' | 'INSPECTION_ORDERS';

export interface UnifiedPlatformItem {
  keyId: string;
  source: 'ESCROW' | 'INSPECTION';
  orderId: string;
  displayId: string;
  itemTitle?: string;
  type: string;
  typeLabel: string;
  badgeStyle: { bg: string; text: string; border: string };
  // 4 Core Fund Categories:
  fundCategory: 'PRODUCT_ESCROW' | 'USER_SHIPPING' | 'HUB_PAYOUT' | 'COMMISSION';
  fundCategoryLabel: string;
  fundCategoryBadge: { bg: string; text: string; border: string };
  // Gom thành 1 loại tiền:
  totalDelta: number;
  deltaAction: 'PLUS' | 'MINUS' | 'ZERO';
  breakdownSummary: string;
  breakdownItems: { label: string; amount: number; sign: '+' | '-' }[];
  // Tổng tiền vận chuyển của người dùng:
  userShippingFee: number;
  userShippingNote: string;
  // Raw fields:
  heldDelta: number;
  shippingDelta: number;
  revenueDelta: number;
  heldBalanceAfter?: number;
  shippingBalanceAfter?: number;
  revenueBalanceAfter?: number;
  createdAt: string;
  isShipping: boolean;
  subsystemLabel: string;
  rawEscrowTx?: SystemWalletTransaction;
  rawInspectionOrder?: InspectionOrderDto;
}

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
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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

  // Selected Order Detail Modal (when clicking orderId for Escrow)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<UnifiedPlatformItem | null>(null);
  const [settlementData, setSettlementData] = useState<OrderSettlementDTO | null>(null);
  const [commissionData, setCommissionData] = useState<OrderCommissionDTO | null>(null);
  const [isLoadingOrderInfo, setIsLoadingOrderInfo] = useState(false);
  const [orderInfoError, setOrderInfoError] = useState<string | null>(null);

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

      // Đồng bộ vào cache và ghi nhận trạng thái đạt kiểm định của bài đăng
      try {
        localStorage.setItem('all_inspection_orders_cache', JSON.stringify(list));
      } catch { }
      list.forEach((ord) => {
        if (isOrderInspectionVerdictPassed(ord)) {
          const pid = ord.postId || (ord as any).listingId || (ord as any).listing?.id;
          const ptitle = ord.postTitle || (ord as any).listing?.title || (ord as any).title;
          if (pid) {
            markListingInspectionPassed(String(pid), ptitle);
          }
        }
      });
    } catch (err: any) {
      console.warn('Could not fetch inspection orders in SystemWalletTab:', err);
      setInspectionOrders([]);
    } finally {
      setIsLoadingInspection(false);
    }
  }, []);

  const fetchTransactions = useCallback(
    async (page = 0, filterType = activeFilter, orderQuery = debouncedSearch) => {
      setIsLoadingHistory(true);
      try {
        const filter: SystemWalletTransactionFilter = {
          page,
          size: pageSize,
        };

        if (filterType === 'SHIPPING' || filterType === 'USER_SHIPPING') {
          filter.hasShipping = true;
        } else if (
          filterType !== 'ALL' &&
          filterType !== 'PRODUCT_ESCROW' &&
          filterType !== 'HUB_PAYOUT' &&
          filterType !== 'COMMISSION'
        ) {
          filter.type = filterType;
        }

        if (orderQuery) {
          filter.orderId = orderQuery;
        }

        const res = await systemWalletService.getTransactions(filter);
        setTransactions(res.items);
        setCurrentPage(res.page);
        setTotalPages(res.totalPages || 1);
        setTotalElements(res.totalElements || 0);
      } catch (err: any) {
        console.error('Error fetching system transactions:', err);
      } finally {
        setIsLoadingHistory(false);
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
  }, [activeFilter, debouncedSearch, fetchTransactions]);

  const handleRefreshAll = () => {
    fetchWallet();
    fetchInspectionOrders();
    fetchTransactions(currentPage, activeFilter, debouncedSearch);
  };

  const handleFilterChange = (type: SystemWalletFilterType) => {
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
      const fee = Number(ord.inspectionFee || 200000);
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

  // Grand Total of all managed funds
  const grandTotalHeld = useMemo(() => {
    const escrowHeld = (wallet?.heldBalance ?? 0) + (wallet?.shippingBalance ?? 0);
    const inspectionHeld = inspectionMetrics.totalInspectionHeld;
    return escrowHeld + inspectionHeld;
  }, [wallet, inspectionMetrics]);

  // 1. Tổng tiền hàng đang giữ (Product Escrow)
  const totalProductHeld = wallet?.heldBalance ?? 0;

  // 2. Tổng tiền ship đã thu của người dùng (All User Shipping Held)
  const totalUserShippingHeld = useMemo(() => {
    const escrowShipping = wallet?.shippingBalance ?? 0;
    const inspectionShipping = inspectionMetrics.inspectionShippingHeld + inspectionMetrics.heldReserveTotal;
    return escrowShipping + inspectionShipping;
  }, [wallet, inspectionMetrics]);

  // 3. Tổng tiền đã thanh toán cho bên Hub (All Hub Payouts)
  const totalHubPaid = useMemo(() => {
    if (wallet?.totalHubPaid !== undefined && wallet?.totalHubPaid !== null) {
      return Number(wallet.totalHubPaid);
    }
    let sum = 0;
    inspectionOrders.forEach((ord) => {
      if (ord.feeSettledAt) {
        sum += Number(ord.inspectionFee || 200000);
      }
    });
    return sum;
  }, [wallet, inspectionOrders]);

  // 4. Tổng tiền hoa hồng sàn (All Revenue Balance)
  const totalRevenue = wallet?.revenueBalance ?? 0;

  // Helper for badges
  const getEscrowTypeLabel = (type: string) => {
    switch (type) {
      case 'OPENING_BALANCE':
        return 'Số dư ban đầu';
      case 'PAYMENT_HOLD':
        return 'Nhận ký quỹ';
      case 'SETTLEMENT':
        return 'Giải ngân';
      case 'REFUND':
        return 'Hoàn tiền';
      case 'RETURN_SHIPPING_FEE':
        return 'Thu cước trả hàng';
      default:
        return type;
    }
  };

  const getEscrowBadgeStyle = (type: string) => {
    switch (type) {
      case 'PAYMENT_HOLD':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
      case 'SETTLEMENT':
        return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' };
      case 'REFUND':
        return { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' };
      case 'RETURN_SHIPPING_FEE':
        return { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' };
    }
  };

  // Build Unified Stream combining Escrow Transactions and Inspection Funds with unified single delta
  const unifiedTransactions = useMemo((): UnifiedPlatformItem[] => {
    const list: UnifiedPlatformItem[] = [];

    // 1. Add Escrow Transactions
    transactions.forEach((tx) => {
      const held = tx.heldDelta;
      const ship = tx.shippingDelta;
      const rev = tx.revenueDelta;

      let totalDelta = 0;
      let deltaAction: 'PLUS' | 'MINUS' | 'ZERO' = 'ZERO';
      const breakdownItems: { label: string; amount: number; sign: '+' | '-' }[] = [];
      let breakdownSummary = '';
      let userShippingFee = Math.abs(ship);
      let userShippingNote = ship !== 0 ? 'Cước vận chuyển Lalamove' : 'Không có cước ship';
      let fundCategory: 'PRODUCT_ESCROW' | 'USER_SHIPPING' | 'HUB_PAYOUT' | 'COMMISSION' = 'PRODUCT_ESCROW';
      let fundCategoryLabel = 'Tiền hàng';
      let fundCategoryBadge = { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };

      if (tx.type === 'PAYMENT_HOLD') {
        totalDelta = held + ship;
        deltaAction = totalDelta > 0 ? 'PLUS' : 'ZERO';
        breakdownSummary = 'Cộng vào ví giữ bảo chứng';
        if (held !== 0) breakdownItems.push({ label: 'Tiền hàng', amount: held, sign: '+' });
        if (ship !== 0) breakdownItems.push({ label: 'Cước ship Lalamove', amount: ship, sign: '+' });
        userShippingNote = 'Người mua thanh toán khi đặt đơn';
        fundCategory = 'PRODUCT_ESCROW';
        fundCategoryLabel = 'Tiền hàng & Ship';
      } else if (tx.type === 'SETTLEMENT') {
        totalDelta = -(Math.abs(held) + Math.abs(ship));
        deltaAction = 'MINUS';
        breakdownSummary = 'Xuất giải ngân từ ví hệ thống';
        const sellerPayout = Math.abs(held) - rev;
        breakdownItems.push({ label: 'Thực trả người bán', amount: sellerPayout, sign: '-' });
        if (rev > 0) breakdownItems.push({ label: 'Hoa hồng sàn trích', amount: rev, sign: '-' });
        if (ship !== 0) breakdownItems.push({ label: 'Cước đối soát ship', amount: Math.abs(ship), sign: '-' });
        userShippingNote = 'Đã quyết toán với bên vận chuyển';
        fundCategory = rev > 0 ? 'COMMISSION' : 'PRODUCT_ESCROW';
        fundCategoryLabel = rev > 0 ? 'Hoa hồng sàn' : 'Giải ngân hàng';
        fundCategoryBadge = rev > 0
          ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
          : { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      } else if (tx.type === 'REFUND') {
        totalDelta = -(Math.abs(held) + Math.abs(ship));
        deltaAction = 'MINUS';
        breakdownSummary = 'Xuất hoàn tiền ví người mua';
        if (held !== 0) breakdownItems.push({ label: 'Hoàn tiền mua hàng', amount: Math.abs(held), sign: '-' });
        if (ship !== 0) breakdownItems.push({ label: 'Hoàn cước ship', amount: Math.abs(ship), sign: '-' });
        userShippingNote = 'Hoàn trả lại cho người mua';
        fundCategory = 'PRODUCT_ESCROW';
        fundCategoryLabel = 'Hoàn tiền hàng';
        fundCategoryBadge = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
      } else if (tx.type === 'RETURN_SHIPPING_FEE') {
        totalDelta = ship;
        deltaAction = ship > 0 ? 'PLUS' : 'MINUS';
        breakdownSummary = 'Thu cước trả hàng từ người bán do vi phạm';
        breakdownItems.push({ label: 'Cước hoàn hàng', amount: Math.abs(ship), sign: ship > 0 ? '+' : '-' });
        userShippingFee = Math.abs(ship);
        userShippingNote = 'Người bán chi trả cước trả hàng';
        fundCategory = 'USER_SHIPPING';
        fundCategoryLabel = 'Cước trả hàng';
        fundCategoryBadge = { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
      } else {
        totalDelta = held + ship + rev;
        deltaAction = totalDelta > 0 ? 'PLUS' : totalDelta < 0 ? 'MINUS' : 'ZERO';
        breakdownSummary = 'Biến động số dư nội bộ';
        if (held !== 0) breakdownItems.push({ label: 'Ký quỹ', amount: held, sign: held > 0 ? '+' : '-' });
        if (ship !== 0) breakdownItems.push({ label: 'Phí ship', amount: ship, sign: ship > 0 ? '+' : '-' });
        if (rev !== 0) breakdownItems.push({ label: 'Hoa hồng', amount: rev, sign: rev > 0 ? '+' : '-' });
      }

      list.push({
        keyId: `escrow-${tx.id}`,
        source: 'ESCROW',
        orderId: tx.orderId || '',
        displayId: tx.orderId ? `${tx.orderId.slice(0, 8)}...${tx.orderId.slice(-4)}` : `#${tx.id}`,
        type: tx.type,
        typeLabel: getEscrowTypeLabel(tx.type),
        badgeStyle: getEscrowBadgeStyle(tx.type),
        fundCategory,
        fundCategoryLabel,
        fundCategoryBadge,
        totalDelta: Math.abs(totalDelta),
        deltaAction,
        breakdownSummary,
        breakdownItems,
        userShippingFee,
        userShippingNote,
        heldDelta: tx.heldDelta,
        shippingDelta: tx.shippingDelta,
        revenueDelta: tx.revenueDelta,
        heldBalanceAfter: tx.heldBalanceAfter,
        shippingBalanceAfter: tx.shippingBalanceAfter,
        revenueBalanceAfter: tx.revenueBalanceAfter,
        createdAt: tx.createdAt,
        isShipping: tx.shippingDelta !== 0,
        subsystemLabel: 'Mua bán sàn',
        rawEscrowTx: tx,
      });
    });

    // 2. Add Inspection Orders Funds Events
    inspectionOrders.forEach((ord) => {
      const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);
      const isSettled = Boolean(ord.feeSettledAt);
      const inspFee = Number(ord.inspectionFee || 200000);
      const shippingFee = Number(ord.shippingFee || 0);
      const returnReserve = Number(ord.returnShippingReserveFee || 0);
      const totalUserShipping = shippingFee + returnReserve;

      const feePayer = ord.feePayer || 'SPLIT_50_50';
      const payerNote =
        feePayer === 'SPLIT_50_50'
          ? 'Gồm cước gửi Hub + Dự phòng hoàn (Chia đôi 50% - 50%)'
          : feePayer === 'BUYER_PAYS'
            ? 'Gồm cước gửi Hub + Dự phòng hoàn (Người mua chịu 100%)'
            : 'Gồm cước gửi Hub + Dự phòng hoàn (Người bán chịu 100%)';

      // Event A: Thu phí & Quỹ dự phòng
      if (isPaid) {
        const totalCollected =
          (ord.sellerPaidAt ? (ord.sellerFeeShare || 0) : 0) +
          (ord.buyerPaidAt ? (ord.buyerFeeShare || 0) : 0) +
          Number(ord.buyerCommitmentDeposit || 0);
        const actualCollected = totalCollected > 0 ? totalCollected : inspFee + totalUserShipping;

        list.push({
          keyId: `insp-pay-${ord.id}`,
          source: 'INSPECTION',
          orderId: ord.id,
          displayId: `${ord.id.slice(0, 8)}...${ord.id.slice(-4)}`,
          itemTitle: ord.postTitle || 'Đơn kiểm định Hub',
          type: 'PAYMENT_HOLD',
          typeLabel: 'Thu quỹ KĐ & Dự phòng',
          badgeStyle: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' },
          fundCategory: 'USER_SHIPPING',
          fundCategoryLabel: 'Cước ship & Quỹ Hub',
          fundCategoryBadge: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
          totalDelta: actualCollected,
          deltaAction: 'PLUS',
          breakdownSummary: 'Cộng vào ví giữ bảo chứng kiểm định',
          breakdownItems: [
            { label: 'Phí kiểm định cơ sở', amount: inspFee, sign: '+' },
            { label: 'Cước vận chuyển đến Hub', amount: shippingFee, sign: '+' },
            { label: 'Quỹ dự phòng cước trả hàng', amount: returnReserve, sign: '+' },
          ],
          userShippingFee: totalUserShipping,
          userShippingNote: payerNote,
          heldDelta: inspFee,
          shippingDelta: totalUserShipping,
          revenueDelta: 0,
          createdAt: ord.sellerPaidAt || ord.buyerPaidAt || ord.createdAt || new Date().toISOString(),
          isShipping: totalUserShipping > 0,
          subsystemLabel: 'Kiểm định Hub',
          rawInspectionOrder: ord,
        });
      }

      // Event B1: Thanh toán cho bên Hub (Hub Payout)
      if (isSettled) {
        list.push({
          keyId: `insp-hub-pay-${ord.id}`,
          source: 'INSPECTION',
          orderId: ord.id,
          displayId: `${ord.id.slice(0, 8)}...${ord.id.slice(-4)}`,
          itemTitle: ord.postTitle || 'Chi trả phí kiểm định cho Hub',
          type: 'SETTLEMENT',
          typeLabel: 'Thanh toán ví Hub',
          badgeStyle: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
          fundCategory: 'HUB_PAYOUT',
          fundCategoryLabel: 'Đã trả Hub',
          fundCategoryBadge: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
          totalDelta: inspFee,
          deltaAction: 'MINUS',
          breakdownSummary: 'Xuất chi trả phí công kiểm định vào ví Trung tâm Hub',
          breakdownItems: [{ label: 'Chi trả trung tâm Hub', amount: inspFee, sign: '-' }],
          userShippingFee: 0,
          userShippingNote: 'Phí dịch vụ kỹ thuật trung tâm',
          heldDelta: -inspFee,
          shippingDelta: 0,
          revenueDelta: 0,
          createdAt: ord.feeSettledAt || new Date().toISOString(),
          isShipping: false,
          subsystemLabel: 'Kiểm định Hub',
          rawInspectionOrder: ord,
        });

        // Event B2: Quyết toán cước hoàn (Return Reserve Settlement)
        list.push({
          keyId: `insp-settle-${ord.id}`,
          source: 'INSPECTION',
          orderId: ord.id,
          displayId: `${ord.id.slice(0, 8)}...${ord.id.slice(-4)}`,
          itemTitle: ord.postTitle || 'Quyết toán quỹ hoàn kiểm định',
          type: 'SETTLEMENT',
          typeLabel: 'Quyết toán cước hoàn',
          badgeStyle: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
          fundCategory: 'USER_SHIPPING',
          fundCategoryLabel: 'Quyết toán cước hoàn',
          fundCategoryBadge: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
          totalDelta: returnReserve,
          deltaAction: 'MINUS',
          breakdownSummary: 'Xuất chi trả cước hoàn thực tế & hoàn trả tiền dư về ví',
          breakdownItems: [{ label: 'Trừ quỹ dự phòng hoàn trả', amount: returnReserve, sign: '-' }],
          userShippingFee: totalUserShipping,
          userShippingNote: 'Đã đối soát cước hoàn & hoàn tiền dư về ví',
          heldDelta: 0,
          shippingDelta: -returnReserve,
          revenueDelta: 0,
          createdAt: ord.feeSettledAt || new Date().toISOString(),
          isShipping: returnReserve > 0,
          subsystemLabel: 'Kiểm định Hub',
          rawInspectionOrder: ord,
        });
      }
    });

    // Sort by timestamp descending (Mới nhất lên trên)
    list.sort((a, b) => {
      const timeA = parseDateMs(a.createdAt);
      const timeB = parseDateMs(b.createdAt);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return b.displayId.localeCompare(a.displayId);
    });

    return list;
  }, [transactions, inspectionOrders]);

  // Filtered Unified Stream
  const displayedUnifiedItems = useMemo(() => {
    let list = unifiedTransactions;

    if (activeFilter === 'PRODUCT_ESCROW') {
      list = list.filter((item) => item.fundCategory === 'PRODUCT_ESCROW' || item.heldDelta !== 0);
    } else if (activeFilter === 'USER_SHIPPING' || activeFilter === 'SHIPPING') {
      list = list.filter((item) => item.isShipping || item.fundCategory === 'USER_SHIPPING');
    } else if (activeFilter === 'HUB_PAYOUT') {
      list = list.filter((item) => item.fundCategory === 'HUB_PAYOUT');
    } else if (activeFilter === 'COMMISSION') {
      list = list.filter((item) => item.fundCategory === 'COMMISSION' || item.revenueDelta > 0);
    } else if (activeFilter === 'PAYMENT_HOLD') {
      list = list.filter((item) => item.type === 'PAYMENT_HOLD');
    } else if (activeFilter === 'SETTLEMENT') {
      list = list.filter((item) => item.type === 'SETTLEMENT');
    } else if (activeFilter === 'REFUND') {
      list = list.filter((item) => item.type === 'REFUND');
    } else if (activeFilter === 'RETURN_SHIPPING_FEE') {
      list = list.filter((item) => item.type === 'RETURN_SHIPPING_FEE' || item.typeLabel.includes('hoàn'));
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.orderId.toLowerCase().includes(q) ||
          item.displayId.toLowerCase().includes(q) ||
          (item.itemTitle && item.itemTitle.toLowerCase().includes(q)) ||
          item.breakdownSummary.toLowerCase().includes(q)
      );
    }

    return list;
  }, [unifiedTransactions, activeFilter, debouncedSearch]);

  // Client-side fallback filter for Escrow transactions (Mới nhất lên trên)
  const displayedTransactions = useMemo(() => {
    let list = transactions;

    if (activeFilter === 'SHIPPING' || activeFilter === 'USER_SHIPPING') {
      const hasNonShipping = list.some((t) => t.shippingDelta === 0);
      if (hasNonShipping) {
        list = list.filter((t) => t.shippingDelta !== 0);
      }
    } else if (activeFilter !== 'ALL' && activeFilter !== 'PRODUCT_ESCROW' && activeFilter !== 'HUB_PAYOUT' && activeFilter !== 'COMMISSION') {
      const hasOtherTypes = list.some((t) => t.type !== activeFilter);
      if (hasOtherTypes) {
        list = list.filter((t) => t.type === activeFilter);
      }
    }

    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      const hasUnmatched = list.some((t) => !t.orderId || !t.orderId.toLowerCase().includes(lower));
      if (hasUnmatched) {
        list = list.filter((t) => t.orderId && t.orderId.toLowerCase().includes(lower));
      }
    }

    const sorted = [...list].sort((a, b) => {
      const timeA = parseDateMs(a.createdAt);
      const timeB = parseDateMs(b.createdAt);
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });

    return sorted;
  }, [transactions, activeFilter, debouncedSearch]);

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

  const handleOpenOrderDetail = async (orderId: string, item?: UnifiedPlatformItem) => {
    if (!orderId) return;

    // Check if this order matches an inspection order in the system
    const matchingInsp = inspectionOrders.find(
      (io) => io.id === orderId || (io as any).linkedOrderId === orderId
    );
    if (matchingInsp) {
      handleOpenInspectionAudit(matchingInsp.id);
      return;
    }

    setSelectedOrderId(orderId);
    setSelectedItem(item || unifiedTransactions.find((u) => u.orderId === orderId) || null);
    setSettlementData(null);
    setCommissionData(null);
    setOrderInfoError(null);
    setIsLoadingOrderInfo(true);

    try {
      const [commRes, setRes] = await Promise.allSettled([
        orderService.getOrderCommission(orderId),
        orderService.getOrderSettlement(orderId),
      ]);

      if (commRes.status === 'fulfilled') {
        setCommissionData(commRes.value);
      }
      if (setRes.status === 'fulfilled') {
        setSettlementData(setRes.value);
      } else {
        setSettlementData(null);
      }
    } catch (e: any) {
      setOrderInfoError(e?.message || 'Không thể tải thông tin quyết toán.');
    } finally {
      setIsLoadingOrderInfo(false);
    }
  };

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

  return (
    <div className="h-full flex flex-col min-h-0 space-y-2">
      {/* 1. Header toolbar - Compact 1-line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
            Ví Hệ Thống &amp; Kế Toán Đối Soát (System Wallet)
          </h2>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#24263e] text-white">
            ADMIN ONLY
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Tổng bảo chứng: <strong className="font-mono">{formatVND(grandTotalHeld)}</strong></span>
          </span>
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

      {/* 2. 4 MAIN KPI CARDS - Compact Height (~64px) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
        {/* 1. Tổng tiền hàng đang giữ (heldBalance) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'PRODUCT_ESCROW' ? 'ALL' : 'PRODUCT_ESCROW');
          }}
          className={`p-2.5 rounded-xl border shadow-2xs transition cursor-pointer ${activeFilter === 'PRODUCT_ESCROW'
            ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/25'
            : 'border-slate-200 hover:border-blue-300 bg-white'
            }`}
          title="Bấm để lọc lịch sử tiền hàng đang giữ"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tiền hàng đang giữ</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-blue-100 text-blue-800">
                Ký quỹ
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-blue-900 font-mono mt-0.5">
            {wallet ? formatVND(totalProductHeld) : '---'}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5 flex justify-between">
            <span>Tiền mua hàng bảo chứng chưa trả người bán</span>
            <span className="text-blue-700 font-bold ml-1">{activeFilter === 'PRODUCT_ESCROW' ? '✓ Đang lọc' : 'Lọc tiền hàng →'}</span>
          </div>
        </div>

        {/* 2. Tiền ship đã thu của người dùng (shippingBalance) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'SHIPPING' ? 'ALL' : 'SHIPPING');
          }}
          className={`p-2.5 rounded-xl border shadow-2xs transition cursor-pointer ${activeFilter === 'SHIPPING' || activeFilter === 'USER_SHIPPING'
            ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/25'
            : 'border-slate-200 hover:border-amber-300 bg-white'
            }`}
          title="Bấm để lọc nhanh các giao dịch có phát sinh tiền vận chuyển"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
              <span>Phí vận chuyển đã thu</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-amber-100 text-amber-800">
                Đang giữ
              </span>
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-900 font-mono mt-0.5">
            {formatVND(totalUserShippingHeld)}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5 flex justify-between">
            <span>Tiền ship hệ thống lưu giữ bảo chứng cho các đơn hàng</span>
            <span className="text-amber-700 font-bold ml-1">{activeFilter === 'SHIPPING' || activeFilter === 'USER_SHIPPING' ? '✓ Đang lọc' : 'Lọc cước ship →'}</span>
          </div>
        </div>

        {/* 3. Tổng tiền đã thanh toán cho bên Hub */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'HUB_PAYOUT' ? 'ALL' : 'HUB_PAYOUT');
          }}
          className={`p-2.5 rounded-xl border shadow-2xs transition cursor-pointer ${activeFilter === 'HUB_PAYOUT'
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
          <div className="text-base sm:text-lg font-black text-purple-900 font-mono mt-0.5">
            {formatVND(totalHubPaid)}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5 flex justify-between">
            <span>Tiền công kiểm định đã chi trả vào ví các Hub</span>
            <span className="text-purple-700 font-bold ml-1">{activeFilter === 'HUB_PAYOUT' ? '✓ Đang xem' : 'Lọc trả Hub →'}</span>
          </div>
        </div>

        {/* 4. Tổng tiền hoa hồng sàn (revenueBalance) */}
        <div
          onClick={() => {
            setActiveViewMode('ALL_UNIFIED');
            handleFilterChange(activeFilter === 'COMMISSION' ? 'ALL' : 'COMMISSION');
          }}
          className={`p-2.5 rounded-xl border shadow-2xs transition cursor-pointer ${activeFilter === 'COMMISSION'
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
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5">
            {wallet ? formatVND(totalRevenue) : '---'}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5 flex justify-between">
            <span>Hoa hồng thực tế thu được từ các đơn quyết toán</span>
            <span className="text-emerald-700 font-bold ml-1">{activeFilter === 'COMMISSION' ? '✓ Đang xem' : 'Lọc hoa hồng →'}</span>
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
            <span>Toàn Bộ Hệ Thống ({unifiedTransactions.length})</span>
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
            <span>Đơn Mua Bán Sàn ({totalElements || transactions.length})</span>
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
            <span>Đơn Kiểm Định Hub ({inspectionOrders.length})</span>
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
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
              }`}
          >
            Nhận ký quỹ
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('SETTLEMENT')}
            className={`px-2 py-0.5 rounded-full font-bold transition cursor-pointer border ${activeFilter === 'SETTLEMENT'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
              }`}
          >
            Giải ngân
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
                    <th className="py-3 px-3.5">Phân Hệ</th>
                    <th className="py-3 px-3.5">Mã Đơn Hàng (Order ID)</th>
                    <th className="py-3 px-3.5">Phân Loại</th>
                    <th className="py-3 px-3.5 text-right min-w-[210px]">
                      <div>Số Tiền Biến Động</div>
                      <span className="text-[9px] text-slate-400 font-normal normal-case block">
                        (Hợp nhất Biến Động Ký Quỹ, Biến Động Phí Ship, Biến Động Hoa Hồng)
                      </span>
                    </th>
                    <th className="py-3 px-3.5 text-right min-w-[170px] bg-amber-50/60 text-amber-950 font-black">
                      <div>Tổng Cước Ship Người Dùng</div>
                      <span className="text-[9px] text-amber-700 font-normal normal-case block">
                        (Cước giao hàng + Quỹ hoàn)
                      </span>
                    </th>
                    <th className="py-3 px-3.5 text-center">Thời Gian</th>
                    <th className="py-3 px-3.5 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory && transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c34c36] mb-2" />
                        <span>Đang tải lịch sử giao dịch toàn hệ thống...</span>
                      </td>
                    </tr>
                  ) : displayedUnifiedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                        {activeFilter !== 'ALL' || searchOrderId
                          ? 'Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.'
                          : 'Chưa có giao dịch nào được ghi nhận.'}
                      </td>
                    </tr>
                  ) : (
                    displayedUnifiedItems.map((item) => (
                      <tr
                        key={item.keyId}
                        className={`hover:bg-slate-50/80 transition ${activeFilter === 'SHIPPING' && item.isShipping ? 'bg-amber-50/20' : ''
                          }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 font-bold whitespace-nowrap">
                          {item.keyId.startsWith('escrow-')
                            ? `#${item.keyId.replace('escrow-', '')}`
                            : item.keyId.startsWith('insp-hub-pay-')
                              ? `#HUB-${item.orderId.slice(0, 6)}`
                              : item.keyId.startsWith('insp-pay-')
                                ? `#INSP-${item.orderId.slice(0, 6)}`
                                : `#SETTLE-${item.orderId.slice(0, 6)}`}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {item.source === 'ESCROW' ? (
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
                          {item.source === 'ESCROW' ? (
                            <button
                              onClick={() => handleOpenOrderDetail(item.orderId, item)}
                              className="font-mono text-[11px] text-blue-700 hover:text-blue-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              title="Bấm để xem đối soát hoa hồng & quyết toán đơn hàng này"
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
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${item.badgeStyle.bg} ${item.badgeStyle.text} ${item.badgeStyle.border}`}
                          >
                            {item.typeLabel}
                          </span>
                        </td>

                        {/* GOM THÀNH 1 CỘT: Số Tiền Biến Động (Cộng / Trừ kèm chi tiết) */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="font-mono font-black text-xs">
                            {item.deltaAction === 'PLUS' ? (
                              <span className="text-emerald-700 inline-flex items-center gap-0.5">
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 inline" />
                                +{formatVND(item.totalDelta)}
                              </span>
                            ) : item.deltaAction === 'MINUS' ? (
                              <span className="text-rose-700 inline-flex items-center gap-0.5">
                                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600 inline" />
                                -{formatVND(Math.abs(item.totalDelta))}
                              </span>
                            ) : (
                              <span className="text-slate-400">0 đ</span>
                            )}
                          </div>

                          {/* Chi tiết cộng tiền gì / trừ tiền gì */}
                          <div className="mt-1 space-y-0.5 text-[10px]">
                            {item.breakdownItems.map((b, idx) => (
                              <div key={idx} className="text-slate-500 font-sans">
                                <span>{b.label}: </span>
                                <strong
                                  className={
                                    b.sign === '+'
                                      ? 'text-emerald-700 font-mono font-bold'
                                      : 'text-slate-800 font-mono font-bold'
                                  }
                                >
                                  {b.sign}
                                  {formatVND(Math.abs(b.amount))}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* CỘT THÊM MỚI: Tổng Cước Ship Người Dùng */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap bg-amber-50/25">
                          <div className="font-mono font-black text-xs text-amber-950">
                            {item.userShippingFee > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-900 font-bold">
                                <Truck className="w-3 h-3 text-amber-600" />
                                {formatVND(item.userShippingFee)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0 đ</span>
                            )}
                          </div>
                          <div className="text-[10px] text-amber-800 font-sans mt-0.5 max-w-[180px] ml-auto text-right">
                            {item.userShippingNote}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {item.source === 'ESCROW' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenOrderDetail(item.orderId, item)}
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition cursor-pointer flex items-center gap-1 mx-auto border border-blue-200"
                              title="Bấm để mở bảng đối soát quyết toán dòng tiền đơn này"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Đối soát</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenInspectionAudit(item.orderId)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                              title="Bấm để mở bảng đối soát tiền kiểm định chi tiết"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Đối soát</span>
                            </button>
                          )}
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
                Hiển thị <strong>{displayedUnifiedItems.length}</strong> / <strong>{unifiedTransactions.length}</strong> giao dịch hợp nhất
              </div>
              <span className="text-[10px] text-slate-400">
                Đồng bộ trực tiếp từ API Hệ Thống &amp; Kiểm Định
              </span>
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
                    <th className="py-3 px-3.5">Mã Đơn Hàng (Order ID)</th>
                    <th className="py-3 px-3.5">Phân Loại</th>
                    <th className="py-3 px-3.5 text-right">Biến Động Ký Quỹ</th>
                    <th
                      className={`py-3 px-3.5 text-right transition ${activeFilter === 'SHIPPING' ? 'bg-amber-100/70 text-amber-900 font-black' : ''
                        }`}
                    >
                      Biến Động Phí Ship
                    </th>
                    <th className="py-3 px-3.5 text-right">Biến Động Hoa Hồng</th>
                    <th className="py-3 px-3.5 text-right">Số Dư Sau GD</th>
                    <th className="py-3 px-3.5 text-center">Thời Gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c34c36] mb-2" />
                        <span>Đang tải lịch sử giao dịch ví hệ thống...</span>
                      </td>
                    </tr>
                  ) : displayedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                        {activeFilter !== 'ALL' || searchOrderId
                          ? 'Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.'
                          : 'Chưa có giao dịch nào được ghi nhận trong ví hệ thống.'}
                      </td>
                    </tr>
                  ) : (
                    displayedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50/80 transition ${activeFilter === 'SHIPPING' && tx.shippingDelta !== 0 ? 'bg-amber-50/20' : ''
                          }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 font-bold">
                          #{tx.id}
                        </td>

                        <td className="py-3 px-3.5">
                          {tx.orderId ? (
                            <button
                              onClick={() => handleOpenOrderDetail(tx.orderId)}
                              className="font-mono text-[11px] text-blue-700 hover:text-blue-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              title="Bấm để xem đối soát hoa hồng & quyết toán đơn hàng này"
                            >
                              <span>
                                {tx.orderId.slice(0, 8)}...{tx.orderId.slice(-4)}
                              </span>
                              <ExternalLink className="w-3 h-3 text-blue-500" />
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">---</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getEscrowBadgeStyle(tx.type).bg} ${getEscrowBadgeStyle(tx.type).text} ${getEscrowBadgeStyle(tx.type).border}`}
                          >
                            {getEscrowTypeLabel(tx.type)}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {formatDelta(tx.heldDelta)}
                        </td>

                        <td
                          className={`py-3 px-3.5 text-right whitespace-nowrap ${activeFilter === 'SHIPPING' || tx.shippingDelta !== 0
                            ? 'font-bold bg-amber-50/40'
                            : ''
                            }`}
                        >
                          {formatDelta(tx.shippingDelta)}
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {formatDelta(tx.revenueDelta)}
                        </td>

                        <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          <div>
                            Ký quỹ: <strong>{formatVND(tx.heldBalanceAfter)}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Hoa hồng: {formatVND(tx.revenueBalanceAfter)}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls for Escrow */}
            <div className="shrink-0 py-1.5 px-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 bg-slate-50">
              <div>
                Trang <strong>{currentPage + 1}</strong> / <strong>{totalPages}</strong> (Tổng{' '}
                <strong>{totalElements}</strong> mục)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchTransactions(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0 || isLoadingHistory}
                  className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => fetchTransactions(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1 || isLoadingHistory}
                  className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
                  title="Trang tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
                    <th className="py-2.5 px-3">Mã Đơn Kiểm Định</th>
                    <th className="py-2.5 px-3">Sản Phẩm &amp; Đối Tác</th>
                    <th className="py-2.5 px-3 text-right">Phí Kiểm Định</th>
                    <th className="py-2.5 px-3 text-right">Cước Gửi Hub</th>
                    <th className="py-2.5 px-3 text-right">Dự Phòng Hoàn</th>
                    <th className="py-2.5 px-3 text-right">Tổng Đã Thu</th>
                    <th className="py-2.5 px-3 text-center">Trạng Thái Quỹ</th>
                    <th className="py-2.5 px-3 text-center">Hành Động</th>
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
                      const inspFee = Number(ord.inspectionFee || 200000);
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
                                {ord.orderType === 'AT_HOME' ? 'Tại Nhà' : 'Tại Lab Hub'}
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

      {/* Order Settlement & Commission Inspection Modal (for Escrow order) */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 text-xs text-[#24263e] space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Đối Soát Quyết Toán Đơn Hàng Sàn
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                      {selectedItem?.typeLabel || 'Quyết toán'}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-500">
                    Mã đơn hàng: <strong className="text-slate-800">#{selectedOrderId}</strong>
                    {selectedItem?.rawEscrowTx?.id && (
                      <span className="ml-2 text-slate-400">| Mã GD: #{selectedItem.rawEscrowTx.id}</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedItem(null);
                }}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {isLoadingOrderInfo ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600" />
                <p className="font-semibold text-xs">Đang tải chi tiết đối soát từ máy chủ...</p>
              </div>
            ) : orderInfoError && !selectedItem ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                {orderInfoError}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 3 KPI Stats Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Card 1: Tổng tiền biến động */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Tổng tiền giao dịch
                    </div>
                    <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5">
                      {formatVND(
                        settlementData
                          ? settlementData.sellerPayout + settlementData.platformCommission
                          : selectedItem
                            ? Math.abs(selectedItem.totalDelta)
                            : 0
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {selectedItem?.breakdownSummary || 'Ghi nhận qua ví hệ thống'}
                    </div>
                  </div>

                  {/* Card 2: Thực trả người bán */}
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                    <div className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">
                      Thực trả người bán
                    </div>
                    <div className="text-base sm:text-lg font-black text-blue-900 font-mono mt-0.5">
                      {formatVND(
                        settlementData?.sellerPayout ??
                        (selectedItem?.rawEscrowTx?.heldDelta
                          ? Math.abs(selectedItem.rawEscrowTx.heldDelta) - (selectedItem.rawEscrowTx.revenueDelta || 0)
                          : selectedItem?.totalDelta ?? 0)
                      )}
                    </div>
                    <div className="text-[10px] text-blue-600 mt-0.5 truncate">
                      {settlementData?.settledAt ? 'Đã giải ngân người bán' : 'Ký quỹ bảo chứng'}
                    </div>
                  </div>

                  {/* Card 3: Hoa hồng sàn thực thu */}
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                      Hoa hồng sàn thực thu
                    </div>
                    <div className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5">
                      +{formatVND(
                        settlementData?.platformCommission ??
                        commissionData?.platformCommission ??
                        selectedItem?.rawEscrowTx?.revenueDelta ??
                        0
                      )}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5 truncate">
                      {commissionData?.ratePercent
                        ? `Trích ${commissionData.ratePercent}% doanh thu sàn`
                        : 'Doanh thu hoa hồng'}
                    </div>
                  </div>
                </div>

                {/* Chi tiết phân bổ tài chính */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <h5 className="font-extrabold text-xs text-slate-800 flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span>Phân bổ dòng tiền đối soát</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Căn cứ dữ liệu ví hệ thống & quyết toán đơn
                    </span>
                  </h5>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Giá trị sản phẩm (Cơ sở hoa hồng):</span>
                      <strong className="font-mono text-slate-900">
                        {formatVND(
                          commissionData?.commissionBase ??
                          settlementData?.commissionBase ??
                          (selectedItem?.rawEscrowTx?.heldDelta ? Math.abs(selectedItem.rawEscrowTx.heldDelta) : 0)
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Hoa hồng sàn trích thu:</span>
                      <strong className="font-mono text-emerald-700">
                        +{formatVND(
                          settlementData?.platformCommission ??
                          commissionData?.platformCommission ??
                          selectedItem?.rawEscrowTx?.revenueDelta ??
                          0
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Cước vận chuyển (Lalamove):</span>
                      <strong className="font-mono text-slate-900">
                        {formatVND(
                          settlementData?.shippingFee ??
                          (selectedItem?.rawEscrowTx?.shippingDelta
                            ? Math.abs(selectedItem.rawEscrowTx.shippingDelta)
                            : selectedItem?.userShippingFee ?? 0)
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between py-1 font-bold pt-1.5 text-slate-900">
                      <span className="text-blue-900">Người bán thực nhận (Seller Payout):</span>
                      <strong className="font-mono text-blue-900 text-sm">
                        {formatVND(
                          settlementData?.sellerPayout ??
                          (selectedItem?.rawEscrowTx?.heldDelta
                            ? Math.abs(selectedItem.rawEscrowTx.heldDelta) - (selectedItem.rawEscrowTx.revenueDelta || 0)
                            : 0)
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Thông tin truy vết sổ cái */}
                <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-1 text-[11px] text-amber-950">
                  <div className="font-bold flex items-center justify-between">
                    <span>Truy vết sổ cái ví hệ thống:</span>
                    <span className="font-mono text-[10px] text-amber-800">
                      {selectedItem?.createdAt
                        ? new Date(selectedItem.createdAt).toLocaleString('vi-VN')
                        : '---'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-amber-900 pt-0.5">
                    <div>
                      <span>Số dư ký quỹ sau GD: </span>
                      <strong className="font-mono">
                        {selectedItem?.rawEscrowTx?.heldBalanceAfter !== undefined
                          ? formatVND(selectedItem.rawEscrowTx.heldBalanceAfter)
                          : '---'}
                      </strong>
                    </div>
                    <div>
                      <span>Số dư hoa hồng sau GD: </span>
                      <strong className="font-mono">
                        {selectedItem?.rawEscrowTx?.revenueBalanceAfter !== undefined
                          ? formatVND(selectedItem.rawEscrowTx.revenueBalanceAfter)
                          : '---'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedOrderId(null);
                      setSelectedItem(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
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
