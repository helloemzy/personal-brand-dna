import { lazy, LazyExoticComponent, ComponentType } from 'react';

export interface LazyComponentWithPreload<T extends ComponentType<any>> extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

/**
 * Enhanced lazy loading with preload capability
 * Allows components to be preloaded before they're needed
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): LazyComponentWithPreload<T> {
  const Component = lazy(importFunc) as LazyComponentWithPreload<T>;
  Component.preload = importFunc;
  return Component;
}

/**
 * Preload multiple components at once
 */
export function preloadComponents(components: LazyComponentWithPreload<any>[]) {
  return Promise.all(components.map(component => component.preload()));
}

/**
 * Retry failed dynamic imports with exponential backoff
 */
export function retryImport<T>(
  importFunc: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attemptImport = (retriesLeft: number) => {
      importFunc()
        .then(resolve)
        .catch((error) => {
          if (retriesLeft === 0) {
            reject(error);
            return;
          }
          
          console.warn(`Failed to import, retrying... (${retriesLeft} attempts left)`);
          setTimeout(() => {
            attemptImport(retriesLeft - 1);
          }, delay * (4 - retriesLeft)); // Exponential backoff
        });
    };
    
    attemptImport(retries);
  });
}

/**
 * Lazy load with retry capability and preload support
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): LazyComponentWithPreload<T> {
  const Component = lazy(() => retryImport(importFunc)) as LazyComponentWithPreload<T>;
  Component.preload = importFunc;
  return Component;
}

/**
 * Preload component when user hovers over a link
 */
export function preloadOnHover<T extends ComponentType<any>>(
  component: LazyComponentWithPreload<T>
) {
  let preloaded = false;
  
  return {
    onMouseEnter: () => {
      if (!preloaded) {
        preloaded = true;
        component.preload();
      }
    },
    onTouchStart: () => {
      if (!preloaded) {
        preloaded = true;
        component.preload();
      }
    }
  };
}

/**
 * Preload component when it's likely to be used soon
 */
export function preloadOnIdle<T extends ComponentType<any>>(
  component: LazyComponentWithPreload<T>
) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      component.preload();
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      component.preload();
    }, 1);
  }
}

/**
 * Intersection observer based preloading
 */
export function preloadOnIntersection<T extends ComponentType<any>>(
  elementRef: React.RefObject<HTMLElement>,
  component: LazyComponentWithPreload<T>,
  options?: IntersectionObserverInit
) {
  if (!elementRef.current || typeof IntersectionObserver === 'undefined') {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        component.preload();
        observer.disconnect();
      }
    });
  }, options);

  observer.observe(elementRef.current);

  return () => observer.disconnect();
}