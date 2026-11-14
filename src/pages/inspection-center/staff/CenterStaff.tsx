import { Users, Search, Loader2, Info } from 'lucide-react';
import type { CenterTab } from '../types';
import type { useCenterDispatchQueue } from '../dispatch/useCenterDispatchQueue';
import type { useCenterStaff } from './useCenterStaff';

interface Props {
  setActiveTab: (tab: CenterTab) => void;
  staffWorkloadMap: ReturnType<typeof useCenterDispatchQueue>['staffWorkloadMap'];
  staff: Pick<ReturnType<typeof useCenterStaff>,
    | 'filteredStaff'
    | 'isLoadingStaff'
    | 'setCreatedStaffSuccessData'
    | 'setCreateStaffError'
    | 'setIsCreateStaffModalOpen'
    | 'setStaffSearchTerm'
    | 'staffSearchTerm'
  >;
}

export function CenterStaff({ setActiveTab, staffWorkloadMap, staff }: Props) {
  const {
    filteredStaff,
    isLoadingStaff,
    setCreatedStaffSuccessData,
    setCreateStaffError,
    setIsCreateStaffModalOpen,
    setStaffSearchTerm,
    staffSearchTerm,
  } = staff;

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden space-y-4">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#c34c36]" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
            DANH SÁCH KỸ THUẬT VIÊN TRỰC THUỘC TRẠM
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
            {filteredStaff.length} nhân sự
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={staffSearchTerm}
              onChange={(e) => setStaffSearchTerm(e.target.value)}
              placeholder="Tìm kiếm KTV..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#c34c36] bg-slate-50/50 w-48 sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* Informative Notice */}
      <div className="mx-4 p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-blue-950">
            Phạm vi quản lý nhân sự ({filteredStaff.length} KTV trực thuộc Trung tâm)
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Hệ thống phân quyền hiển thị các Kỹ thuật viên do chính Trung tâm của bạn quản lý. Để thêm kỹ thuật viên mới cho trạm, vui lòng bấm nút <strong>"+ Cấp Tài Khoản KTV Mới"</strong> bên trên.
          </p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4 w-12">#</th>
              <th className="py-2.5 px-4">Kỹ Thuật Viên</th>
              <th className="py-2.5 px-4">Email Công Vụ</th>
              <th className="py-2.5 px-4">Số Task Đang Nhận</th>
              <th className="py-2.5 px-4">Trạng Thái</th>
              <th className="py-2.5 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingStaff ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                  <span>Đang tải danh sách nhân sự trạm...</span>
                </td>
              </tr>
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>Chưa có kỹ thuật viên nào trong trạm.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStaffError(null);
                      setCreatedStaffSuccessData(null);
                      setIsCreateStaffModalOpen(true);
                    }}
                    className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                  >
                    + Cấp tài khoản KTV mới ngay
                  </button>
                </td>
              </tr>
            ) : (
              filteredStaff.map((staff, idx) => {
                const count = staffWorkloadMap[staff.id] || 0;
                return (
                  <tr key={staff.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {staff.fullName ? staff.fullName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{staff.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {staff.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600 font-mono text-[11px]">
                      {staff.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                          }`}
                      >
                        {count} đơn
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Hoạt động
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('dispatch');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Giao Task
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
