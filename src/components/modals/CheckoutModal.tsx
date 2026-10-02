import React, { useState } from 'react';
import { Listing, EscrowOrder, Language } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  X,
  MapPin,
  Phone,
  User,
  Mail,
  Building,
  CreditCard,
  QrCode,
  FileText,
  Sparkles,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface CheckoutModalProps {
  listing: Listing;
  onClose: () => void;
  onOrderPlaced: (order: EscrowOrder) => void;
  lang: Language;
  currentUser?: { id: string; name: string; email?: string; phone?: string; address?: string } | null;
  agreedPrice?: number;
}

const VIETNAM_CITIES = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
  'Quảng Ninh',
  'Bà Rịa - Vũng Tàu'
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  listing,
  onClose,
  onOrderPlaced,
  lang,
  currentUser,
  agreedPrice
}) => {
  const t = translations[lang];

  // Price calculations (supports negotiated agreedPrice)
  const itemPrice = agreedPrice && agreedPrice > 0 ? agreedPrice : listing.priceVnd;
  const hasAgreedDiscount = agreedPrice && agreedPrice < listing.priceVnd;
  const discountAmount = hasAgreedDiscount ? listing.priceVnd - agreedPrice : 0;

  const [hasInspection, setHasInspection] = useState(true);
  const [carrier, setCarrier] = useState<'GHTK' | 'GHN'>('GHTK');
  const [paymentMethod, setPaymentMethod] = useState<'VIETQR' | 'CARD' | 'MOMO'>('VIETQR');

  // Buyer Form Information
  const [buyerName, setBuyerName] = useState(currentUser?.name || 'Hoàng Quốc Khang');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '0912 345 678');
  const [buyerEmail, setBuyerEmail] = useState(currentUser?.email || 'khachhang@secondlife.vn');
  const [city, setCity] = useState('Đà Nẵng');
  const [district, setDistrict] = useState('Hải Châu');
  const [ward, setWard] = useState('Phường Phước Ninh');
  const [streetAddress, setStreetAddress] = useState(
    currentUser?.address || '92 Phan Châu Trinh'
  );
  const [addressType, setAddressType] = useState<'home' | 'office'>('home');
  const [deliveryNote, setDeliveryNote] = useState('Gọi trước khi giao 15 phút, kiểm tra tem niêm phong Hub.');

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const inspectionFee = hasInspection ? 250000 : 0;
  const shippingFee = hasInspection ? 85000 : 45000;
  const platformFee = Math.round(itemPrice * 0.025);
  const totalAmount = itemPrice + inspectionFee + shippingFee + platformFee;

  const fullAddress = `${streetAddress}, ${ward}, ${district}, ${city}`;

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!buyerName.trim()) {
      errors.buyerName = lang === 'vi' ? 'Vui lòng nhập họ tên người nhận' : 'Name is required';
    }
    if (!buyerPhone.trim() || buyerPhone.replace(/\D/g, '').length < 9) {
      errors.buyerPhone = lang === 'vi' ? 'Số điện thoại không hợp lệ (tối thiểu 9 số)' : 'Valid phone required';
    }
    if (!streetAddress.trim()) {
      errors.streetAddress = lang === 'vi' ? 'Vui lòng nhập số nhà, tên đường' : 'Street address is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFillFromProfile = () => {
    if (currentUser) {
      if (currentUser.name) setBuyerName(currentUser.name);
      if (currentUser.phone) setBuyerPhone(currentUser.phone);
      if (currentUser.email) setBuyerEmail(currentUser.email);
      if (currentUser.address) setStreetAddress(currentUser.address);
    }
  };

  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const orderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: EscrowOrder = {
      id: orderId,
      listingId: listing.id,
      listing: {
        ...listing,
        priceVnd: itemPrice
      },
      buyerId: currentUser?.id || 'buyer-current',
      buyerName,
      buyerPhone,
      buyerAddress: fullAddress,
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
              destination: 'SecondLife Inspection Hub',
              estimatedDelivery: '2026-09-08T15:00:00Z',
              timeline: [
                {
                  timestamp: new Date().toISOString(),
                  description: 'Đã tạo mã vận đơn lấy hàng từ người bán đưa về phòng Lab Hub',
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
              origin: 'SecondLife Hub Lab',
              destination: fullAddress,
              estimatedDelivery: '2026-09-10T12:00:00Z',
              timeline: [
                {
                  timestamp: new Date().toISOString(),
                  description: 'Chờ trung tâm kiểm định 48 bước & dán tem niêm phong trước khi giao',
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
              destination: fullAddress,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Header */}
        <div className="p-5 border-b border-[#24263e]/15 flex items-center justify-between bg-gradient-to-r from-[#fce5da] to-[#faf8f5] text-[#24263e]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#24263e] text-white flex items-center justify-center shadow-md">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#24263e]">
                {lang === 'vi' ? 'Đặt Hàng & Thanh Toán Bảo Lãnh Escrow' : 'Escrow Protected Order & Checkout'}
              </h3>
              <p className="text-[11px] text-[#24263e]/80 font-bold">
                {lang === 'vi' ? '100% tiền tạm giữ an toàn tại ngân hàng liên kết đến khi nghiệm thu' : '100% funds held securely until buyer approval'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#24263e] hover:bg-white/40 p-1.5 rounded-xl cursor-pointer transition font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleConfirmOrder} className="p-5 sm:p-6 space-y-6 text-xs text-[#24263e]">
          {/* Item Snapshot */}
          <div className="flex items-center gap-3.5 bg-[#faf8f5] p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
            <img
              src={listing.photos.front}
              alt={listing.title}
              className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
            />
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c34c36] uppercase font-black">{listing.brand}</span>
                <span className="text-gray-300">•</span>
                <span className="text-[10px] text-slate-500 font-semibold">{listing.category}</span>
                {hasAgreedDiscount && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {lang === 'vi' ? '⚡ Giá Thỏa Thuận Chat' : '⚡ Chat Deal Price'}
                  </span>
                )}
              </div>
              <h4 className="font-bold text-[#24263e] truncate text-xs sm:text-sm mt-0.5">{listing.title}</h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-black text-[#24263e]">
                  {formatVND(itemPrice)}
                </span>
                {hasAgreedDiscount && (
                  <span className="text-xs line-through text-slate-400">
                    {formatVND(listing.priceVnd)}
                  </span>
                )}
                {hasAgreedDiscount && (
                  <span className="text-[11px] font-bold text-emerald-600">
                    (Tiết kiệm {formatVND(discountAmount)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Thông Tin Người Mua Nhận Hàng (Requirement 4) */}
          <div className="space-y-4 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#c34c36]/15 text-[#c34c36] flex items-center justify-center font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-[#24263e] uppercase tracking-wide">
                  {lang === 'vi' ? 'Thông Tin Người Nhận Hàng' : 'Buyer Shipping Details'}
                </h4>
              </div>

              {currentUser && (
                <button
                  type="button"
                  onClick={handleFillFromProfile}
                  className="text-[11px] font-bold text-[#c34c36] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{lang === 'vi' ? 'Điền từ hồ sơ của tôi' : 'Fill from profile'}</span>
                </button>
              )}
            </div>

            {/* Row 1: Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Họ và tên người nhận *' : 'Recipient Full Name *'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                      if (formErrors.buyerName) setFormErrors({ ...formErrors, buyerName: '' });
                    }}
                    placeholder="Nguyễn Văn A"
                    className={`w-full pl-9 pr-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition ${
                      formErrors.buyerName ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                    }`}
                  />
                </div>
                {formErrors.buyerName && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.buyerName}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Số điện thoại nhận hàng *' : 'Phone Number *'}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => {
                      setBuyerPhone(e.target.value);
                      if (formErrors.buyerPhone) setFormErrors({ ...formErrors, buyerPhone: '' });
                    }}
                    placeholder="0912 345 678"
                    className={`w-full pl-9 pr-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition ${
                      formErrors.buyerPhone ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                    }`}
                  />
                </div>
                {formErrors.buyerPhone && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.buyerPhone}</span>
                )}
              </div>
            </div>

            {/* Email for Escrow certificate */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {lang === 'vi' ? 'Email nhận chứng nhận Escrow & Hóa đơn điện tử' : 'Email for Escrow Certificate'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-medium text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                />
              </div>
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Tỉnh / Thành phố *' : 'City / Province *'}
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] cursor-pointer"
                >
                  {VIETNAM_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Quận / Huyện *' : 'District *'}
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Quận/Huyện"
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Phường / Xã *' : 'Ward *'}
                </label>
                <input
                  type="text"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  placeholder="Phường/Xã"
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            {/* Street Address & Address Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {lang === 'vi' ? 'Địa chỉ chi tiết (Số nhà, tên đường, căn hộ/tòa nhà) *' : 'Detailed Street Address *'}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => {
                    setStreetAddress(e.target.value);
                    if (formErrors.streetAddress) setFormErrors({ ...formErrors, streetAddress: '' });
                  }}
                  placeholder="Số 92 Phan Châu Trinh, Tòa nhà Sunview, Căn 402"
                  className={`w-full pl-9 pr-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition ${
                    formErrors.streetAddress ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                  }`}
                />
              </div>
              {formErrors.streetAddress && (
                <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.streetAddress}</span>
              )}
            </div>

            {/* Address Type Selector */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-600">{lang === 'vi' ? 'Loại địa chỉ:' : 'Address Type:'}</span>
              <button
                type="button"
                onClick={() => setAddressType('home')}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  addressType === 'home'
                    ? 'bg-[#24263e] text-white border-[#24263e]'
                    : 'bg-[#faf8f5] text-slate-600 border-slate-200'
                }`}
              >
                🏠 {lang === 'vi' ? 'Nhà riêng / Căn hộ' : 'Home / Apartment'}
              </button>
              <button
                type="button"
                onClick={() => setAddressType('office')}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  addressType === 'office'
                    ? 'bg-[#24263e] text-white border-[#24263e]'
                    : 'bg-[#faf8f5] text-slate-600 border-slate-200'
                }`}
              >
                🏢 {lang === 'vi' ? 'Văn phòng / Công ty' : 'Office'}
              </button>
            </div>

            {/* Delivery Note */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {lang === 'vi' ? 'Ghi chú cho bưu tá giao nhận & Kỹ sư Hub' : 'Delivery Note for Courier'}
              </label>
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Gọi trước 15 phút, nhà có thang máy..."
                className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-medium text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>
          </div>

          {/* Workflow Toggle: Inspection vs Direct */}
          <div className="space-y-2">
            <label className="font-extrabold text-[#24263e] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Phương thức giao dịch & kiểm định:' : 'Transaction & Inspection Mode:'}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasInspection(true)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  hasInspection
                    ? 'bg-[#FFFFFF] border-[#24263e] text-[#24263e] ring-2 ring-[#24263e]/20'
                    : 'bg-[#faf8f5] border-gray-200 text-[#24263e]/60 hover:border-[#24263e]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5 text-[#24263e]">
                    <ShieldCheck className="w-4 h-4 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Kiểm Định Hub 48 Bước (Khuyên Dùng)' : 'Hub 48-Point Inspection (Recommended)'}</span>
                  </div>
                  <p className="text-[10px] text-[#24263e]/70 mt-1 font-medium">
                    {lang === 'vi'
                      ? 'Hàng qua SecondLife Hub: Kỹ sư test máy nén, bo mạch, cảm biến & dán tem niêm phong NFC trước khi giao.'
                      : 'Tested at SecondLife Hub: 48-point diagnostic, authentic parts check & NFC tamper-proof sealing.'}
                  </p>
                </div>
                <div className="text-xs font-black text-[#c34c36] mt-2">
                  {lang === 'vi' ? 'Phí: 250,000đ (Bảo hành hoàn tiền 100%)' : 'Fee: 250,000 VND (100% Refund Guarantee)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHasInspection(false)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  !hasInspection
                    ? 'bg-[#FFFFFF] border-[#24263e] text-[#24263e] ring-2 ring-[#24263e]/20'
                    : 'bg-[#faf8f5] border-gray-200 text-[#24263e]/60 hover:border-[#24263e]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5 text-[#24263e]">
                    <Truck className="w-4 h-4 text-[#24263e]" />
                    <span>{lang === 'vi' ? 'Giao Thẳng (Standard Escrow)' : 'Direct Delivery (Standard Escrow)'}</span>
                  </div>
                  <p className="text-[10px] text-[#24263e]/70 mt-1 font-medium">
                    {lang === 'vi'
                      ? 'Người bán ship trực tiếp đến bạn. Tiền vẫn giữ trong Escrow 48h để bạn tự test máy trước khi giải ngân.'
                      : 'Seller ships directly. Funds held in Escrow for 48h for your self-verification.'}
                  </p>
                </div>
                <div className="text-xs font-bold text-slate-500 mt-2">
                  {lang === 'vi' ? 'Miễn phí kiểm định (0đ)' : 'No inspection fee (0 VND)'}
                </div>
              </button>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="font-extrabold text-[#24263e] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Phương thức nạp tiền ký quỹ Escrow:' : 'Escrow Deposit Payment Method:'}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('VIETQR')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'VIETQR'
                    ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                    : 'bg-[#faf8f5] text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">VietQR 247</span>
                <span className="text-[9px] opacity-80">{lang === 'vi' ? 'Quét mã tức thì' : 'Instant scan'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'CARD'
                    ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                    : 'bg-[#faf8f5] text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">Visa / Master</span>
                <span className="text-[9px] opacity-80">{lang === 'vi' ? 'Thẻ quốc tế' : 'Credit / Debit'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MOMO')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'MOMO'
                    ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                    : 'bg-[#faf8f5] text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">Ví MoMo / Zalo</span>
                <span className="text-[9px] opacity-80">{lang === 'vi' ? 'Ví điện tử' : 'E-wallet'}</span>
              </button>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-2 bg-[#faf8f5] p-4 rounded-2xl border border-slate-200">
            <div className="font-extrabold text-[11px] text-[#24263e] uppercase tracking-wider border-b border-slate-200/60 pb-1.5">
              {lang === 'vi' ? 'Chi tiết thanh toán ký quỹ' : 'Escrow Payment Breakdown'}
            </div>

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>{t.itemAmount}:</span>
              <div className="text-right">
                {hasAgreedDiscount && (
                  <span className="line-through text-slate-400 mr-2">
                    {formatVND(listing.priceVnd)}
                  </span>
                )}
                <span className="font-bold text-[#24263e]">{formatVND(itemPrice)}</span>
              </div>
            </div>

            {hasAgreedDiscount && (
              <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                <span>{lang === 'vi' ? 'Giảm giá thương lượng Chat:' : 'Negotiated Chat Discount:'}</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}

            {hasInspection && (
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>{lang === 'vi' ? 'Phí kiểm định phòng Lab Hub (48 bước):' : 'Certified Hub Inspection Fee:'}</span>
                <span className="font-semibold text-[#24263e]">{formatVND(inspectionFee)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>{lang === 'vi' ? 'Phí vận chuyển bưu tá & bảo hiểm hàng:' : 'Logistics & Freight Insurance:'}</span>
              <span className="font-semibold text-[#24263e]">{formatVND(shippingFee)}</span>
            </div>

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>{lang === 'vi' ? 'Phí nền tảng bảo lãnh Escrow (2.5%):' : 'Escrow Platform Guarantee Fee (2.5%):'}</span>
              <span className="font-semibold text-[#24263e]">{formatVND(platformFee)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-[#24263e]">
              <span>{lang === 'vi' ? 'Tổng số tiền phong tỏa tạm giữ:' : 'Total Amount to Lock in Escrow:'}</span>
              <span className="text-base sm:text-lg font-black text-[#c34c36]">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong>{lang === 'vi' ? 'Cam kết Escrow:' : 'Escrow Custody Guarantee:'}</strong>{' '}
              {lang === 'vi'
                ? 'Người bán KHÔNG nhận được tiền ngay. Số tiền được bảo lãnh 100% tại tài khoản ủy thác ngân hàng. Tiền chỉ được giải ngân sau khi kiểm định viên đóng dấu ĐẠT và bạn hài lòng nhận hàng sau 48h trải nghiệm.'
                : 'Seller does NOT receive payment upfront. Funds are 100% secured in bank custody until Hub verification PASS and you approve within 48h.'}
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-white" />
            <span>
              {lang === 'vi'
                ? `Xác Nhận Phong Tỏa Tiền & Đặt Hàng (${formatVND(totalAmount)})`
                : `Authorize Escrow & Place Order (${formatVND(totalAmount)})`}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
