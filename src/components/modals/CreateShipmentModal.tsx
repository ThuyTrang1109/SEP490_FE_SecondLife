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

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Backend /api/v1/orders/{orderId}/shipments endpoint strictly requires leg: 'SELLER_TO_BUYER' matching paid quote
      const shipment = await shippingService.createShipment(order.id, {
        requestId,
        leg: 'SELLER_TO_BUYER',
      });

      // Kiểm tra trạng thái vận đơn trả về theo mục 10
      if (shipment.lastError && !shipment.orderCode) {
        setErrorMsg(`Lalamove từ chối tạo chuyến: ${translateApiError(shipment.lastError)}`);
        // Tạo requestId mới cho lần tạo lại sau khi đã sửa lỗi
        setRequestId(crypto.randomUUID());
        return;
      }

      onShipmentCreated(shipment);
    } catch (err: any) {
      console.error('Failed to create Lalamove shipment:', err);
      const status = err?.response?.status || err?.status;
      const rawMsg = err?.response?.data?.message || err?.message || '';
      
      if (rawMsg.toLowerCase().includes('not eligible for outbound shipping') || (order.escrowStatus === 'AWAITING_PAYMENT')) {
        setErrorMsg('Người mua chưa nộp tiền ký quỹ Escrow (trạng thái: Chờ Khách Ký Quỹ). Hệ thống chỉ cho phép gọi bưu tá Lalamove sau khi tiền đã được bảo chứng giữ trong Quỹ Escrow.');
      } else if (rawMsg.toLowerCase().includes('must match the paid shipping quote')) {
        setErrorMsg('Chặng vận chuyển không khớp với báo giá thanh toán của đơn hàng. Với đơn kiểm định Hub, chặng chuyển về Hub do Trung tâm kiểm định điều phối.');
      } else if (rawMsg.toLowerCase().includes('seller must confirm')) {
        setErrorMsg('Người bán cần bấm xác nhận đơn hàng trước khi tạo vận đơn giao hàng.');
      } else if (status === 409 || rawMsg.toLowerCase().includes('fee') || rawMsg.toLowerCase().includes('phí') || rawMsg.toLowerCase().includes('tăng')) {
        setErrorMsg('Cước phí vận chuyển Lalamove hiện tại đã tăng so với số tiền phí người mua đã thanh toán lúc đặt hàng. Hệ thống không thể tự trừ thêm tiền của người mua. Vui lòng kiểm tra lại đơn hàng hoặc hỗ trợ hủy đơn theo quy định.');
      } else if (rawMsg.toLowerCase().includes('disabled') || rawMsg.includes('503')) {
        setErrorMsg('Lalamove chưa được kích hoạt trên máy chủ (LALAMOVE_ENABLED=false). Vui lòng cấu hình API Key đối tác trên Backend hoặc kiểm tra thông tin kho.');
      } else {
        setErrorMsg(translateApiError(rawMsg) || 'Không thể tạo vận đơn Lalamove. Vui lòng kiểm tra lại cấu hình kho lấy hàng hoặc thử lại.');
      }
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
              Lộ trình nhận & giao hàng Lalamove
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

            {/* To (Buyer delivery address) */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                2
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 text-xs">
                    Người nhận: {order.buyerName} ({order.buyerPhone})
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                    GPS Sẵn Sàng
                  </span>
                </div>
                <span className="text-slate-600 text-[11px] block leading-snug">
                  {order.buyerAddress}
                </span>
              </div>
            </div>
          </div>

          {/* Route Overview */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600 shrink-0" />
              <div>
                <span className="font-bold text-xs text-slate-800">
                  {order.hasInspectionService && order.inspectionMethod !== 'AT_HOME'
                    ? 'Chặng vận chuyển bàn giao Trung tâm Hub'
                    : 'Chặng vận chuyển trực tiếp (Người bán → Người mua)'}
                </span>
                <p className="text-[10px] text-slate-500">
                  Tài xế Lalamove sẽ đến địa chỉ kho lấy hàng và phát thẳng theo điều phối hệ thống.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 shrink-0">
              Lalamove Sandbox
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
                  <span>Xác Nhận Tạo Vận Đơn Lalamove</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
