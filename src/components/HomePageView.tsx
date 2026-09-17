import React from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  ShoppingBag, 
  ArrowRight, 
  Building2, 
  Lock, 
  Box, 
  CheckCircle2, 
  Star, 
  Layers, 
  Cpu, 
  Truck, 
  RefreshCw, 
  ShieldAlert, 
  Zap, 
  Users, 
  Award, 
  FileCheck2, 
  Check, 
  X as CloseIcon 
} from 'lucide-react';
import { Language } from '../types';
import { CountUp } from './react-bits/CountUp';
import { soundFx } from '../utils/soundEffects';

interface HomePageViewProps {
  lang: Language;
  onExploreMarketplace: () => void;
  onCreateListing: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const HomePageView: React.FC<HomePageViewProps> = ({
  lang,
  onExploreMarketplace,
  onCreateListing,
  onOpenAuth
}) => {
  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-stone-900 via-[#101917] to-[#0A100E] text-white p-6 sm:p-12 lg:p-16 border border-stone-800 shadow-xl">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs font-medium backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'vi' ? 'Sàn Thương Mại Đồ Cũ Thế Hệ Mới • Đạt Chuẩn Kiểm Định' : 'Next-Gen Certified Recommerce Platform'}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-white">
            {lang === 'vi' ? (
              <>
                Mua Bán Đồ Cũ <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-stone-200">
                  AI Định Giá & Kiểm Định Thật.
                </span>
              </>
            ) : (
              <>
                Trade Second-Hand <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-stone-200">
                  With AI Valuation & Certified Hardware.
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
            {lang === 'vi'
              ? 'Xóa bỏ hoàn toàn nỗi lo mua phải hàng dựng, hàng nhái, tráo linh kiện hoặc lừa cọc. SecondLife bảo vệ 100% người mua & người bán bằng mô hình AI định giá chuẩn, kiểm định trực tiếp tại Hub và giữ tiền an toàn qua Quỹ tín thác Escrow.'
              : 'Eliminate counterfeit and scam risks with calibrated AI valuation, physical hardware inspection hubs, and 100% buyer-seller protection via Escrow.'}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                soundFx.playChime();
                onExploreMarketplace();
              }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#1B4D3E] hover:bg-[#236350] text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-950/40 transition-all transform hover:-translate-y-0.5 cursor-pointer"
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
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-stone-900/85 hover:bg-stone-800 text-stone-200 font-medium text-xs sm:text-sm border border-stone-700/80 backdrop-blur-md transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'vi' ? 'Thử Định Giá & Đăng Bán' : 'AI Valuation & Sell'}</span>
            </button>

            <button
              onClick={() => onOpenAuth('register')}
              className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-stone-400 hover:text-white font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              <span>{lang === 'vi' ? 'Đăng ký thành viên' : 'Sign Up'}</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-6 border-t border-stone-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
            <div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                <CountUp to={100} duration={1.5} />%
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {lang === 'vi' ? 'Bảo đảm an toàn Escrow' : 'Escrow Fund Protection'}
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-teal-300">
                <CountUp to={3} duration={1} />
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {lang === 'vi' ? 'Trung tâm Hub (HN, ĐN, HCM)' : 'Flagship Hubs'}
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-stone-200">
                &lt; <CountUp to={3} duration={1.5} />%
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {lang === 'vi' ? 'Sai số định giá AI' : 'AI Valuation Deviation'}
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-amber-300">
                <CountUp to={24} duration={1.2} />h
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {lang === 'vi' ? 'Thời gian kiểm định & niêm phong' : 'Inspection Turnaround'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FOUR CORE PILLARS OF SECONDLIFE */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200">
            <Award className="w-3.5 h-3.5 text-[#1B4D3E]" />
            <span>{lang === 'vi' ? 'Nền Tảng Công Nghệ Đột Phá' : 'Breakthrough Architecture'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            {lang === 'vi' ? '4 Trụ Cột Xây Dựng Niềm Tin Tuyệt Đối' : '4 Pillars of Absolute Trust'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            {lang === 'vi'
              ? 'Giải quyết triệt để 3 vấn đề lớn nhất của thị trường đồ cũ: Mù mờ về giá, gian lận linh kiện và rủi ro chuyển khoản bùng cọc.'
              : 'Solving price ambiguity, component swapping, and fraudulent non-delivery.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Pillar 1 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-2xs hover:shadow-md hover:border-[#1B4D3E]/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-base">
              {lang === 'vi' ? '1. AI Price Estimation' : 'AI Price Valuation'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {lang === 'vi'
                ? 'Mô hình Machine Learning (LightGBM) đối chiếu hàng ngàn giao dịch thực tế trên thị trường Việt Nam kết hợp số năm sử dụng và tình trạng hao mòn để đưa ra mức giá công bằng nhất.'
                : 'Machine Learning algorithms calibrate with verified transactions to provide an objective, real-time market fair price.'}
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-2xs hover:shadow-md hover:border-[#1B4D3E]/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center border border-stone-200">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-base">
              {lang === 'vi' ? '2. Verify Then Ship Hub' : 'Physical Inspection Hubs'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {lang === 'vi'
                ? 'Hàng hóa gửi qua Trung tâm giám định SecondLife Hub tại Hà Nội, Đà Nẵng, TP.HCM. Kỹ sư chuyên môn đo pin, soi màn hình, kiểm tra bo mạch và dán tem niêm phong NFC chống tráo.'
                : 'Hardware engineers thoroughly inspect components, screen, and battery before sealing with tamper-proof NFC tags.'}
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-2xs hover:shadow-md hover:border-[#1B4D3E]/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-100">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-base">
              {lang === 'vi' ? '3. Quỹ Tín Thác Escrow' : 'Escrow Fund Protection'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {lang === 'vi'
                ? 'Tiền mua hàng được giữ an toàn trong quỹ tín thác của hệ thống. Người bán không nhận tiền trước; chỉ giải ngân sau khi kiểm định viên duyệt ĐẠT và người mua đồng ý nhận hàng.'
                : 'Buyer payment is locked safely in Escrow. Funds are released only after inspection passes and buyer confirms satisfaction.'}
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-2xs hover:shadow-md hover:border-[#1B4D3E]/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-[#1B4D3E] flex items-center justify-center border border-stone-200">
              <Box className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-base">
              {lang === 'vi' ? '4. Trải Nghiệm 3D 360°' : 'Interactive 3D Viewing'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {lang === 'vi'
                ? 'Công nghệ 3D Three.js cho phép người mua xoay 360 độ quanh sản phẩm, soi các góc cạnh viền vỏ và xem cấu trúc mô phỏng linh kiện trước khi đưa ra quyết định đặt cọc.'
                : 'Explore devices in interactive 360° 3D with realistic textures, component breakdown, and diagnostic overlays.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (4-STEP PROCESS) */}
      <section className="bg-stone-50/70 rounded-3xl p-6 sm:p-10 border border-stone-200/80 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-bold text-stone-400 tracking-wider">
            {lang === 'vi' ? 'Quy Trình Chuẩn Hóa' : 'Standard Workflow'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
            {lang === 'vi' ? 'Cách Thức Giao Dịch Tại SecondLife' : 'How SecondLife Works'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            {lang === 'vi' ? 'Minh bạch, bảo vệ tối đa lợi ích của cả người mua và người bán.' : 'Transparent and safe for both buyers and sellers.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-[#1B4D3E] text-white font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {lang === 'vi' ? 'Người Bán Đăng Tin + AI' : 'Seller Posts with AI'}
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              {lang === 'vi'
                ? 'Tải lên bộ ảnh 5 góc chuẩn. AI phân tích dòng máy, độ hao mòn và gợi ý mức giá thanh khoản tốt nhất.'
                : 'Upload standard 5-angle photos. AI analyzes device condition and suggests fair market valuation.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-[#1B4D3E] text-white font-bold text-xs flex items-center justify-center">
              2
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {lang === 'vi' ? 'Người Mua Đặt Cọc Escrow' : 'Buyer Funds Escrow'}
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              {lang === 'vi'
                ? 'Người mua thanh toán tiền vào Quỹ tín thác. Tiền được đóng băng an toàn, người bán yên tâm đóng gói gửi hàng.'
                : 'Buyer places funds into protected Escrow. Money is held securely; seller ships with peace of mind.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-[#1B4D3E] text-white font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {lang === 'vi' ? 'Kiểm Định Tại SecondLife Hub' : 'Hub Hardware Inspection'}
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              {lang === 'vi'
                ? 'Kỹ sư Hub mở hộp, kiểm tra tính năng, test pin và màn hình. Đạt chuẩn sẽ dán tem niêm phong NFC trước khi giao tới người mua.'
                : 'Hub technicians verify hardware integrity, screen, and battery health, sealing with anti-tamper NFC tags.'}
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-[#1B4D3E] text-white font-bold text-xs flex items-center justify-center">
              4
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {lang === 'vi' ? 'Nhận Hàng & Giải Ngân' : 'Delivery & Escrow Release'}
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              {lang === 'vi'
                ? 'Người mua có 48 giờ đối soát sản phẩm. Khi xác nhận hài lòng, Escrow lập tức giải ngân 100% tiền cho người bán.'
                : 'Buyer inspects delivered item with 48h protection window. Escrow releases funds to seller upon approval.'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. COMPARISON TABLE: SECONDLIFE VS TRADITIONAL PLATFORMS */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
            {lang === 'vi' ? 'Tại Sao Nên Chọn SecondLife?' : 'Why Choose SecondLife?'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            {lang === 'vi' ? 'Bảng so sánh trải nghiệm giao dịch thực tế' : 'Comparison against traditional second-hand classifieds'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-700">
                <th className="p-4 font-semibold text-stone-800">Tiêu chí so sánh</th>
                <th className="p-4 font-bold text-[#1B4D3E] bg-emerald-50/60 border-x border-emerald-100">
                  SecondLife Verified
                </th>
                <th className="p-4 font-semibold text-stone-600">Hội nhóm Facebook / Diễn đàn</th>
                <th className="p-4 font-semibold text-stone-600">Sàn rao vặt tự do thông thường</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              <tr>
                <td className="p-4 font-medium">Bảo vệ tiền thanh toán</td>
                <td className="p-4 font-semibold text-emerald-800 bg-emerald-50/30 border-x border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Quỹ tín thác Escrow bảo hiểm 100%</span>
                </td>
                <td className="p-4 text-rose-600">Không có (Chuyển khoản trực tiếp, nguy cơ bùng)</td>
                <td className="p-4 text-amber-700">Ship COD (Dễ bị từ chối nhận hoặc tráo hàng)</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Kiểm định chất lượng phần cứng</td>
                <td className="p-4 font-semibold text-emerald-800 bg-emerald-50/30 border-x border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Kỹ sư chuyên nghiệp tại Hub dán tem NFC</span>
                </td>
                <td className="p-4 text-stone-500">Người mua tự kiểm tra ngoài đường/quán cafe</td>
                <td className="p-4 text-stone-500">Không kiểm định, chỉ dựa vào lời rao của người bán</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Độ chính xác về giá bán</td>
                <td className="p-4 font-semibold text-emerald-800 bg-emerald-50/30 border-x border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>AI định giá khách quan dựa trên ML</span>
                </td>
                <td className="p-4 text-stone-500">Hét giá tự do, ép giá tiêu cực</td>
                <td className="p-4 text-stone-500">Người bán tự định giá theo cảm tính</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Trực quan hóa sản phẩm</td>
                <td className="p-4 font-semibold text-emerald-800 bg-emerald-50/30 border-x border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Mô phỏng 3D 360° xoay lật đa chiều</span>
                </td>
                <td className="p-4 text-stone-500">Vài tấm ảnh chụp mờ, góc chụp giấu lỗi</td>
                <td className="p-4 text-stone-500">Ảnh tĩnh 2D chụp cơ bản</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. CALL TO ACTION BANNER */}
      <section className="rounded-3xl bg-[#1B4D3E] text-white p-8 sm:p-12 text-center space-y-5 shadow-lg relative overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-3 relative z-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {lang === 'vi' ? 'Sẵn Sàng Mua Bán Đồ Cũ Không Rủi Ro?' : 'Ready for Risk-Free Recommerce?'}
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto">
            {lang === 'vi'
              ? 'Tham gia cùng hàng ngàn người dùng thông minh tại Việt Nam. Khám phá các thiết bị công nghệ chính hãng đã qua kiểm định với giá hợp lý nhất.'
              : 'Join smart second-hand shoppers across Vietnam. Explore certified tech with guaranteed escrow protection.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                soundFx.playChime();
                onExploreMarketplace();
              }}
              className="px-6 py-3 rounded-xl bg-white text-[#1B4D3E] hover:bg-stone-100 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
            >
              {lang === 'vi' ? 'Vào Sàn Mua Sắm Ngay' : 'Browse Marketplace'}
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3 rounded-xl bg-[#153e32] text-white hover:bg-[#113127] border border-emerald-600/50 font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đăng Ký Tài Khoản Miễn Phí' : 'Create Free Account'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
