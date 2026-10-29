import React from 'react';
import { Printer, X, ShieldCheck, AlertOctagon, Sparkles, CheckCircle2 } from 'lucide-react';
import { ScannableQRCode } from '../common/ScannableQRCode';

interface PrintTamperSealModalProps {
  isOpen: boolean;
  onClose: () => void;
  tamperSealId: string;
  orderId?: string;
  productTitle?: string;
  conditionGrade?: string;
  conditionScore?: number;
  inspectorName?: string;
}

export const PrintTamperSealModal: React.FC<PrintTamperSealModalProps> = ({
  isOpen,
  onClose,
  tamperSealId,
  orderId = '',
  productTitle = 'Thiết bị gia dụng kiểm định',
  conditionGrade = 'A',
  conditionScore = 95,
  inspectorName = 'KTV SecondLife Center'
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print isolation style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-tamper-seal, #printable-tamper-seal * {
            visibility: visible;
          }
          #printable-tamper-seal {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl text-slate-900 border border-slate-200 my-auto print:border-none print:shadow-none print:p-0">
        {/* Header Toolbar (Hidden on print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-[#c34c36] shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                In Tem Niêm Phong Chống Bóc Tách
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">Mã tem: {tamperSealId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83b27] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Tem (Print)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tamper Seal Label (Kích thước tem nhiệt bảo mật) */}
        <div
          id="printable-tamper-seal"
          className="mt-4 p-5 rounded-2xl bg-white border-2 border-dashed border-[#c34c36] space-y-4 shadow-inner relative overflow-hidden"
        >
          {/* Top Banner */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm">
                2L
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#c34c36] block">
                  SECONDLIFE TAMPER-PROOF SECURITY
                </span>
                <span className="text-xs font-black text-slate-900 uppercase">
                  TEM NIÊM PHONG KIỂM ĐỊNH
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase border border-emerald-300">
              PASSED • GRADE {conditionGrade}
            </span>
          </div>

          {/* Main Body: QR Code + Seal Details */}
          <div className="flex items-center gap-4">
            {/* Real Scannable QR Code */}
            <div className="p-2 bg-white rounded-xl border border-slate-300 shadow-2xs shrink-0 flex flex-col items-center">
              <ScannableQRCode value={tamperSealId} size={110} />
              <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Quét kiểm tra</span>
            </div>

            {/* Seal & Order Info */}
            <div className="space-y-1.5 min-w-0 flex-1 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">MÃ TEM NIÊM PHONG (SERIAL)</span>
                <span className="font-mono font-black text-base text-[#c34c36] tracking-wider block truncate">
                  {tamperSealId}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">SẢN PHẨM & ĐƠN HÀNG</span>
                <span className="font-bold text-slate-900 block truncate" title={productTitle}>
                  {productTitle}
                </span>
                {orderId && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Đơn: #{orderId.slice(0, 8)} • Điểm: {conditionScore}/100
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-600">
                KTV niêm phong: <strong className="text-slate-800">{inspectorName}</strong>
              </div>
            </div>
          </div>

          {/* Security Warning Footer */}
          <div className="pt-3 border-t border-slate-200 bg-red-50/80 -mx-5 -mb-5 p-3 text-center rounded-b-xl border-t border-red-200">
            <div className="flex items-center justify-center gap-1.5 text-[#c34c36] text-[10px] font-black uppercase tracking-tight">
              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
              <span>CẢNH BÁO AN NINH: TỪ CHỐI NHẬN NẾU TEM CÓ DẤU HIỆU BÓC HOẶC RÁCH</span>
            </div>
            <div className="text-[9px] text-slate-500 font-medium mt-0.5">
              Hệ thống lưu vết quét QR tại trạm Hub, Shipper và Người mua. Trách nhiệm thuộc bên làm rách tem.
            </div>
          </div>
        </div>

        {/* Tip for Inspector */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl text-slate-500 text-[11px] space-y-1 print:hidden border border-slate-100">
          <p>
            💡 <strong>Hướng dẫn dán tem:</strong> Dán tem niêm phong đè lên ốc mở máy hoặc mép hộp sản phẩm.
          </p>
          <p>
            Mã QR trên tem có thể được quét trực tiếp bằng camera điện thoại của Shipper hoặc Người mua để tra cứu lịch sử trên hệ thống SecondLife.
          </p>
        </div>
      </div>
    </div>
  );
};
