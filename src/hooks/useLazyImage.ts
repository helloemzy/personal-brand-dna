import { useState, useEffect, useRef } from 'react';

interface LazyImageOptions {
  threshold?: number;
  rootMargin?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const useLazyImage = (
  src: string,
  options: LazyImageOptions = {}
) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Crect width="1" height="1" fill="%23f3f4f6"/%3E%3C/svg%3E',
    onLoad,
    onError
  } = options;

  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!imageRef.current || !('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver
      setImageSrc(src);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Preload image
            const img = new Image();
            
            img.onload = () => {
              setImageSrc(src);
              setIsLoading(false);
              onLoad?.();
              
              // Disconnect observer after loading
              observerRef.current?.disconnect();
            };
            
            img.onerror = () => {
              setHasError(true);
              setIsLoading(false);
              onError?.();
              
              // Disconnect observer after error
              observerRef.current?.disconnect();
            };
            
            img.src = src;
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(imageRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, threshold, rootMargin, onLoad, onError]);

  return {
    imageSrc,
    imageRef,
    isLoading,
    hasError
  };
};

// Hook for lazy loading background images
export const useLazyBackgroundImage = (
  src: string,
  options: LazyImageOptions = {}
) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    onLoad,
    onError
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!elementRef.current || !('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver
      setIsLoaded(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Preload image
            const img = new Image();
            
            img.onload = () => {
              setIsLoaded(true);
              onLoad?.();
              
              // Disconnect observer after loading
              observerRef.current?.disconnect();
            };
            
            img.onerror = () => {
              setHasError(true);
              onError?.();
              
              // Disconnect observer after error
              observerRef.current?.disconnect();
            };
            
            img.src = src;
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, threshold, rootMargin, onLoad, onError]);

  const backgroundImage = isLoaded && !hasError ? `url(${src})` : undefined;

  return {
    elementRef,
    backgroundImage,
    isLoaded,
    hasError
  };
};

// Utility to preload multiple images
export const preloadImages = (urls: string[]): Promise<void[]> => {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        })
    )
  );
};

// Hook for progressive image loading (low quality → high quality)
export const useProgressiveImage = (
  lowQualitySrc: string,
  highQualitySrc: string
) => {
  const [src, setSrc] = useState(lowQualitySrc);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSrc(lowQualitySrc);
    setIsLoading(true);

    const img = new Image();
    
    img.onload = () => {
      setSrc(highQualitySrc);
      setIsLoading(false);
    };
    
    img.src = highQualitySrc;

    return () => {
      img.onload = null;
    };
  }, [lowQualitySrc, highQualitySrc]);

  return { src, isLoading, blur: isLoading };
};