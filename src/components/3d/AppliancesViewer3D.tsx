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
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#EC1577]/30 to-[#F1622A]/30 blur-2xl group-hover:opacity-100 opacity-60 transition duration-700" />

      {/* Main Container Card (Dark Frame) */}
      <div className="relative bg-[#0E121B] rounded-3xl p-4 sm:p-6 border border-white/10 shadow-2xl space-y-4">
        {/* Top Header Pills */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>3D Spatial Appliances Scan</span>
          </div>

          {/* Model Switcher & AutoRotate */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-full border border-white/10 text-xs">
            <button
              onClick={() => {
                soundFx.playChime();
                setApplianceType('fridge');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                applianceType === 'fridge'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {lang === 'vi' ? 'Tủ Lạnh' : 'Fridge'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setApplianceType('washer');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                applianceType === 'washer'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {lang === 'vi' ? 'Máy Giặt' : 'Washer'}
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setAutoRotate((prev) => !prev);
              }}
              className={`p-1 px-2 rounded-full text-[11px] transition cursor-pointer ${
                autoRotate ? 'text-[#EC1577] font-semibold bg-black/20' : 'text-slate-400 hover:text-white'
              }`}
              title="Bật/tắt xoay 360°"
            >
              <RefreshCw className={`w-3 h-3 inline ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </button>
          </div>
        </div>

        {/* Center Display Card with Studio 3D Canvas */}
        <div className="relative bg-[#090d14] rounded-2xl h-[320px] sm:h-[350px] flex items-center justify-center overflow-hidden border border-white/10 shadow-inner">
          {/* Top Left Badge inside Card */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E121B]/85 text-white text-xs font-medium border border-white/20 backdrop-blur-md shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EC1577] animate-pulse" />
              <span>
                {applianceType === 'fridge'
                  ? (lang === 'vi' ? 'Tủ Lạnh • Grade A+ (99%)' : 'Refrigerator • Grade A+ (99%)')
                  : (lang === 'vi' ? 'Máy Giặt • Inverter (98%)' : 'Washer • Inverter (98%)')}
              </span>
            </div>
          </div>

          {/* Top Right Badge: Hub NFC Verified */}
          <div className="absolute top-3 right-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E121B]/90 text-white text-xs font-bold border border-amber-400/40 shadow-xl backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Hub NFC Verified</span>
            </div>
          </div>

          {/* Bottom Right Badge: AI Định Giá */}
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E121B]/90 text-white text-xs font-bold border border-white/20 shadow-lg backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>
                {applianceType === 'fridge'
                  ? (lang === 'vi' ? 'AI Định Giá: 14.800.000đ' : 'AI Valuation: 14,800,000đ')
                  : (lang === 'vi' ? 'AI Định Giá: 7.950.000đ' : 'AI Valuation: 7,950,000đ')}
              </span>
            </div>
          </div>

          {/* Bottom Left Drag Indicator */}
          <div className="absolute bottom-3 left-3 z-20 opacity-70 hover:opacity-100 transition pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E121B]/70 text-slate-200 text-[11px] font-medium backdrop-blur-sm border border-white/10">
              <Move3d className="w-3 h-3 text-[#F1622A]" />
              <span>{lang === 'vi' ? 'Kéo để xoay • Cuộn zoom' : 'Drag to rotate • Scroll zoom'}</span>
            </div>
          </div>

          {/* Real 3D Studio Three.js Viewer */}
          <div className="w-full h-full relative z-10">
            <Appliance3DViewer type={applianceType} autoRotate={autoRotate} />
          </div>
        </div>

        {/* Outer Bottom Footer Bar */}
        <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
          <div className="flex items-center gap-2 font-medium">
            <Box className="w-4 h-4 text-[#EC1577]" />
            <span>{lang === 'vi' ? 'Mô hình 3D đa chiều & Soi phần cứng' : 'Multi-dimensional 3D Model & Hardware Scan'}</span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/10 text-white font-mono text-[11px] font-bold border border-white/15">
            SL-3D-APPLIANCES
          </div>
        </div>
      </div>
    </div>
  );
};
