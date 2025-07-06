import { Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../index';

/**
 * Debug middleware specifically for tracking workshop state changes
 * This helps identify what's causing the crash
 */
export const workshopDebuggerMiddleware: Middleware<{}, RootState> = store => next => action => {
  // Only run in development or when debug flag is set
  const isDebugMode = process.env.NODE_ENV === 'development' || 
                      localStorage.getItem('workshop_debug') === 'true';
  
  if (!isDebugMode) {
    return next(action);
  }

  // Log workshop-related actions
  if (action.type && action.type.startsWith('workshop/')) {
    console.group(`🔍 Workshop Action: ${action.type}`);
    
    // Get state before action
    const stateBefore = store.getState();
    const workshopBefore = stateBefore.workshop;
    
    console.log('State Before:', {
      selectedValues: workshopBefore?.values?.selected?.length || 0,
      customValues: workshopBefore?.values?.custom?.length || 0,
      rankings: workshopBefore?.values?.rankings || {},
      currentStep: workshopBefore?.currentStep,
    });
    
    console.log('Action Payload:', action.payload);
    
    // Execute the action
    const result = next(action);
    
    // Get state after action
    const stateAfter = store.getState();
    const workshopAfter = stateAfter.workshop;
    
    console.log('State After:', {
      selectedValues: workshopAfter?.values?.selected?.length || 0,
      customValues: workshopAfter?.values?.custom?.length || 0,
      rankings: workshopAfter?.values?.rankings || {},
      currentStep: workshopAfter?.currentStep,
    });
    
    // Check for potential issues
    if (workshopAfter?.values?.selected && workshopAfter.values.selected.length > 10) {
      console.error('⚠️ WARNING: More than 10 values selected!');
    }
    
    // Check for array corruption
    if (workshopAfter?.values?.selected && !Array.isArray(workshopAfter.values.selected)) {
      console.error('🚨 CRITICAL: Selected values is not an array!');
    }
    
    // Check for persist metadata
    if ((workshopAfter as any)?._persist) {
      console.warn('⚠️ WARNING: _persist metadata found in workshop state');
      console.log('_persist data:', (workshopAfter as any)._persist);
    }
    
    // Log full workshop state for deep debugging
    if (action.type === 'workshop/selectValue' || action.type === 'workshop/deselectValue') {
      console.log('Full Workshop State:', JSON.stringify(workshopAfter, null, 2));
    }
    
    console.groupEnd();
    
    return result;
  }
  
  // Also log persist actions that might affect workshop
  if (action.type === 'persist/REHYDRATE' && action.payload?.workshop) {
    console.group('💾 Workshop Rehydration');
    console.log('Rehydrated workshop state:', action.payload.workshop);
    console.groupEnd();
  }
  
  return next(action);
};

/**
 * Enable workshop debugging
 */
export const enableWorkshopDebugging = () => {
  localStorage.setItem('workshop_debug', 'true');
  console.log('🔍 Workshop debugging enabled. Refresh the page to start debugging.');
};

/**
 * Disable workshop debugging
 */
export const disableWorkshopDebugging = () => {
  localStorage.removeItem('workshop_debug');
  console.log('🔍 Workshop debugging disabled.');
};

// Expose debugging functions globally in development
if (process.env.NODE_ENV === 'development') {
  (window as any).enableWorkshopDebugging = enableWorkshopDebugging;
  (window as any).disableWorkshopDebugging = disableWorkshopDebugging;
}