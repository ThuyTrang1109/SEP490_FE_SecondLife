import { getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from './orderContacts';
import {
  UserPlus,
  CheckCircle2,
  Clock,
  Calendar,
  Loader2,
  X,
  Layers,
  Info,
  Package,
  PackageCheck,
  CalendarSync,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { formatVND } from '../../../utils/translations';
import type { CenterTab } from '../types';
import type { useCenterAppointments } from './useCenterAppointments';
import type { useCenterDispatchQueue } from './useCenterDispatchQueue';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useCenterShipments } from '../orders/useCenterShipments';
import type { useCenterStaff } from '../staff/useCenterStaff';
import type { useInspectorAssignment } from './useInspectorAssignment';

interface Props {
  assignModalOrder: NonNullable<ReturnType<typeof useInspectorAssignment>['assignModalOrder']>;
  handleOpenReviewAppointment: ReturnType<typeof useCenterAppointments>['handleOpenReviewAppointment'];
  handleReceivePackageAtHub: ReturnType<typeof useCenterOrders>['handleReceivePackageAtHub'];
  isOrderReceivedAtHub: ReturnType<typeof useCenterShipments>['isOrderReceivedAtHub'];
  setActiveTab: (tab: CenterTab) => void;
  staffList: ReturnType<typeof useCenterStaff>['staffList'];
  staffWorkloadMap: ReturnType<typeof useCenterDispatchQueue>['staffWorkloadMap'];
  assignment: Pick<ReturnType<typeof useInspectorAssignment>,
    | 'assignError'
    | 'assignNote'
    | 'handleConfirmAssign'
    | 'isAssigning'
    | 'selectedInspectorId'
    | 'setAssignError'
    | 'setAssignModalOrder'
    | 'setAssignNote'
    | 'setSelectedInspectorId'
  >;
}

export function AssignInspectorModal({
  assignModalOrder,
  handleOpenReviewAppointment,
  handleReceivePackageAtHub,
  isOrderReceivedAtHub,
  setActiveTab,
  staffList,
  staffWorkloadMap,
  assignment,
}: Props) {
  const {
    assignError,
    assignNote,
    handleConfirmAssign,
    isAssigning,
    selectedInspectorId,
    setAssignError,
    setAssignModalOrder,
    setAssignNote,
    setSelectedInspectorId,
  } = assignment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl sm:max-w-2xl lg:max-w-3xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto subtle-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#24263e]">Phân Công Kỹ Thuật Viên Kiểm Định</h3>
              <p className="text-[11px] text-gray-400">
                {assignModalOrder.orderType === 'AT_HOME'
                  ? 'Giao task kiểm tra và ấn định lịch hẹn khảo sát tại nhà khách'
                  : 'Giao task kiểm tra kỹ thuật tại trạm Lab Hub'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAssignModalOrder(null)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Brief Summary Card */}
        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
          <div className="flex items-start gap-3">
            {assignModalOrder.postImageUrls && assignModalOrder.postImageUrls[0] ? (
              <img
                src={assignModalOrder.postImageUrls[0]}
                alt="Item"
                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              <div className="text-[10px] font-mono font-bold text-gray-400">
                MÃ ĐƠN: #{assignModalOrder.id}
              </div>
              <h4 className="font-extrabold text-gray-900 truncate">
                {assignModalOrder.postTitle || 'Thiết bị'}
              </h4>
              <div className="text-[#c34c36] font-mono font-bold text-xs">
                {formatVND(assignModalOrder.postPrice || 0)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-[11px]">
            <div>
              <span className="text-gray-400">Hình thức: </span>
              <strong className="text-gray-800">
                {assignModalOrder.orderType === 'AT_HOME' ? 'Tại Nhà Khách (Tận Nơi)' : 'Tại Lab Hub (Trung Tâm)'}
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Phí kiểm định: </span>
              <strong className="text-[#c34c36] font-mono">
                {formatVND(assignModalOrder.inspectionFee || (assignModalOrder.orderType === 'AT_HOME' ? 200000 : 120000))}
              </strong>
            </div>
          </div>
        </div>

        {/* Info note if order is waiting fee payment */}
        {assignModalOrder.status === 'WAITING_FEE_PAYMENT' && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Người bán đã đồng ý kiểm định</div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Đơn hàng đã được xác nhận kiểm định và sẵn sàng bàn giao. Bạn có thể phân công Kỹ thuật viên tiếp nhận và khảo sát ngay.
              </p>
            </div>
          </div>
        )}
        {assignModalOrder.status === 'WAITING_SELLER_APPROVAL' && (
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Chờ người bán đồng ý kiểm định</div>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                Người bán chưa xác nhận đồng ý yêu cầu kiểm định từ người mua.
              </p>
            </div>
          </div>
        )}
        {(assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED') && (
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-rose-800">Đơn kiểm định đã bị hủy</div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Đơn hàng này đã bị hủy, không thể phân công hay giao task cho kỹ thuật viên.
              </p>
            </div>
          </div>
        )}

        {/* Thông báo điều kiện nhận hàng đối với đơn tại Hub */}
        {assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder) && (
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex flex-col gap-2.5 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-900">Kiện hàng chưa được tiếp nhận tại Lab Hub</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Đơn kiểm định tại trạm Lab Hub cần nhận kiện hàng thực tế trước khi phân công KTV đo kiểm. Nếu bưu tá vừa bàn giao kiện hàng đến quầy, bạn có thể bấm xác nhận nhận hàng ngay bên dưới để mở khóa giao task.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleReceivePackageAtHub(assignModalOrder.id, assignModalOrder.postTitle);
                  setAssignModalOrder((prev) => (prev ? { ...prev, status: 'CONFIRMED_PENDING_DISPATCH' } : null));
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Xác Nhận Đã Nhận Hàng Tại Hub Ngay</span>
              </button>
            </div>
          </div>
        )}

        {/* Chi tiết lịch hẹn đối với đơn kiểm định tại nhà */}
        {assignModalOrder.orderType === 'AT_HOME' && (
          (() => {
            let apptTime = assignModalOrder.appointmentScheduledAt;
            let apptNote = assignModalOrder.appointmentNote;
            if (!apptTime && typeof window !== 'undefined') {
              try {
                const raw = localStorage.getItem(`order_appointment_${assignModalOrder.id}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  apptTime = parsed.scheduledAt;
                  apptNote = parsed.note;
                }
              } catch { }
            }

            if (!apptTime) {
              return (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900">Người bán chưa đặt lịch hẹn đón KTV</div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Đơn hàng này người bán chưa chọn ngày giờ tiếp đón Kỹ thuật viên. Bạn cần đợi người bán đặt lịch trước để phân công KTV theo ca làm việc (08:00 - 12:00 hoặc 13:00 - 17:00).
                    </p>
                  </div>
                </div>
              );
            }

            const d = new Date(apptTime);
            const isMorning = d.getHours() < 12;

            return (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300 text-xs text-amber-950 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-black text-amber-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wide">
                    <Calendar className="w-4 h-4 text-amber-700" />
                    Lịch Hẹn Người Bán Yêu Cầu (Đã Xác Nhận):
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                    {isMorning ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian KTV có mặt:</span>
                    <span className="font-black text-amber-900 text-sm">
                      🕒 {d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Địa chỉ khảo sát thực tế (Nhà Người Bán):</span>
                    <span className="font-extrabold text-slate-800 text-xs block leading-snug">
                      📍 {getOrderSellerAddress(assignModalOrder)}
                    </span>
                    <div className="text-[11px] text-slate-600 font-medium flex items-center gap-2 pt-0.5">
                      <span>👤 {getOrderSellerName(assignModalOrder)}</span>
                      <span>📞 {getOrderSellerPhone(assignModalOrder)}</span>
                    </div>
                  </div>
                </div>
                {apptNote && (
                  <div className="text-[11px] text-amber-900 italic bg-white/80 p-2.5 rounded-lg border border-amber-200">
                    💬 <strong>Ghi chú từ người bán:</strong> {apptNote}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Assign Fields */}
        <div className="space-y-4">
          {/* Select Inspector */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#24263e] flex items-center justify-between">
              <span>
                Chọn kỹ thuật viên phụ trách: <strong className="text-rose-500">*</strong>
              </span>
              <span className="text-[11px] font-normal text-gray-500">
                ({staffList.length} nhân sự trạm)
              </span>
            </label>

            {staffList.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                Trung tâm chưa có kỹ thuật viên nào. Vui lòng cấp tài khoản ở trang{' '}
                <button
                  type="button"
                  className="cursor-pointer font-bold underline"
                  onClick={() => {
                    setAssignModalOrder(null);
                    setActiveTab('staff');
                  }}
                >
                  Đội ngũ kỹ thuật viên
                </button>.
              </div>
            ) : (
              <>
                <select
                  value={selectedInspectorId}
                  onChange={(e) => setSelectedInspectorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-gray-50/50"
                >
                  <option value="">-- Chọn kỹ thuật viên --</option>
                  {staffList.map((st) => {
                    const count = staffWorkloadMap[st.id] || 0;
                    return (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.email}) — Đang có {count} task
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Danh sách hiển thị các KTV trực thuộc Trung tâm quản lý.
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Dispatch note */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#24263e]">Ghi Chú Hướng Dẫn Kỹ Thuật Cho KTV:</label>
            <textarea
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              rows={2}
              placeholder="Lưu ý mang đồng hồ đo gas R600a, kiểm tra kỹ gioăng từ hít và bo mạch điều khiển..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
            />
          </div>
          {/* Error Alert inside Modal */}
          {assignError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">Không Thể Xác Nhận Giao Task</div>
                <p className="text-[11px] leading-relaxed text-rose-700">{assignError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        {(() => {
          const modalApptTime = assignModalOrder.appointmentScheduledAt || (() => {
            if (typeof window !== 'undefined') {
              try {
                const raw = localStorage.getItem(`order_appointment_${assignModalOrder.id}`);
                if (raw) return JSON.parse(raw).scheduledAt;
              } catch { }
            }
            return null;
          })();
          const isAtHomeMissingAppt = assignModalOrder.orderType === 'AT_HOME' && !modalApptTime;

          return (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div className="text-[11px] text-gray-500 font-medium">
                {assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED' ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Đơn kiểm định đã bị hủy
                  </span>
                ) : assignModalOrder.status === 'WAITING_SELLER_APPROVAL' ? (
                  <span className="text-purple-700 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Chờ người bán duyệt
                  </span>
                ) : isAtHomeMissingAppt ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    Chờ người bán hẹn lịch
                  </span>
                ) : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder) ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    Chờ nhận hàng tại Hub
                  </span>
                ) : !selectedInspectorId ? (
                  <span className="text-rose-600 font-semibold">
                    * Vui lòng chọn KTV trước
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {assignModalOrder.orderType === 'AT_HOME' ? 'Lịch hẹn hợp lệ · Sẵn sàng giao task' : 'Sẵn sàng phân công'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 flex-wrap">
                {assignModalOrder.orderType === 'AT_HOME' && (
                  <button
                    type="button"
                    onClick={() => {
                      const orderToReview = assignModalOrder;
                      setAssignModalOrder(null);
                      handleOpenReviewAppointment(orderToReview);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer flex items-center gap-1.5"
                    title="Đổi lại lịch hẹn hoặc thương lượng lại với người bán"
                  >
                    <CalendarSync className="w-4 h-4 text-amber-600" />
                    <span>Đổi Lịch Hẹn</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOrder(null);
                    setAssignError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAssign}
                  disabled={
                    isAssigning ||
                    !selectedInspectorId ||
                    assignModalOrder.status === 'CANCELLED' ||
                    assignModalOrder.status === 'CANCELED' ||
                    isAtHomeMissingAppt ||
                    (assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder))
                  }
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md ${isAssigning ||
                    !selectedInspectorId ||
                    assignModalOrder.status === 'CANCELLED' ||
                    assignModalOrder.status === 'CANCELED' ||
                    isAtHomeMissingAppt ||
                    (assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder))
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                    : 'bg-[#c34c36] hover:bg-[#a63f2d] text-white cursor-pointer'
                    }`}
                  title={
                    assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED'
                      ? 'Đơn hàng đã bị hủy, không thể giao task'
                      : isAtHomeMissingAppt
                        ? 'Người bán chưa chọn lịch hẹn tại nhà. Bạn cần đợi người bán đặt lịch trước khi phân công KTV.'
                        : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder)
                          ? 'Hub chưa nhận được hàng thực tế từ người bán, vui lòng bấm "Xác Nhận Đã Nhận Hàng Tại Hub" trước khi giao task'
                          : 'Xác nhận phân công KTV'
                  }
                >
                  {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED'
                      ? 'Đã Hủy - Không Thể Giao'
                      : isAtHomeMissingAppt
                        ? 'Chờ Người Bán Hẹn Lịch'
                        : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder)
                          ? 'Chờ Nhận Hàng Tại Hub Để Giao Task'
                          : assignModalOrder.orderType === 'AT_HOME'
                            ? 'Xác Nhận & Giao Task Cho KTV'
                            : 'Xác nhận phân công'}
                  </span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
