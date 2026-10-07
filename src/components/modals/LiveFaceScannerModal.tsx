import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Eye,
  ScanFace,
  Layers
} from 'lucide-react';
import { mediaService } from '../../services/mediaService';
import { Language } from '../../types';

export interface VnptEkycResultData {
  clientSession?: string;
  token?: string;
  livenessFace?: any;
  masked?: any;
  compare?: any;
  hashImg?: string;
  raw?: any;
}

export interface LiveFaceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFaceCaptured: (
    imageUrl: string,
    file?: File,
    previewUrl?: string,
    vnptData?: VnptEkycResultData
  ) => void;
  lang?: Language;
}

export const LiveFaceScannerModal: React.FC<LiveFaceScannerModalProps> = ({
  isOpen,
  onClose,
  onFaceCaptured,
  lang = 'vi',
}) => {
  // Mode: 'vnpt' (chính thức qua VNPT Web SDK) hoặc 'camera' (WebRTC dự phòng)
  const [scanMode, setScanMode] = useState<'vnpt' | 'camera'>('vnpt');

  // VNPT SDK State
  const [isProcessingVnpt, setIsProcessingVnpt] = useState(false);
  const [vnptError, setVnptError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());

  // WebRTC Fallback Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Dừng WebRTC stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Khởi động WebRTC stream dự phòng
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedBlob(null);
    setCapturedPreview(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'vi'
          ? 'Trình duyệt không hỗ trợ WebRTC Camera.'
          : 'WebRTC Camera not supported.'
      );
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = lang === 'vi'
        ? 'Không thể truy cập Camera. Vui lòng cấp quyền trong trình duyệt.'
        : 'Camera permission denied.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = lang === 'vi'
          ? 'Quyền truy cập Camera bị từ chối. Hãy bấm biểu tượng 🔒 trên thanh địa chỉ để cấp quyền.'
          : 'Camera permission denied.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, [lang, stopCamera]);

  // Lắng nghe sự kiện hoàn thành từ VNPT eKYC SDK iframe
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'VNPT_EKYC_RESULT') return;

      const result = event.data.data;
      console.log('[Parent Modal] Received VNPT eKYC Result:', result);

      setIsProcessingVnpt(true);
      setVnptError(null);

      try {
        let base64 =
          result.base64_face_img?.img_face_near ||
          result.base64_face_img?.img_face_far ||
          result.base64_doc_img?.img_front ||
          '';

        if (base64 && !base64.startsWith('data:')) {
          base64 = `data:image/jpeg;base64,${base64}`;
        }

        let faceFile: File | undefined;
        let finalImageUrl = base64;
        const previewUrl = base64;

        if (base64) {
          try {
            const resBlob = await fetch(base64).then((r) => r.blob());
            faceFile = new File([resBlob], `vnpt_face_${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });

            // Tải ảnh lên CDN / Cloudinary để BE nhận URL vĩnh viễn
            const uploadRes = await mediaService.uploadImage(faceFile, 'seller-verifications');
            if (uploadRes?.url) {
              finalImageUrl = uploadRes.url;
            }
          } catch (uploadErr) {
            console.warn('Lỗi tải ảnh VNPT lên CDN, sử dụng data URL:', uploadErr);
          }
        }

        const clientSession =
          result.client_session ||
          result.clientSession ||
          `vnpt-session-${Date.now()}`;
        const token =
          result.token ||
          result.hash_img ||
          result.hashImg ||
          `vnpt-token-${Date.now()}`;

        const vnptData: VnptEkycResultData = {
          clientSession,
          token,
          livenessFace: result.liveness_face,
          masked: result.masked,
          compare: result.compare,
          hashImg: result.hash_img,
          raw: result,
        };

        // Gửi kết quả về modal cha
        onFaceCaptured(finalImageUrl, faceFile, previewUrl, vnptData);
        onClose();
      } catch (err: any) {
        console.error('Lỗi xử lý kết quả VNPT SDK:', err);
        setVnptError(err.message || 'Xử lý kết quả quét mặt thất bại. Vui lòng thử lại.');
      } finally {
        setIsProcessingVnpt(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onFaceCaptured, onClose]);

  // Quản lý đóng/mở modal
  useEffect(() => {
    if (isOpen) {
      setIframeKey(Date.now());
      setVnptError(null);
      setIsProcessingVnpt(false);
      if (scanMode === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
      setCapturedBlob(null);
      setCapturedPreview(null);
      setCameraError(null);
      setIsUploading(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, scanMode, startCamera, stopCamera]);

  // WebRTC: Chụp ảnh
  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview(previewUrl);
        stopCamera();
      },
      'image/jpeg',
      0.95
    );
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  const handleConfirmAndUploadFallback = async () => {
    if (!capturedBlob) return;
    setIsUploading(true);
    try {
      const selfieFile = new File([capturedBlob], `selfie_ekyc_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      const res = await mediaService.uploadImage(selfieFile, 'seller-verifications');
      const fallbackVnptData: VnptEkycResultData = {
        clientSession: `webrtc-session-${Date.now()}`,
        token: `webrtc-token-${Date.now()}`,
      };
      onFaceCaptured(res.url, selfieFile, capturedPreview || res.url, fallbackVnptData);
      onClose();
    } catch (err: any) {
      console.error('Upload selfie error:', err);
      setCameraError(err.message || 'Tải ảnh khuôn mặt thất bại.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#131625] rounded-3xl max-w-2xl w-full px-5 py-6 sm:px-7 sm:py-7 text-white text-center space-y-4 shadow-2xl relative border border-slate-700/80 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer z-30"
          title="Đóng modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pt-1 sm:pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>VNPT AI eKYC Face Liveness v3.2.1</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            {lang === 'vi' ? 'Quét Khuôn Mặt Xác Thực Định Danh Người Bán' : 'VNPT eKYC Face Verification'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {lang === 'vi'
              ? 'Hệ thống sử dụng SDK nhận diện khuôn mặt 3D của VNPT để kiểm tra người thật và chống giả mạo.'
              : 'Powered by VNPT AI Face Liveness SDK for automated anti-spoofing and identity verification.'}
          </p>
        </div>

        {/* Chuyển đổi chế độ quét (VNPT SDK chính thức vs WebRTC Camera) */}
        <div className="flex items-center justify-center gap-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-800 max-w-sm mx-auto w-full">
          <button
            type="button"
            onClick={() => {
              setScanMode('vnpt');
              stopCamera();
              setIframeKey(Date.now());
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${scanMode === 'vnpt'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <ScanFace className="w-3.5 h-3.5" />
            <span>VNPT SDK (Khuyên dùng)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('camera');
              startCamera();
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${scanMode === 'camera'
                ? 'bg-[#c34c36] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera WebRTC</span>
          </button>
        </div>

        {/* Thông báo lỗi nếu có */}
        {(vnptError || cameraError) && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{vnptError || cameraError}</span>
            </div>
            {scanMode === 'vnpt' && (
              <button
                type="button"
                onClick={() => setIframeKey(Date.now())}
                className="text-[11px] underline font-bold hover:text-white shrink-0 cursor-pointer"
              >
                Tải lại SDK
              </button>
            )}
          </div>
        )}

        {/* Khung quét VNPT SDK hoặc Camera WebRTC */}
        <div className="flex-1 min-h-[440px] sm:min-h-[500px] relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
          {scanMode === 'vnpt' ? (
            <div className="w-full h-full relative flex flex-col">
              {/* Iframe nhúng VNPT Web SDK */}
              <iframe
                key={iframeKey}
                src={`/vnpt-ekyc/face-scan.html?flow=FACE&t=${iframeKey}`}
                title="VNPT eKYC Face Scan"
                allow="camera *; microphone *; display-capture *"
                className="w-full h-[490px] sm:h-[540px] border-0 rounded-2xl bg-[#0b0f19]"
              />

              {/* Loading overlay khi xử lý kết quả từ SDK */}
              {isProcessingVnpt && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 p-6">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <span className="text-sm font-bold text-white">
                    Đang đối soát & lưu kết quả khuôn mặt từ VNPT eKYC...
                  </span>
                  <span className="text-xs text-slate-400">
                    Vui lòng đợi trong giây lát để hệ thống cập nhật phiên xác thực.
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* WebRTC Camera Fallback View */
            <div className="w-full h-full relative flex items-center justify-center p-4">
              {/* Flash effect */}
              {isFlashing && (
                <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-200 pointer-events-none" />
              )}

              {/* Live Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[440px] object-cover rounded-2xl transform -scale-x-100 ${capturedPreview || !isCameraActive ? 'hidden' : 'block'
                  }`}
              />

              {/* Captured Photo Preview */}
              {capturedPreview && (
                <img
                  src={capturedPreview}
                  alt="Captured face preview"
                  className="w-full max-h-[440px] object-contain rounded-2xl"
                />
              )}

              {/* Face Guide Oval Overlay */}
              {isCameraActive && !capturedPreview && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-52 h-68 sm:w-60 sm:h-76 border-2 border-dashed border-emerald-400/80 rounded-[50%] shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse" />
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {/* Footer điều khiển (cho WebRTC mode) */}
        {scanMode === 'camera' && (
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {capturedPreview ? (
              <>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleRetake}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Chụp Lại' : 'Retake'}</span>
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleConfirmAndUploadFallback}
                  className="w-full sm:w-auto px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'vi' ? 'Đang lưu ảnh...' : 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Xác Nhận & Sử Dụng Ảnh Này' : 'Confirm Photo'}</span>
                    </>
                  )}
                </button>
              </>
            ) : isCameraActive ? (
              <button
                type="button"
                onClick={handleSnap}
                className="w-full sm:w-auto px-8 py-2.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-slate-900 font-extrabold text-sm shadow-xl hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Bấm Chụp Khuôn Mặt' : 'Capture Face'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="w-full sm:w-auto px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Bật Camera' : 'Turn On Camera'}</span>
              </button>
            )}
          </div>
        )}

        {/* Gợi ý góc dưới */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 pt-0.5">
          <span>💡 Hãy nhìn thẳng vào camera</span>
          <span>•</span>
          <span>Không đeo kính râm / khẩu trang</span>
          <span>•</span>
          <span>Đảm bảo đủ ánh sáng</span>
        </div>
      </div>
    </div>
  );
};
