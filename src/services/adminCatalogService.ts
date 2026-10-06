import { request } from './apiClient';

export interface AdminCategory {
  id: string;
  name: string;
  description?: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name: string;
  description?: string;
}

export interface AdminItem {
  id: string;
  name: string;
  category: AdminCategory;
}

export interface CreateItemRequest {
  name: string;
  categoryId: string;
}

export interface UpdateItemRequest {
  name: string;
  categoryId: string;
}

export interface AdminCategoryQuestionTemplate {
  id: string;
  categoryId: string;
  itemId?: string | null;
  templateText: string;
}

export interface CreateTemplateRequest {
  categoryId: string;
  itemId?: string | null;
  templateText: string;
}

export interface UpdateTemplateRequest {
  categoryId: string;
  itemId?: string | null;
  templateText: string;
}

// ============================================================================
// MOCK DATABASE FALLBACK (Khởi tạo sẵn dữ liệu theo đúng tài liệu Admin Catalog)
// ============================================================================

const STORAGE_KEYS = {
  CATEGORIES: 'mock_admin_catalog_categories_v1',
  ITEMS: 'mock_admin_catalog_items_v1',
  TEMPLATES: 'mock_admin_catalog_templates_v1',
};

const DEFAULT_CATEGORIES: AdminCategory[] = [
  {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    name: 'Đồ điện tử',
    description: 'Các sản phẩm điện tử, điện lạnh'
  },
  {
    id: '8bb4e112-98ab-4123-8cfb-11963f66af01',
    name: 'Đồ gia dụng',
    description: 'Bếp, xoong nồi, bát đĩa...'
  },
  {
    id: '9fa77c21-12de-4f32-9cb1-77883f66af88',
    name: 'Thiết bị nhà bếp',
    description: 'Nồi cơm cao tần, lò vi sóng, bếp từ đôi'
  }
];

const DEFAULT_ITEMS: AdminItem[] = [
  {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    name: 'Máy giặt',
    category: {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      name: 'Đồ điện tử',
      description: 'Các sản phẩm điện tử, điện lạnh'
    }
  },
  {
    id: '7bb33d12-1111-4562-b3fc-2c963f66afa7',
    name: 'Tủ lạnh Inverter',
    category: {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      name: 'Đồ điện tử',
      description: 'Các sản phẩm điện tử, điện lạnh'
    }
  },
  {
    id: '8cc44e23-2222-4562-b3fc-2c963f66afa8',
    name: 'Nồi chiên không dầu',
    category: {
      id: '8bb4e112-98ab-4123-8cfb-11963f66af01',
      name: 'Đồ gia dụng',
      description: 'Bếp, xoong nồi, bát đĩa...'
    }
  },
  {
    id: '9dd55f34-3333-4562-b3fc-2c963f66afa9',
    name: 'Bếp từ đôi cảm ứng',
    category: {
      id: '9fa77c21-12de-4f32-9cb1-77883f66af88',
      name: 'Thiết bị nhà bếp',
      description: 'Nồi cơm cao tần, lò vi sóng, bếp từ đôi'
    }
  }
];

const DEFAULT_TEMPLATES: AdminCategoryQuestionTemplate[] = [
  {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    categoryId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    itemId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    templateText:
      'Dựa vào hình ảnh bạn đăng lên tôi thấy ngoại hình đẹp {AI_APPEARANCE_ESTIMATE}. Bạn đồng ý không?\nVui lòng cung cấp thêm thông tin:\n1. Hãng sản xuất\n2. Khối lượng giặt (kg)\n3. Kiểu máy cửa ngang hay cửa trên\n4. Tình trạng bảo hành chính hãng'
  },
  {
    id: '4fa85f64-5717-4562-b3fc-2c963f66afb7',
    categoryId: '8bb4e112-98ab-4123-8cfb-11963f66af01',
    itemId: null,
    templateText:
      'Sản phẩm thuộc nhóm đồ gia dụng. Vui lòng cung cấp thêm thông tin chi tiết:\n1. Tên model sản phẩm\n2. Thời gian đã qua sử dụng\n3. Tình trạng lớp chống dính/bề mặt\n4. Phụ kiện đi kèm còn đủ không'
  }
];

// Helper load / save mock
const loadMock = <T>(key: string, defaultVal: T): T => {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
};

const saveMock = <T>(key: string, val: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn('Lỗi lưu mock catalog localStorage:', err);
  }
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
};

