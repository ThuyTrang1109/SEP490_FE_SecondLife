import { request } from './apiClient';
import { ItemBackend } from '../types';

export const itemService = {
  /**
   * Lấy danh sách toàn bộ vật phẩm từ Backend (GET /api/v1/items)
   */
  async getItems(categoryId?: string): Promise<ItemBackend[]> {
    const url = categoryId ? `/v1/items?categoryId=${categoryId}` : '/v1/items';
    const response = await request<ItemBackend[]>(url, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy danh sách vật phẩm theo ID danh mục từ Backend
   */
  async getItemsByCategory(categoryId: string): Promise<ItemBackend[]> {
    const response = await request<ItemBackend[]>(`/v1/items/category/${categoryId}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },
};
