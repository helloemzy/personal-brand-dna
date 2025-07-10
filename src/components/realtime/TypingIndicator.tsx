import React from 'react';
import { useSelector } from 'react-redux';
import { selectTypingUsers } from '../../store/slices/realtimeSlice';

interface TypingIndicatorProps {
  context: string;
  className?: string;
  maxDisplay?: number;
  variant?: 'dots' | 'text' | 'compact';
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  context,
  className = '',
  maxDisplay = 3,
  variant = 'text'
}) => {
  const typingUsers = useSelector(selectTypingUsers(context));

  if (typingUsers.length === 0) {
    return null;
  }

  const displayUsers = typingUsers.slice(0, maxDisplay);
  const remainingCount = Math.max(0, typingUsers.length - maxDisplay);

  const formatUserList = () => {
    if (displayUsers.length === 1) {
      return displayUsers[0].userName;
    } else if (displayUsers.length === 2) {
      return `${displayUsers[0].userName} and ${displayUsers[1].userName}`;
    } else if (displayUsers.length === 3 && remainingCount === 0) {
      return `${displayUsers[0].userName}, ${displayUsers[1].userName}, and ${displayUsers[2].userName}`;
    } else {
      const names = displayUsers.slice(0, -1).map(u => u.userName).join(', ');
      const lastPart = remainingCount > 0 
        ? `and ${remainingCount + 1} others`
        : `and ${displayUsers[displayUsers.length - 1].userName}`;
      return `${names} ${lastPart}`;
    }
  };

  const getTypingText = () => {
    const count = typingUsers.length;
    return count === 1 ? 'is typing' : 'are typing';
  };

  if (variant === 'dots') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="text-xs">
          {typingUsers.length} typing
        </span>
      </div>
    );
  }

  // Text variant (default)
  return (
    <div className={`flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <span className="italic">
        <span className="font-medium">{formatUserList()}</span> {getTypingText()}...
      </span>
    </div>
  );
};

export default TypingIndicator;