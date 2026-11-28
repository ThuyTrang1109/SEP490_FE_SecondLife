import React, { useState } from 'react';
import {
  Lock,
  FileText,
  Cpu,
  Scale,
  Sparkles,
  Info,
  Phone,
  Mail
} from 'lucide-react';
import { Language } from '../../types';
import { formatConditionGrade } from '../../utils/translations';
import logoImg from '../../assets/logo.png';

export type PolicyTabKey = 'privacy' | 'about' | 'lab' | 'rules' | 'terms';

interface PolicyModalProps {
  isOpen: boolean;
  initialTab?: PolicyTabKey;
  onClose: () => void;
  lang?: Language;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  initialTab = 'about',
  onClose,
  lang = 'vi'
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTabKey>(initialTab);

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#faf8f5] text-[#24263e] rounded-3xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-white/10 bg-[#24263e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="logo-badge bg-white p-1.5 rounded-xl shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Second<span className="text-[#c34c36]">Life</span> Legal & Information Center</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c34c36] text-white font-black uppercase shadow-xs">
                  VERIFIED
                </span>
              </h3>
              <p className="text-xs text-[#fce5da] font-medium">
                {lang === 'vi' ? 'Thông tin về giao dịch, kiểm định và dữ liệu cá nhân' : 'Information about transactions, inspections, and personal data'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer border border-white/15"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-[#1b1c2d] border-b border-white/10 flex items-center gap-2 overflow-x-auto subtle-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('about')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'about'
              ? 'bg-[#c34c36] text-white shadow-sm font-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Giới thiệu hệ thống' : 'About System'}</span>
          </button>

          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'lab'
              ? 'bg-[#c34c36] text-white shadow-sm font-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Kiểm định sản phẩm' : 'Product inspection'}</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'rules'
              ? 'bg-[#c34c36] text-white shadow-sm font-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Quy chế hoạt động' : 'Operating Rules'}</span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'terms'
              ? 'bg-[#c34c36] text-white shadow-sm font-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Điều khoản dịch vụ' : 'Terms of Service'}</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'privacy'
              ? 'bg-[#c34c36] text-white shadow-sm font-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}</span>
          </button>
        </div>

        {/* Modal Body Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-[#24263e] leading-relaxed subtle-scrollbar flex-1 bg-[#faf8f5]">
          {/* TAB 1: GIỚI THIỆU HỆ THỐNG */}
          {activeTab === 'about' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-[#c34c36]/40 flex items-center gap-3 shadow-xs">
                <Sparkles className="w-6 h-6 text-[#24263e] shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">SecondLife — Sàn mua bán đồ gia dụng đã qua sử dụng</h4>
                  <p className="text-xs text-[#24263e]/80">Đăng tin, trao đổi với người mua hoặc người bán và theo dõi đơn hàng trên cùng một nền tảng.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Tính năng chính</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <h6 className="font-black text-[#24263e] text-xs">Kiểm định sản phẩm</h6>
                    <p className="text-xs text-[#24263e]/75">Sản phẩm thuộc diện bắt buộc phải kiểm định trước khi đăng bán. Với tin đủ điều kiện, người mua có thể đề xuất kiểm định trước khi quyết định mua.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <h6 className="font-black text-[#24263e] text-xs">Thanh toán qua Escrow</h6>
                    <p className="text-xs text-[#24263e]/75">Escrow tạm giữ khoản thanh toán của đơn hàng trong thời gian giao nhận và đối soát.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <h6 className="font-black text-[#24263e] text-xs">AI hỗ trợ đăng tin</h6>
                    <p className="text-xs text-[#24263e]/75">AI có thể phân tích ảnh, gợi ý mô tả và mức giá tham khảo. Người bán xác nhận thông tin và chọn giá đăng bán.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Liên hệ hỗ trợ</h5>
                <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-2 text-xs shadow-xs">
                  <div className="flex items-center gap-2 text-[#24263e]">
                    <Phone className="w-4 h-4 text-[#24263e] shrink-0" />
                    <a href="tel:19008899" className="font-semibold hover:underline">1900 8899</a>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: HỆ THỐNG PHÒNG LAB */}
          {activeTab === 'lab' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-teal-500/30 flex items-center gap-3 shadow-xs">
                <Cpu className="w-6 h-6 text-teal-700 shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Kiểm định sản phẩm qua SecondLife</h4>
                  <p className="text-xs text-[#24263e]/80">Đơn kiểm định có thể thực hiện tại nhà người bán hoặc tại trung tâm, tùy phương án được chọn.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Quy trình kiểm định</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Kỹ thuật viên ghi nhận ngoại quan và phụ kiện, sau đó kiểm tra theo danh sách hạng mục được gán cho sản phẩm.</li>
                  <li>Biên bản ghi kết quả từng hạng mục, điểm tình trạng và kết luận đạt hoặc không đạt. Người dùng có thể xem biên bản trong chi tiết kiểm định.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Qui chuẩn phân hạng chất lượng</h5>
                <p className="text-xs text-[#24263e]/80">Phân hạng mô tả ngoại quan. Kết luận kiểm định được ghi riêng trong biên bản dựa trên các hạng mục đã kiểm tra.</p>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-white border border-emerald-500/40 shadow-xs">
                    <span className="font-black text-emerald-800 text-xs">{formatConditionGrade('Like New')}</span>
                    <span className="text-xs text-[#24263e]/85 ml-2">Ngoại quan gần như mới.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-amber-500/40 shadow-xs">
                    <span className="font-black text-amber-800 text-xs">{formatConditionGrade('Good')}</span>
                    <span className="text-xs text-[#24263e]/85 ml-2">Ngoại quan còn đẹp, có thể có vết xước nhẹ.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-purple-500/40 shadow-xs">
                    <span className="font-black text-purple-800 text-xs">{formatConditionGrade('Fair')}</span>
                    <span className="text-xs text-[#24263e]/85 ml-2">Có vết trầy xước hoặc cấn móp nhìn thấy rõ.</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: QUY CHẾ HOẠT ĐỘNG */}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-amber-500/30 flex items-center gap-3 shadow-xs">
                <Scale className="w-6 h-6 text-amber-700 shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Quy chế hoạt động của SecondLife</h4>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Đăng tin bán sản phẩm</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Hoàn tất xác minh danh tính bằng CCCD và được duyệt quyền người bán trước khi đăng bán.</li>
                  <li>Đăng từ 3 đến 6 ảnh chụp thực tế và mô tả đúng tình trạng của sản phẩm.</li>
                  <li>Tin thuộc diện kiểm định bắt buộc chỉ có thể được đăng bán sau khi sản phẩm đạt kiểm định.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Giao dịch qua Escrow</h5>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Khoản thanh toán được tạm giữ trong Escrow khi người mua thanh toán đơn hàng.</li>
                  <li>Đơn mua trực tiếp được giao từ người bán đến người mua. Với đơn có yêu cầu kiểm định, người mua xem kết quả và có thể chọn mua tiếp khi sản phẩm đạt kiểm định.</li>
                  <li>Kể từ lúc giao thành công, người mua có 48 giờ để kiểm tra hàng và gửi khiếu nại khi tiền còn trong Escrow.</li>
                  <li>Tiền được giải ngân về ví người bán khi người mua xác nhận đã nhận hàng hoặc khi hết thời hạn đối soát và đơn đủ điều kiện tự động giải ngân.</li>
                </ol>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Xử lý vi phạm</h5>
                <p className="text-xs text-[#24263e]/85">
                  Người dùng có thể báo cáo bài đăng hoặc khiếu nại đơn hàng. Vi phạm được xác nhận có thể được ghi nhận vào lịch sử uy tín và dẫn đến hạn chế quyền bán.
                </p>
              </section>
            </div>
          )}

          {/* TAB 4: ĐIỀU KHOẢN DỊCH VỤ */}
          {activeTab === 'terms' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-purple-500/30 flex items-center gap-3 shadow-xs">
                <FileText className="w-6 h-6 text-purple-700 shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Điều khoản dịch vụ</h4>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Phạm vi giao dịch</h5>
                <p className="text-[#24263e]/85">
                  Escrow và quy trình khiếu nại đơn hàng áp dụng cho các giao dịch được đặt và thanh toán trên SecondLife. Bạn có thể xem số tiền thanh toán và trạng thái ký quỹ trong chi tiết đơn.
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Quyết toán phí kiểm định</h5>
                <p className="text-xs text-[#24263e]/85">
                  Phần phí mỗi bên chịu được ghi trong phương án kiểm định. Nếu sản phẩm không đạt khi kiểm định tại trung tâm, hàng được xử lý hoàn về người bán. Khoản dự phòng cước hoàn được đối soát theo cước thực tế.
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Giải quyết khiếu nại</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Khi người mua gửi khiếu nại hợp lệ, hệ thống tạm đóng băng khoản thanh toán trong Escrow để chờ xử lý.</li>
                  <li>Nhân viên xem xét nội dung khiếu nại, bằng chứng và thông tin của đơn hàng. Người bán có thể gửi phản hồi và bằng chứng theo trạng thái hồ sơ.</li>
                  <li>Nếu yêu cầu trả hàng và hoàn tiền được duyệt, người mua có thể tạo vận đơn hoàn. Khoản hoàn tiền được xử lý sau khi xác nhận giao trả thành công.</li>
                </ul>
              </section>
            </div>
          )}

          {/* TAB 5: CHÍNH SÁCH BẢO MẬT */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-rose-500/30 flex items-center gap-3 shadow-xs">
                <Lock className="w-6 h-6 text-[#24263e] shrink-0" />
                <div>
                  <h4 className="font-black text-[#24263e] text-base">Chính sách bảo mật dữ liệu cá nhân</h4>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Dữ liệu dùng trong hệ thống</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Thông tin tài khoản gồm họ tên, email, số điện thoại và ảnh đại diện do người dùng cung cấp.</li>
                  <li>Hồ sơ xác minh người bán gồm số CCCD, ảnh hai mặt CCCD và ảnh chân dung nếu có.</li>
                  <li>Thông tin đơn hàng gồm địa chỉ giao nhận, thông tin thanh toán và lịch sử giao dịch. Hồ sơ khiếu nại có thể kèm hình ảnh hoặc video do các bên gửi.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Mục đích sử dụng dữ liệu</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#24263e]/80">
                  <li>Hồ sơ xác minh được sử dụng để kiểm tra danh tính và xét duyệt quyền bán. Khi chọn VNPT eKYC, ảnh giấy tờ và ảnh chân dung được dùng để đối chiếu danh tính qua VNPT.</li>
                  <li>Khi đặt chuyến qua Lalamove, hệ thống gửi tên, số điện thoại và địa chỉ giao nhận để đơn vị vận chuyển thực hiện chuyến.</li>
                  <li>Thông tin giao dịch và bằng chứng được sử dụng để đối soát, xử lý khiếu nại và hoàn tiền.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#24263e] text-sm">Thông tin hồ sơ</h5>
                <p className="text-xs text-[#24263e]/85">
                  Bạn có thể xem và cập nhật thông tin tài khoản trong phần Hồ sơ, hoặc xem trạng thái xác minh khi đã nộp hồ sơ người bán.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-[#24263e]/15 bg-[#fce5da] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[#24263e]/80 font-bold">
            <Mail className="w-4 h-4 text-[#24263e]" />
            <span>{lang === 'vi' ? 'Email hỗ trợ' : 'Support email'} <a href="mailto:noreply.homeappliance@gmail.com" className="text-[#24263e] font-black hover:underline">noreply.homeappliance@gmail.com</a></span>
          </div>
          <button
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
