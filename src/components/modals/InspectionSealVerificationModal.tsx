import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  QrCode,
  Camera,
  Search,
  Loader2,
  AlertOctagon,
  History,
  Send
} from 'lucide-react';
import {
  inspectorService,
  InspectionSealVerificationResponse,
  InspectionSealLogDto
} from '../../services/inspectorService';
import { ScannableQRCode } from '../common/ScannableQRCode';

interface InspectionSealVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSealId?: string;
  onOpenScanner?: () => void;
}

export const InspectionSealVerificationModal: React.FC<InspectionSealVerificationModalProps> = ({
  isOpen,
  onClose,
  initialSealId = '',
  onOpenScanner
}) => {
  const [sealIdInput, setSealIdInput] = useState(initialSealId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<InspectionSealVerificationResponse | null>(null);

  // Form for recording a new scan
  const [showScanForm, setShowScanForm] = useState(false);
  const [scanStage, setScanStage] = useState<'CARRIER_HANDOVER' | 'DELIVERED_BUYER'>('CARRIER_HANDOVER');
  const [sealCondition, setSealCondition] = useState<'INTACT' | 'TAMPERED'>('INTACT');
  const [locationText, setLocationText] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSealId) {
      setSealIdInput(initialSealId);
      handleVerify(initialSealId);
    }
  }, [initialSealId]);

  if (!isOpen) return null;

  const handleVerify = async (idToVerify?: string) => {
    const id = (idToVerify || sealIdInput).trim();
    if (!id) {
      setError('Vui lòng nhập mã tem niêm phong cần kiểm tra');
      return;
    }

    setIsLoading(true);
    setError(null);
    setScanSuccessMessage(null);

    try {
      const data = await inspectorService.getSealVerification(id);
      setVerificationData(data);
    } catch (err: any) {
      console.error('Lỗi tra cứu tem:', err);
      setError(err?.message || 'Không tìm thấy thông tin tem niêm phong hợp lệ với mã: ' + id);
      setVerificationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitScanLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationData?.tamperSealId) return;

    setIsSubmittingLog(true);
    setError(null);
    setScanSuccessMessage(null);

    try {
      await inspectorService.recordSealScan({
        tamperSealId: verificationData.tamperSealId,
        scanStage,
        sealCondition,
        locationText: locationText.trim() || undefined,
        note: notes.trim() || undefined
      });

      setScanSuccessMessage(
        sealCondition === 'INTACT'
          ? 'Đã ghi nhận lần quét tem nguyên vẹn thành công!'
          : 'Đã cảnh báo tem bị rách/bóc! Hệ thống đã gửi thông báo đến các bên liên quan.'
      );
      setShowScanForm(false);
      setNotes('');
      // Reload verification to display updated scanHistory
      await handleVerify(verificationData.tamperSealId);
    } catch (err: any) {
      console.error('Lỗi ghi nhận lượt quét:', err);
      setError(err?.message || 'Không thể lưu lịch sử quét tem. Vui lòng kiểm tra quyền đăng nhập.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const isTampered = verificationData?.currentSealStatus === 'TAMPERED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-slate-200 my-auto space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Xác Thực Tem Niêm Phong SecondLife
              </h3>
              <p className="text-xs text-slate-500">Tra cứu chứng nhận số & giám sát chuỗi cung ứng</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sealIdInput}
              onChange={(e) => setSealIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Nhập mã tem niêm phong (VD: SL-SEAL-8829102)..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-sm text-slate-900 outline-none focus:border-[#c34c36] focus:bg-white"
            />
          </div>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              title="Mở camera quét mã QR trên tem"
            >
              <Camera className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Quét Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={isLoading}
            className="px-5 py-2.5 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Tra Cứu</span>}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {scanSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{scanSuccessMessage}</span>
          </div>
        )}

        {/* Verification Result Card */}
        {verificationData && (
          <div className="space-y-4 animate-fadeIn">
            {/* Integrity Status Alert Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                isTampered
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {isTampered ? (
                  <AlertOctagon className="w-7 h-7 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight">
                    {isTampered ? 'CẢNH BÁO: TEM ĐÃ BỊ RÁCH HOẶC BÓC TÁCH!' : 'TEM CHÍNH HÃNG NGUYÊN VẸN 100%'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {isTampered
                      ? 'Thiết bị có thể đã bị can thiệp sau kiểm định. Vui lòng quay video đồng kiểm.'
                      : 'Được chứng thực bởi Trung tâm kiểm định SecondLife.'}
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  isTampered ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {verificationData.currentSealStatus}
              </span>
            </div>

            {/* Product & Inspector Info */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Sản phẩm</span>
                <div className="font-bold text-slate-900 mt-0.5 text-sm">{verificationData.productTitle}</div>
                <div className="text-slate-500 mt-1">
                  Đơn kiểm định: <strong className="font-mono text-slate-700">#{verificationData.inspectionOrderId?.slice(0, 8)}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Đánh giá chất lượng</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded font-black text-xs">
                    GRADE {verificationData.conditionGrade || 'A'}
                  </span>
                  <span className="font-black font-mono text-sm text-slate-900">
                    {verificationData.conditionScore || 95} / 100 điểm
                  </span>
                </div>
                <div className="text-slate-500 mt-1">
                  KTV thực hiện: <strong>{verificationData.inspectorName}</strong>
                </div>
              </div>
            </div>

            {/* Scan History Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Lịch Sử Nhật Ký Quét Tem ({verificationData.scanHistory?.length || 0} lần)</span>
                </span>

                <button
                  type="button"
                  onClick={() => setShowScanForm(!showScanForm)}
                  className="text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                >
                  {showScanForm ? 'Ẩn biểu mẫu quét' : '+ Quét ghi nhận lần mới'}
                </button>
              </div>

              {/* Form to submit scan stage */}
              {showScanForm && (
                <form
                  onSubmit={handleSubmitScanLog}
                  className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs animate-fadeIn"
                >
                  <div className="font-bold text-amber-900">Ghi nhận trạng thái tem chặng hiện tại</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Giai đoạn quét</label>
                      <select
                        value={scanStage}
                        onChange={(e) => setScanStage(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="CARRIER_HANDOVER">Tài xế/Shipper nhận máy (CARRIER_HANDOVER)</option>
                        <option value="DELIVERED_BUYER">Giao đến tay người mua (DELIVERED_BUYER)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Tình trạng tem</label>
                      <select
                        value={sealCondition}
                        onChange={(e) => setSealCondition(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="INTACT">Nguyên vẹn 100% (INTACT)</option>
                        <option value="TAMPERED">Bị rách / Có dấu hiệu bóc (TAMPERED)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Địa điểm / Vị trí quét</label>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      placeholder="VD: Hub Cầu Giấy, Hà Nội..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Ghi chú</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="VD: Bưu tá đã kiểm tra tem trước khi nhận giao..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowScanForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingLog}
                      className="px-4 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a83b27] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmittingLog ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Lưu Lịch Sử Quét</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Timeline list */}
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                {(!verificationData.scanHistory || verificationData.scanHistory.length === 0) ? (
                  <div className="p-4 text-center text-slate-400">Chưa có lịch sử quét tem nào được lưu</div>
                ) : (
                  verificationData.scanHistory.map((log, idx) => (
                    <div key={log.id || idx} className="p-3 sm:px-4 flex items-start justify-between gap-3 hover:bg-slate-50/60">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono text-xs">
                            {log.scanStage === 'INITIAL_SEAL'
                              ? '1. NIÊM PHONG LẦN ĐẦU'
                              : log.scanStage === 'CARRIER_HANDOVER'
                              ? '2. BÀN GIAO VẬN CHUYỂN'
                              : '3. GIAO TẬN TAY NGƯỜI MUA'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              log.sealCondition === 'TAMPERED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {log.sealCondition}
                          </span>
                        </div>

                        <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-x-2">
                          {log.scannedByName && (
                            <span>
                              Người quét: <strong>{log.scannedByName}</strong>
                            </span>
                          )}
                          {log.locationText && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{log.locationText}</span>
                            </span>
                          )}
                        </div>

                        {log.note && <p className="text-slate-600 italic text-[11px]">"{log.note}"</p>}
                      </div>

                      <div className="text-right shrink-0 text-slate-400 text-[10px] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>
                          {log.scannedAt
                            ? new Date(log.scannedAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })
                            : 'Mới đây'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
