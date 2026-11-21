import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ScannableQRCodeProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
  allowRemoteFallback?: boolean;
}

export const ScannableQRCode: React.FC<ScannableQRCodeProps> = ({
  value,
  size = 160,
  className = '',
  title = 'Quét mã QR để xác thực',
  allowRemoteFallback = true,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    setRenderFailed(false);
    setDataUrl('');
    if (!value) {
      return;
    }

    let isSubscribed = true;
    QRCode.toDataURL(value, {
      width: size * 2, // Hi-DPI scale for sharp printing
      margin: 1,
      color: {
        dark: '#0f172a', // Deep slate for high contrast
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isSubscribed) setDataUrl(url);
      })
      .catch((err) => {
        console.warn('Error generating QR Code:', err);
        // Fallback to QR server if local rendering fails
        if (!isSubscribed) return;
        if (allowRemoteFallback) {
          setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`);
        } else {
          setRenderFailed(true);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [value, size, allowRemoteFallback]);

  if (!value) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-slate-400 text-xs ${className}`}
      >
        Chưa có mã
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 animate-pulse text-slate-400 text-xs ${className}`}
      >
        {renderFailed ? 'Không tạo được mã QR' : 'Đang tạo mã QR...'}
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR Code: ${value}`}
      title={title}
      style={{ width: size, height: size }}
      className={`object-contain select-none ${className}`}
    />
  );
};
