import { request } from './apiClient';
import { CategoryBackend } from '../types';

export const categoryService = {
  /**
   * Lấy danh sách toàn bộ danh mục sản phẩm từ Backend
   */
  async getCategories(): Promise<CategoryBackend[]> {
    const response = await request<CategoryBackend[]>('/categories', {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },
};
