import { AlertCircle, ArrowRight, Loader2, X, Sliders, AlertTriangle } from 'lucide-react';
import { formatVND } from '../../../utils/translations';
import type { useCenterPricing } from './useCenterPricing';

interface Props {
  pricing: Pick<ReturnType<typeof useCenterPricing>,
    | 'handleProceedToPreview'
    | 'handleProposeTierChange'
    | 'handleSubmitProposal'
    | 'isSubmittingProposal'
    | 'proposeStep'
    | 'proposeTiers'
    | 'proposeValidationError'
    | 'setIsProposeModalOpen'
    | 'setProposeStep'
  >;
}

export function PricingProposalModal({ pricing }: Props) {
  const {
    handleProceedToPreview,
    handleProposeTierChange,
    handleSubmitProposal,
    isSubmittingProposal,
    proposeStep,
    proposeTiers,
    proposeValidationError,
    setIsProposeModalOpen,
    setProposeStep,
  } = pricing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                Đề Xuất Điều Chỉnh Bậc Cước Di Chuyển
              </h3>
              <p className="text-[11px] text-slate-500">
                {proposeStep === 'edit'
                  ? 'Bước 1/2: Cấu hình các bậc cước di chuyển theo khoảng cách'
                  : 'Bước 2/2: Xem lại đề xuất trước khi gửi Admin sàn xét duyệt'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsProposeModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Error Banner */}
        {proposeValidationError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{proposeValidationError}</span>
          </div>
        )}

        {/* STEP 1: EDIT FORM */}
        {proposeStep === 'edit' && (
          <div className="space-y-4">
            {/* Tiers List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Cấu hình các bậc thang cước di chuyển ({proposeTiers.length} bậc):
                </label>
                <span className="text-[10px] text-slate-400">
                  Bậc cuối để trống cự ly đến để biểu thị không giới hạn (∞)
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {proposeTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 text-xs">
                        Bậc #{tier.tierNumber || idx + 1}
                      </span>
                      <input
                        type="text"
                        value={tier.name || ''}
                        placeholder="Tên bậc..."
                        onChange={(e) => handleProposeTierChange(idx, 'name', e.target.value)}
                        className="w-56 p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Từ (km):</span>
                        <input
                          type="number"
                          min={0}
                          value={tier.fromKm ?? 0}
                          onChange={(e) =>
                            handleProposeTierChange(idx, 'fromKm', Number(e.target.value))
                          }
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs font-mono"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Đến (km):</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="Không giới hạn"
                          value={tier.toKm ?? ''}
                          onChange={(e) =>
                            handleProposeTierChange(
                              idx,
                              'toKm',
                              e.target.value.trim() !== '' ? Number(e.target.value) : null
                            )
                          }
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs font-mono"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Đơn giá / km (VND):</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={tier.pricePerKm ?? 0}
                          onChange={(e) =>
                            handleProposeTierChange(idx, 'pricePerKm', Number(e.target.value))
                          }
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-black text-[#c34c36] text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleProceedToPreview}
                className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Tiếp Tục Xem Lại & Xác Nhận</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & CONFIRM */}
        {proposeStep === 'preview' && (
          <div className="space-y-4">
            {/* Mandatory Warning Banner */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>LƯU Ý VỀ HIỆU LỰC ĐỀ XUẤT</span>
              </div>
              <p>
                Đề xuất biểu phí chỉ chính thức có hiệu lực sau khi Quản trị viên (Admin) sàn SecondLife phê duyệt.
                Trung tâm không thể tự kích hoạt hoặc áp dụng biểu phí trước khi được xét duyệt.
              </p>
            </div>

            {/* Summary Table */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Chi tiết {proposeTiers.length} bậc cước di chuyển đề xuất:
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 text-[10px] uppercase">
                        <th className="py-2 px-3">Bậc</th>
                        <th className="py-2 px-3">Tên bậc</th>
                        <th className="py-2 px-3">Khoảng cách</th>
                        <th className="py-2 px-3 text-right">Đơn giá / km</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proposeTiers.map((t, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            #{t.tierNumber || i + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800">{t.name}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono">
                            {t.fromKm ?? 0} km -{' '}
                            {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-[#c34c36] font-mono">
                            {formatVND(t.pricePerKm || 0)} / km
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProposeStep('edit')}
                disabled={isSubmittingProposal}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
              >
                Quay Lại Sửa
              </button>
              <button
                type="button"
                onClick={handleSubmitProposal}
                disabled={isSubmittingProposal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingProposal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác Nhận Gửi Đề Xuất Lên Admin</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
