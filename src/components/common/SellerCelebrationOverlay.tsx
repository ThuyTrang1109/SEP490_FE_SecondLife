import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Sparkles, Store, Truck, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { Language } from '../../types';

interface SellerCelebrationOverlayProps {
  isOpen: boolean;
  shopName?: string;
  lang?: Language;
  countdownSeconds?: number;
  onProceedNext: () => void;
  onGoToDashboard: () => void;
}

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
}

const FIREWORK_COLORS = [
  '#ff5a36',
  '#fbbf24',
  '#34d399',
  '#38bdf8',
  '#a855f7',
  '#fb7185',
  '#fde047',
];

export const SellerCelebrationOverlay: React.FC<SellerCelebrationOverlayProps> = ({
  isOpen,
  shopName,
  lang = 'vi',
  countdownSeconds = 30,
  onProceedNext,
  onGoToDashboard,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(countdownSeconds);
  const hasTriggeredProceedRef = useRef(false);
  const onProceedRef = useRef(onProceedNext);
  onProceedRef.current = onProceedNext;

  // Countdown 30s -> 0s and automatically navigate to next action
  useEffect(() => {
    if (!isOpen) {
      hasTriggeredProceedRef.current = false;
      setSecondsLeft(countdownSeconds);
      return;
    }

    hasTriggeredProceedRef.current = false;
    setSecondsLeft(countdownSeconds);

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (!hasTriggeredProceedRef.current) {
            hasTriggeredProceedRef.current = true;
            window.setTimeout(() => onProceedRef.current(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, countdownSeconds]);

  // Full-screen HTML5 Canvas fireworks animation
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId = 0;
    const particles: FireworkParticle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const spawnBurst = (cx: number, cy: number, count = 48) => {
      const baseColor = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
        const speed = 2.2 + Math.random() * 5.2;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.012,
          color: Math.random() > 0.25
            ? baseColor
            : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          size: 2 + Math.random() * 2.5,
        });
      }
    };

    const launchSalvo = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      spawnBurst(w * (0.18 + Math.random() * 0.64), h * (0.16 + Math.random() * 0.34), 56);
    };

    // Initial celebratory salvo across the viewport
    spawnBurst(window.innerWidth * 0.25, window.innerHeight * 0.28, 60);
    spawnBurst(window.innerWidth * 0.75, window.innerHeight * 0.26, 60);
    const secondWave = window.setTimeout(() => {
      spawnBurst(window.innerWidth * 0.5, window.innerHeight * 0.22, 72);
    }, 320);

    const burstInterval = window.setInterval(launchSalvo, 950);

    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.065; // gentle gravity
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.alpha -= p.decay;

        if (p.alpha <= 0.02) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrameId = window.requestAnimationFrame(render);
    };

    animFrameId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(secondWave);
      window.clearInterval(burstInterval);
      window.cancelAnimationFrame(animFrameId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / countdownSeconds) * 100));

  const handleProceedClick = () => {
    if (hasTriggeredProceedRef.current) return;
    hasTriggeredProceedRef.current = true;
    onProceedNext();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-[91] pointer-events-none"
      />

      <div className="relative z-[92] w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-amber-200 overflow-hidden animate-in zoom-in-95">
        <button
          type="button"
          onClick={onGoToDashboard}
          aria-label={lang === 'vi' ? 'Đóng thông báo' : 'Close notification'}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebration Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#24263e] via-[#343759] to-[#c34c36] text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-300/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" />
                <span>{lang === 'vi' ? 'Đăng ký thành công' : 'Registration Approved'}</span>
              </span>
              <h3 className="text-base sm:text-lg font-black leading-snug">
                {lang === 'vi'
                  ? 'Chúc mừng bạn đã trở thành Người Bán trên SecondLife!'
                  : 'Congratulations! You are now a verified Seller on SecondLife!'}
              </h3>
              {shopName && (
                <p className="text-xs text-white/85 mt-0.5">
                  {lang === 'vi' ? `Gian hàng "${shopName}" đã được kích hoạt chính thức.` : `Store "${shopName}" is now active.`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body: 30s countdown + Next Steps */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-800">
          {/* 30s Countdown Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-950">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#c34c36] shrink-0" />
                <span>
                  {lang === 'vi'
                    ? 'Tự động chuyển sang bước đăng nhập kích hoạt quyền Người Bán sau:'
                    : 'Proceeding to re-login for Seller activation in:'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#c34c36] text-white font-black tabular-nums text-xs">
                {secondsLeft}s
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-amber-200/70 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#c34c36] to-emerald-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Next Steps Guidance */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              {lang === 'vi' ? 'Thao tác tiếp theo sau khi đăng ký thành công' : 'Next steps after Seller registration'}
            </h4>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="w-7 h-7 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-black shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {lang === 'vi' ? '1. Đăng nhập lại để nhận quyền Người Bán mới' : '1. Log in again to activate Seller permissions'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {lang === 'vi'
                    ? 'Hệ thống vừa nâng cấp quyền tài khoản lên Người Bán, hãy đăng nhập lại để làm mới phiên truy cập bảo mật.'
                    : 'Your role has been upgraded to Seller. Sign back in to refresh your security session.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {lang === 'vi' ? '2. Đăng tin sản phẩm đầu tiên' : '2. Post your first appliance listing'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {lang === 'vi'
                    ? 'Mở Kênh Người Bán → Đăng tin bán, tải ảnh thực tế thiết bị và nhận AI gợi ý giá niêm yết phù hợp.'
                    : 'Open Seller Dashboard → Post Listing, upload real device photos, and get AI fair-price suggestions.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {lang === 'vi' ? '3. Kiểm định Hub / Lalamove lấy tận kho & Giải ngân Escrow' : '3. Hub inspection / pickup & Escrow payout'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {lang === 'vi'
                    ? 'Giao thiết bị kiểm định qua địa chỉ kho vừa đăng ký và nhận tiền bán an toàn qua quỹ Escrow.'
                    : 'Hand over devices from your registered warehouse address and receive safe Escrow payouts.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onGoToDashboard}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng thông báo' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleProceedClick}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#e05d42] hover:opacity-95 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {lang === 'vi' ? `Đăng nhập lại ngay (${secondsLeft}s)` : `Log in again now (${secondsLeft}s)`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
