import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  FileText,
  Package,
  Layers,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import {
  returnShippingFeeService,
  ReturnShippingFeeResponse,
  ReturnShippingFeeStatus,
  SellerReturnShippingDebtResponse
} from '../../services';
import { formatVND } from '../../utils/translations';

interface SellerReturnShippingFeesSectionProps {
  onOpenOrderModal?: (orderId: string) => void;
}

export const SellerReturnShippingFeesSection: React.FC<SellerReturnShippingFeesSectionProps> = ({
  onOpenOrderModal,
}) => {
  const [fees, setFees] = useState<ReturnShippingFeeResponse[]>([]);
  const [debt, setDebt] = useState<SellerReturnShippingDebtResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Fetch total debt
      try {
        const debtRes = await returnShippingFeeService.getMyReturnShippingDebt();
        setDebt(debtRes);
      } catch (err) {
        console.warn('Could not load seller debt:', err);
      }

      // 2. Fetch fee list
      const feeRes = await returnShippingFeeService.getMyReturnShippingFees({
        page: 0,
        size: 50,
        outstandingOnly,
      });
      setFees(feeRes.items || []);
    } catch (err: any) {
      console.error('[SellerReturnShippingFeesSection] Failed to load fees:', err);
      setError(err?.message || 'Không thể tải danh sách phí hoàn hàng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outstandingOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status: ReturnShippingFeeStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>ĐÃ THU ĐỦ PHÍ</span>
          </span>
        );
      case 'OUTSTANDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>CÒN NỢ CÔNG NỢ</span>
          </span>
        );
      case 'PENDING_FEE':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>CHỜ HÃNG CHỐT PHÍ</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Debt Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Outstanding Debt */}
        <div className="p-4 bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl border border-rose-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-rose-900">
              TỔNG CÔNG NỢ PHÍ HOÀN
            </span>
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 mt-2">
            {debt?.outstandingDebt != null ? formatVND(debt.outstandingDebt) : '0 đ'}
          </div>
          <p className="text-[11px] text-rose-800 mt-1">
            {debt?.outstandingDebt && debt.outstandingDebt > 0
              ? 'Số tiền còn nợ do số dư ví không đủ khấu trừ khi phát sinh đơn hoàn có lỗi.'
              : 'Tài khoản không có dư nợ phí hoàn hàng.'}
          </p>
        </div>

        {/* Total Assessments count */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            SỐ ĐƠN HOÀN PHÁT SINH
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {fees.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Các đơn hàng đổi trả có lỗi người bán đã được trọng tài quyết toán.
          </p>
        </div>

        {/* System Debt Policy Note */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="font-extrabold text-slate-800 flex items-center gap-1 text-[11px] uppercase">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Chính Sách Khấu Trừ Phí Hoàn</span>
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Phí hoàn hàng được trừ trực tiếp từ số dư khả dụng ví SecondLife của người bán. Ví không bị trừ âm; phần thiếu được ghi nhận vào công nợ.
            </p>
          </div>
          <span className="text-[10px] text-slate-400 italic">
            * Hệ thống chưa áp dụng thu nợ tự động hoặc thanh toán nợ thủ công.
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#c34c36]" />
            <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase">
              Lịch Sử Quyết Toán Phí Hoàn Hàng
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOutstandingOnly(!outstandingOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                outstandingOnly
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{outstandingOnly ? 'Đang lọc: Chỉ đơn còn nợ' : 'Lọc: Chỉ đơn còn nợ'}</span>
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Đang tải dữ liệu phí hoàn hàng...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-xs p-4">
            {error}
          </div>
        ) : fees.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-slate-600">Không có bản ghi phí hoàn hàng nào</p>
            <p className="text-[11px] text-slate-400">
              {outstandingOnly
                ? 'Không có khoản nợ phí hoàn hàng nào chưa thanh toán.'
                : 'Bạn chưa có phát sinh đơn hoàn hàng có lỗi nào.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 text-[11px] font-bold">
                  <th className="py-3 px-4">Thời Điểm</th>
                  <th className="py-3 px-4">Mã Đơn / Vận Đơn</th>
                  <th className="py-3 px-4 text-right">Tổng Cước Phí</th>
                  <th className="py-3 px-4 text-right">Đã Khấu Trừ</th>
                  <th className="py-3 px-4 text-right">Còn Nợ</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fees.map((f) => (
                  <tr key={f.shipmentId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                      <span className="block text-[10px] text-slate-400">
                        {new Date(f.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-800">
                        Đơn #{f.orderId.substring(0, 8)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        Shipment: #{f.shipmentId.substring(0, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                      {f.feeAmount != null ? formatVND(f.feeAmount) : 'Chờ xác nhận'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {f.collectedAmount != null ? formatVND(f.collectedAmount) : '0 đ'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700 whitespace-nowrap">
                      {f.debtAmount != null ? formatVND(f.debtAmount) : '0 đ'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(f.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
