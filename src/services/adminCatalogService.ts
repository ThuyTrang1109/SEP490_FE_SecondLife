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
  async getAllCategories(): Promise<AdminCategory[]> {
    const response = await request<AdminCategory[]>('/v1/admin/catalog/categories', {
      method: 'GET',
      requiresAuth: true
    });
    return (response as any)?.data || response || [];
  },

  async createCategory(payload: CreateCategoryRequest): Promise<AdminCategory> {
    const response = await request<AdminCategory>('/v1/admin/catalog/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async updateCategory(id: string, payload: UpdateCategoryRequest): Promise<AdminCategory> {
    const response = await request<AdminCategory>(`/v1/admin/catalog/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async deleteCategory(id: string): Promise<string> {
    const response = await request<any>(`/v1/admin/catalog/categories/${id}`, {
      method: 'DELETE',
      requiresAuth: true
    });
    const resMsg = (response as any)?.message || response;
    return typeof resMsg === 'string' ? resMsg : 'Category deleted successfully';
  },

  // --------------------------------------------------------------------------
  // 2. ITEM (Sản phẩm con)
  // --------------------------------------------------------------------------
  async getAllItems(): Promise<AdminItem[]> {
    const response = await request<AdminItem[]>('/v1/admin/catalog/items', {
      method: 'GET',
      requiresAuth: true
    });
    return (response as any)?.data || response || [];
  },

  async getItemsByCategory(categoryId: string): Promise<AdminItem[]> {
    const response = await request<AdminItem[]>(`/v1/admin/catalog/categories/${categoryId}/items`, {
      method: 'GET',
      requiresAuth: true
    });
    return (response as any)?.data || response || [];
  },

  async createItem(payload: CreateItemRequest): Promise<AdminItem> {
    const response = await request<AdminItem>('/v1/admin/catalog/items', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async updateItem(id: string, payload: UpdateItemRequest): Promise<AdminItem> {
    const response = await request<AdminItem>(`/v1/admin/catalog/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async deleteItem(id: string): Promise<string> {
    const response = await request<any>(`/v1/admin/catalog/items/${id}`, {
      method: 'DELETE',
      requiresAuth: true
    });
    const resMsg = (response as any)?.message || response;
    return typeof resMsg === 'string' ? resMsg : 'Item deleted successfully';
  },

  // --------------------------------------------------------------------------
  // 3. CATEGORY QUESTION TEMPLATE (Kịch bản AI)
  // --------------------------------------------------------------------------
  async getAllTemplates(): Promise<AdminCategoryQuestionTemplate[]> {
    const response = await request<AdminCategoryQuestionTemplate[]>('/v1/admin/catalog/templates', {
      method: 'GET',
      requiresAuth: true
    });
    return (response as any)?.data || response || [];
  },

  async createTemplate(payload: CreateTemplateRequest): Promise<AdminCategoryQuestionTemplate> {
    const response = await request<AdminCategoryQuestionTemplate>('/v1/admin/catalog/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async updateTemplate(id: string, payload: UpdateTemplateRequest): Promise<AdminCategoryQuestionTemplate> {
    const response = await request<AdminCategoryQuestionTemplate>(`/v1/admin/catalog/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return (response as any)?.data || response;
  },

  async deleteTemplate(id: string): Promise<string> {
    const response = await request<any>(`/v1/admin/catalog/templates/${id}`, {
      method: 'DELETE',
      requiresAuth: true
    });
    const resMsg = (response as any)?.message || response;
    return typeof resMsg === 'string' ? resMsg : 'Template deleted successfully';
  }
};
