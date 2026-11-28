import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Building2,
  Clock,
  Truck,
  Package,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { AdminInspectionOrderFundsDTO } from '../../types/adminInspectionFunds';
import { getAdminInspectionOrderFunds } from '../../services/adminInspectionFundsService';
import {
  resolveCollectionStatusLabel,
  getCollectionStatusBadgeStyle,
  resolveReturnReserveStatusLabel,
  getReturnReserveBadgeStyle,
  resolveShipmentStatusLabel,
  getShipmentStatusBadgeStyle,
  resolveShipmentLegLabel,
  resolveProviderStatusLabel,
  formatAuditDateTime,
  resolveReturnReserveDetails,
} from '../../utils/adminInspectionFunds';
import { formatVND } from '../../utils/translations';

export interface AdminInspectionFundsViewProps {
  inspectionOrderId: string | null;
  funds: AdminInspectionOrderFundsDTO | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onClose?: () => void;
}

export const AdminInspectionFundsView: React.FC<AdminInspectionFundsViewProps> = ({
  inspectionOrderId,
  funds,
  loading = false,
  error = null,
  onRefresh,
  onClose,
}) => {
  return (
    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-xs text-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="audit-funds-title" className="font-extrabold text-sm text-slate-900">
                Đối soát tiền kiểm định
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                Chỉ đọc
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Đơn kiểm định: {inspectionOrderId || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              disabled={loading || !inspectionOrderId}
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 transition flex items-center gap-1 font-bold text-xs disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Làm mới dữ liệu đối soát"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
              title="Đóng modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 overflow-y-auto space-y-5 flex-1">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold text-xs">{error}</p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                Vui lòng kiểm tra quyền hạn tài khoản hoặc liên hệ quản trị viên hệ thống.
              </p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !funds && (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <p className="text-xs font-medium">Đang tải dữ liệu đối soát tiền kiểm định...</p>
          </div>
        )}

        {funds && (
          <>
            {/* 1. KHU VỰC TỔNG QUAN (OVERVIEW) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                  Tổng quan thu phí & quyết toán
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Trạng thái thu:</span>
                  {(() => {
                    const badge = getCollectionStatusBadgeStyle(funds.collectionStatus);
                    return (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {resolveCollectionStatusLabel(funds.collectionStatus)}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Đã thu */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Đã thu</span>
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-lg font-black font-mono text-slate-900">
                    {formatVND(funds.totalCollected ?? 0)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Tổng tiền nền tảng đã nhận</span>
                </div>

                {/* Còn chờ xử lý */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Còn chờ xử lý</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-black font-mono text-amber-900">
                    {formatVND(funds.unsettledCollectedAmount ?? 0)}
                  </div>
                  <span className="text-[10px] text-amber-700 block">Đang giữ chờ đối soát & quyết toán</span>
                </div>

                {/* Hub đã nhận */}
                <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200 space-y-1">
                  <div className="flex items-center justify-between text-sky-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Hub đã nhận</span>
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  </div>
                  <div className="text-lg font-black font-mono text-sky-950">
                    {funds.settlement?.centerPayoutAmount != null
                      ? formatVND(funds.settlement.centerPayoutAmount)
                      : 'Chưa quyết toán'}
                  </div>
                  <span className="text-[10px] text-sky-700 block">
                    {funds.settlement?.centerPayoutAmount != null
                      ? 'Đã chi trả vào ví trung tâm'
                      : 'Chưa có khoản chi cho Hub'}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. THU THEO TỪNG BÊN (COLLECTION BREAKDOWN) */}
            <section className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                Thu theo từng bên
              </h4>
              {(() => {
                const buyer = funds.buyerPayment ?? (funds as any).buyer;
                const seller = funds.sellerPayment ?? (funds as any).seller;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Buyer */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="font-bold text-slate-900">Người mua</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {buyer?.paidAt
                            ? `Đã nộp: ${formatAuditDateTime(buyer.paidAt)}`
                            : 'Chưa nộp'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Phải nộp</span>
                          <span className="font-bold font-mono text-slate-700">
                            {buyer?.amountDue === 0
                              ? 'Không cần nộp'
                              : formatVND(buyer?.amountDue ?? 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Thực thu</span>
                          <span className="font-bold font-mono text-emerald-700">
                            {formatVND(buyer?.amountCollected ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Seller */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="font-bold text-slate-900">Người bán</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {seller?.paidAt
                            ? `Đã nộp: ${formatAuditDateTime(seller.paidAt)}`
                            : 'Chưa nộp'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Phải nộp</span>
                          <span className="font-bold font-mono text-slate-700">
                            {seller?.amountDue === 0
                              ? 'Không cần nộp'
                              : formatVND(seller?.amountDue ?? 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Thực thu</span>
                          <span className="font-bold font-mono text-emerald-700">
                            {formatVND(seller?.amountCollected ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* 3. CHI TIẾT PHÍ (FEE BREAKDOWN) */}
            {(() => {
              const fees = funds.fees ?? {
                inspectionFee: (funds as any).inspectionFee,
                travelFee: (funds as any).travelFee,
                shippingFee: (funds as any).shippingFee,
                cashShippingSimulation: (funds as any).cashShippingSimulation,
                outboundCashPendingAmount: (funds as any).outboundCashPendingAmount,
              };
              return (
                <section className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                    Chi tiết cấu thành phí
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Phí kiểm định cơ sở</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(fees?.inspectionFee ?? 0)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Phụ phí di chuyển KTV</span>
                      <span className="font-bold font-mono text-slate-900">
                        {fees?.travelFee != null ? formatVND(fees.travelFee) : '0 ₫'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Cước vận chuyển</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(fees?.shippingFee ?? 0)}
                      </span>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 4. DỰ PHÒNG CƯỚC TRẢ HÀNG - HIDE IF NOT_REQUIRED */}
            {funds.returnReserve && funds.returnReserve.status !== 'NOT_REQUIRED' && (() => {
              const reserveDetails = resolveReturnReserveDetails(funds);
              const {
                plannedAmount,
                heldAmount,
                actualReturnFee,
                hasActualReturnFee,
                returnShipmentCode,
                returnShipmentStatus,
                returnShipments,
                isInterruptedReturn,
                splitPlan,
                surplusAmount,
                buyerSurplusShare,
                sellerSurplusShare,
                refundAmountsRecorded,
                refundStatusLabel,
                refundStatusBadge,
                refundDescription,
              } = reserveDetails;

              const badge = getReturnReserveBadgeStyle(funds.returnReserve.status);

              return (
                <section className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-700" />
                      <h4 className="font-bold uppercase tracking-wider text-[11px] text-amber-900">
                        Dự phòng cước trả hàng
                      </h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {resolveReturnReserveStatusLabel(funds.returnReserve.status)}
                    </span>
                  </div>

                  {/* 4 Thẻ KPI: Kế hoạch, Cước hoàn thực tế, Phương án chia, Tiền dư sau cước */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-white border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-medium">Dự phòng kế hoạch</span>
                      <span className="font-bold font-mono text-slate-800 text-sm">
                        {formatVND(plannedAmount)}
                      </span>
                      <span className="text-[10px] text-amber-700 block mt-0.5">
                        Dự phòng đang giữ: <strong className="font-mono">{formatVND(heldAmount)}</strong>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-medium">Cước hoàn thực tế (Hub → Người bán)</span>
                      <span className="font-bold font-mono text-slate-900 text-sm">
                        {isInterruptedReturn
                          ? `${formatVND(actualReturnFee)} (Tạm tính)`
                          : hasActualReturnFee
                            ? formatVND(actualReturnFee)
                            : 'Chưa phát sinh (0 đ)'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {returnShipmentCode ? (
                          <span title={returnShipmentCode} className={isInterruptedReturn ? 'text-rose-600 font-semibold' : 'text-slate-700 font-medium'}>
                            Mã: <strong className="font-mono">{returnShipmentCode}</strong> {isInterruptedReturn ? '· Vận đơn thất bại (Chưa trừ)' : ''}
                          </span>
                        ) : (
                          <span>{returnShipmentStatus ? resolveShipmentStatusLabel(returnShipmentStatus) : 'Chưa tạo chuyến hoàn'}</span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-medium">Phương án chia tỉ lệ đơn</span>
                      <span className="text-[13px] text-slate-700 block mt-0.5 font-semibold">
                        Mua: {splitPlan.buyerPercent}% · Bán: {splitPlan.sellerPercent}%
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate" title={splitPlan.label}>
                        {splitPlan.label}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-emerald-800 block font-medium">Tiền dư sau trừ cước thực tế</span>
                      <span className="font-black font-mono text-emerald-800 text-sm">
                        {formatVND(surplusAmount)}
                      </span>
                      <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
                        {isInterruptedReturn ? 'Chưa trừ (Vận đơn hủy)' : hasActualReturnFee ? 'Đã trừ cước hoàn' : 'Dự kiến hoàn trả'}
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết từng vận đơn hoàn trả & cước phí vận chuyển kèm trạng thái */}
                  {returnShipments && returnShipments.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 pb-1 border-b border-amber-100/70">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-amber-700" />
                          Chi tiết vận đơn hoàn trả & cước phí:
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {returnShipments.length} kiện hoàn trả
                        </span>
                      </div>
                      <div className="divide-y divide-amber-100/60 rounded-md border border-amber-100 bg-amber-50/20 overflow-hidden">
                        {returnShipments.map((s, idx) => {
                          const isInterrupted = ['CANCELLED', 'CANCELED', 'FAILED', 'EXPIRED', 'REJECTED'].includes((s.status || '').toUpperCase());
                          const isDelivered = ['DELIVERED', 'COMPLETED'].includes((s.status || '').toUpperCase());
                          const statusBadge = getShipmentStatusBadgeStyle(s.status);

                          return (
                            <div key={s.shipmentId || idx} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 text-[11px]">
                                    {resolveShipmentLegLabel(s.leg)}
                                  </span>
                                  <span className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] select-all font-semibold">
                                    Mã VĐ: #{s.orderCode || s.shipmentId || 'Chưa có mã'}
                                  </span>
                                  {s.providerStatus && (
                                    <span className="text-[10px] text-slate-400">
                                      (NVC: {resolveProviderStatusLabel(s.providerStatus)})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                  <span>Trạng thái:</span>
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                                    {resolveShipmentStatusLabel(s.status)}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span className={isInterrupted ? 'text-amber-700 font-semibold' : isDelivered ? 'text-emerald-700 font-semibold' : 'text-sky-700'}>
                                    {isInterrupted ? 'Chưa trừ vào dự phòng (Vận đơn hủy/thất bại)' : isDelivered ? 'Đã cấn trừ vào quỹ dự phòng' : 'Đang tạm tính'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-left sm:text-right shrink-0">
                                <span className="text-[10px] text-slate-400 block">Cước vận chuyển</span>
                                <span className={`font-mono font-bold text-xs ${isInterrupted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                  {s.actualFee != null ? formatVND(s.actualFee) : 'Chưa có cước'}
                                </span>
                                {isInterrupted && (
                                  <span className="block text-[9px] text-amber-700 font-semibold">
                                    (0 ₫ thực trừ)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bù trừ & Công nợ cước hoàn vượt dự phòng */}
                  {funds.returnFee && (() => {
                    const rf = funds.returnFee;
                    const actualSettled = rf.actualFee != null;
                    const totalOutstanding = rf.buyer.outstanding + rf.seller.outstanding;
                    return (
                      <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 space-y-2 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-amber-100/70 text-[11px]">
                          <span className="font-bold text-slate-800">Đối soát bù cước chiều về (Buyer / Seller):</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actualSettled
                            ? totalOutstanding > 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}>
                            {actualSettled
                              ? totalOutstanding > 0
                                ? `Đã chốt cước thực tế · Còn phải thu ${formatVND(totalOutstanding)}`
                                : 'Đã chốt cước thực tế · Đã thu đủ'
                              : rf.quotedFee != null
                                ? `Chưa chốt cước thực tế · Tạm tính theo báo giá (${formatVND(rf.quotedFee)})`
                                : 'Chưa chốt cước thực tế'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-md bg-slate-50 border border-slate-100 space-y-0.5">
                            <div className="font-bold text-slate-800 text-[11px]">Người mua ({rf.buyer.percent}%)</div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Đã thu thêm:</span>
                              <strong className="font-mono text-emerald-700">{formatVND(rf.buyer.collected)}</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Còn phải thu:</span>
                              <strong className={`font-mono ${rf.buyer.outstanding > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                {formatVND(rf.buyer.outstanding)}
                              </strong>
                            </div>
                          </div>
                          <div className="p-2 rounded-md bg-slate-50 border border-slate-100 space-y-0.5">
                            <div className="font-bold text-slate-800 text-[11px]">Người bán ({rf.seller.percent}%)</div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Đã thu thêm:</span>
                              <strong className="font-mono text-emerald-700">{formatVND(rf.seller.collected)}</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Còn phải thu:</span>
                              <strong className={`font-mono ${rf.seller.outstanding > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                {formatVND(rf.seller.outstanding)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Phân bổ & Trạng thái hoàn trả tiền dư vào ví (Không lặp lại nội dung) */}
                  <div className="p-2.5 rounded-lg bg-white/95 border border-amber-200/80 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-amber-100/70 flex-wrap gap-1">
                      <span className="font-bold text-slate-800">
                        {refundAmountsRecorded
                          ? 'Tiền dư đã hoàn vào ví theo hạch toán:'
                          : 'Phân bổ tiền dư dự kiến theo tỉ lệ chia của đơn:'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Tổng tiền dư: <strong className="text-slate-900 font-bold">{formatVND(surplusAmount)}</strong>
                      </span>
                    </div>

                    {/* Thẻ tiền hoàn Người mua & Người bán */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">
                          {refundAmountsRecorded ? 'Đã hoàn Người mua:' : `Hoàn Người mua (${splitPlan.buyerPercent}%):`}
                        </span>
                        <strong className="font-mono text-emerald-700 text-xs">{formatVND(buyerSurplusShare)}</strong>
                      </div>
                      <div className="p-2 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">
                          {refundAmountsRecorded ? 'Đã hoàn Người bán:' : `Hoàn Người bán (${splitPlan.sellerPercent}%):`}
                        </span>
                        <strong className="font-mono text-emerald-700 text-xs">{formatVND(sellerSurplusShare)}</strong>
                      </div>
                    </div>

                    {/* Trạng thái hoàn trả tiền dư & diễn giải súc tích */}
                    <div className="pt-1 border-t border-amber-100/60 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-800">Trạng thái hoàn trả tiền dư:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${refundStatusBadge.bg} ${refundStatusBadge.text} ${refundStatusBadge.border}`}>
                          {refundStatusLabel}
                        </span>
                      </div>
                      {refundDescription && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {refundDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-amber-800 italic">
                    * Lưu ý: Khoản dự phòng đang giữ đã được cộng gộp trong số tiền Còn chờ xử lý ở phần Tổng quan.
                  </p>
                </section>
              );
            })()}

            {/* 5. QUYẾT TOÁN (SETTLEMENT) */}
            <section className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                  Quyết toán tài chính đơn hàng
                </h4>
                {funds.settlement?.settledAt ? (
                  <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Thời điểm: {formatAuditDateTime(funds.settlement.settledAt)}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Chưa ghi nhận quyết toán</span>
                )}
              </div>

              {funds.settlement ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Tiền trả Hub</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(funds.settlement.centerPayoutAmount ?? 0)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Hoàn người mua</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(funds.settlement.buyerRefundAmount ?? 0)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Hoàn người bán</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(funds.settlement.sellerRefundAmount ?? 0)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Nền tảng giữ lại</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatVND(funds.settlement.platformRetainedAmount ?? 0)}
                      </span>
                    </div>
                  </div>

                  {funds.settlement.sellerCompensationAmount != null &&
                    funds.settlement.sellerCompensationAmount > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between">
                        <span>Bồi thường người bán:</span>
                        <strong className="font-mono text-emerald-900">
                          {formatVND(funds.settlement.sellerCompensationAmount)}
                        </strong>
                      </div>
                    )}

                  <p className="text-[10px] text-slate-400 italic">
                    * Các khoản hoàn trong quyết toán là tổng theo từng bên, có thể gồm nhiều khoản ngoài dự phòng cước hoàn.
                  </p>
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg">
                  Đơn hàng chưa đến bước quyết toán hoặc chưa phát sinh quyết toán cuối cùng.
                </div>
              )}
            </section>

            {/* 6. VẬN ĐƠN (SHIPMENTS) */}
            <section className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                Danh sách kiện hàng & cước vận chuyển ({funds.shipments?.length ?? 0})
              </h4>

              {funds.shipments && funds.shipments.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="p-2.5">Chặng vận chuyển</th>
                        <th className="p-2.5">Mã vận đơn / Đơn vị giao</th>
                        <th className="p-2.5">Trạng thái kiện</th>
                        <th className="p-2.5 text-right">Cước thực tế</th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {funds.shipments.map((s, idx) => {
                        const statusBadge = getShipmentStatusBadgeStyle(s.status);
                        const isCash =
                          s.cashPaidAmount != null ||
                          s.cashReimbursedAmount != null ||
                          s.cashConfirmedAt != null;

                        return (
                          <tr key={s.shipmentId || idx} className="hover:bg-slate-50/60 transition">
                            <td className="p-2.5">
                              <span className="font-bold text-slate-900">
                                {resolveShipmentLegLabel(s.leg)}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="font-mono text-slate-700">
                                {s.orderCode || 'Chưa có mã'}
                              </span>
                              {s.providerStatus && (
                                <span className="block text-[10px] text-slate-400">
                                  NVC: {resolveProviderStatusLabel(s.providerStatus)}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                              >
                                {resolveShipmentStatusLabel(s.status)}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {s.actualFee != null
                                ? formatVND(s.actualFee)
                                : 'Chưa có cước thực tế'}
                            </td>
                            <td className="p-2.5 text-[11px]">
                              {isCash ? (
                                <div className="space-y-0.5 text-slate-600">
                                  <div>
                                    Đã ứng:{' '}
                                    <strong className="font-mono text-slate-800">
                                      {s.cashPaidAmount != null
                                        ? formatVND(s.cashPaidAmount)
                                        : '—'}
                                    </strong>
                                  </div>
                                  <div>
                                    Đã hoàn ứng:{' '}
                                    <strong className="font-mono text-emerald-700">
                                      {s.cashReimbursedAmount != null
                                        ? formatVND(s.cashReimbursedAmount)
                                        : '—'}
                                    </strong>
                                  </div>
                                  {s.cashConfirmedAt && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      Xác nhận: {formatAuditDateTime(s.cashConfirmedAt)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-center text-slate-400 text-xs italic">
                  Chưa có thông tin vận đơn cho đơn kiểm định này.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
        <span className="text-[11px] text-slate-400">
          Dữ liệu đối soát tài chính theo thời gian thực từ SecondLife Admin Gateway.
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        )}
      </div>
    </div>
  );
};

interface AdminInspectionFundsModalProps {
  inspectionOrderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminInspectionFundsModal: React.FC<AdminInspectionFundsModalProps> = ({
  inspectionOrderId,
  isOpen,
  onClose,
}) => {
  const [funds, setFunds] = useState<AdminInspectionOrderFundsDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeReqId = useRef<string | null>(null);

  const fetchFunds = useCallback(async (id: string) => {
    activeReqId.current = id;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminInspectionOrderFunds(id);
      if (activeReqId.current === id) {
        setFunds(data);
      }
    } catch (err: any) {
      if (activeReqId.current === id) {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu đối soát');
      }
    } finally {
      if (activeReqId.current === id) {
        setLoading(false);
      }
    }
  }, []);

  // When opening or changing order, clear old data first before loading new order
  useEffect(() => {
    if (isOpen && inspectionOrderId) {
      setFunds(null);
      setError(null);
      void fetchFunds(inspectionOrderId);
    } else {
      setFunds(null);
      setError(null);
      activeReqId.current = null;
    }
  }, [isOpen, inspectionOrderId, fetchFunds]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-funds-title"
    >
      <AdminInspectionFundsView
        inspectionOrderId={inspectionOrderId}
        funds={funds}
        loading={loading}
        error={error}
        onRefresh={() => inspectionOrderId && fetchFunds(inspectionOrderId)}
        onClose={onClose}
      />
    </div>
  );
};
