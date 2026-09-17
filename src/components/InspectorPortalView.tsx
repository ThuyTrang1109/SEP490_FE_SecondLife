import React, { useState } from 'react';
import { InspectionCenter, EscrowOrder, InspectionChecklistItem, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { mockInspectionCenters, mockStandardChecklist } from '../data/mockData';
import { Building2, QrCode, CheckCircle2, XCircle, Camera, ShieldCheck, AlertCircle, Sparkles, FileText, ArrowRight, Upload, Printer } from 'lucide-react';

interface InspectorPortalViewProps {
  orders: EscrowOrder[];
  onCompleteInspection: (orderId: string, verdict: 'PASS' | 'FAIL', tamperSeal: string, summary: string) => void;
  lang: Language;
}

export const InspectorPortalView: React.FC<InspectorPortalViewProps> = ({
  orders,
  onCompleteInspection,
  lang
}) => {
  const t = translations[lang];

  const [activeCenter, setActiveCenter] = useState<InspectionCenter>(mockInspectionCenters[0]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [qrCodeInput, setQrCodeInput] = useState('');

  // Inspection workbench state
  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>(
    mockStandardChecklist.Smartphones || []
  );
  const [overallVerdict, setOverallVerdict] = useState<'PASS' | 'FAIL'>('PASS');
  const [tamperSealInput, setTamperSealInput] = useState('SL-NFC-' + Math.floor(1000000 + Math.random() * 9000000));
  const [inspectorNotes, setInspectorNotes] = useState(
    'Màn hình zin 100%, không ép kính, viền đẹp 99%. Pin 93% đạt chuẩn Grade A (Like New).'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleCheckItem = (id: string, status: 'pass' | 'fail') => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleFinishInspection = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      onCompleteInspection(
        activeOrder.id,
        overallVerdict,
        tamperSealInput,
        inspectorNotes
      );
      setIsSubmitting(false);
      setSuccessMessage(`Đã nghiệm thu thành công đơn hàng #${activeOrder.id}! Báo cáo số đã được xuất và dán tem ${tamperSealInput}.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }, 800);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header with Hub Switcher & Center Stats */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900/50 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Cổng Giám Định Viên & Đối Tác Trung Tâm Kiểm Định</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 font-['Outfit']">
              {activeCenter.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {activeCenter.address} • Hotline kỹ thuật: {activeCenter.phone}
            </p>
          </div>

          {/* Hub Switcher */}
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10 flex flex-col gap-1.5 self-start md:self-auto">
            <span className="text-[11px] font-bold text-blue-300 px-2">Chọn Trung Tâm Giám Định:</span>
            <div className="flex flex-wrap gap-1">
              {mockInspectionCenters.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => setActiveCenter(hub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${activeCenter.id === hub.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                >
                  {hub.city}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Công suất Hub / ngày</div>
            <div className="text-xl font-extrabold text-white font-['Outfit']">{activeCenter.capacityPerDay} thiết bị</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Hàng đợi hiện tại</div>
            <div className="text-xl font-extrabold text-amber-400 font-['Outfit']">{activeCenter.currentQueue} đơn chờ</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">Tỷ lệ đạt chuẩn Pass</div>
            <div className="text-xl font-extrabold text-emerald-400 font-['Outfit']">{activeCenter.passRatePercentage}%</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-slate-400">SLA Cam kết kết quả</div>
            <div className="text-xl font-extrabold text-blue-300 font-['Outfit']">&lt; {activeCenter.slaHours} giờ</div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Inspection Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Queue and QR Intake (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick QR Scanner simulation */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>Quét mã QR / Nhận gói hàng từ bưu tá</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrCodeInput}
                onChange={(e) => setQrCodeInput(e.target.value)}
                placeholder="Nhập mã đơn / quét mã vạch..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
              <button
                onClick={() => {
                  if (qrCodeInput) {
                    const match = orders.find((o) => o.id.includes(qrCodeInput));
                    if (match) setSelectedOrderId(match.id);
                  }
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Nhận máy
              </button>
            </div>
          </div>

          {/* Incoming Order Queue */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Hàng đợi kiểm định cần xử lý ({orders.length})
            </div>

            <div className="space-y-3">
              {orders.map((ord) => {
                const isSelected = ord.id === activeOrder.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${isSelected
                        ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono font-bold text-slate-800">#{ord.id}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        {ord.listing.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">
                      {ord.listing.title}
                    </h4>

                    <div className="text-xs text-slate-600 mt-1 flex justify-between">
                      <span>Người bán: {ord.sellerName}</span>
                      <span className="font-extrabold text-slate-900 font-['Outfit']">
                        {formatVND(ord.itemPriceVnd)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Certified Checklist Execution & Verdict (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            {/* Header: Item being inspected */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={activeOrder.listing.photos.front}
                  alt="Inspection target"
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
                />
                <div>
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                    {activeOrder.listing.brand} • Năm {activeOrder.listing.purchaseYear}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 font-['Outfit']">
                    {activeOrder.listing.title}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Tình trạng người bán khai báo:{' '}
                    <span className="font-semibold text-emerald-700">
                      {activeOrder.listing.declaredConditionText}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Standardized Multi-Point Category Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Checklist kiểm định phần cứng tiêu chuẩn ({checklist.length} hạng mục)</span>
                </div>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{item.category}: {item.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{item.description}</div>
                      {item.testedValue && (
                        <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded w-fit border border-emerald-200">
                          Kết quả đo: {item.testedValue}
                        </div>
                      )}
                    </div>

                    {/* Pass / Fail switch buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => toggleCheckItem(item.id, 'pass')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${item.status === 'pass'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50'
                          }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pass</span>
                      </button>

                      <button
                        onClick={() => toggleCheckItem(item.id, 'fail')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${item.status === 'fail'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-red-50'
                          }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Fail</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tamper Seal & Notes Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Mã tem niêm phong NFC chống tráo *</label>
                <input
                  type="text"
                  value={tamperSealInput}
                  onChange={(e) => setTamperSealInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-[10px] text-slate-400">Tem dán niêm phong che vít máy hoặc khóa túi hàng hiệu</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Kết luận tổng thể *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallVerdict('PASS')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${overallVerdict === 'PASS'
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-100 text-slate-700'
                      }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ĐẠT CHUẨN (PASS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallVerdict('FAIL')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${overallVerdict === 'FAIL'
                        ? 'bg-red-600 text-white ring-2 ring-red-500/20 shadow-xs'
                        : 'bg-slate-100 text-slate-700'
                      }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>TỪ CHỐI (FAIL)</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Ghi chú kết quả kỹ sư giám định</label>
                <textarea
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Submit report button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Printer className="w-4 h-4 text-slate-400" />
                <span>Báo cáo điện tử sẽ tự động đồng bộ lên hồ sơ đơn hàng của Người mua & Người bán.</span>
              </div>

              <button
                onClick={handleFinishInspection}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang ký số...' : 'Ký Số & Phát Hành Báo Cáo Nghiệm Thu'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
