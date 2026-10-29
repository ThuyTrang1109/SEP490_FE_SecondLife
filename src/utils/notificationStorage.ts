import { NotificationItem } from '../types/notification';
import { UserProfile, UserRole } from '../types';
import { translateSystemNotification } from './systemNotificationTranslator';

/**
 * Kiểm tra xem một thông báo có thuộc về người dùng và vai trò hiện tại hay không.
 * Ngăn chặn tuyệt đối việc tài khoản này xem được thông báo của tài khoản khác.
 */
export function isNotificationForUser(
  item: NotificationItem | null | undefined,
  currentUser: UserProfile | null | undefined,
  currentRole: UserRole | string | null | undefined
): boolean {
  if (!item) return false;
  if (!currentUser) return false;

  const currentUserId = String(currentUser.id || '');
  const currentUserName = ((currentUser as any)?.fullName || currentUser?.name || '').trim().toLowerCase();
  const currentUserEmail = (currentUser?.email || '').trim().toLowerCase();
  const role = String(currentRole || currentUser.role || '').toUpperCase();
  const userRoles = Array.isArray((currentUser as any)?.roles)
    ? (currentUser as any).roles.map((r: any) => String(r).toUpperCase())
    : [];

  const targetId = item.recipientId || item.userId;
  const itemRecipientName = String((item as any)?.recipientName || (item as any)?.sellerName || '').trim().toLowerCase();
  const itemRecipientEmail = String((item as any)?.recipientEmail || (item as any)?.sellerEmail || '').trim().toLowerCase();

  // 1. Kiểm tra đích danh người dùng trước tiên:
  // Nếu thông báo gửi đích danh cho currentUserId thì hiển thị ngay lập tức
  if (targetId && String(targetId) === currentUserId) {
    return true;
  }

  // 1.1 Khớp theo tên hiển thị hoặc email của người nhận/người bán
  if (currentUserName && itemRecipientName && currentUserName === itemRecipientName) {
    return true;
  }
  if (currentUserEmail && itemRecipientEmail && currentUserEmail === itemRecipientEmail) {
    return true;
  }

  // 1.2 Nếu thông báo đã chỉ định đích danh người khác (khác currentUserId và khác tên/email)
  // Lưu ý: Nếu thông báo gửi cho vai trò SELLER hoặc BUYER và người dùng đang ở vai trò đó, vẫn cho phép hiển thị
  const targetRole = String(item.recipientRole || '').toUpperCase();
  if (targetId && String(targetId) !== currentUserId && itemRecipientName && itemRecipientName !== currentUserName) {
    if (targetRole !== 'SELLER' && targetRole !== 'BUYER') {
      return false;
    }
    // Nếu là SELLER nhưng người dùng hiện tại lại là ADMIN/INSPECTOR/CENTER thì không hiển thị
    if (targetRole === 'SELLER' && (role === 'INSPECTOR' || role === 'INSPECTION_CENTER' || role === 'ADMIN')) {
      return false;
    }
  }

  // 2. Kiểm tra vai trò chuyên biệt (Inspector, Inspection Center, Admin)
  if (['INSPECTOR', 'INSPECTION_CENTER'].includes(targetRole)) {
    return role === 'INSPECTOR' || role === 'INSPECTION_CENTER' || userRoles.includes('INSPECTOR') || userRoles.includes('INSPECTION_CENTER');
  }
  if (targetRole === 'ADMIN') {
    return role === 'ADMIN' || userRoles.includes('ADMIN');
  }

  // 3. Đối với người dùng cá nhân C2C (vừa là Người mua vừa là Người bán):
  // Thông báo của Người bán (SELLER) sẽ hiển thị cho tài khoản nếu họ là người bán hoặc có bài đăng/đơn bán
  if (targetRole === 'SELLER') {
    if (role === 'INSPECTOR' || role === 'INSPECTION_CENTER' || role === 'ADMIN') {
      return false; // Portal chuyên biệt không hiển thị thông báo seller thông thường
    }
    // Nếu thông báo gửi cho người bán và người dùng này là user/seller/buyer cá nhân
    return true;
  }

  if (targetRole === 'BUYER') {
    if (role === 'INSPECTOR' || role === 'INSPECTION_CENTER' || role === 'ADMIN') {
      return false;
    }
    return true;
  }

  if (['ALL', 'SYSTEM'].includes(targetRole)) {
    return true;
  }

  // 4. Phân loại theo ngữ cảnh nội dung nếu thông báo chưa gắn metadata:
  const title = (item.title || '').toLowerCase();
  const msg = (item.message || '').toLowerCase();
  const itemType = String(item.type || '').toUpperCase();

  // Thông báo dành riêng cho Trung tâm kiểm định / KTV
  if (
    title.includes('nhiệm vụ kiểm định') ||
    title.includes('phân công ktv') ||
    msg.includes('trung tâm vui lòng điều phối') ||
    msg.includes('phân công ktv') ||
    itemType === 'INSPECTION_TASK'
  ) {
    return role === 'INSPECTOR' || role === 'INSPECTION_CENTER';
  }

  // Thông báo dành cho Người bán
  if (
    title.includes('yêu cầu kiểm định') ||
    title.includes('đơn kiểm định mới') ||
    title.includes('kiểm định tại nhà') ||
    title.includes('kiểm định qua hub') ||
    title.includes('hẹn lịch ktv') ||
    title.includes('có đơn hàng mới') ||
    title.includes('người mua từ chối mua tiếp') ||
    title.includes('sản phẩm của bạn') ||
    itemType === 'INSPECTION_SELLER_REQUEST' ||
    msg.includes('vừa đặt mua sản phẩm') ||
    msg.includes('vừa đặt cọc kiểm định') ||
    msg.includes('vừa gửi yêu cầu kiểm định') ||
    msg.includes('hẹn lịch ktv') ||
    msg.includes('chuẩn bị gửi hàng') ||
    msg.includes('thiết bị của bạn')
  ) {
    return role !== 'INSPECTOR' && role !== 'INSPECTION_CENTER' && role !== 'ADMIN';
  }

  // Thông báo dành cho Người mua
  if (
    title.includes('kết quả kiểm định') ||
    title.includes('đặt đơn kiểm định') ||
    title.includes('đặt đơn hàng') ||
    msg.includes('hoàn tất thẩm định') ||
    msg.includes('xác nhận quyết định nhận hàng') ||
    msg.includes('hoàn trả 100%')
  ) {
    return role !== 'INSPECTOR' && role !== 'INSPECTION_CENTER' && role !== 'ADMIN';
  }

  return true;
}

