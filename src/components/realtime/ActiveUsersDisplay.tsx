import React from 'react';
import { useSelector } from 'react-redux';
import { selectActiveUsers, selectActiveUserCount } from '../../store/slices/realtimeSlice';
import { formatDistanceToNow } from 'date-fns';

interface ActiveUsersDisplayProps {
  variant?: 'full' | 'compact' | 'avatars';
  maxDisplay?: number;
  showStatus?: boolean;
  showLastSeen?: boolean;
  className?: string;
}

const ActiveUsersDisplay: React.FC<ActiveUsersDisplayProps> = ({
  variant = 'compact',
  maxDisplay = 5,
  showStatus = true,
  showLastSeen = false,
  className = ''
}) => {
  const activeUsers = useSelector(selectActiveUsers);
  const activeUserCount = useSelector(selectActiveUserCount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return '●';
      case 'away':
        return '◐';
      case 'busy':
        return '✕';
      default:
        return '○';
    }
  };

  const displayUsers = activeUsers.slice(0, maxDisplay);
  const remainingCount = Math.max(0, activeUserCount - maxDisplay);

  if (variant === 'avatars') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="flex -space-x-2">
          {displayUsers.map((user) => (
            <div
              key={user.userId}
              className="relative group"
              title={`${user.userName} - ${user.status}`}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.userName}
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium">
                  {user.userName.charAt(0).toUpperCase()}
                </div>
              )}
              {showStatus && (
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(
                    user.status
                  )}`}
                />
              )}
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {user.userName}
                {user.currentPage && (
                  <div className="text-gray-300">on {user.currentPage}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {remainingCount > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium">
            +{remainingCount}
          </div>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          {activeUserCount} online
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {activeUserCount} {activeUserCount === 1 ? 'user' : 'users'} online
          </span>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Active Users ({activeUserCount})
        </h3>
      </div>
      <div className="space-y-2">
        {displayUsers.map((user) => (
          <div
            key={user.userId}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.userName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                  {user.userName.charAt(0).toUpperCase()}
                </div>
              )}
              {showStatus && (
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(
                    user.status
                  )}`}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user.userName}
                </p>
                {showStatus && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getStatusIcon(user.status)}
                  </span>
                )}
              </div>
              {user.currentPage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.currentPage}
                </p>
              )}
              {showLastSeen && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })}
                </p>
              )}
            </div>
            {user.workshopStep !== undefined && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Step
                </span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {user.workshopStep}
                </span>
              </div>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-1">
            and {remainingCount} more...
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveUsersDisplay;