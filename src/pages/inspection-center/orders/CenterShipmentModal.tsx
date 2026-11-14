import { MapPin, RefreshCw, Loader2, Plus, Truck, Package, AlertTriangle } from 'lucide-react';
import { LalamoveProgress } from '../../../components/common/LalamoveProgress';
import { InspectionCashShipmentStatus } from '../../../components/inspection/InspectionCashShipmentStatus';
import { UserProfile } from '../../../types';
import { getHubReturnProgress, getReturnReserveMessage } from '../../../utils/inspectionCenterData';
import { resolveInspectionCenter } from '../../../utils/orderUtils';
import { formatVND } from '../../../utils/translations';
import type { useCenterProfile } from '../useCenterProfile';
import type { useCenterShipments } from './useCenterShipments';

interface Props {
  centerProfile: ReturnType<typeof useCenterProfile>['centerProfile'];
  currentUser: UserProfile | null | undefined;
  shipmentModalOrder: NonNullable<ReturnType<typeof useCenterShipments>['shipmentModalOrder']>;
  shipments: Pick<ReturnType<typeof useCenterShipments>,
    | 'canCreateInboundInModal'
    | 'closeShipmentModal'
    | 'handleCreateInspectionShipment'
    | 'handleSyncCenterShipment'
    | 'inboundShipments'
    | 'inspectionShipments'
    | 'isCreatingShipment'
    | 'isLoadingShipments'
    | 'receiverAddress'
    | 'receiverName'
    | 'receiverPhone'
    | 'senderAddress'
    | 'senderName'
    | 'senderPhone'
    | 'setReceiverAddress'
    | 'setReceiverName'
    | 'setReceiverPhone'
    | 'setSenderAddress'
    | 'setSenderName'
    | 'setSenderPhone'
    | 'setShipmentError'
    | 'setShipmentSuccess'
    | 'setShipmentTab'
    | 'shipmentError'
    | 'shipmentModalRequestRef'
    | 'shipmentSuccess'
    | 'shipmentTab'
    | 'syncingShipments'
  >;
}

