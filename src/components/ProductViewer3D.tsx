import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Layers,
  ShieldCheck,
  Cpu,
  Info,
  Camera,
  Eye,
  CheckCircle2,
  Sun,
  Palette,
  Compass,
  Download
} from 'lucide-react';
import { Listing } from '../types';
import { soundFx } from '../utils/soundEffects';

interface ProductViewer3DProps {
  listing?: Listing | null;
  lang: 'vi' | 'en';
  onClose?: () => void;
}

interface Hotspot {
  id: string;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  position: [number, number, number];
  targetCamera: [number, number, number];
  status: 'passed' | 'minor' | 'verified';
}

const COLORWAYS = [
  { id: 'natural', name: 'Titan Tự Nhiên', hex: 0x9b958c, roughness: 0.25, metalness: 0.95 },
  { id: 'black', name: 'Titan Đen', hex: 0x242426, roughness: 0.3, metalness: 0.95 },
  { id: 'blue', name: 'Titan Xanh', hex: 0x2c3b4d, roughness: 0.25, metalness: 0.95 },
  { id: 'white', name: 'Titan Trắng', hex: 0xe5e5ea, roughness: 0.2, metalness: 0.9 }
];

export const ProductViewer3D: React.FC<ProductViewer3DProps> = ({ listing, lang, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // View state
  const [explodedView, setExplodedView] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedColor, setSelectedColor] = useState(COLORWAYS[0]);
  const [lightingPreset, setLightingPreset] = useState<'studio' | 'cyber' | 'sun'>('studio');
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  // Define Hotspots for inspection
  const hotspots: Hotspot[] = [
    {
      id: 'camera',
      titleVi: 'Cụm 3 Camera Sapphire',
      titleEn: 'Triple Sapphire Camera Island',
      descVi: 'Ống kính trong suốt không một vết trầy xước. Lớp tráng phủ chống lóa nguyên bản, cảm biến chống rung OIS hoạt động chính xác 100%.',
      descEn: 'Pristine sapphire crystal glass with no scratches. Original anti-reflective coating intact, OIS stabilization passes 100%.',
      position: [0.55, 1.15, -0.22],
      targetCamera: [1.2, 1.4, -2.2],
      status: 'passed'
    },
    {
      id: 'screen',
      titleVi: 'Màn Hình Super Retina XDR OLED',
      titleEn: 'Super Retina XDR OLED Display',
      descVi: 'Độ sáng đạt chuẩn 2,000 nits. Cảm ứng mượt mà 120Hz ProMotion, TrueTone và Face ID nhạy bén, không điểm chết (0 dead pixels).',
      descEn: 'Full 2,000 nits peak brightness. 120Hz ProMotion touch responsiveness, TrueTone & Face ID active with 0 dead pixels.',
      position: [0, 0.4, 0.22],
      targetCamera: [0, 0.4, 3.2],
      status: 'passed'
    },
    {
      id: 'frame',
      titleVi: 'Khung Viền Titanium Cấp Hàng Không',
      titleEn: 'Aerospace Grade Titanium Frame',
      descVi: 'Khung titan đúc nguyên khối. Ghi nhận vi xước dăm 0.1mm góc cổng sạc do cọ xát chìa khóa, đã được AI định giá chiết khấu minh bạch.',
      descEn: 'Unibody titanium chassis. Recorded micro-abrasion 0.1mm near charging port, factored objectively by AI valuation model.',
      position: [0.95, -0.6, 0],
      targetCamera: [2.5, -0.6, 0.5],
      status: 'minor'
    },
    {
      id: 'battery',
      titleVi: 'Cell Pin & Bo Mạch Logic',
      titleEn: 'Original Battery Cell & Logic Board',
      descVi: 'Pin zin theo máy dung lượng 93% (238 chu kỳ sạc). Chip A17 Pro nguyên bản, chưa qua sửa chữa hoặc câu dây nguồn.',
      descEn: 'Original OEM battery with 93% health (238 charge cycles). Unmodified motherboard with genuine SoC.',
      position: [-0.3, -0.2, 0],
      targetCamera: [-1.5, 0.2, 2.5],
      status: 'verified'
    },
    {
      id: 'nfc-seal',
      titleVi: 'Tem Niêm Phong Chống Giả NFC SecondLife',
      titleEn: 'SecondLife Cryptographic NFC Tamper Seal',
      descVi: 'Mã tem #SL-8839 đã mã hóa bưu kiện trên Blockchain. Nếu tem bị rách hoặc tháo gỡ trước khi người mua nhận máy, bảo lãnh Escrow hoàn tiền 100%.',
      descEn: 'Cryptographic seal #SL-8839 signed on chain. If breached before buyer acceptance, escrow issues immediate 100% refund.',
      position: [0, -1.3, -0.15],
      targetCamera: [0, -1.6, -2.5],
      status: 'verified'
    }
  ];

  // Three.js Scene Setup & References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const backCoverRef = useRef<THREE.Mesh | null>(null);
  const internalsGroupRef = useRef<THREE.Group | null>(null);
  const lightsRef = useRef<{ ambient: THREE.AmbientLight; main: THREE.DirectionalLight; accent: THREE.PointLight } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 550;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.5, 5.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const accentLight = new THREE.PointLight(0x10b981, 2, 20);
    accentLight.position.set(-4, -2, -3);
    scene.add(accentLight);

    lightsRef.current = { ambient: ambientLight, main: mainLight, accent: accentLight };

    // Group for whole phone
    const modelGroup = new THREE.Group();
    modelGroupRef.current = modelGroup;

    // 1. Titanium Frame (Curved Box Geometry approximation)
    const frameGeo = new THREE.BoxGeometry(2.0, 4.1, 0.22, 4, 4, 4);
    const frameMat = new THREE.MeshStandardMaterial({
      color: selectedColor.hex,
      metalness: selectedColor.metalness,
      roughness: selectedColor.roughness
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    modelGroup.add(frameMesh);

    // 2. Front Screen (OLED Glass)
    const screenGeo = new THREE.PlaneGeometry(1.88, 3.96);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.9,
      roughness: 0.08,
      emissive: 0x064e3b,
      emissiveIntensity: 0.25
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = 0.115;
    modelGroup.add(screenMesh);

    // Front Dynamic Island / Speaker Pill
    const pillGeo = new THREE.CapsuleGeometry(0.06, 0.26, 8, 16);
    const pillMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pillMesh = new THREE.Mesh(pillGeo, pillMat);
    pillMesh.rotation.z = Math.PI / 2;
    pillMesh.position.set(0, 1.76, 0.12);
    modelGroup.add(pillMesh);

    // 3. Back Cover (Matte Frosted Glass) - Designed to separate in Exploded Mode
    const backGeo = new THREE.PlaneGeometry(1.88, 3.96);
    const backMat = new THREE.MeshStandardMaterial({
      color: selectedColor.hex,
      metalness: 0.85,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.z = -0.115;
    backMesh.rotation.y = Math.PI;
    backMesh.castShadow = true;
    modelGroup.add(backMesh);
    backCoverRef.current = backMesh;

    // 4. Rear Camera Module Island
    const cameraIslandGeo = new THREE.BoxGeometry(0.85, 0.85, 0.09);
    const islandMat = new THREE.MeshStandardMaterial({
      color: selectedColor.hex,
      metalness: 0.9,
      roughness: 0.2
    });
    const cameraIsland = new THREE.Mesh(cameraIslandGeo, islandMat);
    cameraIsland.position.set(0.48, 1.45, -0.16);
    backMesh.add(cameraIsland); // Attached to back cover

    // 3 Camera Lenses with Sapphire Glass & Metal Rings
    const lensPositions: [number, number][] = [
      [-0.22, 0.22],
      [-0.22, -0.22],
      [0.22, 0]
    ];
    lensPositions.forEach(([lx, ly]) => {
      // Ring
      const ringGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.1 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(lx, ly, -0.06);
      cameraIsland.add(ringMesh);

      // Glass Lens
      const glassGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.03, 32);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        transmission: 0.85,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
        ior: 1.77 // Sapphire glass
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.rotation.x = Math.PI / 2;
      glassMesh.position.set(lx, ly, -0.1);
      cameraIsland.add(glassMesh);
    });

    // 5. Internal Hardware Group (Revealed during Exploded / X-Ray Mode)
    const internalsGroup = new THREE.Group();
    internalsGroupRef.current = internalsGroup;

    // Battery pack
    const batteryGeo = new THREE.BoxGeometry(1.0, 2.3, 0.08);
    const batteryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const batteryMesh = new THREE.Mesh(batteryGeo, batteryMat);
    batteryMesh.position.set(0.35, -0.3, 0);
    internalsGroup.add(batteryMesh);

    // Motherboard PCB
    const pcbGeo = new THREE.BoxGeometry(1.6, 1.3, 0.06);
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.3 });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.position.set(0, 1.1, 0);
    internalsGroup.add(pcbMesh);

    // A17 Pro SoC Chip with Metallic Heat Shield
    const chipGeo = new THREE.BoxGeometry(0.5, 0.5, 0.04);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.2
    });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(-0.2, 1.1, 0.04);
    internalsGroup.add(chipMesh);

    // SecondLife Tamper-Evident NFC Seal inside chassis
    const sealGeo = new THREE.BoxGeometry(0.6, 0.3, 0.02);
    const sealMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.5
    });
    const sealMesh = new THREE.Mesh(sealGeo, sealMat);
    sealMesh.position.set(0, -1.5, 0.04);
    internalsGroup.add(sealMesh);

    internalsGroup.visible = false;
    modelGroup.add(internalsGroup);

    // Add model to scene
    scene.add(modelGroup);

    // Mouse Drag Rotation Handling
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      modelGroup.rotation.y += deltaX * 0.008;
      modelGroup.rotation.x += deltaY * 0.008;

      // Restrict x rotation to prevent flipping upside down
      modelGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, modelGroup.rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.003;
      camera.position.z = Math.max(2.8, Math.min(8.0, camera.position.z));
      setZoomLevel(Math.round((5.2 / camera.position.z) * 100) / 100);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Handle Window Resize
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
      const delta = clock.getDelta();

      if (autoRotate && !isDragging && !activeHotspot) {
        modelGroup.rotation.y += delta * 0.5;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  // Update Colorway
  useEffect(() => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.name !== 'screen' && child !== backCoverRef.current) {
          child.material.color.setHex(selectedColor.hex);
          child.material.roughness = selectedColor.roughness;
          child.material.metalness = selectedColor.metalness;
        }
      }
    });
    if (backCoverRef.current && backCoverRef.current.material instanceof THREE.MeshStandardMaterial) {
      backCoverRef.current.material.color.setHex(selectedColor.hex);
    }
  }, [selectedColor]);

  // Update Lighting Preset
  useEffect(() => {
    if (!lightsRef.current) return;
    const { ambient, main, accent } = lightsRef.current;
    if (lightingPreset === 'studio') {
      ambient.color.setHex(0xffffff);
      ambient.intensity = 1.3;
      main.color.setHex(0xffffff);
      main.intensity = 2.4;
      accent.color.setHex(0x10b981);
      accent.intensity = 1.2;
    } else if (lightingPreset === 'cyber') {
      ambient.color.setHex(0x064e3b);
      ambient.intensity = 1.8;
      main.color.setHex(0x38bdf8);
      main.intensity = 3.0;
      accent.color.setHex(0xa855f7);
      accent.intensity = 2.5;
    } else {
      // sun
      ambient.color.setHex(0xfef3c7);
      ambient.intensity = 1.1;
      main.color.setHex(0xfbbf24);
      main.intensity = 3.5;
      accent.color.setHex(0x60a5fa);
      accent.intensity = 0.8;
    }
  }, [lightingPreset]);

  // Handle Exploded View Toggle
  const toggleExplodedView = () => {
    soundFx.playScanBeep();
    const newExploded = !explodedView;
    setExplodedView(newExploded);

    if (backCoverRef.current && internalsGroupRef.current) {
      if (newExploded) {
        internalsGroupRef.current.visible = true;
        // Slide back cover backward
        backCoverRef.current.position.z = -1.2;
        // Pause auto-rotate to inspect
        setAutoRotate(false);
      } else {
        internalsGroupRef.current.visible = false;
        backCoverRef.current.position.z = -0.115;
      }
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    soundFx.playChime();
    setActiveHotspot(null);
    if (cameraRef.current && modelGroupRef.current) {
      cameraRef.current.position.set(0, 0.5, 5.2);
      cameraRef.current.lookAt(0, 0, 0);
      modelGroupRef.current.rotation.set(0, 0, 0);
      setZoomLevel(1);
    }
  };

  // Zoom In/Out
  const handleZoom = (delta: number) => {
    soundFx.playChime();
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.max(2.8, Math.min(8.0, cameraRef.current.position.z - delta));
      setZoomLevel(Math.round((5.2 / cameraRef.current.position.z) * 100) / 100);
    }
  };

  // Hotspot Click
  const handleHotspotClick = (spot: Hotspot) => {
    soundFx.playScanBeep();
    setActiveHotspot(spot);
    setAutoRotate(false);

    if (cameraRef.current && modelGroupRef.current) {
      // Smoothly animate camera toward target camera angle
      const [tx, ty, tz] = spot.targetCamera;
      cameraRef.current.position.set(tx, ty, tz);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  // Capture High-Res Snapshot
  const handleSnapshot = () => {
    soundFx.playScanBeep();
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 2500);

    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `SecondLife-3D-Inspection-${listing?.brand || 'Device'}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  return (
    <div className="bg-slate-950 rounded-3xl overflow-hidden border border-emerald-500/40 text-white shadow-2xl flex flex-col h-full relative">
      {/* Top Controls Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white font-['Outfit']">
                {listing?.title || (lang === 'vi' ? 'Mô Hình 3D Kiểm Định Thiết Bị' : '3D Hardware Inspection Model')}
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                PBR 3D SHADER
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'vi'
                ? 'Giữ chuột kéo để xoay 360°, cuộn chuột phóng to soi vết xước'
                : 'Drag to rotate 360°, scroll to zoom in & inspect micro scratches'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exploded / X-Ray Teardown Button */}
          <button
            onClick={toggleExplodedView}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              explodedView
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {explodedView
                ? (lang === 'vi' ? 'Đóng Nắp Lưng' : 'Close Back Cover')
                : (lang === 'vi' ? 'Bóc Tách Linh Kiện (X-Ray)' : 'Exploded View (X-Ray)')}
            </span>
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => {
              soundFx.playChime();
              setAutoRotate(!autoRotate);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
              autoRotate
                ? 'bg-emerald-600/80 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {autoRotate ? 'Tắt Xoay Tự Động' : 'Bật Xoay Tự Động'}
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            title="Khôi phục góc nhìn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Snapshot Button */}
          <button
            onClick={handleSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            title="Chụp ảnh 3D & Lưu"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{snapshotTaken ? 'Đã Lưu!' : 'Chụp 3D'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-bold border border-red-500/30 cursor-pointer"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="relative flex-1 min-h-[440px] sm:min-h-[500px] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#05966908_1px,transparent_1px),linear-gradient(to_bottom,#05966908_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

        {/* Left Floating Hotspot Inspection Points */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 max-w-[240px]">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3 text-emerald-400" />
            <span>{lang === 'vi' ? 'Điểm Kiểm Tra Vi Mô' : 'Inspection Pins'}</span>
          </div>

          {hotspots.map((spot) => {
            const isActive = activeHotspot?.id === spot.id;
            return (
              <button
                key={spot.id}
                onClick={() => handleHotspotClick(spot)}
                className={`text-left p-2 rounded-xl text-xs transition border backdrop-blur-md cursor-pointer flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-emerald-600/90 text-white border-emerald-400 ring-2 ring-emerald-500/30 shadow-lg'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                }`}
              >
                <div className="truncate">
                  <div className="font-bold truncate">{lang === 'vi' ? spot.titleVi : spot.titleEn}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {spot.status === 'passed' ? '✓ Đạt 100%' : spot.status === 'verified' ? '★ Xác thực Hub' : '⚠ Vi xước nhẹ'}
                  </div>
                </div>
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    spot.status === 'passed'
                      ? 'bg-emerald-400'
                      : spot.status === 'verified'
                      ? 'bg-teal-400'
                      : 'bg-amber-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Active Hotspot Detail Card Modal Overlay */}
        {activeHotspot && (
          <div className="absolute right-4 top-4 z-10 max-w-sm bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-4 shadow-2xl space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                <span>SecondLife Hub Verified</span>
              </span>
              <button
                onClick={() => setActiveHotspot(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            <h3 className="font-bold text-white text-sm">
              {lang === 'vi' ? activeHotspot.titleVi : activeHotspot.titleEn}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'vi' ? activeHotspot.descVi : activeHotspot.descEn}
            </p>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Độ phân giải siêu âm: 0.05mm</span>
              <span className="text-emerald-400 font-bold">KẾT QUẢ: ĐẠT CHUẨN</span>
            </div>
          </div>
        )}

        {/* Exploded Mode HUD Indicator */}
        {explodedView && (
          <div className="absolute top-4 inset-x-0 mx-auto w-fit z-10 bg-amber-500/20 backdrop-blur-md border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
            <Layers className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'ĐANG BÓC TÁCH LINH KIỆN & PIN (X-RAY)' : 'EXPLODED HARDWARE VIEW ACTIVE'}</span>
          </div>
        )}

        {/* Floating Zoom & Compass Controls (Bottom Right) */}
        <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => handleZoom(0.5)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.5)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-mono text-center text-slate-400 pt-1 border-t border-slate-800">
            {zoomLevel}x
          </div>
        </div>
      </div>

      {/* Bottom Colorway & Lighting Customizer Toolbar */}
      <div className="px-5 py-3 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10 text-xs">
        {/* Color Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-slate-400 font-semibold">
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'vi' ? 'Màu Hoàn Thiện:' : 'Colorway:'}</span>
          </div>
          <div className="flex items-center gap-2">
            {COLORWAYS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  soundFx.playChime();
                  setSelectedColor(c);
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition ${
                  selectedColor.id === c.id
                    ? 'bg-slate-800 border-emerald-500 text-white font-bold'
                    : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                  style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }}
                />
                <span className="text-[11px]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lighting Atmosphere Preset */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-slate-400 font-semibold">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'vi' ? 'Ánh Sáng Studio:' : 'Lighting:'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('studio');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                lightingPreset === 'studio'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Phòng Lab
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('cyber');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                lightingPreset === 'cyber'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Cyber Hologram
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('sun');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                lightingPreset === 'sun'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Nắng Tự Nhiên
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
