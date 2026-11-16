import { Copy, Edit3, FileText } from 'lucide-react';
import type { useCenterChecklists } from './useCenterChecklists';

interface Props {
  viewingChecklist: NonNullable<ReturnType<typeof useCenterChecklists>['viewingChecklist']>;
  checklist: Pick<ReturnType<typeof useCenterChecklists>, 'handleCloneChecklist' | 'handleOpenEditModal' | 'setViewingChecklist'>;
}

export function ChecklistDetailsModal({ viewingChecklist, checklist }: Props) {
  const { handleCloneChecklist, handleOpenEditModal, setViewingChecklist } = checklist;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                Hồ Sơ Tiêu Chuẩn Kiểm Định Kỹ Thuật
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                  {viewingChecklist.categoryName || 'Tất cả danh mục'}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  {viewingChecklist.active !== false ? 'Đang hiệu lực' : 'Tạm dừng'}
                </span>
                {viewingChecklist.createdAt && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Ban hành: {new Date(viewingChecklist.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewingChecklist(null)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div>
            <h4 className="font-black text-sm text-slate-900 mb-1">{viewingChecklist.title}</h4>
            {viewingChecklist.description ? (
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                {viewingChecklist.description}
              </p>
            ) : (
              <p className="text-slate-400 italic">Không có ghi chú quy chuẩn bổ sung.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                CÁC HẠNG MỤC TIÊU TRÍ ĐO KIỂM ({viewingChecklist.items?.length || 0})
              </span>
              <span className="text-[11px] font-bold text-rose-600">
                {(viewingChecklist.items || []).filter(i => i.mandatory !== false).length} tiêu chí bắt buộc đạt
              </span>
            </div>

            <div className="space-y-2">
              {(viewingChecklist.items || []).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`p-3 rounded-xl border space-y-1 ${item.mandatory !== false
                    ? 'border-rose-200/70 bg-rose-50/20'
                    : 'border-slate-200 bg-slate-50/40'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-slate-400">#{idx + 1}.</span>
                      <span>{item.itemTitle || (item as any).name}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${item.mandatory !== false
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {item.mandatory !== false ? 'Bắt Buộc' : 'Tùy Chọn'}
                    </span>
                  </div>
                  {(item.criteriaDescription || (item as any).description) && (
                    <p className="text-[11px] text-slate-600 pl-4 border-l-2 border-slate-300">
                      {item.criteriaDescription || (item as any).description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => {
              handleCloneChecklist(viewingChecklist);
              setViewingChecklist(null);
            }}
            className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Nhân Bản Mẫu Này</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleOpenEditModal(viewingChecklist);
                setViewingChecklist(null);
              }}
              className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Chỉnh Sửa Bộ Này</span>
            </button>
            <button
              type="button"
              onClick={() => setViewingChecklist(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
