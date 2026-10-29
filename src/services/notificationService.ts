import { request } from './apiClient';
import {
  NotificationItem,
  NotificationPageResponse,
  UnreadCountResponse,
  NotificationActionResponse,
} from '../types/notification';

export interface GetNotificationsParams {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
  type?: string;
}

export const notificationService = {
  /**
   * Lấy số lượng thông báo chưa đọc để hiển thị badge quả chuông
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const res = await request<UnreadCountResponse>('/notifications/unread-count', {
        method: 'GET',
        requiresAuth: true,
      });
      const data = (res as any)?.data ?? res;
      return typeof data?.unreadCount === 'number' ? data.unreadCount : 0;
    } catch (err) {
      console.warn('Failed to fetch notification unread count:', err);
      return 0;
    }
  },

  /**
   * Lấy danh sách thông báo phân trang và lọc
   * GET /api/v1/notifications
   */
  async getNotifications(params: GetNotificationsParams = {}): Promise<NotificationPageResponse<NotificationItem>> {
    const { page = 0, size = 10, unreadOnly, type } = params;
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('size', String(size));
    if (unreadOnly !== undefined) {
      q.set('unreadOnly', String(unreadOnly));
    }
    if (type && type !== 'ALL') {
      q.set('type', type);
    }

    const res = await request<NotificationPageResponse<NotificationItem>>(`/notifications?${q.toString()}`, {
      method: 'GET',
      requiresAuth: true,
    });

    const d = (res as any)?.data ?? res;
    // Map backend PageResponse format (content, page, size, totalElements, totalPages)
    const items = d?.content || d?.items || (Array.isArray(d) ? d : []);
    return {
      content: items,
      page: d?.page ?? page,
      size: d?.size ?? size,
      totalElements: d?.totalElements ?? items.length,
      totalPages: d?.totalPages ?? 1,
      last: d?.last ?? (d?.totalPages ? page >= d.totalPages - 1 : true),
      first: d?.first ?? (page === 0),
      empty: items.length === 0,
    };
  },

  /**
   * Đánh dấu 1 thông báo là đã đọc
   * PATCH /api/v1/notifications/{id}/read
   */
  async markAsRead(id: string): Promise<NotificationItem> {
    const res = await request<NotificationItem>(`/notifications/${id}/read`, {
      method: 'PATCH',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as NotificationItem;
  },

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   * PATCH /api/v1/notifications/read-all
   */
  async markAllAsRead(): Promise<NotificationActionResponse> {
    const res = await request<NotificationActionResponse>('/notifications/read-all', {
      method: 'PATCH',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as NotificationActionResponse;
  },

  /**
   * Xóa mềm 1 thông báo cụ thể
   * DELETE /api/v1/notifications/{id}
   */
  async deleteNotification(id: string): Promise<NotificationActionResponse> {
    const res = await request<NotificationActionResponse>(`/notifications/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as NotificationActionResponse;
  },

  /**
   * Xóa tất cả thông báo đã đọc
   * DELETE /api/v1/notifications/clear-read
   */
  async clearReadNotifications(): Promise<NotificationActionResponse> {
    const res = await request<NotificationActionResponse>('/notifications/clear-read', {
      method: 'DELETE',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as NotificationActionResponse;
  },

  /**
   * Xóa toàn bộ thông báo trong hộp thư
   * DELETE /api/v1/notifications/clear-all
   */
  async clearAllNotifications(): Promise<NotificationActionResponse> {
    const res = await request<NotificationActionResponse>('/notifications/clear-all', {
      method: 'DELETE',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as NotificationActionResponse;
  },

  /**
   * Đăng ký hoặc cập nhật FCM device token cho thiết bị di động / web push
   * POST /api/v1/notifications/devices
   */
  async registerDeviceToken(token: string, deviceType = 'WEB'): Promise<void> {
    try {
      await request<void>('/notifications/devices', {
        method: 'POST',
        body: JSON.stringify({ token, deviceType }),
        requiresAuth: true,
      });
    } catch (err) {
      console.warn('Failed to register device token:', err);
    }
  },

  /**
   * Hủy đăng ký FCM device token khi đăng xuất
   * DELETE /api/v1/notifications/devices/{token}
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      await request<void>(`/notifications/devices/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    } catch (err) {
      console.warn('Failed to unregister device token:', err);
    }
  },
};

