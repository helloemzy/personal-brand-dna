import React from 'react';
import { useSelector } from 'react-redux';
import { selectConnectionStatus } from '../../store/slices/realtimeSlice';

interface ConnectionStatusProps {
  variant?: 'full' | 'compact' | 'icon';
  showText?: boolean;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  variant = 'compact',
  showText = true,
  className = ''
}) => {
  const connectionStatus = useSelector(selectConnectionStatus);

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          color: 'yellow',
          text: 'Connecting...',
          icon: '⟳',
          bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          iconClass: 'text-yellow-500',
          dotClass: 'bg-yellow-500 animate-pulse'
        };
      case 'connected':
        return {
          color: 'green',
          text: 'Connected',
          icon: '✓',
          bgClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          iconClass: 'text-green-500',
          dotClass: 'bg-green-500'
        };
      case 'disconnected':
        return {
          color: 'gray',
          text: 'Disconnected',
          icon: '○',
          bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          iconClass: 'text-gray-500',
          dotClass: 'bg-gray-500'
        };
      case 'error':
        return {
          color: 'red',
          text: 'Connection Error',
          icon: '✕',
          bgClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          iconClass: 'text-red-500',
          dotClass: 'bg-red-500 animate-pulse'
        };
      case 'failed':
        return {
          color: 'red',
          text: 'Connection Failed',
          icon: '⚠',
          bgClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          iconClass: 'text-red-500',
          dotClass: 'bg-red-500'
        };
      default:
        return {
          color: 'gray',
          text: 'Unknown',
          icon: '?',
          bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          iconClass: 'text-gray-500',
          dotClass: 'bg-gray-500'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (variant === 'icon') {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`w-3 h-3 rounded-full ${statusInfo.dotClass}`} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
        {showText && (
          <span className={`text-sm font-medium ${statusInfo.iconClass}`}>
            {statusInfo.text}
          </span>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`${className}`}>
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgClass}`}>
        <div className={`w-2 h-2 rounded-full mr-1.5 ${statusInfo.dotClass}`} />
        {statusInfo.text}
      </div>
    </div>
  );
};

export default ConnectionStatus;