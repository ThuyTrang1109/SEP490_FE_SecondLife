import React, { useState } from 'react';
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

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  lang?: Language;
}

type ProfileTab = 'info' | 'wallet' | 'kyc' | 'settings';

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onRoleChange,
  onLogout,
  lang = 'vi',
}) => {
  if (!isOpen || !currentUser) return null;

  const [activeTab, setActiveTab] = useState<ProfileTab>('info');

  // Form states
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '0912 345 678');
  const [address, setAddress] = useState(
    currentUser.address || '92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, TP. Đà Nẵng'
  );
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(currentUser.gender || 'male');
  const [birthday, setBirthday] = useState(currentUser.birthday || '1998-05-18');
  const [bankName, setBankName] = useState(currentUser.bankAccount?.bankName || 'Vietcombank');
  const [accountNumber, setAccountNumber] = useState(
    currentUser.bankAccount?.accountNumber || '991204882910'
  );
  const [accountHolder, setAccountHolder] = useState(
    currentUser.bankAccount?.accountHolder || 'HOANG QUOC KHANG'
  );

  const [isSaved, setIsSaved] = useState(false);

  // Seller registration & switching states
  const [isSellerRegistered, setIsSellerRegistered] = useState<boolean>(
    Boolean(currentUser.isSellerRegistered || currentUser.role === 'seller')
  );
  const [shopName, setShopName] = useState(
    currentUser.shopName || (currentUser.name ? `Gian Hàng ${currentUser.name}` : 'SecondLife Shop')
  );
  const [sellerPhone, setSellerPhone] = useState(currentUser.phone || '0912 345 678');
  const [pickupAddress, setPickupAddress] = useState(
    currentUser.pickupAddress || currentUser.address || '92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, TP. Đà Nẵng'
  );
  const [idCardNumber, setIdCardNumber] = useState(currentUser.idCardNumber || '048299102941');
  const [sellerBankName, setSellerBankName] = useState(
    currentUser.bankAccount?.bankName || 'Vietcombank'
  );
  const [sellerAccountNumber, setSellerAccountNumber] = useState(
    currentUser.bankAccount?.accountNumber || '991204882910'
  );
  const [sellerAccountHolder, setSellerAccountHolder] = useState(
    currentUser.bankAccount?.accountHolder || 'HOANG QUOC KHANG'
  );
  const [sellerProductTypes, setSellerProductTypes] = useState('Tủ lạnh, Máy giặt, Thiết bị điện lạnh gia dụng');
  const [sellerTermsAgreed, setSellerTermsAgreed] = useState(true);
  const [showSellerRegistrationForm, setShowSellerRegistrationForm] = useState(false);
  const [sellerFormSuccess, setSellerFormSuccess] = useState<string | null>(null);
  const [sellerFormError, setSellerFormError] = useState<string | null>(null);

  const handleRegisterSeller = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerFormError(null);

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
    if (!sellerTermsAgreed) {
      setSellerFormError('Vui lòng đồng ý với cam kết chất lượng Hub và cơ chế Escrow.');
      return;
    }

    const updated: UserProfile = {
      ...currentUser,
      role: 'seller',
      isSellerRegistered: true,
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
    onRoleChange('seller');
    setSellerFormSuccess('Đăng ký tài khoản Người Bán thành công! Vai trò đã chuyển sang Người Bán.');
    setTimeout(() => setSellerFormSuccess(null), 4000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...currentUser,
      name,
      email,
      phone,
      address,
      gender,
      birthday,
      bankAccount: {
        bankName,
        accountNumber,
        accountHolder,
      },
    };
    onUpdateProfile(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'buyer':
        return {
          label: 'Người Mua Xác Thực (Verified Buyer)',
          className: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
        };
      case 'seller':
        return {
          label: 'Nhà Bán Hàng Uy Tín (Top Seller 4.9★)',
          className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
        };
      case 'inspector':
        return {
          label: 'Kỹ Sư Giám Định Hub (Certified Lab Tech)',
          className: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
        };
      case 'admin':
        return {
          label: 'Quản Trị Viên Hệ Thống (Supervisor)',
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
                  title="Thay đổi ảnh đại diện"
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
                <span>eKYC: Đã Xác Thực CCCD</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Điểm Uy Tín: <strong className="text-slate-900 font-bold">99/100</strong></span>
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
            <span>Thông Tin Cá Nhân</span>
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
            <span>Ví Escrow & Ngân Hàng</span>
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
            <span>Định Danh & Bảo Mật</span>
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
            <KeyRound className="w-4 h-4" />
            <span>Đổi Vai Trò</span>
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
                    Họ và Tên
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
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Địa Chỉ Email
                  </label>
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
                    Số Điện Thoại (Nhận mã OTP / Bưu tá gọi)
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
                    Ngày Sinh
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
                  Giới Tính
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
                    <span>Nam</span>
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
                    <span>Nữ</span>
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
                    <span>Khác</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  Địa Chỉ Nhận Hàng & Lấy Hàng Mặc Định
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
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
                      <span>Đã lưu thông tin thành công!</span>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs sm:text-sm shadow-md hover:opacity-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Thay Đổi</span>
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
                      Số Dư Khả Dụng Trong Ví
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                      Sẵn Sàng Rút
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    {formatVND(currentUser.walletBalanceVnd || 24500000)}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Tiền bán hàng đã hoàn tất giải ngân từ người mua qua quỹ Escrow.
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FFF5F7] to-[#FFF0ED] border border-[#EC1577]/30 text-[#0E121B] space-y-2 relative overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#EC1577]" />
                      Tiền Đang Phong Tỏa Escrow
                    </span>
                    <span className="text-[10px] bg-[#EC1577]/10 text-[#EC1577] px-2 py-0.5 rounded font-bold">
                      Đang Bảo Lãnh
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#EC1577] tracking-tight">
                    {formatVND(currentUser.escrowLockedVnd || 19562500)}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bảo đảm an toàn cho các đơn hàng đang trên đường giao hoặc chờ kiểm tra 48h.
                  </p>
                </div>
              </div>

              {/* Linked Bank Account Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Tài Khoản Ngân Hàng Nhận Tiền Bán
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Đã Xác Thực 24/7
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <label className="text-slate-500 text-[11px] block">Ngân hàng</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="mt-1 w-full p-2 bg-white rounded-lg border border-gray-200 font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[11px] block">Số tài khoản</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="mt-1 w-full p-2 bg-white rounded-lg border border-gray-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[11px] block">Tên chủ tài khoản</label>
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
                    Cập Nhật Tài Khoản Ngân Hàng
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
                    Tài khoản đã hoàn tất định danh eKYC Căn Cước Công Dân
                  </h4>
                  <p className="text-xs text-emerald-800/80 leading-relaxed">
                    Hồ sơ của bạn đã được đối soát sinh trắc học và dán tem xác thực SecondLife Verified.
                    Bạn có thể đăng bán và giải ngân không giới hạn hạn mức.
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-emerald-700">
                    <span>Mã Định Danh: <strong>KYC-VN-9920148</strong></span>
                    <span>•</span>
                    <span>Ngày Phê Duyệt: 15/01/2026</span>
                  </div>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cài Đặt An Toàn & Bảo Vệ Tài Khoản
                </h4>

                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Xác thực 2 bước (2FA qua SMS)</span>
                      <span className="text-[11px] text-slate-500">Gửi mã OTP xác nhận mỗi khi chuyển tiền Escrow</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Đang Bật
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Mật khẩu đăng nhập</span>
                      <span className="text-[11px] text-slate-500">Đã đổi 45 ngày trước (Độ mạnh: Rất cao)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-[#EC1577] hover:underline cursor-pointer"
                  >
                    Đổi Mật Khẩu
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
                    Chuyển Đổi Vai Trò Tài Khoản
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Người Mua & Người Bán
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Hệ thống cho phép bạn chuyển đổi linh hoạt giữa Người Mua và Người Bán. Để chuyển sang Người Bán, bạn cần hoàn tất thông tin đăng ký gian hàng và địa chỉ kho lấy hàng.
                </p>
              </div>

              {/* Success Notification */}
              {sellerFormSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{sellerFormSuccess}</span>
                </div>
              )}

              {/* 2 Roles Switcher Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. NGƯỜI MUA */}
                <div
                  onClick={() => {
                    if (currentUser.role !== 'buyer') {
                      onRoleChange('buyer');
                      onUpdateProfile({ ...currentUser, role: 'buyer' });
                      setShowSellerRegistrationForm(false);
                      setSellerFormSuccess('Đã chuyển thành công sang vai trò Người Mua (Buyer).');
                      setTimeout(() => setSellerFormSuccess(null), 3000);
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between relative ${currentUser.role === 'buyer'
                      ? 'bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-xs'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${currentUser.role === 'buyer' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                          }`}>
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Người Mua (Buyer)
                          </span>
                          <span className="text-[10px] text-slate-400">Dành cho khách mua hàng</span>
                        </div>
                      </div>
                      {currentUser.role === 'buyer' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          Đang Dùng
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-blue-600 hover:underline">
                          Chọn vai trò
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Duyệt sàn đồ gia dụng cũ đã qua kiểm định, xem điểm giám định Hub 3D & tem NFC, đặt cọc giữ tiền Escrow an toàn tuyệt đối.
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Quyền lợi: Mua cọc Escrow, hoàn tiền khi lỗi</span>
                  </div>
                </div>

                {/* 2. NGƯỜI BÁN */}
                <div
                  onClick={() => {
                    if (currentUser.role === 'seller') {
                      setShowSellerRegistrationForm(!showSellerRegistrationForm);
                    } else if (isSellerRegistered) {
                      onRoleChange('seller');
                      onUpdateProfile({ ...currentUser, role: 'seller' });
                      setSellerFormSuccess('Đã chuyển thành công sang vai trò Người Bán (Seller).');
                      setTimeout(() => setSellerFormSuccess(null), 3000);
                    } else {
                      setShowSellerRegistrationForm(true);
                      setSellerFormError(null);
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between relative ${currentUser.role === 'seller'
                      ? 'bg-gradient-to-br from-[#EC1577]/10 to-[#F1622A]/10 border-[#EC1577] ring-2 ring-[#EC1577]/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-[#EC1577]/50 hover:shadow-xs'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${currentUser.role === 'seller'
                            ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white'
                            : 'bg-rose-50 text-[#EC1577]'
                          }`}>
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Người Bán (Seller)
                          </span>
                          <span className="text-[10px] text-slate-400">Dành cho chủ shop / cá nhân bán</span>
                        </div>
                      </div>

                      {currentUser.role === 'seller' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#EC1577] bg-[#EC1577]/10 px-2 py-0.5 rounded-full border border-[#EC1577]/30">
                          <CheckCircle2 className="w-3 h-3 text-[#EC1577]" />
                          Đang Dùng
                        </span>
                      ) : isSellerRegistered ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đã Đăng Ký
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Cần Đăng Ký
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Đăng bán máy lạnh, tủ lạnh, máy giặt cũ... Định giá AI tự động, bưu tá lấy hàng giao Hub kiểm định, nhận tiền qua Escrow.
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Yêu cầu: Đăng ký kho & thông tin nhận tiền</span>
                    <span className="font-bold text-[#EC1577]">
                      {currentUser.role === 'seller'
                        ? 'Chi tiết gian hàng'
                        : isSellerRegistered
                          ? 'Bấm để chuyển vai trò'
                          : 'Điền đơn đăng ký →'}
                    </span>
                  </div>
                </div>
              </div>

              {/* THÔNG TIN GIAN HÀNG ĐÃ ĐĂNG KÝ (HIỂN THỊ KHI ĐÃ LÀ SELLER HOẶC ĐÃ ĐĂNG KÝ) */}
              {isSellerRegistered && !showSellerRegistrationForm && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#EC1577]" />
                      <span className="text-xs font-bold text-slate-900">
                        Hồ Sơ Gian Hàng Người Bán Của Bạn
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        Đã Kích Hoạt
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSellerRegistrationForm(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#EC1577] hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa thông tin</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Tên gian hàng</span>
                      <span className="font-bold text-slate-800">{shopName || 'Gian Hàng SecondLife'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Hotline bán hàng & Zalo</span>
                      <span className="font-bold text-slate-800">{sellerPhone || phone}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Địa chỉ kho bưu tá lấy hàng</span>
                      <span className="font-medium text-slate-800">{pickupAddress || address}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Số CCCD định danh</span>
                      <span className="font-bold text-slate-800">{idCardNumber || '048299102941'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Tài khoản nhận tiền Escrow</span>
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
                          {isSellerRegistered ? 'Cập Nhật Thông Tin Gian Hàng' : 'Đơn Đăng Ký Chuyển Tài Khoản Người Bán'}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Điền thông tin để Kỹ sư Hub và đơn vị vận chuyển (GHTK/GHN) đến nhận thiết bị giám định
                        </p>
                      </div>
                    </div>
                    {isSellerRegistered && (
                      <button
                        type="button"
                        onClick={() => setShowSellerRegistrationForm(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                      >
                        Đóng
                      </button>
                    )}
                  </div>

                  {/* Highlights Banner */}
                  <div className="grid grid-cols-3 gap-2 py-1 text-[11px]">
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50/60 border border-rose-100 text-slate-700">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577] shrink-0" />
                      <span>Xác minh CCCD</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/60 border border-amber-100 text-slate-700">
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Lấy hàng tận kho</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 text-slate-700">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Giải ngân Escrow</span>
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
                          Tên Gian Hàng / Cửa Hàng <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder="VD: Điện Máy Cũ Hoàng Khang"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Số Điện Thoại Kinh Doanh & Zalo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={sellerPhone}
                          onChange={(e) => setSellerPhone(e.target.value)}
                          placeholder="VD: 0912 345 678"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Địa Chỉ Kho / Nơi Bưu Tá Đến Lấy Hàng Giao Hub <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Đối tác vận chuyển (GHTK / GHN) sẽ đến địa chỉ này tiếp nhận thiết bị gửi về Hub kiểm định.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Số Căn Cước Công Dân (CCCD/CMND) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={idCardNumber}
                          onChange={(e) => setIdCardNumber(e.target.value)}
                          placeholder="VD: 048299102941"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Loại Thiết Bị Bán Chủ Yếu
                        </label>
                        <input
                          type="text"
                          value={sellerProductTypes}
                          onChange={(e) => setSellerProductTypes(e.target.value)}
                          placeholder="VD: Tủ lạnh, Máy giặt, Máy pha cafe..."
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#EC1577] focus:ring-1 focus:ring-[#EC1577] outline-none text-xs bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Bank Information for Payout */}
                    <div className="p-3 rounded-2xl bg-white border border-gray-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <CreditCard className="w-3.5 h-3.5 text-[#EC1577]" />
                        <span>Tài Khoản Ngân Hàng Nhận Tiền Bán (Giải Ngân Escrow)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Ngân hàng</label>
                          <input
                            type="text"
                            value={sellerBankName}
                            onChange={(e) => setSellerBankName(e.target.value)}
                            placeholder="Vietcombank"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#EC1577]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số tài khoản</label>
                          <input
                            type="text"
                            value={sellerAccountNumber}
                            onChange={(e) => setSellerAccountNumber(e.target.value)}
                            placeholder="991204882910"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#EC1577]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Chủ tài khoản</label>
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
                        Tôi cam kết mọi thiết bị đăng bán là chính hãng, đúng tình trạng; sẵn sàng giao hàng cho bưu tá để Kỹ sư Hub kiểm định dán tem NFC và tuân thủ quy chế giải ngân qua quỹ tín thác Escrow của SecondLife.
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
                        Hủy
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSellerRegistered
                          ? 'Cập Nhật Hồ Sơ Gian Hàng'
                          : 'Xác Nhận Đăng Ký & Kích Hoạt Người Bán'}
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
            <span>Đăng Xuất Khỏi Thiết Bị</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Hồ Sơ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
