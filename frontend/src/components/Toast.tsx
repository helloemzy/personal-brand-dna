import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Global toast state
let toastMessages: ToastMessage[] = [];
let toastListeners: Array<(messages: ToastMessage[]) => void> = [];

// Toast API
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    addToast({ type: 'success', title, message, duration });
  },
  error: (title: string, message?: string, duration?: number) => {
    addToast({ type: 'error', title, message, duration });
  },
  warning: (title: string, message?: string, duration?: number) => {
    addToast({ type: 'warning', title, message, duration });
  },
  info: (title: string, message?: string, duration?: number) => {
    addToast({ type: 'info', title, message, duration });
  },
};

const addToast = (toast: Omit<ToastMessage, 'id'>) => {
  const newToast: ToastMessage = {
    ...toast,
    id: Math.random().toString(36).substr(2, 9),
    duration: toast.duration || 5000,
  };
  
  toastMessages = [...toastMessages, newToast];
  toastListeners.forEach(listener => listener(toastMessages));
  
  // Auto remove toast after duration
  setTimeout(() => {
    removeToast(newToast.id);
  }, newToast.duration);
};

const removeToast = (id: string) => {
  toastMessages = toastMessages.filter(toast => toast.id !== id);
  toastListeners.forEach(listener => listener(toastMessages));
};

const Toast: React.FC = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newMessages: ToastMessage[]) => {
      setMessages(newMessages);
    };
    
    toastListeners.push(listener);
    
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const getToastIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getToastColors = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-sm w-full ${getToastColors(message.type)} border rounded-md shadow-lg p-4 animate-in slide-in-from-right-full`}
        >
          <div className="flex">
            <div className="flex-shrink-0">
              {getToastIcon(message.type)}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {message.title}
              </p>
              {message.message && (
                <p className="mt-1 text-sm text-gray-600">
                  {message.message}
                </p>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => removeToast(message.id)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Toast;