import { request } from './apiClient';

export interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const userService = {
  async getMyProfile(): Promise<UserProfileDto> {
    const res = await request<UserProfileDto>('/me', {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async updateMyProfile(data: UpdateProfileDto): Promise<UserProfileDto> {
    const res = await request<UserProfileDto>('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  async changeMyPassword(data: ChangePasswordDto): Promise<void> {
    await request<void>('/me/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
  },
};
