/**
 * Keyboard Shortcuts Component
 * Provides global keyboard shortcuts and displays help dialog
 */

import React, { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import Modal from './Modal';
import { createKeyboardShortcut, focusVisible } from '../../utils/accessibility';
import { useNavigate } from 'react-router-dom';
import { useAnnounce } from '../../hooks/useAccessibility';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

const KeyboardShortcuts: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();
  const announce = useAnnounce();
  
  const shortcuts: Shortcut[] = [
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const search = document.querySelector('[role="search"] input, input[type="search"]');
        if (search instanceof HTMLElement) {
          search.focus();
          announce('Search focused');
        }
      }
    },
    {
      key: 'g',
      description: 'Go to dashboard',
      modifiers: { ctrl: true },
      action: () => {
        navigate('/dashboard');
        announce('Navigating to dashboard');
      }
    },
    {
      key: 'n',
      description: 'Create new content',
      modifiers: { ctrl: true },
      action: () => {
        navigate('/content/new');
        announce('Navigating to create content');
      }
    },
    {
      key: 'w',
      description: 'Go to workshop',
      modifiers: { ctrl: true },
      action: () => {
        navigate('/brand-house');
        announce('Navigating to Brand House workshop');
      }
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      modifiers: { shift: true },
      action: () => setShowHelp(true)
    },
    {
      key: 'k',
      description: 'Show command palette',
      modifiers: { ctrl: true },
      action: () => {
        announce('Command palette not yet implemented');
      }
    },
    {
      key: 'r',
      description: 'Go to results',
      modifiers: { ctrl: true },
      action: () => {
        navigate('/workshop/results');
        announce('Navigating to workshop results');
      }
    },
    {
      key: 's',
      description: 'Save current progress',
      modifiers: { ctrl: true },
      action: () => {
        // Trigger auto-save if available
        const saveButton = document.querySelector('[data-save-trigger]');
        if (saveButton instanceof HTMLElement) {
          saveButton.click();
        }
        announce('Saving progress');
      }
    },
    {
      key: 'c',
      description: 'Copy to clipboard',
      modifiers: { ctrl: true },
      action: () => {
        // Find the most recent copy button that was focused
        const copyButtons = document.querySelectorAll('[data-copy-button]');
        const lastFocused = Array.from(copyButtons).find(btn => 
          btn === document.activeElement || btn.contains(document.activeElement)
        );
        if (lastFocused instanceof HTMLElement) {
          lastFocused.click();
        }
        announce('Content copied to clipboard');
      }
    },
    {
      key: 'escape',
      description: 'Close modal or cancel action',
      action: () => {
        // Find and close any open modals
        const closeButtons = document.querySelectorAll('[data-modal-close], [aria-label*="Close"], [aria-label*="close"]');
        const modal = document.querySelector('[role="dialog"]');
        if (modal && closeButtons.length > 0) {
          (closeButtons[0] as HTMLElement).click();
          announce('Modal closed');
        }
      }
    },
    {
      key: 'j',
      description: 'Next item',
      action: () => {
        // Navigate to next focusable item
        const focusable = document.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const current = document.activeElement;
        const currentIndex = Array.from(focusable).indexOf(current as Element);
        const next = focusable[currentIndex + 1] || focusable[0];
        if (next instanceof HTMLElement) {
          next.focus();
          announce('Next item focused');
        }
      }
    },
    {
      key: 'k',
      description: 'Previous item',
      action: () => {
        // Navigate to previous focusable item
        const focusable = document.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const current = document.activeElement;
        const currentIndex = Array.from(focusable).indexOf(current as Element);
        const prev = focusable[currentIndex - 1] || focusable[focusable.length - 1];
        if (prev instanceof HTMLElement) {
          prev.focus();
          announce('Previous item focused');
        }
      }
    }
  ];
  
  // Register keyboard shortcuts
  useEffect(() => {
    const handlers = shortcuts.map(shortcut => {
      const handler = createKeyboardShortcut(
        shortcut.key,
        shortcut.action,
        shortcut.modifiers
      );
      
      document.addEventListener('keydown', handler);
      return handler;
    });
    
    return () => {
      handlers.forEach(handler => {
        document.removeEventListener('keydown', handler);
      });
    };
  }, []);
  
  const formatShortcut = (shortcut: Shortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
    if (shortcut.modifiers?.alt) parts.push('Alt');
    if (shortcut.modifiers?.shift) parts.push('Shift');
    if (shortcut.modifiers?.meta) parts.push('Cmd');
    
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join(' + ');
  };
  
  return (
    <>
      {/* Help button */}
      <button
        onClick={() => setShowHelp(true)}
        className={`fixed bottom-4 left-4 z-40 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 ${focusVisible}`}
        aria-label="Show keyboard shortcuts"
        title="Press ? for keyboard shortcuts"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
      
      {/* Shortcuts help modal */}
      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Keyboard Shortcuts"
        description="Navigate faster with these keyboard shortcuts"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid gap-3">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm text-gray-700">{shortcut.description}</span>
                <kbd className="inline-flex items-center space-x-1 text-xs">
                  {formatShortcut(shortcut).split(' + ').map((key, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-gray-400">+</span>}
                      <span className="inline-block px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono">
                        {key}
                      </span>
                    </React.Fragment>
                  ))}
                </kbd>
              </div>
            ))}
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Navigation Tips</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Use <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Tab</kbd> to navigate between elements</li>
              <li>• Use <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Esc</kbd> to close dialogs and menus</li>
              <li>• Use <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Space</kbd> to activate buttons</li>
              <li>• Use arrow keys to navigate within menus and lists</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default KeyboardShortcuts;