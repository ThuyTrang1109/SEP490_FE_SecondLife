import React, { useState, useEffect, useCallback } from 'react';
import { Listing, EscrowOrder, Language, UserWallet, ShippingQuoteResponseDto, ShippingLeg } from '../../types';
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
  QrCode,
  Sparkles,
  Wallet,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock
} from 'lucide-react';
import { orderService, walletService, shippingService, GhnLocation } from '../../services';

interface CheckoutModalProps {
  listing: Listing;
  onClose: () => void;
  onOrderPlaced: (order: EscrowOrder) => void;
  lang: Language;
  currentUser?: { id: string; name: string; email?: string; phone?: string; address?: string } | null;
  agreedPrice?: number;
  negotiationId?: string;
  onOpenDeposit?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  listing,
  onClose,
  onOrderPlaced,
  lang,
  currentUser,
  agreedPrice,
  negotiationId,
  onOpenDeposit,
}) => {
  const t = translations[lang];

  // Price calculations (supports negotiated agreedPrice)
  const itemPrice = agreedPrice && agreedPrice > 0 ? agreedPrice : listing.priceVnd;
  const hasAgreedDiscount = agreedPrice && agreedPrice < listing.priceVnd;
  const discountAmount = hasAgreedDiscount ? listing.priceVnd - agreedPrice : 0;

  const [hasInspection, setHasInspection] = useState(false);

  // Wallet and Order Submission States
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // GHN Address & Catalogue States
  const [provinces, setProvinces] = useState<GhnLocation[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | ''>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>('');

  const [wards, setWards] = useState<GhnLocation[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [selectedWardName, setSelectedWardName] = useState<string>('');

  // Buyer Form Information
  const [buyerName, setBuyerName] = useState(currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [buyerEmail, setBuyerEmail] = useState(currentUser?.email || '');
  const [streetAddress, setStreetAddress] = useState(currentUser?.address || '');
  const [addressType, setAddressType] = useState<'home' | 'office'>('home');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Delivery & Protection Option: 'INSPECTION' (Verify Then Ship) or 'DIRECT' (Direct Door-to-Door)
  const [deliveryOption, setDeliveryOption] = useState<'INSPECTION' | 'DIRECT'>('INSPECTION');

  // GHN Quote State
  const [ghnQuote, setGhnQuote] = useState<ShippingQuoteResponseDto | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Load wallet on mount
  useEffect(() => {
    let isMounted = true;
    const fetchWallet = async () => {
      setWalletLoading(true);
      try {
        const w = await walletService.getMyWallet();
        if (isMounted && w) setWallet(w);
      } catch (err) {
        console.warn('Could not fetch wallet in checkout modal:', err);
      } finally {
        if (isMounted) setWalletLoading(false);
      }
    };
    fetchWallet();
    return () => { isMounted = false; };
  }, []);

  // Load GHN Provinces on mount
  useEffect(() => {
    let isMounted = true;
    const loadProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const provs = await shippingService.getProvinces();
        if (isMounted && Array.isArray(provs) && provs.length > 0) {
          setProvinces(provs);
        }
      } catch (err) {
        console.warn('Error loading GHN provinces:', err);
      } finally {
        if (isMounted) setLoadingProvinces(false);
      }
    };
    loadProvinces();
    return () => { isMounted = false; };
  }, []);

  // Load GHN Wards when selectedProvinceId changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setWards([]);
      setSelectedWardName('');
      setGhnQuote(null);
      return;
    }

    let isMounted = true;
    const loadWards = async () => {
      setLoadingWards(true);
      try {
        const w = await shippingService.getWards(selectedProvinceId);
        if (isMounted) {
          setWards(w);
        }
      } catch (err) {
        console.warn('Error loading GHN wards:', err);
      } finally {
        if (isMounted) setLoadingWards(false);
      }
    };
    loadWards();
    return () => { isMounted = false; };
  }, [selectedProvinceId]);

  // Request GHN Shipping Quote
  const calculateGhnQuote = useCallback(async (
    pName?: string,
    wName?: string,
    addr?: string,
    name?: string,
    phone?: string
  ) => {
    const province = (pName || selectedProvinceName || '').trim();
    const ward = (wName || selectedWardName || '').trim();
    if (!province || !ward) {
      return;
    }

    const rawPhone = (phone || buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
    const validPhone = rawPhone.length >= 9 && rawPhone.length <= 15 ? rawPhone : '0912345678';
    const validName = (name || buyerName || currentUser?.name || 'Khách Hàng').trim() || 'Khách Hàng';
    const validAddress = (addr || streetAddress || 'Địa chỉ nhận hàng').trim() || 'Địa chỉ nhận hàng';

    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const quote = await shippingService.getShippingQuote({
        postId: listing.id,
        ...(negotiationId ? { negotiationId } : {}),
        deliveryAddress: {
          name: validName,
          phone: validPhone,
          address: validAddress,
          provinceName: province,
          wardName: ward,
          newAddress: true,
        },
      });
      setGhnQuote(quote);
      setQuoteError(null);
    } catch (err: any) {
      console.warn('Failed to calculate GHN quote:', err);
      let errMsg = err?.response?.data?.message || err?.message || 'Không thể tính phí vận chuyển GHN.';
      if (typeof errMsg === 'string') {
        if (errMsg.includes('Seller pickup address is not configured')) {
          errMsg = 'Người bán chưa cấu hình địa chỉ kho lấy hàng GHN. Hệ thống sẽ tạm tính cước phí giao tiêu chuẩn.';
        } else if (errMsg.includes('You cannot buy your own post')) {
          errMsg = 'Bạn đang đăng nhập bằng tài khoản người bán. Không thể tạo báo giá mua bài đăng của chính mình.';
        } else if (errMsg.includes('Post is not available')) {
          errMsg = 'Bài đăng hiện không ở trạng thái sẵn sàng để giao dịch.';
        }
      }
      setQuoteError(errMsg);
    } finally {
      setQuoteLoading(false);
    }
  }, [selectedProvinceName, selectedWardName, streetAddress, buyerName, buyerPhone, currentUser, listing.id, negotiationId]);

  // Debounced auto-quote calculation when address fields change
  useEffect(() => {
    if (selectedProvinceName && selectedWardName) {
      const timer = setTimeout(() => {
        calculateGhnQuote(selectedProvinceName, selectedWardName, streetAddress, buyerName, buyerPhone);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedProvinceName, selectedWardName, streetAddress, calculateGhnQuote]);

  // Financial values
  const shippingFee = ghnQuote ? Number(ghnQuote.shippingFee) : 30000;
  const productPrice = ghnQuote ? Number(ghnQuote.productPrice) : itemPrice;
  const totalAmount = ghnQuote ? Number(ghnQuote.totalPayable) : (itemPrice + shippingFee);

  const fullAddress = `${streetAddress}, ${selectedWardName}, ${selectedProvinceName}`;

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!buyerName.trim()) {
      errors.buyerName = lang === 'vi' ? 'Vui lòng nhập họ tên người nhận' : 'Name is required';
    }
    if (!buyerPhone.trim() || buyerPhone.replace(/\D/g, '').length < 9) {
      errors.buyerPhone = lang === 'vi' ? 'Số điện thoại không hợp lệ (tối thiểu 9 số)' : 'Valid phone required';
    }
    if (!selectedProvinceName) {
      errors.city = lang === 'vi' ? 'Vui lòng chọn Tỉnh/Thành phố GHN' : 'City is required';
    }
    if (!selectedWardName) {
      errors.ward = lang === 'vi' ? 'Vui lòng chọn Phường/Xã GHN' : 'Ward is required';
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

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    let activeQuote = ghnQuote;
    if (!activeQuote || !activeQuote.quoteId) {
      if (selectedProvinceName && selectedWardName) {
        setSubmittingOrder(true);
        try {
          const rawPhone = (buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
          const validPhone = rawPhone.length >= 9 && rawPhone.length <= 15 ? rawPhone : '0912345678';
          activeQuote = await shippingService.getShippingQuote({
            postId: listing.id,
            ...(negotiationId ? { negotiationId } : {}),
            deliveryAddress: {
              name: (buyerName || currentUser?.name || 'Khách Hàng').trim(),
              phone: validPhone,
              address: (streetAddress || 'Địa chỉ nhận hàng').trim(),
              provinceName: selectedProvinceName.trim(),
              wardName: selectedWardName.trim(),
              newAddress: true,
            },
          });
          setGhnQuote(activeQuote);
        } catch (err: any) {
          setOrderError(err?.message || 'Không thể lấy báo giá GHN. Vui lòng kiểm tra lại địa chỉ hoặc thử lại.');
          setSubmittingOrder(false);
          return;
        }
      } else {
        setOrderError(
          lang === 'vi'
            ? 'Đang chờ báo giá vận chuyển từ GHN. Vui lòng kiểm tra lại địa chỉ hoặc bấm thử lại.'
            : 'Awaiting GHN shipping quote. Please check your address or retry.'
        );
        return;
      }
    }

    const currentBal = wallet?.balance ?? 0;
    if (currentBal < totalAmount) {
      setOrderError(
        lang === 'vi'
          ? `Số dư ví của bạn (${formatVND(currentBal)}) không đủ để thanh toán đơn hàng (${formatVND(totalAmount)}). Vui lòng nạp thêm tiền vào ví để hoàn tất đặt hàng.`
          : `Your wallet balance (${formatVND(currentBal)}) is insufficient for order checkout (${formatVND(totalAmount)}). Please deposit funds to continue.`
      );
      return;
    }

    setOrderError(null);
    setSubmittingOrder(true);

    try {
      // Step 7: Call Backend API: POST /api/v1/orders
      const requestId = crypto.randomUUID();
      const backendOrder = await orderService.createOrder({
        postId: listing.id,
        shippingQuoteId: ghnQuote.quoteId,
        requestId,
        ...(negotiationId ? {
          negotiationId,
          agreedPrice: productPrice,
        } : {}),
      });

      const orderId = backendOrder?.id || `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalChargedPrice = backendOrder?.finalPrice || productPrice;
      const finalShippingFee = backendOrder?.shippingFee || shippingFee;
      const finalTotalPaid = backendOrder?.totalPaid || totalAmount;

      const isInspected = deliveryOption === 'INSPECTION';
      const shippingLegsData: ShippingLeg[] = isInspected
        ? [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_CENTER',
              carrier: 'GHN Express',
              trackingNumber: `GHN-HUB-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'PICKED_UP',
              origin: listing.location || 'Địa chỉ kho người bán',
              destination: 'Trạm Kiểm Định SecondLife Hub Lab',
              estimatedDelivery: '1-2 ngày',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: 'Khởi tạo đơn hàng có kiểm định Hub (Verify Then Ship). Bưu tá GHN chuẩn bị lấy hàng chuyển về Hub.',
                  location: 'Hệ thống SecondLife Escrow'
                }
              ]
            },
            {
              id: 'LEG-2',
              legType: 'CENTER_TO_BUYER',
              carrier: 'GHN Express',
              trackingNumber: `GHN-BUYER-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'IN_TRANSIT',
              origin: 'Trạm Kiểm Định SecondLife Hub Lab',
              destination: fullAddress,
              estimatedDelivery: '1-2 ngày sau khi đạt chuẩn kiểm định',
              timeline: [
                {
                  timestamp: '--:--',
                  description: 'Chờ hoàn tất quy trình kiểm định và dán tem niêm phong NFC tại Hub Lab.',
                  location: 'Trung tâm kiểm định SecondLife'
                }
              ]
            }
          ]
        : [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_BUYER',
              carrier: 'GHN Express',
              trackingNumber: `GHN-DIRECT-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'PICKED_UP',
              origin: listing.location || 'Địa chỉ kho người bán',
              destination: fullAddress,
              estimatedDelivery: ghnQuote?.expectedDeliveryTime || '1-2 ngày',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: 'Đã thanh toán ví thành công qua Escrow. Bưu tá GHN lấy hàng và giao thẳng trực tiếp đến người mua.',
                  location: 'Hệ thống SecondLife Escrow'
                }
              ]
            }
          ];

      const newOrder: EscrowOrder = {
        id: orderId,
        listingId: listing.id,
        listing: {
          ...listing,
          priceVnd: finalChargedPrice,
        },
        buyerId: currentUser?.id || 'buyer-current',
        buyerName,
        buyerPhone,
        buyerAddress: fullAddress,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        itemPriceVnd: finalChargedPrice,
        inspectionFeeVnd: 0,
        shippingFeeVnd: finalShippingFee,
        platformFeeVnd: 0,
        totalPaidVnd: finalTotalPaid,
        escrowStatus: 'HELD_IN_ESCROW',
        hasInspectionService: isInspected,
        shippingLegs: shippingLegsData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        multiStagePhotos: {
          listingPhotos: [listing.photos.front, listing.photos.back]
        }
      };

      onOrderPlaced(newOrder);
    } catch (err: any) {
      console.error('Order creation error:', err);
      const errMsg = (err?.message || '').toLowerCase();
      if (
        errMsg.includes('400') ||
        errMsg.includes('negotiation') ||
        errMsg.includes('thương lượng') ||
        errMsg.includes('bad request') ||
        errMsg.includes('invalid')
      ) {
        setOrderError(
          lang === 'vi'
            ? 'Mức giá thương lượng không hợp lệ, đã bị thay đổi hoặc đã hết hiệu lực (Lỗi 400). Vui lòng kiểm tra lại phòng chat hoặc đàm phán lại mức giá mới.'
            : 'Invalid or expired negotiation deal price (400 Bad Request). Please review in chat before placing order.'
        );
      } else {
        setOrderError(err?.message || 'Không thể tạo đơn hàng trên hệ thống. Vui lòng kiểm tra lại kết nối backend hoặc số dư ví.');
      }
    } finally {
      setSubmittingOrder(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Header */}
        <div className="p-5 border-b border-[#24263e]/15 flex items-center justify-between bg-gradient-to-r from-[#fce5da] to-[#faf8f5] text-[#24263e] shrink-0 rounded-t-3xl">
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
        <form onSubmit={handleConfirmOrder} className="p-5 sm:p-6 space-y-6 text-xs text-[#24263e] flex-1 overflow-y-auto subtle-scrollbar">
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

          {/* LỰA CHỌN PHƯƠNG THỨC GIAO NHẬN (KIỂM ĐỊNH HOẶC GIAO THẲNG) */}
          <div className="space-y-3 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-[#24263e] uppercase tracking-wide">
                  {lang === 'vi' ? 'Phương Thức Giao Nhận & Bảo Vệ' : 'Delivery & Protection Option'}
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Kiểm định hàng qua Hub */}
              <div
                onClick={() => setDeliveryOption('INSPECTION')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  deliveryOption === 'INSPECTION'
                    ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      deliveryOption === 'INSPECTION' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
                    }`}>
                      {deliveryOption === 'INSPECTION' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                        {lang === 'vi' ? 'Kiểm Định Hàng Qua Hub' : 'Hub Lab Inspection'}
                      </h5>
                      <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                        Verify Then Ship
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                    {lang === 'vi'
                      ? 'Kỹ sư Hub Lab kiểm định kỹ thuật 20+ chỉ tiêu, dán tem niêm phong NFC chống tráo trước khi giao đến bạn.'
                      : 'Engineers inspect technical condition, apply tamper NFC seal before final delivery.'}
                  </p>
                </div>
              </div>

              {/* Option 2: Giao thẳng */}
              <div
                onClick={() => setDeliveryOption('DIRECT')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  deliveryOption === 'DIRECT'
                    ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      deliveryOption === 'DIRECT' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
                    }`}>
                      {deliveryOption === 'DIRECT' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                        {lang === 'vi' ? 'Giao Thẳng Trực Tiếp' : 'Direct Door-to-Door'}
                      </h5>
                      <span className="text-[11px] text-blue-700 font-bold block mt-0.5">
                        Người bán → Người mua
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                    {lang === 'vi'
                      ? 'Bưu tá GHN lấy hàng từ người bán và phát thẳng tới địa chỉ của bạn. Đồng kiểm ngoại quan lúc nhận máy.'
                      : 'GHN courier picks up from seller and delivers straight to you with co-inspection upon receipt.'}
                  </p>
                </div>
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

            {/* Address fields with GHN Catalogue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Tỉnh / Thành phố nhận hàng (GHN) *' : 'GHN Province / City *'}
                </label>
                <select
                  value={selectedProvinceId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setSelectedProvinceId(id);
                    const found = provinces.find((p) => p._id === id);
                    setSelectedProvinceName(found ? found.name : '');
                    if (formErrors.city) setFormErrors({ ...formErrors, city: '' });
                  }}
                  disabled={loadingProvinces}
                  className={`w-full px-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition cursor-pointer ${
                    formErrors.city ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                  }`}
                >
                  <option value="" disabled hidden>
                    {loadingProvinces ? 'Đang tải danh mục GHN...' : 'Chọn Tỉnh / Thành phố'}
                  </option>
                  {provinces.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {formErrors.city && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.city}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Phường / Xã nhận hàng (GHN) *' : 'GHN Ward *'}
                </label>
                <select
                  value={selectedWardName}
                  onChange={(e) => {
                    const newWard = e.target.value;
                    setSelectedWardName(newWard);
                    if (formErrors.ward) setFormErrors({ ...formErrors, ward: '' });
                    if (selectedProvinceName && newWard) {
                      calculateGhnQuote(selectedProvinceName, newWard, streetAddress, buyerName, buyerPhone);
                    }
                  }}
                  disabled={!selectedProvinceId || loadingWards}
                  className={`w-full px-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition cursor-pointer ${
                    formErrors.ward ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                  }`}
                >
                  <option value="" disabled hidden>
                    {!selectedProvinceId
                      ? 'Vui lòng chọn Tỉnh/Thành trước'
                      : loadingWards
                        ? 'Đang tải danh sách Phường/Xã...'
                        : 'Chọn Phường / Xã'}
                  </option>
                  {wards.map((w) => (
                    <option key={w._id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {formErrors.ward && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.ward}</span>
                )}
              </div>
            </div>

            {/* Street Address */}
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
                  onBlur={(e) => {
                    if (selectedProvinceName && selectedWardName) {
                      calculateGhnQuote(selectedProvinceName, selectedWardName, e.target.value, buyerName, buyerPhone);
                    }
                  }}
                  placeholder="Số 92 Phan Châu Trinh, Căn 402"
                  className={`w-full pl-9 pr-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition ${
                    formErrors.streetAddress ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                  }`}
                />
              </div>
              {formErrors.streetAddress && (
                <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.streetAddress}</span>
              )}
            </div>

            {/* Direct GHN Calculation Action Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-600">
                {selectedProvinceName && selectedWardName ? (
                  <span>
                    📍 Giao đến: <strong className="text-slate-900">{selectedWardName}, {selectedProvinceName}</strong>
                  </span>
                ) : (
                  <span className="italic text-slate-400">Chọn Tỉnh/Thành và Phường/Xã để tính cước phí GHN</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => calculateGhnQuote()}
                disabled={!selectedProvinceName || !selectedWardName || quoteLoading}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                {quoteLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tính...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Tính Phí GHN</span>
                  </>
                )}
              </button>
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
                {lang === 'vi' ? 'Ghi chú cho bưu tá giao nhận GHN' : 'Delivery Note for GHN Courier'}
              </label>
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Gọi trước 15 phút, nhà có thang máy..."
                className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-medium text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            {/* Live GHN Quote Status Indicator */}
            {quoteLoading && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-800">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <span>Đang kết nối API GHN tính toán cước phí vận chuyển và thời gian giao hàng...</span>
              </div>
            )}

            {quoteError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2.5 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{quoteError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => calculateGhnQuote(selectedProvinceName, selectedWardName, streetAddress, buyerName, buyerPhone)}
                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            )}

            {ghnQuote && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-emerald-950 animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-700" />
                    <span>Báo giá Giao Hàng Nhanh (GHN) hợp lệ</span>
                  </div>
                  <span className="font-mono text-[11px] bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900 font-semibold">
                    Chặng: {ghnQuote.leg || 'SELLER_TO_BUYER'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-emerald-700">Phí giao GHN: </span>
                    <strong className="text-emerald-950">{formatVND(ghnQuote.shippingFee)}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-700">Thời gian dự kiến: </span>
                    <strong className="text-emerald-950">
                      {ghnQuote.expectedDeliveryTime
                        ? new Date(ghnQuote.expectedDeliveryTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '2-3 ngày'}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selector & Wallet Balance */}
          <div className="space-y-2">
            <label className="font-extrabold text-[#24263e] uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>{lang === 'vi' ? 'Phương thức thanh toán bằng ví điện tử:' : 'Payment Method:'}</span>
              <span className="text-emerald-700 font-bold lowercase">
                {lang === 'vi' ? 'Trừ trực tiếp số dư ví' : 'Direct wallet debit'}
              </span>
            </label>

            {/* Wallet Balance Card */}
            <div className={`p-4 rounded-2xl border transition-all ${
              (wallet?.balance ?? 0) >= totalAmount
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-300'
                : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-300'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    (wallet?.balance ?? 0) >= totalAmount ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      {lang === 'vi' ? 'Ví Tiền SecondLife (Ký Quỹ Escrow)' : 'SecondLife Wallet Escrow'}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      {lang === 'vi' ? 'Số dư hiện có: ' : 'Available Balance: '}
                      <strong className="font-mono text-slate-900 text-sm">{formatVND(wallet?.balance ?? 0)}</strong>
                    </span>
                  </div>
                </div>

                {onOpenDeposit && (wallet?.balance ?? 0) < totalAmount ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDeposit();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Nạp Tiền Ví' : 'Top Up Wallet'}</span>
                  </button>
                ) : (wallet?.balance ?? 0) >= totalAmount ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-800 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'vi' ? 'Đủ số dư' : 'Sufficient'}</span>
                  </span>
                ) : null}
              </div>

              {(wallet?.balance ?? 0) < totalAmount && (
                <div className="mt-2.5 pt-2 border-t border-amber-200/80 text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'vi'
                      ? `Số dư ví còn thiếu ${formatVND(totalAmount - (wallet?.balance ?? 0))}. Vui lòng nạp tiền vào ví trước khi xác nhận đặt hàng.`
                      : `Wallet is short by ${formatVND(totalAmount - (wallet?.balance ?? 0))}. Please top up before ordering.`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-2 bg-[#faf8f5] p-4 rounded-2xl border border-slate-200">
            <div className="font-extrabold text-[11px] text-[#24263e] uppercase tracking-wider border-b border-slate-200/60 pb-1.5 flex items-center justify-between">
              <span>{lang === 'vi' ? 'Chi tiết thanh toán đơn hàng & vận chuyển' : 'Payment Breakdown'}</span>
              {ghnQuote?.expiresAt && (
                <span className="text-[10px] text-slate-500 font-normal lowercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  báo giá hiệu lực đến: {new Date(ghnQuote.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>{t.itemAmount}:</span>
              <div className="text-right">
                {hasAgreedDiscount && (
                  <span className="line-through text-slate-400 mr-2">
                    {formatVND(listing.priceVnd)}
                  </span>
                )}
                <span className="font-bold text-[#24263e]">{formatVND(productPrice)}</span>
              </div>
            </div>

            {hasAgreedDiscount && (
              <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                <span>{lang === 'vi' ? 'Giảm giá thương lượng Chat:' : 'Negotiated Chat Discount:'}</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 text-[11px] items-center">
              <span>Hình thức giao nhận:</span>
              <span className="font-bold text-slate-800">
                {deliveryOption === 'INSPECTION' ? '🛡️ Kiểm định qua Hub' : '⚡ Giao thẳng trực tiếp'}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 text-[11px] items-center">
              <span>{lang === 'vi' ? 'Phí giao hàng Giao Hàng Nhanh (GHN):' : 'GHN Shipping Fee:'}</span>
              <div className="text-right">
                {quoteLoading ? (
                  <span className="text-blue-600 font-bold flex items-center gap-1 justify-end">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tính phí GHN...</span>
                  </span>
                ) : ghnQuote ? (
                  <span className="font-bold text-emerald-700">
                    +{formatVND(shippingFee)}
                  </span>
                ) : quoteError ? (
                  <span className="text-amber-800 font-medium">
                    +{formatVND(shippingFee)} (Tạm tính)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => calculateGhnQuote()}
                    disabled={!selectedProvinceName || !selectedWardName}
                    className="text-blue-600 hover:underline font-bold disabled:text-slate-400 disabled:no-underline cursor-pointer"
                  >
                    {selectedProvinceName && selectedWardName ? 'Bấm tính phí ship GHN' : 'Chờ chọn địa chỉ...'}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-[#24263e]">
              <span>{lang === 'vi' ? 'Tổng số tiền trừ ví:' : 'Total Payable from Wallet:'}</span>
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
                ? 'Tiền sẽ được trừ vào ví và phong tỏa an toàn tại quỹ Escrow. Sau khi GHN giao hàng và bạn xác nhận đã nhận hàng thành công, tiền hàng mới được giải ngân cho người bán.'
                : 'Payment is securely held in Escrow custody. Seller receives funds only after GHN delivers and you confirm receipt.'}
            </span>
          </div>

          {/* Order Error Alert */}
          {orderError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{orderError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submittingOrder || !ghnQuote}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingOrder ? (
              <>
                <Loader2 className="w-4 h-4 text-white animate-spin" />
                <span>{lang === 'vi' ? 'Đang kết nối Escrow & trừ tiền ví...' : 'Connecting Escrow & deducting wallet...'}</span>
              </>
            ) : !ghnQuote ? (
              <>
                <Truck className="w-4 h-4 text-white" />
                <span>{lang === 'vi' ? 'Vui lòng chọn địa chỉ để lấy báo giá GHN' : 'Please select address for GHN quote'}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-white" />
                <span>
                  {lang === 'vi'
                    ? `Xác Nhận Đặt Hàng & Thanh Toán Ví (${formatVND(totalAmount)})`
                    : `Confirm Order & Pay with Wallet (${formatVND(totalAmount)})`}
                </span>
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};
