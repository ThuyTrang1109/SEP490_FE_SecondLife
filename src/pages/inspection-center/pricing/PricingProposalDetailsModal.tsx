import { X, Sliders } from 'lucide-react';
import { formatVND } from '../../../utils/translations';
import type { useCenterPricing } from './useCenterPricing';

interface Props {
  selectedProposalDetail: NonNullable<ReturnType<typeof useCenterPricing>['selectedProposalDetail']>;
  setSelectedProposalDetail: ReturnType<typeof useCenterPricing>['setSelectedProposalDetail'];
}

export function PricingProposalDetailsModal({ selectedProposalDetail, setSelectedProposalDetail }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                Chi Tiết Đề Xuất #{selectedProposalDetail.id.slice(0, 8)}
              </h3>
              <p className="text-[11px] text-slate-400">
                Gửi bởi {selectedProposalDetail.proposedByName || selectedProposalDetail.proposedByEmail} •{' '}
                {selectedProposalDetail.createdAt
                  ? new Date(selectedProposalDetail.createdAt).toLocaleString('vi-VN')
                  : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedProposalDetail(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Proposal Key Info */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Danh mục áp dụng:
            </span>
            <span className="font-bold text-slate-800 text-xs">
              {selectedProposalDetail.categoryName || 'Tất cả danh mục sản phẩm'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Phí kiểm định cơ sở:
            </span>
            <span className="font-black text-[#c34c36] text-xs font-mono">
              {formatVND(selectedProposalDetail.baseInspectionFee || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Trạng thái:
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mt-0.5 ${selectedProposalDetail.status === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-800'
                : selectedProposalDetail.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
                }`}
            >
              {selectedProposalDetail.status === 'APPROVED'
                ? 'Đã Phê Duyệt'
                : selectedProposalDetail.status === 'REJECTED'
                  ? 'Bị Từ Chối'
                  : 'Chờ Admin Duyệt'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Người xét duyệt:
            </span>
            <span className="font-bold text-slate-700 text-xs">
              {selectedProposalDetail.reviewedByName || 'Chờ xử lý'}
            </span>
          </div>
        </div>

        {selectedProposalDetail.rejectReason && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <strong>Lý do từ chối:</strong> {selectedProposalDetail.rejectReason}
          </div>
        )}

        {/* Tiers Breakdown */}
        <div className="space-y-1.5">
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
            Bảng bậc thang cước trong đề xuất:
          </span>
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 text-[10px] uppercase">
                  <th className="py-2 px-3">Bậc</th>
                  <th className="py-2 px-3">Tên bậc</th>
                  <th className="py-2 px-3">Cự ly</th>
                  <th className="py-2 px-3 text-right">Đơn giá / km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedProposalDetail.tiers || []).map((t, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      #{t.tierNumber || idx + 1}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{t.name}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">
                      {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
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

        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedProposalDetail(null)}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
