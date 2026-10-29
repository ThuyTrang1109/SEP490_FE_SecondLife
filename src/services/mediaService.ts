import { getAccessToken, clearAuthTokens, resolveApiUrl, refreshAccessToken, isUserIdle, isTokenExpired, notifySessionExpired } from './apiClient';

export interface CloudinaryUploadResponseDto {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  originalFilename: string;
}

/** Build Authorization header, refreshing token if needed */
async function getAuthHeaders(): Promise<Record<string, string>> {
  let token = getAccessToken();
  if (!token || isTokenExpired(token)) {
    if (!isUserIdle()) {
      token = await refreshAccessToken();
    }
  }
  if (!token) {
    notifySessionExpired('MEDIA_TOKEN_MISSING_OR_EXPIRED');
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
    const url = resolveApiUrl(`/v1/media/upload${query}`);

    const doUpload = async (headers: Record<string, string>) => {
      return fetch(url, { method: 'POST', headers, body: formData });
    };

    try {
      let headers = await getAuthHeaders();
      let response = await doUpload(headers);

      // Auto-retry once on 401 with refreshed token
      if (response.status === 401 || response.status === 403) {
        let newToken: string | null = null;
        if (!isUserIdle()) {
          newToken = await refreshAccessToken();
        }
        if (newToken) {
          headers = { Authorization: `Bearer ${newToken}` };
          response = await doUpload(headers);
        } else {
          notifySessionExpired('MEDIA_UPLOAD_UNAUTHORIZED');
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
    const url = resolveApiUrl(`/v1/media/upload-multiple${query}`);

    const doUpload = async (headers: Record<string, string>) => {
      return fetch(url, { method: 'POST', headers, body: formData });
    };

    try {
      let headers = await getAuthHeaders();
      let response = await doUpload(headers);

      // Auto-retry once on 401 with refreshed token
      if (response.status === 401 || response.status === 403) {
        let newToken: string | null = null;
        if (!isUserIdle()) {
          newToken = await refreshAccessToken();
        }
        if (newToken) {
          headers = { Authorization: `Bearer ${newToken}` };
          response = await doUpload(headers);
        } else {
          notifySessionExpired('MEDIA_MULTI_UPLOAD_UNAUTHORIZED');
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

  /**
   * Upload single video file (MP4, MOV, WEBM <= 100MB) to Cloudinary
   * Swagger: POST /api/v1/media/upload-video
   */
  async uploadVideo(file: File, folder?: string): Promise<CloudinaryUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const url = resolveApiUrl(`/v1/media/upload-video${query}`);

    const doUpload = async (headers: Record<string, string>) => {
      return fetch(url, { method: 'POST', headers, body: formData });
    };

    try {
      let headers = await getAuthHeaders();
      let response = await doUpload(headers);

      if (response.status === 401 || response.status === 403) {
        let newToken: string | null = null;
        if (!isUserIdle()) {
          newToken = await refreshAccessToken();
        }
        if (newToken) {
          headers = { Authorization: `Bearer ${newToken}` };
          response = await doUpload(headers);
        } else {
          notifySessionExpired('MEDIA_VIDEO_UPLOAD_UNAUTHORIZED');
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }

      if (!response.ok) {
        let errMsg = `Tải video thất bại (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      return resData?.data ?? resData;
    } catch (err: any) {
      console.error('Backend video upload error:', err);
      throw new Error(err.message || 'Không thể tải video lên máy chủ. Vui lòng kiểm tra kết nối mạng và kích thước file <= 100MB.');
    }
  },
};

