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
  if (
    path.startsWith('/auth') ||
    path.startsWith('/users') ||
    path.startsWith('/seller-verifications') ||
    path.startsWith('/seller') ||
    path.startsWith('/staff') ||
    path.startsWith('/payment-callbacks') ||
    path.startsWith('/health')
  ) {
    return true;
  }
  if (
    path.startsWith('/admin/users') || path.startsWith('/admin/posts')
    || path.startsWith('/admin/catalog')) {
    return false;
  }
  return true;
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
    return `${origin}/api/users/me`;
  }
  if (path === '/me/change-password') {
    return `${origin}/api/auth/change-password`;
  }
  if (path.startsWith('/me/')) {
    return `${origin}/api/users${path.substring(3)}`;
  }

  // Check if path belongs to a NO-V1 controller
  if (isNoV1Path(path)) {
    return `${origin}/api${path}`;
  }

  // Default to /api/v1/
  return `${origin}/api/v1${path}`;
}

export const BASE_URL = resolveApiUrl('/v1');

export const ACCESS_TOKEN_KEY = 'secondlife_access_token';
export const REFRESH_TOKEN_KEY = 'secondlife_refresh_token';
export const USER_INFO_KEY = 'secondlife_user_session';

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

async function refreshAccessToken(): Promise<string | null> {
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
        clearAuthTokens();
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
        return newAccessToken;
      }

      clearAuthTokens();
      return null;
    } catch {
      clearAuthTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { requiresAuth = true, _retry = false, headers: customHeaders, ...restOptions } = options;

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(customHeaders as Record<string, string>),
  };

  let token = getAccessToken();
  if (requiresAuth && !token) {
    // If access token is missing, attempt to refresh if we have a refresh token
    const rToken = getRefreshToken();
    if (rToken && !_retry && !endpoint.includes('/auth/')) {
      token = await refreshAccessToken();
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requiresAuth) {
    clearAuthTokens();
    throw new Error('ChÆ°a Ä‘Äƒng nháº­p hoáº·c phiÃªn lÃ m viá»‡c Ä‘Ã£ káº¿t thÃºc.');
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
      // If 401 Unauthorized on an authenticated endpoint, try silent token refresh once
      if (response.status === 401 && !_retry && requiresAuth && !endpoint.includes('/auth/')) {
        const refreshedToken = await refreshAccessToken();https://github.com/ThuyTrang1109/SEP490_FE_SecondLife/pull/2/conflict?name=src%252Fservices%252FapiClient.ts&ancestor_oid=d4b27e146409b1126a7b20af575dc1778aed0ad4&base_oid=936eec38ee15b5712cc954055f6df1ed7ad552b0&head_oid=9451ffbdf6130c549a6e63576dbc6f7034315ba8
        if (refreshedToken) {
          return request<T>(endpoint, {
            ...options,
            _retry: true,
          });
        }
      }

      // Only clear auth tokens and revoke session if 401 occurs on an authenticated route after retry
      if (response.status === 401 && requiresAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('unauthorized_session'));
        }
      }

      const errorMessage =
        resData?.message ||
        resData?.error ||

        (response.status === 403 ? 'B?n không có quy?n th?c hi?n hành d?ng này.' : `HTTP Error ${response.status}: ${response.statusText}`);

      throw new Error(errorMessage);
    }

    return resData as ApiResponse<T>;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {

      throw new Error('Không th? k?t n?i d?n Backend Server. Vui lòng ki?m tra l?i backend (port 8080).');

    }
    throw error;
  }
}
