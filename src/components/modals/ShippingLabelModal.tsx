import React, { useState, useEffect } from 'react';
import { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Printer,
  X,
  Truck,
  QrCode,
  Package,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';

interface ShippingLabelModalProps {
  order: EscrowOrder;
  shipment: ShipmentBackend;
  onClose: () => void;
  lang: Language;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({
  order,
  shipment,
  onClose,
  lang,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileNotice(null);
    try {
      const updated = await shippingService.reconcileCreation(shipment.shipmentId);
      setReconcileNotice(`Đã đối soát và tạo lại vận đơn thành công: Mã #${updated.orderCode || updated.shipmentId}`);
    } catch (err: any) {
      setReconcileNotice(err?.message || 'Không thể đối soát tạo lại vận đơn.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const trackingCode = shipment.orderCode || `LLM-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-gray-200 my-auto">
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Phiếu Gửi Hàng & Vận Đơn Lalamove Delivery
              </h3>
              <p className="text-xs text-slate-500">Mã đơn: #{order.id} • Đối tác vận chuyển Lalamove</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reconcile notice or exception banner */}
        {reconcileNotice && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-semibold flex items-center justify-between">
            <span>{reconcileNotice}</span>
            <button onClick={() => setReconcileNotice(null)} className="text-blue-500 hover:text-blue-700">✕</button>
          </div>
        )}

        {(shipment.status === 'FAILED' || shipment.status === 'PENDING_RETRY') && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-rose-800 block">Vận đơn gặp sự cố hoặc timeout tạo mã</span>
              <span className="text-[11px] text-rose-700">Bấm thử lại để kích hoạt đối soát và cấp lại mã vận đơn</span>
            </div>
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 shrink-0"
            >
              {isReconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Thử Lại (Reconcile)</span>
            </button>
          </div>
        )}

        {/* Printable Voucher Paper */}
        <div id="printable-lalamove-label" className="mt-5 p-5 rounded-2xl bg-slate-50 border-2 border-dashed border-gray-300 space-y-4">
          {/* Header Row: Lalamove branding & Tracking Barcode */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-[#c34c36] tracking-tight">LALAMOVE DELIVERY</span>
                <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded">HÀNG LẤY TẬN KHO</span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold block">Dịch vụ Giao hàng hỏa tốc Lalamove</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Mã vận đơn Lalamove</span>
              <span className="font-mono font-black text-sm bg-slate-900 text-white px-3 py-1 rounded-lg block">
                {trackingCode}
              </span>
            </div>
          </div>

          {/* Barcode Mock Visualizer */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 text-center space-y-1">
            <div className="h-10 w-full flex items-center justify-center gap-1 overflow-hidden px-4">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full ${i % 3 === 0 ? 'w-1 bg-black' : i % 5 === 0 ? 'w-1.5 bg-black' : 'w-0.5 bg-black'}`}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-slate-600 font-bold tracking-widest">{trackingCode}</span>
          </div>

          {/* Addresses 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Sender / Pickup address */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Người gửi (Kho tài xế Lalamove lấy hàng)</span>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{order.sellerName}</span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{order.listing.location || 'Địa chỉ kho đăng ký của người bán'}</span>
              </div>
            </div>

            {/* Receiver / Delivery address */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Người nhận (Điểm giao hàng)</span>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{order.buyerName}</span>
              </div>
              <div className="font-bold text-slate-700 flex items-center gap-1 text-[11px]">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{order.buyerPhone}</span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{order.buyerAddress}</span>
              </div>
            </div>
          </div>

          {/* Parcel & Payment Details */}
          <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-slate-500">Sản phẩm gửi:</span>
              <span className="font-bold text-slate-900 truncate max-w-[260px]">{order.listing.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <span>Khối lượng ước tính: </span>
                <strong className="text-slate-900">5.0 kg</strong>
              </div>
              <div>
                <span>Bảo hiểm hàng hóa: </span>
                <strong className="text-slate-900">{formatVND(order.itemPriceVnd)}</strong>
              </div>
              <div>
                <span>Chặng vận chuyển: </span>
                <strong className="text-slate-900">{shipment.leg || 'SELLER_TO_BUYER'}</strong>
              </div>
              <div>
                <span>Tiền thu hộ COD: </span>
                <strong className="text-emerald-700 font-bold">0 VNĐ (Đã thanh toán Escrow)</strong>
              </div>
            </div>
          </div>

          {/* Lalamove Delivery instructions */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
            <div className="font-bold uppercase tracking-tight flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Chỉ dẫn tài xế Lalamove:</span>
            </div>
            <p className="leading-snug">
              Cho khách xem hàng, không cho dùng thử. Sản phẩm điện máy gia dụng SecondLife đã được niêm phong kỹ lưỡng. Chuyển hoàn về người gửi sau 3 lần giao không thành công.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-black text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>In Phiếu Dán Kiện Hàng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
