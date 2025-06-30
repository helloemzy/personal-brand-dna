import axios, { AxiosResponse } from 'axios';
import { User } from '../store/slices/authSlice';

// Create axios instance - for Vercel deployment
const API_BASE_URL = process.env['REACT_APP_API_URL'] || '';

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
  expiresIn?: string;
}

interface RegisterResponse {
  message: string;
  userId: string;
}

interface OTPResponse {
  message: string;
  verificationToken: string;
  otp?: string; // Only in development
}

// Auth API service with consolidated endpoints
export const authAPI = {
  // Demo login
  demoLogin: async (): Promise<AxiosResponse<LoginResponse>> => {
    return apiClient.post('/auth?action=demo-login');
  },

  // Authentication
  login: async (credentials: { 
    email: string; 
    password: string; 
  }): Promise<AxiosResponse<LoginResponse>> => {
    return apiClient.post('/auth?action=login', credentials);
  },

  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    industry?: string;
    role?: string;
    company?: string;
  }): Promise<AxiosResponse<RegisterResponse>> => {
    return apiClient.post('/auth?action=register', userData);
  },

  // OTP Authentication
  sendOTP: async (email: string): Promise<AxiosResponse<OTPResponse>> => {
    return apiClient.post('/auth?action=send-otp', { email });
  },

  verifyOTP: async (data: {
    otp: string;
    verificationToken: string;
  }): Promise<AxiosResponse<LoginResponse>> => {
    return apiClient.post('/auth?action=verify-otp', data);
  },

  // Email verification
  verifyEmail: async (token: string): Promise<AxiosResponse<any>> => {
    return apiClient.get(`/auth?action=verify-email&token=${token}`);
  },

  // Simplified methods for other services (will be implemented later)
  logout: async (): Promise<AxiosResponse<void>> => {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return Promise.resolve({ data: undefined } as AxiosResponse<void>);
  },

  refreshToken: async (refreshToken: string): Promise<AxiosResponse<any>> => {
    // This would be implemented in a full auth router
    return Promise.reject(new Error('Not implemented'));
  },

  getProfile: async (): Promise<AxiosResponse<any>> => {
    // This would be implemented in a user router
    return Promise.reject(new Error('Not implemented'));
  },

  updateProfile: async (_profileData: Partial<User>): Promise<AxiosResponse<any>> => {
    // This would be implemented in a user router
    return Promise.reject(new Error('Not implemented'));
  },

  forgotPassword: async (_email: string): Promise<AxiosResponse<void>> => {
    // This would be implemented in the auth router
    return Promise.reject(new Error('Not implemented'));
  },

  resetPassword: async (_resetData: {
    token: string;
    password: string;
  }): Promise<AxiosResponse<void>> => {
    // This would be implemented in the auth router
    return Promise.reject(new Error('Not implemented'));
  },

  changePassword: async (_passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<AxiosResponse<void>> => {
    // This would be implemented in a user router
    return Promise.reject(new Error('Not implemented'));
  },

  checkAuthStatus: async (): Promise<AxiosResponse<{ user: User }>> => {
    // This would be implemented in the auth router
    return Promise.reject(new Error('Not implemented'));
  },
};

// Error handler utility
export const handleAPIError = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  } else if (error.response?.data?.message) {
    return error.response.data.message;
  } else if (error.message) {
    return error.message;
  } else {
    return 'An unexpected error occurred';
  }
};

// Export axios instance for use in other services
export default apiClient;