/**
 * Axe-core setup for accessibility testing
 * Only runs in development mode
 */

export const setupAxe = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  try {
    const React = await import('react');
    const ReactDOM = await import('react-dom');
    const axe = await import('@axe-core/react');
    
    // Configure axe-core
    const axeConfig = {
      rules: [
        // Disable rules that might be too noisy during development
        { id: 'color-contrast', enabled: true },
        { id: 'duplicate-id', enabled: true },
        { id: 'empty-heading', enabled: true },
        { id: 'heading-order', enabled: true },
        { id: 'label', enabled: true },
        { id: 'link-name', enabled: true },
        { id: 'list', enabled: true },
        { id: 'listitem', enabled: true },
        { id: 'region', enabled: true }
      ]
    };
    
    // Initialize axe-core
    axe.default(React, ReactDOM, 1000, axeConfig);
    
    console.log(
      '%c♿ Accessibility testing enabled',
      'background: #4B5563; color: #F3F4F6; padding: 4px 8px; border-radius: 4px;'
    );
    console.log(
      '%cAxe-core will log accessibility issues to the console.',
      'color: #6B7280;'
    );
    console.log(
      '%cPress Ctrl+Shift+A to open the in-app accessibility audit.',
      'color: #6B7280;'
    );
  } catch (error) {
    console.error('Failed to setup axe-core:', error);
  }
};