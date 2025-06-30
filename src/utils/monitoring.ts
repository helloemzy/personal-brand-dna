// Monitoring and Error Tracking Utilities

interface ErrorContext {
  userId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private static instance: MonitoringService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  initialize() {
    if (this.isInitialized) return;

    // Initialize error boundary
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        component: 'window',
        action: 'unhandledRejection'
      });
    });

    this.isInitialized = true;
  }

  captureError(error: Error, context?: ErrorContext) {
    // In production, this would send to Sentry or similar
    console.error('Error captured:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });

    // Send to monitoring service in production
    if (process.env['NODE_ENV'] === 'production') {
      this.sendToMonitoringService(error, context);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    console.log(`[${level.toUpperCase()}]`, message);

    if (process.env['NODE_ENV'] === 'production') {
      this.sendToMonitoringService(message, { level });
    }
  }

  setUser(userId: string, email?: string) {
    // Set user context for error tracking
    console.log('User context set:', { userId, email });
  }

  addBreadcrumb(message: string, category: string, data?: any) {
    // Track user actions for debugging
    console.log('Breadcrumb:', { message, category, data, timestamp: new Date().toISOString() });
  }

  trackPerformance(name: string, duration: number) {
    // Track performance metrics
    console.log('Performance metric:', { name, duration });

    if (process.env['NODE_ENV'] === 'production' && window.performance) {
      // Send to monitoring service
      this.sendPerformanceMetric(name, duration);
    }
  }

  private sendToMonitoringService(data: any, context?: any) {
    // Placeholder for actual monitoring service integration
    // In production, this would send to Sentry, DataDog, etc.
    fetch('/api/monitoring/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, context })
    }).catch(() => {
      // Fail silently to not disrupt user experience
    });
  }

  private sendPerformanceMetric(name: string, duration: number) {
    // Send performance data to monitoring service
    fetch('/api/monitoring/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, duration, timestamp: Date.now() })
    }).catch(() => {
      // Fail silently
    });
  }
}

// Performance monitoring decorator
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      monitoring.trackPerformance(`${target.constructor.name}.${propertyKey}`, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      monitoring.trackPerformance(`${target.constructor.name}.${propertyKey} (failed)`, duration);
      throw error;
    }
  };

  return descriptor;
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();

// React Error Boundary Hook
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    monitoring.captureError(error, {
      component: errorInfo?.componentStack || '',
      action: 'React Error Boundary'
    });
  };
}