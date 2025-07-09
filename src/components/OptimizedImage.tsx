import React, { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  srcSet?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  sizes,
  srcSet,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use Intersection Observer for truly lazy loading
  useEffect(() => {
    if (priority || loading === 'eager' || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before the image enters viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading]);

  // Preload priority images
  useEffect(() => {
    if (priority && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      if (srcSet) {
        link.setAttribute('imagesrcset', srcSet);
      }
      if (sizes) {
        link.setAttribute('imagesizes', sizes);
      }
      document.head.appendChild(link);
    }
  }, [priority, src, srcSet, sizes]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  // Generate srcSet for responsive images if not provided
  const generateSrcSet = () => {
    if (srcSet) return srcSet;
    
    // If src contains optimization parameters, generate srcSet
    if (src.includes('w=') || src.includes('q=')) {
      const widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
      return widths
        .map((w) => {
          const url = new URL(src, window.location.origin);
          url.searchParams.set('w', w.toString());
          return `${url.toString()} ${w}w`;
        })
        .join(', ');
    }
    
    return undefined;
  };

  // Generate sizes attribute if not provided
  const generateSizes = () => {
    if (sizes) return sizes;
    
    return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
  };

  // Default blur placeholder
  const defaultBlurDataURL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cfilter id="b"%3E%3CfeGaussianBlur stdDeviation="3"/%3E%3C/filter%3E%3Crect width="100" height="100" fill="%23f3f4f6" filter="url(%23b)"/%3E%3C/svg%3E';

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
        backgroundColor: hasError ? '#ef4444' : undefined
      }}
    >
      {/* Placeholder */}
      {!isLoaded && placeholder === 'blur' && (
        <div
          className="absolute inset-0 z-10"
          style={{
            backgroundImage: `url(${blurDataURL || defaultBlurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)'
          }}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-500">Failed to load image</p>
          </div>
        </div>
      )}

      {/* Actual image */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          srcSet={generateSrcSet()}
          sizes={generateSizes()}
          onLoad={handleLoad}
          onError={handleError}
          className={`
            ${!isLoaded ? 'opacity-0' : 'opacity-100'}
            transition-opacity duration-300 ease-in-out
            ${className}
          `}
          style={{
            width: width ? `${width}px` : '100%',
            height: height ? `${height}px` : 'auto',
            objectFit: 'cover'
          }}
        />
      )}

      {/* Loading skeleton */}
      {!isLoaded && !hasError && placeholder === 'empty' && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

// Hook for preloading images
export function useImagePreloader(imageSrcs: string[]) {
  useEffect(() => {
    const preloadImage = (src: string) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });
    };

    // Preload images in the background
    imageSrcs.forEach((src) => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          preloadImage(src).catch(console.error);
        });
      } else {
        setTimeout(() => {
          preloadImage(src).catch(console.error);
        }, 1);
      }
    });
  }, [imageSrcs]);
}

// Progressive image component
export const ProgressiveImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  thumbnailSrc?: string;
}> = ({ src, alt, className, thumbnailSrc }) => {
  const [currentSrc, setCurrentSrc] = useState(thumbnailSrc || src);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!thumbnailSrc) return;

    // Load full resolution image
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
  }, [src, thumbnailSrc]);

  return (
    <div className={`relative ${className}`}>
      <img
        src={currentSrc}
        alt={alt}
        className={`
          w-full h-full object-cover
          ${isLoading && thumbnailSrc ? 'filter blur-sm scale-105' : ''}
          transition-all duration-300
        `}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse opacity-50" />
      )}
    </div>
  );
};

export default OptimizedImage;