import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Store,
  ShieldCheck,
  Truck,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Camera,
  CreditCard,
  FileCheck,
  Edit3,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Building,
  UploadCloud,
  Loader2,
  RefreshCw,
  LocateFixed,
  XCircle,
  Clock,
  ArrowLeft,
  Check
} from 'lucide-react';
import {
  sellerService,
  mediaService,
  shippingService,
  GhnLocation,
  SellerVerificationResponseDto,
  FALLBACK_PROVINCES,
  resolveProvinceFromText,
  normalizeAddressText,
  userService,
} from '../../services';
import { UserProfile, UserRole, Language } from '../../types';
import { LiveFaceScannerModal, VnptEkycResultData } from './LiveFaceScannerModal';
import { LalamoveAddressPicker } from '../common/LalamoveAddressPicker';
import { VietQrBankPicker } from '../common/VietQrBankPicker';
import { SellerCelebrationOverlay } from '../common/SellerCelebrationOverlay';
import {
  BANK_ACCOUNT_NUMBER_MAX_LENGTH,
  BANK_ACCOUNT_NUMBER_MIN_LENGTH,
  sanitizeBankAccountHolder,
  sanitizeBankAccountNumber,
  validateBankAccountFields,
} from '../../utils/bankAccountValidation';

interface SellerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  onRoleChange: (role: UserRole) => void;
  onNavigateToCreateListing?: () => void;
  lang?: Language;
}

const SHOP_NAME_MIN_LENGTH = 5;
const SHOP_NAME_MAX_LENGTH = 30;
const SHOP_NAME_VALID_REGEX = /^[\p{L}\p{N} ]+$/u;

function sanitizeShopName(value: string): string {
  return value.replace(/[^\p{L}\p{N} ]/gu, '').slice(0, SHOP_NAME_MAX_LENGTH);
}

function getDefaultShopName(user?: Pick<UserProfile, 'shopName' | 'name'>): string {
  const raw = user?.shopName || (user?.name ? `Gian hàng ${user.name}` : 'SecondLife Shop');
  const sanitized = sanitizeShopName(raw).trim();
  return sanitized.length >= SHOP_NAME_MIN_LENGTH ? sanitized : 'SecondLife Shop';
}

