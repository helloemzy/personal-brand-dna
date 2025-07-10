import React from 'react';
import { useLazyImage, useProgressiveImage } from '../hooks/useLazyImage';
import { Skeleton } from './LoadingSkeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  lowQualitySrc?: string;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onLoad?: () => void;
  onError?: () => void;
  showSkeleton?: boolean;
  skeletonClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  lowQualitySrc,
  aspectRatio,
  objectFit = 'cover',
  onLoad,
  onError,
  showSkeleton = true,
  skeletonClassName = '',
  className = '',
  style,
  ...props
}) => {
  const { imageSrc, imageRef, isLoading, hasError } = useLazyImage(src, {
    placeholder,
    onLoad,
    onError
  });

  const progressiveImage = useProgressiveImage(
    lowQualitySrc || placeholder || imageSrc,
    src
  );

  // Use progressive loading if lowQualitySrc is provided
  const finalSrc = lowQualitySrc ? progressiveImage.src : imageSrc;
  const isBlurred = lowQualitySrc ? progressiveImage.blur : false;

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
        style={{
          ...style,
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined
        }}
      >
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative" style={{ aspectRatio: aspectRatio ? `${aspectRatio}` : undefined }}>
      {showSkeleton && isLoading && (
        <div className="absolute inset-0">
          <Skeleton 
            variant="rectangular" 
            width="100%" 
            height="100%" 
            className={skeletonClassName}
          />
        </div>
      )}
      
      <img
        ref={imageRef}
        src={finalSrc}
        alt={alt}
        className={`${className} ${isBlurred ? 'filter blur-sm' : ''} transition-all duration-300`}
        style={{
          ...style,
          objectFit,
          opacity: isLoading ? 0 : 1
        }}
        loading="lazy"
        {...props}
      />
    </div>
  );
};

// Optimized background image component
interface LazyBackgroundImageProps {
  src: string;
  lowQualitySrc?: string;
  className?: string;
  children?: React.ReactNode;
  overlay?: boolean;
  overlayOpacity?: number;
}

export const LazyBackgroundImage: React.FC<LazyBackgroundImageProps> = ({
  src,
  lowQualitySrc,
  className = '',
  children,
  overlay = false,
  overlayOpacity = 0.5
}) => {
  const { imageSrc, imageRef, isLoading } = useLazyImage(src, {
    placeholder: lowQualitySrc
  });

  return (
    <div
      ref={imageRef as any}
      className={`relative bg-cover bg-center ${className}`}
      style={{
        backgroundImage: `url(${imageSrc})`,
        transition: 'background-image 0.3s ease-in-out'
      }}
    >
      {overlay && (
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      
      {isLoading && (
        <div className="absolute inset-0">
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </div>
      )}
      
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
};

// Picture element for responsive images
interface ResponsiveImageProps {
  sources: Array<{
    srcSet: string;
    media?: string;
    type?: string;
  }>;
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: number;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  sources,
  src,
  alt,
  className,
  aspectRatio
}) => {
  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <LazyImage
        src={src}
        alt={alt}
        className={className}
        aspectRatio={aspectRatio}
      />
    </picture>
  );
};

// Image with blur hash placeholder
interface BlurHashImageProps extends LazyImageProps {
  blurHash?: string;
  blurHashWidth?: number;
  blurHashHeight?: number;
}

export const BlurHashImage: React.FC<BlurHashImageProps> = ({
  blurHash,
  blurHashWidth = 32,
  blurHashHeight = 32,
  ...props
}) => {
  // In a real implementation, you would decode the blur hash here
  // For now, we'll use a placeholder
  const placeholder = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="${blurHashWidth}" height="${blurHashHeight}"%3E%3Crect width="${blurHashWidth}" height="${blurHashHeight}" fill="%23e5e7eb"/%3E%3C/svg%3E`;

  return <LazyImage {...props} placeholder={placeholder} />;
};