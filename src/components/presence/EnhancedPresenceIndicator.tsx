import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectActiveUsers } from '../../store/slices/realtimeSlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { RootState } from '../../store';

interface UserActivity {
  userId: string;
  userName: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'idle';
  lastActivity: Date;
  currentAction?: string;
  currentLocation?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  timezone?: string;
}

interface EnhancedPresenceIndicatorProps {
  context?: string; // Specific context like 'workshop', 'content-editor'
  showDetailedStatus?: boolean;
  showLastSeen?: boolean;
  showCurrentAction?: boolean;
  maxUsers?: number;
  layout?: 'horizontal' | 'vertical' | 'grid';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const EnhancedPresenceIndicator: React.FC<EnhancedPresenceIndicatorProps> = ({
  context,
  showDetailedStatus = true,
  showLastSeen = true,
  showCurrentAction = true,
  maxUsers = 10,
  layout = 'horizontal',
  size = 'medium',
  className = ''
}) => {
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const activeUsers = useSelector(selectActiveUsers);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { isConnected, emit, on, off, updatePresence } = useWebSocket({ autoConnect: false });

  // Track user activity and presence
  useEffect(() => {
    if (!isConnected || !currentUser) return;

    const updateActivity = (action: string) => {
      const activity: Partial<UserActivity> = {
        currentAction: action,
        lastActivity: new Date(),
        status: 'online',
        device: getDeviceType(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      updatePresence(activity);

      // Broadcast detailed activity
      emit('user_activity', {
        userId: currentUser.id,
        userName: currentUser.name || currentUser.email,
        ...activity,
        context
      });
    };

    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      updateActivity('navigating');
    };

    // Track keyboard activity
    const handleKeyPress = () => {
      updateActivity('typing');
    };

    // Track focus/blur for idle detection
    const handleFocus = () => {
      updateActivity('active');
      updatePresence({ status: 'online' });
    };

    const handleBlur = () => {
      updateActivity('away');
      updatePresence({ status: 'away' });
    };

    // Track page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateActivity('away');
        updatePresence({ status: 'away' });
      } else {
        updateActivity('active');
        updatePresence({ status: 'online' });
      }
    };

    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keypress', handleKeyPress);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial activity update
    updateActivity('joined');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, currentUser, context, emit, updatePresence]);

  // Listen for other users' activities
  useEffect(() => {
    if (!isConnected) return;

    const handleUserActivity = (activity: UserActivity) => {
      if (activity.userId === currentUser?.id) return; // Skip our own activities

      setUserActivities(prev => {
        const existingIndex = prev.findIndex(u => u.userId === activity.userId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...activity };
          return updated;
        } else {
          return [...prev, activity].slice(0, maxUsers);
        }
      });
    };

    on('user_activity', handleUserActivity);

    return () => {
      off('user_activity', handleUserActivity);
    };
  }, [isConnected, currentUser?.id, maxUsers, on, off]);

  // Clean up old activities
  useEffect(() => {
    const cleanup = setInterval(() => {
      setUserActivities(prev => 
        prev.filter(activity => 
          Date.now() - new Date(activity.lastActivity).getTime() < 5 * 60 * 1000 // 5 minutes
        )
      );
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, []);

  const getDeviceType = (): 'desktop' | 'mobile' | 'tablet' => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '💻';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'typing': return 'typing...';
      case 'navigating': return 'browsing';
      case 'active': return 'active';
      case 'away': return 'away';
      case 'joined': return 'just joined';
      default: return action;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small': return 'w-6 h-6 text-xs';
      case 'large': return 'w-12 h-12 text-lg';
      default: return 'w-8 h-8 text-sm';
    }
  };

  const allUsers = [
    ...activeUsers.map(user => ({
      userId: user.userId,
      userName: user.userName,
      avatar: user.avatar,
      status: user.status,
      lastActivity: new Date(user.lastSeen),
      currentLocation: user.currentPage,
      device: 'desktop' as const
    })),
    ...userActivities
  ].reduce((unique, user) => {
    const exists = unique.find(u => u.userId === user.userId);
    if (!exists) {
      unique.push(user);
    } else {
      // Merge data, preferring more recent activity
      Object.assign(exists, user);
    }
    return unique;
  }, [] as UserActivity[]).slice(0, maxUsers);

  if (allUsers.length === 0) {
    return null;
  }

  const layoutClasses = {
    horizontal: 'flex items-center space-x-2',
    vertical: 'flex flex-col space-y-2',
    grid: 'grid grid-cols-2 gap-2'
  };

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      {allUsers.map((user) => (
        <div
          key={user.userId}
          className="relative group"
          title={`${user.userName} - ${user.status}`}
        >
          <div className="relative">
            {/* User Avatar */}
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.userName}
                className={`${getSizeClasses()} rounded-full border-2 border-white dark:border-gray-800`}
              />
            ) : (
              <div className={`${getSizeClasses()} rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white font-medium`}>
                {user.userName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Status Indicator */}
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(user.status)}`}
            />

            {/* Device Indicator */}
            {user.device && size !== 'small' && (
              <div className="absolute -top-1 -right-1 text-xs">
                {getDeviceIcon(user.device)}
              </div>
            )}
          </div>

          {/* Detailed Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
            <div className="font-medium">{user.userName}</div>
            
            {showDetailedStatus && (
              <div className="text-gray-300 capitalize">
                {user.status} • {getDeviceIcon(user.device)}
              </div>
            )}
            
            {showCurrentAction && user.currentAction && (
              <div className="text-gray-300">
                {getActionText(user.currentAction)}
              </div>
            )}
            
            {user.currentLocation && (
              <div className="text-gray-300 truncate max-w-40">
                📍 {user.currentLocation}
              </div>
            )}
            
            {showLastSeen && (
              <div className="text-gray-400">
                {formatDistanceToNow(user.lastActivity, { addSuffix: true })}
              </div>
            )}

            {user.timezone && user.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
              <div className="text-gray-400">
                🌍 {user.timezone.split('/').pop()?.replace('_', ' ')}
              </div>
            )}

            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      ))}

      {/* Summary text for larger groups */}
      {layout === 'horizontal' && allUsers.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          {allUsers.length === 1 ? (
            `${allUsers[0].userName} is online`
          ) : (
            `${allUsers.length} people online`
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedPresenceIndicator;