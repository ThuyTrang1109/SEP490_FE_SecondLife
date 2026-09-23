import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Building2,
  Lock,
  Box,
  CheckCircle2,
  Cpu,
  Award,
  RefreshCw,
  Move3d
} from 'lucide-react';
import { Language, UserRole } from '../types';
import { CountUp } from '../components/react-bits/CountUp';
import { soundFx } from '../utils/soundEffects';
import { Appliance3DViewer } from '../components/3d/Appliance3DViewer';

interface HomePageViewProps {
  lang: Language;
  onExploreMarketplace: () => void;
  onCreateListing: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  currentUser?: { id: string; name: string; email: string; role: UserRole } | null;
}

export const HomePageView: React.FC<HomePageViewProps> = ({
  lang,
  onExploreMarketplace,
  onCreateListing,
  onOpenAuth,
  currentUser
}) => {
  const [heroAppliance, setHeroAppliance] = useState<'fridge' | 'washer'>('fridge');
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 text-[#0E121B]">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-[#090d14] text-white p-6 sm:p-8 lg:p-10 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#EC1577]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#F1622A]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Model Controls */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="SecondLife Logo"
              className="h-10 sm:h-12 w-auto object-contain bg-white p-1.5 rounded-xl shadow-md border border-white/20"
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-slate-300 text-xs font-medium backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-[#EC1577]" />
              <span className="text-white">{lang === 'vi' ? 'Sàn Thương Mại Đồ Cũ Thế Hệ Mới • Đạt Chuẩn Kiểm Định' : 'Next-Gen Certified Recommerce Platform'}</span>
            </div>
          </div>

          {/* Model Switcher & 360 Auto-Rotate Toggle */}
          <div className="flex items-center gap-1.5 bg-[#0E121B]/90 backdrop-blur-md p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => {
                soundFx.playChime();
                setHeroAppliance('fridge');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                heroAppliance === 'fridge'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'vi' ? 'Tủ Lạnh Hitachi' : 'Hitachi Fridge'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setHeroAppliance('washer');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                heroAppliance === 'washer'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'vi' ? 'Máy Giặt Electrolux' : 'Electrolux Washer'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setAutoRotate((prev) => !prev);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                autoRotate ? 'text-[#EC1577] font-semibold bg-white/5' : 'text-slate-400 hover:text-white'
              }`}
              title="Bật / tắt tự động xoay 360°"
            >
              <RefreshCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span>360°</span>
            </button>
          </div>
        </div>

        {/* 3-Column Studio Display: Left Text | Center 3D Appliance | Right Hub Verified Card */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 pt-4">
          {/* 1. Cột chữ bên trái */}
          <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0 space-y-3.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
              {lang === 'vi' ? (
                <>
                  Mua Bán Đồ Cũ <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#EC1577] to-[#F1622A]">
                    AI Định Giá & Kiểm Định Thật.
                  </span>
                </>
              ) : (
                <>
                  Trade Second-Hand <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#EC1577] to-[#F1622A]">
                    With AI Valuation & Certified Hardware.
                  </span>
                </>
              )}
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-normal">
              {lang === 'vi'
                ? 'Xóa bỏ hoàn toàn nỗi lo mua phải hàng dựng, hàng nhái, tráo linh kiện hoặc lừa cọc. SecondLife bảo vệ người mua & người bán bằng mô hình AI định giá chuẩn, kiểm định trực tiếp tại Hub và giữ tiền an toàn qua Quỹ tín thác Escrow.'
                : 'Eliminate counterfeit and scam risks with calibrated AI valuation, physical hardware inspection hubs, and buyer-seller protection via Escrow.'}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => {
                  soundFx.playChime();
                  onExploreMarketplace();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Khám Phá Sàn Sản Phẩm' : 'Explore Marketplace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  soundFx.playChime();
                  onCreateListing();
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm border border-white/20 backdrop-blur-md transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#EC1577]" />
                <span>{lang === 'vi' ? 'Thử Định Giá & Đăng Bán' : 'AI Valuation & Sell'}</span>
              </button>

              {!currentUser && (
                <button
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-slate-300 hover:text-white font-medium text-xs sm:text-sm transition cursor-pointer"
                >
                  <span>{lang === 'vi' ? 'Đăng ký' : 'Sign Up'}</span>
                  <span>&rarr;</span>
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-lg sm:text-xl font-bold text-[#EC1577]">
                  {lang === 'vi' ? 'Bảo Đảm' : 'Protected'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Cơ chế Escrow' : 'Escrow Protection'}
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">
                  <CountUp to={3} duration={1} />
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Trung tâm Hub' : 'Flagship Hubs'}
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">
                  &lt; <CountUp to={3} duration={1.5} />%
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Sai số giá AI' : 'AI Deviation'}
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">
                  <CountUp to={24} duration={1.2} />h
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Kiểm định Hub' : 'Inspection Time'}
                </div>
              </div>
            </div>
          </div>

          {/* 2. CHÍNH LÀ CHỖ NÀY: Khoảng trống ở giữa nhúng Appliance3DViewer */}
          <div className="flex-1 w-full h-[360px] sm:h-[430px] mx-0 lg:mx-4 relative flex items-center justify-center z-10">
            <Appliance3DViewer type={heroAppliance} autoRotate={autoRotate} />
          </div>

          {/* 3. Thẻ thông tin SecondLife Hub bên phải */}
          <div className="w-full sm:w-auto lg:w-[260px] shrink-0 z-10 flex flex-col gap-3">
            <div className="bg-[#0B0E15]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-2.5 w-full text-xs shadow-xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#EC1577]" />
                  <span>SecondLife Hub</span>
                </span>
                <span className="text-[10px] bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white px-1.5 py-0.5 rounded font-bold">VERIFIED</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Thiết bị:</span>
                  <span className="text-slate-200 font-medium">
                    {heroAppliance === 'fridge' ? 'Tủ Lạnh Hitachi 540L' : 'Máy Giặt Electrolux 10kg'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tình trạng:</span>
                  <span className="text-white font-medium">
                    {heroAppliance === 'fridge' ? 'Như mới (99%)' : 'Nguyên bản (98%)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{heroAppliance === 'fridge' ? 'Máy nén/Gas:' : 'Động cơ/Lồng:'}</span>
                  <span className="text-slate-200 font-medium">
                    {heroAppliance === 'fridge' ? 'Gas R600a (-19°C)' : 'EcoInverter (1400 RPM)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tem niêm phong:</span>
                  <span className="text-slate-200 font-medium">
                    {heroAppliance === 'fridge' ? '#SL-HOME-8839' : '#SL-WASH-9912'}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-slate-400">AI Định Giá:</span>
                <span className="text-white font-bold font-mono">
                  {heroAppliance === 'fridge' ? '14.800.000đ' : '7.950.000đ'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs">
              <Move3d className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>{lang === 'vi' ? 'Kéo chuột xoay 360° • Cuộn zoom' : 'Drag 360° • Scroll to zoom'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FOUR CORE PILLARS OF SECONDLIFE */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFFFFF] text-[#0E121B] text-xs font-semibold border border-slate-200 shadow-xs">
            <Award className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>{lang === 'vi' ? 'Nền Tảng Công Nghệ Đột Phá' : 'Breakthrough Architecture'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0E121B] tracking-tight">
            {lang === 'vi' ? '4 Trụ Cột Xây Dựng Niềm Tin Tuyệt Đối' : '4 Pillars of Absolute Trust'}
          </h2>
          <p className="text-xs sm:text-sm text-[#0E121B]/70">
            {lang === 'vi'
              ? 'Giải quyết triệt để 3 vấn đề lớn nhất của thị trường đồ cũ: Mù mờ về giá, gian lận linh kiện và rủi ro chuyển khoản bùng cọc.'
              : 'Solving price ambiguity, component swapping, and fraudulent non-delivery.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#0E121B] text-base">
              {lang === 'vi' ? '1. AI Price Estimation' : 'AI Price Valuation'}
            </h3>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Mô hình Machine Learning (LightGBM) đối chiếu hàng ngàn giao dịch thực tế trên thị trường Việt Nam kết hợp số năm sử dụng và tình trạng hao mòn để đưa ra mức giá công bằng nhất.'
                : 'Machine Learning algorithms calibrate with verified transactions to provide an objective, real-time market fair price.'}
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#0E121B] text-base">
              {lang === 'vi' ? '2. Verify Then Ship Hub' : 'Physical Inspection Hubs'}
            </h3>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Hàng hóa gửi qua Trung tâm giám định SecondLife Home Hub tại Hà Nội, Đà Nẵng, TP.HCM. Kỹ sư chuyên môn đo áp suất gas, kiểm tra máy nén/bơm xả, kiểm thử lồng giặt/bo mạch và dán tem niêm phong NFC chống tráo.'
                : 'Hardware engineers thoroughly inspect compressor, gas pressure, washer drum, and control circuit before sealing with tamper-proof NFC tags.'}
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#0E121B] text-base">
              {lang === 'vi' ? '3. Quỹ Tín Thác Escrow' : 'Escrow Fund Protection'}
            </h3>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Tiền mua hàng được giữ an toàn trong quỹ tín thác của hệ thống. Người bán không nhận tiền trước; chỉ giải ngân sau khi kiểm định viên duyệt ĐẠT và người mua đồng ý nhận hàng.'
                : 'Buyer payment is locked safely in Escrow. Funds are released only after inspection passes and buyer confirms satisfaction.'}
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
              <Box className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#0E121B] text-base">
              {lang === 'vi' ? '4. Trải Nghiệm 3D 360°' : 'Interactive 3D Viewing'}
            </h3>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Công nghệ 3D Three.js cho phép người mua xoay 360 độ quanh sản phẩm, soi các góc cạnh viền vỏ và xem cấu trúc mô phỏng linh kiện trước khi đưa ra quyết định đặt cọc.'
                : 'Explore devices in interactive 360° 3D with realistic textures, component breakdown, and diagnostic overlays.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-bold text-[#EC1577] tracking-wider">
            {lang === 'vi' ? 'Quy Trình Chuẩn Hóa' : 'Standard Workflow'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0E121B]">
            {lang === 'vi' ? 'Cách Thức Giao Dịch Tại SecondLife' : 'How SecondLife Works'}
          </h2>
          <p className="text-xs sm:text-sm text-[#0E121B]/70">
            {lang === 'vi' ? 'Minh bạch, bảo vệ tối đa lợi ích của cả người mua và người bán.' : 'Transparent and safe for both buyers and sellers.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#F4F5F8] rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs flex items-center justify-center shadow-md">
              1
            </div>
            <h4 className="font-bold text-[#0E121B] text-sm">
              {lang === 'vi' ? 'Người Bán Đăng Tin + AI' : 'Seller Posts with AI'}
            </h4>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Tải lên bộ ảnh 5 góc chuẩn. AI phân tích dòng máy, độ hao mòn và gợi ý mức giá thanh khoản tốt nhất.'
                : 'Upload standard 5-angle photos. AI analyzes device condition and suggests fair market valuation.'}
            </p>
          </div>

          <div className="bg-[#F4F5F8] rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs flex items-center justify-center shadow-md">
              2
            </div>
            <h4 className="font-bold text-[#0E121B] text-sm">
              {lang === 'vi' ? 'Người Mua Đặt Cọc Escrow' : 'Buyer Funds Escrow'}
            </h4>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Người mua thanh toán tiền vào Quỹ tín thác. Tiền được đóng băng an toàn, người bán yên tâm đóng gói gửi hàng.'
                : 'Buyer places funds into protected Escrow. Money is held securely; seller ships with peace of mind.'}
            </p>
          </div>

          <div className="bg-[#F4F5F8] rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs flex items-center justify-center shadow-md">
              3
            </div>
            <h4 className="font-bold text-[#0E121B] text-sm">
              {lang === 'vi' ? 'Kiểm Định Tại SecondLife Hub' : 'Hub Hardware Inspection'}
            </h4>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Kỹ sư Hub mở hộp, kiểm tra tính năng, test pin và màn hình. Đạt chuẩn sẽ dán tem niêm phong NFC trước khi giao tới người mua.'
                : 'Hub technicians verify hardware integrity, screen, and battery health, sealing with anti-tamper NFC tags.'}
            </p>
          </div>

          <div className="bg-[#F4F5F8] rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs flex items-center justify-center shadow-md">
              4
            </div>
            <h4 className="font-bold text-[#0E121B] text-sm">
              {lang === 'vi' ? 'Nhận Hàng & Giải Ngân' : 'Delivery & Escrow Release'}
            </h4>
            <p className="text-xs text-[#0E121B]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Người mua có 48 giờ đối soát sản phẩm. Khi xác nhận hài lòng, Escrow lập tức giải ngân 100% tiền cho người bán.'
                : 'Buyer inspects delivered item with 48h protection window. Escrow releases funds to seller upon approval.'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. COMPARISON TABLE */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0E121B]">
            {lang === 'vi' ? 'Tại Sao Nên Chọn SecondLife?' : 'Why Choose SecondLife?'}
          </h2>
          <p className="text-xs sm:text-sm text-[#0E121B]/70">
            {lang === 'vi' ? 'Bảng so sánh trải nghiệm giao dịch thực tế' : 'Comparison against traditional second-hand classifieds'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="h-1 w-full bg-gradient-to-r from-[#EC1577] via-[#F1622A] to-[#EC1577]" />
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0E121B] text-white">
                <th className="p-4 sm:p-5 font-extrabold text-white text-xs sm:text-sm bg-[#0E121B] border-r border-white/10 w-1/4">
                  Tiêu chí so sánh
                </th>
                <th className="p-4 sm:p-5 font-extrabold text-white text-xs sm:text-sm bg-[#0E121B] border-r border-white/10 text-center w-1/4">
                  ✨ SecondLife Verified
                </th>
                <th className="p-4 sm:p-5 font-extrabold text-slate-100 text-xs sm:text-sm bg-[#0E121B] border-r border-white/10 text-center w-1/4">
                  Hội nhóm Facebook / Diễn đàn
                </th>
                <th className="p-4 sm:p-5 font-extrabold text-slate-100 text-xs sm:text-sm bg-[#0E121B] text-center w-1/4">
                  Sàn rao vặt tự do thông thường
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[#0E121B]">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 sm:p-5 font-bold text-[#0E121B] bg-slate-50/50">Bảo vệ tiền thanh toán</td>
                <td className="p-4 sm:p-5 font-extrabold text-[#EC1577] bg-gradient-to-r from-[#EC1577]/10 to-[#F1622A]/10 border-x border-[#EC1577]/30 text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 bg-[#FFFFFF] px-3 py-1.5 rounded-full shadow-xs border border-[#EC1577]/40 text-[#EC1577] font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
                    <span>Quỹ tín thác Escrow bảo đảm</span>
                  </div>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200">
                    <span>✕</span> Không có (Chuyển khoản trực tiếp)
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-amber-200">
                    <span>⚠</span> Ship COD (Rủi ro tráo hàng)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 sm:p-5 font-bold text-[#0E121B] bg-slate-50/50">Kiểm định chất lượng phần cứng</td>
                <td className="p-4 sm:p-5 font-extrabold text-[#EC1577] bg-gradient-to-r from-[#EC1577]/10 to-[#F1622A]/10 border-x border-[#EC1577]/30 text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 bg-[#FFFFFF] px-3 py-1.5 rounded-full shadow-xs border border-[#EC1577]/40 text-[#EC1577] font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
                    <span>Kỹ sư Hub dán tem niêm phong NFC</span>
                  </div>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200">
                    <span>✕</span> Tự giao dịch ngoài quán cafe
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200">
                    <span>✕</span> Không kiểm định phần cứng
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 sm:p-5 font-bold text-[#0E121B] bg-slate-50/50">Độ chính xác về giá bán</td>
                <td className="p-4 sm:p-5 font-extrabold text-[#EC1577] bg-gradient-to-r from-[#EC1577]/10 to-[#F1622A]/10 border-x border-[#EC1577]/30 text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 bg-[#FFFFFF] px-3 py-1.5 rounded-full shadow-xs border border-[#EC1577]/40 text-[#EC1577] font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
                    <span>AI định giá khách quan dựa trên ML</span>
                  </div>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200">
                    <span>✕</span> Hét giá tự do, ép giá tiêu cực
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-amber-200">
                    <span>⚠</span> Tự định giá theo cảm tính
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 sm:p-5 font-bold text-[#0E121B] bg-slate-50/50">Trực quan hóa sản phẩm</td>
                <td className="p-4 sm:p-5 font-extrabold text-[#EC1577] bg-gradient-to-r from-[#EC1577]/10 to-[#F1622A]/10 border-x border-[#EC1577]/30 text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 bg-[#FFFFFF] px-3 py-1.5 rounded-full shadow-xs border border-[#EC1577]/40 text-[#EC1577] font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
                    <span>Mô phỏng 3D 360° xoay lật đa chiều</span>
                  </div>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200">
                    <span>✕</span> Ảnh chụp mờ giấu lỗi
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-slate-700 font-medium text-center">
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-[11px] font-semibold border border-amber-200">
                    <span>⚠</span> Ảnh tĩnh 2D cơ bản
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. CALL TO ACTION BANNER */}
      {!currentUser && (
        <section className="rounded-3xl bg-[#0E121B] text-white p-8 sm:p-12 text-center space-y-5 border border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#EC1577]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {lang === 'vi' ? 'Sẵn Sàng Mua Bán Đồ Cũ Không Rủi Ro?' : 'Ready for Risk-Free Recommerce?'}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto">
              {lang === 'vi'
                ? 'Tham gia cùng hàng ngàn người dùng thông minh tại Việt Nam. Khám phá các thiết bị đồ gia dụng chính hãng đã qua kiểm định với giá hợp lý nhất.'
                : 'Join smart second-hand shoppers across Vietnam. Explore certified home appliances with guaranteed escrow protection.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  soundFx.playChime();
                  onExploreMarketplace();
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold text-xs sm:text-sm shadow-md hover:opacity-95 transition cursor-pointer"
              >
                {lang === 'vi' ? 'Vào Sàn Mua Sắm Ngay' : 'Browse Marketplace'}
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 font-medium text-xs sm:text-sm transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đăng Ký Tài Khoản Miễn Phí' : 'Create Free Account'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
