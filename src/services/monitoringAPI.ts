import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// Monitoring API response types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    ai: ServiceHealth;
    storage: ServiceHealth;
    email: ServiceHealth;
  };
  metrics: {
    cpu: number;
    memory: number;
    activeConnections: number;
    requestsPerMinute: number;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency: number;
  lastCheck: string;
  error?: string;
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  endpoint?: string;
  resolved: boolean;
}

export interface ErrorLogsResponse {
  errors: ErrorLog[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalErrors: number;
    unresolvedErrors: number;
    errorsByLevel: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
  };
}

export interface MetricsResponse {
  timeframe: string;
  metrics: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      averageResponseTime: number;
    };
    users: {
      active: number;
      new: number;
      retained: number;
    };
    content: {
      generated: number;
      published: number;
      averageQuality: number;
    };
    system: {
      uptime: number;
      errorRate: number;
      throughput: number;
    };
  };
  trends: {
    requests: number[];
    errors: number[];
    responseTime: number[];
  };
}

// Monitoring API service
export const monitoringAPI = {
  // Health check
  getHealthStatus: async (): Promise<AxiosResponse<HealthCheckResponse>> => {
    return apiClient.get('/monitoring?action=health');
  },

  // Error logs
  getErrorLogs: async (params?: {
    page?: number;
    limit?: number;
    level?: string;
    startDate?: string;
    endDate?: string;
    resolved?: boolean;
    userId?: string;
    endpoint?: string;
  }): Promise<AxiosResponse<ErrorLogsResponse>> => {
    const queryParams = new URLSearchParams({ action: 'errors' });
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.level) queryParams.append('level', params.level);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.resolved !== undefined) queryParams.append('resolved', params.resolved.toString());
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.endpoint) queryParams.append('endpoint', params.endpoint);

    return apiClient.get(`/monitoring?${queryParams.toString()}`);
  },

  // Log error
  logError: async (error: {
    message: string;
    stack?: string;
    level?: 'error' | 'warn' | 'info';
    context?: Record<string, any>;
  }): Promise<AxiosResponse<{ logged: boolean; errorId: string }>> => {
    return apiClient.post('/monitoring?action=error', error);
  },

  // Resolve error
  resolveError: async (errorId: string): Promise<AxiosResponse<{ resolved: boolean }>> => {
    return apiClient.post(`/monitoring?action=resolve&id=${errorId}`);
  },

  // Get metrics
  getMetrics: async (params?: {
    timeframe?: 'hour' | 'day' | 'week' | 'month';
    metric?: string;
  }): Promise<AxiosResponse<MetricsResponse>> => {
    const queryParams = new URLSearchParams({ action: 'metrics' });
    if (params?.timeframe) queryParams.append('timeframe', params.timeframe);
    if (params?.metric) queryParams.append('metric', params.metric);

    return apiClient.get(`/monitoring?${queryParams.toString()}`);
  },

  // Performance tracking
  trackPerformance: async (data: {
    action: string;
    duration: number;
    success: boolean;
    metadata?: Record<string, any>;
  }): Promise<AxiosResponse<{ tracked: boolean }>> => {
    return apiClient.post('/monitoring?action=performance', data);
  },

  // Get system alerts
  getAlerts: async (): Promise<AxiosResponse<{
    alerts: Array<{
      id: string;
      type: 'critical' | 'warning' | 'info';
      message: string;
      timestamp: string;
      acknowledged: boolean;
    }>;
  }>> => {
    return apiClient.get('/monitoring?action=alerts');
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId: string): Promise<AxiosResponse<{ acknowledged: boolean }>> => {
    return apiClient.post(`/monitoring?action=acknowledge&id=${alertId}`);
  },
};

// Helper functions
export const getHealthStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy':
    case 'up':
      return 'text-green-600';
    case 'degraded':
      return 'text-yellow-600';
    case 'unhealthy':
    case 'down':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export const getHealthStatusIcon = (status: string): string => {
  switch (status) {
    case 'healthy':
    case 'up':
      return '✅';
    case 'degraded':
      return '⚠️';
    case 'unhealthy':
    case 'down':
      return '❌';
    default:
      return '❓';
  }
};

export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
};

export const getErrorLevelColor = (level: string): string => {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'warn':
      return 'bg-yellow-100 text-yellow-800';
    case 'info':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const formatErrorRate = (rate: number): string => {
  if (rate < 0.001) return '< 0.1%';
  return `${(rate * 100).toFixed(2)}%`;
};

// Error tracking utility
export const captureError = async (error: Error, context?: Record<string, any>) => {
  try {
    await monitoringAPI.logError({
      message: error.message,
      stack: error.stack || '',
      level: 'error',
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
};

export default monitoringAPI;