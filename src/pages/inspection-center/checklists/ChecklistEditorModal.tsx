import {
  AlertCircle,
  ShieldCheck,
  Loader2,
  Layers,
  Plus,
  FileCheck,
  Zap,
  ArrowUp,
  ArrowDown,
  Square,
} from 'lucide-react';
import { InspectionComplexityLevel } from '../../../types';
import { formatVND } from '../../../utils/translations';
import { APPLIANCE_PRESETS } from './appliancePresets';
import type { useCenterCatalog } from './useCenterCatalog';
import type { useCenterChecklists } from './useCenterChecklists';
import type { useCenterPricing } from '../pricing/useCenterPricing';

interface Props {
  catalogItems: ReturnType<typeof useCenterCatalog>['catalogItems'];
  categories: ReturnType<typeof useCenterCatalog>['categories'];
  checklist: Pick<ReturnType<typeof useCenterChecklists>,
    | 'checklistDesc'
    | 'checklistItems'
    | 'checklists'
    | 'checklistTitle'
    | 'editingChecklistId'
    | 'handleApplyPreset'
    | 'handleSaveChecklist'
    | 'isSavingChecklist'
    | 'resetChecklistForm'
    | 'selectedCategoryId'
    | 'selectedComplexityLevel'
    | 'selectedItemId'
    | 'setChecklistDesc'
    | 'setChecklistItems'
    | 'setChecklistTitle'
    | 'setIsChecklistModalOpen'
    | 'setSelectedCategoryId'
    | 'setSelectedComplexityLevel'
    | 'setSelectedItemId'
  >;
  pricing: Pick<ReturnType<typeof useCenterPricing>,
    | 'getApprovedFeeForLevel'
    | 'getPendingProposalForLevel'
    | 'isLevelFeeApproved'
  >;
}

