import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Check,
  X,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  FileText,
  User,
  Clock,
  ExternalLink
} from 'lucide-react';
import { staffService } from '../../services/staffService';
import { SellerVerificationResponseDto, SellerVerificationStatus } from '../../services/sellerService';

interface StaffSellerVerificationTabProps {
  onNotify?: (message: string) => void;
}

export const StaffSellerVerificationTab: React.FC<StaffSellerVerificationTabProps> = ({ onNotify }) => {
  const [verifications, setVerifications] = useState<SellerVerificationResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('NEEDS_REVIEW');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected verification for review modal
  const [selectedVer, setSelectedVer] = useState<SellerVerificationResponseDto | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_RESUBMIT'>('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadVerifications();
  }, [statusFilter]);

  const loadVerifications = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await staffService.listVerifications({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        size: 50,
      });
      const items = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
      setVerifications(items);
    } catch (err: any) {
      console.warn('Load staff verifications error:', err);
      setVerifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReview = (ver: SellerVerificationResponseDto, decision: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMIT') => {
    setSelectedVer(ver);
    setReviewDecision(decision);
    setRejectionReason(
      decision === 'REQUEST_RESUBMIT'
        ? 'Ảnh chụp CCCD bị lóa sáng hoặc mờ góc thông tin. Vui lòng chụp lại rõ nét.'
        : decision === 'REJECT'
        ? 'Thông tin giấy tờ định danh không trùng khớp với hồ sơ đăng ký.'
        : ''
    );
  };

  const handleSubmitReview = async () => {
    if (!selectedVer) return;
    if (reviewDecision !== 'APPROVE' && !rejectionReason.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập lý do từ chối hoặc yêu cầu nộp lại' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await staffService.reviewVerification(selectedVer.id, {
        decision: reviewDecision,
        rejectionReason: rejectionReason.trim() || undefined,
      });

      const msg =
        reviewDecision === 'APPROVE'
          ? `Đã phê duyệt hồ sơ người bán #${selectedVer.id.slice(0, 8)} thành công!`
          : reviewDecision === 'REQUEST_RESUBMIT'
          ? `Đã gửi yêu cầu nộp lại hồ sơ cho người bán #${selectedVer.id.slice(0, 8)}!`
          : `Đã từ chối hồ sơ người bán #${selectedVer.id.slice(0, 8)}!`;

      setFeedback({ type: 'success', message: msg });
      if (onNotify) onNotify(msg);
      setSelectedVer(null);
      loadVerifications();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Thực hiện kiểm duyệt thất bại' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = verifications.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.id.toLowerCase().includes(term) ||
      (v.userFullName && v.userFullName.toLowerCase().includes(term)) ||
      (v.userEmail && v.userEmail.toLowerCase().includes(term)) ||
      (v.documentNumber && v.documentNumber.toLowerCase().includes(term)) ||
      (v.phone && v.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 font-bold">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Hàng Đợi Kiểm Duyệt Hồ Sơ Người Bán (Staff Verification Queue)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Kiểm tra đối soát tài liệu CCCD/eKYC của Người bán trước khi cấp quyền đăng tin kinh doanh
            </p>
          </div>
        </div>

        <button
          onClick={loadVerifications}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Global alert feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Tên, Email, SĐT, Số CCCD..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {(['NEEDS_REVIEW', 'SUBMITTED', 'APPROVED', 'RESUBMIT_REQUIRED', 'REJECTED', 'ALL'] as const).map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'NEEDS_REVIEW' && 'Cần duyệt (Needs Review)'}
                {st === 'SUBMITTED' && 'Mới gửi (Submitted)'}
                {st === 'APPROVED' && 'Đã duyệt'}
                {st === 'RESUBMIT_REQUIRED' && 'Cần nộp lại'}
                {st === 'REJECTED' && 'Đã từ chối'}
                {st === 'ALL' && 'Tất cả'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Verifications Table */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách hồ sơ...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
          <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Không có hồ sơ nào trong hàng đợi</p>
          <p className="text-xs text-slate-400 mt-1">Các hồ sơ eKYC cần duyệt thủ công sẽ xuất hiện tại đây</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Người Bán</th>
                  <th className="py-3 px-4">Giấy Tờ Định Danh</th>
                  <th className="py-3 px-4">Ảnh CCCD & Selfie</th>
                  <th className="py-3 px-4 text-center">Điểm eKYC</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((ver) => (
                  <tr key={ver.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{ver.userFullName || 'Chưa cập nhật'}</div>
                      <div className="text-[11px] text-slate-500">{ver.userEmail}</div>
                      {ver.phone && <div className="text-[11px] text-slate-500 font-mono">{ver.phone}</div>}
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-800">
                        {ver.verificationType}: {ver.documentNumberMasked || ver.documentNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {ver.submittedAt ? new Date(ver.submittedAt).toLocaleString('vi-VN') : '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {ver.documentFrontUrl && (
                          <a
                            href={ver.documentFrontUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-10 h-7 rounded border border-gray-200 overflow-hidden bg-slate-100 shrink-0 hover:scale-105 transition"
                            title="Xem ảnh mặt trước"
                          >
                            <img src={ver.documentFrontUrl} alt="CCCD Trước" className="w-full h-full object-cover" />
                          </a>
                        )}
                        {ver.documentBackUrl && (
                          <a
                            href={ver.documentBackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-10 h-7 rounded border border-gray-200 overflow-hidden bg-slate-100 shrink-0 hover:scale-105 transition"
                            title="Xem ảnh mặt sau"
                          >
                            <img src={ver.documentBackUrl} alt="CCCD Sau" className="w-full h-full object-cover" />
                          </a>
                        )}
                        {ver.selfieUrl && (
                          <a
                            href={ver.selfieUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-8 h-8 rounded-full border border-gray-200 overflow-hidden bg-slate-100 shrink-0 hover:scale-105 transition"
                            title="Xem ảnh selfie"
                          >
                            <img src={ver.selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-slate-800">
                        Match: <span className="text-indigo-600">{ver.faceMatchScore ? `${(ver.faceMatchScore * 100).toFixed(0)}%` : '—'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Liveness: {ver.livenessScore ? `${(ver.livenessScore * 100).toFixed(0)}%` : '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ver.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ver.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : ver.status === 'RESUBMIT_REQUIRED'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {ver.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {ver.status === 'NEEDS_REVIEW' || ver.status === 'SUBMITTED' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReview(ver, 'APPROVE')}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                            title="Phê duyệt hồ sơ"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReview(ver, 'REQUEST_RESUBMIT')}
                            className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 transition cursor-pointer"
                            title="Yêu cầu nộp lại"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReview(ver, 'REJECT')}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                            title="Từ chối hồ sơ"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold">Đã xử lý</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVIEW ACTION MODAL */}
      {selectedVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    reviewDecision === 'APPROVE'
                      ? 'bg-emerald-50 text-emerald-600'
                      : reviewDecision === 'REQUEST_RESUBMIT'
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {reviewDecision === 'APPROVE' ? (
                    <Check className="w-5 h-5" />
                  ) : reviewDecision === 'REQUEST_RESUBMIT' ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <X className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {reviewDecision === 'APPROVE'
                    ? 'Phê Duyệt Hồ Sơ Người Bán'
                    : reviewDecision === 'REQUEST_RESUBMIT'
                    ? 'Yêu Cầu Nộp Lại Hồ Sơ'
                    : 'Từ Chối Hồ Sơ Người Bán'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Người bán: <strong>{selectedVer.userFullName || selectedVer.userEmail}</strong> • CCCD: <strong>{selectedVer.documentNumber}</strong>
            </p>

            {/* Document preview row */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Mặt trước CCCD</span>
                {selectedVer.documentFrontUrl ? (
                  <img src={selectedVer.documentFrontUrl} alt="Trước" className="w-full h-20 object-cover rounded border" />
                ) : (
                  <div className="h-20 flex items-center justify-center bg-gray-100 text-slate-400 text-xs">Không có</div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Mặt sau CCCD</span>
                {selectedVer.documentBackUrl ? (
                  <img src={selectedVer.documentBackUrl} alt="Sau" className="w-full h-20 object-cover rounded border" />
                ) : (
                  <div className="h-20 flex items-center justify-center bg-gray-100 text-slate-400 text-xs">Không có</div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Ảnh Selfie</span>
                {selectedVer.selfieUrl ? (
                  <img src={selectedVer.selfieUrl} alt="Selfie" className="w-full h-20 object-cover rounded border" />
                ) : (
                  <div className="h-20 flex items-center justify-center bg-gray-100 text-slate-400 text-xs">Không có</div>
                )}
              </div>
            </div>

            {reviewDecision !== 'APPROVE' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Lý do {reviewDecision === 'REQUEST_RESUBMIT' ? 'yêu cầu nộp lại' : 'từ chối'} *:
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ghi rõ lý do để người bán hiểu và thực hiện lại..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedVer(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 ${
                  reviewDecision === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : reviewDecision === 'REQUEST_RESUBMIT'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {reviewDecision === 'APPROVE'
                    ? 'Xác Nhận Phê Duyệt'
                    : reviewDecision === 'REQUEST_RESUBMIT'
                    ? 'Gửi Yêu Cầu Nộp Lại'
                    : 'Xác Nhận Từ Chối'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
