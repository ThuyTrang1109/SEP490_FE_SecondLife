import React, { useState, useEffect } from 'react';
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
  MapPin,
  Building
} from 'lucide-react';
import { UserProfile, UserRole, Language } from '../../types';
import { sellerService, mediaService } from '../../services';

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

  // Upload States
  const [docFrontUrl, setDocFrontUrl] = useState<string>('');
  const [docBackUrl, setDocBackUrl] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [uploadingField, setUploadingField] = useState<'front' | 'back' | 'selfie' | null>(null);

  // UI state
  const [showForm, setShowForm] = useState(!isRegistered);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  }, [currentUser, isOpen]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(field);
    try {
      const uploaded = await mediaService.uploadImage(file, 'seller-verifications');
      if (field === 'front') setDocFrontUrl(uploaded.url);
      if (field === 'back') setDocBackUrl(uploaded.url);
      if (field === 'selfie') setSelfieUrl(uploaded.url);
    } catch (err: any) {
      alert(err.message || (lang === 'vi' ? 'Tải ảnh lên không thành công' : 'Upload failed'));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

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
    if (!docFrontUrl || !docBackUrl) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng tải lên đầy đủ ảnh CCCD mặt trước và mặt sau.'
          : 'Please upload both front and back Citizen ID photos.'
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

    setIsSubmitting(true);
    try {
      await sellerService.submitVerification({
        verificationType: 'CITIZEN_ID',
        documentNumber: idCardNumber.trim(),
        documentFrontUrl: docFrontUrl,
        documentBackUrl: docBackUrl,
        selfieUrl: selfieUrl || undefined,
      });

      const updated: UserProfile = {
        ...currentUser,
        isSellerRegistered: true,
        kycStatus: 'pending',
        shopName: shopName.trim(),
        pickupAddress: pickupAddress.trim(),
        phone: sellerPhone.trim(),
        idCardNumber: idCardNumber.trim(),
        bankAccount: {
          bankName: sellerBankName.trim() || currentUser.bankAccount?.bankName || 'Vietcombank',
          accountNumber: sellerAccountNumber.trim() || currentUser.bankAccount?.accountNumber || '',
          accountHolder: sellerAccountHolder.trim() || currentUser.bankAccount?.accountHolder || '',
        },
      };

      onUpdateProfile(updated);
      setShowForm(false);
      setSuccessMsg(
        lang === 'vi'
          ? 'Hồ sơ định danh eKYC đã được gửi thành công! Hồ sơ đang ở trạng thái Chờ duyệt (Pending) bởi Quản trị viên. Quyền Người Bán sẽ được kích hoạt sau khi được phê duyệt.'
          : 'eKYC verification submitted successfully! It is pending review by the Administrator.'
      );
    } catch (err: any) {
      setErrorMsg(
        err.message ||
        (lang === 'vi'
          ? 'Gửi hồ sơ định danh không thành công. Vui lòng kiểm tra lại thông tin.'
          : 'Failed to submit verification. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstantActivateDemo = () => {
    const updated: UserProfile = {
      ...currentUser,
      isSellerRegistered: true,
      role: 'seller',
      kycStatus: 'verified',
      shopName: shopName.trim() || currentUser.shopName || `Gian Hàng ${currentUser.name}`,
      pickupAddress: pickupAddress.trim() || currentUser.pickupAddress || currentUser.address || 'Hà Nội',
      phone: sellerPhone.trim() || currentUser.phone || '0912345678',
      idCardNumber: idCardNumber.trim() || '048299102941',
    };
    onRoleChange('seller');
    onUpdateProfile(updated);
    setSuccessMsg(
      lang === 'vi'
        ? 'Đã kích hoạt quyền Người Bán (Chế độ Thử Nghiệm)! Bây giờ bạn có thể đăng tin bán sản phẩm ngay.'
        : 'Seller role activated (Demo mode)! You can now post listings.'
    );
    setShowForm(false);
    setTimeout(() => {
      onClose();
      onNavigateToCreateListing?.();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#0E121B] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {lang === 'vi' ? 'Đăng Ký Thành Người Bán' : 'Seller Hub Onboarding'}
                </h3>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  currentUser.role === 'seller'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : currentUser.kycStatus === 'pending' || currentUser.isSellerRegistered
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {currentUser.role === 'seller'
                    ? (lang === 'vi' ? 'Đã Kích Hoạt Người Bán' : 'Seller Active')
                    : (currentUser.kycStatus === 'pending' || currentUser.isSellerRegistered)
                    ? (lang === 'vi' ? 'Đang Chờ Duyệt eKYC' : 'Pending Review')
                    : (lang === 'vi' ? 'Chưa Kích Hoạt' : 'Not Registered')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {lang === 'vi'
                  ? 'Đăng ký gian hàng & địa chỉ kho để bắt đầu đăng bán thiết bị gia dụng trên SecondLife'
                  : 'Register store profile & warehouse to post appliances on SecondLife'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Highlights Banner */}
          <div className="grid grid-cols-3 gap-2.5 py-1 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100 text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#EC1577] shrink-0" />
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
                  <Store className="w-4 h-4 text-[#EC1577]" />
                  <span className="text-xs font-bold text-slate-900">
                    {lang === 'vi' ? 'Hồ Sơ Gian Hàng Của Bạn' : 'Your Seller Store Profile'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    currentUser.kycStatus === 'pending'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : currentUser.role === 'seller' || currentUser.kycStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {currentUser.kycStatus === 'pending'
                      ? (lang === 'vi' ? 'Đang Chờ Quản Trị Viên Duyệt' : 'Pending Review')
                      : (currentUser.role === 'seller' || currentUser.kycStatus === 'verified')
                      ? (lang === 'vi' ? 'Đã Kích Hoạt' : 'Active')
                      : (lang === 'vi' ? 'Chưa Định Danh' : 'Unverified')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EC1577] hover:underline cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Chỉnh sửa thông tin' : 'Edit Info'}</span>
                </button>
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
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs">
                {currentUser.role === 'seller' ? (
                  <div className="flex items-center justify-between gap-3">
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
                        className="px-4 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Đến Trang Đăng Bán' : 'Post Listing'}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-relaxed">
                      {lang === 'vi'
                        ? 'Hồ sơ của bạn đang được Ban Quản trị SecondLife đối soát CCCD và địa chỉ kho. Để trải nghiệm đăng tin ngay trong môi trường thử nghiệm, bạn có thể nhấn kích hoạt nhanh bên dưới.'
                        : 'Your profile is awaiting review by SecondLife administrators. You can use the quick demo activation below to test posting.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleInstantActivateDemo}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Kích Hoạt Quyền Người Bán Ngay (Thử Nghiệm)' : 'Instant Activate Seller (Demo)'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: FORM ĐĂNG KÝ NGƯỜI BÁN */}
          {(showForm || !isRegistered) && (
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-slate-50 border-2 border-[#EC1577]/30 shadow-md space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {lang === 'vi' ? 'Địa Chỉ Kho / Nơi Bưu Tá Đến Lấy Hàng Giao Hub' : 'Warehouse / Pickup Location for Hub'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder={lang === 'vi' ? 'Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố' : 'Street address, ward, district, city'}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {lang === 'vi'
                      ? 'Đối tác vận chuyển (GHTK / GHN) sẽ đến địa chỉ này tiếp nhận thiết bị gửi về Hub kiểm định.'
                      : 'Couriers (GHTK / GHN) will pick up devices from this address and deliver them to Hub for inspection.'}
                  </span>
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                    />
                  </div>
                </div>

                {/* eKYC Document Photo Upload Section */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileCheck className="w-4 h-4 text-[#EC1577]" />
                    <span>{lang === 'vi' ? 'Ảnh Tải Lên Xác Thực eKYC (Mặt Trước, Mặt Sau, Chân Dung)' : 'eKYC Verification Photo Uploads'}</span>
                    <span className="text-red-500">*</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Front ID */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">{lang === 'vi' ? '1. Ảnh CCCD Mặt Trước' : '1. Front ID Card'} *</label>
                      <div className="relative border border-dashed border-slate-300 hover:border-[#EC1577] rounded-xl p-2 bg-white text-center transition">
                        {docFrontUrl ? (
                          <div className="space-y-1">
                            <img src={docFrontUrl} alt="Front ID" className="w-full h-20 object-cover rounded-lg" />
                            <span className="text-[10px] text-emerald-600 font-bold block flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã tải lên' : 'Uploaded'}
                            </span>
                          </div>
                        ) : (
                          <label className="cursor-pointer block py-3 space-y-1">
                            <Camera className="w-5 h-5 text-slate-400 mx-auto" />
                            <span className="text-[10px] font-bold text-slate-600 block">
                              {uploadingField === 'front' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh mặt trước' : 'Select Front Photo')}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Back ID */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">{lang === 'vi' ? '2. Ảnh CCCD Mặt Sau' : '2. Back ID Card'} *</label>
                      <div className="relative border border-dashed border-slate-300 hover:border-[#EC1577] rounded-xl p-2 bg-white text-center transition">
                        {docBackUrl ? (
                          <div className="space-y-1">
                            <img src={docBackUrl} alt="Back ID" className="w-full h-20 object-cover rounded-lg" />
                            <span className="text-[10px] text-emerald-600 font-bold block flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã tải lên' : 'Uploaded'}
                            </span>
                          </div>
                        ) : (
                          <label className="cursor-pointer block py-3 space-y-1">
                            <Camera className="w-5 h-5 text-slate-400 mx-auto" />
                            <span className="text-[10px] font-bold text-slate-600 block">
                              {uploadingField === 'back' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh mặt sau' : 'Select Back Photo')}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Selfie */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">{lang === 'vi' ? '3. Ảnh Chân Dung Selfie' : '3. Selfie Photo'}</label>
                      <div className="relative border border-dashed border-slate-300 hover:border-[#EC1577] rounded-xl p-2 bg-white text-center transition">
                        {selfieUrl ? (
                          <div className="space-y-1">
                            <img src={selfieUrl} alt="Selfie" className="w-full h-20 object-cover rounded-lg" />
                            <span className="text-[10px] text-emerald-600 font-bold block flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã tải lên' : 'Uploaded'}
                            </span>
                          </div>
                        ) : (
                          <label className="cursor-pointer block py-3 space-y-1">
                            <Camera className="w-5 h-5 text-slate-400 mx-auto" />
                            <span className="text-[10px] font-bold text-slate-600 block">
                              {uploadingField === 'selfie' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh selfie' : 'Select Selfie')}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'selfie')} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Information for Payout */}
                <div className="p-3 rounded-2xl bg-white border border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <CreditCard className="w-3.5 h-3.5 text-[#EC1577]" />
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#EC1577]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{lang === 'vi' ? 'Số tài khoản' : 'Account number'}</label>
                      <input
                        type="text"
                        value={sellerAccountNumber}
                        onChange={(e) => setSellerAccountNumber(e.target.value)}
                        placeholder="991204882910"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#EC1577]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{lang === 'vi' ? 'Chủ tài khoản' : 'Account holder'}</label>
                      <input
                        type="text"
                        value={sellerAccountHolder}
                        onChange={(e) => setSellerAccountHolder(e.target.value)}
                        placeholder="HOANG QUOC KHANG"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#EC1577]"
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
                    className="mt-0.5 rounded text-[#EC1577] focus:ring-[#EC1577] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed">
                    {lang === 'vi'
                      ? 'Tôi cam kết mọi thiết bị đăng bán là chính hãng, đúng tình trạng; sẵn sàng giao hàng cho bưu tá để Kỹ sư Hub kiểm định dán tem NFC và tuân thủ quy chế giải ngân qua quỹ tín thác Escrow của SecondLife.'
                      : 'I commit that all listed appliances are authentic and match condition; ready for courier pickup and Hub inspection.'}
                  </span>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleInstantActivateDemo}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Kích hoạt nhanh (Demo)' : 'Quick Demo Activation'}</span>
                </button>

                <div className="flex items-center gap-2">
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
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? (lang === 'vi' ? 'Đang Gửi Hồ Sơ...' : 'Submitting...')
                        : isRegistered
                        ? (lang === 'vi' ? 'Cập Nhật Hồ Sơ Gian Hàng' : 'Update Store Profile')
                        : (lang === 'vi' ? 'Xác Nhận Đăng Ký & Gửi Duyệt eKYC' : 'Confirm Registration & Submit eKYC')}
                    </span>
                  </button>
                </div>
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
    </div>
  );
};
