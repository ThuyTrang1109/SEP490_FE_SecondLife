import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Play, Video, Maximize2, X } from 'lucide-react';
import { userReportService } from '../../services/userReportService';

export interface DisputeEvidenceThumbnailProps {
  url: string;
  idx: number;
  labelPrefix?: string;
  size?: 'sm' | 'md' | 'lg';
  onOpen: (view: { kind: 'IMAGE' | 'VIDEO'; src: string; dispose?: () => void }) => void;
  onRemove?: () => void;
}

export const DisputeEvidenceThumbnail: React.FC<DisputeEvidenceThumbnailProps> = ({
  url,
  idx,
  labelPrefix = 'Bằng chứng',
  size = 'md',
  onOpen,
  onRemove,
}) => {
  const [mediaView, setMediaView] = useState<{
    kind: 'IMAGE' | 'VIDEO';
    src: string;
    dispose?: () => void;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let localDispose: (() => void) | null = null;

    setLoading(true);
    setError(false);

    const isDirectUrl =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:');
    const isVideoExt = /\.(mp4|webm|mov|mkv|avi|m4v)(\?.*)?$/i.test(url);

    if (isDirectUrl) {
      if (isMounted) {
        setMediaView({
          kind: isVideoExt ? 'VIDEO' : 'IMAGE',
          src: url,
        });
        setLoading(false);
      }
      return;
    }

    // Tải bằng chứng riêng tư từ server (hỗ trợ cả ảnh và video playback)
    userReportService
      .loadPrivateEvidenceView(url)
      .then((view) => {
        if (isMounted) {
          localDispose = view.dispose;
          setMediaView(view);
        } else {
          view.dispose();
        }
      })
      .catch((err) => {
        console.warn('loadPrivateEvidenceView error, thử tải qua getEvidenceBlobUrl:', err);
        userReportService
          .getEvidenceBlobUrl(url)
          .then((bUrl) => {
            if (isMounted) {
              localDispose = () => URL.revokeObjectURL(bUrl);
              setMediaView({
                kind: isVideoExt ? 'VIDEO' : 'IMAGE',
                src: bUrl,
                dispose: localDispose,
              });
            } else {
              URL.revokeObjectURL(bUrl);
            }
          })
          .catch((finalErr) => {
            console.error('Không thể tải tệp bằng chứng:', url, finalErr);
            if (isMounted) setError(true);
          });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (localDispose) localDispose();
    };
  }, [url]);

  const handleClick = () => {
    if (mediaView) {
      onOpen({ kind: mediaView.kind, src: mediaView.src, dispose: () => { } });
    } else {
      onOpen({ kind: 'IMAGE', src: url, dispose: () => { } });
    }
  };

  const sizeClasses =
    size === 'sm'
      ? 'w-16 h-16 rounded-xl'
      : size === 'lg'
        ? 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl'
        : 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative ${sizeClasses} overflow-hidden border border-slate-200/90 bg-slate-100 group shadow-2xs hover:shadow-md cursor-pointer transition-all hover:scale-[1.03] text-left shrink-0 focus:outline-none focus:ring-2 focus:ring-[#c34c36]`}
      title={`Bấm để xem phóng to ${mediaView?.kind === 'VIDEO' ? 'video' : 'ảnh'} ${labelPrefix} #${idx + 1}`}
    >
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
          <Loader2 className="w-4 h-4 animate-spin text-[#c34c36]" />
          <span className="text-[9px] mt-1 text-slate-400 font-medium">Đang tải...</span>
        </div>
      ) : error ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-rose-500 bg-rose-50/60 p-1 text-center">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span className="text-[9px] font-bold text-rose-700 mt-0.5 line-clamp-1">#{idx + 1}</span>
        </div>
      ) : mediaView?.kind === 'VIDEO' ? (
        <div className="relative w-full h-full bg-slate-900">
          <video
            src={mediaView.src}
            preload="metadata"
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
          />
          {/* Nút Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
            <div className="w-7 h-7 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-rose-600" />
            </div>
          </div>
          {/* Badge góc video */}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white flex items-center gap-0.5 leading-none shadow-xs">
            <Video className="w-2.5 h-2.5" />
            <span>Video</span>
          </span>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <img
            src={mediaView?.src}
            alt={`${labelPrefix} ${idx + 1}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
          {/* Overlay phóng to khi hover */}
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <Maximize2 className="w-4 h-4 drop-shadow" />
          </div>
          {/* Badge số thứ tự */}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white backdrop-blur-xs leading-none">
            #{idx + 1}
          </span>
        </div>
      )}

      {/* Nút xóa tệp (nếu cho phép) */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
          title="Gỡ tệp này"
        >
          <X className="w-3 h-3 stroke-[2.5]" />
        </button>
      )}
    </button>
  );
};
