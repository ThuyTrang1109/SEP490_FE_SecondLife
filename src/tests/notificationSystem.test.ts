import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNotificationForUser,
  compareNotificationsNewestFirst,
} from '../utils/notificationStorage';
import { NotificationItem } from '../types/notification';
import { UserProfile } from '../types';

test('isNotificationForUser strictly prevents seller notifications from appearing in buyer notifications', () => {
  const buyerUser: UserProfile = {
    id: 'user-buyer-123',
    name: 'Nguyen Hieu Tuan',
    email: 'buyer@example.com',
    role: 'buyer',
    roles: ['buyer'],
    verified: true,
  } as any;

  const sellerUser: UserProfile = {
    id: 'user-seller-456',
    name: 'Gian Hàng Verified Seller',
    email: 'seller@example.com',
    role: 'seller',
    roles: ['seller', 'buyer'],
    verified: true,
  } as any;

  // 1. Seller order notification generated upon checkout
  const sellerNotif: NotificationItem = {
    id: 'notif-seller-inspection-order-999',
    recipientId: 'user-seller-456',
    recipientRole: 'seller',
    title: 'Đơn đặt hàng mới cần xác nhận',
    message: 'Khách mua Nguyen Hieu Tuan vừa đặt mua sản phẩm "Máy Sấy Tóc Braun Silencio 1000 Model 4588 - Nguyên Zin" của bên seller. Vui lòng xác nhận đơn hàng!',
    type: 'INSPECTION_SELLER_REQUEST',
    referenceId: 'order-999',
    referenceType: 'INSPECTION_ORDER',
    actionUrl: '/seller/orders?filter=awaiting_pickup',
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:50:00.000Z',
    ...( { recipientName: 'Gian Hàng Verified Seller', recipientEmail: 'seller@example.com' } as any),
  };

  // Buyer MUST NOT see this notification
  assert.equal(isNotificationForUser(sellerNotif, buyerUser, 'buyer'), false);

  // Seller MUST see this notification
  assert.equal(isNotificationForUser(sellerNotif, sellerUser, 'seller'), true);

  // 2. Buyer order notification generated upon checkout
  const buyerNotif: NotificationItem = {
    id: 'notif-buyer-order-999',
    recipientId: 'user-buyer-123',
    recipientRole: 'buyer',
    title: 'Đặt đơn hàng thành công',
    message: 'Bạn đã đặt mua sản phẩm "Máy Sấy Tóc Braun Silencio 1000 Model 4588 - Nguyên Zin". Đang chờ Người bán xác nhận!',
    type: 'ORDER',
    referenceId: 'order-999',
    referenceType: 'ORDER',
    actionUrl: '/buyer/orders',
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:50:00.000Z',
  };

  // Buyer MUST see their own notification
  assert.equal(isNotificationForUser(buyerNotif, buyerUser, 'buyer'), true);

  // Seller MUST NOT see buyer's notification
  assert.equal(isNotificationForUser(buyerNotif, sellerUser, 'seller'), false);
});

test('isNotificationForUser blocks notifications with a different targetId', () => {
  const currentUser: UserProfile = {
    id: 'user-111',
    name: 'User One',
    email: 'user1@example.com',
    role: 'buyer',
    roles: ['buyer'],
    verified: true,
  } as any;

  const notifForOtherUser: NotificationItem = {
    id: 'notif-222',
    recipientId: 'user-222',
    title: 'Thông báo cá nhân',
    message: 'Nội dung riêng',
    type: 'SYSTEM',
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:50:00.000Z',
  };

  assert.equal(isNotificationForUser(notifForOtherUser, currentUser, 'buyer'), false);
});

test('compareNotificationsNewestFirst correctly sorts newest items to the top', () => {
  const notifOld: NotificationItem = {
    id: 'notif-1',
    title: 'Cũ hơn',
    message: '10 phút trước',
    type: 'SYSTEM',
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:00:00.000Z',
  };

  const notifNew: NotificationItem = {
    id: 'notif-2',
    title: 'Mới hơn',
    message: 'Vừa xong',
    type: 'SYSTEM',
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:10:00.000Z',
  };

  const notifSameTimeA: NotificationItem = {
    id: 'notif-a',
    title: 'Cùng giờ A',
    message: 'Vừa xong A',
    type: 'SYSTEM',
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:10:00.000Z',
  };

  const notifSameTimeB: NotificationItem = {
    id: 'notif-b',
    title: 'Cùng giờ B',
    message: 'Vừa xong B',
    type: 'SYSTEM',
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-18T08:10:00.000Z',
  };

  const list = [notifOld, notifNew];
  list.sort(compareNotificationsNewestFirst);

  // Newest should be index 0
  assert.equal(list[0].id, 'notif-2');
  assert.equal(list[1].id, 'notif-1');

  // Same time tie-breaking by ID descending ('notif-b' before 'notif-a')
  const tieList = [notifSameTimeA, notifSameTimeB];
  tieList.sort(compareNotificationsNewestFirst);
  assert.equal(tieList[0].id, 'notif-b');
  assert.equal(tieList[1].id, 'notif-a');
});
