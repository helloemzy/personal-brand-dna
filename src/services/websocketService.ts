import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { 
  setConnectionStatus, 
  addActiveUser, 
  removeActiveUser,
  updatePresence,
  addNotification
} from '../store/slices/realtimeSlice';

interface WebSocketConfig {
  url?: string;
  auth?: {
    token: string;
  };
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface PresenceData {
  userId: string;
  userName: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy';
  lastSeen: Date;
  currentPage?: string;
  workshopStep?: number;
}

interface CollaborationEvent {
  type: 'workshop_update' | 'content_edit' | 'comment' | 'reaction';
  userId: string;
  data: any;
  timestamp: Date;
}

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    // Require WebSocket URL to be explicitly set in production
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL;
    
    if (!wsUrl && process.env.NODE_ENV === 'production') {
      throw new Error('REACT_APP_WEBSOCKET_URL environment variable is required in production');
    }
    
    this.config = {
      url: wsUrl || (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : ''),
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    };
  }

  /**
   * Initialize WebSocket connection
   */
  connect(token?: string): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    // Configure authentication
    if (token) {
      this.config.auth = { token };
    }

    // Create socket connection
    this.socket = io(this.config.url!, {
      auth: this.config.auth,
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
    this.startHeartbeat();
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    store.dispatch(setConnectionStatus('disconnected'));
  }

  /**
   * Setup core event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      store.dispatch(setConnectionStatus('connected'));
      this.joinUserRooms();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      store.dispatch(setConnectionStatus('disconnected'));
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      store.dispatch(setConnectionStatus('error'));
    });

    // Presence events
    this.socket.on('user_joined', (data: PresenceData) => {
      store.dispatch(addActiveUser(data));
    });

    this.socket.on('user_left', (userId: string) => {
      store.dispatch(removeActiveUser(userId));
    });

    this.socket.on('presence_update', (data: PresenceData) => {
      store.dispatch(updatePresence(data));
    });

    // Collaboration events
    this.socket.on('collaboration_event', (event: CollaborationEvent) => {
      this.handleCollaborationEvent(event);
    });

    // Notification events
    this.socket.on('notification', (notification: any) => {
      store.dispatch(addNotification(notification));
    });

    // Custom event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket!.on(event, handler);
      });
    });
  }

  /**
   * Join user-specific rooms
   */
  private joinUserRooms(): void {
    const state = store.getState();
    const userId = state.auth.user?.id;
    
    if (userId && this.socket) {
      // Join user's personal room
      this.socket.emit('join_room', `user:${userId}`);
      
      // Join any active workshop sessions
      const workshopSessionId = state.workshop.sessionId;
      if (workshopSessionId) {
        this.socket.emit('join_room', `workshop:${workshopSessionId}`);
      }
    }
  }

  /**
   * Handle collaboration events
   */
  private handleCollaborationEvent(event: CollaborationEvent): void {
    // Emit to registered handlers
    const handlers = this.eventHandlers.get('collaboration_event') || [];
    handlers.forEach(handler => handler(event));

    // Handle specific event types
    switch (event.type) {
      case 'workshop_update':
        // Workshop updates are handled by workshop-specific listeners
        this.emit('workshop:update', event.data);
        break;
      case 'content_edit':
        // Content edits are handled by content-specific listeners
        this.emit('content:edit', event.data);
        break;
      case 'comment':
        // Comments are handled by comment-specific listeners
        this.emit('comment:new', event.data);
        break;
      case 'reaction':
        // Reactions are handled by reaction-specific listeners
        this.emit('reaction:add', event.data);
        break;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) return;

    let attempts = 0;
    const maxAttempts = this.config.reconnectionAttempts || 5;

    const tryReconnect = () => {
      if (attempts >= maxAttempts) {
        console.error('Max reconnection attempts reached');
        store.dispatch(setConnectionStatus('failed'));
        return;
      }

      attempts++;
      console.log(`Reconnection attempt ${attempts}/${maxAttempts}`);
      
      this.connect();
      
      if (!this.socket?.connected) {
        this.reconnectTimer = setTimeout(tryReconnect, this.config.reconnectionDelay! * attempts);
      } else {
        this.reconnectTimer = null;
      }
    };

    this.reconnectTimer = setTimeout(tryReconnect, this.config.reconnectionDelay!);
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', { timestamp: new Date() });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Emit an event
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, queuing event:', event);
      // Could implement event queue here for offline support
    }
  }

  /**
   * Listen for an event
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    this.eventHandlers.get(event)!.push(handler);
    
    if (this.socket) {
      this.socket.on(event, handler as any);
    }
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    
    if (this.socket) {
      this.socket.off(event, handler as any);
    }
  }

  /**
   * Join a room
   */
  joinRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_room', room);
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', room);
    }
  }

  /**
   * Update user presence
   */
  updatePresence(presence: Partial<PresenceData>): void {
    if (this.socket?.connected) {
      this.socket.emit('presence_update', presence);
    }
  }

  /**
   * Send collaboration event
   */
  sendCollaborationEvent(event: Omit<CollaborationEvent, 'timestamp'>): void {
    if (this.socket?.connected) {
      this.socket.emit('collaboration_event', {
        ...event,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

// Export types
export type { PresenceData, CollaborationEvent };