export function ChecklistEditorModal({ catalogItems, categories, checklist, pricing }: Props) {
  const {
    checklistDesc,
    checklistItems,
    checklists,
    checklistTitle,
    editingChecklistId,
    handleApplyPreset,
    handleSaveChecklist,
    isSavingChecklist,
    resetChecklistForm,
    selectedCategoryId,
    selectedComplexityLevel,
    selectedItemId,
    setChecklistDesc,
    setChecklistItems,
    setChecklistTitle,
    setIsChecklistModalOpen,
    setSelectedCategoryId,
    setSelectedComplexityLevel,
    setSelectedItemId,
  } = checklist;
  const { getApprovedFeeForLevel, getPendingProposalForLevel, isLevelFeeApproved } = pricing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold">
              <Layers className="w-4 h-4 text-[#c34c36]" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                {editingChecklistId ? 'Chỉnh Sửa Bộ Tiêu Chuẩn Kiểm Định' : 'Thiết Lập Bộ Tiêu Chuẩn Kiểm Định Mới'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {editingChecklistId
                  ? 'Cập nhật danh mục, mô tả và các hạng mục tiêu chí đo kiểm kỹ thuật'
                  : 'Định nghĩa quy chuẩn đo lường kỹ thuật cho sản phẩm theo chuẩn ISO 17025 & SecondLife'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsChecklistModalOpen(false);
              resetChecklistForm();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Quick Preset Selector Pills inside Modal */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl shrink-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Nạp nhanh mẫu tiêu chuẩn gợi ý theo dòng máy:</span>
            </span>
            <span className="text-[10px] text-slate-400">Tự động điền tiêu chuẩn đo kiểm chuẩn</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {APPLIANCE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#c34c36] hover:bg-rose-50/50 text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1"
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
          {/* Item, Category & Complexity Level Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Danh mục thiết bị <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  const catId = e.target.value;
                  setSelectedCategoryId(catId);
                  setSelectedItemId('');
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:border-[#c34c36]"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Loại thiết bị cụ thể (Item) <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedItemId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedItemId(val);
                  if (val) {
                    const itm = catalogItems.find(i => i.id === val);
                    if (itm) {
                      if (itm.categoryId && !selectedCategoryId) setSelectedCategoryId(itm.categoryId);
                      if (!checklistTitle) {
                        setChecklistTitle(`Tiêu chuẩn kiểm định ${itm.name}`);
                      }
                    }
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:border-[#c34c36]"
              >
                <option value="">-- Chọn loại thiết bị --</option>
                {catalogItems
                  .filter(i => (!selectedCategoryId || i.categoryId === selectedCategoryId) && i.selectable !== false)
                  .map((itm) => {
                    const hasPending = checklists.some(c => c.itemId === itm.id && c.approvalStatus === 'PENDING_APPROVAL' && c.id !== editingChecklistId);
                    return (
                      <option key={itm.id} value={itm.id}>
                        {itm.name}{hasPending ? ' (Đang chờ Admin duyệt)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Cấp độ kiểm định đề xuất <span className="text-rose-500">*</span>
                </label>
                {isLevelFeeApproved(selectedComplexityLevel) ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Giá đã duyệt: {formatVND(getApprovedFeeForLevel(selectedComplexityLevel)?.baseInspectionFee || 0)}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                    Chưa duyệt giá
                  </span>
                )}
              </div>
              <select
                value={selectedComplexityLevel}
                onChange={(e) => setSelectedComplexityLevel(e.target.value as InspectionComplexityLevel)}
                className={`w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs focus:outline-none ${isLevelFeeApproved(selectedComplexityLevel)
                  ? 'border-slate-200 text-slate-800 focus:border-[#c34c36]'
                  : 'border-amber-300 text-amber-900 bg-amber-50/30 focus:border-amber-500'
                  }`}
              >
                {[
                  { level: 'L1' as InspectionComplexityLevel, label: 'L1 - Cơ bản (Quạt, ấm, bàn ủi...)' },
                  { level: 'L2' as InspectionComplexityLevel, label: 'L2 - Nâng cao (Nồi cơm, lò vi sóng, hút bụi...)' },
                  { level: 'L3' as InspectionComplexityLevel, label: 'L3 - Chuyên sâu (Máy giặt, máy sấy, máy rửa chén...)' },
                  { level: 'L4' as InspectionComplexityLevel, label: 'L4 - Phức tạp (Tủ lạnh Side-by-Side, điều hòa...)' },
                ].map((opt) => {
                  const approved = isLevelFeeApproved(opt.level);
                  const pending = Boolean(getPendingProposalForLevel(opt.level));
                  return (
                    <option
                      key={opt.level}
                      value={opt.level}
                      disabled={!approved}
                      className={!approved ? 'text-slate-400 bg-slate-100' : 'text-slate-900'}
                    >
                      {opt.label} {approved ? '✓ (Giá đã duyệt)' : pending ? '⚠ (Đang chờ Admin duyệt giá)' : '✕ (Chưa có giá duyệt)'}
                    </option>
                  );
                })}
              </select>

              {!isLevelFeeApproved(selectedComplexityLevel) && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-[11px]">
                      Cấp độ {selectedComplexityLevel} chưa có mức phí kiểm định được phê duyệt!
                    </p>
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      Theo quy định, trung tâm cần có biểu phí cấp {selectedComplexityLevel} được Admin duyệt trước khi đề xuất bộ tiêu chuẩn kiểm định. Vui lòng chọn cấp độ khác đã được duyệt giá hoặc gửi đề xuất giá cấp {selectedComplexityLevel} trước.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Checklist Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tên bộ tiêu chuẩn kiểm định <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
              placeholder="VD: Tiêu Chuẩn Kiểm Định Tủ Lạnh & Thiết Bị Làm Lạnh Inverter..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#c34c36]"
            />
          </div>

          {/* Technical Description / ISO Reference */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Căn cứ kỹ thuật & Mô tả đo lường (Quy chuẩn TCVN / ISO 17025)
            </label>
            <textarea
              rows={2}
              value={checklistDesc}
              onChange={(e) => setChecklistDesc(e.target.value)}
              placeholder="Mô tả tóm tắt quy trình kiểm tra bo mạch, máy nén, cảm biến, an toàn điện và thiết bị đo kiểm yêu cầu..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:border-[#c34c36]"
            />
          </div>

          {/* Dynamic Items Builder */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                  DANH SÁCH HẠNG MỤC TIÊU TRÍ KIỂM TRA ({checklistItems.length})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                  {checklistItems.filter(i => i.mandatory).length} bắt buộc
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setChecklistItems((prev) => [
                    ...prev,
                    {
                      itemTitle: '',
                      criteriaDescription: '',
                      mandatory: true,
                    },
                  ])
                }
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-[#c34c36] hover:text-white text-[#c34c36] font-bold transition cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Hạng Mục</span>
              </button>
            </div>

            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition space-y-2 ${item.mandatory
                    ? 'border-rose-200/80 bg-rose-50/20'
                    : 'border-slate-200 bg-slate-50/50'
                    }`}
                >
                  {/* Top row: Index + Title input + Mandatory toggle + Move + Delete */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>

                    <input
                      type="text"
                      value={item.itemTitle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChecklistItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, itemTitle: val } : it))
                        );
                      }}
                      placeholder={`Tên hạng mục kiểm tra #${idx + 1} (VD: Đo dòng khởi động Block máy nén)...`}
                      className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#c34c36]"
                    />

                    {/* Mandatory Switch */}
                    <label
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer shrink-0 transition select-none ${item.mandatory
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      title="Nếu đánh dấu Bắt buộc, sản phẩm sẽ KHÔNG ĐẠT kiểm định nếu KTV đánh rớt mục này"
                    >
                      <input
                        type="checkbox"
                        checked={item.mandatory}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setChecklistItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, mandatory: val } : it))
                          );
                        }}
                        className="hidden"
                      />
                      {item.mandatory ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{item.mandatory ? 'Bắt Buộc Đạt' : 'Tùy Chọn'}</span>
                    </label>

                    {/* Move Up / Down */}
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          if (idx > 0) {
                            setChecklistItems((prev) => {
                              const copy = [...prev];
                              const temp = copy[idx - 1];
                              copy[idx - 1] = copy[idx];
                              copy[idx] = temp;
                              return copy;
                            });
                          }
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === checklistItems.length - 1}
                        onClick={() => {
                          if (idx < checklistItems.length - 1) {
                            setChecklistItems((prev) => {
                              const copy = [...prev];
                              const temp = copy[idx + 1];
                              copy[idx + 1] = copy[idx];
                              copy[idx] = temp;
                              return copy;
                            });
                          }
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Delete item */}
                    {checklistItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded"
                        title="Xóa tiêu chí này"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Bottom row: Criteria Description / Test Method */}
                  <div>
                    <textarea
                      rows={2}
                      value={item.criteriaDescription}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChecklistItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, criteriaDescription: val } : it))
                        );
                      }}
                      placeholder="Phương pháp đo kiểm & Ngưỡng đạt chuẩn (VD: Dùng Ampe kìm đo dòng khởi động < 3 lần dòng định mức; Block chạy êm, độ ồn < 42dB)..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Tổng cộng: <span className="font-bold text-slate-800">{checklistItems.length} hạng mục</span>{' '}
            (<span className="font-bold text-rose-600">{checklistItems.filter(i => i.mandatory).length} mục bắt buộc</span>)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsChecklistModalOpen(false);
                resetChecklistForm();
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={
                isSavingChecklist ||
                !checklistTitle.trim() ||
                checklistItems.length === 0 ||
                !isLevelFeeApproved(selectedComplexityLevel)
              }
              onClick={handleSaveChecklist}
              className={`px-5 py-2 rounded-xl font-black shadow-sm transition flex items-center gap-1.5 ${!isLevelFeeApproved(selectedComplexityLevel)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-[#24263e] hover:bg-black text-white cursor-pointer disabled:opacity-50'
                }`}
              title={
                !isLevelFeeApproved(selectedComplexityLevel)
                  ? `Cấp ${selectedComplexityLevel} chưa có biểu phí được Admin duyệt. Không thể gửi đề xuất.`
                  : undefined
              }
            >
              {isSavingChecklist ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>{editingChecklistId ? 'Lưu Thay Đổi' : 'Lưu Bộ Tiêu Chuẩn'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
