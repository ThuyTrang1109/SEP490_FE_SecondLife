import React, { useState } from 'react';
import { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { formatConditionGrade, formatVND } from '../../utils/translations';
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
import { shippingService, type ShippingAddressDto } from '../../services/shippingService';
import { inspectorService } from '../../services/inspectorService';
import { translateApiError } from '../../services/apiClient';
import { translateSystemNotification } from '../../utils/systemNotificationTranslator';
import { resolveOrderListing } from '../../utils/catalogCache';
import { resolveInspectionCenter } from '../../utils/orderUtils';
import { upsertShipment } from '../../utils/lalamoveTracking';
import {
  getOrderSellerAddress,
  getOrderSellerName,
  getOrderSellerPhone,
  getOrderBuyerAddress,
  getOrderBuyerName,
  getOrderBuyerPhone,
  extractAddressText,
} from '../../pages/inspection-center/dispatch/orderContacts';

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

  const [requestId] = useState<string>(() => crypto.randomUUID());

  const isAtHome = Boolean(
    order.inspectionMethod === 'AT_HOME' ||
    (order as any).orderType === 'AT_HOME' ||
    (order as any).inspectionOrder?.orderType === 'AT_HOME' ||
    (order as any).inspectionOrder?.inspectionMethod === 'AT_HOME'
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
  const [sellerPickup, setSellerPickup] = useState<ShippingAddressDto | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    inspectorService.getInspectionCenters().then((list) => {
      if (isMounted && list && list.length > 0) {
        setApiCenters(list);
      }
    }).catch(() => { });

    shippingService.getPickupAddress().then((pa) => {
      if (isMounted && pa) {
        setSellerPickup(pa);
      }
    }).catch(() => { });

    // Lấy chi tiết đơn kiểm định gắn với đơn hàng để nhận diện chính xác trung tâm / địa chỉ
    const findInspId = () => {
      if ((order as any).inspectionOrderId) return (order as any).inspectionOrderId;
      if ((order as any).inspectionOrder?.id) return (order as any).inspectionOrder.id;
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const found = list.find((o: any) => o.linkedOrderId === order.id || o.id === order.id || (order as any).orderId === o.id);
            if (found?.id) return found.id;
          }
        }
      } catch { }
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const list = JSON.parse(rawCenter);
          if (Array.isArray(list)) {
            const found = list.find((o: any) => o.linkedOrderId === order.id || o.id === order.id || (order as any).orderId === o.id);
            if (found?.id) return found.id;
          }
        }
      } catch { }
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list)) {
            const found = list.find((o: any) => o.linkedOrderId === order.id || o.id === order.id);
            if (found?.inspectionOrderId) return found.inspectionOrderId;
          }
        }
      } catch { }
      return order.id;
    };

    const inspTargetId = findInspId();
    if (inspTargetId) {
      inspectorService.getOrder(inspTargetId, { bypassCache: true }).then((dto) => {
        if (isMounted && dto) {
          setInspectionOrderInfo(dto);
        }
      }).catch(() => { });
    }

    return () => { isMounted = false; };
  }, [order.id, (order as any).inspectionOrderId]);

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

  // Parse buyer delivery info if stored as JSON or object
  const parsedBuyerDelivery = React.useMemo(() => {
    const rawCandidates = [
      (order as any).deliveryAddress,
      (order as any).buyerDeliveryAddressJson,
      inspectionOrderInfo?.buyerDeliveryAddressJson,
      inspectionOrderInfo?.deliveryAddress,
      (order as any).buyerAddress,
    ];

    for (const raw of rawCandidates) {
      if (!raw) continue;
      if (typeof raw === 'object' && (raw.address || raw.fullAddress || raw.name)) {
        return raw;
      }
      if (typeof raw === 'string' && raw.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(raw.trim());
          if (parsed && typeof parsed === 'object') return parsed;
        } catch { }
      }
    }
    return null;
  }, [order, inspectionOrderInfo]);

  const sellerFullAddress = React.useMemo(() => {
    const candidate =
      sellerPickup?.address ||
      extractAddressText((order as any).sellerAddress) ||
      extractAddressText((order as any).pickupAddress) ||
      extractAddressText((order as any).sellerContact?.address) ||
      extractAddressText((order as any).sellerPickupAddressJson) ||
      extractAddressText(inspectionOrderInfo?.sellerAddress) ||
      extractAddressText(inspectionOrderInfo?.sellerContact?.address) ||
      extractAddressText(inspectionOrderInfo?.sellerPickupAddressJson) ||
      getOrderSellerAddress(order);

    if (candidate && candidate !== 'Kho người bán (Đang cập nhật địa chỉ)') {
      return candidate;
    }
    return order.listing?.location || candidate || 'Địa chỉ kho đã lưu trong hồ sơ người bán';
  }, [sellerPickup, order, inspectionOrderInfo]);

  const sellerContactName = React.useMemo(() => {
    return (
      sellerPickup?.name ||
      (order as any).sellerContact?.name ||
      order.sellerName ||
      order.listing?.seller?.name ||
      inspectionOrderInfo?.sellerContact?.name ||
      inspectionOrderInfo?.sellerName ||
      getOrderSellerName(order) ||
      'Gian Hàng Verified Seller'
    ).slice(0, 50);
  }, [sellerPickup, order, inspectionOrderInfo]);

  const sellerContactPhone = React.useMemo(() => {
    return cleanPhone(
      sellerPickup?.phone ||
      (order as any).sellerContact?.phone ||
      order.sellerPhone ||
      (order.listing?.seller as any)?.phoneNumber ||
      order.listing?.seller?.phone ||
      inspectionOrderInfo?.sellerContact?.phone ||
      inspectionOrderInfo?.sellerPhone ||
      getOrderSellerPhone(order),
      '0969768917'
    );
  }, [sellerPickup, order, inspectionOrderInfo]);

  const buyerFullAddress = React.useMemo(() => {
    const candidate =
      parsedBuyerDelivery?.address ||
      parsedBuyerDelivery?.fullAddress ||
      extractAddressText((order as any).deliveryAddress) ||
      extractAddressText((order as any).buyerDeliveryAddressJson) ||
      getOrderBuyerAddress(order) ||
      extractAddressText(inspectionOrderInfo?.buyerAddress) ||
      extractAddressText(inspectionOrderInfo?.buyerDeliveryAddressJson) ||
      extractAddressText((order as any).buyerAddress) ||
      extractAddressText((order as any).buyerContact?.address) ||
      extractAddressText(inspectionOrderInfo?.deliveryAddress);

    if (candidate && candidate !== 'Địa chỉ nhận hàng của người mua') {
      return candidate;
    }
    return candidate || 'Địa chỉ nhận hàng của người mua';
  }, [parsedBuyerDelivery, order, inspectionOrderInfo]);

  const buyerContactName = React.useMemo(() => {
    return (
      parsedBuyerDelivery?.name ||
      (order as any).buyerContact?.name ||
      order.buyerName ||
      (order as any).buyer?.fullName ||
      (order as any).buyer?.name ||
      inspectionOrderInfo?.buyerContact?.name ||
      inspectionOrderInfo?.buyerName ||
      getOrderBuyerName(order) ||
      'Khách mua'
    ).slice(0, 50);
  }, [parsedBuyerDelivery, order, inspectionOrderInfo]);

  const buyerContactPhone = React.useMemo(() => {
    return cleanPhone(
      parsedBuyerDelivery?.phone ||
      (order as any).buyerContact?.phone ||
      order.buyerPhone ||
      (order as any).buyer?.phone ||
      inspectionOrderInfo?.buyerContact?.phone ||
      inspectionOrderInfo?.buyerPhone ||
      getOrderBuyerPhone(order),
      '0987654321'
    );
  }, [parsedBuyerDelivery, order, inspectionOrderInfo]);

  const sellerLat = typeof sellerPickup?.latitude === 'number' && sellerPickup.latitude !== 0
    ? sellerPickup.latitude
    : (typeof (order as any).sellerLatitude === 'number' && (order as any).sellerLatitude !== 0)
      ? (order as any).sellerLatitude
      : 21.0333;

  const sellerLng = typeof sellerPickup?.longitude === 'number' && sellerPickup.longitude !== 0
    ? sellerPickup.longitude
    : (typeof (order as any).sellerLongitude === 'number' && (order as any).sellerLongitude !== 0)
      ? (order as any).sellerLongitude
      : 105.7937;

  const buyerLat = typeof parsedBuyerDelivery?.latitude === 'number' && parsedBuyerDelivery.latitude !== 0
    ? parsedBuyerDelivery.latitude
    : (typeof (order as any).buyerLatitude === 'number' && (order as any).buyerLatitude !== 0)
      ? (order as any).buyerLatitude
      : 10.8698;

  const buyerLng = typeof parsedBuyerDelivery?.longitude === 'number' && parsedBuyerDelivery.longitude !== 0
    ? parsedBuyerDelivery.longitude
    : (typeof (order as any).buyerLongitude === 'number' && (order as any).buyerLongitude !== 0)
      ? (order as any).buyerLongitude
      : 106.6844;

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const payloadLeg = isHubInspection ? 'SELLER_TO_CENTER' : 'SELLER_TO_BUYER';
    const sName = sellerContactName;
    const sPhone = sellerContactPhone;
    const rName = isHubInspection ? (hubCenter?.name || 'Trung tâm kiểm định') : buyerContactName;
    const rPhone = isHubInspection ? cleanPhone(hubCenter?.phone, '0987654321') : buyerContactPhone;

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
          : isAtHome
            ? `Giao hàng đã qua kiểm định tại nhà Đạt chuẩn cho người mua ${rName}`
            : 'Giao hàng cho người mua qua Lalamove',
      };

      // Chỉ gửi địa chỉ nếu là giao thẳng thông thường không qua Hub kiểm định (e.g. SELLER_TO_BUYER hoặc AT_HOME sau kiểm định)
      if (!isHubInspection) {
        shipmentPayload.fromAddress = {
          name: sName,
          phone: sPhone,
          address: sellerFullAddress,
          latitude: sellerLat,
          longitude: sellerLng,
        };
        shipmentPayload.toAddress = {
          name: rName,
          phone: rPhone,
          address: buyerFullAddress,
          latitude: buyerLat,
          longitude: buyerLng,
        };
      }

      if (isHubInspection) {
        // Gọi API tạo vận đơn kiểm định Chặng 1 chuyển hàng từ Người bán đến Hub (Cước trừ ví Doanh nghiệp qua Sàn)
        try {
          shipment = await shippingService.createInspectionShipment(order.id, { requestId, leg: 'SELLER_TO_CENTER', ...shipmentPayload });
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
        const targetId = (order as any).orderId || (order as any).linkedOrderId || order.id;
        const idsToUpdate = Array.from(new Set([order.id, targetId, inspectionOrderInfo?.id, (inspectionOrderInfo as any)?.orderId].filter(Boolean))) as string[];
        for (const oid of idsToUpdate) {
          localStorage.setItem(`order_shipment_created_${oid}`, 'true');
          localStorage.setItem(`seller_ready_${oid}`, nowIso);
          localStorage.setItem(`order_packed_${oid}`, 'true');
          if (isHubInspection) {
            localStorage.setItem(`seller_shipped_to_hub_${oid}`, 'true');
          }

          const shipmentsKey = `sl_order_shipments_${oid}`;
          const existingRaw = localStorage.getItem(shipmentsKey) || localStorage.getItem(`order_shipments_${oid}`);
          let existingList: ShipmentBackend[] = [];
          if (existingRaw) {
            try { existingList = JSON.parse(existingRaw); } catch { }
          }
          const updatedShipments = isHubInspection || isAtHome
            ? [shipment, ...existingList.filter((s) => s.shipmentId !== shipment.shipmentId)]
            : upsertShipment(existingList, shipment);
          localStorage.setItem(shipmentsKey, JSON.stringify(updatedShipments));
          localStorage.setItem(`order_shipments_${oid}`, JSON.stringify(updatedShipments));
        }

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
                  Tạo vận đơn • Lalamove
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isHubInspection ? 'Chặng 1: Gửi Hub' : isAtHome ? 'Giao Trực Tiếp (Kiểm Định Tại Nhà Đạt)' : 'Giao Thẳng'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                Mã đơn hàng: <strong className="font-mono text-slate-700">#{order.id.slice(0, 12).toUpperCase()}</strong> •{' '}
                {isHubInspection
                  ? 'Lộ trình chuyển kiện hàng đến Trạm Kiểm Định SecondLife Hub (Cước Sàn thanh toán)'
                  : isAtHome
                    ? 'Đơn kiểm định tại nhà đã Đạt chuẩn & Khách đã xác nhận mua. Vận chuyển trực tiếp từ Người Bán đến Người Mua qua Lalamove'
                    : 'Vận chuyển trực tiếp từ Người Bán đến Người Mua'}
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
                  {formatConditionGrade(order.listing?.conditionGrade, 'vi') || 'Đã qua sử dụng'}
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

          {/* MỤC 2: LỘ TRÌNH VẬN CHUYỂN */}
          <div className="space-y-2 bg-[#faf8f5] p-3 sm:p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold uppercase text-[10px] sm:text-[11px] text-slate-500 tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                {isHubInspection
                  ? 'Lộ trình Chặng 1: Kho người bán ➔ Trạm Kiểm Định SecondLife Hub'
                  : isAtHome
                    ? 'Lộ trình giao hàng trực tiếp: Kho người bán ➔ Khách mua hàng'
                    : 'Lộ trình nhận & giao hàng Lalamove'}
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {isHubInspection ? 'Lalamove Chặng 1' : isAtHome ? 'Lalamove Giao Trực Tiếp' : 'Lalamove Direct'}
              </span>
            </div>

            {/* Điểm 1: Kho lấy hàng (Người bán) */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                1
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">Kho lấy hàng (Người bán)</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                    {sellerPickup?.address ? 'Kho lấy hàng xác minh' : 'GPS Sẵn Sàng'}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <User className="w-3 h-3 text-slate-500 inline shrink-0" />
                  <span>{sellerContactName}</span>
                  <span className="text-slate-400">•</span>
                  <Phone className="w-3 h-3 text-slate-500 inline shrink-0" />
                  <span className="font-mono text-slate-700">{sellerContactPhone}</span>
                </div>
                <span className="text-slate-700 text-xs block leading-tight font-medium">
                  📍 {sellerFullAddress}
                </span>
                <span className="text-[10px] text-amber-700 italic block">
                  {isAtHome
                    ? 'Tài xế Lalamove sẽ đến địa chỉ kho này để nhận kiện hàng đã dán tem niêm phong đạt chuẩn'
                    : 'Tài xế Lalamove sẽ đến địa chỉ này lấy kiện hàng'}
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
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">
                    {isHubInspection
                      ? `Điểm đến: ${hubCenter.name}`
                      : 'Điểm giao hàng (Người mua)'}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${isHubInspection
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                    {isHubInspection ? '' : 'GPS Người Nhận'}
                  </span>
                </div>
                {!isHubInspection && (
                  <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <User className="w-3 h-3 text-slate-500 inline shrink-0" />
                    <span>{buyerContactName}</span>
                    <span className="text-slate-400">•</span>
                    <Phone className="w-3 h-3 text-slate-500 inline shrink-0" />
                    <span className="font-mono text-slate-700">{buyerContactPhone}</span>
                  </div>
                )}
                <span className="text-slate-700 text-xs block leading-tight font-medium">
                  📍 {isHubInspection ? hubCenter.address : buyerFullAddress}
                </span>
                {isHubInspection ? (
                  <span className="text-[10px] text-blue-700 italic block">
                    Hotline: {hubCenter.phone} • Kĩ thuật viên tiếp nhận thẩm định và cấp chứng thư
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 italic block">
                    Tài xế Lalamove sẽ giao trực tiếp đến tận tay người mua
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MỤC 3: QUY TRÌNH GIAO NHẬN */}
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
                      Hub kích hoạt Chặng 2 giao tận tay khách mua: <strong>{buyerContactName}</strong> ({buyerContactPhone || 'Đã xác minh'}).
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-800 leading-snug pt-1 border-t border-slate-100">
                    <span className="font-bold shrink-0">❌ Nếu KHÔNG ĐẠT:</span>
                    <span>
                      Hub hoàn trả hàng về kho <strong>Người bán</strong>. Phần dư dự phòng cước trả hàng được hoàn cho hai bên theo tỷ lệ đã thống nhất sau khi trừ cước thực tế.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : isAtHome ? (
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-50/90 p-3 rounded-2xl border border-emerald-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold uppercase text-[10px] sm:text-[11px] text-emerald-900 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Kiểm định tại nhà Đạt chuẩn & Khách đã xác nhận mua
                </span>
                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-200 text-emerald-800 border border-emerald-300">
                  Giao Thẳng
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-xl border border-emerald-100 shadow-2xs text-[11px]">
                  <span className="font-bold text-emerald-700 shrink-0">✅ Kỹ thuật viên:</span>
                  <span className="leading-snug">
                    Đã hoàn tất đo kiểm 5 bước tại nhà người bán và dán tem niêm phong đạt chuẩn SecondLife.
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-xl border border-emerald-100 shadow-2xs text-[11px]">
                  <span className="font-bold text-blue-700 shrink-0">✅ Khách mua ({buyerContactName}):</span>
                  <span className="leading-snug">
                    Đã xem biên bản kiểm định, đồng ý nhận máy và thanh toán tiền bảo đảm Escrow.
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-xl border border-amber-200 shadow-2xs text-[11px] text-amber-900">
                  <span className="font-bold shrink-0">📦 Bàn giao tài xế:</span>
                  <span className="leading-snug">
                    Vui lòng bàn giao kiện hàng nguyên vẹn cho tài xế Lalamove để giao thẳng tới địa chỉ người mua: <strong>{buyerFullAddress}</strong>.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <span></span>
          )}



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
                  <span>Đang kết nối...</span>
                </>
              ) : order.escrowStatus === 'AWAITING_PAYMENT' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-gray-500" />
                  <span>Chờ Khách Ký Quỹ Escrow</span>
                </>
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5 text-white" />
                  <span>
                    {isHubInspection
                      ? 'Xác nhận tạo vận đơn gửi đến Hub (Chặng 1)'
                      : isAtHome
                        ? 'Xác nhận tạo vận đơn giao cho khách mua'
                        : 'Xác nhận tạo đơn vận chuyển'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
