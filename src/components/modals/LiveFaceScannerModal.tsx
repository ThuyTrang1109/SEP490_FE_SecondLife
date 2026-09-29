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
  Eye
} from 'lucide-react';
import { mediaService } from '../../services/mediaService';
import { Language } from '../../types';

export interface LiveFaceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFaceCaptured: (imageUrl: string, file?: File, previewUrl?: string) => void;
  lang?: Language;
}

export const LiveFaceScannerModal: React.FC<LiveFaceScannerModalProps> = ({
  isOpen,
  onClose,
  onFaceCaptured,
  lang = 'vi',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Stop camera media tracks cleanly
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

  // Start camera media stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedBlob(null);
    setCapturedPreview(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'vi'
          ? 'Trình duyệt của bạn không hỗ trợ truy cập Camera (WebRTC). Vui lòng sử dụng Chrome, Safari hoặc Edge phiên bản mới.'
          : 'Your browser does not support WebRTC Camera. Please use modern Chrome, Safari, or Edge.'
      );
      return;
    }

    try {
      // Dừng camera cũ nếu đang chạy
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
        await videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = lang === 'vi'
        ? 'Không thể truy cập Camera. Vui lòng cho phép quyền sử dụng camera trong cài đặt trình duyệt.'
        : 'Unable to access camera. Please allow camera permission in your browser settings.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = lang === 'vi'
          ? 'Quyền truy cập Camera đã bị từ chối. Vui lòng bấm vào biểu tượng ổ khóa 🔒 trên thanh địa chỉ để cấp quyền.'
          : 'Camera permission denied. Please grant permission in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = lang === 'vi'
          ? 'Không tìm thấy thiết bị Camera / Webcam nào trên máy của bạn.'
          : 'No camera or webcam device found on your system.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, [lang, stopCamera]);

  // Khi modal mở: tự động kích hoạt camera; khi đóng: tắt camera
  useEffect(() => {
    if (isOpen) {
      startCamera();
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
  }, [isOpen, startCamera, stopCamera]);

  // Chụp frame từ Video stream lên Canvas
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

    // Flash effect giống camera chụp
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Lật ảnh theo trục ngang (Mirror) để ảnh đúng chiều như mắt nhìn gương
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
        // Tạm dừng video để hiện ảnh chụp
        stopCamera();
      },
      'image/jpeg',
      0.95
    );
  };

  // Người dùng chọn chụp lại
  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  // Xác nhận ảnh chụp và tải lên Cloudinary
  const handleConfirmAndUpload = async () => {
    if (!capturedBlob) return;

    setIsUploading(true);
    try {
      const selfieFile = new File([capturedBlob], `selfie_ekyc_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      const res = await mediaService.uploadImage(selfieFile, 'seller-verifications');
      onFaceCaptured(res.url, selfieFile, capturedPreview || res.url);
      onClose();
    } catch (err: any) {
      console.error('Upload selfie error:', err);
      setCameraError(err.message || 'Tải ảnh khuôn mặt thất bại. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1c1e30] rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white text-center space-y-4 shadow-2xl relative border border-slate-700/80 overflow-hidden">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          title={lang === 'vi' ? 'Đóng cửa sổ' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Hướng dẫn */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c34c36]/20 border border-[#c34c36]/40 text-[#fce5da] text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#fce5da]" />
            <span>{lang === 'vi' ? 'Công nghệ Quét Khuôn Mặt eKYC' : 'eKYC Face Match Verification'}</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            {capturedPreview
              ? (lang === 'vi' ? 'Xem Lại Ảnh Khuôn Mặt Đã Chụp' : 'Review Captured Face Photo')
              : (lang === 'vi' ? 'Chụp Ảnh Chân Dung Trực Tiếp' : 'Live Face Scan')}
          </h3>
          <p className="text-xs text-slate-300 max-w-sm mx-auto">
            {capturedPreview
              ? (lang === 'vi' ? 'Kiểm tra ảnh rõ nét, nhìn thẳng và không bị lóa sáng trước khi xác nhận.' : 'Make sure your face is sharp and well-lit.')
              : (lang === 'vi' ? 'Căn chỉnh khuôn mặt nằm trọn trong khung tròn và nhìn thẳng vào Camera.' : 'Align your face inside the circle frame.')}
          </p>
        </div>

        {/* Thông báo lỗi nếu có */}
        {cameraError && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-medium block">{cameraError}</span>
              <button
                type="button"
                onClick={startCamera}
                className="text-[11px] font-bold text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{lang === 'vi' ? 'Thử mở lại Camera' : 'Retry Camera'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Khung Tròn / Oval Quét Khuôn Mặt (Bank-grade Face Frame) */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-full overflow-hidden border-4 border-[#c34c36] shadow-2xl bg-slate-950 flex items-center justify-center">
          {/* Flash Effect */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200" />
          )}

          {/* Vòng định vị Radar Scanner */}
          {!capturedPreview && isCameraActive && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Vạch ngắm canh tâm 4 góc */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-400/80 rounded-full" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-400/80 rounded-full" />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-400/80 rounded-full" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-400/80 rounded-full" />
              {/* Hiệu ứng quét liveness chuyển động */}
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#fce5da] to-transparent absolute top-0 animate-bounce duration-1000 opacity-60" />
            </div>
          )}

          {/* Video Feed trực tiếp (Mirror) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transform -scale-x-100 ${capturedPreview ? 'hidden' : 'block'}`}
            playsInline
            autoPlay
            muted
          />

          {/* Canvas ẩn để chụp frame */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Ảnh tĩnh sau khi đã chụp (Preview) */}
          {capturedPreview && (
            <img
              src={capturedPreview}
              alt="Captured Selfie"
              className="w-full h-full object-cover"
            />
          )}

          {/* Trạng thái chưa bật được Camera */}
          {!isCameraActive && !capturedPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-4 text-xs space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-slate-300 font-medium">
                {lang === 'vi' ? 'Đang chuẩn bị Camera...' : 'Initializing Camera...'}
              </span>
            </div>
          )}
        </div>

        {/* Hướng dẫn tiêu chuẩn chụp ảnh */}
        {!capturedPreview && (
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-300 pt-1 max-w-sm mx-auto">
            <div className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-1">
              <span>💡 Đủ ánh sáng</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-1">
              <span>👓 Không kính râm</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-1">
              <span>👤 Nhìn thẳng</span>
            </div>
          </div>
        )}

        {/* Nút điều khiển tương tác */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {capturedPreview ? (
            <>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleRetake}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Chụp Lại' : 'Retake'}</span>
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={handleConfirmAndUpload}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'vi' ? 'Đang tải lên Cloud...' : 'Uploading...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Xác Nhận & Sử Dụng Ảnh Này' : 'Confirm & Use Photo'}</span>
                  </>
                )}
              </button>
            </>
          ) : isCameraActive ? (
            <button
              type="button"
              onClick={handleSnap}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-slate-900 font-extrabold text-sm shadow-xl hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2 group"
            >
              <Camera className="w-5 h-5 group-hover:scale-110 transition-transform text-slate-900" />
              <span>{lang === 'vi' ? 'Bấm Chụp Khuôn Mặt' : 'Capture Face Photo'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Mở Lại Camera' : 'Turn On Camera'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
