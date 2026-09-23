import React, { useState } from 'react';
import { InspectionCenter, EscrowOrder, InspectionChecklistItem, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { mockInspectionCenters, mockStandardChecklist } from '../data/mockData';
import { Building2, QrCode, CheckCircle2, XCircle, ShieldCheck, Printer } from 'lucide-react';

interface InspectorPortalViewProps {
  orders: EscrowOrder[];
  onCompleteInspection: (orderId: string, verdict: 'PASS' | 'FAIL', tamperSeal: string, summary: string) => void;
  lang: Language;
}

export const InspectorPortalView: React.FC<InspectorPortalViewProps> = ({
  orders,
  onCompleteInspection,
  lang,
}) => {
  const [activeCenter, setActiveCenter] = useState<InspectionCenter>(mockInspectionCenters[0]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [qrCodeInput, setQrCodeInput] = useState('');

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>(
    mockStandardChecklist['Tủ lạnh & Tủ đông'] || mockStandardChecklist['Máy giặt & Máy sấy'] || []
  );
  const [overallVerdict, setOverallVerdict] = useState<'PASS' | 'FAIL'>('PASS');
  const [tamperSealInput, setTamperSealInput] = useState('SL-HOME-' + Math.floor(1000000 + Math.random() * 9000000));
  const [inspectorNotes, setInspectorNotes] = useState(
    'Máy nén Compressor & Áp suất Gas R600a siêu êm, độ lạnh -19.2°C chuẩn xác, gioăng cửa hít nam tính nguyên bản. Đạt chuẩn Grade A (Like New).'
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
      setSuccessMessage(
        lang === 'vi'
          ? `Đã nghiệm thu thành công đơn hàng #${activeOrder.id}! Báo cáo số đã được xuất và dán tem ${tamperSealInput}.`
          : `Order #${activeOrder.id} successfully inspected! Digital report issued with seal ${tamperSealInput}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    }, 800);
  };

  return (
    <div className="space-y-8 pb-16 text-[#0E121B]">
      {/* Top Header */}
      <div className="bg-[#0E121B] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>
                {lang === 'vi'
                  ? 'Cổng Giám Định Viên & Đối Tác Trung Tâm Kiểm Định'
                  : 'Inspector Portal & Verification Center Partners'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
              {activeCenter.name}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 mt-1">
              {activeCenter.address} • {lang === 'vi' ? 'Hotline kỹ thuật: ' : 'Technical hotline: '}
              {activeCenter.phone}
            </p>
          </div>

          <div className="bg-white/10 p-2 rounded-2xl border border-white/20 flex flex-col gap-1.5 self-start md:self-auto">
            <span className="text-[11px] font-bold text-white/70 px-2">
              {lang === 'vi' ? 'Chọn Trung Tâm Giám Định:' : 'Select Inspection Center:'}
            </span>
            <div className="flex flex-wrap gap-1">
              {mockInspectionCenters.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => setActiveCenter(hub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeCenter.id === hub.id
                      ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-xs'
                      : 'bg-white/10 text-white hover:bg-white/20'
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
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">
              {lang === 'vi' ? 'Công suất Hub / ngày' : 'Hub Daily Capacity'}
            </div>
            <div className="text-xl font-extrabold text-[#0E121B]">
              {activeCenter.capacityPerDay} {lang === 'vi' ? 'thiết bị' : 'units'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">
              {lang === 'vi' ? 'Hàng đợi hiện tại' : 'Current Queue'}
            </div>
            <div className="text-xl font-extrabold text-[#EC1577]">
              {activeCenter.currentQueue} {lang === 'vi' ? 'đơn chờ' : 'pending'}
            </div>
          </div>
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">
              {lang === 'vi' ? 'Tỷ lệ đạt chuẩn Pass' : 'Standard Pass Rate'}
            </div>
            <div className="text-xl font-extrabold text-[#0E121B]">{activeCenter.passRatePercentage}%</div>
          </div>
          <div className="bg-[#FFFFFF] text-[#0E121B] rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="text-xs text-[#0E121B]/70">
              {lang === 'vi' ? 'SLA Cam kết kết quả' : 'Result SLA'}
            </div>
            <div className="text-xl font-extrabold text-[#0E121B]">&lt; {activeCenter.slaHours} {lang === 'vi' ? 'giờ' : 'hours'}</div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-[#0E121B] border border-white/10 text-white font-bold text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-[#EC1577]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Inspection Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Queue and QR Intake */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#FFFFFF] rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0E121B] uppercase tracking-wider">
              <QrCode className="w-4 h-4 text-[#EC1577]" />
              <span>{lang === 'vi' ? 'Quét mã QR / Nhận gói hàng từ bưu tá' : 'Scan QR / Courier Handover Intake'}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrCodeInput}
                onChange={(e) => setQrCodeInput(e.target.value)}
                placeholder={lang === 'vi' ? 'Nhập mã đơn / quét mã vạch...' : 'Enter order ID / scan barcode...'}
                className="flex-1 px-3 py-2 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs text-[#0E121B]"
              />
              <button
                onClick={() => {
                  if (qrCodeInput) {
                    const match = orders.find((o) => o.id.includes(qrCodeInput));
                    if (match) setSelectedOrderId(match.id);
                  }
                }}
                className="px-3 py-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {lang === 'vi' ? 'Nhận máy' : 'Intake'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-[#0E121B]/70 uppercase tracking-wider">
              {lang === 'vi'
                ? `Hàng đợi kiểm định cần xử lý (${orders.length})`
                : `Pending Inspection Queue (${orders.length})`}
            </div>

            <div className="space-y-3">
              {orders.map((ord) => {
                const isSelected = ord.id === activeOrder.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#0E121B] text-white border-[#0E121B] shadow-md'
                        : 'bg-[#FFFFFF] border-gray-200 hover:border-[#EC1577] text-[#0E121B]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] opacity-80">
                      <span className="font-mono font-bold">#{ord.id}</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#F4F5F8] text-[#0E121B]'
                      }`}>
                        {ord.listing.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs mt-1 line-clamp-1">
                      {ord.listing.title}
                    </h4>

                    <div className="text-xs opacity-75 mt-1 flex justify-between">
                      <span>{lang === 'vi' ? 'Người bán: ' : 'Seller: '}{ord.sellerName}</span>
                      <span className="font-extrabold text-[#EC1577]">
                        {formatVND(ord.itemPriceVnd)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Certified Checklist Execution */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#FFFFFF] rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <img
                  src={activeOrder.listing.photos.front}
                  alt="Inspection target"
                  className="w-16 h-16 rounded-2xl object-cover border border-gray-200 bg-[#F4F5F8]"
                />
                <div>
                  <span className="text-[11px] font-bold text-[#0E121B]/70 uppercase tracking-wider">
                    {activeOrder.listing.brand} • {lang === 'vi' ? 'Năm ' : 'Year '}{activeOrder.listing.purchaseYear}
                  </span>
                  <h3 className="font-extrabold text-base text-[#0E121B]">
                    {activeOrder.listing.title}
                  </h3>
                  <div className="text-xs text-[#0E121B]/70 mt-0.5">
                    {lang === 'vi' ? 'Tình trạng người bán khai báo: ' : 'Declared condition: '}
                    <span className="font-semibold text-[#0E121B]">
                      {activeOrder.listing.declaredConditionText}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#0E121B] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#EC1577]" />
                  <span>
                    {lang === 'vi'
                      ? `Checklist kiểm định phần cứng tiêu chuẩn (${checklist.length} hạng mục)`
                      : `Standard Hardware Inspection Checklist (${checklist.length} items)`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-gray-200 bg-[#F4F5F8] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-[#0E121B] flex items-center gap-2">
                        <span>{item.category}: {item.title}</span>
                      </div>
                      <div className="text-[11px] text-[#0E121B]/70">{item.description}</div>
                      {item.testedValue && (
                        <div className="text-[11px] font-mono text-[#0E121B] bg-[#FFFFFF] px-2 py-0.5 rounded w-fit border border-gray-200">
                          {lang === 'vi' ? 'Kết quả đo: ' : 'Measured: '}{item.testedValue}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => toggleCheckItem(item.id, 'pass')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          item.status === 'pass'
                            ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-xs'
                            : 'bg-[#FFFFFF] border border-gray-200 text-[#0E121B]/70 hover:text-[#0E121B]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pass</span>
                      </button>

                      <button
                        onClick={() => toggleCheckItem(item.id, 'fail')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          item.status === 'fail'
                            ? 'bg-[#0E121B] text-white shadow-xs border border-[#0E121B]'
                            : 'bg-[#FFFFFF] border border-gray-200 text-[#0E121B]/70 hover:text-[#0E121B]'
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0E121B]">
                  {lang === 'vi' ? 'Mã tem niêm phong NFC chống tráo *' : 'Anti-Tamper NFC Security Seal Code *'}
                </label>
                <input
                  type="text"
                  value={tamperSealInput}
                  onChange={(e) => setTamperSealInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs font-mono font-bold text-[#0E121B]"
                />
                <span className="text-[10px] text-[#0E121B]/60">
                  {lang === 'vi'
                    ? 'Tem dán niêm phong che vít máy hoặc khóa túi hàng hiệu'
                    : 'Tamper-evident seal over housing screws or secure closures'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0E121B]">
                  {lang === 'vi' ? 'Kết luận tổng thể *' : 'Overall Inspection Verdict *'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallVerdict('PASS')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      overallVerdict === 'PASS'
                        ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-xs'
                        : 'bg-[#F4F5F8] text-[#0E121B]/70 border border-gray-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'ĐẠT CHUẨN (PASS)' : 'PASSED (VERIFIED)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallVerdict('FAIL')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      overallVerdict === 'FAIL'
                        ? 'bg-[#0E121B] text-white shadow-xs border border-[#0E121B]'
                        : 'bg-[#F4F5F8] text-[#0E121B]/70 border border-gray-200'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'TỪ CHỐI (FAIL)' : 'REJECTED (FAIL)'}</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-[#0E121B]">
                  {lang === 'vi' ? 'Ghi chú kết quả kỹ sư giám định' : 'Inspector Diagnostic Notes'}
                </label>
                <textarea
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-xs text-[#0E121B]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-[#0E121B]/70 flex items-center gap-1">
                <Printer className="w-4 h-4 text-gray-400" />
                <span>
                  {lang === 'vi'
                    ? 'Báo cáo điện tử sẽ tự động đồng bộ lên hồ sơ đơn hàng của Người mua & Người bán.'
                    : 'Digital report will automatically sync to buyer & seller order records.'}
                </span>
              </div>

              <button
                onClick={handleFinishInspection}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>
                  {isSubmitting
                    ? (lang === 'vi' ? 'Đang ký số...' : 'Signing...')
                    : (lang === 'vi' ? 'Ký Số & Phát Hành Báo Cáo Nghiệm Thu' : 'Digitally Sign & Issue Inspection Report')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
