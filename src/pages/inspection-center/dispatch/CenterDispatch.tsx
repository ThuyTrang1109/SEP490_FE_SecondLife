import {
  UserPlus,
  Clock,
  Search,
  Calendar,
  Loader2,
  Layers,
  UserCheck,
  Briefcase,
  PackageCheck,
  CalendarCheck,
  CalendarSync,
} from 'lucide-react';
import React, { type ReactNode } from 'react';
import { InspectionOrderDto } from '../../../services';
import { formatVND } from '../../../utils/translations';
import type { DispatchFilter } from '../types';
import type { useCenterAppointments } from './useCenterAppointments';
import type { useCenterDispatchQueue } from './useCenterDispatchQueue';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useInspectorAssignment } from './useInspectorAssignment';

interface Props {
  handleOpenAssign: ReturnType<typeof useInspectorAssignment>['handleOpenAssign'];
  handleOpenReviewAppointment: ReturnType<typeof useCenterAppointments>['handleOpenReviewAppointment'];
  handleReceivePackageAtHub: ReturnType<typeof useCenterOrders>['handleReceivePackageAtHub'];
  isLoadingOrders: ReturnType<typeof useCenterOrders>['isLoadingOrders'];
  renderStatusBadge: (order: InspectionOrderDto) => React.ReactNode;
  dispatch: Pick<ReturnType<typeof useCenterDispatchQueue>,
    | 'dispatchFilter'
    | 'dispatchOrders'
    | 'filteredOrders'
    | 'orderMethodFilter'
    | 'searchTerm'
    | 'setDispatchFilter'
    | 'setOrderMethodFilter'
    | 'setSearchTerm'
  >;
}

