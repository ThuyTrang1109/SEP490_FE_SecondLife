import { request } from './apiClient';

export interface VideoSignatureResponse {
  uploadId: string;
  publicId: string;
  signature: string;
  parameters: Record<string, string>;
  uploadUrl: string;
  expiresAt: string;
  maxBytes: number;
  chunkSizeBytes: number;
}

export interface VideoCompleteRequest {
  uploadId: string;
  publicId: string;
  videoUrl?: string;
  bytes?: number;
  format?: string;
  durationSeconds?: number;
}

export interface VideoMetadataResponse {
  evidenceId: string;
  evidenceUrl: string;
  contentType: string;
  size: number;
  mediaType: 'VIDEO';
}

export interface VideoPlaybackResponse {
  url: string;
  expiresAt: string;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const videoService = {
  /**
   * Xin chữ ký upload video phân đoạn trực tiếp lên Cloudinary
   * POST /api/video/upload-signature
   * Quyền: MEDIA_UPLOAD_SELF
   */
  async getUploadSignature(requestId?: string): Promise<VideoSignatureResponse> {
    const res = await request<VideoSignatureResponse>('/video/upload-signature', {
      method: 'POST',
      body: JSON.stringify({
        requestId: requestId || generateUuid(),
      }),
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as VideoSignatureResponse;
  },

  /**
   * Hoàn tất xác thực video với Cloudinary và ghi nhận evidence riêng tư
   * POST /api/video/complete
   * Quyền: MEDIA_UPLOAD_SELF
   */
  async completeUpload(payload: VideoCompleteRequest): Promise<VideoMetadataResponse> {
    const res = await request<VideoMetadataResponse>('/video/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as VideoMetadataResponse;
  },

  /**
   * Xin URL phát video tạm thời (có chữ ký, có hạn dùng)
   * GET /api/video/{uploadId}/playback
   * Quyền: người upload hoặc STAFF (STAFF_FRAUD_REVIEW) / ADMIN
   */
  async getPlaybackUrl(uploadId: string): Promise<VideoPlaybackResponse> {
    const res = await request<VideoPlaybackResponse>(`/video/${uploadId}/playback`, {
      method: 'GET',
      requiresAuth: true,
    });
    return ((res as any)?.data ?? res) as VideoPlaybackResponse;
  },

  /**
   * Helper tải lên video phân đoạn (chunked) trực tiếp lên Cloudinary và complete tại BE
   */
  async uploadVideoChunked(
    file: File,
    onProgress?: (progressPercent: number) => void,
    signal?: AbortSignal
  ): Promise<VideoMetadataResponse> {
    const sig = await videoService.getUploadSignature();
    if (file.size > sig.maxBytes) {
      throw new Error(`Kích thước video (${Math.round(file.size / (1024 * 1024))}MB) vượt quá giới hạn cho phép (${Math.round(sig.maxBytes / (1024 * 1024))}MB).`);
    }

    const chunkSize = sig.chunkSizeBytes || 5 * 1024 * 1024;
    const totalBytes = file.size;
    let offset = 0;
    const uniqueUploadId = `uq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    while (offset < totalBytes) {
      if (signal?.aborted) {
        throw new Error('Đã hủy tải video.');
      }
      const end = Math.min(offset + chunkSize, totalBytes);
      const chunk = file.slice(offset, end);

      const formData = new FormData();
      Object.entries(sig.parameters || {}).forEach(([k, v]) => {
        formData.append(k, String(v));
      });
      formData.append('file', chunk);

      const contentRange = `bytes ${offset}-${end - 1}/${totalBytes}`;
      const uploadHeaders: Record<string, string> = {
        'X-Unique-Upload-Id': uniqueUploadId,
        'Content-Range': contentRange,
      };

      const uploadRes = await fetch(sig.uploadUrl, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
        signal,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload video chunk thất bại: HTTP ${uploadRes.status}`);
      }

      offset = end;
      if (onProgress) {
        const pct = Math.round((offset / totalBytes) * 100);
        onProgress(pct);
      }
    }

    // Complete upload at BE
    return await videoService.completeUpload({
      uploadId: sig.uploadId,
      publicId: sig.publicId,
      bytes: file.size,
    });
  },
};
