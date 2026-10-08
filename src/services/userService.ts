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
  province?: string;
  district?: string;
  ward?: string;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  province?: string;
  district?: string;
  ward?: string;
  streetAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const userService = {
  async getMyProfile(): Promise<UserProfileDto> {
    const res = await request<UserProfileDto>('/users/me', {
      method: 'GET',
      requiresAuth: true,
    });
    return res.data;
  },

  async updateMyProfile(data: UpdateProfileDto): Promise<UserProfileDto> {
    const res = await request<UserProfileDto>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
    return res.data;
  },

  async changeMyPassword(data: ChangePasswordDto): Promise<void> {
    await request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    });
  },
};
