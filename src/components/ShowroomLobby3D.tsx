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

  // Reliable, high-performance tech motion video loops
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

  // Three.js interactive 3D scene when mode === 'three3d' or as fallback
  useEffect(() => {
    if (mode !== 'three3d' && !videoError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040d12, 0.035);

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 450;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 9);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x10b981, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x34d399, 3, 20);
    pointLight.position.set(0, 5, 2);
    scene.add(pointLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 2, 20);
    blueLight.position.set(-4, 2, -2);
    scene.add(blueLight);

    // 3D Hexagonal / Cyber Inspection Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(2.5, 3, 0.4, 6);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: false
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.2;
    scene.add(pedestal);

    // Glowing wireframe ring around pedestal
    const ringGeo = new THREE.TorusGeometry(3.2, 0.04, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.1;
    scene.add(ring);

    // Outer rotating laser ring
    const outerRingGeo = new THREE.TorusGeometry(4.2, 0.02, 16, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2.2;
    outerRing.position.y = -1.0;
    scene.add(outerRing);

    // Floating 3D holographic device (Stylized flagship phone & tablet)
    const phoneGroup = new THREE.Group();

    // Phone body
    const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 0.18);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.1
    });
    const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
    phoneGroup.add(phoneBody);

    // Phone screen with emerald holographic sheen
    const screenGeo = new THREE.PlaneGeometry(1.5, 3.06);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x065f46,
      emissive: 0x047857,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.095;
    phoneGroup.add(screen);

    // Triple Camera Module bump
    const cameraBumpGeo = new THREE.BoxGeometry(0.65, 0.65, 0.08);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const cameraBump = new THREE.Mesh(cameraBumpGeo, bumpMat);
    cameraBump.position.set(0.35, 1.1, -0.12);
    phoneGroup.add(cameraBump);

    // Holographic inspection laser plane
    const scanPlaneGeo = new THREE.PlaneGeometry(3.5, 0.08);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const scanPlane = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    phoneGroup.add(scanPlane);

    scene.add(phoneGroup);

    // Floating Cyber Dust / Particles
    const particleCount = 180;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 14;
      positions[i + 1] = (Math.random() - 0.5) * 8 + 1;
      positions[i + 2] = (Math.random() - 0.5) * 14;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0x34d399,
      size: 0.06,
      transparent: true,
      opacity: 0.7
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    // Mouse parallax tracking
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    // Handle Resize
    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Phone levitation and gentle rotation
      phoneGroup.position.y = Math.sin(elapsed * 1.5) * 0.15 + 0.3;
      phoneGroup.rotation.y = elapsed * 0.6;
      phoneGroup.rotation.x = Math.sin(elapsed * 0.8) * 0.1;

      // Laser scanning sweep up and down
      scanPlane.position.y = Math.sin(elapsed * 2.8) * 1.5;
      scanPlane.rotation.y = elapsed * 0.6;

      // Rotating pedestal rings
      ring.rotation.z = elapsed * 0.4;
      outerRing.rotation.z = -elapsed * 0.3;

      // Particle floating
      particleSystem.rotation.y = elapsed * 0.08;

      // Camera parallax response
      camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 0.8 + 2.5 - camera.position.y) * 0.05;
      camera.lookAt(0, 0.4, 0);

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
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl border border-emerald-500/30 group">
      {/* Visual Background Container */}
      <div className="relative w-full h-[460px] sm:h-[500px] overflow-hidden bg-radial from-slate-900 via-slate-950 to-black">
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
              className="absolute inset-0 w-full h-full object-cover opacity-65 scale-105 transition-all duration-1000 group-hover:scale-100"
            />
            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent z-1" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40 z-1" />
            <div className="absolute inset-0 bg-emerald-950/20 mix-blend-overlay z-1" />
          </>
        ) : (
          <div className="absolute inset-0 w-full h-full">
            <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent pointer-events-none z-1" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none z-1" />
          </div>
        )}

        {/* Ambient Grid lines overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#05966910_1px,transparent_1px),linear-gradient(to_bottom,#05966910_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-2" />

        {/* High-Tech Top Status Bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-300 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold tracking-wider uppercase text-[11px] font-['Outfit']">
              {lang === 'vi' ? 'SẢNH 3D & KIỂM ĐỊNH KỸ THUẬT SỐ' : '3D SHOWROOM & DIGITAL INSPECTION LOBBY'}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-mono text-[10px]">FPS 60 • 4K SHADER</span>
          </div>

          {/* Lobby Mode & Media Controls */}
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 shadow-lg">
            {/* Toggle Video vs 3D Mode */}
            <button
              onClick={() => {
                soundFx.playChime();
                setMode('video');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition ${
                mode === 'video'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Video Sảnh Chuyển Động' : 'Motion Video Lobby'}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playChime();
                setMode('three3d');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition ${
                mode === 'three3d'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Sảnh 3D Tương Tác' : 'Interactive 3D Three.js'}</span>
            </button>

            {mode === 'video' && (
              <div className="flex items-center border-l border-slate-700 pl-2 gap-1">
                <button
                  onClick={() => setSelectedVideo(selectedVideo === 'cyber' ? 'lab' : 'cyber')}
                  className="px-2 py-1 text-[11px] text-slate-300 hover:text-emerald-400 font-medium"
                  title="Đổi góc máy video sảnh"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  {selectedVideo === 'cyber' ? 'Góc Cyber' : 'Góc Lab'}
                </button>
              </div>
            )}

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition ${
                !isMuted ? 'text-emerald-400 bg-emerald-950/60' : 'hover:bg-slate-800'
              }`}
              title={isMuted ? 'Bật âm thanh không gian' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Hero Content Overlay (Foreground) */}
        <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-10 pb-8 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold backdrop-blur-md w-fit shadow-xs">
            <Zap className="w-4 h-4 text-emerald-400" />
            <ShinyText
              text={lang === 'vi' ? 'Sàn Đồ Cũ Số 1 Việt Nam • AI Định Giá & Kiểm Định 3D' : 'Vietnam #1 Inspected Recommerce Marketplace'}
              color="#a7f3d0"
              shineColor="#ffffff"
              speed={2.5}
            />
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-white">
            <BlurText
              text={lang === 'vi' ? 'Sàn Đồ Cũ Công Nghệ 3D & Kiểm Định Tận Tay.' : 'Next-Gen 3D Recommerce with Hardware Inspection.'}
              delay={80}
              animateBy="words"
              direction="top"
              className="text-white"
            />
          </h1>

          <p className="text-slate-200 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
            {lang === 'vi'
              ? 'Chiêm ngưỡng thiết bị với mô hình 3D 360°, tra cứu kết quả kiểm định vi mạch phần cứng tại Hub SecondLife trước khi kích hoạt thanh toán bảo vệ tiền Escrow.'
              : 'Inspect devices via interactive 360° 3D models and certified hardware hub diagnostics before releasing escrow payments.'}
          </p>

          {/* Quick CTA Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                soundFx.playScanBeep();
                onExplore3DProduct();
              }}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Box className="w-4 h-4 text-slate-950" />
              <span>{lang === 'vi' ? 'Mở Trình Soi Thiết Bị 3D' : 'Launch 3D Hardware Viewer'}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playChime();
                setMode(mode === 'video' ? 'three3d' : 'video');
              }}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-sm border border-slate-700/80 backdrop-blur-md transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>
                {mode === 'video'
                  ? (lang === 'vi' ? 'Chuyển Sang Sảnh 3D Tương Tác' : 'Switch to 3D Three.js')
                  : (lang === 'vi' ? 'Xem Video Sảnh Chuyển Động' : 'Switch to Motion Video')}
              </span>
            </button>
          </div>

          {/* Key Statistics Grid with React Bits CountUp */}
          <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <div className="bg-slate-900/75 backdrop-blur-md rounded-2xl p-3 border border-emerald-500/25 shadow-sm">
              <div className="text-lg sm:text-xl font-extrabold text-emerald-400">
                <CountUp to={100} duration={2} />%
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Bảo vệ tiền Escrow</div>
            </div>
            <div className="bg-slate-900/75 backdrop-blur-md rounded-2xl p-3 border border-teal-500/25 shadow-sm">
              <div className="text-lg sm:text-xl font-extrabold text-teal-300">
                <CountUp to={360} duration={2.5} />° 3D
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Mô phỏng & X-Ray</div>
            </div>
            <div className="bg-slate-900/75 backdrop-blur-md rounded-2xl p-3 border border-cyan-500/25 shadow-sm">
              <div className="text-lg sm:text-xl font-extrabold text-cyan-300">
                &lt; <CountUp to={3} duration={1.5} />%
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Độ lệch định giá AI</div>
            </div>
            <div className="bg-slate-900/75 backdrop-blur-md rounded-2xl p-3 border border-amber-500/25 shadow-sm">
              <div className="text-lg sm:text-xl font-extrabold text-amber-300">
                <CountUp to={3} duration={1.2} /> Hubs
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">HN • ĐN • TP.HCM</div>
            </div>
          </div>
        </div>

        {/* Interactive 3D Hologram Floating Widget on the right (Desktop only) */}
        <div className="hidden lg:flex absolute right-8 bottom-8 z-10 flex-col gap-2 pointer-events-none">
          <div className="bg-slate-900/85 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl space-y-2.5 max-w-[270px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" />
                <span>AI Diagnostics Hub</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-mono font-bold">LIVE</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Target:</span>
                <span className="text-white font-semibold">iPhone 15 Pro Max</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Grade:</span>
                <span className="text-emerald-400 font-bold">Như mới (99%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Battery:</span>
                <span className="text-white">92% Nguyên Bản</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tamper Seal:</span>
                <span className="text-teal-300">#SL-8839 (Đạt Chuẩn)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
