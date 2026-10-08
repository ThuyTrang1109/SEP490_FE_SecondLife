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
  const [leg, setLeg] = useState<'SELLER_TO_BUYER' | 'SELLER_TO_CENTER'>('SELLER_TO_BUYER');

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const requestId = crypto.randomUUID();
      const shipment = await shippingService.createShipment(order.id, {
        requestId,
        leg,
      });

      onShipmentCreated(shipment);
    } catch (err: any) {
      console.error('Failed to create GHN shipment:', err);
      setErrorMsg(err?.message || 'Không thể tạo vận đơn GHN. Vui lòng kiểm tra lại cấu hình kho lấy hàng hoặc thử lại.');
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
                Tạo Vận Đơn Giao Hàng Nhanh (GHN)
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
              <span>{errorMsg}</span>
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
              <span className="text-[10px] text-[#c34c36] uppercase font-black">{order.listing.brand}</span>
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Giá trị hàng: <strong className="text-slate-900">{formatVND(order.itemPriceVnd)}</strong>
              </div>
            </div>
          </div>

          {/* Logistics Route Visualizer */}
          <div className="space-y-3 bg-[#faf8f5] p-4 rounded-2xl border border-gray-200">
            <span className="font-extrabold uppercase text-[10px] text-slate-400 block tracking-wider">
              Lộ trình nhận & giao hàng GHN
            </span>

            {/* From (Seller warehouse) */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                1
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-900 text-xs block">Kho lấy hàng (Người bán)</span>
                <span className="text-slate-600 text-[11px] block leading-snug">
                  {order.listing.location || 'Địa chỉ kho đã lưu trong hồ sơ người bán'}
                </span>
                <span className="text-[10px] text-amber-700 italic block">
                  Bưu tá GHN sẽ đến địa chỉ này lấy kiện hàng
                </span>
              </div>
            </div>

            <div className="w-0.5 h-4 bg-slate-300 ml-3" />

            {/* To (Buyer delivery address) */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                2
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-900 text-xs block">
                  Người nhận: {order.buyerName} ({order.buyerPhone})
                </span>
                <span className="text-slate-600 text-[11px] block leading-snug">
                  {order.buyerAddress}
                </span>
              </div>
            </div>
          </div>

          {/* Leg Selection */}
          <div className="space-y-2">
            <label className="font-extrabold text-[11px] uppercase tracking-wider text-slate-600">
              Chặng giao hàng:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setLeg('SELLER_TO_BUYER')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  leg === 'SELLER_TO_BUYER'
                    ? 'border-[#c34c36] bg-[#c34c36]/5 text-slate-900 font-bold ring-2 ring-[#c34c36]/20'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Truck className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>Giao thẳng (Seller → Buyer)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-normal">
                  Áp dụng giao hàng trực tiếp bưu tá đến nhà người mua.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLeg('SELLER_TO_CENTER')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  leg === 'SELLER_TO_CENTER'
                    ? 'border-[#c34c36] bg-[#c34c36]/5 text-slate-900 font-bold ring-2 ring-[#c34c36]/20'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Qua Hub Kiểm Định (Seller → Hub)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-normal">
                  Chuyển kiện hàng đến trung tâm kiểm định SecondLife.
                </p>
              </button>
            </div>
          </div>

          {/* Info notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2 text-[11px] text-blue-900">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Sau khi tạo vận đơn, hệ thống sẽ cấp mã vận đơn GHN chính thức. Bạn có thể in phiếu gửi và chuẩn bị đóng gói để bàn giao cho bưu tá.
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
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-black text-xs transition cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span>Đang kết nối GHN...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-white" />
                  <span>Xác Nhận Tạo Vận Đơn GHN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