/**
 * Lấy danh sách thông báo cục bộ chỉ thuộc về người dùng hiện tại
 */
export function getScopedLocalNotifications(
  currentUser: UserProfile | null | undefined,
  currentRole: UserRole | string | null | undefined
): NotificationItem[] {
  if (!currentUser) return [];
  const currentUserId = String(currentUser.id || '');
  const userKey = `secondlife_local_notifications_${currentUserId}`;

  let list: NotificationItem[] = [];

  // 1. Đọc từ bộ nhớ riêng của user
  try {
    const rawUser = localStorage.getItem(userKey);
    if (rawUser) {
      const parsed: NotificationItem[] = JSON.parse(rawUser);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    }
  } catch {}

  // 2. Đọc từ bộ nhớ chung nhưng lọc nghiêm ngặt theo đúng user/role
  try {
    const rawGlobal = localStorage.getItem('secondlife_local_notifications');
    if (rawGlobal) {
      const globalList: NotificationItem[] = JSON.parse(rawGlobal);
      if (Array.isArray(globalList)) {
        for (const item of globalList) {
          if (isNotificationForUser(item, currentUser, currentRole) && !list.some((n) => n.id === item.id)) {
            list.push(item);
          }
        }
      }
    }
  } catch {}

  return list
    .filter((n) => isNotificationForUser(n, currentUser, currentRole))
    .map((n) => ({
      ...n,
      title: translateSystemNotification(n.title),
      message: translateSystemNotification(n.message),
    }));
}

/**
 * Lưu thông báo cục bộ đến đúng người nhận (Seller, Buyer, Inspector)
 */
