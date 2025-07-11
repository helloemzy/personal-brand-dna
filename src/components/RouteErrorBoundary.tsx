import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  routeName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Universal error boundary for protecting routes
 * Logs errors to Sentry and shows user-friendly error messages
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { routeName = 'Unknown Route' } = this.props;
    
    // Log error to console in development
    logger.error(`Error in ${routeName}:`, error, errorInfo);
    
    // Send to Sentry with context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true);
      scope.setTag('routeName', routeName);
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'RouteErrorBoundary',
        route: routeName,
      });
      Sentry.captureException(error);
    });
    
    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const { error, errorId } = this.state;
    const subject = encodeURIComponent(`Bug Report: ${error?.message || 'Unknown Error'}`);
    const body = encodeURIComponent(`
Error ID: ${errorId}
Route: ${this.props.routeName || 'Unknown'}
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}

Please describe what you were doing when this error occurred:
[Your description here]
    `);
    
    window.open(`mailto:support@brandpillar.ai?subject=${subject}&body=${body}`, '_blank');
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state;
      const { fallback, routeName } = this.props;
      
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }
      
      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            
            <h1 className="mt-4 text-xl font-semibold text-center text-gray-900">
              Oops! Something went wrong
            </h1>
            
            <p className="mt-2 text-sm text-center text-gray-600">
              We're sorry, but something unexpected happened{routeName ? ` on ${routeName}` : ''}.
            </p>
            
            {/* Error details in development */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}
            
            {/* Error ID for support */}
            {errorId && (
              <p className="mt-4 text-xs text-center text-gray-500">
                Error ID: <code className="font-mono">{errorId}</code>
              </p>
            )}
            
            {/* Recovery actions */}
            <div className="mt-6 space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reload Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </button>
              
              <button
                onClick={this.handleReportBug}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                <Bug className="w-4 h-4 mr-2" />
                Report This Issue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for routes
export const withRouteErrorBoundary = (
  Component: React.ComponentType<any>,
  routeName?: string
) => {
  return (props: any) => (
    <RouteErrorBoundary routeName={routeName}>
      <Component {...props} />
    </RouteErrorBoundary>
  );
};