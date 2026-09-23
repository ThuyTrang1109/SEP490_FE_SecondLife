import React from 'react';
import {
  ShieldCheck,
  Lock,
  Truck,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle2,
  CreditCard,
  Building,
  Smartphone,
  HelpCircle,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { Language } from '../../types';

interface FooterProps {
  lang?: Language;
  onTabChange?: (tab: string) => void;
  onOpenProfile?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang = 'vi',
  onTabChange,
  onOpenProfile
}) => {
  return (
    <footer className="mt-auto bg-[#0A0D14] text-slate-300 text-xs border-t-2 border-[#EC1577]/30 shadow-2xl relative">
      {/* 1. Value Proposition Banner (Thanh Cam Kết Chất Lượng TMĐT) */}
      <div className="border-b border-white/10 bg-[#0E121B]/90 backdrop-blur-md py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {/* Item 1 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[#EC1577]/30 transition group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC1577]/20 to-[#F1622A]/20 border border-[#EC1577]/40 flex items-center justify-center text-[#EC1577] shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-[#EC1577]" />
            </div>
            <div>
              <h5 className="font-bold text-white text-xs leading-snug">
                {lang === 'vi' ? '100% Kiểm Định Hub' : '100% Certified Labs'}
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                {lang === 'vi' ? '48 bước test kỹ thuật & dán tem NFC' : '48-point test & NFC seal'}
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Bảo Lãnh Escrow' : 'Escrow Protection'}
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                {lang === 'vi' ? 'Giữ tiền cọc, chỉ chi khi nhận hàng' : 'Funds held safely in escrow'}
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 transition group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Giao Nhận Tận Nơi' : 'Nationwide Logistics'}
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                {lang === 'vi' ? 'Hợp tác GHTK, GHN chuyên điện máy' : 'Dedicated appliance freight'}
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/30 transition group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-white text-xs leading-snug">
                {lang === 'vi' ? 'Định Giá AI Khách Quan' : 'AI Smart Valuation'}
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                {lang === 'vi' ? 'Mua đúng giá, bán không hớ' : 'Fair market pricing algorithm'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Directory Links (5 Columns) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Cột 1: Thông tin công ty & Hotline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="SecondLife Logo"
                className="h-10 w-auto object-contain rounded-xl bg-white p-1 shadow-md shadow-black/20"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg text-white tracking-wide">SecondLife</span>
                  <span className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-[9px] font-black px-1.5 py-0.2 rounded border border-white/20">
                    VERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {lang === 'vi'
                    ? 'Sàn thương mại điện tử đồ gia dụng cũ có kiểm định chất lượng phòng Lab Hub'
                    : 'Certified Recommerce Platform with Hub Lab Testing & Escrow Security'}
                </p>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              {lang === 'vi'
                ? 'SecondLife giải quyết triệt để nỗi lo tráo đồ, hỏng ngầm và lừa đảo tiền cọc khi mua bán tủ lạnh, máy giặt, máy lạnh, máy pha cà phê cũ thông qua cơ chế kiểm định phòng Lab và bảo lãnh tài chính Escrow.'
                : 'SecondLife eliminates the risks of component swapping, hidden defects, and deposit fraud when trading used home appliances and electronics through certified Lab Hub testing and Escrow payment protection.'}
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-[#EC1577] shrink-0" />
                <span>
                  {lang === 'vi' ? 'Tổng đài tư vấn: ' : 'Hotline: '}
                  <strong className="text-white font-bold text-sm">1900 8899</strong> (8:00 - 21:00)
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-[#EC1577] shrink-0" />
                <span>
                  {lang === 'vi' ? 'Email hỗ trợ: ' : 'Support Email: '}
                  <strong className="text-white font-medium">hotro@secondlife.vn</strong>
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-[#EC1577] shrink-0 mt-0.5" />
                <span>
                  {lang === 'vi'
                    ? 'Địa chỉ: 92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, TP. Đà Nẵng'
                    : 'Headquarters: 92 Phan Chau Trinh, Phuoc Ninh, Hai Chau, Da Nang City'}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-400 text-[11px]">
                <Building className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'vi' ? (
                    <>Mạng lưới Hub kiểm định: <strong>Hà Nội</strong> (Cầu Giấy) &bull; <strong>Đà Nẵng</strong> (Hải Châu) &bull; <strong>TP. Hồ Chí Minh</strong> (Quận 10)</>
                  ) : (
                    <>Inspection Hub Network: <strong>Hanoi</strong> (Cau Giay) &bull; <strong>Da Nang</strong> (Hai Chau) &bull; <strong>Ho Chi Minh City</strong> (District 10)</>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Cột 2: Chăm sóc khách hàng */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {lang === 'vi' ? 'Chăm Sóc Khách Hàng' : 'Customer Service'}
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#help" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Trung tâm trợ giúp 24/7' : '24/7 Help Center'}</span>
                </a>
              </li>
              <li>
                <a href="#escrow-guide" onClick={(e) => { e.preventDefault(); onTabChange?.('orders'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Hướng dẫn mua cọc Escrow' : 'Escrow Buying Guide'}</span>
                </a>
              </li>
              <li>
                <a href="#seller-guide" onClick={(e) => { e.preventDefault(); onOpenProfile?.(); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Đăng ký bán hàng & gửi Hub' : 'Register to Sell & Hub Logistics'}</span>
                </a>
              </li>
              <li>
                <a href="#inspection-process" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Quy trình kiểm định 48 bước' : '48-Point Inspection Process'}</span>
                </a>
              </li>
              <li>
                <a href="#nfc-lookup" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Tra cứu tem niêm phong NFC' : 'NFC Security Seal Verification'}</span>
                </a>
              </li>
              <li>
                <a href="#return-policy" onClick={(e) => { e.preventDefault(); onTabChange?.('orders'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Chính sách đổi trả & hoàn tiền' : 'Return & Refund Policy'}</span>
                </a>
              </li>
              <li>
                <a href="#dispute" onClick={(e) => { e.preventDefault(); onTabChange?.('orders'); }} className="hover:text-white transition flex items-center gap-1.5">
                  <span>{lang === 'vi' ? 'Giải quyết tranh chấp Escrow' : 'Escrow Dispute Resolution'}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Cột 3: Về SecondLife */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {lang === 'vi' ? 'Về SecondLife' : 'About SecondLife'}
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#about" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Giới thiệu về SecondLife' : 'About SecondLife Platform'}
                </a>
              </li>
              <li>
                <a href="#hubs" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Hệ thống phòng Lab Hub' : 'Inspection Hub Labs System'}
                </a>
              </li>
              <li>
                <a href="#grades" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Quy chuẩn phân hạng Grade S/A/B' : 'Grade S/A/B Quality Standards'}
                </a>
              </li>
              <li>
                <a href="#careers" onClick={(e) => { e.preventDefault(); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Tuyển dụng Kỹ sư giám định Hub' : 'Careers & Inspector Opportunities'}
                </a>
              </li>
              <li>
                <a href="#terms" onClick={(e) => { e.preventDefault(); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Điều khoản & Quy chế hoạt động' : 'Terms of Service & Rules'}
                </a>
              </li>
              <li>
                <a href="#privacy" onClick={(e) => { e.preventDefault(); }} className="hover:text-white transition">
                  {lang === 'vi' ? 'Chính sách bảo mật dữ liệu' : 'Data Privacy Policy'}
                </a>
              </li>
            </ul>
          </div>

          {/* Cột 4: Phương Thức Thanh Toán & Vận Chuyển */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                {lang === 'vi' ? 'Thanh Toán Qua Escrow' : 'Secure Escrow Payment'}
              </h4>
              <div className="grid grid-cols-3 gap-1.5">
                {['VietQR', 'Vietcombank', 'Techcombank', 'MB Bank', 'Visa/Master', 'Ví MoMo'].map((pay) => (
                  <span
                    key={pay}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-center font-bold text-slate-200"
                  >
                    {pay}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                {lang === 'vi' ? 'Đối Tác Vận Chuyển Hub' : 'Logistics Partners'}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {['GHTK Express', 'Giao Hàng Nhanh', 'Viettel Post', 'Hub Logistic'].map((ship) => (
                  <span
                    key={ship}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-center font-bold text-slate-200"
                  >
                    {ship}
                  </span>
                ))}
              </div>
            </div>

            {/* Chứng nhận TMĐT & Tem bảo chứng */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                {lang === 'vi' ? 'Chứng Nhận & Bảo Mật' : 'Certifications & Security'}
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-[#EC1577] text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3 text-[#EC1577]" />
                  {lang === 'vi' ? 'Hệ Thống Bán Đồ Cũ Kiểm Định' : 'Certified Recommerce System'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  PCI-DSS & SSL 256-bit
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Legal & Copyright Bar */}
      <div className="border-t border-white/10 bg-[#07090E] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left text-[11px] text-slate-400">
          <div>
            <p className="font-bold text-slate-300">
              {lang === 'vi'
                ? '© 2026 SecondLife - Hệ thống bán đồ cũ uy tín & kiểm định chất lượng.'
                : '© 2026 SecondLife - Certified Recommerce & Escrow Marketplace.'}
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {lang === 'vi'
                ? 'Hệ thống bán đồ cũ thiết bị gia dụng và công nghệ, hỗ trợ kiểm định phòng Lab và bảo lãnh thanh toán an toàn.'
                : 'Certified marketplace for pre-owned home appliances and tech, verified by Hub Labs with Escrow guarantees.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <span className="hover:text-white cursor-pointer transition">
              {lang === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}
            </span>
            <span>&bull;</span>
            <span className="hover:text-white cursor-pointer transition">
              {lang === 'vi' ? 'Quy chế hoạt động' : 'Terms of Service'}
            </span>
            <span>&bull;</span>
            <span className="hover:text-white cursor-pointer transition">
              {lang === 'vi' ? 'Bảo lãnh Escrow' : 'Escrow Protection'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
