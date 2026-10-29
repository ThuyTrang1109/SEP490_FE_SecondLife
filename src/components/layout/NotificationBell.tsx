import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Wallet,
  Tag,
  Package,
  ShieldAlert,
  Sparkles,
  Clock,
  ChevronRight,
  Loader2,
  Trash2
} from 'lucide-react';
import { NotificationItem, NotificationType } from '../../types/notification';
import { notificationService } from '../../services/notificationService';
import { notificationWsClient } from '../../services/notificationWsClient';
import { Language, UserProfile, UserRole } from '../../types';
import {
  getScopedLocalNotifications,
  isNotificationForUser,
  markScopedLocalNotificationRead,
} from '../../utils/notificationStorage';

interface NotificationBellProps {
  lang: Language;
  onNavigateToUrl?: (actionUrl: string | null, notification: NotificationItem) => void;
  onViewAllNotifications?: () => void;
  token?: string | null;
  currentUser?: UserProfile | null;
  currentRole?: UserRole | string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  lang,
  onNavigateToUrl,
  onViewAllNotifications,
  token,
  currentUser,
  currentRole,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [hasNewAnim, setHasNewAnim] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load unread count scoped strictly to current user
  const loadUnreadCount = useCallback(async () => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await notificationService.getUnreadCount();
      const localNotifs = getScopedLocalNotifications(currentUser, currentRole);
      const localUnread = localNotifs.filter((n) => !n.isRead).length;
      setUnreadCount(count + localUnread);
    } catch {
      // Ignored
    }
  }, [currentUser, currentRole]);

  // Load quick view items (top 6 notifications) scoped strictly to current user
  const loadQuickNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications({ page: 0, size: 6 });
      const localNotifs = getScopedLocalNotifications(currentUser, currentRole);
      const combined = [...localNotifs, ...(res.content || [])];
      const seen = new Set<string>();
      const unique = combined.filter((n) => {
        if (!n?.id || seen.has(n.id)) return false;
        seen.add(n.id);
        return isNotificationForUser(n, currentUser, currentRole);
      });
      setNotifications(unique.slice(0, 6));
    } catch (err) {
      console.warn('Failed to load quick notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, currentRole]);

  // Initial load & account change reset
  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    setNotifications([]);
    loadUnreadCount();
  }, [currentUser?.id, currentRole, loadUnreadCount]);

  // Listen for local custom notifications (e.g. from checkout or inspection)
  useEffect(() => {
    const handleLocalNotif = (e: any) => {
      const item: NotificationItem = e.detail;
      if (item && isNotificationForUser(item, currentUser, currentRole)) {
        setUnreadCount((prev) => prev + 1);
        setHasNewAnim(true);
        setTimeout(() => setHasNewAnim(false), 2000);
        setNotifications((prev) => [item, ...prev.filter((n) => n.id !== item.id)].slice(0, 6));
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'secondlife_local_notifications' ||
        (currentUser && e.key === `secondlife_local_notifications_${currentUser.id}`)
      ) {
        loadUnreadCount();
        loadQuickNotifications();
      }
    };
    window.addEventListener('secondlife_notification', handleLocalNotif);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('secondlife_notification', handleLocalNotif);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser, currentRole, loadUnreadCount, loadQuickNotifications]);

  // Connect WebSocket STOMP
  useEffect(() => {
    if (token) {
      notificationWsClient.connect(token);
    }

    // Subscribe to incoming real-time notifications
    const unsubscribe = notificationWsClient.subscribeListener((item: NotificationItem) => {
      // Chỉ nhận thông báo nếu thuộc về chính tài khoản này
      if (!isNotificationForUser(item, currentUser, currentRole)) {
        return;
      }

      // Increment unread count
      setUnreadCount((prev) => prev + 1);

      // Trigger bell shaking animation
      setHasNewAnim(true);
      setTimeout(() => setHasNewAnim(false), 2000);

      // Prepend to current list if list is loaded
      setNotifications((prev) => [item, ...prev.filter((n) => n.id !== item.id)].slice(0, 6));
    });

    return () => {
      unsubscribe();
    };
  }, [token, currentUser, currentRole]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Toggle dropdown
  const handleToggle = () => {
    if (!isOpen) {
      loadQuickNotifications();
      loadUnreadCount();
    }
    setIsOpen(!isOpen);
  };

  // Mark single as read
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await notificationService.markAsRead(item.id).catch(() => {});
        markScopedLocalNotificationRead(currentUser, item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }
    setIsOpen(false);
    if (onNavigateToUrl) {
      onNavigateToUrl(item.actionUrl, item);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMarkingAll(true);
    try {
      await notificationService.markAllAsRead().catch(() => {});
      markScopedLocalNotificationRead(currentUser);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Icon by type helper
  const getNotificationIcon = (type: NotificationType | string) => {
    const t = (type || 'SYSTEM').toUpperCase();
    switch (t) {
      case 'ORDER':
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
        );
      case 'INSPECTION':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
        );
      case 'SHIPPING':
        return (
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
            <Truck className="w-4 h-4 text-orange-400" />
          </div>
        );
      case 'WALLET':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
        );
      case 'LISTING':
        return (
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
        );
      case 'NEGOTIATION':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Tag className="w-4 h-4 text-amber-400" />
          </div>
        );
      case 'SECURITY':
      case 'EKYC':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-500/15 text-slate-300 flex items-center justify-center shrink-0 border border-slate-500/20">
            <Sparkles className="w-4 h-4 text-slate-300" />
          </div>
        );
    }
  };

  // Format relative timeago
  const formatTimeAgo = (isoString: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return lang === 'vi' ? 'Vừa xong' : 'Just now';
      if (diffMin < 60) return `${diffMin} ${lang === 'vi' ? 'phút trước' : 'm ago'}`;
      if (diffHour < 24) return `${diffHour} ${lang === 'vi' ? 'giờ trước' : 'h ago'}`;
      if (diffDay < 7) return `${diffDay} ${lang === 'vi' ? 'ngày trước' : 'd ago'}`;
      return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={`p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 relative transition cursor-pointer flex items-center justify-center ${
          isOpen ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/30' : ''
        } ${hasNewAnim ? 'animate-bounce' : ''}`}
        title={lang === 'vi' ? 'Thông báo hệ thống' : 'Notifications'}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />

        {/* Red Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#c34c36] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#24263e] shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Quick View Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[360px] sm:w-[400px] max-w-[92vw] bg-[#24263e]/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl text-white z-50 overflow-hidden animate-fadeIn">
          {/* Popover Header */}
          <div className="p-4 border-b border-white/15 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">
                {lang === 'vi' ? 'Thông Báo' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-extrabold bg-[#c34c36] text-white px-2 py-0.5 rounded-full shadow-2xs">
                  {unreadCount} {lang === 'vi' ? 'chưa đọc' : 'unread'}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="text-[11px] text-white/70 hover:text-white font-bold flex items-center gap-1 transition cursor-pointer hover:underline disabled:opacity-50"
              >
                {isMarkingAll ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{lang === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}</span>
              </button>
            )}
          </div>

          {/* Popover Body List */}
          <div className="max-h-[380px] overflow-y-auto subtle-scrollbar divide-y divide-white/10">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-white/50 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                <span className="text-xs font-semibold">
                  {lang === 'vi' ? 'Đang tải thông báo...' : 'Loading notifications...'}
                </span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-white/30 border border-white/10">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-white/80">
                  {lang === 'vi' ? 'Không có thông báo mới' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-white/50 max-w-xs mx-auto">
                  {lang === 'vi'
                    ? 'Mọi cập nhật về đơn hàng, vận chuyển và tài khoản sẽ hiển thị tại đây.'
                    : 'All updates about orders, shipping and account will appear here.'}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-white/10 transition cursor-pointer group relative ${
                    !item.isRead ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  {/* Type Icon */}
                  {getNotificationIcon(item.type)}

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate leading-snug ${
                          !item.isRead ? 'font-black text-white' : 'font-semibold text-white/80'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-white/40 font-medium shrink-0">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/65 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#c34c36] shrink-0 mt-1.5 shadow-xs" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Popover Footer */}
          <div className="p-3 border-t border-white/15 bg-white/5 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onViewAllNotifications) {
                  onViewAllNotifications();
                }
              }}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>{lang === 'vi' ? 'Xem tất cả thông báo' : 'View all notifications'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
