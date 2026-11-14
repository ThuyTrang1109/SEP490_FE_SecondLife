import { ClipboardList, ChevronDown, Loader2, Eye, Check, Truck, RotateCcw } from 'lucide-react';
import React, { type ReactNode } from 'react';
import { LalamoveProgress } from '../../../components/common/LalamoveProgress';
import { CenterInspectionFees, CenterInspectionFeeStatus } from '../../../components/inspection/CenterInspectionFees';
import { InspectionCashShipmentStatus } from '../../../components/inspection/InspectionCashShipmentStatus';
import { InspectionOrderDto } from '../../../services';
import { UserProfile } from '../../../types';
import {
  canBookHubBuyerDelivery,
  canReadCenterInspectionShipments,
  getHubBuyerShipmentLabel,
  getInboundShipmentProgress,
  isPaidHubBuyerDelivery,
  shouldTrackInboundShipment,
  getHubReturnProgress,
  isCenterReturnEligible,
  isHubReturnCase,
} from '../../../utils/inspectionCenterData';
import { centerFeeFilters, type CenterFeeFilter } from '../../../utils/inspectionCenterFees';
import { getInspectionTaskStage } from '../../../utils/inspectionTaskStatus';
import { formatVND } from '../../../utils/translations';
import type { useCenterInspectionCertificate } from './useCenterInspectionCertificate';
import type { useCenterOrderHistory } from './useCenterOrderHistory';
import type { useCenterOrders } from './useCenterOrders';
import type { useCenterShipments } from './useCenterShipments';

interface Props {
  currentUser: UserProfile | null | undefined;
  handleOpenInspectionCertificate: ReturnType<typeof useCenterInspectionCertificate>['handleOpenInspectionCertificate'];
  isLoadingOrders: ReturnType<typeof useCenterOrders>['isLoadingOrders'];
  loadingCertificateId: ReturnType<typeof useCenterInspectionCertificate>['loadingCertificateId'];
  renderStatusBadge: (order: InspectionOrderDto) => React.ReactNode;
  visibleOrderHistory: ReturnType<typeof useCenterOrders>['visibleOrderHistory'];
  shipments: Pick<ReturnType<typeof useCenterShipments>,
    | 'bookingBuyerOrderId'
    | 'bookingReturnId'
    | 'buyerShipments'
    | 'deniedShipmentOrders'
    | 'expandedBuyerOrderId'
    | 'expandedInboundOrderId'
    | 'expandedReturnOrderId'
    | 'handleBookBuyerDelivery'
    | 'handleOpenShipmentModal'
    | 'hubReturns'
    | 'inboundShipments'
    | 'isOrderReceivedAtHub'
    | 'setExpandedBuyerOrderId'
    | 'setExpandedInboundOrderId'
    | 'setExpandedReturnOrderId'
    | 'setReturnQuoteOrder'
  >;
  orderHistory: Pick<ReturnType<typeof useCenterOrderHistory>,
    | 'expandedFeeOrderId'
    | 'feeFilter'
    | 'orderHistoryRows'
    | 'setExpandedFeeOrderId'
    | 'setFeeFilter'
  >;
}

