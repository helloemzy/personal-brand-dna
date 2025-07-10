/**
 * Image Optimization Utilities
 * Provides utilities for optimizing images in the browser
 */

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  preserveAspectRatio?: boolean;
}

/**
 * Compress and resize an image file
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'webp',
    preserveAspectRatio = true
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight,
          preserveAspectRatio
        );

        canvas.width = width;
        canvas.height = height;

        // Apply image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          `image/${format}`,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Calculate optimal dimensions while preserving aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  preserveAspectRatio: boolean
): { width: number; height: number } {
  if (!preserveAspectRatio) {
    return {
      width: Math.min(originalWidth, maxWidth),
      height: Math.min(originalHeight, maxHeight)
    };
  }

  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if necessary
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return sizes
    .map(size => `${baseUrl}?w=${size} ${size}w`)
    .join(', ');
}

/**
 * Generate picture element sources for different formats
 */
export function generatePictureSources(
  baseUrl: string,
  formats: string[] = ['webp', 'jpeg']
): Array<{ srcSet: string; type: string }> {
  return formats.map(format => ({
    srcSet: generateSrcSet(`${baseUrl}.${format}`),
    type: `image/${format}`
  }));
}

/**
 * Lazy load images with Intersection Observer
 */
export function lazyLoadImages(
  selector: string = 'img[data-lazy]',
  options: IntersectionObserverInit = {}
): () => void {
  const images = document.querySelectorAll<HTMLImageElement>(selector);
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.lazy;
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-lazy');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01,
      ...options
    });

    images.forEach(img => imageObserver.observe(img));
    
    return () => {
      images.forEach(img => imageObserver.unobserve(img));
    };
  } else {
    // Fallback for browsers without IntersectionObserver
    images.forEach(img => {
      const src = img.dataset.lazy;
      if (src) {
        img.src = src;
      }
    });
    
    return () => {};
  }
}

/**
 * Preload critical images
 */
export function preloadCriticalImages(urls: string[]): void {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    
    // Add different formats if supported
    if (url.includes('.')) {
      const extension = url.split('.').pop();
      if (extension) {
        link.type = `image/${extension}`;
      }
    }
    
    document.head.appendChild(link);
  });
}

/**
 * Convert image to base64 data URL
 */
export function imageToDataURL(
  file: File,
  maxSize: number = 50 * 1024 // 50KB
): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size > maxSize) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    
    reader.onerror = () => {
      resolve(null);
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Get optimal image format based on browser support
 */
export async function getOptimalImageFormat(): Promise<'webp' | 'jpeg'> {
  const webpSupported = await supportsWebP();
  return webpSupported ? 'webp' : 'jpeg';
}

/**
 * Image loading strategies based on viewport and connection
 */
export function getImageLoadingStrategy(): 'eager' | 'lazy' | 'auto' {
  // Check if user has reduced data usage preference
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    
    if (connection.saveData) {
      return 'lazy';
    }
    
    // Load eagerly on fast connections
    if (connection.effectiveType === '4g') {
      return 'eager';
    }
  }
  
  // Default to lazy loading
  return 'lazy';
}

/**
 * Create placeholder for lazy loaded images
 */
export function createPlaceholder(
  width: number,
  height: number,
  color: string = '#f3f4f6'
): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E`;
}

/**
 * Extract dominant color from image
 */
export function extractDominantColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return '#f3f4f6'; // Default gray
  }
  
  canvas.width = 1;
  canvas.height = 1;
  
  ctx.drawImage(img, 0, 0, 1, 1);
  
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  const r = pixel[0];
  const g = pixel[1];
  const b = pixel[2];
  
  return `rgb(${r}, ${g}, ${b})`;
}