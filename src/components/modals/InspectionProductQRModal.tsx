import React, { useState, useRef } from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  QrCode,
  Download,
  Copy,
  Check,
  Package,
  Building2,
  Store,
  User,
  MapPin,
  Clock,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import { EscrowOrder, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import { ScannableQRCode } from '../common/ScannableQRCode';
import { dialogService } from '../../utils/dialogService';

interface InspectionProductQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: EscrowOrder | null;
  lang?: Language;
}

export const InspectionProductQRModal: React.FC<InspectionProductQRModalProps> = ({
  isOpen,
  onClose,
  order,
  lang = 'vi'
}) => {
  const [copied, setCopied] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const intakeCode = `SL-INSP-${order.id.slice(0, 8).toUpperCase()}`;
  // QR value points to the order identifier that the inspection center station scanner can recognize
  const qrValue = `SL-INSP-${order.id}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    try {
      // Find the QR image inside ScannableQRCode
      const img = printableRef.current?.querySelector('img');
      if (img && img.src) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = `Tem-Kiem-Dinh-${intakeCode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        dialogService.warning(lang === 'vi' ? 'Không thể xuất ảnh mã QR' : 'Unable to download QR code image', lang === 'vi' ? 'Thông Báo' : 'Notice');
      }
    } catch (err) {
      console.warn('Download error:', err);
    }
  };

  const formattedDate = order.sellerConfirmedAt
    ? new Date(order.sellerConfirmedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto print:p-0 print:bg-white print:static">
      {/* CSS Isolation for sharp printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-inspection-label, #printable-inspection-label * {
            visibility: visible;
          }
          #printable-inspection-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            box-shadow: none !important;
            border: 2px solid #0f172a !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl text-slate-900 border border-slate-200 my-auto print:border-none print:shadow-none print:p-0 space-y-5">
        {/* Header Toolbar (Hidden on print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {lang === 'vi' ? 'Mã QR Kiểm Định Sản Phẩm' : 'Product Inspection QR Code'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  ISO/IEC 17025
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Dán tem này lên mặt ngoài kiện hàng để Hub quét tiếp nhận thiết bị'
                  : 'Stick this label onto package for Hub inspection intake'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="In phiếu dán (Print Label)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'In Tem' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadQR}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Tải ảnh mã QR"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Label Section */}
        <div
          ref={printableRef}
          id="printable-inspection-label"
          className="p-5 rounded-2xl bg-slate-50/70 border-2 border-dashed border-amber-500/80 space-y-4 relative overflow-hidden"
        >
          {/* Top Label Brand Bar */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#c34c36] flex items-center justify-center text-white font-black text-sm shadow-xs">
                2L
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#c34c36] block leading-none">
                  SECONDLIFE PLATFORM
                </span>
                <span className="text-sm font-black text-slate-900 tracking-tight leading-tight block">
                  PHIẾU TIẾP NHẬN KIỂM ĐỊNH THIẾT BỊ
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Trạm Đo Kiểm</span>
              <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                SECOND LIFE HUB
              </span>
            </div>
          </div>

          {/* QR Code & Essential Intake Info */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            {/* Left QR Code */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-100 pb-3 sm:pb-0 sm:pr-4">
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                <ScannableQRCode value={qrValue} size={150} />
              </div>
              <div className="mt-2 text-center">
                <span className="font-mono text-xs font-black text-slate-900 tracking-wider block">
                  {intakeCode}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Mã tiếp nhận quét tự động
                </span>
              </div>
            </div>

            {/* Right Product & Order Info */}
            <div className="sm:col-span-7 space-y-2.5 pl-0 sm:pl-1 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  Sản phẩm gia dụng kiểm định
                </span>
                <h4 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                  {order.listing?.title || 'Thiết bị gia dụng SecondLife'}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Mã đơn hàng:</span>
                  <span className="font-mono font-bold text-slate-800">#{order.id.slice(0, 13)}...</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Giá trị sản phẩm:</span>
                  <span className="font-extrabold text-[#c34c36]">
                    {formatVND(order.itemPriceVnd || order.listing?.priceVnd || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Tình trạng tự khai:</span>
                  <span className="font-bold text-slate-700">{order.listing?.conditionGrade || 'Đã qua sử dụng'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Ngày xác nhận đơn:</span>
                  <span className="font-bold text-slate-700">{formattedDate}</span>
                </div>
              </div>

              {/* Sender & Receiver Summary */}
              <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">Người gửi (Seller):</span>
                  <span className="font-bold text-slate-900 truncate">
                    {order.sellerName || 'Người bán SecondLife'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-semibold text-slate-500">Điểm tiếp nhận:</span>
                  <span className="font-bold text-amber-800 truncate">
                    Trạm Kiểm Định SecondLife Hub
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="font-semibold text-slate-500">Người mua (Buyer):</span>
                  <span className="font-medium text-slate-700 truncate">
                    {order.buyerName || 'Khách hàng SecondLife'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Watermark & Standards */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quy trình đo kiểm 5 bước chống tráo linh kiện & lỗi ẩn</span>
            </div>
            <div className="font-mono text-slate-400">
              REF: {order.id}
            </div>
          </div>
        </div>

        {/* Step-by-step Packing Instructions (Hidden on print) */}
        <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/80 text-xs text-amber-900 space-y-2 print:hidden">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Hướng dẫn dành cho Người Bán trước khi giao hàng:</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-amber-800 leading-relaxed text-[11px]">
            <li>
              <strong>Bước 1:</strong> Bấm nút <strong>"In Tem"</strong> hoặc <strong>"Tải ảnh QR"</strong> ở trên để chuẩn bị nhãn dán.
            </li>
            <li>
              <strong>Bước 2:</strong> Đóng gói sản phẩm cẩn thận bằng màng xốp khí (bubble wrap) tối thiểu 3 lớp để tránh hư hỏng trong quá trình vận chuyển.
            </li>
            <li>
              <strong>Bước 3:</strong> Dán tem mã QR này chắc chắn lên mặt ngoài của thùng carton ở vị trí dễ nhìn thấy nhất.
            </li>
            <li>
              <strong>Bước 4:</strong> Bàn giao kiện hàng cho tài xế Lalamove / bưu tá. Kỹ thuật viên tại Hub sẽ dùng máy quét barcode quét mã này để tiến hành đo kiểm thiết bị ngay khi tiếp nhận.
            </li>
          </ul>
        </div>

        {/* Action Buttons Footer (Hidden on print) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 print:hidden flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Đã sao chép mã!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Sao chép mã tiếp nhận</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'vi' ? 'In Tem Dán Kiện Hàng' : 'Print Package Label'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
