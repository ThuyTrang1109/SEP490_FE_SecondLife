import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  ShieldCheck,
  Eye,
  Sun,
  Palette,
  Compass,
  Download
} from 'lucide-react';
import { Listing } from '../../types';
import { soundFx } from '../../utils/soundEffects';

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
  { id: 'glass-black', name: 'Đen Tuyển Onyx', hex: 0x121212, roughness: 0.15, metalness: 0.9 },
  { id: 'stainless', name: 'Xám Titan Kim Loại', hex: 0x4a4a4a, roughness: 0.3, metalness: 0.95 },
  { id: 'silver', name: 'Bạc Metallic', hex: 0xa1a1aa, roughness: 0.25, metalness: 0.9 },
  { id: 'pure-white', name: 'Trắng Ceramic', hex: 0xf4f4f5, roughness: 0.2, metalness: 0.6 }
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

  // Define Hotspots for Home Appliance inspection
  const hotspots: Hotspot[] = [
    {
      id: 'compressor',
      titleVi: 'Máy Nén Compressor & Hệ Thống Gas',
      titleEn: 'Inverter Compressor & Refrigerant Gas',
      descVi: 'Máy nén Inverter vận hành siêu êm 38dB, nạp gas R600a/R32 nguyên bản, duy trì độ lạnh sâu -19.2°C chuẩn xác.',
      descEn: 'Ultra-quiet 38dB Inverter compressor, sealed R600a/R32 gas line maintaining stable -19.2°C freezing temperature.',
      position: [0.55, 1.15, -0.22],
      targetCamera: [1.2, 1.4, -2.2],
      status: 'passed'
    },
    {
      id: 'control_panel',
      titleVi: 'Bảng Điều Khiển Cảm Ứng & Bo Mạch AI',
      titleEn: 'Touch Control Panel & AI Board',
      descVi: 'Bo mạch chính nguyên tem niêm phong hãng. Màn hình điều khiển LED cảm ứng nhạy bén, cảm biến nhiệt lượng chuẩn 100%.',
      descEn: 'OEM sealed mainboard. Responsive touch LED display panel with 100% accurate thermal sensors.',
      position: [0, 0.4, 0.22],
      targetCamera: [0, 0.4, 3.2],
      status: 'passed'
    },
    {
      id: 'body_chassis',
      titleVi: 'Khung Vỏ Thép & Gioăng Cao Su',
      titleEn: 'Steel Body & Rubber Door Seal',
      descVi: 'Khung vỏ sơn tĩnh điện cao cấp. Gioăng cao su cánh cửa đàn hồi hít kín chống thất thoát nhiệt, ghi nhận vết xước dăm 0.2mm ở chân đế.',
      descEn: 'Powder-coated steel chassis. Magnetic door gasket perfectly sealed with micro 0.2mm scratch near foot stand.',
      position: [0.95, -0.6, 0],
      targetCamera: [2.5, -0.6, 0.5],
      status: 'minor'
    },
    {
      id: 'internal_components',
      titleVi: 'Lồng Giặt Inox / Khay Kính Lực',
      titleEn: 'Stainless Drum / Tempered Glass Shelves',
      descVi: 'Cơ cấu truyền động lồng giặt 3D / Khay kính chịu lực 100kg không nứt vỡ, sạch bong không bám cặn vôi.',
      descEn: 'Heavy-duty 3D washer drum / 100kg tempered glass shelves in pristine condition without limescale deposits.',
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
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const accentLight = new THREE.PointLight(0xffffff, 2, 20);
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
      emissive: 0x27272a,
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
    const batteryMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 });
    const batteryMesh = new THREE.Mesh(batteryGeo, batteryMat);
    batteryMesh.position.set(0.35, -0.3, 0);
    internalsGroup.add(batteryMesh);

    // Motherboard PCB
    const pcbGeo = new THREE.BoxGeometry(1.6, 1.3, 0.06);
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.position.set(0, 1.1, 0);
    internalsGroup.add(pcbMesh);

    // SoC Chip with Metallic Heat Shield
    const chipGeo = new THREE.BoxGeometry(0.5, 0.5, 0.04);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      metalness: 0.9,
      roughness: 0.2
    });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(-0.2, 1.1, 0.04);
    internalsGroup.add(chipMesh);

    // SecondLife Tamper-Evident NFC Seal inside chassis
    const sealGeo = new THREE.BoxGeometry(0.6, 0.3, 0.02);
    const sealMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd4d4d8,
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

    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

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
      accent.color.setHex(0xffffff);
      accent.intensity = 1.2;
    } else if (lightingPreset === 'cyber') {
      ambient.color.setHex(0x27272a);
      ambient.intensity = 1.8;
      main.color.setHex(0xffffff);
      main.intensity = 3.0;
      accent.color.setHex(0x71717a);
      accent.intensity = 2.5;
    } else {
      ambient.color.setHex(0xf4f4f5);
      ambient.intensity = 1.1;
      main.color.setHex(0xffffff);
      main.intensity = 3.5;
      accent.color.setHex(0xa1a1aa);
      accent.intensity = 0.8;
    }
  }, [lightingPreset]);

  const toggleExplodedView = () => {
    soundFx.playScanBeep();
    const newExploded = !explodedView;
    setExplodedView(newExploded);

    if (backCoverRef.current && internalsGroupRef.current) {
      if (newExploded) {
        internalsGroupRef.current.visible = true;
        backCoverRef.current.position.z = -1.2;
        setAutoRotate(false);
      } else {
        internalsGroupRef.current.visible = false;
        backCoverRef.current.position.z = -0.115;
      }
    }
  };

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

  const handleZoom = (delta: number) => {
    soundFx.playChime();
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.max(2.8, Math.min(8.0, cameraRef.current.position.z - delta));
      setZoomLevel(Math.round((5.2 / cameraRef.current.position.z) * 100) / 100);
    }
  };

  const handleHotspotClick = (spot: Hotspot) => {
    soundFx.playScanBeep();
    setActiveHotspot(spot);
    setAutoRotate(false);

    if (cameraRef.current && modelGroupRef.current) {
      const [tx, ty, tz] = spot.targetCamera;
      cameraRef.current.position.set(tx, ty, tz);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

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
    <div className="bg-[#0E121B] rounded-3xl overflow-hidden border border-white/10 text-white shadow-2xl flex flex-col h-full relative">
      {/* Top Controls Bar */}
      <div className="px-5 py-3.5 bg-[#0E121B] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-md">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                {listing?.title || (lang === 'vi' ? 'Mô Hình 3D Kiểm Định Thiết Bị' : '3D Hardware Inspection Model')}
              </h2>
              <span className="text-[10px] bg-white/10 text-white font-mono px-2 py-0.5 rounded-full border border-white/20">
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
          <button
            onClick={toggleExplodedView}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              explodedView
                ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-md'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {explodedView
                ? (lang === 'vi' ? 'Đóng Nắp Lưng' : 'Close Back Cover')
                : (lang === 'vi' ? 'Bóc Tách Linh Kiện (X-Ray)' : 'Exploded View (X-Ray)')}
            </span>
          </button>

          <button
            onClick={() => {
              soundFx.playChime();
              setAutoRotate(!autoRotate);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
              autoRotate
                ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white border-transparent'
                : 'bg-white/10 text-slate-400 border-white/20 hover:text-white'
            }`}
          >
            {autoRotate ? 'Tắt Xoay Tự Động' : 'Bật Xoay Tự Động'}
          </button>

          <button
            onClick={handleResetCamera}
            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/20 transition cursor-pointer"
            title="Khôi phục góc nhìn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold transition cursor-pointer shadow-md"
            title="Chụp ảnh 3D & Lưu"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>{snapshotTaken ? 'Đã Lưu!' : 'Chụp 3D'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold border border-white/20 cursor-pointer"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="relative flex-1 min-h-[440px] sm:min-h-[500px] w-full bg-[#0E121B] overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

        {/* Left Floating Hotspot Inspection Points */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 max-w-[240px]">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3 text-[#EC1577]" />
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
                    ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white border-transparent shadow-lg'
                    : 'bg-[#FFFFFF]/90 text-[#0E121B] border-slate-200 hover:bg-[#F4F5F8]'
                }`}
              >
                <div className="truncate">
                  <div className="font-bold truncate">{lang === 'vi' ? spot.titleVi : spot.titleEn}</div>
                  <div className={`text-[10px] ${isActive ? 'text-white/90' : 'text-slate-500'} truncate`}>
                    {spot.status === 'passed' ? '✓ Đạt 100%' : spot.status === 'verified' ? '★ Xác thực Hub' : '⚠ Vi xước nhẹ'}
                  </div>
                </div>
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    spot.status === 'passed'
                      ? 'bg-white'
                      : spot.status === 'verified'
                      ? 'bg-[#EC1577]'
                      : 'bg-slate-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Active Hotspot Detail Card Overlay */}
        {activeHotspot && (
          <div className="absolute right-4 top-4 z-10 max-w-sm bg-[#FFFFFF] backdrop-blur-xl border border-slate-200 rounded-2xl p-4 shadow-2xl space-y-2 animate-fadeIn text-[#0E121B]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white uppercase bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded shadow-sm">
                <ShieldCheck className="w-3 h-3" />
                <span>SecondLife Hub Verified</span>
              </span>
              <button
                onClick={() => setActiveHotspot(null)}
                className="text-slate-400 hover:text-[#0E121B] text-xs px-1"
              >
                ✕
              </button>
            </div>

            <h3 className="font-bold text-[#0E121B] text-sm">
              {lang === 'vi' ? activeHotspot.titleVi : activeHotspot.titleEn}
            </h3>

            <p className="text-xs text-[#0E121B]/80 leading-relaxed">
              {lang === 'vi' ? activeHotspot.descVi : activeHotspot.descEn}
            </p>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Độ phân giải siêu âm: 0.05mm</span>
              <span className="text-[#EC1577] font-bold">KẾT QUẢ: ĐẠT CHUẨN</span>
            </div>
          </div>
        )}

        {/* Exploded Mode HUD Indicator */}
        {explodedView && (
          <div className="absolute top-4 inset-x-0 mx-auto w-fit z-10 bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
            <Layers className="w-3.5 h-3.5 text-white" />
            <span>{lang === 'vi' ? 'ĐANG BÓC TÁCH LINH KIỆN & PIN (X-RAY)' : 'EXPLODED HARDWARE VIEW ACTIVE'}</span>
          </div>
        )}

        {/* Floating Zoom Controls */}
        <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1.5 bg-[#0E121B]/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => handleZoom(0.5)}
            className="p-2 rounded-xl text-white hover:bg-white/10 transition"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.5)}
            className="p-2 rounded-xl text-white hover:bg-white/10 transition"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-mono text-center text-slate-400 pt-1 border-t border-white/10">
            {zoomLevel}x
          </div>
        </div>
      </div>

      {/* Bottom Colorway & Lighting Customizer Toolbar */}
      <div className="px-5 py-3 bg-[#0E121B] border-t border-white/10 flex flex-wrap items-center justify-between gap-4 z-10 text-xs">
        {/* Color Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-slate-400 font-semibold">
            <Palette className="w-3.5 h-3.5 text-[#EC1577]" />
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
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
                  selectedColor.id === c.id
                    ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] border-transparent text-white font-bold'
                    : 'bg-white/10 border-white/20 text-slate-400 hover:text-white'
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
            <Sun className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>{lang === 'vi' ? 'Ánh Sáng Studio:' : 'Lighting:'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('studio');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                lightingPreset === 'studio'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-sm'
                  : 'bg-white/10 text-slate-400 hover:text-white border border-white/20'
              }`}
            >
              Phòng Lab
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('cyber');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                lightingPreset === 'cyber'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-sm'
                  : 'bg-white/10 text-slate-400 hover:text-white border border-white/20'
              }`}
            >
              Monochrome Glow
            </button>
            <button
              onClick={() => {
                soundFx.playChime();
                setLightingPreset('sun');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                lightingPreset === 'sun'
                  ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold shadow-sm'
                  : 'bg-white/10 text-slate-400 hover:text-white border border-white/20'
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
