import { Middleware } from '@reduxjs/toolkit';

/**
 * Middleware to catch and log Redux errors
 */
export const errorLoggerMiddleware: Middleware = store => next => action => {
  try {
    // Log the action in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Dispatching action:', action.type, action.payload);
    }
    
    // Process the action
    const result = next(action);
    
    // Check for any errors in the state after the action
    const state = store.getState();
    if (state.workshop?.lastError) {
      console.error('Workshop error detected:', state.workshop.lastError);
    }
    
    return result;
  } catch (error) {
    console.error('Redux middleware error:', error);
    console.error('Action that caused error:', action);
    
    // Re-throw in development to help debugging
    // DISABLED: Causing issues in production builds
    // if (process.env.NODE_ENV === 'development') {
    //   throw error;
    // }
    
    // In production, dispatch an error action
    store.dispatch({
      type: 'error/middlewareError',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: action.type,
      },
    });
    
    return undefined;
  }
};