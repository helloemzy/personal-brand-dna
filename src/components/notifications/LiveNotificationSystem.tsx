import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectNotifications, 
  addNotification,
  markNotificationRead,
  clearNotifications
} from '../../store/slices/realtimeSlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RootState } from '../../store';
import { formatDistanceToNow } from 'date-fns';

interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

interface LiveNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'collaboration' | 'achievement' | 'system';
  title: string;
  message: string;
  duration?: number; // Auto-dismiss after this many ms (0 = persistent)
  actions?: NotificationAction[];
  userId?: string;
  userName?: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  relatedUrl?: string;
  avatar?: string;
}

interface LiveNotificationSystemProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  maxVisible?: number;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
  className?: string;
}

const LiveNotificationSystem: React.FC<LiveNotificationSystemProps> = ({
  position = 'top-right',
  maxVisible = 5,
  enableSound = true,
  enableBrowserNotifications = true,
  className = ''
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<LiveNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);
  const user = useSelector((state: RootState) => state.auth.user);
  const { isConnected, on, off } = useWebSocket({ autoConnect: false });

  // Request browser notification permission
  useEffect(() => {
    if (enableBrowserNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setBrowserNotificationsEnabled(permission === 'granted');
        });
      } else {
        setBrowserNotificationsEnabled(Notification.permission === 'granted');
      }
    }
  }, [enableBrowserNotifications]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!isConnected) return;

    const handleLiveNotification = (notification: Omit<LiveNotification, 'id' | 'timestamp' | 'read'>) => {
      const newNotification: LiveNotification = {
        ...notification,
        id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false
      };

      // Add to Redux store
      dispatch(addNotification(newNotification));
      
      // Show in live notification system
      showLiveNotification(newNotification);
    };

    // Listen for different types of notifications
    on('notification', handleLiveNotification);
    on('collaboration_notification', handleLiveNotification);
    on('system_notification', handleLiveNotification);
    on('achievement_notification', handleLiveNotification);

    return () => {
      off('notification', handleLiveNotification);
      off('collaboration_notification', handleLiveNotification);
      off('system_notification', handleLiveNotification);
      off('achievement_notification', handleLiveNotification);
    };
  }, [isConnected, dispatch, on, off]);

  // Show live notification
  const showLiveNotification = (notification: LiveNotification) => {
    // Play sound if enabled
    if (soundEnabled && audioRef.current) {
      const soundMap = {
        success: '/sounds/success.mp3',
        error: '/sounds/error.mp3',
        warning: '/sounds/warning.mp3',
        collaboration: '/sounds/collaboration.mp3',
        achievement: '/sounds/achievement.mp3',
        system: '/sounds/system.mp3',
        info: '/sounds/info.mp3'
      };
      
      audioRef.current.src = soundMap[notification.type] || soundMap.info;
      audioRef.current.play().catch(() => {
        // Ignore audio play errors (user interaction required)
      });
    }

    // Show browser notification if enabled
    if (browserNotificationsEnabled && document.hidden) {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.avatar || '/icons/logo-192x192.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent'
      });
    }

    // Add to visible notifications
    setVisibleNotifications(prev => {
      const updated = [notification, ...prev].slice(0, maxVisible);
      return updated;
    });

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        dismissNotification(notification.id);
      }, notification.duration);
    }
  };

  // Dismiss notification
  const dismissNotification = (id: string) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Handle notification click
  const handleNotificationClick = (notification: LiveNotification) => {
    dispatch(markNotificationRead(notification.id));
    
    if (notification.relatedUrl) {
      window.location.href = notification.relatedUrl;
    }
    
    if (notification.actions && notification.actions.length === 1) {
      notification.actions[0].action();
    }
    
    dismissNotification(notification.id);
  };

  // Handle action click
  const handleActionClick = (action: NotificationAction, notificationId: string) => {
    action.action();
    dismissNotification(notificationId);
  };

  // Get notification style classes
  const getNotificationStyles = (type: string, priority: string) => {
    const baseClasses = 'max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out';
    
    const typeStyles = {
      success: 'bg-green-50 border-l-4 border-green-400',
      error: 'bg-red-50 border-l-4 border-red-400',
      warning: 'bg-yellow-50 border-l-4 border-yellow-400',
      info: 'bg-blue-50 border-l-4 border-blue-400',
      collaboration: 'bg-purple-50 border-l-4 border-purple-400',
      achievement: 'bg-indigo-50 border-l-4 border-indigo-400',
      system: 'bg-gray-50 border-l-4 border-gray-400'
    };

    const priorityStyles = {
      low: '',
      medium: 'ring-2 ring-opacity-20',
      high: 'ring-2 ring-opacity-40 shadow-xl',
      urgent: 'ring-4 ring-red-500 ring-opacity-60 shadow-2xl animate-pulse'
    };

    return `${baseClasses} ${typeStyles[type as keyof typeof typeStyles] || typeStyles.info} ${priorityStyles[priority as keyof typeof priorityStyles]}`;
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    const icons = {
      success: (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      error: (
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      warning: (
        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      collaboration: (
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      achievement: (
        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      system: (
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      info: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    };

    return icons[type as keyof typeof icons] || icons.info;
  };

  // Get position classes
  const getPositionClasses = () => {
    const positions = {
      'top-right': 'top-0 right-0 mt-4 mr-4',
      'top-left': 'top-0 left-0 mt-4 ml-4',
      'bottom-right': 'bottom-0 right-0 mb-4 mr-4',
      'bottom-left': 'bottom-0 left-0 mb-4 ml-4',
      'top-center': 'top-0 left-1/2 transform -translate-x-1/2 mt-4'
    };

    return positions[position];
  };

  if (visibleNotifications.length === 0) {
    return (
      <>
        {/* Hidden audio element for notification sounds */}
        <audio ref={audioRef} preload="none" />
      </>
    );
  }

  return (
    <>
      {/* Hidden audio element for notification sounds */}
      <audio ref={audioRef} preload="none" />
      
      {/* Notification Container */}
      <div 
        className={`fixed z-50 space-y-3 ${getPositionClasses()} ${className}`}
        style={{ maxWidth: '400px' }}
      >
        {visibleNotifications.map((notification, index) => (
          <div
            key={notification.id}
            className={getNotificationStyles(notification.type, notification.priority)}
            style={{
              animationDelay: `${index * 100}ms`,
              animationName: 'slideIn',
              animationDuration: '300ms',
              animationFillMode: 'both'
            }}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.avatar ? (
                    <img 
                      src={notification.avatar} 
                      alt={notification.userName || 'User'} 
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="flex">
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                </div>
                
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {notification.message}
                  </p>
                  
                  {notification.userName && (
                    <p className="mt-1 text-xs text-gray-400">
                      from {notification.userName} • {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </p>
                  )}
                  
                  {/* Actions */}
                  {notification.actions && notification.actions.length > 0 && (
                    <div className="mt-3 flex space-x-2">
                      {notification.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => handleActionClick(action, notification.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            action.style === 'primary' 
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : action.style === 'danger'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Settings Toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-xs text-gray-500 hover:text-gray-700 mr-3"
            title={`${soundEnabled ? 'Disable' : 'Enable'} notification sounds`}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          
          {visibleNotifications.length > 1 && (
            <button
              onClick={() => setVisibleNotifications([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default LiveNotificationSystem;