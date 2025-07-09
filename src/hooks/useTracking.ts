// React hook for analytics tracking
// Provides easy integration with trackingService

import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { trackingService } from '../services/trackingService';

export interface UseTrackingOptions {
  trackPageViews?: boolean;
  trackClicks?: boolean;
  trackScrollDepth?: boolean;
  trackTimeOnPage?: boolean;
}

export function useTracking(options: UseTrackingOptions = {}) {
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const workshopData = useSelector((state: RootState) => state.workshop);
  const scrollDepthRef = useRef(0);
  const pageStartTimeRef = useRef<Date>();

  // Set user ID when authenticated
  useEffect(() => {
    if (user?.id) {
      trackingService.setUserId(user.id);
    }
  }, [user?.id]);

  // Track page views
  useEffect(() => {
    if (options.trackPageViews !== false) {
      trackingService.trackPageView(location.pathname);
      pageStartTimeRef.current = new Date();
    }

    // Track time on page when navigating away
    return () => {
      if (options.trackTimeOnPage && pageStartTimeRef.current) {
        const timeOnPage = Date.now() - pageStartTimeRef.current.getTime();
        trackingService.trackEvent({
          category: 'Engagement',
          action: 'Time on Page',
          label: location.pathname,
          value: Math.round(timeOnPage / 1000),
        });
      }
    };
  }, [location.pathname, options.trackPageViews, options.trackTimeOnPage]);

  // Track scroll depth
  useEffect(() => {
    if (!options.trackScrollDepth) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const scrollPercentage = Math.round((scrolled / scrollHeight) * 100);

      // Track 25%, 50%, 75%, and 100% milestones
      const milestones = [25, 50, 75, 100];
      const currentMilestone = milestones.find(m => 
        scrollPercentage >= m && scrollDepthRef.current < m
      );

      if (currentMilestone) {
        scrollDepthRef.current = currentMilestone;
        trackingService.trackEvent({
          category: 'Engagement',
          action: 'Scroll Depth',
          label: location.pathname,
          value: currentMilestone,
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname, options.trackScrollDepth]);

  // Track clicks
  useEffect(() => {
    if (!options.trackClicks) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Track button clicks
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const button = target.closest('button') as HTMLElement;
        trackingService.trackEvent({
          category: 'Interaction',
          action: 'Button Click',
          label: button.textContent || button.getAttribute('aria-label') || 'Unknown',
          customDimensions: {
            button_id: button.id,
            button_class: button.className,
            page: location.pathname,
          },
        });
      }

      // Track link clicks
      if (target.tagName === 'A' || target.closest('a')) {
        const link = target.closest('a') as HTMLAnchorElement;
        const isExternal = link.hostname !== window.location.hostname;
        
        trackingService.trackEvent({
          category: 'Interaction',
          action: isExternal ? 'External Link Click' : 'Internal Link Click',
          label: link.href,
          customDimensions: {
            link_text: link.textContent,
            link_target: link.target,
            page: location.pathname,
          },
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [location.pathname, options.trackClicks]);

  // Helper functions
  const trackEvent = useCallback((
    category: string,
    action: string,
    label?: string,
    value?: number,
    customDimensions?: Record<string, any>
  ) => {
    trackingService.trackEvent({
      category,
      action,
      label,
      value,
      customDimensions,
    });
  }, []);

  const trackWorkshopStep = useCallback((
    action: 'start' | 'complete' | 'skip',
    stepName: string
  ) => {
    if (action === 'start') {
      trackingService.trackWorkshopStepStart(stepName);
    } else if (action === 'complete') {
      trackingService.trackWorkshopStepComplete(stepName, workshopData);
    } else {
      trackingService.trackEvent({
        category: 'Workshop',
        action: 'Step Skipped',
        label: stepName,
      });
    }
  }, [workshopData]);

  const trackContentAction = useCallback((
    action: 'generate' | 'edit' | 'publish' | 'schedule' | 'delete',
    contentType: string,
    metadata?: Record<string, any>
  ) => {
    trackingService.trackEvent({
      category: 'Content',
      action: action.charAt(0).toUpperCase() + action.slice(1),
      label: contentType,
      customDimensions: metadata,
    });
  }, []);

  const trackFeatureUsage = useCallback((
    featureName: string,
    action?: string,
    metadata?: Record<string, any>
  ) => {
    trackingService.trackEvent({
      category: 'Feature',
      action: action || 'Used',
      label: featureName,
      customDimensions: metadata,
    });
  }, []);

  const trackError = useCallback((
    errorMessage: string,
    errorType?: string,
    metadata?: Record<string, any>
  ) => {
    trackingService.trackEvent({
      category: 'Error',
      action: errorType || 'Application Error',
      label: errorMessage,
      customDimensions: metadata,
    });
  }, []);

  const trackConversion = useCallback((
    conversionName: string,
    value?: number
  ) => {
    trackingService.trackConversion(conversionName, value);
  }, []);

  // A/B Testing helpers
  const getABTestVariant = useCallback((
    testId: string,
    variants: string[]
  ): string => {
    return trackingService.assignABTestVariant(testId, variants);
  }, []);

  const trackABTestEvent = useCallback((
    testId: string,
    eventName: string,
    properties?: Record<string, any>
  ) => {
    trackingService.trackABTestEvent(testId, eventName, properties);
  }, []);

  const trackABTestConversion = useCallback((
    testId: string,
    value?: number
  ) => {
    trackingService.trackABTestConversion(testId, value);
  }, []);

  return {
    trackEvent,
    trackWorkshopStep,
    trackContentAction,
    trackFeatureUsage,
    trackError,
    trackConversion,
    getABTestVariant,
    trackABTestEvent,
    trackABTestConversion,
  };
}

// Custom hook for workshop tracking
export function useWorkshopTracking() {
  const workshopData = useSelector((state: RootState) => state.workshop);
  const { trackWorkshopStep } = useTracking();

  const trackWorkshopStart = useCallback(() => {
    trackingService.trackWorkshopStart();
  }, []);

  const trackWorkshopComplete = useCallback(() => {
    trackingService.trackWorkshopComplete(workshopData);
  }, [workshopData]);

  const trackWorkshopDropOff = useCallback((stepName: string, reason?: string) => {
    trackingService.trackWorkshopDropOff(stepName, reason);
  }, []);

  return {
    trackWorkshopStart,
    trackWorkshopComplete,
    trackWorkshopDropOff,
    trackStepStart: (step: string) => trackWorkshopStep('start', step),
    trackStepComplete: (step: string) => trackWorkshopStep('complete', step),
    trackStepSkip: (step: string) => trackWorkshopStep('skip', step),
  };
}

// Custom hook for content tracking
export function useContentTracking() {
  const { trackContentAction, trackEvent } = useTracking();

  const trackContentGenerated = useCallback((
    contentType: string,
    pillar: string,
    source: string
  ) => {
    trackingService.trackContentGenerated(contentType, pillar, source);
  }, []);

  const trackContentPublished = useCallback((
    contentId: string,
    platform: string
  ) => {
    trackingService.trackContentPublished(contentId, platform);
  }, []);

  const trackLinkedInConnect = useCallback(() => {
    trackingService.trackLinkedInConnect();
  }, []);

  const trackLinkedInPost = useCallback((
    postId: string,
    scheduled: boolean
  ) => {
    trackingService.trackLinkedInPost(postId, scheduled);
  }, []);

  return {
    trackContentGenerated,
    trackContentPublished,
    trackLinkedInConnect,
    trackLinkedInPost,
    trackContentEdit: (contentId: string) => 
      trackContentAction('edit', 'post', { content_id: contentId }),
    trackContentSchedule: (contentId: string, scheduledTime: Date) =>
      trackContentAction('schedule', 'post', { 
        content_id: contentId,
        scheduled_time: scheduledTime.toISOString(),
      }),
    trackContentDelete: (contentId: string) =>
      trackContentAction('delete', 'post', { content_id: contentId }),
  };
}