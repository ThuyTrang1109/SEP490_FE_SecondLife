import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ScannableQRCodeProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

export const ScannableQRCode: React.FC<ScannableQRCodeProps> = ({
  value,
  size = 160,
  className = '',
  title = 'Quét mã QR để xác thực'
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!value) {
      setDataUrl('');
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
        if (isSubscribed) {
          setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [value, size]);

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
        Đang tạo mã QR...
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
