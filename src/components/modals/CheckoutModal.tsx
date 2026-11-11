import { paths } from '../../app/router/paths';
import { isValidUUID, isSellerOfferId, isOfficialAcceptedNegotiation } from '../../utils/negotiationHelper';
import { negotiationService } from '../../services';
import { Negotiation } from '../../types';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Listing, EscrowOrder, EscrowStatus, Language, UserWallet, ShippingQuoteResponseDto, ShippingRouteErrorDetails, ShippingLeg, InspectionCenter, UserProfile, InspectionProposalPrefillData } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { getBoughtListingIds, markListingAsBought, markListingAsAvailable, reconcileBoughtListingIds, safeJsonParse, resolveInspectionCenter } from '../../utils/orderUtils';
import {
  ArrowLeft,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Package,
  Info,
} from 'lucide-react';
import { orderService, walletService, shippingService, GhnLocation, inspectorService, InspectionQuoteResponse, InspectionTravelTierDto } from '../../services';
import { translateApiError, ApiError } from '../../services/apiClient';
import { LalamoveAddressPicker, getCityCoordinates, normalizeCityKey } from '../common/LalamoveAddressPicker';
import { saveScopedLocalNotification } from '../../utils/notificationStorage';
import { resolveListingCategory, resolveOrderListing } from '../../utils/catalogCache';
import { translateSystemNotification } from '../../utils/systemNotificationTranslator';

export const formatLalamoveVehicle = (serviceType?: string): { name: string; icon: string; desc: string; standard?: string } => {
  if (!serviceType) {
    return {
      name: 'Chưa có thông tin phương tiện',
      icon: '🚚',
      desc: 'Vui lòng kiểm tra phương tiện trong báo giá vận chuyển',
      standard: 'Phương tiện do Lalamove chỉ định',
    };
  }
  const rawCode = serviceType.toUpperCase();
  const code = rawCode.replace(/^LD_/, '');

  if (code === 'MOTORCYCLE' || code === 'BIKE') {
    return {
      name: 'Xe máy',
      icon: '🏍️',
      desc: 'Giao nhanh hàng nhỏ gọn nội thành',
      standard: 'Cân nặng ≤ 30kg • Kích thước ≤ 50x40x50cm',
    };
  }
  if (code === 'VAN_1000' || code === 'VAN1000') {
    return {
      name: 'Xe Van 1 tấn',
      icon: '🚐',
      desc: 'Chở hàng cồng kềnh, tải trọng lớn che chắn mưa nắng',
      standard: 'Cân nặng ≤ 1.000kg • Thùng xe Van 1 tấn',
    };
  }
  if (code === 'VAN' || code === 'VAN500' || code === 'VAN_500' || code.includes('VAN')) {
    return {
      name: 'Xe bán tải / Van',
      icon: '🚐',
      desc: 'Chở hàng cồng kềnh, tải trọng lớn che chắn mưa nắng',
      standard: 'Cân nặng ≤ 500kg • Kích thước ≤ 170x120x120cm',
    };
  }
  if (code === 'PICK_UP_TRUCK' || code === 'PICKUP_TRUCK' || code.includes('PICK_UP') || code.includes('PICKUP')) {
    return {
      name: 'Xe bán tải (Pick-up)',
      icon: '🛻',
      desc: 'Chở hàng cồng kềnh, kiện hàng lớn hoặc vận chuyển đường dài',
      standard: 'Cân nặng ≤ 500kg • Thùng 140x150x50cm',
    };
  }
  if (code === 'TRUCK500' || code === 'TRUCK_500' || code === 'TRUCK_500KG') {
    return {
      name: 'Xe tải 500kg',
      icon: '🚚',
      desc: 'Chở hàng nặng, kích thước lớn an toàn',
      standard: 'Cân nặng ≤ 500kg • Thùng 190x140x140cm',
    };
  }
  if (code === 'TRUCK1000' || code === 'TRUCK_1000' || code === 'TRUCK_1000KG' || code === 'TRUCK_1T') {
    return {
      name: 'Xe tải 1 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
      standard: 'Cân nặng ≤ 1.000kg • Thùng 300x160x160cm',
    };
  }
  if (code === 'TRUCK1500' || code === 'TRUCK_1500' || code === 'TRUCK_1500KG') {
    return {
      name: 'Xe tải 1.5 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
      standard: 'Cân nặng ≤ 1.500kg • Thùng 320x160x170cm',
    };
  }
  if (code === 'TRUCK175' || code === 'TRUCK_175') {
    return {
      name: 'Xe tải 1.75 tấn',
      icon: '🚛',
      desc: 'Xe tải thùng rộng đường dài',
      standard: 'Cân nặng ≤ 1.750kg • Thùng 190x140x140cm',
    };
  }
  if (code === 'TRUCK2000' || code === 'TRUCK_2000' || code === 'TRUCK_2000KG' || code === 'TRUCK_2T') {
    return {
      name: 'Xe tải 2 tấn',
      icon: '🚛',
      desc: 'Xe tải hạng nặng',
      standard: 'Cân nặng ≤ 2.000kg • Thùng 400x170x170cm',
    };
  }
  if (code === 'TRUCK2500' || code === 'TRUCK_2500' || code === 'TRUCK_2500KG') {
    return {
      name: 'Xe tải 2.5 tấn',
      icon: '🚛',
      desc: 'Xe tải hạng nặng',
      standard: 'Cân nặng ≤ 2.500kg • Thùng 420x170x180cm',
    };
  }
  if (code === 'TRUCK330' || code === 'TRUCK_330') {
    return {
      name: 'Xe tải 3.3 tấn',
      icon: '🚛',
      desc: 'Xe tải siêu trường siêu trọng',
      standard: 'Cân nặng ≤ 3.300kg • Thùng 300x160x160cm',
    };
  }
  if (code === 'TRUCK550' || code === 'TRUCK_550') {
    return {
      name: 'Xe tải 5.5 tấn',
      icon: '🚛',
      desc: 'Xe tải siêu trường siêu trọng',
      standard: 'Cân nặng ≤ 5.500kg • Thùng 400x170x170cm',
    };
  }
  return {
    name: serviceType,
    icon: '🚚',
    desc: 'Phương tiện Lalamove do hệ thống tự động báo giá',
    standard: 'Tiêu chuẩn phương tiện Lalamove',
  };
};

