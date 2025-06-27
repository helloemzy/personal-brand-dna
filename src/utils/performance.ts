/**
 * Performance monitoring utilities for tracking web vitals and component performance
 */

// Types for Web Vitals
interface Metric {
  name: string;
  value: number;
  delta: number;
  entries: PerformanceEntry[];
  id: string;
  navigationType: string;
}

interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
}

// Performance tracking configuration
const PERFORMANCE_CONFIG = {
  enableWebVitals: true,
  enableComponentTracking: true,
  enableAPITracking: true,
  sampleRate: 1.0, // Track 100% of users (adjust for production)
  slowThreshold: {
    component: 16, // 16ms for 60fps
    api: 1000, // 1 second for API calls
    pageLoad: 3000, // 3 seconds for page load
  },
};

// Web Vitals tracking
export const trackWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  if (!PERFORMANCE_CONFIG.enableWebVitals) return;

  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

// Component render tracking
class ComponentPerformanceTracker {
  private renderTimes: Map<string, number[]> = new Map();

  startTracking(componentName: string): () => void {
    if (!PERFORMANCE_CONFIG.enableComponentTracking) {
      return () => {};
    }

    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (!this.renderTimes.has(componentName)) {
        this.renderTimes.set(componentName, []);
      }

      const times = this.renderTimes.get(componentName)!;
      times.push(renderTime);

      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
      }

      // Log slow renders
      if (renderTime > PERFORMANCE_CONFIG.slowThreshold.component) {
        console.warn(
          `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
        );
      }
    };
  }

  getStats(componentName: string) {
    const times = this.renderTimes.get(componentName) || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((acc, time) => acc + time, 0);

    return {
      count: times.length,
      average: sum / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  logAllStats() {
    console.group('Component Performance Stats');
    this.renderTimes.forEach((times, componentName) => {
      const stats = this.getStats(componentName);
      if (stats) {
        console.log(`${componentName}:`, stats);
      }
    });
    console.groupEnd();
  }

  clear() {
    this.renderTimes.clear();
  }
}

export const componentTracker = new ComponentPerformanceTracker();

// API call performance tracking
class APIPerformanceTracker {
  private apiCalls: Map<string, number[]> = new Map();

  async trackAPICall<T>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    if (!PERFORMANCE_CONFIG.enableAPITracking) {
      return apiCall();
    }

    const startTime = performance.now();

    try {
      const result = await apiCall();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordCall(endpoint, duration);

      if (duration > PERFORMANCE_CONFIG.slowThreshold.api) {
        console.warn(
          `Slow API call detected for ${endpoint}: ${duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordCall(endpoint, duration, true);
      throw error;
    }
  }

  private recordCall(endpoint: string, duration: number, failed = false) {
    const key = failed ? `${endpoint}_failed` : endpoint;
    
    if (!this.apiCalls.has(key)) {
      this.apiCalls.set(key, []);
    }

    const calls = this.apiCalls.get(key)!;
    calls.push(duration);

    // Keep only last 100 calls
    if (calls.length > 100) {
      calls.shift();
    }
  }

  getStats(endpoint: string) {
    const times = this.apiCalls.get(endpoint) || [];
    const failedTimes = this.apiCalls.get(`${endpoint}_failed`) || [];

    if (times.length === 0 && failedTimes.length === 0) return null;

    const calculateStats = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const sum = arr.reduce((acc, time) => acc + time, 0);

      return {
        count: arr.length,
        average: sum / arr.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        min: sorted[0],
        max: sorted[sorted.length - 1],
      };
    };

    return {
      success: calculateStats(times),
      failed: calculateStats(failedTimes),
      failureRate: failedTimes.length / (times.length + failedTimes.length),
    };
  }

  logAllStats() {
    console.group('API Performance Stats');
    const endpoints = new Set<string>();
    
    this.apiCalls.forEach((_, key) => {
      const endpoint = key.replace('_failed', '');
      endpoints.add(endpoint);
    });

    endpoints.forEach(endpoint => {
      const stats = this.getStats(endpoint);
      if (stats) {
        console.log(`${endpoint}:`, stats);
      }
    });
    console.groupEnd();
  }

