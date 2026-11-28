import { MapPin, RefreshCw, Loader2, Plus, Truck, Package } from 'lucide-react';
import { LalamoveProgress } from '../../../components/common/LalamoveProgress';
import { InspectionCashShipmentStatus } from '../../../components/inspection/InspectionCashShipmentStatus';
import { UserProfile } from '../../../types';
import {
  canBookCenterBuyerDelivery,
  canBookCenterReturn,
  getHubReturnProgress,
  getInboundShipmentProgress,
  getReturnReserveMessage,
  isShipmentInterrupted,
} from '../../../utils/inspectionCenterData';
import { resolveInspectionCenter } from '../../../utils/orderUtils';
import { formatVND } from '../../../utils/translations';
import type { useCenterProfile } from '../useCenterProfile';
import type { useCenterShipments } from './useCenterShipments';

interface Props {
  centerProfile: ReturnType<typeof useCenterProfile>['centerProfile'];
  currentUser: UserProfile | null | undefined;
  shipmentModalOrder: NonNullable<ReturnType<typeof useCenterShipments>['shipmentModalOrder']>;
  shipments: Pick<ReturnType<typeof useCenterShipments>,
    | 'bookingBuyerOrderId'
    | 'bookingReturnId'
    | 'buyerShipments'
    | 'closeShipmentModal'
    | 'deniedShipmentOrders'
    | 'handleBookBuyerDelivery'
    | 'handleSyncCenterShipment'
    | 'hasLoadedShipmentModal'
    | 'hubReturns'
    | 'inboundShipments'
    | 'inspectionShipments'
    | 'isLoadingShipments'
    | 'setReturnQuoteOrder'
    | 'setShipmentError'
    | 'setShipmentSuccess'
    | 'shipmentError'
    | 'shipmentModalRequestRef'
    | 'shipmentSuccess'
    | 'syncingShipments'
  >;
}

