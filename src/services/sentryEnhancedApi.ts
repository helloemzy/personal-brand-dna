import { sentryFetch } from '../utils/sentryApiInterceptor';
import { captureError, addBreadcrumb, measureAsyncOperation } from '../config/sentry';

/**
 * Base API configuration with Sentry error tracking
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://brandpillar-ai.vercel.app/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Enhanced fetch wrapper with Sentry tracking and error handling
 */
export class SentryEnhancedApi {
  private static async handleResponse<T>(response: Response, endpoint: string): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        // Use text if not JSON
        if (errorText) errorMessage = errorText;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    try {
      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      captureError(new Error(`Failed to parse response from ${endpoint}`), {
        level: 'error',
        tags: {
          api_endpoint: endpoint,
        },
      });
      
      return {
        success: false,
        error: 'Invalid response format',
      };
    }
  }

  /**
   * GET request with Sentry tracking
   */
  static async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    return measureAsyncOperation(
      async () => {
        try {
          const response = await sentryFetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            ...options,
          });
          
          return this.handleResponse<T>(response, endpoint);
        } catch (error) {
          captureError(error as Error, {
            level: 'error',
            tags: {
              api_endpoint: endpoint,
              api_method: 'GET',
            },
          });
          
          return {
            success: false,
            error: 'Network error occurred',
          };
        }
      },
      `API GET ${endpoint}`
    );
  }

  /**
   * POST request with Sentry tracking
   */
  static async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    return measureAsyncOperation(
      async () => {
        try {
          const response = await sentryFetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
            ...options,
          });
          
          return this.handleResponse<T>(response, endpoint);
        } catch (error) {
          captureError(error as Error, {
            level: 'error',
            tags: {
              api_endpoint: endpoint,
              api_method: 'POST',
            },
          });
          
          return {
            success: false,
            error: 'Network error occurred',
          };
        }
      },
      `API POST ${endpoint}`
    );
  }

  /**
   * PUT request with Sentry tracking
   */
  static async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    return measureAsyncOperation(
      async () => {
        try {
          const response = await sentryFetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
            ...options,
          });
          
          return this.handleResponse<T>(response, endpoint);
        } catch (error) {
          captureError(error as Error, {
            level: 'error',
            tags: {
              api_endpoint: endpoint,
              api_method: 'PUT',
            },
          });
          
          return {
            success: false,
            error: 'Network error occurred',
          };
        }
      },
      `API PUT ${endpoint}`
    );
  }

  /**
   * DELETE request with Sentry tracking
   */
  static async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    return measureAsyncOperation(
      async () => {
        try {
          const response = await sentryFetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            ...options,
          });
          
          return this.handleResponse<T>(response, endpoint);
        } catch (error) {
          captureError(error as Error, {
            level: 'error',
            tags: {
              api_endpoint: endpoint,
              api_method: 'DELETE',
            },
          });
          
          return {
            success: false,
            error: 'Network error occurred',
          };
        }
      },
      `API DELETE ${endpoint}`
    );
  }
}

/**
 * Workshop-specific API calls with enhanced error tracking
 */
export const workshopApi = {
  async saveWorkshopData(userId: string, data: any) {
    addBreadcrumb('Saving workshop data', {
      category: 'workshop',
      data: { userId, step: data.currentStep },
    });

    return SentryEnhancedApi.post('/workshop/save', {
      userId,
      workshopData: data,
    });
  },

  async getWorkshopData(userId: string) {
    addBreadcrumb('Fetching workshop data', {
      category: 'workshop',
      data: { userId },
    });

    return SentryEnhancedApi.get(`/workshop/${userId}`);
  },

  async completeWorkshop(userId: string, finalData: any) {
    addBreadcrumb('Completing workshop', {
      category: 'workshop',
      data: { userId },
    });

    return SentryEnhancedApi.post('/workshop/complete', {
      userId,
      workshopData: finalData,
    });
  },
};

/**
 * Content generation API calls with enhanced error tracking
 */
export const contentApi = {
  async generateContent(prompt: string, options?: any) {
    addBreadcrumb('Generating content', {
      category: 'content',
      data: { promptLength: prompt.length },
    });

    return SentryEnhancedApi.post('/content/generate', {
      prompt,
      ...options,
    });
  },

  async getContentHistory(userId: string, page: number = 1) {
    addBreadcrumb('Fetching content history', {
      category: 'content',
      data: { userId, page },
    });

    return SentryEnhancedApi.get(`/content/history/${userId}?page=${page}`);
  },
};