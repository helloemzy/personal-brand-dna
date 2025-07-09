import * as Sentry from '@sentry/react';
import { AlertCircle } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Sentry-enhanced error boundary with additional features
 * This wraps our custom ErrorBoundary with Sentry's HOC for better integration
 */
const SentryErrorBoundary = Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: ({ error, resetError }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Application Error</h1>
        <p className="mt-2 text-sm text-gray-600">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={resetError}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    </div>
  ),
  showDialog: true,
  beforeCapture: (scope, error) => {
    // Add additional context before capturing
    scope.setTag('ui.component', 'error-boundary');
    scope.setContext('error_boundary', {
      component: 'SentryErrorBoundary',
      timestamp: new Date().toISOString(),
    });
  },
});

export default SentryErrorBoundary;