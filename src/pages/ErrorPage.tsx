import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { AlertTriangle, Home, RefreshCw, Send } from 'lucide-react';
import { captureError } from '../config/sentry';

interface ErrorPageProps {
  error?: Error;
  resetError?: () => void;
}

/**
 * Custom error page with Sentry integration
 * Provides user-friendly error handling with reporting capabilities
 */
const ErrorPage: React.FC<ErrorPageProps> = ({ error, resetError }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [eventId, setEventId] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    // Capture the error to Sentry if we have one
    if (error) {
      const id = Sentry.captureException(error, {
        tags: {
          location: location.pathname,
          component: 'error-page',
        },
        contexts: {
          navigation: {
            from: document.referrer,
            to: location.pathname,
          },
        },
      });
      setEventId(id);
    }
  }, [error, location]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleTryAgain = () => {
    if (resetError) {
      resetError();
    } else {
      navigate(-1);
    }
  };

  const handleSendReport = async () => {
    if (!eventId) return;

    setIsReporting(true);
    try {
      // Show Sentry's built-in feedback dialog
      Sentry.showReportDialog({
        eventId,
        onLoad: () => {
          setShowReportDialog(true);
        },
        onClose: () => {
          setShowReportDialog(false);
          setReportSent(true);
          setIsReporting(false);
        },
      });
    } catch (err) {
      console.error('Failed to show report dialog:', err);
      setIsReporting(false);
    }
  };

  // Determine error message and type
  const getErrorInfo = () => {
    if (!error) {
      return {
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Please try again.',
        type: 'generic',
      };
    }

    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        title: 'Connection Problem',
        message: 'Unable to connect to our servers. Please check your internet connection and try again.',
        type: 'network',
      };
    }

    // Permission errors
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to access this resource. Please log in or contact support.',
        type: 'permission',
      };
    }

    // Not found errors
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return {
        title: 'Page Not Found',
        message: 'The page you\'re looking for doesn\'t exist or has been moved.',
        type: 'notfound',
      };
    }

    // Default error
    return {
      title: 'Application Error',
      message: error.message || 'An unexpected error occurred. Our team has been notified.',
      type: 'application',
    };
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Error Header */}
          <div className="bg-red-50 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {errorInfo.title}
            </h1>
            <p className="text-gray-600">
              {errorInfo.message}
            </p>
          </div>

          {/* Error Details (Development Only) */}
          {import.meta.env.DEV && error && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <details className="text-sm">
                <summary className="font-medium text-gray-700 cursor-pointer mb-2">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                  <p className="font-mono text-xs text-gray-800 break-all">
                    {error.stack || error.toString()}
                  </p>
                </div>
              </details>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleTryAgain}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>

              <button
                onClick={handleGoHome}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </button>

              {eventId && !reportSent && (
                <button
                  onClick={handleSendReport}
                  disabled={isReporting}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isReporting ? 'Opening Report Dialog...' : 'Send Error Report'}
                </button>
              )}

              {reportSent && (
                <div className="text-center text-sm text-green-600 font-medium">
                  ✓ Thank you! Your report has been sent.
                </div>
              )}
            </div>
          </div>

          {/* Error ID */}
          {eventId && (
            <div className="px-6 py-3 bg-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Error ID: <span className="font-mono">{eventId}</span>
              </p>
            </div>
          )}

          {/* Additional Help */}
          <div className="px-6 py-4 text-center text-sm text-gray-600">
            <p>
              Need help?{' '}
              <a
                href="mailto:support@brandpillar.ai"
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export wrapped with Sentry error boundary
export default Sentry.withErrorBoundary(ErrorPage, {
  fallback: ({ error }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Critical Error</h1>
        <p className="text-gray-600 mb-4">
          {error?.message || 'A critical error occurred'}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Return to Safety
        </button>
      </div>
    </div>
  ),
});