import React, { useState } from 'react';
import { Listing, EscrowOrder, Language } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { ShieldCheck, Truck, CheckCircle2, Lock, X } from 'lucide-react';

interface CheckoutModalProps {
  listing: Listing;
  onClose: () => void;
  onOrderPlaced: (order: EscrowOrder) => void;
  lang: Language;
  currentUser?: { id: string; name: string; email?: string; phone?: string; address?: string } | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  listing,
  onClose,
  onOrderPlaced,
  lang,
  currentUser
}) => {
  const t = translations[lang];

  const [hasInspection, setHasInspection] = useState(true);
  const [carrier] = useState<'GHTK' | 'GHN'>('GHTK');
  const [buyerName, setBuyerName] = useState(currentUser?.name || 'Khách hàng SecondLife');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '0912 345 678');
  const [buyerAddress, setBuyerAddress] = useState(currentUser?.address || '92 Phan Châu Trinh, Hải Châu, Đà Nẵng');

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
      buyerId: currentUser?.id || 'buyer-current',
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
      <div className="bg-[#FFFFFF] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#2b1d16]">
        {/* Header */}
        <div className="p-5 border-b border-[#2b1d16]/15 flex items-center justify-between bg-[#cea981] text-[#2b1d16]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2b1d16] text-white flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#2b1d16]">
                {lang === 'vi' ? 'Thanh Toán Bảo Lãnh Escrow' : 'Escrow Protected Checkout'}
              </h3>
              <p className="text-[11px] text-[#2b1d16]/80 font-bold">
                {lang === 'vi' ? 'Tiền được giữ an toàn 100% tại ngân hàng liên kết' : '100% funds held securely in partner custodial bank'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-[#2b1d16] hover:bg-white/40 p-1.5 rounded-lg cursor-pointer transition font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-[#2b1d16]">
          {/* Item Snapshot */}
          <div className="flex items-center gap-3 bg-[#f6f5eb] p-3 rounded-2xl border border-gray-200">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
            />
            <div className="overflow-hidden">
              <div className="text-[10px] text-[#2b1d16]/60 uppercase font-black">{listing.brand}</div>
              <h4 className="font-bold text-[#2b1d16] truncate">{listing.title}</h4>
              <div className="text-sm font-black text-[#2b1d16] mt-0.5">
                {formatVND(listing.priceVnd)}
              </div>
            </div>
          </div>

          {/* Workflow Toggle */}
          <div className="space-y-2">
            <label className="font-bold text-[#2b1d16] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Chọn phương thức giao dịch:' : 'Select Transaction Mode:'}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasInspection(true)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  hasInspection
                    ? 'bg-[#FFFFFF] border-[#2b1d16] text-[#2b1d16] ring-2 ring-[#2b1d16]/20'
                    : 'bg-[#f6f5eb] border-gray-200 text-[#2b1d16]/60 hover:border-[#2b1d16]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1 text-[#2b1d16]">
                    <ShieldCheck className="w-4 h-4 text-[#2b1d16]" />
                    <span>{lang === 'vi' ? 'Kiểm Định Trước Khi Nhận' : 'Inspection Before Delivery'}</span>
                  </div>
                  <p className="text-[10px] text-[#2b1d16]/70 mt-1 font-medium">
                    {lang === 'vi'
                      ? 'Hàng gửi tới SecondLife Hub để kỹ sư test máy & dán tem NFC trước khi giao.'
                      : 'Shipped to SecondLife Hub for hardware diagnostics & NFC tamper sealing before delivery.'}
                  </p>
                </div>
                <div className="text-xs font-black text-[#2b1d16] mt-2">
                  {lang === 'vi' ? 'Phí: 250,000đ (Khuyên dùng)' : 'Fee: 250,000 VND (Recommended)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHasInspection(false)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  !hasInspection
                    ? 'bg-[#FFFFFF] border-[#2b1d16] text-[#2b1d16] ring-2 ring-[#2b1d16]/20'
                    : 'bg-[#f6f5eb] border-gray-200 text-[#2b1d16]/60 hover:border-[#2b1d16]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1 text-[#2b1d16]">
                    <Truck className="w-4 h-4 text-[#2b1d16]" />
                    <span>{lang === 'vi' ? 'Giao Thẳng (Standard Escrow)' : 'Direct Delivery (Standard Escrow)'}</span>
                  </div>
                  <p className="text-[10px] text-[#2b1d16]/70 mt-1 font-medium">
                    {lang === 'vi'
                      ? 'Người bán ship trực tiếp. Bạn tự kiểm tra trong 48h trước khi tiền giải ngân.'
                      : 'Seller ships directly. You verify within 48h before escrow release.'}
                  </p>
                </div>
                <div className="text-xs font-bold text-[#2b1d16]/60 mt-2">
                  {lang === 'vi' ? 'Miễn phí kiểm định' : 'No inspection fee'}
                </div>
              </button>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="space-y-3 bg-[#f6f5eb] p-4 rounded-2xl border border-gray-200">
            <div className="font-bold text-[#2b1d16] text-xs uppercase tracking-wider">
              {lang === 'vi' ? 'Thông tin nhận hàng' : 'Shipping Information'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#2b1d16]/70">{lang === 'vi' ? 'Họ tên người nhận:' : 'Recipient Name:'}</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#2b1d16] focus:outline-none focus:border-[#cea981]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#2b1d16]/70">{lang === 'vi' ? 'Số điện thoại:' : 'Phone Number:'}</label>
                <input
                  type="text"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#2b1d16] focus:outline-none focus:border-[#cea981]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-[#2b1d16]/70">{lang === 'vi' ? 'Địa chỉ giao hàng:' : 'Delivery Address:'}</label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-gray-200 rounded-xl text-xs text-[#2b1d16] focus:outline-none focus:border-[#cea981]"
                />
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[#2b1d16]/70">
              <span>{t.itemAmount}:</span>
              <span className="font-semibold text-[#2b1d16]">{formatVND(itemPrice)}</span>
            </div>
            {hasInspection && (
              <div className="flex justify-between text-[#2b1d16]/70">
                <span>{lang === 'vi' ? 'Phí dịch vụ kiểm định xác thực:' : 'Certified Inspection Fee:'}</span>
                <span className="font-semibold text-[#2b1d16]">{formatVND(inspectionFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#2b1d16]/70">
              <span>{lang === 'vi' ? 'Phí vận chuyển & bảo hiểm hàng hóa:' : 'Shipping & Insurance Fee:'}</span>
              <span className="font-semibold text-[#2b1d16]">{formatVND(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-[#2b1d16]/70">
              <span>{lang === 'vi' ? 'Phí nền tảng Escrow (2.5%):' : 'Escrow Platform Fee (2.5%):'}</span>
              <span className="font-semibold text-[#2b1d16]">{formatVND(platformFee)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm text-[#2b1d16]">
              <span>{lang === 'vi' ? 'Tổng số tiền thanh toán tạm giữ:' : 'Total Escrow Custody Amount:'}</span>
              <span className="text-base font-extrabold text-[#2b1d16]">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="p-3 bg-[#f6f5eb] rounded-xl border border-gray-200 flex items-start gap-2 text-[#2b1d16] text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-[#2b1d16] shrink-0 mt-0.5" />
            <span>
              <strong>{lang === 'vi' ? 'Cam kết Escrow:' : 'Escrow Guarantee:'}</strong>{' '}
              {lang === 'vi'
                ? 'Người bán KHÔNG nhận được tiền ngay. Tiền chỉ được giải ngân sau khi kiểm định viên đóng dấu ĐẠT và bạn hài lòng nhận hàng. Nếu phát hiện hàng nhái hoặc không đúng mô tả, hệ thống tự động hoàn tiền 100%.'
                : 'The seller does NOT receive funds immediately. Money is released only after the technician certifies PASS and you confirm receipt. Full 100% refund if counterfeit or not as described.'}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleConfirmOrder}
            className="w-full py-3 px-4 bg-[#2b1d16] hover:bg-black text-white rounded-xl font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-white" />
            <span>
              {lang === 'vi'
                ? `Phong Tỏa Tiền & Đặt Hàng Qua Escrow (${formatVND(totalAmount)})`
                : `Lock Funds & Place Escrow Order (${formatVND(totalAmount)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
