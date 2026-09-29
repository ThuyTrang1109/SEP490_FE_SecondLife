import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Box, RefreshCw, Move3d } from 'lucide-react';
import { soundFx } from '../../utils/soundEffects';
import { Appliance3DViewer } from './Appliance3DViewer';

interface AppliancesViewer3DProps {
  lang: 'vi' | 'en';
}

export const AppliancesViewer3D: React.FC<AppliancesViewer3DProps> = ({ lang }) => {
  const [applianceType, setApplianceType] = useState<'fridge' | 'washer'>('fridge');
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <div className="relative group select-none w-full max-w-xl mx-auto">
      {/* Dynamic Background Glow */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#c34c36]/30 to-[#fce5da]/30 blur-2xl group-hover:opacity-100 opacity-60 transition duration-700" />

      {/* Main Container Card (Dark Frame) */}
      <div className="relative bg-[#c34c36] text-[#24263e] rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl space-y-4">
        {/* Top Header Pills */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/40 border border-[#24263e]/15 text-[#24263e] text-xs font-bold backdrop-blur-md shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#24263e]" />
            <span>3D Spatial Appliances Scan</span>
          </div>

          {/* Model Switcher & AutoRotate */}
          <div className="flex items-center gap-1.5 bg-white/35 p-1 rounded-full border border-[#24263e]/15 text-xs shadow-xs">
            <button
              onClick={() => {
                soundFx.playChime();
                setApplianceType('fridge');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                applianceType === 'fridge'
                  ? 'bg-[#24263e] text-white shadow'
                  : 'text-[#24263e]/80 hover:text-[#24263e]'
              }`}
            >
              {lang === 'vi' ? 'Tủ Lạnh' : 'Fridge'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setApplianceType('washer');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                applianceType === 'washer'
                  ? 'bg-[#24263e] text-white shadow'
                  : 'text-[#24263e]/80 hover:text-[#24263e]'
              }`}
            >
              {lang === 'vi' ? 'Máy Giặt' : 'Washer'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setAutoRotate((prev) => !prev);
              }}
              className={`p-1 px-2 rounded-full text-[11px] font-bold transition cursor-pointer ${
                autoRotate ? 'text-[#24263e] bg-white/60' : 'text-[#24263e]/70 hover:text-[#24263e]'
              }`}
              title="Bật/tắt xoay 360°"
            >
              <RefreshCw className={`w-3 h-3 inline ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </button>
          </div>
        </div>

        {/* Center Display Card with Studio 3D Canvas */}
        <div className="relative bg-[#c34c36] rounded-2xl h-[320px] sm:h-[350px] flex items-center justify-center overflow-hidden border border-white/20 shadow-inner">
          {/* Top Left Badge inside Card */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 text-[#24263e] text-xs font-bold border border-white/60 backdrop-blur-md shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#24263e] animate-pulse" />
              <span>
                {applianceType === 'fridge'
                  ? (lang === 'vi' ? 'Tủ Lạnh • Grade A+ (99%)' : 'Refrigerator • Grade A+ (99%)')
                  : (lang === 'vi' ? 'Máy Giặt • Inverter (98%)' : 'Washer • Inverter (98%)')}
              </span>
            </div>
          </div>

          {/* Top Right Badge: Hub NFC Verified */}
          <div className="absolute top-3 right-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 text-[#24263e] text-xs font-bold border border-white/60 shadow-xl backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
              <span>Hub NFC Verified</span>
            </div>
          </div>

          {/* Bottom Right Badge: AI Định Giá */}
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/50 text-[#24263e] text-xs font-bold border border-white/60 shadow-lg backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#24263e]" />
              <span>
                {applianceType === 'fridge'
                  ? (lang === 'vi' ? 'AI Định Giá: 14.800.000đ' : 'AI Valuation: 14,800,000đ')
                  : (lang === 'vi' ? 'AI Định Giá: 7.950.000đ' : 'AI Valuation: 7,950,000đ')}
              </span>
            </div>
          </div>

          {/* Bottom Left Drag Indicator */}
          <div className="absolute bottom-3 left-3 z-20 opacity-90 hover:opacity-100 transition pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/40 text-[#24263e] text-[11px] font-bold backdrop-blur-sm border border-white/50 shadow-xs">
              <Move3d className="w-3 h-3 text-[#24263e]" />
              <span>{lang === 'vi' ? 'Kéo để xoay • Cuộn zoom' : 'Drag to rotate • Scroll zoom'}</span>
            </div>
          </div>

          {/* Real 3D Studio Three.js Viewer */}
          <div className="w-full h-full relative z-10">
            <Appliance3DViewer type={applianceType} autoRotate={autoRotate} />
          </div>
        </div>

        {/* Outer Bottom Footer Bar */}
        <div className="flex items-center justify-between text-xs text-[#24263e] pt-1 font-semibold">
          <div className="flex items-center gap-2 font-bold">
            <Box className="w-4 h-4 text-[#24263e]" />
            <span>{lang === 'vi' ? 'Mô hình 3D đa chiều & Soi phần cứng' : 'Multi-dimensional 3D Model & Hardware Scan'}</span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/40 text-[#24263e] font-mono text-[11px] font-black border border-[#24263e]/20">
            SL-3D-APPLIANCES
          </div>
        </div>
      </div>
    </div>
  );
};
