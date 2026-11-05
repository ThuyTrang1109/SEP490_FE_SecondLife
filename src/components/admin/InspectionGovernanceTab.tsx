import React, { useState, useEffect } from 'react';
import {
  FileText,
  Navigation,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  Save,
  X,
  ShieldCheck,
  Check,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Language } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  inspectorService,
  InspectionFeeProposalResponse,
  InspectionTravelTierDto,
  InspectionFeeProposalStatus,
  canManageInspectionFee
} from '../../services/inspectorService';

interface InspectionGovernanceTabProps {
  lang: Language;
  currentUser?: any;
}

export const InspectionGovernanceTab: React.FC<InspectionGovernanceTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'proposals' | 'travel_tiers'>('proposals');

  // Permissions
  const hasFeeManagePermission = canManageInspectionFee(currentUser);

  // Proposals state
  const [proposals, setProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<'ALL' | InspectionFeeProposalStatus>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const pageSize = 10;

  // Selected Proposal for Details & Diff View
  const [viewingProposal, setViewingProposal] = useState<InspectionFeeProposalResponse | null>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<InspectionFeeProposalResponse | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Travel tiers state
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [isEditingTiers, setIsEditingTiers] = useState(false);
  const [editedTiers, setEditedTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierValidationError, setTierValidationError] = useState<string | null>(null);

  // Preview before saving tiers directly
  const [isPreviewSaveTiersOpen, setIsPreviewSaveTiersOpen] = useState(false);
  const [isSavingTiers, setIsSavingTiers] = useState(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    loadProposals(0, proposalStatusFilter);
    loadTravelTiers();
  }, []);

  const loadProposals = async (targetPage: number = 0, statusFilter: string = proposalStatusFilter) => {
    setIsLoadingProposals(true);
    try {
      const data = await inspectorService.getAdminFeeProposals(statusFilter, targetPage, pageSize);
      setProposals(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || 0);
      setPage(data.page || 0);
    } catch (err: any) {
      console.warn('Failed to load admin fee proposals:', err);
      setProposals([]);
    } finally {
      setIsLoadingProposals(false);
    }
  };

  const handleStatusFilterChange = (newStatus: 'ALL' | InspectionFeeProposalStatus) => {
    setProposalStatusFilter(newStatus);
    setPage(0);
    loadProposals(0, newStatus);
  };

  const loadTravelTiers = async () => {
    setIsLoadingTiers(true);
    try {
      const data = await inspectorService.getAdminTravelTiers();
      const tiers = Array.isArray(data) ? data : [];
      setTravelTiers(tiers);
      setEditedTiers(JSON.parse(JSON.stringify(tiers)));
    } catch (err: any) {
      console.warn('Failed to load travel tiers:', err);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const handleOpenReview = (proposal: InspectionFeeProposalResponse, action: 'APPROVE' | 'REJECT') => {
    setSelectedProposal(proposal);
    setReviewAction(action);
    setReviewNote('');
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedProposal) return;
    if (reviewAction === 'REJECT' && !reviewNote.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập lý do từ chối đề xuất để trung tâm kiểm định nắm rõ' });
      return;
    }

    setIsSubmittingReview(true);
    setFeedback(null);
    try {
      await inspectorService.reviewFeeProposal(selectedProposal.id, {
        approved: reviewAction === 'APPROVE',
        reason: reviewNote.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: reviewAction === 'APPROVE'
          ? 'Đã phê duyệt đề xuất biểu phí thành công! Bảng bậc cước di chuyển đã được tự động cập nhật.'
          : 'Đã từ chối đề xuất biểu phí thành công.'
      });

      setIsReviewModalOpen(false);
      setSelectedProposal(null);
      if (viewingProposal?.id === selectedProposal.id) {
        setViewingProposal(null);
      }
      // Reload both proposals and active travel tiers
      loadProposals(page, proposalStatusFilter);
      loadTravelTiers();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const errorMsg = err?.message || '';
      if (status === 409 || errorMsg.includes('409') || errorMsg.toLowerCase().includes('already been reviewed')) {
        setFeedback({
          type: 'warning',
          message: 'Đề xuất này đã được một quản trị viên khác xử lý trước đó. Đang làm mới dữ liệu...'
        });
        setIsReviewModalOpen(false);
        setSelectedProposal(null);
        if (viewingProposal?.id === selectedProposal?.id) setViewingProposal(null);
        loadProposals(page, proposalStatusFilter);
        loadTravelTiers();
      } else {
        setFeedback({ type: 'error', message: errorMsg || 'Xét duyệt đề xuất thất bại. Vui lòng thử lại.' });
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Direct Tier Editing handlers
  const handleTierChange = (index: number, field: keyof InspectionTravelTierDto, value: any) => {
    const updated = [...editedTiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTiers(updated);
    setTierValidationError(null);
  };

  const validateEditedTiers = (): string | null => {
    if (!editedTiers || editedTiers.length === 0) {
      return 'Danh sách bậc thang không được để trống';
    }

    for (let i = 0; i < editedTiers.length; i++) {
      const t = editedTiers[i];
      if (!t.name || !t.name.trim()) {
        return `Bậc #${t.tierNumber || i + 1}: Tên bậc không được để trống`;
      }
      const fromKm = Number(t.fromKm);
      if (isNaN(fromKm) || fromKm < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Khoảng cách từ (fromKm) phải là số không âm`;
      }
      if (t.toKm !== null && t.toKm !== undefined && String(t.toKm).trim() !== '') {
        const toKm = Number(t.toKm);
        if (isNaN(toKm) || toKm <= fromKm) {
          return `Bậc #${t.tierNumber || i + 1}: Khoảng cách đến (toKm = ${toKm}) phải lớn hơn khoảng cách từ (${fromKm} km)`;
        }
      }
      const price = Number(t.pricePerKm);
      if (isNaN(price) || price < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Đơn giá / km phải là số không âm`;
      }
    }

    return null;
  };

  const handleOpenPreviewSaveTiers = () => {
    const err = validateEditedTiers();
    if (err) {
      setTierValidationError(err);
      return;
    }
    setTierValidationError(null);
    setIsPreviewSaveTiersOpen(true);
  };

  const handleConfirmSaveTiers = async () => {
    setIsSavingTiers(true);
    setFeedback(null);
    try {
      const saved = await inspectorService.updateAdminTravelTiers(editedTiers);
      setTravelTiers(saved);
      setEditedTiers(JSON.parse(JSON.stringify(saved)));
      setIsEditingTiers(false);
      setIsPreviewSaveTiersOpen(false);
      setFeedback({
        type: 'success',
        message: 'Đã cập nhật trực tiếp bảng 6 bậc thang cước di chuyển KTV thành công!'
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Cập nhật bảng bậc thang thất bại' });
    } finally {
      setIsSavingTiers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Quản Trị Biểu Phí & Bậc Thang Kiểm Định
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Xét duyệt đề xuất từ Trung tâm kiểm định và kiểm soát bảng giá bậc thang di chuyển KTV toàn hệ thống
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('proposals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'proposals'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Đề Xuất Biểu Phí</span>
          </button>
          <button
            onClick={() => setActiveSubTab('travel_tiers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'travel_tiers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>6 Bậc Thang Di Chuyển</span>
          </button>
        </div>
      </div>

      {/* Permission alert if lacking INSPECTION_FEE_MANAGE */}
      {!hasFeeManagePermission && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý phân quyền:</strong> Tài khoản của bạn hiện ở chế độ chỉ đọc. Cần quyền{' '}
            <code className="font-mono px-1 py-0.5 rounded bg-amber-100 font-bold">INSPECTION_FEE_MANAGE</code> để phê
            duyệt đề xuất hoặc cập nhật biểu phí.
          </span>
        </div>
      )}

      {/* Global alert feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: ĐỀ XUẤT BIỂU PHÍ (PROPOSALS)                                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-4">
          {/* Filter Bar & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Lọc trạng thái:</span>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'PENDING_APPROVAL', label: 'Chờ duyệt (Pending)' },
                { key: 'APPROVED', label: 'Đã duyệt (Approved)' },
                { key: 'REJECTED', label: 'Đã từ chối (Rejected)' }
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => handleStatusFilterChange(st.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    proposalStatusFilter === st.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Tổng: {totalElements} đề xuất</span>
              <button
                onClick={() => loadProposals(page, proposalStatusFilter)}
                disabled={isLoadingProposals}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProposals ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Proposals List */}
          {isLoadingProposals ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề xuất biểu phí...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có đề xuất biểu phí nào</p>
              <p className="text-xs text-slate-400 mt-1">
                Các đề xuất điều chỉnh bảng giá từ Quản lý Trung tâm kiểm định sẽ hiển thị tại đây
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {proposals.map((proposal) => {
                const isPending = proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING';
                return (
                  <div
                    key={proposal.id}
                    className="p-5 rounded-3xl bg-white border border-gray-100 hover:border-amber-200 transition shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900">
                              Đề xuất biểu phí #{proposal.id.slice(0, 8)}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                proposal.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : proposal.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}
                            >
                              {proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING'
                                ? 'Chờ Duyệt'
                                : proposal.status === 'APPROVED'
                                ? 'Đã Phê Duyệt'
                                : 'Đã Từ Chối'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Gửi bởi: <strong className="text-slate-700">{proposal.proposedByName || proposal.proposedByEmail || 'TTKD'}</strong> •{' '}
                            Ngày gửi: {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN') : 'Mới đây'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <button
                          onClick={() => setViewingProposal(proposal)}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>So sánh bậc phí</span>
                        </button>

                        {isPending && hasFeeManagePermission && (
                          <>
                            <button
                              onClick={() => handleOpenReview(proposal, 'REJECT')}
                              className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              <span>Từ chối</span>
                            </button>
                            <button
                              onClick={() => handleOpenReview(proposal, 'APPROVE')}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <Check className="w-4 h-4" />
                              <span>Phê duyệt</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Proposal Quick Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block uppercase">Phí kiểm định cơ sở đề xuất</span>
                        <span className="text-base font-black text-[#c34c36]">
                          {formatVND(proposal.baseInspectionFee || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block uppercase">Danh mục áp dụng</span>
                        <span className="text-xs font-bold text-slate-800">
                          {proposal.categoryName || 'Tất cả danh mục sản phẩm'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block uppercase">Người xét duyệt</span>
                        <span className="text-xs font-bold text-slate-800">
                          {proposal.reviewedByName ? `${proposal.reviewedByName} (Đã xử lý)` : 'Chờ Admin xử lý'}
                        </span>
                        {proposal.rejectReason && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                            Lý do từ chối: {proposal.rejectReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Attached tiers preview */}
                    {proposal.tiers && proposal.tiers.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">
                            Các bậc cước di chuyển trong đề xuất ({proposal.tiers.length} bậc):
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          {proposal.tiers.map((t, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-gray-200 bg-white text-center">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                                {t.name || `Bậc ${t.tierNumber || idx + 1}`}
                              </span>
                              <span className="text-xs font-bold text-slate-700 block mt-0.5">
                                {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                              </span>
                              <span className="text-xs font-black text-[#c34c36] block mt-1">
                                {formatVND(t.pricePerKm || 0)}/km
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">
                Trang <strong>{page + 1}</strong> / {totalPages} ({totalElements} đề xuất)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadProposals(page - 1, proposalStatusFilter)}
                  disabled={page <= 0 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  onClick={() => loadProposals(page + 1, proposalStatusFilter)}
                  disabled={page >= totalPages - 1 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BẢNG 6 BẬC THANG DI CHUYỂN HIỆN HÀNH (TRAVEL TIERS)            */}
      {/* ===================================================================== */}
      {activeSubTab === 'travel_tiers' && (
        <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Bảng 6 Bậc Thang Cước Di Chuyển Kỹ Thuật Viên
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Công thức tính phí di chuyển thực tế khi kiểm định tận nhà (Gói AT_HOME) dựa trên khoảng cách km
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditingTiers ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditingTiers(false);
                      setEditedTiers(JSON.parse(JSON.stringify(travelTiers)));
                      setTierValidationError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    onClick={handleOpenPreviewSaveTiers}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Xem Lại & Lưu Mới</span>
                  </button>
                </>
              ) : (
                hasFeeManagePermission && (
                  <button
                    onClick={() => {
                      setIsEditingTiers(true);
                      setEditedTiers(JSON.parse(JSON.stringify(travelTiers)));
                      setTierValidationError(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh Sửa Trực Tiếp</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Policy Info Note */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Quy tắc vận hành bậc thang di chuyển</span>
            </div>
            <p>
              • Biểu phí gồm 6 bậc thang cố định áp dụng chung toàn quốc cho hình thức kiểm định tận nhà (AT_HOME).
            </p>
            <p>
              • Bậc cuối cùng được cấu hình với khoảng cách đến là <em>Không giới hạn (∞)</em> bằng cách để trống ô cự ly đến.
            </p>
            <p>
              • Phí vận chuyển hàng hóa về Trung tâm (Lab Hub) là khoản do đối tác giao vận (Lalamove) thực hiện, không quản trị tại bảng này.
            </p>
          </div>

          {/* Validation error message if any */}
          {tierValidationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{tierValidationError}</span>
            </div>
          )}

          {isLoadingTiers ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải bảng bậc thang...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Bậc thang</th>
                    <th className="py-3 px-4">Tên hiển thị</th>
                    <th className="py-3 px-4">Khoảng cách từ (km)</th>
                    <th className="py-3 px-4">Khoảng cách đến (km)</th>
                    <th className="py-3 px-4">Đơn giá / km (VND)</th>
                    <th className="py-3 px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(isEditingTiers ? editedTiers : travelTiers).map((tier, idx) => (
                    <tr key={tier.tierNumber || idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-black text-slate-900">
                        #{tier.tierNumber || idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="text"
                            value={tier.name || ''}
                            onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                            className="w-48 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{tier.name || `Bậc ${tier.tierNumber || idx + 1}`}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            value={tier.fromKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'fromKm', Number(e.target.value))}
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">{tier.fromKm ?? 0} km</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            value={tier.toKm ?? ''}
                            placeholder="Không giới hạn"
                            onChange={(e) =>
                              handleTierChange(idx, 'toKm', e.target.value.trim() !== '' ? Number(e.target.value) : null)
                            }
                            className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {tier.toKm != null ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={tier.pricePerKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'pricePerKm', Number(e.target.value))}
                            className="w-32 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-[#c34c36] focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-black text-[#c34c36]">{formatVND(tier.pricePerKm || 0)} / km</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tier.status || 'ACTIVE'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SO SÁNH BẬC PHÍ CHI TIẾT (SIDE-BY-SIDE DIFF VIEW)           */}
      {/* ===================================================================== */}
      {viewingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Chi Tiết & So Sánh Đề Xuất Biểu Phí #{viewingProposal.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đề xuất bởi {viewingProposal.proposedByName || viewingProposal.proposedByEmail} •{' '}
                    {viewingProposal.createdAt ? new Date(viewingProposal.createdAt).toLocaleString('vi-VN') : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingProposal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proposal Key Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Phí kiểm định cơ sở đề xuất</span>
                <span className="text-lg font-black text-[#c34c36]">
                  {formatVND(viewingProposal.baseInspectionFee || 0)}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Phí cơ sở áp dụng theo danh mục sản phẩm trong CSDL
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Danh mục áp dụng</span>
                <span className="text-xs font-bold text-slate-800">
                  {viewingProposal.categoryName || 'Tất cả danh mục sản phẩm'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Trạng thái</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase mt-1 ${
                    viewingProposal.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingProposal.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {viewingProposal.status === 'PENDING_APPROVAL' || viewingProposal.status === 'PENDING'
                    ? 'Chờ Duyệt'
                    : viewingProposal.status === 'APPROVED'
                    ? 'Đã Phê Duyệt'
                    : 'Đã Từ Chối'}
                </span>
                {viewingProposal.rejectReason && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Lý do từ chối: {viewingProposal.rejectReason}
                  </p>
                )}
              </div>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bảng so sánh cước bậc thang di chuyển (Hiện hành vs Đề xuất)
              </h4>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Bậc</th>
                      <th className="py-2.5 px-3">Tên bậc</th>
                      <th className="py-2.5 px-3">Cự ly hiện hành</th>
                      <th className="py-2.5 px-3">Cự ly đề xuất</th>
                      <th className="py-2.5 px-3">Đơn giá hiện hành</th>
                      <th className="py-2.5 px-3">Đơn giá đề xuất</th>
                      <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(viewingProposal.tiers || []).map((proposedTier, idx) => {
                      const activeTier = travelTiers.find((t) => t.tierNumber === proposedTier.tierNumber) || travelTiers[idx];
                      const oldPrice = activeTier?.pricePerKm ?? 0;
                      const newPrice = proposedTier.pricePerKm ?? 0;
                      const diff = newPrice - oldPrice;

                      const oldDist = activeTier
                        ? `${activeTier.fromKm ?? 0} - ${activeTier.toKm != null ? `${activeTier.toKm} km` : '∞'}`
                        : '—';
                      const newDist = `${proposedTier.fromKm ?? 0} - ${
                        proposedTier.toKm != null ? `${proposedTier.toKm} km` : '∞'
                      }`;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            #{proposedTier.tierNumber || idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {proposedTier.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">
                            {oldDist}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 font-mono">
                            {newDist}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">
                            {formatVND(oldPrice)}/km
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#c34c36] font-mono">
                            {formatVND(newPrice)}/km
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold font-mono">
                            {diff > 0 ? (
                              <span className="text-rose-600">+{formatVND(diff)}</span>
                            ) : diff < 0 ? (
                              <span className="text-blue-600">{formatVND(diff)}</span>
                            ) : (
                              <span className="text-slate-400">Không đổi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions if Pending */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                onClick={() => setViewingProposal(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
              >
                Đóng
              </button>

              {(viewingProposal.status === 'PENDING_APPROVAL' || viewingProposal.status === 'PENDING') && hasFeeManagePermission && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const p = viewingProposal;
                      setViewingProposal(null);
                      handleOpenReview(p, 'REJECT');
                    }}
                    className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Từ Chối Đề Xuất</span>
                  </button>
                  <button
                    onClick={() => {
                      const p = viewingProposal;
                      setViewingProposal(null);
                      handleOpenReview(p, 'APPROVE');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Phê Duyệt Đề Xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REVIEW PROPOSAL (APPROVE / REJECT DIALOG)                    */}
      {/* ===================================================================== */}
      {isReviewModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    reviewAction === 'APPROVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {reviewAction === 'APPROVE' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {reviewAction === 'APPROVE' ? 'Phê Duyệt Đề Xuất Biểu Phí' : 'Từ Chối Đề Xuất Biểu Phí'}
                </h3>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang thực hiện <strong>{reviewAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'}</strong> đề xuất biểu phí #
              <strong>{selectedProposal.id.slice(0, 8)}</strong> với mức phí cơ sở đề xuất:{' '}
              <strong className="text-[#c34c36]">{formatVND(selectedProposal.baseInspectionFee || 0)}</strong>.
            </p>

            {reviewAction === 'APPROVE' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                Khi phê duyệt, bảng 6 bậc thang cước di chuyển trên toàn hệ thống sẽ được tự động cập nhật theo các bậc trong đề xuất này.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Ghi chú / Ý kiến phản hồi {reviewAction === 'REJECT' && <span className="text-rose-500">* (Bắt buộc)</span>}:
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  reviewAction === 'APPROVE'
                    ? 'Nhập căn cứ phê duyệt (không bắt buộc)...'
                    : 'Nhập lý do từ chối để Trung tâm kiểm định nắm rõ và điều chỉnh lại...'
                }
                className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{reviewAction === 'APPROVE' ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: PREVIEW BEFORE DIRECT SAVING TIERS                          */}
      {/* ===================================================================== */}
      {isPreviewSaveTiersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Save className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Xem Lại Thay Đổi Bảng Bậc Thang Trước Khi Lưu
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewSaveTiersOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang cập nhật trực tiếp biểu phí bậc thang di chuyển. Hãy kiểm tra lại các mức cước mới dưới đây:
            </p>

            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 text-[11px] uppercase">
                    <th className="py-2.5 px-3">Bậc</th>
                    <th className="py-2.5 px-3">Tên bậc</th>
                    <th className="py-2.5 px-3">Khoảng cách</th>
                    <th className="py-2.5 px-3">Đơn giá mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editedTiers.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">#{t.tierNumber || idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{t.name}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                      </td>
                      <td className="py-2.5 px-3 font-black text-[#c34c36] font-mono">
                        {formatVND(t.pricePerKm || 0)} / km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPreviewSaveTiersOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
              >
                Quay Lại Sửa
              </button>
              <button
                onClick={handleConfirmSaveTiers}
                disabled={isSavingTiers}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingTiers && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác Nhận Lưu Vào Hệ Thống</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
