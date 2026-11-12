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
  formatAuditDateTime,
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
                Đối Soát Tiền Kiểm Định
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
                  Tổng Quan Thu Phí & Quyết Toán
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
                Thu Theo Từng Bên (Buyer / Seller)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Buyer */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-900">Người mua (Buyer)</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {funds.buyerPayment?.paidAt
                        ? `Đã nộp: ${formatAuditDateTime(funds.buyerPayment.paidAt)}`
                        : 'Chưa nộp'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Phải nộp</span>
                      <span className="font-bold font-mono text-slate-700">
                        {funds.buyerPayment?.amountDue === 0
                          ? 'Không cần nộp'
                          : formatVND(funds.buyerPayment?.amountDue ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Thực thu</span>
                      <span className="font-bold font-mono text-emerald-700">
                        {formatVND(funds.buyerPayment?.amountCollected ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seller */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-900">Người bán (Seller)</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {funds.sellerPayment?.paidAt
                        ? `Đã nộp: ${formatAuditDateTime(funds.sellerPayment.paidAt)}`
                        : 'Chưa nộp'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Phải nộp</span>
                      <span className="font-bold font-mono text-slate-700">
                        {funds.sellerPayment?.amountDue === 0
                          ? 'Không cần nộp'
                          : formatVND(funds.sellerPayment?.amountDue ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Thực thu</span>
                      <span className="font-bold font-mono text-emerald-700">
                        {formatVND(funds.sellerPayment?.amountCollected ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. CHI TIẾT PHÍ (FEE BREAKDOWN) */}
            <section className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
              <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                Chi Tiết Cấu Thành Phí
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Phí kiểm định cơ sở</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatVND(funds.fees?.inspectionFee ?? 0)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Phụ phí di chuyển KTV</span>
                  <span className="font-bold font-mono text-slate-900">
                    {funds.fees?.travelFee != null ? formatVND(funds.fees.travelFee) : '0 ₫'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Cước vận chuyển</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatVND(funds.fees?.shippingFee ?? 0)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Cọc cam kết người mua</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatVND(funds.fees?.buyerCommitmentDeposit ?? 0)}
                  </span>
                </div>
              </div>

              {/* Cash Simulation Notes */}
              {funds.fees?.cashShippingSimulation && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    <strong>Mô phỏng Sandbox:</strong> Cước chặng đi có phần ứng tiền mặt.
                    {funds.fees.outboundCashPendingAmount != null && funds.fees.outboundCashPendingAmount > 0 && (
                      <span>
                        {' '}Cước đi đã thu đang chờ hoàn ứng hoặc hoàn tiền:{' '}
                        <strong className="font-mono text-amber-950">
                          {formatVND(funds.fees.outboundCashPendingAmount)}
                        </strong>.
                      </span>
                    )}
                  </span>
                </div>
              )}
            </section>

            {/* 4. DỰ PHÒNG CƯỚC HOÀN (RETURN RESERVE) - HIDE IF NOT_REQUIRED */}
            {funds.returnReserve && funds.returnReserve.status !== 'NOT_REQUIRED' && (
              <section className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-700" />
                    <h4 className="font-bold uppercase tracking-wider text-[11px] text-amber-900">
                      Dự Phòng Cước Trả Hàng (Return Reserve)
                    </h4>
                  </div>
                  {(() => {
                    const badge = getReturnReserveBadgeStyle(funds.returnReserve.status);
                    return (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {resolveReturnReserveStatusLabel(funds.returnReserve.status)}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block">Dự phòng kế hoạch</span>
                    <span className="font-bold font-mono text-slate-800">
                      {formatVND(funds.returnReserve.plannedAmount ?? 0)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block">Dự phòng đang giữ</span>
                    <span className="font-black font-mono text-amber-800">
                      {formatVND(funds.returnReserve.heldAmount ?? 0)}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-amber-800 italic">
                  * Lưu ý: Khoản dự phòng đang giữ đã được cộng gộp trong số tiền Còn chờ xử lý ở phần Tổng quan.
                </p>
              </section>
            )}

            {/* 5. QUYẾT TOÁN (SETTLEMENT) */}
            <section className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                  Quyết Toán Tài Chính Đơn Hàng (Settlement)
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
                        <span>Bồi thường người bán (Seller Compensation):</span>
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
                Danh Sách Kiện Hàng & Cước Vận Chuyển ({funds.shipments?.length ?? 0})
              </h4>

              {funds.shipments && funds.shipments.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="p-2.5">Chặng vận chuyển</th>
                        <th className="p-2.5">Mã Lalamove / Đơn</th>
                        <th className="p-2.5">Trạng thái kiện</th>
                        <th className="p-2.5 text-right">Cước thực tế</th>
                        <th className="p-2.5">Chi tiết tiền mặt (Sandbox)</th>
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
                                  NVC: {s.providerStatus}
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
