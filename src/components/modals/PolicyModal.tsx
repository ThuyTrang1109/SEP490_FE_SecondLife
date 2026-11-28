import React, { useState } from 'react';
import {
  Lock,
  FileText,
  Cpu,
  Scale,
  Sparkles,
  Info,
  Phone,
  Mail,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Language } from '../../types';
import { PolicyDocumentView } from '../policy/PolicyDocumentView';
import { PolicyVersionDto } from '../../services/policyService';
import { navigatePath } from '../../app/router/browser';
import logoImg from '../../assets/logo.png';

export type PolicyTabKey = 'privacy' | 'about' | 'lab' | 'rules' | 'terms';

interface PolicyModalProps {
  isOpen: boolean;
  initialTab?: PolicyTabKey;
  focusPolicyOnly?: boolean;
  policy?: PolicyVersionDto | null;
  onClose: () => void;
  lang?: Language;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  initialTab = 'terms',
  focusPolicyOnly = false,
  policy,
  onClose,
  lang = 'vi'
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTabKey>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(focusPolicyOnly ? 'terms' : initialTab);
    }
  }, [isOpen, initialTab, focusPolicyOnly]);

  if (!isOpen) return null;

  const openFullPage = () => {
    onClose();
    navigatePath('/terms-of-service');
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Điều khoản sử dụng và Quy chế hoạt động SecondLife"
    >
      <div className="relative w-full max-w-4xl bg-[#faf8f5] text-[#24263e] rounded-3xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-white/10 bg-[#24263e] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="logo-badge bg-white p-1.5 rounded-xl shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                <span>
                  Second<span className="text-[#c34c36]">Life</span>{' '}
                  {focusPolicyOnly
                    ? 'Điều khoản & Quy chế'
                    : 'Legal & Information Center'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c34c36] text-white font-black uppercase shadow-xs">
                  VERIFIED
                </span>
              </h3>
              <p className="text-xs text-[#fce5da] font-medium truncate">
                {lang === 'vi'
                  ? 'Điều khoản sử dụng, Quy chế hoạt động và quy chuẩn kiểm định chính thức'
                  : 'Official Terms of Service, Operating Policy and inspection standards'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chính sách"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer border border-white/15 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation (hidden when focused directly on official Terms from Register/Login) */}
        {!focusPolicyOnly && (
          <div className="px-5 sm:px-6 py-2.5 bg-[#1b1c2d] border-b border-white/10 flex items-center gap-2 overflow-x-auto subtle-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'about'
                  ? 'bg-[#c34c36] text-white shadow-sm font-black'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Giới Thiệu Hệ Thống' : 'About System'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-[#c34c36] text-white shadow-sm font-black'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Hệ Thống Kiểm Định' : 'Inspection Hub'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'terms' || activeTab === 'rules'
                  ? 'bg-[#c34c36] text-white shadow-sm font-black'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {lang === 'vi'
                  ? 'Điều Khoản & Quy Chế Hoạt Động'
                  : 'Terms & Operating Policy'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-[#c34c36] text-white shadow-sm font-black'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Chính Sách Bảo Mật' : 'Privacy Policy'}</span>
            </button>
          </div>
        )}

        {/* Modal Body Scrollable Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-sm text-[#24263e] leading-relaxed subtle-scrollbar flex-1 bg-[#faf8f5]">
          {/* TAB: OFFICIAL TERMS & OPERATING POLICY (SINGLE SOURCE OF TRUTH FROM BACKEND) */}
          {(focusPolicyOnly || activeTab === 'terms' || activeTab === 'rules') && (
            <div className="animate-fadeIn">
              <PolicyDocumentView compact policy={policy} />
            </div>
          )}

          {/* TAB: GIỚI THIỆU HỆ THỐNG */}
          {!focusPolicyOnly && activeTab === 'about' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-[#c34c36]/40 flex items-center gap-3 shadow-xs">
                <Sparkles className="w-6 h-6 text-[#24263e] shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">
                    SecondLife - Sàn Đồ Gia Dụng Cũ Kiểm Định & AI Định Giá
                  </h4>
                  <p className="text-xs text-[#24263e]/80">
                    Bảo vệ tài chính người dùng qua cơ chế Quỹ Ký quỹ Escrow 48 giờ và quy trình Kiểm định Kỹ thuật Độc lập.
                  </p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">1. Sứ mệnh & Tầm nhìn</h5>
                <p className="text-[#24263e]/85 text-xs sm:text-sm">
                  SecondLife giải quyết các rủi ro lớn khi mua bán thiết bị gia dụng đã qua sử dụng (Tủ lạnh, Máy giặt, Điều hòa, Lò vi sóng, Bếp từ,...):{' '}
                  <strong>lừa đảo tiền cọc, tráo đổi linh kiện, sai lệch mô tả và thiết bị hư hỏng ngầm.</strong>
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">2. Ba Trụ Cột Nền Tảng</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-[#c34c36]/20 flex items-center justify-center text-[#24263e] font-black">1</div>
                    <h6 className="font-black text-[#24263e] text-xs">Kiểm Định Kỹ Thuật Độc Lập</h6>
                    <p className="text-xs text-[#24263e]/75">
                      Hỗ trợ kiểm định tại nhà hoặc tại Trung tâm kiểm định, lưu bằng chứng ảnh/video 14 ngày và dán tem niêm phong mã hóa chống tráo đổi.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-800 font-black">2</div>
                    <h6 className="font-black text-[#24263e] text-xs">Bảo Lãnh Thanh Toán Escrow 48h</h6>
                    <p className="text-xs text-[#24263e]/75">
                      Tiền mua hàng được phong tỏa trong Quỹ Ký quỹ Escrow. Người bán chỉ được giải ngân sau khi Người mua xác nhận hoặc hết 48 giờ dùng thử không có khiếu nại.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-teal-600/20 flex items-center justify-center text-teal-800 font-black">3</div>
                    <h6 className="font-black text-[#24263e] text-xs">Trợ Lý AI Tư Vấn & Định Giá</h6>
                    <p className="text-xs text-[#24263e]/75">
                      Hỗ trợ phân tích thiết bị và đề xuất khoảng giá thị trường tham khảo minh bạch cho cả Người mua và Người bán.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">3. Thông Tin Trụ Sở & Liên Hệ</h5>
                <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-2 text-xs shadow-xs">
                  <div className="flex items-start gap-2 text-[#24263e]">
                    <MapPin className="w-4 h-4 text-[#24263e] shrink-0 mt-0.5" />
                    <span><strong>Trụ sở chính:</strong> Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh.</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#24263e]">
                    <Mail className="w-4 h-4 text-[#24263e] shrink-0" />
                    <span><strong>Email phản hồi chính thức:</strong> noreply.homeappliance@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#24263e]">
                    <Phone className="w-4 h-4 text-[#24263e] shrink-0" />
                    <span><strong>Hotline hỗ trợ:</strong> 1900 8899 (Hỗ trợ từ 08:00 - 21:00 hàng ngày)</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB: HỆ THỐNG KIỂM ĐỊNH */}
          {!focusPolicyOnly && activeTab === 'lab' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-teal-500/30 flex items-center gap-3 shadow-xs">
                <Cpu className="w-6 h-6 text-teal-700 shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Hệ Thống Kiểm Định Kỹ Thuật SecondLife</h4>
                  <p className="text-xs text-[#24263e]/80">Kiểm định minh bạch tại nhà hoặc tại Trung tâm, kèm tem niêm phong mã hóa định danh.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">1. Hai Hình Thức Kiểm Định</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/85">
                  <li><strong>Kiểm định tại nhà:</strong> Kiểm định viên đến tận nơi theo ca sáng (08:00 – 12:00) hoặc ca chiều (13:00 – 17:00), cước di chuyển 2 chiều tính theo 6 bậc thang minh bạch.</li>
                  <li><strong>Kiểm định tại Trung tâm:</strong> Thiết bị được vận chuyển qua Lalamove tới Trung tâm để kiểm tra chuyên sâu, sau đó giao thẳng cho Người mua nếu đạt chuẩn hoặc hoàn về Người bán nếu không đạt.</li>
                  <li><strong>Kiểm định bắt buộc giá trị cao:</strong> Sản phẩm niêm yết trên 10.000.000 VNĐ bắt buộc phải hoàn tất kiểm định trước khi mở bán công khai.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h5 className="font-black text-[#24263e] text-sm">2. Tem Niêm Phong Mã Hóa Chống Tráo Đổi</h5>
                <p className="text-xs text-[#24263e]/85">
                  Thiết bị đạt chuẩn được dán tem niêm phong mã hóa định danh duy nhất kèm nhật ký quét tọa độ. Người mua có thể tra cứu trực tiếp mã tem để đối chiếu tình trạng thiết bị và báo cáo kiểm định.
                </p>
              </section>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('terms')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#c34c36] hover:underline cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Xem đầy đủ Điều 6 trong Điều khoản sử dụng & Quy chế hoạt động</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: CHÍNH SÁCH BẢO MẬT */}
          {!focusPolicyOnly && activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-rose-500/30 flex items-center gap-3 shadow-xs">
                <Lock className="w-6 h-6 text-[#24263e] shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Chính Sách Bảo Mật Dữ Liệu Cá Nhân</h4>
                  <p className="text-xs text-[#24263e]/80">Cam kết bảo vệ dữ liệu tài khoản, định danh eKYC và giao dịch của Người dùng.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">1. Dữ Liệu Thu Thập</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/85">
                  <li>Thông tin tài khoản: Họ tên, Email, Số điện thoại, Ảnh đại diện.</li>
                  <li>Dữ liệu định danh eKYC Người bán: Giấy tờ tùy thân và ảnh chân dung đối chiếu (mã hóa bảo mật).</li>
                  <li>Dữ liệu giao dịch: Lịch sử thanh toán ký quỹ Escrow, thông tin giao nhận hàng và lịch sử chấp thuận điều khoản.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h5 className="font-black text-[#24263e] text-sm">2. Cam Kết Bảo Mật</h5>
                <p className="text-xs text-[#24263e]/85">
                  SecondLife cam kết không bán, trao đổi hoặc tiết lộ dữ liệu cá nhân của Người dùng cho bên thứ ba vì mục đích quảng cáo thương mại. Mọi yêu cầu hỗ trợ dữ liệu vui lòng liên hệ <strong>noreply.homeappliance@gmail.com</strong>.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#24263e]/15 bg-[#fce5da] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[#24263e]/80 font-bold">
              <Mail className="w-4 h-4 text-[#24263e]" />
              <span><strong className="text-[#24263e] font-black">noreply.homeappliance@gmail.com</strong></span>
            </div>
            {!focusPolicyOnly && (
              <button
                type="button"
                onClick={openFullPage}
                className="inline-flex items-center gap-1 text-[#c34c36] font-extrabold hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở trang riêng (/terms-of-service)</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#24263e] text-white font-black text-xs hover:bg-[#3d2a20] transition cursor-pointer shadow-md"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