  clear() {
    this.apiCalls.clear();
  }
}

export const apiTracker = new APIPerformanceTracker();

// React hook for component performance tracking
export const useComponentPerformance = (componentName: string) => {
  if (!PERFORMANCE_CONFIG.enableComponentTracking) {
    return;
  }

  const endTracking = componentTracker.startTracking(componentName);
  
  // Clean up tracking when component unmounts
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => endTracking());
  } else {
    setTimeout(endTracking, 0);
  }
};

// Memory usage tracking
export const trackMemoryUsage = () => {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      percentUsed: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
};

// Page load performance
export const trackPageLoad = () => {
  if ('PerformanceNavigationTiming' in window) {
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navTiming) {
      const pageLoadTime = navTiming.loadEventEnd - navTiming.fetchStart;
      const domContentLoaded = navTiming.domContentLoadedEventEnd - navTiming.fetchStart;
      const domProcessing = navTiming.domComplete - navTiming.domLoading;

      if (pageLoadTime > PERFORMANCE_CONFIG.slowThreshold.pageLoad) {
        console.warn(`Slow page load detected: ${pageLoadTime.toFixed(2)}ms`);
      }

      return {
        pageLoadTime,
        domContentLoaded,
        domProcessing,
        redirectTime: navTiming.redirectEnd - navTiming.redirectStart,
        dnsTime: navTiming.domainLookupEnd - navTiming.domainLookupStart,
        connectTime: navTiming.connectEnd - navTiming.connectStart,
        ttfb: navTiming.responseStart - navTiming.fetchStart,
        responseTime: navTiming.responseEnd - navTiming.responseStart,
      };
    }
  }
  return null;
};

// Performance marks for custom measurements
export const performanceMark = {
  start: (markName: string) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(`${markName}_start`);
    }
  },

  end: (markName: string) => {
    if ('performance' in window && 'mark' in performance && 'measure' in performance) {
      performance.mark(`${markName}_end`);
      try {
        performance.measure(markName, `${markName}_start`, `${markName}_end`);
        const measures = performance.getEntriesByName(markName, 'measure');
        const duration = measures[measures.length - 1]?.duration;
        
        // Clean up marks
        performance.clearMarks(`${markName}_start`);
        performance.clearMarks(`${markName}_end`);
        performance.clearMeasures(markName);

        return duration;
      } catch (e) {
        console.error('Performance measurement error:', e);
        return null;
      }
    }
    return null;
  },
};

// Export performance report
export const generatePerformanceReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    pageLoad: trackPageLoad(),
    memory: trackMemoryUsage(),
    components: {} as Record<string, any>,
    apis: {} as Record<string, any>,
  };

  // Get component stats
  componentTracker.renderTimes.forEach((_, componentName) => {
    report.components[componentName] = componentTracker.getStats(componentName);
  });

  // Get API stats
  const endpoints = new Set<string>();
  apiTracker.apiCalls.forEach((_, key) => {
    const endpoint = key.replace('_failed', '');
    endpoints.add(endpoint);
  });

  endpoints.forEach(endpoint => {
    report.apis[endpoint] = apiTracker.getStats(endpoint);
  });

  return report;
};

// Initialize performance monitoring
export const initPerformanceMonitoring = () => {
  // Track Web Vitals
  trackWebVitals((metric) => {
    console.log(`${metric.name}: ${metric.value}`);
    
    // You can send this data to your analytics service
    // analytics.track('web_vital', {
    //   metric: metric.name,
    //   value: metric.value,
    //   delta: metric.delta,
    // });
  });

  // Log performance report periodically (every 5 minutes)
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      console.log('Performance Report:', generatePerformanceReport());
    }, 5 * 60 * 1000);
  }

  // Log report before page unload
  window.addEventListener('beforeunload', () => {
    const report = generatePerformanceReport();
    // Send to analytics or save to localStorage
    localStorage.setItem('lastPerformanceReport', JSON.stringify(report));
  });
};