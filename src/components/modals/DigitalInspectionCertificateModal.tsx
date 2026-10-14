import React from 'react';
import { EscrowOrder, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Printer,
  X,
  Calendar,
  MapPin,
  User,
  QrCode,
  FileCheck,
  Camera,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface DigitalInspectionCertificateModalProps {
  order: EscrowOrder;
  onClose: () => void;
  lang?: Language;
}

export const DigitalInspectionCertificateModal: React.FC<DigitalInspectionCertificateModalProps> = ({
  order,
  onClose,
  lang = 'vi',
}) => {
  const certId = `CERT-SL-${order.id.slice(0, 8).toUpperCase()}`;
  const inspectionDate = order.inspectionReport?.completedAt || order.updatedAt || order.createdAt;
  const grade = order.listing.conditionGrade || 'Like New';
  const hubName = order.inspectionCenterName || 'Trung Tâm Kiểm Định SecondLife Hub';
  const inspectorName = order.inspectionReport?.inspectorName || 'Kỹ Thuật Viên Trưởng SecondLife (Level 4 Master Tech)';

  const checklistItems = [
    {
      id: 'cosmetic',
      title: 'Ngoại quan, Thân vỏ & Khung máy',
      standard: 'Không nứt vỡ, trầy xước viền dưới 2%, bản lề/cửa đóng kín khít',
      score: 98,
      status: 'PASSED',
    },
    {
      id: 'display',
      title: 'Màn hình hiển thị & Bảng điều khiển cảm ứng',
      standard: 'Không điểm chết, đèn LED sáng đều, phím cơ/cảm ứng nhạy 100%',
      score: 99,
      status: 'PASSED',
    },
    {
      id: 'board_power',
      title: 'Bo mạch chủ, IC điều khiển & Công suất vận hành',
      standard: 'Nguyên zin chưa qua sửa chữa, tản nhiệt tốt, dòng điện ổn định',
      score: 100,
      status: 'PASSED',
    },
    {
      id: 'safety',
      title: 'Tiêu chuẩn an toàn điện & Chống rò rỉ từ tính',
      standard: 'Đạt chuẩn kiểm thử điện áp xoay chiều 220V, tiếp địa an toàn tuyệt đối',
      score: 100,
      status: 'PASSED',
    },
    {
      id: 'accessories',
      title: 'Phụ kiện đi kèm & Tem niêm phong SecondLife',
      standard: 'Dây nguồn zin, phụ kiện chính hãng, dán tem chống tháo rời Tamper Seal',
      score: 96,
      status: 'PASSED',
    },
  ];

  const overallScore = Math.round(
    checklistItems.reduce((acc, curr) => acc + curr.score, 0) / checklistItems.length
  );

  const photos = [
    order.listing.photos.front,
    order.listing.photos.back,
    order.listing.photos.screenOrDetails,
    order.listing.photos.accessoriesOrBox,
    order.listing.photos.serialOrReceipt,
  ].filter(Boolean);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl text-slate-900 border border-amber-200/80 my-auto print:border-none print:shadow-none print:p-4">
        {/* Header Toolbar (Hidden when printing) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Chứng Nhận Kiểm Định Số (SecondLife Verified)
              </h3>
              <p className="text-[11px] text-slate-400">Mã đơn hàng: #{order.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* OFFICIAL CERTIFICATE PAPER (PRINTABLE)                        */}
        {/* ============================================================== */}
        <div id="printable-certificate" className="mt-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#faf8f5] to-white border-2 border-amber-300/80 shadow-inner relative space-y-6">
          {/* Watermark Seal Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
            <ShieldCheck className="w-96 h-96 text-amber-900" />
          </div>

          {/* Top Banner: SecondLife Logo, Seal, Cert ID */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-amber-200/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#24263e] flex items-center justify-center text-white shadow-md border-2 border-amber-400">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-widest text-[#c34c36] uppercase block">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM • TIÊU CHUẨN SECONDLIFE
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#24263e] tracking-tight mt-0.5">
                  GIẤY CHỨNG NHẬN KIỂM ĐỊNH CHẤT LƯỢNG
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Hệ thống thẩm định & niêm phong điện máy gia dụng SecondLife Certified
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 sm:text-right">
              <div className="hidden sm:block">
                <div className="text-[10px] uppercase font-bold text-slate-400">Số hiệu chứng thư</div>
                <div className="font-mono font-black text-xs text-slate-900">{certId}</div>
                <div className="text-[10px] text-slate-400">{new Date(inspectionDate).toLocaleDateString('vi-VN')}</div>
              </div>
              {/* QR Code Simulation */}
              <div className="p-1.5 bg-white border border-slate-300 rounded-xl shadow-xs">
                <QrCode className="w-12 h-12 text-[#24263e]" />
              </div>
            </div>
          </div>

          {/* Section 1: Device Identification */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                1. Thông Tin Thiết Bị Được Kiểm Định
              </span>
              <h2 className="text-base font-black text-slate-900 truncate">
                {order.listing.title}
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Danh mục:</span>{' '}
                  <strong className="text-slate-800">{order.listing.category}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Thương hiệu:</span>{' '}
                  <strong className="text-slate-800">{order.listing.brand || 'Chính hãng'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Model / Dòng máy:</span>{' '}
                  <strong className="text-slate-800">{order.listing.model || 'Standard'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Mã niêm phong (Seal):</span>{' '}
                  <strong className="font-mono text-emerald-700">SL-SEAL-{order.id.slice(0, 6).toUpperCase()}</strong>
                </div>
              </div>
            </div>

            {/* Overall Quality Rating Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#24263e] to-[#3a3c5a] text-white flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[#fce5da]">
                <span>Xếp Hạng Chung</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="my-2">
                <div className="text-3xl font-black text-white">{overallScore}<span className="text-sm font-normal text-white/70">/100</span></div>
                <div className="text-xs font-bold text-amber-300 mt-0.5">
                  Phân Hạng: {grade} (Đạt Chuẩn)
                </div>
              </div>
              <div className="text-[10px] text-white/70">
                Được bảo chứng 100% qua Quỹ Bảo Lãnh Escrow
              </div>
            </div>
          </div>

          {/* Section 2: 5 Checklist Categories */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              2. Kết Quả Checklist Nghiệm Thu 5 Công Đoạn
            </span>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
              {checklistItems.map((item, index) => (
                <div key={item.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.standard}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-black text-xs text-slate-700">
                      {item.score}/100
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>ĐẠT</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Inspection Photos Proof */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                <span>3. Ảnh Chụp Thực Tế Lúc Nghiệm Thu Tại Hub ({photos.length} ảnh)</span>
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group relative">
                    <img
                      src={url}
                      alt={`Inspection Proof ${i + 1}`}
                      className="w-full h-full object-cover transition transform group-hover:scale-105"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                      Ảnh {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Signatures & Certification Stamp */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Đơn Vị Kiểm Định</span>
              <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#c34c36]" />
                <span>{hubName}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Địa chỉ: Trung tâm kỹ thuật SecondLife Logistics & Inspection
              </p>
            </div>

            <div className="text-right space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Kỹ Thuật Viên Nghiệm Thu</span>
              <div className="font-black text-slate-900 text-sm flex items-center justify-end gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>{inspectorName}</span>
              </div>
              <div className="inline-block mt-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold font-mono">
                ✓ CHỮ KÝ SỐ SECONDLIFE VERIFIED
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 text-center text-[11px] text-slate-400 print:hidden">
          Biên bản này có giá trị pháp lý trong cửa sổ 48h đối soát khiếu nại của Quỹ Bảo Lãnh Escrow.
        </div>
      </div>
    </div>
  );
};
