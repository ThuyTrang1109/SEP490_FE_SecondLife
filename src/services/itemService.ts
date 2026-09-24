import { request } from './apiClient';
import { ItemBackend } from '../types';

export const itemService = {
  /**
   * Lấy danh sách vật phẩm theo ID danh mục từ Backend
   */
  async getItemsByCategory(categoryId: string): Promise<ItemBackend[]> {
    const response = await request<ItemBackend[]>(`/items/category/${categoryId}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },
};
