/**
 * Live Region Component
 * Announces dynamic content changes to screen readers
 */

import React from 'react';
import { srOnly } from '../../utils/accessibility';

interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  className?: string;
}

const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  priority = 'polite',
  atomic = true,
  relevant = 'additions',
  className = ''
}) => {
  if (!message) return null;
  
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={`${srOnly} ${className}`}
    >
      {message}
    </div>
  );
};

export default LiveRegion;