export function CenterShipmentModal({ centerProfile, currentUser, shipmentModalOrder, shipments }: Props) {
  const {
    bookingBuyerOrderId,
    bookingReturnId,
    buyerShipments,
    closeShipmentModal,
    deniedShipmentOrders,
    handleBookBuyerDelivery,
    handleSyncCenterShipment,
    hasLoadedShipmentModal,
    hubReturns,
    inboundShipments,
    inspectionShipments,
    isLoadingShipments,
    setReturnQuoteOrder,
    setShipmentError,
    setShipmentSuccess,
    shipmentError,
    shipmentModalRequestRef,
    shipmentSuccess,
    syncingShipments,
  } = shipments;

  const orderId = shipmentModalOrder.id;
  const hasCheckedShipments = hasLoadedShipmentModal && !deniedShipmentOrders.has(orderId);
  const canBookReturn = hasCheckedShipments &&
    canBookCenterReturn(shipmentModalOrder, currentUser?.id, currentUser?.role, hubReturns.get(orderId));
  const canBookBuyerDelivery = hasCheckedShipments &&
    canBookCenterBuyerDelivery(shipmentModalOrder, currentUser?.id, buyerShipments.get(orderId));

  const effectiveShipments = inspectionShipments.length > 0
    ? inspectionShipments
    : (() => {
      const inbound = inboundShipments.get(orderId);
      if (inbound) return [inbound];
      const buyer = buyerShipments.get(orderId);
      if (buyer) return [buyer];
      const ret = hubReturns.get(orderId)?.shipment;
      if (ret) return [ret];
      return [];
    })();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Vận đơn điều phối kiểm định Lab Hub
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Đơn kiểm định: #{shipmentModalOrder.id.slice(0, 8)} • {shipmentModalOrder.postTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeShipmentModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Notification messages */}
        {shipmentError && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
            <span>{shipmentError}</span>
            <button type="button" onClick={() => setShipmentError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
          </div>
        )}
        {shipmentSuccess && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
            <span>{shipmentSuccess}</span>
            <button type="button" onClick={() => setShipmentSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">✕</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#24263e] px-3.5 py-1.5 text-xs font-bold text-white">
            <Package className="w-3.5 h-3.5" />
            <span>Lộ trình vận đơn ({effectiveShipments.length})</span>
          </div>
          {canBookReturn && !effectiveShipments.some((s) => s.leg === 'CENTER_TO_SELLER') && (
            <button
              type="button"
              disabled={bookingReturnId !== null}
              onClick={() => {
                closeShipmentModal();
                setReturnQuoteOrder(shipmentModalOrder);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo vận đơn trả người bán
            </button>
          )}
          {canBookBuyerDelivery && !effectiveShipments.some((s) => s.leg === 'CENTER_TO_BUYER') && (
            <button
              type="button"
              disabled={bookingBuyerOrderId !== null}
              onClick={() => void handleBookBuyerDelivery(shipmentModalOrder)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {bookingBuyerOrderId === orderId ? 'Đang xử lý…' : 'Tạo vận đơn giao người mua'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 subtle-scrollbar pr-1 text-xs">
          {isLoadingShipments ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
              <span>Đang tải lộ trình vận chuyển từ máy chủ...</span>
            </div>
          ) : effectiveShipments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <Truck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Chưa có vận đơn nào cho đơn kiểm định này.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {effectiveShipments.map((s, idx) => {
                const isSellerToCenter = s.leg === 'SELLER_TO_CENTER';
                const isCenterToBuyer = s.leg === 'CENTER_TO_BUYER';
                const isCenterToSeller = s.leg === 'CENTER_TO_SELLER';
                const isSyncing = syncingShipments.has(s.shipmentId);
                const progress = isCenterToSeller ? getHubReturnProgress(s) : getInboundShipmentProgress(s);
                const isDelivered = progress.step === 3;
                const isInterrupted = !isDelivered && isShipmentInterrupted(s);
                const statusLabel = isDelivered && isSellerToCenter ? 'Đã nhận tại Hub'
                  : isDelivered && isCenterToBuyer ? 'Đã giao tới người mua'
                    : isSellerToCenter || isCenterToBuyer || isCenterToSeller ? progress.label
                      : s.providerStatus || s.status || 'Đang điều phối';
                const statusColorClass = isInterrupted ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : isDelivered ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                const legBadgeTitle = isSellerToCenter
                  ? 'Chặng 1: Người Bán ➔ Lab Hub'
                  : isCenterToBuyer
                    ? 'Chặng 2: Lab Hub ➔ Người Mua (Đạt chuẩn)'
                    : isCenterToSeller
                      ? 'Chặng 2: Lab Hub ➔ hoàn trả người bán'
                      : `Chặng: ${s.leg || 'Điều phối Lab Hub'}`;

                const legColorClass = isSellerToCenter
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : isCenterToBuyer
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div key={s.shipmentId || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                          {s.orderCode ? `Mã Vận đơn: #${s.orderCode}` : 'Chưa có mã vận đơn'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${legColorClass}`}>
                          {legBadgeTitle}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColorClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <InspectionCashShipmentStatus shipment={s} />

                    {isSellerToCenter && (
                      <div className="space-y-2 text-[11px] text-slate-700">
                        {!isInterrupted && (
                          <LalamoveProgress
                            title="Tiến trình vận chuyển Lalamove (Người bán → Hub)"
                            routeBadge="Chặng 1: Seller ➔ Hub"
                            currentStep={progress.step}
                            completeCurrentStep={isDelivered}
                          />
                        )}
                        {s.shareLink && (
                          <a href={s.shareLink} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline inline-block">
                            Theo dõi trên Lalamove
                          </a>
                        )}
                        {s.lastError && <p className="text-rose-700">{s.lastError}</p>}
                      </div>
                    )}

                    {isCenterToBuyer && (
                      <div className="space-y-2 text-[11px] text-slate-700">
                        {!isInterrupted && (
                          <LalamoveProgress
                            title="Tiến trình giao hàng Lalamove (Hub → Người mua)"
                            routeBadge="Chặng 2: Hub ➔ Buyer"
                            currentStep={progress.step}
                            completeCurrentStep={isDelivered}
                          />
                        )}
                        {s.shareLink && (
                          <a href={s.shareLink} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline inline-block">
                            Theo dõi trên Lalamove
                          </a>
                        )}
                        {s.lastError && <p className="text-rose-700">{s.lastError}</p>}
                        {isInterrupted && canBookBuyerDelivery && (
                          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-teal-900 mt-2">
                            <div className="text-[11px]">
                              <span className="font-bold">Vận đơn này đã bị hủy hoặc giao thất bại.</span> Bạn có thể đặt lại vận đơn mới để giao hàng cho người mua.
                            </div>
                            <button
                              type="button"
                              disabled={bookingBuyerOrderId !== null}
                              onClick={() => void handleBookBuyerDelivery(shipmentModalOrder)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              {bookingBuyerOrderId === orderId ? 'Đang xử lý…' : 'Tạo lại vận đơn giao người mua'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isCenterToSeller && (
                      <div className="space-y-2 text-[11px] text-slate-700">
                        {!isInterrupted && (
                          <LalamoveProgress
                            title="Tiến trình hoàn trả Lalamove (Hub → Người bán)"
                            routeBadge="Chặng hoàn trả: Hub ➔ Seller"
                            currentStep={progress.step}
                            completeCurrentStep={isDelivered}
                          />
                        )}
                        <p>Dự phòng {shipmentModalOrder.returnShippingReserveFee == null ? '—' : formatVND(shipmentModalOrder.returnShippingReserveFee)} · Cước thực tế {s.actualFee == null ? 'Chưa có' : formatVND(s.actualFee)}</p>
                        {s.deliveredAt && <p>Giao hoàn lúc {new Date(s.deliveredAt).toLocaleString('vi-VN')}</p>}
                        <p>{getReturnReserveMessage(shipmentModalOrder.returnShippingReserveFee, s)}</p>
                        {s.shareLink && <a href={s.shareLink} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">Theo dõi trên Lalamove</a>}
                        {s.status === 'CREATION_UNCERTAIN' && <p>Nhân viên hỗ trợ có thể đối soát với mã chuyến {s.shipmentId}.</p>}
                        {s.lastError && <p className="text-rose-700">{s.lastError}</p>}
                        {isInterrupted && canBookReturn && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-amber-900 mt-2">
                            <div className="text-[11px]">
                              <span className="font-bold">Vận đơn này đã bị hủy hoặc giao thất bại.</span> Bạn có thể đặt lại vận đơn mới để trả hàng về cho người bán.
                            </div>
                            <button
                              type="button"
                              disabled={bookingReturnId !== null}
                              onClick={() => {
                                closeShipmentModal();
                                setReturnQuoteOrder(shipmentModalOrder);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Tạo lại vận đơn hoàn trả
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {(() => {
                      const inboundRef = inspectionShipments.find((item) => item.leg === 'SELLER_TO_CENTER') || inboundShipments.get(shipmentModalOrder.id);
                      const resolvedCenter = resolveInspectionCenter({
                        ...shipmentModalOrder,
                        inspectionCenterName: (currentUser as any)?.centerName || currentUser?.name || (shipmentModalOrder as any).inspectionCenterName,
                        inspectionCenterAddress: (currentUser as any)?.address || (shipmentModalOrder as any).inspectionCenterAddress,
                        inspectionCenterPhone: (currentUser as any)?.phone || (shipmentModalOrder as any).inspectionCenterPhone,
                      });
                      const hubName = centerProfile?.name || resolvedCenter.name || 'Trung tâm kiểm định secondLife';
                      const hubPhone = centerProfile?.phone || resolvedCenter.phone || '1900 8899';
                      const hubAddress = centerProfile?.address || resolvedCenter.address || 'Giảng đường phượng vỹ, đường số 8, phường linh xuân, thành phố Hồ Chí Minh';

                      const sellerName = shipmentModalOrder.sellerName || inboundRef?.senderName || 'Người bán';
                      const sellerPhone = shipmentModalOrder.sellerPhone || (shipmentModalOrder as any).phone || inboundRef?.senderPhone || '0912345678';
                      const sellerAddress = shipmentModalOrder.sellerAddress || (shipmentModalOrder as any).address || (shipmentModalOrder as any).location || inboundRef?.senderAddress || 'Địa chỉ kho người bán';

                      const buyerName = shipmentModalOrder.buyerName || 'Khách mua';
                      const buyerPhone = (shipmentModalOrder as any).buyerPhone || (shipmentModalOrder as any).phone || '0987654321';
                      const buyerAddress = (shipmentModalOrder as any).buyerAddress || (shipmentModalOrder as any).deliveryAddress || (shipmentModalOrder as any).address || 'Địa chỉ nhận hàng của người mua';

                      const senderTitle = isSellerToCenter
                        ? 'Điểm lấy hàng (Nhà người bán):'
                        : 'Điểm gửi hàng (Phòng Lab Hub):';
                      const displaySenderName = isSellerToCenter
                        ? (s.senderName || sellerName)
                        : (s.senderName || hubName);
                      const displaySenderPhone = isSellerToCenter
                        ? (s.senderPhone || sellerPhone)
                        : (s.senderPhone || hubPhone);
                      const displaySenderAddress = isSellerToCenter
                        ? (s.senderAddress || sellerAddress)
                        : (s.senderAddress || hubAddress);

                      const receiverTitle = isSellerToCenter
                        ? 'Điểm tiếp nhận (Phòng Lab Hub):'
                        : isCenterToBuyer
                          ? 'Điểm giao hàng (Khách Mua):'
                          : 'Điểm nhận trả (Người Bán):';
                      const displayReceiverName = isSellerToCenter
                        ? (s.receiverName || hubName)
                        : isCenterToBuyer
                          ? (s.receiverName || buyerName)
                          : (s.receiverName || sellerName);
                      const displayReceiverPhone = isSellerToCenter
                        ? (s.receiverPhone || hubPhone)
                        : isCenterToBuyer
                          ? (s.receiverPhone || buyerPhone)
                          : (s.receiverPhone || sellerPhone);
                      const displayReceiverAddress = isSellerToCenter
                        ? (s.receiverAddress || hubAddress)
                        : isCenterToBuyer
                          ? (s.receiverAddress || buyerAddress)
                          : (s.receiverAddress || sellerAddress);

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
                              <MapPin className="w-3.5 h-3.5 text-blue-500" />
                              <span>{senderTitle}</span>
                            </div>
                            <div className="font-bold text-slate-800">{displaySenderName}</div>
                            {displaySenderPhone && <div className="text-slate-500 font-mono text-[10px]">{displaySenderPhone}</div>}
                            {displaySenderAddress && <div className="text-slate-600 text-[10px]">{displaySenderAddress}</div>}
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{receiverTitle}</span>
                            </div>
                            <div className="font-bold text-slate-800">{displayReceiverName}</div>
                            {displayReceiverPhone && <div className="text-slate-500 font-mono text-[10px]">{displayReceiverPhone}</div>}
                            {displayReceiverAddress && <div className="text-slate-600 text-[10px]">{displayReceiverAddress}</div>}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Driver & Carrier Details */}
                    <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        {s.driverPlateNumber && <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200">{s.driverPlateNumber}</span>}
                        <span className="text-[10px] text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded font-semibold">Bạn có thể đồng bộ trạng thái đơn hàng mới nhất: </span>
                        <button
                          type="button"
                          disabled={!s.orderCode || !s.shipmentId || isSyncing}
                          aria-busy={isSyncing}
                          onClick={() => void handleSyncCenterShipment(shipmentModalOrder.id, s, shipmentModalRequestRef.current)}
                          className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Đồng bộ trạng thái vận đơn Lalamove mới nhất"
                        >
                          <RefreshCw aria-hidden="true" className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Đang đồng bộ…' : 'Đồng bộ'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={closeShipmentModal}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