// ============================================================================
// ADMIN CATALOG SERVICE (Gọi API Backend kèm Mock Fallback chuẩn tài liệu)
// ============================================================================

export const adminCatalogService = {
  // --------------------------------------------------------------------------
  // 1. CATEGORY (Danh mục)
  // --------------------------------------------------------------------------
  async getCategories(): Promise<AdminCategory[]> {
    try {
      const response = await request<AdminCategory[]>('/v1/admin/catalog/categories', {
        method: 'GET',
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (Array.isArray(data) && data.length > 0) {
        saveMock(STORAGE_KEYS.CATEGORIES, data);
        return data;
      }
      return loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    } catch (err) {
      console.warn('Backend /api/v1/admin/catalog/categories chưa sẵn sàng, dùng mock fallback:', err);
      return loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    }
  },

  async createCategory(payload: CreateCategoryRequest): Promise<AdminCategory> {
    try {
      const response = await request<AdminCategory>('/v1/admin/catalog/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        saveMock(STORAGE_KEYS.CATEGORIES, [data, ...list]);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const newCategory: AdminCategory = {
        id: generateUUID(),
        name: payload.name,
        description: payload.description || ''
      };
      const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      const updated = [newCategory, ...list];
      saveMock(STORAGE_KEYS.CATEGORIES, updated);
      return newCategory;
    }
  },

  async updateCategory(id: string, payload: UpdateCategoryRequest): Promise<AdminCategory> {
    try {
      const response = await request<AdminCategory>(`/v1/admin/catalog/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        const updated = list.map((c) => (c.id === id ? data : c));
        saveMock(STORAGE_KEYS.CATEGORIES, updated);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      const updatedCategory: AdminCategory = {
        id,
        name: payload.name,
        description: payload.description || ''
      };
      const updated = list.map((c) => (c.id === id ? updatedCategory : c));
      saveMock(STORAGE_KEYS.CATEGORIES, updated);
      return updatedCategory;
    }
  },

  async deleteCategory(id: string): Promise<string> {
    try {
      const response = await request<any>(`/v1/admin/catalog/categories/${id}`, {
        method: 'DELETE',
        requiresAuth: true
      });
      const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      saveMock(STORAGE_KEYS.CATEGORIES, list.filter((c) => c.id !== id));
      const resMsg = (response as any)?.message || response;
      return typeof resMsg === 'string' ? resMsg : 'Category deleted successfully';
    } catch {
      // Mock fallback
      const list = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      saveMock(STORAGE_KEYS.CATEGORIES, list.filter((c) => c.id !== id));
      return 'Category deleted successfully';
    }
  },

  // --------------------------------------------------------------------------
  // 2. ITEM (Sản phẩm con)
  // --------------------------------------------------------------------------
  async getItems(): Promise<AdminItem[]> {
    try {
      const response = await request<AdminItem[]>('/v1/admin/catalog/items', {
        method: 'GET',
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (Array.isArray(data) && data.length > 0) {
        saveMock(STORAGE_KEYS.ITEMS, data);
        return data;
      }
      return loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    } catch (err) {
      console.warn('Backend /api/v1/admin/catalog/items chưa sẵn sàng, dùng mock fallback:', err);
      return loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    }
  },

  async getItemsByCategory(categoryId: string): Promise<AdminItem[]> {
    try {
      const response = await request<AdminItem[]>(`/v1/admin/catalog/categories/${categoryId}/items`, {
        method: 'GET',
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (Array.isArray(data)) {
        return data;
      }
      const allItems = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      return allItems.filter((i) => i.category?.id === categoryId);
    } catch {
      const allItems = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      return allItems.filter((i) => i.category?.id === categoryId);
    }
  },

  async createItem(payload: CreateItemRequest): Promise<AdminItem> {
    try {
      const response = await request<AdminItem>('/v1/admin/catalog/items', {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
        saveMock(STORAGE_KEYS.ITEMS, [data, ...list]);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const categories = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      const category = categories.find((c) => c.id === payload.categoryId) || {
        id: payload.categoryId,
        name: 'Danh mục',
        description: ''
      };
      const newItem: AdminItem = {
        id: generateUUID(),
        name: payload.name,
        category
      };
      const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      saveMock(STORAGE_KEYS.ITEMS, [newItem, ...list]);
      return newItem;
    }
  },

  async updateItem(id: string, payload: UpdateItemRequest): Promise<AdminItem> {
    try {
      const response = await request<AdminItem>(`/v1/admin/catalog/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
        const updated = list.map((i) => (i.id === id ? data : i));
        saveMock(STORAGE_KEYS.ITEMS, updated);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const categories = loadMock<AdminCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      const category = categories.find((c) => c.id === payload.categoryId) || {
        id: payload.categoryId,
        name: 'Danh mục',
        description: ''
      };
      const updatedItem: AdminItem = {
        id,
        name: payload.name,
        category
      };
      const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      const updated = list.map((i) => (i.id === id ? updatedItem : i));
      saveMock(STORAGE_KEYS.ITEMS, updated);
      return updatedItem;
    }
  },

  async deleteItem(id: string): Promise<string> {
    try {
      const response = await request<any>(`/v1/admin/catalog/items/${id}`, {
        method: 'DELETE',
        requiresAuth: true
      });
      const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      saveMock(STORAGE_KEYS.ITEMS, list.filter((i) => i.id !== id));
      const resMsg = (response as any)?.message || response;
      return typeof resMsg === 'string' ? resMsg : 'Item deleted successfully';
    } catch {
      // Mock fallback
      const list = loadMock<AdminItem[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      saveMock(STORAGE_KEYS.ITEMS, list.filter((i) => i.id !== id));
      return 'Item deleted successfully';
    }
  },

  // --------------------------------------------------------------------------
  // 3. CATEGORY QUESTION TEMPLATE (Kịch bản AI)
  // --------------------------------------------------------------------------
  async getTemplates(): Promise<AdminCategoryQuestionTemplate[]> {
    try {
      const response = await request<AdminCategoryQuestionTemplate[]>('/v1/admin/catalog/templates', {
        method: 'GET',
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (Array.isArray(data) && data.length > 0) {
        saveMock(STORAGE_KEYS.TEMPLATES, data);
        return data;
      }
      return loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
    } catch (err) {
      console.warn('Backend /api/v1/admin/catalog/templates chưa sẵn sàng, dùng mock fallback:', err);
      return loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
    }
  },

  async createTemplate(payload: CreateTemplateRequest): Promise<AdminCategoryQuestionTemplate> {
    try {
      const response = await request<AdminCategoryQuestionTemplate>('/v1/admin/catalog/templates', {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
        saveMock(STORAGE_KEYS.TEMPLATES, [data, ...list]);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const newTemplate: AdminCategoryQuestionTemplate = {
        id: generateUUID(),
        categoryId: payload.categoryId,
        itemId: payload.itemId || null,
        templateText: payload.templateText
      };
      const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
      saveMock(STORAGE_KEYS.TEMPLATES, [newTemplate, ...list]);
      return newTemplate;
    }
  },

  async updateTemplate(id: string, payload: UpdateTemplateRequest): Promise<AdminCategoryQuestionTemplate> {
    try {
      const response = await request<AdminCategoryQuestionTemplate>(`/v1/admin/catalog/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        requiresAuth: true
      });
      const data: any = (response as any)?.data || response;
      if (data && data.id) {
        const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
        const updated = list.map((t) => (t.id === id ? data : t));
        saveMock(STORAGE_KEYS.TEMPLATES, updated);
        return data;
      }
      throw new Error('No response from backend');
    } catch {
      // Mock fallback
      const updatedTemplate: AdminCategoryQuestionTemplate = {
        id,
        categoryId: payload.categoryId,
        itemId: payload.itemId || null,
        templateText: payload.templateText
      };
      const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
      const updated = list.map((t) => (t.id === id ? updatedTemplate : t));
      saveMock(STORAGE_KEYS.TEMPLATES, updated);
      return updatedTemplate;
    }
  },

  async deleteTemplate(id: string): Promise<string> {
    try {
      const response = await request<any>(`/v1/admin/catalog/templates/${id}`, {
        method: 'DELETE',
        requiresAuth: true
      });
      const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
      saveMock(STORAGE_KEYS.TEMPLATES, list.filter((t) => t.id !== id));
      const resMsg = (response as any)?.message || response;
      return typeof resMsg === 'string' ? resMsg : 'Template deleted successfully';
    } catch {
      // Mock fallback
      const list = loadMock<AdminCategoryQuestionTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
      saveMock(STORAGE_KEYS.TEMPLATES, list.filter((t) => t.id !== id));
      return 'Template deleted successfully';
    }
  }
};
