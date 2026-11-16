import {
  Clock,
  Search,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Eye,
  Copy,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Zap,
  CheckSquare,
  FileText,
  Boxes,
} from 'lucide-react';
import { APPLIANCE_PRESETS } from './appliancePresets';
import type { useCenterCatalog } from './useCenterCatalog';
import type { useCenterChecklists } from './useCenterChecklists';

interface Props {
  categories: ReturnType<typeof useCenterCatalog>['categories'];
  checklist: Pick<ReturnType<typeof useCenterChecklists>,
    | 'checklistCategoryFilter'
    | 'checklists'
    | 'checklistSearch'
    | 'checklistStats'
    | 'filteredChecklists'
    | 'handleCloneChecklist'
    | 'handleDeleteChecklist'
    | 'handleOpenCreateModal'
    | 'handleOpenEditModal'
    | 'handleViewChecklistDetail'
    | 'isLoadingChecklists'
    | 'loadChecklists'
    | 'setChecklistCategoryFilter'
    | 'setChecklistSearch'
  >;
}

export function CenterChecklists({ categories, checklist }: Props) {
  const {
    checklistCategoryFilter,
    checklists,
    checklistSearch,
    checklistStats,
    filteredChecklists,
    handleCloneChecklist,
    handleDeleteChecklist,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleViewChecklistDetail,
    isLoadingChecklists,
    loadChecklists,
    setChecklistCategoryFilter,
    setChecklistSearch,
  } = checklist;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-black">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Checklist Studio: Bộ Tiêu Chuẩn Kỹ Thuật Kiểm Định Sản Phẩm
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập tiêu chuẩn kiểm định chuyên sâu từng dòng sản phẩm gia dụng (Tủ lạnh, Máy giặt, Điều hòa, Bếp từ, Lò vi sóng...) theo chuẩn ISO 17025 & SecondLife Hub
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 text-[#c34c36]" />
            <span>+ Tạo Bộ Tiêu Chuẩn Mới</span>
          </button>
          <button
            type="button"
            onClick={loadChecklists}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingChecklists ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 KPI Statistic Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bộ Tiêu Chuẩn</span>
            <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.total}</span>
            <span className="text-[10px] text-slate-400 block">Đang hiệu lực tại trạm</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Danh Mục Thiết Bị</span>
            <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.categoriesCount}</span>
            <span className="text-[10px] text-slate-400 block">Đã có quy chuẩn đo kiểm</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hạng Mục Tiêu Trí</span>
            <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.totalItems}</span>
            <span className="text-[10px] text-slate-400 block">Tiêu chí đo kiểm chi tiết</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">An Toàn Bắt Buộc</span>
            <span className="text-lg sm:text-xl font-black text-rose-600">{checklistStats.mandatoryItems}</span>
            <span className="text-[10px] text-slate-400 block">Bắt buộc đạt mới PASS</span>
          </div>
        </div>
      </div>

      {/* Quick Template Library Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-[#24263e] to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              ⚡ Thư Viện Mẫu Tiêu Chuẩn Nhanh Theo Dòng Sản Phẩm Gia Dụng
            </span>
          </div>
          <span className="text-[11px] text-slate-300">
            Nhấp chọn mẫu để tự động điền tiêu chuẩn đo kiểm chuẩn ISO & SecondLife
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {APPLIANCE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleOpenCreateModal(preset.key)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer hover:scale-102 transform duration-150 active:scale-98"
            >
              <span>{preset.icon}</span>
              <span>{preset.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                {preset.items.length} mục
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              placeholder="Tìm bộ tiêu chuẩn, danh mục hoặc tiêu chí..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#c34c36]"
            />
            {checklistSearch && (
              <button
                type="button"
                onClick={() => setChecklistSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="min-w-[180px]">
            <select
              value={checklistCategoryFilter}
              onChange={(e) => setChecklistCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#c34c36]"
            >
              <option value="ALL">-- Tất cả danh mục --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="GENERAL">Áp dụng chung (Không gắn category)</option>
            </select>
          </div>

          {(checklistSearch || checklistCategoryFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setChecklistSearch('');
                setChecklistCategoryFilter('ALL');
              }}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer px-1"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-slate-500">
          Hiển thị <span className="text-slate-900 font-black">{filteredChecklists.length}</span> / {checklists.length} bộ tiêu chuẩn
        </div>
      </div>

      {/* Checklists Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Bộ Tiêu Chuẩn & Căn Cứ Đo Kiểm</th>
                <th className="py-3 px-4">Loại Thiết Bị (Item) & Cấp Độ</th>
                <th className="py-3 px-4 text-center">Hạng Mục Tiêu Trí</th>
                <th className="py-3 px-4 text-center">Trạng Thái Phê Duyệt</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingChecklists ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#24263e] mb-2" />
                    <span>Đang tải danh sách bộ checklist...</span>
                  </td>
                </tr>
              ) : filteredChecklists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Chưa có bộ tiêu chuẩn nào phù hợp.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Chọn một mẫu nhanh ở trên hoặc nhấn "+ Tạo Bộ Tiêu Chuẩn Mới" để thiết lập.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal()}
                        className="px-4 py-2 rounded-xl bg-[#24263e] text-white text-xs font-bold hover:bg-black transition cursor-pointer"
                      >
                        + Tạo Mới Ngay
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChecklists.map((chk, idx) => {
                  const itemsCount = chk.items?.length || 0;
                  const mandatoryCount = (chk.items || []).filter((i) => i.mandatory !== false).length;
                  return (
                    <tr key={chk.id} className="hover:bg-slate-50/70 transition group">
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] text-center">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-[#c34c36] transition">
                          {chk.title}
                        </div>
                        {chk.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 max-w-xl">
                            {chk.description}
                          </div>
                        )}
                        {chk.createdAt && (
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>Ban hành: {new Date(chk.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-[#c34c36]" />
                            <span>{chk.itemName || chk.categoryName || 'Tất cả danh mục'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {chk.complexityLevel && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${chk.complexityLevel === 'L1' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                chk.complexityLevel === 'L2' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  chk.complexityLevel === 'L3' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                Cấp {chk.complexityLevel}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              v{chk.revision || 1}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-black text-slate-800 text-xs">{itemsCount} mục</span>
                          {mandatoryCount > 0 && (
                            <span className="text-[10px] text-rose-600 font-bold">
                              ({mandatoryCount} bắt buộc)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {chk.approvalStatus === 'APPROVED' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ĐÃ DUYỆT
                          </span>
                        ) : chk.approvalStatus === 'PENDING_APPROVAL' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            CHỜ DUYỆT
                          </span>
                        ) : chk.approvalStatus === 'REJECTED' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                              TỪ CHỐI
                            </span>
                            {chk.rejectReason && (
                              <span className="text-[10px] text-rose-600 line-clamp-1 max-w-[120px]" title={chk.rejectReason}>
                                {chk.rejectReason}
                              </span>
                            )}
                          </div>
                        ) : chk.approvalStatus === 'WITHDRAWN' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                            ĐÃ RÚT
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            {chk.approvalStatus || (chk.active !== false ? 'Đang Áp Dụng' : 'Tạm Dừng')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleViewChecklistDetail(chk)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Xem chi tiết các hạng mục kiểm định"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(chk)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Chỉnh sửa bộ tiêu chuẩn"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloneChecklist(chk)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Nhân bản làm tiêu chuẩn mới"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {chk.approvalStatus !== 'APPROVED' && chk.approvalStatus !== 'LEGACY' ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklist(chk)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Rút đề xuất bộ tiêu chuẩn"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Không thể rút tiêu chuẩn đã được duyệt"
                            >
                              <Trash2 className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
