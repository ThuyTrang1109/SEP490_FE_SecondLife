import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  Flashlight,
  FlashlightOff,
  Upload,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Scan,
  Zap,
  Sparkles,
  Info
} from 'lucide-react';
import { EscrowOrder, Language } from '../../types';
import { dialogService } from '../../utils/dialogService';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  orders?: EscrowOrder[];
  lang?: Language;
}

// Hàm phát tiếng beep ngắn khi quét thành công bằng Web Audio API
export const playScanBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime); // 1400Hz tiếng bíp thanh chuẩn POS scanner
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (_) {}
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  orders = [],
  lang = 'vi',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState<boolean>(false);

  // Dừng camera và giải phóng tài nguyên
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
  }, []);

  // Khởi động Camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    setCameraError(null);
    setScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'vi'
          ? 'Trình duyệt của bạn không hỗ trợ truy cập máy ảnh (WebRTC).'
          : 'Camera access is not supported on this browser.'
      );
      setHasCameraPermission(false);
      return;
    }

    try {
      stopCamera();

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' }, // Ưu tiên camera sau trên điện thoại/máy tính bảng
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setHasCameraPermission(true);
      setIsScanning(true);

      // Kiểm tra hỗ trợ Flashlight / Torch
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorchSupport(true);
        }
      }

      // Liệt kê danh sách các camera có sẵn
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoDevs);
      if (track && track.getSettings) {
        setCurrentDeviceId(track.getSettings().deviceId || '');
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      let msg =
        lang === 'vi'
          ? 'Không thể mở Camera. Vui lòng cấp quyền truy cập Camera trên trình duyệt.'
          : 'Could not access camera. Please allow camera permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg =
          lang === 'vi'
            ? 'Quyền truy cập Camera bị từ chối. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ để cấp quyền.'
            : 'Camera permission denied. Please grant permission in browser settings.';
      }
      setCameraError(msg);
      setHasCameraPermission(false);
    }
  }, [lang, stopCamera]);

  // Bật/tắt Flash / Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  // Đổi Camera (trước / sau)
  const switchCamera = () => {
    if (availableDevices.length <= 1) return;
    const currentIndex = availableDevices.findIndex((d) => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    const nextDev = availableDevices[nextIndex];
    if (nextDev) {
      startCamera(nextDev.deviceId);
    }
  };

  // Xử lý khi quét trúng mã vạch
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      if (!code || scannedResult) return;
      const cleanCode = code.trim();
      if (!cleanCode) return;

      setScannedResult(cleanCode);
      playScanBeep();

      if (navigator.vibrate) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch (_) {}
      }

      // Giữ hiệu ứng thành công khoảng 400ms rồi đóng modal và trả về kết quả
      setTimeout(() => {
        stopCamera();
        onScanSuccess(cleanCode);
        onClose();
      }, 400);
    },
    [scannedResult, stopCamera, onScanSuccess, onClose]
  );

  // Vòng lặp nhận diện BarcodeDetector theo thời gian thực (nếu trình duyệt hỗ trợ)
  useEffect(() => {
    if (!isOpen || !isScanning) return;

    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      setIsBarcodeDetectorSupported(false);
      return;
    }
    setIsBarcodeDetectorSupported(true);

    let isMounted = true;
    let detector: any = null;

    try {
      detector = new BarcodeDetectorClass({
        formats: [
          'qr_code',
          'code_128',
          'code_39',
          'code_93',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'data_matrix',
        ],
      });
    } catch (_) {
      try {
        detector = new BarcodeDetectorClass();
      } catch (e) {
        console.warn('BarcodeDetector initialization error:', e);
      }
    }

    if (!detector) return;

    const intervalId = setInterval(async () => {
      if (!isMounted || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleBarcodeDetected(barcodes[0].rawValue);
        }
      } catch (_) {
        // Bỏ qua lỗi từng frame nếu frame bị mờ hoặc đang xoay
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isOpen, isScanning, handleBarcodeDetected]);

  // Quét từ tệp ảnh người dùng tải lên
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));

      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (BarcodeDetectorClass) {
        const detector = new BarcodeDetectorClass();
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleBarcodeDetected(barcodes[0].rawValue);
          return;
        }
      }

      // Nếu không tự động quét được từ file ảnh
      dialogService.warning(
        lang === 'vi'
          ? 'Không tìm thấy mã vạch rõ nét trong ảnh tải lên. Vui lòng thử ảnh khác hoặc nhập mã trực tiếp.'
          : 'Could not detect a clear barcode in this image. Please try another image.',
        lang === 'vi' ? 'Không Nhận Diện Được Mã' : 'Scan Notice'
      );
    } catch (err: any) {
      console.warn('File barcode scan error:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Mở camera khi modal bật
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#1e2238] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#24263e] to-[#2d2a45] flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#c34c36] text-white flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{lang === 'vi' ? 'Máy Quét Barcode & QR Code' : 'Barcode & QR Scanner'}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  Live Scanner
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                {lang === 'vi'
                  ? 'Hướng camera về mã vạch đơn hàng hoặc kiện hàng để nhận máy'
                  : 'Point camera at the order barcode to intake device'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="relative bg-black w-full aspect-4/3 max-h-[360px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-xs text-rose-200 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83d2a] text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Thử Lại Camera' : 'Retry Camera'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Mask */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-black/40" />

                {/* Central Targeting Box */}
                <div
                  className={`relative w-64 h-44 rounded-2xl border-2 transition-all duration-300 ${
                    scannedResult
                      ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.6)]'
                      : 'border-[#c34c36]/90 shadow-[0_0_20px_rgba(195,76,54,0.3)]'
                  }`}
                >
                  {/* Corner Target Accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-lg" />

                  {/* Animated Laser Scanning Line */}
                  {!scannedResult && (
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#ff6547] to-transparent shadow-[0_0_12px_#ff6547] animate-[scannerLaser_2s_ease-in-out_infinite]" />
                  )}

                  {/* Success Banner when detected */}
                  {scannedResult && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded-2xl p-2 text-center animate-in zoom-in-95">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                      <span className="text-[11px] font-bold text-emerald-300">
                        {lang === 'vi' ? 'ĐÃ QUÉT THÀNH CÔNG!' : 'BARCODE DETECTED!'}
                      </span>
                      <span className="text-xs font-mono font-black text-white mt-0.5 truncate max-w-full px-2">
                        {scannedResult}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Camera Controls Toolbar */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {hasTorchSupport && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md transition cursor-pointer ${
                      torchEnabled
                        ? 'bg-amber-400 text-slate-900 shadow-md'
                        : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                    title={torchEnabled ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                  >
                    {torchEnabled ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  </button>
                )}

                {availableDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition cursor-pointer"
                    title="Đổi camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Scanning status banner */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
                <span className="text-[11px] font-semibold bg-black/60 backdrop-blur-md text-white/90 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                  <Scan className="w-3.5 h-3.5 text-[#ff6547] animate-pulse" />
                  <span>
                    {isBarcodeDetectorSupported
                      ? lang === 'vi'
                        ? 'Đang tự động nhận diện mã vạch...'
                        : 'Auto-detecting barcode...'
                      : lang === 'vi'
                      ? 'Hướng camera hoặc bấm mã đơn mẫu bên dưới'
                      : 'Align barcode or pick sample below'}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bottom Options & Quick Simulators */}
        <div className="p-4 sm:p-5 bg-[#1e2238] space-y-4">
          {/* Action Row: Upload file or Manual input */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center gap-1.5 transition cursor-pointer shrink-0"
              title="Tải ảnh mã vạch lên"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'vi' ? 'Tải ảnh mã vạch' : 'Upload photo'}</span>
            </button>

            {/* Quick manual input */}
            <div className="flex-1 flex gap-1.5">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualInput.trim()) {
                    handleBarcodeDetected(manualInput.trim());
                  }
                }}
                placeholder={lang === 'vi' ? 'Nhập mã đơn / vận đơn...' : 'Enter order/tracking #...'}
                className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono placeholder:text-slate-400 outline-none focus:border-[#c34c36]"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualInput.trim()) {
                    handleBarcodeDetected(manualInput.trim());
                  }
                }}
                disabled={!manualInput.trim()}
                className="px-3 py-2 bg-[#c34c36] hover:bg-[#a83d2a] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {lang === 'vi' ? 'Nạp' : 'Go'}
              </button>
            </div>
          </div>

          {/* Quick Sample Barcode Pills from Active Order Queue */}
          {orders.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-bold flex items-center gap-1 text-amber-300">
                  <Zap className="w-3.5 h-3.5" />
                  {lang === 'vi' ? 'Bấm nhanh mã đơn mẫu để quét thử:' : 'Quick sample barcodes:'}
                </span>
                <span className="text-[10px] text-slate-400">{orders.length} đơn chờ</span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {orders.map((o) => {
                  const tracking = o.shippingLegs?.[0]?.trackingNumber;
                  const displayCode = tracking || o.id;
                  const itemTitle = o.listing?.title || 'Thiết bị';

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleBarcodeDetected(displayCode)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#c34c36] hover:text-white border border-white/10 text-[11px] font-mono text-slate-200 transition flex items-center gap-1.5 cursor-pointer group"
                      title={`Bấm để nạp đơn: ${itemTitle}`}
                    >
                      <QrCode className="w-3 h-3 text-amber-400 group-hover:text-white" />
                      <span className="font-bold">{displayCode.slice(0, 14)}</span>
                      <span className="text-[10px] text-slate-400 group-hover:text-white/80 max-w-[120px] truncate font-sans">
                        • {itemTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scannerLaser {
          0% { top: 8%; opacity: 0.9; }
          50% { top: 92%; opacity: 1; }
          100% { top: 8%; opacity: 0.9; }
        }
      `}</style>
    </div>
  );
};
