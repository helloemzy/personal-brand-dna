/**
 * Skip Links Component
 * Provides keyboard shortcuts to skip to main content areas
 */

import React from 'react';
import { focusVisible } from '../../utils/accessibility';

const SkipLinks: React.FC = () => {
  const skipToMain = (e: React.MouseEvent) => {
    e.preventDefault();
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main instanceof HTMLElement) {
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView();
    }
  };
  
  const skipToNav = (e: React.MouseEvent) => {
    e.preventDefault();
    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav instanceof HTMLElement) {
      const firstLink = nav.querySelector('a, button');
      if (firstLink instanceof HTMLElement) {
        firstLink.focus();
      }
    }
  };
  
  const skipToSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    const search = document.querySelector('[role="search"]') || document.querySelector('input[type="search"]');
    if (search instanceof HTMLElement) {
      search.focus();
    }
  };
  
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-[100] focus-within:w-full focus-within:bg-white focus-within:shadow-lg">
      <div className="px-4 py-2 space-x-4">
        <a
          href="#main"
          onClick={skipToMain}
          className={`inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md ${focusVisible} hover:bg-blue-700`}
        >
          Skip to main content
        </a>
        <a
          href="#navigation"
          onClick={skipToNav}
          className={`inline-block px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md ${focusVisible} hover:bg-blue-100`}
        >
          Skip to navigation
        </a>
        <a
          href="#search"
          onClick={skipToSearch}
          className={`inline-block px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md ${focusVisible} hover:bg-blue-100`}
        >
          Skip to search
        </a>
      </div>
    </div>
  );
};

export default SkipLinks;