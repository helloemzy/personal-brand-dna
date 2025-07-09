import * as Sentry from '@sentry/react';

interface PerformanceMetrics {
  navigationTiming: PerformanceNavigationTiming | null;
  resourceTimings: PerformanceResourceTiming[];
  bundleSizes: Map<string, number>;
  loadTimes: Map<string, number>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    navigationTiming: null,
    resourceTimings: [],
    bundleSizes: new Map(),
    loadTimes: new Map()
  };

  private observer: PerformanceObserver | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializeObserver();
    }
  }

  private initializeObserver() {
    try {
      // Observe navigation timing
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.metrics.navigationTiming = entry as PerformanceNavigationTiming;
            this.reportNavigationMetrics();
          } else if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.metrics.resourceTimings.push(resourceEntry);
            this.trackResourceMetrics(resourceEntry);
          }
        });
      });

      this.observer.observe({ 
        entryTypes: ['navigation', 'resource', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
      });
    } catch (error) {
      console.error('Failed to initialize performance observer:', error);
    }
  }

  private reportNavigationMetrics() {
    if (!this.metrics.navigationTiming) return;

    const nav = this.metrics.navigationTiming;
    const metrics = {
      // Page load times
      domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
      domComplete: nav.domComplete - nav.domInteractive,
      loadComplete: nav.loadEventEnd - nav.loadEventStart,
      
      // Network metrics
      dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
      tcpConnect: nav.connectEnd - nav.connectStart,
      tlsNegotiation: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
      
      // Server metrics
      serverResponseTime: nav.responseStart - nav.requestStart,
      downloadTime: nav.responseEnd - nav.responseStart,
      
      // Frontend metrics
      domProcessing: nav.domComplete - nav.domLoading,
      domInteractive: nav.domInteractive - nav.responseEnd,
      
      // Total time
      totalPageLoad: nav.loadEventEnd - nav.fetchStart
    };

    // Report to Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: 'Page load metrics',
      level: 'info',
      data: metrics
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('📊 Page Load Performance');
      console.table(metrics);
      console.groupEnd();
    }
  }

  private trackResourceMetrics(resource: PerformanceResourceTiming) {
    // Track bundle sizes
    if (resource.name.includes('.js') || resource.name.includes('.css')) {
      const size = resource.transferSize || resource.encodedBodySize || 0;
      const loadTime = resource.responseEnd - resource.startTime;
      
      // Extract filename from URL
      const filename = resource.name.split('/').pop() || resource.name;
      
      this.metrics.bundleSizes.set(filename, size);
      this.metrics.loadTimes.set(filename, loadTime);

      // Track large bundles
      if (size > 100000) { // 100KB threshold
        console.warn(`⚠️ Large bundle detected: ${filename} (${(size / 1024).toFixed(2)}KB)`);
        
        Sentry.captureMessage(`Large bundle: ${filename}`, {
          level: 'warning',
          extra: {
            size: size,
            loadTime: loadTime,
            url: resource.name
          }
        });
      }
    }
  }

  public measureChunkLoad(chunkName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      this.metrics.loadTimes.set(chunkName, loadTime);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 Chunk "${chunkName}" loaded in ${loadTime.toFixed(2)}ms`);
      }

      // Report slow chunk loads
      if (loadTime > 3000) { // 3 second threshold
        Sentry.captureMessage(`Slow chunk load: ${chunkName}`, {
          level: 'warning',
          extra: {
            loadTime: loadTime,
            chunkName: chunkName
          }
        });
      }
    };
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  public reportBundleSizes() {
    const totalSize = Array.from(this.metrics.bundleSizes.values()).reduce((sum, size) => sum + size, 0);
    
    const report = {
      totalBundleSize: totalSize,
      numberOfBundles: this.metrics.bundleSizes.size,
      bundles: Array.from(this.metrics.bundleSizes.entries()).map(([name, size]) => ({
        name,
        size,
        sizeInKB: (size / 1024).toFixed(2)
      })).sort((a, b) => b.size - a.size)
    };

    if (process.env.NODE_ENV === 'development') {
      console.group('📊 Bundle Size Report');
      console.log(`Total bundle size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      console.table(report.bundles);
      console.groupEnd();
    }

    return report;
  }

  public checkPerformanceBudget(budgets: { [key: string]: number }) {
    const violations: string[] = [];

    // Check total bundle size
    if (budgets.totalBundleSize) {
      const totalSize = Array.from(this.metrics.bundleSizes.values()).reduce((sum, size) => sum + size, 0);
      if (totalSize > budgets.totalBundleSize) {
        violations.push(`Total bundle size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds budget (${(budgets.totalBundleSize / 1024 / 1024).toFixed(2)}MB)`);
      }
    }

    // Check individual chunk sizes
    if (budgets.maxChunkSize) {
      this.metrics.bundleSizes.forEach((size, name) => {
        if (size > budgets.maxChunkSize) {
          violations.push(`Chunk "${name}" (${(size / 1024).toFixed(2)}KB) exceeds max size (${(budgets.maxChunkSize / 1024).toFixed(2)}KB)`);
        }
      });
    }

    // Check page load time
    if (budgets.maxLoadTime && this.metrics.navigationTiming) {
      const totalLoadTime = this.metrics.navigationTiming.loadEventEnd - this.metrics.navigationTiming.fetchStart;
      if (totalLoadTime > budgets.maxLoadTime) {
        violations.push(`Page load time (${totalLoadTime.toFixed(0)}ms) exceeds budget (${budgets.maxLoadTime}ms)`);
      }
    }

    if (violations.length > 0) {
      console.error('❌ Performance budget violations:', violations);
      
      // Report to Sentry
      Sentry.captureMessage('Performance budget exceeded', {
        level: 'error',
        extra: {
          violations,
          metrics: this.getMetrics()
        }
      });
    }

    return violations;
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for tracking component performance
export function usePerformanceTracking(componentName: string) {
  useEffect(() => {
    const measureEnd = performanceMonitor.measureChunkLoad(componentName);
    
    return () => {
      measureEnd();
    };
  }, [componentName]);
}

// Performance budgets
export const PERFORMANCE_BUDGETS = {
  totalBundleSize: 2 * 1024 * 1024, // 2MB total
  maxChunkSize: 300 * 1024, // 300KB per chunk
  maxLoadTime: 3000, // 3 seconds
  maxLCP: 2500, // 2.5 seconds for Largest Contentful Paint
  maxFID: 100, // 100ms for First Input Delay
  maxCLS: 0.1 // 0.1 for Cumulative Layout Shift
};

// Web Vitals tracking
export function trackWebVitals() {
  if ('web-vital' in window) {
    // @ts-ignore - web-vitals library
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        console.log('CLS:', metric.value);
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: 'Cumulative Layout Shift',
          data: { value: metric.value }
        });
      });
      
      getFID((metric) => {
        console.log('FID:', metric.value);
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: 'First Input Delay',
          data: { value: metric.value }
        });
      });
      
      getFCP((metric) => {
        console.log('FCP:', metric.value);
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: 'First Contentful Paint',
          data: { value: metric.value }
        });
      });
      
      getLCP((metric) => {
        console.log('LCP:', metric.value);
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: 'Largest Contentful Paint',
          data: { value: metric.value }
        });
      });
      
      getTTFB((metric) => {
        console.log('TTFB:', metric.value);
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: 'Time to First Byte',
          data: { value: metric.value }
        });
      });
    });
  }
}