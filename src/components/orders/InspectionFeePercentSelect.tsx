import React from 'react';
import { Scale, ChevronDown, User, Store } from 'lucide-react';
import { formatVND } from '../../utils/translations';
import { feePercentLabel, feePercentOptions, splitInspectionFee } from '../../utils/inspectionFeePercent';

interface InspectionFeePercentSelectProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  total?: number | null;
  lang: string;
}

export function InspectionFeePercentSelect({
  value,
  onChange,
  options = feePercentOptions(),
  total,
  lang,
}: InspectionFeePercentSelectProps) {
  const amounts = total == null ? undefined : splitInspectionFee(total, value);
  const sellerPercent = 100 - value;

  // Key preset shortcuts for quick one-click selection
  const presets = [
    { label: lang === 'vi' ? 'Mua 100%' : 'Buyer 100%', val: 100 },
    { label: lang === 'vi' ? 'Mua 70%' : 'Buyer 70%', val: 70 },
    { label: lang === 'vi' ? 'Chia đôi 50/50' : 'Split 50/50', val: 50 },
    { label: lang === 'vi' ? 'Bán 70%' : 'Seller 70%', val: 30 },
    { label: lang === 'vi' ? 'Bán 100%' : 'Seller 100%', val: 0 },
  ].filter((p) => options.includes(p.val));

  return (
    <div className="space-y-3.5">
      {/* 1. Header with Icon & Current Ratio Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-tight">
              {lang === 'vi' ? 'Tỷ lệ chia phí kiểm định' : 'Inspection Fee Split'}
            </h4>
            <p className="text-[10.5px] text-slate-500 font-medium">
              {lang === 'vi'
                ? 'Đàm phán tỷ lệ chi trả giữa người mua & người bán'
                : 'Negotiate fee distribution between buyer & seller'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200 text-[11px] font-black tracking-tight text-slate-700">
          <span className="text-blue-700 font-bold">{value}%</span>
          <span className="text-slate-400">/</span>
          <span className="text-amber-700 font-bold">{sellerPercent}%</span>
        </div>
      </div>

      {/* 2. Visual Two-Tone Ratio Bar */}
      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden p-0.5 border border-slate-300/40 flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-l-full transition-all duration-300 ease-out shadow-xs"
            style={{ width: `${Math.max(3, Math.min(97, value))}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-r-full transition-all duration-300 ease-out shadow-xs"
            style={{ width: `${Math.max(3, Math.min(97, sellerPercent))}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10.5px] font-bold px-0.5">
          <span className="text-blue-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
            {lang === 'vi' ? `Người mua: ${value}%` : `Buyer: ${value}%`}
          </span>
          <span className="text-amber-700 flex items-center gap-1">
            {lang === 'vi' ? `Người bán: ${sellerPercent}%` : `Seller: ${sellerPercent}%`}
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          </span>
        </div>
      </div>

      {/* 3. Quick Preset Shortcut Pills (if options allow) */}
      {presets.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {presets.map((preset) => {
            const isSelected = value === preset.val;
            return (
              <button
                key={preset.val}
                type="button"
                onClick={() => onChange(preset.val)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs font-black ring-2 ring-indigo-600/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Styled Select Dropdown for Detailed Percentages */}
      <div className="relative">
        <select
          aria-label={lang === 'vi' ? 'Tỷ lệ chia phí kiểm định' : 'Inspection fee split'}
          className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer transition-all"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {options.map((percent) => (
            <option key={percent} value={percent}>
              {feePercentLabel(percent, lang)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {/* 5. Financial Breakdown Cards for Buyer & Seller */}
      {amounts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Buyer Card */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <span>{lang === 'vi' ? 'Người mua (Bạn)' : 'Buyer (You)'}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                {value}%
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-blue-700 tracking-tight">
              {formatVND(amounts.buyer)}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">
              {lang === 'vi' ? 'Thanh toán ở Giai đoạn 1' : 'Paid in Stage 1'}
            </div>
          </div>

          {/* Seller Card */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Store className="w-3 h-3" />
                </div>
                <span>{lang === 'vi' ? 'Người bán (Đối tác)' : 'Seller (Partner)'}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                {sellerPercent}%
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-amber-700 tracking-tight">
              {formatVND(amounts.seller)}
            </div>
            <div className="text-[10px] text-amber-600 font-medium">
              {lang === 'vi' ? 'Khấu trừ vào tiền nhận được' : 'Deducted from payout'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
