import React, { useState } from 'react';
import { Listing, EscrowOrder, Language } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { ShieldCheck, Truck, CheckCircle2, Lock, X } from 'lucide-react';

interface CheckoutModalProps {
  listing: Listing;
  onClose: () => void;
  onOrderPlaced: (order: EscrowOrder) => void;
  lang: Language;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  listing,
  onClose,
  onOrderPlaced,
  lang
}) => {
  const t = translations[lang];

  const [hasInspection, setHasInspection] = useState(true);
  const [carrier] = useState<'GHTK' | 'GHN'>('GHTK');
  const [buyerName, setBuyerName] = useState('Hoàng Quốc Khang');
  const [buyerPhone, setBuyerPhone] = useState('0912 345 678');
  const [buyerAddress, setBuyerAddress] = useState('92 Phan Châu Trinh, Hải Châu, Đà Nẵng');

  const itemPrice = listing.priceVnd;
  const inspectionFee = hasInspection ? 250000 : 0;
  const shippingFee = hasInspection ? 85000 : 45000;
  const platformFee = Math.round(itemPrice * 0.025);
  const totalAmount = itemPrice + inspectionFee + shippingFee + platformFee;

  const handleConfirmOrder = () => {
    const orderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: EscrowOrder = {
      id: orderId,
      listingId: listing.id,
      listing,
      buyerId: 'buyer-current',
      buyerName,
      buyerPhone,
      buyerAddress,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      itemPriceVnd: itemPrice,
      inspectionFeeVnd: inspectionFee,
      shippingFeeVnd: shippingFee,
      platformFeeVnd: platformFee,
      totalPaidVnd: totalAmount,
      escrowStatus: hasInspection ? 'INSPECTION_IN_PROGRESS' : 'SHIPPED_TO_BUYER',
      hasInspectionService: hasInspection,
      shippingLegs: hasInspection
        ? [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_CENTER',
              carrier: 'GHTK',
              trackingNumber: `GHTK-SG-${Math.floor(100000 + Math.random() * 900000)}`,
              status: 'PICKED_UP',
              origin: listing.location,
              destination: 'SecondLife Inspection Hub TP.HCM',
              estimatedDelivery: '2026-09-08T15:00:00Z',
              timeline: [
                {
                  timestamp: new Date().toISOString(),
                  description: 'Đã tạo mã vận đơn lấy hàng từ người bán',
                  location: listing.location
                }
              ]
            },
            {
              id: 'LEG-2',
              legType: 'CENTER_TO_BUYER',
              carrier: 'GHN',
              trackingNumber: `GHN-EXP-${Math.floor(100000 + Math.random() * 900000)}`,
              status: 'PICKED_UP',
              origin: 'SecondLife Hub TP.HCM',
              destination: buyerAddress,
              estimatedDelivery: '2026-09-10T12:00:00Z',
              timeline: [
                {
                  timestamp: new Date().toISOString(),
                  description: 'Chờ trung tâm kiểm định nghiệm thu & đóng gói niêm phong',
                  location: 'Kho trung tâm SecondLife Hub'
                }
              ]
            }
          ]
        : [
            {
              id: 'LEG-DIRECT',
              legType: 'DIRECT',
              carrier,
              trackingNumber: `${carrier}-DIR-${Math.floor(100000 + Math.random() * 900000)}`,
              status: 'PICKED_UP',
              origin: listing.location,
              destination: buyerAddress,
              estimatedDelivery: '2026-09-09T18:00:00Z',
              timeline: [
                {
                  timestamp: new Date().toISOString(),
                  description: 'Người bán đang chuẩn bị đóng gói giao cho bưu tá',
                  location: listing.location
                }
              ]
            }
          ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      multiStagePhotos: {
        listingPhotos: [listing.photos.front, listing.photos.back]
      }
    };

    onOrderPlaced(newOrder);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#0E121B]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0E121B] text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Thanh Toán Bảo Lãnh Escrow
              </h3>
              <p className="text-[11px] text-white/70">Tiền được giữ an toàn 100% tại ngân hàng liên kết</p>
            </div>
          </div>

          <button onClick={onClose} className="text-white/70 hover:text-white p-1 cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-[#0E121B]">
          {/* Item Snapshot */}
          <div className="flex items-center gap-3 bg-[#F4F5F8] p-3 rounded-2xl border border-gray-200">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
            />
            <div className="overflow-hidden">
              <div className="text-[10px] text-gray-400 uppercase font-bold">{listing.brand}</div>
              <h4 className="font-bold text-[#0E121B] truncate">{listing.title}</h4>
              <div className="text-sm font-black text-[#EC1577] mt-0.5">
                {formatVND(listing.priceVnd)}
              </div>
            </div>
          </div>

          {/* Workflow Toggle */}
          <div className="space-y-2">
            <label className="font-bold text-[#0E121B] uppercase tracking-wider text-[11px]">
              Chọn phương thức giao dịch:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasInspection(true)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  hasInspection
                    ? 'bg-[#FFFFFF] border-[#EC1577] text-[#0E121B] ring-2 ring-[#EC1577]/30'
                    : 'bg-[#F4F5F8] border-gray-200 text-gray-400 hover:border-[#0E121B]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1 text-[#0E121B]">
                    <ShieldCheck className="w-4 h-4 text-[#EC1577]" />
                    <span>Kiểm Định Trước Khi Nhận</span>
                  </div>
                  <p className="text-[10px] text-[#0E121B]/60 mt-1">
                    Hàng gửi tới SecondLife Hub để kỹ sư test máy & dán tem NFC trước khi giao.
                  </p>
                </div>
                <div className="text-xs font-black text-[#EC1577] mt-2">
                  Phí: 250,000đ (Khuyên dùng)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHasInspection(false)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  !hasInspection
                    ? 'bg-[#FFFFFF] border-[#EC1577] text-[#0E121B] ring-2 ring-[#EC1577]/30'
                    : 'bg-[#F4F5F8] border-gray-200 text-gray-400 hover:border-[#0E121B]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1 text-[#0E121B]">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <span>Giao Thẳng (Standard Escrow)</span>
                  </div>
                  <p className="text-[10px] text-[#0E121B]/60 mt-1">
                    Người bán ship trực tiếp. Bạn tự kiểm tra trong 48h trước khi tiền giải ngân.
                  </p>
                </div>
                <div className="text-xs font-bold text-gray-400 mt-2">
                  Miễn phí kiểm định
                </div>
              </button>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="space-y-3 bg-[#F4F5F8] p-4 rounded-2xl border border-gray-200">
            <div className="font-bold text-[#0E121B] text-xs uppercase tracking-wider">
              Thông tin nhận hàng
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#0E121B]/70">Họ tên người nhận:</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#0E121B] focus:outline-none focus:border-[#EC1577]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#0E121B]/70">Số điện thoại:</label>
                <input
                  type="text"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#0E121B] focus:outline-none focus:border-[#EC1577]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-[#0E121B]/70">Địa chỉ giao hàng:</label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#0E121B] focus:outline-none focus:border-[#EC1577]"
                />
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[#0E121B]/70">
              <span>{t.itemAmount}:</span>
              <span className="font-semibold text-[#0E121B]">{formatVND(itemPrice)}</span>
            </div>
            {hasInspection && (
              <div className="flex justify-between text-[#0E121B]/70">
                <span>Phí dịch vụ kiểm định xác thực:</span>
                <span className="font-semibold text-[#0E121B]">{formatVND(inspectionFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#0E121B]/70">
              <span>Phí vận chuyển & bảo hiểm hàng hóa:</span>
              <span className="font-semibold text-[#0E121B]">{formatVND(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-[#0E121B]/70">
              <span>Phí nền tảng Escrow (2.5%):</span>
              <span className="font-semibold text-[#0E121B]">{formatVND(platformFee)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm text-[#0E121B]">
              <span>Tổng số tiền thanh toán tạm giữ:</span>
              <span className="text-base font-extrabold text-[#EC1577]">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="p-3 bg-[#F4F5F8] rounded-xl border border-gray-200 flex items-start gap-2 text-[#0E121B] text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0 mt-0.5" />
            <span>
              <strong>Cam kết Escrow:</strong> Người bán KHÔNG nhận được tiền ngay. Tiền chỉ được giải ngân sau khi kiểm định viên đóng dấu ĐẠT và bạn hài lòng nhận hàng. Nếu phát hiện hàng nhái hoặc không đúng mô tả, hệ thống tự động hoàn tiền 100%.
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleConfirmOrder}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-white" />
            <span>Phong Tỏa Tiền & Đặt Hàng Qua Escrow ({formatVND(totalAmount)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
