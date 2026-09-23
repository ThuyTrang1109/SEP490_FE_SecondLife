import { request, setAuthTokens, clearAuthTokens, getRefreshToken, ApiResponse } from './apiClient';

export interface UserSummaryDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  accountStatus?: string;
  emailVerified?: boolean;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInMs: number;
  user: UserSummaryDto;
  roles: string[];
  permissions: string[];
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInMs: number;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface VerifyEmailRequestDto {
  email: string;
  otp?: string;
  code?: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  email: string;
  otp?: string;
  code?: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface GoogleLoginRequestDto {
  idToken: string;
}

export const authService = {
  async register(data: RegisterRequestDto): Promise<AuthResponseDto> {
    const res = await request<AuthResponseDto>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: false,
    });
    if (res.data?.accessToken) {
      setAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  },

  async login(data: LoginRequestDto): Promise<AuthResponseDto> {
    const res = await request<AuthResponseDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: false,
    });
    if (res.data?.accessToken) {
      setAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  },

  async refreshToken(): Promise<TokenResponseDto> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');
    const res = await request<TokenResponseDto>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      requiresAuth: false,
    });
    if (res.data?.accessToken) {
      setAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await request<void>('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
          requiresAuth: true,
        });
      } catch (e) {
        // Suppress errors during logout
      }
    }
    clearAuthTokens();
  },

  async verifyEmail(data: VerifyEmailRequestDto): Promise<void> {
    const payload = {
      email: data.email,
      otp: data.otp || data.code || '',
    };
    await request<void>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async resendVerification(email: string): Promise<void> {
    await request<void>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
      requiresAuth: false,
    });
  },

  async forgotPassword(email: string): Promise<void> {
    await request<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      requiresAuth: false,
    });
  },

  async resetPassword(data: ResetPasswordRequestDto): Promise<void> {
    const payload = {
      email: data.email,
      otp: data.otp || data.code || '',
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword || data.newPassword,
    };
    await request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async googleLogin(idToken: string): Promise<AuthResponseDto> {
    const res = await request<AuthResponseDto>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
      requiresAuth: false,
    });
    if (res.data?.accessToken) {
      setAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  },
};
