import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ExternalLink,
  ChevronRight,
  Filter,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { formatVND } from '../../utils/translations';
import { Language } from '../../types';

interface AdminInspectionFundsTabProps {
  lang?: Language;
  onOpenFundsAudit: (orderId: string) => void;
  onNavigateGovernance?: () => void;
}

function renderInspectionOrderStatus(status?: string | null) {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'DISPATCHED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          Đã điều phối
        </span>
      );
    case 'CANCELLED':
    case 'CANCELED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
          Đã hủy
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Đã hoàn tất
        </span>
      );
    case 'PASSED':
    case 'INSPECTION_PASSED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Đạt chuẩn
        </span>
      );
    case 'FAILED':
    case 'REJECTED':
    case 'INSPECTION_FAILED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Không đạt chuẩn
        </span>
      );
    case 'INSPECTING':
    case 'INSPECTION_IN_PROGRESS':
    case 'IN_PROGRESS':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Đang kiểm định
        </span>
      );
    case 'RECEIVED_AT_CENTER':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
          Đã nhận tại Hub
        </span>
      );
    case 'SHIPPING_TO_CENTER':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
          Đang giao đến Hub
        </span>
      );
    case 'WAITING_SELLER_APPROVAL':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          Chờ người bán duyệt
        </span>
      );
    case 'WAITING_BUYER_APPROVAL':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          Chờ người mua duyệt
        </span>
      );
    case 'WAITING_FEE_PAYMENT':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Chờ đóng phí
        </span>
      );
    case 'PAYMENT_EXPIRED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
          Hết hạn nộp phí
        </span>
      );
    case 'SCHEDULED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
          Đã lên lịch hẹn
        </span>
      );
    case 'CONFIRMED_PENDING_DISPATCH':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          Chờ điều phối
        </span>
      );
    case 'DELIVERING_TO_BUYER':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
          Đang giao người mua
        </span>
      );
    case 'RETURNING_TO_SELLER':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
          Đang hoàn trả
        </span>
      );
    case 'RETURNED_TO_SELLER':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Đã hoàn trả
        </span>
      );
    case 'DISPUTED':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
          Đang khiếu nại
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          Chờ xử lý
        </span>
      );
    default:
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
          {status || '—'}
        </span>
      );
  }
}

