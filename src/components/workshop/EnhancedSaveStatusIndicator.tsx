import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  WifiOff, 
  Wifi,
  Cloud,
  CloudOff,
  GitMerge
} from 'lucide-react';
import { toast } from '../Toast';

interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline';
  lastSaved?: Date;
  error?: string;
  conflictData?: {
    localVersion: number;
    remoteVersion: number;
    conflictType: 'data' | 'version' | 'timestamp';
  };
  retryCount?: number;
  isOnline?: boolean;
}

interface EnhancedSaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  onRetry?: () => void;
  onResolveConflict?: (resolution: 'local' | 'remote' | 'merge') => void;
  className?: string;
}

const EnhancedSaveStatusIndicator: React.FC<EnhancedSaveStatusIndicatorProps> = ({
  saveStatus,
  onRetry,
  onResolveConflict,
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation when status changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [saveStatus.status]);

  // Auto-hide success status after 3 seconds
  useEffect(() => {
    if (saveStatus.status === 'saved') {
      const timer = setTimeout(() => {
        setShowDetails(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus.status]);

  const getStatusConfig = () => {
    switch (saveStatus.status) {
      case 'saving':
        return {
          icon: RefreshCw,
          text: 'Saving...',
          className: 'text-blue-600 bg-blue-50 border-blue-200',
          iconClassName: 'animate-spin'
        };
      case 'saved':
        return {
          icon: Check,
          text: 'Saved',
          className: 'text-green-600 bg-green-50 border-green-200',
          iconClassName: 'animate-pulse'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          text: saveStatus.retryCount && saveStatus.retryCount > 0 
            ? `Error (Retry ${saveStatus.retryCount}/3)` 
            : 'Save failed',
          className: 'text-red-600 bg-red-50 border-red-200',
          iconClassName: 'animate-bounce'
        };
      case 'conflict':
        return {
          icon: GitMerge,
          text: 'Conflict detected',
          className: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          iconClassName: 'animate-pulse'
        };
      case 'offline':
        return {
          icon: saveStatus.isOnline ? CloudOff : WifiOff,
          text: saveStatus.isOnline ? 'Cloud sync disabled' : 'Offline mode',
          className: 'text-gray-600 bg-gray-50 border-gray-200',
          iconClassName: ''
        };
      default:
        return {
          icon: Clock,
          text: 'Auto-save enabled',
          className: 'text-gray-400 bg-gray-50 border-gray-200',
          iconClassName: ''
        };
    }
  };

  const handleConflictResolution = (resolution: 'local' | 'remote' | 'merge') => {
    onResolveConflict?.(resolution);
    setShowDetails(false);
    
    const resolutionMessages = {
      local: 'Used your local changes',
      remote: 'Used server version',
      merge: 'Merged changes automatically'
    };
    
    toast.success('Conflict resolved', resolutionMessages[resolution]);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffSecs < 30) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const shouldShowIndicator = saveStatus.status !== 'idle' || saveStatus.lastSaved;

  if (!shouldShowIndicator) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Main status indicator */}
      <div
        key={animationKey}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-300 cursor-pointer ${config.className}`}
        onClick={() => setShowDetails(!showDetails)}
        role="button"
        tabIndex={0}
        aria-label={`Save status: ${config.text}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setShowDetails(!showDetails);
          }
        }}
      >
        <Icon size={12} className={config.iconClassName} />
        <span>{config.text}</span>
        {saveStatus.lastSaved && (
          <span className="text-xs opacity-75">
            {formatRelativeTime(saveStatus.lastSaved)}
          </span>
        )}
        {(saveStatus.status === 'error' || saveStatus.status === 'conflict') && (
          <div className="w-2 h-2 bg-current rounded-full animate-ping" />
        )}
      </div>

      {/* Detailed status dropdown */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
          <div className="space-y-3">
            {/* Status details */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Save Status</span>
              <div className="flex items-center gap-1">
                {saveStatus.isOnline !== false && <Wifi size={14} className="text-green-500" />}
                <Cloud size={14} className={saveStatus.isOnline ? 'text-green-500' : 'text-gray-400'} />
              </div>
            </div>

            {/* Last saved info */}
            {saveStatus.lastSaved && (
              <div className="text-xs text-gray-600">
                Last saved: {saveStatus.lastSaved.toLocaleString()}
              </div>
            )}

            {/* Error details */}
            {saveStatus.status === 'error' && saveStatus.error && (
              <div className="space-y-2">
                <div className="text-sm text-red-600">Error Details:</div>
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                  {saveStatus.error}
                </div>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    Retry Save
                  </button>
                )}
              </div>
            )}

            {/* Conflict resolution */}
            {saveStatus.status === 'conflict' && saveStatus.conflictData && (
              <div className="space-y-3">
                <div className="text-sm text-yellow-600">Conflict Details:</div>
                <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded border">
                  Local version: {saveStatus.conflictData.localVersion}<br/>
                  Server version: {saveStatus.conflictData.remoteVersion}<br/>
                  Type: {saveStatus.conflictData.conflictType}
                </div>
                
                <div className="text-sm font-medium text-gray-900">Choose resolution:</div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleConflictResolution('local')}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Use My Changes
                  </button>
                  <button
                    onClick={() => handleConflictResolution('remote')}
                    className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                  >
                    Use Server Version
                  </button>
                  <button
                    onClick={() => handleConflictResolution('merge')}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Auto-Merge (Recommended)
                  </button>
                </div>
              </div>
            )}

            {/* Offline mode info */}
            {saveStatus.status === 'offline' && (
              <div className="text-xs text-gray-600">
                Your changes are saved locally and will sync when connection is restored.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSaveStatusIndicator;