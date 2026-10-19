// types/notification.ts

export type NotificationType = 
  | 'ORDER'         // Đơn hàng mua/bán thông thường
  | 'INSPECTION'    // Đơn kiểm định sản phẩm
  | 'SHIPPING'      // Tiến độ vận chuyển Lalamove
  | 'LISTING'       // Trạng thái bài đăng tin
  | 'NEGOTIATION'   // Thương lượng / Trả giá
  | 'WALLET'        // Nạp tiền ví, hoàn tiền, nhận doanh thu
  | 'EKYC'          // Xác minh hồ sơ người bán
  | 'SECURITY'      // Cảnh báo bảo mật tài khoản
  | 'SYSTEM';       // Thông báo chung từ hệ thống

export type ReferenceType = 
  | 'ORDER'
  | 'INSPECTION_ORDER'
  | 'POST'
  | 'NEGOTIATION'
  | 'WALLET_TRANSACTION'
  | 'USER'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;                      // UUID thông báo
  title: string;                   // Tiêu đề ngắn gọn
  message: string;                 // Nội dung thông báo
  type: NotificationType | string; // Phân loại để hiển thị icon/màu sắc
  referenceId: string | null;      // ID đối tượng nghiệp vụ (orderId, postId...)
  referenceType: ReferenceType | string | null;
  actionUrl: string | null;        // Deep link FE cần redirect tới
  isRead: boolean;                 // Trạng thái đã đọc
  readAt: string | null;           // ISO Timestamp thời điểm đọc
  createdAt: string;               // ISO Timestamp thời điểm tạo
  userId?: string | null;          // ID người dùng nhận thông báo
  recipientId?: string | null;     // ID người dùng nhận thông báo
  recipientRole?: 'BUYER' | 'SELLER' | string | null; // Vai trò người nhận
}

export interface UnreadCountResponse {
  unreadCount: number;             // Số lượng thông báo chưa đọc
}

export interface NotificationActionResponse {
  success: boolean;
  affectedRows?: number;           // Số lượng thông báo đã xử lý
  affectedCount?: number;          // Tương thích BE trả về affectedCount
  message: string;
}

export interface NotificationPageResponse<T> {
  content: T[];
  page: number;                    // 0-indexed
  size: number;
  totalElements: number;
  totalPages: number;
  last?: boolean;
  first?: boolean;
  empty?: boolean;
}
