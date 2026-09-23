import { getAccessToken } from './apiClient';

export interface CloudinaryUploadResponseDto {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  originalFilename: string;
}

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const mediaService = {
  /**
   * Upload single image file (JPG, PNG, WEBP) to Cloudinary
   * Swagger: POST /api/v1/media/upload
   */
  async uploadImage(file: File, folder?: string): Promise<CloudinaryUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const token = getAccessToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/media/upload${query}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData?.message || 'Tải ảnh lên thất bại');
    }
    return resData.data;
  },

  /**
   * Upload multiple image files at once to Cloudinary
   * Swagger: POST /api/v1/media/upload-multiple
   */
  async uploadMultipleImages(files: File[], folder?: string): Promise<CloudinaryUploadResponseDto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const token = getAccessToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/media/upload-multiple${query}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData?.message || 'Tải danh sách ảnh thất bại');
    }
    return resData.data;
  },
};
