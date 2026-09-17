import React, { useState } from 'react';
import { X, ShieldCheck, Mail, Lock, User, Phone, CheckCircle2, ArrowRight, Sparkles, Building2, UserCheck, ShieldAlert } from 'lucide-react';
import { UserRole, Language } from '../types';
import { soundFx } from '../utils/soundEffects';

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
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1-Click Demo Accounts for project evaluation
  const demoAccounts: Array<{ label: string; role: UserRole; name: string; email: string; desc: string }> = [
    { label: 'Người Mua (Buyer)', role: 'buyer', name: 'Hoàng Quốc Khang', email: 'khang.buyer@secondlife.vn', desc: 'Tài khoản người mua tìm kiếm, đàm phán và cọc Escrow' },
    { label: 'Người Bán (Seller)', role: 'seller', name: 'Nguyễn Minh Tuấn', email: 'tuan.seller@secondlife.vn', desc: 'Người bán uy tín có sản phẩm niêm yết trên sàn' },
    { label: 'Kỹ Sư Hub (Inspector)', role: 'inspector', name: 'KTV Trưởng Hải Đăng', email: 'haidang.hub@secondlife.vn', desc: 'Chuyên gia nghiệm thu bo mạch tại SecondLife Hub' },
    { label: 'Quản Trị (Admin)', role: 'admin', name: 'Admin Điều Hành', email: 'admin@secondlife.vn', desc: 'Trọng tài phân xử khiếu nại Escrow toàn hệ thống' }
  ];

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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailOrPhone.trim() || !password.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập đầy đủ email/SĐT và mật khẩu.' : 'Please enter email/phone and password.');
      return;
    }

    soundFx.playChime();
    onLoginSuccess({
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      name: emailOrPhone.split('@')[0] || 'Người Dùng',
      email: emailOrPhone.includes('@') ? emailOrPhone : `${emailOrPhone}@user.secondlife.vn`,
      role: selectedRole
    });
    onClose();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng điền đầy đủ thông tin bắt buộc.' : 'Please fill all required fields.');
      return;
    }
    if (!agreedTerms) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng đồng ý với điều khoản sử dụng & cam kết Escrow.' : 'Please accept the terms of service.');
      return;
    }

    soundFx.playChime();
    onLoginSuccess({
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      name: fullName,
      email: registerEmail,
      role: selectedRole
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-xl border border-stone-200/90 flex flex-col my-auto relative">
        {/* Header with Close */}
        <div className="px-6 pt-5 pb-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1B4D3E] text-white flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 leading-tight">
                {mode === 'login'
                  ? (lang === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Account Login')
                  : (lang === 'vi' ? 'Đăng Ký Thành Viên Mới' : 'Create an Account')}
              </h3>
              <p className="text-[11px] text-stone-500">SecondLife Vietnam • Safe Recommerce</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl text-xs font-semibold text-stone-600">
            <button
              onClick={() => {
                setErrorMsg(null);
                setMode('login');
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {lang === 'vi' ? 'Đăng Nhập' : 'Login'}
            </button>
            <button
              onClick={() => {
                setErrorMsg(null);
                setMode('register');
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {lang === 'vi' ? 'Đăng Ký' : 'Register'}
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {mode === 'login' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  {lang === 'vi' ? 'Email hoặc Số điện thoại' : 'Email or Phone'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="khang.buyer@secondlife.vn"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700">
                    {lang === 'vi' ? 'Mật khẩu' : 'Password'}
                  </label>
                  <a href="#" className="text-[11px] text-emerald-800 hover:underline">
                    {lang === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                  />
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#1B4D3E] hover:bg-[#153e32] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đăng Nhập Ngay' : 'Log In'}
              </button>

              {/* Quick 1-Click Demo Section */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <div className="text-[11px] font-semibold text-stone-500 flex items-center justify-between">
                  <span>⚡ {lang === 'vi' ? 'Đăng nhập nhanh tài khoản mẫu (Demo)' : 'Quick Demo Logins'}</span>
                  <span className="text-[10px] bg-stone-100 px-1.5 py-0.2 rounded text-stone-600">Đồ án CAPSTONE</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleDemoLogin(acc)}
                      className="p-2.5 rounded-xl border border-stone-200 hover:border-[#1B4D3E]/60 hover:bg-emerald-50/40 text-left transition cursor-pointer space-y-0.5"
                    >
                      <div className="text-xs font-semibold text-stone-900 flex items-center gap-1">
                        {acc.role === 'buyer' && <User className="w-3 h-3 text-emerald-700" />}
                        {acc.role === 'seller' && <Sparkles className="w-3 h-3 text-teal-700" />}
                        {acc.role === 'inspector' && <Building2 className="w-3 h-3 text-blue-700" />}
                        {acc.role === 'admin' && <ShieldAlert className="w-3 h-3 text-purple-700" />}
                        <span>{acc.label}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 truncate">{acc.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  {lang === 'vi' ? 'Họ và tên của bạn' : 'Full Name'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="ban@email.com"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">
                    {lang === 'vi' ? 'Số điện thoại' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  {lang === 'vi' ? 'Vai trò đăng ký chính' : 'Primary Account Role'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('buyer')}
                    className={`p-2 rounded-xl border text-xs font-medium text-center transition cursor-pointer ${
                      selectedRole === 'buyer'
                        ? 'bg-emerald-50 border-[#1B4D3E] text-emerald-950 font-semibold'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    {lang === 'vi' ? 'Người Mua Hàng' : 'Buyer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('seller')}
                    className={`p-2 rounded-xl border text-xs font-medium text-center transition cursor-pointer ${
                      selectedRole === 'seller'
                        ? 'bg-emerald-50 border-[#1B4D3E] text-emerald-950 font-semibold'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    {lang === 'vi' ? 'Người Bán Hàng' : 'Seller'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  {lang === 'vi' ? 'Mật khẩu khởi tạo' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E]"
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-start gap-2 pt-1 text-[11px] text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-[#1B4D3E] focus:ring-[#1B4D3E]"
                />
                <span>
                  {lang === 'vi'
                    ? 'Tôi đồng ý với Quy chế hoạt động & Cam kết kiểm định Escrow của SecondLife.'
                    : 'I agree to SecondLife Terms of Service and Escrow Guarantee.'}
                </span>
              </label>

              {/* Register Submit */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#1B4D3E] hover:bg-[#153e32] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hoàn Tất Đăng Ký' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
