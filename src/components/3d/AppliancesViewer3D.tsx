import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ShieldCheck, Box, RefreshCw, Move3d } from 'lucide-react';
import { soundFx } from '../../utils/soundEffects';

interface AppliancesViewer3DProps {
  lang: 'vi' | 'en';
}

export const AppliancesViewer3D: React.FC<AppliancesViewer3DProps> = ({ lang }) => {
  const [rotateY, setRotateY] = useState(0);
  const [rotateX, setRotateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  const startPosRef = useRef({ x: 0, y: 0 });
  const currentRotRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  // Auto rotation loop when not dragging
  useEffect(() => {
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (autoRotate && !isDragging) {
        setRotateY((prev) => (prev + delta * 15) % 360);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoRotate, isDragging]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    currentRotRef.current = { x: rotateX, y: rotateY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    const newY = currentRotRef.current.y + deltaX * 0.5;
    const newX = Math.max(-20, Math.min(20, currentRotRef.current.x - deltaY * 0.3));

    setRotateY(newY);
    setRotateX(newX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      currentRotRef.current = { x: rotateX, y: rotateY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - startPosRef.current.x;
    const deltaY = e.touches[0].clientY - startPosRef.current.y;

    const newY = currentRotRef.current.y + deltaX * 0.5;
    const newX = Math.max(-20, Math.min(20, currentRotRef.current.x - deltaY * 0.3));

    setRotateY(newY);
    setRotateX(newX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const formattedDegree = Math.floor(((rotateY % 360) + 360) % 360);

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

          {/* Right Pill: AI MESH 360° */}
          <button
            onClick={() => {
              soundFx.playChime();
              setAutoRotate((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-extrabold shadow-md hover:scale-105 transition cursor-pointer"
            title="Click to toggle 360° auto-rotation"
          >
            <span>AI MESH 360°</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
              {formattedDegree}°
            </span>
          </button>
        </div>

        {/* Center Display Card (Crisp White Background as in Reference Image) */}
        <div
          className="relative bg-white rounded-2xl p-4 sm:p-6 min-h-[280px] sm:min-h-[320px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing border border-slate-200 shadow-inner"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ perspective: '1200px' }}
        >
          {/* Top Left Badge inside White Card */}
          <div className="absolute top-3 left-3 z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E121B]/85 text-white text-xs font-medium border border-white/20 backdrop-blur-md shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EC1577] animate-pulse" />
              <span>{lang === 'vi' ? 'Tủ Lạnh • Grade A+ (99%)' : 'Refrigerator • Grade A+ (99%)'}</span>
            </div>
          </div>

          {/* Center Badge: Hub NFC Verified */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0E121B]/90 text-white text-xs font-bold border border-amber-400/40 shadow-xl backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Hub NFC Verified</span>
            </div>
          </div>

          {/* Bottom Right Badge: AI Định Giá */}
          <div className="absolute bottom-3 right-3 z-20">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E121B]/90 text-white text-xs font-bold border border-white/20 shadow-lg backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
              <span>{lang === 'vi' ? 'AI Định Giá: 14.800.000đ' : 'AI Valuation: 14,800,000đ'}</span>
            </div>
          </div>

          {/* Bottom Left Drag Indicator */}
          <div className="absolute bottom-3 left-3 z-20 opacity-70 hover:opacity-100 transition">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E121B]/70 text-slate-200 text-[11px] font-medium backdrop-blur-sm border border-white/10">
              <Move3d className="w-3 h-3 text-[#F1622A]" />
              <span>{lang === 'vi' ? 'Kéo chuột để xoay 3D' : 'Drag to rotate 3D'}</span>
            </div>
          </div>

          {/* 3D Interactive Appliance Group Image Stage */}
          <div
            className="relative z-10 w-full flex items-center justify-center transition-transform duration-75 ease-out"
            style={{
              transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Appliance Collection Image */}
            <img
              src="/appliances-3d.png"
              alt="3D Spatial Appliances Collection"
              className="max-h-[220px] sm:max-h-[260px] w-auto object-contain drop-shadow-2xl pointer-events-none select-none"
            />

            {/* Dynamic 3D Shadow underneath floor */}
            <div
              className="absolute -bottom-4 w-3/4 h-6 bg-black/20 rounded-full blur-md pointer-events-none"
              style={{
                transform: `translateZ(-20px) scale(${1 - Math.abs(rotateX) / 50})`
              }}
            />
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

