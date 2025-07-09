// Core Analytics Tracking Service
// Handles all user behavior tracking, event logging, and analytics

import { WorkshopData } from '../store/slices/workshopSlice';

// Types
export interface TrackingEvent {
  eventName: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  customDimensions?: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
}

export interface PageViewEvent {
  path: string;
  title: string;
  referrer?: string;
  searchParams?: Record<string, string>;
  duration?: number;
  exitRate?: number;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  pageViews: number;
  events: number;
  source?: string;
  medium?: string;
  campaign?: string;
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser: string;
    os: string;
    screenResolution: string;
  };
}

export interface ConversionFunnel {
  funnelName: string;
  steps: Array<{
    name: string;
    completed: boolean;
    timestamp?: Date;
    timeSpent?: number;
    dropOffRate?: number;
  }>;
  conversionRate: number;
  totalTime: number;
}

export interface WorkshopAnalytics {
  workshopStarted: boolean;
  workshopCompleted: boolean;
  stepsCompleted: string[];
  timePerStep: Record<string, number>;
  totalTime: number;
  dropOffStep?: string;
  completionRate: number;
  dataQuality: {
    valuesProvided: boolean;
    audienceDetailed: boolean;
    writingSampleLength: number;
    personalityAnswered: boolean;
  };
}

export interface ABTestVariant {
  testId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
  converted: boolean;
  conversionValue?: number;
  events: Array<{
    eventName: string;
    timestamp: Date;
    properties?: Record<string, any>;
  }>;
}

// Privacy settings
export interface PrivacySettings {
  consentGiven: boolean;
  consentTimestamp?: Date;
  analyticsEnabled: boolean;
  performanceEnabled: boolean;
  marketingEnabled: boolean;
  anonymousMode: boolean;
  doNotTrack: boolean;
}

