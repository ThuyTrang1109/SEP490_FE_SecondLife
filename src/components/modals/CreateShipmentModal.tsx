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
  Calendar
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';
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

  // Lấy chính xác địa chỉ và thông tin Trung tâm Kiểm định của đơn hàng (không hardcode)
  const hubCenter = resolveInspectionCenter(order);

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
    const rName = isHubInspection ? hubCenter.name.slice(0, 50) : (order.buyerName || 'Người mua').slice(0, 50);
    const rPhone = cleanPhone(isHubInspection ? hubCenter.phone : order.buyerPhone, isHubInspection ? '0908123456' : '0987654321');

    try {
      let shipment: ShipmentBackend | null = null;

      // Chuẩn bị payload chuẩn theo API CreateShipmentRequest
      const shipmentPayload = {
        requestId,
        leg: payloadLeg as any,
        fromAddress: {
          name: sName,
          phone: sPhone,
          latitude: 10.7769,
          longitude: 106.7009,
        },
        toAddress: {
          name: rName,
          phone: rPhone,
          latitude: isHubInspection ? (hubCenter.lat || 10.8415) : 10.8012,
          longitude: isHubInspection ? (hubCenter.lng || 106.8098) : 106.7123,
        },
        reason: isHubInspection
          ? `Bàn giao kiện hàng đến ${hubCenter.name} thẩm định`
          : 'Giao hàng cho người mua qua Lalamove',
      };

      if (isHubInspection) {
        // Gọi API tạo vận đơn kiểm định Chặng 1 chuyển hàng từ Người bán đến Hub
        try {
          shipment = await shippingService.createInspectionShipment(order.id, shipmentPayload as any);
        } catch (inspErr) {
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
          try { existingList = JSON.parse(existingRaw); } catch {}
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
          } catch {}
        }

        window.dispatchEvent(new CustomEvent('secondlife_seller_shipped_to_hub', { detail: { orderId: order.id } }));
        window.dispatchEvent(new StorageEvent('storage', { key: `seller_ready_${order.id}`, newValue: nowIso }));
      } catch {}

      onShipmentCreated(shipment);
    } catch (err: any) {
      console.error('Failed to create Lalamove shipment:', err);
      const rawMsg = err?.response?.data?.message || err?.message || '';
      setErrorMsg(translateApiError(rawMsg) || 'Không thể tạo vận đơn Lalamove. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-gray-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white flex items-center justify-center shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Tạo Vận Đơn Giao Hàng Lalamove
              </h3>
              <p className="text-xs text-slate-500">Đơn hàng: #{order.id.slice(0, 12)}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateShipment} className="mt-5 space-y-5 text-xs text-slate-700">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{translateSystemNotification(errorMsg)}</span>
            </div>
          )}

          {order.escrowStatus === 'AWAITING_PAYMENT' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Đơn hàng đang chờ người mua nộp tiền ký quỹ Escrow. Theo quy định, chỉ có thể điều phối tài xế Lalamove sau khi tiền đã được giữ trong Quỹ Escrow (trạng thái Ký Quỹ Thành Công).</span>
            </div>
          )}

          {/* Product Overview */}
          <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl border border-gray-200">
            <img
              src={order.listing.photos.front}
              alt={order.listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-[#c34c36] uppercase font-black">{resolveOrderListing(order.listing).brand}</span>
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Giá trị hàng: <strong className="text-slate-900">{formatVND(order.itemPriceVnd)}</strong>
              </div>
            </div>
          </div>

          {/* Logistics Route Visualizer */}
          <div className="space-y-3 bg-[#faf8f5] p-4 rounded-2xl border border-gray-200">
            <span className="font-extrabold uppercase text-[10px] text-slate-400 block tracking-wider">
              {isHubInspection
                ? 'Lộ trình Chặng 1: Người bán ➔ Trung tâm Lab Hub SecondLife'
                : 'Lộ trình nhận & giao hàng Lalamove'}
            </span>

            {/* From (Seller warehouse) */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                1
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">Kho lấy hàng (Người bán)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                    GPS Sẵn Sàng
                  </span>
                </div>
                <span className="text-slate-600 text-[11px] block leading-snug">
                  {order.listing.location || 'Địa chỉ kho đã lưu trong hồ sơ người bán'}
                </span>
                <span className="text-[10px] text-amber-700 italic block">
                  Tài xế Lalamove sẽ đến địa chỉ này lấy kiện hàng
                </span>
              </div>
            </div>

            <div className="w-0.5 h-4 bg-slate-300 ml-3" />

            {/* To: Hub for inspection OR Buyer for direct delivery */}
            <div className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                isHubInspection ? 'bg-blue-500/20 text-blue-700' : 'bg-emerald-500/20 text-emerald-700'
              }`}>
                2
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">
                    {isHubInspection
                      ? `Điểm đến: ${hubCenter.name}`
                      : `Người nhận: ${order.buyerName} (${order.buyerPhone})`}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                    isHubInspection
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {isHubInspection ? 'Trạm ISO/IEC 17025' : 'GPS Sẵn Sàng'}
                  </span>
                </div>
                <span className="text-slate-600 text-[11px] block leading-snug">
                  {isHubInspection
                    ? hubCenter.address
                    : order.buyerAddress}
                </span>
                {isHubInspection && (
                  <span className="text-[10px] text-blue-700 italic block">
                    Hotline Hub: {hubCenter.phone} • KTV tiếp nhận tháo máy, thẩm định 48 bước và cấp chứng thư
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2-Leg Journey Breakdown Card (For Hub Inspection) */}
          {isHubInspection && (
            <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-3.5 rounded-2xl border border-blue-200 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-extrabold uppercase text-[10px] text-blue-900 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Quy trình giao nhận 2 chặng (Verify Then Ship)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                  Chặng 1 / 2
                </span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-700">
                <div className="flex items-start gap-2 bg-white/90 p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="font-bold text-blue-700 shrink-0">📦 Chặng 1 (Vận đơn này):</span>
                  <span>Bàn giao kiện hàng cho Lalamove vận chuyển đến <strong>{hubCenter.name}</strong> ({hubCenter.address}) để đo kiểm.</span>
                </div>

                <div className="space-y-1.5 bg-white/90 p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                  <div className="font-bold text-slate-900">🚚 Chặng 2 (Kích hoạt sau khi có kết quả kiểm định):</div>
                  <div className="flex items-start gap-1.5 text-emerald-800">
                    <span className="font-bold shrink-0">✅ Nếu kiểm định ĐẠT (PASS):</span>
                    <span>Hub kích hoạt Chặng 2 giao tận tay khách mua: <strong>{order.buyerName}</strong> ({order.buyerPhone || 'Đã xác minh'}) tại <em>{order.buyerAddress}</em>.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-800">
                    <span className="font-bold shrink-0">❌ Nếu kiểm định KHÔNG ĐẠT (FAIL):</span>
                    <span>Hub kích hoạt vận đơn hoàn trả hàng về kho <strong>Người bán</strong>, đồng thời Quỹ Escrow hoàn tiền 100% cho <strong>Người mua</strong>.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Route Overview */}
          <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-2 border ${
            isHubInspection ? 'bg-blue-50/80 border-blue-200' : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <Truck className={`w-4 h-4 shrink-0 ${isHubInspection ? 'text-blue-600' : 'text-orange-600'}`} />
              <div>
                <span className={`font-bold text-xs ${isHubInspection ? 'text-blue-900' : 'text-slate-800'}`}>
                  {isHubInspection
                    ? 'Chặng 1: Bàn giao kiện hàng đến Trung tâm Lab Hub'
                    : 'Chặng vận chuyển trực tiếp (Người bán → Người mua)'}
                </span>
                <p className={`text-[10px] ${isHubInspection ? 'text-blue-700' : 'text-slate-500'}`}>
                  {isHubInspection
                    ? 'Tài xế Lalamove sẽ đến lấy kiện hàng tại kho và vận chuyển an toàn đến Trung tâm kiểm định.'
                    : 'Tài xế Lalamove sẽ đến địa chỉ kho lấy hàng và phát thẳng theo điều phối hệ thống.'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
              isHubInspection ? 'text-blue-800 bg-blue-100 border-blue-200' : 'text-orange-800 bg-orange-100 border-orange-200'
            }`}>
              {isHubInspection ? 'Lalamove Chặng 1' : 'Lalamove Sandbox'}
            </span>
          </div>

          {/* Info notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2 text-[11px] text-blue-900">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Sau khi tạo vận đơn, hệ thống sẽ cấp mã vận đơn Lalamove chính thức. Bạn có thể in phiếu gửi và chuẩn bị đóng gói để bàn giao cho tài xế.
            </span>
          </div>

          {/* Submit buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || order.escrowStatus === 'AWAITING_PAYMENT'}
              className={`px-6 py-2.5 rounded-xl font-black text-xs transition shadow-md flex items-center gap-2 ${
                order.escrowStatus === 'AWAITING_PAYMENT'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#c34c36] hover:bg-[#dc4729] text-white cursor-pointer disabled:opacity-50'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span>Đang kết nối Lalamove...</span>
                </>
              ) : order.escrowStatus === 'AWAITING_PAYMENT' ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-gray-500" />
                  <span>Chờ Khách Ký Quỹ Escrow</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-white" />
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
