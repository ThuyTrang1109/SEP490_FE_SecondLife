import React, { useState } from 'react';
import { ShieldCheck, Box, RefreshCw, Cpu, Move3d } from 'lucide-react';
import { soundFx } from '../../utils/soundEffects';
import { BlurText } from '../react-bits/BlurText';
import { CountUp } from '../react-bits/CountUp';
import { Appliance3DViewer } from './Appliance3DViewer';

interface ShowroomLobby3DProps {
  lang?: 'vi' | 'en';
  onExplore3DProduct?: () => void;
}

export const ShowroomLobby3D: React.FC<ShowroomLobby3DProps> = ({
  lang = 'vi',
  onExplore3DProduct,
}) => {
  const [applianceType, setApplianceType] = useState<'fridge' | 'washer'>('fridge');
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fbf8f3] via-[#f5ede3] to-[#ebdccb] text-[#2b1d16] shadow-xl border border-[#cea981]/40 group">
      {/* Dynamic Background Studio Glow */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] bg-[#cea981]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[380px] h-[380px] bg-[#e6caa4]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Status & Controls Bar */}
      <div className="relative z-20 px-6 sm:px-8 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#2b1d16]/15 text-[#2b1d16] text-[11px] font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#2b1d16] animate-pulse" />
          <span className="font-extrabold tracking-wide">
            {lang === 'vi' ? 'SẢNH KIỂM ĐỊNH 3D SECONDLIFE' : 'SECONDLIFE 3D INSPECTION LOBBY'}
          </span>
        </div>

        {/* 3D Model Switcher & 360° Controls */}
        <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-md p-1 rounded-xl border border-[#2b1d16]/15 text-xs shadow-xs">
          <button
            onClick={() => {
              soundFx.playChime();
              setApplianceType('fridge');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              applianceType === 'fridge'
                ? 'bg-[#2b1d16] text-white shadow-md'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/60'
            }`}
          >
            {lang === 'vi' ? 'Tủ Lạnh Hitachi' : 'Hitachi Fridge'}
          </button>
          <button
            onClick={() => {
              soundFx.playChime();
              setApplianceType('washer');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              applianceType === 'washer'
                ? 'bg-[#2b1d16] text-white shadow-md'
                : 'text-[#2b1d16]/80 hover:text-[#2b1d16] hover:bg-white/60'
            }`}
          >
            {lang === 'vi' ? 'Máy Giặt Electrolux' : 'Electrolux Washer'}
          </button>
          <button
            onClick={() => {
              soundFx.playChime();
              setAutoRotate((prev) => !prev);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              autoRotate ? 'text-[#2b1d16] bg-white/80 shadow-xs' : 'text-[#2b1d16]/70 hover:text-[#2b1d16]'
            }`}
            title="Bật / tắt tự động xoay 360°"
          >
            <RefreshCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            <span>360°</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout: Left Text | Center 3D Appliance Viewer | Right Hub Card */}
      <div className="relative w-full min-h-[460px] sm:min-h-[480px] flex flex-col lg:flex-row items-center justify-between p-6 sm:p-8 pt-4 gap-6 overflow-hidden">
        {/* 1. Cột chữ bên trái */}
        <div className="w-full lg:w-[420px] shrink-0 z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-[#2b1d16]/15 text-[#2b1d16] text-xs font-bold backdrop-blur-md w-fit shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2b1d16]" />
            <span>{lang === 'vi' ? 'Sàn Đồ Cũ Kiểm Định & AI Định Giá Uy Tín' : 'Certified Recommerce & AI Valuation'}</span>
          </div>

          <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#2b1d16] leading-tight">
            <BlurText
              text={lang === 'vi' ? 'Mua Bán Đồ Cũ An Toàn Với Mô Hình 3D & Escrow.' : 'Verified Second-Hand with 3D Models & Escrow.'}
              delay={60}
              animateBy="words"
              direction="top"
              className="text-[#2b1d16] font-black"
            />
          </h1>

          <p className="text-[#2b1d16]/85 text-xs sm:text-sm leading-relaxed max-w-xl font-bold">
            {lang === 'vi'
              ? 'Kiểm tra chi tiết thiết bị với mô hình 3D 360°, xoay cuộn zoom đa chiều, tra cứu biên bản kiểm định phần cứng và thanh toán được bảo vệ trọn vẹn qua Quỹ tín thác.'
              : 'Inspect devices in 360° 3D, verify hardware hub reports, and pay safely via Escrow protection.'}
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 text-[#2b1d16] text-xs font-bold border border-[#cea981]/40 backdrop-blur-md shadow-xs">
              <Move3d className="w-3.5 h-3.5 text-[#2b1d16]" />
              <span>{lang === 'vi' ? 'Kéo để xoay • Cuộn để zoom' : 'Drag to rotate • Scroll to zoom'}</span>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl">
            <div className="bg-white/70 backdrop-blur-md rounded-xl p-2 border border-[#cea981]/40 shadow-xs">
              <div className="text-base font-black text-[#2b1d16]">
                {lang === 'vi' ? 'Bảo Đảm' : 'Protected'}
              </div>
              <div className="text-[11px] text-[#2b1d16]/75 font-bold">{lang === 'vi' ? 'Cơ chế Escrow' : 'Escrow Protection'}</div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-xl p-2 border border-[#cea981]/40 shadow-xs">
              <div className="text-base font-black text-[#2b1d16]">
                <CountUp to={360} duration={2.5} />° 3D
              </div>
              <div className="text-[11px] text-[#2b1d16]/75 font-bold">Mô phỏng 3D</div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-xl p-2 border border-[#cea981]/40 shadow-xs">
              <div className="text-base font-black text-[#2b1d16]">
                &lt; <CountUp to={3} duration={1.5} />%
              </div>
              <div className="text-[11px] text-[#2b1d16]/75 font-bold">Độ lệch giá AI</div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-xl p-2 border border-[#cea981]/40 shadow-xs">
              <div className="text-base font-black text-[#2b1d16]">
                <CountUp to={3} duration={1.2} /> Hubs
              </div>
              <div className="text-[11px] text-[#2b1d16]/75 font-bold">HN • ĐN • TP.HCM</div>
            </div>
          </div>
        </div>

        {/* 2. CHÍNH LÀ CHỖ NÀY: Khoảng trống ở giữa chỉ cần gọi Component vào */}
        <div className="flex-1 w-full h-[360px] sm:h-[420px] mx-0 lg:mx-4 relative flex items-center justify-center z-10">
          <Appliance3DViewer type={applianceType} autoRotate={autoRotate} />
        </div>

        {/* 3. Thẻ thông tin SecondLife Hub bên phải */}
        <div className="w-full sm:w-auto lg:w-[260px] shrink-0 z-10 flex flex-col gap-2">
          <div className="bg-white/75 backdrop-blur-xl border border-[#cea981]/50 rounded-2xl p-4 space-y-2.5 w-full text-xs shadow-lg">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#2b1d16] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#2b1d16]" />
                <span>SecondLife Hub</span>
              </span>
              <span className="text-[10px] bg-[#2b1d16] text-white px-1.5 py-0.5 rounded font-black tracking-wider">VERIFIED</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#2b1d16]/75 font-semibold">Thiết bị:</span>
                <span className="text-[#2b1d16] font-bold">
                  {applianceType === 'fridge' ? 'Tủ Lạnh Hitachi 540L' : 'Máy Giặt Electrolux Inverter'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#2b1d16]/75 font-semibold">Tình trạng:</span>
                <span className="text-[#2b1d16] font-bold">
                  {applianceType === 'fridge' ? 'Như mới (99%)' : 'Nguyên bản (98%)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#2b1d16]/75 font-semibold">{applianceType === 'fridge' ? 'Máy nén/Gas:' : 'Động cơ/Lồng:'}</span>
                <span className="text-[#2b1d16] font-bold">
                  {applianceType === 'fridge' ? 'Gas R600a (-19°C)' : 'EcoInverter (1400 RPM)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#2b1d16]/75 font-semibold">Tem niêm phong:</span>
                <span className="text-[#2b1d16] font-bold">
                  {applianceType === 'fridge' ? '#SL-HOME-8839' : '#SL-WASH-9912'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Export alias HeroBanner for convenience
export const HeroBanner = ShowroomLobby3D;