class TrackingService {
  private sessionId: string;
  private userId?: string;
  private sessionStartTime: Date;
  private pageStartTime?: Date;
  private currentPage?: string;
  private eventQueue: TrackingEvent[] = [];
  private privacySettings: PrivacySettings;
  private abTests: Map<string, ABTestVariant> = new Map();
  private workshopStartTime?: Date;
  private workshopStepTimes: Map<string, Date> = new Map();

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.privacySettings = this.loadPrivacySettings();
    this.initializeGA4();
    this.setupEventListeners();
    this.startSessionHeartbeat();
  }

  // Initialize Google Analytics 4
  private initializeGA4() {
    if (!this.privacySettings.analyticsEnabled) return;

    const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!GA_MEASUREMENT_ID) {
      console.warn('Google Analytics measurement ID not configured');
      return;
    }

    // Load GA4 script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function() {
      (window as any).dataLayer.push(arguments);
    };
    
    (window as any).gtag('js', new Date());
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false, // We'll handle page views manually
      cookie_flags: 'SameSite=None;Secure',
      anonymize_ip: this.privacySettings.anonymousMode,
    });

    // Set user properties
    if (this.userId && !this.privacySettings.anonymousMode) {
      (window as any).gtag('set', { user_id: this.userId });
    }
  }

  // Set user ID for tracking
  setUserId(userId: string) {
    if (this.privacySettings.anonymousMode) return;
    
    this.userId = userId;
    
    // Update GA4
    if ((window as any).gtag) {
      (window as any).gtag('set', { user_id: userId });
    }

    // Track user identification event
    this.trackEvent({
      category: 'User',
      action: 'Identified',
      label: 'Login',
    });
  }

  // Track page views
  trackPageView(path: string, title?: string) {
    if (!this.privacySettings.analyticsEnabled) return;

    // End tracking for previous page
    if (this.currentPage && this.pageStartTime) {
      const duration = Date.now() - this.pageStartTime.getTime();
      this.trackEvent({
        category: 'Page',
        action: 'Exit',
        label: this.currentPage,
        value: Math.round(duration / 1000),
      });
    }

    // Start tracking new page
    this.currentPage = path;
    this.pageStartTime = new Date();

    // Send to GA4
    if ((window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        page_location: window.location.href,
        page_referrer: document.referrer,
      });
    }

    // Track internally
    const pageView: PageViewEvent = {
      path,
      title: title || document.title,
      referrer: document.referrer,
      searchParams: this.getSearchParams(),
    };

    this.storePageView(pageView);
  }

  // Track custom events
  trackEvent(event: Partial<TrackingEvent>) {
    if (!this.privacySettings.analyticsEnabled) return;

    const fullEvent: TrackingEvent = {
      eventName: event.eventName || `${event.category}_${event.action}`,
      category: event.category || 'General',
      action: event.action || 'Click',
      label: event.label,
      value: event.value,
      customDimensions: event.customDimensions,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    // Send to GA4
    if ((window as any).gtag) {
      (window as any).gtag('event', fullEvent.eventName, {
        event_category: fullEvent.category,
        event_label: fullEvent.label,
        value: fullEvent.value,
        ...fullEvent.customDimensions,
      });
    }

    // Store internally
    this.eventQueue.push(fullEvent);
    this.processEventQueue();
  }

  // Workshop-specific tracking
  trackWorkshopStart() {
    this.workshopStartTime = new Date();
    this.trackEvent({
      category: 'Workshop',
      action: 'Started',
      label: 'Brand House',
    });
  }

  trackWorkshopStepStart(stepName: string) {
    this.workshopStepTimes.set(stepName, new Date());
    this.trackEvent({
      category: 'Workshop',
      action: 'Step Started',
      label: stepName,
    });
  }

  trackWorkshopStepComplete(stepName: string, data?: any) {
    const startTime = this.workshopStepTimes.get(stepName);
    const timeSpent = startTime ? Date.now() - startTime.getTime() : 0;

    this.trackEvent({
      category: 'Workshop',
      action: 'Step Completed',
      label: stepName,
      value: Math.round(timeSpent / 1000),
      customDimensions: {
        step_name: stepName,
        time_spent: timeSpent,
        data_quality: this.assessDataQuality(stepName, data),
      },
    });
  }

  trackWorkshopComplete(workshopData: WorkshopData) {
    const totalTime = this.workshopStartTime 
      ? Date.now() - this.workshopStartTime.getTime() 
      : 0;

    this.trackEvent({
      category: 'Workshop',
      action: 'Completed',
      label: 'Brand House',
      value: Math.round(totalTime / 1000),
      customDimensions: {
        archetype: workshopData.archetype,
        total_time: totalTime,
        steps_completed: Object.keys(workshopData).length,
        has_values: !!workshopData.values?.length,
        has_audience: !!workshopData.audience?.personas?.length,
        has_writing: !!workshopData.writingSample?.text,
        has_personality: !!workshopData.personality?.traits?.length,
      },
    });

    // Track conversion
    this.trackConversion('workshop_complete', 100);
  }

  trackWorkshopDropOff(stepName: string, reason?: string) {
    const totalTime = this.workshopStartTime 
      ? Date.now() - this.workshopStartTime.getTime() 
      : 0;

    this.trackEvent({
      category: 'Workshop',
      action: 'Dropped Off',
      label: stepName,
      value: Math.round(totalTime / 1000),
      customDimensions: {
        drop_off_step: stepName,
        drop_off_reason: reason,
        steps_completed: this.workshopStepTimes.size,
      },
    });
  }

  // Content tracking
  trackContentGenerated(contentType: string, pillar: string, source: string) {
    this.trackEvent({
      category: 'Content',
      action: 'Generated',
      label: contentType,
      customDimensions: {
        content_pillar: pillar,
        content_source: source,
      },
    });
  }

  trackContentPublished(contentId: string, platform: string) {
    this.trackEvent({
      category: 'Content',
      action: 'Published',
      label: platform,
      customDimensions: {
        content_id: contentId,
        publish_platform: platform,
      },
    });

    // Track conversion
    this.trackConversion('content_published', 50);
  }

  // LinkedIn tracking
  trackLinkedInConnect() {
    this.trackEvent({
      category: 'LinkedIn',
      action: 'Connected',
      label: 'OAuth',
    });
  }

  trackLinkedInPost(postId: string, scheduled: boolean) {
    this.trackEvent({
      category: 'LinkedIn',
      action: scheduled ? 'Scheduled' : 'Posted',
      label: postId,
    });
  }

  // Conversion tracking
  trackConversion(conversionName: string, value?: number) {
    if (!this.privacySettings.analyticsEnabled) return;

    this.trackEvent({
      category: 'Conversion',
      action: conversionName,
      value: value,
    });

    // Send to GA4
    if ((window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        conversion_name: conversionName,
        value: value,
        currency: 'USD',
      });
    }
  }

  // A/B Testing
  assignABTestVariant(testId: string, variants: string[]): string {
    // Check if user already assigned to this test
    const existingVariant = this.abTests.get(testId);
    if (existingVariant) {
      return existingVariant.variantId;
    }

    // Assign random variant
    const variantId = variants[Math.floor(Math.random() * variants.length)];
    
    const variant: ABTestVariant = {
      testId,
      variantId,
      userId: this.userId || this.sessionId,
      assignedAt: new Date(),
      converted: false,
      events: [],
    };

    this.abTests.set(testId, variant);
    
    // Track assignment
    this.trackEvent({
      category: 'ABTest',
      action: 'Assigned',
      label: testId,
      customDimensions: {
        test_id: testId,
        variant_id: variantId,
      },
    });

    return variantId;
  }

  trackABTestEvent(testId: string, eventName: string, properties?: Record<string, any>) {
    const variant = this.abTests.get(testId);
    if (!variant) return;

    variant.events.push({
      eventName,
      timestamp: new Date(),
      properties,
    });

    this.trackEvent({
      category: 'ABTest',
      action: 'Event',
      label: `${testId}_${eventName}`,
      customDimensions: {
        test_id: testId,
        variant_id: variant.variantId,
        event_name: eventName,
        ...properties,
      },
    });
  }

  trackABTestConversion(testId: string, value?: number) {
    const variant = this.abTests.get(testId);
    if (!variant) return;

    variant.converted = true;
    variant.conversionValue = value;

    this.trackEvent({
      category: 'ABTest',
      action: 'Converted',
      label: testId,
      value: value,
      customDimensions: {
        test_id: testId,
        variant_id: variant.variantId,
      },
    });
  }

  // Privacy & Consent
  updatePrivacySettings(settings: Partial<PrivacySettings>) {
    this.privacySettings = {
      ...this.privacySettings,
      ...settings,
      consentTimestamp: new Date(),
    };

    // Store in localStorage
    localStorage.setItem('privacy_settings', JSON.stringify(this.privacySettings));

    // Update GA4 settings
    if ((window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: settings.analyticsEnabled ? 'granted' : 'denied',
        ads_storage: settings.marketingEnabled ? 'granted' : 'denied',
      });
    }

    this.trackEvent({
      category: 'Privacy',
      action: 'Settings Updated',
      customDimensions: settings,
    });
  }

  getPrivacySettings(): PrivacySettings {
    return { ...this.privacySettings };
  }

  // Utility methods
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSearchParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  private loadPrivacySettings(): PrivacySettings {
    const stored = localStorage.getItem('privacy_settings');
    if (stored) {
      return JSON.parse(stored);
    }

    // Default settings
    return {
      consentGiven: false,
      analyticsEnabled: false,
      performanceEnabled: true,
      marketingEnabled: false,
      anonymousMode: false,
      doNotTrack: navigator.doNotTrack === '1',
    };
  }

  private assessDataQuality(stepName: string, data: any): string {
    if (!data) return 'empty';
    
    switch (stepName) {
      case 'values':
        return data.length >= 5 ? 'complete' : 'partial';
      case 'audience':
        return data.personas?.length >= 2 ? 'complete' : 'partial';
      case 'writing':
        return data.text?.length >= 100 ? 'complete' : 'partial';
      case 'personality':
        return data.traits?.length >= 3 ? 'complete' : 'partial';
      default:
        return 'unknown';
    }
  }

  private storePageView(pageView: PageViewEvent) {
    // Store in session storage for analytics dashboard
    const pageViews = JSON.parse(sessionStorage.getItem('page_views') || '[]');
    pageViews.push({
      ...pageView,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    });
    sessionStorage.setItem('page_views', JSON.stringify(pageViews));
  }

  private processEventQueue() {
    if (this.eventQueue.length === 0) return;

    // Batch process events (in production, send to analytics API)
    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Store in session storage for analytics dashboard
    const storedEvents = JSON.parse(sessionStorage.getItem('analytics_events') || '[]');
    storedEvents.push(...events);
    sessionStorage.setItem('analytics_events', JSON.stringify(storedEvents));
  }

  private setupEventListeners() {
    // Track page unload
    window.addEventListener('beforeunload', () => {
      if (this.currentPage && this.pageStartTime) {
        const duration = Date.now() - this.pageStartTime.getTime();
        this.trackEvent({
          category: 'Page',
          action: 'Unload',
          label: this.currentPage,
          value: Math.round(duration / 1000),
        });
      }

      // End session
      this.endSession();
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.trackEvent({
        category: 'Error',
        action: 'JavaScript Error',
        label: event.message,
        customDimensions: {
          error_message: event.message,
          error_file: event.filename,
          error_line: event.lineno,
          error_column: event.colno,
        },
      });
    });
  }

  private startSessionHeartbeat() {
    // Send heartbeat every 30 seconds to track session duration
    setInterval(() => {
      if (this.privacySettings.analyticsEnabled) {
        this.trackEvent({
          category: 'Session',
          action: 'Heartbeat',
          value: Math.round((Date.now() - this.sessionStartTime.getTime()) / 1000),
        });
      }
    }, 30000);
  }

  private endSession() {
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    
    this.trackEvent({
      category: 'Session',
      action: 'End',
      value: Math.round(sessionDuration / 1000),
    });

    // Process any remaining events
    this.processEventQueue();
  }

  // Public methods for analytics dashboard
  getSessionAnalytics(): {
    pageViews: any[];
    events: any[];
    sessionDuration: number;
    currentSession: UserSession;
  } {
    const pageViews = JSON.parse(sessionStorage.getItem('page_views') || '[]');
    const events = JSON.parse(sessionStorage.getItem('analytics_events') || '[]');
    
    return {
      pageViews,
      events,
      sessionDuration: Date.now() - this.sessionStartTime.getTime(),
      currentSession: {
        sessionId: this.sessionId,
        userId: this.userId,
        startTime: this.sessionStartTime,
        pageViews: pageViews.length,
        events: events.length,
        device: this.getDeviceInfo(),
      },
    };
  }

  private getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const screenWidth = window.screen.width;
    
    return {
      type: screenWidth < 768 ? 'mobile' : screenWidth < 1024 ? 'tablet' : 'desktop' as any,
      browser: this.getBrowser(userAgent),
      os: this.getOS(userAgent),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  }

  private getBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  }
}

// Export singleton instance
export const trackingService = new TrackingService();