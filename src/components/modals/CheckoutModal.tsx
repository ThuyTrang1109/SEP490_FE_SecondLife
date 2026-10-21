import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Listing, EscrowOrder, EscrowStatus, Language, UserWallet, ShippingQuoteResponseDto, ShippingLeg, InspectionCenter, UserProfile } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { mockInspectionCenters } from '../../data/mockData';
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
  Clock,
  Building2,
  Home,
  UserCheck,
  Coins,
  Percent,
  BadgeCheck,
  Check,
  Edit3,
  ListFilter,
  XCircle,
} from 'lucide-react';
import { orderService, walletService, shippingService, GhnLocation, inspectorService, InspectionQuoteResponse, InspectionTravelTierDto } from '../../services';
import { LalamoveAddressPicker, getCityCoordinates } from '../common/LalamoveAddressPicker';

export const formatLalamoveVehicle = (serviceType?: string): { name: string; icon: string; desc: string } => {
  if (!serviceType) {
    return {
      name: 'Phương tiện tối ưu tự chọn',
      icon: '🚚',
      desc: 'Hệ thống tự động chọn phương tiện có phí thấp nhất phù hợp kích thước kiện hàng',
    };
  }
  const code = serviceType.toUpperCase();
  if (code === 'MOTORCYCLE' || code === 'BIKE') {
    return {
      name: 'Xe máy',
      icon: '🏍️',
      desc: 'Giao nhanh hàng nhỏ gọn nội thành',
    };
  }
  if (code === 'VAN' || code === 'VAN500' || code.includes('VAN')) {
    return {
      name: 'Xe bán tải / Van',
      icon: '🚐',
      desc: 'Chở hàng cồng kềnh, tải trọng lớn che chắn mưa nắng',
    };
  }
  if (code === 'PICK_UP_TRUCK' || code.includes('PICK_UP') || code.includes('PICKUP')) {
    return {
      name: 'Xe bán tải (Pick-up)',
      icon: '🛻',
      desc: 'Chở hàng cồng kềnh, kiện hàng lớn hoặc vận chuyển đường dài',
    };
  }
  if (code === 'TRUCK500' || code === 'TRUCK_500KG') {
    return {
      name: 'Xe tải 500kg',
      icon: '🚚',
      desc: 'Chở hàng nặng, kích thước lớn an toàn',
    };
  }
  if (code === 'TRUCK1000' || code === 'TRUCK_1000KG' || code === 'TRUCK_1T') {
    return {
      name: 'Xe tải 1 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
    };
  }
  if (code === 'TRUCK1500' || code === 'TRUCK_1500KG') {
    return {
      name: 'Xe tải 1.5 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
    };
  }
  if (code === 'TRUCK2000' || code === 'TRUCK_2000KG' || code === 'TRUCK_2T') {
    return {
      name: 'Xe tải 2 tấn',
      icon: '🚛',
      desc: 'Xe tải hạng nặng',
    };
  }
  return {
    name: serviceType,
    icon: '🚚',
    desc: 'Phương tiện Lalamove do hệ thống tự động báo giá',
  };
};

export interface VehicleClassification {
  type: 'MOTORCYCLE' | 'VAN' | 'PICK_UP_TRUCK' | 'TRUCK';
  name: string;
  icon: string;
  standard: string;
  desc: string;
  isMotorcycleEligible: boolean;
}

/**
 * Phân loại phương tiện giao hàng theo kích thước và khối lượng của kiện hàng sản phẩm
 */
export const classifyVehicleByProduct = (
  weightG?: number,
  lengthCm?: number,
  widthCm?: number,
  heightCm?: number
): VehicleClassification => {
  const w = Number(weightG || 0);
  const l = Number(lengthCm || 0);
  const wi = Number(widthCm || 0);
  const h = Number(heightCm || 0);

  // 1. Xe máy (MOTORCYCLE):
  // Trọng lượng <= 30kg (30.000g), kích thước 3 chiều <= 50cm, 40cm, 50cm
  const fitsMotorcycleDimensions =
    ((l <= 50 && wi <= 40) || (l <= 40 && wi <= 50)) && h <= 50;
  const fitsMotorcycleWeight = w > 0 ? w <= 30000 : true;

  if (fitsMotorcycleWeight && (l === 0 || fitsMotorcycleDimensions)) {
    return {
      type: 'MOTORCYCLE',
      name: 'Xe máy',
      icon: '🏍️',
      standard: 'Cân nặng ≤ 30kg • Kích thước ≤ 50x40x50cm',
      desc: 'Phù hợp kiện hàng nhỏ gọn, giao nhanh nội thành tiết kiệm chi phí',
      isMotorcycleEligible: true,
    };
  }

  // 2. Xe bán tải / Van 500kg (VAN / PICK_UP_TRUCK):
  // Trọng lượng <= 500kg (500.000g), kích thước <= 160cm x 110cm x 110cm
  const fitsVanDimensions =
    ((l <= 160 && wi <= 110) || (l <= 110 && wi <= 160)) && h <= 110;
  const fitsVanWeight = w <= 500000;

  if (fitsVanWeight && fitsVanDimensions) {
    return {
      type: 'PICK_UP_TRUCK',
      name: 'Xe bán tải / Van 500kg',
      icon: '🛻',
      standard: 'Cân nặng ≤ 500kg • Kích thước ≤ 160x110x110cm',
      desc: 'Phù hợp kiện hàng cồng kềnh, tải trọng trung bình che chắn an toàn',
      isMotorcycleEligible: false,
    };
  }

  // 3. Xe tải 1 - 2 tấn (TRUCK):
  return {
    type: 'TRUCK',
    name: 'Xe tải 1 - 2 tấn',
    icon: '🚚',
    standard: 'Cân nặng > 500kg hoặc kiện hàng kích thước lớn',
    desc: 'Phù hợp hàng nặng, kích thước lớn cần xe tải chuyên dụng',
    isMotorcycleEligible: false,
  };
};

interface CheckoutModalProps {
  listing: Listing;
  onClose: () => void;
  onOrderPlaced: (order: EscrowOrder) => void;
  lang: Language;
  currentUser?: UserProfile | null;
  agreedPrice?: number;
  negotiationId?: string;
  onOpenDeposit?: () => void;
  onCancelUnpaid?: (msg?: string) => void;
  showToast?: (msg: string) => void;
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
  onCancelUnpaid,
  showToast,
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
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'BANK_TRANSFER'>('WALLET');
  const [currentRequestId, setCurrentRequestId] = useState<string>(() => crypto.randomUUID());
  const [bankPaymentInfo, setBankPaymentInfo] = useState<any | null>(null);
  const [createdOrder, setCreatedOrder] = useState<EscrowOrder | null>(null);
  const [checkingBankPayment, setCheckingBankPayment] = useState<boolean>(false);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState<number | null>(null);
  const [isPaymentExpired, setIsPaymentExpired] = useState<boolean>(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);
  const [bankCheckMessage, setBankCheckMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Shipping Address & Catalogue States
  const [provinces, setProvinces] = useState<GhnLocation[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | ''>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>('');

  const [wards, setWards] = useState<GhnLocation[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [selectedWardName, setSelectedWardName] = useState<string>('');
  const [provinceMode, setProvinceMode] = useState<'select' | 'manual'>('select');
  const [wardMode, setWardMode] = useState<'select' | 'manual'>('select');

  // Buyer Form Information
  const sellerCityInfo = getCityCoordinates(listing.sellerAddress || listing.location);
  const hasProfileAddress = Boolean(currentUser?.address?.trim() || currentUser?.streetAddress?.trim());
  const initialDeliveryLat = (hasProfileAddress && typeof currentUser?.latitude === 'number')
    ? currentUser.latitude
    : sellerCityInfo.lat;
  const initialDeliveryLng = (hasProfileAddress && typeof currentUser?.longitude === 'number')
    ? currentUser.longitude
    : sellerCityInfo.lng;

  const [buyerName, setBuyerName] = useState(currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [buyerEmail, setBuyerEmail] = useState(currentUser?.email || '');
  const [streetAddress, setStreetAddress] = useState(currentUser?.address || currentUser?.streetAddress || '');
  const [deliveryLatitude, setDeliveryLatitude] = useState<number>(initialDeliveryLat);
  const [deliveryLongitude, setDeliveryLongitude] = useState<number>(initialDeliveryLng);
  const [addressType, setAddressType] = useState<'home' | 'office'>('home');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const quoteDebounceTimerRef = useRef<any>(null);

  // Delivery & Protection Option: 'INSPECTION' (Verify Then Ship) or 'DIRECT' (Direct Door-to-Door)
  const [deliveryOption, setDeliveryOption] = useState<'INSPECTION' | 'DIRECT'>(
    listing.priceVnd > 5000000 || listing.requiresInspection ? 'INSPECTION' : 'DIRECT'
  );

  // Confirmation of disassembly and voiding of original "zin" condition
  const [agreedZinLoss, setAgreedZinLoss] = useState(false);

  // Inspection Center, Method & Fee Splitting States
  const [selectedCenterId, setSelectedCenterId] = useState<string>(mockInspectionCenters[0]?.id || 'center-hcm-01');
  const [inspectionMethod, setInspectionMethod] = useState<'AT_CENTER' | 'AT_HOME'>('AT_CENTER');
  const [feeSplit, setFeeSplit] = useState<'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100'>('BUYER_100');

  // Auto suggest/select inspection center based on buyer province
  useEffect(() => {
    if (!selectedProvinceName) return;
    const provLower = selectedProvinceName.toLowerCase();
    if (provLower.includes('hà nội') || provLower.includes('ha noi')) {
      const hn = mockInspectionCenters.find((c) => c.id.includes('hn'));
      if (hn) setSelectedCenterId(hn.id);
    } else if (
      provLower.includes('đà nẵng') ||
      provLower.includes('da nang') ||
      provLower.includes('huế') ||
      provLower.includes('quảng')
    ) {
      const dn = mockInspectionCenters.find((c) => c.id.includes('dn'));
      if (dn) setSelectedCenterId(dn.id);
    } else if (
      provLower.includes('hồ chí minh') ||
      provLower.includes('ho chi minh') ||
      provLower.includes('sài gòn') ||
      provLower.includes('bình dương') ||
      provLower.includes('đồng nai')
    ) {
      const hcm = mockInspectionCenters.find((c) => c.id.includes('hcm'));
      if (hcm) setSelectedCenterId(hcm.id);
    }
  }, [selectedProvinceName]);

  // Lalamove Shipping Quote State
  const [ghnQuote, setGhnQuote] = useState<ShippingQuoteResponseDto | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Live Inspection Quote State (POST /api/v1/inspection/quote)
  const [inspectionQuote, setInspectionQuote] = useState<InspectionQuoteResponse | null>(null);
  const [loadingInspectionQuote, setLoadingInspectionQuote] = useState(false);
  const [showTierBreakdown, setShowTierBreakdown] = useState(false);

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

  // Load Shipping Provinces on mount
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
        console.warn('Error loading shipping provinces:', err);
      } finally {
        if (isMounted) setLoadingProvinces(false);
      }
    };
    loadProvinces();
    return () => { isMounted = false; };
  }, []);

