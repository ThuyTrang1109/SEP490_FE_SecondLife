import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Wallet,
  Package,
  ShieldCheck,
  Users,
  Tag,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  Layers,
  CreditCard,
  ChevronRight,
  FileSpreadsheet,
  DollarSign,
  Activity
} from 'lucide-react';
import {
  adminOrderService,
  AdminOrderResponse,
  AdminOrderStatsResponse
} from '../../services/adminOrderService';
import { systemWalletService } from '../../services/systemWalletService';
import { adminService, UserAdminResponseDto } from '../../services/adminService';
import { SellerVerificationResponseDto } from '../../services/sellerService';
import { adminPostService } from '../../services/adminPostService';
import { walletService, WalletWithdrawalResponseDto } from '../../services/walletService';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { adminCommissionService, CommissionRuleResponse } from '../../services/adminCommissionService';
import { resolveCategoryAndItem } from '../../utils/catalogCache';
import { isOrderInspectionVerdictPassed } from '../../utils/listingInspection';
import { parseDateMs } from './SystemWalletTab';
import { AdminReportPeriodFilter } from './AdminReportPeriodFilter';
import {
  formatReportBounds, isInReportPeriod, reportBucket, reportGrouping, reportPeriodBounds, type ReportPeriod
} from '../../utils/adminReportPeriod';
import {
  EscrowOrder,
  Listing,
  Language,
  SystemWalletData,
  SystemWalletTransaction,
  InspectionCenter
} from '../../types';
import { formatVND } from '../../utils/translations';

export interface SystemOverviewReportTabProps {
  lang?: Language;
  initialListings?: Listing[];
  initialOrders?: EscrowOrder[];
  initialUsers?: UserAdminResponseDto[];
  initialVerifications?: SellerVerificationResponseDto[];
  onNavigateTab?: (tabId: string) => void;
}

// ============================================================================
// REUSABLE INTERACTIVE SVG CHART COMPONENTS (100% REAL SYSTEM DATA)
// ============================================================================

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  bgBadge: string;
  subLabel?: string;
}

