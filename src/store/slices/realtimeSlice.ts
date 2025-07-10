import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ActiveUser {
  userId: string;
  userName: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy';
  lastSeen: Date;
  currentPage?: string;
  workshopStep?: number;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'collaboration';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface RealtimeState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'failed';
  activeUsers: Record<string, ActiveUser>;
  notifications: Notification[];
  unreadCount: number;
  collaborationEvents: any[];
  typing: {
    [key: string]: {
      userId: string;
      userName: string;
      timestamp: number;
    }[];
  };
}

const initialState: RealtimeState = {
  connectionStatus: 'disconnected',
  activeUsers: {},
  notifications: [],
  unreadCount: 0,
  collaborationEvents: [],
  typing: {}
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    // Connection management
    setConnectionStatus: (state, action: PayloadAction<RealtimeState['connectionStatus']>) => {
      state.connectionStatus = action.payload;
    },

    // User presence management
    addActiveUser: (state, action: PayloadAction<ActiveUser>) => {
      state.activeUsers[action.payload.userId] = action.payload;
    },

    removeActiveUser: (state, action: PayloadAction<string>) => {
      delete state.activeUsers[action.payload];
    },

    updatePresence: (state, action: PayloadAction<ActiveUser>) => {
      if (state.activeUsers[action.payload.userId]) {
        state.activeUsers[action.payload.userId] = {
          ...state.activeUsers[action.payload.userId],
          ...action.payload
        };
      }
    },

    clearActiveUsers: (state) => {
      state.activeUsers = {};
    },

    // Notification management
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false
      };
      state.notifications.unshift(notification);
      state.unreadCount++;
    },

    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    markAllNotificationsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },

    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },

    // Collaboration events
    addCollaborationEvent: (state, action: PayloadAction<any>) => {
      state.collaborationEvents.unshift(action.payload);
      // Keep only last 100 events
      if (state.collaborationEvents.length > 100) {
        state.collaborationEvents = state.collaborationEvents.slice(0, 100);
      }
    },

    // Typing indicators
    addTypingUser: (state, action: PayloadAction<{
      context: string;
      userId: string;
      userName: string;
    }>) => {
      const { context, userId, userName } = action.payload;
      if (!state.typing[context]) {
        state.typing[context] = [];
      }
      
      // Remove existing entry for this user
      state.typing[context] = state.typing[context].filter(t => t.userId !== userId);
      
      // Add new entry
      state.typing[context].push({
        userId,
        userName,
        timestamp: Date.now()
      });
    },

    removeTypingUser: (state, action: PayloadAction<{
      context: string;
      userId: string;
    }>) => {
      const { context, userId } = action.payload;
      if (state.typing[context]) {
        state.typing[context] = state.typing[context].filter(t => t.userId !== userId);
        if (state.typing[context].length === 0) {
          delete state.typing[context];
        }
      }
    },

    // Clean up old typing indicators (older than 3 seconds)
    cleanupTypingIndicators: (state) => {
      const now = Date.now();
      const timeout = 3000; // 3 seconds

      Object.keys(state.typing).forEach(context => {
        state.typing[context] = state.typing[context].filter(
          t => now - t.timestamp < timeout
        );
        if (state.typing[context].length === 0) {
          delete state.typing[context];
        }
      });
    },

    // Reset state
    resetRealtimeState: () => initialState
  }
});

export const {
  setConnectionStatus,
  addActiveUser,
  removeActiveUser,
  updatePresence,
  clearActiveUsers,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  addCollaborationEvent,
  addTypingUser,
  removeTypingUser,
  cleanupTypingIndicators,
  resetRealtimeState
} = realtimeSlice.actions;

export default realtimeSlice.reducer;

// Selectors
export const selectConnectionStatus = (state: { realtime: RealtimeState }) => 
  state.realtime.connectionStatus;

export const selectActiveUsers = (state: { realtime: RealtimeState }) => 
  Object.values(state.realtime.activeUsers);

export const selectActiveUserCount = (state: { realtime: RealtimeState }) => 
  Object.keys(state.realtime.activeUsers).length;

export const selectNotifications = (state: { realtime: RealtimeState }) => 
  state.realtime.notifications;

export const selectUnreadCount = (state: { realtime: RealtimeState }) => 
  state.realtime.unreadCount;

export const selectTypingUsers = (context: string) => (state: { realtime: RealtimeState }) => 
  state.realtime.typing[context] || [];

export const selectIsConnected = (state: { realtime: RealtimeState }) => 
  state.realtime.connectionStatus === 'connected';