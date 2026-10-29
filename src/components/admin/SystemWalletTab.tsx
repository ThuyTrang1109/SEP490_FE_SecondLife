import React, { useState, useEffect, useCallback } from 'react';
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
  Info
} from 'lucide-react';
import {
  systemWalletService,
  orderService
} from '../../services';
import {
  SystemWalletData,
  SystemWalletTransaction,
  OrderSettlementDTO,
  OrderCommissionDTO
} from '../../types';
import { formatVND } from '../../utils/translations';

export const SystemWalletTab: React.FC = () => {
  const [wallet, setWallet] = useState<SystemWalletData | null>(null);
  const [transactions, setTransactions] = useState<SystemWalletTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Order Detail Modal (when clicking orderId)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [settlementData, setSettlementData] = useState<OrderSettlementDTO | null>(null);
  const [commissionData, setCommissionData] = useState<OrderCommissionDTO | null>(null);
  const [isLoadingOrderInfo, setIsLoadingOrderInfo] = useState(false);
  const [orderInfoError, setOrderInfoError] = useState<string | null>(null);

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

  const fetchTransactions = useCallback(async (page = 0) => {
    setIsLoadingHistory(true);
    try {
      const res = await systemWalletService.getTransactions(page, pageSize);
      setTransactions(res.items);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch (err: any) {
      console.error('Error fetching system transactions:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchWallet();
    fetchTransactions(0);
  }, [fetchWallet, fetchTransactions]);

  const handleRefreshAll = () => {
    fetchWallet();
    fetchTransactions(currentPage);
  };

  const handleOpenOrderDetail = async (orderId: string) => {
    if (!orderId) return;
    setSelectedOrderId(orderId);
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
        // If 404, not settled yet
        setSettlementData(null);
      }
    } catch (e: any) {
      setOrderInfoError(e?.message || 'Không thể tải thông tin quyết toán.');
    } finally {
      setIsLoadingOrderInfo(false);
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case 'OPENING_BALANCE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            Số dư đối chiếu ban đầu
          </span>
        );
      case 'PAYMENT_HOLD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            Nhận ký quỹ
          </span>
        );
      case 'SETTLEMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Giải ngân
          </span>
        );
      case 'REFUND':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            Hoàn tiền
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
            {type}
          </span>
        );
    }
  };

  const formatDelta = (val: number) => {
    if (val === 0) return <span className="text-slate-400 font-mono">0 đ</span>;
    if (val > 0) {
      return (
        <span className="text-emerald-700 font-mono font-bold flex items-center gap-0.5">
          <ArrowUpRight className="w-3 h-3 text-emerald-600 inline" />
          +{formatVND(val)}
        </span>
      );
    }
    return (
      <span className="text-rose-700 font-mono font-bold flex items-center gap-0.5">
        <ArrowDownLeft className="w-3 h-3 text-rose-600 inline" />
        {formatVND(val)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
              Ví Hệ Thống & Kế Toán Đối Soát (System Wallet)
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#24263e] text-white">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi dòng tiền ký quỹ Escrow, doanh thu hoa hồng sàn và cước phí vận chuyển Lalamove
          </p>
        </div>

        <div className="flex items-center gap-2">
          {wallet?.updatedAt && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Cập nhật: {new Date(wallet.updatedAt).toLocaleString('vi-VN')}</span>
            </span>
          )}

          <button
            onClick={handleRefreshAll}
            disabled={isLoading || isLoadingHistory}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu từ server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#c34c36] ${isLoading || isLoadingHistory ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 Main Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Tiền sản phẩm đang ký quỹ (heldBalance) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2 relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Tiền sản phẩm đang ký quỹ</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight font-mono">
            {wallet ? formatVND(wallet.heldBalance) : '---'}
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 leading-snug flex items-start gap-1">
            <Info className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
            <span>Bao gồm tiền HELD & FROZEN chưa thanh toán cho người bán hoặc hoàn tiền</span>
          </div>
        </div>

        {/* 2. Phí vận chuyển đã thu (shippingBalance) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2 relative overflow-hidden group hover:border-amber-400 transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Phí vận chuyển đã thu</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 tracking-tight font-mono">
            {wallet ? formatVND(wallet.shippingBalance) : '---'}
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 leading-snug flex items-start gap-1">
            <Info className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
            <span>Cước Lalamove đã thu từ người mua trừ phần hoàn (không phải hoa hồng)</span>
          </div>
        </div>

        {/* 3. Hoa hồng đã nhận (revenueBalance) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2 relative overflow-hidden group hover:border-emerald-400 transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Hoa hồng đã nhận (Doanh thu)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight font-mono">
            {wallet ? formatVND(wallet.revenueBalance) : '---'}
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 leading-snug flex items-start gap-1">
            <Info className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            <span>Lợi nhuận hoa hồng thực tế thu được từ các đơn hàng đã quyết toán xong</span>
          </div>
        </div>

        {/* 4. Tổng số dư ghi nhận (totalBalance) */}
        <div className="bg-gradient-to-br from-[#24263e] to-[#1a1b2d] text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-white/80 font-bold">
            <span>Tổng số dư ghi nhận</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-mono">
            {wallet ? formatVND(wallet.totalBalance) : '---'}
          </div>
          <div className="pt-1 border-t border-white/10 text-[10px] text-white/60 leading-snug flex items-start gap-1">
            <span className="font-semibold text-white/80">= Ký quỹ + Phí ship + Hoa hồng</span>
          </div>
        </div>
      </div>

      {/* Internal accounting note */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Lưu ý nghiệp vụ kế toán:</strong> Đây là ví đối soát nội bộ phục vụ dòng tiền đơn hàng và hoa hồng của hệ thống SecondLife. Hệ thống tự động ghi nhận theo các mốc BUYER thanh toán (PAYMENT_HOLD) và giải ngân quyết toán (SETTLEMENT). Không có thao tác nạp/rút thủ công trực tiếp từ màn hình này.
        </p>
      </div>

      {/* Transactions History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#faf8f5]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#c34c36]" />
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase">
              Lịch Sử Biến Động Số Dư ({totalElements} giao dịch)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Sắp xếp theo thời gian mới nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3.5">Mã GD</th>
                <th className="py-3 px-3.5">Mã Đơn Hàng (Order ID)</th>
                <th className="py-3 px-3.5">Phân Loại</th>
                <th className="py-3 px-3.5 text-right">Biến Động Ký Quỹ</th>
                <th className="py-3 px-3.5 text-right">Biến Động Phí Ship</th>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    Chưa có giao dịch nào được ghi nhận trong ví hệ thống.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
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
                          <span>{tx.orderId.slice(0, 8)}...{tx.orderId.slice(-4)}</span>
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">---</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {getTransactionTypeBadge(tx.type)}
                    </td>

                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {formatDelta(tx.heldDelta)}
                    </td>

                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {formatDelta(tx.shippingDelta)}
                    </td>

                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {formatDelta(tx.revenueDelta)}
                    </td>

                    <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      <div>Ký quỹ: <strong>{formatVND(tx.heldBalanceAfter)}</strong></div>
                      <div className="text-[10px] text-slate-400">Hoa hồng: {formatVND(tx.revenueBalanceAfter)}</div>
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Trang <strong>{currentPage + 1}</strong> / <strong>{totalPages}</strong> (Tổng <strong>{totalElements}</strong> mục)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchTransactions(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0 || isLoadingHistory}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchTransactions(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1 || isLoadingHistory}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Settlement & Commission Inspection Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 text-xs text-[#24263e] space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#c34c36] text-white flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Đối Soát Quyết Toán & Hoa Hồng Đơn
                  </h4>
                  <p className="font-mono text-[10px] text-slate-500">#{selectedOrderId}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {isLoadingOrderInfo ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c34c36]" />
                <p>Đang tải dữ liệu quyết toán từ server...</p>
              </div>
            ) : orderInfoError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                {orderInfoError}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Commission Snapshot Card */}
                <div className="p-3.5 bg-[#faf8f5] rounded-2xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800 border-b border-gray-200 pb-1.5">
                    <span>1. Snapshot Hoa Hồng Sàn</span>
                    {commissionData?.ruleCode && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                        Rule: {commissionData.ruleCode}
                      </span>
                    )}
                  </div>

                  {commissionData ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Giá tính hoa hồng:</span>
                        <strong className="text-slate-900 font-mono">{formatVND(commissionData.commissionBase || 0)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tỷ lệ hoa hồng:</span>
                        <strong className="text-slate-900 font-mono">{commissionData.ratePercent ?? 5}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Hoa hồng ước tính:</span>
                        <strong className="text-emerald-700 font-mono">{formatVND(commissionData.platformCommission || 0)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Trạng thái:</span>
                        <strong className="text-blue-700">{commissionData.status || 'ACTIVE'}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">Chưa có thông tin snapshot hoa hồng.</p>
                  )}
                </div>

                {/* Settlement Card */}
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200 pb-1.5">
                    <span>2. Quyết Toán Thực Tế (Settlement)</span>
                    {settlementData ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">
                        ĐÃ GIẢI NGÂN
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        CHƯA GIẢI NGÂN
                      </span>
                    )}
                  </div>

                  {settlementData ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between py-0.5 border-b border-emerald-100">
                        <span className="text-emerald-800">Giá sản phẩm (Cơ sở hoa hồng):</span>
                        <strong className="font-mono text-slate-900">{formatVND(settlementData.commissionBase)}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-emerald-100">
                        <span className="text-emerald-800">Hoa hồng sàn thực thu:</span>
                        <strong className="font-mono text-emerald-700">+{formatVND(settlementData.platformCommission)}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-emerald-100">
                        <span className="text-emerald-800">Người bán thực nhận (Seller Payout):</span>
                        <strong className="font-mono text-blue-800">{formatVND(settlementData.sellerPayout)}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-emerald-100">
                        <span className="text-emerald-800">Phí vận chuyển Lalamove:</span>
                        <strong className="font-mono text-slate-900">{formatVND(settlementData.shippingFee)}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 text-[10px] text-emerald-700 pt-1">
                        <span>Thời điểm giải ngân:</span>
                        <span className="font-mono">{new Date(settlementData.settledAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 text-slate-500 italic text-[11px]">
                      Đơn hàng đang ở trạng thái ký quỹ hoặc đang vận chuyển. Tiền sẽ được giải ngân vào ví người bán sau khi người mua xác nhận nhận hàng hoặc sau 48 giờ kể từ khi giao thành công.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end border-t border-gray-100">
              <button
                onClick={() => setSelectedOrderId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
