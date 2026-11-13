import React, { useMemo, useState } from 'react';
import { Barcode, Copy, Check, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';

export function getAtHomeIntakeCode(orderId: string): string {
  if (!orderId) return 'SL-ATHOME-00000000';
  const clean = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `SL-ATHOME-${clean}`;
}

export function generateBarcodeBars(code: string): number[] {
  const bars: number[] = [];
  const seed = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let i = 0; i < 46; i++) {
    const val = (seed * (i + 1) * 31) % 100;
    bars.push(val < 25 ? 1.5 : val < 60 ? 2.5 : val < 85 ? 3.5 : 4.5);
  }
  return bars;
}

interface AtHomeIntakeBarcodeProps {
  orderId: string;
  isArrived?: boolean;
  lang?: 'vi' | 'en';
  compact?: boolean;
  appointmentTime?: string;
  inspectorName?: string;
}

export const AtHomeIntakeBarcode: React.FC<AtHomeIntakeBarcodeProps> = ({
  orderId,
  isArrived = false,
  lang = 'vi',
  compact = false,
  appointmentTime,
  inspectorName,
}) => {
  const [copied, setCopied] = useState(false);
  const intakeCode = useMemo(() => getAtHomeIntakeCode(orderId), [orderId]);
  const bars = useMemo(() => generateBarcodeBars(intakeCode), [intakeCode]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(intakeCode).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isArrived) {
    return (
      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 flex items-center gap-3 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-emerald-900">
              {lang === 'vi' ? 'Kỹ thuật viên đã đến và đang kiểm tra' : 'Technician has arrived and is inspecting'}
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              {lang === 'vi' ? 'Đã xác thực mã' : 'Verified'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
            {lang === 'vi'
              ? `${inspectorName ? `KTV ${inspectorName}` : 'Kỹ thuật viên'} đã quét mã tiếp nhận và đang tiến hành quy trình đo kiểm 5 bước tại chỗ.`
              : 'Technician has scanned intake barcode and is performing 5-step on-site inspection.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border bg-gradient-to-b from-amber-50/70 via-white to-amber-50/40 border-amber-200 shadow-2xs overflow-hidden ${compact ? 'p-3 space-y-2' : 'p-3.5 sm:p-4 space-y-2.5'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
            <Barcode className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-black uppercase text-amber-950 tracking-wider">
            {lang === 'vi' ? 'Mã Vạch Tiếp Nhận KTV Tại Nhà' : 'At-Home Inspector Intake Barcode'}
          </span>
        </div>
        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200/80 flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-3 h-3 text-amber-600" />
          <span>{lang === 'vi' ? 'Xác thực đúng KTV Hub' : 'Hub Verified'}</span>
        </span>
      </div>

      {/* Barcode Visualizer */}
      <div className="bg-white p-2.5 rounded-xl border border-gray-200/90 text-center shadow-2xs space-y-1">
        <div className="h-10 w-full max-w-[260px] mx-auto flex items-center justify-center gap-[2.5px] overflow-hidden px-1">
          {bars.map((width, i) => (
            <div
              key={i}
              className="h-full bg-slate-900"
              style={{ width: `${width}px` }}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-slate-800 font-black tracking-[0.25em] block select-all">
          {intakeCode}
        </span>
      </div>

      {/* Code Text and Copy Action */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="text-[11px] text-amber-900/90 flex-1 min-w-0 leading-tight">
          <span className="font-bold block sm:inline">{lang === 'vi' ? 'Mã Tiếp Nhận:' : 'Intake Code:'} </span>
          <code className="font-mono font-black text-amber-950 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 select-all">
            {intakeCode}
          </code>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${copied
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700'
            }`}
          title={lang === 'vi' ? 'Sao chép mã tiếp nhận' : 'Copy intake code'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{lang === 'vi' ? 'Đã chép mã' : 'Copied'}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Sao chép mã' : 'Copy Code'}</span>
            </>
          )}
        </button>
      </div>

      {/* Instructions for seller */}
      <p className="text-[10px] text-amber-900/75 leading-relaxed pt-0.5 italic">
        {lang === 'vi'
          ? '💡 Đưa mã vạch trên màn hình hoặc đọc mã tiếp nhận cho Kỹ thuật viên quét khi đến nhà. Thao tác này giúp xác thực đúng nhân sự kiểm định của SecondLife và bảo vệ bạn.'
          : '💡 Show this barcode or provide the intake code to the technician upon arrival to verify authentic SecondLife staff.'}
      </p>
    </div>
  );
};

