import { Middleware } from '@reduxjs/toolkit';
import * as Sentry from '@sentry/react';
import { addBreadcrumb } from '../../config/sentry';

/**
 * Redux middleware for tracking actions and state changes in Sentry
 */
export const sentryMiddleware: Middleware = (store) => (next) => (action) => {
  // Add breadcrumb for each Redux action
  addBreadcrumb(`Redux: ${action.type}`, {
    category: 'redux.action',
    level: 'info',
    data: {
      action: action.type,
      payload: action.payload,
    },
  });

  // Track specific workshop actions
  if (action.type.startsWith('workshop/')) {
    const workshopAction = action.type.replace('workshop/', '');
    
    // Track important workshop milestones
    const importantActions = [
      'completeStep',
      'completeWorkshop',
      'resetWorkshop',
      'saveProgress',
    ];

    if (importantActions.includes(workshopAction)) {
      Sentry.addBreadcrumb({
        message: `Workshop milestone: ${workshopAction}`,
        category: 'workshop.milestone',
        level: 'info',
        data: {
          action: workshopAction,
          step: action.payload?.step,
          timestamp: Date.now(),
        },
      });
    }

    // Track workshop errors
    if (workshopAction === 'setError') {
      Sentry.captureMessage(`Workshop error: ${action.payload}`, {
        level: 'error',
        tags: {
          component: 'workshop',
          error_type: 'user_error',
        },
      });
    }
  }

  // Track authentication actions
  if (action.type.startsWith('auth/')) {
    const authAction = action.type.replace('auth/', '');
    
    if (authAction === 'login/fulfilled') {
      Sentry.setUser({
        id: action.payload?.user?.id,
        email: action.payload?.user?.email,
      });
    } else if (authAction === 'logout/fulfilled' || authAction === 'clearAuth') {
      Sentry.setUser(null);
    }
  }

  // Track performance for async actions
  let transaction: Sentry.Transaction | undefined;
  
  if (action.type.endsWith('/pending')) {
    const actionName = action.type.replace('/pending', '');
    transaction = Sentry.startTransaction({
      name: `Redux: ${actionName}`,
      op: 'redux.async',
    });
    
    // Store transaction for later use
    (action as any).__sentryTransaction = transaction;
  }

  // Call the next middleware/reducer
  let result;
  try {
    result = next(action);
  } catch (error) {
    // Capture any errors that occur during action processing
    Sentry.captureException(error, {
      tags: {
        action_type: action.type,
        component: 'redux',
      },
      extra: {
        action,
        state: store.getState(),
      },
    });
    throw error;
  }

  // Complete transaction for async actions
  if (action.type.endsWith('/fulfilled') || action.type.endsWith('/rejected')) {
    const baseAction = action.type.replace(/\/(fulfilled|rejected)$/, '');
    const pendingAction = `${baseAction}/pending`;
    
    // Look for the transaction in recent actions
    const transaction = (action as any).__sentryTransaction;
    if (transaction) {
      if (action.type.endsWith('/fulfilled')) {
        transaction.setStatus('ok');
      } else {
        transaction.setStatus('internal_error');
        
        // Capture rejection as error
        if (action.payload) {
          Sentry.captureException(new Error(`Redux async action failed: ${baseAction}`), {
            tags: {
              action_type: action.type,
              component: 'redux',
            },
            extra: {
              error: action.payload,
            },
          });
        }
      }
      transaction.finish();
    }
  }

  return result;
};

/**
 * Redux crash reporter for capturing unhandled errors in reducers
 */
export const createSentryCrashReporter = () => {
  return (store: any) => (next: any) => (action: any) => {
    try {
      return next(action);
    } catch (err) {
      const error = err as Error;
      
      // Capture the error with full context
      Sentry.captureException(error, {
        tags: {
          component: 'redux-reducer',
          action_type: action.type,
        },
        extra: {
          action,
          state: store.getState(),
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });

      // Log to console in development
      if (import.meta.env.DEV) {
        console.error('Redux reducer error:', error);
        console.error('Action:', action);
        console.error('State:', store.getState());
      }

      // Re-throw to maintain Redux error behavior
      throw error;
    }
  };
};