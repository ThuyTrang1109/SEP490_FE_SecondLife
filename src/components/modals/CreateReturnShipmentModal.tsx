import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Store,
  ArrowDown,
  Info,
  RotateCcw,
} from 'lucide-react';
import type { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { shippingService } from '../../services/shippingService';
import { formatConditionGrade, formatVND } from '../../utils/translations';
import { resolveOrderListing } from '../../utils/catalogCache';
import {
  getOrderSellerAddress,
  getOrderSellerName,
  getOrderSellerPhone,
  getOrderBuyerAddress,
  getOrderBuyerName,
  getOrderBuyerPhone,
  extractAddressText,
} from '../../pages/inspection-center/dispatch/orderContacts';
import { createReportRequestId } from '../../services/userReportService';

interface CreateReturnShipmentModalProps {
  order: EscrowOrder;
  onClose: () => void;
  onShipmentCreated: (shipment: ShipmentBackend) => void;
  lang?: Language;
}

export const CreateReturnShipmentModal: React.FC<CreateReturnShipmentModalProps> = ({
  order,
  onClose,
  onShipmentCreated,
  lang = 'vi',
}) => {
  const vi = lang === 'vi';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requestId] = useState<string>(() => createReportRequestId());

  // Parse buyer address / delivery address if stored as JSON
  const parsedBuyerDelivery = useMemo(() => {
    const raw = order.deliveryAddress || (order as any).buyerDeliveryAddressJson || order.buyerAddress;
    if (!raw) return null;
    if (typeof raw === 'object' && (raw.address || raw.fullAddress || raw.name)) return raw;
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw.trim());
        if (parsed && typeof parsed === 'object') return parsed;
      } catch { }
    }
    return null;
  }, [order]);

  // Initial Sender (Khách mua hoàn hàng) details
  const [buyerName, setBuyerName] = useState(() => {
    return (
      parsedBuyerDelivery?.name ||
      order.buyerName ||
      (order as any).buyerContact?.name ||
      getOrderBuyerName(order) ||
      'Khách mua hoàn hàng'
    );
  });

  const [buyerPhone, setBuyerPhone] = useState(() => {
    return (
      parsedBuyerDelivery?.phone ||
      order.buyerPhone ||
      (order as any).buyerContact?.phone ||
      getOrderBuyerPhone(order) ||
      'Chưa cập nhật SĐT'
    );
  });

  const [buyerAddress, setBuyerAddress] = useState(() => {
    return (
      parsedBuyerDelivery?.address ||
      parsedBuyerDelivery?.fullAddress ||
      extractAddressText(order.deliveryAddress) ||
      order.buyerAddress ||
      getOrderBuyerAddress(order) ||
      'Địa chỉ nhận hàng ban đầu của bạn'
    );
  });

  // Initial Recipient (Người bán nhận lại hàng) details
  const [sellerName, setSellerName] = useState(() => {
    return (
      order.sellerName ||
      order.listing?.seller?.name ||
      (order as any).sellerContact?.name ||
      getOrderSellerName(order) ||
      'Người bán'
    );
  });

  const [sellerPhone, setSellerPhone] = useState(() => {
    return (
      order.sellerPhone ||
      (order.listing?.seller as any)?.phoneNumber ||
      order.listing?.seller?.phone ||
      (order as any).sellerContact?.phone ||
      getOrderSellerPhone(order) ||
      'Chưa cập nhật SĐT'
    );
  });

  const [sellerAddress, setSellerAddress] = useState(() => {
    return (
      order.sellerAddress ||
      (order as any).pickupAddress ||
      order.listing?.sellerAddress ||
      order.listing?.location ||
      getOrderSellerAddress(order) ||
      'Kho / Địa chỉ của người bán'
    );
  });

  // Query authorative previous shipments to ensure 100% matched addresses
  useEffect(() => {
    let isMounted = true;
    shippingService
      .getOrderShipments(order.id)
      .then((shipments) => {
        if (!isMounted || !Array.isArray(shipments) || shipments.length === 0) return;
        // Previous outbound shipment
        const outbound =
          shipments.find((s) => s.leg === 'SELLER_TO_BUYER' || s.leg === 'CENTER_TO_BUYER') || shipments[0];
        if (outbound) {
          // Outbound receiver is the return sender (Buyer)
          if (outbound.receiverName) setBuyerName(outbound.receiverName);
          if (outbound.receiverPhone) setBuyerPhone(outbound.receiverPhone);
          if (outbound.receiverAddress) setBuyerAddress(outbound.receiverAddress);

          // Outbound sender is the return recipient (Seller)
          if (outbound.senderName) setSellerName(outbound.senderName);
          if (outbound.senderPhone) setSellerPhone(outbound.senderPhone);
          if (outbound.senderAddress) setSellerAddress(outbound.senderAddress);
        }
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [order.id]);

  const listingResolved = resolveOrderListing(order.listing);
  const itemPrice = order.itemPriceVnd || order.listing?.priceVnd || (order.listing as any)?.price || 0;
  const reportId = order.orderReturn?.reportId;

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId) {
      setErrorMsg(vi ? 'Không tìm thấy mã vụ việc tranh chấp để tạo vận đơn hoàn.' : 'Dispute report ID not found.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const shipment = await shippingService.createShipment(order.id, {
        requestId,
        reportId,
        leg: 'BUYER_TO_SELLER',
      });

      if (shipment.status === 'CANCELLED') {
        setErrorMsg(
          vi
            ? 'Hãng vận chuyển tạm thời chưa nhận chuyến hoàn này. Vui lòng thử lại sau ít phút.'
            : 'The carrier could not accept this return shipment. Please try again in a few moments.'
        );
        setIsSubmitting(false);
        return;
      }

      onShipmentCreated(shipment);
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : vi ? 'Không tạo được vận đơn hoàn hàng.' : 'Failed to create return shipment.');
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden text-[#24263e]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Khóa cứng ở đỉnh */}
        <div className="h-16 px-5 sm:px-6 bg-[#24263e] text-white flex items-center justify-between shrink-0 select-none border-b border-white/10 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                  {vi ? 'Tạo Vận Đơn Hoàn Hàng • Lalamove' : 'Create Return Shipment • Lalamove'}
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {vi ? 'Người mua ➔ Người bán' : 'Buyer ➔ Seller'}
                </span>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">
                {vi ? 'Mã đơn hàng: ' : 'Order ID: '}
                <strong className="font-mono text-white">#{order.id.slice(0, 12).toUpperCase()}</strong>
                {reportId && (
                  <span className="ml-2 text-white/50">
                    • Vụ việc: <strong className="font-mono text-white/80">#{reportId.slice(0, 8)}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center font-bold transition cursor-pointer"
            title={vi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Cuộn mượt mà bên trong */}
        <form onSubmit={handleCreateReturn} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 subtle-scrollbar">
          {/* Thông báo lỗi nếu có */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. THẺ SẢN PHẨM HOÀN TRẢ */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-gray-200 shadow-2xs">
            <img
              src={order.listing?.photos?.front || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&q=80&w=200'}
              alt={order.listing?.title || 'Sản phẩm'}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-gray-200 shrink-0 bg-white shadow-2xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c34c36] uppercase font-black tracking-wide">
                  {listingResolved.brand || 'SecondLife'}
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                  {formatConditionGrade(order.listing?.conditionGrade, 'vi') || 'Đã kiểm định'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                {order.listing?.title}
              </h4>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between flex-wrap gap-2">
                <span>
                  {vi ? 'Giá trị hoàn tiền: ' : 'Refund value: '}
                  <strong className="text-emerald-700 font-extrabold text-xs sm:text-sm">{formatVND(itemPrice)}</strong>
                </span>
                <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {vi ? 'Quỹ Escrow bảo lãnh' : 'Escrow Protected'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. CHI TIẾT LỘ TRÌNH VẬN CHUYỂN: ĐỊA CHỈ GỬI & ĐỊA CHỈ NHẬN */}
          <div className="space-y-3 bg-[#faf8f5] p-4 sm:p-4.5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-200">
              <span className="font-black uppercase text-[11px] text-slate-700 tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-600" />
                {vi ? 'Lộ Trình Vận Chuyển Hoàn Hàng Lalamove' : 'Lalamove Return Logistics Route'}
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                {vi ? 'Giao Thẳng (Người mua ➔ Người bán)' : 'Direct Return'}
              </span>
            </div>

            {/* ĐIỂM 1: ĐỊA CHỈ GỬI (KHÁCH MUA BÀN GIAO HÀNG HOÀN) */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 font-black text-xs">
                    1
                  </div>
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    {vi ? 'Địa chỉ gửi (Tài xế Lalamove đến lấy hàng)' : 'Sender Address (Pickup)'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                  {vi ? 'Điểm lấy hàng' : 'Pickup Point'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 truncate">{buyerName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 font-mono">{buyerPhone}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{buyerAddress}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                {vi
                  ? '* Tài xế sẽ đến nhận kiện hàng trực tiếp tại địa chỉ giao hàng của bạn.'
                  : '* The driver will pick up the parcel directly at your original delivery address.'}
              </p>
            </div>

            {/* Mũi tên lộ trình trung gian */}
            <div className="flex items-center justify-center gap-2 py-0.5 text-indigo-600">
              <div className="h-px bg-indigo-200 flex-1" />
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-200 text-[10px] font-extrabold">
                <ArrowDown className="w-3 h-3 text-indigo-600 animate-bounce" />
                <span>{vi ? 'Tài xế Lalamove vận chuyển hoàn về người bán' : 'In transit back to seller'}</span>
              </div>
              <div className="h-px bg-indigo-200 flex-1" />
            </div>

            {/* ĐIỂM 2: ĐỊA CHỈ NHẬN (NGƯỜI BÁN NHẬN LẠI HÀNG HOÀN) */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-black text-xs">
                    2
                  </div>
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    {vi ? 'Địa chỉ nhận (Kho / Nhà người bán)' : 'Recipient Address (Return Dropoff)'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {vi ? 'Điểm giao trả' : 'Dropoff Point'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-700">
                  <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 truncate">{sellerName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 font-mono">{sellerPhone}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{sellerAddress}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                {vi
                  ? '* Kiện hàng sẽ được giao trả về người bán.'
                  : '* The parcel will be returned to the seller to verify the returned product.'}
              </p>
            </div>
          </div>



          {/* Hidden submit trigger */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>

        {/* Modal Footer - Khóa cứng ở đáy */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 select-none z-20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-slate-700 hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            {vi ? 'Hủy bỏ' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleCreateReturn}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{vi ? 'Đang tạo vận đơn Lalamove…' : 'Booking with Lalamove…'}</span>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 text-white" />
                <span>{vi ? 'Xác Nhận Tạo Vận Đơn Hoàn' : 'Confirm & Book Return'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
