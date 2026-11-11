import React, { useState } from 'react';
import { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Truck,
  Package,
  MapPin,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  Building2,
  Store,
  Info
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import { inspectorService } from '../../services/inspectorService';
import { translateApiError } from '../../services/apiClient';
import { translateSystemNotification } from '../../utils/systemNotificationTranslator';
import { resolveOrderListing } from '../../utils/catalogCache';
import { resolveInspectionCenter } from '../../utils/orderUtils';

interface CreateShipmentModalProps {
  order: EscrowOrder;
  onClose: () => void;
  onShipmentCreated: (shipment: ShipmentBackend) => void;
  lang: Language;
}

export const CreateShipmentModal: React.FC<CreateShipmentModalProps> = ({
  order,
  onClose,
  onShipmentCreated,
  lang,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID());

  const isAtHome = Boolean(
    order.inspectionMethod === 'AT_HOME' ||
    (order as any).orderType === 'AT_HOME'
  );
  const isHubInspection = Boolean(
    (order.hasInspectionService ||
      (order.inspectionFeeVnd && order.inspectionFeeVnd > 0) ||
      order.inspectionCenterId ||
      order.inspectionMethod ||
      (order as any).inspectionStatus) &&
    !isAtHome
  );

  // Load Trung tâm kiểm định thực tế từ API và chi tiết đơn kiểm định
  const [apiCenters, setApiCenters] = useState<any[]>([]);
  const [inspectionOrderInfo, setInspectionOrderInfo] = useState<any | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    inspectorService.getInspectionCenters().then((list) => {
      if (isMounted && list && list.length > 0) {
        setApiCenters(list);
      }
    }).catch(() => { });

    // Nếu đơn hàng có id, lấy chi tiết đơn kiểm định để nhận diện chính xác trung tâm đã gắn với đơn
    if (order.id) {
      inspectorService.getOrder(order.id).then((dto) => {
        if (isMounted && dto) {
          setInspectionOrderInfo(dto);
        }
      }).catch(() => { });
    }

    return () => { isMounted = false; };
  }, [order.id]);

  // Lấy chính xác địa chỉ và thông tin Trung tâm Kiểm định của đơn hàng từ API (không dùng mock)
  const hubCenter = React.useMemo(() => {
    const directId = inspectionOrderInfo?.inspectionCenterId || order.inspectionCenterId || (order as any).centerId;
    const directName = order.inspectionCenterName || (order as any).centerName;
    const directAddress = order.inspectionCenterAddress || (order as any).centerAddress;
    const directPhone = order.inspectionCenterPhone || (order as any).centerPhone;

    if (apiCenters.length > 0) {
      if (directId) {
        const found = apiCenters.find((c) => c.id === directId || String(directId).includes(c.id));
        if (found) {
          return {
            id: found.id,
            name: directName || found.name,
            address: directAddress || found.address || '',
            phone: directPhone || found.phone || '',
            lat: typeof found.latitude === 'number' ? found.latitude : 10.8752,
            lng: typeof found.longitude === 'number' ? found.longitude : 106.7725,
          };
        }
      }
      const first = apiCenters[0];
      return {
        id: directId || first.id,
        name: directName || first.name,
        address: directAddress || first.address || '',
        phone: directPhone || first.phone || '',
        lat: typeof first.latitude === 'number' ? first.latitude : 10.8752,
        lng: typeof first.longitude === 'number' ? first.longitude : 106.7725,
      };
    }

    return resolveInspectionCenter({ ...order, inspectionCenterId: directId });
  }, [order, apiCenters, inspectionOrderInfo]);

  const cleanPhone = (p?: string, def: string = '0912345678'): string => {
    const d = (p || '').replace(/\D/g, '');
    if (/^(?:0|84)\d{9,10}$/.test(d)) return d.startsWith('84') ? '0' + d.slice(2) : d;
    return def;
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const payloadLeg = isHubInspection ? 'SELLER_TO_CENTER' : 'SELLER_TO_BUYER';
    const sName = (order.listing?.seller?.name || order.sellerName || 'Người bán').slice(0, 50);
    const sPhone = cleanPhone(order.listing?.seller?.phone || (order as any).sellerPhone, '0912345678');
    const rName = (order.buyerName || 'Người mua').slice(0, 50);
    const rPhone = cleanPhone(order.buyerPhone, '0987654321');

    try {
      let shipment: ShipmentBackend | null = null;

      // Chuẩn bị payload chuẩn theo API CreateShipmentRequest
      // Backend quy định (xem schema CreateShipmentRequest):
      // - Với SELLER_TO_CENTER: Điểm lấy hàng và điểm đến đã được chốt và lưu trong báo giá / hồ sơ trung tâm.
      //   Nếu gửi fromAddress/toAddress lệch tọa độ hoặc tên sẽ bị lỗi 409:
      //   "Điểm lấy hàng phải khớp báo giá vận chuyển đã chốt" / "Điểm đến phải khớp hồ sơ trung tâm..."
      //   Do đó, với SELLER_TO_CENTER: FE KHÔNG gửi fromAddress và toAddress để BE tự động dùng dữ liệu đã chốt.
      const shipmentPayload: any = {
        requestId,
        leg: payloadLeg as any,
        reason: isHubInspection
          ? `Bàn giao kiện hàng đến ${hubCenter?.name || 'Trung tâm kiểm định'} thẩm định`
          : 'Giao hàng cho người mua qua Lalamove',
      };

      // Chỉ gửi địa chỉ nếu là giao thẳng thông thường không qua kiểm định
      if (!isHubInspection) {
        shipmentPayload.fromAddress = {
          name: sName,
          phone: sPhone,
          latitude: 10.7769,
          longitude: 106.7009,
        };
        shipmentPayload.toAddress = {
          name: rName,
          phone: rPhone,
          latitude: 10.8012,
          longitude: 106.7123,
        };
      }

      if (isHubInspection) {
        // Gọi API tạo vận đơn kiểm định Chặng 1 chuyển hàng từ Người bán đến Hub
        try {
          shipment = await shippingService.createInspectionShipment(order.id, shipmentPayload as any);
        } catch (inspErr: any) {
          const status = inspErr?.response?.status || inspErr?.status;
          if (status === 409 || status === 400 || status === 422) {
            throw inspErr;
          }
          shipment = await shippingService.createShipment(order.id, shipmentPayload as any);
        }
      } else {
        // Đơn giao hàng trực tiếp Người bán -> Người mua
        shipment = await shippingService.createShipment(order.id, shipmentPayload as any);
      }

      if (!shipment || !shipment.orderCode) {
        throw new Error(shipment?.lastError || 'Lalamove không phản hồi mã vận đơn.');
      }

      // Lưu trạng thái đã tạo vận đơn và sẵn sàng
      try {
        const nowIso = new Date().toISOString();
        localStorage.setItem(`order_shipment_created_${order.id}`, 'true');
        localStorage.setItem(`seller_ready_${order.id}`, nowIso);
        localStorage.setItem(`order_packed_${order.id}`, 'true');
        if (isHubInspection) {
          localStorage.setItem(`seller_shipped_to_hub_${order.id}`, 'true');
        }

        const shipmentsKey = `sl_order_shipments_${order.id}`;
        const existingRaw = localStorage.getItem(shipmentsKey) || localStorage.getItem(`order_shipments_${order.id}`);
        let existingList: ShipmentBackend[] = [];
        if (existingRaw) {
          try { existingList = JSON.parse(existingRaw); } catch { }
        }
        const updatedShipments = [shipment, ...existingList.filter((s) => s.shipmentId !== shipment.shipmentId)];
        localStorage.setItem(shipmentsKey, JSON.stringify(updatedShipments));
        localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(updatedShipments));

        // Cập nhật recent_placed_orders
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          try {
            const list = JSON.parse(rawRecent);
            if (Array.isArray(list)) {
              const updated = list.map((o: any) =>
                o.id === order.id
                  ? { ...o, sellerReadyAt: nowIso, orderShipmentCode: shipment.orderCode }
                  : o
              );
              localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
            }
          } catch { }
        }

        window.dispatchEvent(new CustomEvent('secondlife_seller_shipped_to_hub', { detail: { orderId: order.id } }));
        window.dispatchEvent(new StorageEvent('storage', { key: `seller_ready_${order.id}`, newValue: nowIso }));
      } catch { }

      onShipmentCreated(shipment);
    } catch (err: any) {
      console.error('Failed to create Lalamove shipment:', err);
      const rawMsg = err?.response?.data?.message || err?.message || '';
      setErrorMsg(translateApiError(rawMsg) || 'Không thể tạo vận đơn Lalamove. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemPrice = (() => {
    const val = Number(
      order.itemPriceVnd ??
      order.listing?.priceVnd ??
      (order as any).price ??
      (order as any).postPrice ??
      (order as any).priceVnd ??
      (order as any).amount ??
      (order as any).totalAmount ??
      0
    );
    return Number.isFinite(val) ? val : 0;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl sm:max-w-3xl max-h-[92vh] rounded-3xl bg-white p-4 sm:p-6 shadow-2xl text-slate-900 border border-gray-200 my-auto flex flex-col justify-between overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white flex items-center justify-center shadow-md shrink-0">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Tạo Vận Đơn Giao Hàng Lalamove
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isHubInspection ? 'Chặng 1: Gửi Hub' : 'Giao Thẳng'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                Mã đơn hàng: <strong className="font-mono text-slate-700">#{order.id.slice(0, 12).toUpperCase()}</strong> •{' '}
                {isHubInspection ? 'Lộ trình chuyển kiện hàng đến Trạm Kiểm Định SecondLife Hub' : 'Vận chuyển trực tiếp từ Người Bán đến Người Mua'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Arranged Sequentially with compact spacing */}
        <form onSubmit={handleCreateShipment} className="flex-1 overflow-y-auto pr-1 py-2.5 space-y-2.5 text-xs text-slate-700">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{translateSystemNotification(errorMsg)}</span>
            </div>
          )}

          {order.escrowStatus === 'AWAITING_PAYMENT' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Chỉ có thể điều phối tài xế sau khi tiền đã vào Escrow.
              </span>
            </div>
          )}

          {/* MỤC 1: SẢN PHẨM CẦN GIAO */}
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-gray-200 shadow-2xs">
            <img
              src={order.listing.photos.front}
              alt={order.listing.title}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-gray-200 shrink-0 bg-white shadow-2xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c34c36] uppercase font-black tracking-wide">
                  {resolveOrderListing(order.listing).brand}
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                  {order.listing?.conditionGrade || 'Đã qua sử dụng'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                {order.listing.title}
              </h4>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between flex-wrap gap-2">
                <span>
                  Giá trị hàng: <strong className="text-slate-900 font-bold text-xs sm:text-sm">{formatVND(itemPrice)}</strong>
                </span>
                <span className="text-[11px] text-slate-500">
                  Số lượng: <strong>01 kiện</strong>
                </span>
              </div>
            </div>
          </div>

          {/* MỤC 2: LỘ TRÌNH VẬN CHUYỂN CHẶNG 1 */}
          <div className="space-y-2 bg-[#faf8f5] p-3 sm:p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold uppercase text-[10px] sm:text-[11px] text-slate-500 tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                {isHubInspection
                  ? 'Lộ trình Chặng 1: Kho người bán ➔ Trạm Kiểm Định SecondLife Hub'
                  : 'Lộ trình nhận & giao hàng Lalamove'}
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {isHubInspection ? 'Lalamove Chặng 1' : 'Lalamove Direct'}
              </span>
            </div>

            {/* Điểm 1: Kho lấy hàng (Người bán) */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                1
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">Kho lấy hàng (Người bán)</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                    GPS Sẵn Sàng
                  </span>
                </div>
                <span className="text-slate-700 text-xs block leading-tight font-medium truncate">
                  {order.listing.location || 'Địa chỉ kho đã lưu trong hồ sơ người bán'}
                </span>
                <span className="text-[10px] text-amber-700 italic block">
                  Tài xế Lalamove sẽ đến địa chỉ này lấy kiện hàng
                </span>
              </div>
            </div>

            {/* Đường nối */}
            <div className="w-0.5 h-2 bg-slate-300 ml-2.5" />

            {/* Điểm 2: Hub SecondLife hoặc Người mua */}
            <div className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px] ${isHubInspection ? 'bg-blue-500/20 text-blue-700' : 'bg-emerald-500/20 text-emerald-700'
                }`}>
                2
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">
                    {isHubInspection
                      ? `Điểm đến: ${hubCenter.name}`
                      : `Người nhận: ${order.buyerName} (${order.buyerPhone})`}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${isHubInspection
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                    {isHubInspection ? 'Trạm ISO/IEC 17025' : 'GPS Sẵn Sàng'}
                  </span>
                </div>
                <span className="text-slate-700 text-xs block leading-tight font-medium truncate">
                  {isHubInspection
                    ? hubCenter.address
                    : order.buyerAddress}
                </span>
                {isHubInspection && (
                  <span className="text-[10px] text-blue-700 italic block">
                    Hotline: {hubCenter.phone} • KTV tiếp nhận thẩm định 48 bước và cấp chứng thư
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MỤC 3: QUY TRÌNH GIAO NHẬN 2 CHẶNG (VERIFY THEN SHIP) */}
          {isHubInspection ? (
            <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-3 rounded-2xl border border-blue-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold uppercase text-[10px] sm:text-[11px] text-blue-900 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Quy trình giao nhận 2 chặng
                </span>
                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-blue-200 text-blue-800 border border-blue-300">
                  Chặng 1 / 2
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="font-bold text-blue-700 shrink-0 text-[11px]">📦 Chặng 1 (Vận đơn này):</span>
                  <span className="leading-snug text-[11px]">
                    Bàn giao cho Lalamove giao đến <strong>{hubCenter.name}</strong> để đo kiểm kỹ thuật.
                  </span>
                </div>

                <div className="space-y-1 bg-white/90 p-2 sm:p-2.5 rounded-xl border border-blue-100 shadow-2xs text-[11px]">
                  <div className="font-bold text-slate-900 text-[11px]">🚚 Chặng 2 (Kích hoạt sau khi có kết quả kiểm định):</div>
                  <div className="flex items-start gap-1.5 text-emerald-800 leading-snug">
                    <span className="font-bold shrink-0">✅ Nếu ĐẠT:</span>
                    <span>
                      Hub kích hoạt Chặng 2 giao tận tay khách mua: <strong>{order.buyerName}</strong> ({order.buyerPhone || 'Đã xác minh'}).
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-800 leading-snug pt-1 border-t border-slate-100">
                    <span className="font-bold shrink-0">❌ Nếu KHÔNG ĐẠT:</span>
                    <span>
                      Hub hoàn trả hàng về kho <strong>Người bán</strong>, Quỹ Escrow hoàn tiền 100% cho <strong>Người mua</strong>.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-3 rounded-2xl border border-gray-200 space-y-1 text-xs text-slate-600 shadow-2xs">
              <span className="font-bold text-slate-900 text-xs block">Cam kết giao hàng Lalamove On-Demand</span>
              <p className="leading-relaxed text-[11px]">
                Tài xế Lalamove sẽ đến lấy kiện hàng trực tiếp tại kho của bạn và giao thẳng tới người mua: <strong>{order.buyerName}</strong> ({order.buyerPhone}).
              </p>
            </div>
          )}

          {/* MỤC 4: THÔNG BÁO LƯU Ý */}
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2 text-[11px] text-blue-900 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="leading-normal">
              Sau khi tạo vận đơn, hệ thống sẽ cấp mã vận đơn Lalamove chính thức. Vui lòng đóng gói sẵn sàng để bàn giao cho tài xế.
            </span>
          </div>

          {/* FOOTER ACTIONS - DƯỚI CÙNG */}
          <div className="pt-2.5 border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || order.escrowStatus === 'AWAITING_PAYMENT'}
              className={`px-5 py-2 rounded-xl font-bold text-xs transition shadow-md flex items-center gap-2 ${order.escrowStatus === 'AWAITING_PAYMENT'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#c34c36] hover:bg-[#dc4729] text-white cursor-pointer disabled:opacity-50'
                }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>Đang kết nối Lalamove...</span>
                </>
              ) : order.escrowStatus === 'AWAITING_PAYMENT' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-gray-500" />
                  <span>Chờ Khách Ký Quỹ Escrow</span>
                </>
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5 text-white" />
                  <span>{isHubInspection ? 'Xác Nhận Tạo Vận Đơn Gửi Hub (Chặng 1)' : 'Xác Nhận Tạo Vận Đơn Lalamove'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
