import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useAppSelector } from './redux';
import { setSentryUser, clearSentryUser, addBreadcrumb } from '../config/sentry';

/**
 * Custom hook to track user context and navigation in Sentry
 */
export const useSentryTracking = () => {
  const user = useAppSelector((state) => state.auth.user);
  const currentPath = window.location.pathname;

  // Update user context when authentication changes
  useEffect(() => {
    if (user) {
      setSentryUser({
        id: user.id,
        email: user.email || undefined,
        username: user.full_name || undefined,
        tier: user.subscription_tier || 'free',
      });
    } else {
      clearSentryUser();
    }
  }, [user]);

  // Track page navigation
  useEffect(() => {
    addBreadcrumb(`Navigated to ${currentPath}`, {
      category: 'navigation',
      type: 'navigation',
      data: {
        from: document.referrer,
        to: currentPath,
      },
    });
  }, [currentPath]);
};

/**
 * Hook for tracking specific user actions
 */
export const useActionTracking = () => {
  const trackAction = (action: string, data?: Record<string, any>) => {
    addBreadcrumb(action, {
      category: 'user-action',
      level: 'info',
      data,
    });
  };

  const trackError = (error: Error, context?: Record<string, any>) => {
    Sentry.captureException(error, {
      tags: {
        component: 'user-action',
      },
      extra: context,
    });
  };

  return { trackAction, trackError };
};

/**
 * Hook for performance monitoring
 */
export const usePerformanceTracking = (transactionName: string) => {
  useEffect(() => {
    const transaction = Sentry.startTransaction({
      name: transactionName,
      op: 'navigation',
    });

    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));

    return () => {
      transaction.finish();
    };
  }, [transactionName]);

  const measureOperation = async <T,>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    const span = transaction?.startChild({
      op: 'task',
      description: operationName,
    });

    try {
      const result = await operation();
      span?.setStatus('ok');
      return result;
    } catch (error) {
      span?.setStatus('internal_error');
      throw error;
    } finally {
      span?.finish();
    }
  };

  return { measureOperation };
};