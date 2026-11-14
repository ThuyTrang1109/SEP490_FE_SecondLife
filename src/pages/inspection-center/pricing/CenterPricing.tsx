import {
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Loader2,
  Eye,
  Navigation,
  Sliders,
  Plus,
  Edit3,
  Info,
  CheckSquare,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { canManageInspectionFee } from '../../../services';
import { Language, UserProfile, InspectionComplexityLevel } from '../../../types';
import { dialogService } from '../../../utils/dialogService';
import { formatVND } from '../../../utils/translations';
import type { useCenterCatalog } from '../checklists/useCenterCatalog';
import type { useCenterChecklists } from '../checklists/useCenterChecklists';
import type { useCenterPricing } from './useCenterPricing';

interface Props {
  currentUser: UserProfile | null | undefined;
  isLoadingCategories: ReturnType<typeof useCenterCatalog>['isLoadingCategories'];
  lang: Language;
  checklist: Pick<ReturnType<typeof useCenterChecklists>,
    | 'approvedItemsByLevel'
    | 'handleOpenCreateChecklistForItem'
    | 'handleOpenCreateModal'
    | 'isLoadingChecklists'
    | 'unclassifiedItems'
  >;
  pricing: Pick<ReturnType<typeof useCenterPricing>,
    | 'currentLevelFees'
    | 'getPendingProposalForLevel'
    | 'handleOpenProposeModal'
    | 'handlePricingFilterChange'
    | 'isLevelFeeApproved'
    | 'isLoadingPricing'
    | 'loadPricing'
    | 'pricingProposalFilter'
    | 'pricingProposalPage'
    | 'pricingProposalTotalElements'
    | 'pricingProposalTotalPages'
    | 'setIsProposeLevelFeeModalOpen'
    | 'setProposingLevel'
    | 'setProposingLevelFeeAmount'
    | 'setProposingLevelFeeError'
    | 'setSelectedProposalDetail'
    | 'tierProposals'
    | 'travelTiers'
  >;
}

export function CenterPricing({ currentUser, isLoadingCategories, lang, checklist, pricing }: Props) {
  const { approvedItemsByLevel, handleOpenCreateChecklistForItem, handleOpenCreateModal, isLoadingChecklists, unclassifiedItems } = checklist;
  const {
    currentLevelFees,
    getPendingProposalForLevel,
    handleOpenProposeModal,
    handlePricingFilterChange,
    isLevelFeeApproved,
    isLoadingPricing,
    loadPricing,
    pricingProposalFilter,
    pricingProposalPage,
    pricingProposalTotalElements,
    pricingProposalTotalPages,
    setIsProposeLevelFeeModalOpen,
    setProposingLevel,
    setProposingLevelFeeAmount,
    setProposingLevelFeeError,
    setSelectedProposalDetail,
    tierProposals,
    travelTiers,
  } = pricing;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#c34c36]" />
            <span>Biểu Phí Kiểm Định & Bậc Cước Di Chuyển KTV</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Biểu phí bậc thang phụ phí di chuyển theo khoảng cách km (gói kiểm định tận nhà AT_HOME) và danh sách đề xuất gửi Admin sàn
          </p>
        </div>
        {canManageInspectionFee(currentUser) && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                const availableLevel = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find(
                  lvl => !getPendingProposalForLevel(lvl)
                );
                if (!availableLevel) {
                  dialogService.warning(
                    lang === 'vi'
                      ? 'Tất cả 4 cấp độ (L1–L4) đều đã có đề xuất biểu phí đang chờ Admin phê duyệt. Không thể gửi thêm để tránh trùng lặp.'
                      : 'All 4 levels already have pending proposals awaiting approval.'
                  );
                  return;
                }
                setProposingLevel(availableLevel);
                const approved = currentLevelFees.find(f => f.complexityLevel === availableLevel);
                setProposingLevelFeeAmount(approved?.baseInspectionFee || 100000);
                setProposingLevelFeeError(null);
                setIsProposeLevelFeeModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Đề Xuất Giá 4 Cấp Độ (L1–L4)</span>
            </button>
            <button
              type="button"
              onClick={handleOpenProposeModal}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-slate-500" />
              <span>Đề Xuất Bậc Cước Km</span>
            </button>
          </div>
        )}
      </div>

      {/* Scope & Policy Alert Box */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            Quy định biểu phí theo mô hình Item & Cấp độ L1–L4:
          </p>
          <p className="text-slate-600">
            • <strong>Biểu phí 4 cấp độ (L1–L4):</strong> Mỗi trung tâm kiểm định đề xuất bảng giá riêng cho 4 cấp độ (L1, L2, L3, L4). Sau khi Quản trị viên sàn phê duyệt, bảng giá sẽ có hiệu lực chính thức cho trạm.
          </p>
          <p className="text-slate-600">
            • <strong>Xác định giá đơn hàng:</strong> Khi người mua đặt lịch kiểm định cho sản phẩm, hệ thống căn cứ theo loại thiết bị cụ thể (Item) đã được Admin duyệt cấp độ nào (L1–L4) để áp mức phí kiểm định tương ứng của trung tâm được chọn.
          </p>
          <p className="text-slate-600">
            • <strong>Bậc cước di chuyển:</strong> Áp dụng chung cho dịch vụ KTV kiểm định tại nhà theo số km thực tế.
          </p>
          <p className="text-slate-600">
            • <strong>Giao hàng về Trung tâm:</strong> Cước vận chuyển sản phẩm đến Hub bằng Lalamove là khoản giao vận riêng biệt, không tính trong biểu phí kiểm định.
          </p>
        </div>
      </div>

      {/* 4-Level Fees Studio Cards (L1 - L4) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-black">
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                Bảng Biểu Phí 4 Cấp Độ Kiểm Định (L1 – L4) Đang Áp Dụng
              </h4>
              <p className="text-[11px] text-slate-500">
                Giá kiểm định cơ sở của trạm theo độ phức tạp kỹ thuật từng dòng thiết bị gia dụng (sau khi Admin duyệt)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Gửi đề xuất bộ tiêu chuẩn kiểm định và cấp độ L1-L4 cho loại sản phẩm"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Cấu hình Item và cấp độ</span>
            </button>

          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              level: 'L1' as InspectionComplexityLevel,
              name: 'Cấp L1 - Cơ Bản',
              badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              borderColor: 'hover:border-emerald-300',
            },
            {
              level: 'L2' as InspectionComplexityLevel,
              name: 'Cấp L2 - Nâng Cao',
              badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
              borderColor: 'hover:border-blue-300',
            },
            {
              level: 'L3' as InspectionComplexityLevel,
              name: 'Cấp L3 - Chuyên Sâu',
              badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
              borderColor: 'hover:border-purple-300',
            },
            {
              level: 'L4' as InspectionComplexityLevel,
              name: 'Cấp L4 - Phức Tạp',
              badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
              borderColor: 'hover:border-rose-300',
            },
          ].map((tier) => {
            const approvedFee = currentLevelFees.find(
              (f) => String(f.complexityLevel || '').toUpperCase() === String(tier.level).toUpperCase() && (f.status === 'APPROVED' || !f.status)
            );
            const pendingProp = getPendingProposalForLevel(tier.level);
            const levelItems = approvedItemsByLevel[tier.level] || [];

            return (
              <div
                key={tier.level}
                className={`rounded-2xl p-4 border flex flex-col justify-between transition ${pendingProp
                  ? 'bg-amber-50/30 border-amber-300 ring-2 ring-amber-100 shadow-xs'
                  : `bg-slate-50/60 border-slate-200 ${tier.borderColor} hover:shadow-xs`
                  }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${tier.badgeColor}`}>
                      {tier.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {tier.level}
                    </span>
                  </div>

                  {/* Dynamic Item list from approved active checklists */}
                  <div className="min-h-[46px]">
                    {levelItems.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto subtle-scrollbar py-0.5">
                        {levelItems.map((itm) => (
                          <span
                            key={itm.itemId}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200/90 text-slate-700 shadow-2xs"
                            title={itm.checklistTitle || itm.itemName}
                          >
                            {itm.itemName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[11px] text-slate-400 italic">
                          Chưa có loại sản phẩm được phân cấp
                        </p>
                        {isLevelFeeApproved(tier.level) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateChecklistForItem(undefined, tier.level)}
                            className="text-[10px] font-bold text-[#c34c36] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Cấu hình Item cho cấp {tier.level}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/70 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Chờ duyệt giá cấp {tier.level} trước khi gán Item</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3.5 mt-3 border-t border-slate-200/70 flex flex-col justify-between flex-1 gap-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      Phí kiểm định cơ sở
                    </span>
                    <div className="h-7 flex items-center mt-0.5">
                      {approvedFee && approvedFee.baseInspectionFee ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-[#24263e]">
                            {formatVND(approvedFee.baseInspectionFee)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Hiệu lực
                          </span>
                        </div>
                      ) : pendingProp ? (
                        <span className="text-xs font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                          Chờ duyệt lần đầu
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                          Chưa có giá được duyệt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Đề xuất đang chờ duyệt (nếu có) - Có chiều cao đồng đều h-[42px] giữa các thẻ */}
                  <div className="h-[42px] flex items-center">
                    {pendingProp ? (
                      <div className="w-full p-2 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block">
                              Đang chờ duyệt
                            </span>
                            <span className="text-xs font-black text-amber-900 font-mono block leading-tight">
                              {formatVND(pendingProp.baseInspectionFee || 0)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-700 font-mono font-bold shrink-0">
                          #{pendingProp.id ? pendingProp.id.slice(0, 8) : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-xl bg-slate-50/50 border border-dashed border-slate-200/80 flex items-center justify-center text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{approvedFee ? 'Đang áp dụng giá chuẩn' : 'Chưa có đề xuất mới'}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Nút hành động: Nếu đang chờ duyệt thì vô hiệu hóa nút để tránh gửi trùng lặp */}
                  <div>
                    {pendingProp ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                        title="Cấp độ này đã có đề xuất đang chờ Admin duyệt. Không thể gửi thêm để tránh trùng lặp."
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Đã gửi đề xuất (Chờ duyệt)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setProposingLevel(tier.level);
                          setProposingLevelFeeAmount(approvedFee?.baseInspectionFee || 100000);
                          setProposingLevelFeeError(null);
                          setIsProposeLevelFeeModalOpen(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-[#c34c36] hover:bg-rose-50/50 text-[#c34c36] text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Đề xuất giá cấp {tier.level}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danh Sách Loại Sản Phẩm (Item) Chưa Được Phân Cấp */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                  Loại Sản Phẩm (Item) Chưa Được Phân Cấp
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${unclassifiedItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                  {unclassifiedItems.length} thiết bị
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Danh sách các loại sản phẩm chưa có bộ tiêu chuẩn được Admin phê duyệt cấp độ L1–L4. Trung tâm cần gửi đề xuất checklist để kích hoạt định giá cho dòng sản phẩm này.
              </p>
            </div>
          </div>
          {unclassifiedItems.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Cấu hình Item và cấp độ</span>
            </button>
          )}
        </div>

        {isLoadingChecklists || isLoadingCategories ? (
          <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin mb-1 text-[#24263e]" />
            <span className="text-xs">Đang kiểm tra danh mục thiết bị chưa phân cấp...</span>
          </div>
        ) : unclassifiedItems.length === 0 ? (
          <div className="py-6 text-center text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-200 flex flex-col items-center justify-center">
            <CheckSquare className="w-6 h-6 text-emerald-600 mb-1.5" />
            <p className="font-bold text-xs">Tất cả các loại sản phẩm (Item) đều đã được phân cấp L1–L4 hợp lệ!</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Mọi thiết bị đều đã sẵn sàng áp dụng mức phí kiểm định khi người mua đặt dịch vụ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unclassifiedItems.map((itm) => (
              <div
                key={itm.id}
                className="p-3 rounded-xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 hover:bg-amber-50/20 transition flex items-center justify-between gap-2.5 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate" title={itm.name}>
                    {itm.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5" title={itm.categoryName}>
                    {itm.categoryName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {itm.pendingChecklist ? (
                    <span className="w-24 text-center px-1.5 py-1 rounded-lg text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200 shrink-0 whitespace-nowrap">
                      Chờ duyệt ({itm.pendingChecklist.complexityLevel})
                    </span>
                  ) : (
                    <span className="w-24 text-center px-1.5 py-1 rounded-lg text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 shrink-0 whitespace-nowrap">
                      Chưa cấu hình
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCreateChecklistForItem(itm)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#c34c36] hover:bg-white text-slate-700 hover:text-[#c34c36] font-bold text-[11px] transition cursor-pointer shrink-0 shadow-2xs whitespace-nowrap"
                    title={`Cấu hình bộ tiêu chuẩn cho ${itm.name}`}
                  >
                    Cấu hình
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Active Travel Tiers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Bảng Bậc Thang Cước Di Chuyển Hiện Hành ({travelTiers.length} bậc)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Áp dụng chung toàn hệ thống</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 w-16">Bậc</th>
                <th className="py-3 px-4">Tên Bậc</th>
                <th className="py-3 px-4">Khoảng Cách Áp Dụng</th>
                <th className="py-3 px-4">Đơn Giá / km</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingPricing && travelTiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                    <span>Đang tải bảng bậc thang cước di chuyển...</span>
                  </td>
                </tr>
              ) : travelTiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Chưa có dữ liệu bậc thang cước di chuyển từ hệ thống.
                  </td>
                </tr>
              ) : (
                travelTiers.map((tier, idx) => (
                  <tr key={tier.tierNumber || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-black text-slate-900">
                      #{tier.tierNumber || idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {tier.name || `Bậc ${tier.tierNumber || idx + 1}`}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono">
                      {tier.fromKm ?? 0} km - {tier.toKm != null ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                    </td>
                    <td className="py-3 px-4 font-black text-[#c34c36] font-mono">
                      {formatVND(tier.pricePerKm || 0)} / km
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{tier.status || 'Đang áp dụng'}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proposals History Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Lịch Sử Đề Xuất Biểu Phí 4 Cấp Độ (L1–L4) & Bậc Cước ({pricingProposalTotalElements} đề xuất)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Theo dõi tiến độ xét duyệt biểu phí cơ sở và bậc thang cước từ Quản trị viên sàn
            </p>
          </div>
          <button
            onClick={() => loadPricing(pricingProposalPage, pricingProposalFilter)}
            disabled={isLoadingPricing}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPricing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1">Lọc trạng thái:</span>
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
            { key: 'APPROVED', label: 'Đã duyệt' },
            { key: 'REJECTED', label: 'Đã từ chối' }
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => handlePricingFilterChange(st.key as any)}
              disabled={isLoadingPricing}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${pricingProposalFilter === st.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Proposals Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3">Mã Đề Xuất</th>
                <th className="py-2.5 px-3">Danh Mục Áp Dụng</th>
                <th className="py-2.5 px-3">Phí Cơ Sở Đề Xuất</th>
                <th className="py-2.5 px-3">Người Đề Xuất</th>
                <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                <th className="py-2.5 px-3">Phản Hồi Admin</th>
                <th className="py-2.5 px-3">Thời Gian Gửi</th>
                <th className="py-2.5 px-3 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingPricing ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                    <span>Đang tải lịch sử đề xuất...</span>
                  </td>
                </tr>
              ) : (
                (() => {
                  const seenIds = new Set<string>();
                  const combined = tierProposals.filter((p) => {
                    if (!p || !p.id) return false;
                    if (seenIds.has(p.id)) return false;
                    seenIds.add(p.id);
                    if (pricingProposalFilter !== 'ALL') {
                      const targetStatus = (pricingProposalFilter as string) === 'PENDING' ? 'PENDING_APPROVAL' : pricingProposalFilter;
                      if (p.status !== targetStatus) return false;
                    }
                    return true;
                  });
                  if (combined.length === 0) {
                    return (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Chưa có đề xuất biểu phí nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    );
                  }
                  return combined.map((prop, idx) => (
                    <tr key={prop.id || `prop-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {pricingProposalPage * 10 + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        #{prop.id ? prop.id.slice(0, 8) : '---'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">
                        {prop.complexityLevel ? (
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${prop.complexityLevel === 'L1' ? 'bg-emerald-100 text-emerald-800' :
                              prop.complexityLevel === 'L2' ? 'bg-blue-100 text-blue-800' :
                                prop.complexityLevel === 'L3' ? 'bg-purple-100 text-purple-800' :
                                  'bg-rose-100 text-rose-800'
                              }`}>
                              Cấp {prop.complexityLevel}
                            </span>
                            {prop.categoryName && <span className="text-slate-500 text-[11px]">({prop.categoryName})</span>}
                          </span>
                        ) : (
                          prop.categoryName || 'Tất cả danh mục'
                        )}
                      </td>
                      <td className="py-3 px-3 font-black text-[#c34c36] font-mono">
                        {formatVND(prop.baseInspectionFee || 0)}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {prop.proposedByName || prop.proposedByEmail || 'TTKD'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${prop.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : prop.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                        >
                          {prop.status === 'APPROVED'
                            ? 'Đã Phê Duyệt'
                            : prop.status === 'REJECTED'
                              ? 'Bị Từ Chối'
                              : 'Chờ Admin Duyệt'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {prop.reviewedByName && (
                          <span className="font-semibold text-slate-700 block">
                            {prop.reviewedByName}
                          </span>
                        )}
                        {prop.rejectReason ? (
                          <span className="text-[11px] text-rose-600 font-medium">
                            Lý do: {prop.rejectReason}
                          </span>
                        ) : (
                          !prop.reviewedByName && <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {prop.createdAt ? new Date(prop.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedProposalDetail(prop)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Bậc phí</span>
                        </button>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pricingProposalTotalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Trang <strong>{pricingProposalPage + 1}</strong> / {pricingProposalTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadPricing(pricingProposalPage - 1, pricingProposalFilter, false)}
                disabled={pricingProposalPage <= 0 || isLoadingPricing}
                className="px-3 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>
              <button
                onClick={() => loadPricing(pricingProposalPage + 1, pricingProposalFilter, false)}
                disabled={pricingProposalPage >= pricingProposalTotalPages - 1 || isLoadingPricing}
                className="px-3 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