export function CenterOrders({
  currentUser,
  handleOpenInspectionCertificate,
  isLoadingOrders,
  loadingCertificateId,
  renderStatusBadge,
  visibleOrderHistory,
  shipments,
  orderHistory,
}: Props) {
  const {
    bookingBuyerOrderId,
    bookingReturnId,
    buyerShipments,
    deniedShipmentOrders,
    expandedBuyerOrderId,
    expandedInboundOrderId,
    expandedReturnOrderId,
    handleBookBuyerDelivery,
    handleOpenShipmentModal,
    hubReturns,
    inboundShipments,
    isOrderReceivedAtHub,
    setExpandedBuyerOrderId,
    setExpandedInboundOrderId,
    setExpandedReturnOrderId,
    setReturnQuoteOrder,
  } = shipments;
  const { expandedFeeOrderId, feeFilter, orderHistoryRows, setExpandedFeeOrderId, setFeeFilter } = orderHistory;

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden space-y-4">
      <div className="px-4 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#24263e] shrink-0" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
            TOÀN BỘ LỊCH SỬ ĐƠN KIỂM ĐỊNH CỦA TRUNG TÂM
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
            {orderHistoryRows.length} đơn
          </span>
        </div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
          Lọc theo thu phí
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            value={feeFilter}
            onChange={(event) => setFeeFilter(event.target.value as CenterFeeFilter | 'all')}
          >
            <option value="all">Tất cả</option>
            {Object.entries(centerFeeFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {visibleOrderHistory?.refreshFailed && (
        <p role="alert" className="mx-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tải dữ liệu thu phí thất bại. Bấm Làm mới để thử lại.
        </p>
      )}
      {visibleOrderHistory && visibleOrderHistory.total > visibleOrderHistory.items.length && (
        <p className="mx-4 text-xs text-slate-600">Bộ lọc áp dụng cho {visibleOrderHistory.items.length} đơn gần nhất trong tổng số {visibleOrderHistory.total} đơn.</p>
      )}

      <div className="overflow-x-auto">
        <table role="table" className="block w-full text-left text-xs xl:table">
          <thead role="rowgroup" className="block xl:table-header-group">
            <tr role="row" className="grid grid-cols-2 bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider md:grid-cols-3 xl:table-row">
              <th role="columnheader" className="hidden py-2.5 px-3 text-center xl:table-cell">#</th>
              <th role="columnheader" className="py-2.5 px-4 xl:w-[22%]">Mã Đơn & Sản Phẩm</th>
              <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[15%]">Người Bán / Khách Mua</th>
              <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[9%]">Hình Thức</th>
              <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[11%]">Kỹ Thuật Viên</th>
              <th role="columnheader" className="py-2.5 px-4 xl:w-[24%]">Trạng thái đơn</th>
              <th role="columnheader" className="hidden py-2.5 px-4 md:block xl:table-cell xl:w-[16%]">Thanh toán kiểm định</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block divide-y divide-slate-100 xl:table-row-group">
            {orderHistoryRows.length === 0 ? (
              <tr role="row" className="block xl:table-row">
                <td role="cell" colSpan={7} className="block py-12 text-center text-slate-500 xl:table-cell">
                  {isLoadingOrders || !visibleOrderHistory ? 'Đang tải danh sách đơn kiểm định…'
                    : visibleOrderHistory.refreshFailed && visibleOrderHistory.items.length === 0 ? 'Chưa tải được danh sách đơn.'
                      : feeFilter !== 'all' ? 'Không có đơn phù hợp với bộ lọc thu phí.'
                        : 'Chưa có đơn kiểm định nào trong lịch sử trạm.'}
                </td>
              </tr>
            ) : (
              orderHistoryRows.map(({ order: ord, fees, collectionClosed, isReturning }, idx) => {
                const shipment = inboundShipments.get(ord.id);
                const buyerShipment = buyerShipments.get(ord.id);
                const isAtCenter = ord.orderType === 'AT_CENTER' || !ord.orderType || (ord as any).inspectionMethod === 'AT_CENTER';
                const paidHubDelivery = isPaidHubBuyerDelivery(ord);
                const hasCertificate = getInspectionTaskStage(ord.status) === 'completed';
                const canViewInbound = isAtCenter && !paidHubDelivery && !isHubReturnCase(ord) &&
                  (shouldTrackInboundShipment(ord) || hasCertificate) &&
                  canReadCenterInspectionShipments(ord, currentUser?.id) && !deniedShipmentOrders.has(ord.id);
                const returnState = hubReturns.get(ord.id);
                const returnShipment = returnState?.shipment;
                const canBookReturn = returnState?.received && canBookHubBuyerDelivery(returnShipment) &&
                  isCenterReturnEligible(ord, currentUser?.id, currentUser?.role);
                const progress = shipment ? getInboundShipmentProgress(shipment) : null;

                // Xác định xem kiện hàng từ Seller về Hub đã hoàn thành giao hay chưa
                const isInboundDelivered = Boolean(
                  isAtCenter && (
                    (shipment && (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED' || shipment.providerStatus === 'COMPLETED')) ||
                    progress?.step === 3 ||
                    isOrderReceivedAtHub(ord)
                  )
                );

                // Tự động ẩn / thu gọn tiến trình Chặng 1 sau 15 phút từ lúc nhận hàng tại Hub
                const isInboundOver15Min = Boolean(
                  isInboundDelivered && (() => {
                    if (returnShipment || buyerShipment) return true;
                    const rawDelivered = shipment?.deliveredAt || (shipment as any)?.completedAt || (shipment as any)?.updatedAt || ord.updatedAt || ord.createdAt;
                    if (rawDelivered) {
                      const ts = new Date(rawDelivered).getTime();
                      if (!isNaN(ts) && (Date.now() - ts > 15 * 60 * 1000)) return true;
                    }
                    if (typeof window !== 'undefined' && ord.id) {
                      const key = `inbound_delivered_ts_${ord.id}`;
                      const stored = localStorage.getItem(key);
                      if (stored) {
                        const storedTs = Number(stored);
                        if (!isNaN(storedTs) && (Date.now() - storedTs > 15 * 60 * 1000)) return true;
                      } else {
                        if (hasCertificate) {
                          localStorage.setItem(key, String(Date.now() - 20 * 60 * 1000));
                          return true;
                        }
                        localStorage.setItem(key, String(Date.now()));
                      }
                    }
                    return false;
                  })()
                );

                const isExpandedInbound = expandedInboundOrderId === ord.id;
                const isExpandedReturn = expandedReturnOrderId === ord.id;
                const isExpandedBuyer = expandedBuyerOrderId === ord.id;
                const isExpandedFees = expandedFeeOrderId === ord.id;
                const hasAnyExpanded = isExpandedFees || isExpandedInbound || isExpandedReturn || isExpandedBuyer;
                const inboundProgressId = `inbound-progress-${ord.id}`;
                const returnProgressId = `return-progress-${ord.id}`;
                const buyerProgressId = `buyer-progress-${ord.id}`;
                const feeDetailsId = `fee-details-${ord.id}`;
                const hasInboundInfo = isAtCenter && (shipment || progress || shouldTrackInboundShipment(ord) || canViewInbound || isInboundDelivered);

                return (
                  <React.Fragment key={ord.id}>
                    <tr
                      role="row"
                      className={`grid grid-cols-2 transition md:grid-cols-3 xl:table-row ${hasAnyExpanded
                        ? 'bg-amber-50/30 border-l-4 border-l-[#c34c36] shadow-xs'
                        : 'hover:bg-slate-50/60'
                        }`}
                    >
                      <td role="cell" className="hidden py-3 px-3 font-mono text-slate-400 text-[11px] text-center xl:table-cell">{idx + 1}</td>
                      <td role="cell" className="min-w-0 py-3 px-4">
                        <div className="break-words font-bold text-slate-900" title={ord.postTitle}>{ord.postTitle}</div>
                        <div className="break-all text-[10px] font-mono text-slate-400">ID: #{ord.id}</div>
                        <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                          {formatVND(ord.postPrice || 0)}
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 xl:hidden">
                          <div>Bán: {ord.sellerName || 'Người bán'}</div>
                          <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                          <div>{ord.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Hub'} · {ord.inspectorName || 'Chưa phân công KTV'}</div>
                        </div>
                      </td>
                      <td role="cell" className="hidden py-3 px-4 text-[11px] text-slate-600 xl:table-cell">
                        <div>Bán: {ord.sellerName || 'Người bán'}</div>
                        <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                      </td>
                      <td role="cell" className="hidden py-3 px-4 text-[11px] xl:table-cell">
                        {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                      </td>
                      <td role="cell" className="hidden py-3 px-4 xl:table-cell">
                        {ord.inspectorName ? (
                          <span className="font-bold text-slate-800">{ord.inspectorName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân công</span>
                        )}
                      </td>
                      <td role="cell" className="min-w-0 py-3 px-4 [&_span]:whitespace-normal space-y-2">
                        {/* 1. Trạng thái biên bản kiểm định & Nút xem biên bản */}
                        <div className="flex flex-wrap items-center gap-2">
                          {renderStatusBadge(ord)}
                          {hasCertificate && (
                            <button
                              type="button"
                              onClick={() => void handleOpenInspectionCertificate(ord.id)}
                              disabled={loadingCertificateId !== null}
                              aria-busy={loadingCertificateId === ord.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-wait shadow-2xs cursor-pointer"
                            >
                              {loadingCertificateId === ord.id
                                ? <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
                                : <Eye aria-hidden="true" className="size-3.5 shrink-0" />}
                              Xem biên bản
                            </button>
                          )}
                        </div>

                        {/* 2. CHẶNG 1: VẬN CHUYỂN TỪ NGƯỜI BÁN VỀ HUB (KIỂM ĐỊNH) */}
                        {hasInboundInfo && (
                          <div className={`rounded-xl border p-2.5 text-[11px] transition-all shadow-2xs ${isInboundOver15Min
                            ? 'border-blue-200/80 bg-blue-50/40 text-slate-700'
                            : 'border-blue-200 bg-blue-50/70 text-blue-950'
                            }`}>
                            <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold">
                              <span className="flex items-center gap-1.5 text-blue-950">
                                <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                Chặng 1: Người bán → Hub
                              </span>
                              {isInboundOver15Min ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                                  <Check className="h-3 w-3" />
                                  Đã nhận tại Hub (&gt;15 phút)
                                </span>
                              ) : (
                                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                                  {progress?.label || (isInboundDelivered ? 'Đã nhận tại Hub' : 'Đang điều phối')}
                                </span>
                              )}
                            </div>

                            {shipment && <InspectionCashShipmentStatus shipment={shipment} />}
                            {shipment?.orderCode && (
                              <div className="mt-1 font-mono text-[10px] text-slate-600">
                                Lalamove #{shipment.orderCode}
                              </div>
                            )}

                            {shouldTrackInboundShipment(ord) && !shipment &&
                              (!canReadCenterInspectionShipments(ord, currentUser?.id) || deniedShipmentOrders.has(ord.id)) && (
                                <div className="mt-1 text-[10px] text-slate-500">
                                  {ord.inspectionCenterId ? 'Trung tâm chưa có quyền xem vận đơn.' : 'Đơn chưa gắn trung tâm tiếp nhận.'}
                                </div>
                              )}

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {canViewInbound && (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenShipmentModal(ord)}
                                  className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline cursor-pointer"
                                >
                                  <Eye className="h-3 w-3" />
                                  Vận đơn về Hub
                                </button>
                              )}
                              {progress && (
                                <button
                                  type="button"
                                  aria-expanded={isExpandedInbound}
                                  aria-controls={isExpandedInbound ? inboundProgressId : undefined}
                                  onClick={() => setExpandedInboundOrderId(isExpandedInbound ? null : ord.id)}
                                  className="inline-flex items-center gap-1 font-bold text-blue-800 hover:underline focus-visible:outline-blue-700 cursor-pointer"
                                >
                                  {isInboundOver15Min ? (
                                    <>
                                      <RotateCcw className="h-3 w-3" />
                                      {isExpandedInbound ? 'Ẩn tiến trình Chặng 1' : 'Mở lại xem tiến trình Chặng 1 (Seller → Hub)'}
                                    </>
                                  ) : (
                                    <>
                                      {isExpandedInbound ? 'Ẩn tiến trình' : 'Xem tiến trình'}
                                    </>
                                  )}
                                  <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedInbound ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. CHẶNG HOÀN TRẢ: HUB ➔ NGƯỜI BÁN (KHI ĐƠN KHÔNG ĐẠT / TỪ CHỐI) */}
                        {(canBookReturn || returnShipment) && (
                          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-2.5 text-[11px] shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold text-amber-950">
                              <span className="flex items-center gap-1.5">
                                <RotateCcw className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                Chặng Hoàn Trả: Hub → Người bán
                              </span>
                              {returnShipment ? (
                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                  {getHubReturnProgress(returnShipment).label}
                                </span>
                              ) : (
                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Chờ hoàn trả
                                </span>
                              )}
                            </div>

                            {canBookReturn && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  disabled={bookingReturnId !== null}
                                  onClick={() => setReturnQuoteOrder(ord)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-800 disabled:opacity-60 transition cursor-pointer"
                                >
                                  <Truck className="h-3.5 w-3.5" />
                                  {bookingReturnId === ord.id ? 'Đang xử lý…' : 'Tạo vận đơn trả Seller'}
                                </button>
                              </div>
                            )}

                            {returnShipment && (
                              <div className="mt-1.5 space-y-1.5">
                                <InspectionCashShipmentStatus shipment={returnShipment} />
                                {returnShipment.status === 'DELIVERED' && ord.cashShippingSimulation === false && !returnShipment.cashPayerId && (
                                  <p className="text-[11px] text-amber-900">Cước hoàn đối soát từ khoản dự phòng. Phần dư hoàn cho bên đã nộp.</p>
                                )}
                                <div className="font-mono text-[10px] text-slate-700">
                                  Mã vận đơn: <span className="font-bold">{returnShipment.orderCode ? `#${returnShipment.orderCode}` : `#${returnShipment.shipmentId}`}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenShipmentModal(ord)}
                                    className="font-bold text-amber-800 hover:underline cursor-pointer"
                                  >
                                    Chi tiết vận đơn
                                  </button>
                                  <button
                                    type="button"
                                    aria-expanded={isExpandedReturn}
                                    aria-controls={isExpandedReturn ? returnProgressId : undefined}
                                    onClick={() => setExpandedReturnOrderId(isExpandedReturn ? null : ord.id)}
                                    className="inline-flex items-center gap-1 font-bold text-amber-800 hover:underline cursor-pointer"
                                  >
                                    {isExpandedReturn ? 'Ẩn tiến trình' : 'Xem tiến trình hoàn trả'}
                                    <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedReturn ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. CHẶNG GIAO HÀNG: HUB ➔ NGƯỜI MUA (KHI ĐƠN ĐẠT CHUẨN) */}
                        {(paidHubDelivery || buyerShipment) && (
                          <div className="rounded-xl border border-teal-300 bg-teal-50/70 p-2.5 text-[11px] shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold text-teal-950">
                              <span className="flex items-center gap-1.5">
                                <Truck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                Chặng Giao Hàng: Hub → Người mua
                              </span>
                              {buyerShipment && (
                                <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-900 border border-teal-300">
                                  {getHubBuyerShipmentLabel(buyerShipment)}
                                </span>
                              )}
                            </div>

                            {canBookHubBuyerDelivery(buyerShipment) ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  disabled={bookingBuyerOrderId !== null}
                                  onClick={() => void handleBookBuyerDelivery(ord)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-60 transition cursor-pointer"
                                >
                                  <Truck className="h-3.5 w-3.5" />
                                  {bookingBuyerOrderId === ord.id ? 'Đang xử lý…' : 'Tạo vận đơn giao người mua'}
                                </button>
                              </div>
                            ) : buyerShipment && (
                              <div className="mt-1.5 space-y-1.5">
                                <div className="font-mono text-[10px] text-slate-700">
                                  Mã vận đơn: <span className="font-bold">{buyerShipment.orderCode ? `#${buyerShipment.orderCode}` : `#${buyerShipment.shipmentId}`}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenShipmentModal(ord)}
                                    className="font-bold text-teal-800 hover:underline cursor-pointer"
                                  >
                                    Chi tiết vận đơn
                                  </button>
                                  <button
                                    type="button"
                                    aria-expanded={isExpandedBuyer}
                                    aria-controls={isExpandedBuyer ? buyerProgressId : undefined}
                                    onClick={() => setExpandedBuyerOrderId(isExpandedBuyer ? null : ord.id)}
                                    className="inline-flex items-center gap-1 font-bold text-teal-800 hover:underline cursor-pointer"
                                  >
                                    {isExpandedBuyer ? 'Ẩn tiến trình' : 'Xem tiến trình giao hàng'}
                                    <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedBuyer ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td role="cell" className="col-span-2 min-w-0 space-y-1.5 border-t border-slate-100 px-4 py-3 align-top md:col-span-1 md:border-t-0">
                        <div className="font-bold text-slate-600 md:hidden">Thanh toán kiểm định</div>
                        <CenterInspectionFeeStatus fees={fees} collectionClosed={collectionClosed} isReturning={isReturning} hasResult={hasCertificate} />
                        <button
                          type="button"
                          aria-expanded={isExpandedFees}
                          aria-controls={isExpandedFees ? feeDetailsId : undefined}
                          onClick={() => setExpandedFeeOrderId(isExpandedFees ? null : ord.id)}
                          className="flex w-fit items-center gap-1 rounded text-[11px] font-bold text-[#a83d2b] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {isExpandedFees ? 'Ẩn chi tiết thu phí' : 'Chi tiết thu phí'}
                          <ChevronDown aria-hidden="true" className={`size-3.5 ${isExpandedFees ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>

                    {isExpandedFees && (
                      <tr role="row" id={feeDetailsId} className="block xl:table-row animate-fadeIn">
                        <td role="cell" colSpan={7} className="block bg-amber-50/20 px-4 py-3 xl:table-cell border-l-4 border-l-[#c34c36] border-b-2 border-b-[#c34c36]/20">
                          <div className="rounded-2xl border-2 border-[#c34c36]/40 bg-white p-4 shadow-sm ring-4 ring-[#c34c36]/10 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] animate-pulse" />
                                <span className="font-extrabold text-[#24263e]">
                                  Chi tiết biểu phí &amp; quyết toán của đơn #{ord.id.slice(0, 8)}:
                                </span>
                                <span className="font-bold text-[#c34c36] truncate max-w-[280px] sm:max-w-md">
                                  {ord.postTitle}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedFeeOrderId(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              >
                                ✕ Đóng chi tiết
                              </button>
                            </div>
                            <CenterInspectionFees
                              order={ord}
                              fees={fees}
                              collectionClosed={collectionClosed}
                            />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Dòng mở rộng: Tiến trình Chặng 1 (Người bán → Hub) */}
                    {progress && isExpandedInbound && (
                      <tr role="row" id={inboundProgressId} className="block xl:table-row animate-fadeIn">
                        <td role="cell" colSpan={7} className="block bg-blue-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-blue-600 border-b-2 border-b-blue-200">
                          <div className="rounded-2xl border-2 border-blue-400/60 bg-white p-4 shadow-sm ring-4 ring-blue-500/10 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-blue-100 text-xs font-bold text-blue-900">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                                <Truck className="h-4 w-4 text-blue-600" />
                                <span>Lộ trình Chặng 1 của đơn #{ord.id.slice(0, 8)}: Người Bán ({ord.sellerName || 'Người bán'}) ➔ Hub ({ord.postTitle})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedInboundOrderId(null)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition cursor-pointer"
                              >
                                ✕ Đóng tiến trình
                              </button>
                            </div>
                            <LalamoveProgress
                              title="Tiến trình vận chuyển Lalamove (Người bán → Hub)"
                              routeBadge="Chặng 1: Seller ➔ Hub"
                              currentStep={progress.step}
                              completeCurrentStep={progress.step === 3}
                            />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Dòng mở rộng: Tiến trình Chặng Hoàn Trả (Hub → Người bán) */}
                    {returnShipment && isExpandedReturn && (
                      <tr role="row" id={returnProgressId} className="block xl:table-row animate-fadeIn">
                        <td role="cell" colSpan={7} className="block bg-amber-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-amber-600 border-b-2 border-b-amber-200">
                          <div className="rounded-2xl border-2 border-amber-400/60 bg-white p-4 shadow-sm ring-4 ring-amber-500/10 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-100 text-xs font-bold text-amber-900">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
                                <RotateCcw className="h-4 w-4 text-amber-600" />
                                <span>Lộ trình hoàn hàng của đơn #{ord.id.slice(0, 8)}: Hub ➔ Người Bán ({ord.sellerName || 'Người bán'})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedReturnOrderId(null)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer"
                              >
                                ✕ Đóng tiến trình
                              </button>
                            </div>
                            <LalamoveProgress
                              title="Tiến trình vận chuyển hoàn trả Lalamove (Hub → Người bán)"
                              routeBadge="Chặng Hoàn Trả: Hub ➔ Seller"
                              currentStep={getHubReturnProgress(returnShipment).step}
                              completeCurrentStep={returnShipment.status === 'DELIVERED'}
                            />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Dòng mở rộng: Tiến trình Chặng Giao Hàng (Hub → Người mua) */}
                    {buyerShipment && isExpandedBuyer && (
                      <tr role="row" id={buyerProgressId} className="block xl:table-row animate-fadeIn">
                        <td role="cell" colSpan={7} className="block bg-teal-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-teal-600 border-b-2 border-b-teal-200">
                          <div className="rounded-2xl border-2 border-teal-400/60 bg-white p-4 shadow-sm ring-4 ring-teal-500/10 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-teal-100 text-xs font-bold text-teal-900">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                                <Truck className="h-4 w-4 text-teal-600" />
                                <span>Lộ trình giao hàng của đơn #{ord.id.slice(0, 8)}: Hub ➔ Khách Mua ({ord.buyerName || 'Khách mua'})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedBuyerOrderId(null)}
                                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-bold transition cursor-pointer"
                              >
                                ✕ Đóng tiến trình
                              </button>
                            </div>
                            <LalamoveProgress
                              title="Tiến trình vận chuyển giao hàng Lalamove (Hub → Khách mua)"
                              routeBadge="Chặng Giao Hàng: Hub ➔ Buyer"
                              currentStep={getInboundShipmentProgress(buyerShipment).step}
                              completeCurrentStep={buyerShipment.status === 'DELIVERED'}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
