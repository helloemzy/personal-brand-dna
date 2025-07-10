import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertCircle, RefreshCw, Home, Download, Trash2, HelpCircle, FileText, Bug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { workshopPersistence } from '../../services/workshopPersistenceService';
import { workshopSessionService } from '../../services/workshopSessionService';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId?: string | null;
  isRecovering: boolean;
  recoverAttempts: number;
  showDetailedError: boolean;
  showDiagnostics: boolean;
  diagnostics?: {
    storageUsed: number;
    lastSaveTime?: string;
    corruptedSessions?: string[];
    browserInfo: string;
  };
}

class WorkshopErrorBoundary extends Component<Props, State> {
  private maxRecoveryAttempts = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoverAttempts: 0,
      showDetailedError: false,
      showDiagnostics: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('WorkshopErrorBoundary caught an error:', error, errorInfo);
    }

    // Report to Sentry with workshop-specific context
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
        workshop: {
          step: this.getCurrentWorkshopStep(),
          sessionId: this.getSessionId(),
          hasLocalData: this.checkLocalData(),
        },
      },
      tags: {
        component: 'workshop-error-boundary',
        workshopError: true,
      },
    });

    // Gather diagnostics
    this.gatherDiagnostics();

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      eventId,
    });

    // Attempt automatic recovery
    if (this.state.recoverAttempts < this.maxRecoveryAttempts) {
      this.attemptAutomaticRecovery();
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private getCurrentWorkshopStep(): string {
    try {
      const state = localStorage.getItem('persist:workshop');
      if (state) {
        const parsed = JSON.parse(state);
        const workshop = JSON.parse(parsed.workshop || '{}');
        return workshop.currentStep?.toString() || 'unknown';
      }
    } catch {
      // Ignore errors
    }
    return 'unknown';
  }

  private getSessionId(): string | null {
    try {
      const state = localStorage.getItem('persist:workshop');
      if (state) {
        const parsed = JSON.parse(state);
        const workshop = JSON.parse(parsed.workshop || '{}');
        return workshop.sessionId || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private checkLocalData(): boolean {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.includes('workshop') || key.includes('persist')
      );
      return keys.length > 0;
    } catch {
      return false;
    }
  }

  private async gatherDiagnostics() {
    try {
      const storageUsed = new Blob(Object.values(localStorage)).size;
      const sessions = workshopSessionService.getAllSessions();
      const corruptedSessions = workshopSessionService.getCorruptedSessions();

      const lastSaveTime = workshopPersistence.getLastSaveTime();
      
      this.setState({
        diagnostics: {
          storageUsed,
          lastSaveTime: lastSaveTime ? new Date(lastSaveTime).toLocaleString() : undefined,
          corruptedSessions: corruptedSessions.length > 0 ? corruptedSessions : undefined,
          browserInfo: `${navigator.userAgent} - ${window.innerWidth}x${window.innerHeight}`,
        },
      });
    } catch (error) {
      console.error('Failed to gather diagnostics:', error);
    }
  }

  private async attemptAutomaticRecovery() {
    this.setState({ isRecovering: true, recoverAttempts: this.state.recoverAttempts + 1 });

    try {
      // Try to load last good state
      const lastGoodState = await workshopPersistence.loadState();
      if (lastGoodState) {
        console.log('Found last good state, attempting recovery...');
        
        // Clear error state and reload
        this.setState({ hasError: false, isRecovering: false });
        window.location.reload();
        return;
      }
    } catch (recoveryError) {
      console.error('Automatic recovery failed:', recoveryError);
    }

    this.setState({ isRecovering: false });
  }

  private handleClearAndRestart = async () => {
    if (window.confirm('This will clear all workshop data and start fresh. Are you sure?')) {
      try {
        // Clear all workshop-related data
        await workshopPersistence.clearAllData();
        workshopSessionService.clearAllSessions();
        
        // Clear specific localStorage keys
        const keysToRemove = Object.keys(localStorage).filter(key =>
          key.includes('workshop') || 
          key.includes('persist') ||
          key.includes('brandhouse')
        );
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Redirect to workshop start
        window.location.href = '/brand-house';
      } catch (error) {
        console.error('Failed to clear data:', error);
        alert('Failed to clear data. Please try refreshing the page.');
      }
    }
  };

  private handleLoadLastGoodState = async () => {
    try {
      const sessions = workshopSessionService.getAllSessions();
      if (sessions.length === 0) {
        alert('No previous sessions found.');
        return;
      }

      // Sort by last saved time and find the most recent valid session
      const validSessions = sessions
        .filter(session => session.data && session.lastSavedAt)
        .sort((a, b) => b.lastSavedAt - a.lastSavedAt);

      if (validSessions.length === 0) {
        alert('No valid sessions found.');
        return;
      }

      // Load the most recent valid session
      const latestSession = validSessions[0];
      const restored = await workshopSessionService.restoreSession(latestSession.id);
      
      if (restored) {
        window.location.href = '/brand-house';
      } else {
        alert('Failed to restore session. Please try clearing data and starting fresh.');
      }
    } catch (error) {
      console.error('Failed to load last good state:', error);
      alert('Failed to load previous session. Please try clearing data and starting fresh.');
    }
  };

  private handleExportErrorReport = () => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        name: this.state.error?.name,
      },
      errorInfo: this.state.errorInfo,
      eventId: this.state.eventId,
      diagnostics: this.state.diagnostics,
      workshopStep: this.getCurrentWorkshopStep(),
      sessionId: this.getSessionId(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    const blob = new Blob([JSON.stringify(errorReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-error-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  private handleContactSupport = () => {
    const subject = encodeURIComponent('Workshop Error Report');
    const body = encodeURIComponent(`
Error ID: ${this.state.eventId || 'N/A'}
Error: ${this.state.error?.message || 'Unknown error'}
Workshop Step: ${this.getCurrentWorkshopStep()}
Session ID: ${this.getSessionId() || 'N/A'}
Time: ${new Date().toLocaleString()}

Please describe what you were doing when the error occurred:
[Your description here]
    `);
    
    window.location.href = `mailto:support@brandpillar.ai?subject=${subject}&body=${body}`;
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            
            <h1 className="mt-4 text-2xl font-semibold text-center text-gray-900">
              Workshop Error Detected
            </h1>
            
            <p className="mt-2 text-center text-gray-600">
              We encountered an error in the workshop. Don't worry - your progress may still be recoverable.
            </p>

            {this.state.isRecovering && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />
                Attempting automatic recovery... (Attempt {this.state.recoverAttempts} of {this.maxRecoveryAttempts})
              </div>
            )}

            {/* Recovery Actions */}
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Recovery Options:</h3>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page (Try First)
              </button>

              <button
                onClick={this.handleLoadLastGoodState}
                className="w-full flex items-center justify-center px-4 py-3 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FileText className="w-4 h-4 mr-2" />
                Load Last Good Session
              </button>

              <button
                onClick={this.handleClearAndRestart}
                className="w-full flex items-center justify-center px-4 py-3 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Data & Start Fresh
              </button>

              <div className="flex gap-3">
                <button
                  onClick={this.handleExportErrorReport}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </button>

                <button
                  onClick={this.handleContactSupport}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </button>
              </div>
            </div>

            {/* Error Details Toggle */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => this.setState({ showDetailedError: !this.state.showDetailedError })}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
              >
                <Bug className="w-4 h-4 mr-1" />
                {this.state.showDetailedError ? 'Hide' : 'Show'} Technical Details
              </button>

              {this.state.showDetailedError && this.state.error && (
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 font-mono overflow-auto max-h-40">
                  <p className="font-semibold">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">Component Stack</summary>
                      <pre className="mt-1 whitespace-pre-wrap text-xs">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <button
                onClick={() => this.setState({ showDiagnostics: !this.state.showDiagnostics })}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
              >
                <FileText className="w-4 h-4 mr-1" />
                {this.state.showDiagnostics ? 'Hide' : 'Show'} Diagnostics
              </button>

              {this.state.showDiagnostics && this.state.diagnostics && (
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700">
                  <p><strong>Storage Used:</strong> {(this.state.diagnostics.storageUsed / 1024).toFixed(2)} KB</p>
                  {this.state.diagnostics.lastSaveTime && (
                    <p><strong>Last Save:</strong> {this.state.diagnostics.lastSaveTime}</p>
                  )}
                  {this.state.diagnostics.corruptedSessions && (
                    <p><strong>Corrupted Sessions:</strong> {this.state.diagnostics.corruptedSessions.length}</p>
                  )}
                  <details className="mt-1">
                    <summary className="cursor-pointer">Browser Info</summary>
                    <p className="mt-1 text-xs break-all">{this.state.diagnostics.browserInfo}</p>
                  </details>
                </div>
              )}
            </div>

            {/* Error ID */}
            {this.state.eventId && (
              <p className="mt-6 text-xs text-center text-gray-500">
                Error ID: {this.state.eventId}
              </p>
            )}

            {/* Home Link */}
            <div className="mt-6 text-center">
              <Link
                to="/"
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
              >
                <Home className="w-4 h-4 mr-1" />
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WorkshopErrorBoundary;