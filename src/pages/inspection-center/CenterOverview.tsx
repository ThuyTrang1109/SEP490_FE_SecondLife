import {
  ClipboardList,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  ArrowRight,
  Activity,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import React, { type ReactNode } from 'react';
import { InspectionOrderDto } from '../../services';
import type { CenterTab } from './types';
import type { useCenterDispatchQueue } from './dispatch/useCenterDispatchQueue';
import type { useCenterProfile } from './useCenterProfile';
import type { useCenterStaff } from './staff/useCenterStaff';
import type { useInspectorAssignment } from './dispatch/useInspectorAssignment';

interface Props {
  centerProfile: ReturnType<typeof useCenterProfile>['centerProfile'];
  handleOpenAssign: ReturnType<typeof useInspectorAssignment>['handleOpenAssign'];
  renderStatusBadge: (order: InspectionOrderDto) => React.ReactNode;
  setActiveTab: (tab: CenterTab) => void;
  dispatch: Pick<ReturnType<typeof useCenterDispatchQueue>,
    | 'openReadyDispatchQueue'
    | 'staffWorkloadMap'
    | 'stats'
    | 'urgentDispatchOrders'
  >;
  staff: Pick<ReturnType<typeof useCenterStaff>,
    | 'setCreatedStaffSuccessData'
    | 'setCreateStaffError'
    | 'setIsCreateStaffModalOpen'
    | 'staffList'
  >;
}

export function CenterOverview({
  centerProfile,
  handleOpenAssign,
  renderStatusBadge,
  setActiveTab,
  dispatch,
  staff,
}: Props) {
  const { openReadyDispatchQueue, staffWorkloadMap, stats, urgentDispatchOrders } = dispatch;
  const { setCreatedStaffSuccessData, setCreateStaffError, setIsCreateStaffModalOpen, staffList } = staff;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Center Profile Unconfigured Alert */}
      {centerProfile && !centerProfile.shippingAddressConfigured && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm text-amber-900">Trung tâm chưa hoàn tất cấu hình địa chỉ tiếp nhận & tọa độ GPS</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Quý trung tâm cần cập nhật đầy đủ số nhà, phường/xã, tỉnh/thành và xác nhận điểm ghim trên bản đồ để hệ thống có thể điều phối vận tải Lalamove và tính cước di chuyển.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition cursor-pointer shadow-xs"
          >
            Cấu hình ngay
          </button>
        </div>
      )}

      {/* ROW 1: 4 KPI STAT BOXES (MATCHING ADMIN DASHBOARD EXACT STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1: TỔNG ĐƠN KIỂM ĐỊNH */}
        <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
          <div className="p-4 sm:p-5 pr-14 relative z-10">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
              {stats.total}
            </div>
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
              TỔNG ĐƠN KIỂM ĐỊNH
            </div>
          </div>
          <ClipboardList className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <button
            onClick={() => setActiveTab('orders')}
            className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
          >
            <span>Xem lịch sử đơn</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Box 2: CHỜ GIAO TASK KTV */}
        <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
          <div className="p-4 sm:p-5 pr-14 relative z-10">
            <div className="flex items-center gap-2">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#c34c36] font-mono">
                {stats.pendingDispatch}
              </div>
              {stats.pendingDispatch > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] animate-ping" />
              )}
            </div>
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
              CHỜ GIAO TASK KTV
            </div>
          </div>
          <Clock className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <button
            onClick={openReadyDispatchQueue}
            className="w-full bg-[#c34c36] hover:bg-[#a63f2d] text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
          >
            <span>Điều phối ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Box 3: ĐANG KIỂM ĐỊNH */}
        <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
          <div className="p-4 sm:p-5 pr-14 relative z-10">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
              {stats.inspecting}
            </div>
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
              ĐANG KIỂM ĐỊNH (KTV)
            </div>
          </div>
          <Wrench className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <button
            onClick={() => setActiveTab('orders')}
            className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
          >
            <span>Xem tiến độ kiểm</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Box 4: ĐỘI NGŨ KỸ THUẬT VIÊN */}
        <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
          <div className="p-4 sm:p-5 pr-14 relative z-10">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
              {stats.totalStaff}
            </div>
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
              NHÂN SỰ KTV THUỘC TRẠM
            </div>
          </div>
          <Users className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
          <button
            onClick={() => setActiveTab('staff')}
            className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
          >
            <span>Quản lý KTV & Cấp tài khoản</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ROW 2: WORKLOAD DISTRIBUTION & STATUS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Card: Workload per Inspector */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#c34c36]" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                PHÂN BỔ TẢI CÔNG VIỆC KỸ THUẬT VIÊN
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {staffList.length} nhân sự
            </span>
          </div>

          <div className="p-4 space-y-3">
            {staffList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>Trạm chưa có kỹ thuật viên nào trực thuộc.</p>
                <button
                  onClick={() => {
                    setCreateStaffError(null);
                    setCreatedStaffSuccessData(null);
                    setIsCreateStaffModalOpen(true);
                  }}
                  className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                >
                  + Cấp tài khoản KTV ngay
                </button>
              </div>
            ) : (
              staffList.map((st) => {
                const count = (staffWorkloadMap[st.id] || 0) + (st.email ? (staffWorkloadMap[st.email] || 0) : 0);
                const pct = Math.min(100, Math.round((count / 5) * 100));
                return (
                  <div key={st.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-[10px]">
                          {st.fullName ? st.fullName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <span className="font-bold text-slate-800 truncate">{st.fullName}</span>
                        <span className="text-[11px] text-slate-400 truncate hidden sm:inline">({st.email})</span>
                      </div>
                      <span className="font-bold font-mono text-slate-700 text-xs shrink-0">
                        {count} đơn đang nhận
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${count >= 4
                          ? 'bg-rose-500'
                          : count >= 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          }`}
                        style={{ width: `${count === 0 ? 0 : Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Status Structure */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#24263e]" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                CƠ CẤU TRẠNG THÁI KIỂM ĐỊNH CỦA TRẠM
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              {stats.evaluatedCount > 0 ? `Tỷ lệ đạt ${stats.passRate}%` : 'Chưa có nghiệm thu'}
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-amber-900">Chờ điều phối giao task cho KTV</span>
              </div>
              <strong className="font-mono text-amber-700 text-sm font-black">{stats.pendingDispatch} đơn</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-blue-900">Đang thực hiện kiểm tra</span>
              </div>
              <strong className="font-mono text-blue-700 text-sm font-black">{stats.inspecting} đơn</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-emerald-900">Đạt tiêu chuẩn kiểm định (Pass)</span>
              </div>
              <strong className="font-mono text-emerald-700 text-sm font-black">{stats.passed} đơn</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span className="font-bold text-rose-900">Từ chối nghiệm thu (Fail)</span>
              </div>
              <strong className="font-mono text-rose-700 text-sm font-black">{stats.failed} đơn</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-700">Đơn đã hủy</span>
              </div>
              <strong className="font-mono text-slate-700 text-sm font-black">{stats.cancelled} đơn</strong>
            </div>

            {stats.waitingApproval > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-purple-900">Chờ người bán duyệt / Đóng phí cọc</span>
                </div>
                <strong className="font-mono text-purple-700 text-sm font-black">{stats.waitingApproval} đơn</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: RECENT ORDERS NEEDING DISPATCH (QUICK DISPATCH TABLE) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-amber-500 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
              HÀNG ĐỢI ĐƠN HÀNG CẦN GIAO TASK GẤP
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
              {stats.pendingDispatch} đơn chờ
            </span>
          </div>
          <button
            onClick={openReadyDispatchQueue}
            className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Vào bảng điều phối</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-4 w-[32%] min-w-[220px]">Mã Đơn & Sản Phẩm</th>
                <th className="py-2.5 px-3 w-[14%] min-w-[120px]">Hình Thức</th>
                <th className="py-2.5 px-3 w-[18%] min-w-[150px]">Người Bán / Mua</th>
                <th className="py-2.5 px-3 w-[20%] min-w-[160px]">Trạng Thái</th>
                <th className="py-2.5 px-4 w-[16%] min-w-[130px] text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {urgentDispatchOrders.slice(0, 5).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tuyệt vời! Hiện tại không có đơn nào đang chờ phân công KTV.
                  </td>
                </tr>
              ) : (
                urgentDispatchOrders
                  .slice(0, 5)
                  .map((order, idx) => {
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px] text-center">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 truncate" title={order.postTitle}>{order.postTitle}</div>
                          <div className="text-[10px] font-mono text-slate-400">ID: #{(order.id || '').slice(0, 8)}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                            {order.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600">
                          <div>Bán: {order.sellerName || 'Người bán'}</div>
                          <div>Mua: {order.buyerName || 'Khách mua'}</div>
                        </td>
                        <td className="py-3 px-3">{renderStatusBadge(order)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAssign(order)}
                            className="cursor-pointer rounded-lg bg-[#c34c36] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#a63f2d]"
                          >
                            Giao Task Ngay
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
    </div>
  );
}
