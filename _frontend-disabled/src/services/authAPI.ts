import axios, { AxiosResponse } from 'axios';
import { User } from '../store/slices/authSlice';

// Create axios instance
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await authAPI.refreshToken(refreshToken);
          const { accessToken } = response.data;
          
          localStorage.setItem('token', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// API response types
interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RegisterResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
}

interface ProfileResponse {
  user: User;
  stats: {
    voiceProfiles: number;
    totalContent: number;
    contentThisMonth: number;
    contentUsed: number;
  };
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Auth API service
export const authAPI = {
  // Authentication
  login: async (credentials: { 
    email: string; 
    password: string; 
  }): Promise<AxiosResponse<LoginResponse>> => {
    return apiClient.post('/auth/login', credentials);
  },

  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    industry?: string;
    role?: string;
    company?: string;
    linkedinUrl?: string;
  }): Promise<AxiosResponse<RegisterResponse>> => {
    return apiClient.post('/auth/register', userData);
  },

  logout: async (): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string): Promise<AxiosResponse<RefreshTokenResponse>> => {
    return apiClient.post('/auth/refresh', { refreshToken });
  },

  // Password management
  forgotPassword: async (email: string): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth/forgot-password', { email });
  },

  resetPassword: async (resetData: {
    token: string;
    password: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth/reset-password', resetData);
  },

  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.put('/users/password', passwordData);
  },

  // Email verification
  verifyEmail: async (token: string): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth/verify-email', { token });
  },

  // Profile management
  getProfile: async (): Promise<AxiosResponse<ProfileResponse>> => {
    return apiClient.get('/users/profile');
  },

  updateProfile: async (profileData: Partial<User>): Promise<AxiosResponse<{ user: User }>> => {
    return apiClient.put('/users/profile', profileData);
  },

  updateEmail: async (emailData: {
    newEmail: string;
    password: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.put('/users/email', emailData);
  },

  deleteAccount: async (password: string): Promise<AxiosResponse<void>> => {
    return apiClient.delete('/users/account', { data: { password } });
  },

  // User stats and activity
  getSubscription: async (): Promise<AxiosResponse<any>> => {
    return apiClient.get('/users/subscription');
  },

  getActivity: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<AxiosResponse<any>> => {
    return apiClient.get('/users/activity', { params });
  },

  // Auth status
  checkAuthStatus: async (): Promise<AxiosResponse<{ user: User }>> => {
    return apiClient.get('/auth/me');
  },

  getAuthStatus: async (): Promise<AxiosResponse<{
    authenticated: boolean;
    user: {
      id: string;
      email: string;
      subscriptionTier: string;
      isVerified: boolean;
    };
  }>> => {
    return apiClient.get('/auth/status');
  },
};

// Error handler utility
export const handleAPIError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  } else if (error.message) {
    return error.message;
  } else {
    return 'An unexpected error occurred';
  }
};

// Export axios instance for use in other services
export default apiClient;