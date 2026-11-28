import { translateSystemNotification } from './systemNotificationTranslator';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface RouteDetails {
  originTitle?: string;
  originName?: string;
  originAddress: string;
  destinationTitle?: string;
  destinationName?: string;
  destinationAddress: string;
}

export interface DialogOptions {
  title?: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  routeDetails?: RouteDetails;
}

export interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  routeDetails?: RouteDetails;
  resolve?: (value: boolean) => void;
}

type DialogListener = (state: DialogState | null) => void;

export function translateToVietnamese(msg: string): string {
  if (!msg) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
  return translateSystemNotification(msg);
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
        title: options?.title || 'Thông báo hệ thống',
        message: finalMsg,
        confirmText: options?.confirmText || 'Đã hiểu',
        resolve: () => resolve(),
      });
    });
  }

  success(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'success',
      title: title || 'Thao tác thành công',
      confirmText: 'Đồng Ý',
    });
  }

  error(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'error',
      title: title || 'Đã xảy ra lỗi',
      confirmText: 'Đã hiểu',
    });
  }

  warning(message: string, title?: string): Promise<void> {
    return this.alert(message, {
      type: 'warning',
      title: title || 'Cảnh báo',
      confirmText: 'Đã hiểu',
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
        title: options?.title || 'Xác nhận thao tác',
        message: finalMsg,
        confirmText: options?.confirmText || 'Xác nhận',
        cancelText: options?.cancelText || 'Hủy bỏ',
        routeDetails: options?.routeDetails,
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