export function saveScopedLocalNotification(
  item: NotificationItem,
  targetUserId?: string | null,
  targetRole?: string | null
): void {
  const enhancedItem: NotificationItem = {
    ...item,
    title: translateSystemNotification(item.title),
    message: translateSystemNotification(item.message),
    recipientId: targetUserId || item.recipientId || null,
    recipientRole: targetRole || item.recipientRole || null,
  };

  try {
    // 1. Lưu vào kho riêng của người nhận nếu có ID
    if (targetUserId) {
      const userKey = `secondlife_local_notifications_${targetUserId}`;
      const existingRaw = localStorage.getItem(userKey);
      const existing: NotificationItem[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [enhancedItem, ...existing.filter((n) => n.id !== enhancedItem.id)].slice(0, 50);
      localStorage.setItem(userKey, JSON.stringify(updated));
    }

    // 2. Luôn lưu vào kho thông báo chung để truy xuất dự phòng
    const raw = localStorage.getItem('secondlife_local_notifications');
    const existing: NotificationItem[] = raw ? JSON.parse(raw) : [];
    const updated = [enhancedItem, ...existing.filter((n) => n.id !== enhancedItem.id)].slice(0, 50);
    localStorage.setItem('secondlife_local_notifications', JSON.stringify(updated));

    // 3. Phát sự kiện trong window kèm metadata người nhận
    window.dispatchEvent(
      new CustomEvent('secondlife_notification', {
        detail: enhancedItem,
      })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to save scoped local notification:', e);
  }
}

/**
 * Đánh dấu đã đọc thông báo cục bộ của người dùng hiện tại
 */
export function markScopedLocalNotificationRead(
  currentUser: UserProfile | null | undefined,
  notifId?: string
): void {
  if (!currentUser) return;
  const currentUserId = String(currentUser.id || '');
  const userKey = `secondlife_local_notifications_${currentUserId}`;

  const updateList = (items: NotificationItem[]) => {
    return items.map((n) => {
      if (!notifId || n.id === notifId) {
        return { ...n, isRead: true, readAt: new Date().toISOString() };
      }
      return n;
    });
  };

  try {
    const rawUser = localStorage.getItem(userKey);
    if (rawUser) {
      localStorage.setItem(userKey, JSON.stringify(updateList(JSON.parse(rawUser))));
    }
    const rawGlobal = localStorage.getItem('secondlife_local_notifications');
    if (rawGlobal) {
      localStorage.setItem('secondlife_local_notifications', JSON.stringify(updateList(JSON.parse(rawGlobal))));
    }
  } catch {}
}

/**
 * Xóa thông báo cục bộ của người dùng hiện tại
 */
export function deleteScopedLocalNotification(
  currentUser: UserProfile | null | undefined,
  notifId?: string,
  clearAll = false
): void {
  if (!currentUser) return;
  const currentUserId = String(currentUser.id || '');
  const userKey = `secondlife_local_notifications_${currentUserId}`;

  try {
    if (clearAll) {
      localStorage.removeItem(userKey);
      const rawGlobal = localStorage.getItem('secondlife_local_notifications');
      if (rawGlobal) {
        const list: NotificationItem[] = JSON.parse(rawGlobal);
        const filtered = list.filter((n) => (n.recipientId || n.userId) !== currentUserId);
        localStorage.setItem('secondlife_local_notifications', JSON.stringify(filtered));
      }
      return;
    }

    if (notifId) {
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        const list: NotificationItem[] = JSON.parse(rawUser);
        localStorage.setItem(userKey, JSON.stringify(list.filter((n) => n.id !== notifId)));
      }
      const rawGlobal = localStorage.getItem('secondlife_local_notifications');
      if (rawGlobal) {
        const list: NotificationItem[] = JSON.parse(rawGlobal);
        localStorage.setItem('secondlife_local_notifications', JSON.stringify(list.filter((n) => n.id !== notifId)));
      }
    }
  } catch {}
}

/**
 * Dọn dẹp toàn bộ dữ liệu thông báo khi đăng xuất tài khoản
 */
export function clearNotificationsOnLogout(): void {
  try {
    localStorage.removeItem('secondlife_local_notifications');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('secondlife_local_notifications_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}
