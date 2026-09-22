import React, { useState } from 'react';
import { EscrowOrder, DisputeCase, Listing, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ShieldAlert, CheckCircle2, Download, Gavel, Sparkles, Sliders, FileSpreadsheet } from 'lucide-react';

interface AdminDashboardViewProps {
  orders: EscrowOrder[];
  disputes: DisputeCase[];
  listings: Listing[];
  onResolveDispute: (disputeId: string, decision: 'REFUND_BUYER' | 'RELEASE_SELLER') => void;
  lang: Language;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  orders,
  disputes,
  listings,
  onResolveDispute,
  lang
}) => {
  const t = translations[lang];

  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || '');
  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

  const [duplicateThreshold, setDuplicateThreshold] = useState(85);
  const [priceAnomalyThreshold, setPriceAnomalyThreshold] = useState(45);
  const [modelVersion] = useState('LightGBM-v3.4-Ensemble-Gemini3.8');

  const totalGmv = orders.reduce((sum, o) => sum + o.itemPriceVnd, 0) + 185000000;
  const escrowHeld = orders
    .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
    .reduce((sum, o) => sum + o.totalPaidVnd, 0);
  const platformEarnings = Math.round(totalGmv * 0.025);

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExport = (format: 'CSV' | 'PDF') => {
    setExportNotice(`Đang tạo tệp báo cáo ${format}... Báo cáo thống kê GMV và đối soát Escrow đã được tải xuống.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="space-y-8 pb-16 text-[#0E121B]">
      {/* Admin Header */}
      <div className="bg-[#0E121B] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>Cổng Giám Sát Điều Hành Nền Tảng (Admin & Trust Control)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
              {t.adminDashboardTitle}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 mt-1">
              Quản trị rủi ro thanh toán Escrow, bàn trọng tài giải quyết tranh chấp và tinh chỉnh thuật toán AI định giá.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('CSV')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Xuất CSV</span>
            </button>
            <button
              onClick={() => handleExport('PDF')}
              className="px-3.5 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Báo Cáo PDF</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">Tổng GMV Giao Dịch</div>
            <div className="text-xl sm:text-2xl font-black text-[#0E121B]">{formatVND(totalGmv)}</div>
          </div>

          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">Tiền đang giữ trong Escrow</div>
            <div className="text-xl sm:text-2xl font-black text-[#EC1577]">{formatVND(escrowHeld)}</div>
          </div>

          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">Doanh thu phí sàn (2.5%)</div>
            <div className="text-xl sm:text-2xl font-black text-[#0E121B]">{formatVND(platformEarnings)}</div>
          </div>

          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">Tỷ lệ tranh chấp (Dispute)</div>
            <div className="text-xl sm:text-2xl font-black text-[#0E121B]">0.82%</div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3.5 rounded-2xl bg-[#0E121B] border border-white/10 text-white font-semibold text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#EC1577]" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Main Grid: Dispute Arbitration & AI Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Dispute Cases */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0E121B] uppercase tracking-wider flex items-center gap-1.5">
              <Gavel className="w-4 h-4 text-[#EC1577]" />
              <span>Bàn Trọng Tài Tranh Chấp ({disputes.length})</span>
            </h2>
            <span className="text-[11px] bg-[#EC1577]/20 text-[#EC1577] font-bold px-2 py-0.5 rounded-md border border-[#EC1577]/30">
              Cần phân xử
            </span>
          </div>

          <div className="space-y-3">
            {disputes.map((disp) => {
              const isSelected = disp.id === activeDispute?.id;
              return (
                <div
                  key={disp.id}
                  onClick={() => setSelectedDisputeId(disp.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#0E121B] text-white border-[#0E121B] shadow-md'
                      : 'bg-[#FFFFFF] border-gray-200 hover:border-[#EC1577] text-[#0E121B]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] opacity-80">
                    <span className="font-mono font-bold">#{disp.id}</span>
                    <span>{new Date(disp.openedAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="text-xs font-bold mt-1">
                    Lý do: {disp.reason === 'NOT_AS_DESCRIBED' ? 'Hàng không đúng mô tả' : 'Hàng giả / hư hỏng'}
                  </div>

                  <p className="text-xs opacity-75 mt-1 line-clamp-2">
                    "{disp.description}"
                  </p>

                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="opacity-70">Người khiếu nại: {disp.buyerName}</span>
                    <span className="font-bold text-[#EC1577]">Xem chứng cứ &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Dispute Evidence Review & Arbitration Action */}
        <div className="lg:col-span-8 space-y-6">
          {activeDispute ? (
            <div className="bg-[#FFFFFF] rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-extrabold text-[#0E121B]">
                    Hồ Sơ Trọng Tài #{activeDispute.id} (Đơn hàng #{activeDispute.orderId})
                  </h3>
                  <div className="text-xs text-[#0E121B]/70 mt-0.5">
                    Người mua: <span className="font-bold text-[#0E121B]">{activeDispute.buyerName}</span> vs Người bán: <span className="font-bold text-[#0E121B]">{activeDispute.sellerName}</span>
                  </div>
                </div>

                <span className="bg-[#EC1577]/20 text-[#EC1577] border border-[#EC1577]/30 text-xs font-bold px-2.5 py-1 rounded-full">
                  Trạng thái: Chờ Admin phán quyết
                </span>
              </div>

              {/* Multi-Version Photo Evidence */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#0E121B] uppercase tracking-wider">
                  Đối chiếu ảnh 3 giai đoạn làm bằng chứng tranh tụng:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-gray-200 rounded-2xl p-3 bg-[#F4F5F8] space-y-1.5">
                    <div className="text-[11px] font-bold text-[#0E121B]">1. Ảnh niêm yết của Người bán</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#FFFFFF] border border-gray-200">
                      <img
                        src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80"
                        alt="Seller declaration"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-[#0E121B]/60">Khai báo: Like New 99%</div>
                  </div>

                  <div className="border border-gray-200 rounded-2xl p-3 bg-[#F4F5F8] space-y-1.5">
                    <div className="text-[11px] font-bold text-[#0E121B]">2. Ảnh kiểm định của Trung tâm</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#FFFFFF] border border-gray-200">
                      <img
                        src="https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=600&q=80"
                        alt="Inspection center"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-[#0E121B]/70 font-mono">Tem NFC: SL-NFC-8829104</div>
                  </div>

                  <div className="border border-gray-200 rounded-2xl p-3 bg-[#F4F5F8] space-y-1.5">
                    <div className="text-[11px] font-bold text-[#0E121B]">3. Ảnh bóc hộp Người mua khiếu nại</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#FFFFFF] border border-gray-200">
                      <img
                        src="https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80"
                        alt="Buyer claim evidence"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-[#0E121B]/70">Bằng chứng: Vết xước 4mm góc kính</div>
                  </div>
                </div>
              </div>

              {/* Statement of Claim */}
              <div className="bg-[#F4F5F8] p-4 rounded-2xl border border-gray-200 text-xs text-[#0E121B] space-y-1">
                <div className="font-bold text-[#0E121B]">Nội dung khiếu nại từ Người mua:</div>
                <p className="italic">"{activeDispute.description}"</p>
              </div>

              {/* AI Evidence Processing & Auto-Arbitration Recommendation Engine */}
              <div className="bg-[#0E121B] text-white rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                        <span>AI Vision & Evidence Engine - Phân Tích Bằng Chứng Tự Động</span>
                      </h4>
                      <div className="text-[10px] text-white/70">
                        Độ tin cậy thuật toán: <span className="font-bold text-white">94.8% Match & Defect Analysis</span>
                      </div>
                    </div>
                  </div>
                  <span className="bg-white/10 text-white border border-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    AI Đã Xử Lý Bằng Chứng
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                    <div className="text-[11px] font-semibold text-white">🔍 Phân tích ảnh 3D (Vector Similarity):</div>
                    <p className="text-white/70 text-[11px] leading-relaxed">
                      • Ảnh Hub kiểm định vs Ảnh bóc hộp Buyer: <span className="font-bold text-white">96.4% tương đồng</span>.<br />
                      • Phát hiện vết xước móp 4.2mm xuất hiện sau thời điểm tem niêm phong <span className="font-mono text-white">#SL-HOME-8829104</span> được dán.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                    <div className="text-[11px] font-semibold text-white">🛡️ Đánh giá nguồn gốc hư hỏng (Defect Origin):</div>
                    <p className="text-white/70 text-[11px] leading-relaxed">
                      • Nguồn gốc: <span className="font-bold text-white">Va đập trong vận chuyển (GHTK Transit Damage)</span>.<br />
                      • Đề xuất bảo hiểm: Thuộc phạm vi bảo vệ 100% của Bảo Hiểm Vận Chuyển Ký Quỹ Escrow.
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-[11px] uppercase font-bold text-white/70 tracking-wider">
                      🤖 Đề Xuất Phán Quyết Từ AI (AI Recommended Verdict):
                    </div>
                    <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
                      <span>HOÀN TIỀN 100% CHO NGƯỜI MUA (REFUND BUYER & BẢO HIỂM)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onResolveDispute(activeDispute.id, 'REFUND_BUYER')}
                    className="px-4 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition"
                  >
                    <Gavel className="w-3.5 h-3.5 text-white" />
                    <span>[Admin Duyệt & Phán Quyết Kế Thừa AI]</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#0E121B]/70 text-[11px]">Tùy chọn kiểm duyệt & can thiệp thủ công từ Admin:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onResolveDispute(activeDispute.id, 'REFUND_BUYER')}
                    className="px-3 py-1.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                  >
                    Chấp nhận Hoàn Tiền Buyer
                  </button>
                  <button
                    onClick={() => onResolveDispute(activeDispute.id, 'RELEASE_SELLER')}
                    className="px-3 py-1.5 bg-[#0E121B] hover:bg-[#0E121B]/80 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                  >
                    Bác khiếu nại (Giải ngân Seller)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] rounded-3xl p-8 text-center border border-gray-200 text-[#0E121B]">
              <CheckCircle2 className="w-10 h-10 text-[#EC1577] mx-auto mb-2" />
              <div className="font-bold text-[#0E121B]">Không có tranh chấp nào cần xử lý</div>
            </div>
          )}

          {/* AI Model Configuration & Fraud Threshold Control */}
          <div className="bg-[#FFFFFF] rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4 text-[#0E121B]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0E121B] text-[#EC1577] flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0E121B]">
                  Cấu Hình Mô Hình AI Định Giá & Bộ Lọc Gian Lận
                </h3>
                <p className="text-xs text-[#0E121B]/70">
                  Version hiện hành: <span className="font-mono font-bold text-[#EC1577]">{modelVersion}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-[#F4F5F8] p-3.5 rounded-2xl border border-gray-200">
                <div className="flex justify-between font-semibold text-[#0E121B]">
                  <span>Ngưỡng phát hiện ảnh sao chép (Image Similarity):</span>
                  <span className="font-bold text-[#EC1577]">{duplicateThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={98}
                  value={duplicateThreshold}
                  onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                  className="w-full accent-[#EC1577] cursor-pointer"
                />
                <div className="text-[10px] text-[#0E121B]/60">
                  Tự động chặn tin đăng nếu ảnh trùng lặp &gt; {duplicateThreshold}% với các tin cũ trên Facebook/Chợ Tốt.
                </div>
              </div>

              <div className="space-y-1.5 bg-[#F4F5F8] p-3.5 rounded-2xl border border-gray-200">
                <div className="flex justify-between font-semibold text-[#0E121B]">
                  <span>Cảnh báo giá bất thường (Price Anomaly):</span>
                  <span className="font-bold text-[#EC1577]">&lt; {priceAnomalyThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={priceAnomalyThreshold}
                  onChange={(e) => setPriceAnomalyThreshold(Number(e.target.value))}
                  className="w-full accent-[#EC1577] cursor-pointer"
                />
                <div className="text-[10px] text-[#0E121B]/60">
                  Bắt buộc kiểm định nếu giá niêm yết thấp hơn {priceAnomalyThreshold}% giá thị trường (tránh hàng nhái).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
