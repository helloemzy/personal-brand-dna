import React from 'react';

interface LazyLoadingFallbackProps {
  message?: string;
  showSpinner?: boolean;
  minHeight?: string;
}

const LazyLoadingFallback: React.FC<LazyLoadingFallbackProps> = ({ 
  message = "Loading...",
  showSpinner = true,
  minHeight = "200px"
}) => {
  return (
    <div 
      className="flex flex-col items-center justify-center p-8"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      {showSpinner && (
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 animate-pulse"></div>
          </div>
        </div>
      )}
      <p className="mt-4 text-gray-600 text-sm font-medium">{message}</p>
      
      {/* Skeleton loader for better perceived performance */}
      <div className="mt-6 w-full max-w-md space-y-3">
        <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
      </div>
    </div>
  );
};

// Specific loading fallbacks for different sections
export const WorkshopLoadingFallback: React.FC = () => (
  <LazyLoadingFallback 
    message="Loading workshop step..." 
    minHeight="400px"
  />
);

export const DashboardLoadingFallback: React.FC = () => (
  <LazyLoadingFallback 
    message="Loading dashboard..." 
    minHeight="600px"
  />
);

export const AnalyticsLoadingFallback: React.FC = () => (
  <LazyLoadingFallback 
    message="Loading analytics..." 
    minHeight="500px"
  />
);

export const ContentLoadingFallback: React.FC = () => (
  <LazyLoadingFallback 
    message="Loading content tools..." 
    minHeight="400px"
  />
);

// Page-specific skeleton loaders
export const PageSkeleton: React.FC<{ title?: string }> = ({ title }) => (
  <div className="animate-pulse">
    <div className="bg-white rounded-lg shadow-sm p-6">
      {title && (
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
      )}
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default LazyLoadingFallback;