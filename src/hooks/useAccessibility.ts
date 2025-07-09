/**
 * Accessibility hooks for BrandPillar AI
 * Provides reusable hooks for common accessibility patterns
 */

import { useEffect, useRef, useState, useCallback, RefObject } from 'react';
import { 
  announceToScreenReader, 
  trapFocus, 
  getFocusableElements,
  prefersReducedMotion,
  isHighContrastMode,
  KeyCodes
} from '../utils/accessibility';

/**
 * Hook to manage focus restoration
 */
export const useFocusRestore = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);
  
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && previousFocusRef.current.focus) {
      previousFocusRef.current.focus();
    }
  }, []);
  
  return { saveFocus, restoreFocus };
};

/**
 * Hook to trap focus within a container
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement>,
  isActive: boolean = true
) => {
  useEffect(() => {
    if (!containerRef.current || !isActive) return;
    
    const cleanup = trapFocus(containerRef.current);
    
    // Focus the first focusable element
    const focusableElements = getFocusableElements(containerRef.current);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
    
    return cleanup;
  }, [containerRef, isActive]);
};

/**
 * Hook to announce messages to screen readers
 */
export const useAnnounce = () => {
  const announce = useCallback((message: string, priority?: 'polite' | 'assertive') => {
    announceToScreenReader(message, priority);
  }, []);
  
  return announce;
};

/**
 * Hook to handle escape key
 */
export const useEscapeKey = (handler: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === KeyCodes.ESCAPE) {
        e.preventDefault();
        handler();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handler, isActive]);
};

/**
 * Hook to manage keyboard navigation
 */
export const useKeyboardNavigation = (
  items: HTMLElement[],
  options?: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    onSelect?: (index: number) => void;
  }
) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { orientation = 'vertical', loop = true, onSelect } = options || {};
  
  useEffect(() => {
    if (items.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      let newIndex = activeIndex;
      
      switch (e.key) {
        case KeyCodes.ARROW_UP:
          if (orientation !== 'horizontal') {
            e.preventDefault();
            newIndex = loop 
              ? (activeIndex - 1 + items.length) % items.length
              : Math.max(0, activeIndex - 1);
          }
          break;
          
        case KeyCodes.ARROW_DOWN:
          if (orientation !== 'horizontal') {
            e.preventDefault();
            newIndex = loop
              ? (activeIndex + 1) % items.length
              : Math.min(items.length - 1, activeIndex + 1);
          }
          break;
          
        case KeyCodes.ARROW_LEFT:
          if (orientation !== 'vertical') {
            e.preventDefault();
            newIndex = loop
              ? (activeIndex - 1 + items.length) % items.length
              : Math.max(0, activeIndex - 1);
          }
          break;
          
        case KeyCodes.ARROW_RIGHT:
          if (orientation !== 'vertical') {
            e.preventDefault();
            newIndex = loop
              ? (activeIndex + 1) % items.length
              : Math.min(items.length - 1, activeIndex + 1);
          }
          break;
          
        case KeyCodes.HOME:
          e.preventDefault();
          newIndex = 0;
          break;
          
        case KeyCodes.END:
          e.preventDefault();
          newIndex = items.length - 1;
          break;
          
        case KeyCodes.ENTER:
        case KeyCodes.SPACE:
          e.preventDefault();
          if (onSelect) {
            onSelect(activeIndex);
          }
          break;
          
        default:
          return;
      }
      
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
        items[newIndex]?.focus();
      }
    };
    
    items.forEach(item => {
      item.addEventListener('keydown', handleKeyDown);
    });
    
    return () => {
      items.forEach(item => {
        item.removeEventListener('keydown', handleKeyDown);
      });
    };
  }, [items, activeIndex, orientation, loop, onSelect]);
  
  return { activeIndex, setActiveIndex };
};

/**
 * Hook to detect user preferences
 */
