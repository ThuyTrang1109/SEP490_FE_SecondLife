import React, { useState, useEffect } from 'react';
import {
  FileText,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Edit2,
  Save,
  X,
  Layers,
  ChevronRight,
  TrendingUp,
  Sliders,
  DollarSign,
  ShieldCheck,
  Check,
  Building2,
  User
} from 'lucide-react';
import { Language } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  inspectorService,
  InspectionFeeProposalResponse,
  InspectionTravelTierDto
} from '../../services/inspectorService';

interface InspectionGovernanceTabProps {
  lang: Language;
}

export const InspectionGovernanceTab: React.FC<InspectionGovernanceTabProps> = ({ lang }) => {
  const [activeSubTab, setActiveSubTab] = useState<'proposals' | 'travel_tiers'>('proposals');

  // Proposals state
  const [proposals, setProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('ALL');
  const [selectedProposal, setSelectedProposal] = useState<InspectionFeeProposalResponse | null>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Travel tiers state
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [isEditingTiers, setIsEditingTiers] = useState(false);
  const [editedTiers, setEditedTiers] = useState<InspectionTravelTierDto[]>([]);
  const [isSavingTiers, setIsSavingTiers] = useState(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadProposals();
    loadTravelTiers();
  }, []);

  const loadProposals = async () => {
    setIsLoadingProposals(true);
    try {
      const data = await inspectorService.getAdminFeeProposals();
      setProposals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Failed to load admin fee proposals:', err);
    } finally {
      setIsLoadingProposals(false);
    }
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
      setFeedback({ type: 'error', message: 'Vui lòng nhập lý do từ chối đề xuất' });
      return;
    }

    setIsSubmittingReview(true);
    setFeedback(null);
    try {
      await inspectorService.reviewFeeProposal(selectedProposal.id, {
        approved: reviewAction === 'APPROVE',
        note: reviewNote.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: reviewAction === 'APPROVE'
          ? 'Đã phê duyệt đề xuất biểu phí thành công! Bảng bậc thang đã được cập nhật.'
          : 'Đã từ chối đề xuất biểu phí thành công.'
      });

      setIsReviewModalOpen(false);
      setSelectedProposal(null);
      loadProposals();
      loadTravelTiers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Xét duyệt đề xuất thất bại' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleTierChange = (index: number, field: keyof InspectionTravelTierDto, value: any) => {
    const updated = [...editedTiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTiers(updated);
  };

  const handleSaveTiers = async () => {
    setIsSavingTiers(true);
    setFeedback(null);
    try {
      const saved = await inspectorService.updateAdminTravelTiers(editedTiers);
      setTravelTiers(saved);
      setIsEditingTiers(false);
      setFeedback({ type: 'success', message: 'Đã cập nhật trực tiếp bảng 6 bậc thang di chuyển thành công!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Cập nhật bậc thang di chuyển thất bại' });
    } finally {
      setIsSavingTiers(false);
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (proposalStatusFilter === 'ALL') return true;
    return p.status === proposalStatusFilter;
  });

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
                Xét duyệt đề xuất từ Trung tâm kiểm định và kiểm soát bảng giá bậc thang di chuyển KTV
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
            <span>Đề Xuất Biểu Phí ({proposals.filter(p => p.status === 'PENDING').length} chờ duyệt)</span>
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

      {/* TAB 1: ĐỀ XUẤT BIỂU PHÍ (PROPOSALS) */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Lọc theo trạng thái:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setProposalStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    proposalStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' && 'Tất cả'}
                  {st === 'PENDING' && 'Chờ duyệt (Pending)'}
                  {st === 'APPROVED' && 'Đã duyệt (Approved)'}
                  {st === 'REJECTED' && 'Đã từ chối (Rejected)'}
                </button>
              ))}
            </div>

            <button
              onClick={loadProposals}
              disabled={isLoadingProposals}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProposals ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {/* Proposals List */}
          {isLoadingProposals ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề xuất biểu phí...</p>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có đề xuất biểu phí nào</p>
              <p className="text-xs text-slate-400 mt-1">
                Các đề xuất điều chỉnh bảng giá từ Trưởng Trung tâm kiểm định sẽ hiển thị tại đây
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredProposals.map((proposal) => {
                const isPending = proposal.status === 'PENDING';
                return (
                  <div
                    key={proposal.id}
                    className="p-5 rounded-3xl bg-white border border-gray-100 hover:border-amber-200 transition shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              Đề xuất điều chỉnh biểu phí #{proposal.id.slice(0, 8)}
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
                              {proposal.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Gửi bởi: <strong className="text-slate-700">{proposal.proposedByName || proposal.proposedByEmail || 'TTKD'}</strong> •{' '}
                            Ngày gửi: {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN') : 'Mới đây'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons for PENDING status */}
                      {isPending && (
                        <div className="flex items-center gap-2 self-end sm:self-auto">
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
                        </div>
                      )}
                    </div>

                    {/* Proposal Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block uppercase">Phí kiểm định cơ sở</span>
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
                          {proposal.reviewedByName ? `${proposal.reviewedByName} (Đã duyệt)` : 'Chờ Admin xử lý'}
                        </span>
                        {proposal.rejectReason && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                            Lý do từ chối: {proposal.rejectReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Attached tiers if any */}
                    {proposal.tiers && proposal.tiers.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-slate-700 block mb-2">
                          Chi tiết các bậc thang di chuyển trong đề xuất:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          {proposal.tiers.map((t, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-gray-200 bg-white text-center">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                                {t.name || `Bậc ${t.tierNumber || idx + 1}`}
                              </span>
                              <span className="text-xs font-bold text-slate-700 block mt-0.5">
                                {t.fromKm ?? 0} - {t.toKm ? `${t.toKm} km` : 'Trở lên'}
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
        </div>
      )}

      {/* TAB 2: BẢNG 6 BẬC THANG DI CHUYỂN HIỆN HÀNH (TRAVEL TIERS) */}
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
                    }}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    onClick={handleSaveTiers}
                    disabled={isSavingTiers}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {isSavingTiers ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Lưu Biểu Phí Mới</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditingTiers(true)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Chỉnh Sửa Trực Tiếp</span>
                </button>
              )}
            </div>
          </div>

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
                            className="w-36 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{tier.name || `Bậc ${tier.tierNumber || idx + 1}`}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            value={tier.fromKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'fromKm', Number(e.target.value))}
                            className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">{tier.fromKm ?? 0} km</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            value={tier.toKm ?? ''}
                            placeholder="Vô cực"
                            onChange={(e) =>
                              handleTierChange(idx, 'toKm', e.target.value ? Number(e.target.value) : undefined)
                            }
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {tier.toKm ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            step="1000"
                            value={tier.pricePerKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'pricePerKm', Number(e.target.value))}
                            className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-[#c34c36] focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-black text-[#c34c36]">{formatVND(tier.pricePerKm || 0)} / km</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tier.status || 'Đang áp dụng'}</span>
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

      {/* REVIEW PROPOSAL MODAL */}
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang thực hiện {reviewAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'} đề xuất biểu phí #
              <strong>{selectedProposal.id.slice(0, 8)}</strong> với mức phí cơ sở đề xuất:{' '}
              <strong className="text-[#c34c36]">{formatVND(selectedProposal.baseInspectionFee || 0)}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Ghi chú / Ý kiến phản hồi {reviewAction === 'REJECT' && <span className="text-rose-500">*</span>}:
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
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 ${
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
    </div>
  );
};
