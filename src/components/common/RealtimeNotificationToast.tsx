import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Wallet,
  Tag,
  Package,
  ShieldAlert,
  Sparkles,
  Bell
} from 'lucide-react';
import { NotificationItem, NotificationType } from '../../types/notification';
import { notificationWsClient } from '../../services/notificationWsClient';
import { Language, UserProfile, UserRole } from '../../types';
import { isNotificationForUser } from '../../utils/notificationStorage';

interface RealtimeNotificationToastProps {
  lang: Language;
  currentUser?: UserProfile | null;
  currentRole?: UserRole | string;
  onNavigateToUrl?: (actionUrl: string | null, notification: NotificationItem) => void;
}

// Chime using Web Audio API so it works everywhere without external audio files
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle melodic 2-tone chime: E5 (659Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Audio autostart policy may block before user interaction
  }
}

export const RealtimeNotificationToast: React.FC<RealtimeNotificationToastProps> = ({
  lang,
  currentUser,
  currentRole,
  onNavigateToUrl,
}) => {
  const [currentToast, setCurrentToast] = useState<NotificationItem | null>(null);

  useEffect(() => {
    // If not logged in, do not listen or show notifications
    if (!currentUser) return;

    const handleItem = (item: NotificationItem) => {
      if (!item) return;
      if (!isNotificationForUser(item, currentUser, currentRole)) {
        return;
      }
      playNotificationChime();
      setCurrentToast(item);
      const timer = setTimeout(() => {
        setCurrentToast((prev) => (prev?.id === item.id ? null : prev));
      }, 7000);
      return timer;
    };

    const unsubscribe = notificationWsClient.subscribeListener((item: NotificationItem) => {
      handleItem(item);
    });

    const handleCustom = (e: any) => {
      if (e.detail) {
        handleItem(e.detail);
      }
    };
    window.addEventListener('secondlife_notification', handleCustom);

    const handleStorage = (e: StorageEvent) => {
      const scopedKey = `secondlife_local_notifications_${currentUser.id}`;
      if ((e.key === scopedKey || e.key === 'secondlife_local_notifications') && e.newValue) {
        try {
          const list: NotificationItem[] = JSON.parse(e.newValue);
          if (Array.isArray(list) && list.length > 0) {
            handleItem(list[0]);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('secondlife_notification', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser, currentRole]);

  if (!currentToast) return null;

  const getIcon = (type: NotificationType | string) => {
    const t = (type || 'SYSTEM').toUpperCase();
    switch (t) {
      case 'ORDER':
        return <ShoppingBag className="w-5 h-5 text-blue-400" />;
      case 'INSPECTION':
        return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case 'SHIPPING':
        return <Truck className="w-5 h-5 text-orange-400" />;
      case 'WALLET':
        return <Wallet className="w-5 h-5 text-emerald-400" />;
      case 'LISTING':
        return <Package className="w-5 h-5 text-indigo-400" />;
      case 'NEGOTIATION':
        return <Tag className="w-5 h-5 text-amber-400" />;
      case 'SECURITY':
      case 'EKYC':
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      default:
        return <Bell className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-slideUp">
      <div className="p-4 rounded-3xl bg-[#24263e]/95 backdrop-blur-2xl border border-white/20 shadow-2xl text-white space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-white/10 border border-white/15 shrink-0">
              {getIcon(currentToast.type)}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#c34c36] tracking-wider block">
                {lang === 'vi' ? 'Thông báo mới' : 'New Notification'}
              </span>
              <h4 className="font-bold text-xs text-white leading-tight">
                {currentToast.title}
              </h4>
            </div>
          </div>

          <button
            onClick={() => setCurrentToast(null)}
            className="text-white/50 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">
          {currentToast.message}
        </p>

        <div className="pt-1 flex items-center justify-end gap-2">
          {currentToast.actionUrl && (
            <button
              onClick={() => {
                const url = currentToast.actionUrl;
                setCurrentToast(null);
                if (onNavigateToUrl) {
                  onNavigateToUrl(url, currentToast);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <span>{lang === 'vi' ? 'Xem chi tiết' : 'View details'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
