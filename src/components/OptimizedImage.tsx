import React, { useState, useEffect } from 'react';
import { LazyImage } from './LazyImage';
import { 
  generateSrcSet, 
  generatePictureSources, 
  getOptimalImageFormat,
  createPlaceholder,
  supportsWebP
} from '../utils/imageOptimization';
import { performanceMonitor } from '../utils/performanceMonitor';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  formats?: string[];
  breakpoints?: number[];
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  quality = 80,
  className = '',
  onLoad,
  onError,
  objectFit = 'cover',
  formats = ['webp', 'jpeg'],
  breakpoints = [320, 640, 768, 1024, 1280, 1920]
}) => {
  const [optimalFormat, setOptimalFormat] = useState<'webp' | 'jpeg'>('jpeg');
  const [isWebPSupported, setIsWebPSupported] = useState(false);
  
  useEffect(() => {
    // Check WebP support
    supportsWebP().then(supported => {
      setIsWebPSupported(supported);
      if (supported) {
        setOptimalFormat('webp');
      }
    });
    
    // Get optimal format based on browser
    getOptimalImageFormat().then(format => {
      setOptimalFormat(format);
    });
  }, []);

  // Generate placeholder
  const placeholder = width && height 
    ? createPlaceholder(width, height)
    : undefined;

  // Handle image load with performance tracking
  const handleLoad = () => {
    performanceMonitor.mark(`image-loaded-${src}`);
    onLoad?.();
  };

  // Priority images should not be lazy loaded
  if (priority) {
    return (
      <picture>
        {isWebPSupported && (
          <source
            type="image/webp"
            srcSet={generateSrcSet(`${src}?format=webp&q=${quality}`, breakpoints)}
            sizes={sizes}
          />
        )}
        <source
          type="image/jpeg"
          srcSet={generateSrcSet(`${src}?format=jpeg&q=${quality}`, breakpoints)}
          sizes={sizes}
        />
        <img
          src={`${src}?format=${optimalFormat}&q=${quality}&w=${width || 1920}`}
          alt={alt}
          width={width}
          height={height}
          className={className}
          onLoad={handleLoad}
          onError={onError}
          style={{ objectFit }}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    );
  }

  // Non-priority images use lazy loading
  return (
    <picture>
      {formats.map(format => (
        <source
          key={format}
          type={`image/${format}`}
          srcSet={generateSrcSet(`${src}?format=${format}&q=${quality}`, breakpoints)}
          sizes={sizes}
        />
      ))}
      <LazyImage
        src={`${src}?format=${optimalFormat}&q=${quality}&w=${width || 1920}`}
        alt={alt}
        className={className}
        placeholder={placeholder}
        aspectRatio={width && height ? width / height : undefined}
        objectFit={objectFit}
        onLoad={handleLoad}
        onError={onError}
      />
    </picture>
  );
};

// Hero image component with critical loading
export const HeroImage: React.FC<OptimizedImageProps> = (props) => {
  useEffect(() => {
    // Preload hero image
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = `${props.src}?format=webp&q=${props.quality || 90}&w=1920`;
    link.type = 'image/webp';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, [props.src, props.quality]);

  return <OptimizedImage {...props} priority={true} quality={90} />;
};

// Thumbnail component with lower quality
export const ThumbnailImage: React.FC<OptimizedImageProps> = (props) => {
  return (
    <OptimizedImage 
      {...props} 
      quality={60}
      breakpoints={[160, 320, 480]}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    />
  );
};

// Avatar component with circular crop
interface AvatarImageProps extends Omit<OptimizedImageProps, 'width' | 'height'> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96
  };
  
  const dimension = sizeMap[size];
  
  return (
    <OptimizedImage
      {...props}
      width={dimension}
      height={dimension}
      className={`rounded-full ${className}`}
      objectFit="cover"
      breakpoints={[dimension, dimension * 2]}
      sizes={`${dimension}px`}
    />
  );
};