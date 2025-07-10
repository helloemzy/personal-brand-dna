import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

interface PerformanceMetrics {
  CLS?: number; // Cumulative Layout Shift
  FID?: number; // First Input Delay
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  TTFB?: number; // Time to First Byte
  customMetrics: Record<string, number>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    customMetrics: {}
  };
  
  private observers: Array<() => void> = [];
  private reportCallback?: (metrics: PerformanceMetrics) => void;

  constructor() {
    this.initializeWebVitals();
  }

  // Initialize web vitals monitoring
  private initializeWebVitals() {
    getCLS(this.handleMetric('CLS'));
    getFID(this.handleMetric('FID'));
    getFCP(this.handleMetric('FCP'));
    getLCP(this.handleMetric('LCP'));
    getTTFB(this.handleMetric('TTFB'));
  }

  // Handle web vitals metrics
  private handleMetric = (name: keyof Omit<PerformanceMetrics, 'customMetrics'>) => {
    return (metric: Metric) => {
      this.metrics[name] = metric.value;
      this.notifyObservers();
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${name}:`, metric.value);
      }
      
      // Report if callback is set
      if (this.reportCallback) {
        this.reportCallback(this.metrics);
      }
    };
  };

  // Measure custom performance marks
  mark(name: string) {
    if ('performance' in window) {
      performance.mark(name);
    }
  }

  // Measure between two marks
  measure(name: string, startMark: string, endMark?: string) {
    if ('performance' in window) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (measure) {
          this.metrics.customMetrics[name] = measure.duration;
          this.notifyObservers();
        }
      } catch (error) {
        console.error('Performance measurement error:', error);
      }
    }
  }

  // Measure component render time
  measureComponent(componentName: string, callback: () => void) {
    const startMark = `${componentName}-start`;
    const endMark = `${componentName}-end`;
    
    this.mark(startMark);
    
    // Use requestAnimationFrame to measure after render
    requestAnimationFrame(() => {
      this.mark(endMark);
      this.measure(`${componentName}-render`, startMark, endMark);
      callback();
    });
  }

  // Measure async operation
  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      this.metrics.customMetrics[name] = duration;
      this.notifyObservers();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${name}:`, duration, 'ms');
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.metrics.customMetrics[`${name}-error`] = duration;
      throw error;
    }
  }

  // Get all metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get specific metric
  getMetric(name: string): number | undefined {
    if (name in this.metrics && name !== 'customMetrics') {
      return this.metrics[name as keyof Omit<PerformanceMetrics, 'customMetrics'>];
    }
    return this.metrics.customMetrics[name];
  }

  // Subscribe to metric updates
  subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.observers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.observers = this.observers.filter(obs => obs !== callback);
    };
  }

  // Set report callback for sending metrics to analytics
  setReportCallback(callback: (metrics: PerformanceMetrics) => void) {
    this.reportCallback = callback;
  }

  // Notify all observers
  private notifyObservers() {
    this.observers.forEach(callback => callback(this.metrics));
  }

  // Log performance report
  logReport() {
    console.group('📊 Performance Report');
    console.table({
      'Cumulative Layout Shift (CLS)': this.metrics.CLS,
      'First Input Delay (FID)': this.metrics.FID,
      'First Contentful Paint (FCP)': this.metrics.FCP,
      'Largest Contentful Paint (LCP)': this.metrics.LCP,
      'Time to First Byte (TTFB)': this.metrics.TTFB,
    });
    
    if (Object.keys(this.metrics.customMetrics).length > 0) {
      console.log('Custom Metrics:');
      console.table(this.metrics.customMetrics);
    }
    console.groupEnd();
  }

  // Check if metrics meet performance budgets
  checkBudgets(budgets: Partial<PerformanceMetrics>): boolean {
    let meetsAllBudgets = true;
    
    Object.entries(budgets).forEach(([metric, budget]) => {
      if (metric !== 'customMetrics' && typeof budget === 'number') {
        const actual = this.metrics[metric as keyof Omit<PerformanceMetrics, 'customMetrics'>];
        if (actual && actual > budget) {
          console.warn(`⚠️ Performance budget exceeded for ${metric}: ${actual} > ${budget}`);
          meetsAllBudgets = false;
        }
      }
    });
    
    return meetsAllBudgets;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  React.useEffect(() => {
    performanceMonitor.measureComponent(componentName, () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Component ${componentName} rendered`);
      }
    });
  }, [componentName]);
};

// HOC for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return (props: P) => {
    usePerformanceMonitor(componentName);
    return <Component {...props} />;
  };
}

// Utility to measure route changes
export const measureRouteChange = (from: string, to: string) => {
  const measureName = `route-change-${from}-to-${to}`;
  performanceMonitor.mark(`${measureName}-start`);
  
  return () => {
    performanceMonitor.mark(`${measureName}-end`);
    performanceMonitor.measure(measureName, `${measureName}-start`, `${measureName}-end`);
  };
};