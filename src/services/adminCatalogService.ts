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

export type TemplateProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminTemplateProposal {
  id: string;
  categoryId: string;
  categoryName: string;
  itemId?: string | null;
  itemName?: string | null;
  templateText: string;
  status: TemplateProposalStatus;
  triggeredBy?: string | null;
  requestCount: number;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTemplateProposalRequest {
  templateText: string;
}

export interface ApproveTemplateProposalRequest {
  templateText: string;
}

export interface RejectTemplateProposalRequest {
  reason?: string | null;
}

// ============================================================================
// ADMIN CATALOG SERVICE
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
  // 3. CATEGORY QUESTION TEMPLATE (Kịch bản AI chính thức trong DB)
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
  },

  // --------------------------------------------------------------------------
  // 4. AI QUESTION TEMPLATE PROPOSALS (Đề xuất AI tạm chờ Admin duyệt)
  // --------------------------------------------------------------------------
  async getTemplateProposals(status?: TemplateProposalStatus): Promise<AdminTemplateProposal[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await request<AdminTemplateProposal[]>(
      `/v1/admin/catalog/template-proposals${query}`,
      {
        method: 'GET',
        requiresAuth: true
      }
    );
    return (response as any)?.data || response || [];
  },

  async updateTemplateProposal(
    id: string,
    payload: UpdateTemplateProposalRequest
  ): Promise<AdminTemplateProposal> {
    const response = await request<AdminTemplateProposal>(
      `/v1/admin/catalog/template-proposals/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        requiresAuth: true
      }
    );
    return (response as any)?.data || response;
  },

  async approveTemplateProposal(
    id: string,
    payload: ApproveTemplateProposalRequest
  ): Promise<AdminCategoryQuestionTemplate> {
    const response = await request<AdminCategoryQuestionTemplate>(
      `/v1/admin/catalog/template-proposals/${id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: true
      }
    );
    return (response as any)?.data || response;
  },

  async rejectTemplateProposal(
    id: string,
    payload?: RejectTemplateProposalRequest
  ): Promise<AdminTemplateProposal> {
    const response = await request<AdminTemplateProposal>(
      `/v1/admin/catalog/template-proposals/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
        requiresAuth: true
      }
    );
    return (response as any)?.data || response;
  }
};
