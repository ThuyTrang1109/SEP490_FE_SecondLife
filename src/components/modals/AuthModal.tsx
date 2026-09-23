import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Phone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  Zap,
  RotateCcw,
  Star,
  Award,
  Fingerprint
} from 'lucide-react';
import { UserRole, Language } from '../../types';
import { soundFx } from '../../utils/soundEffects';
import { authService } from '../../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onLoginSuccess: (user: { id: string; name: string; email: string; role: UserRole }) => void;
  lang: Language;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onLoginSuccess,
  lang
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

  // Form states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) || pass.length >= 12) score += 1;
    return score;
  };

  const passStrength = getPasswordStrength(registerPassword);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setResetSent(false);
      setIsLoading(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const demoAccounts: Array<{
    label: string;
    role: UserRole;
    name: string;
    email: string;
    desc: string;
    avatarBg: string;
    icon: React.ReactNode;
  }> = [
      {
        label: lang === 'vi' ? 'Người Mua (Buyer)' : 'Buyer Account',
        role: 'buyer',
        name: 'Hoàng Quốc Khang',
        email: 'khang.buyer@secondlife.vn',
        desc: lang === 'vi' ? 'Tìm kiếm, đàm phán & cọc Escrow' : 'Browse, negotiate & Escrow deposit',
        avatarBg: 'bg-zinc-800 text-white',
        icon: <User className="w-3.5 h-3.5 text-zinc-300" />
      },
      {
        label: lang === 'vi' ? 'Người Bán (Seller)' : 'Seller Account',
        role: 'seller',
        name: 'Nguyễn Minh Tuấn',
        email: 'tuan.seller@secondlife.vn',
        desc: lang === 'vi' ? 'Người bán uy tín có sản phẩm sàn' : 'Verified seller with active listings',
        avatarBg: 'bg-zinc-800 text-white',
        icon: <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
      },
      {
        label: lang === 'vi' ? 'Kỹ Sư Hub (Inspector)' : 'Hub Inspector',
        role: 'inspector',
        name: 'KTV Trưởng Hải Đăng',
        email: 'haidang.hub@secondlife.vn',
        desc: lang === 'vi' ? 'Nghiệm thu bo mạch tại SecondLife Hub' : 'Hardware inspection specialist at Hub',
        avatarBg: 'bg-zinc-800 text-white',
        icon: <Building2 className="w-3.5 h-3.5 text-zinc-300" />
      },
      {
        label: lang === 'vi' ? 'Quản Trị (Admin)' : 'System Admin',
        role: 'admin',
        name: 'Admin Điều Hành',
        email: 'admin@secondlife.vn',
        desc: lang === 'vi' ? 'Trọng tài phân xử khiếu nại Escrow' : 'Escrow dispute arbitrator & manager',
        avatarBg: 'bg-zinc-800 text-white',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-zinc-300" />
      }
    ];

  const mapBackendRole = (roles?: string[]): UserRole => {
    if (!roles || roles.length === 0) return 'buyer';
    if (roles.includes('ROLE_ADMIN') || roles.includes('ADMIN')) return 'admin';
    if (roles.includes('ROLE_INSPECTOR') || roles.includes('INSPECTOR') || roles.includes('HUB_INSPECTOR')) return 'inspector';
    if (roles.includes('ROLE_SELLER') || roles.includes('SELLER')) return 'seller';
    return 'buyer';
  };

  const handleDemoLogin = (account: typeof demoAccounts[0]) => {
    soundFx.playChime();
    onLoginSuccess({
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      name: account.name,
      email: account.email,
      role: account.role
    });
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailOrPhone.trim() || !password.trim()) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng nhập đầy đủ email/SĐT và mật khẩu.'
          : 'Please enter your email/phone and password.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login({
        email: emailOrPhone.trim(),
        password: password
      });
      soundFx.playChime();
      const mappedRole = mapBackendRole(res.roles);
      onLoginSuccess({
        id: res.user.id,
        name: res.user.fullName || res.user.email,
        email: res.user.email,
        role: mappedRole
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'vi' ? 'Đăng nhập thất bại. Vui lòng kiểm tra lại.' : 'Login failed. Please check credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setErrorMsg(
        lang === 'vi' ? 'Vui lòng điền đầy đủ các thông tin bắt buộc.' : 'Please fill out all required fields.'
      );
      return;
    }
    if (!agreedTerms) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng đồng ý với Quy chế & Cam kết Escrow của SecondLife.'
          : 'Please accept SecondLife Terms & Escrow Guarantee.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.register({
        email: registerEmail.trim(),
        password: registerPassword,
        fullName: fullName.trim(),
        phone: phoneNumber.trim() || undefined
      });
      soundFx.playChime();
      const mappedRole = mapBackendRole(res.roles);
      onLoginSuccess({
        id: res.user.id,
        name: res.user.fullName || res.user.email,
        email: res.user.email,
        role: mappedRole
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'vi' ? 'Đăng ký thất bại. Vui lòng thử lại.' : 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!resetEmail.trim()) {
      setErrorMsg(
        lang === 'vi' ? 'Vui lòng nhập email đã đăng ký tài khoản.' : 'Please enter your registered email address.'
      );
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(resetEmail.trim());
      soundFx.playChime();
      setResetSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'vi' ? 'Gửi yêu cầu thất bại.' : 'Failed to send reset link.'));
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-lg overflow-y-auto animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-[1020px] w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-12 my-auto relative overflow-hidden text-[#0E121B]">

        {/* ================= LEFT HERO BRAND & TRUST SIDEBAR ================= */}
        <div className="hidden md:flex md:col-span-5 bg-[#0E121B] p-8 flex-col justify-between text-white relative overflow-hidden select-none border-r border-white/10">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 rounded-full bg-[#EC1577]/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-80 h-80 rounded-full bg-[#F1622A]/10 blur-3xl pointer-events-none" />

          {/* Top Brand Identity Header */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="SecondLife Logo"
                className="h-12 w-auto object-contain rounded-2xl bg-white p-1.5 shadow-xl border border-white/20"
              />
              <div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  SecondLife
                  <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/10 text-white px-2.5 py-0.5 rounded-full border border-white/20">
                    VERIFIED
                  </span>
                </h2>
                <p className="text-xs text-white/70 font-medium">Safe Recommerce Ecosystem</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <h3 className="text-xl font-extrabold leading-snug text-white tracking-tight">
                {lang === 'vi'
                  ? 'Sàn Đồ Cũ An Toàn & Định Giá Minh Bạch'
                  : 'Certified Recommerce & Transparent AI Pricing'}
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {lang === 'vi'
                  ? 'Bảo vệ tài chính qua Quỹ Tín Thác Escrow. Đã kiểm định hơn 10,000+ thiết bị điện tử.'
                  : 'Financial protection guaranteed via Escrow trust fund & certified hardware inspection.'}
              </p>
            </div>

            <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-[#EC1577] animate-pulse" />
                  {lang === 'vi' ? 'Bảo Vệ Tài Chính Escrow' : 'Escrow Money Guarantee'}
                </span>
                <span className="text-[10px] text-white bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded-md font-semibold">100% Active</span>
              </div>
              <p className="text-[11px] text-white/70 leading-normal">
                {lang === 'vi'
                  ? 'Người mua cọc tiền an toàn — Tiền chỉ giải ngân cho người bán khi hàng được kỹ sư Hub kiểm định thành công.'
                  : 'Funds securely deposited — Payout released to seller only after Hub engineer inspection.'}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shrink-0">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white">{lang === 'vi' ? 'Xác Thực Danh Tính 2 Lớp' : '2-Factor Identity Checks'}</div>
                  <div className="text-[10px] text-white/70">{lang === 'vi' ? 'Hạn chế tối đa rủi ro lừa đảo đồ cũ' : 'Prevents fraud in recommerce'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white">{lang === 'vi' ? 'Định Giá AI Siêu Tốc' : 'Instant AI Fair Valuation'}</div>
                  <div className="text-[10px] text-white/70">{lang === 'vi' ? 'Đánh giá khấu hao linh kiện theo thời gian real-time' : 'Real-time component market pricing'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
            <div className="flex items-center gap-1.5 truncate">
              <Award className="w-4 h-4 text-[#EC1577] shrink-0" />
              <span className="truncate">{lang === 'vi' ? 'Top 1 Sàn Đồ Cũ Kiểm Định 2026' : 'Top Certified Recommerce 2026'}</span>
            </div>
            <div className="flex items-center gap-1 text-white font-bold shrink-0">
              <Star className="w-3.5 h-3.5 fill-[#F1622A] text-[#F1622A]" />
              <span>4.9/5</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT INTERACTIVE FORM PANEL ================= */}
        <div className="col-span-1 md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#FFFFFF]">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 md:hidden">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#0E121B] leading-none">SecondLife</div>
                  <div className="text-[10px] text-[#0E121B]/70 font-medium">Safe Recommerce</div>
                </div>
              </div>

              {mode === 'forgot' ? (
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#EC1577] font-bold hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Quay lại Đăng Nhập' : 'Back to Login'}</span>
                </button>
              ) : (
                <div className="text-xs text-[#0E121B]/70 font-medium hidden md:block">
                  {mode === 'login'
                    ? (lang === 'vi' ? 'Chào mừng bạn quay lại!' : 'Welcome back!')
                    : (lang === 'vi' ? 'Tham gia hệ sinh thái SecondLife' : 'Join SecondLife Marketplace')}
                </div>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-400 hover:text-[#0E121B] hover:bg-[#F4F5F8] transition cursor-pointer ml-auto"
                title={lang === 'vi' ? 'Đóng' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {mode !== 'forgot' && (
              <div className="grid grid-cols-2 p-1.5 bg-[#F4F5F8] rounded-2xl text-xs font-semibold text-[#0E121B]/70 mb-4 border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('login');
                  }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer text-center font-bold ${mode === 'login'
                      ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-sm font-extrabold'
                      : 'text-[#0E121B]/70 hover:text-[#0E121B]'
                    }`}
                >
                  {lang === 'vi' ? 'Đăng Nhập' : 'Log In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('register');
                  }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer text-center font-bold ${mode === 'register'
                      ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-sm font-extrabold'
                      : 'text-[#0E121B]/70 hover:text-[#0E121B]'
                    }`}
                >
                  {lang === 'vi' ? 'Đăng Ký Thành Viên' : 'Register Account'}
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#0E121B] border border-[#EC1577] text-white text-xs flex items-start gap-2.5 animate-fadeIn">
              <span className="text-base shrink-0 leading-none">⚠️</span>
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* 1. FORGOT PASSWORD MODE */}
            {mode === 'forgot' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#0E121B]">
                    {lang === 'vi' ? 'Đặt Lại Mật Khẩu' : 'Reset Password'}
                  </h3>
                  <p className="text-xs text-[#0E121B]/70 leading-relaxed">
                    {lang === 'vi'
                      ? 'Nhập email liên kết với tài khoản SecondLife để nhận liên kết khôi phục an toàn.'
                      : 'Enter the email address associated with your SecondLife account to receive a reset link.'}
                  </p>
                </div>

                {resetSent ? (
                  <div className="p-4 rounded-2xl bg-[#F4F5F8] border border-gray-200 text-[#0E121B] space-y-3 text-xs animate-fadeIn">
                    <div className="flex items-center gap-2 font-bold text-[#0E121B] text-sm">
                      <CheckCircle2 className="w-5 h-5 text-[#EC1577] shrink-0" />
                      <span>{lang === 'vi' ? 'Đã gửi hướng dẫn khôi phục!' : 'Instructions sent!'}</span>
                    </div>
                    <p className="text-[#0E121B]/70 leading-relaxed">
                      {lang === 'vi'
                        ? `Chúng tôi đã gửi liên kết đặt lại mật khẩu đến email `
                        : `We sent a password reset link to `}
                      <strong className="text-[#0E121B]">{resetEmail}</strong>.
                      {lang === 'vi' ? ' Vui lòng kiểm tra hộp thư đến.' : ' Please check your email inbox.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="mt-2 w-full py-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold rounded-xl hover:opacity-90 transition cursor-pointer text-xs"
                    >
                      {lang === 'vi' ? 'Quay Lại Màn Hình Đăng Nhập' : 'Return to Login'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#0E121B]">
                        {lang === 'vi' ? 'Địa chỉ Email tài khoản' : 'Account Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="example@secondlife.vn"
                          className="w-full pl-10 pr-3 py-2.5 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Gửi Liên Kết Khôi Phục' : 'Send Reset Link'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 2. LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0E121B] flex items-center justify-between">
                    <span>{lang === 'vi' ? 'Email hoặc Số điện thoại' : 'Email or Phone'}</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      placeholder="khang.buyer@secondlife.vn"
                      className="w-full pl-10 pr-3 py-2.5 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mật khẩu' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setMode('forgot');
                      }}
                      className="text-[11px] font-bold text-[#EC1577] hover:underline cursor-pointer"
                    >
                      {lang === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <span>
                    {isLoading
                      ? (lang === 'vi' ? 'Đang xử lý...' : 'Logging in...')
                      : (lang === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Log In Account')}
                  </span>
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>
            )}

            {/* 3. REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0E121B]">
                    {lang === 'vi' ? 'Họ và tên của bạn' : 'Full Name'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-3 py-2 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="ban@email.com"
                        className="w-full pl-10 pr-3 py-2 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Số điện thoại' : 'Phone Number'}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="0912 345 678"
                        className="w-full pl-10 pr-3 py-2 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0E121B]">
                    {lang === 'vi' ? 'Chọn vai trò tài khoản' : 'Select Account Role'}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('buyer')}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${selectedRole === 'buyer'
                          ? 'bg-[#EC1577]/10 border-[#EC1577] text-[#0E121B] ring-1 ring-[#EC1577]'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B]/70 hover:bg-[#FFFFFF]'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${selectedRole === 'buyer' ? 'bg-[#EC1577] text-white' : 'bg-gray-200 text-[#0E121B]'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{lang === 'vi' ? 'Người Mua' : 'Buyer'}</div>
                          <div className="text-[10px] text-[#0E121B]/60">{lang === 'vi' ? 'Mua đồ kiểm định' : 'Shop certified'}</div>
                        </div>
                      </div>
                      {selectedRole === 'buyer' && <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRole('seller')}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${selectedRole === 'seller'
                          ? 'bg-[#EC1577]/10 border-[#EC1577] text-[#0E121B] ring-1 ring-[#EC1577]'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B]/70 hover:bg-[#FFFFFF]'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${selectedRole === 'seller' ? 'bg-[#EC1577] text-white' : 'bg-gray-200 text-[#0E121B]'}`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{lang === 'vi' ? 'Người Bán' : 'Seller'}</div>
                          <div className="text-[10px] text-[#0E121B]/60">{lang === 'vi' ? 'Đăng bán & nhận cọc' : 'List & payout'}</div>
                        </div>
                      </div>
                      {selectedRole === 'seller' && <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mật khẩu khởi tạo' : 'Password'}
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder={lang === 'vi' ? 'Tối thiểu 8 ký tự' : 'At least 8 characters'}
                      className="w-full pl-10 pr-10 py-2 bg-[#F4F5F8] rounded-xl border border-gray-200 text-xs sm:text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {registerPassword && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className={`h-1 rounded-full transition-all ${passStrength >= 1 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded-full transition-all ${passStrength >= 2 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded-full transition-all ${passStrength >= 3 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2.5 pt-1 text-[11px] text-[#0E121B]/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 bg-[#F4F5F8] text-[#EC1577] focus:ring-[#EC1577] cursor-pointer shrink-0"
                  />
                  <span className="leading-tight">
                    {lang === 'vi'
                      ? 'Tôi đồng ý với Quy chế hoạt động & Cam kết kiểm định Escrow của SecondLife.'
                      : 'I agree to SecondLife Terms of Service and Certified Escrow Guarantee.'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <span>
                    {isLoading
                      ? (lang === 'vi' ? 'Đang khởi tạo tài khoản...' : 'Creating account...')
                      : (lang === 'vi' ? 'Hoàn Tất Đăng Ký Tài Khoản' : 'Create Account Now')}
                  </span>
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>
            )}

            {/* DEMO QUICK ACCESS */}
            {mode !== 'forgot' && (
              <div className="space-y-3.5 pt-1">
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-[#FFFFFF] px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {lang === 'vi' ? 'Tài Khoản Mẫu Chấm Đồ Án (1-Click)' : 'Fast-Pass Demo Logins'}
                  </span>
                  <div className="border-t border-gray-200 w-full" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleDemoLogin(acc)}
                      className="p-2.5 rounded-2xl border border-gray-200 hover:border-[#EC1577] bg-[#F4F5F8] hover:bg-[#FFFFFF] text-left transition-all cursor-pointer flex items-center gap-2.5 group"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold bg-[#0E121B] text-[#EC1577]">
                        {acc.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#0E121B] group-hover:text-[#EC1577] truncate">
                          {acc.label}
                        </div>
                        <div className="text-[10px] text-[#0E121B]/60 truncate">{acc.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
