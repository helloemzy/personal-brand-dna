import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { websocketService, PresenceData, CollaborationEvent } from '../services/websocketService';
import {
  selectConnectionStatus,
  selectIsConnected,
  addTypingUser,
  removeTypingUser,
  cleanupTypingIndicators
} from '../store/slices/realtimeSlice';
import { RootState } from '../store';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  room?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connectionStatus: string;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  updatePresence: (presence: Partial<PresenceData>) => void;
  sendTyping: (context: string) => void;
  stopTyping: (context: string) => void;
  sendCollaborationEvent: (event: Omit<CollaborationEvent, 'timestamp' | 'userId'>) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    autoConnect = true,
    room,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const dispatch = useDispatch();
  const connectionStatus = useSelector(selectConnectionStatus);
  const isConnected = useSelector(selectIsConnected);
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (token) {
      websocketService.connect(token);
    }
  }, [token]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  // Emit event
  const emit = useCallback((event: string, data: any) => {
    websocketService.emit(event, data);
  }, []);

  // Listen for event
  const on = useCallback((event: string, handler: Function) => {
    websocketService.on(event, handler);
  }, []);

  // Remove event listener
  const off = useCallback((event: string, handler: Function) => {
    websocketService.off(event, handler);
  }, []);

  // Join room
  const joinRoom = useCallback((room: string) => {
    websocketService.joinRoom(room);
  }, []);

  // Leave room
  const leaveRoom = useCallback((room: string) => {
    websocketService.leaveRoom(room);
  }, []);

  // Update presence
  const updatePresence = useCallback((presence: Partial<PresenceData>) => {
    if (user) {
      websocketService.updatePresence({
        userId: user.id,
        userName: user.name || user.email,
        ...presence
      });
    }
  }, [user]);

  // Send typing indicator
  const sendTyping = useCallback((context: string) => {
    if (!user || !isConnected) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Add typing user locally
    dispatch(addTypingUser({
      context,
      userId: user.id,
      userName: user.name || user.email
    }));

    // Emit typing event
    emit('typing_start', { context, userId: user.id, userName: user.name || user.email });

    // Auto-stop typing after 2.5 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(context);
    }, 2500);
  }, [user, isConnected, dispatch, emit]);

  // Stop typing indicator
  const stopTyping = useCallback((context: string) => {
    if (!user) return;

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Remove typing user locally
    dispatch(removeTypingUser({ context, userId: user.id }));

    // Emit stop typing event
    if (isConnected) {
      emit('typing_stop', { context, userId: user.id });
    }
  }, [user, isConnected, dispatch, emit]);

  // Send collaboration event
  const sendCollaborationEvent = useCallback((event: Omit<CollaborationEvent, 'timestamp' | 'userId'>) => {
    if (user) {
      websocketService.sendCollaborationEvent({
        ...event,
        userId: user.id
      });
    }
  }, [user]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && token && !isConnected) {
      connect();
    }

    // Set up connection event handlers
    const handleConnect = () => {
      onConnect?.();
    };

    const handleDisconnect = () => {
      onDisconnect?.();
    };

    const handleError = (error: any) => {
      onError?.(error);
    };

    on('connect', handleConnect);
    on('disconnect', handleDisconnect);
    on('connect_error', handleError);

    // Set up typing indicator cleanup interval
    cleanupIntervalRef.current = setInterval(() => {
      dispatch(cleanupTypingIndicators());
    }, 1000);

    return () => {
      off('connect', handleConnect);
      off('disconnect', handleDisconnect);
      off('connect_error', handleError);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }

      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, token, isConnected, connect, disconnect, on, off, onConnect, onDisconnect, onError, dispatch]);

  // Join room when specified
  useEffect(() => {
    if (room && isConnected) {
      joinRoom(room);

      return () => {
        leaveRoom(room);
      };
    }
  }, [room, isConnected, joinRoom, leaveRoom]);

  // Update presence on page navigation
  useEffect(() => {
    if (isConnected) {
      updatePresence({
        currentPage: window.location.pathname,
        status: 'online'
      });
    }
  }, [isConnected, updatePresence]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    updatePresence,
    sendTyping,
    stopTyping,
    sendCollaborationEvent
  };
};

// Hook for typing indicators
export const useTypingIndicator = (context: string) => {
  const { sendTyping, stopTyping } = useWebSocket({ autoConnect: false });
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    sendTyping(context);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(context);
    }, 2500);
  }, [context, sendTyping, stopTyping]);

  const handleStopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopTyping(context);
  }, [context, stopTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleTyping,
    handleStopTyping
  };
};