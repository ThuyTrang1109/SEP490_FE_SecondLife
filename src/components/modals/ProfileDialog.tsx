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
  AlertTriangle
} from 'lucide-react';
import { UserProfile, UserRole, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import { userService, sellerService, mediaService } from '../../services';

export type ProfileTab = 'info' | 'wallet' | 'kyc' | 'settings';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const isStrongPassword = (pass: string): boolean => {
  return STRONG_PASSWORD_REGEX.test(pass);
};

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onOpenVerifyEmail?: (email: string) => void;
  lang?: Language;
  initialTab?: ProfileTab;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onRoleChange,
  onLogout,
  onChangePassword,
  onOpenVerifyEmail,
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

  // Avatar & eKYC document upload states
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser?.avatar || '');
  const [docFrontUrl, setDocFrontUrl] = useState<string>('');
  const [docBackUrl, setDocBackUrl] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [uploadingField, setUploadingField] = useState<'avatar' | 'front' | 'back' | 'selfie' | null>(null);

  // Change password modal state
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  // Sync state whenever currentUser or modal opens
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      setAvatarUrl(currentUser.avatar || '');
      if (currentUser.gender) setGender(currentUser.gender);
      if (currentUser.birthday) setBirthday(currentUser.birthday);
      if (currentUser.bankAccount) {
        if (currentUser.bankAccount.bankName) setBankName(currentUser.bankAccount.bankName);
        if (currentUser.bankAccount.accountNumber) setAccountNumber(currentUser.bankAccount.accountNumber);
        if (currentUser.bankAccount.accountHolder) setAccountHolder(currentUser.bankAccount.accountHolder);
      }
      setIsSellerRegistered(Boolean(currentUser.isSellerRegistered || currentUser.role === 'seller'));
      setShopName(currentUser.shopName || (currentUser.name ? `Gian Hàng ${currentUser.name}` : 'SecondLife Shop'));
      setSellerPhone(currentUser.phone || '');
      setPickupAddress(currentUser.pickupAddress || currentUser.address || '');
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [currentUser, isOpen, initialTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'front' | 'back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(field);
    try {
      const folder = field === 'avatar' ? 'avatars' : 'seller-verifications';
      const uploaded = await mediaService.uploadImage(file, folder);
      if (field === 'avatar') setAvatarUrl(uploaded.url);
      if (field === 'front') setDocFrontUrl(uploaded.url);
      if (field === 'back') setDocBackUrl(uploaded.url);
      if (field === 'selfie') setSelfieUrl(uploaded.url);
    } catch (err: any) {
      alert(err.message || 'Tải ảnh lên không thành công');
    } finally {
      setUploadingField(null);
    }
  };

  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerFormError(null);
    setSellerFormSuccess(null);

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

    setIsSubmittingSeller(true);
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
          ? 'Hồ sơ định danh eKYC đã được gửi thành công! Hồ sơ đang ở trạng thái Chờ duyệt (Pending) bởi Quản trị viên. Quyền Người Bán sẽ được kích hoạt sau khi được phê duyệt.'
          : 'eKYC verification submitted successfully! It is pending review by the Administrator.'
      );
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

    const updated: UserProfile = {
      ...currentUser,
      name: name.trim(),
      email,
      phone: phone.trim(),
      address,
      avatar: avatarUrl || currentUser.avatar,
      gender,
      birthday,
      bankAccount: {
        bankName,
        accountNumber,
        accountHolder,
      },
    };

    try {
      await userService.updateMyProfile({
        fullName: name.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
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
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FFFFFF] border border-gray-200 shadow-2xl text-[#0E121B] subtle-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Profile Cover & Avatar */}
        <div className="relative">
          {/* Cover gradient banner */}
          <div className="h-28 sm:h-32 bg-gradient-to-r from-[#0E121B] via-[#1a2333] to-[#0E121B] rounded-t-3xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-br from-[#EC1577]/30 to-[#F1622A]/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-3 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>SecondLife Member ID: {currentUser.id}</span>
            </div>
          </div>

          {/* Avatar and Basic Info */}
          <div className="px-6 sm:px-8 -mt-12 sm:-mt-14 relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xl ring-4 ring-white">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <button
                  type="button"
                  title={lang === 'vi' ? 'Thay đổi ảnh đại diện' : 'Change avatar'}
                  className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-white shadow-md border border-gray-200 text-gray-700 hover:text-[#EC1577] transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
                    {name || currentUser.name}
                  </h2>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>
                <div className="pt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleInfo.className}`}
                  >
                    <span>{roleInfo.label}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex sm:flex-col items-center sm:items-end gap-1.5 text-xs text-slate-500 pt-2 sm:pt-0">
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'vi' ? 'eKYC: Đã Xác Thực CCCD' : 'eKYC: ID Verified'}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{lang === 'vi' ? 'Điểm Uy Tín: ' : 'Trust Score: '}<strong className="text-slate-900 font-bold">99/100</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 sm:px-8 mt-5 border-b border-gray-100 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'info'
                ? 'text-[#EC1577]'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <User className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Thông Tin Cá Nhân' : 'Personal Profile'}</span>
            {activeTab === 'info' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'wallet'
                ? 'text-[#EC1577]'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Ví Escrow & Ngân Hàng' : 'Escrow Wallet & Bank'}</span>
            {activeTab === 'wallet' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('kyc')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'kyc'
                ? 'text-[#EC1577]'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Shield className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Định Danh & Bảo Mật' : 'Identity & Security'}</span>
            {activeTab === 'kyc' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'settings'
                ? 'text-[#EC1577]'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Store className="w-4 h-4" />
            <span>
              {currentUser.role === 'seller'
                ? (lang === 'vi' ? 'Gian Hàng Người Bán' : 'Seller Store')
                : (lang === 'vi' ? 'Đăng Ký Thành Người Bán' : 'Register as Seller')}
            </span>
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] rounded-t-full" />
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 sm:p-8">
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      {lang === 'vi' ? 'Địa Chỉ Email' : 'Email Address'}
                    </label>
                    {currentUser.emailVerified ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {lang === 'vi' ? 'Đã xác thực' : 'Verified'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenVerifyEmail?.(email || currentUser.email)}
                        className="text-[10px] font-bold text-[#EC1577] bg-pink-50 hover:bg-pink-100 px-2 py-0.5 rounded-md border border-pink-200 inline-flex items-center gap-1 cursor-pointer transition shadow-xs"
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] transition"
                    />
                  </div>
                </div>

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
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] transition"
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  {lang === 'vi' ? 'Giới Tính' : 'Gender'}
                </label>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={gender === 'male'}
                      onChange={() => setGender('male')}
                      className="accent-[#EC1577]"
                    />
                    <span>{lang === 'vi' ? 'Nam' : 'Male'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={gender === 'female'}
                      onChange={() => setGender('female')}
                      className="accent-[#EC1577]"
                    />
                    <span>{lang === 'vi' ? 'Nữ' : 'Female'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      checked={gender === 'other'}
                      onChange={() => setGender('other')}
                      className="accent-[#EC1577]"
                    />
                    <span>{lang === 'vi' ? 'Khác' : 'Other'}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  {lang === 'vi' ? 'Địa Chỉ' : 'Address'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={lang === 'vi' ? 'Nhập địa chỉ' : 'Enter address'}
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] transition"
                  />
                </div>
              </div>

              {/* Action Buttons inside Tab 1 */}
              <div className="pt-3 flex items-center justify-between">
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
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs sm:text-sm shadow-md hover:opacity-95 disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes')}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: VÍ ESCROW & TÀI KHOẢN NGÂN HÀNG */}
          {activeTab === 'wallet' && (
            <div className="space-y-5">
              {/* Financial Balance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E121B] to-[#1e2738] text-white space-y-2 relative overflow-hidden shadow-md">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#EC1577]" />
                      {lang === 'vi' ? 'Số Dư Khả Dụng Trong Ví' : 'Available Wallet Balance'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                      {lang === 'vi' ? 'Sẵn Sàng Rút' : 'Ready to Withdraw'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    {formatVND(currentUser.walletBalanceVnd || 24500000)}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'vi'
                      ? 'Tiền bán hàng đã hoàn tất giải ngân từ người mua qua quỹ Escrow.'
                      : 'Sales proceeds released from buyers via the Escrow trust fund.'}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FFF5F7] to-[#FFF0ED] border border-[#EC1577]/30 text-[#0E121B] space-y-2 relative overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#EC1577]" />
                      {lang === 'vi' ? 'Tiền Đang Phong Tỏa Escrow' : 'Funds in Escrow Hold'}
                    </span>
                    <span className="text-[10px] bg-[#EC1577]/10 text-[#EC1577] px-2 py-0.5 rounded font-bold">
                      {lang === 'vi' ? 'Đang Bảo Lãnh' : 'Under Escrow Protection'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#EC1577] tracking-tight">
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

          {/* TAB 3: ĐỊNH DANH & BẢO MẬT */}
          {activeTab === 'kyc' && (
            <div className="space-y-4">
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
                    <span>{lang === 'vi' ? 'Mã Định Danh: ' : 'Verification ID: '}<strong>KYC-VN-9920148</strong></span>
                    <span>•</span>
                    <span>{lang === 'vi' ? 'Ngày Phê Duyệt: ' : 'Approval Date: '}15/01/2026</span>
                  </div>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="space-y-2.5">
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
                    className="text-xs font-bold text-[#EC1577] hover:underline cursor-pointer"
                  >
                    {lang === 'vi' ? 'Đổi Mật Khẩu' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ĐỔI VAI TRÒ */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {lang === 'vi' ? 'Đăng Ký Thành Người Bán (Seller Center)' : 'Seller Registration & Hub Onboarding'}
                  </h4>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-[#EC1577] border border-rose-200">
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
                      <Store className="w-4 h-4 text-[#EC1577]" />
                      <span className="text-xs font-bold text-slate-900">
                        {lang === 'vi' ? 'Hồ Sơ Gian Hàng Người Bán Của Bạn' : 'Your Seller Store Profile'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                      <button
                        type="button"
                        onClick={() => setShowSellerRegistrationForm(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#EC1577] hover:underline cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Chỉnh sửa thông tin' : 'Edit Information'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Tên gian hàng' : 'Store name'}</span>
                      <span className="font-bold text-slate-800">{shopName || (lang === 'vi' ? 'Gian Hàng SecondLife' : 'SecondLife Store')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Hotline bán hàng & Zalo' : 'Sales hotline & Zalo'}</span>
                      <span className="font-bold text-slate-800">{sellerPhone || phone}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{lang === 'vi' ? 'Địa chỉ kho bưu tá lấy hàng' : 'Courier pickup warehouse address'}</span>
                      <span className="font-medium text-slate-800">{pickupAddress || address}</span>
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
                </div>
              )}

              {/* FORM ĐĂNG KÝ CHUYỂN TÀI KHOẢN NGƯỜI BÁN */}
              {(showSellerRegistrationForm || (!isSellerRegistered && currentUser.role !== 'seller')) && (
                <form
                  onSubmit={handleRegisterSeller}
                  className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-slate-50 border-2 border-[#EC1577]/30 shadow-md space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
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
                      <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577] shrink-0" />
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
                          placeholder={lang === 'vi' ? 'VD: Tủ lạnh, Máy giặt, Máy pha cafe...' : 'e.g., Refrigerators, Washers, Coffee machines...'}
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
                          <label className="text-[10px] font-bold text-slate-600 block">{lang === 'vi' ? '1. Ảnh CCCD Mặt Trước' : '1. Front ID Card'}</label>
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
                          <label className="text-[10px] font-bold text-slate-600 block">{lang === 'vi' ? '2. Ảnh CCCD Mặt Sau' : '2. Back ID Card'}</label>
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
                                  {uploadingField === 'selfie' ? (lang === 'vi' ? 'Đang tải lên...' : 'Uploading...') : (lang === 'vi' ? 'Chọn ảnh chân dung' : 'Select Selfie Photo')}
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
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-gray-100 rounded-b-3xl flex flex-wrap items-center justify-between gap-3">
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
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
                  <Lock className="w-5 h-5 text-[#EC1577]" />
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs text-slate-900"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs text-slate-900"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs text-slate-900"
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
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingPass ? (lang === 'vi' ? 'Đang xử lý...' : 'Processing...') : (lang === 'vi' ? 'Cập Nhật Mật Khẩu' : 'Update Password')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