const SvgDonutChart: React.FC<{
  segments: DonutSegment[];
  centerTitle: string;
  centerValue: string;
  centerSub?: string;
  size?: number;
  strokeWidth?: number;
  formatValue?: (val: number) => string;
}> = ({
  segments,
  centerTitle,
  centerValue,
  centerSub,
  size = 164,
  strokeWidth = 20,
  formatValue = (v) => String(v)
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = useMemo(() => segments.reduce((s, item) => s + Math.max(0, item.value), 0), [segments]);
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativeFraction = 0;

  return (
    <div className="flex flex-col xl:flex-row items-center gap-4 min-w-0 w-full overflow-hidden">
      {/* SVG Ring */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 transform">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {total > 0 ? (
            segments.map((seg, idx) => {
              const val = Math.max(0, seg.value);
              if (val === 0) return null;
              const fraction = val / total;
              const nonZeroCount = segments.filter((s) => s.value > 0).length;
              const dashLength = Math.max(0, fraction * circumference - (nonZeroCount > 1 ? 2 : 0));
              const dashOffset = -cumulativeFraction * circumference;
              cumulativeFraction += fraction;
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          ) : (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#cbd5e1"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
            />
          )}
        </svg>

        {/* Center Text Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
          {hoveredIdx !== null && segments[hoveredIdx] ? (
            <>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 line-clamp-1 max-w-[105px]">
                {segments[hoveredIdx].label}
              </span>
              <span className="text-xs sm:text-sm font-black font-mono text-slate-900 mt-0.5 truncate max-w-[115px]">
                {formatValue(segments[hoveredIdx].value)}
              </span>
              <span className="text-[10px] font-bold text-[#c34c36]">
                {total > 0 ? `${Math.round((segments[hoveredIdx].value / total) * 100)}%` : '0%'}
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                {centerTitle}
              </span>
              <span className="text-xs sm:text-sm font-black font-mono text-slate-900 mt-0.5 leading-tight truncate max-w-[115px]">
                {centerValue}
              </span>
              {centerSub && (
                <span className="text-[9px] font-bold text-emerald-700 mt-0.5">
                  {centerSub}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Interactive Legend List */}
      <div className="flex-1 min-w-0 w-full space-y-2">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? Math.round((Math.max(0, seg.value) / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 min-w-0 ${
                isHovered
                  ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                  : 'bg-slate-50/90 hover:bg-slate-100/90 border-slate-200/80 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-3 h-3 rounded-sm shrink-0 shadow-2xs"
                  style={{ backgroundColor: seg.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold truncate ${isHovered ? 'text-white' : 'text-slate-800'}`} title={seg.label}>
                    {seg.label}
                  </div>
                  {seg.subLabel && (
                    <div className={`text-[10px] truncate ${isHovered ? 'text-slate-300' : 'text-slate-500'}`} title={seg.subLabel}>
                      {seg.subLabel}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 pl-1">
                <div className={`text-xs font-black font-mono whitespace-nowrap ${isHovered ? 'text-[#fce5da]' : 'text-slate-900'}`}>
                  {formatValue(seg.value)}
                </div>
                <span
                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    isHovered ? 'bg-white/15 text-white' : seg.bgBadge
                  }`}
                >
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Semi-Circle Radial Gauge Chart for Real Pass Rate / Completion Rate
const SvgRadialGauge: React.FC<{
  percentage: number;
  label: string;
  subLabel: string;
  color: string;
  passedText: string;
  failedText: string;
}> = ({ percentage, label, subLabel, color, passedText, failedText }) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 70;
  const stroke = 16;
  const normalizedRadius = radius - stroke / 2;
  const circumference = Math.PI * normalizedRadius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
      <div className="relative flex items-center justify-center" style={{ width: 170, height: 100 }}>
        <svg width={170} height={100} viewBox="0 0 170 100" className="overflow-visible">
          {/* Background Arc */}
          <path
            d={`M ${85 - normalizedRadius} 85 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${85 + normalizedRadius} 85`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Value Arc */}
          <path
            d={`M ${85 - normalizedRadius} 85 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${85 + normalizedRadius} 85`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute bottom-2 flex flex-col items-center text-center">
          <span className="text-2xl font-black font-mono text-slate-900">{clamped}%</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 font-medium text-center mt-1">{subLabel}</p>
      <div className="w-full flex items-center justify-between text-[11px] font-bold pt-2 mt-2 border-t border-slate-200/70">
        <span className="text-emerald-700 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {passedText}
        </span>
        <span className="text-rose-600 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          {failedText}
        </span>
      </div>
    </div>
  );
};

function orderGmv(order: AdminOrderResponse): number {
  return order.status === 'CANCELLED' ? 0 : Number(order.finalPrice ?? order.totalAmount ?? 0);
}

export const SystemOverviewReportTab: React.FC<SystemOverviewReportTabProps> = ({
  lang = 'vi',
  initialListings = [],
  initialUsers = [],
  initialVerifications = [],
  onNavigateTab
}) => {
  const [period, setPeriod] = useState<ReportPeriod>({ kind: 'ALL' });
  const [reportSection, setReportSection] = useState<'ALL' | 'FINANCE' | 'ORDERS_INSPECTION' | 'USERS_LISTINGS'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPartialData, setHasPartialData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // 100% Authoritative Backend Database States (NO mock data)
  const [orderStats, setOrderStats] = useState<AdminOrderStatsResponse | null>(null);
  const [adminOrders, setAdminOrders] = useState<AdminOrderResponse[]>([]);
  const [systemWallet, setSystemWallet] = useState<SystemWalletData | null>(null);
  const [walletTxs, setWalletTxs] = useState<SystemWalletTransaction[]>([]);
  const [users, setUsers] = useState<UserAdminResponseDto[]>(initialUsers);
  const [totalUsersElements, setTotalUsersElements] = useState<number>(initialUsers.length);
  const [verifications, setVerifications] = useState<SellerVerificationResponseDto[]>(initialVerifications);
  const [posts, setPosts] = useState<any[]>(initialListings);
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawalResponseDto[]>([]);
  const [inspectionOrders, setInspectionOrders] = useState<InspectionOrderDto[]>([]);
  const [hubCenters, setHubCenters] = useState<InspectionCenter[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRuleResponse[]>([]);

  // Sync with parent AdminDashboardView's live backend users/verifications/listings whenever they update
  useEffect(() => {
    if (initialUsers.length > 0 && users.length === 0) {
      setUsers(initialUsers);
      setTotalUsersElements((prev) => Math.max(prev, initialUsers.length));
    }
  }, [initialUsers, users.length]);

  useEffect(() => {
    if (initialVerifications.length > 0 && verifications.length === 0) {
      setVerifications(initialVerifications);
    }
  }, [initialVerifications, verifications.length]);

  useEffect(() => {
    if (initialListings.length > 0 && posts.length === 0) {
      setPosts(initialListings);
    }
  }, [initialListings, posts.length]);

  const loadAllReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Helper to fetch all pages from a Spring Boot paginated endpoint with safe page size (<= 100)
      const fetchAllPages = async <T,>(
        fetchPage: (page: number, size: number) => Promise<{ items?: T[]; content?: T[]; totalElements?: number; totalPages?: number } | T[]>,
        pageSize = 50,
        maxPages = 10
      ): Promise<{ items: T[]; totalElements: number }> => {
        const firstRes: any = await fetchPage(0, pageSize);
        const firstItems: T[] = Array.isArray(firstRes)
          ? firstRes
          : Array.isArray(firstRes?.items)
            ? firstRes.items
            : Array.isArray(firstRes?.content)
              ? firstRes.content
              : Array.isArray(firstRes?.data?.items)
                ? firstRes.data.items
                : Array.isArray(firstRes?.data?.content)
                  ? firstRes.data.content
                  : [];
        const totalElements = Number(
          firstRes?.totalElements ?? firstRes?.data?.totalElements ?? firstItems.length
        );
        const totalPages = Math.min(
          maxPages,
          Number(firstRes?.totalPages ?? firstRes?.data?.totalPages ?? 1)
        );

        if (totalPages <= 1) {
          return { items: firstItems, totalElements: Math.max(totalElements, firstItems.length) };
        }

        const morePromises: Promise<any>[] = [];
        for (let p = 1; p < totalPages; p++) {
          morePromises.push(fetchPage(p, pageSize).catch(() => null));
        }
        const moreResults = await Promise.all(morePromises);
        const allItems = [...firstItems];
        moreResults.forEach((res) => {
          if (!res) return;
          const pageItems: T[] = Array.isArray(res)
            ? res
            : Array.isArray(res?.items)
              ? res.items
              : Array.isArray(res?.content)
                ? res.content
                : Array.isArray(res?.data?.items)
                  ? res.data.items
                  : Array.isArray(res?.data?.content)
                    ? res.data.content
                    : [];
          allItems.push(...pageItems);
        });

        return { items: allItems, totalElements: Math.max(totalElements, allItems.length) };
      };

      const [
        statsRes,
        ordersRes,
        walletRes,
        walletTxRes,
        usersRes,
        verifRes,
        postsRes,
        withdrawalsRes,
        inspOrdersRes,
        hubsRes,
        commRes
      ] = await Promise.allSettled([
        adminOrderService.getAdminOrderStats(),
        fetchAllPages((page, size) => adminOrderService.getAdminOrders({ page, size }), 50),
        systemWalletService.getSystemWallet(),
        fetchAllPages((page, size) => systemWalletService.getTransactions({ page, size }), 100),
        fetchAllPages((page, size) => adminService.getAdminUsers({ page, size }), 50),
        fetchAllPages((page, size) => adminService.getSellerVerifications({ page, size }), 50),
        fetchAllPages((page, size) => adminPostService.getAdminPosts(undefined, undefined, undefined, { page, size }), 50),
        fetchAllPages((page, size) => walletService.getAdminWithdrawals('ALL', page, size), 100),
        fetchAllPages((page, size) => inspectorService.getAllOrders(undefined, page, size), 100),
        inspectorService.getInspectionCenters(true),
        adminCommissionService.getCommissionRules(0, 50)
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setOrderStats(statsRes.value);
      }

      if (ordersRes.status === 'fulfilled' && ordersRes.value) {
        setAdminOrders(ordersRes.value.items);
      }

      if (walletRes.status === 'fulfilled' && walletRes.value) {
        setSystemWallet(walletRes.value);
      }

      if (walletTxRes.status === 'fulfilled' && walletTxRes.value) {
        setWalletTxs(walletTxRes.value.items);
      }

      if (usersRes.status === 'fulfilled' && usersRes.value && usersRes.value.items.length > 0) {
        setUsers(usersRes.value.items);
        setTotalUsersElements(usersRes.value.totalElements);
      }

      if (verifRes.status === 'fulfilled' && verifRes.value && verifRes.value.items.length > 0) {
        setVerifications(verifRes.value.items);
      }

      if (postsRes.status === 'fulfilled') {
        setPosts(postsRes.value.items);
      }

      if (withdrawalsRes.status === 'fulfilled' && withdrawalsRes.value) {
        setWithdrawals(withdrawalsRes.value.items);
      }

      if (inspOrdersRes.status === 'fulfilled' && inspOrdersRes.value) {
        setInspectionOrders(inspOrdersRes.value.items);
      }

      if (hubsRes.status === 'fulfilled' && Array.isArray(hubsRes.value)) {
        setHubCenters(hubsRes.value);
      }

      if (commRes.status === 'fulfilled' && commRes.value?.items) {
        setCommissionRules(commRes.value.items);
      }

      const pages = [ordersRes, walletTxRes, usersRes, verifRes, postsRes, withdrawalsRes, inspOrdersRes];
      setHasPartialData(
        pages.some((res) => res.status === 'rejected' || res.value.items.length < res.value.totalElements)
        || [statsRes, walletRes, hubsRes, commRes].some((res) => res.status === 'rejected')
      );
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn('Error loading system overview report data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllReportData();
  }, [loadAllReportData]);

  const reportNow = lastSyncedAt.getTime();
  const bounds = useMemo(() => reportPeriodBounds(period, reportNow) ?? undefined, [period, reportNow]);
  const allTime = period.kind === 'ALL';
  const periodLabel = bounds ? `${formatReportBounds(bounds)} (GMT+7)` : (lang === 'vi' ? 'Toàn thời gian' : 'All time');
  const trendGrouping = reportGrouping(bounds);
  const isWithinDateRange = useCallback(
    (dateVal?: unknown) => isInReportPeriod(parseDateMs(dateVal), bounds),
    [bounds]
  );
  const applyPeriod = (next: ReportPeriod) => {
    setHoveredTrendIdx(null);
    setPeriod(next);
  };

  // ============================================================================
  // 1. REAL FINANCIAL & SYSTEM WALLET ANALYTICS FROM DATABASE
  // ============================================================================
  const financialAnalytics = useMemo(() => {
    const filteredOrders = adminOrders.filter((o) => isWithinDateRange(o.createdAt));
    const filteredWalletTxs = walletTxs.filter((tx) => isWithinDateRange(tx.createdAt));

    // Active commission rule from DB (/v1/admin/commission-rules)
    const activeRule = commissionRules.find((r) => r.active) || commissionRules[0];
    const rawRate = activeRule && activeRule.rate !== undefined ? Number(activeRule.rate) : 0;
    const effectiveRate = rawRate > 1 ? rawRate / 100 : rawRate;
    const effectiveRatePercent = (rawRate > 1 ? rawRate : rawRate * 100).toFixed(1);

    // Real GMV from DB (/v1/admin/orders/stats or sum of real DB orders or PAYMENT_HOLD ledger entries)
    const totalGmvFromOrders = filteredOrders.reduce((sum, order) => sum + orderGmv(order), 0);
    const totalGmvFromLedger = filteredWalletTxs
      .filter((tx) => tx.type === 'PAYMENT_HOLD')
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.heldDelta || 0) + Number(tx.shippingDelta || 0)), 0);
    const totalGmv =
      allTime && orderStats?.totalGmv != null
        ? Number(orderStats.totalGmv)
        : adminOrders.length > 0 ? totalGmvFromOrders : totalGmvFromLedger;

    // Real System Wallet balances from DB (/v1/admin/system-wallet)
    const heldEscrow =
      systemWallet?.heldBalance !== undefined
        ? Number(systemWallet.heldBalance)
        : orderStats?.heldEscrowAmount !== undefined
          ? Number(orderStats.heldEscrowAmount)
          : adminOrders
              .filter((o) => o.escrowStatus === 'HELD' || o.escrowStatus === 'FROZEN')
              .reduce((sum, o) => sum + Number(o.totalAmount || o.finalPrice || 0), 0);

    const shippingPoolBalance = Number(systemWallet?.shippingBalance ?? 0);

    // Real platform commission revenue from System Wallet DB or sum of positive revenueDelta in ledger
    const ledgerRevenueSum = filteredWalletTxs.reduce(
      (sum, tx) => sum + (tx.type !== 'PACKAGE_REVENUE' ? Math.max(0, Number(tx.revenueDelta || 0)) : 0),
      0
    );
    const platformRevenue =
      allTime && systemWallet?.revenueBalance !== undefined
        ? Number(systemWallet.revenueBalance) - Number(systemWallet.packageRevenueBalance ?? 0)
        : ledgerRevenueSum;

    const totalSystemBalance =
      systemWallet?.totalBalance !== undefined
        ? Number(systemWallet.totalBalance)
        : heldEscrow + shippingPoolBalance + Number(systemWallet?.revenueBalance ?? walletTxs.reduce(
          (sum, tx) => sum + Number(tx.revenueDelta || 0), 0
        ));

    // Released vs Refunded from real DB Orders or System Wallet Ledger
    const releasedFromOrders = filteredOrders
      .filter((o) => o.escrowStatus === 'RELEASED' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + Number(o.finalPrice || o.totalAmount || 0), 0);
    const releasedFromLedger = filteredWalletTxs
      .filter((tx) => tx.type === 'SETTLEMENT' && Number(tx.heldDelta || 0) < 0)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.heldDelta || 0) + Number(tx.revenueDelta || 0)), 0);
    const releasedAmount = releasedFromOrders > 0 ? releasedFromOrders : releasedFromLedger;

    const refundedFromOrders = filteredOrders
      .filter((o) => o.escrowStatus === 'REFUNDED' || o.status === 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.totalAmount || o.finalPrice || 0), 0);
    const refundedFromLedger = filteredWalletTxs
      .filter((tx) => (tx.type === 'REFUND' || tx.type === 'INSPECTION_REFUND') && Number(tx.heldDelta || 0) < 0)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.heldDelta || 0) + Number(tx.shippingDelta || 0)), 0);
    const refundedAmount = refundedFromOrders > 0 ? refundedFromOrders : refundedFromLedger;

    // Real Withdrawals summary from DB (/v1/wallets/admin/withdrawals)
    const filteredWithdrawals = withdrawals.filter((w) => isWithinDateRange(w.createdAt));
    const pendingWithdrawals = filteredWithdrawals.filter((w) => w.status === 'PENDING_REVIEW');
    const approvedWithdrawals = filteredWithdrawals.filter((w) => w.status === 'APPROVED');
    const rejectedWithdrawals = filteredWithdrawals.filter((w) => w.status === 'REJECTED');

    const pendingWithdrawalAmount = pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
    const approvedWithdrawalAmount = approvedWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
    const rejectedWithdrawalAmount = rejectedWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);

    return {
      totalGmv,
      heldEscrow,
      shippingPoolBalance,
      platformRevenue,
      totalSystemBalance,
      releasedAmount,
      refundedAmount,
      effectiveRate,
      effectiveRatePercent,
      activeRuleName: activeRule?.name || null,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      approvedWithdrawalsCount: approvedWithdrawals.length,
      rejectedWithdrawalsCount: rejectedWithdrawals.length,
      pendingWithdrawalAmount,
      approvedWithdrawalAmount,
      rejectedWithdrawalAmount,
      totalWithdrawalsCount: filteredWithdrawals.length
    };
  }, [adminOrders, orderStats, systemWallet, walletTxs, commissionRules, withdrawals, allTime, isWithinDateRange]);

  // ============================================================================
  // 2. REAL TIME-SERIES TREND CHART DATA (FROM REAL DB ORDERS & LEDGER TRANSACTIONS)
  // ============================================================================
  const trendSeriesData = useMemo(() => {
    const filteredOrders = adminOrders.filter((o) => isWithinDateRange(o.createdAt));
    const filteredTxs = walletTxs.filter((tx) => isWithinDateRange(tx.createdAt));

    const bucketMap = new Map<
      string,
      { sortKey: string; label: string; gmv: number; revenue: number; orders: number }
    >();

    filteredOrders.forEach((ord) => {
      const ts = parseDateMs(ord.createdAt || ord.paidAt || ord.updatedAt);
      if (!Number.isFinite(ts) || !ts) return;
      const { sortKey, label } = reportBucket(ts, trendGrouping);
      const prev = bucketMap.get(sortKey) || { sortKey, label, gmv: 0, revenue: 0, orders: 0 };
      prev.gmv += orderGmv(ord);
      prev.orders += 1;
      bucketMap.set(sortKey, prev);
    });

    // Use ledger holds for GMV only when the orders list is unavailable.
    const seenLedgerOrderIds = new Set<string>();
    filteredTxs.forEach((tx) => {
      const ts = parseDateMs(tx.createdAt);
      if (!Number.isFinite(ts) || !ts) return;
      const { sortKey, label } = reportBucket(ts, trendGrouping);
      const prev = bucketMap.get(sortKey) || { sortKey, label, gmv: 0, revenue: 0, orders: 0 };

      const revDelta = Number(tx.revenueDelta || 0);
      if (revDelta > 0) {
        prev.revenue += revDelta;
      }
      if (adminOrders.length === 0 && tx.type === 'PAYMENT_HOLD' && (!tx.orderId || !seenLedgerOrderIds.has(tx.orderId))) {
        if (tx.orderId) seenLedgerOrderIds.add(tx.orderId);
        prev.gmv += Math.max(0, Number(tx.heldDelta || 0) + Number(tx.shippingDelta || 0));
        prev.orders += 1;
      }
      bucketMap.set(sortKey, prev);
    });

    const sorted = Array.from(bucketMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return allTime ? sorted.slice(-10) : sorted;
  }, [adminOrders, walletTxs, isWithinDateRange, trendGrouping, allTime]);

  // Real Sparkline heights derived strictly from real trendSeriesData
  const realSparklineHeights = useMemo(() => {
    if (trendSeriesData.length === 0) return [];
    const maxGmv = Math.max(...trendSeriesData.map((d) => d.gmv), 1);
    return trendSeriesData.slice(-7).map((d) => ({
      label: d.label,
      gmv: d.gmv,
      heightPct: Math.max(12, Math.round((d.gmv / maxGmv) * 100))
    }));
  }, [trendSeriesData]);

  // ============================================================================
  // 3. REAL ORDER LIFECYCLE & ESCROW ANALYTICS FROM DATABASE
  // ============================================================================
  const orderAnalytics = useMemo(() => {
    const filteredOrders = adminOrders.filter((o) => isWithinDateRange(o.createdAt));
    const filteredTxs = walletTxs.filter((tx) => isWithinDateRange(tx.createdAt));
    const useStats = allTime && orderStats !== null && Number(orderStats.totalOrders ?? 0) > 0;

    // Fallback to ledger transaction order IDs if /v1/admin/orders is empty
    const ledgerHoldOrderIds = new Set(
      filteredTxs.filter((tx) => tx.type === 'PAYMENT_HOLD' && tx.orderId).map((tx) => tx.orderId!)
    );
    const ledgerSettledOrderIds = new Set(
      filteredTxs.filter((tx) => tx.type === 'SETTLEMENT' && tx.orderId).map((tx) => tx.orderId!)
    );
    const ledgerRefundedOrderIds = new Set(
      filteredTxs.filter((tx) => tx.type === 'REFUND' && tx.orderId).map((tx) => tx.orderId!)
    );
    const ledgerInspectionOrderIds = new Set(
      filteredTxs
        .filter((tx) => tx.orderId && ledgerHoldOrderIds.has(tx.orderId) && (tx.inspectionOrderId || tx.type.startsWith('INSPECTION_')))
        .map((tx) => tx.orderId!)
    );

    const hasAdminOrders = adminOrders.length > 0;

    const total = useStats
      ? Number(orderStats!.totalOrders)
      : hasAdminOrders
        ? filteredOrders.length
        : ledgerHoldOrderIds.size;

    const completed = useStats
      ? Number(orderStats!.completedOrders ?? 0)
      : hasAdminOrders
        ? filteredOrders.filter((o) => o.status === 'COMPLETED').length
        : ledgerSettledOrderIds.size;

    const confirmed = useStats
      ? Number((orderStats!.confirmedOrders ?? 0) + (orderStats!.processingOrders ?? 0))
      : hasAdminOrders
        ? filteredOrders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PROCESSING').length
        : Math.max(0, ledgerHoldOrderIds.size - ledgerSettledOrderIds.size - ledgerRefundedOrderIds.size);

    const shipping = useStats
      ? Number((orderStats!.shippingOrders ?? 0) + (orderStats!.deliveredOrders ?? 0))
      : hasAdminOrders
        ? filteredOrders.filter((o) => o.status === 'SHIPPED' || o.status === 'DELIVERED').length
        : 0;

    const cancelled = useStats
      ? Number(orderStats!.cancelledOrders ?? 0)
      : hasAdminOrders
        ? filteredOrders.filter((o) => o.status === 'CANCELLED').length
        : ledgerRefundedOrderIds.size;

    const disputed = useStats
      ? Number(orderStats!.disputedOrders ?? 0)
      : hasAdminOrders
        ? filteredOrders.filter((o) => o.escrowStatus === 'FROZEN').length
        : 0;

    const withInspection = hasAdminOrders
      ? filteredOrders.filter((o) => Boolean(o.hasInspection)).length
      : ledgerInspectionOrderIds.size;

    const directOrders = Math.max(0, total - withInspection);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const inspectionAdoptionRate = total > 0 ? Math.round((withInspection / total) * 100) : 0;

    return {
      total,
      completed,
      confirmed,
      shipping,
      cancelled,
      disputed,
      withInspection,
      directOrders,
      completionRate,
      cancelRate,
      inspectionAdoptionRate
    };
  }, [adminOrders, orderStats, walletTxs, allTime, isWithinDateRange]);

  // ============================================================================
  // 4. REAL INSPECTION & HUB CENTER ANALYTICS FROM DATABASE
  // ============================================================================
  const inspectionAnalytics = useMemo(() => {
    const filteredInsp = inspectionOrders.filter((o) =>
      isWithinDateRange(o.createdAt || o.sellerPaidAt || o.buyerPaidAt || o.feeSettledAt)
    );
    const total = filteredInsp.length;

    const atCenterCount = filteredInsp.filter((o) => o.orderType === 'AT_CENTER').length;
    const atHomeCount = filteredInsp.filter((o) => o.orderType === 'AT_HOME').length;

    let passedCount = 0;
    let failedCount = 0;

    filteredInsp.forEach((ord) => {
      const statusUpper = String(ord.status || '').toUpperCase();
      const anyOrd = ord as any;
      const verdictUpper = String(
        anyOrd.verdict || anyOrd.finalVerdict || anyOrd.result?.finalVerdict || ''
      ).toUpperCase();

      if (
        statusUpper === 'FAILED' ||
        statusUpper === 'INSPECTION_FAILED' ||
        verdictUpper === 'FAIL' ||
        verdictUpper === 'FAILED'
      ) {
        failedCount++;
      } else if (isOrderInspectionVerdictPassed(ord)) {
        passedCount++;
      }
    });

    const evaluatedCount = passedCount + failedCount;
    const inProgressCount = Math.max(0, total - evaluatedCount);

    let totalInspectionFees = 0;
    let heldReturnReserves = 0;
    let settledOrdersCount = 0;

    filteredInsp.forEach((ord) => {
      const fee = Number(ord.inspectionFee ?? 0);
      const reserve = Number(ord.returnShippingReserveFee ?? 0);
      const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);
      const isSettled = Boolean(ord.feeSettledAt);

      if (isPaid) {
        totalInspectionFees += fee;
        if (!isSettled) {
          heldReturnReserves += reserve;
        }
      }
      if (isSettled) {
        settledOrdersCount++;
      }
    });

    const passRate = evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : 0;

    return {
      total,
      atCenterCount,
      atHomeCount,
      passedCount,
      failedCount,
      evaluatedCount,
      inProgressCount,
      passRate,
      totalInspectionFees,
      heldReturnReserves,
      settledOrdersCount,
      activeHubsCount: hubCenters.length
    };
  }, [inspectionOrders, hubCenters, isWithinDateRange]);

  // ============================================================================
  // 5. REAL USERS, eKYC & LISTINGS ANALYTICS FROM DATABASE
  // ============================================================================
  const userAndListingAnalytics = useMemo(() => {
    const filteredUsers = users.filter((u) => isWithinDateRange(u.createdAt));

    const totalUsers = allTime && totalUsersElements > filteredUsers.length ? totalUsersElements : filteredUsers.length;
    const activeUsers = filteredUsers.filter((u) => u.accountStatus === 'ACTIVE').length;
    const lockedUsers = filteredUsers.filter((u) => u.accountStatus !== 'ACTIVE').length;

    const sellersCount = filteredUsers.filter((u) =>
      (u.roles || []).some((r) => r.toUpperCase().includes('SELLER'))
    ).length;
    const inspectorsCount = filteredUsers.filter((u) =>
      (u.roles || []).some((r) => r.toUpperCase().includes('INSPECTOR') || r.toUpperCase().includes('CENTER'))
    ).length;
    const staffAdminCount = filteredUsers.filter((u) =>
      (u.roles || []).some((r) => r.toUpperCase().includes('ADMIN') || r.toUpperCase().includes('STAFF'))
    ).length;
    const buyersOnlyCount = Math.max(0, filteredUsers.length - sellersCount - inspectorsCount - staffAdminCount);

    // Real eKYC Verifications from DB (/admin/seller-verifications)
    const filteredVerifs = verifications.filter((v) => isWithinDateRange((v as any).createdAt || (v as any).submittedAt));
    const ekycApproved = filteredVerifs.filter((v) => v.status === 'APPROVED').length;
    const ekycPending = filteredVerifs.filter(
      (v) => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING' || v.status === 'EKYC_PENDING'
    ).length;
    const ekycRejected = filteredVerifs.filter((v) => v.status === 'REJECTED' || v.status === 'RESUBMIT_REQUIRED').length;
    const ekycTotal = filteredVerifs.length;
    const ekycApprovalRate = ekycTotal > 0 ? Math.round((ekycApproved / ekycTotal) * 100) : 0;

    // Real Posts / Listings from DB (/v1/admin/posts, excluding DRAFT)
    const nonDraftListings = posts
      .filter((p: any) => p.status !== 'DRAFT' && p.status !== 'draft')
      .filter((p: any) => isWithinDateRange(p.createdAt));

    const activeListingsCount = nonDraftListings.filter(
      (p: any) => p.status === 'ACTIVE' || p.status === 'active'
    ).length;
    const pendingListingsCount = nonDraftListings.filter(
      (p: any) =>
        p.status === 'PENDING' ||
        p.status === 'PENDING_REVIEW' ||
        p.status === 'pending' ||
        p.status === 'PENDING_INSPECTION' ||
        p.status === 'READY_TO_PUBLISH'
    ).length;
    const rejectedOrSoldCount = Math.max(0, nonDraftListings.length - activeListingsCount - pendingListingsCount);

    // Real Category distribution resolved via catalogCache
    const categoryMap = new Map<string, { count: number; totalValue: number }>();
    nonDraftListings.forEach((p: any) => {
      const resolved = resolveCategoryAndItem({
        postId: p.id || p.postId,
        categoryId: p.categoryId,
        itemId: p.itemId,
        title: p.title,
        description: p.description || p.aiDescription,
        category: p.categoryName || p.category,
        brand: p.brand,
        model: p.model
      });
      const cat = p.categoryName || resolved.categoryName || resolved.displayCategory || p.category || 'Chưa phân loại';
      const price = Number(p.price ?? p.priceVnd ?? 0);
      const curr = categoryMap.get(cat) || { count: 0, totalValue: 0 };
      categoryMap.set(cat, { count: curr.count + 1, totalValue: curr.totalValue + price });
    });

    const topCategories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalValue: data.totalValue,
        share: nonDraftListings.length > 0 ? Math.round((data.count / nonDraftListings.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalUsers,
      activeUsers,
      lockedUsers,
      sellersCount,
      inspectorsCount,
      staffAdminCount,
      buyersOnlyCount,
      ekycApproved,
      ekycPending,
      ekycRejected,
      ekycTotal,
      ekycApprovalRate,
      totalListings: nonDraftListings.length,
      activeListingsCount,
      pendingListingsCount,
      rejectedOrSoldCount,
      topCategories
    };
  }, [users, totalUsersElements, verifications, posts, allTime, isWithinDateRange]);

  // ============================================================================
  // EXPORT FULL SYSTEM OVERVIEW REPORT CSV (100% REAL DATABASE DATA)
  // ============================================================================
  const handleExportReportCSV = () => {
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const rows: Array<[string, string, string, string]> = [
      ['NHÓM CHỈ SỐ', 'TÊN CHỈ SỐ BÁO CÁO (DATABASE)', 'GIÁ TRỊ THỰC TẾ', 'GHI CHÚ / ĐƠN VỊ'],
      ['THÔNG TIN CHUNG', 'Thời điểm xuất báo cáo', nowStr, `Kỳ lọc: ${periodLabel}`],
      ['THÔNG TIN CHUNG', 'Phạm vi dữ liệu', hasPartialData ? 'Một phần dữ liệu chưa tải đủ' : 'Dữ liệu báo cáo', 'Số dư ví và ký quỹ là số dư hiện tại'],
      ['TÀI CHÍNH & DOANH THU', 'Tổng giá trị giao dịch toàn sàn (GMV)', String(financialAnalytics.totalGmv), 'VND'],
      ['TÀI CHÍNH & DOANH THU', 'Số dư hiện tại của ví hệ thống (System Wallet)', String(financialAnalytics.totalSystemBalance), 'VND'],
      ['TÀI CHÍNH & DOANH THU', 'Tiền ký quỹ đang giữ hiện tại (Escrow Held)', String(financialAnalytics.heldEscrow), 'VND'],
      ['TÀI CHÍNH & DOANH THU', 'Số dư hiện tại của quỹ vận chuyển (Shipping Balance)', String(financialAnalytics.shippingPoolBalance), 'VND'],
      ['TÀI CHÍNH & DOANH THU', 'Doanh thu hoa hồng sàn (Platform Revenue)', String(financialAnalytics.platformRevenue), `Tỷ lệ cấu hình: ${financialAnalytics.effectiveRatePercent}%`],
      ['TÀI CHÍNH & DOANH THU', 'Tổng tiền đã giải ngân cho Người bán', String(financialAnalytics.releasedAmount), 'VND'],
      ['TÀI CHÍNH & DOANH THU', 'Tổng tiền đã hoàn trả Người mua', String(financialAnalytics.refundedAmount), 'VND'],
      ['RÚT TIỀN NGÂN HÀNG', 'Số yêu cầu rút tiền chờ duyệt', String(financialAnalytics.pendingWithdrawalsCount), `${formatVND(financialAnalytics.pendingWithdrawalAmount)}`],
      ['RÚT TIỀN NGÂN HÀNG', 'Số lệnh rút tiền đã giải ngân', String(financialAnalytics.approvedWithdrawalsCount), `${formatVND(financialAnalytics.approvedWithdrawalAmount)}`],
      ['ĐƠN HÀNG TOÀN SÀN', 'Tổng số đơn hàng', String(orderAnalytics.total), 'Đơn hàng'],
      ['ĐƠN HÀNG TOÀN SÀN', 'Đơn hàng hoàn thành (COMPLETED)', String(orderAnalytics.completed), `Tỷ lệ hoàn tất: ${orderAnalytics.completionRate}%`],
      ['ĐƠN HÀNG TOÀN SÀN', 'Đơn hàng đang xác nhận / xử lý', String(orderAnalytics.confirmed), 'Đơn hàng'],
      ['ĐƠN HÀNG TOÀN SÀN', 'Đơn hàng đang vận chuyển (SHIPPED)', String(orderAnalytics.shipping), 'Đơn hàng'],
      ['ĐƠN HÀNG TOÀN SÀN', 'Đơn hàng đã hủy (CANCELLED)', String(orderAnalytics.cancelled), `Tỷ lệ hủy: ${orderAnalytics.cancelRate}%`],
      ['ĐƠN HÀNG TOÀN SÀN', 'Đơn hàng qua Kiểm định chất lượng', String(orderAnalytics.withInspection), `Tỷ lệ kiểm định: ${orderAnalytics.inspectionAdoptionRate}%`],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Tổng số hồ sơ kiểm định', String(inspectionAnalytics.total), 'Đơn kiểm định'],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Kiểm định tại Trung tâm Hub (AT_CENTER)', String(inspectionAnalytics.atCenterCount), 'Đơn'],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Kiểm định tại nhà (AT_HOME)', String(inspectionAnalytics.atHomeCount), 'Đơn'],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Đạt kiểm định (PASSED)', String(inspectionAnalytics.passedCount), `Tỷ lệ đạt: ${inspectionAnalytics.passRate}%`],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Không đạt kiểm định (FAILED)', String(inspectionAnalytics.failedCount), 'Đơn'],
      ['KIỂM ĐỊNH & TRẠM HUB', 'Quỹ dự phòng cước hoàn đang giữ', String(inspectionAnalytics.heldReturnReserves), 'VND'],
      ['NGƯỜI DÙNG & eKYC', 'Tổng số tài khoản người dùng', String(userAndListingAnalytics.totalUsers), `${userAndListingAnalytics.activeUsers} đang hoạt động`],
      ['NGƯỜI DÙNG & eKYC', 'Số lượng Người bán (SELLER)', String(userAndListingAnalytics.sellersCount), 'Tài khoản'],
      ['NGƯỜI DÙNG & eKYC', 'Hồ sơ eKYC đã duyệt / Tổng hồ sơ', `${userAndListingAnalytics.ekycApproved}/${userAndListingAnalytics.ekycTotal}`, `Tỷ lệ duyệt: ${userAndListingAnalytics.ekycApprovalRate}%`],
      ['NGƯỜI DÙNG & eKYC', 'Hồ sơ eKYC đang chờ thẩm định', String(userAndListingAnalytics.ekycPending), 'Hồ sơ'],
      ['BÀI ĐĂNG & DANH MỤC', 'Tổng số bài đăng chính thức trên sàn', String(userAndListingAnalytics.totalListings), 'Không bao gồm bản nháp'],
      ['BÀI ĐĂNG & DANH MỤC', 'Bài đăng đang hiển thị (ACTIVE)', String(userAndListingAnalytics.activeListingsCount), 'Tin đăng']
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bao_cao_tong_quan_he_thong_secondlife_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pre-compute SVG Area Chart coordinates strictly from real trendSeriesData
  const areaChartGeometry = useMemo(() => {
    const width = 620;
    const height = 210;
    const padLeft = 24;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 32;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxVal = Math.max(
      ...trendSeriesData.map((d) => Math.max(d.gmv, d.revenue)),
      1
    );
    const count = trendSeriesData.length;

    const points = trendSeriesData.map((d, i) => {
      const x = padLeft + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2);
      const yGmv = padTop + plotH - (d.gmv / maxVal) * plotH;
      const yRev = padTop + plotH - (d.revenue / maxVal) * plotH;
      return { x, yGmv, yRev, data: d };
    });

    const buildSmoothPath = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
        const cpy1 = p0.y;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
        const cpy2 = p1.y;
        d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
      }
      return d;
    };

    const gmvLinePath = buildSmoothPath(points.map((p) => ({ x: p.x, y: p.yGmv })));
    const gmvAreaPath =
      points.length > 1
        ? `${gmvLinePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
        : '';

    const revLinePath = buildSmoothPath(points.map((p) => ({ x: p.x, y: p.yRev })));
    const revAreaPath =
      points.length > 1
        ? `${revLinePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
        : '';

    return {
      width,
      height,
      padTop,
      padBottom,
      plotH,
      maxVal,
      points,
      gmvLinePath,
      gmvAreaPath,
      revLinePath,
      revAreaPath
    };
  }, [trendSeriesData]);

  // Real Order Status Vertical Bar Chart columns
  const orderBarColumns = useMemo(() => {
    const cols = [
      {
        key: 'completed',
        label: 'Hoàn thành',
        sub: 'Đã giải ngân',
        count: orderAnalytics.completed,
        color: '#10b981',
        gradientFrom: 'from-emerald-500',
        gradientTo: 'to-emerald-400',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        key: 'confirmed',
        label: 'Đang xử lý',
        sub: 'Đã xác nhận',
        count: orderAnalytics.confirmed,
        color: '#0ea5e9',
        gradientFrom: 'from-sky-500',
        gradientTo: 'to-sky-400',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
      },
      {
        key: 'shipping',
        label: 'Đang giao',
        sub: 'Vận chuyển',
        count: orderAnalytics.shipping,
        color: '#3b82f6',
        gradientFrom: 'from-blue-600',
        gradientTo: 'to-indigo-500',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        key: 'inspection',
        label: 'Có Kiểm định',
        sub: 'Qua trạm kiểm định',
        count: orderAnalytics.withInspection,
        color: '#8b5cf6',
        gradientFrom: 'from-violet-600',
        gradientTo: 'to-purple-500',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
      },
      {
        key: 'cancelled',
        label: 'Đã hủy',
        sub: 'Hoàn tiền',
        count: orderAnalytics.cancelled,
        color: '#f43f5e',
        gradientFrom: 'from-rose-500',
        gradientTo: 'to-rose-400',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
      }
    ];
    const maxVal = Math.max(...cols.map((c) => c.count), 1);
    return cols.map((c) => ({
      ...c,
      heightPct: c.count > 0 ? Math.max(10, Math.round((c.count / maxVal) * 100)) : 0,
      sharePct: orderAnalytics.total > 0 ? Math.round((c.count / orderAnalytics.total) * 100) : 0
    }));
  }, [orderAnalytics]);

  const CATEGORY_COLORS = ['#c34c36', '#24263e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  // Real Revenue vs Escrow bar split for KPI Card 2
  const revenueVsEscrowSplit = useMemo(() => {
    const rev = Math.max(0, financialAnalytics.platformRevenue);
    const esc = Math.max(0, financialAnalytics.heldEscrow);
    const sum = rev + esc;
    if (sum <= 0) return { revPct: 0, escPct: 0 };
    const revPct = Math.round((rev / sum) * 100);
    return { revPct, escPct: 100 - revPct };
  }, [financialAnalytics]);

  return (
    <div className="space-y-5 animate-fadeIn max-w-full overflow-x-hidden">
      {/* ============================================================================ */}
      {/* 1. HEADER BANNER & FILTER TOOLBAR                                            */}
      {/* ============================================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#24263e] to-[#c34c36] text-white flex items-center justify-center shadow-sm shrink-0">
              <BarChart3 className="w-6 h-6 text-[#fce5da]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  BIỂU ĐỒ BÁO CÁO TỔNG QUAN HỆ THỐNG
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Dữ liệu thực tế từ hệ thống
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ số liệu và biểu đồ được truy vấn trực tiếp từ cơ sở dữ liệu hệ thống (Ví hệ thống, Đơn hàng ký quỹ, Trạm kiểm định, Người dùng & Tin đăng).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAllReportData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Đồng bộ lại dữ liệu biểu đồ mới nhất từ Backend"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#c34c36]' : ''}`} />
              <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportReportCSV}
              className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83e2b] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Xuất báo cáo CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation pills */}
        <div className="my-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: lang === 'vi' ? 'Tất cả biểu đồ tổng quan' : 'All Visual Charts', icon: Layers },
              { id: 'FINANCE', label: lang === 'vi' ? 'Biểu đồ Tài chính & Dòng tiền' : 'Financial & Cashflow Charts', icon: Wallet },
              { id: 'ORDERS_INSPECTION', label: lang === 'vi' ? 'Biểu đồ Đơn hàng & Kiểm định' : 'Orders & Inspection Charts', icon: BarChart3 },
              { id: 'USERS_LISTINGS', label: lang === 'vi' ? 'Biểu đồ Người dùng & Ngành hàng' : 'Users & Category Charts', icon: PieChart }
            ].map((sec) => {
              const Icon = sec.icon;
              const active = reportSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setReportSection(sec.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-[#fce5da] text-[#24263e] border border-[#24263e]/20 shadow-2xs font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            Cập nhật lúc: {lastSyncedAt.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
          </span>
        </div>
        <AdminReportPeriodFilter lang={lang} now={reportNow} appliedLabel={periodLabel} onApply={applyPeriod} />
        {hasPartialData && (
          <p role="status" className="mt-2 text-xs font-semibold text-amber-700">
            {lang === 'vi' ? 'Một phần dữ liệu chưa tải đủ. Báo cáo và CSV phản ánh dữ liệu đã tải.'
              : 'Some records could not be loaded. The report and CSV reflect the records available.'}
          </p>
        )}
      </div>

      {/* ============================================================================ */}
      {/* 2. TOP KPI CARDS WITH REAL MINI SPARKLINE BARS                               */}
      {/* ============================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng GMV & Số dư Ví Hệ Thống */}
        <div className="bg-gradient-to-br from-[#24263e] to-[#323556] text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#fce5da]/80 uppercase tracking-wider block">
                TỔNG GIÁ TRỊ GIAO DỊCH
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-[#fce5da] mt-1 block">
                {formatVND(financialAnalytics.totalGmv)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 text-[#fce5da] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Real Sparkline Bars from real daily order totals */}
          <div className="flex items-end gap-1.5 h-9 mt-3 pt-2 border-t border-white/10">
            {realSparklineHeights.length > 0 ? (
              realSparklineHeights.map((bar, i) => (
                <div
                  key={i}
                  title={`${bar.label}: ${formatVND(bar.gmv)}`}
                  className="flex-1 rounded-t bg-[#fce5da]/80 hover:bg-[#c34c36] transition-all"
                  style={{ height: `${bar.heightPct}%` }}
                />
              ))
            ) : (
              <div className="w-full text-[10px] text-slate-400 italic">Chưa có phát sinh theo ngày</div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2">
            <span>
              Ví hệ thống hiện tại: <strong className="text-white font-mono">{formatVND(financialAnalytics.totalSystemBalance)}</strong>
            </span>
            <span className="text-emerald-300 font-bold">{orderAnalytics.total} đơn</span>
          </div>
        </div>

        {/* KPI 2: Doanh thu hoa hồng & Ký quỹ thực tế */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                DOANH THU HOA HỒNG SÀN
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-1 block">
                {formatVND(financialAnalytics.platformRevenue)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">Ký quỹ đang giữ hiện tại:</span>
              <span className="font-mono font-bold text-amber-800">{formatVND(financialAnalytics.heldEscrow)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${revenueVsEscrowSplit.revPct}%` }}
                title={`Hoa hồng: ${revenueVsEscrowSplit.revPct}%`}
              />
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${revenueVsEscrowSplit.escPct}%` }}
                title={`Ký quỹ: ${revenueVsEscrowSplit.escPct}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                Tỷ lệ phí sàn:{' '}
                <strong className="text-emerald-700">
                  {financialAnalytics.activeRuleName
                    ? `${financialAnalytics.effectiveRatePercent}%`
                    : `${financialAnalytics.effectiveRatePercent}%`}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('system-wallet')}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Ví hệ thống →
              </button>
            </div>
          </div>
        </div>

        {/* KPI 3: Tỷ lệ Hoàn thành Đơn & Kiểm định thực tế */}
        <div className="bg-white rounded-2xl border border-blue-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider block">
                HIỆU SUẤT ĐƠN & KIỂM ĐỊNH
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {orderAnalytics.completionRate}%
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  ({orderAnalytics.completed}/{orderAnalytics.total} đơn)
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">Đơn qua kiểm định:</span>
              <span className="font-mono font-bold text-indigo-700">
                {orderAnalytics.withInspection} đơn ({orderAnalytics.inspectionAdoptionRate}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${orderAnalytics.completionRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                Đạt kiểm định:{' '}
                <strong className="text-blue-700">
                  {inspectionAnalytics.evaluatedCount > 0 ? `${inspectionAnalytics.passRate}%` : 'Chưa có KQ'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('orders')}
                className="text-blue-700 font-bold hover:underline cursor-pointer"
              >
                Xem đơn →
              </button>
            </div>
          </div>
        </div>

        {/* KPI 4: Cộng đồng Người dùng, eKYC & Tin đăng thực tế */}
        <div className="bg-white rounded-2xl border border-rose-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider block">
                TÀI KHOẢN & TIN ĐĂNG SÀN
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {userAndListingAnalytics.totalUsers}
                </span>
                <span className="text-xs font-bold text-[#c34c36]">
                  • {userAndListingAnalytics.activeListingsCount} tin đang hiển thị
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">Tỷ lệ duyệt hồ sơ người bán:</span>
              <span className="font-mono font-bold text-emerald-700">
                {userAndListingAnalytics.ekycApproved}/{userAndListingAnalytics.ekycTotal} ({userAndListingAnalytics.ekycApprovalRate}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#c34c36] to-amber-500 h-full rounded-full transition-all"
                style={{ width: `${userAndListingAnalytics.ekycApprovalRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span className="text-rose-600 font-bold">{userAndListingAnalytics.ekycPending} hồ sơ chờ duyệt</span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('seller-kyc')}
                className="text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Duyệt hồ sơ →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* 3. ROW 1 CHARTS: BIỂU ĐỒ MIỀN XU HƯỚNG GMV THỰC TẾ & DONUT VÍ HỆ THỐNG       */}
      {/* ============================================================================ */}
      {(reportSection === 'ALL' || reportSection === 'FINANCE') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 7 COLS: SVG AREA & LINE CHART FOR REAL GMV & LEDGER REVENUE */}
          <div className="lg:col-span-7 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-[#24263e] text-[#fce5da] shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      BIỂU ĐỒ DÒNG TIỀN GIAO DỊCH & DOANH THU HOA HỒNG
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {allTime ? '10 ngày gần nhất có phát sinh'
                        : trendGrouping === 'month' ? 'Tổng hợp theo tháng trong kỳ'
                          : trendGrouping === 'week' ? 'Tổng hợp theo tuần trong kỳ, bắt đầu từ thứ Hai'
                            : 'Tổng hợp theo ngày trong kỳ'}
                    </p>
                  </div>
                </div>

                {/* Chart Legend */}
                <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                  <span className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] inline-block shrink-0" />
                    <span>Giá trị giao dịch</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                    <span>Hoa hồng sàn</span>
                  </span>
                </div>
              </div>

              {/* Interactive SVG Area Chart */}
              <div className="mt-4 relative overflow-hidden">
                {trendSeriesData.length > 0 ? (
                  <svg
                    viewBox={`0 0 ${areaChartGeometry.width} ${areaChartGeometry.height}`}
                    className="w-full h-56 select-none"
                  >
                    <defs>
                      <linearGradient id="gmvAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c34c36" stopOpacity="0.32" />
                        <stop offset="95%" stopColor="#c34c36" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                        <stop offset="95%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((step, idx) => {
                      const y = areaChartGeometry.padTop + areaChartGeometry.plotH * step;
                      return (
                        <line
                          key={idx}
                          x1={24}
                          y1={y}
                          x2={areaChartGeometry.width - 24}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                      );
                    })}

                    {/* Area fills */}
                    {areaChartGeometry.gmvAreaPath && (
                      <path d={areaChartGeometry.gmvAreaPath} fill="url(#gmvAreaGrad)" />
                    )}
                    {areaChartGeometry.revAreaPath && (
                      <path d={areaChartGeometry.revAreaPath} fill="url(#revAreaGrad)" />
                    )}

                    {/* Smooth Curves */}
                    {areaChartGeometry.gmvLinePath && (
                      <path
                        d={areaChartGeometry.gmvLinePath}
                        fill="none"
                        stroke="#c34c36"
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    )}
                    {areaChartGeometry.revLinePath && (
                      <path
                        d={areaChartGeometry.revLinePath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        strokeDasharray="5 3"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Data Nodes & Labels */}
                    {areaChartGeometry.points.map((pt, idx) => {
                      const isHovered = hoveredTrendIdx === idx;
                      return (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredTrendIdx(idx)}
                          onMouseLeave={() => setHoveredTrendIdx(null)}
                        >
                          {/* Vertical guide line on hover */}
                          {isHovered && (
                            <line
                              x1={pt.x}
                              y1={areaChartGeometry.padTop}
                              x2={pt.x}
                              y2={areaChartGeometry.padTop + areaChartGeometry.plotH}
                              stroke="#24263e"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                            />
                          )}

                          {/* Invisible larger hit area */}
                          <circle cx={pt.x} cy={pt.yGmv} r={16} fill="transparent" />

                          {/* GMV Node */}
                          <circle
                            cx={pt.x}
                            cy={pt.yGmv}
                            r={isHovered ? 6.5 : 4.5}
                            fill="#ffffff"
                            stroke="#c34c36"
                            strokeWidth={3}
                          />

                          {/* Revenue Node */}
                          <circle
                            cx={pt.x}
                            cy={pt.yRev}
                            r={isHovered ? 5.5 : 3.5}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />

                          {/* Value pill above node */}
                          {(isHovered || idx === areaChartGeometry.points.length - 1) && (
                            <g
                              transform={`translate(${Math.min(
                                Math.max(pt.x, 55),
                                areaChartGeometry.width - 55
                              )}, ${Math.max(14, pt.yGmv - 12)})`}
                            >
                              <rect
                                x="-48"
                                y="-14"
                                width="96"
                                height="18"
                                rx="6"
                                fill={isHovered ? '#24263e' : '#fce5da'}
                              />
                              <text
                                x="0"
                                y="-2"
                                textAnchor="middle"
                                fill={isHovered ? '#ffffff' : '#24263e'}
                                fontSize="9.5"
                                fontWeight="800"
                              >
                                {formatVND(pt.data.gmv)}
                              </text>
                            </g>
                          )}

                          {(isHovered || idx % Math.ceil(areaChartGeometry.points.length / 10) === 0) && (
                            <text
                              x={pt.x}
                              y={areaChartGeometry.height - 8}
                              textAnchor="middle"
                              fill={isHovered ? '#c34c36' : '#64748b'}
                              fontSize="10.5"
                              fontWeight={isHovered ? '800' : '600'}
                            >
                              {pt.data.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="h-56 flex flex-col items-center justify-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-400 text-xs">
                    <span>Chưa có phát sinh đơn hàng hoặc bút toán sổ cái trong khoảng thời gian đã chọn.</span>
                  </div>
                )}

                {/* Active Point Detail Bar */}
                <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {hoveredTrendIdx !== null && trendSeriesData[hoveredTrendIdx] ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#24263e] text-white font-bold text-[11px]">
                          Ngày: {trendSeriesData[hoveredTrendIdx].label}
                        </span>
                        <span className="text-slate-600 font-semibold">
                          Phát sinh: <strong>{trendSeriesData[hoveredTrendIdx].orders} đơn hàng</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span>
                          Giá trị giao dịch: <strong className="text-[#c34c36]">{formatVND(trendSeriesData[hoveredTrendIdx].gmv)}</strong>
                        </span>
                        <span>
                          Hoa hồng thu: <strong className="text-emerald-700">{formatVND(trendSeriesData[hoveredTrendIdx].revenue)}</strong>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600 font-medium">
                        Tổng hợp thực tế: <strong className="text-slate-900">{orderAnalytics.total} đơn giao dịch</strong>
                      </span>
                      <div className="flex items-center gap-4 font-mono">
                        <span>
                          Đã giải ngân người bán: <strong className="text-emerald-700">{formatVND(financialAnalytics.releasedAmount)}</strong>
                        </span>
                        <span>
                          Đã hoàn tiền người mua: <strong className="text-purple-700">{formatVND(financialAnalytics.refundedAmount)}</strong>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: DONUT CHART - CƠ CẤU PHÂN BỔ VÍ HỆ THỐNG THỰC TẾ */}
          <div className="lg:col-span-5 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      {lang === 'vi' ? 'CƠ CẤU DÒNG TIỀN VÍ HỆ THỐNG' : 'SYSTEM WALLET FUND ALLOCATION'}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Phân bổ số dư thực tế trong Ví hệ thống
                    </p>
                  </div>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('system-wallet')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 min-w-0">
                <SvgDonutChart
                  centerTitle="TỔNG VÍ HỆ THỐNG"
                  centerValue={formatVND(financialAnalytics.totalSystemBalance)}
                  centerSub={`${walletTxs.length} bút toán`}
                  formatValue={(v) => formatVND(v)}
                  segments={[
                    {
                      label: 'Ký quỹ Đơn hàng',
                      subLabel: 'Tiền hàng tạm giữ bảo vệ người mua',
                      value: financialAnalytics.heldEscrow,
                      color: '#f59e0b',
                      bgBadge: 'bg-amber-100 text-amber-800'
                    },
                    {
                      label: 'Quỹ Vận chuyển & Cước hoàn',
                      subLabel: 'Phí giao nhận & dự phòng kiểm định',
                      value: financialAnalytics.shippingPoolBalance + inspectionAnalytics.heldReturnReserves,
                      color: '#3b82f6',
                      bgBadge: 'bg-blue-100 text-blue-800'
                    },
                    {
                      label: 'Doanh thu Hoa hồng Sàn',
                      subLabel: 'Lợi nhuận phí sàn thực nhận',
                      value: financialAnalytics.platformRevenue,
                      color: '#10b981',
                      bgBadge: 'bg-emerald-100 text-emerald-800'
                    }
                  ]}
                />
              </div>
            </div>

            {/* Stacked Withdrawal Progress Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>Tỷ lệ Giải ngân Rút tiền Ví ({financialAnalytics.totalWithdrawalsCount} lệnh)</span>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('withdrawals')}
                  className="text-[11px] font-bold text-[#c34c36] hover:underline cursor-pointer"
                >
                  Duyệt lệnh rút →
                </button>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                {financialAnalytics.totalWithdrawalsCount > 0 ? (
                  <>
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{
                        width: `${(financialAnalytics.approvedWithdrawalsCount / financialAnalytics.totalWithdrawalsCount) * 100}%`
                      }}
                      title={`Đã giải ngân: ${financialAnalytics.approvedWithdrawalsCount}`}
                    />
                    <div
                      className="bg-amber-400 h-full transition-all"
                      style={{
                        width: `${(financialAnalytics.pendingWithdrawalsCount / financialAnalytics.totalWithdrawalsCount) * 100}%`
                      }}
                      title={`Chờ duyệt: ${financialAnalytics.pendingWithdrawalsCount}`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${(financialAnalytics.rejectedWithdrawalsCount / financialAnalytics.totalWithdrawalsCount) * 100}%`
                      }}
                      title={`Từ chối: ${financialAnalytics.rejectedWithdrawalsCount}`}
                    />
                  </>
                ) : (
                  <div className="bg-slate-200 h-full w-full" />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Đã duyệt: <strong>{financialAnalytics.approvedWithdrawalsCount}</strong> ({formatVND(financialAnalytics.approvedWithdrawalAmount)})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Chờ duyệt: <strong className="text-amber-800">{financialAnalytics.pendingWithdrawalsCount}</strong> ({formatVND(financialAnalytics.pendingWithdrawalAmount)})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* 4. ROW 2 CHARTS: BIỂU ĐỒ CỘT ĐƠN HÀNG & BIỂU ĐỒ ĐỒNG HỒ ĐO KIỂM ĐỊNH HUB    */}
      {/* ============================================================================ */}
      {(reportSection === 'ALL' || reportSection === 'ORDERS_INSPECTION') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 7 COLS: VERTICAL COLUMN BAR CHART - TRẠNG THÁI ĐƠN HÀNG TOÀN SÀN */}
          <div className="lg:col-span-7 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-[#fce5da] text-[#c34c36] shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      {lang === 'vi'
                        ? 'BIỂU ĐỒ CỘT PHÂN BỔ TRẠNG THÁI ĐƠN HÀNG'
                        : 'MARKETPLACE ORDER STATUS COLUMN CHART'}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Thống kê trạng thái thực tế của {orderAnalytics.total} đơn hàng trên sàn
                    </p>
                  </div>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('orders')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Quản lý đơn</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Vertical Column Chart Canvas */}
              <div className="mt-6 pt-4 px-2 sm:px-6 pb-2 bg-slate-50/60 rounded-2xl border border-slate-200/70">
                <div className="h-52 flex items-end justify-around gap-3 sm:gap-6 border-b border-slate-200 pb-3 relative">
                  {/* Subtle horizontal reference lines */}
                  <div className="absolute inset-x-0 top-0 border-b border-dashed border-slate-200/80 pointer-events-none" />
                  <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-200/80 pointer-events-none" />

                  {orderBarColumns.map((col, idx) => {
                    const isHovered = hoveredBarIdx === idx;
                    return (
                      <div
                        key={col.key}
                        onMouseEnter={() => setHoveredBarIdx(idx)}
                        onMouseLeave={() => setHoveredBarIdx(null)}
                        className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer max-w-[92px]"
                      >
                        {/* Top value badge */}
                        <div
                          className={`mb-1.5 px-2 py-0.5 rounded-lg text-xs font-black font-mono transition-all ${
                            isHovered
                              ? 'bg-[#24263e] text-white shadow-sm -translate-y-0.5 scale-105'
                              : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs'
                          }`}
                        >
                          {col.count} <span className="text-[10px] font-bold opacity-75">({col.sharePct}%)</span>
                        </div>

                        {/* Vertical Bar */}
                        <div className="w-full max-w-[54px] h-36 bg-slate-200/60 rounded-t-xl p-1 flex items-end overflow-hidden">
                          <div
                            className={`w-full rounded-t-lg bg-gradient-to-t ${col.gradientFrom} ${col.gradientTo} transition-all duration-500 shadow-xs group-hover:brightness-110`}
                            style={{ height: `${col.heightPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-start justify-around gap-3 sm:gap-6 pt-3">
                  {orderBarColumns.map((col) => (
                    <div key={col.key} className="flex-1 text-center max-w-[92px]">
                      <div className="text-xs font-extrabold text-slate-800 truncate">{col.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{col.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Comparison Strip: Direct vs Inspection Orders */}
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <span className="text-emerald-800 font-bold">Tỷ lệ hoàn tất đơn:</span>
                <span className="font-mono font-black text-emerald-950 text-sm">{orderAnalytics.completionRate}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
                <span className="text-indigo-800 font-bold">Tỷ lệ đơn có Kiểm định:</span>
                <span className="font-mono font-black text-indigo-950 text-sm">{orderAnalytics.inspectionAdoptionRate}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                <span className="text-rose-800 font-bold">Đơn đang tranh chấp:</span>
                <span className="font-mono font-black text-rose-950 text-sm">{orderAnalytics.disputed} đơn</span>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: RADIAL GAUGE & INSPECTION HUB ANALYTICS */}
          <div className="lg:col-span-5 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-800 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      CHẤT LƯỢNG KIỂM ĐỊNH & TRẠM KIỂM ĐỊNH
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Dữ liệu từ {inspectionAnalytics.total} hồ sơ kiểm định trên hệ thống
                    </p>
                  </div>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('inspection-funds')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Đối soát</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Semi-circle Radial Gauge */}
                <SvgRadialGauge
                  percentage={inspectionAnalytics.passRate}
                  label="TỶ LỆ ĐẠT CHUẨN"
                  subLabel={`Đã có kết luận: ${inspectionAnalytics.evaluatedCount}/${inspectionAnalytics.total} hồ sơ`}
                  color="#10b981"
                  passedText={`${inspectionAnalytics.passedCount} Đạt`}
                  failedText={`${inspectionAnalytics.failedCount} Không đạt`}
                />

                {/* Method & Financial Split Cards */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Tại trạm kiểm định</span>
                      <span className="font-mono text-[#24263e]">{inspectionAnalytics.atCenterCount} đơn</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#24263e] rounded-full transition-all"
                        style={{
                          width: `${
                            inspectionAnalytics.total > 0
                              ? Math.round((inspectionAnalytics.atCenterCount / inspectionAnalytics.total) * 100)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Tại nhà</span>
                      <span className="font-mono text-[#c34c36]">{inspectionAnalytics.atHomeCount} đơn</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#c34c36] rounded-full transition-all"
                        style={{
                          width: `${
                            inspectionAnalytics.total > 0
                              ? Math.round((inspectionAnalytics.atHomeCount / inspectionAnalytics.total) * 100)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900">Đang chờ kết luận:</span>
                    <span className="font-mono font-black text-amber-950">{inspectionAnalytics.inProgressCount} hồ sơ</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                Quỹ dự phòng cước hoàn giữ:{' '}
                <strong className="font-mono text-amber-800">{formatVND(inspectionAnalytics.heldReturnReserves)}</strong>
              </span>
              <span className="text-slate-600">
                Trạm kiểm định hoạt động: <strong className="text-emerald-700">{inspectionAnalytics.activeHubsCount} trạm</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* 5. ROW 3 CHARTS: DONUT CƠ CẤU NGƯỜI DÙNG & BIỂU ĐỒ NGANG NGÀNH HÀNG TIN ĐĂNG */}
      {/* ============================================================================ */}
      {(reportSection === 'ALL' || reportSection === 'USERS_LISTINGS') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 6 COLS: USER ROLES DONUT CHART & eKYC STACKED BAR */}
          <div className="lg:col-span-6 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      CƠ CẤU VAI TRÒ NGƯỜI DÙNG & DUYỆT ĐỊNH DANH
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Phân bổ {userAndListingAnalytics.totalUsers} tài khoản trên hệ thống theo nhóm quyền
                    </p>
                  </div>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('customers')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Quản lý người dùng</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 min-w-0">
                <SvgDonutChart
                  centerTitle="TỔNG TÀI KHOẢN"
                  centerValue={`${userAndListingAnalytics.totalUsers} tài khoản`}
                  centerSub={`${userAndListingAnalytics.activeUsers} đang hoạt động`}
                  formatValue={(v) => `${v} tài khoản`}
                  segments={[
                    {
                      label: 'Người mua',
                      subLabel: 'Tài khoản mua sắm tiêu chuẩn',
                      value: userAndListingAnalytics.buyersOnlyCount,
                      color: '#3b82f6',
                      bgBadge: 'bg-blue-100 text-blue-800'
                    },
                    {
                      label: 'Người bán',
                      subLabel: 'Đã xác thực định danh mở gian hàng',
                      value: userAndListingAnalytics.sellersCount,
                      color: '#10b981',
                      bgBadge: 'bg-emerald-100 text-emerald-800'
                    },
                    {
                      label: 'Kiểm định viên & Quản lý trạm',
                      subLabel: 'Nhân sự phụ trách kiểm định chất lượng',
                      value: userAndListingAnalytics.inspectorsCount,
                      color: '#f59e0b',
                      bgBadge: 'bg-amber-100 text-amber-800'
                    },
                    {
                      label: 'Quản trị & Vận hành',
                      subLabel: 'Quản trị viên & nhân viên hệ thống',
                      value: userAndListingAnalytics.staffAdminCount,
                      color: '#8b5cf6',
                      bgBadge: 'bg-purple-100 text-purple-800'
                    }
                  ]}
                />
              </div>
            </div>

            {/* eKYC Verification Stacked Chart */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800">
                  Biểu đồ Tiến độ Thẩm định Hồ sơ Người Bán ({userAndListingAnalytics.ekycTotal} hồ sơ)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Đạt {userAndListingAnalytics.ekycApprovalRate}%
                </span>
              </div>

              <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden flex p-0.5 gap-0.5">
                {userAndListingAnalytics.ekycTotal > 0 ? (
                  <>
                    <div
                      className="bg-emerald-500 h-full rounded-l-full"
                      style={{
                        width: `${(userAndListingAnalytics.ekycApproved / userAndListingAnalytics.ekycTotal) * 100}%`
                      }}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${(userAndListingAnalytics.ekycPending / userAndListingAnalytics.ekycTotal) * 100}%`
                      }}
                    />
                    <div
                      className="bg-rose-500 h-full rounded-r-full"
                      style={{
                        width: `${(userAndListingAnalytics.ekycRejected / userAndListingAnalytics.ekycTotal) * 100}%`
                      }}
                    />
                  </>
                ) : (
                  <div className="bg-slate-200 h-full w-full rounded-full" />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                <div className="flex items-center gap-1.5 text-emerald-800">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                  <span>Đã duyệt: {userAndListingAnalytics.ekycApproved}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
                  <span>Chờ duyệt: {userAndListingAnalytics.ekycPending}</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
                  <span>Từ chối/Nộp lại: {userAndListingAnalytics.ekycRejected}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 6 COLS: HORIZONTAL BAR CHART - NGÀNH HÀNG & TRẠNG THÁI TIN ĐĂNG */}
          <div className="lg:col-span-6 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-800 shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                      {lang === 'vi'
                        ? 'TỶ TRỌNG TIN ĐĂNG THEO NGÀNH HÀNG GIA DỤNG'
                        : 'APPLIANCE CATEGORY DISTRIBUTION BAR CHART'}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Phân tích {userAndListingAnalytics.totalListings} bài đăng chính thức trên sàn
                    </p>
                  </div>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('listings')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Quản lý tin</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Listing Status Mini Summary Pills */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Đang hiển thị</span>
                    <span className="text-lg font-black font-mono text-emerald-950">
                      {userAndListingAnalytics.activeListingsCount}
                    </span>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Chờ duyệt / KĐ</span>
                    <span className="text-lg font-black font-mono text-amber-950">
                      {userAndListingAnalytics.pendingListingsCount}
                    </span>
                  </div>
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>

                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase block">Đã bán / Đóng</span>
                    <span className="text-lg font-black font-mono text-slate-900">
                      {userAndListingAnalytics.rejectedOrSoldCount}
                    </span>
                  </div>
                  <Package className="w-5 h-5 text-slate-500" />
                </div>
              </div>

              {/* Horizontal Category Bars */}
              <div className="mt-5 space-y-3">
                {userAndListingAnalytics.topCategories.length > 0 ? (
                  userAndListingAnalytics.topCategories.map((cat, idx) => {
                    const barColor = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: barColor }}
                            />
                            <span className="font-extrabold text-slate-800 truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 font-mono">
                            <span className="text-[11px] text-slate-500">{formatVND(cat.totalValue)}</span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-900 font-black text-[11px]">
                              {cat.count} tin ({cat.share}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(4, cat.share)}%`,
                              backgroundColor: barColor
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                    Chưa có bài đăng chính thức nào trên hệ thống trong kỳ lọc hiện tại.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Danh mục sản phẩm chuẩn hóa trên toàn hệ thống</span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('catalog-ai')}
                className="font-bold text-[#c34c36] hover:underline cursor-pointer"
              >
                Cấu hình Danh mục →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* 6. EXECUTIVE RECONCILIATION MATRIX (BẢNG TỔNG HỢP ĐỐI SOÁT DỮ LIỆU THỰC TẾ)   */}
      {/* ============================================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-[#c34c36]" />
            <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
              BẢNG ĐỐI SOÁT TỔNG HỢP CHỈ SỐ TRỌNG YẾU TOÀN SÀN
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Bấm vào từng phân khu để chuyển nhanh sang màn hình nghiệp vụ chi tiết
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Phân khu nghiệp vụ</th>
                <th className="py-3 px-4">Chỉ số trọng yếu</th>
                <th className="py-3 px-4 text-right">Giá trị hiện hành</th>
                <th className="py-3 px-4 text-center">Trạng thái vận hành</th>
                <th className="py-3 px-4 text-right">Điều hướng nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Tài chính & ví hệ thống</td>
                <td className="py-3 px-4 text-slate-600">Số dư ví / Ký quỹ đang giữ hiện tại</td>
                <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                  {formatVND(financialAnalytics.totalSystemBalance)} / {formatVND(financialAnalytics.heldEscrow)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Cân đối kế toán
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('system-wallet')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Ví hệ thống →
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Doanh thu & Hoa hồng sàn</td>
                <td className="py-3 px-4 text-slate-600">Tổng giá trị giao dịch / Doanh thu hoa hồng sàn</td>
                <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                  {formatVND(financialAnalytics.totalGmv)} / {formatVND(financialAnalytics.platformRevenue)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Phí sàn {financialAnalytics.effectiveRatePercent}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('commission-rules')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Quy tắc hoa hồng →
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Đơn hàng & Tiền ký quỹ</td>
                <td className="py-3 px-4 text-slate-600">Đơn hoàn thành / Tổng số đơn hàng toàn sàn</td>
                <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                  {orderAnalytics.completed} / {orderAnalytics.total} đơn ({orderAnalytics.completionRate}%)
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {orderAnalytics.shipping} đơn đang giao
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('orders')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Quản lý đơn →
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Kiểm định & Quỹ dự phòng</td>
                <td className="py-3 px-4 text-slate-600">Tổng hồ sơ kiểm định / Quỹ dự phòng cước hoàn đang giữ</td>
                <td className="py-3 px-4 text-right font-mono font-black text-blue-900">
                  {inspectionAnalytics.total} đơn / {formatVND(inspectionAnalytics.heldReturnReserves)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Tỷ lệ đạt {inspectionAnalytics.passRate}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('inspection-funds')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Đối soát kiểm định →
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Giải ngân Rút tiền Ví</td>
                <td className="py-3 px-4 text-slate-600">Lệnh chờ duyệt / Lệnh đã giải ngân thành công</td>
                <td className="py-3 px-4 text-right font-mono font-black text-amber-900">
                  {financialAnalytics.pendingWithdrawalsCount} chờ ({formatVND(financialAnalytics.pendingWithdrawalAmount)}) /{' '}
                  {financialAnalytics.approvedWithdrawalsCount} đã duyệt
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      financialAnalytics.pendingWithdrawalsCount > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {financialAnalytics.pendingWithdrawalsCount > 0 ? 'Cần xử lý rút tiền' : 'Đã xử lý hết'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('withdrawals')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Duyệt rút tiền →
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 font-bold text-slate-800">Người dùng & Định danh người bán</td>
                <td className="py-3 px-4 text-slate-600">Tổng tài khoản / Hồ sơ người bán đã duyệt</td>
                <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                  {userAndListingAnalytics.totalUsers} tài khoản / {userAndListingAnalytics.ekycApproved} hồ sơ đã duyệt
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      userAndListingAnalytics.ekycPending > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {userAndListingAnalytics.ekycPending} hồ sơ chờ duyệt
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('seller-kyc')}
                    className="text-[#c34c36] hover:underline font-bold cursor-pointer"
                  >
                    Thẩm định hồ sơ →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
