import { Language } from '../types';

export interface DeadlineTimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formattedRemaining: string;
}

/**
 * Format deadline with BOTH time and date according to the UI timezone.
 * Helps users easily recognize deadlines crossing midnight (e.g., 08:00 10/11/2026).
 */
export function formatInspectionDeadline(
  deadline: string | null | undefined,
  lang: Language = 'vi'
): string {
  if (!deadline) return '';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  if (lang === 'vi') {
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }
  return `${hours}:${minutes} ${month}/${day}/${year}`;
}

/**
 * Check whether the payment deadline has passed.
 */
export function isInspectionPaymentExpired(
  deadline: string | null | undefined,
  now: number | Date = Date.now()
): boolean {
  if (!deadline) return false;
  const deadlineMs = typeof deadline === 'string' ? Date.parse(deadline) : new Date(deadline).getTime();
  if (!Number.isFinite(deadlineMs)) return false;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return deadlineMs <= nowMs;
}

/**
 * Calculate countdown and remaining time from paymentDeadline.
 */
export function calculateDeadlineTimeLeft(
  deadline: string | null | undefined,
  now: number | Date = Date.now(),
  lang: Language = 'vi'
): DeadlineTimeLeft {
  if (!deadline) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
      formattedRemaining: '',
    };
  }

  const deadlineMs = typeof deadline === 'string' ? Date.parse(deadline) : new Date(deadline).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
      formattedRemaining: '',
    };
  }

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const diffMs = deadlineMs - nowMs;

  if (diffMs <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      formattedRemaining: lang === 'vi' ? '0p' : '0m',
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedRemaining =
    hours > 0
      ? lang === 'vi'
        ? `${hours}g ${minutes}p`
        : `${hours}h ${minutes}m`
      : lang === 'vi'
      ? `${minutes}p ${seconds}s`
      : `${minutes}m ${seconds}s`;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    isExpired: false,
    formattedRemaining,
  };
}

