import { getAccessToken, getRefreshToken, setAuthTokens, clearAuthTokens, resolveApiUrl } from './apiClient';

export interface CloudinaryUploadResponseDto {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  originalFilename: string;
}

/** Attempt to refresh access token once, returns new token or null */
async function tryRefreshToken(): Promise<string | null> {
  const rToken = getRefreshToken();
  if (!rToken) return null;
  try {
    const res = await fetch(resolveApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rToken }),
    });
    if (!res.ok) {
      clearAuthTokens();
      return null;
    }
    const json = await res.json();
    const newAccess = json?.data?.accessToken || json?.accessToken;
    const newRefresh = json?.data?.refreshToken || json?.refreshToken || rToken;
    if (newAccess) {
      setAuthTokens(newAccess, newRefresh);
      return newAccess;
    }
    clearAuthTokens();
    return null;
  } catch {
    clearAuthTokens();
    return null;
  }
}

/** Build Authorization header, refreshing token if needed */
async function getAuthHeaders(): Promise<Record<string, string>> {
  let token = getAccessToken();
  if (!token) {
    token = await tryRefreshToken();
  }
  if (!token) {
    clearAuthTokens();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('unauthorized_session'));
    }
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải ảnh lên.');
  }
  return { Authorization: `Bearer ${token}` };
}

export const mediaService = {
  /**
   * Upload single image file (JPG, PNG, WEBP) to Cloudinary
   * Swagger: POST /api/v1/media/upload
   */
  async uploadImage(file: File, folder?: string): Promise<CloudinaryUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const url = resolveApiUrl(`/media/upload${query}`);

    const doUpload = async (headers: Record<string, string>) => {
      return fetch(url, { method: 'POST', headers, body: formData });
    };

    try {
      let headers = await getAuthHeaders();
      let response = await doUpload(headers);

      // Auto-retry once on 401 with refreshed token
      if (response.status === 401 || response.status === 403) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          headers = { Authorization: `Bearer ${newToken}` };
          response = await doUpload(headers);
        } else {
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('unauthorized_session'));
          }
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }

      if (!response.ok) {
        let errMsg = `Tải ảnh thất bại (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      return resData?.data ?? resData;
    } catch (err: any) {
      console.error('Backend media upload error:', err);
      throw new Error(err.message || 'Không thể tải ảnh lên máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
    }
  },

  /**
   * Upload multiple image files at once to Cloudinary
   * Swagger: POST /api/v1/media/upload-multiple
   */
  async uploadMultipleImages(files: File[], folder?: string): Promise<CloudinaryUploadResponseDto[]> {
    if (!files || files.length === 0) return [];

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const url = resolveApiUrl(`/media/upload-multiple${query}`);

    const doUpload = async (headers: Record<string, string>) => {
      return fetch(url, { method: 'POST', headers, body: formData });
    };

    try {
      let headers = await getAuthHeaders();
      let response = await doUpload(headers);

      // Auto-retry once on 401 with refreshed token
      if (response.status === 401 || response.status === 403) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          headers = { Authorization: `Bearer ${newToken}` };
          response = await doUpload(headers);
        } else {
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('unauthorized_session'));
          }
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }

      if (!response.ok) {
        let errMsg = `Tải ảnh thất bại (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      return resData?.data ?? resData ?? [];
    } catch (err: any) {
      console.error('Backend multiple media upload error:', err);
      throw new Error(err.message || 'Không thể tải danh sách ảnh lên máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
    }
  },
};
