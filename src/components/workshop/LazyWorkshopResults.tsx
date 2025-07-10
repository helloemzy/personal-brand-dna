import React, { Suspense } from 'react';
import { lazyWithRetry } from '../../utils/lazyWithPreload';
import LoadingSpinner from '../LoadingSpinner';

// Lazy load the WorkshopResultsPage with retry capability
const WorkshopResultsPage = lazyWithRetry(() => 
  import('../../pages/WorkshopResultsPage')
);

// Skeleton loader specifically for results page
const ResultsPageSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header skeleton */}
      <div className="text-center mb-12">
        <div className="h-10 w-64 bg-gray-200 rounded-lg mx-auto mb-4 animate-pulse" />
        <div className="h-6 w-96 bg-gray-200 rounded mx-auto animate-pulse" />
      </div>

      {/* Archetype card skeleton */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Mission statement skeleton */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 mb-8">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-11/12 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Content pillars skeleton */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="flex justify-center gap-4">
        <div className="h-12 w-40 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-12 w-40 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  </div>
);

// Enhanced loading component with progress indicator
const EnhancedLoadingFallback = () => {
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  React.useEffect(() => {
    // Show skeleton after 200ms to avoid flash for fast loads
    const timer = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!showSkeleton) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return <ResultsPageSkeleton />;
};

// Error boundary for failed loads
class ResultsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Failed to load results
            </h2>
            <p className="text-gray-600 mb-4">
              There was an error loading your results. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main lazy component with all enhancements
const LazyWorkshopResults: React.FC = () => {
  return (
    <ResultsErrorBoundary>
      <Suspense fallback={<EnhancedLoadingFallback />}>
        <WorkshopResultsPage />
      </Suspense>
    </ResultsErrorBoundary>
  );
};

// Export the component and the preload function
export default LazyWorkshopResults;
export { WorkshopResultsPage };