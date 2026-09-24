import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  RotateCcw,
  Check,
  Send,
  BadgeCheck
} from 'lucide-react';
import { UserRole, Language } from '../../types';
import { soundFx } from '../../utils/soundEffects';
import { authService } from '../../services/authService';
import { setAuthTokens } from '../../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'forgot';
  onClose: () => void;
  onLoginSuccess: (user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    address?: string;
  }) => void;
  lang: Language;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '473663185250-h6iu28cqthfjien8hup8ng91tih0ve5u.apps.googleusercontent.com';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onLoginSuccess,
  lang
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'verify-email'>(initialMode);

  // Form states - Login
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form states - Register
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Form states - Email Verification (/auth/verify-email & /auth/resend-verification)
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyOtpCode, setVerifyOtpCode] = useState('');
  const [verifyDigits, setVerifyDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(0);
  const verifyOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form states - Change Password / Forgot Password (/auth/forgot-password & /auth/reset-password)
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetOtpCountdown, setResetOtpCountdown] = useState(0);
  const [generatedResetOtp, setGeneratedResetOtp] = useState<string | null>(null);

  // Validation & Feedback States
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  // Countdowns for resend timers
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    let timer: any;
    if (resetOtpCountdown > 0) {
      timer = setTimeout(() => setResetOtpCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resetOtpCountdown]);

  // Validation regex helpers
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPhone = (phone: string) => /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(phone.trim().replace(/\s+/g, ''));
  const isValidEmailOrPhone = (input: string) => isValidEmail(input) || isValidPhone(input);
  const isValidFullName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return false;
    if (/\d/.test(trimmed)) return false;
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words.length >= 2;
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) || pass.length >= 12) score += 1;
    return score;
  };

  const passStrength = getPasswordStrength(registerPassword);
  const newPassStrength = getPasswordStrength(newPassword);

  // Login Field Errors
  const getLoginEmailError = () => {
    if (!emailOrPhone.trim()) return lang === 'vi' ? 'Vui lòng nhập địa chỉ Email.' : 'Please enter your email address.';
    if (!isValidEmail(emailOrPhone.trim())) return lang === 'vi' ? 'Email không đúng định dạng (Ví dụ: user@secondlife.vn).' : 'Invalid email format (e.g. user@secondlife.vn).';
    return null;
  };

  const getLoginPasswordError = () => {
    if (!password) return lang === 'vi' ? 'Vui lòng nhập mật khẩu.' : 'Please enter your password.';
    if (password.length < 6) return lang === 'vi' ? 'Mật khẩu phải có tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.';
    return null;
  };

  // Register Field Errors
  const getRegisterFullNameError = () => {
    if (!fullName.trim()) return lang === 'vi' ? 'Vui lòng nhập họ và tên của bạn.' : 'Please enter your full name.';
    if (!isValidFullName(fullName)) return lang === 'vi' ? 'Họ và tên cần ít nhất 2 từ và không chứa số (VD: Nguyễn Văn A).' : 'Name must contain at least 2 words without numbers.';
    return null;
  };

  const getRegisterEmailError = () => {
    if (!registerEmail.trim()) return lang === 'vi' ? 'Vui lòng nhập địa chỉ Email.' : 'Please enter your email address.';
    if (!isValidEmail(registerEmail)) return lang === 'vi' ? 'Email không đúng định dạng (Ví dụ: name@domain.com).' : 'Invalid email format (e.g. name@domain.com).';
    return null;
  };

  const getRegisterPhoneError = () => {
    if (!phoneNumber.trim()) return lang === 'vi' ? 'Vui lòng nhập số điện thoại.' : 'Please enter your phone number.';
    if (!isValidPhone(phoneNumber)) return lang === 'vi' ? 'Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).' : 'Invalid Vietnamese phone number (10 digits).';
    return null;
  };

  const getRegisterPasswordError = () => {
    if (!registerPassword) return lang === 'vi' ? 'Vui lòng nhập mật khẩu.' : 'Please enter a password.';
    if (registerPassword.length < 8) return lang === 'vi' ? 'Mật khẩu phải có tối thiểu 8 ký tự.' : 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(registerPassword) || !/[0-9]/.test(registerPassword)) {
      return lang === 'vi' ? 'Mật khẩu phải kết hợp cả chữ cái và chữ số.' : 'Password must contain both letters and numbers.';
    }
    return null;
  };

  const getConfirmPasswordError = () => {
    if (!confirmPassword) return lang === 'vi' ? 'Vui lòng nhập lại mật khẩu để xác nhận.' : 'Please confirm your password.';
    if (confirmPassword !== registerPassword) return lang === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.';
    return null;
  };

  const getAgreedTermsError = () => {
    if (!agreedTerms) return lang === 'vi' ? 'Bạn cần đồng ý với Quy chế hoạt động & Cam kết Escrow.' : 'You must accept the Terms & Escrow Guarantee.';
    return null;
  };

  // Verify Email Error
  const getVerifyOtpError = () => {
    if (!verifyOtpCode.trim()) return lang === 'vi' ? 'Vui lòng nhập mã OTP 6 chữ số gửi qua email.' : 'Please enter the 6-digit OTP code sent to your email.';
    if (!/^\d{6}$/.test(verifyOtpCode.trim())) return lang === 'vi' ? 'Mã OTP phải gồm đúng 6 chữ số.' : 'OTP code must be exactly 6 digits.';
    return null;
  };

  // Change Password Field Errors
  const getResetEmailError = () => {
    if (!resetEmail.trim()) return lang === 'vi' ? 'Vui lòng nhập địa chỉ Email tài khoản.' : 'Please enter your registered email.';
    if (!isValidEmail(resetEmail)) return lang === 'vi' ? 'Email không đúng định dạng (VD: user@secondlife.vn).' : 'Invalid email format.';
    return null;
  };

  const getOtpCodeError = () => {
    if (!otpCode.trim()) return lang === 'vi' ? 'Vui lòng nhập mã OTP xác thực (6 số).' : 'Please enter the 6-digit OTP code.';
    if (!/^\d{6}$/.test(otpCode.trim())) return lang === 'vi' ? 'Mã OTP phải gồm đúng 6 chữ số.' : 'OTP code must be exactly 6 digits.';
    return null;
  };

  const getNewPasswordError = () => {
    if (!newPassword) return lang === 'vi' ? 'Vui lòng nhập mật khẩu mới.' : 'Please enter a new password.';
    if (newPassword.length < 8) return lang === 'vi' ? 'Mật khẩu mới tối thiểu 8 ký tự.' : 'New password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return lang === 'vi' ? 'Mật khẩu mới phải gồm cả chữ cái và chữ số.' : 'Password must contain both letters and numbers.';
    }
    return null;
  };

  const getConfirmNewPasswordError = () => {
    if (!confirmNewPassword) return lang === 'vi' ? 'Vui lòng nhập lại mật khẩu mới để xác nhận.' : 'Please confirm your new password.';
    if (confirmNewPassword !== newPassword) return lang === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.';
    return null;
  };

  // Reset states on open or mode change
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setTouched({});
      setSubmitted(false);
      setIsLoading(false);
    }
  }, [isOpen, initialMode]);

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const mapBackendRole = (roles?: string[]): UserRole => {
    if (!roles || roles.length === 0) return 'buyer';
    if (roles.includes('ROLE_ADMIN') || roles.includes('ADMIN')) return 'admin';
    if (roles.includes('ROLE_INSPECTOR') || roles.includes('INSPECTOR') || roles.includes('HUB_INSPECTOR')) return 'inspector';
    if (roles.includes('ROLE_SELLER') || roles.includes('SELLER')) return 'seller';
    return 'buyer';
  };

  const isGoogleInitRef = useRef(false);
  const googleBtnLoginRef = useRef<HTMLDivElement | null>(null);
  const googleBtnRegisterRef = useRef<HTMLDivElement | null>(null);

  // Callback when Google Identity Services returns credential (ID Token)
  const handleGoogleCredentialResponse = async (response: any) => {
    const idToken = response?.credential;
    if (!idToken) {
      soundFx.playCancel();
      setErrorMsg(
        lang === 'vi'
          ? 'Không nhận được mã xác thực Google ID Token. Vui lòng thử lại.'
          : 'Google ID Token not found. Please try again.'
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await authService.googleLogin(idToken);
      soundFx.playChime();
      const mappedRole = mapBackendRole(res.roles);
      onLoginSuccess({
        id: res.user.id,
        name: res.user.fullName || res.user.email,
        email: res.user.email,
        role: mappedRole,
        phone: res.user.phone || '',
        address: ''
      });
      onClose();
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(
        err.message ||
          (lang === 'vi'
            ? 'Đăng nhập Google thất bại trên máy chủ Backend. Vui lòng thử lại.'
            : 'Google login failed on backend server.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize and render Google Identity Services button
  useEffect(() => {
    if (!isOpen) return;

    let timer: any;
    let retries = 0;
    const maxRetries = 25;

    const setupGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        if (retries < maxRetries) {
          retries++;
          timer = setTimeout(setupGoogle, 150);
        }
        return;
      }

      setIsGoogleReady(true);

      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const targetEl =
          mode === 'register'
            ? googleBtnRegisterRef.current || document.getElementById('googleSignInContainerRegister')
            : googleBtnLoginRef.current || document.getElementById('googleSignInContainerLogin');

        if (targetEl) {
          targetEl.innerHTML = '';
          google.accounts.id.renderButton(targetEl, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: mode === 'register' ? 'signup_with' : 'signin_with',
            logo_alignment: 'left',
            width: 340,
            locale: lang === 'vi' ? 'vi' : 'en',
          });
        }
      } catch (err) {
        console.warn('Google Identity button render error:', err);
      }
    };

    timer = setTimeout(setupGoogle, 100);
    return () => clearTimeout(timer);
  }, [isOpen, mode, lang]);

  // Submit handlers with validation
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailErr = getLoginEmailError();
    const passErr = getLoginPasswordError();

    if (emailErr || passErr) {
      soundFx.playCancel();
      setErrorMsg(lang === 'vi' ? 'Vui lòng kiểm tra và sửa các thông tin chưa hợp lệ bên dưới.' : 'Please correct the highlighted errors below.');
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
        role: mappedRole,
        phone: res.user.phone || '',
        address: ''
      });
      onClose();
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Đăng nhập không thành công. Sai email/SĐT hoặc mật khẩu.' : 'Login failed. Invalid credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const nameErr = getRegisterFullNameError();
    const emailErr = getRegisterEmailError();
    const phoneErr = getRegisterPhoneError();
    const passErr = getRegisterPasswordError();
    const confirmErr = getConfirmPasswordError();
    const termsErr = getAgreedTermsError();

    if (nameErr || emailErr || phoneErr || passErr || confirmErr || termsErr) {
      soundFx.playCancel();
      setErrorMsg(lang === 'vi' ? 'Vui lòng sửa các ô dữ liệu chưa đúng quy chuẩn bên dưới.' : 'Please correct the invalid fields below.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.register({
        email: registerEmail.trim(),
        password: registerPassword,
        fullName: fullName.trim(),
        phone: phoneNumber.trim() || undefined
      });
      soundFx.playChime();
      setVerifyEmailAddress(registerEmail.trim());
      setVerifyOtpCode('');
      setVerifyDigits(['', '', '', '', '', '']);
      setResendCountdown(60);
      setSubmitted(false);
      setTouched({});
      setMode('verify-email');
      setTimeout(() => {
        verifyOtpInputRefs.current[0]?.focus();
      }, 150);
      setSuccessMsg(
        lang === 'vi'
          ? `Tạo tài khoản thành công! Mã OTP xác thực 6 chữ số đã được gửi tới ${registerEmail.trim()}.`
          : `Account registered! Verification code sent to ${registerEmail.trim()}.`
      );
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Đăng ký không thành công. Email có thể đã được đăng ký trước đó.' : 'Registration failed. Email may already be registered.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Email Submit (/api/v1/auth/verify-email)
  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const otpErr = getVerifyOtpError();
    if (otpErr) {
      soundFx.playCancel();
      setErrorMsg(otpErr);
      return;
    }

    setIsLoading(true);
    try {
      await authService.verifyEmail({
        email: verifyEmailAddress,
        code: verifyOtpCode.trim()
      });
      soundFx.playChime();
      onLoginSuccess({
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
        name: fullName.trim() || 'Thành viên SecondLife',
        email: verifyEmailAddress,
        role: 'buyer',
        phone: phoneNumber.trim() || '',
        address: ''
      });
      onClose();
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Mã xác thực không hợp lệ hoặc đã hết hạn.' : 'Invalid or expired OTP code.'));
      return;
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Email OTP (/api/v1/auth/resend-verification)
  const handleResendEmailOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await authService.resendVerification(verifyEmailAddress);
      soundFx.playChime();
      setResendCountdown(60);
      setSuccessMsg(
        lang === 'vi'
          ? `Đã gửi lại mã xác thực mới tới ${verifyEmailAddress}!`
          : `New verification code resent to ${verifyEmailAddress}!`
      );
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Không thể gửi lại mã xác thực. Vui lòng thử lại sau.' : 'Failed to resend verification code.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password - Send OTP (/api/v1/auth/forgot-password)
  const handleSendOtp = async () => {
    markTouched('resetEmail');
    const emailErr = getResetEmailError();
    if (emailErr) {
      soundFx.playCancel();
      setErrorMsg(emailErr);
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      await authService.forgotPassword(resetEmail.trim());
      soundFx.playChime();
      setGeneratedResetOtp('889922');
      setResetOtpCountdown(60);
      setSuccessMsg(
        lang === 'vi'
          ? `Mã xác thực OTP đã được gửi tới email ${resetEmail.trim()}! (Mã thử nghiệm: 889922)`
          : `OTP verification code sent to ${resetEmail.trim()}! (Test code: 889922)`
      );
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Không tìm thấy tài khoản với email này.' : 'Account not found with this email.'));
      return;
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password - Reset Password Submit (/api/v1/auth/reset-password)
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailErr = getResetEmailError();
    const otpErr = getOtpCodeError();
    const passErr = getNewPasswordError();
    const confirmErr = getConfirmNewPasswordError();

    if (emailErr || otpErr || passErr || confirmErr) {
      soundFx.playCancel();
      setErrorMsg(lang === 'vi' ? 'Vui lòng điền đúng và đủ thông tin đổi mật khẩu bên dưới.' : 'Please correct the errors below.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword({
        email: resetEmail.trim(),
        code: otpCode.trim(),
        newPassword: newPassword
      });
      soundFx.playChime();
      setSuccessMsg(
        lang === 'vi'
          ? 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.'
          : 'Password changed successfully! You can now log in with your new password.'
      );
      setEmailOrPhone(resetEmail);
      setPassword('');
      setSubmitted(false);
      setTouched({});
      setTimeout(() => {
        setMode('login');
        setErrorMsg(null);
      }, 1500);
    } catch (err: any) {
      soundFx.playCancel();
      setErrorMsg(err.message || (lang === 'vi' ? 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mã OTP.' : 'Failed to reset password. Please check your OTP.'));
      return;
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
                  ? 'Bảo vệ tài chính qua Quỹ Tín Thác Escrow. Đã kiểm định hơn 10,000+ thiết bị điện máy gia dụng.'
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
                  ? 'Tiền mua hàng được phong tỏa an toàn trong quỹ tín thác. Người bán chỉ nhận thanh toán khi kỹ sư Hub duyệt ĐẠT và bạn hài lòng.'
                  : 'Funds locked in escrow until Hub engineers certify condition and buyer confirms satisfaction.'}
              </p>
            </div>
          </div>

          {/* Center Trust Micro-Badges */}
          <div className="relative z-10 space-y-2.5 my-6">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div className="w-8 h-8 rounded-lg bg-[#EC1577]/20 flex items-center justify-center text-[#EC1577] shrink-0 font-bold">
                ✓
              </div>
              <div>
                <div className="font-bold text-white">{lang === 'vi' ? 'Kiểm định 48 bước' : '48-point Hub Testing'}</div>
                <div className="text-[11px] text-white/60">{lang === 'vi' ? 'Kỹ sư chuyên trách dán tem NFC' : 'Engineers seal tamper-proof NFC'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div className="w-8 h-8 rounded-lg bg-[#F1622A]/20 flex items-center justify-center text-[#F1622A] shrink-0 font-bold">
                ★
              </div>
              <div>
                <div className="font-bold text-white">{lang === 'vi' ? 'AI Định Giá Chuẩn Xác' : 'Machine Learning Valuation'}</div>
                <div className="text-[11px] text-white/60">{lang === 'vi' ? 'Đối chiếu dữ liệu thị trường thực' : 'Calibrated on actual sales data'}</div>
              </div>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'vi' ? 'Bảo mật 256-bit SSL' : '256-bit SSL Secured'}</span>
            </div>
            <span>v1.0.0</span>
          </div>
        </div>

        {/* ================= RIGHT FORM PANEL ================= */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between relative bg-white">
          <div className="space-y-4">
            {/* Top Close & Mode Switcher */}
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-extrabold text-[#0E121B] tracking-tight">
                  {mode === 'login' && (lang === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Welcome Back')}
                  {mode === 'register' && (lang === 'vi' ? 'Đăng Ký Tài Khoản Mới' : 'Create New Account')}
                  {mode === 'forgot' && (lang === 'vi' ? 'Quên Mật Khẩu' : 'Forgot Password')}
                  {mode === 'verify-email' && (lang === 'vi' ? 'Xác Thực Địa Chỉ Email' : 'Verify Email Address')}
                </h3>
                <p className="text-xs text-[#0E121B]/70 mt-0.5">
                  {mode === 'login' && (lang === 'vi' ? 'Đăng nhập để giao dịch, định giá AI và xem đơn hàng' : 'Log in to trade, get AI valuation & manage orders')}
                  {mode === 'register' && (lang === 'vi' ? 'Trở thành thành viên bảo đảm trên sàn đồ cũ SecondLife' : 'Join verified second-hand recommerce community')}
                  {mode === 'forgot' && (lang === 'vi' ? 'Nhập email hoặc số điện thoại để nhận mã OTP khôi phục mật khẩu' : 'Enter email or phone to reset your password via OTP')}
                  {mode === 'verify-email' && (lang === 'vi' ? 'Nhập mã OTP 6 số để kích hoạt tài khoản của bạn' : 'Enter 6-digit OTP code to activate your account')}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-400 hover:text-[#0E121B] hover:bg-gray-100 transition cursor-pointer"
                title="Đóng modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2-Tab Mode Switcher: Đăng Nhập | Đăng Ký (Bỏ tab đổi mật khẩu tại trang đăng nhập) */}
            {mode === 'login' || mode === 'register' ? (
              <div className="grid grid-cols-2 p-1 bg-[#F4F5F8] rounded-2xl text-xs font-semibold text-[#0E121B]/70 border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setSubmitted(false);
                    setTouched({});
                    setMode('login');
                  }}
                  className={`py-2 rounded-xl transition-all cursor-pointer text-center font-bold ${
                    mode === 'login'
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
                    setSuccessMsg(null);
                    setSubmitted(false);
                    setTouched({});
                    setMode('register');
                  }}
                  className={`py-2 rounded-xl transition-all cursor-pointer text-center font-bold ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-sm font-extrabold'
                      : 'text-[#0E121B]/70 hover:text-[#0E121B]'
                  }`}
                >
                  {lang === 'vi' ? 'Đăng Ký' : 'Register'}
                </button>
              </div>
            ) : mode === 'forgot' ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50 border border-[#F1622A]/30 text-xs">
                <span className="font-bold text-[#F1622A] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Khôi Phục Mật Khẩu' : 'Reset Password'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('login');
                  }}
                  className="text-[11px] text-[#EC1577] hover:underline font-bold cursor-pointer"
                >
                  {lang === 'vi' ? '← Quay lại Đăng Nhập' : '← Back to Login'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50 border border-[#EC1577]/30 text-xs">
                <span className="font-bold text-[#EC1577] flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Bước 2: Xác thực tài khoản qua Email' : 'Step 2: Verify Email'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-[11px] text-gray-500 hover:text-[#0E121B] underline cursor-pointer"
                >
                  {lang === 'vi' ? 'Sửa email đăng ký' : 'Edit Email'}
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* ================= 1. LOGIN FORM ================= */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-3">
                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0E121B] flex items-center justify-between">
                    <span>{lang === 'vi' ? 'Địa chỉ Email' : 'Email Address'} <strong className="text-rose-500">*</strong></span>
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      (touched.emailOrPhone || submitted) && getLoginEmailError()
                        ? 'text-rose-500'
                        : emailOrPhone && !getLoginEmailError()
                        ? 'text-emerald-500'
                        : 'text-gray-400'
                    }`} />
                    <input
                      type="email"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      onBlur={() => markTouched('emailOrPhone')}
                      placeholder="user@secondlife.vn"
                      className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition ${
                        (touched.emailOrPhone || submitted) && getLoginEmailError()
                          ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                          : touched.emailOrPhone && !getLoginEmailError()
                          ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                      }`}
                    />
                    {touched.emailOrPhone && !getLoginEmailError() && (
                      <Check className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {(touched.emailOrPhone || submitted) && getLoginEmailError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getLoginEmailError()}</span>
                    </div>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mật khẩu' : 'Password'} <strong className="text-rose-500">*</strong>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setSubmitted(false);
                        setTouched({});
                        setResetEmail(emailOrPhone);
                        setMode('forgot');
                      }}
                      className="text-[11px] font-bold text-[#EC1577] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{lang === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      (touched.password || submitted) && getLoginPasswordError() ? 'text-rose-500' : 'text-gray-400'
                    }`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => markTouched('password')}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition ${
                        (touched.password || submitted) && getLoginPasswordError()
                          ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                          : touched.password && !getLoginPasswordError()
                          ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {(touched.password || submitted) && getLoginPasswordError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getLoginPasswordError()}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group mt-1"
                >
                  <span>
                    {isLoading
                      ? (lang === 'vi' ? 'Đang xác thực...' : 'Logging in...')
                      : (lang === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Log In Account')}
                  </span>
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>

                {/* Google Sign-In Button */}
                <div className="pt-1">
                  <div className="relative flex items-center justify-center mb-2">
                    <div className="border-t border-gray-200 w-full" />
                    <span className="bg-white px-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {lang === 'vi' ? 'Hoặc đăng nhập với' : 'Or continue with'}
                    </span>
                    <div className="border-t border-gray-200 w-full" />
                  </div>

                  <div className="w-full flex justify-center py-0.5">
                    <div
                      id="googleSignInContainerLogin"
                      ref={googleBtnLoginRef}
                      className="min-h-[44px] flex items-center justify-center"
                    />
                  </div>

                  {!isGoogleReady && (
                    <div className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 flex items-center justify-center gap-2">
                      <GoogleIcon />
                      <span>{lang === 'vi' ? 'Đang chuẩn bị Google Sign-In...' : 'Loading Google Sign-In...'}</span>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* ================= 2. REGISTER FORM ================= */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} noValidate className="space-y-2.5">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0E121B]">
                    {lang === 'vi' ? 'Họ và tên của bạn' : 'Full Name'} <strong className="text-rose-500">*</strong>
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      (touched.fullName || submitted) && getRegisterFullNameError() ? 'text-rose-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => markTouched('fullName')}
                      placeholder="Nguyễn Văn An"
                      className={`w-full pl-10 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                        (touched.fullName || submitted) && getRegisterFullNameError()
                          ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                          : touched.fullName && !getRegisterFullNameError()
                          ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                      }`}
                    />
                    {touched.fullName && !getRegisterFullNameError() && (
                      <Check className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {(touched.fullName || submitted) && getRegisterFullNameError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getRegisterFullNameError()}</span>
                    </div>
                  )}
                </div>

                {/* Email & Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">Email <strong className="text-rose-500">*</strong></label>
                    <div className="relative">
                      <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.registerEmail || submitted) && getRegisterEmailError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        onBlur={() => markTouched('registerEmail')}
                        placeholder="ban@gmail.com"
                        className={`w-full pl-10 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.registerEmail || submitted) && getRegisterEmailError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.registerEmail && !getRegisterEmailError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                    </div>
                    {(touched.registerEmail || submitted) && getRegisterEmailError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getRegisterEmailError()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Số điện thoại' : 'Phone'} <strong className="text-rose-500">*</strong>
                    </label>
                    <div className="relative">
                      <Phone className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.phoneNumber || submitted) && getRegisterPhoneError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        onBlur={() => markTouched('phoneNumber')}
                        placeholder="0912345678"
                        className={`w-full pl-10 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.phoneNumber || submitted) && getRegisterPhoneError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.phoneNumber && !getRegisterPhoneError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                    </div>
                    {(touched.phoneNumber || submitted) && getRegisterPhoneError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getRegisterPhoneError()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Password & Confirm Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mật khẩu' : 'Password'} <strong className="text-rose-500">*</strong>
                    </label>
                    <div className="relative">
                      <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.registerPassword || submitted) && getRegisterPasswordError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        onBlur={() => markTouched('registerPassword')}
                        placeholder={lang === 'vi' ? 'Tối thiểu 8 ký tự' : 'At least 8 chars'}
                        className={`w-full pl-10 pr-10 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.registerPassword || submitted) && getRegisterPasswordError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.registerPassword && !getRegisterPasswordError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
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
                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                        <div className={`h-1 rounded-full ${passStrength >= 1 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                        <div className={`h-1 rounded-full ${passStrength >= 2 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                        <div className={`h-1 rounded-full ${passStrength >= 3 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                      </div>
                    )}
                    {(touched.registerPassword || submitted) && getRegisterPasswordError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getRegisterPasswordError()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm Password'} <strong className="text-rose-500">*</strong>
                    </label>
                    <div className="relative">
                      <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.confirmPassword || submitted) && getConfirmPasswordError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => markTouched('confirmPassword')}
                        placeholder={lang === 'vi' ? 'Nhập lại mật khẩu' : 'Re-enter password'}
                        className={`w-full pl-10 pr-10 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.confirmPassword || submitted) && getConfirmPasswordError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.confirmPassword && !getConfirmPasswordError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {(touched.confirmPassword || submitted) && getConfirmPasswordError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getConfirmPasswordError()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agreed terms */}
                <div>
                  <label className="flex items-start gap-2 text-[11px] text-[#0E121B]/70 cursor-pointer select-none">
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
                  {(touched.agreedTerms || submitted) && getAgreedTermsError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getAgreedTermsError()}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group mt-1"
                >
                  <span>
                    {isLoading
                      ? (lang === 'vi' ? 'Đang khởi tạo tài khoản...' : 'Creating account...')
                      : (lang === 'vi' ? 'Hoàn Tất Đăng Ký Tài Khoản' : 'Create Account Now')}
                  </span>
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>

                {/* Google Sign-In on Register */}
                <div className="pt-0.5">
                  <div className="relative flex items-center justify-center mb-1.5">
                    <div className="border-t border-gray-200 w-full" />
                    <span className="bg-white px-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {lang === 'vi' ? 'Hoặc đăng ký nhanh với' : 'Or sign up with'}
                    </span>
                    <div className="border-t border-gray-200 w-full" />
                  </div>

                  <div className="w-full flex justify-center py-0.5">
                    <div
                      id="googleSignInContainerRegister"
                      ref={googleBtnRegisterRef}
                      className="min-h-[44px] flex items-center justify-center"
                    />
                  </div>

                  {!isGoogleReady && (
                    <div className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 flex items-center justify-center gap-2">
                      <GoogleIcon />
                      <span>{lang === 'vi' ? 'Đang chuẩn bị Google Sign-In...' : 'Loading Google Sign-In...'}</span>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* ================= 3. VERIFY EMAIL FORM (/auth/verify-email & /auth/resend-verification) ================= */}
            {mode === 'verify-email' && (
              <form onSubmit={handleVerifyEmailSubmit} noValidate className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-50 via-orange-50/40 to-pink-50 border border-pink-200 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center mx-auto shadow-md shadow-pink-500/20">
                    <Mail className="w-6 h-6 animate-pulse" />
                  </div>
                  <h4 className="font-extrabold text-[#0E121B] text-sm">
                    {lang === 'vi' ? 'Xác Thực Email Bằng Mã OTP' : 'Verify Email with 6-Digit OTP'}
                  </h4>
                  <p className="text-xs text-[#0E121B]/70 max-w-sm mx-auto leading-relaxed">
                    {lang === 'vi'
                      ? 'Hệ thống đã gửi mã OTP 6 chữ số đến địa chỉ email:'
                      : 'A 6-digit OTP verification code has been sent to:'}
                  </p>
                  <div className="inline-block px-3 py-1 rounded-full bg-white border border-pink-200 text-xs font-bold text-[#0E121B] shadow-xs">
                    {verifyEmailAddress}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Nhập mã OTP 6 chữ số' : '6-digit OTP Code'} <strong className="text-rose-500">*</strong>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const demoDigits = ['1', '2', '3', '4', '5', '6'];
                        setVerifyDigits(demoDigits);
                        setVerifyOtpCode('123456');
                        setErrorMsg(null);
                        verifyOtpInputRefs.current[5]?.focus();
                      }}
                      className="text-[11px] font-bold text-[#EC1577] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-[#F1622A]" />
                      <span>{lang === 'vi' ? 'Điền nhanh: 123456' : 'Fill demo: 123456'}</span>
                    </button>
                  </div>

                  {/* 6 Individual Numeric Boxes */}
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-1">
                    {verifyDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (verifyOtpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          setErrorMsg(null);
                          const cleanVal = e.target.value.replace(/\D/g, '');
                          const next = [...verifyDigits];
                          if (!cleanVal) {
                            next[idx] = '';
                            setVerifyDigits(next);
                            setVerifyOtpCode(next.join(''));
                            return;
                          }
                          next[idx] = cleanVal.slice(-1);
                          setVerifyDigits(next);
                          setVerifyOtpCode(next.join(''));
                          if (idx < 5) {
                            verifyOtpInputRefs.current[idx + 1]?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace') {
                            if (!verifyDigits[idx] && idx > 0) {
                              const next = [...verifyDigits];
                              next[idx - 1] = '';
                              setVerifyDigits(next);
                              setVerifyOtpCode(next.join(''));
                              verifyOtpInputRefs.current[idx - 1]?.focus();
                            }
                          } else if (e.key === 'ArrowLeft' && idx > 0) {
                            verifyOtpInputRefs.current[idx - 1]?.focus();
                          } else if (e.key === 'ArrowRight' && idx < 5) {
                            verifyOtpInputRefs.current[idx + 1]?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (!pasteData) return;
                          const next = [...verifyDigits];
                          for (let i = 0; i < 6; i++) {
                            next[i] = pasteData[i] || '';
                          }
                          setVerifyDigits(next);
                          setVerifyOtpCode(next.join(''));
                          setErrorMsg(null);
                          const nextFocusIndex = Math.min(pasteData.length, 5);
                          verifyOtpInputRefs.current[nextFocusIndex]?.focus();
                        }}
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-black rounded-xl border-2 transition-all outline-none shadow-xs ${
                          (touched.verifyOtp || submitted) && getVerifyOtpError()
                            ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-200'
                            : digit
                            ? 'border-[#EC1577] bg-white text-[#0E121B] shadow-md shadow-pink-500/10'
                            : 'border-gray-200 bg-gray-50/80 text-[#0E121B] hover:border-gray-300 focus:border-[#EC1577] focus:bg-white focus:ring-2 focus:ring-pink-200'
                        }`}
                      />
                    ))}
                  </div>

                  {(touched.verifyOtp || submitted) && getVerifyOtpError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getVerifyOtpError()}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={isLoading || verifyDigits.join('').length !== 6}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group"
                  >
                    <span>
                      {isLoading
                        ? (lang === 'vi' ? 'Đang xác thực email...' : 'Verifying email...')
                        : (lang === 'vi' ? 'Xác Thực & Kích Hoạt Tài Khoản' : 'Verify & Activate Account')}
                    </span>
                    {!isLoading && <BadgeCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#0E121B]/60">
                      {lang === 'vi' ? 'Chưa nhận được mã?' : 'Did not receive code?'}
                    </span>
                    <button
                      type="button"
                      onClick={handleResendEmailOtp}
                      disabled={isLoading || resendCountdown > 0}
                      className="font-bold text-[#EC1577] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>
                        {resendCountdown > 0
                          ? `${lang === 'vi' ? 'Gửi lại sau' : 'Resend in'} ${resendCountdown}s`
                          : (lang === 'vi' ? 'Gửi lại mã OTP' : 'Resend Code')}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ================= 4. CHANGE / RESET PASSWORD FORM (/auth/forgot-password & /auth/reset-password) ================= */}
            {mode === 'forgot' && (
              <form onSubmit={handleChangePasswordSubmit} noValidate className="space-y-3">
                {/* Email input with Send OTP button */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0E121B] flex items-center justify-between">
                    <span>{lang === 'vi' ? 'Địa chỉ Email tài khoản' : 'Registered Email Address'} <strong className="text-rose-500">*</strong></span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.resetEmail || submitted) && getResetEmailError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        onBlur={() => markTouched('resetEmail')}
                        placeholder="khang.buyer@secondlife.vn"
                        className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.resetEmail || submitted) && getResetEmailError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.resetEmail && !getResetEmailError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isLoading || resetOtpCountdown > 0}
                      className="px-3.5 py-2.5 bg-[#0E121B] hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition flex items-center gap-1.5 shrink-0"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#EC1577]" />
                      <span>
                        {resetOtpCountdown > 0 ? `${resetOtpCountdown}s` : (lang === 'vi' ? 'Gửi mã OTP' : 'Send OTP')}
                      </span>
                    </button>
                  </div>
                  {(touched.resetEmail || submitted) && getResetEmailError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getResetEmailError()}</span>
                    </div>
                  )}
                </div>

                {/* OTP Code with Quick-fill helper */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mã xác thực OTP (6 chữ số)' : '6-digit OTP Code'} <strong className="text-rose-500">*</strong>
                    </label>
                    {generatedResetOtp && (
                      <button
                        type="button"
                        onClick={() => {
                          setOtpCode(generatedResetOtp);
                          markTouched('otpCode');
                        }}
                        className="text-[11px] font-bold text-[#EC1577] hover:underline cursor-pointer"
                      >
                        ⚡ Nhập nhanh: {generatedResetOtp}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      (touched.otpCode || submitted) && getOtpCodeError() ? 'text-rose-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => markTouched('otpCode')}
                      placeholder="889922"
                      className={`w-full pl-10 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-mono font-bold tracking-widest transition ${
                        (touched.otpCode || submitted) && getOtpCodeError()
                          ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                          : touched.otpCode && !getOtpCodeError()
                          ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                          : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                      }`}
                    />
                    {touched.otpCode && !getOtpCodeError() && (
                      <Check className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {(touched.otpCode || submitted) && getOtpCodeError() && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{getOtpCodeError()}</span>
                    </div>
                  )}
                </div>

                {/* New Password & Confirm New Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mật khẩu mới' : 'New Password'} <strong className="text-rose-500">*</strong>
                    </label>
                    <div className="relative">
                      <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.newPassword || submitted) && getNewPasswordError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onBlur={() => markTouched('newPassword')}
                        placeholder={lang === 'vi' ? 'Tối thiểu 8 ký tự' : 'At least 8 chars'}
                        className={`w-full pl-10 pr-10 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.newPassword || submitted) && getNewPasswordError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.newPassword && !getNewPasswordError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                        <div className={`h-1 rounded-full ${newPassStrength >= 1 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                        <div className={`h-1 rounded-full ${newPassStrength >= 2 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                        <div className={`h-1 rounded-full ${newPassStrength >= 3 ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A]' : 'bg-gray-200'}`} />
                      </div>
                    )}
                    {(touched.newPassword || submitted) && getNewPasswordError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getNewPasswordError()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Nhập lại mật khẩu mới' : 'Confirm New Password'} <strong className="text-rose-500">*</strong>
                    </label>
                    <div className="relative">
                      <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        (touched.confirmNewPassword || submitted) && getConfirmNewPasswordError() ? 'text-rose-500' : 'text-gray-400'
                      }`} />
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onBlur={() => markTouched('confirmNewPassword')}
                        placeholder={lang === 'vi' ? 'Nhập lại mật khẩu' : 'Re-enter password'}
                        className={`w-full pl-10 pr-10 py-2 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          (touched.confirmNewPassword || submitted) && getConfirmNewPasswordError()
                            ? 'bg-rose-50/40 border-rose-500 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : touched.confirmNewPassword && !getConfirmNewPasswordError()
                            ? 'bg-[#FFFFFF] border-emerald-500/70 focus:outline-none focus:border-emerald-600'
                            : 'bg-[#F4F5F8] border-gray-200 text-[#0E121B] focus:outline-none focus:border-[#0E121B]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E121B] cursor-pointer p-1"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {(touched.confirmNewPassword || submitted) && getConfirmNewPasswordError() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>{getConfirmNewPasswordError()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 group"
                  >
                    <span>
                      {isLoading
                        ? (lang === 'vi' ? 'Đang cập nhật mật khẩu...' : 'Updating password...')
                        : (lang === 'vi' ? 'Xác Nhận Đổi Mật Khẩu' : 'Confirm Change Password')}
                    </span>
                    {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setMode('login');
                    }}
                    className="w-full py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-[#0E121B] hover:bg-gray-100 transition cursor-pointer text-center"
                  >
                    {lang === 'vi' ? '← Quay lại màn hình đăng nhập' : '← Return to Log In'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
