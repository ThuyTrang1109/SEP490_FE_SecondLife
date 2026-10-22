import { translateApiError } from '../services/apiClient';

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
  return translateApiError(msg);
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
