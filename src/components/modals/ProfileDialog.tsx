import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  CreditCard,
  Lock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  KeyRound,
  LogOut,
  Sparkles,
  Wallet,
  Shield,
  Save,
  Check,
  Star,
  Activity,
  ArrowUpRight,
  Store,
  ShoppingBag,
  Truck,
  FileCheck,
  Edit3,
  RefreshCw,
  LocateFixed,
  Loader2,
  Clock,
  AlertTriangle,
  Copy,
  PlusCircle,
} from 'lucide-react';
import { UserProfile, UserRole, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  userService,
  sellerService,
  mediaService,
  shippingService,
  GhnLocation,
  FALLBACK_PROVINCES,
  resolveProvinceFromText,
  normalizeAddressText,
  addressService,
  OpenApiProvince,
  OpenApiDistrict,
  OpenApiWard,
} from '../../services';
import { LiveFaceScannerModal, VnptEkycResultData } from './LiveFaceScannerModal';
import { saveSellerAddress } from '../../utils/addressUtils';

export type ProfileTab = 'info' | 'wallet' | 'kyc' | 'security' | 'settings';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const isStrongPassword = (pass: string): boolean => {
  return STRONG_PASSWORD_REGEX.test(pass);
};

interface ProfileDialogProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  currentRole?: UserRole;
  onUpdateProfile: (updated: UserProfile) => void;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onOpenVerifyEmail?: (email: string) => void;
  onOpenTopUp?: () => void;
  lang?: Language;
  initialTab?: ProfileTab;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
  onUpdateProfile,
  onRoleChange,
  onLogout,
  onChangePassword,
  onOpenVerifyEmail,
  onOpenTopUp,
  lang = 'vi',
  initialTab = 'info',
}) => {
  if (!isOpen || !currentUser) return null;

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Form states
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(currentUser.gender || 'male');
  const [birthday, setBirthday] = useState(currentUser.birthday || '1998-05-18');
  const [bankName, setBankName] = useState(currentUser.bankAccount?.bankName || 'Vietcombank');
  const [accountNumber, setAccountNumber] = useState(
    currentUser.bankAccount?.accountNumber || '991204882910'
  );
  const [accountHolder, setAccountHolder] = useState(
    currentUser.bankAccount?.accountHolder || (currentUser.name ? currentUser.name.toUpperCase() : 'HOANG QUOC KHANG')
  );

  const [isSaved, setIsSaved] = useState(false);

  // Seller registration & switching states
  const [isSellerRegistered, setIsSellerRegistered] = useState<boolean>(
    Boolean(currentUser.isSellerRegistered || currentUser.role === 'seller')
  );
  const [shopName, setShopName] = useState(
    currentUser.shopName || (currentUser.name ? `Gian Hàng ${currentUser.name}` : 'SecondLife Shop')
  );
  const [sellerPhone, setSellerPhone] = useState(currentUser.phone || '');
  const [pickupAddress, setPickupAddress] = useState(
    currentUser.pickupAddress || currentUser.address || ''
  );
  const [idCardNumber, setIdCardNumber] = useState(currentUser.idCardNumber || '048299102941');
  const [sellerBankName, setSellerBankName] = useState(
    currentUser.bankAccount?.bankName || 'Vietcombank'
  );
  const [sellerAccountNumber, setSellerAccountNumber] = useState(
    currentUser.bankAccount?.accountNumber || '991204882910'
  );
  const [sellerAccountHolder, setSellerAccountHolder] = useState(
    currentUser.bankAccount?.accountHolder || (currentUser.name ? currentUser.name.toUpperCase() : 'HOANG QUOC KHANG')
  );
  const [sellerProductTypes, setSellerProductTypes] = useState('Tủ lạnh, Máy giặt, Thiết bị điện lạnh gia dụng');
  const [sellerTermsAgreed, setSellerTermsAgreed] = useState(true);
  const [showSellerRegistrationForm, setShowSellerRegistrationForm] = useState(false);
  const [sellerFormSuccess, setSellerFormSuccess] = useState<string | null>(null);
  const [sellerFormError, setSellerFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingSeller, setIsSubmittingSeller] = useState(false);

  // Seller Shop Email & OTP Verification States
  const [shopEmail, setShopEmail] = useState<string>(currentUser.email || email || '');
  const [isShopEmailVerified, setIsShopEmailVerified] = useState(false);
  const [shopOtpCode, setShopOtpCode] = useState('');
  const [isSendingShopOtp, setIsSendingShopOtp] = useState(false);
  const [isVerifyingShopOtp, setIsVerifyingShopOtp] = useState(false);
  const [shopOtpCountdown, setShopOtpCountdown] = useState(0);
  const [hasSentShopOtp, setHasSentShopOtp] = useState(false);
  const [shopOtpError, setShopOtpError] = useState<string | null>(null);
  const [shopOtpSuccess, setShopOtpSuccess] = useState<string | null>(null);

  // Avatar & eKYC document upload states
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser?.avatar || '');
  const [imgError, setImgError] = useState(false);
  const [docFrontUrl, setDocFrontUrl] = useState<string>('');
  const [docBackUrl, setDocBackUrl] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [uploadingField, setUploadingField] = useState<'avatar' | 'front' | 'back' | 'selfie' | null>(null);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [vnptClientSession, setVnptClientSession] = useState<string>('');
  const [vnptToken, setVnptToken] = useState<string>('');
  const [vnptLivenessResult, setVnptLivenessResult] = useState<any>(null);

  const [existingVerification, setExistingVerification] = useState<any>(null);
  const verStatus = existingVerification?.status || (currentUser?.kycStatus === 'pending' ? 'NEEDS_REVIEW' : null);
  const isPendingReview = verStatus === 'SUBMITTED' || verStatus === 'EKYC_PENDING' || verStatus === 'NEEDS_REVIEW' || verStatus === 'PENDING';
  const isResubmitRequired = verStatus === 'RESUBMIT_REQUIRED';
  const isRejected = verStatus === 'REJECTED';

  // Change password modal state
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  // BE Shipping & Pickup Address state
  const [provinces, setProvinces] = useState<GhnLocation[]>(FALLBACK_PROVINCES);
  const [wards, setWards] = useState<GhnLocation[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | string | ''>('');
  const [selectedWardId, setSelectedWardId] = useState<number | string | ''>('');
  const [streetAddress, setStreetAddress] = useState('');
  const [isLoadingAddressFromBe, setIsLoadingAddressFromBe] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // User Profile Open API Address state (Tỉnh/Thành, Quận/Huyện, Phường/Xã)
  const [userProvinces, setUserProvinces] = useState<OpenApiProvince[]>([]);
  const [userDistricts, setUserDistricts] = useState<OpenApiDistrict[]>([]);
  const [userWards, setUserWards] = useState<OpenApiWard[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | ''>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(currentUser.province || currentUser.provinceName || '');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | ''>('');
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>(currentUser.district || '');
  const [selectedWardCode, setSelectedWardCode] = useState<number | ''>('');
  const [selectedWardName, setSelectedWardName] = useState<string>(currentUser.ward || currentUser.wardName || '');
  const [userStreetAddress, setUserStreetAddress] = useState<string>(currentUser.streetAddress || '');

  const [isLoadingUserProvinces, setIsLoadingUserProvinces] = useState(false);
  const [isLoadingUserDistricts, setIsLoadingUserDistricts] = useState(false);
  const [isLoadingUserWards, setIsLoadingUserWards] = useState(false);

  const computeFullAddress = () => {
    const parts = [
      userStreetAddress.trim(),
      selectedWardName.trim(),
      selectedDistrictName.trim(),
      selectedProvinceName.trim(),
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Tải danh sách Open API và khớp địa chỉ người dùng
  const syncOpenApiAddress = async (
    targetProvince?: string,
    targetDistrict?: string,
    targetWard?: string,
    targetStreet?: string
  ) => {
    setIsLoadingUserProvinces(true);
    try {
      const pList = await addressService.getProvinces();
      setUserProvinces(pList);

      if (targetStreet) {
        setUserStreetAddress(targetStreet);
      }

      const provQuery = (targetProvince || '').trim().toLowerCase();
      if (!provQuery) return;

      const cleanQuery = (s: string) =>
        s.toLowerCase().replace(/^(tỉnh|thành phố|tp\.|tp|quận|huyện|thị xã|phường|xã|thị trấn)\s+/gi, '').trim();

      const normalizedProvQuery = cleanQuery(provQuery);

      const foundProv = pList.find((p) => {
        const pNorm = cleanQuery(p.name);
        return (
          p.name.toLowerCase() === provQuery ||
          pNorm === normalizedProvQuery ||
          p.name.toLowerCase().includes(provQuery) ||
          provQuery.includes(p.name.toLowerCase()) ||
          pNorm.includes(normalizedProvQuery) ||
          normalizedProvQuery.includes(pNorm)
        );
      });

      if (foundProv) {
        setSelectedProvinceCode(foundProv.code);
        setSelectedProvinceName(foundProv.name);

        setIsLoadingUserDistricts(true);
        const dList = await addressService.getDistricts(foundProv.code);
        setUserDistricts(dList);
        setIsLoadingUserDistricts(false);

        const distQuery = (targetDistrict || '').trim().toLowerCase();
        if (!distQuery) return;

        const normalizedDistQuery = cleanQuery(distQuery);

        const foundDist = dList.find((d) => {
          const dNorm = cleanQuery(d.name);
          return (
            d.name.toLowerCase() === distQuery ||
            dNorm === normalizedDistQuery ||
            d.name.toLowerCase().includes(distQuery) ||
            distQuery.includes(d.name.toLowerCase()) ||
            dNorm.includes(normalizedDistQuery) ||
            normalizedDistQuery.includes(dNorm)
          );
        });

        if (foundDist) {
          setSelectedDistrictCode(foundDist.code);
          setSelectedDistrictName(foundDist.name);

          setIsLoadingUserWards(true);
          const wList = await addressService.getWards(foundDist.code);
          setUserWards(wList);
          setIsLoadingUserWards(false);

          const wardQuery = (targetWard || '').trim().toLowerCase();
          if (!wardQuery) return;

          const normalizedWardQuery = cleanQuery(wardQuery);

          const foundWard = wList.find((w) => {
            const wNorm = cleanQuery(w.name);
            return (
              w.name.toLowerCase() === wardQuery ||
              wNorm === normalizedWardQuery ||
              w.name.toLowerCase().includes(wardQuery) ||
              wardQuery.includes(w.name.toLowerCase()) ||
              wNorm.includes(normalizedWardQuery) ||
              normalizedWardQuery.includes(wNorm)
            );
          });

          if (foundWard) {
            setSelectedWardCode(foundWard.code);
            setSelectedWardName(foundWard.name);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to sync Open API address:', err);
    } finally {
      setIsLoadingUserProvinces(false);
      setIsLoadingUserDistricts(false);
      setIsLoadingUserWards(false);
    }
  };

  const handleUserProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const pCode = rawVal ? Number(rawVal) : '';
    setSelectedProvinceCode(pCode);
    const pObj = userProvinces.find((p) => p.code === pCode);
    const newProvName = pObj ? pObj.name : '';
    setSelectedProvinceName(newProvName);

    setSelectedDistrictCode('');
    setSelectedDistrictName('');
    setSelectedWardCode('');
    setSelectedWardName('');
    setUserDistricts([]);
    setUserWards([]);

    const newFull = [userStreetAddress.trim(), '', '', newProvName].filter(Boolean).join(', ');
    setAddress(newFull);

    if (pCode) {
      setIsLoadingUserDistricts(true);
      try {
        const dList = await addressService.getDistricts(pCode);
        setUserDistricts(Array.isArray(dList) ? dList : []);
      } catch (err) {
        console.warn('handleUserProvinceChange error:', err);
        setUserDistricts([]);
      } finally {
        setIsLoadingUserDistricts(false);
      }
    }
  };

  const handleUserDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const dCode = rawVal ? Number(rawVal) : '';
    setSelectedDistrictCode(dCode);
    const dObj = userDistricts.find((d) => d.code === dCode);
    const newDistName = dObj ? dObj.name : '';
    setSelectedDistrictName(newDistName);

    setSelectedWardCode('');
    setSelectedWardName('');
    setUserWards([]);

    const newFull = [userStreetAddress.trim(), '', newDistName, selectedProvinceName].filter(Boolean).join(', ');
    setAddress(newFull);

    if (dCode) {
      setIsLoadingUserWards(true);
      try {
        const wList = await addressService.getWards(dCode);
        setUserWards(Array.isArray(wList) ? wList : []);
      } catch (err) {
        console.warn('handleUserDistrictChange error:', err);
        setUserWards([]);
      } finally {
        setIsLoadingUserWards(false);
      }
    }
  };

  const handleUserWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawVal = e.target.value;
    const wCode = rawVal ? Number(rawVal) : '';
    setSelectedWardCode(wCode);
    const wObj = userWards.find((w) => w.code === wCode);
    const newWardName = wObj ? wObj.name : '';
    setSelectedWardName(newWardName);

    const newFull = [userStreetAddress.trim(), newWardName, selectedDistrictName, selectedProvinceName].filter(Boolean).join(', ');
    setAddress(newFull);
  };

  const handleUserStreetAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserStreetAddress(val);
    const newFull = [val.trim(), selectedWardName, selectedDistrictName, selectedProvinceName].filter(Boolean).join(', ');
    setAddress(newFull);
  };

  // Sync state whenever currentUser or modal opens
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      setAvatarUrl(currentUser.avatar || '');
      setImgError(false);
      if (currentUser.gender) setGender(currentUser.gender);
      if (currentUser.birthday) setBirthday(currentUser.birthday);
      if (currentUser.bankAccount) {
        if (currentUser.bankAccount.bankName) setBankName(currentUser.bankAccount.bankName);
        if (currentUser.bankAccount.accountNumber) setAccountNumber(currentUser.bankAccount.accountNumber);
        if (currentUser.bankAccount.accountHolder) setAccountHolder(currentUser.bankAccount.accountHolder);
      }
      if (currentUser.province || currentUser.provinceName) {
        setSelectedProvinceName(currentUser.province || currentUser.provinceName || '');
      }
      if (currentUser.district) {
        setSelectedDistrictName(currentUser.district || '');
      }
      if (currentUser.ward || currentUser.wardName) {
        setSelectedWardName(currentUser.ward || currentUser.wardName || '');
      }
      if (currentUser.streetAddress) {
        setUserStreetAddress(currentUser.streetAddress || '');
      }
      setIsSellerRegistered(Boolean(currentUser.isSellerRegistered || currentUser.role === 'seller'));
      setShopName(currentUser.shopName || (currentUser.name ? `Gian Hàng ${currentUser.name}` : 'SecondLife Shop'));
      setSellerPhone(currentUser.phone || '');
      setPickupAddress(currentUser.pickupAddress || currentUser.address || '');
      const isInternalRole = ['admin', 'staff', 'inspector'].includes(currentUser.role);
      if (initialTab && !(isInternalRole && initialTab === 'settings')) {
        setActiveTab(initialTab);
      } else if (isInternalRole && activeTab === 'settings') {
        setActiveTab('info');
      }
    }
  }, [currentUser, isOpen, initialTab]);

  // Sync fresh profile data directly from Backend GET /api/users/me
  useEffect(() => {
    if (isOpen) {
      userService.getMyProfile()
        .then((fresh) => {
          if (fresh) {
            if (fresh.fullName) setName(fresh.fullName);
            if (fresh.email) setEmail(fresh.email);
            if (fresh.phone) setPhone(fresh.phone);
            if (fresh.avatarUrl) {
              setAvatarUrl(fresh.avatarUrl);
              setImgError(false);
            }
            if (fresh.province) setSelectedProvinceName(fresh.province);
            if (fresh.district) setSelectedDistrictName(fresh.district);
            if (fresh.ward) setSelectedWardName(fresh.ward);
            if (fresh.streetAddress) setUserStreetAddress(fresh.streetAddress);

            syncOpenApiAddress(
              fresh.province || currentUser?.province || currentUser?.provinceName,
              fresh.district || currentUser?.district,
              fresh.ward || currentUser?.ward || currentUser?.wardName,
              fresh.streetAddress || currentUser?.streetAddress
            );
          }
        })
        .catch((err) => {
          console.warn('Backend getMyProfile fallback to local session:', err);
          syncOpenApiAddress(
            currentUser?.province || currentUser?.provinceName,
            currentUser?.district,
            currentUser?.ward || currentUser?.wardName,
            currentUser?.streetAddress
          );
        });

      sellerService.getMyVerification()
        .then((verif) => {
          if (verif) {
            setExistingVerification(verif);
            if (verif.documentNumber) setIdCardNumber(verif.documentNumber);
            if (verif.documentFrontUrl) {
              setDocFrontUrl(verif.documentFrontUrl);
            }
            if (verif.documentBackUrl) {
              setDocBackUrl(verif.documentBackUrl);
            }
            if (verif.selfieUrl) {
              setSelfieUrl(verif.selfieUrl);
            }
            if (verif.status === 'RESUBMIT_REQUIRED') {
              setShowSellerRegistrationForm(true);
            } else if (['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(verif.status)) {
              setShowSellerRegistrationForm(false);
            }
          }
        })
        .catch(() => setExistingVerification(null));
    }
  }, [isOpen]);

  // Fetch address and catalogue from Backend
  const fetchAddressFromBackend = async (showNotification = false) => {
    setIsLoadingAddressFromBe(true);
    try {
      const [onboardingData, pickupData] = await Promise.allSettled([
        shippingService.getSellerOnboarding(),
        shippingService.getPickupAddress(),
      ]);

      let addressFound = false;

      if (onboardingData.status === 'fulfilled' && onboardingData.value) {
        const ob = onboardingData.value;
        if (ob.shopName) setShopName(ob.shopName);
        if (ob.phone) setSellerPhone(ob.phone);
        if (ob.email) setShopEmail(ob.email);
        if (ob.emailVerified) setIsShopEmailVerified(true);

        if (ob.pickupAddress) {
          const pa = ob.pickupAddress;
          const fullAddr = [pa.address, pa.wardName, pa.provinceName].filter(Boolean).join(', ');
          if (fullAddr) {
            setPickupAddress(fullAddr);
            setStreetAddress(pa.address || '');
            addressFound = true;
          }
        }
        if (ob.provinceId) {
          setSelectedProvinceId(ob.provinceId);
          shippingService.getWards(ob.provinceId)
            .then((wList) => setWards(Array.isArray(wList) ? wList : []))
            .catch(() => setWards([]));
        }
        if (ob.wardId) {
          setSelectedWardId(ob.wardId);
        }
      }

      if (!addressFound && pickupData.status === 'fulfilled' && pickupData.value) {
        const pa = pickupData.value;
        const fullAddr = [pa.address, pa.wardName, pa.provinceName].filter(Boolean).join(', ');
        if (fullAddr) {
          setPickupAddress(fullAddr);
          setStreetAddress(pa.address || '');
          addressFound = true;
        }
      }

      if (!addressFound && currentUser?.address) {
        setPickupAddress(currentUser.address);
        setStreetAddress(currentUser.address);
      }

      if (showNotification) {
        if (addressFound) {
          setSellerFormSuccess('Đã lấy thành công địa chỉ kho đã lưu từ hệ thống BE!');
        } else {
          setSellerFormSuccess('Đã đồng bộ thông tin từ BE (vui lòng chọn Tỉnh/Phường bên dưới).');
        }
        setTimeout(() => setSellerFormSuccess(null), 4000);
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

  // Load provinces and saved pickup address on open
  useEffect(() => {
    if (isOpen) {
      shippingService.getProvinces()
        .then((pList) => {
          if (Array.isArray(pList) && pList.length > 0) {
            setProvinces(pList);
          }
        })
        .catch((err) => console.warn('Load provinces fallback:', err));
      fetchAddressFromBackend(false);
    }
  }, [isOpen]);

  // Định vị GPS trực tiếp & tự động điền địa chỉ kho
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSellerFormError(
        lang === 'vi'
          ? 'Trình duyệt của bạn không hỗ trợ tính năng định vị GPS.'
          : 'Geolocation is not supported by your browser.'
      );
      return;
    }

    setIsDetectingLocation(true);
    setSellerFormError(null);

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

          setSellerFormSuccess(
            lang === 'vi'
              ? '📍 Đã tự động điền vị trí hiện tại! Bạn có thể tự do chỉnh sửa lại các ô bên dưới nếu cần.'
              : '📍 Location auto-filled! You can freely edit any fields below.'
          );
          setTimeout(() => setSellerFormSuccess(null), 5000);
        } catch (err) {
          console.warn('Geolocation parsing error:', err);
          setSellerFormError(
            lang === 'vi'
              ? 'Không thể phân tích địa chỉ từ toạ độ. Vui lòng tự chọn thông tin bên dưới.'
              : 'Could not resolve address from coordinates. Please select manually.'
          );
          setTimeout(() => setSellerFormError(null), 5000);
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
        setSellerFormError(msg);
        setTimeout(() => setSellerFormError(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'front' | 'back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(field);
    try {
      const folder = field === 'avatar' ? 'avatars' : 'seller-verifications';
      const uploaded = await mediaService.uploadImage(file, folder);
      if (field === 'avatar') {
        setAvatarUrl(uploaded.url);
        setImgError(false);
        try {
          await userService.updateMyProfile({ avatarUrl: uploaded.url });
          const updated: UserProfile = {
            ...currentUser,
            avatar: uploaded.url,
          };
          onUpdateProfile(updated);
        } catch (updateErr) {
          console.warn('Auto sync avatar to profile error:', updateErr);
        }
      }
      if (field === 'front') setDocFrontUrl(uploaded.url);
      if (field === 'back') setDocBackUrl(uploaded.url);
      if (field === 'selfie') setSelfieUrl(uploaded.url);
    } catch (err: any) {
      alert(err.message || 'Tải ảnh lên không thành công');
    } finally {
      setUploadingField(null);
    }
  };

  useEffect(() => {
    if (shopOtpCountdown <= 0) return;
    const timer = setInterval(() => {
      setShopOtpCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [shopOtpCountdown]);

  const handleSendShopOtp = async () => {
    const targetEmail = (shopEmail || currentUser.email || email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setSellerFormError(lang === 'vi' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : 'Please enter a valid email.');
      return;
    }
    setIsSendingShopOtp(true);
    setShopOtpError(null);
    setShopOtpSuccess(null);
    setSellerFormError(null);
    try {
      const cleanPhone = (sellerPhone || '').replace(/\s+/g, '').trim() || '0900000000';
      const cleanShop = (shopName || '').trim().slice(0, 30) || 'SecondLife Shop';
      await shippingService.saveSellerOnboarding({
        shopName: cleanShop,
        email: targetEmail,
        phone: cleanPhone,
        pickupAddress: {
          name: cleanShop,
          phone: cleanPhone,
          address: streetAddress.trim() || pickupAddress.trim() || 'Hà Nội',
          provinceId: Number(selectedProvinceId) || 1000001,
          wardId: Number(selectedWardId) || 1003646,
        },
      });

      const selProv = provinces.find((p) => String(p._id) === String(selectedProvinceId) || String((p as any).id) === String(selectedProvinceId));
      const selWard = wards.find((w) => String(w._id) === String(selectedWardId) || String((w as any).id) === String(selectedWardId));
      saveSellerAddress(pickupAddress.trim() || streetAddress.trim(), selWard?.name, selProv?.name);

      await shippingService.sendSellerOnboardingEmailCode();
      setHasSentShopOtp(true);
      setShopOtpCountdown(60);
      setShopOtpSuccess(
        lang === 'vi'
          ? `Đã gửi mã xác thực 6 số đến ${targetEmail}. Vui lòng kiểm tra hộp thư (hoặc mục Spam).`
          : `Sent 6-digit OTP code to ${targetEmail}. Please check inbox or spam.`
      );
    } catch (err: any) {
      setShopOtpError(err.message || (lang === 'vi' ? 'Không thể gửi mã OTP. Vui lòng thử lại.' : 'Failed to send OTP.'));
    } finally {
      setIsSendingShopOtp(false);
    }
  };

  const handleVerifyShopOtp = async () => {
    const code = shopOtpCode.trim();
    if (code.length !== 6) {
      setShopOtpError(lang === 'vi' ? 'Vui lòng nhập đủ 6 chữ số mã OTP.' : 'Please enter 6-digit OTP.');
      return;
    }
    setIsVerifyingShopOtp(true);
    setShopOtpError(null);
    try {
      await shippingService.verifySellerOnboardingEmailCode(code);
      setIsShopEmailVerified(true);
      setShopOtpSuccess(
        lang === 'vi'
          ? 'Xác thực email thành công! Bạn đã đủ điều kiện thực hiện eKYC.'
          : 'Email verified! Ready for eKYC.'
      );
      setShopOtpError(null);
    } catch (err: any) {
      setShopOtpError(err.message || (lang === 'vi' ? 'Mã OTP không đúng hoặc đã hết hạn.' : 'Invalid or expired OTP.'));
    } finally {
      setIsVerifyingShopOtp(false);
    }
  };

  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerFormError(null);
    setSellerFormSuccess(null);

    if (['admin', 'staff', 'inspector'].includes(currentUser?.role || '')) {
      setSellerFormError(
        lang === 'vi'
          ? 'Tài khoản Quản trị viên (Admin), Nhân viên (Staff) và Kỹ sư Hub (Inspector) không được phép đăng ký làm Người Bán.'
          : 'Administrator, Staff, and Hub Inspector accounts are not allowed to register as a Seller.'
      );
      return;
    }

    if (isPendingReview) {
      setSellerFormError(
        lang === 'vi'
          ? 'Hồ sơ của bạn đang được Ban Quản trị xét duyệt. Bạn không thể gửi lại yêu cầu lúc này. Vui lòng chờ kết quả phê duyệt trong 24 giờ.'
          : 'Your application is pending review. You cannot resubmit at this time.'
      );
      return;
    }

    if (!shopName.trim()) {
      setSellerFormError('Vui lòng nhập tên gian hàng / cửa hàng.');
      return;
    }
    if (!sellerPhone.trim()) {
      setSellerFormError('Vui lòng nhập số điện thoại kinh doanh.');
      return;
    }
    if (!pickupAddress.trim()) {
      setSellerFormError('Vui lòng nhập địa chỉ kho bưu tá lấy hàng.');
      return;
    }
    if (!idCardNumber.trim()) {
      setSellerFormError('Vui lòng nhập số CCCD để xác minh danh tính người bán.');
      return;
    }
    if (!docFrontUrl || !docBackUrl) {
      setSellerFormError('Vui lòng tải lên đầy đủ ảnh CCCD mặt trước và mặt sau.');
      return;
    }
    if (!sellerTermsAgreed) {
      setSellerFormError('Vui lòng đồng ý với cam kết chất lượng Hub và cơ chế Escrow.');
      return;
    }

    if (!isShopEmailVerified) {
      setSellerFormError(
        lang === 'vi'
          ? 'Vui lòng xác thực email gian hàng trước khi nộp hồ sơ eKYC (Bấm "Gửi mã OTP" và nhập mã xác thực bên dưới).'
          : 'Please verify shop email before starting eKYC.'
      );
      if (!hasSentShopOtp) {
        handleSendShopOtp();
      }
      return;
    }

    setIsSubmittingSeller(true);
    try {
      // 1. Nếu chưa lưu onboarding thì lưu (đã lưu ở bước gửi OTP)
      if (!isShopEmailVerified) {
        try {
          const cleanPhone = (sellerPhone || '').replace(/\s+/g, '').trim();
          const cleanShop = (shopName || '').trim().slice(0, 30);
          await shippingService.saveSellerOnboarding({
            shopName: cleanShop,
            email: (shopEmail || currentUser?.email || email || 'seller@secondlife.vn').trim(),
            phone: cleanPhone,
            pickupAddress: {
              name: cleanShop,
              phone: cleanPhone,
              address: streetAddress.trim() || pickupAddress.trim(),
              provinceId: Number(selectedProvinceId) || 1000001,
              wardId: Number(selectedWardId) || 1003646,
            },
          });
        } catch (onboardingErr) {
          console.warn('Backend saveSellerOnboarding notification:', onboardingErr);
        }
      }

      // 2. Submit or resubmit eKYC verification
      let verificationResponse;
      try {
        const checkVerif = await sellerService.getMyVerification();
        if (checkVerif?.status === 'RESUBMIT_REQUIRED') {
          verificationResponse = await sellerService.resubmitVerification(checkVerif.id, {
            documentFrontUrl: docFrontUrl,
            documentBackUrl: docBackUrl,
            selfieUrl: selfieUrl || undefined,
            clientSession: vnptClientSession || undefined,
            token: vnptToken || undefined,
          });
        }
      } catch (_) { }

      if (!verificationResponse) {
        verificationResponse = await sellerService.submitVerification({
          verificationType: 'CITIZEN_ID',
          documentNumber: idCardNumber.trim(),
          documentFrontUrl: docFrontUrl,
          documentBackUrl: docBackUrl,
          selfieUrl: selfieUrl || undefined,
          clientSession: vnptClientSession || `ANDROID_Web_1.0_Device_1.0.0_web_${Date.now()}`,
          token: vnptToken || `vnpt-token-${Date.now()}`,
        });
      }

      const status = verificationResponse?.status;

      if (status === 'APPROVED') {
        const updated: UserProfile = {
          ...currentUser,
          isSellerRegistered: true,
          role: 'seller',
          kycStatus: 'verified',
          shopName: shopName.trim(),
          pickupAddress: pickupAddress.trim(),
          phone: sellerPhone.trim(),
          idCardNumber: idCardNumber.trim(),
          bankAccount: {
            bankName: sellerBankName.trim() || bankName,
            accountNumber: sellerAccountNumber.trim() || accountNumber,
            accountHolder: sellerAccountHolder.trim() || accountHolder,
          },
        };

        setIsSellerRegistered(true);
        setShowSellerRegistrationForm(false);
        onUpdateProfile(updated);
        setSellerFormSuccess(
          lang === 'vi'
            ? '🎉 Xác thực eKYC thành công! Quyền Người Bán của bạn đã được kích hoạt tự động.'
            : '🎉 eKYC verified successfully! Your seller role is now active.'
        );
      } else {
        const updated: UserProfile = {
          ...currentUser,
          isSellerRegistered: true,
          kycStatus: 'pending',
          shopName: shopName.trim(),
          pickupAddress: pickupAddress.trim(),
          phone: sellerPhone.trim(),
          idCardNumber: idCardNumber.trim(),
          bankAccount: {
            bankName: sellerBankName.trim() || bankName,
            accountNumber: sellerAccountNumber.trim() || accountNumber,
            accountHolder: sellerAccountHolder.trim() || accountHolder,
          },
        };

        setIsSellerRegistered(true);
        setShowSellerRegistrationForm(false);
        onUpdateProfile(updated);
        setSellerFormSuccess(
          lang === 'vi'
            ? status === 'NEEDS_REVIEW'
              ? '📋 Hồ sơ đã được tiếp nhận. Đang chờ Quản trị viên duyệt thủ công trong vòng 24h.'
              : 'Hồ sơ định danh eKYC đã được gửi thành công! Hồ sơ đang ở trạng thái Chờ duyệt bởi Quản trị viên.'
            : 'eKYC verification submitted successfully! It is pending review.'
        );
      }
      setTimeout(() => setSellerFormSuccess(null), 5000);
    } catch (err: any) {
      setSellerFormError(
        err.message ||
        (lang === 'vi'
          ? 'Gửi hồ sơ định danh không thành công. Vui lòng kiểm tra lại thông tin.'
          : 'Failed to submit eKYC verification. Please try again.')
      );
    } finally {
      setIsSubmittingSeller(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword) {
      setPassError(lang === 'vi' ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPassError(lang === 'vi' ? 'Vui lòng nhập mật khẩu mới.' : 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPassError(lang === 'vi' ? 'Mật khẩu mới phải có ít nhất 8 ký tự.' : 'New password must be at least 8 characters long.');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setPassError(
        lang === 'vi'
          ? 'Mật khẩu mới phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt.'
          : 'New password must contain uppercase, lowercase, numbers, and special characters.'
      );
      return;
    }
    if (!confirmPassword) {
      setPassError(lang === 'vi' ? 'Vui lòng nhập lại mật khẩu mới để xác nhận.' : 'Please confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError(lang === 'vi' ? 'Xác nhận mật khẩu không khớp.' : 'Password confirmation does not match.');
      return;
    }

    setIsSubmittingPass(true);
    try {
      await userService.changeMyPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPassSuccess(
        lang === 'vi'
          ? 'Đổi mật khẩu thành công! Tất cả các phiên đăng nhập khác đã được đăng xuất.'
          : 'Password changed successfully! All other sessions have been logged out.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePassModalOpen(false);
        setPassSuccess(null);
      }, 2500);
    } catch (err: any) {
      setPassError(
        err?.message ||
        (lang === 'vi'
          ? 'Đổi mật khẩu thất bại. Mật khẩu hiện tại không đúng.'
          : 'Failed to change password. Current password may be incorrect.')
      );
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    const fullAddr = computeFullAddress() || address.trim();

    const updated: UserProfile = {
      ...currentUser,
      name: name.trim(),
      email,
      phone: phone.trim(),
      address: fullAddr,
      province: selectedProvinceName.trim() || undefined,
      provinceName: selectedProvinceName.trim() || undefined,
      district: selectedDistrictName.trim() || undefined,
      ward: selectedWardName.trim() || undefined,
      wardName: selectedWardName.trim() || undefined,
      streetAddress: userStreetAddress.trim() || undefined,
      avatar: avatarUrl || currentUser.avatar,
      gender,
      birthday,
      bankAccount: {
        bankName,
        accountNumber,
        accountHolder,
      },
    };

    saveSellerAddress(
      pickupAddress || fullAddr,
      selectedWardName.trim() || currentUser?.wardName,
      selectedProvinceName.trim() || currentUser?.provinceName
    );

    try {
      await userService.updateMyProfile({
        fullName: name.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
        province: selectedProvinceName.trim() || undefined,
        district: selectedDistrictName.trim() || undefined,
        ward: selectedWardName.trim() || undefined,
        streetAddress: userStreetAddress.trim() || undefined,
        latitude: null,
        longitude: null,
      });

      onUpdateProfile(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setSaveError(
        err.message ||
        (lang === 'vi'
          ? 'Cập nhật thông tin thất bại. Vui lòng thử lại.'
          : 'Failed to update profile. Please try again.')
      );
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'buyer':
        return {
          label: lang === 'vi' ? 'Người Mua Xác Thực (Verified Buyer)' : 'Verified Buyer',
          className: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
        };
      case 'seller':
        return {
          label: lang === 'vi' ? 'Nhà Bán Hàng Uy Tín (Top Seller 4.9★)' : 'Verified Seller (4.9★)',
          className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
        };
      case 'staff':
        return {
          label: lang === 'vi' ? 'Nhân Viên Vận Hành (Operations Staff)' : 'Operations Staff',
          className: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
        };
      case 'inspector':
        return {
          label: lang === 'vi' ? 'Kỹ Sư Giám Định Hub (Certified Lab Tech)' : 'Certified Lab Tech',
          className: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
        };
      case 'admin':
        return {
          label: lang === 'vi' ? 'Quản Trị Viên Hệ Thống (Supervisor)' : 'System Administrator',
          className: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
        };
      default:
        return {
          label: role,
          className: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-3xl bg-[#FFFFFF] border border-gray-200 shadow-2xl text-[#24263e] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Profile Cover */}
        <div className="relative">
          {/* Cover gradient banner */}
          <div className="h-28 sm:h-32 bg-gradient-to-r from-[#1e2238] via-[#2d2a45] to-[#c34c36] rounded-t-3xl relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#c34c36]/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-1/4 w-36 h-36 bg-[#fce5da]/20 rounded-full blur-2xl pointer-events-none" />

            {/* Top Bar inside Cover */}
            <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold border border-white/15 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono">
                  {currentUser.id.length > 16
                    ? `ID: ${currentUser.id.slice(0, 8)}...${currentUser.id.slice(-6)}`
                    : `ID: ${currentUser.id}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentUser.id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  title={lang === 'vi' ? 'Sao chép Member ID' : 'Copy Member ID'}
                  className="ml-1 p-0.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition cursor-pointer hover:rotate-90 duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Profile Identity Bar - 100% on White Background (Zero Overlap Issues) */}
        <div className="px-6 sm:px-8 pt-0 pb-2 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">

            {/* Left: Avatar (overlaps banner cleanly) + User Name & Role */}
            <div className="flex items-end gap-3.5 sm:gap-4">
              {/* Avatar overlapping banner */}
              <div className="relative group shrink-0 -mt-12 sm:-mt-14 z-20">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-[#c34c36] to-[#fce5da] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xl ring-4 ring-white overflow-hidden bg-white relative">
                  {(avatarUrl || currentUser.avatar) && !imgError ? (
                    <img
                      src={avatarUrl || currentUser.avatar}
                      alt={name || currentUser.name}
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    ((name && name !== 'string' ? name : currentUser.name && currentUser.name !== 'string' ? currentUser.name : 'U').charAt(0).toUpperCase())
                  )}
                </div>

                {/* Hidden File Input for Avatar upload */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'avatar')}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingField === 'avatar'}
                  title={lang === 'vi' ? 'Thay đổi ảnh đại diện' : 'Change avatar'}
                  className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-white shadow-md border border-slate-200 text-slate-700 hover:text-[#c34c36] hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  {uploadingField === 'avatar' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c34c36]" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Name & Role Badge - completely readable on clean white */}
              <div className="space-y-1.5 pb-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {name || currentUser.name}
                  </h2>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleInfo.className}`}
                  >
                    <span>{roleInfo.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    SecondLife Member
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Trust Badges */}
            {currentUser.role !== 'buyer' && (
              <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  title={lang === 'vi' ? 'Xem chứng nhận định danh eKYC' : 'View eKYC certificate'}
                  className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl border border-emerald-200/80 font-bold text-xs shadow-xs cursor-pointer transition active:scale-95"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'vi' ? 'eKYC: Đã Xác Thực CCCD' : 'eKYC: ID Verified'}</span>
                </button>
                <div className="inline-flex items-center gap-1 bg-amber-50/90 text-slate-800 px-3 py-1 rounded-xl border border-amber-200/80 text-xs shadow-xs">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>{lang === 'vi' ? 'Điểm Uy Tín: ' : 'Trust Score: '}</span>
                  <strong className="font-black text-amber-700">99/100</strong>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation - Pill Segmented Control Layout: 4 Tabs */}
          <div className="px-6 sm:px-8 mt-5">
            <div className="p-1 sm:p-1.5 bg-slate-100/90 rounded-2xl flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none border border-slate-200/50">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'bg-white text-[#c34c36] shadow-sm font-black border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <User className={`w-4 h-4 shrink-0 ${activeTab === 'info' ? 'text-[#c34c36]' : 'text-slate-500'}`} />
                <span>{lang === 'vi' ? 'Cá Nhân' : 'Profile'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'wallet'
                    ? 'bg-white text-[#c34c36] shadow-sm font-black border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Wallet className={`w-4 h-4 shrink-0 ${activeTab === 'wallet' ? 'text-[#c34c36]' : 'text-slate-500'}`} />
                <span>{lang === 'vi' ? 'Ví Escrow' : 'Wallet'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'security' || activeTab === 'kyc'
                    ? 'bg-white text-[#c34c36] shadow-sm font-black border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Shield className={`w-4 h-4 shrink-0 ${activeTab === 'security' || activeTab === 'kyc' ? 'text-[#c34c36]' : 'text-slate-500'}`} />
                <span>{lang === 'vi' ? 'Bảo Mật' : 'Security'}</span>
              </button>

              {!['admin', 'staff', 'inspector'].includes(currentUser.role) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'settings'
                      ? 'bg-white text-[#c34c36] shadow-sm font-black border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Store className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-[#c34c36]' : 'text-slate-500'}`} />
                  <span>{lang === 'vi' ? 'Gian Hàng' : 'Store'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto subtle-scrollbar">
          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === 'info' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    {lang === 'vi' ? 'Họ và Tên' : 'Full Name'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder={lang === 'vi' ? 'Nhập họ và tên' : 'Enter full name'}
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      {lang === 'vi' ? 'Địa Chỉ Email' : 'Email Address'}
                    </label>
                    {currentUser.emailVerified ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {lang === 'vi' ? 'Đã xác thực' : 'Verified'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenVerifyEmail?.(email || currentUser.email)}
                        className="text-[10px] font-bold text-[#c34c36] bg-[#fce5da]/50 hover:bg-[#fce5da] px-2 py-0.5 rounded-md border border-[#c34c36]/20 inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Mail className="w-3 h-3" /> {lang === 'vi' ? 'Xác thực OTP ngay' : 'Verify OTP now'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="email@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition shadow-2xs"
                    />
                  </div>
                </div>

                {currentRole !== 'admin' && (
                  <>
                    <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    {lang === 'vi' ? 'Số Điện Thoại (Nhận mã OTP / Bưu tá gọi)' : 'Phone Number (OTP / Courier)'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="0912 345 678"
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    {lang === 'vi' ? 'Ngày Sinh' : 'Date of Birth'}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition shadow-2xs"
                    />
                  </div>
                  </>
                )}
              </div>

              {currentRole !== 'admin' && (
                <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  {lang === 'vi' ? 'Giới Tính' : 'Gender'}
                </label>
                <div className="grid grid-cols-3 gap-2.5 max-w-sm">
                  {(['male', 'female', 'other'] as const).map((g) => {
                    const isSelected = gender === g;
                    const labels = {
                      male: lang === 'vi' ? 'Nam' : 'Male',
                      female: lang === 'vi' ? 'Nữ' : 'Female',
                      other: lang === 'vi' ? 'Khác' : 'Other',
                    };
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-[#c34c36]/10 border-[#c34c36] text-[#c34c36] shadow-2xs font-black'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#c34c36]' : 'bg-slate-300'}`} />
                        <span>{labels[g]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Địa Chỉ Hành Chính 3 Cấp & Chi Tiết (Open API) */}
              {currentRole !== 'admin' && (
                <div className="p-3.5 bg-gradient-to-br from-[#faf8f5] to-orange-50/20 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Địa Chỉ Cư Trú / Nhận Hàng' : 'Residential / Delivery Address'}</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {lang === 'vi' ? 'Dữ liệu hành chính chuẩn (Open API)' : 'Standard administrative data'}
                  </span>
                </div>

                {/* 3 Dropdown: Tỉnh / Quận / Phường */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {lang === 'vi' ? 'Tỉnh / Thành Phố' : 'Province / City'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProvinceCode}
                      onChange={handleUserProvinceChange}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition cursor-pointer"
                    >
                      <option value="">
                        {isLoadingUserProvinces
                          ? (lang === 'vi' ? 'Đang tải tỉnh/thành...' : 'Loading provinces...')
                          : `-- ${lang === 'vi' ? 'Chọn Tỉnh / Thành' : 'Select Province'} --`}
                      </option>
                      {userProvinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {lang === 'vi' ? 'Quận / Huyện' : 'District'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedDistrictCode}
                      onChange={handleUserDistrictChange}
                      disabled={!selectedProvinceCode || isLoadingUserDistricts}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isLoadingUserDistricts
                          ? (lang === 'vi' ? 'Đang tải quận/huyện...' : 'Loading districts...')
                          : !selectedProvinceCode
                            ? (lang === 'vi' ? '-- Chọn tỉnh trước --' : '-- Select province first --')
                            : `-- ${lang === 'vi' ? 'Chọn Quận / Huyện' : 'Select District'} --`}
                      </option>
                      {userDistricts.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {lang === 'vi' ? 'Phường / Xã' : 'Ward / Commune'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedWardCode}
                      onChange={handleUserWardChange}
                      disabled={!selectedDistrictCode || isLoadingUserWards}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isLoadingUserWards
                          ? (lang === 'vi' ? 'Đang tải phường/xã...' : 'Loading wards...')
                          : !selectedDistrictCode
                            ? (lang === 'vi' ? '-- Chọn quận trước --' : '-- Select district first --')
                            : `-- ${lang === 'vi' ? 'Chọn Phường / Xã' : 'Select Ward'} --`}
                      </option>
                      {userWards.map((w) => (
                        <option key={w.code} value={w.code}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Input Text: Số nhà, tên đường chi tiết */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {lang === 'vi' ? 'Số nhà, tên đường, ngõ ngách chi tiết' : 'Street address / House number'}
                  </label>
                  <input
                    type="text"
                    value={userStreetAddress}
                    onChange={handleUserStreetAddressChange}
                    placeholder={lang === 'vi' ? 'Ví dụ: Số 202, Đường số 8, Khu phố 6' : 'e.g. 202 Street 8'}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#c34c36] focus:ring-2 focus:ring-[#c34c36]/15 transition shadow-2xs"
                  />
                </div>

                {/* Xem trước địa chỉ hoàn chỉnh */}
                {(computeFullAddress() || address) && (
                  <div className="p-2.5 bg-white/80 rounded-xl border border-orange-200/60 flex items-start gap-2 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-[#c34c36] shrink-0 mt-0.5" />
                    <div className="text-slate-700">
                      <span className="font-bold text-slate-800">{lang === 'vi' ? 'Địa chỉ đầy đủ: ' : 'Full Address: '}</span>
                      <span>{computeFullAddress() || address}</span>
                    </div>
                  </div>
                )}
              </div>
              )}



              {/* Action Buttons inside Tab 1 */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <div>
                  {isSaved && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Đã lưu thông tin thành công!' : 'Profile saved successfully!'}</span>
                    </span>
                  )}
                  {saveError && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span>{saveError}</span>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#b03e29] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'vi' ? 'Đang lưu...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: VÍ ESCROW & TÀI KHOẢN NGÂN HÀNG */}
          {activeTab === 'wallet' && (
            <div className="space-y-5">
              {/* Financial Balance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-[#fce5da] text-[#24263e] space-y-2 relative overflow-hidden shadow-md border border-[#24263e]/15">
                  <div className="flex items-center justify-between text-xs text-[#24263e]/80 font-bold">
                    <span className="font-bold flex items-center gap-1.5 text-[#24263e]">
                      <Wallet className="w-4 h-4 text-[#c34c36]" />
                      {lang === 'vi' ? 'Số Dư Khả Dụng Trong Ví' : 'Available Wallet Balance'}
                    </span>
                    <span className="text-[10px] bg-white text-emerald-900 border border-emerald-500/30 px-2 py-0.5 rounded font-black">
                      {lang === 'vi' ? 'Sẵn Sàng Rút' : 'Ready to Withdraw'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#24263e] tracking-tight">
                    {formatVND(currentUser.walletBalanceVnd || currentUser.walletBalance || 0)}
                  </div>
                  <p className="text-[11px] text-[#24263e]/80 font-medium">
                    {lang === 'vi'
                      ? 'Tiền trong ví dùng để thanh toán mua hàng an toàn qua Quỹ Escrow hoặc rút về tài khoản ngân hàng.'
                      : 'Funds in your wallet used for secure Escrow transactions or bank withdrawal.'}
                  </p>
                  {onOpenTopUp && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenTopUp}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-black shadow-sm transition cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Nạp Tiền Vào Ví (VietQR)' : 'Top Up Wallet (VietQR)'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#faf8f5] to-[#faf8f5] border border-[#c34c36]/30 text-[#24263e] space-y-2 relative overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#24263e]" />
                      {lang === 'vi' ? 'Tiền Đang Phong Tỏa Escrow' : 'Funds in Escrow Hold'}
                    </span>
                    <span className="text-[10px] bg-[#c34c36]/10 text-[#24263e] px-2 py-0.5 rounded font-bold">
                      {lang === 'vi' ? 'Đang Bảo Lãnh' : 'Under Escrow Protection'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#24263e] tracking-tight">
                    {formatVND(currentUser.escrowLockedVnd || 19562500)}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'vi'
                      ? 'Bảo đảm an toàn cho các đơn hàng đang trên đường giao hoặc chờ kiểm tra 48h.'
                      : 'Safeguarding orders currently in transit or in the 48h inspection window.'}
                  </p>
                </div>
              </div>

              {/* Linked Bank Account Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      {lang === 'vi' ? 'Tài Khoản Ngân Hàng Nhận Tiền Bán' : 'Bank Account for Payouts'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {lang === 'vi' ? 'Đã Xác Thực 24/7' : 'Verified 24/7'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <label className="text-slate-500 text-[11px] block">{lang === 'vi' ? 'Ngân hàng' : 'Bank name'}</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="mt-1 w-full p-2 bg-white rounded-lg border border-gray-200 font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[11px] block">{lang === 'vi' ? 'Số tài khoản' : 'Account number'}</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="mt-1 w-full p-2 bg-white rounded-lg border border-gray-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[11px] block">{lang === 'vi' ? 'Tên chủ tài khoản' : 'Account holder name'}</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                      className="mt-1 w-full p-2 bg-white rounded-lg border border-gray-200 font-bold uppercase text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    {lang === 'vi' ? 'Cập Nhật Tài Khoản Ngân Hàng' : 'Update Bank Account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BẢO MẬT & ĐỊNH DANH */}
          {(activeTab === 'security' || activeTab === 'kyc') && (
            <div className="space-y-4">
              {/* Thẻ Định Danh eKYC Căn Cước Công Dân */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                    {lang === 'vi'
                      ? 'Tài khoản đã hoàn tất định danh eKYC Căn Cước Công Dân'
                      : 'Account verified via Citizen Identity eKYC'}
                  </h4>
                  <p className="text-xs text-emerald-800/80 leading-relaxed">
                    {lang === 'vi'
                      ? 'Hồ sơ của bạn đã được đối soát sinh trắc học và dán tem xác thực SecondLife Verified. Bạn có thể đăng bán và giải ngân không giới hạn hạn mức.'
                      : 'Your profile has passed biometric matching with a SecondLife Verified badge. You can list items and withdraw funds without limits.'}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-emerald-700">
                    <span>{lang === 'vi' ? 'Mã Định Danh: ' : 'Verification ID: '}<strong>KYC-VN-{currentUser.id ? currentUser.id.slice(0, 8).toUpperCase() : '9920148'}</strong></span>
                    <span>•</span>
                    <span>{lang === 'vi' ? 'Ngày Phê Duyệt: ' : 'Approval Date: '}15/01/2026</span>
                  </div>
                </div>
              </div>

              {/* Thông số đối soát sinh trắc học eKYC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {lang === 'vi' ? 'Khớp Khuôn Mặt' : 'Face Match'}
                  </span>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    98.6% ({lang === 'vi' ? 'Đạt' : 'Passed'})
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {lang === 'vi' ? 'Thực Thể Sống (Liveness)' : 'Liveness Test'}
                  </span>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {lang === 'vi' ? 'Chính Chủ (Real)' : 'Live Person'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {lang === 'vi' ? 'Chất Lượng Giấy Tờ' : 'Document Quality'}
                  </span>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {lang === 'vi' ? 'Hợp Lệ (Chip CCCD)' : 'Valid Chip ID'}
                  </span>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {lang === 'vi' ? 'Cài Đặt An Toàn & Bảo Vệ Tài Khoản' : 'Security & Account Protection Settings'}
                </h4>

                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {lang === 'vi' ? 'Xác thực 2 bước (2FA qua SMS)' : 'Two-Factor Authentication (2FA SMS)'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {lang === 'vi'
                          ? 'Gửi mã OTP xác nhận mỗi khi chuyển tiền Escrow'
                          : 'Sends an OTP confirmation code whenever transferring Escrow funds'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {lang === 'vi' ? 'Đang Bật' : 'Enabled'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {lang === 'vi' ? 'Mật khẩu đăng nhập' : 'Login Password'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {lang === 'vi' ? 'Đã đổi 45 ngày trước (Độ mạnh: Rất cao)' : 'Changed 45 days ago (Strength: Very Strong)'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPassError(null);
                      setPassSuccess(null);
                      setIsChangePassModalOpen(true);
                    }}
                    className="text-xs font-bold text-[#24263e] hover:underline cursor-pointer"
                  >
                    {lang === 'vi' ? 'Đổi Mật Khẩu' : 'Change Password'}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {lang === 'vi' ? 'Phiên đăng nhập & Thiết bị tin cậy' : 'Active Sessions & Trusted Devices'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {lang === 'vi' ? 'Đang hoạt động trên thiết bị này (Web Browser / Windows)' : 'Active on this device (Web Browser / Windows)'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {lang === 'vi' ? 'Thiết Bị Tin Cậy' : 'Trusted'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ĐỔI VAI TRÒ */}
          {activeTab === 'settings' && (
            ['admin', 'staff', 'inspector'].includes(currentUser.role) ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto space-y-4 animate-in fade-in">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 text-[#c34c36] flex items-center justify-center mx-auto shadow-inner">
                  <Shield className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-900">
                  {lang === 'vi' ? 'Không Hỗ Trợ Đăng Ký Người Bán' : 'Seller Registration Restricted'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {lang === 'vi'
                    ? 'Tài khoản Quản trị viên (Admin), Nhân viên (Staff) và Kỹ sư Hub (Inspector) không được phép đăng ký làm Người Bán trên sàn SecondLife nhằm đảm bảo tính minh bạch, độc lập và bảo mật hệ thống.'
                    : 'Administrator, Staff, and Hub Inspector accounts are restricted from registering as Sellers on SecondLife to ensure system integrity and compliance.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {lang === 'vi' ? 'Quay Lại Thông Tin Cá Nhân' : 'Back to Personal Info'}
                </button>
              </div>
            ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {lang === 'vi' ? 'Đăng Ký Thành Người Bán (Seller Center)' : 'Seller Registration & Hub Onboarding'}
                  </h4>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-[#24263e] border border-rose-200">
                    {currentUser.role === 'seller' || isSellerRegistered
                      ? (lang === 'vi' ? 'Đã Kích Hoạt Người Bán' : 'Seller Active')
                      : (lang === 'vi' ? 'Chưa Kích Hoạt' : 'Not Registered')}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {lang === 'vi'
                    ? 'Đăng ký thông tin gian hàng và địa chỉ kho lấy hàng để bắt đầu đăng bán thiết bị, bưu tá đến tận nơi nhận hàng giao Hub kiểm định 48 bước và nhận tiền bảo lãnh qua Escrow.'
                    : 'Register your store profile and warehouse pickup location to start listing appliances, with doorstep courier pickup for 48-point Hub inspection and secure Escrow payouts.'}
                </p>
              </div>

              {/* Success Notification */}
              {sellerFormSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{sellerFormSuccess}</span>
                </div>
              )}

              {/* THÔNG TIN GIAN HÀNG ĐÃ ĐĂNG KÝ (HIỂN THỊ KHI ĐÃ LÀ SELLER HOẶC ĐÃ ĐĂNG KÝ) */}
              {isSellerRegistered && !showSellerRegistrationForm && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#24263e]" />
                      <span className="text-xs font-bold text-slate-900">
                        {lang === 'vi' ? 'Hồ Sơ Gian Hàng Người Bán Của Bạn' : 'Your Seller Store Profile'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentUser.role === 'seller' || currentUser.kycStatus === 'verified' || existingVerification?.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : isRejected
                            ? 'bg-rose-100 text-rose-800'
                            : isResubmitRequired
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {currentUser.kycStatus === 'pending'
                          ? (lang === 'vi' ? 'Đang Chờ Quản Trị Viên Duyệt' : 'Pending Review')
                          : (currentUser.role === 'seller' || currentUser.kycStatus === 'verified')
                          ? (lang === 'vi' ? 'Đã Kích Hoạt' : 'Active')
                          : isRejected
                            ? (lang === 'vi' ? 'Đã Bị Từ Chối' : 'Rejected')
                            : isResubmitRequired
                              ? (lang === 'vi' ? 'Yêu Cầu Nộp Lại' : 'Resubmit Required')
                              : (lang === 'vi' ? 'Đang Chờ Quản Trị Viên Duyệt' : 'Pending Review')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {currentUser.role === 'seller' && (
                        <button
                          type="button"
                          onClick={() => {
                            onRoleChange('buyer');
                            onUpdateProfile({ ...currentUser, role: 'buyer' });
                            setSellerFormSuccess(
                              lang === 'vi'
                                ? 'Đã chuyển sang vai trò Người Mua (Buyer).'
                                : 'Switched to Buyer role.'
                            );
                            setTimeout(() => setSellerFormSuccess(null), 3000);
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {lang === 'vi' ? 'Chuyển về Người Mua' : 'Switch to Buyer'}
                        </button>
                      )}
                      {!isPendingReview && (
                        <button
                          type="button"
                          onClick={() => setShowSellerRegistrationForm(true)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#24263e] hover:underline cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>
                            {isResubmitRequired
                              ? (lang === 'vi' ? 'Cập nhật & Nộp lại' : 'Update & Resubmit')
                              : isRejected
                                ? (lang === 'vi' ? 'Đăng ký lại hồ sơ mới' : 'Reapply')
                                : (lang === 'vi' ? 'Chỉnh sửa thông tin' : 'Edit Information')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Tên gian hàng' : 'Store name'}</span>
                      <span className="font-bold text-slate-800">{shopName || (lang === 'vi' ? 'Gian Hàng SecondLife' : 'SecondLife Store')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Hotline bán hàng & Zalo' : 'Sales hotline & Zalo'}</span>
                      <span className="font-bold text-slate-800">
                        {sellerPhone || phone || (
                          <span className="text-slate-400 italic font-normal">{lang === 'vi' ? 'Chưa cập nhật' : 'Not updated'}</span>
                        )}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Địa chỉ kho bưu tá lấy hàng' : 'Courier pickup warehouse address'}</span>
                      <span className="font-medium text-slate-800">
                        {pickupAddress || address || (
                          <span className="text-slate-400 italic">{lang === 'vi' ? 'Chưa cập nhật địa chỉ kho (Bấm Chỉnh sửa thông tin bên trên để thêm)' : 'Not updated'}</span>
                        )}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Số CCCD định danh' : 'Citizen ID number'}</span>
                      <span className="font-bold text-slate-800">{idCardNumber || '048299102941'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Tài khoản nhận tiền Escrow' : 'Escrow payout account'}</span>
                      <span className="font-bold text-slate-800">{sellerBankName} - {sellerAccountNumber}</span>
                    </div>
                  </div>

                  {/* Status explanation */}
                  <div className="text-xs space-y-2 pt-1">
                    {currentUser.role === 'seller' || existingVerification?.status === 'APPROVED' ? (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold block text-emerald-800">{lang === 'vi' ? 'Tài khoản người bán đã kích hoạt!' : 'Seller account is active!'}</span>
                          <span className="text-[11px] text-slate-600">{lang === 'vi' ? 'Bạn có thể tiến hành đăng tin bán thiết bị gia dụng ngay.' : 'You can post your appliance listings now.'}</span>
                        </div>
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
                            onClick={() => setShowSellerRegistrationForm(true)}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
                          >
                            {lang === 'vi' ? 'Cập Nhật Ảnh & Nộp Lại Ngay' : 'Update & Resubmit Now'}
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
                        <div className="pt-1 pl-6">
                          <button
                            type="button"
                            onClick={() => setShowSellerRegistrationForm(true)}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
                          >
                            {lang === 'vi' ? 'Đăng Ký Lại Hồ Sơ Mới' : 'Reapply With New Details'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-amber-800">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                          <span>{lang === 'vi' ? 'Đang Chờ Phê Duyệt Hồ Sơ eKYC' : 'Awaiting eKYC Approval'}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700 pl-6">
                          {lang === 'vi'
                            ? 'Hồ sơ của bạn đang được Ban Quản trị SecondLife đối soát CCCD và địa chỉ kho. Vui lòng chờ phê duyệt trong 24 giờ làm việc. Trong thời gian này, bạn không thể chỉnh sửa hoặc gửi lại yêu cầu.'
                            : 'Your profile is awaiting review by SecondLife administrators. Please wait for approval within 24 working hours. You cannot edit or resubmit during this time.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FORM ĐĂNG KÝ CHUYỂN TÀI KHOẢN NGƯỜI BÁN */}
              {(showSellerRegistrationForm || (!isSellerRegistered && currentUser.role !== 'seller')) && !isPendingReview && (
                <form
                  onSubmit={handleRegisterSeller}
                  className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-slate-50 border-2 border-[#c34c36]/30 shadow-md space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                          {isSellerRegistered
                            ? (lang === 'vi' ? 'Cập Nhật Thông Tin Gian Hàng' : 'Update Store Information')
                            : (lang === 'vi' ? 'Đơn Đăng Ký Chuyển Tài Khoản Người Bán' : 'Seller Registration Form')}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          {lang === 'vi'
                            ? 'Điền thông tin để Kỹ sư Hub và đơn vị vận chuyển (GHTK/GHN) đến nhận thiết bị giám định'
                            : 'Fill in details so Hub inspectors and couriers (GHTK/GHN) can collect devices for inspection'}
                        </p>
                      </div>
                    </div>
                    {isSellerRegistered && (
                      <button
                        type="button"
                        onClick={() => setShowSellerRegistrationForm(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                      >
                        {lang === 'vi' ? 'Đóng' : 'Close'}
                      </button>
                    )}
                  </div>

                  {/* Highlights Banner */}
                  <div className="grid grid-cols-3 gap-2 py-1 text-[11px]">
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50/60 border border-rose-100 text-slate-700">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#24263e] shrink-0" />
                      <span>{lang === 'vi' ? 'Xác minh CCCD' : 'National ID'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/60 border border-amber-100 text-slate-700">
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Lấy hàng tận kho' : 'Doorstep Pickup'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 text-slate-700">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Giải ngân Escrow' : 'Escrow Payout'}</span>
                    </div>
                  </div>

                  {sellerFormError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{sellerFormError}</span>
                    </div>
                  )}

                  {/* Inputs */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          {lang === 'vi' ? 'Tên Gian Hàng / Cửa Hàng' : 'Store / Shop Name'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder={lang === 'vi' ? 'VD: Điện Máy Cũ Hoàng Khang' : 'e.g., Hoang Khang Pre-owned Tech'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          {lang === 'vi' ? 'Số Điện Thoại Kinh Doanh & Zalo' : 'Business Phone & Zalo'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={sellerPhone}
                          onChange={(e) => setSellerPhone(e.target.value)}
                          placeholder="0912 345 678"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Email Gian Hàng & Xác Thực Mã OTP Trước Khi eKYC */}
                    <div className="p-3.5 bg-gradient-to-br from-[#faf8f5] to-orange-50/20 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#c34c36]" />
                          <span>{lang === 'vi' ? 'Email Gian Hàng (Bắt buộc xác thực OTP trước khi eKYC)' : 'Shop Email (OTP Verification Required)'}</span>
                          <span className="text-red-500">*</span>
                        </label>
                        {isShopEmailVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{lang === 'vi' ? 'Đã xác thực OTP' : 'Verified'}</span>
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
                          onChange={(e) => {
                            setShopEmail(e.target.value);
                            setIsShopEmailVerified(false);
                            setShopOtpSuccess(null);
                            setShopOtpError(null);
                          }}
                          placeholder="seller@example.com"
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />

                        <button
                          type="button"
                          onClick={handleSendShopOtp}
                          disabled={isSendingShopOtp || shopOtpCountdown > 0 || isShopEmailVerified}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                            isShopEmailVerified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                              : 'bg-[#24263e] hover:bg-black text-white disabled:opacity-50'
                          }`}
                        >
                          {isSendingShopOtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{lang === 'vi' ? 'Đang gửi...' : 'Sending...'}</span>
                            </>
                          ) : shopOtpCountdown > 0 ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{lang === 'vi' ? `Gửi lại (${shopOtpCountdown}s)` : `Resend (${shopOtpCountdown}s)`}</span>
                            </>
                          ) : isShopEmailVerified ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'vi' ? 'Đã Xác Thực' : 'Verified'}</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              <span>{hasSentShopOtp ? (lang === 'vi' ? 'Gửi lại OTP' : 'Resend OTP') : (lang === 'vi' ? 'Gửi mã OTP' : 'Send OTP')}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Inline OTP input when not yet verified */}
                      {!isShopEmailVerified && hasSentShopOtp && (
                        <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">
                              {lang === 'vi' ? 'Nhập mã xác thực OTP 6 số đã nhận qua email:' : 'Enter 6-digit OTP code:'}
                            </span>
                            {shopOtpCountdown > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {lang === 'vi' ? `Thời gian: ${shopOtpCountdown}s` : `${shopOtpCountdown}s remaining`}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={shopOtpCode}
                              onChange={(e) => setShopOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Ví dụ: 123456"
                              className="flex-1 px-3 py-2 rounded-xl border border-gray-300 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs font-mono tracking-widest text-slate-900 bg-slate-50"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyShopOtp}
                              disabled={isVerifyingShopOtp || shopOtpCode.length !== 6}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              {isVerifyingShopOtp ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>{lang === 'vi' ? 'Xác Nhận OTP' : 'Verify OTP'}</span>
                            </button>
                          </div>

                          {shopOtpError && (
                            <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{shopOtpError}</span>
                            </p>
                          )}
                          {shopOtpSuccess && (
                            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>{shopOtpSuccess}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {isShopEmailVerified && (
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{lang === 'vi' ? 'Email gian hàng đã được xác thực thành công. Bạn đủ điều kiện thực hiện eKYC.' : 'Shop email verified. You may proceed with eKYC.'}</span>
                        </div>
                      )}
                    </div>

                    {/* Warehouse Pickup Address Section - Powered by BE API */}
                    <div className="space-y-2.5 p-3.5 bg-gradient-to-br from-[#faf8f5] to-orange-50/20 rounded-2xl border border-gray-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                          <span>{lang === 'vi' ? 'Địa Chỉ Kho / Nơi Bưu Tá Đến Lấy Hàng Giao Hub' : 'Warehouse / Pickup Location for Hub'}</span>
                          <span className="text-red-500">*</span>
                        </label>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {/* Live GPS Geolocation Button */}
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={isDetectingLocation}
                            title={lang === 'vi' ? 'Định vị GPS vị trí hiện tại và tự động điền' : 'Detect current GPS location and auto-fill'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <LocateFixed className={`w-3 h-3 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                            <span>
                              {isDetectingLocation
                                ? (lang === 'vi' ? 'Đang định vị...' : 'Locating...')
                                : (lang === 'vi' ? 'Vị trí hiện tại' : 'Current location')}
                            </span>
                          </button>

                          {/* Call API BE Button */}
                          <button
                            type="button"
                            onClick={() => fetchAddressFromBackend(true)}
                            disabled={isLoadingAddressFromBe}
                            title={lang === 'vi' ? 'Gọi API BE để lấy địa chỉ kho đã lưu' : 'Call BE API to get saved warehouse address'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-[#24263e] hover:bg-[#343759] text-white transition shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingAddressFromBe ? 'animate-spin' : ''}`} />
                            <span>
                              {isLoadingAddressFromBe
                                ? (lang === 'vi' ? 'Đang gọi...' : 'Calling...')
                                : (lang === 'vi' ? 'Làm mới' : 'Refresh')}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Location Accuracy Tip Banner */}
                      <div className="text-[10px] text-amber-800 bg-amber-50/90 px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-start gap-1.5 leading-snug">
                        <span className="shrink-0 font-bold">💡</span>
                        <span>
                          {lang === 'vi'
                            ? 'Lưu ý: Trên máy tính (PC/Laptop), định vị qua IP/Wi-Fi nên có thể lệch so với GPS điện thoại. Bạn có thể tự do bấm chọn lại Tỉnh / Phường hoặc gõ sửa địa chỉ bên dưới.'
                            : 'Note: On PC/Laptop, location is estimated via IP/Wi-Fi. You can freely re-select Province / Ward or edit the address below.'}
                        </span>
                      </div>

                      {/* Cascade selects: Tỉnh / Thành & Phường / Xã từ BE GHN */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            {lang === 'vi' ? 'Tỉnh / Thành Phố' : 'Province / City'}
                          </label>
                          <select
                            value={selectedProvinceId}
                            onChange={handleProvinceChange}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900 cursor-pointer"
                          >
                            <option value="">-- {lang === 'vi' ? 'Chọn Tỉnh / Thành Phố' : 'Select Province'} --</option>
                            {Array.isArray(provinces) && provinces.map((p, idx) => (
                              <option key={p._id ? `${p._id}-${idx}` : idx} value={p._id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            {lang === 'vi' ? 'Phường / Xã' : 'Ward / Commune'}
                          </label>
                          <select
                            value={selectedWardId}
                            onChange={handleWardChange}
                            disabled={!selectedProvinceId || isLoadingWards}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <option value="">
                              {isLoadingWards
                                ? (lang === 'vi' ? 'Đang tải phường/xã ...' : 'Loading wards...')
                                : `-- ${lang === 'vi' ? 'Chọn Phường / Xã' : 'Select Ward'} --`}
                            </option>
                            {Array.isArray(wards) && wards.map((w, idx) => (
                              <option key={w._id ? `${w._id}-${idx}` : idx} value={w._id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Detail Street Address */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          {lang === 'vi' ? 'Số nhà, ngõ ngách, tên đường chi tiết' : 'Street address / House number'}
                        </label>
                        <input
                          type="text"
                          value={streetAddress}
                          onChange={handleStreetAddressChange}
                          placeholder={lang === 'vi' ? 'VD: Số 123 đường Giải Phóng, Ngõ 4' : 'e.g., 123 Giai Phong St'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>

                      {/* Full combined address input */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-700 block">
                            {lang === 'vi' ? 'Địa chỉ đầy đủ bưu tá đến lấy (Tự động tổng hợp hoặc tự do sửa)' : 'Full Pickup Address (Auto-synced / Editable)'} <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[9px] text-[#c34c36] font-semibold">
                            {lang === 'vi' ? '✎ Có thể sửa trực tiếp' : '✎ Editable'}
                          </span>
                        </div>
                        <input
                          type="text"
                          required
                          value={pickupAddress}
                          onChange={(e) => setPickupAddress(e.target.value)}
                          placeholder={lang === 'vi' ? 'Số nhà, tên đường, phường/xã, tỉnh/thành phố' : 'Street address, ward, city'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900 font-medium"
                        />
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-1 text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {lang === 'vi'
                              ? 'Địa chỉ xác thực: Bưu tá sẽ đến tận kho nhận thiết bị bàn giao sang Hub kiểm định 48 bước.'
                              : 'Verified address: Couriers will pick up devices from this address for 48-step Hub inspection.'}
                          </span>
                        </span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[9px] font-semibold">
                          {lang === 'vi' ? '✓ Bạn có thể chỉnh sửa mọi ô trên' : '✓ All fields above are editable'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          {lang === 'vi' ? 'Số Căn Cước Công Dân (CCCD/CMND)' : 'Citizen Identity Number (CCCD)'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={idCardNumber}
                          onChange={(e) => setIdCardNumber(e.target.value)}
                          placeholder="048299102941"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          {lang === 'vi' ? 'Loại Thiết Bị Bán Chủ Yếu' : 'Primary Product Category'}
                        </label>
                        <input
                          type="text"
                          value={sellerProductTypes}
                          onChange={(e) => setSellerProductTypes(e.target.value)}
                          placeholder={lang === 'vi' ? 'VD: Tủ lạnh, Máy giặt, Máy pha cafe...' : 'e.g., Refrigerators, Washers, Coffee machines...'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    {/* eKYC Document Photo Upload Section */}
                    <div className="p-3.5 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <FileCheck className="w-4 h-4 text-[#24263e]" />
                        <span>{lang === 'vi' ? 'Ảnh Tải Lên Xác Thực eKYC (Mặt Trước, Mặt Sau, Chân Dung)' : 'eKYC Verification Photo Uploads'}</span>
                        <span className="text-red-500">*</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Front ID */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-5">
                            <label className="text-[10px] font-bold text-slate-700 block truncate">
                              {lang === 'vi' ? '1. Ảnh CCCD Mặt Trước' : '1. Front ID Card'} <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                              {lang === 'vi' ? 'Mặt trước' : 'Front'}
                            </span>
                          </div>
                          <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                            {docFrontUrl ? (
                              <div className="h-full flex flex-col justify-between">
                                <div className="relative w-full h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                  <img src={docFrontUrl} alt="Front ID" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setDocFrontUrl('')}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition z-10 cursor-pointer"
                                    title={lang === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between px-0.5 text-[10px]">
                                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã tải lên' : 'Uploaded'}
                                  </span>
                                  <label className="text-[#24263e] hover:text-[#c34c36] font-bold underline cursor-pointer">
                                    {lang === 'vi' ? 'Đổi ảnh' : 'Change'}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1.5 hover:bg-slate-50/60 rounded-xl transition">
                                <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                                <span className="text-[11px] font-bold text-slate-700 block">
                                  {uploadingField === 'front' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh mặt trước' : 'Select Front Photo')}
                                </span>
                                <span className="text-[9px] text-slate-400 block">{lang === 'vi' ? 'Hỗ trợ JPG, PNG, WEBP' : 'JPG, PNG, WEBP'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Back ID */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-5">
                            <label className="text-[10px] font-bold text-slate-700 block truncate">
                              {lang === 'vi' ? '2. Ảnh CCCD Mặt Sau' : '2. Back ID Card'} <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                              {lang === 'vi' ? 'Mặt sau' : 'Back'}
                            </span>
                          </div>
                          <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                            {docBackUrl ? (
                              <div className="h-full flex flex-col justify-between">
                                <div className="relative w-full h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                  <img src={docBackUrl} alt="Back ID" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setDocBackUrl('')}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition z-10 cursor-pointer"
                                    title={lang === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between px-0.5 text-[10px]">
                                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã tải lên' : 'Uploaded'}
                                  </span>
                                  <label className="text-[#24263e] hover:text-[#c34c36] font-bold underline cursor-pointer">
                                    {lang === 'vi' ? 'Đổi ảnh' : 'Change'}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1.5 hover:bg-slate-50/60 rounded-xl transition">
                                <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                                <span className="text-[11px] font-bold text-slate-700 block">
                                  {uploadingField === 'back' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh mặt sau' : 'Select Back Photo')}
                                </span>
                                <span className="text-[9px] text-slate-400 block">{lang === 'vi' ? 'Hỗ trợ JPG, PNG, WEBP' : 'JPG, PNG, WEBP'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Selfie */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-5">
                            <label className="text-[10px] font-bold text-slate-700 block truncate">
                              {lang === 'vi' ? '3. Ảnh Chân Dung Selfie' : '3. Selfie Photo'} <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                              {lang === 'vi' ? 'AI So Khớp' : 'AI Match'}
                            </span>
                          </div>
                          <div className="relative border border-dashed border-slate-300 hover:border-[#c34c36] rounded-2xl p-2.5 bg-white text-center transition h-[145px] flex flex-col justify-between">
                            {selfieUrl ? (
                              <div className="h-full flex flex-col justify-between">
                                <div className="relative w-full h-20 rounded-xl overflow-hidden border border-emerald-400 bg-slate-50">
                                  <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
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
                                    {vnptClientSession ? 'VNPT eKYC' : 'OK'}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between px-0.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => setIsFaceScannerOpen(true)}
                                    className="text-[#c34c36] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Camera className="w-3 h-3" />
                                    <span>{lang === 'vi' ? 'Quét lại' : 'Rescan'}</span>
                                  </button>
                                  <label className="text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer">
                                    {lang === 'vi' ? 'Đổi tệp' : 'Upload'}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'selfie')} />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full space-y-2">
                                <button
                                  type="button"
                                  onClick={() => setIsFaceScannerOpen(true)}
                                  className="w-full py-2 px-2 bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-slate-900 rounded-xl text-[10px] font-bold shadow-xs hover:opacity-95 transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3.5 h-3.5 text-slate-900" />
                                  <span>{lang === 'vi' ? 'Mở Camera Quét Mặt' : 'Scan Face'}</span>
                                </button>
                                <label className="text-[9px] text-slate-500 hover:text-[#24263e] underline font-bold cursor-pointer block text-center">
                                  {uploadingField === 'selfie'
                                    ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...')
                                    : (lang === 'vi' ? 'Hoặc chọn ảnh từ máy' : 'Or select photo')}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'selfie')} />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bank Information for Payout */}
                    <div className="p-3 rounded-2xl bg-white border border-gray-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <CreditCard className="w-3.5 h-3.5 text-[#24263e]" />
                        <span>{lang === 'vi' ? 'Tài Khoản Ngân Hàng Nhận Tiền Bán (Giải Ngân Escrow)' : 'Bank Account for Escrow Payout'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{lang === 'vi' ? 'Ngân hàng' : 'Bank name'}</label>
                          <input
                            type="text"
                            value={sellerBankName}
                            onChange={(e) => setSellerBankName(e.target.value)}
                            placeholder="Vietcombank"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#c34c36]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{lang === 'vi' ? 'Số tài khoản' : 'Account number'}</label>
                          <input
                            type="text"
                            value={sellerAccountNumber}
                            onChange={(e) => setSellerAccountNumber(e.target.value)}
                            placeholder="991204882910"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#c34c36]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{lang === 'vi' ? 'Chủ tài khoản' : 'Account holder'}</label>
                          <input
                            type="text"
                            value={sellerAccountHolder}
                            onChange={(e) => setSellerAccountHolder(e.target.value)}
                            placeholder="HOANG QUOC KHANG"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#c34c36]"
                          />
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
                          ? 'Tôi cam kết mọi thiết bị đăng bán là chính hãng, đúng tình trạng; sẵn sàng giao hàng cho bưu tá để Kỹ sư Hub kiểm định dán tem NFC và tuân thủ quy chế giải ngân qua quỹ tín thác Escrow của SecondLife.'
                          : 'I commit that all listed appliances are authentic and match their described condition; I agree to hand them over to couriers for Hub inspection and NFC sealing, and abide by the SecondLife Escrow payout terms.'}
                      </span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                    {isSellerRegistered && (
                      <button
                        type="button"
                        onClick={() => setShowSellerRegistrationForm(false)}
                        className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-600 text-xs font-bold transition cursor-pointer"
                      >
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingSeller}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSubmittingSeller
                          ? (lang === 'vi' ? 'Đang Gửi Hồ Sơ...' : 'Submitting...')
                          : isSellerRegistered
                            ? (lang === 'vi' ? 'Cập Nhật Hồ Sơ Gian Hàng' : 'Update Store Profile')
                            : (lang === 'vi' ? 'Xác Nhận Đăng Ký & Gửi Duyệt eKYC' : 'Confirm Registration & Submit eKYC')}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-gray-100 rounded-b-3xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Đăng Xuất Khỏi Thiết Bị' : 'Log Out from Device'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng' : 'Close'}
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-95 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Lưu Hồ Sơ' : 'Save Profile'}</span>
            </button>
          </div>
        </div>

        {/* Change Password Modal */}
        {isChangePassModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Lock className="w-5 h-5 text-[#24263e]" />
                  <span>{lang === 'vi' ? 'Đổi Mật Khẩu Đăng Nhập' : 'Change Account Password'}</span>
                </div>
                <button
                  onClick={() => {
                    setIsChangePassModalOpen(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPassError(null);
                    setPassSuccess(null);
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'vi' ? 'Mật Khẩu Hiện Tại' : 'Current Password'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passError) setPassError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'vi' ? 'Mật Khẩu Mới' : 'New Password'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passError) setPassError(null);
                    }}
                    placeholder={
                      lang === 'vi'
                        ? 'Tối thiểu 8 ký tự, chữ hoa, thường, số, ký tự đặc biệt'
                        : 'Min 8 chars, uppercase, lowercase, number, symbol'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'vi' ? 'Xác Nhận Mật Khẩu Mới' : 'Confirm New Password'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passError) setPassError(null);
                    }}
                    placeholder={lang === 'vi' ? 'Nhập lại mật khẩu mới' : 'Re-enter new password'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePassModalOpen(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPassError(null);
                      setPassSuccess(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {lang === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPass}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingPass ? (lang === 'vi' ? 'Đang xử lý...' : 'Processing...') : (lang === 'vi' ? 'Cập Nhật Mật Khẩu' : 'Update Password')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal WebRTC Live Face Scanner eKYC */}
      <LiveFaceScannerModal
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
        onFaceCaptured={(url, _file, _preview, vnptData) => {
          setSelfieUrl(url);
          if (vnptData?.clientSession) setVnptClientSession(vnptData.clientSession);
          if (vnptData?.token) setVnptToken(vnptData.token);
          if (vnptData?.livenessFace) setVnptLivenessResult(vnptData.livenessFace);
          setSellerFormError(null);
        }}
        lang={lang}
      />
    </div>
  );
};
