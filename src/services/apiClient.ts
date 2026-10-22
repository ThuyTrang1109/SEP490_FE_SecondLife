export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
}

function isNoV1Path(path: string): boolean {
  return path.startsWith('/auth');
}

export function resolveApiUrl(endpoint: string): string {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const rawEnv = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_ORIGIN || 'http://localhost:8080';
  const origin = rawEnv.replace(/\/api(\/v1)?\/?$/, '').replace(/\/+$/, '');

  let path = endpoint.trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Already prefixed with /api/v1/
  if (path.startsWith('/api/v1/')) {
    const sub = path.substring(7);
    if (isNoV1Path(sub)) {
      return `${origin}/api${sub}`;
    }
    return `${origin}${path}`;
  }

  // Already prefixed with /api/
  if (path.startsWith('/api/')) {
    const sub = path.substring(4);
    if (!isNoV1Path(sub) && !sub.startsWith('/v1/')) {
      return `${origin}/api/v1${sub}`;
    }
    return `${origin}${path}`;
  }

  // Prefixed with /v1/
  if (path.startsWith('/v1/')) {
    const sub = path.substring(3);
    if (isNoV1Path(sub)) {
      return `${origin}/api${sub}`;
    }
    return `${origin}/api/v1${sub}`;
  }

  // Path aliases
  if (path === '/me') {
    return `${origin}/api/v1/users/me`;
  }
  if (path === '/me/change-password') {
    return `${origin}/api/auth/change-password`;
  }
  if (path.startsWith('/me/')) {
    return `${origin}/api/v1/users${path.substring(3)}`;
  }

  // Check if path belongs to a NO-V1 controller
  if (isNoV1Path(path)) {
    return `${origin}/api${path}`;
  }

  // Default to /api/v1/
  return `${origin}/api/v1${path}`;
}

export function parseJwtPayload(token: string | null): any {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = atob(base64);
    try {
      const jsonStr = decodeURIComponent(
        decoded
          .split('')
          .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonStr);
    } catch {
      return JSON.parse(decoded);
    }
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(token: string | null, bufferSeconds = 60): boolean {
  if (!token) return true;
  const decoded = parseJwtPayload(token);
  if (!decoded || typeof decoded.exp !== 'number') return false;
  return Date.now() >= (decoded.exp * 1000) - (bufferSeconds * 1000);
}

export function isTokenExpired(token: string | null): boolean {
  return isTokenExpiringSoon(token, 0);
}

export const BASE_URL = resolveApiUrl('/v1');

export const ACCESS_TOKEN_KEY = 'secondlife_access_token';
export const REFRESH_TOKEN_KEY = 'secondlife_refresh_token';
export const USER_INFO_KEY = 'secondlife_user_session';
export const LAST_ACTIVITY_KEY = 'secondlife_last_activity_time';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

let memoryLastActivity = Date.now();

export function resetActivityTimer(): void {
  const now = Date.now();
  memoryLastActivity = now;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {}
}

export function recordUserActivity(force = false): void {
  const now = Date.now();
  memoryLastActivity = now;
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    const lastStored = stored ? Number(stored) : 0;
    if (force || now - lastStored > 5000) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
  } catch {}
}

export function getLastActivityTime(): number {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed > 0) {
        if (parsed > memoryLastActivity) {
          memoryLastActivity = parsed;
        }
        return memoryLastActivity;
      }
    }
  } catch {}
  return memoryLastActivity;
}

export function isUserIdle(idleTimeoutMs = IDLE_TIMEOUT_MS): boolean {
  const lastTime = getLastActivityTime();
  if (!lastTime || lastTime <= 0) return false;
  return Date.now() - lastTime >= idleTimeoutMs;
}

export const getAccessToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
      return null;
    }
    return token;
  } catch {
    return null;
  }
};

export const getRefreshToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
      return null;
    }
    return token;
  } catch {
    return null;
  }
};

