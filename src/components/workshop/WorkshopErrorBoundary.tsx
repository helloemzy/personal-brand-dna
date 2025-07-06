import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class WorkshopErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workshop Error Boundary caught an error:', error, errorInfo);
    
    // Log additional debugging information
    try {
      const persistRoot = localStorage.getItem('persist:root');
      if (persistRoot) {
        const parsed = JSON.parse(persistRoot);
        console.error('Persisted workshop state:', parsed.workshop);
      }
      
      // Log Redux state if available
      if (window.__REDUX_DEVTOOLS_EXTENSION__) {
        console.error('Redux DevTools detected - check state there');
      }
    } catch (e) {
      console.error('Error accessing debug info:', e);
    }
    
    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error reporting service like Sentry
    }
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    // Clear persisted workshop state more thoroughly
    try {
      // Get the root persist data
      const persistRoot = localStorage.getItem('persist:root');
      if (persistRoot) {
        const parsed = JSON.parse(persistRoot);
        // Remove only the workshop data while preserving other state
        if (parsed.workshop) {
          delete parsed.workshop;
          localStorage.setItem('persist:root', JSON.stringify(parsed));
        }
      }
      
      // Also clear any standalone workshop persistence (legacy)
      localStorage.removeItem('persist:workshop');
      
      // Clear any temporary workshop data
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('workshop_') || key.startsWith('brandhouse_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Failed to clear persisted state:', e);
    }
    
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Something went wrong
              </h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              We encountered an error while loading the Brand House workshop. 
              This might be due to corrupted data or a temporary issue.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error details (development only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reset Workshop
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WorkshopErrorBoundary;