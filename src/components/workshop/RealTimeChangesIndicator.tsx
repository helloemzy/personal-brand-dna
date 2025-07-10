import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectActiveUsers } from '../../store/slices/realtimeSlice';
import TypingIndicator from '../realtime/TypingIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RootState } from '../../store';

interface RealTimeChangesIndicatorProps {
  context: string; // e.g., 'workshop-values', 'workshop-tone'
  className?: string;
  showUserAvatars?: boolean;
}

const RealTimeChangesIndicator: React.FC<RealTimeChangesIndicatorProps> = ({
  context,
  className = '',
  showUserAvatars = true
}) => {
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const activeUsers = useSelector(selectActiveUsers);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { on, off } = useWebSocket({ autoConnect: false });

  // Track recent changes
  useEffect(() => {
    const handleCollaborationEvent = (event: any) => {
      if (event.userId === currentUser?.id) return; // Don't show our own changes
      
      const change = {
        id: Date.now() + Math.random(),
        userId: event.userId,
        userName: event.userName || 'Someone',
        action: event.data?.action || 'made a change',
        timestamp: new Date(),
        context: event.context || context
      };

      setRecentChanges(prev => {
        const updated = [change, ...prev.slice(0, 4)]; // Keep last 5 changes
        return updated;
      });

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setRecentChanges(prev => prev.filter(c => c.id !== change.id));
      }, 5000);
    };

    on('collaboration_event', handleCollaborationEvent);
    return () => off('collaboration_event', handleCollaborationEvent);
  }, [context, currentUser?.id, on, off]);

  const getActionText = (action: string) => {
    switch (action) {
      case 'value_selected':
        return 'selected a value';
      case 'value_deselected':
        return 'deselected a value';
      case 'value_ranked':
        return 'ranked a value';
      case 'custom_value_added':
        return 'added a custom value';
      case 'tone_updated':
        return 'updated tone preferences';
      case 'persona_added':
        return 'added an audience persona';
      case 'persona_updated':
        return 'updated an audience persona';
      case 'persona_removed':
        return 'removed an audience persona';
      case 'writing_sample_updated':
        return 'updated the writing sample';
      case 'quiz_answer_submitted':
        return 'answered a quiz question';
      case 'step_changed':
        return 'moved to a different step';
      default:
        return 'made changes';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (activeUsers.length <= 1 && recentChanges.length === 0) {
    return null; // No collaboration happening
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Typing Indicator */}
      <TypingIndicator context={context} />

      {/* Recent Changes */}
      {recentChanges.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center mb-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Recent Changes
            </span>
          </div>
          <div className="space-y-1">
            {recentChanges.map((change) => (
              <div key={change.id} className="flex items-center space-x-2 text-xs text-blue-800 dark:text-blue-200">
                {showUserAvatars && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                    {change.userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1">
                  <span className="font-medium">{change.userName}</span>{' '}
                  {getActionText(change.action)}
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {formatTimeAgo(change.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Collaborators Info */}
      {activeUsers.length > 1 && (
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex -space-x-1">
            {activeUsers.slice(0, 3).map((user) => (
              <div
                key={user.userId}
                className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium"
                title={user.userName}
              >
                {user.userName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <span>
            {activeUsers.length === 2 ? '1 other person' : `${activeUsers.length - 1} others`} working on this workshop
          </span>
        </div>
      )}
    </div>
  );
};

export default RealTimeChangesIndicator;