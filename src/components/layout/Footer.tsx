import React from 'react';
import {
  ShieldCheck,
  Lock,
  Truck,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { Language, UserRole } from '../../types';
import { PolicyTabKey } from '../modals/PolicyModal';
import logoImg from '../../assets/logo.png';

interface FooterProps {
  lang?: Language;
  currentRole?: UserRole | string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenProfile?: () => void;
  onOpenPolicy?: (policyKey: PolicyTabKey) => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang = 'vi',
  onOpenProfile,
  onOpenPolicy
}) => {
  const [copiedEmail, setCopiedEmail] = React.useState(false);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText('noreply.homeappliance@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <footer className="mt-auto bg-[#24263e] text-white text-xs border-t-2 border-white/10 shadow-2xl relative">
      {/* 1. Value Proposition Banner (Thanh Cam Kết Chất Lượng TMĐT) */}
      <div className="border-b border-white/10 bg-[#1b1c2d] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {/* Item 1 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#c34c36]/50 hover:bg-white/10 transition group shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#c34c36]/20 border border-[#c34c36]/40 flex items-center justify-center text-[#fce5da] shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-[#fce5da]" />
            </div>
            <div>
              <h5 className="font-extrabold text-white text-xs leading-snug">
                {lang === 'vi' ? '100% Kiểm Định Hub' : '100% Certified Labs'}
              </h5>
              <p className="text-[11px] text-white/70 mt-0.5 leading-tight font-medium">
                {lang === 'vi' ? '48 bước test kỹ thuật & dán tem NFC' : '48-point test & NFC seal'}
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 transition group shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
              <Lock className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h5 className="font-extrabold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Bảo Lãnh Escrow' : 'Escrow Protection'}
              </h5>
              <p className="text-[11px] text-white/70 mt-0.5 leading-tight font-medium">
                {lang === 'vi' ? 'Giữ tiền cọc, chỉ chi khi nhận hàng' : 'Funds held safely in escrow'}
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition group shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h5 className="font-extrabold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Giao Nhận Tận Nơi' : 'Nationwide Logistics'}
              </h5>
              <p className="text-[11px] text-white/70 mt-0.5 leading-tight font-medium">
                {lang === 'vi' ? 'Hợp tác GHN chuyên điện máy' : 'Dedicated appliance freight with GHN'}
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition group shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h5 className="font-extrabold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Định Giá AI Khách Quan' : 'AI Smart Valuation'}
              </h5>
              <p className="text-[11px] text-white/70 mt-0.5 leading-tight font-medium">
                {lang === 'vi' ? 'Mua đúng giá, bán không hớ' : 'Fair market pricing algorithm'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Directory Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Cột 1: Thông tin công ty & Hotline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="logo-badge bg-white p-1.5 rounded-xl shadow-xs border border-white/80 flex items-center justify-center shrink-0">
                <img
                  src={logoImg}
                  alt="SecondLife Logo"
                  className="h-9 sm:h-10 w-auto object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg text-white tracking-wide">
                    Second<span className="text-[#c34c36]">Life</span>
                  </span>
                  <span className="bg-[#c34c36] text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs tracking-wider">
                    VERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-white/70 font-medium">
                  {lang === 'vi'
                    ? 'Sàn thương mại điện tử đồ gia dụng cũ có kiểm định chất lượng phòng Lab Hub'
                    : 'Certified Recommerce Platform with Hub Lab Testing & Escrow Security'}
                </p>
              </div>
            </div>

            <p className="text-white/80 text-xs leading-relaxed">
              {lang === 'vi'
                ? 'SecondLife giải quyết triệt để nỗi lo tráo đồ, hỏng ngầm và lừa đảo tiền cọc khi mua bán tủ lạnh, máy giặt, máy lạnh, máy pha cà phê cũ thông qua cơ chế kiểm định phòng Lab và bảo lãnh tài chính Escrow.'
                : 'SecondLife eliminates the risks of component swapping, hidden defects, and deposit fraud when trading used home appliances and electronics through certified Lab Hub testing and Escrow payment protection.'}
            </p>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center gap-2 text-white/90">
                <Phone className="w-4 h-4 text-[#fce5da] shrink-0" />
                <span>
                  {lang === 'vi' ? 'Tổng đài tư vấn: ' : 'Hotline: '}
                  <strong className="text-white font-black text-sm">1900 8899</strong> <span className="text-white/70 font-medium">(8:00 - 21:00)</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-white/90">
                <Mail className="w-4 h-4 text-[#fce5da] shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white/90">{lang === 'vi' ? 'Email hỗ trợ: ' : 'Support Email: '}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold transition cursor-pointer group active:scale-95 shadow-xs"
                    title={lang === 'vi' ? 'Bấm để sao chép địa chỉ email' : 'Click to copy email address'}
                  >
                    <span>noreply.homeappliance@gmail.com</span>
                    {copiedEmail ? (
                      <span className="text-emerald-300 font-bold text-[10px] flex items-center gap-1 bg-emerald-500/25 px-1.5 py-0.5 rounded animate-fadeIn">
                        <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                        {lang === 'vi' ? 'Đã sao chép!' : 'Copied!'}
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-white/80">
                <MapPin className="w-4 h-4 text-[#fce5da] shrink-0 mt-0.5" />
                <span>
                  {lang === 'vi'
                    ? 'Địa chỉ: Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh.'
                    : 'Address: Lot E2a-7, D1 Street, High-Tech Park, Tang Nhon Phu Ward, Ho Chi Minh City.'}
                </span>
              </div>
            </div>
          </div>

          {/* Cột 2: Chăm Sóc Khách Hàng & Quy Chuẩn */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              {lang === 'vi' ? 'Chăm Sóc Khách Hàng' : 'Customer Service'}
            </h4>
            <ul className="space-y-2 text-xs text-white/75 font-medium">
              <li>
                <button onClick={() => onOpenPolicy?.('rules')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Trung tâm trợ giúp 24/7' : '24/7 Help Center'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenPolicy?.('terms')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Hướng dẫn mua cọc Escrow' : 'Escrow Buying Guide'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenProfile?.()} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Đăng ký bán hàng & gửi Hub' : 'Register to Sell & Hub Logistics'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenPolicy?.('lab')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Quy trình kiểm định 48 bước' : '48-Point Inspection Process'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenPolicy?.('lab')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Tra cứu tem niêm phong NFC' : 'NFC Security Seal Verification'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenPolicy?.('terms')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Chính sách đổi trả & hoàn tiền' : 'Return & Refund Policy'}</span>
                </button>
              </li>
              <li>
                <button onClick={() => onOpenPolicy?.('rules')} className="hover:text-[#fce5da] hover:underline transition flex items-center gap-1.5 text-left cursor-pointer">
                  <span>{lang === 'vi' ? 'Giải quyết tranh chấp Escrow' : 'Escrow Dispute Resolution'}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Cột 4: Về SecondLife & Thanh Toán */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2.5">
                {lang === 'vi' ? 'Về SecondLife' : 'About SecondLife'}
              </h4>
              <ul className="space-y-2 text-xs text-white/75 font-medium">
                <li>
                  <button onClick={() => onOpenPolicy?.('about')} className="hover:text-[#fce5da] hover:underline transition text-left cursor-pointer">
                    {lang === 'vi' ? 'Giới thiệu về SecondLife' : 'About SecondLife Platform'}
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPolicy?.('lab')} className="hover:text-[#fce5da] hover:underline transition text-left cursor-pointer">
                    {lang === 'vi' ? 'Hệ thống phòng Lab Hub' : 'Inspection Hub Labs System'}
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPolicy?.('rules')} className="hover:text-[#fce5da] hover:underline transition text-left cursor-pointer">
                    {lang === 'vi' ? 'Quy chế hoạt động sàn' : 'Operating Rules'}
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPolicy?.('terms')} className="hover:text-[#fce5da] hover:underline transition text-left cursor-pointer">
                    {lang === 'vi' ? 'Điều khoản dịch vụ' : 'Terms of Service'}
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPolicy?.('privacy')} className="hover:text-[#fce5da] hover:underline transition text-left cursor-pointer">
                    {lang === 'vi' ? 'Chính sách bảo mật dữ liệu' : 'Data Privacy Policy'}
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2">
                {lang === 'vi' ? 'Bảo Lãnh & Vận Chuyển' : 'Protection & Logistics'}
              </h4>
              <div className="flex flex-wrap gap-1">
                {['VietQR 247', 'Escrow Bank', 'GHN'].map((p) => (
                  <span key={p} className="p-1 rounded bg-white/10 text-[10px] font-bold text-white/80">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Legal & Copyright Bar */}
      <div className="border-t border-white/10 bg-[#1b1c2d] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left text-[11px] text-white/70">
          <div>
            <p className="font-extrabold text-white">
              {lang === 'vi'
                ? '© 2026 SecondLife - Hệ thống bán đồ cũ uy tín & kiểm định chất lượng.'
                : '© 2026 SecondLife - Certified Recommerce & Escrow Marketplace.'}
            </p>
            <p className="text-white/60 text-[11px] mt-0.5 font-medium">
              {lang === 'vi'
                ? 'Hệ thống bán đồ cũ thiết bị gia dụng và công nghệ, hỗ trợ kiểm định phòng Lab và bảo lãnh thanh toán an toàn.'
                : 'Certified marketplace for pre-owned home appliances and tech, verified by Hub Labs with Escrow guarantees.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-white/75 font-medium">
            <button onClick={() => onOpenPolicy?.('privacy')} className="hover:text-[#fce5da] hover:underline cursor-pointer transition">
              {lang === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}
            </button>
            <span>&bull;</span>
            <button onClick={() => onOpenPolicy?.('rules')} className="hover:text-[#fce5da] hover:underline cursor-pointer transition">
              {lang === 'vi' ? 'Quy chế hoạt động' : 'Operating Rules'}
            </button>
            <span>&bull;</span>
            <button onClick={() => onOpenPolicy?.('terms')} className="hover:text-[#fce5da] hover:underline cursor-pointer transition">
              {lang === 'vi' ? 'Điều khoản dịch vụ' : 'Terms of Service'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