export function CenterShipmentModal({ centerProfile, currentUser, shipmentModalOrder, shipments }: Props) {
  const {
    canCreateInboundInModal,
    closeShipmentModal,
    handleCreateInspectionShipment,
    handleSyncCenterShipment,
    inboundShipments,
    inspectionShipments,
    isCreatingShipment,
    isLoadingShipments,
    receiverAddress,
    receiverName,
    receiverPhone,
    senderAddress,
    senderName,
    senderPhone,
    setReceiverAddress,
    setReceiverName,
    setReceiverPhone,
    setSenderAddress,
    setSenderName,
    setSenderPhone,
    setShipmentError,
    setShipmentSuccess,
    setShipmentTab,
    shipmentError,
    shipmentModalRequestRef,
    shipmentSuccess,
    shipmentTab,
    syncingShipments,
  } = shipments;

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
                Vận Đơn Điều Phối Kiểm Định Lab Hub
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

        {/* Tab switchers */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setShipmentTab('tracking')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${shipmentTab === 'tracking'
              ? 'bg-[#24263e] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Lộ Trình Vận Đơn ({inspectionShipments.length})</span>
          </button>
          {canCreateInboundInModal && <button
            type="button"
            onClick={() => setShipmentTab('create')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${shipmentTab === 'create'
              ? 'bg-[#c34c36] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kích Hoạt Giao Vận Hub</span>
          </button>}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 subtle-scrollbar pr-1 text-xs">
          {shipmentTab === 'tracking' ? (
            isLoadingShipments ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                <span>Đang tải lộ trình vận chuyển từ máy chủ...</span>
              </div>
            ) : inspectionShipments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">Chưa có vận đơn nào cho đơn kiểm định này.</p>
                {canCreateInboundInModal && <button
                  type="button"
                  onClick={() => setShipmentTab('create')}
                  className="mt-2 px-4 py-2 bg-[#c34c36] text-white rounded-xl font-bold cursor-pointer hover:bg-[#a63f2d] transition"
                >
                  + Kích Hoạt Vận Đơn Ngay
                </button>}
              </div>
            ) : (
              <div className="space-y-3">
                {inspectionShipments.map((s, idx) => {
                  const isSellerToCenter = s.leg === 'SELLER_TO_CENTER';
                  const isCenterToBuyer = s.leg === 'CENTER_TO_BUYER';
                  const isCenterToSeller = s.leg === 'CENTER_TO_SELLER';
                  const isSyncing = syncingShipments.has(s.shipmentId);

                  const legBadgeTitle = isSellerToCenter
                    ? 'Chặng 1: Người Bán ➔ Lab Hub'
                    : isCenterToBuyer
                      ? 'Chặng 2: Lab Hub ➔ Người Mua (Đạt chuẩn)'
                      : isCenterToSeller
                        ? 'Chặng 2: Lab Hub ➔ Hoàn Trả Người Bán'
                        : `Chặng: ${s.leg || 'Điều Phối Lab Hub'}`;

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
                            {s.orderCode ? `#${s.orderCode}` : 'Chưa có mã vận đơn'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${legColorClass}`}>
                            {legBadgeTitle}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {isCenterToSeller ? getHubReturnProgress(s).label : (s.providerStatus || s.status || 'ĐANG_ĐIỀU_PHỐI')}
                        </span>
                      </div>

                      <InspectionCashShipmentStatus shipment={s} />
                      {isCenterToSeller && (
                        <div className="space-y-2 text-[11px] text-slate-700">
                          <LalamoveProgress currentStep={getHubReturnProgress(s).step} completeCurrentStep={s.status === 'DELIVERED'} />
                          <p>Dự phòng {shipmentModalOrder.returnShippingReserveFee == null ? '—' : formatVND(shipmentModalOrder.returnShippingReserveFee)} · Cước thực tế {s.actualFee == null ? 'Chưa có' : formatVND(s.actualFee)}</p>
                          {s.deliveredAt && <p>Giao hoàn lúc {new Date(s.deliveredAt).toLocaleString('vi-VN')}</p>}
                          <p>{getReturnReserveMessage(shipmentModalOrder.returnShippingReserveFee, s)}</p>
                          {s.shareLink && <a href={s.shareLink} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">Theo dõi trên Lalamove</a>}
                          {s.status === 'CREATION_UNCERTAIN' && <p>Nhân viên hỗ trợ có thể đối soát với mã chuyến {s.shipmentId}.</p>}
                          {s.lastError && <p className="text-rose-700">{s.lastError}</p>}
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
                        const hubName = centerProfile?.name || resolvedCenter.name || 'Trung Tâm Kiểm Định SecondLife';
                        const hubPhone = centerProfile?.phone || resolvedCenter.phone || '1900 8899';
                        const hubAddress = centerProfile?.address || resolvedCenter.address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh';

                        const sellerName = shipmentModalOrder.sellerName || inboundRef?.senderName || 'Người bán';
                        const sellerPhone = shipmentModalOrder.sellerPhone || (shipmentModalOrder as any).phone || inboundRef?.senderPhone || '0912345678';
                        const sellerAddress = shipmentModalOrder.sellerAddress || (shipmentModalOrder as any).address || (shipmentModalOrder as any).location || inboundRef?.senderAddress || 'Địa chỉ kho người bán';

                        const buyerName = shipmentModalOrder.buyerName || 'Khách mua';
                        const buyerPhone = (shipmentModalOrder as any).buyerPhone || (shipmentModalOrder as any).phone || '0987654321';
                        const buyerAddress = (shipmentModalOrder as any).buyerAddress || (shipmentModalOrder as any).deliveryAddress || (shipmentModalOrder as any).address || 'Địa chỉ nhận hàng của người mua';

                        const senderTitle = isSellerToCenter
                          ? 'Điểm Lấy Hàng (Nhà Người Bán):'
                          : 'Điểm Gửi Hàng (Phòng Lab Hub):';
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
                          ? 'Điểm Tiếp Nhận (Phòng Lab Hub):'
                          : isCenterToBuyer
                            ? 'Điểm Giao Hàng (Khách Mua):'
                            : 'Điểm Nhận Trả (Người Bán):';
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
                          <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Tài xế Lalamove: <strong>{s.driverName || 'Chưa có thông tin'}</strong>{s.driverPhone && ` (${s.driverPhone})`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.driverPlateNumber && <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200">{s.driverPlateNumber}</span>}
                          <span className="text-[10px] text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded font-semibold">Theo dõi GPS qua Lalamove API</span>
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
            )
          ) : (
            <form onSubmit={handleCreateInspectionShipment} className="space-y-3.5">
              {centerProfile && (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id) && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                  <div className="font-bold text-slate-800">
                    Điểm đến tiếp nhận: {centerProfile?.name || 'Trung Tâm Tiếp Nhận'}
                  </div>
                  <div className="text-slate-500 font-mono text-[10px]">
                    Hotline: {centerProfile?.phone || 'Chưa thiết lập hotline'}
                  </div>
                  <div className="text-slate-600 text-[10px]">
                    Địa chỉ: {centerProfile?.address || 'Chưa cấu hình địa chỉ tiếp nhận'}
                  </div>
                  {centerProfile && !centerProfile.shippingAddressConfigured && (
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Trung tâm chưa cấu hình địa chỉ tiếp nhận & GPS. Vui lòng mở mục "Thông tin trung tâm" để cập nhật.</span>
                    </div>
                  )}
                </div>
              )}
              {/* Sender address section */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block text-xs">
                  Thông Tin Người Gửi (Nhà Người Bán)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Tên người gửi..."
                    className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="Số điện thoại người gửi..."
                    className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="Địa chỉ gửi hàng..."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                />
              </div>

              {/* Receiver address section */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block text-xs">
                  Thông Tin Điểm Tiếp Nhận (Phòng Lab Hub)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Tên người nhận..."
                    className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="Số điện thoại nhận..."
                    className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  placeholder="Địa chỉ nhận hàng..."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingShipment || Boolean(centerProfile && (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id) && !centerProfile.shippingAddressConfigured)}
                  className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isCreatingShipment && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    Tạo Vận Đơn Lấy Hàng Về Hub
                  </span>
                </button>
              </div>
            </form>
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
