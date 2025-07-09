/**
 * Accessibility utilities for BrandPillar AI
 * Provides common accessibility helpers and utilities
 */

import { useEffect, useRef, RefObject } from 'react';

/**
 * Screen reader only class name
 * Use this to hide content visually but keep it available to screen readers
 */
export const srOnly = 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0';

/**
 * Focus visible class names for consistent focus styling
 */
export const focusVisible = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

/**
 * High contrast mode detection
 */
export const isHighContrastMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-contrast: high)');
  return mediaQuery.matches;
};

/**
 * Reduced motion preference detection
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
};

/**
 * Get appropriate transition classes based on user preferences
 */
export const getTransitionClasses = (defaultClasses: string): string => {
  if (prefersReducedMotion()) {
    return 'transition-none';
  }
  return defaultClasses;
};

/**
 * Announce message to screen readers
 * @param message - The message to announce
 * @param priority - The priority of the announcement ('polite' or 'assertive')
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = srOnly;
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove the announcement after it's been read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Generate unique ID for accessibility
 */
export const generateAccessibleId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if an element is focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  if (element.tabIndex >= 0) return true;
  
  const focusableElements = ['a', 'button', 'input', 'select', 'textarea', 'area'];
  const tagName = element.tagName.toLowerCase();
  
  if (focusableElements.includes(tagName)) {
    return !element.hasAttribute('disabled');
  }
  
  return false;
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  return Array.from(elements).filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
};

/**
 * Trap focus within a container (useful for modals)
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = getFocusableElements(container);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Format text for screen readers
 * Adds appropriate pauses and context
 */
export const formatForScreenReader = (text: string, options?: {
  addPeriod?: boolean;
  spellOut?: boolean;
}): string => {
  let formatted = text;
  
  if (options?.spellOut) {
    formatted = formatted.split('').join(' ');
  }
  
  if (options?.addPeriod && !formatted.match(/[.!?]$/)) {
    formatted += '.';
  }
  
  return formatted;
};

/**
 * Get ARIA label for time-based content
 */
export const getTimeAriaLabel = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    return 'Less than an hour ago';
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

/**
 * Create keyboard shortcut handler
 */
export const createKeyboardShortcut = (
  key: string,
  handler: () => void,
  options?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  }
): ((e: KeyboardEvent) => void) => {
  return (e: KeyboardEvent) => {
    const keyMatch = e.key.toLowerCase() === key.toLowerCase();
    const ctrlMatch = options?.ctrl ? (e.ctrlKey || e.metaKey) : true;
    const altMatch = options?.alt ? e.altKey : !e.altKey;
    const shiftMatch = options?.shift ? e.shiftKey : !e.shiftKey;
    const metaMatch = options?.meta ? e.metaKey : true;
    
    if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
      e.preventDefault();
      handler();
    }
  };
};

/**
 * Get contrast ratio between two colors
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  // Convert hex to RGB
  const getRGB = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };
  
  // Calculate relative luminance
  const getLuminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const lum1 = getLuminance(getRGB(color1));
  const lum2 = getLuminance(getRGB(color2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Check if contrast meets WCAG AA standards
 */
export const meetsContrastStandard = (
  foreground: string,
  background: string,
  fontSize: number = 16,
  isBold: boolean = false
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const largeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  const requiredRatio = largeText ? 3 : 4.5;
  
  return ratio >= requiredRatio;
};

/**
 * Role descriptions for common UI patterns
 */
export const roleDescriptions = {
  navigation: 'Site navigation',
  search: 'Site search',
  tablist: 'Tab navigation',
  main: 'Main content',
  complementary: 'Complementary content',
  contentinfo: 'Site information'
} as const;

/**
 * Common keyboard codes
 */
export const KeyCodes = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
} as const;

/**
 * Export all utilities
 */
export const a11y = {
  srOnly,
  focusVisible,
  isHighContrastMode,
  prefersReducedMotion,
  getTransitionClasses,
  announceToScreenReader,
  generateAccessibleId,
  isFocusable,
  getFocusableElements,
  trapFocus,
  formatForScreenReader,
  getTimeAriaLabel,
  createKeyboardShortcut,
  getContrastRatio,
  meetsContrastStandard,
  roleDescriptions,
  KeyCodes
};

export default a11y;