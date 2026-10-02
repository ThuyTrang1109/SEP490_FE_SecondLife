import { request } from './apiClient';
import { CategoryBackend } from '../types';

export const categoryService = {
  /**
   * Lấy danh sách toàn bộ danh mục sản phẩm từ Backend
   */
  async getCategories(): Promise<CategoryBackend[]> {
    const response = await request<CategoryBackend[]>('/v1/categories', {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },
};
