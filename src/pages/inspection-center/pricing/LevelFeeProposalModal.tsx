import { AlertCircle, Loader2, Check, Sliders, Info } from 'lucide-react';
import { InspectionComplexityLevel } from '../../../types';
import { formatVND } from '../../../utils/translations';
import type { useCenterPricing } from './useCenterPricing';

interface Props {
  pricing: Pick<ReturnType<typeof useCenterPricing>,
    | 'getPendingProposalForLevel'
    | 'handleProposeLevelFeeSubmit'
    | 'isSubmittingLevelFee'
    | 'proposingLevel'
    | 'proposingLevelFeeAmount'
    | 'proposingLevelFeeError'
    | 'setIsProposeLevelFeeModalOpen'
    | 'setProposingLevel'
    | 'setProposingLevelFeeAmount'
    | 'setProposingLevelFeeError'
  >;
}

export function LevelFeeProposalModal({ pricing }: Props) {
  const {
    getPendingProposalForLevel,
    handleProposeLevelFeeSubmit,
    isSubmittingLevelFee,
    proposingLevel,
    proposingLevelFeeAmount,
    proposingLevelFeeError,
    setIsProposeLevelFeeModalOpen,
    setProposingLevel,
    setProposingLevelFeeAmount,
    setProposingLevelFeeError,
  } = pricing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                Đề Xuất Biểu Phí Cấp Độ Kiểm Định (L1 – L4)
              </h3>
              <p className="text-[11px] text-slate-500">
                Biểu phí áp dụng cho các thiết bị thuộc cấp độ tương ứng sau khi Admin duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsProposeLevelFeeModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleProposeLevelFeeSubmit} className="space-y-4">
          {proposingLevelFeeError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{proposingLevelFeeError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Chọn cấp độ kiểm định áp dụng <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { level: 'L1' as InspectionComplexityLevel, name: 'Cấp L1 - Cơ Bản', desc: 'Quạt, ấm, bàn ủi...' },
                { level: 'L2' as InspectionComplexityLevel, name: 'Cấp L2 - Nâng Cao', desc: 'Nồi cơm, lò vi sóng, hút bụi...' },
                { level: 'L3' as InspectionComplexityLevel, name: 'Cấp L3 - Chuyên Sâu', desc: 'Máy giặt, máy sấy, máy rửa bát...' },
                { level: 'L4' as InspectionComplexityLevel, name: 'Cấp L4 - Phức Tạp', desc: 'Tủ lạnh Side-by-Side, điều hòa...' },
              ].map((item) => {
                const isPending = Boolean(getPendingProposalForLevel(item.level));
                return (
                  <button
                    key={item.level}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!isPending) {
                        setProposingLevel(item.level);
                        setProposingLevelFeeError(null);
                      }
                    }}
                    className={`p-3 rounded-xl text-left border transition ${isPending
                      ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                      : proposingLevel === item.level
                        ? 'border-[#24263e] bg-slate-50 shadow-xs ring-1 ring-[#24263e] cursor-pointer'
                        : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    title={isPending ? 'Cấp độ này đã có đề xuất đang chờ Admin duyệt' : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">{item.name}</span>
                      {isPending ? (
                        <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Chờ duyệt
                        </span>
                      ) : proposingLevel === item.level ? (
                        <Check className="w-4 h-4 text-[#c34c36]" />
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {isPending ? 'Đã gửi yêu cầu, đang chờ Admin duyệt' : item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Mức phí kiểm định đề xuất (VND) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1000}
              step={1000}
              required
              value={proposingLevelFeeAmount}
              onChange={(e) => setProposingLevelFeeAmount(e.target.value ? Number(e.target.value) : '')}
              placeholder="Ví dụ: 150000"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:border-[#c34c36] outline-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[50000, 100000, 150000, 200000, 250000, 300000, 400000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setProposingLevelFeeAmount(amt)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                >
                  {formatVND(amt)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Lưu ý phê duyệt:</span>
            </p>
            <p>• Đề xuất sau khi gửi sẽ ở trạng thái <strong>CHỜ DUYỆT</strong> bởi Quản trị viên sàn SecondLife.</p>
            <p>• Khi Admin phê duyệt, mức phí mới sẽ tự động áp dụng cho các đơn hàng kiểm định thiết bị thuộc cấp độ này.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsProposeLevelFeeModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmittingLevelFee}
              className="px-5 py-2 bg-[#24263e] hover:bg-black text-white font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmittingLevelFee ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <span>Gửi Đề Xuất Giá Cấp {proposingLevel}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
