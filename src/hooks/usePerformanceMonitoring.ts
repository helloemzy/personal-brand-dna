import { useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '../services/analyticsService';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  category: 'navigation' | 'resource' | 'paint' | 'layout' | 'custom';
}

interface PerformanceThresholds {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  TTI?: number; // Time to Interactive
}

// Default performance thresholds (in milliseconds)
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  FCP: 1800,   // Good: <1.8s
  LCP: 2500,   // Good: <2.5s
  FID: 100,    // Good: <100ms
  CLS: 0.1,    // Good: <0.1
  TTFB: 800,   // Good: <800ms
  TTI: 3800,   // Good: <3.8s
};

/**
 * Hook to monitor and report performance metrics
 */
export const usePerformanceMonitoring = (
  pageName: string,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS,
  options: {
    reportToAnalytics?: boolean;
    reportToConsole?: boolean;
    customMetrics?: boolean;
  } = {}
) => {
  const {
    reportToAnalytics = true,
    reportToConsole = process.env.NODE_ENV === 'development',
    customMetrics = true
  } = options;

  const metricsReported = useRef(new Set<string>());
  const observers = useRef<PerformanceObserver[]>([]);

  // Report metric to analytics and console
  const reportMetric = useCallback((metric: PerformanceMetric) => {
    // Avoid duplicate reporting
    const metricKey = `${metric.name}-${metric.value}`;
    if (metricsReported.current.has(metricKey)) return;
    metricsReported.current.add(metricKey);

    // Check if metric exceeds threshold
    const threshold = thresholds[metric.name as keyof PerformanceThresholds];
    const isGood = !threshold || metric.value <= threshold;

    // Log to console in development
    if (reportToConsole) {
      const emoji = isGood ? '✅' : '⚠️';
      console.log(
        `${emoji} ${metric.name}: ${metric.value.toFixed(2)}${metric.unit}`,
        isGood ? '(Good)' : `(Exceeds threshold: ${threshold}${metric.unit})`
      );
    }

    // Report to analytics
    if (reportToAnalytics) {
      trackEvent('Performance', metric.name, {
        page: pageName,
        value: Math.round(metric.value),
        unit: metric.unit,
        category: metric.category,
        isGood,
        threshold
      });
    }
  }, [pageName, thresholds, reportToAnalytics, reportToConsole]);

  // Observe Web Vitals
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Clear any existing observers
      observers.current.forEach(obs => obs.disconnect());
      observers.current = [];

      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            reportMetric({
              name: 'FCP',
              value: entry.startTime,
              unit: 'ms',
              category: 'paint'
            });
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      observers.current.push(paintObserver);

      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        reportMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          unit: 'ms',
          category: 'paint'
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      observers.current.push(lcpObserver);

      // Observe first input delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as any;
          reportMetric({
            name: 'FID',
            value: fidEntry.processingStart - fidEntry.startTime,
            unit: 'ms',
            category: 'custom'
          });
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      observers.current.push(fidObserver);

      // Observe layout shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        reportMetric({
          name: 'CLS',
          value: clsValue,
          unit: '',
          category: 'layout'
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      observers.current.push(clsObserver);

      // Cleanup function
      return () => {
        observers.current.forEach(obs => obs.disconnect());
        observers.current = [];
      };
    } catch (error) {
      console.error('Failed to setup performance monitoring:', error);
    }
  }, [reportMetric]);

  // Measure navigation timing
  useEffect(() => {
    if (!('performance' in window) || !performance.timing) return;

    const measureNavigationTiming = () => {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;

      // Time to First Byte
      if (timing.responseStart > 0) {
        reportMetric({
          name: 'TTFB',
          value: timing.responseStart - navigationStart,
          unit: 'ms',
          category: 'navigation'
        });
      }

      // DOM Content Loaded
      if (timing.domContentLoadedEventEnd > 0) {
        reportMetric({
          name: 'DOM_LOADED',
          value: timing.domContentLoadedEventEnd - navigationStart,
          unit: 'ms',
          category: 'navigation'
        });
      }

      // Page Load Complete
      if (timing.loadEventEnd > 0) {
        reportMetric({
          name: 'PAGE_LOAD',
          value: timing.loadEventEnd - navigationStart,
          unit: 'ms',
          category: 'navigation'
        });
      }
    };

    // Measure after page load
    if (document.readyState === 'complete') {
      measureNavigationTiming();
    } else {
      window.addEventListener('load', measureNavigationTiming);
      return () => window.removeEventListener('load', measureNavigationTiming);
    }
  }, [reportMetric]);

  // Custom metric tracking
  const trackCustomMetric = useCallback((
    name: string,
    value: number,
    unit: string = 'ms'
  ) => {
    if (!customMetrics) return;

    reportMetric({
      name,
      value,
      unit,
      category: 'custom'
    });
  }, [customMetrics, reportMetric]);

  // Mark custom timing
  const markTiming = useCallback((markName: string) => {
    if (!('performance' in window) || !performance.mark) return;
    performance.mark(markName);
  }, []);

  // Measure between marks
  const measureTiming = useCallback((
    measureName: string,
    startMark: string,
    endMark?: string
  ) => {
    if (!('performance' in window) || !performance.measure) return;

    try {
      const measure = performance.measure(measureName, startMark, endMark);
      trackCustomMetric(measureName, measure.duration);
    } catch (error) {
      console.error('Failed to measure timing:', error);
    }
  }, [trackCustomMetric]);

  return {
    trackCustomMetric,
    markTiming,
    measureTiming
  };
};

// Component usage example:
// const MyComponent = () => {
//   const { markTiming, measureTiming } = usePerformanceMonitoring('MyPage');
//   
//   useEffect(() => {
//     markTiming('component-start');
//     
//     // Do some work...
//     
//     markTiming('component-end');
//     measureTiming('component-render', 'component-start', 'component-end');
//   }, []);
// };

export default usePerformanceMonitoring;