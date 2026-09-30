import React, { useState } from 'react';
import {
  FileCheck,
  AlertTriangle,
  Image,
  ShieldCheck,
  Flag,
  Scale,
  Send,
  RotateCcw,
  Wallet,
  Truck,
  CheckCircle2,
  TrendingUp,
  UserX,
  LifeBuoy,
  Search,
  Filter,
  Eye,
  Check,
  X,
  MessageSquare,
  Lock,
  Unlock,
  Building2,
  AlertCircle
} from 'lucide-react';
import { Listing, EscrowOrder, Language } from '../types';
import { formatVND } from '../utils/translations';

interface StaffWorkspaceViewProps {
  listings?: Listing[];
  orders?: EscrowOrder[];
  lang?: Language;
}

export const StaffWorkspaceView: React.FC<StaffWorkspaceViewProps> = ({
  listings = [],
  orders = [],
  lang = 'vi',
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'review-listings'
    | 'suspicious-listings'
    | 'duplicate-images'
    | 'proof-possession'
    | 'reports'
    | 'disputes'
    | 'request-evidence'
    | 'refund-requests'
    | 'payouts'
    | 'coordinate-inspection'
    | 'inspection-results'
    | 'monitor-transactions'
    | 'restrict-users'
    | 'support-tickets'
  >('review-listings');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Mock State for Staff Management
  const [reports, setReports] = useState([
    { id: 'REP-101', target: 'Bài tin #POST-8821', reporter: 'hoang.nam@gmail.com', reason: 'Nghi vấn sản phẩm hàng nhái thương hiệu Hitachi', status: 'PENDING', createdAt: '2026-09-29 10:15' },
    { id: 'REP-102', target: 'Người bán TuanStore', reporter: 'minh.tuan@gmail.com', reason: 'Yêu cầu chuyển khoản ngoài hệ thống Escrow', status: 'PENDING', createdAt: '2026-09-29 09:40' },
  ]);

  const [disputes, setDisputes] = useState([
    { id: 'DSP-501', orderId: 'ORD-99120', buyer: 'Lê Văn An', seller: 'Hoàng Quốc Khang', amount: 14500000, reason: 'Tủ lạnh hỏng blốc nén khi giao tới nơi', status: 'IN_REVIEW', buyerEvidence: 'video_hONG_BLOCK.mp4', sellerEvidence: 'bien_ban_HUB.pdf' },
    { id: 'DSP-502', orderId: 'ORD-88102', buyer: 'Trần Thị Mai', seller: 'Cửa Hàng Điện Máy Cũ', amount: 8900000, reason: 'Máy giặt bị rò nước lồng sấy', status: 'WAITING_EVIDENCE', buyerEvidence: 'anh_ro_nuoc.jpg', sellerEvidence: '' },
  ]);

  const [payouts, setPayouts] = useState([
    { id: 'PAY-801', sellerName: 'Hoàng Quốc Khang', amount: 14500000, bank: 'Vietcombank - 991204882', status: 'HOLD', reason: 'Đang có khiếu nại tranh chấp đơn #ORD-99120' },
    { id: 'PAY-802', sellerName: 'Nguyễn Minh Tuấn', amount: 42800000, bank: 'MBBank - 10298839', status: 'APPROVED', reason: 'Đã hoàn tất kiểm định Hub & Người mua xác nhận' },
  ]);

  const [supportTickets, setSupportTickets] = useState([
    { id: 'TCK-301', user: 'pham.nam@gmail.com', subject: 'Thắc mắc quy trình giải ngân Escrow', priority: 'HIGH', status: 'OPEN', updatedAt: '10 phút trước' },
    { id: 'TCK-302', user: 'hoang.store@gmail.com', subject: 'Hướng dẫn nộp lại ảnh eKYC CCCD bị mờ', priority: 'MEDIUM', status: 'OPEN', updatedAt: '25 phút trước' },
  ]);

  const [restrictedUsers, setRestrictedUsers] = useState([
    { id: 'USR-991', name: 'Trần Văn Hùng', email: 'hung.spam@gmail.com', role: 'SELLER', status: 'WARNED', reason: 'Đăng lặp lại 15 tin rác' },
  ]);

  const navItems = [
    { id: 'review-listings', label: '1. Review Listings', icon: FileCheck, badge: listings.length },
    { id: 'suspicious-listings', label: '2. Review Suspicious Listings', icon: AlertTriangle, badge: 2 },
    { id: 'duplicate-images', label: '3. Review Duplicate Images', icon: Image, badge: 1 },
    { id: 'proof-possession', label: '4. Verify Proof of Possession', icon: ShieldCheck, badge: 3 },
    { id: 'reports', label: '5. Handle Reports', icon: Flag, badge: reports.filter(r => r.status === 'PENDING').length },
    { id: 'disputes', label: '6. Handle Disputes', icon: Scale, badge: disputes.length },
    { id: 'request-evidence', label: '7. Request Additional Evidence', icon: Send, badge: 1 },
    { id: 'refund-requests', label: '8. Review Refund Requests', icon: RotateCcw, badge: 2 },
    { id: 'payouts', label: '9. Review / Approve / Hold Payouts', icon: Wallet, badge: payouts.filter(p => p.status === 'HOLD').length },
    { id: 'coordinate-inspection', label: '10. Coordinate Inspection', icon: Truck, badge: 4 },
    { id: 'inspection-results', label: '11. View Inspection Results', icon: CheckCircle2, badge: orders.length },
    { id: 'monitor-transactions', label: '12. Monitor Transactions', icon: TrendingUp, badge: null },
    { id: 'restrict-users', label: '13. Warn / Restrict Users', icon: UserX, badge: restrictedUsers.length },
    { id: 'support-tickets', label: '14. Handle Support Tickets', icon: LifeBuoy, badge: supportTickets.filter(t => t.status === 'OPEN').length },
  ];

  return (
    <div className="space-y-6 pb-16 text-[#2b1d16]">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#cea981] via-[#d4b28c] to-[#ebdccb] text-[#2b1d16] rounded-3xl p-6 sm:p-8 shadow-lg border border-[#cea981]/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#2b1d16]/15 text-[#2b1d16] text-xs font-bold shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-[#2b1d16]" />
              <span>{lang === 'vi' ? 'Không Gian Làm Việc Nhân Viên Ban Quản Trị (Staff & Inspector Workspace)' : 'Staff & Inspector Operational Portal'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-[#2b1d16]">
              {lang === 'vi' ? 'Trung Tâm Xử Lý Nghiệp Vụ & Giám Sát Sàn SecondLife' : 'Staff Operations & Moderation Center'}
            </h1>
            <p className="text-xs sm:text-sm text-[#2b1d16]/85 font-semibold mt-1">
              Quản lý kiểm duyệt tin đăng, giải quyết khiếu nại tranh chấp, kiểm soát Escrow & điều phối kiểm định Hub
            </p>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#2b1d16]/15 text-xs">
          <div className="bg-white/80 rounded-2xl p-3 border border-[#cea981]/40 shadow-xs">
            <span className="text-[#2b1d16]/70 block font-bold">Tin đăng cần duyệt</span>
            <span className="text-xl font-black text-[#2b1d16]">{listings.length}</span>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 border border-[#cea981]/40 shadow-xs">
            <span className="text-[#2b1d16]/70 block font-bold">Tranh chấp mở</span>
            <span className="text-xl font-black text-rose-700">{disputes.length}</span>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 border border-[#cea981]/40 shadow-xs">
            <span className="text-[#2b1d16]/70 block font-bold">Đơn Escrow đang tạm giữ</span>
            <span className="text-xl font-black text-amber-700">{payouts.filter(p => p.status === 'HOLD').length}</span>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 border border-[#cea981]/40 shadow-xs">
            <span className="text-[#2b1d16]/70 block font-bold">Ticket hỗ trợ chờ xử lý</span>
            <span className="text-xl font-black text-emerald-800">{supportTickets.filter(t => t.status === 'OPEN').length}</span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Staff 14-Feature Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation Tree Sidebar (14 Menu Items) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-3 block mb-2">
              Danh Mục Nghiệp Vụ Staff (14 Modules)
            </span>
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#2b1d16] text-white shadow-md'
                      : 'bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#cea981]' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive ? 'bg-amber-400 text-black' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Dynamic Feature Workspace */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm min-h-[520px]">
            {/* 1. Review Listings */}
            {activeTab === 'review-listings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">1. Review Listings (Kiểm Duyệt Bài Đăng Mới)</h3>
                    <p className="text-xs text-slate-500">Thẩm định thông tin mô tả, danh mục và đề xuất giá định giá từ AI</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {listings.map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl border border-gray-200 bg-slate-50 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=150&q=80'} alt="" className="w-14 h-14 rounded-xl object-cover border" />
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md">{item.category}</span>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">{item.title}</h4>
                          <p className="text-[11px] text-slate-500">Người bán: {item.sellerName} • Giá niêm yết: {formatVND(item.priceVnd)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => triggerNotice(`Đã phê duyệt công khai bài đăng: ${item.title}`)} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <Check className="w-3.5 h-3.5" /> Duyệt Bài
                        </button>
                        <button onClick={() => triggerNotice(`Đã từ chối bài đăng: ${item.title}`)} className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <X className="w-3.5 h-3.5" /> Từ Chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Review Suspicious Listings */}
            {activeTab === 'suspicious-listings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-rose-900 uppercase">2. Review Suspicious Listings (Rà Soát Bài Đăng Nghi Vấn AI)</h3>
                    <p className="text-xs text-slate-500">Các bài đăng bị AI gắn cờ do chênh lệch giá bất thường hoặc mô tả bất thường</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-rose-900">#FLAG-8891 • Tủ Lạnh Hitachi Side-by-Side 540L</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">Giá người bán đặt: <strong>3.500.000đ</strong> (AI Định giá khuyến nghị: 18.500.000đ - Rủi ro phá giá / Hàng hỏng nặng)</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-rose-200 text-rose-900 font-bold text-[10px]">Cảnh báo rủi ro 92%</span>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-rose-200">
                    <button onClick={() => triggerNotice('Đã yêu cầu người bán giải trình mức giá')} className="px-3 py-1.5 bg-white border border-rose-300 text-rose-900 rounded-xl font-bold cursor-pointer">Yêu cầu giải trình</button>
                    <button onClick={() => triggerNotice('Đã khóa bài đăng nghi vấn')} className="px-3 py-1.5 bg-rose-700 text-white rounded-xl font-bold cursor-pointer">Tạm Ẩn Bài Đăng</button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Review Duplicate Images */}
            {activeTab === 'duplicate-images' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">3. Review Duplicate Images (Đối Soát Ảnh Trùng Lặp)</h3>
                  <p className="text-xs text-slate-500">Thuật toán AI Image Hashing phát hiện ảnh lấy từ Google / Shopee</p>
                </div>
                <div className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-2">
                  <span className="font-bold text-slate-800">Bài tin #POST-9912 sử dụng bộ ảnh trùng 99% với tin bài #POST-4401</span>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => triggerNotice('Đã cảnh báo người bán về bản quyền hình ảnh')} className="px-3 py-1.5 bg-[#2b1d16] text-white rounded-xl font-bold cursor-pointer">Cảnh Báo Vi Phạm Ảnh</button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Verify Proof of Possession */}
            {activeTab === 'proof-possession' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">4. Verify Proof of Possession (Xác Minh Chính Chủ)</h3>
                  <p className="text-xs text-slate-500">Xác minh ảnh chụp kèm mã Serial Number & Tờ giấy ghi tên gian hàng</p>
                </div>
                <div className="p-4 rounded-2xl border bg-emerald-50/60 border-emerald-200 text-xs space-y-2">
                  <span className="font-bold text-emerald-900">Yêu cầu xác minh từ Seller: Hoàng Quốc Khang (Ảnh Serial: SN-HITACHI-99201)</span>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => triggerNotice('Đã phê duyệt bằng chứng sở hữu sản phẩm!')} className="px-3 py-1.5 bg-emerald-700 text-white rounded-xl font-bold cursor-pointer">Xác Nhận Chính Chủ</button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Handle Reports */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">5. Handle Reports (Xử Lý Báo Cáo Vi Phạm)</h3>
                  <p className="text-xs text-slate-500">Danh sách báo cáo vi phạm từ cộng đồng người mua & người bán</p>
                </div>
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <div key={rep.id} className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{rep.id} • {rep.target}</span>
                        <span className="text-slate-400">{rep.createdAt}</span>
                      </div>
                      <p className="text-slate-600">Lý do báo cáo: <strong>{rep.reason}</strong> (Bởi {rep.reporter})</p>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => triggerNotice(`Đã xử lý báo cáo ${rep.id}`)} className="px-3 py-1.5 bg-[#2b1d16] text-white rounded-xl font-bold cursor-pointer">Xử Lý & Cảnh Báo</button>
                        <button onClick={() => triggerNotice(`Đã bác bỏ báo cáo ${rep.id}`)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Bác Bỏ</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Handle Disputes */}
            {activeTab === 'disputes' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">6. Handle Disputes (Phân Xử Tranh Chấp Trực Tiếp)</h3>
                  <p className="text-xs text-slate-500">Hội đồng trọng tài phân xử khiếu nại giữa Người mua & Người bán khi Escrow bị đóng băng</p>
                </div>
                <div className="space-y-3">
                  {disputes.map((dsp) => (
                    <div key={dsp.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Mã Tranh Chấp: {dsp.id} (Đơn hàng #{dsp.orderId})</span>
                        <span className="text-amber-800 font-black">{formatVND(dsp.amount)}</span>
                      </div>
                      <p className="text-slate-700">Người mua: <strong>{dsp.buyer}</strong> VS Người bán: <strong>{dsp.seller}</strong></p>
                      <p className="text-rose-800 font-medium">Nội dung khiếu nại: {dsp.reason}</p>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => triggerNotice(`Đã phán quyết hoàn tiền 100% cho người mua đơn ${dsp.orderId}`)} className="px-3 py-1.5 bg-emerald-700 text-white rounded-xl font-bold cursor-pointer">Hoàn Tiền Cho Người Mua</button>
                        <button onClick={() => triggerNotice(`Đã phán quyết giải ngân cho người bán đơn ${dsp.orderId}`)} className="px-3 py-1.5 bg-[#2b1d16] text-white rounded-xl font-bold cursor-pointer">Giải Ngân Cho Người Bán</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Request Additional Evidence */}
            {activeTab === 'request-evidence' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">7. Request Additional Evidence (Yêu Cầu Bổ Sung Bằng Chứng)</h3>
                  <p className="text-xs text-slate-500">Gửi thông báo yêu cầu người mua / người bán quay video mở hộp / chụp lại tem mác</p>
                </div>
                <div className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-3">
                  <label className="font-bold text-slate-800 block">Nội dung yêu cầu bổ sung bằng chứng:</label>
                  <textarea rows={3} placeholder="VD: Yêu cầu người mua cung cấp video quay lại quá trình cắm điện tủ lạnh lần đầu..." className="w-full p-3 border rounded-xl bg-white text-xs" />
                  <button onClick={() => triggerNotice('Đã gửi yêu cầu bổ sung bằng chứng tới 2 bên')} className="px-4 py-2 bg-[#2b1d16] text-white font-bold rounded-xl text-xs cursor-pointer">Gửi Yêu Cầu</button>
                </div>
              </div>
            )}

            {/* 8. Review Refund Requests */}
            {activeTab === 'refund-requests' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">8. Review Refund Requests (Thẩm Định Yêu Cầu Hoàn Tiền)</h3>
                  <p className="text-xs text-slate-500">Duyệt lệnh hoàn tiền lại vào tài khoản ngân hàng của người mua</p>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 text-xs space-y-2">
                  <span className="font-bold text-emerald-900">Đơn hàng #ORD-77102 • Số tiền refund: 8.900.000đ</span>
                  <p className="text-slate-600">Lý do: Đã kiểm định lại tại Hub xác nhận thiết bị lỗi mainboard nguyên bản.</p>
                  <button onClick={() => triggerNotice('Đã duyệt lệnh hoàn tiền 8.900.000đ qua Quỹ Escrow')} className="px-4 py-2 bg-emerald-700 text-white rounded-xl font-bold cursor-pointer">Duyệt Hoàn Tiền Ngay</button>
                </div>
              </div>
            )}

            {/* 9. Review / Approve / Hold Payouts */}
            {activeTab === 'payouts' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">9. Review / Approve / Hold Payouts (Kiểm Soát Rút Tiền Escrow)</h3>
                  <p className="text-xs text-slate-500">Tạm giữ hoặc Phê duyệt giải ngân dòng tiền bán hàng của người bán</p>
                </div>
                <div className="space-y-3">
                  {payouts.map((pay) => (
                    <div key={pay.id} className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{pay.sellerName} ({pay.bank})</span>
                        <span className="text-emerald-700 font-black">{formatVND(pay.amount)}</span>
                      </div>
                      <p className="text-slate-500">Ghi chú: {pay.reason}</p>
                      <div className="flex gap-2 pt-2">
                        {pay.status === 'HOLD' ? (
                          <button onClick={() => triggerNotice(`Đã giải tỏa lệnh rút tiền ${pay.id}`)} className="px-3 py-1.5 bg-emerald-700 text-white rounded-xl font-bold cursor-pointer">Phê Duyệt Giải Ngân</button>
                        ) : (
                          <button onClick={() => triggerNotice(`Đã tạm dừng lệnh rút tiền ${pay.id}`)} className="px-3 py-1.5 bg-amber-700 text-white rounded-xl font-bold cursor-pointer">Tạm Giữ Tiền</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. Coordinate Inspection */}
            {activeTab === 'coordinate-inspection' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">10. Coordinate Inspection (Điều Phối Kiểm Định Hub)</h3>
                  <p className="text-xs text-slate-500">Sắp xếp lịch bưu tá GHTK/GHN lấy thiết bị về Hub kiểm định</p>
                </div>
                <div className="p-4 rounded-2xl border bg-blue-50/50 border-blue-200 text-xs space-y-2">
                  <span className="font-bold text-blue-900">Đơn hàng #ORD-55102 • Thiết bị: Tủ Lạnh Hitachi 540L</span>
                  <p className="text-slate-600">Kho lấy hàng: 180 Cầu Giấy, Hà Nội ➔ Hub Cầu Giấy</p>
                  <button onClick={() => triggerNotice('Đã tạo vận đơn điều phối bưu tá GHTK qua Hub')} className="px-4 py-2 bg-blue-700 text-white rounded-xl font-bold cursor-pointer">Tạo Vận Đơn Lấy Hàng</button>
                </div>
              </div>
            )}

            {/* 11. View Inspection Results */}
            {activeTab === 'inspection-results' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">11. View Inspection Results (Xem Kết Quả Kiểm Định 3D/NFC)</h3>
                  <p className="text-xs text-slate-500">Tra cứu báo cáo kỹ thuật phần cứng do Kỹ sư Hub nghiệm thu</p>
                </div>
                <div className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Đơn #ORD-99120 • Tem NFC: #SL-HOME-8839</span>
                    <span className="text-emerald-700 font-bold">ĐẠT CHUẨN (PASS)</span>
                  </div>
                  <p className="text-slate-600">Kết quả: Máy nén Gas R600a siêu êm (-19.2°C), tem niêm phong nguyên bản Grade A.</p>
                </div>
              </div>
            )}

            {/* 12. Monitor Transactions */}
            {activeTab === 'monitor-transactions' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">12. Monitor Transactions (Giám Sát Luồng Giao Dịch)</h3>
                  <p className="text-xs text-slate-500">Theo dõi dòng tiền nạp/rút và số dư bảo chứng Escrow thời gian thực</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border">
                    <span className="text-slate-500 block font-bold">Tổng dòng tiền Escrow đang phong tỏa</span>
                    <span className="text-xl font-black text-[#2b1d16]">185.000.000đ</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border">
                    <span className="text-slate-500 block font-bold">Tổng phí dịch vụ sàn thu được (2.5%)</span>
                    <span className="text-xl font-black text-emerald-800">12.450.000đ</span>
                  </div>
                </div>
              </div>
            )}

            {/* 13. Warn / Restrict Users */}
            {activeTab === 'restrict-users' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">13. Warn / Restrict Users (Cảnh Báo & Giới Hạn Tài Khoản)</h3>
                  <p className="text-xs text-slate-500">Gửi cảnh báo hoặc tạm khóa/giới hạn quyền đăng bài của người dùng vi phạm</p>
                </div>
                <div className="space-y-3">
                  {restrictedUsers.map((usr) => (
                    <div key={usr.id} className="p-4 rounded-2xl border bg-slate-50 text-xs flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-slate-900">{usr.name} ({usr.email})</span>
                        <p className="text-slate-500">Lý do: {usr.reason}</p>
                      </div>
                      <button onClick={() => triggerNotice(`Đã khóa quyền đăng bài tài khoản ${usr.email}`)} className="px-3 py-1.5 bg-rose-700 text-white font-bold rounded-xl cursor-pointer">Khóa Quyền Đăng Bài</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 14. Handle Support Tickets */}
            {activeTab === 'support-tickets' && (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase">14. Handle Support Tickets (Xử Lý Yêu Cầu Hỗ Trợ CSKH)</h3>
                  <p className="text-xs text-slate-500">Giải đáp thắc mắc và hỗ trợ kỹ thuật trực tiếp cho người dùng</p>
                </div>
                <div className="space-y-3">
                  {supportTickets.map((tck) => (
                    <div key={tck.id} className="p-4 rounded-2xl border bg-slate-50 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{tck.id} • {tck.subject}</span>
                        <span className="text-amber-800">{tck.priority}</span>
                      </div>
                      <p className="text-slate-500">Người gửi: {tck.user} ({tck.updatedAt})</p>
                      <button onClick={() => triggerNotice(`Đã mở cửa sổ phản hồi ticket ${tck.id}`)} className="px-3 py-1.5 bg-[#2b1d16] text-white rounded-xl font-bold cursor-pointer">Trả Lời Hỗ Trợ</button>
                    </div>
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