export const SellerRegistrationModal: React.FC<SellerRegistrationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onRoleChange,
  onNavigateToCreateListing,
  lang = 'vi',
}) => {
  if (!isOpen || !currentUser) return null;

  const isInternalRole = ['admin', 'staff', 'inspector'].includes(currentUser.role);
  if (isInternalRole) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
        <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 rounded-full bg-rose-50 text-[#c34c36] flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            {lang === 'vi' ? 'Không hỗ trợ đăng ký người bán' : 'Seller Registration Restricted'}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {lang === 'vi'
              ? 'Tài khoản Quản trị viên (Admin), Nhân viên (Staff) và Kỹ sư Hub (Inspector) không được phép đăng ký làm Người Bán trên sàn SecondLife nhằm đảm bảo tính minh bạch, độc lập và bảo mật hệ thống.'
              : 'Administrator, Staff, and Hub Inspector accounts are restricted from registering as Sellers on the platform to maintain system integrity and compliance.'}
          </p>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 text-white font-bold text-sm rounded-xl transition shadow-md shadow-[#c34c36]/20 cursor-pointer"
            >
              {lang === 'vi' ? 'Đã Hiểu và Đóng' : 'I Understand & Close'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAlreadySeller = currentUser.role === 'seller';
  const isRegistered = isAlreadySeller;

  // Form State
  const [shopName, setShopName] = useState(() => getDefaultShopName(currentUser));
  const [sellerPhone, setSellerPhone] = useState(currentUser.phone || '');
  const [pickupAddress, setPickupAddress] = useState(
    currentUser.pickupAddress || currentUser.address || ''
  );
  const [idCardNumber, setIdCardNumber] = useState(currentUser.idCardNumber || '');
  const [sellerBankName, setSellerBankName] = useState(
    currentUser.bankAccount?.bankName || ''
  );
  const [sellerAccountNumber, setSellerAccountNumber] = useState(
    sanitizeBankAccountNumber(currentUser.bankAccount?.accountNumber || '')
  );
  const [sellerAccountHolder, setSellerAccountHolder] = useState(
    sanitizeBankAccountHolder(currentUser.bankAccount?.accountHolder || currentUser.name || '')
  );
  const [sellerProductTypes, setSellerProductTypes] = useState(
    currentUser.productTypes || ''
  );
  const [sellerTermsAgreed, setSellerTermsAgreed] = useState(true);

  // Photo States & Files for Batch Upload (media/upload-multiple)
  const [docFrontUrl, setDocFrontUrl] = useState<string>('');
  const [docBackUrl, setDocBackUrl] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [selfiePreview, setSelfiePreview] = useState<string>('');
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);

  // VNPT eKYC Session & Token for BE verification
  const [vnptClientSession, setVnptClientSession] = useState<string>('');
  const [vnptToken, setVnptToken] = useState<string>('');
  const [vnptLivenessResult, setVnptLivenessResult] = useState<any>(null);

  // Onboarding Shop Email & OTP Verification States
  const [shopEmail, setShopEmail] = useState<string>(currentUser.email || '');
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isVerifyingBeforeSubmit, setIsVerifyingBeforeSubmit] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isEmailVerifiedForOnboarding, setIsEmailVerifiedForOnboarding] = useState(false);
  const isUsingVerifiedAccountEmail = Boolean(
    currentUser?.emailVerified &&
    currentUser?.email &&
    shopEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
  );
  const isShopEmailReady = isEmailVerifiedForOnboarding || isUsingVerifiedAccountEmail;
  const [inlineOtpCode, setInlineOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSentSuccess, setOtpSentSuccess] = useState<string | null>(null);
  const [hasSentOtp, setHasSentOtp] = useState(false);
  const [savedImageUrls, setSavedImageUrls] = useState<{ front: string; back: string; selfie: string }>({
    front: '',
    back: '',
    selfie: '',
  });
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Verification state & registration check
  const [existingVerification, setExistingVerification] = useState<SellerVerificationResponseDto | null>(null);
  const [cooldownUnlockAt, setCooldownUnlockAt] = useState<Date | null>(null);
  const [cooldownServerMsg, setCooldownServerMsg] = useState<string | null>(null);

  const MAX_DAILY_REJECTED_SUBMISSIONS = 5;
  const SUBMISSION_COOLDOWN_HOURS = 24;

  const formatCooldownUnlockTime = (date: Date): string => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return `${get('hour')}:${get('minute')} ngày ${get('day')}/${get('month')}/${get('year')}`;
  };

  const syncRejectionCooldown = async (status?: string | null) => {
    if (status !== 'REJECTED') {
      setCooldownUnlockAt(null);
      setCooldownServerMsg(null);
      return;
    }
    try {
      const history = await sellerService.getVerificationHistory();
      const windowStartMs = Date.now() - SUBMISSION_COOLDOWN_HOURS * 3600 * 1000;
      const recentRejectedTimestamps = (Array.isArray(history) ? history : [])
        .filter((item) => item.status === 'REJECTED' && item.submittedAt)
        .map((item) => Date.parse(item.submittedAt))
        .filter((ts) => Number.isFinite(ts) && ts >= windowStartMs);

      if (recentRejectedTimestamps.length >= MAX_DAILY_REJECTED_SUBMISSIONS) {
        const latestRejectedMs = Math.max(...recentRejectedTimestamps);
        const unlockDate = new Date(latestRejectedMs + SUBMISSION_COOLDOWN_HOURS * 3600 * 1000);
        if (unlockDate.getTime() > Date.now()) {
          setCooldownUnlockAt(unlockDate);
          return;
        }
      }
      setCooldownUnlockAt(null);
    } catch {
      // Keep any server-provided cooldown notice if history fetch fails
    }
  };

  const isApprovedSeller = currentUser.role === 'seller' || isAlreadySeller || existingVerification?.status === 'APPROVED';
  const verStatus = existingVerification?.status || null;
  const isPendingReview = Boolean(
    existingVerification &&
    ['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(verStatus)
  );
  const isProviderErrorPending = Boolean(
    existingVerification?.status === 'EKYC_PENDING' &&
    existingVerification?.ekycStatus === 'PROVIDER_ERROR'
  );
  const isResubmitRequired = Boolean(verStatus === 'RESUBMIT_REQUIRED');
  const isRejected = Boolean(verStatus === 'REJECTED');
  const isCooldownLocked = Boolean(
    isRejected && ((cooldownUnlockAt && cooldownUnlockAt.getTime() > Date.now()) || cooldownServerMsg)
  );
  const hasRegistered = Boolean(isApprovedSeller || isPendingReview || isResubmitRequired || isRejected);

  // UI state
  const [isCheckingVerification, setIsCheckingVerification] = useState<boolean>(Boolean(isOpen && !isAlreadySeller));
  const [showForm, setShowForm] = useState(!hasRegistered);
  const [showApprovalCelebration, setShowApprovalCelebration] = useState(false);

  const finishCelebrationAndRelogin = () => {
    setShowApprovalCelebration(false);
    try {
      sessionStorage.removeItem('seller_upgrade_celebrating');
      sessionStorage.setItem('seller_upgrade_relogin', '1');
    } catch { }
    window.dispatchEvent(new CustomEvent('unauthorized_session', { detail: { reason: 'seller_upgrade_complete' } }));
  };

  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem('seller_upgrade_celebrating'); } catch { }
    };
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 3-step registration wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const getShopNameValidationError = (rawName: string): string | null => {
    const cleanShop = rawName.trim();
    if (!cleanShop) {
      return lang === 'vi' ? 'Vui lòng nhập tên gian hàng / cửa hàng.' : 'Please enter store name.';
    }
    if (cleanShop.length < SHOP_NAME_MIN_LENGTH) {
      return lang === 'vi'
        ? `Tên gian hàng phải có tối thiểu ${SHOP_NAME_MIN_LENGTH} ký tự.`
        : `Store name must be at least ${SHOP_NAME_MIN_LENGTH} characters.`;
    }
    if (cleanShop.length > SHOP_NAME_MAX_LENGTH) {
      return lang === 'vi'
        ? `Tên gian hàng tối đa ${SHOP_NAME_MAX_LENGTH} ký tự.`
        : `Store name must be at most ${SHOP_NAME_MAX_LENGTH} characters.`;
    }
    if (!SHOP_NAME_VALID_REGEX.test(cleanShop)) {
      return lang === 'vi'
        ? 'Tên gian hàng không được chứa ký tự đặc biệt (chỉ gồm chữ cái, số và khoảng trắng).'
        : 'Store name cannot contain special characters (letters, numbers, and spaces only).';
    }
    return null;
  };

  const validateStep1 = (): boolean => {
    setErrorMsg(null);
    const shopError = getShopNameValidationError(shopName);
    if (shopError) {
      setErrorMsg(shopError);
      return false;
    }

    const cleanPhone = sellerPhone.replace(/\s+/g, '').trim();
    if (!cleanPhone) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập số điện thoại.' : 'Please enter phone number.');
      return false;
    }
    const phoneRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg(
        lang === 'vi'
          ? 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).'
          : 'Invalid phone number (must be 10 digits starting with 03, 05, 07, 08, 09).'
      );
      return false;
    }

    const cleanEmail = shopEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập đúng định dạng email gian hàng (VD: name@example.com).' : 'Please enter a valid shop email.');
      return false;
    }

    if (!isShopEmailReady) {
      setErrorMsg(
        lang === 'vi'
          ? 'Email gian hàng chưa được xác thực OTP. Vui lòng bấm "Gửi mã OTP" và hoàn thành xác thực trước khi sang Bước 2.'
          : 'Shop email has not been verified with OTP. Please verify email before proceeding to Step 2.'
      );
      if (!hasSentOtp) {
        handleSendOtpInline();
      } else {
        setIsVerifyingBeforeSubmit(false);
        setIsOtpModalOpen(true);
      }
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    setErrorMsg(null);
    if (!pickupAddress.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập hoặc chọn địa chỉ kho lấy hàng trên bản đồ.' : 'Please enter pickup warehouse address.');
      return false;
    }
    if ((!isApprovedSeller && !isWarehouseConfirmed) || !pickupLatitude || !pickupLongitude) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng ghim vị trí kho trên bản đồ (hoặc bấm "Dùng vị trí hiện tại của tôi") để hoàn tất Bước 2.'
          : 'Please pin warehouse location on map to complete Step 2.'
      );
      return false;
    }
    const bankError = validateBankAccountFields({
      bankName: sellerBankName,
      accountNumber: sellerAccountNumber,
      accountHolder: sellerAccountHolder,
      lang,
    });
    if (bankError) {
      setErrorMsg(bankError);
      return false;
    }
    return true;
  };

  // BE Shipping & Pickup Address state
  const [pickupLatitude, setPickupLatitude] = useState<number | null>(currentUser.latitude ?? null);
  const [pickupLongitude, setPickupLongitude] = useState<number | null>(currentUser.longitude ?? null);
  const [isWarehouseConfirmed, setIsWarehouseConfirmed] = useState(false);

  const saveConfirmedWarehouse = () => {
    if ((!isApprovedSeller && !isWarehouseConfirmed) || !pickupLatitude || !pickupLongitude || !pickupAddress.trim()) {
      throw new Error(lang === 'vi' ? 'Vui lòng xác nhận vị trí kho trên bản đồ.' : 'Confirm the pickup location on the map.');
    }
    const name = shopName.trim().slice(0, 30);
    const phone = sellerPhone.replace(/\s+/g, '').trim();
    return shippingService.saveSellerOnboarding({
      shopName: name,
      email: shopEmail.trim(),
      phone,
      pickupAddress: { name, phone, address: pickupAddress.trim(), latitude: pickupLatitude, longitude: pickupLongitude },
    });
  };

  const openFaceScanner = async () => {
    try {
      const onboarding = await saveConfirmedWarehouse();
      if (!onboarding.canStartEkyc) throw new Error(lang === 'vi' ? 'Vui lòng xác thực OTP email gian hàng.' : 'Verify the shop email first.');
      setIsFaceScannerOpen(true);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Không thể lưu địa chỉ kho.');
    }
  };
  const [provinces, setProvinces] = useState<GhnLocation[]>(FALLBACK_PROVINCES);
  const [wards, setWards] = useState<GhnLocation[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | string | ''>('');
  const [selectedWardId, setSelectedWardId] = useState<number | string | ''>('');
  const [streetAddress, setStreetAddress] = useState('');
  const [isLoadingAddressFromBe, setIsLoadingAddressFromBe] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [pickupLockReason, setPickupLockReason] = useState<string | null>(null);

  // Fetch address and catalogue from Backend
  const fetchAddressFromBackend = async (showNotification = false) => {
    setIsLoadingAddressFromBe(true);
    try {
      const [onboardingData, savedPickup, pickupStatus] = await Promise.all([
        shippingService.getSellerOnboarding().catch(() => null),
        isApprovedSeller ? shippingService.getPickupAddress() : Promise.resolve(null),
        isApprovedSeller ? shippingService.getPickupAddressUpdateStatus() : Promise.resolve(null),
      ]);
      if (pickupStatus) {
        setPickupLockReason(
          pickupStatus.updatable
            ? null
            : (pickupStatus.reason || 'Không thể thay đổi địa chỉ lấy hàng lúc này.')
        );
      }

      let addressFound = false;

      if (onboardingData) {
        const ob = onboardingData;
        if (ob.shopName) {
          const cleanObShop = sanitizeShopName(ob.shopName);
          if (cleanObShop.trim().length >= SHOP_NAME_MIN_LENGTH) {
            setShopName((prev) => (prev && prev.trim() !== '' ? prev : cleanObShop));
          }
        }
        if (ob.phone) setSellerPhone((prev) => (prev && prev.trim() !== '' ? prev : ob.phone));
        if (ob.email) setShopEmail((prev) => (prev && prev.trim() !== '' ? prev : ob.email));
        setIsEmailVerifiedForOnboarding(Boolean(ob.emailVerified));

        if (ob.pickupAddress) {
          const pa = ob.pickupAddress;
          if (pa.latitude && pa.longitude) {
            setPickupLatitude((prev) => (prev !== null ? prev : pa.latitude));
            setPickupLongitude((prev) => (prev !== null ? prev : pa.longitude));
          }
          const fullAddr = pa.address || [pa.address, pa.wardName, pa.provinceName].filter(Boolean).join(', ');
          if (fullAddr) {
            setPickupAddress((prev) => (prev && prev.trim() !== '' ? prev : fullAddr));
            setStreetAddress((prev) => (prev && prev.trim() !== '' ? prev : (pa.address || '')));
            addressFound = true;
          }
        }
        if (ob.provinceId) {
          setSelectedProvinceId((prev) => {
            if (prev) return prev;
            shippingService.getWards(ob.provinceId)
              .then((wList) => setWards(Array.isArray(wList) ? wList : []))
              .catch(() => setWards([]));
            return ob.provinceId;
          });
        }
        if (ob.wardId) {
          setSelectedWardId((prev) => (prev ? prev : ob.wardId));
        }
      }

      if (savedPickup?.address) {
        setPickupAddress(savedPickup.address);
        setStreetAddress(savedPickup.address);
        setPickupLatitude(savedPickup.latitude ?? null);
        setPickupLongitude(savedPickup.longitude ?? null);
        addressFound = true;
      }

      if (!addressFound && !isApprovedSeller && currentUser?.address) {
        setPickupAddress((prev) => (prev && prev.trim() !== '' ? prev : currentUser.address));
        setStreetAddress((prev) => (prev && prev.trim() !== '' ? prev : currentUser.address));
      }

      if (showNotification) {
        if (addressFound) {
          setSuccessMsg(lang === 'vi' ? 'Đã lấy thành công địa chỉ kho đã lưu từ hệ thống BE!' : 'Synced address from BE!');
        } else {
          setSuccessMsg(lang === 'vi' ? 'Đã đồng bộ thông tin từ BE (vui lòng chọn Tỉnh/Phường bên dưới).' : 'Synced from BE!');
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.warn('fetchAddressFromBackend error:', err);
    } finally {
      setIsLoadingAddressFromBe(false);
    }
  };

  const updateCombinedAddress = (pId: number | string | '', wId: number | string | '', street: string) => {
    const pObj = Array.isArray(provinces) ? provinces.find((p) => String(p._id) === String(pId)) : undefined;
    const wObj = Array.isArray(wards) ? wards.find((w) => String(w._id) === String(wId)) : undefined;
    const parts = [
      street.trim(),
      wObj ? wObj.name : '',
      pObj ? pObj.name : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      setPickupAddress(parts.join(', '));
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const pId = rawVal ? (isNaN(Number(rawVal)) ? rawVal : Number(rawVal)) : '';
    setSelectedProvinceId(pId);
    setSelectedWardId('');
    if (pId) {
      setIsLoadingWards(true);
      try {
        const pIdNum = Number(pId);
        const wList = await shippingService.getWards(isNaN(pIdNum) ? pId : pIdNum);
        setWards(Array.isArray(wList) ? wList : []);
      } catch (err) {
        console.warn('handleProvinceChange error:', err);
        setWards([]);
      } finally {
        setIsLoadingWards(false);
      }
    } else {
      setWards([]);
    }
    updateCombinedAddress(pId, '', streetAddress);
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const wId = rawVal ? (isNaN(Number(rawVal)) ? rawVal : Number(rawVal)) : '';
    setSelectedWardId(wId);
    updateCombinedAddress(selectedProvinceId, wId, streetAddress);
  };

  const handleStreetAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setStreetAddress(text);
    updateCombinedAddress(selectedProvinceId, selectedWardId, text);
  };

  // Định vị GPS trực tiếp & tự động điền địa chỉ kho
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg(
        lang === 'vi'
          ? 'Trình duyệt của bạn không hỗ trợ tính năng định vị GPS.'
          : 'Geolocation is not supported by your browser.'
      );
      return;
    }

    setIsDetectingLocation(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          let addressData: any = null;
          let bdcData: any = null;

          // 1. Gọi song song OpenStreetMap Nominatim & BigDataCloud
          const [nomResult, bdcResult] = await Promise.allSettled([
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=vi`,
              { headers: { 'User-Agent': 'SecondLifeApp/1.0' } }
            ).then((r) => (r.ok ? r.json() : null)),
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
            ).then((r) => (r.ok ? r.json() : null)),
          ]);

          if (nomResult.status === 'fulfilled' && nomResult.value) {
            addressData = nomResult.value;
          }
          if (bdcResult.status === 'fulfilled' && bdcResult.value) {
            bdcData = bdcResult.value;
          }

          const addr = addressData?.address || {};
          const houseNumber = addr.house_number || '';
          const road = addr.road || addr.street || addr.suburb || addr.pedestrian || bdcData?.locality || '';
          const detectedStreet = [houseNumber, road].filter(Boolean).join(' ').trim();

          // Thu thập tất cả các từ khoá địa danh phát hiện được
          const rawCandidates: string[] = [
            addr.suburb,
            addr.quarter,
            addr.neighbourhood,
            addr.city,
            addr.town,
            addr.county,
            addr.state,
            addr.province,
            bdcData?.principalSubdivision,
            bdcData?.city,
            bdcData?.locality,
            ...(bdcData?.localityInfo?.informative || []).map((x: any) => x?.name),
            ...(bdcData?.localityInfo?.administrative || []).map((x: any) => x?.name),
            addressData?.display_name,
          ].filter(Boolean);

          // Nhận diện Tỉnh / Thành phố tối ưu (khắc phục lỗi OSM gộp Vũng Tàu, Biên Hoà... vào TP.HCM)
          const matchedProvince = resolveProvinceFromText(rawCandidates, provinces);

          if (detectedStreet) {
            setStreetAddress(detectedStreet);
          }

          let matchedWardName = '';
          if (matchedProvince) {
            setSelectedProvinceId(matchedProvince._id);
            setIsLoadingWards(true);
            try {
              const wList = await shippingService.getWards(matchedProvince._id);
              const validWards = Array.isArray(wList) ? wList : [];
              setWards(validWards);

              // Danh sách ứng viên phường/xã
              const wardCandidates: string[] = [
                addr.suburb,
                addr.quarter,
                addr.neighbourhood,
                addr.ward,
                addr.city_district,
                bdcData?.locality,
              ].filter(Boolean);

              let foundWard = undefined;
              for (const cand of wardCandidates) {
                const normCand = normalizeAddressText(cand);
                if (!normCand) continue;
                foundWard = validWards.find((w) => {
                  const normW = normalizeAddressText(w.name);
                  return (
                    normW === normCand ||
                    normW.includes(normCand) ||
                    normCand.includes(normW) ||
                    w.name.toLowerCase().includes(cand.toLowerCase())
                  );
                });
                if (foundWard) break;
              }

              if (foundWard) {
                setSelectedWardId(foundWard._id);
                matchedWardName = foundWard.name;
              } else if (validWards.length > 0) {
                setSelectedWardId(validWards[0]._id);
                matchedWardName = validWards[0].name;
              }
            } catch (wErr) {
              console.warn('Lỗi tải danh sách phường xã khi định vị:', wErr);
            } finally {
              setIsLoadingWards(false);
            }
          }

          // Tổng hợp địa chỉ đầy đủ
          const combined = [
            detectedStreet || streetAddress,
            matchedWardName,
            matchedProvince ? matchedProvince.name : (addr.city || addr.state || ''),
          ]
            .filter(Boolean)
            .join(', ');

          const finalAddress = combined || addressData?.display_name || 'Vị trí hiện tại';
          setPickupAddress(finalAddress);

          setSuccessMsg(
            lang === 'vi'
              ? '📍 Đã tự động điền vị trí hiện tại! Bạn có thể tự do chỉnh sửa lại các ô bên dưới nếu cần.'
              : '📍 Location auto-filled! You can freely edit any fields below.'
          );
          setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err) {
          console.warn('Geolocation parsing error:', err);
          setErrorMsg(
            lang === 'vi'
              ? 'Không thể phân tích địa chỉ từ toạ độ. Vui lòng tự chọn thông tin bên dưới.'
              : 'Could not resolve address from coordinates. Please select manually.'
          );
          setTimeout(() => setErrorMsg(null), 5000);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        let msg = lang === 'vi' ? 'Không thể lấy toạ độ vị trí hiện tại.' : 'Unable to retrieve location coordinates.';
        if (err.code === 1) {
          msg = lang === 'vi' ? 'Quyền truy cập vị trí đã bị từ chối trên trình duyệt.' : 'Location permission denied in browser.';
        } else if (err.code === 2) {
          msg = lang === 'vi' ? 'Không bắt được tín hiệu định vị GPS.' : 'Position unavailable.';
        } else if (err.code === 3) {
          msg = lang === 'vi' ? 'Quá thời gian chờ phản hồi định vị (timeout).' : 'Location request timed out.';
        }
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Load provinces, saved pickup address, and authoritative verification state on open
  useEffect(() => {
    if (!isOpen) {
      setIsCheckingVerification(false);
      return;
    }

    let isSubscribed = true;
    setIsCheckingVerification(!isAlreadySeller);

    shippingService.getProvinces()
      .then((pList) => {
        if (isSubscribed && Array.isArray(pList) && pList.length > 0) {
          setProvinces(pList);
        }
      })
      .catch((err) => console.warn('Load provinces fallback:', err));
    fetchAddressFromBackend(false);

    (async () => {
      try {
        const verif = await sellerService.getMyVerification();
        if (!isSubscribed) return;

        if (verif) {
          setExistingVerification(verif);
          if (verif.documentNumber) setIdCardNumber((prev) => prev?.trim() ? prev : verif.documentNumber);
          if (verif.documentFrontUrl) {
            setDocFrontUrl((prev) => prev || verif.documentFrontUrl);
            setFrontPreview((prev) => prev || verif.documentFrontUrl);
          }
          if (verif.documentBackUrl) {
            setDocBackUrl((prev) => prev || verif.documentBackUrl);
            setBackPreview((prev) => prev || verif.documentBackUrl);
          }
          if (verif.selfieUrl) {
            setSelfieUrl((prev) => prev || verif.selfieUrl);
            setSelfiePreview((prev) => prev || verif.selfieUrl);
          }

          await syncRejectionCooldown(verif.status);
          if (!isSubscribed) return;

          if (verif.status === 'RESUBMIT_REQUIRED') {
            setShowForm(true);
            setCurrentStep(3);
          } else {
            setShowForm(false);
          }

          if (['APPROVED', 'SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(verif.status)) {
            if (currentUser?.id) localStorage.setItem(`seller_registered_${currentUser.id}`, 'true');
            if (currentUser?.email) localStorage.setItem(`seller_registered_${currentUser.email}`, 'true');
          }
        } else {
          setExistingVerification(null);
          await syncRejectionCooldown(null);
          if (!isSubscribed) return;
          setShowForm(currentUser.role !== 'seller');
        }
      } catch {
        if (!isSubscribed) return;
        setExistingVerification(null);
        await syncRejectionCooldown(null);
        if (!isSubscribed) return;
        setShowForm(currentUser.role !== 'seller');
      } finally {
        if (isSubscribed) {
          setIsCheckingVerification(false);
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  const DRAFT_KEY = `seller_reg_draft_${currentUser?.id || 'default'}`;
  const isInitializedRef = useRef(false);

  // Restore draft on open (or fallback to currentUser profile) - only run ONCE per modal open
  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      return;
    }
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    setCurrentStep(1);

    // 1. First check if a saved draft exists (restore field values without overriding server verification status)
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.shopName) setShopName(sanitizeShopName(d.shopName));
        if (d.sellerPhone) setSellerPhone(d.sellerPhone);
        if (d.pickupAddress) setPickupAddress(d.pickupAddress);
        if (d.streetAddress) setStreetAddress(d.streetAddress);
        if (d.selectedProvinceId) {
          setSelectedProvinceId(d.selectedProvinceId);
          shippingService.getWards(d.selectedProvinceId)
            .then((wList) => setWards(Array.isArray(wList) ? wList : []))
            .catch(() => { });
        }
        if (d.selectedWardId) setSelectedWardId(d.selectedWardId);
        if (d.idCardNumber) setIdCardNumber(d.idCardNumber);
        if (d.sellerBankName) setSellerBankName(d.sellerBankName);
        if (d.sellerAccountNumber) setSellerAccountNumber(sanitizeBankAccountNumber(d.sellerAccountNumber));
        if (d.sellerAccountHolder) setSellerAccountHolder(sanitizeBankAccountHolder(d.sellerAccountHolder));
        if (d.docFrontUrl) {
          setDocFrontUrl(d.docFrontUrl);
          setFrontPreview(d.docFrontUrl);
        } else if (d.frontPreview) {
          setFrontPreview(d.frontPreview);
        }
        if (d.docBackUrl) {
          setDocBackUrl(d.docBackUrl);
          setBackPreview(d.docBackUrl);
        } else if (d.backPreview) {
          setBackPreview(d.backPreview);
        }
        if (d.selfieUrl && /^https?:\/\//i.test(d.selfieUrl)) {
          setSelfieUrl(d.selfieUrl);
          setSelfiePreview(d.selfieUrl);
        } else if (d.selfiePreview || d.selfieUrl) {
          setSelfiePreview(d.selfiePreview || d.selfieUrl);
        }
      }
    } catch (e) {
      console.warn('Error restoring seller draft:', e);
    }

    // 2. Initial values from currentUser for any remaining empty fields
    if (currentUser) {
      setShopName((prev) => prev?.trim() ? prev : getDefaultShopName(currentUser));
      setSellerPhone((prev) => prev?.trim() ? prev : (currentUser.phone || ''));
      setPickupAddress((prev) => prev?.trim() ? prev : (currentUser.pickupAddress || currentUser.address || ''));
      if (currentUser.idCardNumber) setIdCardNumber((prev) => prev?.trim() ? prev : currentUser.idCardNumber);
      if (currentUser.bankAccount?.bankName) setSellerBankName((prev) => prev?.trim() ? prev : currentUser.bankAccount.bankName);
      if (currentUser.bankAccount?.accountNumber) {
        setSellerAccountNumber((prev) => prev?.trim() ? prev : sanitizeBankAccountNumber(currentUser.bankAccount.accountNumber));
      }
      if (currentUser.bankAccount?.accountHolder) {
        setSellerAccountHolder((prev) => prev?.trim() ? prev : sanitizeBankAccountHolder(currentUser.bankAccount.accountHolder));
      }
    }
  }, [isOpen, DRAFT_KEY]);

  // Auto-save form draft whenever any field changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const draft = {
        shopName,
        sellerPhone,
        pickupAddress,
        streetAddress,
        selectedProvinceId,
        selectedWardId,
        idCardNumber,
        sellerBankName,
        sellerAccountNumber,
        sellerAccountHolder,
        docFrontUrl,
        frontPreview: frontPreview?.startsWith('http') || frontPreview?.startsWith('data:') ? frontPreview : '',
        docBackUrl,
        backPreview: backPreview?.startsWith('http') || backPreview?.startsWith('data:') ? backPreview : '',
        selfieUrl,
        selfiePreview: selfiePreview?.startsWith('http') || selfiePreview?.startsWith('data:') ? selfiePreview : '',
        isEmailVerifiedForOnboarding,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { }
  }, [
    isOpen,
    shopName,
    sellerPhone,
    pickupAddress,
    streetAddress,
    selectedProvinceId,
    selectedWardId,
    idCardNumber,
    sellerBankName,
    sellerAccountNumber,
    sellerAccountHolder,
    docFrontUrl,
    frontPreview,
    docBackUrl,
    backPreview,
    selfieUrl,
    selfiePreview,
    isEmailVerifiedForOnboarding,
    DRAFT_KEY
  ]);

  // Helper to convert an image file to a compressed base64 data URL for preview and draft persistence
  const createCompressedDataUrl = (file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) return resolve('');
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(result);
          }
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const dataURLtoFile = (dataurl: string, filename: string): File | null => {
    try {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (err) {
      console.warn('Error converting dataURL to File:', err);
      return null;
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (field === 'front') {
      setFrontFile(file);
      setDocFrontUrl(''); // Reset remote url so batch upload will process this new file
    } else if (field === 'back') {
      setBackFile(file);
      setDocBackUrl('');
    } else if (field === 'selfie') {
      setSelfieFile(file);
      setSelfieUrl('');
    }

    try {
      const dataUrl = await createCompressedDataUrl(file);
      if (field === 'front') setFrontPreview(dataUrl);
      else if (field === 'back') setBackPreview(dataUrl);
      else if (field === 'selfie') setSelfiePreview(dataUrl);
    } catch {
      const fallbackUrl = URL.createObjectURL(file);
      if (field === 'front') setFrontPreview(fallbackUrl);
      else if (field === 'back') setBackPreview(fallbackUrl);
      else if (field === 'selfie') setSelfiePreview(fallbackUrl);
    }
    setErrorMsg(null);
  };

  const handleFaceCapturedFromCamera = (
    url: string,
    file?: File,
    previewUrl?: string,
    vnptData?: VnptEkycResultData
  ) => {
    const isRemoteUrl = /^https?:\/\//i.test(url);
    setSelfieUrl(isRemoteUrl ? url : '');
    if (file) setSelfieFile(file);
    if (previewUrl) {
      setSelfiePreview(previewUrl);
    } else if (url) {
      setSelfiePreview(url);
    }
    if (vnptData?.clientSession) setVnptClientSession(vnptData.clientSession);
    if (vnptData?.token) setVnptToken(vnptData.token);
    if (vnptData?.livenessFace) setVnptLivenessResult(vnptData.livenessFace);
    setErrorMsg(null);
  };

  const handleMultipleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    if (files[0]) {
      setFrontFile(files[0]);
      setDocFrontUrl('');
      try {
        const u = await createCompressedDataUrl(files[0]);
        setFrontPreview(u);
      } catch {
        setFrontPreview(URL.createObjectURL(files[0]));
      }
    }
    if (files[1]) {
      setBackFile(files[1]);
      setDocBackUrl('');
      try {
        const u = await createCompressedDataUrl(files[1]);
        setBackPreview(u);
      } catch {
        setBackPreview(URL.createObjectURL(files[1]));
      }
    }
    if (files[2]) {
      setSelfieFile(files[2]);
      setSelfieUrl('');
      try {
        const u = await createCompressedDataUrl(files[2]);
        setSelfiePreview(u);
      } catch {
        setSelfiePreview(URL.createObjectURL(files[2]));
      }
    }
    setErrorMsg(null);
  };

  const handleSendOtpInline = async () => {
    const targetEmail = (shopEmail || currentUser.email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : 'Please enter a valid email.');
      return;
    }
    setIsSendingOtp(true);
    setErrorMsg(null);
    setOtpError(null);
    setOtpSentSuccess(null);
    try {
      const cleanPhone = (sellerPhone || '').replace(/\s+/g, '').trim() || '0900000000';
      const cleanShop = (shopName || '').trim().slice(0, 30) || 'SecondLife Shop';

      await shippingService.saveSellerOnboarding({
        shopName: cleanShop,
        email: targetEmail,
        phone: cleanPhone,
      });

      await shippingService.sendSellerOnboardingEmailCode();
      setHasSentOtp(true);
      setOtpCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setIsVerifyingBeforeSubmit(false);
      setIsOtpModalOpen(true);
      setOtpSentSuccess(
        lang === 'vi'
          ? `Đã gửi mã xác thực 6 số đến ${targetEmail}. Vui lòng kiểm tra hộp thư (hoặc mục Spam).`
          : `Sent 6-digit OTP code to ${targetEmail}. Please check inbox or spam.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'vi' ? 'Không thể gửi mã OTP. Vui lòng thử lại.' : 'Failed to send OTP.'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtpInline = async () => {
    const code = inlineOtpCode.trim();
    if (code.length !== 6) {
      setOtpError(lang === 'vi' ? 'Vui lòng nhập đủ 6 chữ số mã OTP.' : 'Please enter 6-digit OTP.');
      return;
    }
    setIsSubmittingOtp(true);
    setOtpError(null);
    try {
      await shippingService.verifySellerOnboardingEmailCode(code);
      setIsEmailVerifiedForOnboarding(true);
      setOtpSentSuccess(
        lang === 'vi'
          ? 'Xác thực email thành công! Bạn đã đủ điều kiện tiếp tục eKYC.'
          : 'Email verified! Ready for eKYC.'
      );
      setOtpError(null);
    } catch (err: any) {
      setOtpError(err.message || (lang === 'vi' ? 'Mã OTP không đúng hoặc đã hết hạn.' : 'Invalid or expired OTP.'));
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgressMsg(null);

    // If user presses Enter in Step 1 or Step 2, advance to next step
    if (!isApprovedSeller && currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
      return;
    }
    if (!isApprovedSeller && currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
      return;
    }

    if (!isApprovedSeller && !validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!isApprovedSeller && !validateStep2()) {
      setCurrentStep(2);
      return;
    }

    if (isPendingReview) {
      setErrorMsg(
        lang === 'vi'
          ? 'Hồ sơ của bạn đang được Ban Quản trị xét duyệt. Bạn không thể gửi lại yêu cầu lúc này. Vui lòng chờ kết quả phê duyệt trong 24 giờ.'
          : 'Your application is pending review. You cannot resubmit at this time.'
      );
      return;
    }

    const shopError = getShopNameValidationError(shopName);
    if (shopError) {
      setErrorMsg(shopError);
      return;
    }
    if (!sellerPhone.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập số điện thoại kinh doanh.' : 'Please enter phone number.');
      return;
    }
    if (!pickupAddress.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập địa chỉ kho bưu tá lấy hàng.' : 'Please enter pickup warehouse address.');
      return;
    }

    const isAlreadySeller = Boolean(
      isApprovedSeller ||
      existingVerification?.status === 'APPROVED' ||
      (existingVerification?.status as any) === 'VERIFIED'
    );

    if (isAlreadySeller) {
      setIsSubmitting(true);
      try {
        const cleanPhone = (sellerPhone || '').replace(/\s+/g, '').trim();
        const cleanShop = (shopName || '').trim().slice(0, 30);

        if (pickupLockReason) {
          throw new Error(pickupLockReason);
        }
        if (!isWarehouseConfirmed || pickupLatitude == null || pickupLongitude == null) {
          throw new Error(lang === 'vi' ? 'Vui lòng xác nhận vị trí kho trên bản đồ.' : 'Confirm the pickup location on the map.');
        }
        const savedPickup = await shippingService.savePickupAddress({
          name: cleanShop,
          phone: cleanPhone,
          latitude: pickupLatitude,
          longitude: pickupLongitude,
        });
        const savedPickupAddress = savedPickup.address || pickupAddress;
        const savedPickupLat = savedPickup.latitude ?? pickupLatitude;
        const savedPickupLng = savedPickup.longitude ?? pickupLongitude;
        setPickupAddress(savedPickupAddress);
        setPickupLatitude(savedPickupLat);
        setPickupLongitude(savedPickupLng);

        if (currentUser?.id) localStorage.setItem(`seller_registered_${currentUser.id}`, 'true');
        if (currentUser?.email) localStorage.setItem(`seller_registered_${currentUser.email}`, 'true');

        const updated: UserProfile = {
          ...currentUser,
          isSellerRegistered: true,
          role: 'seller',
          kycStatus: 'verified',
          shopName: cleanShop,
          pickupAddress: savedPickupAddress,
          latitude: savedPickupLat,
          longitude: savedPickupLng,
          idCardNumber: idCardNumber.trim(),
          bankAccount: {
            bankName: sellerBankName.trim(),
            accountNumber: sellerAccountNumber.trim(),
            accountHolder: sellerAccountHolder.trim(),
          },
        };

        setShowForm(false);
        onUpdateProfile(updated);
        setSuccessMsg(
          lang === 'vi'
            ? 'Đã cập nhật địa chỉ kho lấy hàng.'
            : 'Warehouse pickup address saved.'
        );
        setTimeout(() => setSuccessMsg(null), 6000);
        return;
      } catch (err: any) {
        setErrorMsg(err.message || 'Cập nhật thất bại. Vui lòng thử lại.');
        setTimeout(() => setErrorMsg(null), 6000);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!idCardNumber.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập số CCCD để xác minh danh tính người bán.' : 'Please enter citizen ID.');
      return;
    }
    const effectiveFrontFile = frontFile || (frontPreview?.startsWith('data:') ? dataURLtoFile(frontPreview, 'cccd_front.jpg') : null);
    const effectiveBackFile = backFile || (backPreview?.startsWith('data:') ? dataURLtoFile(backPreview, 'cccd_back.jpg') : null);
    const effectiveSelfieFile = selfieFile || (selfiePreview?.startsWith('data:') ? dataURLtoFile(selfiePreview, 'selfie.jpg') : null);

    const hasFront = Boolean(effectiveFrontFile || docFrontUrl);
    const hasBack = Boolean(effectiveBackFile || docBackUrl);
    if (!hasFront || !hasBack) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng chọn đầy đủ ảnh CCCD mặt trước và mặt sau.'
          : 'Please select both front and back Citizen ID photos.'
      );
      return;
    }
    if (!sellerTermsAgreed) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng đồng ý với cam kết chất lượng Hub và cơ chế Escrow.'
          : 'Please agree to Hub inspection and Escrow terms.'
      );
      return;
    }

    if (!isShopEmailReady) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng xác thực email gian hàng trước khi thực hiện eKYC (Bấm "Gửi mã OTP" và nhập mã xác thực bên dưới).'
          : 'Please verify shop email before starting eKYC.'
      );
      if (!hasSentOtp) {
        handleSendOtpInline();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Tối ưu: Tải lên nhiều ảnh cùng lúc bằng POST /media/upload-multiple thay vì 3 request rời rạc
      const isRemoteUrl = (u?: string) => Boolean(u && /^https?:\/\//i.test(u));
      const filesToUpload: { field: 'front' | 'back' | 'selfie'; file: File }[] = [];
      if (effectiveFrontFile && !isRemoteUrl(docFrontUrl)) filesToUpload.push({ field: 'front', file: effectiveFrontFile });
      if (effectiveBackFile && !isRemoteUrl(docBackUrl)) filesToUpload.push({ field: 'back', file: effectiveBackFile });
      if (effectiveSelfieFile && !isRemoteUrl(selfieUrl)) filesToUpload.push({ field: 'selfie', file: effectiveSelfieFile });

      let finalFrontUrl = isRemoteUrl(docFrontUrl) ? docFrontUrl : '';
      let finalBackUrl = isRemoteUrl(docBackUrl) ? docBackUrl : '';
      let finalSelfieUrl = isRemoteUrl(selfieUrl) ? selfieUrl : '';

      if (filesToUpload.length > 0) {
        setUploadProgressMsg(
          lang === 'vi'
            ? `Đang tải ${filesToUpload.length} ảnh eKYC lên hệ thống lưu trữ...`
            : `Uploading ${filesToUpload.length} verification photos...`
        );
        const uploadedList = await mediaService.uploadMultipleImages(
          filesToUpload.map((item) => item.file),
          'seller-verifications'
        );

        filesToUpload.forEach((item, index) => {
          const uploaded = uploadedList[index];
          if (uploaded?.url) {
            if (item.field === 'front') {
              finalFrontUrl = uploaded.url;
              setDocFrontUrl(uploaded.url);
            } else if (item.field === 'back') {
              finalBackUrl = uploaded.url;
              setDocBackUrl(uploaded.url);
            } else if (item.field === 'selfie') {
              finalSelfieUrl = uploaded.url;
              setSelfieUrl(uploaded.url);
            }
          }
        });
      }

      if (!finalFrontUrl || !finalBackUrl) {
        throw new Error(
          lang === 'vi'
            ? 'Không thể tải lên ảnh CCCD mặt trước hoặc mặt sau. Vui lòng thử lại.'
            : 'Failed to upload ID photos.'
        );
      }

      const obStatus = await saveConfirmedWarehouse();

      if (!obStatus?.emailVerified) {
        setIsEmailVerifiedForOnboarding(false);
        setUploadProgressMsg(
          lang === 'vi' ? 'Đang gửi mã OTP xác thực về email gian hàng...' : 'Sending OTP to shop email...'
        );
        try {
          await shippingService.sendSellerOnboardingEmailCode();
        } catch (sendErr: any) {
          console.warn('sendSellerOnboardingEmailCode:', sendErr);
        }
        setSavedImageUrls({ front: finalFrontUrl, back: finalBackUrl, selfie: finalSelfieUrl });
        setOtpCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setIsVerifyingBeforeSubmit(true);
        setIsOtpModalOpen(true);
        setIsSubmitting(false);
        setUploadProgressMsg(null);
        return;
      }

      // 4. Nếu đã xác thực email -> Nộp hồ sơ eKYC
      await doSubmitEkyc(finalFrontUrl, finalBackUrl, finalSelfieUrl);
    } catch (err: any) {
      setIsSubmitting(false);
      setUploadProgressMsg(null);
      setErrorMsg(err.message || (lang === 'vi' ? 'Có lỗi xảy ra khi nộp hồ sơ eKYC.' : 'Failed to submit eKYC.'));
    }
  };

  const doSubmitEkyc = async (
    finalFrontUrl: string,
    finalBackUrl: string,
    finalSelfieUrl: string
  ) => {
    setIsSubmitting(true);
    setUploadProgressMsg(
      lang === 'vi' ? 'Đang gửi hồ sơ và đối soát eKYC với hệ thống...' : 'Submitting verification...'
    );
    try {
      let verificationResponse: SellerVerificationResponseDto;

      let isResubmit = existingVerification?.status === 'RESUBMIT_REQUIRED';
      let activeVerifId = existingVerification?.id;

      if (!isResubmit) {
        try {
          const checkVerif = await sellerService.getMyVerification();
          if (checkVerif && ['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(checkVerif.status)) {
            setIsSubmitting(false);
            setUploadProgressMsg(null);
            setErrorMsg(
              lang === 'vi'
                ? 'Hồ sơ của bạn đang được Ban Quản trị xử lý xét duyệt. Bạn không thể gửi lại yêu cầu lúc này.'
                : 'Your application is pending review. You cannot submit again at this time.'
            );
            return;
          }
          if (checkVerif?.status === 'RESUBMIT_REQUIRED') {
            isResubmit = true;
            activeVerifId = checkVerif.id;
            setExistingVerification(checkVerif);
          }
        } catch (_) { }
      }

      if (isResubmit && activeVerifId) {
        setUploadProgressMsg(
          lang === 'vi' ? 'Đang nộp lại ảnh chứng từ eKYC...' : 'Resubmitting verification documents...'
        );
        verificationResponse = await sellerService.resubmitVerification(activeVerifId, {
          documentFrontUrl: finalFrontUrl,
          documentBackUrl: finalBackUrl,
          selfieUrl: finalSelfieUrl || undefined,
          clientSession: vnptClientSession || undefined,
          token: vnptToken || undefined,
        });
      } else {
        setUploadProgressMsg(
          lang === 'vi' ? 'Đang gửi hồ sơ và đối soát eKYC với hệ thống...' : 'Submitting verification...'
        );
        try {
          verificationResponse = await sellerService.submitVerification({
            verificationType: 'CITIZEN_ID',
            documentNumber: idCardNumber.trim(),
            documentFrontUrl: finalFrontUrl,
            documentBackUrl: finalBackUrl,
            selfieUrl: finalSelfieUrl || undefined,
            clientSession: vnptClientSession || `ANDROID_Web_1.0_Device_1.0.0_web_${Date.now()}`,
            token: vnptToken || `vnpt-token-${Date.now()}`,
          });
        } catch (verifErr: any) {
          const is409 =
            verifErr?.response?.status === 409 ||
            verifErr?.status === 409 ||
            (verifErr?.message && verifErr.message.includes('409'));
          const is429 =
            verifErr?.response?.status === 429 ||
            verifErr?.status === 429 ||
            (verifErr?.message && verifErr.message.includes('429'));
          if (is409) {
            console.log('Seller verification already exists (409 Conflict), treating as approved');
            verificationResponse = { status: 'APPROVED' } as any;
          } else if (is429) {
            setCooldownServerMsg(
              verifErr?.message ||
              (lang === 'vi'
                ? 'Bạn đã gửi hồ sơ thất bại quá nhiều lần trong 24 giờ qua. Vui lòng thử lại sau.'
                : 'Too many rejected submissions in the last 24 hours. Please try again later.')
            );
            void syncRejectionCooldown('REJECTED');
            throw verifErr;
          } else {
            throw verifErr;
          }
        }
      }

      // Phân nhánh xử lý chính xác theo mã trạng thái status trả về từ Backend
      const status = verificationResponse?.status;

      if (status === 'APPROVED') {
        try {
          // Hold off automatic 401 re-login redirect while the 30s fireworks celebration is visible
          sessionStorage.setItem('seller_upgrade_celebrating', '1');
          sessionStorage.setItem('seller_upgrade_relogin', '1');
        } catch { }
        setExistingVerification(verificationResponse);
        setShowApprovalCelebration(true);
        setSuccessMsg(
          lang === 'vi'
            ? '🎉 Chúc mừng bạn đã đăng ký người bán thành công! Bạn đã chính thức trở thành người bán trên SecondLife.'
            : '🎉 Congratulations! You have successfully registered as a Seller on SecondLife.'
        );
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch { }
      } else if (status === 'RESUBMIT_REQUIRED') {
        setExistingVerification(verificationResponse);
        setShowForm(true);
        setCurrentStep(3);
        // Lý do yêu cầu nộp lại đã hiển thị tập trung trong hộp cảnh báo ở đầu Bước 3.
        setErrorMsg(null);
      } else if (status === 'REJECTED') {
        setExistingVerification(verificationResponse);
        void syncRejectionCooldown('REJECTED');
        onUpdateProfile({
          ...currentUser,
          kycStatus: 'unverified',
        });
        // Lý do từ chối và nút Đăng ký lại được hiển thị tập trung trong thẻ trạng thái isRejected bên dưới.
        setErrorMsg(null);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch { }
      } else if (status === 'EKYC_PENDING' && verificationResponse?.ekycStatus === 'PROVIDER_ERROR') {
        setExistingVerification(verificationResponse);
        onUpdateProfile({
          ...currentUser,
          kycStatus: 'pending',
        });
        setErrorMsg(null);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch { }
      } else {
        try {
          sessionStorage.setItem('seller_upgrade_relogin', '1');
          setTimeout(() => {
            try { sessionStorage.removeItem('seller_upgrade_relogin'); } catch { }
          }, 5000);
        } catch { }
        const updated: UserProfile = {
          ...currentUser,
          isSellerRegistered: true,
          shopName: shopName.trim(),
          phone: sellerPhone.trim(),
          pickupAddress: pickupAddress.trim(),
          idCardNumber: idCardNumber.trim(),
          bankAccount: {
            bankName: sellerBankName,
            accountNumber: sellerAccountNumber,
            accountHolder: sellerAccountHolder,
          },
          kycStatus: 'pending',
        };
        onUpdateProfile(updated);
        setExistingVerification(verificationResponse);
        // Trạng thái chờ duyệt đã được hiển thị rõ trong thẻ isPendingReview bên dưới, không lặp banner chúc mừng phía trên.
        setSuccessMsg(null);
        setErrorMsg(null);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch { }
      }

      const immediateSummary = status === 'APPROVED' || status === 'REJECTED' || (status === 'EKYC_PENDING' && verificationResponse?.ekycStatus === 'PROVIDER_ERROR');
      setTimeout(() => {
        setIsSubmitting(false);
        setUploadProgressMsg(null);
        if (status !== 'RESUBMIT_REQUIRED') {
          setShowForm(false);
        }
      }, status === 'RESUBMIT_REQUIRED' || immediateSummary ? 0 : 1500);
    } catch (err: any) {
      setIsSubmitting(false);
      setUploadProgressMsg(null);
      setErrorMsg(err.message || (lang === 'vi' ? 'Có lỗi xảy ra khi nộp hồ sơ eKYC.' : 'Failed to submit eKYC.'));
    }
  };

  const handleVerifyOtpAndSubmit = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setOtpError(lang === 'vi' ? 'Vui lòng nhập đầy đủ 6 chữ số mã OTP.' : 'Please enter all 6 digits of the OTP code.');
      return;
    }
    setIsSubmittingOtp(true);
    setOtpError(null);
    try {
      await shippingService.verifySellerOnboardingEmailCode(code);
      setIsEmailVerifiedForOnboarding(true);
      setIsOtpModalOpen(false);
      if (isVerifyingBeforeSubmit && savedImageUrls.front) {
        setSuccessMsg(
          lang === 'vi' ? 'Xác thực Email Shop thành công! Đang gửi hồ sơ eKYC...' : 'Email verified! Submitting eKYC...'
        );
        await doSubmitEkyc(savedImageUrls.front, savedImageUrls.back, savedImageUrls.selfie);
      } else {
        setOtpSentSuccess(
          lang === 'vi'
            ? 'Xác thực email thành công! Bạn có thể tiếp tục hoàn thành form đăng ký bên dưới.'
            : 'Email verified! You can continue completing the registration form below.'
        );
      }
    } catch (err: any) {
      setOtpError(err.message || (lang === 'vi' ? 'Mã OTP không đúng hoặc đã hết hạn.' : 'Invalid or expired OTP code.'));
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    try {
      await shippingService.sendSellerOnboardingEmailCode();
      setOtpCountdown(60);
      setOtpError(null);
    } catch (err: any) {
      setOtpError(err.message || (lang === 'vi' ? 'Không thể gửi lại mã OTP.' : 'Failed to resend code.'));
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#24263e]/15 flex items-center justify-between bg-[#fce5da] text-[#24263e]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#24263e] text-white shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[#24263e]">
                  {lang === 'vi' ? 'ĐĂNG KÝ THÀNH NGƯỜI BÁN' : 'Seller Hub Onboarding'}
                </h3>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${isCheckingVerification
                  ? 'bg-white/90 text-slate-600 border-slate-300'
                  : isApprovedSeller
                    ? 'bg-white text-emerald-900 border-emerald-500'
                    : isResubmitRequired
                      ? 'bg-amber-100 text-amber-900 border-amber-500 animate-pulse'
                      : isRejected
                        ? 'bg-rose-100 text-rose-900 border-rose-500'
                        : isProviderErrorPending
                          ? 'bg-rose-50 text-rose-900 border-rose-400'
                          : isPendingReview
                            ? 'bg-white text-amber-900 border-amber-500'
                            : 'bg-white text-rose-900 border-rose-500'
                  }`}>
                  {isCheckingVerification
                    ? (lang === 'vi' ? 'Đang kiểm tra...' : 'Checking...')
                    : isApprovedSeller
                      ? (lang === 'vi' ? 'Đã kích hoạt người bán' : 'Seller Active')
                      : isResubmitRequired
                        ? (lang === 'vi' ? 'Cần chụp lại ảnh eKYC' : 'Resubmission Required')
                        : isRejected
                          ? (lang === 'vi' ? 'Hồ sơ bị từ chối' : 'Rejected')
                          : isProviderErrorPending
                            ? (lang === 'vi' ? 'Lỗi kết nối eKYC' : 'eKYC Provider Issue')
                            : isPendingReview
                              ? (lang === 'vi' ? 'Đang chờ duyệt eKYC' : 'Pending Review')
                              : (lang === 'vi' ? 'Chưa kích hoạt' : 'Not Registered')}
                </span>
              </div>
              <p className="text-[11px] text-[#24263e]/80 font-bold mt-0.5">
                {lang === 'vi'
                  ? 'Đăng ký gian hàng & địa chỉ kho để bắt đầu đăng bán thiết bị gia dụng trên SecondLife'
                  : 'Register store profile & warehouse to post appliances on SecondLife'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#24263e] hover:bg-white/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto subtle-scrollbar px-5 sm:px-6 pt-2 sm:pt-2.5 pb-5 sm:pb-6 space-y-3">
          {/* Highlights Banner */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100 text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#24263e] shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Xác minh CCCD' : 'National ID'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'Định danh eKYC' : 'eKYC Verified'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-slate-700">
              <Truck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Lấy hàng tận kho' : 'Doorstep Pickup'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'Lalamove giao Hub' : 'Lalamove Pickup'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-slate-700">
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Giải ngân Escrow' : 'Escrow Payout'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'Bảo lãnh an toàn' : 'Protected'}</span>
              </div>
            </div>
          </div>

          {isCheckingVerification && (
            <div className="p-8 rounded-3xl bg-slate-50 border border-gray-200 flex flex-col items-center justify-center gap-2.5 text-slate-600 animate-in fade-in">
              <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
              <p className="text-xs font-semibold">
                {lang === 'vi' ? 'Đang kiểm tra trạng thái hồ sơ người bán...' : 'Checking seller verification status...'}
              </p>
            </div>
          )}

          {/* Notification when viewing registered store profile */}
          {!isCheckingVerification && !showForm && successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {!isCheckingVerification && !showForm && errorMsg && !(hasRegistered && (isRejected || isProviderErrorPending || isResubmitRequired)) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW: THÔNG TIN GIAN HÀNG ĐÃ ĐĂNG KÝ */}
          {!isCheckingVerification && !showForm && hasRegistered && (
            <div className="p-5 rounded-3xl bg-slate-50 border border-gray-200 space-y-4 animate-in fade-in">
              {/* Active Role Status Notification Banner */}
              <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${currentUser.role === 'seller'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-blue-50/70 border-blue-200 text-blue-950'
                }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${currentUser.role === 'seller' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                    }`}>
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'vi' ? 'Vai trò đang chọn:' : 'Current Role:'}
                      </span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md ${currentUser.role === 'seller' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                        {currentUser.role === 'seller'
                          ? (lang === 'vi' ? 'Người Bán (Seller)' : 'Seller')
                          : (lang === 'vi' ? 'Người Mua (Buyer)' : 'Buyer')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {currentUser.role === 'seller'
                        ? (lang === 'vi' ? 'Bạn đang ở giao diện Người Bán (quản lý gian hàng, đăng tin và đơn hàng).' : 'You are in Seller mode.')
                        : (lang === 'vi' ? 'Bạn đang ở giao diện Người Mua (tìm kiếm mua sắm và theo dõi đơn mua).' : 'You are in Buyer mode.')}
                    </p>
                  </div>
                </div>
                {isApprovedSeller && (
                  <div className="shrink-0 flex items-center gap-2">
                    {currentUser.role === 'seller' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          onRoleChange('buyer');
                          onUpdateProfile({ ...currentUser, role: 'buyer', isSellerRegistered: true });
                        }}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        {lang === 'vi' ? 'Chuyển về Người Mua' : 'Switch to Buyer'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          onRoleChange('seller');
                          onUpdateProfile({ ...currentUser, role: 'seller', isSellerRegistered: true });
                        }}
                        className="px-3.5 py-1.5 bg-[#24263e] hover:bg-[#343754] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        {lang === 'vi' ? 'Chuyển về Người Bán' : 'Switch to Seller'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-[#24263e]" />
                  <span className="text-xs font-bold text-slate-900">
                    {lang === 'vi' ? 'Hồ sơ gian hàng của bạn' : 'Your Seller Store Profile'}
                  </span>
                  {!isRejected && !isPendingReview && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isApprovedSeller
                      ? 'bg-emerald-100 text-emerald-800'
                      : isResubmitRequired
                        ? 'bg-orange-100 text-orange-800'
                        : isProviderErrorPending
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                      {isApprovedSeller
                        ? (lang === 'vi' ? 'Đã kích hoạt' : 'Active')
                        : isResubmitRequired
                          ? (lang === 'vi' ? 'Yêu cầu nộp lại' : 'Resubmit Required')
                          : isProviderErrorPending
                            ? (lang === 'vi' ? 'Tạm gián đoạn cổng eKYC' : 'eKYC Provider Pending Retry')
                            : (lang === 'vi' ? 'Đang chờ quản trị viên duyệt' : 'Pending Review')}
                    </span>
                  )}
                </div>

                {isApprovedSeller && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setShowForm(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#24263e] hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'vi' ? 'Chỉnh sửa thông tin' : 'Edit Info'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">{lang === 'vi' ? 'Tên gian hàng' : 'Store name'}</span>
                  <span className="font-bold text-slate-800">{currentUser.shopName || shopName}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">{lang === 'vi' ? 'Hotline bán hàng & Zalo' : 'Sales hotline & Zalo'}</span>
                  <span className="font-bold text-slate-800">{currentUser.phone || sellerPhone}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">{lang === 'vi' ? 'Địa chỉ kho bưu tá lấy hàng' : 'Courier pickup warehouse address'}</span>
                  <span className="font-medium text-slate-800">{currentUser.pickupAddress || pickupAddress}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">{lang === 'vi' ? 'Số CCCD định danh' : 'Citizen ID number'}</span>
                  <span className="font-bold text-slate-800">{currentUser.idCardNumber || idCardNumber}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">{lang === 'vi' ? 'Tài khoản nhận tiền Escrow' : 'Escrow payout account'}</span>
                  <span className="font-bold text-slate-800">{sellerBankName} - {sellerAccountNumber}</span>
                </div>
              </div>

              {/* Status explanation */}
              <div className="text-xs space-y-2">
                {isApprovedSeller ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold block text-emerald-800">{lang === 'vi' ? 'Tài khoản người bán đã kích hoạt!' : 'Seller account is active!'}</span>
                      <span className="text-[11px] text-slate-600">{lang === 'vi' ? 'Bạn có thể tiến hành đăng tin bán thiết bị gia dụng ngay.' : 'You can post your appliance listings now.'}</span>
                    </div>
                    {onNavigateToCreateListing && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToCreateListing();
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Đến trang đăng bán' : 'Post Listing'}</span>
                      </button>
                    )}
                  </div>
                ) : isResubmitRequired ? (
                  <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-300 text-orange-950 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-orange-800">
                      <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Nhân viên yêu cầu nộp lại chứng từ eKYC:' : 'Staff requested document resubmission:'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed pl-6 text-slate-800 font-medium">
                      {existingVerification?.rejectionReason || (lang === 'vi' ? 'Ảnh chứng từ chưa rõ nét hoặc thông tin cần bổ sung. Vui lòng chụp lại và gửi lại yêu cầu.' : 'Please retake clearer photos and resubmit.')}
                    </p>
                    <div className="pt-1 pl-6">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setCurrentStep(3);
                          setShowForm(true);
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
                      >
                        {lang === 'vi' ? 'Cập nhật ảnh & nộp lại ngay' : 'Update & Resubmit Now'}
                      </button>
                    </div>
                  </div>
                ) : isRejected ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Hồ sơ người bán đã bị từ chối:' : 'Seller application was rejected:'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed pl-6 text-slate-800 font-medium">
                      {existingVerification?.rejectionReason || (lang === 'vi' ? 'Hồ sơ không đáp ứng điều kiện định danh của SecondLife.' : 'Application does not meet identification criteria.')}
                    </p>
                    {isCooldownLocked && (
                      <div className="ml-6 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed font-medium">
                        {cooldownServerMsg ||
                          (lang === 'vi'
                            ? `Bạn đã gửi hồ sơ bị từ chối ${MAX_DAILY_REJECTED_SUBMISSIONS} lần trong ${SUBMISSION_COOLDOWN_HOURS} giờ qua. Hệ thống tạm khóa gửi mới để tránh spam, vui lòng thử lại sau ${cooldownUnlockAt ? formatCooldownUnlockTime(cooldownUnlockAt) : '24 giờ'}.`
                            : `You have reached ${MAX_DAILY_REJECTED_SUBMISSIONS} rejected submissions within ${SUBMISSION_COOLDOWN_HOURS} hours. Please try again after ${cooldownUnlockAt ? formatCooldownUnlockTime(cooldownUnlockAt) : '24 hours'}.`)}
                      </div>
                    )}
                    <div className="pt-1 pl-6">
                      <button
                        type="button"
                        disabled={isCooldownLocked}
                        onClick={() => {
                          if (isCooldownLocked) return;
                          setErrorMsg(null);
                          setCurrentStep(1);
                          setShowForm(true);
                        }}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs ${isCooldownLocked
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                          }`}
                      >
                        {isCooldownLocked
                          ? (lang === 'vi' ? 'Tạm khóa nộp lại (24 giờ)' : 'Temporarily Locked (24h)')
                          : (lang === 'vi' ? 'Đăng ký lại hồ sơ mới' : 'Reapply With New Details')}
                      </button>
                    </div>
                  </div>
                ) : isProviderErrorPending ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        {lang === 'vi'
                          ? (existingVerification?.reasonCode === 'PROVIDER_REQUEST_REJECTED'
                            ? 'Cổng VNPT từ chối xử lý hồ sơ eKYC'
                            : 'Cổng xác thực eKYC đang tạm gián đoạn')
                          : 'eKYC Provider Error'}
                      </span>
                    </div>
                    {existingVerification?.rejectionReason && (
                      <p className="text-[11px] leading-relaxed font-semibold text-rose-900 pl-6">
                        {lang === 'vi' ? 'Chi tiết lỗi: ' : 'Error detail: '}
                        {existingVerification.rejectionReason}
                      </p>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-700 pl-6">
                      {lang === 'vi'
                        ? (existingVerification?.rejectionReason
                          ? `Hồ sơ của bạn đã được lưu lại (${existingVerification.reasonCodeDescription || existingVerification.reasonCode || 'Lỗi cổng VNPT'}). Hệ thống hoặc quản trị viên sẽ kiểm tra và xử lý giúp bạn, bạn chưa cần gửi lại hồ sơ mới.`
                          : `Hồ sơ của bạn đã được lưu lại (${existingVerification?.reasonCodeDescription || existingVerification?.reasonCode || 'Lỗi kết nối cổng VNPT'}). Hệ thống hoặc quản trị viên sẽ kiểm tra và thử lại giúp bạn, bạn chưa cần gửi lại hồ sơ mới.`)
                        : `Your application was saved (${existingVerification?.rejectionReason || existingVerification?.reasonCodeDescription || existingVerification?.reasonCode || 'VNPT connection error'}). The system or admin will review/retry it for you.`}
                    </p>
                  </div>
                ) : isPendingReview ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                      <span>{lang === 'vi' ? 'Đang chờ phê duyệt hồ sơ eKYC' : 'Awaiting eKYC Approval'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700 pl-6">
                      {lang === 'vi'
                        ? 'Hồ sơ của bạn đang được Ban Quản trị SecondLife đối soát CCCD và địa chỉ kho. Vui lòng chờ phê duyệt. Trong thời gian này, bạn không thể chỉnh sửa hoặc gửi lại yêu cầu.'
                        : 'Your profile is awaiting review by SecondLife administrators. Please wait for approval. You cannot edit or resubmit during this time.'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* VIEW: FORM ĐĂNG KÝ NGƯỜI BÁN */}
          {!isCheckingVerification && showForm && (
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-slate-50 border-2 border-[#c34c36]/30 shadow-md space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      {isRegistered
                        ? (lang === 'vi' ? 'Cập nhật thông tin gian hàng' : 'Update Store Information')
                        : (lang === 'vi' ? 'Đơn đăng ký chuyển tài khoản người bán' : 'Seller Registration Form')}
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'vi'
                        ? 'Điền thông tin để Kỹ sư Hub và đơn vị vận chuyển đến nhận thiết bị giám định'
                        : 'Fill in details so Hub inspectors and couriers can collect devices for inspection'}
                    </p>
                  </div>
                </div>

                {isRegistered && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    {lang === 'vi' ? 'Đóng form' : 'Close form'}
                  </button>
                )}
              </div>
              {/* 3-Step Wizard Navigation */}
              {!isApprovedSeller && <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 text-xs">
                {/* Step 1 Pill */}
                <button
                  type="button"
                  onClick={() => { setErrorMsg(null); setCurrentStep(1); }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left transition cursor-pointer ${currentStep === 1
                    ? 'bg-white shadow-xs text-[#24263e] border border-slate-200/80 font-black'
                    : currentStep > 1
                      ? 'text-emerald-700 hover:bg-white/50 font-bold'
                      : 'text-slate-400 hover:bg-white/50 font-medium'
                    }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${currentStep === 1
                      ? 'bg-[#c34c36] text-white'
                      : currentStep > 1
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                      }`}
                  >
                    {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                      {lang === 'vi' ? 'Bước 1' : 'Step 1'}
                    </span>
                    <span className="block text-[11px] truncate">
                      {lang === 'vi' ? 'Thông tin gian hàng' : 'Store Details'}
                    </span>
                  </div>
                </button>

                {/* Step 2 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) {
                      setErrorMsg(null);
                      setCurrentStep(2);
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left transition cursor-pointer ${currentStep === 2
                    ? 'bg-white shadow-xs text-[#24263e] border border-slate-200/80 font-black'
                    : currentStep > 2
                      ? 'text-emerald-700 hover:bg-white/50 font-bold'
                      : 'text-slate-400 hover:bg-white/50 font-medium'
                    }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${currentStep === 2
                      ? 'bg-[#c34c36] text-white'
                      : currentStep > 2
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                      }`}
                  >
                    {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                      {lang === 'vi' ? 'Bước 2' : 'Step 2'}
                    </span>
                    <span className="block text-[11px] leading-tight">
                      {lang === 'vi' ? 'Kho & ngân hàng' : 'Pickup & Bank'}
                    </span>
                  </div>
                </button>

                {/* Step 3 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1() && validateStep2()) {
                      setErrorMsg(null);
                      setCurrentStep(3);
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left transition cursor-pointer ${currentStep === 3
                    ? 'bg-white shadow-xs text-[#24263e] border border-slate-200/80 font-black'
                    : 'text-slate-400 hover:bg-white/50 font-medium'
                    }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${currentStep === 3
                      ? 'bg-[#c34c36] text-white'
                      : 'bg-slate-200 text-slate-500'
                      }`}
                  >
                    3
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                      {lang === 'vi' ? 'Bước 3' : 'Step 3'}
                    </span>
                    <span className="block text-[11px] truncate">
                      {lang === 'vi' ? 'Xác thực eKYC' : 'eKYC Verification'}
                    </span>
                  </div>
                </button>
              </div>}

              {/* BƯỚC 1: THÔNG TIN GIAN HÀNG & EMAIL OTP */}
              {!isApprovedSeller && currentStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {/* Form Inputs */}
                  {/* Resubmission Alert if status is RESUBMIT_REQUIRED */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          {lang === 'vi' ? 'Tên gian hàng / cửa hàng' : 'Store / Shop Name'} <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                          {shopName.length}/{SHOP_NAME_MAX_LENGTH}
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        minLength={SHOP_NAME_MIN_LENGTH}
                        maxLength={SHOP_NAME_MAX_LENGTH}
                        value={shopName}
                        onChange={(e) => setShopName(sanitizeShopName(e.target.value))}
                        placeholder={lang === 'vi' ? 'VD: Cửa hàng điện gia dụng' : 'e.g., Home Appliances Store'}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {lang === 'vi'
                          ? `Từ ${SHOP_NAME_MIN_LENGTH} đến ${SHOP_NAME_MAX_LENGTH} ký tự, không chứa ký tự đặc biệt.`
                          : `${SHOP_NAME_MIN_LENGTH}–${SHOP_NAME_MAX_LENGTH} characters, letters/numbers/spaces only.`}
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {lang === 'vi' ? 'Số điện thoại' : 'Business Phone & Zalo'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={sellerPhone}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setSellerPhone(digitsOnly);
                        }}
                        placeholder="0912345678"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  {/* Email Gian Hàng (tự kế thừa xác thực từ tài khoản nếu dùng email đăng ký) */}
                  <div className="p-3.5 bg-gradient-to-br from-[#faf8f5] to-orange-50/20 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#c34c36]" />
                        <span>
                          {isUsingVerifiedAccountEmail
                            ? (lang === 'vi' ? 'Email gian hàng' : 'Shop Email')
                            : (lang === 'vi' ? 'Email gian hàng (Bắt buộc xác thực OTP nếu khác email tài khoản)' : 'Shop Email (OTP Verification Required)')}
                        </span>
                        <span className="text-red-500">*</span>
                      </label>
                      {isShopEmailReady ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>
                            {isUsingVerifiedAccountEmail && !isEmailVerifiedForOnboarding
                              ? (lang === 'vi' ? 'Đã xác thực theo tài khoản' : 'Account Email Verified')
                              : (lang === 'vi' ? 'Đã xác thực OTP' : 'Verified')}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>{lang === 'vi' ? 'Chưa xác thực email' : 'Unverified'}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        value={shopEmail}
                        disabled={isEmailVerifiedForOnboarding}
                        readOnly={isEmailVerifiedForOnboarding}
                        onChange={(e) => {
                          if (isEmailVerifiedForOnboarding) return;
                          setShopEmail(e.target.value);
                          setIsEmailVerifiedForOnboarding(false);
                          setHasSentOtp(false);
                          setOtpSentSuccess(null);
                          setOtpError(null);
                        }}
                        placeholder="seller@example.com"
                        className={`flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none text-xs ${isEmailVerifiedForOnboarding
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                          : 'bg-white text-slate-900 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36]'
                          }`}
                      />

                      {!isUsingVerifiedAccountEmail && (
                        <button
                          type="button"
                          onClick={handleSendOtpInline}
                          disabled={isSendingOtp || otpCountdown > 0 || isEmailVerifiedForOnboarding}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${isEmailVerifiedForOnboarding
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                            : 'bg-[#24263e] hover:bg-black text-white disabled:opacity-50'
                            }`}
                        >
                          {isSendingOtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{lang === 'vi' ? 'Đang gửi...' : 'Sending...'}</span>
                            </>
                          ) : otpCountdown > 0 ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{lang === 'vi' ? `Gửi lại (${otpCountdown}s)` : `Resend (${otpCountdown}s)`}</span>
                            </>
                          ) : isEmailVerifiedForOnboarding ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã xác thực' : 'Verified'}</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              <span>{hasSentOtp ? (lang === 'vi' ? 'Gửi lại OTP' : 'Resend OTP') : (lang === 'vi' ? 'Gửi mã OTP' : 'Send OTP')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Trạng thái xác thực email gian hàng */}
                    {!isShopEmailReady && hasSentOtp && (
                      <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold text-[#24263e] block">
                              {lang === 'vi' ? 'Đã gửi mã xác thực đến email của bạn' : 'Verification code sent'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {lang === 'vi' ? 'Bấm nút để mở lại bảng nhập mã xác thực OTP 6 số' : 'Click button to enter 6-digit OTP code'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsVerifyingBeforeSubmit(false);
                            setIsOtpModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                          <span>{lang === 'vi' ? 'Nhập mã xác thực' : 'Enter OTP Code'}</span>
                        </button>
                      </div>
                    )}

                    {otpSentSuccess && !isShopEmailReady && (
                      <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{otpSentSuccess}</span>
                      </p>
                    )}

                    {isShopEmailReady && (
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {isUsingVerifiedAccountEmail && !isEmailVerifiedForOnboarding
                            ? (lang === 'vi' ? 'Email tài khoản đã xác thực trước đó. Bạn không cần nhập lại OTP.' : 'Account email already verified. No OTP required.')
                            : (lang === 'vi' ? 'Email gian hàng đã được xác thực thành công. Bạn đủ điều kiện nộp eKYC.' : 'Shop email verified. You may proceed with eKYC.')}
                        </span>
                      </div>
                    )}
                  </div>


                  {/* Inline Error & Success Feedback */}
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}


                  {/* Step 1 Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                    {isRegistered ? (
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-600 text-xs font-bold transition cursor-pointer"
                      >
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </button>
                    ) : <div />}

                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep1()) {
                          setErrorMsg(null);
                          setCurrentStep(2);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer ml-auto"
                    >
                      <span>{lang === 'vi' ? 'Tiếp tục' : 'Continue'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* BƯỚC 2: KHO LẤY HÀNG & TÀI KHOẢN NGÂN HÀNG */}
              {(isApprovedSeller || currentStep === 2) && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {pickupLockReason && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{pickupLockReason}</span>
                    </div>
                  )}
                  {/* Lalamove Warehouse Pickup Address Section */}
                  <LalamoveAddressPicker
                    key={`${!pickupLockReason ? 'edit' : 'locked'}-seller-reg-warehouse`}
                    readOnly={Boolean(pickupLockReason)}
                    initialName={shopName}
                    initialPhone={sellerPhone}
                    initialLatitude={pickupLatitude ?? undefined}
                    initialLongitude={pickupLongitude ?? undefined}
                    initialAddress={pickupAddress}
                    onAddressUnconfirmed={() => setIsWarehouseConfirmed(false)}
                    onAddressConfirmed={(data) => {
                      setIsWarehouseConfirmed(true);
                      setPickupLatitude(data.latitude);
                      setPickupLongitude(data.longitude);
                      setPickupAddress(data.address);
                      setStreetAddress(data.address);
                      if (data.name && (isApprovedSeller || !shopName)) {
                        const cleanPickedShop = sanitizeShopName(data.name);
                        if (cleanPickedShop.trim().length >= SHOP_NAME_MIN_LENGTH) {
                          setShopName(cleanPickedShop);
                        }
                      }
                      if (data.phone && (isApprovedSeller || !sellerPhone)) setSellerPhone(data.phone);
                    }}
                    lang={lang}
                    title={lang === 'vi' ? 'Địa chỉ kho lấy hàng:' : 'Pickup Location'}
                    description={
                      currentUser.address || currentUser.pickupAddress || currentUser.streetAddress
                        ? (lang === 'vi' ? '' : 'Synced from your profile. Drag pin if warehouse location is different.')
                        : (lang === 'vi' ? 'Hồ sơ chưa có địa chỉ. Bấm "Dùng vị trí hiện tại" hoặc nhấp vào bản đồ để định vị kho lấy hàng.' : 'No profile address. Click "Use Current Location" or pick on map.')
                    }
                  />

                  {!isApprovedSeller && (
                    <section className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-3">
                      <h6 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <CreditCard aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#24263e]" />
                        {lang === 'vi' ? 'Tài khoản ngân hàng nhận tiền bán (Giải ngân Escrow)' : 'Bank Account for Escrow Payout'}
                      </h6>
                      <VietQrBankPicker value={sellerBankName} onChange={setSellerBankName} lang={lang} />
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 flex items-center justify-between text-[10px] font-bold text-slate-600">
                            <span>{lang === 'vi' ? 'Số tài khoản' : 'Account number'}</span>
                            <span className="font-semibold text-slate-400 tabular-nums">
                              {sellerAccountNumber.length}/{BANK_ACCOUNT_NUMBER_MAX_LENGTH}
                            </span>
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            minLength={BANK_ACCOUNT_NUMBER_MIN_LENGTH}
                            maxLength={BANK_ACCOUNT_NUMBER_MAX_LENGTH}
                            value={sellerAccountNumber}
                            onChange={(e) => setSellerAccountNumber(sanitizeBankAccountNumber(e.target.value))}
                            placeholder={lang === 'vi' ? 'Nhập 8–16 chữ số...' : '8–16 digits'}
                            className="min-h-9 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#c34c36]"
                          />
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {lang === 'vi' ? 'Chỉ nhập số, từ 8 đến 16 chữ số.' : 'Digits only, 8 to 16 digits.'}
                          </span>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold text-slate-600">{lang === 'vi' ? 'Chủ tài khoản' : 'Account holder'}</span>
                          <input
                            type="text"
                            value={sellerAccountHolder}
                            onChange={(e) => setSellerAccountHolder(sanitizeBankAccountHolder(e.target.value))}
                            placeholder={sanitizeBankAccountHolder(currentUser.name || '') || (lang === 'vi' ? 'NGUYEN VAN A' : 'ACCOUNT HOLDER NAME')}
                            className="min-h-9 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs uppercase outline-none focus:border-[#c34c36]"
                          />
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {lang === 'vi' ? 'Tự động in hoa, chỉ chữ không dấu, không ký tự đặc biệt.' : 'Auto uppercase, unaccented letters only.'}
                          </span>
                        </label>
                      </div>
                    </section>
                  )}

                  {/* Inline Error & Success Feedback */}
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}


                  {/* Step 2 Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        if (isApprovedSeller) {
                          setShowForm(false);
                          setIsWarehouseConfirmed(false);
                          void fetchAddressFromBackend();
                        } else {
                          setCurrentStep(1);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{isApprovedSeller ? (lang === 'vi' ? 'Hủy' : 'Cancel') : (lang === 'vi' ? 'Quay lại Bước 1' : 'Back to Step 1')}</span>
                    </button>

                    {isApprovedSeller ? (
                      <button
                        type="submit"
                        disabled={isSubmitting || isLoadingAddressFromBe}
                        className="px-5 py-2.5 rounded-xl bg-[#24263e] text-white text-xs font-black shadow-sm disabled:opacity-50"
                      >
                        {isSubmitting ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu địa chỉ kho' : 'Save pickup address')}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                      >
                        <span>{lang === 'vi' ? 'Tiếp tục xác thực eKYC' : 'Continue to eKYC'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* BƯỚC 3: ĐỊNH DANH eKYC */}
              {!isApprovedSeller && currentStep === 3 && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {existingVerification?.status === 'RESUBMIT_REQUIRED' && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-950">
                            {lang === 'vi' ? 'HỒ SƠ CẦN BỔ SUNG / CHỤP LẠI ẢNH eKYC' : 'RESUBMISSION REQUIRED'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                            {lang === 'vi' ? `Lần nộp lại: ${existingVerification.resubmissionCount || 0}/3` : `Attempt: ${existingVerification.resubmissionCount || 0}/3`}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {lang === 'vi'
                            ? `Lý do từ bên thứ 3: "${existingVerification.rejectionReason || 'Ảnh chụp CCCD bị mờ, lóa ánh sáng hoặc không nhận diện rõ'}". Vui lòng tải lên ảnh chụp mới rõ nét và bấm "Nộp lại chứng từ eKYC" ở cuối form.`
                            : `Provider reason: "${existingVerification.rejectionReason || 'Blurry photos or glare'}". Please upload clear photos and submit again.`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {lang === 'vi' ? 'Số căn cước công dân (CCCD/CMND)' : 'Citizen Identity Number (CCCD)'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={idCardNumber}
                        onChange={(e) => setIdCardNumber(e.target.value)}
                        placeholder={lang === 'vi' ? 'Nhập 12 số CCCD gắn chip...' : '12-digit Citizen ID'}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {lang === 'vi' ? 'Loại thiết bị bán chủ yếu' : 'Primary Product Category'}
                      </label>
                      <input
                        type="text"
                        value={sellerProductTypes}
                        onChange={(e) => setSellerProductTypes(e.target.value)}
                        placeholder={lang === 'vi' ? 'VD: Tủ lạnh, Máy giặt, Máy pha cafe...' : 'e.g., Refrigerators, Washers...'}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  {/* eKYC Document Photo Upload Section */}
                  <div className="p-3.5 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-[#24263e]" />
                        <span>{lang === 'vi' ? 'Ảnh tải lên xác thực eKYC (Mặt trước, mặt sau, chân dung)' : 'eKYC Verification Photo Uploads'}</span>
                        <span className="text-red-500">*</span>
                      </div>


                    </div>

                    {uploadProgressMsg && (
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold flex items-center gap-2 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                        <span>{uploadProgressMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Front ID */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between h-5">
                          <label className="text-[10px] font-bold text-slate-700 block truncate">
                            {lang === 'vi' ? '1. Ảnh CCCD mặt trước' : '1. Front ID Card'} <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {lang === 'vi' ? 'Mặt trước' : 'Front'}
                          </span>
                        </div>
                        <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                          {(frontPreview || docFrontUrl) ? (
                            <div className="h-full flex flex-col justify-between">
                              <div className="relative w-full h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                <img
                                  src={frontPreview || docFrontUrl}
                                  alt="Front ID"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFrontFile(null);
                                    setFrontPreview('');
                                    setDocFrontUrl('');
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition z-10 cursor-pointer"
                                  title={lang === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between px-0.5 text-[10px]">
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {frontFile ? (lang === 'vi' ? 'Sẵn sàng' : 'Ready') : (lang === 'vi' ? 'Đã tải lên' : 'Uploaded')}
                                </span>
                                <label className="text-[#24263e] hover:text-[#c34c36] font-bold underline cursor-pointer">
                                  {lang === 'vi' ? 'Đổi ảnh' : 'Change'}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'front')} />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1.5 hover:bg-slate-50/60 rounded-xl transition">
                              <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                              <span className="text-[11px] font-bold text-slate-700 block">
                                {lang === 'vi' ? 'Chọn ảnh mặt trước' : 'Select Front Photo'}
                              </span>
                              <span className="text-[9px] text-slate-400 block">{lang === 'vi' ? 'Hỗ trợ JPG, PNG, WEBP' : 'JPG, PNG, WEBP'}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'front')} />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Back ID */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between h-5">
                          <label className="text-[10px] font-bold text-slate-700 block truncate">
                            {lang === 'vi' ? '2. Ảnh CCCD mặt sau' : '2. Back ID Card'} <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {lang === 'vi' ? 'Mặt sau' : 'Back'}
                          </span>
                        </div>
                        <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                          {(backPreview || docBackUrl) ? (
                            <div className="h-full flex flex-col justify-between">
                              <div className="relative w-full h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                <img
                                  src={backPreview || docBackUrl}
                                  alt="Back ID"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBackFile(null);
                                    setBackPreview('');
                                    setDocBackUrl('');
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition z-10 cursor-pointer"
                                  title={lang === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between px-0.5 text-[10px]">
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {backFile ? (lang === 'vi' ? 'Sẵn sàng' : 'Ready') : (lang === 'vi' ? 'Đã tải lên' : 'Uploaded')}
                                </span>
                                <label className="text-[#24263e] hover:text-[#c34c36] font-bold underline cursor-pointer">
                                  {lang === 'vi' ? 'Đổi ảnh' : 'Change'}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'back')} />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1.5 hover:bg-slate-50/60 rounded-xl transition">
                              <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                              <span className="text-[11px] font-bold text-slate-700 block">
                                {lang === 'vi' ? 'Chọn ảnh mặt sau' : 'Select Back Photo'}
                              </span>
                              <span className="text-[9px] text-slate-400 block">{lang === 'vi' ? 'Hỗ trợ JPG, PNG, WEBP' : 'JPG, PNG, WEBP'}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'back')} />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Selfie */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between h-5">
                          <label className="text-[10px] font-bold text-slate-700 block truncate">
                            {lang === 'vi' ? '3. Ảnh chân dung selfie' : '3. Selfie Photo'} <span className="text-red-500">*</span>
                          </label>

                        </div>
                        <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                          {(selfiePreview || selfieUrl) ? (
                            <div className="h-full flex flex-col justify-between">
                              <div className="relative w-full h-20 rounded-xl overflow-hidden border border-emerald-400 bg-slate-50">
                                <img
                                  src={selfiePreview || selfieUrl}
                                  alt="Selfie eKYC"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelfieFile(null);
                                    setSelfiePreview('');
                                    setSelfieUrl('');
                                    setVnptClientSession('');
                                    setVnptToken('');
                                    setVnptLivenessResult(null);
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition z-10 cursor-pointer"
                                  title={lang === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white rounded text-[8px] font-bold shadow-xs">
                                  {vnptClientSession ? 'VNPT eKYC' : (lang === 'vi' ? 'Đã chụp' : 'OK')}
                                </div>
                              </div>
                              <div className="flex items-center justify-center px-0.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => void openFaceScanner()}
                                  className="text-[#c34c36] font-bold hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <Camera className="w-3 h-3" />
                                  <span>{lang === 'vi' ? 'Quét lại' : 'Rescan'}</span>
                                </button>

                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full space-y-2">
                              <button
                                type="button"
                                onClick={() => void openFaceScanner()}
                                className="w-full py-2 px-2 bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-slate-900 rounded-xl text-[10px] font-bold shadow-xs hover:opacity-95 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                                <span className="truncate">{lang === 'vi' ? 'Mở camera quét mặt' : 'Live Camera Scan'}</span>
                              </button>
                              <span className="text-[9px] text-slate-500 font-medium block text-center">
                                {lang === 'vi' ? 'Bắt buộc quét camera trực tiếp' : 'Live camera scan required'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Agreement */}
                  <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={sellerTermsAgreed}
                      onChange={(e) => setSellerTermsAgreed(e.target.checked)}
                      className="mt-0.5 rounded text-[#24263e] focus:ring-[#c34c36] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-600 leading-relaxed">
                      {lang === 'vi'
                        ? 'Tôi cam kết mọi thiết bị đăng bán là đúng tình trạng, tuân thủ quy chế giải ngân qua quỹ tín thác Escrow của SecondLife.'
                        : 'I commit that all listed appliances are authentic and match condition; ready for Lalamove pickup and Hub inspection.'}
                    </span>
                  </label>


                  {/* Inline Error & Success Feedback */}
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}


                  {/* Step 3 Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setCurrentStep(2);
                      }}
                      className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Quay lại Bước 2' : 'Back to Step 2'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-[#24263e] hover:bg-black disabled:opacity-50 text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? (lang === 'vi' ? 'Đang gửi hồ sơ...' : 'Submitting...')
                          : existingVerification?.status === 'RESUBMIT_REQUIRED'
                            ? (lang === 'vi' ? 'Nộp lại chứng từ eKYC' : 'Resubmit eKYC Documents')
                            : isRegistered
                              ? (lang === 'vi' ? 'Cập nhật hồ sơ gian hàng' : 'Update Store Profile')
                              : (lang === 'vi' ? 'Xác nhận đăng ký & gửi duyệt eKYC' : 'Confirm Registration & Submit eKYC')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-gray-100 flex items-center justify-between text-xs text-slate-500">
          <span>{lang === 'vi' ? 'Đăng ký người bán được bảo lãnh bởi SecondLife Hub' : 'Seller registration secured by SecondLife Hub'}</span>
          {/* <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button> */}
        </div>
      </div>

      {/* Modal Nhập Mã OTP Xác Thực Email Shop Bắt Buộc Của BE */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {lang === 'vi' ? 'Xác thực email gian hàng' : 'Verify Shop Email'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'vi'
                  ? 'Hệ thống đã gửi mã OTP 6 số đến email đăng ký:'
                  : 'A 6-digit OTP code has been sent to:'}
              </p>
              <p className="text-xs font-bold text-[#c34c36] mt-0.5">
                {shopEmail || currentUser?.email}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isVerifyingBeforeSubmit
                  ? (lang === 'vi'
                    ? 'Theo quy định của SecondLife, email Shop cần được xác thực trước khi gửi hồ sơ eKYC.'
                    : 'Shop email must be verified before submitting eKYC.')
                  : (lang === 'vi'
                    ? 'Nhập mã 6 số để xác thực email gian hàng và tiếp tục điền form đăng ký.'
                    : 'Enter 6 digits to verify shop email and continue registration.')}
              </p>
            </div>

            {/* 6 OTP inputs */}
            <div className="flex justify-center gap-2 py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newDigits = [...otpDigits];
                    newDigits[idx] = val;
                    setOtpDigits(newDigits);
                    if (val && idx < 5) {
                      otpInputRefs.current[idx + 1]?.focus();
                    }
                    if (newDigits.every((d) => d !== '')) {
                      handleVerifyOtpAndSubmit(newDigits.join(''));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && idx > 0) {
                      otpInputRefs.current[idx - 1]?.focus();
                    }
                  }}
                  className="w-10 h-12 text-center text-lg font-black rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/20 outline-none bg-slate-50 text-slate-900"
                />
              ))}
            </div>

            {otpError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-medium flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCountdown > 0 || isSubmittingOtp}
                className="text-[#c34c36] font-bold hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${otpCountdown > 0 ? 'animate-spin' : ''}`} />
                <span>
                  {otpCountdown > 0
                    ? `${lang === 'vi' ? 'Gửi lại sau' : 'Resend in'} (${otpCountdown}s)`
                    : (lang === 'vi' ? 'Gửi lại mã OTP' : 'Resend OTP')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsOtpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleVerifyOtpAndSubmit()}
              disabled={isSubmittingOtp || otpDigits.some((d) => !d)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#24263e] hover:bg-[#1b1c2e] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingOtp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {isVerifyingBeforeSubmit
                      ? (lang === 'vi' ? 'Đang xác thực & Nộp eKYC...' : 'Verifying & Submitting...')
                      : (lang === 'vi' ? 'Đang xác thực OTP...' : 'Verifying OTP...')}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isVerifyingBeforeSubmit
                      ? (lang === 'vi' ? 'Xác thực OTP & nộp eKYC' : 'Verify OTP & Submit eKYC')
                      : (lang === 'vi' ? 'Xác nhận & tiếp tục' : 'Verify & Continue Form')}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal WebRTC Live Face Scanner eKYC */}
      <LiveFaceScannerModal
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
        onFaceCaptured={handleFaceCapturedFromCamera}
        lang={lang}
      />

      {/* Pháo hoa chúc mừng + đếm ngược 30s hướng dẫn thao tác tiếp theo sau khi đăng ký thành công */}
      <SellerCelebrationOverlay
        isOpen={showApprovalCelebration}
        shopName={shopName.trim()}
        lang={lang}
        countdownSeconds={30}
        onProceedNext={finishCelebrationAndRelogin}
        onGoToDashboard={finishCelebrationAndRelogin}
      />
    </div>
  );
};