export function CenterDispatch({
  handleOpenAssign,
  handleOpenReviewAppointment,
  handleReceivePackageAtHub,
  isLoadingOrders,
  renderStatusBadge,
  dispatch,
}: Props) {
  const {
    dispatchFilter,
    dispatchOrders,
    filteredOrders,
    orderMethodFilter,
    searchTerm,
    setDispatchFilter,
    setOrderMethodFilter,
    setSearchTerm,
  } = dispatch;

  return (
    <section className="@container overflow-hidden rounded-xl border border-slate-200 border-t-4 border-t-[#c34c36] bg-white shadow-xs">
      <header className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#c34c36]/10 text-[#c34c36]">
          <Briefcase aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-sm font-extrabold text-slate-900 sm:text-base">Hàng đợi điều phối</h2>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-700">
              {dispatchOrders.length} đơn
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">Tiếp nhận kiện hàng tại Hub, giao task và đổi kỹ thuật viên phụ trách.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 @[34rem]:grid-cols-2 @[56rem]:grid-cols-[2fr_1fr_1fr]">
        <div className="relative @[34rem]:col-span-2 @[56rem]:col-span-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm đơn điều phối"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã đơn, sản phẩm, người mua hoặc người bán"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 focus-visible:outline-[#c34c36]"
          />
        </div>
        <select
          aria-label="Hình thức kiểm định"
          value={orderMethodFilter}
          onChange={(e) => setOrderMethodFilter(e.target.value as typeof orderMethodFilter)}
          className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus-visible:outline-[#c34c36]"
        >
          <option value="ALL">Tất cả hình thức</option>
          <option value="AT_CENTER">Kiểm định tại Hub</option>
          <option value="AT_HOME">Kiểm định tại nhà</option>
        </select>
        <select
          aria-label="Giai đoạn điều phối"
          value={dispatchFilter}
          onChange={(e) => setDispatchFilter(e.target.value as DispatchFilter)}
          className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus-visible:outline-[#c34c36]"
        >
          <option value="ALL">Tất cả giai đoạn</option>
          <option value="WAITING_CENTER_APPROVAL">Chờ Hub duyệt lịch hẹn (Tại nhà)</option>
          <option value="WAITING_SELLER_APPROVAL">Chờ Seller phản hồi lịch (Tại nhà)</option>
          <option value="WAITING_SELLER_APPOINTMENT">Chờ người bán hẹn lịch (Tại nhà)</option>
          <option value="WAITING_FOR_HUB">Chờ nhận hàng tại Hub</option>
          <option value="READY_TO_ASSIGN">Sẵn sàng giao KTV (Đã chốt lịch)</option>
          <option value="ASSIGNED">Đã phân công KTV</option>
        </select>
      </div>

      <table aria-label="Hàng đợi điều phối kiểm định" role="table" className="block w-full text-left text-xs @[56rem]:table @[56rem]:table-fixed">
        <thead role="rowgroup" className="hidden border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600 @[56rem]:table-header-group">
          <tr role="row">
            <th scope="col" className="w-[5%] px-2 py-3 text-center">#</th>
            <th scope="col" className="w-[31%] px-4 py-3">Sản phẩm &amp; mã đơn</th>
            <th scope="col" className="w-[14%] px-4 py-3">Hình thức &amp; phí</th>
            <th scope="col" className="w-[17%] px-4 py-3">Kỹ thuật viên</th>
            <th scope="col" className="w-[19%] px-4 py-3">Trạng thái</th>
            <th scope="col" className="w-[14%] px-4 py-3 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block divide-y divide-slate-100 @[56rem]:table-row-group">
          {isLoadingOrders || filteredOrders.length === 0 ? (
            <tr role="row" className="block @[56rem]:table-row">
              <td role="cell" colSpan={6} className="block px-4 py-12 text-center text-slate-600 @[56rem]:table-cell">
                {isLoadingOrders ? (
                  <span role="status">
                    <Loader2 aria-hidden="true" className="mx-auto mb-2 size-6 animate-spin text-[#c34c36]" />
                    Đang tải hàng đợi điều phối…
                  </span>
                ) : dispatchOrders.length === 0 ? 'Hiện chưa có đơn trong hàng đợi điều phối.' : 'Không có đơn phù hợp với bộ lọc.'}
              </td>
            </tr>
          ) : (
            filteredOrders.map(({ order, stage }, index) => {
              const thumbnail = order.postImageUrls?.[0] || order.postImageUrl;
              const assigned = Boolean(order.inspectorId);
              const inspectorName = order.inspectorName && order.inspectorName !== 'Chưa phân công'
                ? order.inspectorName : 'Kỹ thuật viên';
              const waitingForHub = stage === 'WAITING_FOR_HUB';
              const waitingSellerAppt = stage === 'WAITING_SELLER_APPOINTMENT';
              const waitingCenterApproval = stage === 'WAITING_CENTER_APPROVAL';
              const waitingSellerCounter = stage === 'WAITING_SELLER_APPROVAL';
              const actionLabel = waitingForHub
                ? 'Nhận tại Hub'
                : waitingSellerAppt
                  ? 'Chờ hẹn lịch'
                  : waitingCenterApproval
                    ? 'Duyệt lịch hẹn'
                    : waitingSellerCounter
                      ? 'Xem phản hồi'
                      : assigned
                        ? 'Đổi KTV'
                        : 'Giao task';
              const ActionIcon = waitingForHub
                ? PackageCheck
                : waitingSellerAppt
                  ? Clock
                  : waitingCenterApproval
                    ? CalendarCheck
                    : waitingSellerCounter
                      ? CalendarSync
                      : assigned
                        ? UserCheck
                        : UserPlus;
              return (
                <tr key={order.id} role="row" className="grid grid-cols-2 items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70 @[56rem]:table-row @[56rem]:p-0">
                  <td role="cell" className="hidden px-2 py-3 text-center font-mono text-slate-500 @[56rem]:table-cell">{index + 1}</td>
                  <td role="cell" className="col-span-2 min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" className="size-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <Layers aria-hidden="true" className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="line-clamp-2 break-words font-bold text-slate-900" title={order.postTitle}>{order.postTitle || 'Sản phẩm kiểm định'}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500" title={order.id}>#{order.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                    <div className="mb-0.5 text-[10px] font-bold uppercase text-slate-500 @[56rem]:hidden">Hình thức &amp; phí</div>
                    <div className="font-semibold text-slate-800">{order.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Hub'}</div>
                    {order.orderType === 'AT_HOME' && (() => {
                      let apptTime = order.appointmentScheduledAt;
                      if (typeof window !== 'undefined') {
                        const possibleIds = [order.id, (order as any).linkedOrderId, (order as any).orderId, (order as any).inspectionOrderId].filter(Boolean) as string[];
                        const idSet = new Set(possibleIds);
                        for (const pid of possibleIds) {
                          try {
                            const raw = localStorage.getItem(`order_appointment_${pid}`);
                            if (raw) {
                              const parsed = JSON.parse(raw);
                              if (parsed.status === 'PENDING_CENTER_CONFIRMATION' && parsed.scheduledAt) {
                                apptTime = parsed.scheduledAt;
                                break;
                              } else if (parsed.scheduledAt && !apptTime) {
                                apptTime = parsed.scheduledAt;
                              }
                            }
                          } catch {}
                        }
                        try {
                          const rawCenter = localStorage.getItem('center_inspection_orders');
                          if (rawCenter) {
                            const list = JSON.parse(rawCenter);
                            if (Array.isArray(list)) {
                              const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
                              if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && m.appointmentScheduledAt) {
                                apptTime = m.appointmentScheduledAt;
                              }
                            }
                          }
                        } catch {}
                        try {
                          const rawSeller = localStorage.getItem('my_seller_inspection_orders');
                          if (rawSeller) {
                            const list = JSON.parse(rawSeller);
                            if (Array.isArray(list)) {
                              const m = list.find((o: any) => idSet.has(o.id) || idSet.has(o.linkedOrderId) || idSet.has(o.orderId) || idSet.has(o.inspectionOrderId));
                              if (m && m.appointmentStatus === 'PENDING_CENTER_CONFIRMATION' && m.appointmentScheduledAt) {
                                apptTime = m.appointmentScheduledAt;
                              }
                            }
                          }
                        } catch {}
                      }
                      if (!apptTime) return null;
                      return (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 w-fit">
                          <Calendar className="size-3 text-amber-700 shrink-0" />
                          <span className="truncate">
                            {new Date(apptTime).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="mt-0.5 text-[11px] tabular-nums text-slate-600">
                      {order.inspectionFee == null ? 'Chưa có phí' : formatVND(order.inspectionFee)}
                    </div>
                  </td>
                  <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                    <div className="mb-0.5 text-[10px] font-bold uppercase text-slate-500 @[56rem]:hidden">Kỹ thuật viên</div>
                    {assigned ? (
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                          {inspectorName.charAt(0).toUpperCase()}
                        </span>
                        <span className="line-clamp-2 break-words font-semibold text-slate-800" title={inspectorName}>{inspectorName}</span>
                      </div>
                    ) : waitingSellerAppt ? (
                      <span className="font-medium text-amber-700 italic text-[11px]">Chờ người bán hẹn lịch</span>
                    ) : (
                      <span className="font-medium text-slate-600">Chưa phân công</span>
                    )}
                  </td>
                  <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3 [&_span]:whitespace-normal">
                    {renderStatusBadge(order)}
                  </td>
                  <td role="cell" className="min-w-0 text-right @[56rem]:px-4 @[56rem]:py-3 @[56rem]:text-center">
                    <button
                      type="button"
                      disabled={waitingSellerAppt}
                      onClick={() => {
                        if (waitingForHub) {
                          handleReceivePackageAtHub(order.id, order.postTitle);
                        } else if (waitingCenterApproval || waitingSellerCounter) {
                          handleOpenReviewAppointment(order);
                        } else {
                          handleOpenAssign(order);
                        }
                      }}
                      className={`inline-flex min-h-9 w-full max-w-32 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                        waitingSellerAppt
                          ? 'border-amber-200 bg-amber-50 text-amber-800 cursor-not-allowed opacity-80'
                          : waitingForHub
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                            : waitingCenterApproval
                              ? 'border-amber-500 bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-xs'
                              : waitingSellerCounter
                                ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 cursor-pointer shadow-xs'
                                : assigned
                                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer'
                                  : 'border-[#c34c36] bg-[#c34c36] text-white hover:bg-[#a63f2d] cursor-pointer'
                      }`}
                      title={
                        waitingSellerAppt
                          ? 'Người bán chưa chọn lịch hẹn tại nhà. Bạn cần đợi người bán đặt lịch trước khi duyệt và phân công KTV.'
                          : waitingCenterApproval
                            ? 'Người bán đã đề xuất lịch hẹn. Bấm để duyệt, gửi lại lịch hoặc từ chối.'
                            : waitingSellerCounter
                              ? 'Trung tâm đã gửi đề xuất lịch mới. Bấm để xem lại hoặc điều chỉnh.'
                              : undefined
                      }
                    >
                      <ActionIcon aria-hidden="true" className="size-3.5 shrink-0" />
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs tabular-nums text-slate-600 sm:px-5">
        Hiển thị {filteredOrders.length} / {dispatchOrders.length} đơn trong hàng đợi
      </footer>
    </section>
  );
}
