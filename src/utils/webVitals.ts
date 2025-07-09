import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import * as Sentry from '@sentry/react';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

// Send Web Vitals to analytics
const sendToAnalytics = (metric: WebVitalMetric) => {
  // Google Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  }

  // Sentry Performance Monitoring
  if (metric.name === 'LCP' || metric.name === 'FCP' || metric.name === 'TTFB') {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (transaction) {
      transaction.setMeasurement(metric.name, metric.value);
    }
  }

  // Custom performance tracking
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vital] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }
};

// Performance thresholds
const thresholds = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 }
};

// Get rating based on value
const getRating = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return 'needs-improvement';
  
  if (value <= threshold.good) return 'good';
  if (value > threshold.poor) return 'poor';
  return 'needs-improvement';
};

// Monitor Web Vitals
export const reportWebVitals = () => {
  getCLS((metric) => {
    const enhancedMetric = {
      ...metric,
      rating: getRating('CLS', metric.value)
    };
    sendToAnalytics(enhancedMetric);
  });

  getFID((metric) => {
    const enhancedMetric = {
      ...metric,
      rating: getRating('FID', metric.value)
    };
    sendToAnalytics(enhancedMetric);
  });

  getFCP((metric) => {
    const enhancedMetric = {
      ...metric,
      rating: getRating('FCP', metric.value)
    };
    sendToAnalytics(enhancedMetric);
  });

  getLCP((metric) => {
    const enhancedMetric = {
      ...metric,
      rating: getRating('LCP', metric.value)
    };
    sendToAnalytics(enhancedMetric);
  });

  getTTFB((metric) => {
    const enhancedMetric = {
      ...metric,
      rating: getRating('TTFB', metric.value)
    };
    sendToAnalytics(enhancedMetric);
  });
};

// Performance observer for custom metrics
export const observePerformance = () => {
  if ('PerformanceObserver' in window) {
    // Observe long tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Report long tasks to analytics
          if (entry.duration > 50) {
            console.warn('[Long Task]', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task observer not supported
    }

    // Observe resource timing
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('.js') || entry.name.includes('.css')) {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.duration > 1000) {
              console.warn('[Slow Resource]', {
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                size: resourceEntry.transferSize
              });
            }
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      // Resource timing observer not supported
    }
  }
};

// Bundle size tracking
export const trackBundleSize = () => {
  if ('performance' in window && 'memory' in performance) {
    const memory = (performance as any).memory;
    if (memory) {
      const bundleInfo = {
        usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576), // MB
        totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576), // MB
        jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Bundle Size]', bundleInfo);
      }
    }
  }
};

// Initialize all performance monitoring
export const initPerformanceMonitoring = () => {
  reportWebVitals();
  observePerformance();
  
  // Track bundle size after load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(trackBundleSize, 1000);
    });
  }
};