export const AdminInspectionFundsTab: React.FC<AdminInspectionFundsTabProps> = ({
  lang = 'vi',
  onOpenFundsAudit,
  onNavigateGovernance,
}) => {
  const [orders, setOrders] = useState<InspectionOrderDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fundFilter, setFundFilter] = useState<'ALL' | 'HELD_MONEY' | 'AWAITING_SETTLEMENT' | 'SETTLED'>('ALL');

  // Fetch inspection orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let backendList: InspectionOrderDto[] = [];
      try {
        const res = await inspectorService.getAllOrders(undefined, 0, 100);
        const extracted = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
        if (extracted && extracted.length > 0) {
          backendList = extracted;
        }
      } catch (err) {
        console.warn('Could not fetch from inspectorService.getAllOrders:', err);
      }

      // Helper to extract timestamp for sorting newest first
      const getOrderTimestamp = (ord: any): number => {
        const dateStr =
          ord.createdAt ||
          ord.orderDate ||
          ord.createdDate ||
          ord.sellerPaidAt ||
          ord.buyerPaidAt ||
          ord.feeSettledAt ||
          ord.updatedAt;

        if (dateStr) {
          const t = new Date(dateStr).getTime();
          if (!isNaN(t) && t > 0) return t;
        }

        return 0;
      };

      // Merge and deduplicate
      const seenIds = new Set<string>();
      const combined: InspectionOrderDto[] = [];

      backendList.forEach((item: any) => {
        if (!item || !item.id) return;
        const normalizedId = String(item.id).trim();
        if (seenIds.has(normalizedId)) return;

        // Check if item is inspection order
        const isInsp = Boolean(
          item.orderType === 'AT_CENTER' ||
          item.orderType === 'AT_HOME' ||
          item.hasInspectionService ||
          item.requiresInspection ||
          (item.inspectionFee && item.inspectionFee > 0) ||
          item.returnShippingReserveFee !== undefined ||
          item.sellerPaidAt ||
          item.buyerPaidAt
        );

        if (isInsp) {
          seenIds.add(normalizedId);
          combined.push({
            id: normalizedId,
            postId: item.postId || item.listing?.id || 'post_' + normalizedId.slice(0, 8),
            postTitle: item.postTitle || item.listing?.title || 'Thiết bị công nghệ kiểm định',
            postPrice: Number(item.postPrice || item.itemPriceVnd || 0),
            buyerName: item.buyerName || item.customerName || 'Người mua',
            sellerName: item.sellerName || 'Người bán',
            orderType: item.orderType || item.inspectionMethod || 'AT_CENTER',
            status: item.status || item.backendStatus || item.escrowStatus || 'WAITING_INSPECTION',
            inspectionFee: Number(item.inspectionFee || item.inspectionFeeVnd || 0),
            shippingFee: Number(item.shippingFee || item.shippingFeeVnd || 0),
            returnShippingReserveFee: Number(item.returnShippingReserveFee ?? 0),
            buyerCommitmentDeposit: Number(item.buyerCommitmentDeposit || 0),
            travelFee: Number(item.travelFee || item.travelFeeRoundTrip || 0),
            feePayer: item.feePayer || 'SELLER_PAYS',
            buyerFeePercent: item.buyerFeePercent,
            sellerFeeShare: Number(item.sellerFeeShare ?? 0),
            buyerFeeShare: Number(item.buyerFeeShare ?? 0),
            sellerPaidAt: item.sellerPaidAt || null,
            buyerPaidAt: item.buyerPaidAt || null,
            feeSettledAt: item.feeSettledAt || null,
            cashShippingSimulation: Boolean(item.cashShippingSimulation),
            linkedOrderId: item.linkedOrderId || null,
            createdAt: item.createdAt || item.orderDate || item.createdDate || item.sellerPaidAt || item.buyerPaidAt || null,
            updatedAt: item.updatedAt || null,
          });
        }
      });

      // Sort newest first
      combined.sort((a, b) => {
        const timeA = getOrderTimestamp(a);
        const timeB = getOrderTimestamp(b);
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      setOrders(combined);
    } catch (err: any) {
      console.error('Error loading inspection funds orders:', err);
      setError(err?.message || 'Không thể tải danh sách đơn kiểm định.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Derived Metrics
  const metrics = useMemo(() => {
    let totalHeldReserves = 0;
    let totalCollectedFunds = 0;
    let heldOrdersCount = 0;
    let awaitingSettlementCount = 0;
    let settledCount = 0;

    orders.forEach((ord) => {
      const isSettled = Boolean(ord.feeSettledAt);
      const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);
      const reserve = Number(ord.returnShippingReserveFee || 0);
      const collected = (ord.sellerPaidAt ? (ord.sellerFeeShare || 0) : 0) +
        (ord.buyerPaidAt ? (ord.buyerFeeShare || 0) : 0) +
        (ord.buyerCommitmentDeposit || 0);

      totalCollectedFunds += collected;

      if (isSettled) {
        settledCount++;
      } else {
        awaitingSettlementCount++;
        if (reserve > 0 && isPaid) {
          totalHeldReserves += reserve;
          heldOrdersCount++;
        }
      }
    });

    return {
      totalOrders: orders.length,
      heldOrdersCount,
      awaitingSettlementCount,
      settledCount,
      totalHeldReserves,
      totalCollectedFunds,
    };
  }, [orders]);

  // Filtered & Sorted Orders (Mới nhất lên trên)
  const filteredOrders = useMemo(() => {
    return orders
      .filter((ord) => {
        // Search match
        const query = searchQuery.trim().toLowerCase();
        const matchSearch =
          !query ||
          ord.id.toLowerCase().includes(query) ||
          ((ord as any).orderId || '').toLowerCase().includes(query) ||
          (ord.linkedOrderId || '').toLowerCase().includes(query) ||
          (ord.postTitle || '').toLowerCase().includes(query) ||
          (ord.buyerName || '').toLowerCase().includes(query) ||
          (ord.sellerName || '').toLowerCase().includes(query);

        if (!matchSearch) return false;

        // Status filter
        const isSettled = Boolean(ord.feeSettledAt);
        const isPaid = Boolean(ord.sellerPaidAt || ord.buyerPaidAt);

        if (fundFilter === 'HELD_MONEY') {
          return !isSettled && (ord.returnShippingReserveFee || 0) > 0 && isPaid;
        }
        if (fundFilter === 'AWAITING_SETTLEMENT') {
          return !isSettled && isPaid;
        }
        if (fundFilter === 'SETTLED') {
          return isSettled;
        }

        return true;
      })
      .sort((a, b) => {
        const getTs = (ord: any): number => {
          const s = ord.createdAt || ord.orderDate || ord.createdDate || ord.sellerPaidAt || ord.buyerPaidAt || ord.feeSettledAt || ord.updatedAt;
          if (s) {
            const t = new Date(s).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          return 0;
        };
        const timeA = getTs(a);
        const timeB = getTs(b);
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
  }, [orders, searchQuery, fundFilter]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. Header & Breadcrumb Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-600 text-white shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>ĐỐI SOÁT TIỀN KIỂM ĐỊNH</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Admin Funds Audit
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toàn bộ các đơn kiểm định đang giữ tiền phong tỏa, quỹ dự phòng cước hoàn và chờ quyết toán tài chính
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigateGovernance && (
            <button
              type="button"
              onClick={onNavigateGovernance}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Biểu phí</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Đơn đang giữ tiền */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Đơn Đang Giữ Tiền</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {metrics.heldOrdersCount} <span className="text-xs font-medium text-slate-500">đơn</span>
          </div>
          <p className="text-[11px] text-amber-800 font-medium">
            Có quỹ cước hoàn hoặc phí đang phong tỏa
          </p>
        </div>

        {/* Card 2: Quỹ cước hoàn đang giữ */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Quỹ Cước Hoàn Đang Giữ</span>
            <ArrowDownLeft className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black font-mono text-orange-600">
            {formatVND(metrics.totalHeldReserves)}
          </div>
          <p className="text-[11px] text-slate-500">
            Dự phòng trả cước Hub ➔ Seller nếu trả hàng
          </p>
        </div>

        {/* Card 3: Chờ quyết toán */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Chờ Quyết Toán Hub</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-700">
            {metrics.awaitingSettlementCount} <span className="text-xs font-medium text-slate-500">đơn</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Chưa chốt đối soát giải ngân cho Trung tâm
          </p>
        </div>

        {/* Card 4: Đã quyết toán xong */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Đã Quyết Toán Xong</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            {metrics.settledCount} <span className="text-xs font-medium text-slate-500">đơn</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Đã thanh toán cho Hub và hoàn tiền thừa
          </p>
        </div>
      </div>

      {/* 4. Orders Table Panel */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
              <span>Danh Sách Đơn Kiểm Định Đang Quản Lý Dòng Tiền</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {filteredOrders.length} đơn
              </span>

            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click vào nút <strong>"Đối Soát Tiền Kiểm Định"</strong> của bất kỳ đơn nào để xem toàn bộ luồng tiền, quỹ dự phòng và quyết toán
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter pills */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFundFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${fundFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Tất cả ({metrics.totalOrders})
              </button>
              <button
                type="button"
                onClick={() => setFundFilter('HELD_MONEY')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${fundFilter === 'HELD_MONEY'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-amber-800 hover:text-amber-950'
                  }`}
              >
                Đang giữ tiền ({metrics.heldOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setFundFilter('AWAITING_SETTLEMENT')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${fundFilter === 'AWAITING_SETTLEMENT'
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-blue-700 hover:text-blue-900'
                  }`}
              >
                Chờ quyết toán ({metrics.awaitingSettlementCount})
              </button>
              <button
                type="button"
                onClick={() => setFundFilter('SETTLED')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-[11px] ${fundFilter === 'SETTLED'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
                  }`}
              >
                Đã quyết toán ({metrics.settledCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn, tên máy, người..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-amber-600 w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold">{error}</p>
              <p className="text-[11px] text-rose-600 mt-0.5">Vui lòng kiểm tra lại kết nối hoặc quyền truy cập của Admin.</p>
            </div>
          </div>
        )}

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold min-w-[320px]">Mã Đơn &amp; Sản Phẩm</th>
                <th className="py-3 px-4 font-bold">Người Bán / Mua</th>
                <th className="py-3 px-4 font-bold text-right">Phí Đã Nộp</th>
                <th className="py-3 px-4 font-bold text-center">Trạng Thái Đơn</th>
                <th className="py-3 px-4 font-bold text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <p className="text-xs font-semibold">Không tìm thấy đơn kiểm định nào phù hợp bộ lọc.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isSellerPaid = Boolean(ord.sellerPaidAt);
                  const isBuyerPaid = Boolean(ord.buyerPaidAt);
                  const isPaid = isSellerPaid || isBuyerPaid;
                  const totalPaid = (isSellerPaid ? (ord.sellerFeeShare || 0) : 0) +
                    (isBuyerPaid ? (ord.buyerFeeShare || 0) : 0) +
                    (ord.buyerCommitmentDeposit || 0);

                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-amber-50/30 transition group"
                    >
                      {/* 1. Mã đơn & sản phẩm */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-amber-800 text-xs break-all select-all flex items-center gap-1.5 flex-wrap">
                          <span className="bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded border border-slate-200">
                            #{ord.id}
                          </span>
                        </div>
                        {ord.linkedOrderId && ord.linkedOrderId !== ord.id && (
                          <div className="text-[10px] font-mono text-slate-500 mt-1 break-all select-all flex items-center gap-1">
                            <span className="font-sans font-medium text-slate-400">Đơn mua:</span>
                            <span className="bg-slate-50 px-1 py-0.2 rounded border border-slate-200/80">#{ord.linkedOrderId}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          {ord.createdAt
                            ? new Date(ord.createdAt).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : ord.sellerPaidAt
                              ? new Date(ord.sellerPaidAt).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                              : '—'}
                        </div>
                        <div className="font-semibold text-slate-800 text-xs mt-1 break-words max-w-[420px] leading-snug" title={ord.postTitle}>
                          {ord.postTitle || 'Sản phẩm kiểm định'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${ord.orderType === 'AT_HOME'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                            }`}>
                            {ord.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Lab Hub'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Người bán / Mua */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="text-[11px] text-slate-700">
                          <span className="text-slate-400">Bán:</span> <strong>{ord.sellerName || '—'}</strong>
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5">
                          <span className="text-slate-400">Mua:</span> <strong>{ord.buyerName || '—'}</strong>
                        </div>
                      </td>

                      {/* 3. Phí Đã Nộp */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="font-bold font-mono text-slate-900">
                          {formatVND(totalPaid)}
                        </div>
                        <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                          {isPaid ? 'Đã thu phí' : 'Chưa nộp'}
                        </span>
                      </td>

                      {/* 4. Trạng thái đơn */}
                      <td className="py-3.5 px-4 align-top text-center">
                        {renderInspectionOrderStatus(ord.status)}
                      </td>

                      {/* 5. Hành Động */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <button
                          type="button"
                          onClick={() => onOpenFundsAudit(ord.id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer mx-auto"
                          title="Mở bảng đối soát dòng tiền chi tiết của đơn kiểm định này"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Đối Soát Tiền</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
