import {
  WalletTransaction,
  WalletTransactionType,
  WalletTransactionReferenceType,
  WalletTransactionDirection,
  WalletTransactionsPage,
} from '../types';

/**
 * Định dạng số tiền ví SecondLife (VND), bảo toàn phần thập phân tối đa 2 chữ số nếu có.
 * Nếu số tiền là null/undefined thì trả về nhãn 'Chưa được ghi nhận'.
 */
export function formatWalletMoney(
  amount: number | null | undefined,
  _lang: string = 'vi',
  emptyFallback: string = 'Chưa được ghi nhận'
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return emptyFallback;
  }

  const num = Number(amount);
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);

  return `${formatted} đ`;
}

/**
 * Chuyển đổi ngày người dùng chọn (YYYY-MM-DD theo giờ địa phương)
 * sang khoảng thời gian ISO-8601 UTC để gửi lên Backend:
 * - `from`: 00:00:00 ngày bắt đầu (bao gồm mốc này).
 * - `to`: 00:00:00 ngày tiếp theo sau ngày kết thúc (không bao gồm mốc này, đảm bảo tính trọn vẹn cả ngày kết thúc).
 */
export function walletDateRange(
  fromStr?: string,
  toStr?: string
): { from?: string; to?: string; error?: string } {
  let fromIso: string | undefined;
  let toIso: string | undefined;

  if (fromStr && fromStr.trim()) {
    const parts = fromStr.trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const fromDate = new Date(year, month, day, 0, 0, 0, 0);
      if (!isNaN(fromDate.getTime())) {
        fromIso = fromDate.toISOString();
      }
    }
  }

  if (toStr && toStr.trim()) {
    const parts = toStr.trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      // Đầu ngày kế tiếp (thời điểm kết thúc của ngày được chọn)
      const toDate = new Date(year, month, day + 1, 0, 0, 0, 0);
      if (!isNaN(toDate.getTime())) {
        toIso = toDate.toISOString();
      }
    }
  }

  if (fromIso && toIso && fromIso >= toIso) {
    return {
      from: fromIso,
      to: toIso,
      error: 'Ngày bắt đầu không được lớn hơn ngày kết thúc',
    };
  }

  return {
    ...(fromIso ? { from: fromIso } : {}),
    ...(toIso ? { to: toIso } : {}),
  };
}

/**
 * Trả về nhãn tiếng Việt cho loại giao dịch ví
 */
export function walletTransactionLabel(type?: string | null): string {
  switch (type) {
    case 'DEPOSIT':
      return 'Nạp tiền';
    case 'WITHDRAW':
      return 'Rút tiền';
    case 'PAYMENT':
      return 'Thanh toán';
    case 'EARNING':
      return 'Nhận tiền';
    case 'REFUND':
      return 'Hoàn tiền';
    case 'RETURN_SHIPPING_FEE':
      return 'Phí ship hoàn hàng';
    case 'SHIPPING_REIMBURSE':
      return 'Hoàn ứng cước (Sandbox)';
    default:
      return type || 'Giao dịch ví';
  }
}

/**
 * Trả về nhãn tiếng Việt cho đối tượng nguồn tham chiếu
 */
export function walletReferenceLabel(referenceType?: string | null): string {
  switch (referenceType) {
    case 'ORDER':
      return 'Đơn hàng';
    case 'INSPECTION_ORDER':
      return 'Đơn kiểm định';
    case 'DEPOSIT_REQUEST':
      return 'Yêu cầu nạp tiền';
    case 'WITHDRAWAL':
      return 'Yêu cầu rút tiền';
    case 'SHIPMENT':
      return 'Chuyến vận chuyển';
    case 'CREDIT_PURCHASE':
      return 'Mua quyền sử dụng dịch vụ';
    case 'TOPUP_PACKAGE':
      return 'Gói quyền sử dụng dịch vụ';
    case 'PACKAGE_PURCHASE':
      return 'Gói dịch vụ';
    case 'ESCROW_HOLD':
      return 'Tạm giữ Escrow';
    case 'ESCROW_RELEASE':
      return 'Giải ngân Escrow';
    case 'DISPUTE_REFUND':
      return 'Hoàn tiền khiếu nại';
    case 'UNKNOWN':
    default:
      return 'Chưa có thông tin';
  }
}

