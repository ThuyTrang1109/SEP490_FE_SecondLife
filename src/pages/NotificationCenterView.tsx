import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Filter,
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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle
} from 'lucide-react';
import { NotificationItem, NotificationType } from '../types/notification';
import { notificationService } from '../services/notificationService';
import { Language, UserProfile, UserRole } from '../types';
import { dialogService } from '../utils/dialogService';
import {
  getScopedLocalNotifications,
  isNotificationForUser,
  markScopedLocalNotificationRead,
  deleteScopedLocalNotification,
} from '../utils/notificationStorage';

interface NotificationCenterViewProps {
  lang: Language;
  onNavigateToUrl?: (actionUrl: string | null, notification: NotificationItem) => void;
  onBackToHome?: () => void;
  currentUser?: UserProfile | null;
  currentRole?: UserRole | string;
}

export const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({
  lang,
  onNavigateToUrl,
  onBackToHome,
  currentUser,
  currentRole,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Filters
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Action loading states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [noticeMsg, setNoticeMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const showNotice = (text: string, isError = false) => {
    setNoticeMsg({ text, isError });
    setTimeout(() => setNoticeMsg(null), 4000);
  };

  // Fetch unread count & notifications
  const loadData = useCallback(async (targetPage = 0) => {
    setIsLoading(true);
    try {
      let listContent: NotificationItem[] = [];
      let pageNum = targetPage;
      let totalP = 1;
      let totalEl = 0;
      let backendUnread = 0;

      try {
        const [listRes, countRes] = await Promise.all([
          notificationService.getNotifications({
            page: targetPage,
            size: 10,
            unreadOnly: unreadOnly ? true : undefined,
            type: selectedType,
          }),
          notificationService.getUnreadCount(),
        ]);
        listContent = listRes.content || [];
        pageNum = listRes.page;
        totalP = listRes.totalPages || 1;
        totalEl = listRes.totalElements || 0;
        backendUnread = countRes || 0;
      } catch (beErr) {
        console.warn('Backend notification fetch fallback:', beErr);
      }

      // Merge local notifications (scoped strictly to current user)
      const localNotifs = getScopedLocalNotifications(currentUser, currentRole).filter((n) => {
        if (selectedType && selectedType !== 'ALL') {
          if ((n.type || '').toUpperCase() !== selectedType.toUpperCase()) return false;
        }
        if (unreadOnly) {
          if (n.isRead) return false;
        }
        return true;
      });

      const combined = [...localNotifs, ...listContent];
      const seen = new Set<string>();
      const unique = combined.filter((n) => {
        if (!n?.id || seen.has(n.id)) return false;
        seen.add(n.id);
        return isNotificationForUser(n, currentUser, currentRole);
      });

      const localUnread = localNotifs.filter((n) => !n.isRead).length;

      setNotifications(unique);
      setPage(pageNum);
      setTotalPages(Math.max(1, Math.ceil(unique.length / 10), totalP));
      setTotalElements(unique.length);
      setUnreadCount(backendUnread + localUnread);
    } catch (err: any) {
      console.warn('Failed to load notifications in center view:', err);
      showNotice(err?.message || 'Không thể tải danh sách thông báo.', true);
    } finally {
      setIsLoading(false);
    }
  }, [unreadOnly, selectedType, currentUser, currentRole]);

  useEffect(() => {
    loadData(0);
  }, [loadData]);

  // Listen for real-time and storage updates
  useEffect(() => {
    const handleUpdate = () => loadData(0);
    window.addEventListener('secondlife_notification', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('secondlife_notification', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadData]);

  // Mark 1 as read
  const handleMarkOneRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (item.isRead) return;
    try {
      await notificationService.markAsRead(item.id).catch(() => {});
    } catch {}

    markScopedLocalNotificationRead(currentUser, item.id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    showNotice(lang === 'vi' ? 'Đã đánh dấu thông báo là đã đọc.' : 'Marked as read.');
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    setIsProcessing(true);
    try {
      await notificationService.markAllAsRead().catch(() => {});
      markScopedLocalNotificationRead(currentUser);

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      showNotice(lang === 'vi' ? 'Đã đánh dấu tất cả thông báo là đã đọc!' : 'Marked all as read!');
    } catch (err: any) {
      showNotice(err?.message || 'Không thể đánh dấu tất cả.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete 1 notification
  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialogService.confirm(
      lang === 'vi' ? 'Bạn có chắc muốn xóa thông báo này không?' : 'Delete this notification?',
      { title: lang === 'vi' ? 'Xác Nhận Xóa' : 'Confirm Delete', type: 'warning' }
    );
    if (!confirmed) return;
    try {
      await notificationService.deleteNotification(id).catch(() => {});
    } catch {}

    deleteScopedLocalNotification(currentUser, id);

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotalElements((prev) => Math.max(0, prev - 1));
    showNotice(lang === 'vi' ? 'Đã xóa thông báo.' : 'Notification deleted.');
  };

  // Clear read notifications
  const handleClearRead = async () => {
    const confirmed = await dialogService.confirm(
      lang === 'vi' ? 'Bạn có chắc muốn xóa toàn bộ các thông báo đã đọc?' : 'Clear all read notifications?',
      { title: lang === 'vi' ? 'Dọn Dẹp Thông Báo' : 'Clear Read Notifications', type: 'warning' }
    );
    if (!confirmed) return;
    setIsProcessing(true);
    try {
      await notificationService.clearReadNotifications().catch(() => {});
      deleteScopedLocalNotification(currentUser, undefined, false);

      showNotice(lang === 'vi' ? 'Đã dọn dẹp các thông báo đã đọc!' : 'Cleared read notifications!');
      await loadData(0);
    } catch (err: any) {
      showNotice(err?.message || 'Không thể xóa thông báo đã đọc.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    const confirmed = await dialogService.confirm(
      lang === 'vi' ? 'Cảnh báo: Bạn có chắc chắn muốn xóa TOÀN BỘ mọi thông báo trong hộp thư không?' : 'Clear ALL notifications?',
      { title: lang === 'vi' ? 'Xóa Toàn Bộ Thông Báo' : 'Clear All Notifications', type: 'error' }
    );
    if (!confirmed) return;
    setIsProcessing(true);
    try {
      await notificationService.clearAllNotifications().catch(() => {});
      deleteScopedLocalNotification(currentUser, undefined, true);

      showNotice(lang === 'vi' ? 'Đã dọn sạch toàn bộ hộp thư thông báo!' : 'Cleared all notifications!');
      setNotifications([]);
      setTotalElements(0);
      setUnreadCount(0);
    } catch (err: any) {
      showNotice(err?.message || 'Không thể dọn sạch thông báo.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Type styling helper
  const getTypeBadge = (type: NotificationType | string) => {
    const t = (type || 'SYSTEM').toUpperCase();
    switch (t) {
      case 'ORDER':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-blue-600" />
            <span>Đơn Hàng</span>
          </span>
        );
      case 'INSPECTION':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            <span>Kiểm Định</span>
          </span>
        );
      case 'SHIPPING':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
            <Truck className="w-3 h-3 text-orange-600" />
            <span>Vận Chuyển</span>
          </span>
        );
      case 'WALLET':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Wallet className="w-3 h-3 text-emerald-600" />
            <span>Ví Tiền</span>
          </span>
        );
      case 'LISTING':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
            <Package className="w-3 h-3 text-indigo-600" />
            <span>Bài Đăng</span>
          </span>
        );
      case 'NEGOTIATION':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Tag className="w-3 h-3 text-amber-600" />
            <span>Trả Giá</span>
          </span>
        );
      case 'SECURITY':
      case 'EKYC':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            <span>Bảo Mật</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-slate-600" />
            <span>Hệ Thống</span>
          </span>
        );
    }
  };

  const typeFilters = [
    { key: 'ALL', label: lang === 'vi' ? 'Tất cả loại' : 'All types' },
    { key: 'ORDER', label: lang === 'vi' ? 'Đơn hàng' : 'Orders' },
    { key: 'INSPECTION', label: lang === 'vi' ? 'Kiểm định' : 'Inspections' },
    { key: 'SHIPPING', label: lang === 'vi' ? 'Vận chuyển' : 'Shipping' },
    { key: 'WALLET', label: lang === 'vi' ? 'Ví tiền' : 'Wallet' },
    { key: 'LISTING', label: lang === 'vi' ? 'Bài đăng' : 'Listings' },
    { key: 'NEGOTIATION', label: lang === 'vi' ? 'Trả giá' : 'Negotiations' },
    { key: 'SECURITY', label: lang === 'vi' ? 'Bảo mật' : 'Security' },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] py-8 px-4 sm:px-6 lg:px-8 text-slate-900 animate-fadeIn">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              {onBackToHome && (
                <button
                  onClick={onBackToHome}
                  className="hover:text-slate-900 transition cursor-pointer font-bold"
                >
                  Trang chủ
                </button>
              )}
              <span>•</span>
              <span className="font-bold text-[#c34c36]">Trung tâm thông báo</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white flex items-center justify-center shadow-md">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {lang === 'vi' ? 'Trung Tâm Thông Báo' : 'Notification Center'}
                </h1>
                <p className="text-xs text-slate-500">
                  {lang === 'vi'
                    ? 'Quản lý toàn bộ thông báo in-app, tiến trình vận chuyển Lalamove và hoạt động tài khoản'
                    : 'Manage in-app alerts, Lalamove tracking updates and account events'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={isProcessing || unreadCount === 0}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Đánh dấu tất cả thông báo là đã đọc"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}</span>
            </button>

            <button
              onClick={handleClearRead}
              disabled={isProcessing || notifications.every((n) => !n.isRead)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Xóa các thông báo đã đọc"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'vi' ? 'Xóa đã đọc' : 'Clear read'}</span>
            </button>

            <button
              onClick={handleClearAll}
              disabled={isProcessing || notifications.length === 0}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Dọn sạch toàn bộ thông báo"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{lang === 'vi' ? 'Xóa tất cả' : 'Clear all'}</span>
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {noticeMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
              noticeMsg.isError
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            }`}
          >
            {noticeMsg.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{noticeMsg.text}</span>
          </div>
        )}

        {/* Filter Pills & Read Toggle */}
        <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            {/* Unread Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnreadOnly(false)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  !unreadOnly
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{lang === 'vi' ? 'Tất cả' : 'All'}</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {totalElements}
                </span>
              </button>

              <button
                onClick={() => setUnreadOnly(true)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  unreadOnly
                    ? 'bg-[#c34c36] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{lang === 'vi' ? 'Chưa đọc' : 'Unread'}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-[#c34c36] font-black">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => loadData(page)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#c34c36]' : ''}`} />
              <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </button>
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto subtle-scrollbar pb-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Lọc:</span>
            </span>
            {typeFilters.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setSelectedType(tf.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedType === tf.key
                    ? 'bg-[#24263e] text-white shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 bg-white rounded-3xl border border-gray-200 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#c34c36]" />
              <span className="text-xs font-bold">
                {lang === 'vi' ? 'Đang tải danh sách thông báo...' : 'Loading notifications...'}
              </span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 px-6 bg-white rounded-3xl border border-dashed border-gray-300 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                {lang === 'vi' ? 'Không có thông báo nào phù hợp' : 'No notifications found'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {unreadOnly
                  ? 'Bạn đã đọc toàn bộ các thông báo trong mục này. Chuyển sang tab "Tất cả" để xem lịch sử.'
                  : 'Hộp thư của bạn hiện đang trống. Mọi thông báo mới từ sàn SecondLife sẽ hiển thị tại đây.'}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleMarkOneRead(item)}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !item.isRead
                    ? 'bg-white border-[#c34c36]/40 shadow-xs hover:border-[#c34c36] ring-1 ring-[#c34c36]/10'
                    : 'bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Indicator Dot */}
                  <div className="pt-1 shrink-0">
                    {!item.isRead ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] block shadow-xs ring-4 ring-[#c34c36]/20" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-200 block" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getTypeBadge(item.type)}
                      <h3
                        className={`text-sm leading-snug truncate ${
                          !item.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-700'
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                      </span>
                      {item.isRead && item.readAt && (
                        <span>• Đã đọc: {new Date(item.readAt).toLocaleTimeString('vi-VN')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  {item.actionUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkOneRead(item);
                        if (onNavigateToUrl) {
                          onNavigateToUrl(item.actionUrl, item);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>{lang === 'vi' ? 'Xem chi tiết' : 'View'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}

                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkOneRead(item, e)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      title="Đánh dấu đã đọc"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDeleteOne(item.id, e)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Xóa thông báo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pt-4 flex items-center justify-between text-xs text-slate-600">
            <div>
              Trang <strong>{page + 1}</strong> / <strong>{totalPages}</strong> (Tổng {totalElements} thông báo)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData(Math.max(0, page - 1))}
                disabled={page <= 0}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>

              <button
                onClick={() => loadData(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <span>Tiếp</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
