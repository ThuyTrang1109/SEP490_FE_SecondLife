import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Sparkles, Eye, Play, Pause, Volume2, VolumeX, ShieldCheck, Box, RefreshCw, Cpu, Layers, Maximize2, Zap } from 'lucide-react';
import { soundFx } from '../utils/soundEffects';
import { ShinyText } from './react-bits/ShinyText';
import { BlurText } from './react-bits/BlurText';
import { CountUp } from './react-bits/CountUp';

interface ShowroomLobby3DProps {
  lang: 'vi' | 'en';
  onExplore3DProduct: () => void;
}

export const ShowroomLobby3D: React.FC<ShowroomLobby3DProps> = ({ lang, onExplore3DProduct }) => {
  const [mode, setMode] = useState<'video' | 'three3d'>('video');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<'cyber' | 'lab'>('cyber');
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-performance motion video loops
  const videoSources = {
    cyber: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-motherboard-processor-with-illuminated-circuits-40348-large.mp4',
    lab: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-an-engineer-working-on-a-circuit-board-42358-large.mp4'
  };

  // Toggle audio
  const handleToggleSound = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  };

  // Three.js interactive 3D scene
  useEffect(() => {
    if (mode !== 'three3d' && !videoError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c1412, 0.04);

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 400;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 8.5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x475569, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x34d399, 1.2, 15);
    fillLight.position.set(-3, 3, 2);
    scene.add(fillLight);

    // Studio Pedestal (Brushed dark stone)
    const pedestalGeo = new THREE.CylinderGeometry(2.4, 2.8, 0.35, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.1;
    scene.add(pedestal);

    // Subtle refined metallic ring
    const ringGeo = new THREE.TorusGeometry(3.0, 0.02, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      metalness: 0.9,
      roughness: 0.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.0;
    scene.add(ring);

    // Floating stylized phone device
    const phoneGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 0.16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2
    });
    const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
    phoneGroup.add(phoneBody);

    // Screen
    const screenGeo = new THREE.PlaneGeometry(1.5, 3.06);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      metalness: 0.5,
      roughness: 0.3
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.09;
    phoneGroup.add(screen);

    // Camera island
    const camIslandGeo = new THREE.BoxGeometry(0.7, 0.7, 0.08);
    const camIslandMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.1
    });
    const camIsland = new THREE.Mesh(camIslandGeo, camIslandMat);
    camIsland.position.set(-0.35, 1.1, -0.1);
    phoneGroup.add(camIsland);

    phoneGroup.position.y = 0.5;
    scene.add(phoneGroup);

    // Resize handling
    const handleResize = () => {
      if (!canvas) return;
      const newW = canvas.clientWidth;
      const newH = canvas.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      phoneGroup.rotation.y = elapsed * 0.4 + mouseX * 0.5;
      phoneGroup.position.y = 0.4 + Math.sin(elapsed * 1.5) * 0.08;
      ring.rotation.z = elapsed * 0.2;

      camera.position.x += (mouseX * 0.8 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 0.4 + 2.5 - camera.position.y) * 0.05;
      camera.lookAt(0, 0.3, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
    };
  }, [mode, videoError]);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#0F1715] text-white shadow-xl border border-stone-800/80 group">
      {/* Visual Background Container */}
      <div className="relative w-full h-[360px] sm:h-[390px] overflow-hidden bg-gradient-to-br from-[#121F1B] via-[#0E1715] to-[#090D0C]">
        {mode === 'video' && !videoError ? (
          <>
            <video
              ref={videoRef}
              src={videoSources[selectedVideo]}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onError={() => setVideoError(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-45 scale-102 transition-all duration-1000 group-hover:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E1715] via-[#0E1715]/75 to-transparent z-1" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1715] via-transparent to-black/30 z-1" />
          </>
        ) : (
          <div className="absolute inset-0 w-full h-full">
            <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E1715] via-[#0E1715]/65 to-transparent pointer-events-none z-1" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1715] via-transparent to-transparent pointer-events-none z-1" />
          </div>
        )}

        {/* Top Status Bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 bg-stone-900/85 backdrop-blur-md px-3 py-1 rounded-full border border-stone-700/60 text-stone-300 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold tracking-wide">
              {lang === 'vi' ? 'SẢNH KIỂM ĐỊNH 3D SECONDLIFE' : 'SECONDLIFE 3D INSPECTION LOBBY'}
            </span>
          </div>

          {/* Media Controls */}
          <div className="flex items-center gap-1.5 bg-stone-900/85 backdrop-blur-md p-1 rounded-xl border border-stone-700/60">
            <button
              onClick={() => {
                soundFx.playChime();
                setMode('video');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium transition ${
                mode === 'video'
                  ? 'bg-stone-800 text-white font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Play className="w-3 h-3" />
              <span>Video</span>
            </button>

            <button
              onClick={() => {
                soundFx.playChime();
                setMode('three3d');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium transition ${
                mode === 'three3d'
                  ? 'bg-stone-800 text-white font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>3D Interactive</span>
            </button>

            {mode === 'video' && (
              <button
                onClick={() => setSelectedVideo(selectedVideo === 'cyber' ? 'lab' : 'cyber')}
                className="px-2 py-0.5 text-[11px] text-stone-400 hover:text-emerald-300 transition"
                title="Đổi góc quay"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                {selectedVideo === 'cyber' ? 'Góc Vi Mạch' : 'Góc Phòng Lab'}
              </button>
            )}

            <button
              onClick={handleToggleSound}
              className="p-1 rounded-lg text-stone-400 hover:text-white transition"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 text-xs font-medium backdrop-blur-md w-fit">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'vi' ? 'Sàn Đồ Cũ Kiểm Định & AI Định Giá Uy Tín' : 'Certified Recommerce & AI Valuation'}</span>
          </div>

          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            <BlurText
              text={lang === 'vi' ? 'Mua Bán Đồ Cũ An Toàn Với Mô Hình 3D & Escrow.' : 'Verified Second-Hand with 3D Models & Escrow.'}
              delay={60}
              animateBy="words"
              direction="top"
              className="text-white"
            />
          </h1>

          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-xl font-normal">
            {lang === 'vi'
              ? 'Kiểm tra chi tiết thiết bị với mô hình 3D 360°, tra cứu biên bản kiểm định phần cứng và thanh toán được bảo vệ trọn vẹn qua Quỹ tín thác.'
              : 'Inspect devices in 360° 3D, verify hardware hub reports, and pay safely via Escrow protection.'}
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => {
                soundFx.playScanBeep();
                onExplore3DProduct();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B4D3E] hover:bg-[#22604d] text-white font-medium text-xs shadow-md transition-all cursor-pointer"
            >
              <Box className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Trải Nghiệm Soi 3D' : 'Launch 3D Viewer'}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playChime();
                setMode(mode === 'video' ? 'three3d' : 'video');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-200 font-medium text-xs border border-stone-700/60 backdrop-blur-md transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-stone-400" />
              <span>{mode === 'video' ? 'Chuyển Chế Độ 3D' : 'Chuyển Sang Video'}</span>
            </button>
          </div>

          {/* Statistics Grid */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl">
            <div className="bg-stone-900/70 backdrop-blur-md rounded-xl p-2 border border-stone-800/80">
              <div className="text-base font-bold text-emerald-400">
                <CountUp to={100} duration={2} />%
              </div>
              <div className="text-[11px] text-stone-400">Bảo vệ tiền Escrow</div>
            </div>
            <div className="bg-stone-900/70 backdrop-blur-md rounded-xl p-2 border border-stone-800/80">
              <div className="text-base font-bold text-teal-300">
                <CountUp to={360} duration={2.5} />° 3D
              </div>
              <div className="text-[11px] text-stone-400">Mô phỏng 3D</div>
            </div>
            <div className="bg-stone-900/70 backdrop-blur-md rounded-xl p-2 border border-stone-200/90">
              <div className="text-base font-bold text-stone-200">
                &lt; <CountUp to={3} duration={1.5} />%
              </div>
              <div className="text-[11px] text-stone-400">Độ lệch giá AI</div>
            </div>
            <div className="bg-stone-900/70 backdrop-blur-md rounded-xl p-2 border border-amber-500/20">
              <div className="text-base font-bold text-amber-300">
                <CountUp to={3} duration={1.2} /> Hubs
              </div>
              <div className="text-[11px] text-stone-400">HN • ĐN • TP.HCM</div>
            </div>
          </div>
        </div>

        {/* Right Studio Inspection Pill (Desktop) */}
        <div className="hidden lg:flex absolute right-8 bottom-6 z-10 flex-col gap-2 pointer-events-none">
          <div className="bg-stone-900/85 backdrop-blur-xl border border-stone-800 rounded-2xl p-3.5 space-y-2 max-w-[240px] text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>SecondLife Hub</span>
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-medium border border-emerald-800/60">VERIFIED</span>
            </div>
            <div className="space-y-1 text-[11px] text-stone-400">
              <div className="flex justify-between">
                <span>Thiết bị:</span>
                <span className="text-stone-200 font-medium">iPhone 15 Pro Max</span>
              </div>
              <div className="flex justify-between">
                <span>Tình trạng:</span>
                <span className="text-emerald-400 font-medium">Như mới (99%)</span>
              </div>
              <div className="flex justify-between">
                <span>Pin thực tế:</span>
                <span className="text-stone-200 font-medium">92% Nguyên bản</span>
              </div>
              <div className="flex justify-between">
                <span>Tem niêm phong:</span>
                <span className="text-stone-200 font-medium">#SL-8839</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
