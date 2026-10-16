import { request } from './apiClient';
import { CategoryBackend } from '../types';

export interface CategoryPayload {
  name: string;
  description?: string;
}

export interface ItemPayload {
  categoryId: string;
  name: string;
  description?: string;
}

export const categoryService = {
  /**
   * Lấy danh sách toàn bộ danh mục sản phẩm từ Backend
   * GET /api/v1/categories
   */
  async getCategories(): Promise<CategoryBackend[]> {
    const response = await request<CategoryBackend[]>('/v1/categories', {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy chi tiết 1 danh mục theo ID
   * GET /api/v1/categories/{id}
   */
  async getCategory(id: string): Promise<CategoryBackend> {
    const response = await request<CategoryBackend>(`/v1/categories/${id}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Tạo mới danh mục sản phẩm (ADMIN)
   * POST /api/v1/categories
   */
  async createCategory(data: CategoryPayload): Promise<CategoryBackend> {
    const response = await request<CategoryBackend>('/v1/categories', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Cập nhật danh mục sản phẩm (ADMIN)
   * PUT /api/v1/categories/{id}
   */
  async updateCategory(id: string, data: CategoryPayload): Promise<CategoryBackend> {
    const response = await request<CategoryBackend>(`/v1/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Xóa danh mục sản phẩm (ADMIN)
   * DELETE /api/v1/categories/{id}
   */
  async deleteCategory(id: string): Promise<void> {
    await request<void>(`/v1/categories/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  /**
   * Lấy danh sách các dòng sản phẩm chi tiết theo danh mục
   * GET /api/v1/items?categoryId={categoryId}
   */
  async getItems(categoryId?: string): Promise<any[]> {
    const url = categoryId ? `/v1/items?categoryId=${categoryId}` : '/v1/items';
    const response = await request<any[]>(url, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy danh sách dòng sản phẩm theo Category ID
   * GET /api/v1/items/category/{categoryId}
   */
  async getItemsByCategory(categoryId: string): Promise<any[]> {
    const response = await request<any[]>(`/v1/items/category/${categoryId}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Lấy chi tiết một dòng sản phẩm theo ID
   * GET /api/v1/items/{id}
   */
  async getItem(id: string): Promise<any> {
    const response = await request<any>(`/v1/items/${id}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return (response as any)?.data || response;
  },

  /**
   * Tạo dòng sản phẩm mới (ADMIN)
   * POST /api/v1/items
   */
  async createItem(data: ItemPayload): Promise<any> {
    const response = await request<any>('/v1/items', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Cập nhật dòng sản phẩm (ADMIN)
   * PUT /api/v1/items/{id}
   */
  async updateItem(id: string, data: ItemPayload): Promise<any> {
    const response = await request<any>(`/v1/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (response as any)?.data || response;
  },

  /**
   * Xóa dòng sản phẩm (ADMIN)
   * DELETE /api/v1/items/{id}
   */
  async deleteItem(id: string): Promise<void> {
    await request<void>(`/v1/items/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};