  // Handler khi người dùng tự nhập Tỉnh/Thành phố
  const handleManualProvinceChange = (text: string) => {
    setSelectedProvinceName(text);
    if (formErrors.city) setFormErrors((prev) => ({ ...prev, city: '' }));

    const trimmed = text.trim().toLowerCase();
    if (!trimmed) {
      setSelectedProvinceId('');
      return;
    }

    const clean = (s: string) =>
      s.toLowerCase().replace(/^(tỉnh|thành phố|tp\.|tp)\s+/i, '').trim();
    const cleanInput = clean(trimmed);

    const match = provinces.find((p) => {
      const pLower = p.name.toLowerCase();
      const pClean = clean(pLower);
      return (
        pLower === trimmed ||
        pClean === cleanInput ||
        pLower.includes(trimmed) ||
        trimmed.includes(pLower) ||
        pClean.includes(cleanInput)
      );
    });

    if (match) {
      setSelectedProvinceId(match._id);
    } else {
      setSelectedProvinceId('');
    }
  };

  // Load Wards when selectedProvinceId changes
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
        console.warn('Error loading shipping wards:', err);
      } finally {
        if (isMounted) setLoadingWards(false);
      }
    };
    loadWards();
    return () => { isMounted = false; };
  }, [selectedProvinceId]);

  // Request Lalamove Shipping Quote via BE POST /api/v1/shipping/quotes
  const calculateLalamoveQuote = useCallback(async (
    lat?: number,
    lng?: number,
    addr?: string,
    name?: string,
    phone?: string
  ) => {
    const currentLat = lat ?? deliveryLatitude;
    const currentLng = lng ?? deliveryLongitude;
    if (!currentLat || !currentLng) {
      return;
    }

    const rawPhone = (phone || buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
    const validPhone = rawPhone.length >= 9 && rawPhone.length <= 15 ? rawPhone : '0912345678';
    const validName = (name || buyerName || currentUser?.name || 'Khách Hàng').trim() || 'Khách Hàng';

    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const quote = await shippingService.getShippingQuote({
        postId: listing.id,
        ...(negotiationId ? { negotiationId } : {}),
        deliveryAddress: {
          name: validName,
          phone: validPhone,
          latitude: currentLat,
          longitude: currentLng,
        },
      });
      setGhnQuote(quote);
      setQuoteError(null);
    } catch (err: any) {
      console.warn('Failed to calculate Lalamove quote:', err);
      setGhnQuote(null);
      let errMsg = err?.response?.data?.message || err?.message || 'Không thể tính phí vận chuyển Lalamove.';
      if (typeof errMsg === 'string') {
        if (errMsg.includes('ERR_RATE_LIMIT_EXCEEDED') || errMsg.includes('429')) {
          errMsg = 'Hệ thống Lalamove đang bận xử lý nhiều báo giá. Vui lòng chờ 2-3 giây rồi thử lại.';
        } else if (errMsg.includes('Seller pickup address is not configured')) {
          errMsg = 'Người bán chưa cấu hình địa chỉ kho lấy hàng Lalamove. Không thể tạo đơn hàng.';
        } else if (errMsg.includes('Seller must save the packed weight and dimensions') || errMsg.includes('Shipping weight is required')) {
          errMsg = 'Người bán chưa cấu hình kích thước và trọng lượng kiện hàng. Không thể tính phí vận chuyển Lalamove. Vui lòng liên hệ người bán cập nhật bài đăng.';
        } else if (errMsg.includes('You cannot buy your own post')) {
          errMsg = 'Bạn đang đăng nhập bằng tài khoản người bán. Không thể tạo báo giá mua bài đăng của chính mình.';
        } else if (errMsg.includes('Post is not available')) {
          errMsg = 'Bài đăng hiện không ở trạng thái sẵn sàng để giao dịch.';
        } else if (
          errMsg.includes('ERR_OUT_OF_SERVICE_AREA') ||
          errMsg.includes('OUT_OF_SERVICE_AREA') ||
          errMsg.includes('ngoài khu vực phục vụ')
        ) {
          errMsg = `Vị trí giao hàng nằm ngoài phạm vi phục vụ Lalamove so với kho người bán (${sellerCityInfo.name}). Do Lalamove là dịch vụ giao hàng nhanh nội thành, vui lòng chọn địa chỉ nhận hàng tại cùng khu vực ${sellerCityInfo.name}.`;
        } else if (errMsg.includes('Chưa cấu hình Geoapify') || errMsg.includes('Geoapify')) {
          errMsg = 'Dịch vụ bản đồ Backend chưa bật Geoapify key. Đã chuyển sang chế độ định vị dự phòng OpenStreetMap.';
        }
      }
      setQuoteError(errMsg);
    } finally {
      setQuoteLoading(false);
    }
  }, [deliveryLatitude, deliveryLongitude, buyerPhone, buyerName, streetAddress, currentUser, listing.id, negotiationId]);

  const calculateGhnQuote = calculateLalamoveQuote;

  // Auto-quote calculation with 700ms debounce when coordinates change
  useEffect(() => {
    if (!deliveryLatitude || !deliveryLongitude) return;

    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    quoteDebounceTimerRef.current = setTimeout(() => {
      calculateLalamoveQuote(deliveryLatitude, deliveryLongitude);
    }, 700);

    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [calculateLalamoveQuote, deliveryLatitude, deliveryLongitude]);

  // Fetch Live Inspection Quote from Backend API
  const fetchInspectionQuote = useCallback(async (lat?: number, lng?: number) => {
    if (!listing.id) return;
    setLoadingInspectionQuote(true);
    try {
      const q = await inspectorService.getQuote({
        postId: listing.id,
        buyerLatitude: lat || deliveryLatitude,
        buyerLongitude: lng || deliveryLongitude,
      });
      if (q) setInspectionQuote(q);
    } catch (err) {
      console.warn('Could not fetch inspection quote:', err);
    } finally {
      setLoadingInspectionQuote(false);
    }
  }, [listing.id, deliveryLatitude, deliveryLongitude]);

  useEffect(() => {
    if (deliveryOption === 'INSPECTION') {
      fetchInspectionQuote(deliveryLatitude, deliveryLongitude);
    }
  }, [deliveryOption, deliveryLatitude, deliveryLongitude, fetchInspectionQuote]);

  // Inspection fee & split calculations
  const isInspected = deliveryOption === 'INSPECTION';
  const selectedCenter = mockInspectionCenters.find((c) => c.id === selectedCenterId) || mockInspectionCenters[0];

  const atHomeFee = inspectionQuote?.atHomePackage?.totalFee 
    ?? inspectionQuote?.atHomeTotalFee 
    ?? 175000;
  const atCenterFee = inspectionQuote?.atCenterPackage?.totalFee 
    ?? inspectionQuote?.atCenterTotalFee 
    ?? 200000;

  const baseInspectionFee = isInspected ? (inspectionMethod === 'AT_HOME' ? atHomeFee : atCenterFee) : 0;
  const buyerInspectionFee = isInspected
    ? feeSplit === 'BUYER_100'
      ? baseInspectionFee
      : feeSplit === 'SPLIT_50_50'
        ? Math.round(baseInspectionFee / 2)
        : 0
    : 0;
  const sellerInspectionFee = isInspected ? baseInspectionFee - buyerInspectionFee : 0;

  // Financial values
  const shippingFee = ghnQuote ? Number(ghnQuote.shippingFee) : 30000;
  const productPrice = ghnQuote ? Number(ghnQuote.productPrice) : itemPrice;
  const totalAmount = productPrice + shippingFee + buyerInspectionFee;
  // Khi mua có kiểm định: CHỈ trả trước phí kiểm định và tiền ship; Tiền sản phẩm trả ở Giai đoạn 2 sau khi kiểm định ĐẠT
  const upfrontAmount = isInspected ? (shippingFee + buyerInspectionFee) : totalAmount;
  const stage2ProductAmount = isInspected ? productPrice : 0;

  const fullAddress = [streetAddress, selectedWardName, selectedProvinceName].filter(Boolean).join(', ') || streetAddress;

  const validatePhoneNumber = (phone: string, currentLang: Language = 'vi'): string => {
    const trimmed = (phone || '').trim();
    if (!trimmed) {
      return currentLang === 'vi' ? 'Vui lòng nhập số điện thoại nhận hàng' : 'Phone number is required';
    }
    const cleanPhone = trimmed.replace(/\D/g, '');
    if (/[^\d\s.-]/.test(trimmed)) {
      return currentLang === 'vi'
        ? 'Số điện thoại chỉ được chứa các chữ số'
        : 'Phone number can only contain digits';
    }
    if (!cleanPhone.startsWith('0')) {
      return currentLang === 'vi'
        ? 'Số điện thoại phải bắt đầu bằng số 0 (ví dụ: 0987...)'
        : 'Phone number must start with 0';
    }
    if (cleanPhone.length < 10) {
      return currentLang === 'vi'
        ? `Số điện thoại phải có đúng 10 chữ số (bạn đang nhập thiếu: ${cleanPhone.length}/10 số)`
        : `Phone number must be exactly 10 digits (currently ${cleanPhone.length}/10)`;
    }
    if (cleanPhone.length > 10) {
      return currentLang === 'vi'
        ? `Số điện thoại chỉ được đúng 10 chữ số (bạn đang nhập dư: ${cleanPhone.length}/10 số)`
        : `Phone number must be exactly 10 digits (exceeded: ${cleanPhone.length}/10)`;
    }
    return '';
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!buyerName.trim()) {
      errors.buyerName = lang === 'vi' ? 'Vui lòng nhập họ tên người nhận' : 'Name is required';
    }
    const phoneErr = validatePhoneNumber(buyerPhone, lang);
    if (phoneErr) {
      errors.buyerPhone = phoneErr;
    }
    if (!streetAddress.trim() || !deliveryLatitude || !deliveryLongitude) {
      errors.streetAddress = lang === 'vi' ? 'Vui lòng chọn hoặc xác nhận địa chỉ giao nhận trên bản đồ Lalamove' : 'Please confirm delivery address on Lalamove map';
    }
    if (deliveryOption === 'INSPECTION' && !agreedZinLoss) {
      errors.agreedZinLoss = lang === 'vi'
        ? 'Vui lòng xác nhận bạn đã hiểu và đồng ý việc tháo sản phẩm kiểm định sẽ làm mất trạng thái zin của sản phẩm.'
        : 'Please confirm agreement that disassembly inspection will void the product original "zin" status.';
    }
    setFormErrors(errors);
    const firstErr = Object.values(errors)[0];
    if (firstErr) {
      setOrderError(firstErr);
      return false;
    }
    setOrderError(null);
    return true;
  };

  // Automatically clear general order error banner as soon as user types or fixes any field
  useEffect(() => {
    if (orderError) {
      setOrderError(null);
    }
  }, [buyerPhone, buyerName, buyerEmail, streetAddress, deliveryLatitude, deliveryLongitude, agreedZinLoss, deliveryOption]);

  const handleFillFromProfile = () => {
    setOrderError(null);
    if (currentUser) {
      if (currentUser.name) setBuyerName(currentUser.name);
      if (currentUser.phone) {
        setBuyerPhone(currentUser.phone);
        const err = validatePhoneNumber(currentUser.phone, lang);
        if (err) {
          setFormErrors(prev => ({ ...prev, buyerPhone: err }));
        } else {
          setFormErrors(prev => {
            const updated = { ...prev };
            delete updated.buyerPhone;
            return updated;
          });
        }
      }
      if (currentUser.email) setBuyerEmail(currentUser.email);
      const profileAddr = currentUser.address || currentUser.streetAddress || '';
      if (profileAddr) setStreetAddress(profileAddr);
      if (typeof currentUser.latitude === 'number' && typeof currentUser.longitude === 'number') {
        setDeliveryLatitude(currentUser.latitude);
        setDeliveryLongitude(currentUser.longitude);
      }
      const userProv = (currentUser as any).provinceName || (currentUser as any).province || '';
      const userWard = (currentUser as any).wardName || (currentUser as any).ward || '';
      if (userProv) {
        handleManualProvinceChange(userProv);
      }
      if (userWard) {
        setSelectedWardName(userWard);
      }
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    let activeQuote = ghnQuote;
    if (!activeQuote || !activeQuote.quoteId) {
      if (deliveryLatitude && deliveryLongitude) {
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
              latitude: deliveryLatitude,
              longitude: deliveryLongitude,
            },
          });
          setGhnQuote(activeQuote);
        } catch (err: any) {
          setOrderError(err?.message || 'Không thể lấy báo giá Lalamove. Vui lòng kiểm tra lại địa chỉ hoặc thử lại.');
          setSubmittingOrder(false);
          return;
        }
      } else {
        setOrderError(
          lang === 'vi'
            ? 'Đang chờ báo giá vận chuyển từ Lalamove. Vui lòng kiểm tra lại địa chỉ hoặc bấm thử lại.'
            : 'Awaiting Lalamove shipping quote. Please check your address or retry.'
        );
        return;
      }
    }

    // Kiểm tra số dư ví nếu thanh toán bằng WALLET
    if (paymentMethod === 'WALLET') {
      let currentBal = wallet?.balance ?? 0;
      try {
        const freshW = await walletService.getMyWallet();
        if (freshW && typeof freshW.balance === 'number') {
          setWallet(freshW);
          currentBal = freshW.balance;
        }
      } catch {}

      if (currentBal < upfrontAmount) {
        setOrderError(
          lang === 'vi'
            ? `Số dư ví của bạn (${formatVND(currentBal)}) không đủ để thanh toán ${isInspected ? 'tiền cọc kiểm định & tiền ship' : 'đơn hàng'} (${formatVND(upfrontAmount)}). Vui lòng nạp thêm tiền vào ví hoặc chọn hình thức 'Chuyển Khoản Trực Tiếp'.`
            : `Your wallet balance (${formatVND(currentBal)}) is insufficient for ${isInspected ? 'inspection deposit & shipping' : 'order checkout'} (${formatVND(upfrontAmount)}). Please top up or choose Direct Bank Transfer.`
        );
        return;
      }
    }

    setOrderError(null);
    setSubmittingOrder(true);

    try {
      let orderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      let finalChargedPrice = productPrice;
      let finalShippingFee = shippingFee;
      let finalTotalPaid = upfrontAmount;

      if (isInspected) {
        // Gửi yêu cầu mua có kiểm định tới Backend qua POST /api/v1/inspection/requests
        const feePayerCode = feeSplit === 'BUYER_100' ? 'BUYER_PAYS' : feeSplit === 'SELLER_100' ? 'SELLER_PAYS' : 'SPLIT_50_50';
        try {
          let validPhone = (buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
          if (!validPhone.startsWith('0') && !validPhone.startsWith('84')) validPhone = '0' + validPhone;
          if (validPhone.length < 10 || validPhone.length > 11) validPhone = '0912345678';
          const buyerLat = Number(deliveryLatitude) || 10.762622;
          const buyerLng = Number(deliveryLongitude) || 106.660172;

          const beInspectionOrder = await inspectorService.createRequest({
            postId: listing.id,
            orderType: inspectionMethod,
            feePayer: feePayerCode,
            buyerConsentZinLoss: true,
            buyerLatitude: buyerLat,
            buyerLongitude: buyerLng,
            buyerDeliveryAddress: {
              name: (buyerName || currentUser?.name || 'Khách Hàng').trim().slice(0, 100),
              phone: validPhone,
              latitude: buyerLat,
              longitude: buyerLng,
            },
            note: deliveryNote || undefined,
          });
          if (beInspectionOrder?.id) {
            orderId = String(beInspectionOrder.id);
          }
        } catch (beErr: any) {
          console.warn('Backend inspection request fallback:', beErr);
        }
      } else {
        // Gọi Backend Order trực tiếp qua POST /api/v1/orders
        const quoteIdToUse = activeQuote?.quoteId || ghnQuote?.quoteId;
        if (!quoteIdToUse) {
          throw new Error(lang === 'vi' ? 'Không tìm thấy mã báo giá vận chuyển hợp lệ. Vui lòng thử lại.' : 'Shipping quote ID is missing.');
        }
        const backendOrder = await orderService.createOrder({
          postId: listing.id,
          shippingQuoteId: quoteIdToUse,
          requestId: currentRequestId,
          paymentMethod,
          ...(negotiationId ? { negotiationId } : {}),
        });
        if (backendOrder?.id) orderId = backendOrder.id;
        finalChargedPrice = backendOrder?.finalPrice || productPrice;
        finalShippingFee = backendOrder?.shippingFee || shippingFee;
        finalTotalPaid = backendOrder?.totalPaid ? Number(backendOrder.totalPaid) : totalAmount;
      }

      const shippingLegsData: ShippingLeg[] = isInspected
        ? [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_CENTER',
              carrier: inspectionMethod === 'AT_HOME' ? 'SecondLife On-site Team' : 'Lalamove',
              trackingNumber: `LLM-HUB-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'PICKED_UP',
              origin: listing.sellerAddress || listing.location || 'Địa chỉ kho người bán',
              destination: inspectionMethod === 'AT_HOME'
                ? `Kiểm định tại nhà người bán (Kỹ sư ${selectedCenter?.name})`
                : (selectedCenter?.name || 'Trạm Kiểm Định SecondLife Hub Lab'),
              estimatedDelivery: 'Trong ngày',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: inspectionMethod === 'AT_HOME'
                    ? `Cử chuyên viên kỹ thuật từ ${selectedCenter?.name} đến tận nhà người bán kiểm định trực tiếp on-site.`
                    : `Khởi tạo đơn hàng kiểm định Hub (${selectedCenter?.name}). Tài xế Lalamove chuẩn bị lấy hàng chuyển về Hub.`,
                  location: selectedCenter?.name || 'Hệ thống SecondLife Escrow'
                }
              ]
            },
            {
              id: 'LEG-2',
              legType: 'CENTER_TO_BUYER',
              carrier: 'Lalamove',
              trackingNumber: `LLM-BUYER-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'IN_TRANSIT',
              origin: selectedCenter?.name || 'Trạm Kiểm Định SecondLife Hub Lab',
              destination: fullAddress,
              estimatedDelivery: 'Giao nhanh trong ngày sau khi đạt chuẩn kiểm định',
              timeline: [
                {
                  timestamp: '--:--',
                  description: 'Chờ hoàn tất quy trình kiểm định và dán tem niêm phong NFC tại Hub Lab.',
                  location: selectedCenter?.name || 'Trung tâm kiểm định SecondLife'
                }
              ]
            }
          ]
        : [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_BUYER',
              carrier: 'Lalamove',
              trackingNumber: `LLM-DIRECT-${orderId.slice(0, 8).toUpperCase()}`,
              status: 'PICKED_UP',
              origin: listing.sellerAddress || listing.location || 'Địa chỉ kho người bán',
              destination: fullAddress,
              estimatedDelivery: ghnQuote?.expectedDeliveryTime || 'Giao ngay trong ngày',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: !isInspected && paymentMethod === 'BANK_TRANSFER'
                    ? 'Đơn hàng đã được khởi tạo. Đang chờ người mua quét mã VietQR để nạp tiền ký quỹ Escrow bảo vệ đơn hàng.'
                    : 'Đã thanh toán ví thành công qua Escrow. Tiền đã được đóng băng an toàn tại Quỹ Escrow, sẵn sàng cho đơn vị vận chuyển lấy hàng.',
                  location: 'Hệ thống SecondLife Escrow'
                }
              ]
            }
          ];

      const isBankWaiting = !isInspected && paymentMethod === 'BANK_TRANSFER';
      const initialEscrowStatus: EscrowStatus = isInspected
        ? 'INSPECTION_IN_PROGRESS'
        : isBankWaiting
        ? 'AWAITING_PAYMENT'
        : 'HELD_IN_ESCROW';

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
        inspectionFeeVnd: isInspected ? buyerInspectionFee : 0,
        shippingFeeVnd: finalShippingFee,
        platformFeeVnd: 0,
        totalPaidVnd: finalTotalPaid,
        escrowStatus: initialEscrowStatus,
        paymentMethod: paymentMethod,
        backendStatus: isBankWaiting ? 'PENDING_PAYMENT' : 'PROCESSING',
        hasInspectionService: isInspected,
        inspectionCenterId: isInspected ? selectedCenter?.id : undefined,
        inspectionCenterName: isInspected ? selectedCenter?.name : undefined,
        inspectionMethod: isInspected ? inspectionMethod : undefined,
        inspectionFeeSplit: isInspected ? feeSplit : undefined,
        buyerInspectionFeeVnd: isInspected ? buyerInspectionFee : 0,
        sellerInspectionFeeVnd: isInspected ? sellerInspectionFee : 0,
        shippingLegs: shippingLegsData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        multiStagePhotos: {
          listingPhotos: [listing.photos.front, listing.photos.back]
        }
      };

      try {
        localStorage.setItem(`order_listing_${orderId}`, JSON.stringify(listing));
        if (listing?.id) {
          localStorage.setItem(`cached_post_${listing.id}`, JSON.stringify(listing));
        }
        localStorage.setItem(`order_buyer_info_${orderId}`, JSON.stringify({
          buyerName: (buyerName || currentUser?.name || 'Khách Hàng').trim(),
          buyerPhone: buyerPhone.trim(),
          buyerAddress: fullAddress,
        }));
        if (currentUser?.id) {
          localStorage.setItem(`buyer_info_${currentUser.id}`, JSON.stringify({
            name: (buyerName || currentUser?.name || 'Khách Hàng').trim(),
            phone: buyerPhone.trim(),
          }));
        }

        // Only save to recent_placed_orders and dispatch seller notification for instant payment (wallet or inspection)
        if (!isBankWaiting) {
          let existingRecent: EscrowOrder[] = [];
          try {
            const stored = localStorage.getItem('recent_placed_orders');
            if (stored && stored !== 'undefined' && stored !== 'null') existingRecent = JSON.parse(stored);
          } catch {}
          const updatedRecent = [newOrder, ...existingRecent.filter((o) => o.id !== newOrder.id)].slice(0, 30);
          localStorage.setItem('recent_placed_orders', JSON.stringify(updatedRecent));

          // Dispatch notification specifically for seller (and buyer)
          const sellerNotifItem = {
            id: `notif-seller-inspection-${orderId}`,
            title: isInspected ? 'Yêu cầu kiểm định Hub mới' : 'Đơn đặt hàng mới',
            message: isInspected
              ? `Khách mua ${buyerName || 'Khách Hàng'} vừa gửi yêu cầu kiểm định cho sản phẩm "${listing.title}". Người bán vui lòng kiểm tra và hẹn lịch KTV!`
              : `Khách mua ${buyerName || 'Khách Hàng'} vừa đặt mua sản phẩm "${listing.title}". Vui lòng xác nhận đơn hàng!`,
            type: isInspected ? 'INSPECTION' : 'ORDER',
            referenceId: orderId,
            referenceType: isInspected ? 'INSPECTION_ORDER' : 'ORDER',
            actionUrl: '/orders?tab=inspecting',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
          };
          try {
            const rawNotifs = localStorage.getItem('secondlife_local_notifications');
            const existingNotifs = rawNotifs && rawNotifs !== 'undefined' && rawNotifs !== 'null' ? JSON.parse(rawNotifs) : [];
            localStorage.setItem('secondlife_local_notifications', JSON.stringify([sellerNotifItem, ...existingNotifs.filter((n: any) => n.id !== sellerNotifItem.id)].slice(0, 50)));
            window.dispatchEvent(new CustomEvent('secondlife_notification', { detail: sellerNotifItem }));
          } catch {}
        }
      } catch {}

      if (!isInspected && paymentMethod === 'BANK_TRANSFER') {
        try {
          const payRes = await orderService.getOrderPayment(orderId);
          setBankPaymentInfo(payRes);
          const bankWaitingOrder: EscrowOrder = {
            ...newOrder,
            escrowStatus: 'AWAITING_PAYMENT',
            backendStatus: 'PENDING_PAYMENT',
            paymentMethod: 'BANK_TRANSFER',
            paymentExpiresAt: payRes?.expiresAt || null,
            bankPaymentDetails: payRes,
          };
          setCreatedOrder(bankWaitingOrder);
          // KHÔNG lưu bankWaitingOrder vào recent_placed_orders khi CHƯA thanh toán
          setSubmittingOrder(false);
          return;
        } catch (pErr) {
          console.warn('Could not fetch bank transfer payment instructions:', pErr);
        }
      }

      onOrderPlaced(newOrder);
    } catch (err: any) {
      console.error('Order creation error:', err);
      const status = err?.response?.status || err?.status;
      const beMsg = err?.response?.data?.message || err?.message || '';
      const errMsg = beMsg.toLowerCase();

      // Mục 8.3: Bắt lỗi 409 khi quote hết hạn hoặc dữ liệu kiện hàng/giá bị thay đổi
      if (status === 409 || errMsg.includes('quote') || errMsg.includes('expired') || errMsg.includes('hết hạn')) {
        setGhnQuote(null);
        setOrderError(
          lang === 'vi'
            ? 'Báo giá vận chuyển đã hết hạn hoặc thông tin đơn hàng đã thay đổi. Hệ thống đang tự động cập nhật báo giá mới nhất, vui lòng xác nhận lại tổng tiền trước khi đặt hàng.'
            : 'Shipping quote expired or order details changed. Refreshing quote, please reconfirm total before ordering.'
        );
        calculateLalamoveQuote(deliveryLatitude, deliveryLongitude);
        setCurrentRequestId(crypto.randomUUID());
        return;
      }

      if (errMsg.includes('you cannot buy your own post') || errMsg.includes('tự mua')) {
        setOrderError(lang === 'vi' ? 'Bạn đang đăng nhập bằng tài khoản người bán của bài đăng này. Không thể tự mua hàng của chính mình.' : 'You cannot buy your own post.');
      } else if (errMsg.includes('expired') || errMsg.includes('hết hạn')) {
        setOrderError(lang === 'vi' ? 'Phiên thương lượng đã hết hạn. Vui lòng kiểm tra lại phòng chat hoặc thương lượng lại mức giá mới.' : 'Negotiation session has expired.');
      } else if (errMsg.includes('insufficient') || errMsg.includes('không đủ số dư') || errMsg.includes('balance')) {
        setOrderError(lang === 'vi' ? 'Số dư ví Escrow không đủ để thanh toán. Vui lòng nạp thêm tiền vào ví hoặc chọn phương thức Chuyển khoản ngân hàng.' : 'Insufficient wallet balance. Please top up or choose bank transfer.');
      } else if (errMsg.includes('not available for purchase') || errMsg.includes('post is not available')) {
        setOrderError(lang === 'vi' ? 'Sản phẩm này hiện không còn khả dụng để đặt mua (đã có người mua hoặc bài đăng đã kết thúc).' : 'Post is not available for purchase.');
      } else if (
        errMsg.includes('negotiation') ||
        errMsg.includes('thương lượng')
      ) {
        setOrderError(
          lang === 'vi'
            ? 'Mức giá thương lượng không hợp lệ hoặc đã hết hiệu lực. Vui lòng kiểm tra lại phòng chat.'
            : 'Invalid or expired negotiation deal price. Please review in chat before placing order.'
        );
      } else {
        setOrderError(beMsg || (lang === 'vi' ? 'Không thể tạo đơn hàng trên hệ thống. Vui lòng kiểm tra lại kết nối backend hoặc số dư ví.' : 'Failed to create order on backend.'));
      }
    } finally {
      setSubmittingOrder(false);
    }
  };


  // Đồng hồ đếm ngược thời hạn chuyển khoản ký quỹ theo dữ liệu expiresAt từ BE
  useEffect(() => {
    if (!bankPaymentInfo) {
      setPaymentSecondsLeft(null);
      setIsPaymentExpired(false);
      return;
    }

    const calcSeconds = () => {
      if (!bankPaymentInfo.expiresAt) {
        return 15 * 60;
      }
      const expMs = new Date(bankPaymentInfo.expiresAt).getTime();
      const nowMs = Date.now();
      return Math.floor((expMs - nowMs) / 1000);
    };

    const initialDiff = calcSeconds();
    if (initialDiff <= 0 || bankPaymentInfo.status === 'EXPIRED') {
      setPaymentSecondsLeft(0);
      setIsPaymentExpired(true);
      return;
    }

    setPaymentSecondsLeft(initialDiff);
    setIsPaymentExpired(false);

    const timer = setInterval(() => {
      const remaining = calcSeconds();
      if (remaining <= 0) {
        setPaymentSecondsLeft(0);
        setIsPaymentExpired(true);
        clearInterval(timer);
      } else {
        setPaymentSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [bankPaymentInfo?.expiresAt, bankPaymentInfo?.status]);

  const handlePaymentSuccess = useCallback((paidOrder: EscrowOrder) => {
    setIsPaymentSuccess(true);
    setCreatedOrder(paidOrder);
    setBankCheckMessage({
      type: 'success',
      text: lang === 'vi' ? '🎉 Đã ký quỹ Escrow thành công! Đang chuyển hướng đến đơn hàng...' : '🎉 Escrow deposit verified! Redirecting...',
    });

    try {
      const raw = localStorage.getItem('recent_placed_orders');
      const list = raw ? JSON.parse(raw) : [];
      const updated = [paidOrder, ...list.filter((o: any) => o.id !== paidOrder.id)].slice(0, 30);
      localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
    } catch {}

    try {
      const sellerNotifItem = {
        id: `notif-seller-${paidOrder.id}`,
        title: 'Đơn đặt hàng mới đã ký quỹ Escrow',
        message: `Khách mua ${buyerName || 'Khách Hàng'} vừa ký quỹ thành công cho sản phẩm "${listing.title}". Vui lòng xác nhận đơn hàng!`,
        type: 'ORDER',
        referenceId: paidOrder.id,
        referenceType: 'ORDER',
        actionUrl: '/orders?tab=awaiting_pickup',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      const rawNotifs = localStorage.getItem('secondlife_local_notifications');
      const existingNotifs = rawNotifs ? JSON.parse(rawNotifs) : [];
      localStorage.setItem('secondlife_local_notifications', JSON.stringify([sellerNotifItem, ...existingNotifs.filter((n: any) => n.id !== sellerNotifItem.id)].slice(0, 50)));
      window.dispatchEvent(new CustomEvent('secondlife_notification', { detail: sellerNotifItem }));
    } catch {}

    setTimeout(() => {
      onOrderPlaced(paidOrder);
      onClose();
    }, 1800);
  }, [buyerName, listing.title, onOrderPlaced, onClose, lang]);

  const handleCloseUnpaidModal = async () => {
    if (isPaymentSuccess) {
      if (createdOrder) {
        onOrderPlaced(createdOrder);
      }
      onClose();
      return;
    }

    // Nếu chưa thanh toán mà đã tắt mã:
    if (createdOrder?.id) {
      try {
        await orderService.cancelOrder(createdOrder.id, {
          reasonCode: 'BUYER_REQUESTED',
          reason: 'Người mua tắt mã QR thanh toán, chưa hoàn tất chuyển khoản'
        });
      } catch (err) {
        console.warn('Silent cancel unpaid order on backend:', err);
      }

      // Xóa mọi dữ liệu lưu tạm của đơn chưa thanh toán này
      try {
        localStorage.removeItem(`order_listing_${createdOrder.id}`);
        localStorage.removeItem(`order_buyer_info_${createdOrder.id}`);
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const filtered = list.filter((o: any) => o.id !== createdOrder.id);
          localStorage.setItem('recent_placed_orders', JSON.stringify(filtered));
        }
        const rawNotifs = localStorage.getItem('secondlife_local_notifications');
        if (rawNotifs) {
          const list = JSON.parse(rawNotifs);
          const filtered = list.filter((n: any) => n.referenceId !== createdOrder.id);
          localStorage.setItem('secondlife_local_notifications', JSON.stringify(filtered));
        }
      } catch {}
    }

    const unpaidxMsg = lang === 'vi'
      ? 'Đơn hàng chưa được thanh toán! Bạn đã đóng mã thanh toán VietQR nên giao dịch ký quỹ chưa hoàn tất.'
      : 'Order not paid! VietQR code was closed without payment.';

    if (showToast) {
      showToast(unpaidxMsg);
    } else {
      window.dispatchEvent(new CustomEvent('secondlife_toast', { detail: unpaidxMsg }));
    }

    if (onCancelUnpaid) {
      onCancelUnpaid(unpaidxMsg);
    } else {
      onClose();
    }
  };

  // Polling tự động đối soát SePay thời gian thực mỗi 3 giây (Zero-Refresh)
  useEffect(() => {
    if (!bankPaymentInfo || !createdOrder || isPaymentExpired || isPaymentSuccess) return;

    const orderId = createdOrder.id;
    const interval = setInterval(async () => {
      try {
        const fresh = await orderService.getOrderPayment(orderId);
        if (fresh) {
          setBankPaymentInfo(fresh);
          const isPaid = fresh.status === 'PAID' || fresh.remainingAmount === 0 || fresh.orderStatus === 'PROCESSING';
          if (isPaid) {
            const paidOrder: EscrowOrder = {
              ...createdOrder,
              escrowStatus: 'HELD_IN_ESCROW',
              backendStatus: 'PROCESSING',
            };
            handlePaymentSuccess(paidOrder);
          } else if (fresh.status === 'EXPIRED') {
            setIsPaymentExpired(true);
          }
        }
      } catch (err) {
        // quiet polling catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [bankPaymentInfo, createdOrder, isPaymentExpired, isPaymentSuccess, handlePaymentSuccess]);

  if (bankPaymentInfo && createdOrder) {
    const remainingToPay = bankPaymentInfo.remainingAmount ?? bankPaymentInfo.totalAmount ?? totalAmount;
    const vietQrUrl = `https://img.vietqr.io/image/${bankPaymentInfo.bankName || 'MB'}-${bankPaymentInfo.bankAccountNumber || '0000000000'}-compact2.png?amount=${remainingToPay}&addInfo=${encodeURIComponent(bankPaymentInfo.transferContent || createdOrder.id)}&accountName=${encodeURIComponent(bankPaymentInfo.bankAccountName || 'SECONDLIFE ESCROW')}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
        <div className="bg-[#FFFFFF] rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
          {/* Header */}
          <div className="p-5 border-b border-[#24263e]/15 flex items-center justify-between bg-gradient-to-r from-blue-50 to-[#faf8f5] text-[#24263e] shrink-0 rounded-t-3xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#24263e] text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#24263e]">
                  {lang === 'vi' ? 'Ký Quỹ Escrow Qua Ngân Hàng VietQR (SePay)' : 'Escrow Deposit via VietQR'}
                </h3>
                <p className="text-[11px] text-slate-600 font-bold">
                  Đơn hàng: #{createdOrder.id} • Ký quỹ để đóng băng tiền bảo vệ giao dịch
                </p>
              </div>
            </div>

            <button
              onClick={handleCloseUnpaidModal}
              className="text-[#24263e] hover:bg-white/40 p-1.5 rounded-xl cursor-pointer transition font-bold"
              title={lang === 'vi' ? 'Đóng và quay lại trang mua hàng' : 'Close and return to product'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto subtle-scrollbar">
            {/* Status / Success / Expired Banner */}
            {isPaymentSuccess ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-semibold flex items-center gap-3 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-sm text-emerald-800">🎉 Đã Ký Quỹ Escrow Thành Công!</h5>
                  <p className="text-[11px] text-emerald-700">
                    Số tiền {formatVND(remainingToPay)} đã được hệ thống đóng băng an toàn tại Quỹ Escrow. Đang chuyển hướng...
                  </p>
                </div>
              </div>
            ) : isPaymentExpired ? (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 font-semibold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-sm text-rose-800">⚠️ Mã Ký Quỹ Đã Quá Hạn (15 Phút Backend)</h5>
                  <p className="text-[11px] text-rose-700">
                    Thời hạn ký quỹ theo dữ liệu Backend đã kết thúc. Vui lòng không chuyển khoản vào mã này nữa để tránh đơn bị tự động hủy.
                  </p>
                </div>
              </div>
            ) : (
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                (paymentSecondsLeft ?? 900) < 180
                  ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${(paymentSecondsLeft ?? 900) < 180 ? 'text-amber-600 animate-spin' : 'text-blue-600'}`} />
                  <div>
                    <span className="font-bold text-xs">
                      {lang === 'vi' ? 'Thời gian chuyển tiền ký quỹ còn lại:' : 'Remaining deposit window:'}
                    </span>
                    {bankPaymentInfo.expiresAt && (
                      <span className="text-[10px] text-slate-500 block">
                        Hạn chót BE: {new Date(bankPaymentInfo.expiresAt).toLocaleTimeString('vi-VN')} ({new Date(bankPaymentInfo.expiresAt).toLocaleDateString('vi-VN')})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-base font-black font-mono px-2.5 py-1 rounded-xl border ${
                    (paymentSecondsLeft ?? 900) < 180
                      ? 'bg-rose-100 border-rose-300 text-rose-700 font-extrabold'
                      : 'bg-white border-blue-200 text-blue-800'
                  }`}>
                    {paymentSecondsLeft !== null
                      ? `${Math.floor(paymentSecondsLeft / 60).toString().padStart(2, '0')}:${(paymentSecondsLeft % 60).toString().padStart(2, '0')}`
                      : '15:00'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-[#faf8f5] p-4 rounded-2xl border border-slate-200">
              {/* QR Image with Expired Blur Overlay */}
              <div className="relative flex flex-col items-center justify-center bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <img
                  src={vietQrUrl}
                  alt="VietQR Code"
                  className={`w-48 h-48 object-contain rounded-xl transition-all ${
                    isPaymentExpired ? 'filter blur-sm opacity-40' : ''
                  }`}
                />
                {isPaymentExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-2xl p-4 text-center">
                    <XCircle className="w-8 h-8 text-rose-400 mb-1" />
                    <span className="text-white font-extrabold text-xs uppercase bg-rose-600 px-2 py-0.5 rounded shadow">
                      MÃ KÝ QUỸ ĐÃ HẾT HẠN
                    </span>
                    <span className="text-[10px] text-white/90 mt-1">Không chuyển tiền</span>
                  </div>
                )}
                {!isPaymentExpired && (
                  <span className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#c34c36]" />
                    <span>Quét bằng app ngân hàng bất kỳ</span>
                  </span>
                )}
              </div>

              {/* Bank Details */}
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Số tiền ký quỹ (Đóng băng Escrow):</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <strong className="text-base font-black text-[#c34c36] font-mono">{formatVND(remainingToPay)}</strong>
                    <button
                      type="button"
                      disabled={isPaymentExpired}
                      onClick={() => {
                        navigator.clipboard.writeText(String(remainingToPay));
                        setCopiedBankField('amount');
                        setTimeout(() => setCopiedBankField(null), 2000);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                    >
                      {copiedBankField === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Nội dung CK (Bắt buộc chính xác):</span>
                  <div className="flex items-center justify-between mt-0.5 bg-amber-50 p-1.5 rounded-xl border border-amber-200">
                    <strong className="text-xs font-black text-amber-950 font-mono">{bankPaymentInfo.transferContent || createdOrder.id}</strong>
                    <button
                      type="button"
                      disabled={isPaymentExpired}
                      onClick={() => {
                        navigator.clipboard.writeText(bankPaymentInfo.transferContent || createdOrder.id);
                        setCopiedBankField('content');
                        setTimeout(() => setCopiedBankField(null), 2000);
                      }}
                      className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                    >
                      {copiedBankField === 'content' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Ngân hàng thụ hưởng:</span>
                  <strong className="text-xs text-slate-900 block mt-0.5">{bankPaymentInfo.bankName || 'Ngân hàng đối tác'}</strong>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Số tài khoản:</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <strong className="text-xs font-mono text-slate-900">{bankPaymentInfo.bankAccountNumber || 'Chưa cấu hình'}</strong>
                    <button
                      type="button"
                      disabled={isPaymentExpired}
                      onClick={() => {
                        navigator.clipboard.writeText(bankPaymentInfo.bankAccountNumber || '');
                        setCopiedBankField('account');
                        setTimeout(() => setCopiedBankField(null), 2000);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                    >
                      {copiedBankField === 'account' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Chủ tài khoản:</span>
                  <strong className="text-xs text-slate-900 block mt-0.5">{bankPaymentInfo.bankAccountName || 'SECONDLIFE ESCROW'}</strong>
                </div>
              </div>
            </div>

            {/* Escrow Freeze Funds Messaging */}
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-[11px] text-blue-950 space-y-1.5">
              <div className="font-extrabold flex items-center gap-1.5 text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Cơ Chế Ký Quỹ Đóng Băng Tiền (Escrow Protection):</span>
              </div>
              <p className="text-slate-600 leading-snug">
                Khoản tiền này sẽ được cổng SePay đối soát và <strong>đóng băng an toàn tại Quỹ Ký Quỹ Escrow</strong> của SecondLife. Người bán <strong>hoàn toàn CHƯA nhận được tiền</strong> cho đến khi bạn nhận được hàng, kiểm tra 48h và bấm xác nhận hài lòng.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[10px] font-bold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>Hệ thống đang tự động đối soát theo thời gian thực (mỗi 3 giây)...</span>
              </div>
            </div>

            {/* Thông báo kết quả kiểm tra thanh toán nếu có */}
            {bankCheckMessage && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
                bankCheckMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                {bankCheckMessage.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{bankCheckMessage.text}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCloseUnpaidModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition"
              >
                <X className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Hủy & Quay Lại Trang Mua Hàng' : 'Cancel & Return to Product'}</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {isPaymentSuccess ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (createdOrder) onOrderPlaced(createdOrder);
                      onClose();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Xem Đơn Hàng Ngay' : 'View Order Now'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setCheckingBankPayment(true);
                      setBankCheckMessage(null);
                      try {
                        const freshPayment = await orderService.getOrderPayment(createdOrder.id);
                        setBankPaymentInfo(freshPayment);
                        const isPaid = freshPayment.status === 'PAID' || freshPayment.remainingAmount === 0 || freshPayment.orderStatus === 'PROCESSING';
                        if (isPaid) {
                          const paidOrder: EscrowOrder = {
                            ...createdOrder,
                            escrowStatus: 'HELD_IN_ESCROW',
                            backendStatus: 'PROCESSING',
                          };
                          handlePaymentSuccess(paidOrder);
                        } else {
                          setBankCheckMessage({
                            type: 'error',
                            text: lang === 'vi'
                              ? 'Chưa nhận được thanh toán đối soát từ ngân hàng. Nếu bạn vừa chuyển khoản, vui lòng đợi 5-10 giây để hệ thống SePay tự động ghi nhận.'
                              : 'Payment not detected yet. If you just transferred, please wait a few seconds.',
                          });
                        }
                      } catch (e) {
                        setBankCheckMessage({
                          type: 'error',
                          text: lang === 'vi' ? 'Không thể kết nối đến máy chủ đối soát. Vui lòng thử lại.' : 'Could not check payment status.',
                        });
                      } finally {
                        setCheckingBankPayment(false);
                      }
                    }}
                    disabled={checkingBankPayment || isPaymentExpired}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-black text-xs cursor-pointer shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingBankPayment ? 'animate-spin' : ''}`} />
                    <span>
                      {checkingBankPayment
                        ? (lang === 'vi' ? 'Đang kiểm tra đối soát...' : 'Checking...')
                        : (lang === 'vi' ? 'Tôi Đã Chuyển Khoản • Kiểm Tra Ngay' : 'I Have Transferred • Check Now')}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

                  <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? 'Tháo máy kiểm định • Mất trạng thái zin'
                        : 'Disassembled for testing • Voids original zin'}
                    </span>
                  </div>
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
                      ? 'Tài xế Lalamove lấy hàng từ người bán và phát thẳng tới địa chỉ của bạn. Đồng kiểm ngoại quan lúc nhận hàng.'
                      : 'Lalamove courier picks up from seller and delivers straight to you with co-inspection upon receipt.'}
                  </p>
                </div>
              </div>
            </div>

            {/* BLOCK CẤU HÌNH KIỂM ĐỊNH CHI TIẾT */}
            {deliveryOption === 'INSPECTION' && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3.5 animate-fadeIn">
                {/* THÔNG BÁO VỀ VIỆC THÁO SẢN PHẨM KIỂM ĐỊNH & MẤT TRẠNG THÁI ZIN */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all shadow-xs ${
                    formErrors.agreedZinLoss
                      ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20'
                      : agreedZinLoss
                        ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-300'
                        : 'bg-gradient-to-br from-amber-50/90 via-[#fffbf5] to-orange-50/80 border-amber-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition ${
                        agreedZinLoss ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {agreedZinLoss ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h5 className="font-extrabold text-xs sm:text-sm text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                          <span>
                            {lang === 'vi'
                              ? 'Lưu ý quan trọng: Quy trình tháo máy & Trạng thái "Zin"'
                              : 'Important Notice: Disassembly Inspection & "Zin" Status'}
                          </span>
                        </h5>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            agreedZinLoss
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {agreedZinLoss
                            ? (lang === 'vi' ? '✓ Đã đồng ý' : '✓ Confirmed')
                            : (lang === 'vi' ? '⚠️ Cần xác nhận' : '⚠️ Action Required')}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-700 leading-relaxed space-y-1.5">
                        <p>
                          {lang === 'vi' ? (
                            <>
                              Khi bạn chọn mua hàng kiểm định, kỹ thuật viên chuyên trách tại Trung tâm Kiểm định SecondLife sẽ tiến hành{' '}
                              <strong className="text-slate-900 font-bold underline decoration-amber-400 decoration-2">
                                tháo mở sản phẩm
                              </strong>{' '}
                              để kiểm tra chuyên sâu các linh kiện, bo mạch, vi xử lý và phát hiện chính xác tình trạng sửa chữa, thay thế hoặc lỗi tiềm ẩn.
                            </>
                          ) : (
                            <>
                              When selecting inspection, certified technicians will{' '}
                              <strong className="text-slate-900 font-bold underline decoration-amber-400 decoration-2">
                                disassemble the product
                              </strong>{' '}
                              to perform thorough diagnostics on internal circuitry, components, and detect hidden repairs or replacements.
                            </>
                          )}
                        </p>

                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-300/80 text-amber-950 font-medium">
                          <p>
                            ⚠️{' '}
                            <strong>
                              {lang === 'vi'
                                ? 'Sản phẩm sẽ mất trạng thái "zin" ban đầu:'
                                : 'Product will lose original "zin" status:'}
                            </strong>{' '}
                            {lang === 'vi'
                              ? 'Do phải tháo máy để kiểm định chất lượng, sản phẩm sẽ mất tem niêm phong xuất xưởng ban đầu của nhà sản xuất (mất trạng thái zin). Sau khi kiểm định đạt chuẩn, hệ thống sẽ dán Tem niêm phong bảo đảm NFC SecondLife và cấp Biên bản chứng thực độc quyền để bảo vệ quyền lợi người mua.'
                              : 'Because disassembly is required, original factory seals will be opened (losing pristine "zin" status). In return, passed items receive an official SecondLife NFC Tamper-Evident Seal & Lab Certification.'}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Consent Checkbox */}
                      <label className="flex items-start gap-2.5 pt-2 mt-1 border-t border-slate-200/80 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={agreedZinLoss}
                          onChange={(e) => {
                            setAgreedZinLoss(e.target.checked);
                            if (formErrors.agreedZinLoss) {
                              setFormErrors((prev) => ({ ...prev, agreedZinLoss: '' }));
                            }
                          }}
                          className="mt-0.5 w-4 h-4 rounded text-[#c34c36] focus:ring-[#c34c36] border-slate-300 cursor-pointer accent-[#c34c36]"
                        />
                        <span
                          className={`text-[11px] font-bold leading-snug transition ${
                            agreedZinLoss ? 'text-emerald-800' : 'text-slate-800 group-hover:text-[#c34c36]'
                          }`}
                        >
                          {lang === 'vi'
                            ? 'Tôi đã hiểu và đồng ý rằng sản phẩm sẽ được tháo máy để kiểm định và sẽ mất trạng thái zin của sản phẩm.'
                            : 'I understand and agree that the product will be disassembled for inspection and will lose its original "zin" condition.'}
                        </span>
                      </label>

                      {formErrors.agreedZinLoss && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-bold pt-0.5 animate-fadeIn">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{formErrors.agreedZinLoss}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 1. Chọn Trung Tâm Kiểm Định */}
                <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                      <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>{lang === 'vi' ? '1. Chọn Trung Tâm Kiểm Định Tiếp Nhận' : '1. Select Inspection Hub'}</span>
                      <span className="text-[10px] text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        ❌ [Trạm mẫu / Chưa có API Hubs]
                      </span>
                    </label>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      📍 {selectedCenter.city}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {mockInspectionCenters.map((hub) => {
                      const isSelected = hub.id === selectedCenterId;
                      return (
                        <div
                          key={hub.id}
                          onClick={() => setSelectedCenterId(hub.id)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#c34c36] bg-white shadow-xs ring-2 ring-[#c34c36]/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white/70'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-[11px] text-slate-900 leading-snug line-clamp-1">
                                {hub.city}
                              </span>
                              {isSelected ? (
                                <BadgeCheck className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {hub.name.replace('SecondLife Home Hub ', '')}
                            </p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500">
                            <span className="font-bold text-emerald-700">⏱️ SLA: {hub.slaHours}h</span>
                            <span className="font-semibold text-slate-600">Đạt: {hub.passRatePercentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chi tiết trung tâm đã chọn */}
                  <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                        {selectedCenter.name}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                        📞 Hotline: <strong className="text-slate-900">{selectedCenter.phone}</strong>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 pl-4.5">
                      {selectedCenter.address}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pl-4.5 pt-0.5 text-[9px] text-slate-500">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                        👨‍🔧 Đội ngũ: <strong>{selectedCenter.activeInspectors} kỹ sư</strong>
                      </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                        📦 Công suất: <strong>{selectedCenter.capacityPerDay} máy/ngày</strong>
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                        ✅ Tỷ lệ thẩm định đạt: {selectedCenter.passRatePercentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Chọn Cách Kiểm Định (2 cách) */}
                <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>{lang === 'vi' ? '2. Chọn Phương Thức Kiểm Định' : '2. Inspection Method'}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      (2 phương thức linh hoạt)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Cách 1: Đưa đến trung tâm */}
                    <div
                      onClick={() => setInspectionMethod('AT_CENTER')}
                      className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        inspectionMethod === 'AT_CENTER'
                          ? 'border-blue-600 bg-white shadow-xs ring-2 ring-blue-600/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white/70'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-extrabold text-xs text-slate-900">
                              {lang === 'vi' ? 'Đưa đến trung tâm' : 'Bring to Center'}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                            {formatVND(atCenterFee)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          {lang === 'vi'
                            ? `Chuyển hàng về Hub Lab SecondLife. Gồm phí ship trung tâm (${formatVND(inspectionQuote?.atCenterPackage?.shippingToCenterFee || 50000)}) và quỹ dự phòng chiều về (${formatVND(inspectionQuote?.atCenterPackage?.returnReserveFee || 50000)}).`
                            : 'Shipped to Hub Lab. Includes shipping to center and return reserve fee.'}
                        </p>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-blue-700 font-bold">
                        <span>🏷️ Đã bao gồm dự phòng 2 chiều</span>
                        {inspectionMethod === 'AT_CENTER' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </div>

                    {/* Cách 2: Cử người đến nhà */}
                    <div
                      onClick={() => setInspectionMethod('AT_HOME')}
                      className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        inspectionMethod === 'AT_HOME'
                          ? 'border-purple-600 bg-white shadow-xs ring-2 ring-purple-600/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white/70'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Home className="w-4 h-4 text-purple-600 shrink-0" />
                            <span className="font-extrabold text-xs text-slate-900">
                              {lang === 'vi' ? 'Cử người đến nhà kiểm định' : 'On-site at Home'}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                            {formatVND(atHomeFee)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          {lang === 'vi'
                            ? `Kỹ thuật viên SecondLife mang thiết bị đến tận nhà người bán (${(inspectionQuote?.atHomePackage?.distanceKm || inspectionQuote?.travelDistanceKm || 10).toFixed(1)} km). Cước di chuyển 6 bậc thang.`
                            : 'Technicians bring equipment to seller home with 6-tier distance calculation.'}
                        </p>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-purple-700 font-bold">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTierBreakdown(!showTierBreakdown);
                          }}
                          className="hover:underline flex items-center gap-1 text-purple-800"
                        >
                          <span>📊 {showTierBreakdown ? 'Ẩn chi tiết cước' : 'Xem chi tiết 6 bậc cước'}</span>
                        </button>
                        {inspectionMethod === 'AT_HOME' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                      </div>
                    </div>
                  </div>

                  {/* BẢNG CHI TIẾT 6 BẬC THANG CƯỚC DI CHUYỂN */}
                  {showTierBreakdown && (
                    <div className="mt-2 p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-[10px] space-y-1.5 animate-fadeIn">
                      <div className="font-bold text-purple-900 flex items-center justify-between">
                        <span>Biểu Phí Cước Di Chuyển KTV (6 Bậc Thang Căn Cước Tuyến Tính):</span>
                        <span className="text-[9px] bg-purple-200 px-2 py-0.5 rounded-full font-bold">2 Chiều (Khứ hồi)</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        {(inspectionQuote?.atHomePackage?.tiersBreakdown || inspectionQuote?.appliedTiers || [
                          { tierNumber: 1, name: '0 - 5 km đầu', pricePerKm: 2000 },
                          { tierNumber: 2, name: 'Trên 5 - 10 km', pricePerKm: 2500 },
                          { tierNumber: 3, name: 'Trên 10 - 15 km', pricePerKm: 3000 },
                          { tierNumber: 4, name: 'Trên 15 - 20 km', pricePerKm: 3500 },
                          { tierNumber: 5, name: 'Trên 20 - 30 km', pricePerKm: 4000 },
                          { tierNumber: 6, name: 'Trên 30 km', pricePerKm: 4500 }
                        ]).map((tier: any) => (
                          <div key={tier.tierNumber} className="flex justify-between items-center text-slate-700 py-0.5 border-b border-purple-100/60 last:border-0">
                            <span className="font-semibold">Bậc {tier.tierNumber} ({tier.name}):</span>
                            <span className="font-bold text-purple-900">{formatVND(tier.pricePerKm)} / km</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Chia Tiền Kiểm Định */}
                <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>{lang === 'vi' ? '3. Phân Chia Tiền Kiểm Định' : '3. Inspection Fee Split'}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Tổng phí: <strong className="text-slate-900 font-bold">{formatVND(baseInspectionFee)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Option 1: Người mua 100% */}
                    <div
                      onClick={() => setFeeSplit('BUYER_100')}
                      className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        feeSplit === 'BUYER_100'
                          ? 'border-[#c34c36] bg-white shadow-xs ring-2 ring-[#c34c36]/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-slate-900">
                            {lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%'}
                          </span>
                          {feeSplit === 'BUYER_100' && <Check className="w-3.5 h-3.5 text-[#c34c36]" />}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Mặc định</span>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] font-bold text-[#c34c36]">
                        Bạn trả: {formatVND(baseInspectionFee)}
                      </div>
                    </div>

                    {/* Option 2: Chia đôi 50% - 50% */}
                    <div
                      onClick={() => setFeeSplit('SPLIT_50_50')}
                      className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        feeSplit === 'SPLIT_50_50'
                          ? 'border-emerald-600 bg-white shadow-xs ring-2 ring-emerald-600/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-slate-900">
                            {lang === 'vi' ? 'Chia đôi 50% - 50%' : 'Split 50% - 50%'}
                          </span>
                          {feeSplit === 'SPLIT_50_50' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Mỗi bên một nửa</span>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] font-bold text-emerald-700">
                        Bạn trả: {formatVND(Math.round(baseInspectionFee / 2))}
                      </div>
                    </div>

                    {/* Option 3: Người bán 100% */}
                    <div
                      onClick={() => setFeeSplit('SELLER_100')}
                      className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        feeSplit === 'SELLER_100'
                          ? 'border-blue-600 bg-white shadow-xs ring-2 ring-blue-600/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-slate-900">
                            {lang === 'vi' ? 'Người bán 100%' : 'Seller 100%'}
                          </span>
                          {feeSplit === 'SELLER_100' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Cam kết người bán</span>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] font-bold text-blue-700">
                        Bạn trả: 0 VNĐ
                      </div>
                    </div>
                  </div>

                  {/* Thanh tóm tắt phân chia */}
                  <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span>
                      💡 <strong>Bạn thanh toán:</strong> <strong className="text-[#c34c36] font-bold">{formatVND(buyerInspectionFee)}</strong>
                    </span>
                    <span>
                      Người bán chịu: <strong className="text-slate-900 font-bold">{formatVND(sellerInspectionFee)}</strong> (khấu trừ doanh thu khi hoàn tất)
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                      if (orderError) setOrderError(null);
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {lang === 'vi' ? 'Số điện thoại nhận hàng *' : 'Phone Number *'}
                  </label>
                  {buyerPhone.trim() && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      buyerPhone.replace(/\D/g, '').length === 10 && buyerPhone.trim().startsWith('0')
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : buyerPhone.replace(/\D/g, '').length < 10
                        ? 'text-amber-700 bg-amber-50 border border-amber-200'
                        : 'text-rose-700 bg-rose-50 border border-rose-200'
                    }`}>
                      {buyerPhone.replace(/\D/g, '').length}/10 số
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuyerPhone(val);
                      if (orderError) setOrderError(null);
                      const clean = val.replace(/\D/g, '');
                      if (!val.trim()) {
                        setFormErrors(prev => ({
                          ...prev,
                          buyerPhone: lang === 'vi' ? 'Vui lòng nhập số điện thoại nhận hàng' : 'Phone number is required'
                        }));
                      } else if (/[^\d\s.-]/.test(val)) {
                        setFormErrors(prev => ({
                          ...prev,
                          buyerPhone: lang === 'vi' ? 'Số điện thoại chỉ được chứa các chữ số' : 'Phone number can only contain digits'
                        }));
                      } else if (!clean.startsWith('0')) {
                        setFormErrors(prev => ({
                          ...prev,
                          buyerPhone: lang === 'vi' ? 'Số điện thoại phải bắt đầu bằng số 0 (ví dụ: 0987...)' : 'Phone number must start with 0'
                        }));
                      } else if (clean.length < 10) {
                        setFormErrors(prev => ({
                          ...prev,
                          buyerPhone: lang === 'vi'
                            ? `Số điện thoại phải có đúng 10 chữ số (bạn đang nhập thiếu: ${clean.length}/10 số)`
                            : `Phone number must be exactly 10 digits (currently ${clean.length}/10)`
                        }));
                      } else if (clean.length > 10) {
                        setFormErrors(prev => ({
                          ...prev,
                          buyerPhone: lang === 'vi'
                            ? `Số điện thoại chỉ được đúng 10 chữ số (bạn đang nhập dư: ${clean.length}/10 số)`
                            : `Phone number must be exactly 10 digits (exceeded: ${clean.length}/10)`
                        }));
                      } else {
                        // Exactly 10 digits and starts with 0
                        setFormErrors(prev => {
                          const updated = { ...prev };
                          delete updated.buyerPhone;
                          return updated;
                        });
                      }
                    }}
                    onBlur={() => {
                      const err = validatePhoneNumber(buyerPhone, lang);
                      if (err) {
                        setFormErrors(prev => ({ ...prev, buyerPhone: err }));
                      } else {
                        setFormErrors(prev => {
                          const updated = { ...prev };
                          delete updated.buyerPhone;
                          return updated;
                        });
                      }
                    }}
                    placeholder="0912 345 678"
                    maxLength={15}
                    className={`w-full pl-9 pr-3 py-2 bg-[#faf8f5] border rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition ${
                      formErrors.buyerPhone ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-[#c34c36]'
                    }`}
                  />
                </div>
                {formErrors.buyerPhone && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {formErrors.buyerPhone}
                  </span>
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

            {/* Lalamove Delivery Address Selection */}
            <LalamoveAddressPicker
              initialName={buyerName}
              initialPhone={buyerPhone}
              onNameChange={(val) => {
                setBuyerName(val);
                if (formErrors.buyerName) setFormErrors({ ...formErrors, buyerName: '' });
              }}
              onPhoneChange={(val) => {
                setBuyerPhone(val);
              }}
              initialLatitude={deliveryLatitude}
              initialLongitude={deliveryLongitude}
              initialAddress={streetAddress}
              sellerCity={sellerCityInfo.name}
              sellerLocation={listing.sellerAddress || listing.location}
              onAddressConfirmed={(data) => {
                setDeliveryLatitude(data.latitude);
                setDeliveryLongitude(data.longitude);
                setStreetAddress(data.address);
                setSelectedProvinceName(data.city);
                if (data.name) setBuyerName(data.name);
                if (data.phone) setBuyerPhone(data.phone);
                // Xóa báo giá cũ và lỗi khi người dùng chọn tọa độ mới
                setGhnQuote(null);
                setQuoteError(null);
              }}
              lang={lang}
              title={lang === 'vi' ? 'Địa Chỉ Giao Nhận Hàng Lalamove' : 'Lalamove Delivery Address'}
              description={
                hasProfileAddress
                  ? (lang === 'vi' ? 'Đã tự động đồng bộ từ địa chỉ hồ sơ của bạn. Bạn có thể kéo ghim nếu điểm nhận hàng khác.' : 'Auto-synced from your profile address. Drag pin to adjust if needed.')
                  : (lang === 'vi' ? 'Hồ sơ chưa có địa chỉ. Bấm "Dùng Vị Trí Hiện Tại" hoặc nhấp vào bản đồ để chọn điểm giao hàng.' : 'No profile address. Click "Use Current Location" or pick on the map.')
              }
            />

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
                {lang === 'vi' ? 'Ghi chú cho tài xế giao nhận Lalamove' : 'Delivery Note for Lalamove Courier'}
              </label>
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Gọi trước 15 phút, nhà có thang máy..."
                className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-medium text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            {/* Live Lalamove Quote Status Indicator */}
            {quoteLoading && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2.5 text-xs text-orange-800">
                <Loader2 className="w-4 h-4 text-orange-600 animate-spin shrink-0" />
                <span>Đang kết nối API Lalamove tính toán cước phí vận chuyển...</span>
              </div>
            )}

            {quoteError && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold leading-relaxed">{quoteError}</p>
                    {(quoteError.includes('phạm vi phục vụ') || quoteError.includes('ERR_OUT_OF_SERVICE_AREA')) && (
                      <p className="text-[11px] text-amber-700">
                        👉 Bấm nút bên cạnh để chuyển vị trí giao hàng sang khu vực <strong>{sellerCityInfo.name}</strong>.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {(quoteError.includes('phạm vi phục vụ') || quoteError.includes('ERR_OUT_OF_SERVICE_AREA')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryLatitude(sellerCityInfo.lat);
                        setDeliveryLongitude(sellerCityInfo.lng);
                        setStreetAddress(`Khu vực trung tâm ${sellerCityInfo.name}`);
                        setSelectedProvinceName(sellerCityInfo.name);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs transition"
                    >
                      Đổi sang {sellerCityInfo.name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (quoteDebounceTimerRef.current) clearTimeout(quoteDebounceTimerRef.current);
                      calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                    }}
                    className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl font-bold text-xs cursor-pointer transition"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            )}

            {ghnQuote && !quoteError && (
              <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-3 text-xs text-emerald-950 animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-700" />
                    <span className="font-extrabold">Báo Giá Vận Chuyển Lalamove</span>
                  </div>
                  <span className="font-mono text-[11px] bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900 font-semibold">
                    Chặng: {ghnQuote.leg || 'SELLER_TO_BUYER'}
                  </span>
                </div>

                {/* Thẻ phân loại phương tiện theo kích thước & khối lượng kiện hàng sản phẩm */}
                {(() => {
                  const vehicleByQuote = formatLalamoveVehicle(ghnQuote.serviceType);
                  const parcelVehicle = classifyVehicleByProduct(
                    listing.shippingWeight,
                    listing.shippingLength,
                    listing.shippingWidth,
                    listing.shippingHeight
                  );

                  const weightKg = Number(listing.shippingWeight || 0) / 1000;
                  const weightDisplay = weightKg >= 1
                    ? `${weightKg.toLocaleString('vi-VN')} kg`
                    : `${listing.shippingWeight || 1000} gram`;
                  const dimsDisplay = `${listing.shippingLength || 30} x ${listing.shippingWidth || 25} x ${listing.shippingHeight || 20} cm`;

                  // Phát hiện trường hợp sản phẩm nhỏ (Xe máy) nhưng bị Lalamove tính cước xe tải do khoảng cách xa
                  const isRouteMismatch = parcelVehicle.isMotorcycleEligible && ghnQuote.serviceType !== 'MOTORCYCLE';

                  return (
                    <div className="space-y-2.5">
                      <div className="p-3 bg-white/95 border border-emerald-200 rounded-xl space-y-2 shadow-2xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl shrink-0 mt-0.5">{parcelVehicle.icon}</span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-900">
                                  Phương tiện chuẩn: {parcelVehicle.name}
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                  Phân loại theo kích thước & khối lượng
                                </span>
                                {ghnQuote.serviceType && (
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                                    Provider: {ghnQuote.serviceType}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                {parcelVehicle.desc}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Chi tiết kích thước và khối lượng của kiện hàng */}
                        <div className="flex items-center gap-2 pt-2 border-t border-emerald-100 text-[11px] text-slate-700 flex-wrap">
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            📦 Kiện hàng:
                          </span>
                          <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                            Khối lượng: <strong className="text-slate-900">{weightDisplay}</strong>
                          </span>
                          <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                            Kích thước: <strong className="text-slate-900">{dimsDisplay}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({parcelVehicle.standard})
                          </span>
                        </div>
                      </div>

                      {/* Cảnh báo khi sản phẩm nhỏ gọn nhưng bị tính cước xe tải đường dài */}
                      {isRouteMismatch && (
                        <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold block text-amber-950">
                              Lưu ý về phương tiện và khoảng cách giao hàng:
                            </strong>
                            <span>
                              Theo kích thước ({dimsDisplay}) và khối lượng ({weightDisplay}), sản phẩm này thuộc phân loại <strong>{parcelVehicle.name}</strong> (cước nội thành thông thường ~20.000 đ – 45.000 đ). Tuy nhiên do địa chỉ nhận hàng cách kho người bán quá xa (hoặc khác tỉnh thành), nhà xe không nhận chạy xe máy mà điều động <strong>{vehicleByQuote.name}</strong> đường dài với cước <strong>{formatVND(ghnQuote.shippingFee)}</strong>.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white/70 rounded-xl border border-emerald-100 space-y-0.5">
                    <span className="text-emerald-700 font-medium block">Phí giao Lalamove (Người mua trả):</span>
                    <strong className="text-emerald-950 text-sm font-black">{formatVND(ghnQuote.shippingFee)}</strong>
                  </div>
                  <div className="p-2.5 bg-white/70 rounded-xl border border-emerald-100 space-y-0.5">
                    <span className="text-emerald-700 font-medium block">Thời gian dự kiến:</span>
                    <strong className="text-emerald-950 text-xs font-bold">
                      {ghnQuote.expectedDeliveryTime
                        ? new Date(ghnQuote.expectedDeliveryTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'Chưa có dự kiến giao hàng'}
                    </strong>
                  </div>
                </div>

                {ghnQuote.expiresAt && (
                  <div className="flex items-center justify-between text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>Thời hạn báo giá:</span>
                    </span>
                    <span className="font-bold">
                      {new Date(ghnQuote.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(ghnQuote.expiresAt).toLocaleDateString('vi-VN')})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method Selector: WALLET vs BANK_TRANSFER (Mục 8) */}
          <div className="space-y-3">
            <label className="font-extrabold text-[#24263e] uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>{lang === 'vi' ? 'Phương thức thanh toán bảo lãnh Escrow:' : 'Payment Method:'}</span>
              <span className="text-emerald-700 font-bold lowercase">
                {paymentMethod === 'WALLET'
                  ? (lang === 'vi' ? 'Trừ trực tiếp số dư ví' : 'Direct wallet debit')
                  : (lang === 'vi' ? 'Quét mã VietQR chuyển khoản' : 'VietQR Bank Transfer')}
              </span>
            </label>

            {/* Selection Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Ví SecondLife Escrow */}
              <div
                onClick={() => setPaymentMethod('WALLET')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  paymentMethod === 'WALLET'
                    ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                        {lang === 'vi' ? 'Ví Điện Tử SecondLife' : 'SecondLife Wallet'}
                      </h5>
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        {lang === 'vi' ? 'Ký quỹ Escrow tức thì' : 'Instant Escrow hold'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'WALLET' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
                  }`}>
                    {paymentMethod === 'WALLET' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Số dư khả dụng:</span>
                  <strong className="font-mono text-slate-900">{formatVND(wallet?.balance ?? 0)}</strong>
                </div>
              </div>

              {/* Option 2: Chuyển khoản ngân hàng trực tiếp VietQR */}
              <div
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                        {lang === 'vi' ? 'Chuyển Khoản Trực Tiếp' : 'Direct Bank Transfer'}
                      </h5>
                      <span className="text-[10px] text-blue-700 font-bold block">
                        {lang === 'vi' ? 'Quét mã VietQR (SePay)' : 'VietQR / SePay'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'BANK_TRANSFER' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
                  }`}>
                    {paymentMethod === 'BANK_TRANSFER' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Đối soát tự động:</span>
                  <span className="text-emerald-700 font-bold">24/7 tức thì</span>
                </div>
              </div>
            </div>

            {/* Wallet Details Card if WALLET is selected */}
            {paymentMethod === 'WALLET' && (
              <div className={`p-4 rounded-2xl border transition-all ${
                (wallet?.balance ?? 0) >= upfrontAmount
                  ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-300'
                  : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-300'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      (wallet?.balance ?? 0) >= upfrontAmount ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
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

                  {onOpenDeposit && (wallet?.balance ?? 0) < upfrontAmount ? (
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
                  ) : (wallet?.balance ?? 0) >= upfrontAmount ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-800 text-[11px] font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Đủ số dư' : 'Sufficient'}</span>
                    </span>
                  ) : null}
                </div>

                {(wallet?.balance ?? 0) < upfrontAmount && (
                  <div className="mt-2.5 pt-2 border-t border-amber-200/80 text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? `Số dư ví còn thiếu ${formatVND(upfrontAmount - (wallet?.balance ?? 0))}. Bạn có thể nạp tiền vào ví hoặc chọn phương thức 'Chuyển Khoản Trực Tiếp'.`
                        : `Wallet is short by ${formatVND(upfrontAmount - (wallet?.balance ?? 0))}. Please top up or choose Direct Bank Transfer.`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bank Transfer Details Card if BANK_TRANSFER is selected */}
            {paymentMethod === 'BANK_TRANSFER' && (
              <div className="p-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white text-xs space-y-2">
                <div className="flex items-center gap-2.5 text-blue-900 font-bold">
                  <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Thanh toán quét mã VietQR tự động qua SePay</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {lang === 'vi'
                    ? 'Sau khi bấm "Đặt Hàng & Lấy Mã VietQR", hệ thống sẽ hiển thị mã QR kèm nội dung chuyển tiền định danh. Bạn mở app ngân hàng bất kỳ để quét mã và chuyển tiền. Tiền sẽ được đối soát tự động và đưa vào ký quỹ Escrow bảo vệ bạn.'
                    : 'After clicking Place Order, a dynamic VietQR will be generated with your unique order code. Funds will be verified and held in Escrow.'}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-blue-700 font-bold pt-1 border-t border-blue-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bảo lãnh Escrow 100% • Người bán chỉ nhận tiền sau khi bạn xác nhận đã nhận hàng</span>
                </div>
              </div>
            )}
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
              <span>{lang === 'vi' ? 'Phí giao hàng Lalamove On-Demand:' : 'Lalamove Shipping Fee:'}</span>
              <div className="text-right">
                {quoteLoading ? (
                  <span className="text-orange-600 font-bold flex items-center gap-1 justify-end">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tính phí Lalamove...</span>
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
                    onClick={() => calculateLalamoveQuote()}
                    className="text-orange-600 hover:underline font-bold cursor-pointer"
                  >
                    {lang === 'vi' ? 'Tính phí Lalamove' : 'Calculate quote'}
                  </button>
                )}
              </div>
            </div>

            {deliveryOption === 'INSPECTION' && (
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 space-y-1.5 text-[11px] animate-fadeIn">
                <div className="flex justify-between text-emerald-950 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {lang === 'vi' ? 'Phí kiểm định' : 'Inspection Fee'} (
                      {inspectionMethod === 'AT_HOME'
                        ? (lang === 'vi' ? 'Cử người đến nhà' : 'On-site')
                        : (lang === 'vi' ? 'Đưa đến trung tâm' : 'At Center')}
                      ):
                    </span>
                  </span>
                  <span className="font-extrabold text-[#c34c36]">
                    {buyerInspectionFee > 0 ? `+${formatVND(buyerInspectionFee)}` : (lang === 'vi' ? '0 VNĐ (Người bán chịu)' : '0 VND (Seller covered)')}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-emerald-800 gap-1 pt-0.5 border-t border-emerald-200/60 font-medium">
                  <span className="truncate">
                    📍 {selectedCenter?.name}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {feeSplit === 'BUYER_100'
                      ? (lang === 'vi' ? 'Người mua chịu 100%' : 'Buyer pays 100%')
                      : feeSplit === 'SPLIT_50_50'
                        ? (lang === 'vi'
                            ? `Chia đôi (Bạn: ${formatVND(buyerInspectionFee)} | Bán: ${formatVND(sellerInspectionFee)})`
                            : `Split 50-50 (You: ${formatVND(buyerInspectionFee)} | Seller: ${formatVND(sellerInspectionFee)})`)
                        : (lang === 'vi'
                            ? `Người bán chịu 100% (${formatVND(sellerInspectionFee)})`
                            : `Seller pays 100% (${formatVND(sellerInspectionFee)})`)}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-emerald-200/60 text-[10px] text-amber-900 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'vi'
                      ? 'Lưu ý: Thiết bị sẽ được tháo máy để kiểm tra kỹ thuật (sẽ mất trạng thái zin nguyên bản).'
                      : 'Notice: Device will be disassembled for inspection (voids original "zin" condition).'}
                  </span>
                </div>
              </div>
            )}

            {isInspected ? (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Giai đoạn 1 (Trả trước): Phí kiểm định + Ship' : 'Stage 1 (Upfront): Inspection + Shipping'}</span>
                    </span>
                    <span className="text-[#c34c36] font-extrabold">{formatVND(upfrontAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>{lang === 'vi' ? 'Giai đoạn 2 (Sau khi máy ĐẠT kiểm định): Tiền sản phẩm' : 'Stage 2 (After PASSED inspection): Product Price'}</span>
                    <span className="font-semibold text-slate-700">{formatVND(stage2ProductAmount)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic pt-0.5 border-t border-amber-100">
                    {lang === 'vi'
                      ? '* Tiền sản phẩm chỉ thanh toán sau khi bạn xem biên bản kiểm định và đồng ý mua tiếp.'
                      : '* Product price is paid only after you review inspection report and confirm purchase.'}
                  </p>
                </div>

                <div className="flex justify-between font-bold text-sm text-[#24263e] pt-1">
                  <span>
                    {paymentMethod === 'WALLET'
                      ? (lang === 'vi' ? 'Tổng tiền cọc trừ ví ngay:' : 'Total Deposit Payable from Wallet:')
                      : (lang === 'vi' ? 'Tổng cọc thanh toán VietQR ngay:' : 'Total Deposit Payable via VietQR:')}
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#c34c36]">
                    {formatVND(upfrontAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-[#24263e]">
                <span>
                  {paymentMethod === 'WALLET'
                    ? (lang === 'vi' ? 'Tổng số tiền trừ ví:' : 'Total Payable from Wallet:')
                    : (lang === 'vi' ? 'Tổng thanh toán qua VietQR:' : 'Total Payable via VietQR:')}
                </span>
                <span className="text-base sm:text-lg font-black text-[#c34c36]">
                  {formatVND(totalAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong>{lang === 'vi' ? 'Cam kết Escrow:' : 'Escrow Custody Guarantee:'}</strong>{' '}
              {isInspected
                ? (lang === 'vi'
                    ? 'Bạn chỉ trả trước phí kiểm định và tiền ship. Sau khi có kết quả kiểm định đạt chuẩn, bạn sẽ có quyền xem biên bản để xác nhận mua tiếp (trả tiền máy) hoặc từ chối hủy đơn bảo lãnh.'
                    : 'You only pay inspection & shipping deposit upfront. You will review the inspection report to confirm purchase or cancel.')
                : (lang === 'vi'
                    ? 'Tiền sẽ được trừ vào ví và phong tỏa an toàn tại quỹ Escrow. Sau khi tài xế Lalamove giao hàng và bạn xác nhận đã nhận hàng thành công, tiền hàng mới được giải ngân cho người bán.'
                    : 'Payment is securely held in Escrow custody. Seller receives funds only after Lalamove delivers and you confirm receipt.')}
            </span>
          </div>

          {/* Order Error Alert */}
          {orderError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center justify-between gap-2.5 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="break-words">{orderError}</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderError(null)}
                className="text-red-400 hover:text-red-700 p-1 rounded-lg transition shrink-0 cursor-pointer"
                title={lang === 'vi' ? 'Đóng thông báo' : 'Dismiss notice'}
              >
                <X className="w-4 h-4" />
              </button>
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
                <span>
                  {paymentMethod === 'WALLET'
                    ? (lang === 'vi' ? 'Đang kết nối Escrow & trừ tiền ví...' : 'Connecting Escrow & deducting wallet...')
                    : (lang === 'vi' ? 'Đang tạo đơn & lấy mã VietQR...' : 'Creating order & generating VietQR...')}
                </span>
              </>
            ) : !ghnQuote ? (
              <>
                <Truck className="w-4 h-4 text-white" />
                <span>{lang === 'vi' ? 'Vui lòng xác nhận địa chỉ để lấy báo giá Lalamove' : 'Please confirm location for Lalamove quote'}</span>
              </>
            ) : paymentMethod === 'WALLET' ? (
              <>
                <Lock className="w-4 h-4 text-white" />
                <span>
                  {isInspected
                    ? (lang === 'vi'
                        ? `Xác Nhận Đặt Cọc Kiểm Định & Ship (${formatVND(upfrontAmount)})`
                        : `Confirm Inspection Deposit & Ship (${formatVND(upfrontAmount)})`)
                    : (lang === 'vi'
                        ? `Xác Nhận Đặt Hàng & Thanh Toán Ví (${formatVND(totalAmount)})`
                        : `Confirm Order & Pay with Wallet (${formatVND(totalAmount)})`)}
                </span>
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 text-white" />
                <span>
                  {isInspected
                    ? (lang === 'vi'
                        ? `Đặt Cọc Kiểm Định & Nhận VietQR (${formatVND(upfrontAmount)})`
                        : `Inspection Deposit & Get VietQR (${formatVND(upfrontAmount)})`)
                    : (lang === 'vi'
                        ? `Đặt Hàng & Nhận Mã VietQR (${formatVND(totalAmount)})`
                        : `Place Order & Get VietQR Code (${formatVND(totalAmount)})`)}
                </span>
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};
