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
  Clock
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
} from '../../services';
import { UserProfile, UserRole, Language } from '../../types';
import { LiveFaceScannerModal, VnptEkycResultData } from './LiveFaceScannerModal';

interface SellerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  onRoleChange: (role: UserRole) => void;
  onNavigateToCreateListing?: () => void;
  lang?: Language;
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

  const isAlreadySeller = currentUser.role === 'seller';
  const isRegistered = Boolean(currentUser.isSellerRegistered || isAlreadySeller);

  // Form State
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
  const [sellerProductTypes, setSellerProductTypes] = useState(
    'Tủ lạnh, Máy giặt, Thiết bị điện lạnh gia dụng'
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
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isEmailVerifiedForOnboarding, setIsEmailVerifiedForOnboarding] = useState(false);
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

  // UI state
  const [showForm, setShowForm] = useState(!isRegistered);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [existingVerification, setExistingVerification] = useState<SellerVerificationResponseDto | null>(null);

  const verStatus = existingVerification?.status || (currentUser.kycStatus === 'pending' ? 'NEEDS_REVIEW' : null);
  const isPendingReview = verStatus === 'SUBMITTED' || verStatus === 'EKYC_PENDING' || verStatus === 'NEEDS_REVIEW' || verStatus === 'PENDING';
  const isResubmitRequired = verStatus === 'RESUBMIT_REQUIRED';
  const isRejected = verStatus === 'REJECTED';

  // BE Shipping & Pickup Address state
  const [provinces, setProvinces] = useState<GhnLocation[]>(FALLBACK_PROVINCES);
  const [wards, setWards] = useState<GhnLocation[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | string | ''>('');
  const [selectedWardId, setSelectedWardId] = useState<number | string | ''>('');
  const [streetAddress, setStreetAddress] = useState('');
  const [isLoadingAddressFromBe, setIsLoadingAddressFromBe] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

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
        if (ob.emailVerified) setIsEmailVerifiedForOnboarding(true);

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

  useEffect(() => {
    if (currentUser) {
      setShopName(currentUser.shopName || (currentUser.name ? `Gian Hàng ${currentUser.name}` : 'SecondLife Shop'));
      setSellerPhone(currentUser.phone || '');
      setPickupAddress(currentUser.pickupAddress || currentUser.address || '');
      if (currentUser.idCardNumber) setIdCardNumber(currentUser.idCardNumber);
      if (currentUser.bankAccount?.bankName) setSellerBankName(currentUser.bankAccount.bankName);
      if (currentUser.bankAccount?.accountNumber) setSellerAccountNumber(currentUser.bankAccount.accountNumber);
      if (currentUser.bankAccount?.accountHolder) setSellerAccountHolder(currentUser.bankAccount.accountHolder);
      setShowForm(!Boolean(currentUser.isSellerRegistered || currentUser.role === 'seller'));
    }

    if (isOpen) {
      sellerService.getMyVerification()
        .then((verif) => {
          if (verif) {
            setExistingVerification(verif);
            if (verif.documentNumber) setIdCardNumber(verif.documentNumber);
            if (verif.documentFrontUrl) {
              setDocFrontUrl(verif.documentFrontUrl);
              setFrontPreview(verif.documentFrontUrl);
            }
            if (verif.documentBackUrl) {
              setDocBackUrl(verif.documentBackUrl);
              setBackPreview(verif.documentBackUrl);
            }
            if (verif.selfieUrl) {
              setSelfieUrl(verif.selfieUrl);
              setSelfiePreview(verif.selfieUrl);
            }
            if (verif.status === 'RESUBMIT_REQUIRED') {
              setShowForm(true);
            } else if (['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(verif.status)) {
              setShowForm(false);
            }
          }
        })
        .catch(() => {
          setExistingVerification(null);
        });
    }
  }, [currentUser, isOpen]);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (field === 'front') {
      setFrontFile(file);
      setFrontPreview(previewUrl);
      setDocFrontUrl(''); // Reset remote url so batch upload will process this new file
    } else if (field === 'back') {
      setBackFile(file);
      setBackPreview(previewUrl);
      setDocBackUrl('');
    } else if (field === 'selfie') {
      setSelfieFile(file);
      setSelfiePreview(previewUrl);
      setSelfieUrl('');
    }
    setErrorMsg(null);
  };

  const handleFaceCapturedFromCamera = (
    url: string,
    file?: File,
    previewUrl?: string,
    vnptData?: VnptEkycResultData
  ) => {
    setSelfieUrl(url);
    if (file) setSelfieFile(file);
    if (previewUrl) setSelfiePreview(previewUrl);
    if (vnptData?.clientSession) setVnptClientSession(vnptData.clientSession);
    if (vnptData?.token) setVnptToken(vnptData.token);
    if (vnptData?.livenessFace) setVnptLivenessResult(vnptData.livenessFace);
    setErrorMsg(null);
  };

  const handleMultipleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    if (files[0]) {
      setFrontFile(files[0]);
      setFrontPreview(URL.createObjectURL(files[0]));
      setDocFrontUrl('');
    }
    if (files[1]) {
      setBackFile(files[1]);
      setBackPreview(URL.createObjectURL(files[1]));
      setDocBackUrl('');
    }
    if (files[2]) {
      setSelfieFile(files[2]);
      setSelfiePreview(URL.createObjectURL(files[2]));
      setSelfieUrl('');
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
        pickupAddress: {
          name: cleanShop,
          phone: cleanPhone,
          address: streetAddress.trim() || pickupAddress.trim() || 'Hà Nội',
          provinceId: Number(selectedProvinceId) || 1000001,
          wardId: Number(selectedWardId) || 1003646,
        },
      });

      await shippingService.sendSellerOnboardingEmailCode();
      setHasSentOtp(true);
      setOtpCountdown(60);
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

    if (isPendingReview) {
      setErrorMsg(
        lang === 'vi'
          ? 'Hồ sơ của bạn đang được Ban Quản trị xét duyệt. Bạn không thể gửi lại yêu cầu lúc này. Vui lòng chờ kết quả phê duyệt trong 24 giờ.'
          : 'Your application is pending review. You cannot resubmit at this time.'
      );
      return;
    }

    if (!shopName.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập tên gian hàng / cửa hàng.' : 'Please enter store name.');
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
    if (!idCardNumber.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập số CCCD để xác minh danh tính người bán.' : 'Please enter citizen ID.');
      return;
    }
    const hasFront = Boolean(frontFile || docFrontUrl);
    const hasBack = Boolean(backFile || docBackUrl);
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

    if (!isEmailVerifiedForOnboarding) {
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
      const filesToUpload: { field: 'front' | 'back' | 'selfie'; file: File }[] = [];
      if (frontFile && !docFrontUrl) filesToUpload.push({ field: 'front', file: frontFile });
      if (backFile && !docBackUrl) filesToUpload.push({ field: 'back', file: backFile });
      if (selfieFile && !selfieUrl) filesToUpload.push({ field: 'selfie', file: selfieFile });

      let finalFrontUrl = docFrontUrl;
      let finalBackUrl = docBackUrl;
      let finalSelfieUrl = selfieUrl;

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

      // 2. Nếu chưa lưu onboarding thì lưu
      if (!isEmailVerifiedForOnboarding) {
        setUploadProgressMsg(
          lang === 'vi' ? 'Đang cập nhật hồ sơ gian hàng lên hệ thống...' : 'Saving shop profile...'
        );
        const cleanPhone = (sellerPhone || '').replace(/\s+/g, '').trim();
        const cleanShop = (shopName || '').trim().slice(0, 30);
        const cleanEmail = (shopEmail || currentUser?.email || 'seller@secondlife.vn').trim();

        await shippingService.saveSellerOnboarding({
          shopName: cleanShop,
          email: cleanEmail,
          phone: cleanPhone,
          pickupAddress: {
            name: cleanShop,
            phone: cleanPhone,
            address: streetAddress.trim() || pickupAddress.trim(),
            provinceId: Number(selectedProvinceId) || 1000001,
            wardId: Number(selectedWardId) || 1003646,
          },
        });
      }

      // 3. Kiểm tra xem Email đã được xác thực OTP chưa theo chính sách BE
      let obStatus = null;
      try {
        obStatus = await shippingService.getSellerOnboarding();
      } catch (_) {}

      if (!obStatus?.emailVerified) {
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
        } catch (_) {}
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
        verificationResponse = await sellerService.submitVerification({
          verificationType: 'CITIZEN_ID',
          documentNumber: idCardNumber.trim(),
          documentFrontUrl: finalFrontUrl,
          documentBackUrl: finalBackUrl,
          selfieUrl: finalSelfieUrl || undefined,
          clientSession: vnptClientSession || `ANDROID_Web_1.0_Device_1.0.0_web_${Date.now()}`,
          token: vnptToken || `vnpt-token-${Date.now()}`,
        });
      }

      // Phân nhánh xử lý chính xác theo mã trạng thái status trả về từ Backend
      const status = verificationResponse?.status;

      if (status === 'APPROVED') {
        const updated: UserProfile = {
          ...currentUser,
          isSellerRegistered: true,
          role: 'seller',
          kycStatus: 'verified',
          shopName: shopName.trim(),
          phone: sellerPhone.trim(),
          pickupAddress: pickupAddress.trim(),
          idCardNumber: idCardNumber.trim(),
          bankAccount: {
            bankName: sellerBankName,
            accountNumber: sellerAccountNumber,
            accountHolder: sellerAccountHolder,
          },
        };
        onUpdateProfile(updated);
        onRoleChange('seller');
        setSuccessMsg(
          lang === 'vi'
            ? 'Xác thực định danh eKYC thành công! Bạn đã chính thức trở thành Người Bán trên SecondLife.'
            : 'eKYC verification approved! You are now an official Seller.'
        );
      } else if (status === 'RESUBMIT_REQUIRED') {
        setExistingVerification(verificationResponse);
        setErrorMsg(
          lang === 'vi'
            ? `Hồ sơ cần nộp lại hình ảnh: "${verificationResponse.rejectionReason || 'Ảnh chụp giấy tờ chưa đạt tiêu chuẩn'}". Vui lòng kiểm tra lại.`
            : `Resubmission required: "${verificationResponse.rejectionReason || 'Document images not accepted'}".`
        );
      } else {
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
        setSuccessMsg(
          lang === 'vi'
            ? 'Hồ sơ đã được gửi thành công! Kỹ sư Hub & Hệ thống sẽ thẩm định trong vòng 24 - 48 giờ.'
            : 'Application submitted! Will be reviewed in 24 - 48 hours.'
        );
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setUploadProgressMsg(null);
        setShowForm(false);
      }, 1500);
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
      setSuccessMsg(
        lang === 'vi' ? 'Xác thực Email Shop thành công! Đang gửi hồ sơ eKYC...' : 'Email verified! Submitting eKYC...'
      );
      await doSubmitEkyc(savedImageUrls.front, savedImageUrls.back, savedImageUrls.selfie);
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
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#24263e]/15 flex items-center justify-between bg-[#fce5da] text-[#24263e]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#24263e] text-white shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[#24263e]">
                  {lang === 'vi' ? 'Đăng Ký Thành Người Bán' : 'Seller Hub Onboarding'}
                </h3>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${currentUser.role === 'seller'
                  ? 'bg-white text-emerald-900 border-emerald-500'
                  : existingVerification?.status === 'RESUBMIT_REQUIRED'
                    ? 'bg-amber-100 text-amber-900 border-amber-500 animate-pulse'
                    : currentUser.kycStatus === 'pending' || currentUser.isSellerRegistered
                      ? 'bg-white text-amber-900 border-amber-500'
                      : 'bg-white text-rose-900 border-rose-500'
                  }`}>
                  {currentUser.role === 'seller'
                    ? (lang === 'vi' ? 'Đã Kích Hoạt Người Bán' : 'Seller Active')
                    : existingVerification?.status === 'RESUBMIT_REQUIRED'
                      ? (lang === 'vi' ? 'Cần Chụp Lại Ảnh eKYC' : 'Resubmission Required')
                      : (currentUser.kycStatus === 'pending' || currentUser.isSellerRegistered)
                        ? (lang === 'vi' ? 'Đang Chờ Duyệt eKYC' : 'Pending Review')
                        : (lang === 'vi' ? 'Chưa Kích Hoạt' : 'Not Registered')}
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Highlights Banner */}
          <div className="grid grid-cols-3 gap-2.5 py-1 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100 text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#24263e] shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Xác minh CCCD' : 'National ID'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'Định danh eKYC 48h' : 'eKYC Verified'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-slate-700">
              <Truck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Lấy hàng tận kho' : 'Doorstep Pickup'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'GHTK/GHN giao Hub' : 'Courier Pickup'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-slate-700">
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px] text-slate-900">{lang === 'vi' ? 'Giải ngân Escrow' : 'Escrow Payout'}</span>
                <span className="text-[10px] text-slate-500 hidden sm:block">{lang === 'vi' ? 'Bảo lãnh an toàn 100%' : '100% Protected'}</span>
              </div>
            </div>
          </div>

          {/* Success Notification */}
          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW: THÔNG TIN GIAN HÀNG ĐÃ ĐĂNG KÝ */}
          {isRegistered && !showForm && (
            <div className="p-5 rounded-3xl bg-slate-50 border border-gray-200 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-[#24263e]" />
                  <span className="text-xs font-bold text-slate-900">
                    {lang === 'vi' ? 'Hồ Sơ Gian Hàng Của Bạn' : 'Your Seller Store Profile'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    currentUser.role === 'seller' || currentUser.kycStatus === 'verified' || existingVerification?.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : isRejected
                        ? 'bg-rose-100 text-rose-800'
                        : isResubmitRequired
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {currentUser.role === 'seller' || currentUser.kycStatus === 'verified' || existingVerification?.status === 'APPROVED'
                      ? (lang === 'vi' ? 'Đã Kích Hoạt' : 'Active')
                      : isRejected
                        ? (lang === 'vi' ? 'Đã Bị Từ Chối' : 'Rejected')
                        : isResubmitRequired
                          ? (lang === 'vi' ? 'Yêu Cầu Nộp Lại' : 'Resubmit Required')
                          : (lang === 'vi' ? 'Đang Chờ Quản Trị Viên Duyệt' : 'Pending Review')}
                  </span>
                </div>

                {!isPendingReview && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#24263e] hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>
                      {isResubmitRequired
                        ? (lang === 'vi' ? 'Cập nhật & Nộp lại' : 'Update & Resubmit')
                        : isRejected
                          ? (lang === 'vi' ? 'Đăng ký lại hồ sơ mới' : 'Reapply')
                          : (lang === 'vi' ? 'Chỉnh sửa thông tin' : 'Edit Info')}
                    </span>
                  </button>
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
                {currentUser.role === 'seller' || existingVerification?.status === 'APPROVED' ? (
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
                        <span>{lang === 'vi' ? 'Đến Trang Đăng Bán' : 'Post Listing'}</span>
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
                        onClick={() => setShowForm(true)}
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
                        onClick={() => setShowForm(true)}
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

          {/* VIEW: FORM ĐĂNG KÝ NGƯỜI BÁN */}
          {(showForm || !isRegistered) && !isPendingReview && (
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
                        ? (lang === 'vi' ? 'Cập Nhật Thông Tin Gian Hàng' : 'Update Store Information')
                        : (lang === 'vi' ? 'Đơn Đăng Ký Chuyển Tài Khoản Người Bán' : 'Seller Registration Form')}
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'vi'
                        ? 'Điền thông tin để Kỹ sư Hub và đơn vị vận chuyển (GHTK/GHN) đến nhận thiết bị giám định'
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

              {/* Form Inputs */}
              <div className="space-y-3">
                {/* Resubmission Alert if status is RESUBMIT_REQUIRED */}
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
                          ? `Lý do từ bên thứ 3: "${existingVerification.rejectionReason || 'Ảnh chụp CCCD bị mờ, lóa ánh sáng hoặc không nhận diện rõ'}". Vui lòng tải lên ảnh chụp mới rõ nét và bấm "Nộp Lại Chứng Từ eKYC" ở cuối form.`
                          : `Provider reason: "${existingVerification.rejectionReason || 'Blurry photos or glare'}". Please upload clear photos and submit again.`}
                      </p>
                    </div>
                  </div>
                )}
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
                      {lang === 'vi' ? 'Số Điện Thoại Zalo' : 'Business Phone & Zalo'} <span className="text-red-500">*</span>
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

                {/* Email Gian Hàng & Xác Thực Mã OTP Bắt Buộc Trước Khi eKYC */}
                <div className="p-3.5 bg-gradient-to-br from-[#faf8f5] to-orange-50/20 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>{lang === 'vi' ? 'Email Gian Hàng (Bắt buộc xác thực OTP trước khi eKYC)' : 'Shop Email (OTP Verification Required)'}</span>
                      <span className="text-red-500">*</span>
                    </label>
                    {isEmailVerifiedForOnboarding ? (
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
                        setIsEmailVerifiedForOnboarding(false);
                        setOtpSentSuccess(null);
                        setOtpError(null);
                      }}
                      placeholder="seller@example.com"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs bg-white text-slate-900"
                    />

                    <button
                      type="button"
                      onClick={handleSendOtpInline}
                      disabled={isSendingOtp || otpCountdown > 0 || isEmailVerifiedForOnboarding}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                        isEmailVerifiedForOnboarding
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
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
                          <span>{lang === 'vi' ? 'Đã Xác Thực' : 'Verified'}</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          <span>{hasSentOtp ? (lang === 'vi' ? 'Gửi lại OTP' : 'Resend OTP') : (lang === 'vi' ? 'Gửi mã OTP' : 'Send OTP')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inline OTP input when not yet verified */}
                  {!isEmailVerifiedForOnboarding && hasSentOtp && (
                    <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">
                          {lang === 'vi' ? 'Nhập mã xác thực OTP 6 số đã nhận qua email:' : 'Enter 6-digit OTP code:'}
                        </span>
                        {otpCountdown > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {lang === 'vi' ? `Thời gian: ${otpCountdown}s` : `${otpCountdown}s remaining`}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={inlineOtpCode}
                          onChange={(e) => setInlineOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Ví dụ: 123456"
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-300 focus:border-[#c34c36] focus:ring-1 focus:ring-[#c34c36] outline-none text-xs font-mono tracking-widest text-slate-900 bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtpInline}
                          disabled={isSubmittingOtp || inlineOtpCode.length !== 6}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          {isSubmittingOtp ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{lang === 'vi' ? 'Xác Nhận OTP' : 'Verify OTP'}</span>
                        </button>
                      </div>

                      {otpError && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{otpError}</span>
                        </p>
                      )}
                      {otpSentSuccess && (
                        <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>{otpSentSuccess}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {isEmailVerifiedForOnboarding && (
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Email gian hàng đã được xác thực thành công. Bạn đủ điều kiện nộp eKYC.' : 'Shop email verified. You may proceed with eKYC.'}</span>
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
                            ? (lang === 'vi' ? 'Đang gọi ...' : 'Calling...')
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
                        {lang === 'vi' ? 'Tỉnh / Thành Phố (API BE GHN)' : 'Province / City (BE GHN API)'}
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
                            ? (lang === 'vi' ? 'Đang tải phường/xã từ BE...' : 'Loading wards...')
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
                      <span>{lang === 'vi' ? 'Ảnh Tải Lên Xác Thực eKYC (Mặt Trước, Mặt Sau, Chân Dung)' : 'eKYC Verification Photo Uploads'}</span>
                      <span className="text-red-500">*</span>
                    </div>

                    {/* Batch Multi-File Upload Button */}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-[#c34c36]/40 text-[#c34c36] text-[11px] font-bold rounded-xl shadow-2xs transition cursor-pointer self-start sm:self-auto">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Chọn nhiều ảnh cùng lúc' : 'Batch select photos'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleMultipleFilesSelect}
                      />
                    </label>
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
                          {lang === 'vi' ? '1. Ảnh CCCD Mặt Trước' : '1. Front ID Card'} <span className="text-red-500">*</span>
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
                          {lang === 'vi' ? '2. Ảnh CCCD Mặt Sau' : '2. Back ID Card'} <span className="text-red-500">*</span>
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
                          {lang === 'vi' ? '3. Ảnh Chân Dung Selfie' : '3. Selfie Photo'} <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                          {lang === 'vi' ? 'AI So Khớp' : 'AI Face Match'}
                        </span>
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
                                <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileSelect(e, 'selfie')} />
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
                              <Camera className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                              <span className="truncate">{lang === 'vi' ? 'Mở Camera Quét Mặt' : 'Live Camera Scan'}</span>
                            </button>
                            <label className="text-[9px] text-slate-500 hover:text-[#24263e] underline font-bold cursor-pointer block text-center">
                              {lang === 'vi' ? 'Hoặc chọn ảnh từ máy' : 'Or select photo'}
                              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileSelect(e, 'selfie')} />
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
                      : 'I commit that all listed appliances are authentic and match condition; ready for courier pickup and Hub inspection.'}
                  </span>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end pt-3 border-t border-gray-100 gap-2">
                {isRegistered && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-600 text-xs font-bold transition cursor-pointer"
                  >
                    {lang === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#24263e] hover:bg-black disabled:opacity-50 text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? (lang === 'vi' ? 'Đang Gửi Hồ Sơ...' : 'Submitting...')
                      : existingVerification?.status === 'RESUBMIT_REQUIRED'
                        ? (lang === 'vi' ? 'Nộp Lại Chứng Từ eKYC' : 'Resubmit eKYC Documents')
                        : isRegistered
                          ? (lang === 'vi' ? 'Cập Nhật Hồ Sơ Gian Hàng' : 'Update Store Profile')
                          : (lang === 'vi' ? 'Xác Nhận Đăng Ký & Gửi Duyệt eKYC' : 'Confirm Registration & Submit eKYC')}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-gray-100 flex items-center justify-between text-xs text-slate-500">
          <span>{lang === 'vi' ? 'Đăng ký người bán được bảo lãnh bởi SecondLife Hub' : 'Seller registration secured by SecondLife Hub'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>
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
                {lang === 'vi' ? 'Xác Thực Email Gian Hàng' : 'Verify Shop Email'}
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
                {lang === 'vi'
                  ? 'Theo quy định của SecondLife, email Shop cần được xác thực trước khi gửi hồ sơ eKYC.'
                  : 'Shop email must be verified before submitting eKYC.'}
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
                  <span>{lang === 'vi' ? 'Đang xác thực & Nộp eKYC...' : 'Verifying & Submitting...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'vi' ? 'Xác Thực OTP & Nộp eKYC' : 'Verify OTP & Submit eKYC'}</span>
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
    </div>
  );
};
