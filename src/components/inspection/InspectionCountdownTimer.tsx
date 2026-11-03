import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface InspectionCountdownTimerProps {
  deadline?: string | Date;
  onExpire?: () => void;
  prefixText?: string;
  warningHours?: number;
  className?: string;
  compact?: boolean;
}

export const InspectionCountdownTimer: React.FC<InspectionCountdownTimerProps> = ({
  deadline,
  onExpire,
  prefixText = 'Thời gian còn lại:',
  warningHours = 4,
  className = '',
  compact = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    totalMs: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  const expiredFiredRef = useRef(false);

  useEffect(() => {
    if (!deadline) return;

    const targetDate = new Date(deadline).getTime();

    const calculateTime = () => {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({
          totalMs: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });

        if (!expiredFiredRef.current) {
          expiredFiredRef.current = true;
          onExpire?.();
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        totalMs: diff,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (!deadline) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const isUrgent = !timeLeft.isExpired && timeLeft.totalMs < warningHours * 60 * 60 * 1000;

  if (compact) {
    if (timeLeft.isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          <AlertCircle className="w-3.5 h-3.5" />
          Hết hạn
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          isUrgent
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <div
        className={`flex items-center gap-2 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 ${className}`}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div className="text-sm">
          <span className="font-semibold">ĐÃ HẾT HẠN</span>
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
            Thời hạn khiếu nại đã kết thúc. Hệ thống đã tự động ghi nhận và áp dụng xử lý uy tín.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isUrgent
          ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 dark:border-amber-700/60 dark:from-amber-950/40 dark:to-orange-950/30 dark:text-amber-200'
          : 'border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-bounce" />
          ) : (
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
          <span className="text-xs sm:text-sm font-medium">{prefixText}</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-base sm:text-lg font-bold">
          <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/30 shadow-xs">
            {pad(timeLeft.hours)}
          </span>
          <span>:</span>
          <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/30 shadow-xs">
            {pad(timeLeft.minutes)}
          </span>
          <span>:</span>
          <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/30 shadow-xs">
            {pad(timeLeft.seconds)}
          </span>
        </div>
      </div>

      {isUrgent && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 font-medium">
          Sắp hết hạn! Hãy hoàn tất thao tác để bảo vệ quyền lợi và điểm uy tín tài khoản.
        </p>
      )}
    </div>
  );
};

