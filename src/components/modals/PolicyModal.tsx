import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  FileText,
  Building2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  Info,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Language } from '../../types';
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
      <div className="relative w-full max-w-4xl bg-[#f6f5eb] text-[#2b1d16] rounded-3xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-[#2b1d16]/15 bg-[#cea981] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt="SecondLife Logo"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div>
              <h3 className="text-base font-black text-[#2b1d16] flex items-center gap-2">
                <span>SecondLife Legal & Information Center</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#2b1d16] font-black uppercase border border-[#2b1d16]/20">
                  VERIFIED
                </span>
              </h3>
              <p className="text-xs text-[#2b1d16]/80 font-bold">
                {lang === 'vi' ? 'Thông tin chính sách, điều khoản và quy trình kiểm định phòng Lab' : 'Official policies, terms, and Hub Lab inspection standards'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/40 hover:bg-white/60 text-[#2b1d16] flex items-center justify-center text-sm font-bold transition cursor-pointer border border-[#2b1d16]/20"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-[#cea981] border-b border-[#2b1d16]/15 flex items-center gap-2 overflow-x-auto subtle-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('about')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'about'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Giới Thiệu Hệ Thống' : 'About System'}</span>
          </button>

          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'lab'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Hệ Thống Phòng Lab' : 'Lab Inspection'}</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Quy Chế Hoạt Động' : 'Operating Rules'}</span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Điều Khoản Dịch Vụ' : 'Terms of Service'}</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-white text-[#2b1d16] shadow-sm font-black'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/40'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Chính Sách Bảo Mật' : 'Privacy Policy'}</span>
          </button>
        </div>

        {/* Modal Body Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-[#2b1d16] leading-relaxed subtle-scrollbar flex-1 bg-[#f6f5eb]">
          {/* TAB 1: GIỚI THIỆU HỆ THỐNG */}
          {activeTab === 'about' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-[#cea981]/40 flex items-center gap-3 shadow-xs">
                <Sparkles className="w-6 h-6 text-[#2b1d16] shrink-0" />
                <div>
                  <h4 className="font-black text-[#2b1d16] text-base">SecondLife - Sàn Đồ Cũ Kiểm Định & AI Định Giá Thế Hệ Mới</h4>
                  <p className="text-xs text-[#2b1d16]/80">Tiên phong bảo vệ tài chính người dùng qua cơ chế Quỹ Tín Thác Escrow và Phòng Lab Kiểm Định Chuyên Nghiệp.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm flex items-center gap-2">
                  <span>1. Sứ mệnh & Tầm nhìn</span>
                </h5>
                <p className="text-[#2b1d16]/85">
                  SecondLife ra đời nhằm giải quyết triệt để nỗi lo ngại lớn nhất của người tiêu dùng khi mua bán các thiết bị gia dụng và điện máy đã qua sử dụng (Tủ lạnh, Máy giặt, Điều hòa, Lò vi sóng, Bếp từ, Robot hút bụi,...): <strong>Lừa đảo tiền cọc, tráo đổi linh kiện ngầm, gian lận độ mới và tình trạng thiết bị hư hỏng không đúng như mô tả.</strong>
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm flex items-center gap-2">
                  <span>2. Ba Trụ Cột Đột Phá Công Nghệ</span>
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-[#cea981]/25 flex items-center justify-center text-[#2b1d16] font-black">1</div>
                    <h6 className="font-black text-[#2b1d16] text-xs">Phòng Lab Kiểm Định 48 Bước</h6>
                    <p className="text-xs text-[#2b1d16]/75">Mọi sản phẩm đăng bán đều đi qua quy trình soi bo mạch, đo công suất tiêu thụ điện, thử vắt/thử lạnh thực tế và dán tem chống giả NFC.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-800 font-black">2</div>
                    <h6 className="font-black text-[#2b1d16] text-xs">Bảo Lãnh Thanh Toán Escrow</h6>
                    <p className="text-xs text-[#2b1d16]/75">Tiền mua hàng được giữ an toàn trên Quỹ trung gian Escrow. Người bán chỉ được giải ngân khi người mua kiểm tra nhận hàng hoàn toàn ưng ý.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-teal-600/20 flex items-center justify-center text-teal-800 font-black">3</div>
                    <h6 className="font-black text-[#2b1d16] text-xs">Trợ Lý AI Tư Vấn & Định Giá</h6>
                    <p className="text-xs text-[#2b1d16]/75">Thuật toán AI độc quyền tự động nhận diện thiết bị qua hình ảnh, phân tích lịch sử thị trường để đề xuất mức giá mua bán công bằng nhất.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">3. Thông Tin Trụ Sở & Trụ Trực</h5>
                <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-2 text-xs shadow-xs">
                  <div className="flex items-start gap-2 text-[#2b1d16]">
                    <MapPin className="w-4 h-4 text-[#2b1d16] shrink-0 mt-0.5" />
                    <span><strong>Trụ sở chính:</strong> Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh.</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#2b1d16]">
                    <Mail className="w-4 h-4 text-[#2b1d16] shrink-0" />
                    <span><strong>Email phản hồi chính thức:</strong> noreply.homeappliance@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#2b1d16]">
                    <Phone className="w-4 h-4 text-[#2b1d16] shrink-0" />
                    <span><strong>Hotline hỗ trợ:</strong> 1900 8899 (Hỗ trợ từ 08:00 - 21:00 hàng ngày)</span>
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
                  <h4 className="font-black text-[#2b1d16] text-base">Hệ Thống Kiểm Định Chuyên Sâu SecondLife Hub Lab</h4>
                  <p className="text-xs text-[#2b1d16]/80">Tiêu chuẩn kiểm định thiết bị điện máy nghiêm ngặt nhất Việt Nam với tem niêm phong thông minh NFC.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">1. Quy Trình Kiểm Định 48 Bước Nghiêm Ngặt</h5>
                <p className="text-[#2b1d16]/85">Mỗi món đồ gia dụng gửi tới phòng Lab SecondLife đều trải qua 4 giai đoạn test độc lập bởi Kỹ sư chuyên trách:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#2b1d16]/80">
                  <li><strong>Kiểm tra ngoại quan & Khung vỏ:</strong> Đo độ móp méo, phát hiện vết trầy xước, đo độ cặn vôi lồng giặt và độ kín gioăng cao su tủ lạnh.</li>
                  <li><strong>Đo thông số điện năng năng lượng:</strong> Dùng thiết bị đo dòng ampe, đo điện áp Stator Inverter, đo dòng rò điện bảo vệ an toàn cháy nổ.</li>
                  <li><strong>Thử tải hoạt động thực tế:</strong> Chạy thử máy giặt vắt tốc độ cao 1400 vòng/phút, tủ lạnh làm đông sâu -18°C trong 4 tiếng liên tục.</li>
                  <li><strong>Quét soi bo mạch vi xử lý:</strong> Phát hiện vết hàn sửa chữa chui, soi bo mạch nguồn không tráo đổi linh kiện nguyên bản.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">2. Quy Chuẩn Phân Hạng Chất Lượng (Grade Standards)</h5>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-white border border-emerald-500/40 shadow-xs">
                    <span className="font-black text-emerald-800 text-xs">GRADE S (Like New 98-99%):</span>
                    <span className="text-xs text-[#2b1d16]/85 ml-2">Thiết bị trưng bày hoặc dùng lướt dưới 3 tháng, ngoại hình hoàn hảo không trầy xước, bo mạch dán tem nguyên bản 100%.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-amber-500/40 shadow-xs">
                    <span className="font-black text-amber-800 text-xs">GRADE A (Very Good 90-95%):</span>
                    <span className="text-xs text-[#2b1d16]/85 ml-2">Thiết bị đã qua sử dụng từ 6-12 tháng, hiệu suất hoạt động êm ái, trầy xước nhẹ không ảnh hưởng thẩm mỹ.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-purple-500/40 shadow-xs">
                    <span className="font-black text-purple-800 text-xs">GRADE B (Good 80-89%):</span>
                    <span className="text-xs text-[#2b1d16]/85 ml-2">Thiết bị hoạt động ổn định, giá rẻ tiết kiệm tối đa, đã được Lab bảo dưỡng thay gioăng/vệ sinh lồng giặt tiêu chuẩn.</span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h5 className="font-black text-[#2b1d16] text-sm">3. Tem Niêm Phong Điện Tử NFC Anti-Tamper</h5>
                <p className="text-xs text-[#2b1d16]/85">
                  Mọi sản phẩm sau khi qua phòng Lab đều được dán tem niêm phong mã hóa NFC. Người mua có thể dùng smartphone chạm vào tem để xem lại toàn bộ chứng nhận kiểm định, lịch sử đo điện áp và hình ảnh chụp bo mạch trực tiếp tại phòng Lab.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: QUY CHẾ HOẠT ĐỘNG */}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-amber-500/30 flex items-center gap-3 shadow-xs">
                <Scale className="w-6 h-6 text-amber-700 shrink-0" />
                <div>
                  <h4 className="font-black text-[#2b1d16] text-base">Quy Chế Hoạt Động Sàn Thương Mại Điện Tử SecondLife</h4>
                  <p className="text-xs text-[#2b1d16]/80">Quy định minh bạch bảo vệ quyền lợi hợp pháp của Người mua và Người bán trên nền tảng.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">1. Quy Định Đăng Tin Bán Sản Phẩm</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#2b1d16]/80">
                  <li>Người bán phải thực hiện xác thực danh tính eKYC (CCCD/Hộ chiếu) trước khi đăng bán sản phẩm.</li>
                  <li>Thông tin mô tả, hình ảnh sản phẩm phải là ảnh chụp thực tế sản phẩm hiện tại, không sử dụng ảnh mạng giả mạo.</li>
                  <li>Nghiêm cấm đăng bán sản phẩm là hàng giả, hàng nhái thương hiệu, hàng trộm cắp hoặc hư hỏng nặng không thể sửa chữa.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">2. Quy Trình Giao Dịch & Tín Thác Escrow</h5>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#2b1d16]/80">
                  <li><strong>Đặt mua & Phong tỏa tiền:</strong> Người mua nộp tiền mua hàng vào Quỹ bảo chứng Escrow của SecondLife.</li>
                  <li><strong>Vận chuyển qua Hub Kiểm định:</strong> Sản phẩm được đơn vị vận chuyển lấy về Hub Lab SecondLife để kiểm định 48 bước.</li>
                  <li><strong>Xác nhận nhận hàng:</strong> Nếu kiểm định ĐẠT, hàng được chuyển tới Người mua. Người mua có 24h kiểm tra thực tế.</li>
                  <li><strong>Giải ngân Escrow:</strong> Khi Người mua bấm "Xác nhận nhận hàng" (hoặc quá 24h không có khiếu nại), tiền trong Escrow tự động chuyển về ví Người bán.</li>
                </ol>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">3. Xử Lý Vi Phạm & Khóa Tài Khoản</h5>
                <p className="text-xs text-[#2b1d16]/85">
                  Hệ thống SecondLife áp dụng chế tài nghiêm khắc đối với các hành vi cố tình lừa đảo, tráo linh kiện hoặc khai báo thông tin sai sự thật: Khóa vĩnh viễn tài khoản, tịch thu điểm uy tín và chuyển thông tin cho cơ quan công an xử lý theo quy định pháp luật.
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
                  <h4 className="font-black text-[#2b1d16] text-base">Điều Khoản Dịch Vụ & Bảo Lãnh Tài Chính</h4>
                  <p className="text-xs text-[#2b1d16]/80">Điều khoản pháp lý ràng buộc giữa Người dùng và Nền tảng Thương mại Điện tử SecondLife.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">1. Chấp Nhận Điều Khoản</h5>
                <p className="text-[#2b1d16]/85">
                  Khi đăng ký tài khoản hoặc sử dụng bất kỳ dịch vụ nào trên SecondLife, bạn đồng ý tuân thủ đầy đủ các điều khoản và điều kiện được ghi nhận tại đây. SecondLife có quyền cập nhật điều khoản và thông báo công khai tới người dùng.
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">2. Cơ Chế Tranh Chấp & Hoàn Tiền</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#2b1d16]/80">
                  <li>Nếu sản phẩm không đạt kiểm định tại Hub Lab, đơn hàng tự động hủy và tiền trong Escrow hoàn trả 100% cho Người mua.</li>
                  <li>Nếu sản phẩm nhận được có lỗi trầy xước hỏng hóc khác với báo cáo kiểm định, Người mua có quyền mở "Khiếu nại Escrow" trong vòng 24 giờ.</li>
                  <li>Ban quản trị SecondLife sẽ đóng băng tiền cọc và tiến hành phân xử trọng tài dựa trên dữ liệu camera kiểm định tại Hub Lab.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">3. Giới Hạn Trách Nhiệm</h5>
                <p className="text-xs text-[#2b1d16]/85">
                  SecondLife cam kết chịu trách nhiệm đối với kết quả kiểm định ghi nhận trong chứng nhận Lab và tính an toàn của dòng tiền Escrow. SecondLife không chịu trách nhiệm với các giao dịch thỏa thuận tự phát bên ngoài hệ thống không qua bảo chứng Escrow.
                </p>
              </section>
            </div>
          )}

          {/* TAB 5: CHÍNH SÁCH BẢO MẬT */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-white border border-rose-500/30 flex items-center gap-3 shadow-xs">
                <Lock className="w-6 h-6 text-[#2b1d16] shrink-0" />
                <div>
                  <h4 className="font-black text-[#2b1d16] text-base">Chính Sách Bảo Mật Dữ Liệu Cá Nhân (Privacy Policy)</h4>
                  <p className="text-xs text-[#2b1d16]/80">Cam kết bảo mật an toàn tuyệt đối thông tin người dùng theo tiêu chuẩn SSL 256-bit & PCI-DSS.</p>
                </div>
              </div>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">1. Loại Dữ Liệu Thu Thập</h5>
                <p className="text-[#2b1d16]/85">Chúng tôi chỉ thu thập các dữ liệu cần thiết phục vụ giao dịch và kiểm định an toàn:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#2b1d16]/80">
                  <li>Thông tin tài khoản: Họ tên, Email, Số điện thoại, Ảnh đại diện.</li>
                  <li>Dữ liệu eKYC Người bán: Ảnh CCCD/Hộ chiếu mặt trước/sau và ảnh chân dung đối chiếu.</li>
                  <li>Dữ liệu giao dịch: Lịch sử nộp/rút tiền Escrow, địa chỉ giao nhận hàng.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">2. Cam Kết Không Chia Sẻ Dữ Liệu</h5>
                <p className="text-xs text-[#2b1d16]/85">
                  SecondLife cam kết <strong>tuyệt đối không bán, trao đổi hoặc tiết lộ thông tin cá nhân của người dùng</strong> cho bất kỳ bên thứ ba nào vì mục đích quảng cáo thương mại. Dữ liệu chứng từ eKYC được lưu trữ mã hóa an toàn trên hệ thống máy chủ đám mây Cloudinary & Spring Security.
                </p>
              </section>

              <section className="space-y-3">
                <h5 className="font-black text-[#2b1d16] text-sm">3. Quyền Lợi Dữ Liệu Của Người Dùng</h5>
                <p className="text-xs text-[#2b1d16]/85">
                  Người dùng có toàn quyền xem, cập nhật hoặc yêu cầu xóa bỏ dữ liệu cá nhân của mình bất kỳ lúc nào thông qua phần Cài đặt Hồ sơ hoặc gửi yêu cầu tới email hỗ trợ chính thức: <strong>noreply.homeappliance@gmail.com</strong>.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-[#2b1d16]/15 bg-[#cea981] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[#2b1d16]/80 font-bold">
            <Mail className="w-4 h-4 text-[#2b1d16]" />
            <span>Email hỗ trợ: <strong className="text-[#2b1d16] font-black">noreply.homeappliance@gmail.com</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#2b1d16] text-white font-black text-xs hover:bg-[#3d2a20] transition cursor-pointer shadow-md"
          >
            {lang === 'vi' ? 'Đã Hiểu & Đồng Ý' : 'I Understand & Agree'}
          </button>
        </div>
      </div>
    </div>
  );
};