/**
 * Phân tích và chuẩn hóa số dư: bảo toàn null (chưa ghi nhận), chuyển "0.00" hoặc 0 thành 0
 */
function parseBalance(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Chuẩn hóa một bản ghi WalletTransaction theo contract BE (Migration V60):
 * - Bảo toàn dấu amount và suy ra direction nhất quán.
 * - Chuẩn hóa balanceBefore / balanceAfter, bảo toàn null.
 * - Field nguồn thiếu hiển thị là UNKNOWN.
 * - Không tự ý gắn trạng thái SUCCESS.
 */
export function normalizeWalletTransaction(raw: any): WalletTransaction {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Dữ liệu giao dịch ví không hợp lệ (không phải object).');
  }

  const rawAmount = raw.amount;
  if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
    throw new Error('Giao dịch ví thiếu trường số tiền (amount).');
  }

  const amount = Number(rawAmount);
  if (isNaN(amount) || !isFinite(amount)) {
    throw new Error(`Số tiền giao dịch ví không hợp lệ: ${rawAmount}`);
  }

  const direction: WalletTransactionDirection =
    raw.direction === 'CREDIT' || raw.direction === 'DEBIT' || raw.direction === 'NEUTRAL'
      ? raw.direction
      : amount > 0
      ? 'CREDIT'
      : amount < 0
      ? 'DEBIT'
      : 'NEUTRAL';

  const balanceBefore = parseBalance(raw.balanceBefore);
  const balanceAfter = parseBalance(raw.balanceAfter);

  const referenceType: WalletTransactionReferenceType = raw.referenceType || 'UNKNOWN';

  return {
    id: String(raw.id ?? ''),
    walletId: String(raw.walletId ?? ''),
    amount,
    type: (raw.type as WalletTransactionType) || 'PAYMENT',
    status: raw.status || undefined,
    description: String(raw.description ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    referenceId: raw.referenceId !== undefined && raw.referenceId !== null ? String(raw.referenceId) : null,
    referenceType,
    balanceBefore,
    balanceAfter,
    currency: raw.currency || 'VND',
    direction,
  };
}

/**
 * Chuẩn hóa response danh sách phân trang giao dịch ví:
 * Hỗ trợ định dạng `items`, `content` hoặc bọc trong `data`.
 */
export function normalizeWalletTransactionPage(raw: any, page = 0, size = 10): WalletTransactionsPage {
  const data = raw?.data !== undefined && raw?.data !== null && typeof raw?.data === 'object' && !('items' in raw)
    ? raw.data
    : raw;

  let rawList: any[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (Array.isArray(data?.items)) {
    rawList = data.items;
  } else if (Array.isArray(data?.content)) {
    rawList = data.content;
  }

  const items = rawList.map(normalizeWalletTransaction);
  const totalElements = typeof data?.totalElements === 'number' ? data.totalElements : items.length;
  const currentSize = typeof data?.size === 'number' && data.size > 0 ? data.size : size;
  const totalPages =
    typeof data?.totalPages === 'number'
      ? data.totalPages
      : totalElements > 0
      ? Math.ceil(totalElements / currentSize)
      : 0;
  const currentPage = typeof data?.page === 'number' ? data.page : page;
  const isLast = typeof data?.isLast === 'boolean' ? data.isLast : currentPage + 1 >= totalPages;

  return {
    items,
    page: currentPage,
    size: currentSize,
    totalElements,
    totalPages,
    isLast,
  };
}
