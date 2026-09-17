import React, { useState } from 'react';
import { EscrowOrder, DisputeCase, Listing, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ShieldAlert, TrendingUp, DollarSign, CheckCircle2, AlertTriangle, Download, Eye, Gavel, Sparkles, Sliders, FileSpreadsheet, Lock } from 'lucide-react';

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

  // Selected Dispute for Arbitration Workbench
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || '');
  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

  // AI Model Tuning State
  const [duplicateThreshold, setDuplicateThreshold] = useState(85);
  const [priceAnomalyThreshold, setPriceAnomalyThreshold] = useState(45);
  const [modelVersion, setModelVersion] = useState('LightGBM-v3.4-Ensemble-Gemini3.8');

  // Business Metrics Calculations
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
    <div className="space-y-8 pb-16">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-purple-900/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cổng Giám Sát Điều Hành Nền Tảng (Admin & Trust Control)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 font-['Outfit']">
              {t.adminDashboardTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Quản trị rủi ro thanh toán Escrow, bàn trọng tài giải quyết tranh chấp và tinh chỉnh thuật toán AI định giá.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('CSV')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất CSV</span>
            </button>
            <button
              onClick={() => handleExport('PDF')}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Báo Cáo PDF</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Tổng GMV Giao Dịch</div>
            <div className="text-xl sm:text-2xl font-black text-white font-['Outfit']">{formatVND(totalGmv)}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Tiền đang giữ trong Escrow</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-['Outfit']">{formatVND(escrowHeld)}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Doanh thu phí sàn (2.5%)</div>
            <div className="text-xl sm:text-2xl font-black text-teal-300 font-['Outfit']">{formatVND(platformEarnings)}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Tỷ lệ tranh chấp (Dispute)</div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 font-['Outfit']">0.82%</div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Main Grid: Dispute Arbitration & AI Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Dispute Cases (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Gavel className="w-4 h-4 text-purple-600" />
              <span>Bàn Trọng Tài Tranh Chấp ({disputes.length})</span>
            </h2>
            <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md">
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
                  className={`p-4 rounded-2xl border transition cursor-pointer ${isSelected
                      ? 'bg-purple-50/70 border-purple-500 shadow-md ring-2 ring-purple-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono font-bold text-slate-800">#{disp.id}</span>
                    <span>{new Date(disp.openedAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="text-xs font-bold text-red-600 mt-1">
                    Lý do: {disp.reason === 'NOT_AS_DESCRIBED' ? 'Hàng không đúng mô tả' : 'Hàng giả / hư hỏng'}
                  </div>

                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    "{disp.description}"
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Người khiếu nại: {disp.buyerName}</span>
                    <span className="font-bold text-purple-700">Xem chứng cứ &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Dispute Evidence Review & Arbitration Action (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeDispute ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-['Outfit']">
                    Hồ Sơ Trọng Tài #{activeDispute.id} (Đơn hàng #{activeDispute.orderId})
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Người mua: <span className="font-bold text-slate-800">{activeDispute.buyerName}</span> vs Người bán: <span className="font-bold text-slate-800">{activeDispute.sellerName}</span>
                  </div>
                </div>

                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  Trạng thái: Chờ Admin phán quyết
                </span>
              </div>

              {/* Side-by-Side Multi-Version Photo Evidence */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Đối chiếu ảnh 3 giai đoạn làm bằng chứng tranh tụng:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-700">1. Ảnh niêm yết của Người bán</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-200">
                      <img
                        src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80"
                        alt="Seller declaration"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">Khai báo: Like New 99%</div>
                  </div>

                  <div className="border border-blue-200 rounded-2xl p-3 bg-blue-50/50 space-y-1.5">
                    <div className="text-[11px] font-bold text-blue-900">2. Ảnh kiểm định của Trung tâm</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-200">
                      <img
                        src="https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=600&q=80"
                        alt="Inspection center"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-blue-700 font-mono">Tem NFC: SL-NFC-8829104</div>
                  </div>

                  <div className="border border-red-200 rounded-2xl p-3 bg-red-50/50 space-y-1.5">
                    <div className="text-[11px] font-bold text-red-900">3. Ảnh bóc hộp Người mua khiếu nại</div>
                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-200">
                      <img
                        src="https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80"
                        alt="Buyer claim evidence"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-red-700">Bằng chứng: Vết xước 4mm góc kính</div>
                  </div>
                </div>
              </div>

              {/* Statement of Claim */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">Nội dung khiếu nại từ Người mua:</div>
                <p className="italic">"{activeDispute.description}"</p>
              </div>

              {/* Arbitration Actions */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onResolveDispute(activeDispute.id, 'REFUND_BUYER')}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Gavel className="w-4 h-4" />
                  <span>Xử Người Mua Thắng: Hoàn Tiền 100% Qua Escrow</span>
                </button>

                <button
                  onClick={() => onResolveDispute(activeDispute.id, 'RELEASE_SELLER')}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bác Khiếu Nại: Giải Ngân Cho Người Bán</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-800">Không có tranh chấp nào cần xử lý</div>
            </div>
          )}

          {/* AI Model Configuration & Fraud Threshold Control */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">
                  Cấu Hình Mô Hình AI Định Giá & Bộ Lọc Gian Lận
                </h3>
                <p className="text-xs text-slate-500">
                  Version hiện hành: <span className="font-mono font-bold text-purple-700">{modelVersion}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Ngưỡng phát hiện ảnh sao chép (Image Similarity):</span>
                  <span className="font-bold text-purple-700">{duplicateThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={98}
                  value={duplicateThreshold}
                  onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="text-[10px] text-slate-400">
                  Tự động chặn tin đăng nếu ảnh trùng lặp &gt; {duplicateThreshold}% với các tin cũ trên Facebook/Chợ Tốt.
                </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Cảnh báo giá bất thường (Price Anomaly):</span>
                  <span className="font-bold text-purple-700">&lt; {priceAnomalyThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={priceAnomalyThreshold}
                  onChange={(e) => setPriceAnomalyThreshold(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="text-[10px] text-slate-400">
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
