import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Building2,
  CreditCard,
  User,
  Calendar,
  Check,
  X,
  ArrowUpRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { walletService, WalletWithdrawalResponseDto } from '../../services/walletService';
import { formatVND } from '../../utils/translations';
import { Language } from '../../types';

interface WithdrawalsTabProps {
  lang?: Language;
  onNotice?: (msg: string) => void;
}

export const WithdrawalsTab: React.FC<WithdrawalsTabProps> = ({ lang = 'vi', onNotice }) => {
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawalResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Review modal state
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WalletWithdrawalResponseDto | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNote, setAdminNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await walletService.getAdminWithdrawals(statusFilter, 0, 100);
      setWithdrawals(res.items || []);
    } catch (err: any) {
      console.error('Failed to load admin withdrawals:', err);
      if (onNotice) {
        onNotice('Không thể tải danh sách rút tiền từ máy chủ.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [statusFilter]);

  // Filtered list by search term
  const filteredWithdrawals = useMemo(() => {
    let list = withdrawals;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (w) =>
          (w.userEmail && w.userEmail.toLowerCase().includes(term)) ||
          (w.accountNumber && w.accountNumber.toLowerCase().includes(term)) ||
          (w.accountHolderName && w.accountHolderName.toLowerCase().includes(term)) ||
          (w.bankCode && w.bankCode.toLowerCase().includes(term)) ||
          (w.id && w.id.toLowerCase().includes(term))
      );
    }
    return list;
  }, [withdrawals, searchTerm]);

  // Stats
  const pendingItems = useMemo(() => withdrawals.filter((w) => w.status === 'PENDING_REVIEW'), [withdrawals]);
  const approvedItems = useMemo(() => withdrawals.filter((w) => w.status === 'APPROVED'), [withdrawals]);
  const rejectedItems = useMemo(() => withdrawals.filter((w) => w.status === 'REJECTED'), [withdrawals]);

  const pendingAmount = useMemo(
    () => pendingItems.reduce((sum, w) => sum + (Number(w.amount) || 0), 0),
    [pendingItems]
  );

  const handleOpenReview = (item: WalletWithdrawalResponseDto, action: 'APPROVE' | 'REJECT') => {
    setSelectedWithdrawal(item);
    setReviewAction(action);
    setAdminNote(action === 'APPROVE' ? 'Đã giải ngân qua Internet Banking' : '');
    setActionError(null);
  };

  const handleConfirmReview = async () => {
    if (!selectedWithdrawal) return;

    if (reviewAction === 'REJECT' && !adminNote.trim()) {
      setActionError('Vui lòng nhập lý do từ chối yêu cầu rút tiền.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      await walletService.reviewWithdrawal(selectedWithdrawal.id, reviewAction, adminNote.trim());
      const msg =
        reviewAction === 'APPROVE'
          ? `Đã phê duyệt lệnh rút tiền ${formatVND(selectedWithdrawal.amount)} cho ${selectedWithdrawal.accountHolderName}.`
          : `Đã từ chối lệnh rút tiền của ${selectedWithdrawal.accountHolderName}.`;
      if (onNotice) onNotice(msg);
      setSelectedWithdrawal(null);
      await fetchWithdrawals();
    } catch (err: any) {
      console.error('Failed to review withdrawal:', err);
      setActionError(err?.message || 'Có lỗi xảy ra khi xử lý yêu cầu rút tiền.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#24263e] to-[#c34c36] text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5 text-[#fce5da]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {lang === 'vi' ? 'QUẢN LÝ & PHÊ DUYỆT RÚT TIỀN VÍ' : 'WALLET WITHDRAWAL REQUESTS'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Xem xét thông tin tài khoản ngân hàng, đối soát và phê duyệt lệnh rút tiền ví'
                  : 'Review user bank account details and approve/reject wallet withdrawal requests'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchWithdrawals}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chờ xử lý */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              {lang === 'vi' ? 'Đang Chờ Duyệt' : 'Pending Review'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-200/60 text-amber-900 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-2 font-mono">
            {pendingItems.length}
          </div>
          <div className="text-[11px] font-semibold text-amber-800/80 mt-1">
            Tổng tiền: <strong className="text-amber-950">{formatVND(pendingAmount)}</strong>
          </div>
        </div>

        {/* Card 2: Đã phê duyệt */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              {lang === 'vi' ? 'Đã Giải Ngân' : 'Approved'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-200/60 text-emerald-900 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2 font-mono">
            {approvedItems.length}
          </div>
          <div className="text-[11px] font-semibold text-emerald-800/80 mt-1">
            Lệnh rút tiền thành công
          </div>
        </div>

        {/* Card 3: Đã từ chối */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">
              {lang === 'vi' ? 'Đã Từ Chối' : 'Rejected'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-200/60 text-rose-900 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-950 mt-2 font-mono">
            {rejectedItems.length}
          </div>
          <div className="text-[11px] font-semibold text-rose-800/80 mt-1">
            Hủy do sai thông tin / rủi ro
          </div>
        </div>

        {/* Card 4: Tổng số lệnh */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              {lang === 'vi' ? 'Tổng Yêu Cầu' : 'Total Requests'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
            {withdrawals.length}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Giao dịch rút tiền toàn hệ thống
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'PENDING_REVIEW', label: `Chờ duyệt (${pendingItems.length})` },
            { id: 'APPROVED', label: `Đã duyệt (${approvedItems.length})` },
            { id: 'REJECTED', label: `Từ chối (${rejectedItems.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#24263e] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo email, tên, STK, ngân hàng..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#24263e]/20 focus:border-[#24263e]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#c34c36]" />
            <span className="text-xs font-semibold">Đang tải danh sách yêu cầu rút tiền...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Wallet className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-bold text-slate-600">Không tìm thấy yêu cầu rút tiền nào</span>
            <span className="text-[11px] text-slate-400">
              {searchTerm ? 'Thử tìm với từ khóa khác' : 'Chưa có yêu cầu rút tiền phù hợp với bộ lọc hiện tại'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Mã Lệnh / Ngày Tạo</th>
                  <th className="py-3 px-4">Khách Hàng (Email)</th>
                  <th className="py-3 px-4">Số Tiền Rút</th>
                  <th className="py-3 px-4">Tài Khoản Thụ Hưởng</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Ghi Chú Admin</th>
                  <th className="py-3 px-4 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.map((item) => {
                  const isPending = item.status === 'PENDING_REVIEW';
                  const isApproved = item.status === 'APPROVED';
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <span>#{item.id?.substring(0, 8)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.userEmail || 'Chưa có email'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {item.userId?.substring(0, 8)}...</div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-sm font-black text-[#c34c36] font-mono">
                          {formatVND(item.amount)}
                        </div>
                      </td>

                      {/* Bank Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.bankCode}</span>
                        </div>
                        <div className="font-mono text-slate-700 text-xs font-semibold">
                          STK: {item.accountNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Chủ TK: {item.accountHolderName}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ Duyệt</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã Giải Ngân</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Đã Từ Chối</span>
                          </span>
                        )}
                      </td>

                      {/* Admin Note */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-[11px] text-slate-600 truncate" title={item.adminNote || 'Chưa có ghi chú'}>
                          {item.adminNote || <span className="text-slate-300 italic">Không có</span>}
                        </div>
                        {item.reviewedAt && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Duyệt: {new Date(item.reviewedAt).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenReview(item, 'APPROVE')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Phê duyệt giải ngân"
                            >
                              <Check className="w-3 h-3" />
                              <span>Duyệt</span>
                            </button>
                            <button
                              onClick={() => handleOpenReview(item, 'REJECT')}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Từ chối yêu cầu"
                            >
                              <X className="w-3 h-3" />
                              <span>Từ chối</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Đã xong</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REVIEW / APPROVE / REJECT MODAL */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div
              className={`p-4 sm:p-5 flex items-center justify-between text-white ${
                reviewAction === 'APPROVE'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  : 'bg-gradient-to-r from-rose-600 to-red-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {reviewAction === 'APPROVE' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {reviewAction === 'APPROVE' ? 'Xác Nhận Phê Duyệt Rút Tiền' : 'Từ Chối Yêu Cầu Rút Tiền'}
                  </h3>
                  <p className="text-xs text-white/80">Lệnh #{selectedWithdrawal.id?.substring(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Payment Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Số tiền cần chuyển:</span>
                  <span className="text-base font-black text-[#c34c36] font-mono">
                    {formatVND(selectedWithdrawal.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Khách hàng:</span>
                  <span className="font-bold text-slate-800">{selectedWithdrawal.userEmail}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Ngân hàng thụ hưởng:</span>
                  <span className="font-bold text-slate-800 uppercase">{selectedWithdrawal.bankCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Số tài khoản:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {selectedWithdrawal.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Tên chủ tài khoản:</span>
                  <span className="font-extrabold text-slate-900 uppercase">
                    {selectedWithdrawal.accountHolderName}
                  </span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Admin Note Input */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  {reviewAction === 'APPROVE'
                    ? 'Ghi chú phê duyệt / Mã giao dịch ngân hàng:'
                    : 'Lý do từ chối rút tiền (Bắt buộc):'}
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder={
                    reviewAction === 'APPROVE'
                      ? 'Ví dụ: Đã chuyển khoản qua Vietcombank FT2610150912...'
                      : 'Ví dụ: Tên chủ tài khoản không khớp với hồ sơ CCCD, hoặc số tài khoản không hợp lệ...'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#24263e]/20 focus:border-[#24263e] text-xs font-medium"
                />
              </div>

              {reviewAction === 'REJECT' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Lưu ý: Khi từ chối, số tiền {formatVND(selectedWithdrawal.amount)} sẽ được tự động hoàn trả lại số dư ví cho người dùng.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmReview}
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{reviewAction === 'APPROVE' ? 'Xác Nhận Giải Ngân' : 'Xác Nhận Từ Chối'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
