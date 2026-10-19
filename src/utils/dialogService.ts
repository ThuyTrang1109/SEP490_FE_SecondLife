export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface DialogOptions {
  title?: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

type DialogListener = (state: DialogState | null) => void;

export function translateToVietnamese(msg: string): string {
  if (!msg) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
  const s = String(msg).trim();

  if (/bad credentials/i.test(s)) return 'Tên đăng nhập hoặc mật khẩu không chính xác.';
  if (/user not found/i.test(s)) return 'Không tìm thấy tài khoản người dùng.';
  if (/order not found/i.test(s)) return 'Không tìm thấy đơn hàng.';
  if (/post not found|listing not found/i.test(s)) return 'Không tìm thấy thông tin sản phẩm.';
  if (/unauthorized/i.test(s)) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (/access denied|forbidden/i.test(s)) return 'Bạn không có quyền thực hiện hành động này.';
  if (/insufficient balance|insufficient fund/i.test(s)) return 'Số dư ví không đủ để thực hiện giao dịch.';
  if (/email already exists|email.*already in use/i.test(s)) return 'Địa chỉ Email này đã được đăng ký trong hệ thống.';
  if (/phone.*already exists/i.test(s)) return 'Số điện thoại này đã được sử dụng.';
  if (/failed to fetch|network error/i.test(s)) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.';
  if (/internal server error/i.test(s)) return 'Máy chủ gặp sự cố xử lý. Vui lòng thử lại sau.';
  if (/cannot read properties of/i.test(s)) return 'Dữ liệu chưa hoàn tất tải. Vui lòng làm mới trang.';
  if (/jwt expired|token.*expired/i.test(s)) return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
  if (/invalid otp|otp expired/i.test(s)) return 'Mã xác thực OTP không chính xác hoặc đã hết hiệu lực.';
  if (/invalid status/i.test(s)) return 'Trạng thái đơn hàng không hợp lệ cho thao tác này.';

  return s;
}

class DialogService {
  private listener: DialogListener | null = null;

  subscribe(listener: DialogListener) {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  alert(message: string, options?: DialogOptions): Promise<void> {
    const finalMsg = translateToVietnamese(message);
    return new Promise((resolve) => {
      if (!this.listener) {
        console.warn('[Popup Alert]', finalMsg);
        resolve();
        return;
      }
      this.listener({
        isOpen: true,
        type: options?.type || 'info',
        title: options?.title || 'Thông Báo Hệ Thống',
        message: finalMsg,
        confirmText: options?.confirmText || 'Đã Hiểu',
        resolve: () => resolve(),
      });
    });
  }

  success(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'success',
      title: title || 'Thao Tác Thành Công',
      confirmText: 'Đồng Ý',
    });
  }

  error(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'error',
      title: title || 'Đã Xảy Ra Lỗi',
      confirmText: 'Đã Hiểu',
    });
  }

  warning(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'warning',
      title: title || 'Cảnh Báo',
      confirmText: 'Đã Hiểu',
    });
  }

  confirm(message: string, options?: DialogOptions): Promise<boolean> {
    const finalMsg = translateToVietnamese(message);
    return new Promise((resolve) => {
      if (!this.listener) {
        console.warn('[Popup Confirm]', finalMsg);
        resolve(true);
        return;
      }
      this.listener({
        isOpen: true,
        type: options?.type || 'confirm',
        title: options?.title || 'Xác Nhận Thao Tác',
        message: finalMsg,
        confirmText: options?.confirmText || 'Xác Nhận',
        cancelText: options?.cancelText || 'Hủy Bỏ',
        resolve: (val: boolean) => resolve(val),
      });
    });
  }
}

export const dialogService = new DialogService();

// Global interceptor: Thay thế hoàn toàn native window.alert của trình duyệt
// Giúp toàn bộ các hàm gọi alert() bất kỳ đâu trong dự án đều mở Popup Modal hiện đại,
// xóa bỏ hoàn toàn thông báo "localhost says" khó chịu của trình duyệt.
if (typeof window !== 'undefined') {
  window.alert = (msg?: any) => {
    dialogService.alert(String(msg ?? ''));
  };
}
