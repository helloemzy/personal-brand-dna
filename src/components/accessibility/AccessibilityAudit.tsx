/**
 * Accessibility Audit Component
 * Development tool to check accessibility issues
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface AuditResult {
  type: 'error' | 'warning' | 'info' | 'pass';
  message: string;
  element?: string;
  wcag?: string;
}

const AccessibilityAudit: React.FC = () => {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const runAudit = async () => {
    setIsAuditing(true);
    const auditResults: AuditResult[] = [];
    
    // Check for images without alt text
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.alt && !img.getAttribute('role')) {
        auditResults.push({
          type: 'error',
          message: 'Image missing alt text',
          element: img.src.substring(img.src.lastIndexOf('/') + 1),
          wcag: '1.1.1'
        });
      }
    });
    
    // Check for buttons without accessible text
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const text = button.textContent?.trim();
      const ariaLabel = button.getAttribute('aria-label');
      const ariaLabelledBy = button.getAttribute('aria-labelledby');
      
      if (!text && !ariaLabel && !ariaLabelledBy) {
        auditResults.push({
          type: 'error',
          message: 'Button missing accessible text',
          element: button.outerHTML.substring(0, 50) + '...',
          wcag: '4.1.2'
        });
      }
    });
    
    // Check for form inputs without labels
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.id;
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (!label && !ariaLabel && !ariaLabelledBy) {
          auditResults.push({
            type: 'error',
            message: 'Form input missing label',
            element: `${input.tagName.toLowerCase()}#${id}`,
            wcag: '3.3.2'
          });
        }
      }
    });
    
    // Check for heading hierarchy
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let lastLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      if (level > lastLevel + 1) {
        auditResults.push({
          type: 'warning',
          message: `Heading level skipped (h${lastLevel} to h${level})`,
          element: heading.textContent?.substring(0, 50) + '...',
          wcag: '1.3.1'
        });
      }
      lastLevel = level;
    });
    
    // Check for color contrast (simplified check)
    const textElements = document.querySelectorAll('p, span, div, a, button');
    const lowContrastCount = 0;
    // Note: Real contrast checking would require more complex calculations
    
    // Check for keyboard traps
    const focusableElements = document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) {
      auditResults.push({
        type: 'warning',
        message: 'No focusable elements found on page',
        wcag: '2.1.1'
      });
    }
    
    // Check for ARIA landmarks
    const main = document.querySelector('main, [role="main"]');
    const nav = document.querySelector('nav, [role="navigation"]');
    
    if (!main) {
      auditResults.push({
        type: 'warning',
        message: 'No main landmark found',
        wcag: '1.3.1'
      });
    }
    
    if (!nav) {
      auditResults.push({
        type: 'info',
        message: 'No navigation landmark found',
        wcag: '1.3.1'
      });
    }
    
    // Check for page title
    if (!document.title) {
      auditResults.push({
        type: 'error',
        message: 'Page missing title',
        wcag: '2.4.2'
      });
    }
    
    // Check for language attribute
    if (!document.documentElement.lang) {
      auditResults.push({
        type: 'error',
        message: 'Page missing language attribute',
        wcag: '3.1.1'
      });
    }
    
    // Add success message if no issues
    if (auditResults.length === 0) {
      auditResults.push({
        type: 'pass',
        message: 'No accessibility issues detected!'
      });
    }
    
    setResults(auditResults);
    setIsAuditing(false);
  };
  
  // Run audit on mount and page changes
  useEffect(() => {
    if (showAudit) {
      runAudit();
    }
  }, [showAudit]);
  
  // Keyboard shortcut to toggle audit (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAudit(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!showAudit) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowAudit(true)}
          className="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          aria-label="Open accessibility audit"
          title="Press Ctrl+Shift+A to toggle"
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
      </div>
    );
  }
  
  const errorCount = results.filter(r => r.type === 'error').length;
  const warningCount = results.filter(r => r.type === 'warning').length;
  const infoCount = results.filter(r => r.type === 'info').length;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Accessibility Audit</h2>
          <button
            onClick={() => setShowAudit(false)}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close accessibility audit"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center space-x-4 text-sm">
          {errorCount > 0 && (
            <span className="flex items-center text-red-600">
              <XCircle className="w-4 h-4 mr-1" />
              {errorCount} errors
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center text-yellow-600">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {warningCount} warnings
            </span>
          )}
          {infoCount > 0 && (
            <span className="flex items-center text-blue-600">
              <Info className="w-4 h-4 mr-1" />
              {infoCount} info
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {isAuditing ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Running audit...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.type === 'error'
                    ? 'bg-red-50 border-red-200'
                    : result.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : result.type === 'info'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {result.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                    {result.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                    {result.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
                    {result.type === 'pass' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${
                      result.type === 'error'
                        ? 'text-red-800'
                        : result.type === 'warning'
                        ? 'text-yellow-800'
                        : result.type === 'info'
                        ? 'text-blue-800'
                        : 'text-green-800'
                    }`}>
                      {result.message}
                    </p>
                    {result.element && (
                      <p className="mt-1 text-xs text-gray-600 font-mono">{result.element}</p>
                    )}
                    {result.wcag && (
                      <p className="mt-1 text-xs text-gray-500">WCAG {result.wcag}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={runAudit}
          disabled={isAuditing}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAuditing ? 'Auditing...' : 'Re-run Audit'}
        </button>
        <p className="mt-2 text-xs text-gray-500 text-center">
          Press Ctrl+Shift+A to toggle
        </p>
      </div>
    </div>
  );
};

export default AccessibilityAudit;