export const useAccessibilityPreferences = () => {
  const [preferences, setPreferences] = useState({
    reducedMotion: prefersReducedMotion(),
    highContrast: isHighContrastMode()
  });
  
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, reducedMotion: e.matches }));
    };
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, highContrast: e.matches }));
    };
    
    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);
    
    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);
  
  return preferences;
};

/**
 * Hook to manage ARIA live regions
 */
export const useLiveRegion = (
  priority: 'polite' | 'assertive' = 'polite'
): [string, (message: string) => void] => {
  const [message, setMessage] = useState('');
  
  const announce = useCallback((newMessage: string) => {
    setMessage('');
    // Small delay to ensure screen readers pick up the change
    setTimeout(() => setMessage(newMessage), 100);
  }, []);
  
  return [message, announce];
};

/**
 * Hook to manage focus visible state
 */
export const useFocusVisible = () => {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
    };
    
    const handleMouseDown = () => {
      setIsFocusVisible(false);
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
  
  return isFocusVisible;
};

/**
 * Hook to manage skip links
 */
export const useSkipLinks = () => {
  const skipToMain = useCallback(() => {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main instanceof HTMLElement) {
      main.focus();
      main.scrollIntoView();
    }
  }, []);
  
  const skipToNav = useCallback(() => {
    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav instanceof HTMLElement) {
      const firstLink = nav.querySelector('a, button');
      if (firstLink instanceof HTMLElement) {
        firstLink.focus();
      }
    }
  }, []);
  
  return { skipToMain, skipToNav };
};

/**
 * Hook to manage roving tabindex
 */
export const useRovingTabIndex = (
  containerRef: RefObject<HTMLElement>,
  selector: string = '[role="option"], [role="tab"], [role="menuitem"]'
) => {
  const [activeIndex, setActiveIndex] = useState(0);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const items = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    );
    
    // Set tabindex
    items.forEach((item, index) => {
      item.tabIndex = index === activeIndex ? 0 : -1;
    });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = items.findIndex(item => item === e.target);
      if (currentIndex === -1) return;
      
      let newIndex = currentIndex;
      
      switch (e.key) {
        case KeyCodes.ARROW_DOWN:
        case KeyCodes.ARROW_RIGHT:
          e.preventDefault();
          newIndex = (currentIndex + 1) % items.length;
          break;
          
        case KeyCodes.ARROW_UP:
        case KeyCodes.ARROW_LEFT:
          e.preventDefault();
          newIndex = (currentIndex - 1 + items.length) % items.length;
          break;
          
        case KeyCodes.HOME:
          e.preventDefault();
          newIndex = 0;
          break;
          
        case KeyCodes.END:
          e.preventDefault();
          newIndex = items.length - 1;
          break;
      }
      
      if (newIndex !== currentIndex) {
        setActiveIndex(newIndex);
        items[newIndex].focus();
      }
    };
    
    containerRef.current.addEventListener('keydown', handleKeyDown);
    
    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, selector, activeIndex]);
  
  return { activeIndex, setActiveIndex };
};

/**
 * Hook to manage form field descriptions and errors
 */
export const useFieldAccessibility = (
  fieldId: string,
  options?: {
    error?: string;
    description?: string;
    required?: boolean;
  }
) => {
  const errorId = `${fieldId}-error`;
  const descriptionId = `${fieldId}-description`;
  
  const ariaAttributes = {
    'aria-invalid': !!options?.error,
    'aria-describedby': [
      options?.error && errorId,
      options?.description && descriptionId
    ].filter(Boolean).join(' ') || undefined,
    'aria-required': options?.required
  };
  
  return {
    fieldProps: ariaAttributes,
    errorId,
    descriptionId
  };
};

/**
 * Export all hooks
 */
export const useAccessibility = () => {
  const announce = useAnnounce();
  const preferences = useAccessibilityPreferences();
  const focusVisible = useFocusVisible();
  const { skipToMain, skipToNav } = useSkipLinks();
  
  return {
    announce,
    preferences,
    focusVisible,
    skipToMain,
    skipToNav
  };
};