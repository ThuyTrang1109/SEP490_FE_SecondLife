import { request, PageResponse } from './apiClient';

export interface PermissionResponseDto {
  code: string;
  name: string;
  description?: string;
  assignableRoles: string[];
  systemPermission: boolean;
}

export interface CreatePermissionRequestDto {
  code: string;
  name: string;
  description?: string;
  assignableRoles: string[];
}

export interface UpdatePermissionRequestDto {
  name: string;
  description?: string;
  assignableRoles?: string[];
}

export interface RolePermissionsResponseDto {
  code: string;
  name: string;
  description?: string;
  editable: boolean;
  permissionCodes: string[];
}

export interface ReplaceRolePermissionsRequestDto {
  expectedPermissionCodes: string[];
  permissionCodes: string[];
}

export interface RolePermissionAuditResponseDto {
  id: string;
  permissionCode: string;
  action: 'GRANT' | 'REVOKE' | string;
  changedBy: string;
  changedAt: string;
}

export const adminRbacService = {
  /**
   * Lấy toàn bộ danh mục Permission và các Role được phép gán
   */
  async getPermissions(): Promise<PermissionResponseDto[]> {
    const res = await request<PermissionResponseDto[]>('/admin/permissions', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem chi tiết 1 Permission theo mã code
   */
  async getPermission(permissionCode: string): Promise<PermissionResponseDto> {
    const res = await request<PermissionResponseDto>(`/admin/permissions/${permissionCode}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Khởi tạo permission đã có trong backend catalog nếu thiếu trong DB
   */
  async createPermission(data: CreatePermissionRequestDto): Promise<PermissionResponseDto> {
    const res = await request<PermissionResponseDto>('/admin/permissions', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật thông tin và danh sách Role cho phép của Permission
   */
  async updatePermission(
    permissionCode: string,
    data: UpdatePermissionRequestDto
  ): Promise<PermissionResponseDto> {
    const res = await request<PermissionResponseDto>(`/admin/permissions/${permissionCode}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xóa một Custom Permission (chưa gán vào Role nào)
   */
  async deletePermission(permissionCode: string): Promise<void> {
    await request<void>(`/admin/permissions/${permissionCode}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  /**
   * Lấy danh sách toàn bộ Role kèm các Permission hiện hành (Role-Permission Matrix)
   */
  async getRoles(): Promise<RolePermissionsResponseDto[]> {
    const res = await request<RolePermissionsResponseDto[]>('/admin/roles', {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem chi tiết 1 Role và danh sách Permission của Role đó
   */
  async getRole(roleCode: string): Promise<RolePermissionsResponseDto> {
    const res = await request<RolePermissionsResponseDto>(`/admin/roles/${roleCode}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Cập nhật / thay thế ma trận quyền của một Role bằng snapshot expectedPermissionCodes
   */
  async replaceRolePermissions(
    roleCode: string,
    data: ReplaceRolePermissionsRequestDto
  ): Promise<RolePermissionsResponseDto> {
    const res = await request<RolePermissionsResponseDto>(`/admin/roles/${roleCode}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return (res as any)?.data || res;
  },

  /**
   * Xem nhật ký kiểm toán (Audit Trail) thay đổi quyền của một Role
   */
  async getRolePermissionAudit(
    roleCode: string,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<RolePermissionAuditResponseDto>> {
    const res = await request<PageResponse<RolePermissionAuditResponseDto>>(
      `/admin/roles/${roleCode}/permission-changes?page=${page}&size=${size}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    return res.data;
  },
};
