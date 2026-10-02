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

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const ACCESS_TOKEN_KEY = 'secondlife_access_token';
export const REFRESH_TOKEN_KEY = 'secondlife_refresh_token';
export const USER_INFO_KEY = 'secondlife_user_session';

export const getAccessToken = (): string | null => {
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
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
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken.trim());
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null' && refreshToken.trim() !== '') {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.trim());
    } else if (refreshToken === null) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch (err) {
    console.warn('Failed to save auth tokens to localStorage:', err);
  }
};

export const getStoredUser = (): any | null => {
  try {
    const raw = localStorage.getItem(USER_INFO_KEY);
    if (!raw || raw === 'undefined' || raw === 'null' || raw.trim() === '') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any) => {
  try {
    if (user && user !== 'undefined' && user !== 'null') {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_INFO_KEY);
    }
  } catch (err) {
    console.warn('Failed to save user session to localStorage:', err);
  }
};

export const clearAuthTokens = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  } catch (err) {
    console.warn('Failed to clear tokens from localStorage:', err);
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
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth) {
    let token = getAccessToken();
    if (!token) {
      // If access token is missing, attempt to refresh if we have a refresh token
      const rToken = getRefreshToken();
      if (rToken && !_retry && !endpoint.includes('/auth/')) {
        token = await refreshAccessToken();
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      clearAuthTokens();
      throw new Error('Chưa đăng nhập hoặc phiên làm việc đã kết thúc.');
    }
  }

  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

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
      // If 401 or 403, try silent refresh once
      if ((response.status === 401 || response.status === 403) && !_retry && !endpoint.includes('/auth/')) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          return request<T>(endpoint, {
            ...options,
            _retry: true,
          });
        }
      }

      if (response.status === 401 || response.status === 403) {
        clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('unauthorized_session'));
        }
      }

      const errorMessage =
        resData?.message ||
        resData?.error ||
        `HTTP Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return resData as ApiResponse<T>;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Không thể kết nối đến Backend Server. Vui lòng kiểm tra lại backend (port 8080).');
    }
    throw error;
  }
}
