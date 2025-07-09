import * as Sentry from '@sentry/react';
import { captureError, addBreadcrumb } from '../config/sentry';

interface ApiError {
  status: number;
  statusText: string;
  url: string;
  method: string;
  responseData?: any;
}

/**
 * Enhanced fetch wrapper with Sentry error tracking
 */
export const sentryFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const method = options.method || 'GET';
  const startTime = Date.now();

  // Add breadcrumb for API call
  addBreadcrumb(`API ${method} ${url}`, {
    category: 'fetch',
    type: 'http',
    data: {
      url,
      method,
      headers: options.headers,
    },
  });

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    // Add breadcrumb for response
    addBreadcrumb(`API Response ${response.status}`, {
      category: 'fetch',
      type: 'http',
      data: {
        url,
        method,
        status_code: response.status,
        duration,
      },
    });

    // Track slow API calls
    if (duration > 3000) {
      Sentry.captureMessage(`Slow API call: ${method} ${url}`, {
        level: 'warning',
        tags: {
          api_endpoint: url,
          api_method: method,
          duration: duration.toString(),
        },
      });
    }

    // Handle API errors
    if (!response.ok) {
      const errorData: ApiError = {
        status: response.status,
        statusText: response.statusText,
        url,
        method,
      };

      // Try to get response body for more context
      try {
        const responseText = await response.text();
        try {
          errorData.responseData = JSON.parse(responseText);
        } catch {
          errorData.responseData = responseText;
        }
      } catch {
        // Ignore if we can't read the response
      }

      // Capture different types of errors with appropriate severity
      if (response.status >= 500) {
        captureError(new Error(`Server Error: ${method} ${url}`), {
          level: 'error',
          tags: {
            api_endpoint: url,
            api_method: method,
            http_status: response.status.toString(),
          },
          extra: errorData,
        });
      } else if (response.status === 404) {
        captureError(new Error(`Not Found: ${method} ${url}`), {
          level: 'warning',
          tags: {
            api_endpoint: url,
            api_method: method,
            http_status: '404',
          },
          extra: errorData,
        });
      } else if (response.status === 401 || response.status === 403) {
        // Don't capture auth errors as they're expected
        addBreadcrumb(`Auth Error: ${response.status}`, {
          category: 'auth',
          level: 'warning',
          data: errorData,
        });
      } else {
        captureError(new Error(`API Error: ${method} ${url}`), {
          level: 'warning',
          tags: {
            api_endpoint: url,
            api_method: method,
            http_status: response.status.toString(),
          },
          extra: errorData,
        });
      }
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Network errors
    captureError(error as Error, {
      level: 'error',
      tags: {
        api_endpoint: url,
        api_method: method,
        error_type: 'network',
      },
      extra: {
        duration,
        options,
      },
    });

    throw error;
  }
};

/**
 * Axios-style interceptor for existing API calls
 */
export const createApiInterceptor = (apiClient: any) => {
  // Request interceptor
  apiClient.interceptors.request.use(
    (config: any) => {
      addBreadcrumb(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        category: 'xhr',
        type: 'http',
        data: {
          url: config.url,
          method: config.method,
          params: config.params,
        },
      });
      return config;
    },
    (error: any) => {
      captureError(error, {
        level: 'error',
        tags: {
          error_type: 'request_interceptor',
        },
      });
      return Promise.reject(error);
    }
  );

  // Response interceptor
  apiClient.interceptors.response.use(
    (response: any) => {
      addBreadcrumb(`API Response: ${response.status}`, {
        category: 'xhr',
        type: 'http',
        data: {
          url: response.config.url,
          status_code: response.status,
        },
      });
      return response;
    },
    (error: any) => {
      if (error.response) {
        // Server responded with error
        const { status, config } = error.response;
        
        if (status >= 500) {
          captureError(error, {
            level: 'error',
            tags: {
              api_endpoint: config.url,
              api_method: config.method,
              http_status: status.toString(),
              error_type: 'server_error',
            },
          });
        } else if (status !== 401 && status !== 403) {
          // Don't capture auth errors
          captureError(error, {
            level: 'warning',
            tags: {
              api_endpoint: config.url,
              api_method: config.method,
              http_status: status.toString(),
              error_type: 'client_error',
            },
          });
        }
      } else if (error.request) {
        // Network error
        captureError(error, {
          level: 'error',
          tags: {
            error_type: 'network_error',
          },
        });
      }
      
      return Promise.reject(error);
    }
  );

  return apiClient;
};