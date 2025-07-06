/**
 * Debounce and throttle utilities for performance optimization
 */

import * as React from 'react';
import { DEBOUNCE_DELAYS, THROTTLE_DELAYS } from '../config/performance';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let result: any;

  const debounced = function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    const later = () => {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };

    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) result = func.apply(context, args);
    
    return result;
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  let lastArgs: Parameters<T> | null = null;
  let lastContext: any = null;
  
  const { leading = true, trailing = true } = options;

  const throttled = function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    
    if (!previous && !leading) previous = now;
    
    const remaining = wait - (now - previous);
    lastArgs = args;
    lastContext = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(lastContext, lastArgs);
      lastArgs = null;
      lastContext = null;
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = !leading ? 0 : Date.now();
        timeout = null;
        if (lastArgs) {
          func.apply(lastContext, lastArgs);
          lastArgs = null;
          lastContext = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    previous = 0;
    lastArgs = null;
    lastContext = null;
  };

  return throttled;
}

/**
 * Pre-configured debounce functions for common use cases
 */
export const debouncedFunctions = {
  workshopAutoSave: (func: (...args: any[]) => any) => 
    debounce(func, DEBOUNCE_DELAYS.workshopAutoSave),
    
  searchInput: (func: (...args: any[]) => any) => 
    debounce(func, DEBOUNCE_DELAYS.searchInput),
    
  formValidation: (func: (...args: any[]) => any) => 
    debounce(func, DEBOUNCE_DELAYS.formValidation),
    
  textEditor: (func: (...args: any[]) => any) => 
    debounce(func, DEBOUNCE_DELAYS.textEditor),
    
  analyticsEvent: (func: (...args: any[]) => any) => 
    debounce(func, DEBOUNCE_DELAYS.analyticsEvent),
};

/**
 * Pre-configured throttle functions for common use cases
 */
export const throttledFunctions = {
  scrollEvent: (func: (...args: any[]) => any) => 
    throttle(func, THROTTLE_DELAYS.scrollEvent),
    
  windowResize: (func: (...args: any[]) => any) => 
    throttle(func, THROTTLE_DELAYS.windowResize),
    
  mouseMove: (func: (...args: any[]) => any) => 
    throttle(func, THROTTLE_DELAYS.mouseMove),
    
  apiCall: (func: (...args: any[]) => any) => 
    throttle(func, THROTTLE_DELAYS.apiCall),
};

/**
 * Hook for using debounced values in React components
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for using throttled values in React components
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastRun = React.useRef(Date.now());

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRun.current >= delay) {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }
    }, delay - (Date.now() - lastRun.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttledValue;
}