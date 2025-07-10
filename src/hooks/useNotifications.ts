import { useDispatch } from 'react-redux';
import { addNotification } from '../store/slices/realtimeSlice';
import { useWebSocket } from './useWebSocket';

interface NotificationOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'collaboration' | 'achievement' | 'system';
  duration?: number; // Auto-dismiss time in ms (0 = persistent)
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  relatedUrl?: string;
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  broadcastToOthers?: boolean; // Whether to send to other connected users
  context?: string; // Context for collaboration notifications
}

interface UseNotificationsReturn {
  showNotification: (options: NotificationOptions) => void;
  showSuccess: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showError: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showWarning: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showInfo: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showCollaboration: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showAchievement: (title: string, message: string, options?: Partial<NotificationOptions>) => void;
  showProgress: (title: string, message: string, progress: number) => void;
  askConfirmation: (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void
  ) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const dispatch = useDispatch();
  const { emit, isConnected } = useWebSocket({ autoConnect: false });

  const showNotification = (options: NotificationOptions) => {
    const notification = {
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      priority: options.priority || 'medium',
      duration: options.duration,
      category: options.category,
      relatedUrl: options.relatedUrl,
      actions: options.actions
    };

    // Add to local store
    dispatch(addNotification(notification));

    // Broadcast to other users if requested and connected
    if (options.broadcastToOthers && isConnected) {
      emit('broadcast_notification', {
        ...notification,
        context: options.context,
        senderName: 'You' // This would be replaced with actual user name in real implementation
      });
    }
  };

  const showSuccess = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'success',
      title,
      message,
      duration: 4000,
      priority: 'medium',
      ...options
    });
  };

  const showError = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'error',
      title,
      message,
      duration: 0, // Persistent for errors
      priority: 'high',
      ...options
    });
  };

  const showWarning = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'warning',
      title,
      message,
      duration: 6000,
      priority: 'medium',
      ...options
    });
  };

  const showInfo = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'info',
      title,
      message,
      duration: 5000,
      priority: 'low',
      ...options
    });
  };

  const showCollaboration = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'collaboration',
      title,
      message,
      duration: 3000,
      priority: 'medium',
      broadcastToOthers: true,
      ...options
    });
  };

  const showAchievement = (title: string, message: string, options: Partial<NotificationOptions> = {}) => {
    showNotification({
      type: 'achievement',
      title,
      message,
      duration: 8000,
      priority: 'high',
      ...options
    });
  };

  const showProgress = (title: string, message: string, progress: number) => {
    showNotification({
      type: 'info',
      title,
      message: `${message} (${Math.round(progress)}%)`,
      duration: 0, // Persistent until manually dismissed
      priority: 'low',
      category: 'progress'
    });
  };

  const askConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    showNotification({
      type: 'warning',
      title,
      message,
      duration: 0, // Persistent until action taken
      priority: 'high',
      actions: [
        {
          label: 'Confirm',
          action: onConfirm,
          style: 'primary'
        },
        {
          label: 'Cancel',
          action: onCancel || (() => {}),
          style: 'secondary'
        }
      ]
    });
  };

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showCollaboration,
    showAchievement,
    showProgress,
    askConfirmation
  };
};

// Pre-configured notification templates for common scenarios
export const notificationTemplates = {
  // Workshop related
  workshopSaved: () => ({
    type: 'success' as const,
    title: 'Progress Saved',
    message: 'Your workshop progress has been saved automatically',
    duration: 2000,
    priority: 'low' as const
  }),

  workshopCompleted: () => ({
    type: 'achievement' as const,
    title: 'Workshop Completed! 🎉',
    message: 'Congratulations! You have completed your Brand House workshop',
    duration: 8000,
    priority: 'high' as const
  }),

  collaboratorJoined: (name: string) => ({
    type: 'collaboration' as const,
    title: 'Collaborator Joined',
    message: `${name} has joined your workshop session`,
    duration: 4000,
    priority: 'medium' as const
  }),

  // Content related
  contentGenerated: () => ({
    type: 'success' as const,
    title: 'Content Generated',
    message: 'Your personalized content has been created successfully',
    duration: 5000,
    priority: 'medium' as const
  }),

  contentPublished: (platform: string) => ({
    type: 'success' as const,
    title: 'Content Published',
    message: `Your content has been published to ${platform}`,
    duration: 4000,
    priority: 'medium' as const
  }),

  // System related
  connectionLost: () => ({
    type: 'warning' as const,
    title: 'Connection Lost',
    message: 'Real-time features are temporarily unavailable',
    duration: 0,
    priority: 'high' as const
  }),

  connectionRestored: () => ({
    type: 'success' as const,
    title: 'Connection Restored',
    message: 'Real-time features are now available',
    duration: 3000,
    priority: 'medium' as const
  }),

  // Error scenarios
  uploadFailed: () => ({
    type: 'error' as const,
    title: 'Upload Failed',
    message: 'There was an error uploading your file. Please try again.',
    duration: 0,
    priority: 'high' as const
  }),

  apiError: (action: string) => ({
    type: 'error' as const,
    title: 'Operation Failed',
    message: `Unable to ${action}. Please check your connection and try again.`,
    duration: 0,
    priority: 'high' as const
  })
};