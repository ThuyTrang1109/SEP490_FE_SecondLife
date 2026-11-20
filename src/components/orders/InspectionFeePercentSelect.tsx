import React from 'react';
import { Scale, User, Store } from 'lucide-react';
import { formatVND } from '../../utils/translations';
import { feePercentLabel, feePercentOptions, splitInspectionFee } from '../../utils/inspectionFeePercent';

const allPercentages = feePercentOptions();

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
  options = allPercentages,
  total,
  lang,
}: InspectionFeePercentSelectProps) {
  const amounts = total == null ? undefined : splitInspectionFee(total, value);
  const sellerPercent = 100 - value;
  const lastOptionIndex = options.length - 1;
  const selectedIndex = Math.max(options.indexOf(value), 0);
  const canAdjust = lastOptionIndex > 0;
  const showRatioOnTrack = !canAdjust || options.length === allPercentages.length;

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

      {/* 2. Fee Split Slider */}
      <div className="space-y-1.5">
        <div className="relative flex h-8 items-center">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-2.5 h-1.5 overflow-hidden rounded-full ${showRatioOnTrack ? 'bg-amber-500' : 'bg-slate-300'}`}
          >
            {showRatioOnTrack && <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${value}%` }} />}
          </div>
          {canAdjust && (
            <input
              type="range"
              min={0}
              max={lastOptionIndex}
              step={1}
              value={selectedIndex}
              onChange={(event) => onChange(options[event.currentTarget.valueAsNumber])}
              aria-label={lang === 'vi' ? 'Tỷ lệ chia phí kiểm định' : 'Inspection fee split'}
              aria-valuetext={feePercentLabel(value, lang)}
              className="relative w-full h-full appearance-none bg-transparent rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:active:cursor-grabbing"
            />
          )}
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
                aria-pressed={isSelected}
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

      {/* 4. Financial Breakdown Cards for Buyer & Seller */}
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
