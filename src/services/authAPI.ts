import axios, { AxiosResponse, AxiosError } from 'axios';
import { User } from '../store/slices/authSlice';

// API Error type
interface APIErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
}

export type APIError = AxiosError<APIErrorResponse>;

// Response types
interface SubscriptionResponse {
  id: string;
  tier: 'free' | 'starter' | 'professional' | 'executive';
  status: 'active' | 'inactive' | 'cancelled';
  currentPeriodEnd?: string;
  features: string[];
}

interface ActivityResponse {
  activities: Array<{
    id: string;
    type: string;
    timestamp: string;
    description: string;
    metadata?: Record<string, unknown>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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
    return apiClient.post('/auth?action=login', credentials);
  },

  demoLogin: async (): Promise<AxiosResponse<LoginResponse>> => {
    return apiClient.post('/auth?action=demo-login');
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
    return apiClient.post('/auth?action=register', userData);
  },

  logout: async (): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth?action=logout');
  },

  refreshToken: async (refreshToken: string): Promise<AxiosResponse<RefreshTokenResponse>> => {
    return apiClient.post('/auth?action=refresh', { refreshToken });
  },

  // Password management
  forgotPassword: async (email: string): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth?action=forgot-password', { email });
  },

  resetPassword: async (resetData: {
    token: string;
    password: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth?action=reset-password', resetData);
  },

  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.put('/auth?action=change-password', passwordData);
  },

  // Email verification
  verifyEmail: async (token: string): Promise<AxiosResponse<void>> => {
    return apiClient.post('/auth?action=verify-email', { token });
  },

  // Profile management
  getProfile: async (): Promise<AxiosResponse<ProfileResponse>> => {
    return apiClient.get('/auth?action=profile');
  },

  updateProfile: async (profileData: Partial<User>): Promise<AxiosResponse<{ user: User }>> => {
    return apiClient.put('/auth?action=update-profile', profileData);
  },

  updateEmail: async (emailData: {
    newEmail: string;
    password: string;
  }): Promise<AxiosResponse<void>> => {
    return apiClient.put('/auth?action=update-email', emailData);
  },

  deleteAccount: async (password: string): Promise<AxiosResponse<void>> => {
    return apiClient.delete('/auth?action=delete-account', { data: { password } });
  },

  // User stats and activity
  getSubscription: async (): Promise<AxiosResponse<SubscriptionResponse>> => {
    return apiClient.get<SubscriptionResponse>('/auth?action=subscription');
  },

  getActivity: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<AxiosResponse<ActivityResponse>> => {
    const queryParams = new URLSearchParams({ action: 'activity' });
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    return apiClient.get<ActivityResponse>(`/auth?${queryParams.toString()}`);
  },

  // Auth status
  checkAuthStatus: async (): Promise<AxiosResponse<{ user: User }>> => {
    return apiClient.get('/auth?action=me');
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
    return apiClient.get('/auth?action=status');
  },

  // Phone authentication
  sendPhoneOTP: async (phoneNumber: string): Promise<{
    success: boolean;
    message?: string;
    verificationToken?: string;
    expiresAt?: string;
    otpCode?: string; // Only in development
  }> => {
    try {
      const response = await apiClient.post('/phone-auth/send-otp', { phoneNumber });
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      return {
        success: false,
        message: handleAPIError(error)
      };
    }
  },

  verifyPhoneOTP: async (
    phoneNumber: string,
    otpCode: string,
    verificationToken: string,
    userData?: {
      name: string;
      occupation: string;
      country: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    token?: string;
    refreshToken?: string;
    user?: User;
  }> => {
    try {
      const response = await apiClient.post('/phone-auth/verify-otp', {
        phoneNumber,
        otpCode,
        verificationToken,
        userData
      });
      return {
        success: true,
        token: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: response.data.user
      };
    } catch (error) {
      return {
        success: false,
        message: handleAPIError(error)
      };
    }
  },

  // Voice discovery
  initiateVoiceCall: async (phoneNumber: string): Promise<{
    success: boolean;
    message?: string;
    callId?: string;
  }> => {
    try {
      const response = await apiClient.post('/voice-discovery/initiate-call', { phoneNumber });
      return {
        success: true,
        callId: response.data.callId,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: handleAPIError(error)
      };
    }
  },

  checkCallStatus: async (callId: string): Promise<{
    callStatus: string;
    duration?: number;
    transcriptReady?: boolean;
  }> => {
    const response = await apiClient.get(`/voice-discovery/call-status/${callId}`);
    return response.data;
  },
};

export default authAPI;

// Error handler utility
export const handleAPIError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as APIError;
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    } else if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    } else if (axiosError.message) {
      return axiosError.message;
    }
  } else if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Export axios instance for use in other services
export { apiClient };