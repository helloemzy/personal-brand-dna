import React, { useState, useEffect } from 'react';
import { Activity, Database, HardDrive, Cpu, Clock, AlertCircle } from 'lucide-react';
import { workshopPersistence } from '../services/workshopPersistenceService';
import { workshopSessionService } from '../services/workshopSessionService';

interface DiagnosticInfo {
  storageUsed: number;
  storageLimit: number;
  sessionCount: number;
  corruptedSessions: number;
  lastSaveTime?: string;
  performanceMetrics: {
    saveTime: number;
    loadTime: number;
    avgResponseTime: number;
  };
  browserInfo: {
    userAgent: string;
    language: string;
    cookiesEnabled: boolean;
    onLine: boolean;
    platform: string;
  };
}

const DiagnosticTools: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      gatherDiagnostics();
    }
  }, [isOpen]);

  const gatherDiagnostics = async () => {
    try {
      // Calculate storage usage
      let storageUsed = 0;
      for (const key in localStorage) {
        const item = localStorage.getItem(key);
        if (item) {
          storageUsed += new Blob([item]).size;
        }
      }

      // Get sessions info
      const sessions = workshopSessionService.getAllSessions();
      const sessionStats = workshopSessionService.getSessionStats();
      const corruptedSessions = sessionStats.corrupted;

      // Get last save time
      const lastSaveTime = workshopPersistence.getLastSaveTime();

      // Performance metrics (mock data - would be real in production)
      const performanceMetrics = {
        saveTime: Math.random() * 100 + 50, // 50-150ms
        loadTime: Math.random() * 200 + 100, // 100-300ms
        avgResponseTime: Math.random() * 50 + 20, // 20-70ms
      };

      // Browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        platform: navigator.platform,
      };

      setDiagnostics({
        storageUsed,
        storageLimit: 10 * 1024 * 1024, // 10MB typical limit
        sessionCount: sessions.length,
        corruptedSessions,
        lastSaveTime: lastSaveTime ? new Date(lastSaveTime).toLocaleString() : undefined,
        performanceMetrics,
        browserInfo,
      });
    } catch (error) {
      console.error('Failed to gather diagnostics:', error);
    }
  };

  const handleClearCache = () => {
    if (window.confirm('This will clear all cached data. Are you sure?')) {
      try {
        // Clear specific workshop cache keys
        const keysToRemove = Object.keys(localStorage).filter(key =>
          key.includes('cache') || key.includes('temp')
        );
        keysToRemove.forEach(key => localStorage.removeItem(key));
        alert('Cache cleared successfully');
        gatherDiagnostics();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        alert('Failed to clear cache');
      }
    }
  };

  const handleExportDiagnostics = () => {
    if (!diagnostics) return;

    const report = {
      timestamp: new Date().toISOString(),
      diagnostics,
      workshopState: {
        persistenceEnabled: true,
        debugMode: isDebugMode,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDebugMode = () => {
    const newDebugMode = !isDebugMode;
    setIsDebugMode(newDebugMode);
    
    // Store debug mode preference
    if (newDebugMode) {
      localStorage.setItem('workshop_debug_mode', 'true');
      window.WORKSHOP_DEBUG = true;
    } else {
      localStorage.removeItem('workshop_debug_mode');
      window.WORKSHOP_DEBUG = false;
    }
  };

  return (
    <>
      {/* Floating Diagnostic Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-40"
        title="Diagnostic Tools"
      >
        <Activity className="w-5 h-5" />
      </button>

      {/* Diagnostic Panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Diagnostic Tools</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {diagnostics ? (
            <div className="space-y-4">
              {/* Storage Info */}
              <div className="border-b pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Storage</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>Used: {(diagnostics.storageUsed / 1024).toFixed(2)} KB / {(diagnostics.storageLimit / 1024 / 1024).toFixed(0)} MB</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(diagnostics.storageUsed / diagnostics.storageLimit) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="border-b pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Sessions</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>Total: {diagnostics.sessionCount}</p>
                  {diagnostics.corruptedSessions > 0 && (
                    <p className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Corrupted: {diagnostics.corruptedSessions}
                    </p>
                  )}
                  {diagnostics.lastSaveTime && (
                    <p>Last save: {diagnostics.lastSaveTime}</p>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="border-b pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Performance</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>Save time: {diagnostics.performanceMetrics.saveTime.toFixed(0)}ms</p>
                  <p>Load time: {diagnostics.performanceMetrics.loadTime.toFixed(0)}ms</p>
                  <p>Avg response: {diagnostics.performanceMetrics.avgResponseTime.toFixed(0)}ms</p>
                </div>
              </div>

              {/* Browser Info */}
              <div className="border-b pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Environment</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>Platform: {diagnostics.browserInfo.platform}</p>
                  <p>Language: {diagnostics.browserInfo.language}</p>
                  <p>Online: {diagnostics.browserInfo.onLine ? 'Yes' : 'No'}</p>
                  <p>Cookies: {diagnostics.browserInfo.cookiesEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDebugMode}
                    onChange={toggleDebugMode}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Debug Mode</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={handleClearCache}
                    className="flex-1 px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                  >
                    Clear Cache
                  </button>
                  <button
                    onClick={handleExportDiagnostics}
                    className="flex-1 px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                  >
                    Export Report
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Gathering diagnostics...</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// Add to window for global access
declare global {
  interface Window {
    WORKSHOP_DEBUG?: boolean;
  }
}

export default DiagnosticTools;