export const parseLalamoveVehicleLimits = (text: string) => {
  if (!text) return [];
  const marker = 'Giới hạn từng loại xe tại điểm lấy hàng (dài x rộng x cao):';
  const idx = text.indexOf(marker);
  const rawLimits = idx !== -1 ? text.slice(idx + marker.length).trim() : text;
  const items = rawLimits.split(';').map(s => s.trim()).filter(Boolean);

  return items.map(item => {
    const colonIdx = item.indexOf(':');
    const rawCode = colonIdx !== -1 ? item.slice(0, colonIdx).trim() : item;
    const limitText = colonIdx !== -1 ? item.slice(colonIdx + 1).trim() : '';
    const formatted = formatLalamoveVehicle(rawCode);
    return {
      rawCode,
      name: formatted.name && formatted.name !== rawCode ? formatted.name : rawCode,
      icon: formatted.icon || '🚚',
      limitText: limitText || formatted.standard || '',
    };
  });
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

export interface BuyerDeliveryAddress {
  id: string;
  name: string;
  phone: string;
  email?: string;
  streetAddress: string;
  city?: string;
  latitude: number;
  longitude: number;
  addressType: 'home' | 'office';
  isDefault: boolean;
}

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
  onNavigateToChat?: (listing: Listing, prefillData?: InspectionProposalPrefillData) => void;
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
  onNavigateToChat,
}) => {
  const t = translations[lang];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Negotiation validation state
  const [verifyingNegotiation, setVerifyingNegotiation] = useState<boolean>(Boolean(negotiationId));
  const [negotiationValidation, setNegotiationValidation] = useState<{
    valid: boolean;
    error?: string;
    verifiedNegotiation?: Negotiation | null;
  }>({
    valid: !negotiationId,
  });

  useEffect(() => {
    if (!negotiationId) {
      setNegotiationValidation({ valid: true, verifiedNegotiation: null });
      setVerifyingNegotiation(false);
      return;
    }

    let isMounted = true;
    const verify = async () => {
      setVerifyingNegotiation(true);
      // 1. Format check: Must be UUID and not a fake seller-offer
      if (!isValidUUID(negotiationId) || isSellerOfferId(negotiationId)) {
        if (!isMounted) return;
        setNegotiationValidation({
          valid: false,
          error: lang === "vi"
            ? "Mã thương lượng không hợp lệ. Hệ thống chỉ chấp nhận thương lượng chính thức dạng UUID."
            : "Invalid negotiation ID. Only official UUID negotiations are accepted.",
        });
        setVerifyingNegotiation(false);
        return;
      }

      // 2. Cross-check with Backend to ensure it belongs to this post, this buyer, is ACCEPTED and not expired
      try {
        const verified = await negotiationService.getValidAcceptedNegotiation(listing.id, negotiationId);
        if (!isMounted) return;
        if (!verified) {
          setNegotiationValidation({
            valid: false,
            error: lang === "vi"
              ? "Thương lượng giá này không tồn tại, chưa được người bán chấp nhận hoặc đã hết hạn."
              : "This negotiation is not accepted, does not exist, or has expired.",
          });
        } else {
          setNegotiationValidation({
            valid: true,
            verifiedNegotiation: verified,
          });
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn("[CheckoutModal] Failed to verify negotiation with BE:", err);
        setNegotiationValidation({
          valid: false,
          error: lang === "vi"
            ? "Không thể xác thực thương lượng với máy chủ."
            : "Could not verify negotiation with server.",
        });
      } finally {
        if (isMounted) setVerifyingNegotiation(false);
      }
    };

    verify();
    return () => {
      isMounted = false;
    };
  }, [negotiationId, listing.id, lang]);

  // Price calculations (supports verified negotiated agreedPrice)
  const isNegotiatedCheckout = Boolean(negotiationId && negotiationValidation.valid && negotiationValidation.verifiedNegotiation);
  const itemPrice = isNegotiatedCheckout
    ? negotiationValidation.verifiedNegotiation!.offeredPrice
    : listing.priceVnd;
  const hasAgreedDiscount = isNegotiatedCheckout && itemPrice < listing.priceVnd;
  const discountAmount = hasAgreedDiscount ? listing.priceVnd - itemPrice : 0;
  const validNegotiationId = isNegotiatedCheckout ? negotiationValidation.verifiedNegotiation!.id : undefined;

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

  // Buyer Form Information (Shopee-style Address Book)
  const sellerCityInfo = getCityCoordinates(listing.sellerAddress || listing.location);
  const addressStorageKey = currentUser?.id ? `secondlife_buyer_addresses_${currentUser.id}` : 'secondlife_buyer_addresses_guest';

  // Saved Addresses list (Shopee-style)
  const [savedAddresses, setSavedAddresses] = useState<BuyerDeliveryAddress[]>(() => {
    try {
      const raw = localStorage.getItem(addressStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }

    const profileAddress = (currentUser?.address || currentUser?.streetAddress || '').trim();
    if (profileAddress) {
      const defaultAddr: BuyerDeliveryAddress = {
        id: `addr-${Date.now()}`,
        name: currentUser?.name || 'Khách Hàng',
        phone: currentUser?.phone || '',
        email: currentUser?.email || '',
        streetAddress: profileAddress,
        city: sellerCityInfo.name,
        latitude: (typeof currentUser?.latitude === 'number' && currentUser.latitude !== 0) ? currentUser.latitude : sellerCityInfo.lat,
        longitude: (typeof currentUser?.longitude === 'number' && currentUser.longitude !== 0) ? currentUser.longitude : sellerCityInfo.lng,
        addressType: 'home',
        isDefault: true,
      };
      try {
        localStorage.setItem(addressStorageKey, JSON.stringify([defaultAddr]));
      } catch { }
      return [defaultAddr];
    }
    return [];
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    return savedAddresses.find((a) => a.isDefault)?.id || savedAddresses[0]?.id || null;
  });

  const activeAddress = useMemo(() => {
    return savedAddresses.find((a) => a.id === selectedAddressId) || savedAddresses[0] || null;
  }, [savedAddresses, selectedAddressId]);

  const [buyerName, setBuyerName] = useState(activeAddress?.name || currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(activeAddress?.phone || currentUser?.phone || '');
  const [buyerEmail, setBuyerEmail] = useState(activeAddress?.email || currentUser?.email || '');
  const [streetAddress, setStreetAddress] = useState(activeAddress?.streetAddress || currentUser?.address || currentUser?.streetAddress || '');
  const [deliveryLatitude, setDeliveryLatitude] = useState<number>(activeAddress?.latitude ?? (typeof currentUser?.latitude === 'number' ? currentUser.latitude : sellerCityInfo.lat));
  const [deliveryLongitude, setDeliveryLongitude] = useState<number>(activeAddress?.longitude ?? (typeof currentUser?.longitude === 'number' ? currentUser.longitude : sellerCityInfo.lng));
  const [addressType, setAddressType] = useState<'home' | 'office'>(activeAddress?.addressType || 'home');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(Boolean(activeAddress?.latitude && activeAddress?.longitude));
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Shopee Address Modals State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<BuyerDeliveryAddress | null>(null);

  // Address form temporary state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formLat, setFormLat] = useState<number>(sellerCityInfo.lat);
  const [formLng, setFormLng] = useState<number>(sellerCityInfo.lng);
  const [formType, setFormType] = useState<'home' | 'office'>('home');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);

  // Sync active address changes with checkout form
  useEffect(() => {
    if (activeAddress) {
      setBuyerName(activeAddress.name);
      setBuyerPhone(activeAddress.phone);
      if (activeAddress.email) setBuyerEmail(activeAddress.email);
      setStreetAddress(activeAddress.streetAddress);
      setDeliveryLatitude(activeAddress.latitude);
      setDeliveryLongitude(activeAddress.longitude);
      setAddressType(activeAddress.addressType);
      setIsLocationConfirmed(Boolean(activeAddress.latitude && activeAddress.longitude));
      if (activeAddress.city) setSelectedProvinceName(activeAddress.city);
    }
  }, [activeAddress?.id]);

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setFormName(currentUser?.name || buyerName || '');
    setFormPhone(currentUser?.phone || buyerPhone || '');
    setFormEmail(currentUser?.email || buyerEmail || '');
    setFormStreet('');
    setFormCity(sellerCityInfo.name);
    setFormLat(sellerCityInfo.lat);
    setFormLng(sellerCityInfo.lng);
    setFormType('home');
    setFormIsDefault(savedAddresses.length === 0);
    setFormErrorMsg(null);
    setIsAddressFormOpen(true);
  };

  const handleOpenEditAddress = (addr: BuyerDeliveryAddress) => {
    setEditingAddress(addr);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormEmail(addr.email || '');
    setFormStreet(addr.streetAddress);
    setFormCity(addr.city || sellerCityInfo.name);
    setFormLat(addr.latitude);
    setFormLng(addr.longitude);
    setFormType(addr.addressType);
    setFormIsDefault(addr.isDefault);
    setFormErrorMsg(null);
    setIsAddressFormOpen(true);
  };

  const handleSaveAddressForm = () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormErrorMsg(lang === 'vi' ? 'Vui lòng nhập họ tên người nhận' : 'Recipient name is required');
      return;
    }
    const cleanPhone = formPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
      setFormErrorMsg(lang === 'vi' ? 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0' : 'Phone must be exactly 10 digits starting with 0');
      return;
    }
    const trimmedStreet = formStreet.trim();
    if (!trimmedStreet || !formLat || !formLng) {
      setFormErrorMsg(lang === 'vi' ? 'Vui lòng chọn địa chỉ và bấm xác nhận vị trí trên bản đồ Lalamove' : 'Please pick and confirm delivery address on map');
      return;
    }
    const cityKey = normalizeCityKey(formCity || trimmedStreet);
    if (cityKey === 'OTHER') {
      setFormErrorMsg(
        lang === 'vi'
          ? 'Hệ thống hiện chỉ hỗ trợ giao hàng tại khu vực Hà Nội và TP. Hồ Chí Minh (kèm các khu vực lân cận được Lalamove hỗ trợ: Bắc Ninh, Hải Phòng, Hưng Yên, Ninh Bình, Đồng Nai, Bình Dương, Vũng Tàu). Vui lòng chọn địa chỉ trong khu vực hỗ trợ.'
          : 'Service is currently only available in Hanoi and Ho Chi Minh City (& nearby regions).'
      );
      return;
    }

    let updatedList: BuyerDeliveryAddress[] = [];
    if (editingAddress) {
      updatedList = savedAddresses.map((a) => {
        if (a.id === editingAddress.id) {
          return {
            ...a,
            name: trimmedName,
            phone: cleanPhone,
            email: formEmail.trim() || undefined,
            streetAddress: trimmedStreet,
            city: formCity,
            latitude: formLat,
            longitude: formLng,
            addressType: formType,
            isDefault: formIsDefault,
          };
        }
        return formIsDefault ? { ...a, isDefault: false } : a;
      });
      setSelectedAddressId(editingAddress.id);
    } else {
      const newAddr: BuyerDeliveryAddress = {
        id: `addr-${Date.now()}`,
        name: trimmedName,
        phone: cleanPhone,
        email: formEmail.trim() || undefined,
        streetAddress: trimmedStreet,
        city: formCity,
        latitude: formLat,
        longitude: formLng,
        addressType: formType,
        isDefault: formIsDefault || savedAddresses.length === 0,
      };
      if (newAddr.isDefault) {
        updatedList = [newAddr, ...savedAddresses.map((a) => ({ ...a, isDefault: false }))];
      } else {
        updatedList = [...savedAddresses, newAddr];
      }
      setSelectedAddressId(newAddr.id);
    }

    setSavedAddresses(updatedList);
    try {
      localStorage.setItem(addressStorageKey, JSON.stringify(updatedList));
    } catch { }

    setIsAddressFormOpen(false);
    setIsAddressModalOpen(false);
    setFormErrorMsg(null);
  };

  const handleDeleteAddress = (idToDelete: string) => {
    if (savedAddresses.length <= 1) return;
    const remaining = savedAddresses.filter((a) => a.id !== idToDelete);
    if (!remaining.some((a) => a.isDefault)) {
      remaining[0].isDefault = true;
    }
    setSavedAddresses(remaining);
    try {
      localStorage.setItem(addressStorageKey, JSON.stringify(remaining));
    } catch { }
    if (selectedAddressId === idToDelete) {
      setSelectedAddressId(remaining[0].id);
    }
  };
  const quoteDebounceTimerRef = useRef<any>(null);

  // Delivery & Protection Option: 'INSPECTION' (Verify Then Ship) or 'DIRECT' (Direct Door-to-Door)
  const [deliveryOption, setDeliveryOption] = useState<'INSPECTION' | 'DIRECT'>(
    listing.requiresInspection ? 'INSPECTION' : 'DIRECT'
  );

  // Confirmation of disassembly and voiding of original "zin" condition
  const [agreedZinLoss, setAgreedZinLoss] = useState(false);

  // Inspection Center, Method & Fee Splitting States
  const [inspectionCenters, setInspectionCenters] = useState<InspectionCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState<boolean>(false);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [inspectionMethod, setInspectionMethod] = useState<'AT_CENTER' | 'AT_HOME'>('AT_CENTER');
  const [feeSplit, setFeeSplit] = useState<'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100'>('BUYER_100');

  // Load Inspection Centers / Hubs from API
  useEffect(() => {
    let isMounted = true;
    const fetchCenters = async () => {
      try {
        setLoadingCenters(true);
        const hubs = await inspectorService.getInspectionCenters();
        if (isMounted && hubs && hubs.length > 0) {
          setInspectionCenters(hubs);
          // If current selectedCenterId is not in new list, pick the first one
          setSelectedCenterId((prev) => {
            if (hubs.some((h) => h.id === prev)) return prev;
            return hubs[0].id;
          });
        }
      } catch (err) {
        console.warn('Failed to load inspection centers:', err);
      } finally {
        if (isMounted) setLoadingCenters(false);
      }
    };
    fetchCenters();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto suggest/select inspection center based on buyer province
  useEffect(() => {
    if (!selectedProvinceName || inspectionCenters.length === 0) return;
    const provLower = selectedProvinceName.toLowerCase();
    if (provLower.includes('hà nội') || provLower.includes('ha noi')) {
      const hn = inspectionCenters.find((c) => c.id.includes('hn') || c.city.toLowerCase().includes('hà nội'));
      if (hn) setSelectedCenterId(hn.id);
    } else if (
      provLower.includes('đà nẵng') ||
      provLower.includes('da nang') ||
      provLower.includes('huế') ||
      provLower.includes('quảng')
    ) {
      const dn = inspectionCenters.find((c) => c.id.includes('dn') || c.city.toLowerCase().includes('đà nẵng'));
      if (dn) setSelectedCenterId(dn.id);
    } else if (
      provLower.includes('hồ chí minh') ||
      provLower.includes('ho chi minh') ||
      provLower.includes('sài gòn') ||
      provLower.includes('bình dương') ||
      provLower.includes('đồng nai')
    ) {
      const hcm = inspectionCenters.find((c) => c.id.includes('hcm') || c.city.toLowerCase().includes('hồ chí minh'));
      if (hcm) setSelectedCenterId(hcm.id);
    }
  }, [selectedProvinceName, inspectionCenters]);

  // Lalamove Shipping Quote State
  const [ghnQuote, setGhnQuote] = useState<ShippingQuoteResponseDto | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteErrorCode, setQuoteErrorCode] = useState<string | null>(null);
  const [quoteErrorStatus, setQuoteErrorStatus] = useState<number | null>(null);
  const [quoteErrorDetails, setQuoteErrorDetails] = useState<ShippingRouteErrorDetails | null>(null);
  const [showVehicleLimits, setShowVehicleLimits] = useState(false);

  // References for request cancellation, sequence tracking, and in-flight quote deduplication
  const quoteRequestIdRef = useRef<number>(0);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);
  const inFlightQuotePromiseRef = useRef<Promise<ShippingQuoteResponseDto | null> | null>(null);
  const inFlightQuoteKeyRef = useRef<string>('');
  const cachedQuoteKeyRef = useRef<string>('');
  const cachedQuoteRef = useRef<ShippingQuoteResponseDto | null>(null);
  const isInitialListingNegotiationMount = useRef<boolean>(true);

  const inspectionQuoteRequestIdRef = useRef<number>(0);
  const officialInspectionQuote = useRef<{
    quote: InspectionQuoteResponse;
    centerId?: string;
    method: 'AT_CENTER' | 'AT_HOME';
    buyerLatitude: number;
    buyerLongitude: number;
    negotiationId?: string;
  } | null>(null);
  const inspectionQuoteAbortControllerRef = useRef<AbortController | null>(null);

  // Cleanup in-flight requests on modal unmount (React Strict Mode safe)
  useEffect(() => {
    return () => {
      if (quoteAbortControllerRef.current) {
        quoteAbortControllerRef.current.abort();
        quoteAbortControllerRef.current = null;
      }
      if (inspectionQuoteAbortControllerRef.current) {
        inspectionQuoteAbortControllerRef.current.abort();
        inspectionQuoteAbortControllerRef.current = null;
      }
      inFlightQuotePromiseRef.current = null;
    };
  }, []);

  // Invalidate quote ONLY when listing.id or negotiationId changes on subsequent updates (skip initial mount)
  useEffect(() => {
    if (isInitialListingNegotiationMount.current) {
      isInitialListingNegotiationMount.current = false;
      return;
    }
    if (quoteAbortControllerRef.current) {
      quoteAbortControllerRef.current.abort();
      quoteAbortControllerRef.current = null;
    }
    if (inspectionQuoteAbortControllerRef.current) {
      inspectionQuoteAbortControllerRef.current.abort();
      inspectionQuoteAbortControllerRef.current = null;
    }
    quoteRequestIdRef.current += 1;
    inspectionQuoteRequestIdRef.current += 1;
    setGhnQuote(null);
    setQuoteLoading(false);
    setQuoteError(null);
    setQuoteErrorCode(null);
    setQuoteErrorStatus(null);
    setQuoteErrorDetails(null);
    setInspectionQuote(null);
    cachedQuoteKeyRef.current = '';
    cachedQuoteRef.current = null;
    inFlightQuotePromiseRef.current = null;
  }, [listing.id, negotiationId]);

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

  interface FetchQuoteOptions {
    lat?: number;
    lng?: number;
    addr?: string;
    name?: string;
    phone?: string;
    forceRefresh?: boolean;
  }

  // Unified Quote Manager: Handles auto-fetch, manual retry, and order checkout with promise deduplication
  const getOrFetchQuote = useCallback(async (opts?: FetchQuoteOptions): Promise<ShippingQuoteResponseDto | null> => {
    const currentLat = opts?.lat ?? deliveryLatitude;
    const currentLng = opts?.lng ?? deliveryLongitude;

    // 1. Kiểm tra tọa độ GPS
    if (!currentLat || !currentLng || isNaN(currentLat) || isNaN(currentLng)) {
      setGhnQuote(null);
      setQuoteLoading(false);
      return null;
    }

    // 2. Kiểm tra khu vực được hỗ trợ (Hà Nội, TP.HCM & các tỉnh lân cận)
    const currentAddr = (opts?.addr || streetAddress || activeAddress?.streetAddress || '').trim();
    const cityToCheck = activeAddress?.city || selectedProvinceName || currentAddr;
    const regionKey = normalizeCityKey(cityToCheck);
    if (regionKey === 'OTHER') {
      setGhnQuote(null);
      setQuoteLoading(false);
      setQuoteError(
        lang === 'vi'
          ? 'Hệ thống hiện chỉ hỗ trợ giao hàng tại khu vực Hà Nội và TP. Hồ Chí Minh (kèm các khu vực lân cận: Bắc Ninh, Hải Phòng, Hưng Yên, Ninh Bình, Đồng Nai, Bình Dương, Vũng Tàu). Vui lòng đổi địa chỉ trong khu vực hỗ trợ.'
          : 'Service is currently only available in Hanoi and Ho Chi Minh City (& nearby regions).'
      );
      setQuoteErrorCode('UNSUPPORTED_REGION');
      return null;
    }

    // 3. Kiểm tra tính hợp lệ của thương lượng (nếu có)
    if (negotiationId && verifyingNegotiation) {
      // Đang chờ xác thực thương lượng với BE
      return null;
    }
    if (negotiationId && !negotiationValidation.valid) {
      setGhnQuote(null);
      setQuoteLoading(false);
      if (negotiationValidation.error) {
        setQuoteError(negotiationValidation.error);
      }
      return null;
    }

    const rawPhone = (opts?.phone || buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
    const validPhone = rawPhone.length >= 9 && rawPhone.length <= 15 ? rawPhone : '0912345678';
    const validName = (opts?.name || buyerName || currentUser?.name || 'Khách Hàng').trim() || 'Khách Hàng';
    const negIdToUse = validNegotiationId;

    // Khóa định danh request theo thông số thực tế
    const targetKey = `${listing.id}|${negIdToUse || ''}|${currentLat.toFixed(5)}|${currentLng.toFixed(5)}|${validPhone}|${validName}`;

    // 4. Nếu không yêu cầu ép tải lại (forceRefresh: false)
    if (!opts?.forceRefresh) {
      // 4a. Nếu đã có báo giá hợp lệ trong state cho đúng targetKey và chưa hết hạn: dùng lại ngay
      const currentCachedQuote = cachedQuoteRef.current || ghnQuote;
      if (currentCachedQuote && currentCachedQuote.quoteId && cachedQuoteKeyRef.current === targetKey) {
        const isExpired = currentCachedQuote.expiresAt ? new Date(currentCachedQuote.expiresAt).getTime() <= Date.now() : false;
        if (!isExpired) {
          setQuoteLoading(false);
          return currentCachedQuote;
        }
      }

      // 4b. Nếu cùng một báo giá đang được tải trong in-flight promise: chờ chung request đó
      if (inFlightQuotePromiseRef.current && inFlightQuoteKeyRef.current === targetKey) {
        return inFlightQuotePromiseRef.current;
      }
    }

    // 5. Khởi tạo request lấy báo giá mới
    if (quoteAbortControllerRef.current) {
      quoteAbortControllerRef.current.abort();
    }
    const requestId = ++quoteRequestIdRef.current;
    const controller = new AbortController();
    quoteAbortControllerRef.current = controller;
    inFlightQuoteKeyRef.current = targetKey;

    setGhnQuote(null);
    cachedQuoteRef.current = null;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteErrorCode(null);
    setQuoteErrorStatus(null);
    setQuoteErrorDetails(null);

    const quotePromise = (async (): Promise<ShippingQuoteResponseDto | null> => {
      let timeoutId: any = null;
      try {
        timeoutId = setTimeout(() => {
          controller.abort('TIMEOUT');
        }, 15000);

        const quote = await shippingService.getShippingQuote({
          postId: listing.id,
          ...(negIdToUse ? { negotiationId: negIdToUse } : {}),
          deliveryAddress: {
            name: validName,
            phone: validPhone,
            latitude: currentLat,
            longitude: currentLng,
            address: currentAddr || undefined,
          },
        }, { signal: controller.signal });

        if (requestId !== quoteRequestIdRef.current) {
          return null;
        }

        setGhnQuote(quote);
        cachedQuoteRef.current = quote;
        cachedQuoteKeyRef.current = targetKey;
        setQuoteError(null);
        setQuoteErrorCode(null);
        setQuoteErrorStatus(null);
        setQuoteErrorDetails(null);
        return quote;
      } catch (err: any) {
        const isTimeout =
          controller.signal.aborted &&
          (controller.signal.reason === 'TIMEOUT' ||
            err?.message === 'TIMEOUT' ||
            err?.name === 'TimeoutError' ||
            (typeof err === 'string' && err.includes('TIMEOUT')));

        if (!isTimeout && (err?.name === 'AbortError' || controller.signal.aborted || requestId !== quoteRequestIdRef.current)) {
          return null;
        }

        console.warn('Failed to calculate Lalamove quote:', err);
        if (requestId === quoteRequestIdRef.current) {
          setGhnQuote(null);
          cachedQuoteRef.current = null;
          cachedQuoteKeyRef.current = '';

          if (isTimeout) {
            setQuoteErrorStatus(504);
            setQuoteErrorCode('TIMEOUT');
            setQuoteErrorDetails(null);
            setQuoteError(
              lang === 'vi'
                ? 'Kết nối đến hệ thống Lalamove quá thời gian quy định (Timeout). Hệ thống đang thử nghiệm nhiều loại xe (Xe máy, Bán tải, Xe tải) cho kiện hàng nhưng máy chủ phản hồi chậm. Vui lòng bấm "Thử lại" hoặc đổi địa chỉ nhận hàng.'
                : 'Lalamove quote request timed out. Please click "Retry" or verify delivery address.'
            );
          } else {
            const status = typeof err?.status === 'number' ? err.status : undefined;
            const code = err?.code || (err as any)?.response?.data?.code;
            const details = err?.details || (err as any)?.response?.data?.details;
            let rawMsg = (err as any)?.response?.data?.message || err?.message || 'Không thể tính phí vận chuyển Lalamove.';

            setQuoteErrorStatus(status ?? null);
            setQuoteErrorCode(code ?? null);
            setQuoteErrorDetails(details ?? null);

            let errMsg = rawMsg;
            if (status === 422 && code === 'NO_SUITABLE_VEHICLE_FOR_ROUTE') {
              errMsg = rawMsg;
            } else if (status === 429 || rawMsg.includes('ERR_RATE_LIMIT_EXCEEDED')) {
              errMsg = 'Hệ thống Lalamove đang bận xử lý nhiều báo giá. Vui lòng chờ 2-3 giây rồi bấm thử lại.';
            } else if (status === 504) {
              errMsg = 'Hệ thống Lalamove phản hồi quá thời gian quy định (Timeout). Vui lòng thử lại sau giây lát.';
            } else if (status === 502 || status === 503) {
              errMsg = 'Dịch vụ Lalamove hiện đang gián đoạn kết nối hoặc đang bảo trì. Vui lòng thử lại sau.';
            } else if (typeof rawMsg === 'string') {
              if (rawMsg.includes('Seller pickup address is not configured')) {
                errMsg = 'Người bán chưa cấu hình địa chỉ kho lấy hàng Lalamove. Không thể tạo đơn hàng.';
              } else if (rawMsg.includes('Seller must save the packed weight and dimensions') || rawMsg.includes('Shipping weight is required')) {
                errMsg = 'Người bán chưa cấu hình kích thước và trọng lượng kiện hàng. Không thể tính phí vận chuyển Lalamove. Vui lòng liên hệ người bán cập nhật bài đăng.';
              } else if (
                rawMsg.includes('Shipping supports packages up to 50 kg and 200 cm') ||
                rawMsg.toLowerCase().includes('up to 50 kg and 200 cm')
              ) {
                errMsg = 'Dịch vụ vận chuyển chỉ hỗ trợ kiện hàng tối đa 50 kg và kích thước mỗi chiều không quá 200 cm (2 mét).';
              } else if (rawMsg.includes('You cannot buy your own post')) {
                errMsg = 'Bạn đang đăng nhập bằng tài khoản người bán. Không thể tạo báo giá mua bài đăng của chính mình.';
              } else if (rawMsg.includes('Post is not available')) {
                errMsg = 'Bài đăng hiện không ở trạng thái sẵn sàng để giao dịch.';
              } else if (rawMsg.includes('Không có loại xe Lalamove đủ tải trọng') || rawMsg.includes('Giới hạn từng loại xe')) {
                errMsg = rawMsg;
              } else {
                errMsg = translateApiError(rawMsg);
              }
            }
            setQuoteError(errMsg);
          }
        }
        return null;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (requestId === quoteRequestIdRef.current) {
          setQuoteLoading(false);
          inFlightQuotePromiseRef.current = null;
        }
      }
    })();

    inFlightQuotePromiseRef.current = quotePromise;
    return quotePromise;
  }, [
    deliveryLatitude,
    deliveryLongitude,
    streetAddress,
    buyerName,
    buyerPhone,
    currentUser,
    listing.id,
    negotiationId,
    verifyingNegotiation,
    negotiationValidation,
    validNegotiationId,
    activeAddress,
    selectedProvinceName,
    lang,
  ]);

  // Public quote calculation interface (Manual retry buttons force fresh quote)
  const calculateLalamoveQuote = useCallback(async (
    lat?: number,
    lng?: number,
    addr?: string,
    name?: string,
    phone?: string
  ) => {
    return getOrFetchQuote({
      lat,
      lng,
      addr,
      name,
      phone,
      forceRefresh: true,
    });
  }, [getOrFetchQuote]);

  const calculateGhnQuote = calculateLalamoveQuote;

  // Stable primitives to prevent unnecessary re-quotes caused by render re-renders
  const stableDeliveryLat = deliveryLatitude ? Number(deliveryLatitude.toFixed(5)) : 0;
  const stableDeliveryLng = deliveryLongitude ? Number(deliveryLongitude.toFixed(5)) : 0;
  const isNegotiationSettled = !negotiationId || !verifyingNegotiation;

  // Auto-fetch quote when modal opens with valid default address or when coordinates/negotiation settle
  useEffect(() => {
    if (deliveryOption === 'INSPECTION') return;
    if (!isNegotiationSettled) return;

    if (negotiationId && !negotiationValidation.valid) {
      if (negotiationValidation.error) {
        setQuoteError(negotiationValidation.error);
      }
      setQuoteLoading(false);
      return;
    }

    if (!stableDeliveryLat || !stableDeliveryLng) {
      setGhnQuote(null);
      cachedQuoteRef.current = null;
      setQuoteLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      getOrFetchQuote({
        lat: stableDeliveryLat,
        lng: stableDeliveryLng,
        addr: streetAddress,
        name: buyerName,
        phone: buyerPhone,
        forceRefresh: false,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [
    listing.id,
    stableDeliveryLat,
    stableDeliveryLng,
    negotiationId,
    isNegotiationSettled,
    negotiationValidation.valid,
    validNegotiationId,
    deliveryOption,
    streetAddress,
    buyerName,
    buyerPhone,
    getOrFetchQuote,
  ]);

  // Fetch Live Inspection Quote from Backend API (POST /api/v1/inspection/quote)
  const [inspectionQuoteError, setInspectionQuoteError] = useState<string | null>(null);
  const [inspectionQuoteErrorCode, setInspectionQuoteErrorCode] = useState<string | null>(null);
  const [inspectionQuoteErrorStatus, setInspectionQuoteErrorStatus] = useState<number | null>(null);

  const isValidUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const selectedCenter = inspectionCenters.find((c) => c.id === selectedCenterId) || inspectionCenters[0] || resolveInspectionCenter();

  const formatLalamoveServiceType = (st?: string) => {
    if (!st) return 'Lalamove';
    switch (st.toUpperCase()) {
      case 'MOTORCYCLE': return 'Xe máy';
      case 'VAN': return 'Xe bán tải';
      case 'TRUCK': return 'Xe tải';
      case 'SEDAN':
      case 'CAR': return 'Ô tô';
      default: return st;
    }
  };

  const fetchInspectionQuote = useCallback(async (lat?: number, lng?: number, centerId?: string) => {
    if (!listing.id) return;

    if (inspectionQuoteAbortControllerRef.current) {
      inspectionQuoteAbortControllerRef.current.abort();
    }
    const requestId = ++inspectionQuoteRequestIdRef.current;
    officialInspectionQuote.current = null;
    const controller = new AbortController();
    inspectionQuoteAbortControllerRef.current = controller;

    setLoadingInspectionQuote(true);
    setInspectionQuoteError(null);
    setInspectionQuoteErrorCode(null);
    setInspectionQuoteErrorStatus(null);
    try {
      const targetCenterId = isValidUuid(centerId) ? centerId : (isValidUuid(selectedCenterId) ? selectedCenterId : undefined);
      const buyerLatitude = lat ?? deliveryLatitude;
      const buyerLongitude = lng ?? deliveryLongitude;
      const q = await inspectorService.getQuote({
        postId: listing.id,
        buyerLatitude,
        buyerLongitude,
        inspectionCenterId: targetCenterId,
        orderType: inspectionMethod || 'AT_CENTER',
        negotiationId: validNegotiationId,
      }, { signal: controller.signal });

      if (requestId !== inspectionQuoteRequestIdRef.current) return;

      if (q) {
        officialInspectionQuote.current = {
          quote: q, centerId: targetCenterId, method: inspectionMethod,
          buyerLatitude, buyerLongitude, negotiationId: validNegotiationId,
        };
        setInspectionQuote(q);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || requestId !== inspectionQuoteRequestIdRef.current) {
        return;
      }
      console.warn('Could not fetch inspection quote:', err);

      // Fallback: Nếu BE chưa có checklist được duyệt cho loại sản phẩm (409) hoặc lỗi định giá,
      // gọi trực tiếp Lalamove tính cước từ người bán tới Trung tâm kiểm định để không để 0 đ
      const activeCenter = inspectionCenters.find((c) => c.id === (centerId || selectedCenterId)) || selectedCenter;
      if (inspectionMethod === 'AT_CENTER' && activeCenter && activeCenter.latitude && activeCenter.longitude) {
        try {
          const centerShipping = await shippingService.getShippingQuote({
            postId: listing.id,
            deliveryAddress: {
              address: activeCenter.address,
              latitude: activeCenter.latitude,
              longitude: activeCenter.longitude,
              name: activeCenter.name,
              phone: activeCenter.phone || '0875456654',
            }
          }, { signal: controller.signal });

          if (requestId === inspectionQuoteRequestIdRef.current && centerShipping?.shippingFee) {
            const outboundFee = Number(centerShipping.shippingFee);
            const returnFee = Math.round(outboundFee * 1.15);
            const baseFee = 200000;
            const total = baseFee + outboundFee + returnFee;
            setInspectionQuote({
              postId: listing.id,
              baseInspectionFee: baseFee,
              baseFee,
              shippingToCenterFee: outboundFee,
              returnShippingReserveFee: returnFee,
              atCenterTotalFee: total,
              atCenterSplitOptions: {
                BUYER_PAYS: total,
                SELLER_PAYS: total,
                SPLIT_50_50: Math.round(total / 2),
              },
              atCenterPackage: {
                shippingToCenterFee: outboundFee,
                returnReserveFee: returnFee,
                totalFee: total,
                suggestedSplit50: Math.round(total / 2),
              },
              shippingQuote: {
                id: centerShipping.quoteId,
                inspectionCenterId: centerId || selectedCenterId || activeCenter.id,
                expiresAt: centerShipping.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                outbound: {
                  leg: 'SELLER_TO_CENTER',
                  provider: 'LALAMOVE',
                  shippingFee: outboundFee,
                  serviceType: centerShipping.serviceType,
                  providerQuotationId: centerShipping.providerQuotationId,
                  expiresAt: centerShipping.expiresAt,
                  vehicleSelection: centerShipping.vehicleSelection,
                },
                returnReserve: {
                  leg: 'CENTER_TO_SELLER',
                  provider: 'LALAMOVE',
                  shippingFee: returnFee,
                  serviceType: centerShipping.serviceType,
                  providerQuotationId: undefined,
                  expiresAt: centerShipping.expiresAt,
                  vehicleSelection: undefined,
                }
              }
            } as any);
            setInspectionQuoteError(null);
            return;
          }
        } catch (centerShipErr) {
          console.warn('Fallback center shipping quote failed:', centerShipErr);
        }
      }

      setInspectionQuote(null);

      const status = typeof err?.status === 'number' ? err.status : undefined;
      const code = err?.code || (err as any)?.response?.data?.code;
      setInspectionQuoteErrorStatus(status ?? null);
      setInspectionQuoteErrorCode(code ?? null);

      if (status === 422 || code === 'NO_SUITABLE_VEHICLE_FOR_ROUTE') {
        setInspectionQuoteError(
          err?.message || (lang === 'vi'
            ? 'Tuyến vận chuyển từ người bán đến trung tâm kiểm định không có xe Lalamove phù hợp kích thước/khối lượng kiện hàng. Vui lòng chọn trung tâm khác hoặc phương thức Kiểm định tại nhà.'
            : 'No suitable Lalamove vehicle for this route. Please choose another center or on-site inspection.')
        );
      } else if (status === 429) {
        setInspectionQuoteError(
          lang === 'vi'
            ? 'Hệ thống định giá Lalamove đang bận xử lý (quá giới hạn tần suất). Vui lòng thử lại sau giây lát.'
            : 'Lalamove rate limit reached. Please try again shortly.'
        );
      } else if (status === 409) {
        setInspectionQuoteError(
          err?.message || (lang === 'vi'
            ? 'Báo giá hoặc tiêu chuẩn kiểm định đã có cập nhật mới. Vui lòng tải lại báo giá.'
            : 'Inspection pricing or criteria changed. Please refresh quote.')
        );
      } else if (status && status >= 500) {
        setInspectionQuoteError(
          lang === 'vi'
            ? 'Hệ thống Lalamove hoặc máy chủ định giá tạm thời gián đoạn (502/503/504). Vui lòng thử lại sau.'
            : 'Carrier integration temporarily unavailable. Please retry shortly.'
        );
      } else {
        setInspectionQuoteError(err?.message || (lang === 'vi' ? 'Chưa thể lấy báo giá kiểm định cho sản phẩm này.' : 'Failed to get inspection quote.'));
      }
    } finally {
      if (requestId === inspectionQuoteRequestIdRef.current) {
        setLoadingInspectionQuote(false);
      }
    }
  }, [listing.id, deliveryLatitude, deliveryLongitude, selectedCenterId, inspectionMethod, inspectionCenters, selectedCenter, lang, validNegotiationId]);

  useEffect(() => {
    if (deliveryOption === 'INSPECTION') {
      fetchInspectionQuote(deliveryLatitude, deliveryLongitude, selectedCenterId);
    }
  }, [deliveryOption, deliveryLatitude, deliveryLongitude, selectedCenterId, inspectionMethod, fetchInspectionQuote]);

  // Inspection fee & split calculations
  const isInspected = deliveryOption === 'INSPECTION';
  const isAtCenterInspection = isInspected && inspectionMethod === 'AT_CENTER';

  const atHomeFee = inspectionQuote?.atHomePackage?.totalFee
    ?? inspectionQuote?.atHomeTotalFee
    ?? 0;
  const atCenterFee = inspectionQuote?.atCenterPackage?.totalFee
    ?? inspectionQuote?.atCenterTotalFee
    ?? 0;

  const atCenterBaseFee = Number(inspectionQuote?.baseInspectionFee || inspectionQuote?.baseFee || 0);
  const atCenterOutboundFee = Number(
    inspectionQuote?.shippingQuote?.outbound?.shippingFee
    ?? inspectionQuote?.shippingToCenterFee
    ?? inspectionQuote?.atCenterPackage?.shippingToCenterFee
    ?? 0
  );
  const atCenterReturnFee = Number(
    inspectionQuote?.shippingQuote?.returnReserve?.shippingFee
    ?? inspectionQuote?.returnShippingReserveFee
    ?? inspectionQuote?.atCenterPackage?.returnReserveFee
    ?? 0
  );
  const atCenterShippingQuote = inspectionQuote?.shippingQuote;
  const isAtCenterQuoteExpired = atCenterShippingQuote?.expiresAt
    ? new Date(atCenterShippingQuote.expiresAt).getTime() <= Date.now()
    : false;

  const baseInspectionFee = isInspected ? (inspectionMethod === 'AT_HOME' ? atHomeFee : atCenterFee) : 0;
  const buyerInspectionFee = isInspected
    ? feeSplit === 'BUYER_100'
      ? baseInspectionFee
      : feeSplit === 'SPLIT_50_50'
        ? ((inspectionMethod === 'AT_HOME' ? inspectionQuote?.atHomeSplitOptions : inspectionQuote?.atCenterSplitOptions)?.SPLIT_50_50
          ?? Math.round(baseInspectionFee / 2))
        : 0
    : 0;
  const sellerInspectionFee = isInspected ? baseInspectionFee - buyerInspectionFee : 0;

  // Financial values
  const shippingFee = (isLocationConfirmed && ghnQuote && !quoteError) ? Number(ghnQuote.shippingFee) : 0;
  const productPrice = ghnQuote ? Number(ghnQuote.productPrice) : itemPrice;
  const totalAmount = productPrice + shippingFee + buyerInspectionFee;
  // Khi mua có kiểm định: CHỈ trả trước phần phí kiểm định (hoặc phần buyer chịu); Tiền sản phẩm trả ở Giai đoạn 2 sau khi kiểm định ĐẠT
  const upfrontAmount = isInspected ? buyerInspectionFee : totalAmount;
  const stage2ProductAmount = isInspected ? productPrice : 0;

  const handleNavigateToChat = useCallback(() => {
    const savedQuote = officialInspectionQuote.current;
    const prefillData: InspectionProposalPrefillData = {
      postId: listing.id,
      buyerLatitude: deliveryLatitude,
      buyerLongitude: deliveryLongitude,
      negotiationId: validNegotiationId,
      agreedPrice: validNegotiationId ? itemPrice : undefined,
      centerId: selectedCenterId,
      centerName: selectedCenter?.name,
      centerAddress: selectedCenter?.address || undefined,
      centerPhone: selectedCenter?.phone || undefined,
      inspectionMethod,
      feeSplit,
      feePayer: feeSplit === 'BUYER_100' ? 'BUYER_PAYS' : feeSplit === 'SELLER_100' ? 'SELLER_PAYS' : 'SPLIT_50_50',
      isZinLossAcknowledged: agreedZinLoss,
      quote: savedQuote && savedQuote.quote === inspectionQuote && savedQuote.centerId === selectedCenterId &&
        savedQuote.method === inspectionMethod && savedQuote.buyerLatitude === deliveryLatitude &&
        savedQuote.buyerLongitude === deliveryLongitude && savedQuote.negotiationId === validNegotiationId
        ? savedQuote.quote : null,
      baseInspectionFee: atCenterBaseFee,
      shippingToCenterFee: atCenterOutboundFee,
      returnShippingReserveFee: atCenterReturnFee,
      totalAtCenterFee: atCenterFee,
      totalAtHomeFee: atHomeFee,
      buyerInspectionFee,
      sellerInspectionFee,
      upfrontAmount,
      savedAt: Date.now(),
    };

    if (onNavigateToChat) {
      onNavigateToChat(listing, prefillData);
    } else {
      onClose();
    }
  }, [
    onNavigateToChat,
    listing,
    deliveryLatitude,
    deliveryLongitude,
    validNegotiationId,
    itemPrice,
    onClose,
    selectedCenterId,
    selectedCenter,
    inspectionMethod,
    feeSplit,
    agreedZinLoss,
    inspectionQuote,
    atCenterBaseFee,
    atCenterOutboundFee,
    atCenterReturnFee,
    atCenterFee,
    atHomeFee,
    buyerInspectionFee,
    sellerInspectionFee,
    upfrontAmount,
  ]);

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
    if (!streetAddress.trim() || !deliveryLatitude || !deliveryLongitude || !isLocationConfirmed || !ghnQuote) {
      errors.streetAddress = lang === 'vi' ? 'Vui lòng bấm nút "Xác Nhận Vị Trí Này" trên bản đồ để tính phí vận chuyển Lalamove' : 'Please click "Confirm Location" on the map to calculate Lalamove shipping fee';
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
    if (deliveryOption === 'INSPECTION') {
      handleNavigateToChat();
      return;
    }
    if (!validateForm()) {
      return;
    }

    let activeQuote = ghnQuote;
    const isQuoteExpired = activeQuote?.expiresAt ? new Date(activeQuote.expiresAt).getTime() <= Date.now() : false;

    // Đối với giao thẳng trực tiếp (không qua Hub), yêu cầu báo giá vận chuyển Lalamove hợp lệ
    if (!isInspected) {
      if (!activeQuote || !activeQuote.quoteId || isQuoteExpired || quoteLoading) {
        const activeCityToCheck = activeAddress?.city || activeAddress?.streetAddress || '';
        if (activeCityToCheck && normalizeCityKey(activeCityToCheck) === 'OTHER') {
          const errorMsg = lang === 'vi'
            ? 'Hệ thống hiện chỉ hỗ trợ giao hàng tại khu vực Hà Nội và TP. Hồ Chí Minh (kèm các khu vực lân cận được Lalamove hỗ trợ: Bắc Ninh, Hải Phòng, Hưng Yên, Ninh Bình, Đồng Nai, Bình Dương, Vũng Tàu). Vui lòng chọn lại địa chỉ nhận hàng.'
            : 'Service is currently only available in Hanoi and Ho Chi Minh City (& nearby regions).';
          setOrderError(errorMsg);
          setQuoteError(errorMsg);
          return;
        }

        if (deliveryLatitude && deliveryLongitude && isLocationConfirmed) {
          setSubmittingOrder(true);
          const prevTotal = totalAmount; // Lưu tổng tiền trước khi lấy lại giá

          // Dùng chung cơ chế getOrFetchQuote: nếu đang tải thì chờ chung, nếu hết hạn thì forceRefresh
          activeQuote = await getOrFetchQuote({
            lat: deliveryLatitude,
            lng: deliveryLongitude,
            addr: streetAddress,
            name: buyerName,
            phone: buyerPhone,
            forceRefresh: isQuoteExpired,
          });

          if (!activeQuote || !activeQuote.quoteId) {
            setSubmittingOrder(false);
            return;
          }

          // Kiểm tra xem tổng tiền sau khi làm mới có bị thay đổi không
          const newShippingFee = Number(activeQuote.shippingFee) || 0;
          const newProductPrice = Number(activeQuote.productPrice) || itemPrice;
          const newTotal = newProductPrice + newShippingFee + buyerInspectionFee;

          if (prevTotal > 0 && Math.abs(newTotal - prevTotal) >= 1) {
            setOrderError(
              lang === 'vi'
                ? `Cước phí vận chuyển Lalamove đã được cập nhật (${formatVND(newShippingFee)}). Tổng thanh toán thay đổi từ ${formatVND(prevTotal)} thành ${formatVND(newTotal)}. Vui lòng kiểm tra lại số tiền và bấm 'Xác Nhận Đặt Hàng' một lần nữa.`
                : `Lalamove quote updated (${formatVND(newShippingFee)}). Total changed from ${formatVND(prevTotal)} to ${formatVND(newTotal)}. Please verify and click confirm again.`
            );
            setSubmittingOrder(false);
            return;
          }
        } else {
          setOrderError(
            lang === 'vi'
              ? 'Chưa có báo giá vận chuyển hợp lệ. Vui lòng xác nhận vị trí giao hàng để lấy báo giá trước khi đặt hàng.'
              : 'No valid shipping quote. Please confirm your delivery address to get a quote before placing your order.'
          );
          return;
        }
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
      } catch { }

      if (currentBal < upfrontAmount) {
        setOrderError(
          lang === 'vi'
            ? `Số dư ví của bạn (${formatVND(currentBal)}) không đủ để thanh toán ${isInspected ? 'tiền cọc kiểm định & tiền ship' : 'đơn hàng'} (${formatVND(upfrontAmount)}). Vui lòng nạp thêm tiền vào ví hoặc chọn hình thức 'Chuyển Khoản Trực Tiếp'.`
            : `Your wallet balance (${formatVND(currentBal)}) is insufficient for ${isInspected ? 'inspection deposit & shipping' : 'order checkout'} (${formatVND(upfrontAmount)}). Please top up or choose Direct Bank Transfer.`
        );
        return;
      }
    }

    const alreadyBoughtIds = getBoughtListingIds();
    if (alreadyBoughtIds.has(String(listing.id))) {
      setOrderError(
        lang === 'vi'
          ? 'Sản phẩm này đã được người khác đặt mua rồi! Vui lòng không đặt mua trùng lặp.'
          : 'This listing has already been purchased. Please choose another item.'
      );
      return;
    }

    setOrderError(null);
    setSubmittingOrder(true);

    try {
      let orderId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f81d4fae-7dec-11d0-a765-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      let finalChargedPrice = productPrice;
      let finalShippingFee = shippingFee;
      let finalTotalPaid = upfrontAmount;

      if (isInspected) {
        if (inspectionMethod === 'AT_CENTER' && isAtCenterQuoteExpired) {
          setOrderError(lang === 'vi' ? 'Báo giá Lalamove đã hết hạn. Vui lòng bấm làm mới báo giá trước khi tiếp tục.' : 'Lalamove shipping quote has expired. Please refresh quote.');
          setSubmittingOrder(false);
          return;
        }

        // Gửi yêu cầu mua có kiểm định tới Backend qua POST /api/v1/inspection/requests
        const feePayerCode = feeSplit === 'BUYER_100' ? 'BUYER_PAYS' : feeSplit === 'SELLER_100' ? 'SELLER_PAYS' : 'SPLIT_50_50';
        let validPhone = (buyerPhone || currentUser?.phone || '').replace(/\D/g, '');
        if (!validPhone.startsWith('0') && !validPhone.startsWith('84')) validPhone = '0' + validPhone;
        if (validPhone.length < 10 || validPhone.length > 11) validPhone = '0912345678';
        const buyerLat = Number(deliveryLatitude) || 10.762622;
        const buyerLng = Number(deliveryLongitude) || 106.660172;

        const hubNote = selectedCenter ? `[Trung tâm tiếp nhận: ${selectedCenter.name} - ${selectedCenter.city}]` : '';
        const fullNote = [deliveryNote, hubNote].filter(Boolean).join(' | ');

        const config = inspectionQuote?.inspectionConfiguration;
        const targetCenterId = config?.inspectionCenterId || (isValidUuid(selectedCenterId) ? selectedCenterId : undefined);
        try {
          const beInspectionOrder = await inspectorService.createRequest({
            postId: listing.id,
            orderType: inspectionMethod,
            feePayer: feePayerCode,
            buyerConsentZin: agreedZinLoss ? true : undefined,
            buyerConsentZinLoss: agreedZinLoss ? true : undefined,
            buyerLatitude: buyerLat,
            buyerLongitude: buyerLng,
            buyerDeliveryAddress: {
              name: (buyerName || currentUser?.name || 'Khách Hàng').trim().slice(0, 100),
              phone: validPhone,
              latitude: buyerLat,
              longitude: buyerLng,
            },
            note: fullNote || undefined,
            negotiationId: negotiationId || undefined,
            inspectionCenterId: targetCenterId,
            expectedFeeProposalId: config?.feeProposalId || undefined,
            expectedChecklistTemplateId: config?.checklistTemplateId || undefined,
            inspectionShippingQuoteId: inspectionMethod === 'AT_CENTER' ? (inspectionQuote?.shippingQuote?.id || undefined) : undefined,
          });
          if (beInspectionOrder?.id) {
            orderId = String(beInspectionOrder.id);
          }
        } catch (inspErr: any) {
          console.warn('Backend inspection request issue:', inspErr);
          const errMsg = (inspErr?.message || '').toLowerCase();
          if (errMsg.includes('chính mình') || errMsg.includes('own post')) {
            setOrderError(lang === 'vi' ? 'Bạn đang đăng nhập bằng tài khoản người bán của bài đăng này. Không thể tự mua hàng của chính mình.' : 'You cannot buy your own post.');
            setSubmittingOrder(false);
            return;
          }
          if (errMsg.includes('đang diễn ra') || errMsg.includes('active inspection')) {
            setOrderError(lang === 'vi' ? 'Bài đăng đã có đơn kiểm định khác đang diễn ra. Vui lòng chờ kết quả kiểm định.' : 'Another inspection order is already in progress.');
            setSubmittingOrder(false);
            return;
          }
          if (inspErr?.status === 409 || errMsg.includes('409') || errMsg.includes('thay đổi') || errMsg.includes('mới')) {
            setOrderError(lang === 'vi' ? 'Báo giá hoặc tiêu chuẩn kiểm định đã có cập nhật mới từ hệ thống. Đang tải lại báo giá, vui lòng xác nhận số tiền mới trước khi bấm gửi.' : 'Inspection quote updated. Reloading quote, please confirm new pricing.');
            setInspectionQuote(null);
            await fetchInspectionQuote(deliveryLatitude, deliveryLongitude, selectedCenterId);
            setSubmittingOrder(false);
            return;
          }
          setOrderError(inspErr?.message || (lang === 'vi' ? 'Không thể khởi tạo đơn kiểm định.' : 'Failed to create inspection order.'));
          setSubmittingOrder(false);
          return;
        }
      } else {
        // Gọi Backend Order trực tiếp qua POST /api/v1/orders
        const quoteIdToUse = activeQuote?.quoteId || ghnQuote?.quoteId;
        if (!quoteIdToUse) {
          throw new Error(lang === 'vi' ? 'Không tìm thấy mã báo giá vận chuyển hợp lệ. Vui lòng thử lại.' : 'Shipping quote ID is missing.');
        }
        if (negotiationId && !negotiationValidation.valid) {
          setOrderError(negotiationValidation.error || "Thương lượng không hợp lệ.");
          setSubmittingOrder(false);
          return;
        }
        const backendOrder = await orderService.createOrder({
          postId: listing.id,
          shippingQuoteId: quoteIdToUse,
          requestId: currentRequestId,
          paymentMethod,
          ...(validNegotiationId ? { negotiationId: validNegotiationId } : {}),
        });
        if (backendOrder?.id) orderId = backendOrder.id;
        finalChargedPrice = backendOrder?.finalPrice || productPrice;
        finalShippingFee = backendOrder?.shippingFee || shippingFee;
        finalTotalPaid = backendOrder?.totalPaid ? Number(backendOrder.totalPaid) : totalAmount;
      }

      const shippingLegsData: ShippingLeg[] = isInspected
        ? (inspectionMethod === 'AT_HOME'
          ? [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_BUYER',
              carrier: 'SecondLife On-site Team',
              trackingNumber: '',
              status: 'PENDING',
              origin: listing.sellerAddress || listing.location || 'Địa chỉ kho người bán',
              destination: `Kiểm định tại nhà người bán (Kỹ sư ${selectedCenter?.name || 'On-site'})`,
              estimatedDelivery: 'Kỹ sư đến kiểm định theo lịch hẹn',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: `Cử chuyên viên kỹ thuật từ ${selectedCenter?.name || 'Trung tâm'} đến tận nhà người bán kiểm định trực tiếp on-site.`,
                  location: 'Địa chỉ kho người bán'
                }
              ]
            },
            {
              id: 'LEG-2',
              legType: 'SELLER_TO_BUYER',
              carrier: 'Lalamove',
              trackingNumber: '',
              status: 'PENDING',
              origin: listing.sellerAddress || listing.location || 'Địa chỉ kho người bán',
              destination: fullAddress,
              estimatedDelivery: 'Giao nhanh đến người mua sau khi kiểm định đạt chuẩn',
              timeline: [
                {
                  timestamp: '--:--',
                  description: 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong tem kiểm định.',
                  location: fullAddress
                }
              ]
            }
          ]
          : [
            {
              id: 'LEG-1',
              legType: 'SELLER_TO_CENTER',
              carrier: 'Lalamove',
              trackingNumber: '',
              status: 'PENDING',
              origin: listing.sellerAddress || listing.location || 'Địa chỉ kho người bán',
              destination: selectedCenter?.address ? `${selectedCenter.name} (${selectedCenter.address})` : (selectedCenter?.name || 'Trạm Kiểm Định SecondLife Hub Lab'),
              estimatedDelivery: 'Trong ngày',
              timeline: [
                {
                  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  description: `Khởi tạo đơn hàng kiểm định Hub (${selectedCenter?.name || 'Hub'}). Chờ bưu tá Lalamove điều phối lấy hàng chuyển về Hub.`,
                  location: selectedCenter?.address || selectedCenter?.name || 'Hệ thống SecondLife Escrow'
                }
              ]
            },
            {
              id: 'LEG-2',
              legType: 'CENTER_TO_BUYER',
              carrier: 'Lalamove',
              trackingNumber: '',
              status: 'PENDING',
              origin: selectedCenter?.address ? `${selectedCenter.name} (${selectedCenter.address})` : (selectedCenter?.name || 'Trạm Kiểm Định SecondLife Hub Lab'),
              destination: fullAddress,
              estimatedDelivery: 'Giao nhanh trong ngày sau khi đạt chuẩn kiểm định',
              timeline: [
                {
                  timestamp: '--:--',
                  description: 'Chờ hoàn tất quy trình kiểm định và dán tem niêm phong NFC tại Hub Lab.',
                  location: selectedCenter?.address || selectedCenter?.name || 'Trung tâm kiểm định SecondLife'
                }
              ]
            }
          ]
        )
        : [
          {
            id: 'LEG-1',
            legType: 'SELLER_TO_BUYER',
            carrier: 'Lalamove',
            trackingNumber: '',
            status: 'PENDING',
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
        ? 'AWAITING_INSPECTION'
        : isBankWaiting
          ? 'AWAITING_PAYMENT'
          : 'HELD_IN_ESCROW';

      const targetSellerId = String(
        listing.sellerId ||
        (listing as any).seller?.id ||
        (listing as any).userId ||
        (listing as any).user?.id ||
        ''
      );
      const targetSellerName = String(
        listing.sellerName ||
        (listing as any).seller?.fullName ||
        (listing as any).seller?.name ||
        (listing as any).user?.fullName ||
        (listing as any).user?.profile?.fullName ||
        (listing as any).user?.name ||
        'Người bán SecondLife'
      );
      const targetSellerEmail = (listing as any).sellerEmail || (listing as any).seller?.email || (listing as any).user?.email || '';
      const targetSellerAvatar = listing.sellerAvatarUrl || listing.sellerAvatar || (listing as any).seller?.avatarUrl || (listing as any).user?.avatarUrl;
      const targetSellerAddress = listing.sellerAddress || listing.location || (listing as any).seller?.address || '';

      const newOrder: EscrowOrder = {
        id: orderId,
        listingId: String(listing.id),
        listing: resolveOrderListing({
          ...listing,
          priceVnd: finalChargedPrice,
          sellerId: targetSellerId,
          sellerName: targetSellerName,
          sellerAddress: targetSellerAddress,
          sellerAvatarUrl: targetSellerAvatar,
        }),
        buyerId: currentUser?.id || 'buyer-current',
        buyerName: (buyerName || currentUser?.name || 'Khách Hàng').trim(),
        buyerPhone: buyerPhone.trim(),
        buyerAddress: fullAddress,
        sellerId: targetSellerId,
        sellerName: targetSellerName,
        sellerAvatarUrl: targetSellerAvatar,
        itemPriceVnd: finalChargedPrice,
        inspectionFeeVnd: isInspected ? buyerInspectionFee : 0,
        shippingFeeVnd: finalShippingFee,
        platformFeeVnd: 0,
        totalPaidVnd: finalTotalPaid,
        finalPrice: finalChargedPrice,
        finalItemPrice: finalChargedPrice,
        postPrice: finalChargedPrice,
        totalPaid: finalTotalPaid,
        escrowStatus: initialEscrowStatus,
        paymentMethod: paymentMethod,
        backendStatus: isInspected ? 'WAITING_SELLER_APPROVAL' : (isBankWaiting ? 'PENDING_PAYMENT' : 'PROCESSING'),
        hasInspectionService: isInspected,
        inspectionCenterId: isInspected ? selectedCenter?.id : undefined,
        inspectionCenterName: isInspected ? selectedCenter?.name : undefined,
        inspectionCenterAddress: isInspected ? selectedCenter?.address : undefined,
        inspectionCenterPhone: isInspected ? selectedCenter?.phone : undefined,
        inspectionMethod: isInspected ? inspectionMethod : undefined,
        inspectionFeeSplit: isInspected ? feeSplit : undefined,
        buyerInspectionFeeVnd: isInspected ? buyerInspectionFee : 0,
        sellerInspectionFeeVnd: isInspected ? sellerInspectionFee : 0,
        shippingLegs: shippingLegsData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        multiStagePhotos: {
          listingPhotos: [listing.photos.front, listing.photos.back]
        },
        ...((targetSellerEmail ? { sellerEmail: targetSellerEmail } : {}) as any),
        ...((currentUser?.email ? { buyerEmail: currentUser.email } : {}) as any),
      };

      try {
        if (!isBankWaiting) {
          markListingAsBought(String(listing.id));
        }
        localStorage.removeItem(`order_cancellation_info_${orderId}`);
        localStorage.removeItem(`order_cancelled_${orderId}`);
        if (listing?.id) {
          localStorage.removeItem(`listing_available_${listing.id}`);
          localStorage.removeItem(`listing_cancelled_at_${listing.id}`);
        }
        localStorage.setItem(`order_listing_${orderId}`, JSON.stringify(newOrder.listing));
        if (listing?.id) {
          localStorage.setItem(`cached_post_${listing.id}`, JSON.stringify(newOrder.listing));
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
          if (paymentMethod === 'WALLET') {
            try {
              const currentBal = wallet?.balance ?? 0;
              const newBal = Math.max(0, currentBal - upfrontAmount);
              setWallet((prev) => (prev ? { ...prev, balance: newBal } : null));
              if (currentUser?.id) {
                localStorage.setItem(`user_wallet_balance_${currentUser.id}`, String(newBal));
              }
            } catch { }
          }
          const stored = localStorage.getItem('recent_placed_orders');
          const existingRecent = safeJsonParse<EscrowOrder[]>(stored, []);
          const updatedRecent = [newOrder, ...existingRecent.filter((o) => o.id !== newOrder.id)].slice(0, 50);
          localStorage.setItem('recent_placed_orders', JSON.stringify(updatedRecent));

          if (isInspected) {
            try {
              // Lưu vào bộ nhớ đơn bán của Người bán để Seller Dashboard và EscrowOrdersView hiển thị ngay tức thì
              const rawSellerInsp = localStorage.getItem('my_seller_inspection_orders');
              const existingSellerInsp = safeJsonParse<EscrowOrder[]>(rawSellerInsp, []);
              const updatedSellerInsp = [newOrder, ...existingSellerInsp.filter((o) => o.id !== newOrder.id)].slice(0, 50);
              localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updatedSellerInsp));

              // Lưu vào center_inspection_orders để Trung tâm kiểm định đồng bộ
              const rawCenter = localStorage.getItem('center_inspection_orders');
              const existingCenter = safeJsonParse<EscrowOrder[]>(rawCenter, []);
              const updatedCenter = [newOrder, ...existingCenter.filter((o) => o.id !== newOrder.id)].slice(0, 50);
              localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
            } catch { }
          }

          // Dispatch notification specifically for seller (and buyer)
          const sellerNotifTitle = isInspected
            ? (inspectionMethod === 'AT_HOME'
              ? 'Yêu cầu kiểm định tại nhà mới (Hẹn lịch KTV)'
              : 'Yêu cầu kiểm định mới (Chờ bạn xác nhận)')
            : 'Đơn đặt hàng mới cần xác nhận';

          const sellerNotifMsg = isInspected
            ? (inspectionMethod === 'AT_HOME'
              ? `Khách mua ${buyerName || 'Khách Hàng'} vừa đặt đơn kiểm định tại nhà cho "${listing.title}". Người bán vui lòng vào đơn hàng để xác nhận và hẹn lịch KTV đến tận nơi thẩm định!`
              : `Khách mua ${buyerName || 'Khách Hàng'} vừa gửi yêu cầu kiểm định cho sản phẩm "${listing.title}". Người bán vui lòng vào đơn hàng để xác nhận đồng ý kiểm định!`)
            : `Khách mua ${buyerName || 'Khách Hàng'} vừa đặt mua sản phẩm "${listing.title}". Vui lòng xác nhận đơn hàng!`;

          const sellerNotifItem = {
            id: `notif-seller-inspection-${orderId}`,
            recipientId: targetSellerId,
            recipientRole: 'seller',
            sellerName: targetSellerName,
            sellerEmail: targetSellerEmail,
            recipientName: targetSellerName,
            recipientEmail: targetSellerEmail,
            title: sellerNotifTitle,
            message: sellerNotifMsg,
            type: 'INSPECTION_SELLER_REQUEST' as const,
            referenceId: orderId,
            referenceType: 'INSPECTION_ORDER' as const,
            actionUrl: paths.orders('seller', orderId) + '?filter=awaiting_pickup',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
            inspectionMethod: isInspected ? inspectionMethod : undefined,
          };
          saveScopedLocalNotification(sellerNotifItem as any, targetSellerId, 'seller');

          // Buyer local notification
          const buyerNotifItem = {
            id: `notif-buyer-${orderId}`,
            recipientId: currentUser?.id,
            recipientRole: 'buyer',
            title: isInspected ? 'Đặt đơn kiểm định thành công' : 'Đặt đơn hàng thành công',
            message: `Bạn đã đặt mua sản phẩm "${listing.title}". Đang chờ Người bán xác nhận!`,
            type: isInspected ? 'INSPECTION' : 'ORDER',
            referenceId: orderId,
            referenceType: isInspected ? 'INSPECTION_ORDER' : 'ORDER',
            actionUrl: paths.orders('buyer', orderId) + (isInspected ? '?filter=inspecting' : ''),
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
          };
          saveScopedLocalNotification(buyerNotifItem as any, currentUser?.id, 'buyer');
          try {
            window.dispatchEvent(new CustomEvent('secondlife_order_placed_signal', { detail: newOrder }));
            window.dispatchEvent(new CustomEvent('secondlife_listing_status_changed', { detail: { id: listing.id, status: 'reserved' } }));
            window.dispatchEvent(new CustomEvent('secondlife_inspection_task_created', { detail: newOrder }));
            window.dispatchEvent(new CustomEvent('secondlife_notification', { detail: sellerNotifItem }));
            localStorage.setItem('secondlife_order_placed_signal', String(Date.now()));
          } catch { }
        }
      } catch { }

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
        setOrderError(translateApiError(beMsg) || (lang === 'vi' ? 'Không thể tạo đơn hàng trên hệ thống. Vui lòng kiểm tra lại kết nối backend hoặc số dư ví.' : 'Failed to create order on backend.'));
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
    if (listing?.id) {
      markListingAsBought(String(listing.id));
    }
    setBankCheckMessage({
      type: 'success',
      text: lang === 'vi' ? '🎉 Đã ký quỹ Escrow thành công! Đang chuyển hướng đến đơn hàng...' : '🎉 Escrow deposit verified! Redirecting...',
    });

    try {
      const raw = localStorage.getItem('recent_placed_orders');
      const list = safeJsonParse<any[]>(raw, []);
      const updated = [paidOrder, ...list.filter((o: any) => o.id !== paidOrder.id)].slice(0, 30);
      localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
    } catch { }

    try {
      const targetSellerId = listing.sellerId || (listing as any).seller?.id;
      const sellerNotifItem = {
        id: `notif-seller-${paidOrder.id}`,
        recipientId: targetSellerId,
        recipientRole: 'seller',
        title: 'Đơn đặt hàng mới đã ký quỹ Escrow',
        message: `Khách mua ${buyerName || 'Khách Hàng'} vừa ký quỹ thành công cho sản phẩm "${listing.title}". Vui lòng xác nhận đơn hàng!`,
        type: 'ORDER' as const,
        referenceId: paidOrder.id,
        referenceType: 'ORDER',
        actionUrl: paths.orders('seller', paidOrder.id) + '?filter=awaiting_pickup',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(sellerNotifItem, targetSellerId, 'seller');

      const buyerNotifItem = {
        id: `notif-buyer-${paidOrder.id}`,
        recipientId: currentUser?.id,
        recipientRole: 'buyer',
        title: 'Ký quỹ đơn hàng thành công',
        message: `Bạn đã ký quỹ Escrow thành công cho đơn #${paidOrder.id.slice(0, 8)}. Người bán sẽ sớm chuẩn bị hàng!`,
        type: 'ORDER' as const,
        referenceId: paidOrder.id,
        referenceType: 'ORDER',
        actionUrl: paths.orders('buyer', paidOrder.id),
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      saveScopedLocalNotification(buyerNotifItem, currentUser?.id, 'buyer');
    } catch { }

    setTimeout(() => {
      onOrderPlaced(paidOrder);
      onClose();
    }, 1800);
  }, [buyerName, listing.id, listing.title, onOrderPlaced, onClose, lang]);

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
        const list = safeJsonParse<any[]>(raw, []);
        const filtered = list.filter((o: any) => o.id !== createdOrder.id);
        localStorage.setItem('recent_placed_orders', JSON.stringify(filtered));

        const rawAll = localStorage.getItem('all_orders_cache');
        const listAll = safeJsonParse<any[]>(rawAll, []);
        const filteredAll = listAll.filter((o: any) => o.id !== createdOrder.id);
        localStorage.setItem('all_orders_cache', JSON.stringify(filteredAll));

        const rawNotifs = localStorage.getItem('secondlife_local_notifications');
        const listNotifs = safeJsonParse<any[]>(rawNotifs, []);
        const filteredNotifs = listNotifs.filter((n: any) => n.referenceId !== createdOrder.id);
        localStorage.setItem('secondlife_local_notifications', JSON.stringify(filteredNotifs));

        if (currentUser?.id) {
          const userKey = `secondlife_local_notifications_${currentUser.id}`;
          const rawUserNotifs = localStorage.getItem(userKey);
          const listUserNotifs = safeJsonParse<any[]>(rawUserNotifs, []);
          const filteredUserNotifs = listUserNotifs.filter((n: any) => n.referenceId !== createdOrder.id);
          localStorage.setItem(userKey, JSON.stringify(filteredUserNotifs));
        }
      } catch { }
    }

    // Giải phóng bài đăng để sản phẩm lập tức hiện lại trên sàn giao dịch
    const cancelledListingId = String(listing?.id || createdOrder?.listingId || '');
    if (cancelledListingId) {
      markListingAsAvailable(cancelledListingId);
      reconcileBoughtListingIds();
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
      <div className="w-full bg-[#f8fafc] text-[#24263e] min-h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
        {/* Full-width Top Title Bar */}
        <div className="bg-white border-b border-slate-200/80 shadow-2xs shrink-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseUnpaidModal}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Quay lại' : 'Back'}</span>
              </button>
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <QrCode className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#24263e]">
                    {lang === 'vi' ? 'Ký Quỹ Escrow Qua Ngân Hàng VietQR (SePay)' : 'Escrow Deposit via VietQR'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    Đơn hàng: #{createdOrder.id} • Ký quỹ để đóng băng tiền bảo vệ giao dịch
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseUnpaidModal}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
              title={lang === 'vi' ? 'Đóng và quay lại trang mua hàng' : 'Close and return to product'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
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
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${(paymentSecondsLeft ?? 900) < 180
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
                  <span className={`text-base font-black font-mono px-2.5 py-1 rounded-xl border ${(paymentSecondsLeft ?? 900) < 180
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
                  className={`w-48 h-48 object-contain rounded-xl transition-all ${isPaymentExpired ? 'filter blur-sm opacity-40' : ''
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
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${bankCheckMessage.type === 'error'
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
    <div className="w-full bg-[#f8fafc] text-[#24263e] min-h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
      {/* Full-width Top Title Bar */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={bankPaymentInfo || createdOrder ? handleCloseUnpaidModal : onClose}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Quay lại' : 'Back'}</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center shadow-xs">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm sm:text-base text-[#24263e] leading-tight">
                  {lang === 'vi' ? 'Đặt Hàng & Thanh Toán Bảo Lãnh Escrow' : 'Escrow Protected Order & Checkout'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                  {lang === 'vi' ? '100% tiền tạm giữ an toàn tại ngân hàng liên kết đến khi nghiệm thu' : '100% funds held securely until buyer approval'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ký quỹ Escrow bảo đảm 100%</span>
            </span>
            <button
              type="button"
              onClick={bankPaymentInfo || createdOrder ? handleCloseUnpaidModal : onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl cursor-pointer transition"
              title="Đóng trang đặt hàng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body with 2-Column E-Commerce Layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <form onSubmit={handleConfirmOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* CỘT TRÁI (7 cols): Giao nhận, Kiểm định Hub, Thông tin người nhận, Địa chỉ Lalamove, Phương thức thanh toán */}
            <div className="lg:col-span-7 space-y-6">
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
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${deliveryOption === 'INSPECTION'
                      ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          {lang === 'vi' ? 'Thương lượng qua Chat' : 'Negotiate in Chat'}
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deliveryOption === 'INSPECTION' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
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
                            ? 'Tháo máy kiểm định • Cần thương lượng trước'
                            : 'Disassembled for testing • Requires negotiation'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Giao thẳng */}
                  <div
                    onClick={() => setDeliveryOption('DIRECT')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${deliveryOption === 'DIRECT'
                      ? 'border-[#c34c36] bg-[#faf8f5] shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {lang === 'vi' ? 'Mua ngay tức thì' : 'Buy Now'}
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deliveryOption === 'DIRECT' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
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
                            {lang === 'vi' ? 'Người bán → Người mua (Mua ngay)' : 'Direct Delivery (Buy Now)'}
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
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all shadow-xs ${formErrors.agreedZinLoss
                        ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20'
                        : agreedZinLoss
                          ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-300'
                          : 'bg-gradient-to-br from-amber-50/90 via-[#fffbf5] to-orange-50/80 border-amber-300'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition ${agreedZinLoss ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
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
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${agreedZinLoss
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
                              className={`text-[11px] font-bold leading-snug transition ${agreedZinLoss ? 'text-emerald-800' : 'text-slate-800 group-hover:text-[#c34c36]'
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
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {lang === 'vi' ? 'Hệ thống Trạm Hub Chính Thức' : 'Official Verified Hubs'}
                          </span>
                        </label>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                          📍 {selectedCenter.city}
                        </span>
                      </div>

                      {inspectionCenters.length > 1 && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            {lang === 'vi' ? 'Chọn trạm Hub tiếp nhận:' : 'Select Inspection Hub:'}
                          </label>
                          <select
                            value={selectedCenterId}
                            onChange={(e) => {
                              setSelectedCenterId(e.target.value);
                              fetchInspectionQuote(deliveryLatitude, deliveryLongitude, e.target.value);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 outline-none focus:border-[#c34c36] shadow-2xs cursor-pointer"
                          >
                            {inspectionCenters.map((hub) => (
                              <option key={hub.id} value={hub.id}>
                                {hub.name} {hub.address ? `- ${hub.address}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Chi tiết trung tâm đã chọn */}
                      <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                            {selectedCenter.name}
                          </span>
                          {selectedCenter.phone && (
                            <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                              📞 Hotline: <strong className="text-slate-900">{selectedCenter.phone}</strong>
                            </span>
                          )}
                        </div>
                        {selectedCenter.address && (
                          <p className="text-[10px] text-slate-600 pl-4.5">
                            {selectedCenter.address}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 pl-4.5 pt-0.5 text-[9px] text-slate-500">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                            🔬 Trạm thẩm định tiêu chuẩn
                          </span>
                          {Boolean(selectedCenter.activeInspectors) && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                              👨‍🔧 Đội ngũ: <strong>{selectedCenter.activeInspectors} chuyên viên</strong>
                            </span>
                          )}
                          {Boolean(selectedCenter.capacityPerDay) && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                              📦 Công suất: <strong>{selectedCenter.capacityPerDay} máy/ngày</strong>
                            </span>
                          )}
                          {Boolean(selectedCenter.passRatePercentage) && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                              ✅ Tỷ lệ thẩm định đạt: {selectedCenter.passRatePercentage}%
                            </span>
                          )}
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
                          className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${inspectionMethod === 'AT_CENTER'
                            ? 'border-blue-600 bg-white shadow-xs ring-2 ring-blue-600/15'
                            : 'border-slate-200 hover:border-slate-300 bg-white/70'
                            }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="font-extrabold text-xs text-slate-900">
                                  {lang === 'vi' ? 'Đưa đến trung tâm' : 'Bring to Center'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {loadingInspectionQuote && (
                                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                                )}
                                <span className="text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                  {loadingInspectionQuote ? '...' : formatVND(atCenterFee)}
                                </span>
                              </div>
                            </div>

                            {/* Chi tiết cước và biểu phí */}
                            {loadingInspectionQuote ? (
                              <div className="py-2.5 flex items-center gap-2 text-[10px] text-slate-500 animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                                <span>{lang === 'vi' ? 'Đang gọi API Lalamove & tính cước thời gian thực...' : 'Fetching live Lalamove quote & fees...'}</span>
                              </div>
                            ) : inspectionQuoteError ? (
                              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-800 space-y-1.5">
                                <p className="font-semibold flex items-start gap-1.5 leading-snug">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <span>{inspectionQuoteError}</span>
                                </p>
                                <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchInspectionQuote(deliveryLatitude, deliveryLongitude, selectedCenterId);
                                    }}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[9px] font-bold cursor-pointer transition flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>{lang === 'vi' ? 'Thử tải lại báo giá' : 'Retry'}</span>
                                  </button>
                                  {inspectionQuoteErrorStatus === 422 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectionMethod('AT_HOME');
                                      }}
                                      className="text-[9px] font-bold text-purple-700 underline hover:text-purple-900 cursor-pointer"
                                    >
                                      {lang === 'vi' ? 'Chuyển sang Kiểm định tại nhà' : 'Switch to On-site'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5 text-[10px] text-slate-600">
                                <div className="flex justify-between items-center">
                                  <span>• {lang === 'vi' ? 'Phí kiểm định cơ sở' : 'Base inspection fee'}:</span>
                                  <span className="font-bold text-slate-800">{formatVND(atCenterBaseFee)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-1">
                                    <span>• {lang === 'vi' ? 'Cước vận chuyển hàng từ người bán đến trung tâm kiểm định' : 'To Hub shipping'}:</span>
                                    {atCenterShippingQuote?.outbound?.serviceType && (
                                      <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                                        {formatLalamoveVehicle(atCenterShippingQuote.outbound.serviceType).name}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-bold text-slate-800">{formatVND(atCenterOutboundFee)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-1">
                                    <span>• {lang === 'vi' ? 'Dự phòng cước hoàn' : 'Return reserve'}:</span>
                                    {atCenterShippingQuote?.returnReserve?.serviceType && (
                                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-medium">
                                        {formatLalamoveVehicle(atCenterShippingQuote.returnReserve.serviceType).name}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-bold text-slate-800">{formatVND(atCenterReturnFee)}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 italic pl-2">
                                  ↳ {lang === 'vi' ? '(Khoản dự phòng hoàn lại nếu sản phẩm Đạt chuẩn kiểm định hoặc người mua từ chối kết quả kiểm đinh.)' : '(Refunded if item passes inspection)'}
                                </div>

                                {/* Thông báo phân loại xe nếu có từ BE */}
                                {atCenterShippingQuote?.outbound?.vehicleSelection?.message && (
                                  <p className="mt-1 text-[9px] text-amber-800 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200 leading-snug">
                                    ℹ️ {atCenterShippingQuote.outbound.vehicleSelection.message}
                                  </p>
                                )}

                                {/* Trạng thái hết hạn báo giá */}
                                {isAtCenterQuoteExpired && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[9px] text-rose-700 flex items-center justify-between gap-1.5">
                                    <span className="font-medium">⏰ {lang === 'vi' ? 'Báo giá Lalamove đã hết hạn (quá thời hạn quotation).' : 'Quote expired.'}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fetchInspectionQuote(deliveryLatitude, deliveryLongitude, selectedCenterId);
                                      }}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer shrink-0 transition"
                                    >
                                      {lang === 'vi' ? 'Lấy giá mới' : 'Refresh'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-blue-700 font-bold">
                            <span className="flex items-center gap-1">
                              <span>🏷️ {lang === 'vi' ? 'Đã bao gồm cước 2 chiều Lalamove' : 'Includes 2-way shipping'}</span>
                              {atCenterShippingQuote?.expiresAt && !isAtCenterQuoteExpired && (
                                <span className="text-[9px] font-normal text-slate-400">
                                  (hạn: {new Date(atCenterShippingQuote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                            </span>
                            {inspectionMethod === 'AT_CENTER' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        </div>

                        {/* Cách 2: Cử người đến nhà */}
                        <div
                          onClick={() => setInspectionMethod('AT_HOME')}
                          className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${inspectionMethod === 'AT_HOME'
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
                          className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${feeSplit === 'BUYER_100'
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
                          className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${feeSplit === 'SPLIT_50_50'
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
                          className={`p-2.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${feeSplit === 'SELLER_100'
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


                    </div>
                  </div>
                )}
              </div>

              {/* Shopee-Style Delivery Address Section (Chỉ hiển thị khi Giao Thẳng Trực Tiếp) */}
              {deliveryOption === 'DIRECT' && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  {/* Shopee-signature envelope striped top bar */}
                  <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,#c34c36,#c34c36_32px,#ffffff_32px,#ffffff_42px,#3b82f6_42px,#3b82f6_74px,#ffffff_74px,#ffffff_84px)] shrink-0" />

                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Title Header with MapPin */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#c34c36]/10 text-[#c34c36] flex items-center justify-center font-bold shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                        </div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-[#24263e] uppercase tracking-wide">
                          {lang === 'vi' ? 'Địa Chỉ Nhận Hàng' : 'Delivery Address'}
                        </h4>
                      </div>

                      {activeAddress ? (
                        <button
                          type="button"
                          onClick={() => setIsAddressModalOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <span>{lang === 'vi' ? 'Thay Đổi' : 'Change'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenAddAddress}
                          className="text-xs font-bold text-[#c34c36] hover:text-[#a83824] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Thêm Địa Chỉ Mới' : 'Add Address'}</span>
                        </button>
                      )}
                    </div>

                    {/* Shopee Address Display or Empty State */}
                    {activeAddress ? (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2.5">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-slate-900 text-sm">
                                {activeAddress.name}
                              </span>
                              <span className="font-bold text-slate-600 text-xs sm:text-sm">
                                (+84) {activeAddress.phone.replace(/^0/, '')}
                              </span>
                              {activeAddress.isDefault && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold text-[#c34c36] border border-[#c34c36]/40 rounded bg-red-50/70 leading-none">
                                  {lang === 'vi' ? 'Mặc định' : 'Default'}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 rounded leading-none">
                                {activeAddress.addressType === 'office' ? (lang === 'vi' ? 'Văn Phòng' : 'Office') : (lang === 'vi' ? 'Nhà Riêng' : 'Home')}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                              {activeAddress.streetAddress || streetAddress}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsAddressModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-bold transition cursor-pointer"
                            >
                              {lang === 'vi' ? 'Thay Đổi' : 'Change'}
                            </button>
                          </div>
                        </div>

                        {/* Compact Note & Email inputs */}
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              {lang === 'vi' ? 'Ghi chú cho tài xế Lalamove (tùy chọn)' : 'Delivery note (optional)'}
                            </label>
                            <input
                              type="text"
                              value={deliveryNote}
                              onChange={(e) => setDeliveryNote(e.target.value)}
                              placeholder={lang === 'vi' ? 'Ví dụ: Gọi trước 15 phút, nhà có thang máy...' : 'E.g., Call before delivery...'}
                              className="w-full px-3 py-1.5 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#c34c36] transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              {lang === 'vi' ? 'Email nhận chứng nhận Escrow & Hóa đơn' : 'Email for Escrow Certificate'}
                            </label>
                            <input
                              type="email"
                              value={buyerEmail}
                              onChange={(e) => setBuyerEmail(e.target.value)}
                              placeholder="email@domain.com"
                              className="w-full px-3 py-1.5 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#c34c36] transition"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty state: User has NO saved address yet (lần đầu chưa có) */
                      <div className="p-6 border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-900">
                            {lang === 'vi' ? 'Bạn chưa có địa chỉ nhận hàng nào' : 'No delivery address saved yet'}
                          </h5>
                          <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                            {lang === 'vi'
                              ? 'Thêm địa chỉ nhận hàng để SecondLife tính chính xác cước Lalamove và giao hàng an toàn đến tay bạn.'
                              : 'Add a delivery address to calculate shipping quote and place your order.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddAddress}
                          className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a83824] text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'vi' ? 'Thêm Địa Chỉ Nhận Hàng Mới' : 'Add New Delivery Address'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lalamove Shipping & Vehicle Options Card (Chỉ hiển thị khi Giao Thẳng Trực Tiếp) */}
              {deliveryOption === 'DIRECT' && (
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  {/* Live Lalamove Quote Status Indicator */}
                  {quoteLoading && (
                    <div className="p-3.5 bg-orange-50/90 border border-orange-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-orange-950 animate-fadeIn shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                          <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                        </div>
                        <div>
                          <p className="font-bold text-orange-950">
                            Đang kết nối API Lalamove tính toán cước phí vận chuyển...
                          </p>
                          <p className="text-[11px] text-orange-700 mt-0.5">
                            Hệ thống đang tự động tìm loại xe phù hợp (Xe máy, Bán tải, Xe tải) cho kiện hàng.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (quoteAbortControllerRef.current) quoteAbortControllerRef.current.abort();
                          calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                        }}
                        className="px-3 py-1.5 bg-orange-200 hover:bg-orange-300 text-orange-950 rounded-xl font-bold text-xs cursor-pointer transition flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Thử lại ngay</span>
                      </button>
                    </div>
                  )}

                  {!isLocationConfirmed && !quoteLoading && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {lang === 'vi'
                          ? 'Vui lòng chọn vị trí trên bản đồ và bấm "Xác Nhận Vị Trí Này" để hệ thống tính phí vận chuyển Lalamove.'
                          : 'Please select a location on the map and click "Confirm Location" to calculate Lalamove shipping fee.'}
                      </span>
                    </div>
                  )}

                  {quoteError && (() => {
                    const isVehicleLimit = quoteError.includes('Không có loại xe Lalamove đủ tải trọng') || quoteError.includes('Giới hạn từng loại xe');
                    const isNoSuitableVehicle = quoteErrorCode === 'NO_SUITABLE_VEHICLE_FOR_ROUTE' || quoteErrorStatus === 422;

                    if (isVehicleLimit) {
                      const vehicleLimits = parseLalamoveVehicleLimits(quoteError);

                      return (
                        <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-xs text-amber-950 dark:text-amber-100 space-y-3 animate-fadeIn">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                                  Kiện hàng vượt quá tải trọng / kích thước xe Lalamove
                                </h4>
                                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                                  Kích thước hoặc cân nặng của sản phẩm này lớn hơn giới hạn chuyên chở của các loại xe Lalamove tại điểm lấy hàng của người bán.
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                              }}
                              disabled={quoteLoading}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs transition flex items-center gap-1.5 shrink-0"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${quoteLoading ? 'animate-spin' : ''}`} />
                              <span>{quoteLoading ? 'Đang tính...' : 'Thử lại'}</span>
                            </button>
                          </div>

                          {/* Hướng dẫn giải pháp ngắn gọn, thân thiện */}
                          <div className="text-xs text-amber-800 dark:text-amber-300 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-800/40 flex items-start gap-2">
                            <span className="text-sm shrink-0">💡</span>
                            <span className="leading-relaxed text-[11px]">
                              <strong>Gợi ý:</strong> Bạn có thể nhắn tin trao đổi với người bán để kiểm tra lại thông số đóng gói bài đăng hoặc thỏa thuận phương án vận chuyển riêng.
                            </span>
                          </div>

                          {/* Danh sách giới hạn chi tiết từng loại xe */}
                          {vehicleLimits.length > 0 && (
                            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                              <button
                                type="button"
                                onClick={() => setShowVehicleLimits(!showVehicleLimits)}
                                className="flex items-center justify-between w-full text-left text-xs font-bold text-amber-900 dark:text-amber-200 hover:text-amber-700 cursor-pointer py-1"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>📋</span>
                                  <span>Xem quy chuẩn kích thước các loại xe ({vehicleLimits.length} loại xe)</span>
                                </span>
                                {showVehicleLimits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {showVehicleLimits && (
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                  {vehicleLimits.map((v, idx) => (
                                    <div key={idx} className="bg-white/80 dark:bg-amber-950/50 p-2 rounded-xl border border-amber-200/70 dark:border-amber-800/40 text-[11px] leading-tight">
                                      <div className="font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                                        <span>{v.icon}</span>
                                        <span>{v.name}</span>
                                      </div>
                                      {v.limitText && (
                                        <div className="text-amber-800 dark:text-amber-300 text-[10px] mt-0.5 pl-5">
                                          {v.limitText}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (isNoSuitableVehicle) {
                      return (
                        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-bold text-amber-950 leading-relaxed">{quoteError}</p>
                              <p className="text-[11px] text-amber-800">
                                👉 Vui lòng kiểm tra và điều chỉnh vị trí hoặc địa chỉ giao nhận trên bản đồ rồi bấm thử lại.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                              }}
                              disabled={quoteLoading}
                              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl font-bold text-xs cursor-pointer transition flex items-center gap-1"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${quoteLoading ? 'animate-spin' : ''}`} />
                              <span>{quoteLoading ? 'Đang tính...' : 'Thử lại'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Các trường hợp lỗi kỹ thuật (429, 502, 503, 504) hoặc lỗi khác
                    return (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold leading-relaxed">{quoteError}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                            }}
                            disabled={quoteLoading}
                            className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl font-bold text-xs cursor-pointer transition flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${quoteLoading ? 'animate-spin' : ''}`} />
                            <span>{quoteLoading ? 'Đang tính...' : 'Thử lại'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {isLocationConfirmed && ghnQuote && !quoteError && (
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

                      {/* Khung vàng giải thích phương tiện thay thế khi BE sử dụng fallback */}
                      {ghnQuote.vehicleSelection?.fallbackUsed === true && (
                        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-950 shadow-2xs animate-fadeIn">
                          <div className="flex items-center gap-2 font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-xs font-extrabold">Lý do chọn phương tiện thay thế</span>
                          </div>
                          {ghnQuote.vehicleSelection.message && (
                            <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                              {ghnQuote.vehicleSelection.message}
                            </p>
                          )}
                          {(ghnQuote.vehicleSelection.pickupCity || ghnQuote.vehicleSelection.deliveryCity || typeof ghnQuote.vehicleSelection.distanceKm === 'number') && (
                            <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-amber-200/70 text-[10px] text-amber-800">
                              {(ghnQuote.vehicleSelection.pickupCity || ghnQuote.vehicleSelection.deliveryCity) && (
                                <span className="bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                                  Tuyến: {[ghnQuote.vehicleSelection.pickupCity, ghnQuote.vehicleSelection.deliveryCity].filter(Boolean).join(' ➔ ')}
                                </span>
                              )}
                              {typeof ghnQuote.vehicleSelection.distanceKm === 'number' && (
                                <span className="bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                                  Khoảng cách: <strong>{ghnQuote.vehicleSelection.distanceKm.toLocaleString('vi-VN')} km</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Thẻ phân loại phương tiện theo kích thước & khối lượng kiện hàng sản phẩm */}
                      {(() => {
                        const displayVehicle = formatLalamoveVehicle(ghnQuote.serviceType);
                        // Use the quote snapshot, never inferred listing/category/localStorage defaults.
                        const { shippingWeight, shippingLength, shippingWidth, shippingHeight } = ghnQuote;
                        const hasParcel = [shippingWeight, shippingLength, shippingWidth, shippingHeight]
                          .every(value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
                        const weightDisplay = hasParcel
                          ? `${(shippingWeight! / 1000).toLocaleString('vi-VN')} kg`
                          : 'Chưa có thông tin';
                        const dimsDisplay = hasParcel
                          ? `${shippingLength} x ${shippingWidth} x ${shippingHeight} cm`
                          : 'Chưa có thông tin';

                        return (
                          <div className="space-y-2.5">
                            <div className="p-3 bg-white/95 border border-emerald-200 rounded-xl space-y-2 shadow-2xs">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <span className="text-2xl shrink-0 mt-0.5">{displayVehicle.icon}</span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-xs text-slate-900">
                                        Phương tiện: {displayVehicle.name}
                                      </span>
                                      {ghnQuote.serviceType && (
                                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                                          {ghnQuote.serviceType}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                      {displayVehicle.desc}
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
                                  Số đo đóng gói theo báo giá
                                </span>
                              </div>
                            </div>

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
              )}

              {/* Payment Method Selector: WALLET vs BANK_TRANSFER (Chỉ hiển thị khi Giao Thẳng Trực Tiếp) */}
              {deliveryOption === 'DIRECT' && (
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
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${paymentMethod === 'WALLET'
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
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'WALLET' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
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
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${paymentMethod === 'BANK_TRANSFER'
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
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'BANK_TRANSFER' ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300'
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
                    <div className={`p-4 rounded-2xl border transition-all ${(wallet?.balance ?? 0) >= upfrontAmount
                      ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-300'
                      : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-300'
                      }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${(wallet?.balance ?? 0) >= upfrontAmount ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
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
              )}

            </div>

            {/* CỘT PHẢI (5 cols - Sticky): Sản phẩm, Chi tiết thanh toán, Cam kết Escrow, Nút đặt hàng */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              {/* Product Order Summary Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Package className="w-4 h-4 text-[#c34c36]" />
                  <h4 className="font-extrabold text-xs sm:text-sm text-[#24263e] uppercase tracking-wide">
                    {lang === 'vi' ? 'Sản Phẩm Đặt Mua' : 'Product Order Summary'}
                  </h4>
                </div>
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
                      <span className="text-[10px] text-slate-500 font-semibold">{resolveListingCategory(listing)}</span>
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
              </div>

              {/* Financial Breakdown Card */}
              <div className="space-y-2 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
                <div className="font-extrabold text-[11px] text-[#24263e] uppercase tracking-wider border-b border-slate-200/60 pb-1.5 flex items-center justify-between">
                  <span>
                    {deliveryOption === 'INSPECTION'
                      ? (lang === 'vi' ? 'Chi tiết chi phí kiểm định' : 'Inspection Payment Details')
                      : (lang === 'vi' ? 'Chi tiết thanh toán đơn hàng & vận chuyển' : 'Payment Breakdown')}
                  </span>
                  {deliveryOption === 'DIRECT' && ghnQuote?.expiresAt && (
                    <span className="text-[10px] text-slate-500 font-normal lowercase flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      báo giá hiệu lực đến: {new Date(ghnQuote.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {deliveryOption === 'DIRECT' ? (
                  /* DIRECT DELIVERY BREAKDOWN */
                  <>
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
                        ⚡ Giao thẳng trực tiếp
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 text-[11px] items-center">
                      <span>{lang === 'vi' ? 'Phí giao hàng Lalamove On-Demand:' : 'Lalamove Shipping Fee:'}</span>
                      <div className="text-right">
                        {quoteLoading ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (quoteAbortControllerRef.current) quoteAbortControllerRef.current.abort();
                              calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                            }}
                            title="Bấm để thử lại tính phí nếu chờ lâu"
                            className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 justify-end cursor-pointer group"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="group-hover:underline">Đang tính phí Lalamove...</span>
                          </button>
                        ) : (isLocationConfirmed && ghnQuote && !quoteError) ? (
                          <span className="font-bold text-emerald-700">
                            +{formatVND(shippingFee)}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold text-[11px]">
                            Chưa có báo giá vận chuyển
                          </span>
                        )}
                      </div>
                    </div>

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
                  </>
                ) : (
                  /* INSPECTION DELIVERY BREAKDOWN - CHỈ HIỆN THÔNG TIN CẦN THIẾT CỦA KIỂM ĐỊNH */
                  <>
                    <div className="flex justify-between text-slate-600 text-[11px] items-center">
                      <span>Hình thức giao nhận:</span>
                      <span className="font-bold text-slate-800">
                        🛡️ Kiểm định qua Hub
                      </span>
                    </div>

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

                      {inspectionMethod === 'AT_CENTER' && atCenterShippingQuote && (
                        <div className="pt-1.5 border-t border-emerald-200/60 space-y-1 text-[10px] text-emerald-950 font-medium">
                          <div className="flex justify-between">
                            <span className="text-slate-600">• {lang === 'vi' ? 'Phí kiểm định cơ sở:' : 'Base inspection:'}</span>
                            <span className="font-bold text-slate-800">{formatVND(atCenterBaseFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 flex items-center gap-1">
                              <span>• {lang === 'vi' ? 'Cước Lalamove giao Hub:' : 'Lalamove to Hub:'}</span>
                              {atCenterShippingQuote?.outbound?.serviceType && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-semibold">
                                  {formatLalamoveVehicle(atCenterShippingQuote.outbound.serviceType).name}
                                </span>
                              )}
                            </span>
                            <span className="font-bold text-slate-800">{formatVND(atCenterOutboundFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 flex items-center gap-1">
                              <span>• {lang === 'vi' ? 'Dự phòng hoàn hàng (hoàn lại nếu Đạt):' : 'Return reserve (refunded if Pass):'}</span>
                              {atCenterShippingQuote?.returnReserve?.serviceType && (
                                <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-medium">
                                  {formatLalamoveVehicle(atCenterShippingQuote.returnReserve.serviceType).name}
                                </span>
                              )}
                            </span>
                            <span className="font-bold text-slate-800">{formatVND(atCenterReturnFee)}</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-emerald-200/60 text-[10px] text-amber-900 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>
                          {lang === 'vi'
                            ? 'Lưu ý: Thiết bị sẽ được tháo máy để kiểm tra kỹ thuật (sẽ mất trạng thái zin nguyên bản).'
                            : 'Notice: Device will be disassembled for inspection (voids original "zin" condition).'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span className="flex items-center gap-1.5 text-amber-900">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'vi' ? 'Giai đoạn 1 (Trả trước): Phí kiểm định' : 'Stage 1 (Upfront): Inspection Fee'}</span>
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
                          {lang === 'vi' ? 'Tổng phí kiểm định phần bạn trả:' : 'Your Inspection Fee Share:'}
                        </span>
                        <span className="text-base sm:text-lg font-black text-[#c34c36]">
                          {formatVND(upfrontAmount)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Order Error Alert */}
              {negotiationId && !negotiationValidation.valid && (
                <div className="p-3.5 mb-3 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">{lang === "vi" ? "Thương lượng không thể áp dụng" : "Negotiation cannot be applied"}</p>
                    <p className="mt-0.5">{negotiationValidation.error}</p>
                  </div>
                </div>
              )}
              {orderError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center justify-between gap-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="break-words">{translateSystemNotification(orderError)}</span>
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

              {/* Submit or Chat Navigation Button */}
              {deliveryOption === 'INSPECTION' ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleNavigateToChat}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-white" />
                    <span>
                      {lang === 'vi'
                        ? `Đến Phòng Chat Thương Lượng Kiểm Định (${formatVND(upfrontAmount)})`
                        : `Go to Chat to Negotiate Inspection (${formatVND(upfrontAmount)})`}
                    </span>
                  </button>
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-snug flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'vi'
                        ? 'Đơn hàng kiểm định không thanh toán mua thẳng tại đây mà cần gửi đề xuất để Người bán xác nhận đồng thuận trong phòng chat trước.'
                        : 'Inspection orders cannot be placed directly here. You must propose and negotiate in chat for seller approval first.'}
                    </span>
                  </div>
                  {!listing.requiresInspection && (
                    <button
                      type="button"
                      onClick={() => setDeliveryOption('DIRECT')}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>{lang === 'vi' ? 'Hoặc chọn Giao Thẳng để Mua ngay' : 'Or switch to Direct Delivery to Buy Now'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={
                    submittingOrder ||
                    !isLocationConfirmed ||
                    !ghnQuote ||
                    Boolean(quoteError)
                  }
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
                  ) : (!isLocationConfirmed || !ghnQuote || Boolean(quoteError)) ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (quoteError || quoteLoading) {
                          if (quoteAbortControllerRef.current) quoteAbortControllerRef.current.abort();
                          calculateLalamoveQuote(deliveryLatitude, deliveryLongitude, streetAddress, buyerName, buyerPhone);
                        }
                      }}
                      className={`w-full py-1 text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2 ${quoteError || quoteLoading ? 'cursor-pointer hover:underline' : 'cursor-not-allowed'
                        }`}
                    >
                      {quoteLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Đang tải báo giá Lalamove (Nhấn để thử lại nếu lâu)...</span>
                        </>
                      ) : quoteError ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-white" />
                          <span>Chưa có báo giá vận chuyển - Nhấn để Thử lại</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4 text-white" />
                          <span>Vui lòng chọn địa chỉ nhận hàng để tính phí</span>
                        </>
                      )}
                    </div>
                  ) : paymentMethod === 'WALLET' ? (
                    <>
                      <Lock className="w-4 h-4 text-white" />
                      <span>
                        {lang === 'vi'
                          ? `Xác Nhận Đặt Hàng & Thanh Toán Ví (${formatVND(totalAmount)})`
                          : `Confirm Order & Pay with Wallet (${formatVND(totalAmount)})`}
                      </span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 text-white" />
                      <span>
                        {lang === 'vi'
                          ? `Đặt Hàng & Nhận Mã VietQR (${formatVND(totalAmount)})`
                          : `Place Order & Get VietQR Code (${formatVND(totalAmount)})`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Shopee-Style Modal: "Địa Chỉ Của Tôi" (Address Selector Modal) */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                {lang === 'vi' ? 'Địa Chỉ Của Tôi' : 'My Addresses'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Address List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {savedAddresses.map((addr) => {
                const isSelected = (selectedAddressId || activeAddress?.id) === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${isSelected
                      ? 'border-[#c34c36] bg-[#fdf8f6]/60 ring-1 ring-[#c34c36]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                  >
                    {/* Radio check indicator */}
                    <div className="pt-0.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#c34c36] bg-[#c34c36]' : 'border-slate-300 bg-white'
                        }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Address details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{addr.name}</span>
                        <span className="text-xs font-semibold text-slate-500">| (+84) {addr.phone.replace(/^0/, '')}</span>
                        {addr.isDefault && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-[#c34c36] border border-[#c34c36]/40 rounded bg-red-50/70">
                            {lang === 'vi' ? 'Mặc định' : 'Default'}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 rounded">
                          {addr.addressType === 'office' ? (lang === 'vi' ? 'Văn Phòng' : 'Office') : (lang === 'vi' ? 'Nhà Riêng' : 'Home')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">
                        {addr.streetAddress}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditAddress(addr);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {lang === 'vi' ? 'Cập nhật' : 'Edit'}
                      </button>
                      {savedAddresses.length > 1 && !addr.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(addr.id);
                          }}
                          className="text-[11px] font-medium text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          {lang === 'vi' ? 'Xóa' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Address Button */}
              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#c34c36] hover:bg-[#fdf8f6]/40 text-slate-700 hover:text-[#c34c36] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Thêm Địa Chỉ Mới' : 'Add New Address'}</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83824] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Xác Nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopee-Style Modal: "Thêm / Cập Nhật Địa Chỉ" (Add/Edit Address Form Modal) */}
      {isAddressFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingAddress
                  ? (lang === 'vi' ? 'Cập Nhật Địa Chỉ Nhận Hàng' : 'Edit Delivery Address')
                  : (lang === 'vi' ? 'Thêm Địa Chỉ Nhận Hàng Mới' : 'New Delivery Address')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressFormOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {formErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formErrorMsg}</span>
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'vi' ? 'Họ và tên người nhận *' : 'Recipient Name *'}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {lang === 'vi' ? 'Số điện thoại nhận hàng *' : 'Phone Number *'}
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => {
                      setFormPhone(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="0912 345 678"
                    maxLength={10}
                    className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Email nhận thông báo Escrow & Hóa đơn (tùy chọn)' : 'Email for Notifications (optional)'}
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-slate-200 rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none focus:border-[#c34c36] transition"
                />
              </div>

              {/* Lalamove Address & Map Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'vi' ? 'Địa chỉ & Ghim vị trí Lalamove *' : 'Address & Map Pin *'}
                </label>
                <LalamoveAddressPicker
                  initialName={formName}
                  initialPhone={formPhone}
                  initialLatitude={formLat}
                  initialLongitude={formLng}
                  initialAddress={formStreet}
                  sellerCity={sellerCityInfo.name}
                  sellerLocation={listing.sellerAddress || listing.location}
                  onAddressConfirmed={(data) => {
                    setFormLat(data.latitude);
                    setFormLng(data.longitude);
                    setFormStreet(data.address);
                    setFormCity(data.city);
                    if (data.name && !formName) setFormName(data.name);
                    if (data.phone && !formPhone) setFormPhone(data.phone);
                    if (formErrorMsg) setFormErrorMsg(null);
                  }}
                  lang={lang}
                  title={lang === 'vi' ? 'Tìm địa chỉ & kéo ghim giao hàng' : 'Search address & drag pin'}
                  description={lang === 'vi' ? 'Lalamove sẽ dùng tọa độ ghim này để tính chính xác cước phí' : 'Coordinates will be used for shipping quote'}
                />
              </div>

              {/* Address Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  {lang === 'vi' ? 'Loại địa chỉ:' : 'Address Type:'}
                </label>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormType('home')}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${formType === 'home'
                      ? 'border-[#c34c36] bg-[#fdf8f6] text-[#c34c36]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Nhà Riêng' : 'Home'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('office')}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${formType === 'office'
                      ? 'border-[#c34c36] bg-[#fdf8f6] text-[#c34c36]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Văn Phòng' : 'Office'}</span>
                  </button>
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-[#c34c36] focus:ring-[#c34c36] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  {lang === 'vi' ? 'Thiết lập làm địa chỉ mặc định' : 'Set as default address'}
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsAddressFormOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Trở Lại' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleSaveAddressForm}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83824] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hoàn Thành' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