export const setAuthTokens = (accessToken?: string | null, refreshToken?: string | null) => {
  try {
    if (accessToken && accessToken !== 'undefined' && accessToken !== 'null' && accessToken.trim() !== '') {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken.trim());
      resetActivityTimer();
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null' && refreshToken.trim() !== '') {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.trim());
    } else if (refreshToken === null) {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch (err) {
    console.warn('Failed to save auth tokens to sessionStorage:', err);
  }
};

export const getStoredUser = (): any | null => {
  try {
    const raw = sessionStorage.getItem(USER_INFO_KEY);
    if (!raw || raw === 'undefined' || raw === 'null' || raw.trim() === '') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any) => {
  try {
    if (user && user !== 'undefined' && user !== 'null') {
      sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(USER_INFO_KEY);
    }
  } catch (err) {
    console.warn('Failed to save user session to sessionStorage:', err);
  }
};

export const clearAuthTokens = () => {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    resetActivityTimer();
    
    // Clear legacy or additional user cached items
    localStorage.removeItem('secondlife_user');
    localStorage.removeItem('secondlife_seller_profile_address');
    
    // Clear chat history cache to prevent wrong sender names for new logins
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chat_history_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear notification storage keys to prevent notification leaks between accounts
    localStorage.removeItem('secondlife_local_notifications');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('secondlife_local_notifications_') || key.startsWith('secondlife_notif_'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('Failed to clear tokens from storage:', err);
  }
};

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  _retry?: boolean;
}

// Shared promise for refreshing token to prevent concurrent duplicate calls
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const rToken = getRefreshToken();
  if (!rToken) return null;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(resolveApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: rToken }),
      });

      if (!response.ok) {
        // If BE returns 400 or 401, refresh token is truly expired/invalid/revoked
        if (response.status === 400 || response.status === 401) {
          clearAuthTokens();
        }
        return null;
      }

      const raw = await response.text();
      let resJson: any = null;
      try {
        if (raw && raw.trim() && raw !== 'undefined') {
          resJson = JSON.parse(raw);
        }
      } catch {
        resJson = null;
      }

      const newAccessToken = resJson?.data?.accessToken || resJson?.accessToken;
      const newRefreshToken = resJson?.data?.refreshToken || resJson?.refreshToken || rToken;

      if (newAccessToken) {
        setAuthTokens(newAccessToken, newRefreshToken);
        recordUserActivity();
        return newAccessToken;
      }

      clearAuthTokens();
      return null;
    } catch (err) {
      console.warn('Network error during refreshAccessToken:', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function translateApiError(msg: string | null | undefined): string {
  if (!msg) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
  const s = String(msg).trim();
  if (!s) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';

  // 1. Xác thực tài khoản & Phân quyền (Auth & Security)
  if (/bad credentials/i.test(s)) return 'Tên đăng nhập hoặc mật khẩu không chính xác.';
  if (/user not found|account not found|user with.*not found/i.test(s)) return 'Không tìm thấy tài khoản người dùng.';
  if (/user.*disabled|user.*locked|account.*locked|user.*inactive/i.test(s)) return 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.';
  if (/unauthorized/i.test(s)) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (/access denied|forbidden|not authorized/i.test(s)) return 'Bạn không có quyền thực hiện hành động này.';
  if (/jwt expired|token.*expired|expired token/i.test(s)) return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
  if (/invalid token|malformed token/i.test(s)) return 'Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.';
  if (/invalid otp|otp expired|expired otp/i.test(s)) return 'Mã xác thực OTP không chính xác hoặc đã hết hiệu lực.';
  if (/password.*incorrect|old password.*incorrect|current password.*incorrect/i.test(s)) return 'Mật khẩu hiện tại không chính xác.';
  if (/passwords? (do not|does not) match/i.test(s)) return 'Mật khẩu xác nhận không khớp.';
  if (/password must be at least/i.test(s)) return 'Mật khẩu phải có tối thiểu 6 ký tự.';
  if (/email already exists|email.*already in use/i.test(s)) return 'Địa chỉ Email này đã được đăng ký trong hệ thống.';
  if (/phone.*already exists|phone.*already in use/i.test(s)) return 'Số điện thoại này đã được sử dụng.';
  if (/cannot remove the last active admin role/i.test(s)) return 'Không thể xóa vai trò của Quản trị viên (ADMIN) cuối cùng.';

  // 2. eKYC & Xác thực người bán (Seller Verification)
  if (/shop information cannot be changed after seller verification has started/i.test(s)) return 'Thông tin cửa hàng không thể sửa đổi sau khi đã bắt đầu xác thực hồ sơ.';
  if (/shop email has already been verified/i.test(s)) return 'Email cửa hàng đã được xác minh trước đó.';
  if (/please wait before requesting another email verification code/i.test(s)) return 'Vui lòng đợi giây lát trước khi yêu cầu gửi lại mã xác minh mới.';
  if (/email verification code is missing or expired/i.test(s)) return 'Mã xác minh email không hợp lệ hoặc đã hết hạn.';
  if (/too many incorrect codes/i.test(s)) return 'Bạn đã nhập sai mã xác minh quá số lần cho phép. Vui lòng yêu cầu mã mới.';
  if (/email verification code is incorrect/i.test(s)) return 'Mã xác minh email không chính xác.';
  if (/verify the shop email before starting ekyc/i.test(s)) return 'Vui lòng xác minh email cửa hàng trước khi bắt đầu eKYC.';
  if (/document number must contain letters or digits/i.test(s)) return 'Số giấy tờ tùy thân chỉ được chứa chữ cái hoặc chữ số.';
  if (/verification not found/i.test(s)) return 'Không tìm thấy hồ sơ xác thực người bán.';
  if (/identity.*restricted/i.test(s)) return 'Danh tính người dùng đang bị hạn chế; không thể duyệt hồ sơ.';

  // 3. Đơn hàng, Vận chuyển, Ký quỹ Escrow & Lalamove
  if (/order not found/i.test(s)) return 'Không tìm thấy đơn hàng.';
  if (/order is already closed|order already closed/i.test(s)) return 'Đơn hàng này đã hoàn tất hoặc đã bị hủy trước đó.';
  if (/order already cancelled|order is already cancelled/i.test(s)) return 'Đơn hàng này đã bị hủy.';
  if (/cannot cancel order/i.test(s)) return 'Không thể hủy đơn hàng ở trạng thái hiện tại.';
  if (/only the seller can create an outbound shipment/i.test(s)) return 'Chỉ người bán mới có quyền tạo vận đơn gửi hàng.';
  if (/seller must confirm the order before creating an outbound shipment/i.test(s)) return 'Người bán cần xác nhận đơn hàng trước khi tạo mã vận chuyển.';
  if (/order has no paid shipping quote/i.test(s)) return 'Đơn hàng chưa có thông tin cước phí vận chuyển hợp lệ.';
  if (/order is not eligible for outbound shipping/i.test(s)) return 'Đơn hàng chưa đủ điều kiện để tạo đơn giao hàng.';
  if (/funds are already settled/i.test(s)) return 'Tiền ký quỹ của đơn hàng đã được quyết toán xong.';
  if (/settlement requires delivered goods and held escrow/i.test(s)) return 'Quyết toán tiền yêu cầu hàng đã giao thành công và tiền ký quỹ đang được giữ an toàn.';
  if (/order price differs from its immutable commission snapshot/i.test(s)) return 'Giá trị đơn hàng không khớp với mức phí ban đầu.';
  if (/inspection has not passed/i.test(s)) return 'Đơn hàng chưa có kết quả kiểm định đạt chuẩn.';
  if (/a staff\/admin return decision with reason is required/i.test(s)) return 'Cần có quyết định kèm lý do từ Nhân viên / Quản trị viên để tạo đơn hoàn trả.';
  if (/outbound delivery must be confirmed before creating a buyer return/i.test(s)) return 'Kiện hàng phải được xác nhận giao trước khi tạo yêu cầu hoàn trả.';
  if (/shipment leg must match the paid shipping quote/i.test(s)) return 'Chặng vận chuyển không khớp với báo giá cước đã thanh toán.';
  if (/staff\/admin creates shipments from the inspection center/i.test(s)) return 'Chỉ Nhân viên hoặc Quản trị viên mới được tạo vận đơn từ trung tâm kiểm định.';
  if (/invalid order shipment leg/i.test(s)) return 'Chặng vận chuyển đơn hàng không hợp lệ.';
  if (/shipment requires a positive product price in whole vnd/i.test(s)) return 'Giá trị sản phẩm khai báo vận chuyển phải là số nguyên dương hợp lệ.';
  if (/shipment not found/i.test(s)) return 'Không tìm thấy thông tin vận đơn.';
  if (/pickup coordinates are outside the valid geographical ranges/i.test(s)) return 'Tọa độ địa chỉ lấy hàng nằm ngoài phạm vi hỗ trợ.';
  if (/driver not found|no driver assigned/i.test(s)) return 'Chưa có tài xế nhận chuyến hoặc đang tìm tài xế Lalamove.';
  if (/driver cancelled/i.test(s)) return 'Tài xế đã hủy chuyến nhận hàng.';
  if (/delivery failed/i.test(s)) return 'Giao hàng không thành công.';
  if (/order tracking not available/i.test(s)) return 'Hiện chưa có thông tin hành trình vận chuyển.';

  // 4. Đăng tin, AI Định giá & Hình ảnh (Listings & Valuation)
  if (/post not found|listing not found/i.test(s)) return 'Không tìm thấy bài đăng hoặc thông tin sản phẩm.';
  if (/listing is not in draft status/i.test(s)) return 'Bài đăng không còn ở trạng thái nháp.';
  if (/listing already published|post already approved/i.test(s)) return 'Sản phẩm đã được đăng bán hoặc đã được duyệt.';
  if (/image file is too large/i.test(s)) return 'Kích thước tệp ảnh quá lớn (tối đa 10MB mỗi ảnh).';
  if (/image dimensions exceed/i.test(s)) return 'Độ phân giải hình ảnh vượt quá giới hạn hỗ trợ.';
  if (/image dimension, pixel and byte limits must be positive/i.test(s)) return 'Kích thước và thông số hình ảnh không hợp lệ.';
  if (/image similarity thresholds/i.test(s)) return 'Ngưỡng đối soát trùng lặp ảnh không hợp lệ.';
  if (/ai valuation returned an inconsistent price range/i.test(s)) return 'Dịch vụ AI phản hồi khoảng giá không nhất quán. Vui lòng thử lại.';
  if (/failed to generate description/i.test(s)) return 'Không thể tạo mô tả tự động bằng AI. Vui lòng thử lại.';
  if (/ai price provider/i.test(s)) return 'Dịch vụ định giá AI đang bận. Vui lòng thử lại sau.';

  // 5. Ví, Credit & Thanh toán (Wallet, Credits & Payments)
  if (/insufficient balance|insufficient fund|not enough money/i.test(s)) return 'Số dư tài khoản ví không đủ để thực hiện giao dịch.';
  if (/insufficient credits|out of credits|not enough credits/i.test(s)) return 'Bạn đã hết lượt sử dụng (credit). Vui lòng nạp thêm credit.';
  if (/credit package not found|package not found/i.test(s)) return 'Không tìm thấy gói credit yêu cầu.';
  if (/a positive credit amount is required/i.test(s)) return 'Số lượng credit phải là số dương hợp lệ.';
  if (/payment event id was reused with different details/i.test(s)) return 'Giao dịch thanh toán bị trùng lặp hoặc không hợp lệ.';
  if (/payment callback does not match intent/i.test(s)) return 'Thông tin thanh toán không khớp với giao dịch ban đầu.';
  if (/invalid normalized payment callback/i.test(s)) return 'Dữ liệu phản hồi thanh toán không hợp lệ.';
  if (/transfer contains multiple payment references/i.test(s)) return 'Nội dung chuyển khoản chứa nhiều mã giao dịch không hợp lệ.';
  if (/sepay transaction requires a positive id and a positive whole vnd amount/i.test(s)) return 'Giao dịch yêu cầu mã hợp lệ và số tiền VNĐ nguyên dương.';
  if (/you cannot view the finances of this order/i.test(s)) return 'Bạn không có quyền xem thông tin tài chính của đơn hàng này.';
  if (/only unsettled orders can capture a commission policy/i.test(s)) return 'Chỉ các đơn hàng chưa quyết toán mới có thể ghi nhận chính sách chiết khấu.';

  // 6. Hệ thống & Mạng (Network & Server)
  if (/failed to fetch|network error|networkerror|network request failed/i.test(s)) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.';
  if (/internal server error|500 internal server error/i.test(s)) return 'Máy chủ gặp sự cố xử lý. Vui lòng thử lại sau.';
  if (/request timeout|gateway timeout|504/i.test(s)) return 'Yêu cầu quá thời gian phản hồi (Timeout). Vui lòng thử lại.';
  if (/bad request|400 bad request/i.test(s)) return 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
  if (/cannot read properties of/i.test(s)) return 'Dữ liệu chưa hoàn tất tải. Vui lòng làm mới trang.';
  if (/invalid status/i.test(s)) return 'Trạng thái hiện tại không hợp lệ cho thao tác này.';
  if (/validation failed/i.test(s)) return 'Thông tin nhập vào chưa đúng định dạng hoặc còn thiếu trường bắt buộc.';
  if (/cannot be null|must not be null|must not be blank|must not be empty/i.test(s)) return 'Vui lòng điền đầy đủ các thông tin bắt buộc.';

  // Xử lý chuỗi thông báo chứa mã lỗi HTTP tiếng Anh: "Lỗi máy chủ (500): Internal Server Error"
  const httpMatch = s.match(/Lỗi máy chủ \((\d+)\): (.+)/i);
  if (httpMatch) {
    const code = httpMatch[1];
    const reason = httpMatch[2].toLowerCase();
    if (code === '404' || reason.includes('not found')) return 'Không tìm thấy dữ liệu yêu cầu trên máy chủ.';
    if (code === '403' || reason.includes('forbidden')) return 'Bạn không có quyền thực hiện thao tác này.';
    if (code === '401' || reason.includes('unauthorized')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (code === '400' || reason.includes('bad request')) return 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại.';
    if (code === '500' || reason.includes('internal server error')) return 'Máy chủ gặp sự cố xử lý nội bộ. Vui lòng thử lại sau.';
    if (code === '502' || code === '503' || code === '504') return 'Máy chủ phản hồi chậm hoặc đang bảo trì. Vui lòng thử lại.';
    return `Yêu cầu không thành công (Mã lỗi ${code}). Vui lòng thử lại sau.`;
  }

  return s;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { requiresAuth = true, _retry = false, headers: customHeaders, ...restOptions } = options;

  // Record user activity on any API interaction
  recordUserActivity();

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(customHeaders as Record<string, string>),
  };

  let token = getAccessToken();
  const rToken = getRefreshToken();

  // If endpoint requires auth and user is active, proactively renew token before calling BE
  if (requiresAuth && rToken && !_retry && !endpoint.includes('/auth/')) {
    const isExpiredOrSoon = !token || isTokenExpired(token) || isTokenExpiringSoon(token, 120);
    if (isExpiredOrSoon && !isUserIdle()) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
      }
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requiresAuth) {
    // Chỉ kích hoạt unauthorized_session nếu trước đó người dùng có phiên hoạt động và bị nhàn rỗi quá hạn
    // Tuyệt đối không dispatch khi người dùng chưa đăng nhập hoặc vừa đăng xuất thủ công
    if (rToken && isUserIdle()) {
      clearAuthTokens();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('unauthorized_session'));
      }
    }
    throw new Error('Chưa đăng nhập hoặc phiên làm việc đã kết thúc.');
  }

  const url = resolveApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    let resData: any = null;
    const rawText = await response.text();

    if (rawText && rawText.trim() && rawText !== 'undefined' && rawText !== 'null') {
      try {
        resData = JSON.parse(rawText);
      } catch {
        resData = {
          success: response.ok,
          message: rawText,
          data: null,
        };
      }
    } else {
      resData = {
        success: response.ok,
        message: response.ok ? 'OK' : `HTTP Error ${response.status}`,
        data: null,
      };
    }

    if (!response.ok) {
      // If 401 Unauthorized on an authenticated endpoint, try silent token refresh once if user is active
      if (response.status === 401 && !_retry && requiresAuth && !endpoint.includes('/auth/')) {
        if (!isUserIdle()) {
          const refreshedToken = await refreshAccessToken();
          if (refreshedToken) {
            return request<T>(endpoint, {
              ...options,
              _retry: true,
            });
          }
        }
      }

      // Only clear auth tokens and revoke session if 401 occurs on an authenticated route after retry
      // and user previously possessed active tokens
      if (response.status === 401 && requiresAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        console.log('[apiClient] Dispatched unauthorized_session due to 401 on endpoint:', endpoint);
        const hadTokens = Boolean(token || rToken);
        clearAuthTokens();
        if (hadTokens && typeof window !== 'undefined') {
          window.dispatchEvent(new Event('unauthorized_session'));
        }
      }

      const rawError =
        (Array.isArray(resData?.errors) && resData.errors.length > 0
          ? resData.errors.map((e: any) => e.defaultMessage || e.message || String(e)).join(', ')
          : null) ||
        resData?.message ||
        resData?.error ||
        (response.status === 403 ? 'Bạn không có quyền thực hiện hành động này.' : `Lỗi máy chủ (${response.status}): ${response.statusText || 'Yêu cầu không thành công'}`);

      throw new Error(translateApiError(rawError));
    }

    return resData as ApiResponse<T>;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Không thể kết nối đến Backend Server. Vui lòng kiểm tra lại backend (port 8080).');
    }
    throw error;
  }
}

