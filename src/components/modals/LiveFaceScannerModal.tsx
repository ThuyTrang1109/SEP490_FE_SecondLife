import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
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
  // VNPT SDK State
  const [isProcessingVnpt, setIsProcessingVnpt] = useState(false);
  const [vnptError, setVnptError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());

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

        if (!base64) {
          console.warn('VNPT result did not include face image:', result);
          setVnptError(
            lang === 'vi'
              ? 'Chưa nhận diện được ảnh khuôn mặt. Vui lòng căn chỉnh lại khuôn mặt vừa khớp khung hình oval.'
              : 'Face image not detected. Please align your face inside the oval frame.'
          );
          setIsProcessingVnpt(false);
          return;
        }

        let faceFile: File | undefined;
        try {
          const resBlob = await fetch(base64).then((r) => r.blob());
          faceFile = new File([resBlob], `vnpt_face_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
        } catch (e) {
          console.warn('Could not create File from base64:', e);
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

        // Chỉ truyền base64 vào previewUrl để modal cha thực hiện upload faceFile lấy URL thật
        onFaceCaptured('', faceFile, base64, vnptData);
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
  }, [isOpen, onFaceCaptured, onClose, lang]);

  // Quản lý đóng/mở modal
  useEffect(() => {
    if (isOpen) {
      setIframeKey(Date.now());
      setVnptError(null);
      setIsProcessingVnpt(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#131625] rounded-3xl max-w-2xl w-full px-5 py-6 sm:px-7 sm:py-7 text-white text-center space-y-4 shadow-2xl relative border border-slate-700/80 overflow-hidden flex flex-col max-h-[96vh]"
      >
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
            {lang === 'vi' ? 'Quét khuôn mặt xác thực định danh người bán' : 'VNPT eKYC Face Verification'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {lang === 'vi'
              ? 'Hệ thống sử dụng SDK nhận diện khuôn mặt 3D của VNPT để kiểm tra người thật và chống giả mạo.'
              : 'Powered by VNPT AI Face Liveness SDK for automated anti-spoofing and identity verification.'}
          </p>
        </div>

        {/* Thông báo lỗi nếu có */}
        {vnptError && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{vnptError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setVnptError(null);
                setIframeKey(Date.now());
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Khung quét VNPT SDK */}
        <div className="flex-1 min-h-[440px] sm:min-h-[500px] relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
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
        </div>

        {/* Gợi ý góc dưới */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 pt-0.5">
          <span>Hãy nhìn thẳng vào camera</span>
          <span>•</span>
          <span>Không đeo kính râm / khẩu trang</span>
          <span>•</span>
          <span>Đảm bảo khuôn mặt vừa khớp khung hình oval</span>
        </div>
      </div>
    </div>
  );
};
