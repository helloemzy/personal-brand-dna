// User Analytics Service
// Provides detailed analytics for user behavior, workshop performance, and content engagement

import { trackingService } from './trackingService';

export interface UserJourney {
  userId?: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  touchpoints: Array<{
    type: 'page_view' | 'event' | 'conversion';
    timestamp: Date;
    details: any;
  }>;
  workshopStatus: {
    started: boolean;
    completed: boolean;
    stepsCompleted: string[];
    dropOffStep?: string;
    totalTime?: number;
  };
  contentEngagement: {
    postsGenerated: number;
    postsPublished: number;
    postsScheduled: number;
    engagementRate?: number;
  };
  conversionEvents: Array<{
    name: string;
    timestamp: Date;
    value?: number;
  }>;
}

export interface WorkshopFunnel {
  totalStarts: number;
  stepCompletion: Record<string, {
    started: number;
    completed: number;
    dropOff: number;
    avgTimeSpent: number;
  }>;
  overallCompletion: number;
  avgCompletionTime: number;
  dropOffReasons: Record<string, number>;
}

export interface ContentPerformance {
  totalGenerated: number;
  totalPublished: number;
  byPillar: Record<string, {
    generated: number;
    published: number;
    avgEngagement: number;
  }>;
  bySource: Record<string, number>;
  publishingTimes: Record<string, number>;
  topPerformingTopics: Array<{
    topic: string;
    pillar: string;
    engagement: number;
  }>;
}

export interface FeatureAdoption {
  feature: string;
  firstUsed?: Date;
  lastUsed?: Date;
  totalUses: number;
  uniqueUsers: number;
  adoptionRate: number;
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

export interface UserSegment {
  segmentName: string;
  criteria: Record<string, any>;
  userCount: number;
  characteristics: {
    avgSessionDuration: number;
    avgPageViews: number;
    conversionRate: number;
    topFeatures: string[];
    commonPaths: string[][];
  };
}

class UserAnalyticsService {
  // Get user journey analytics
  async getUserJourney(userId?: string, sessionId?: string): Promise<UserJourney> {
    const sessionData = trackingService.getSessionAnalytics();
    const events = sessionData.events.filter(e => 
      (!userId || e.userId === userId) && 
      (!sessionId || e.sessionId === sessionId)
    );

    const journey: UserJourney = {
      userId,
      sessionId: sessionId || sessionData.currentSession.sessionId,
      startTime: sessionData.currentSession.startTime,
      touchpoints: [],
      workshopStatus: {
        started: false,
        completed: false,
        stepsCompleted: [],
      },
      contentEngagement: {
        postsGenerated: 0,
        postsPublished: 0,
        postsScheduled: 0,
      },
      conversionEvents: [],
    };

    // Process events
    events.forEach(event => {
      journey.touchpoints.push({
        type: 'event',
        timestamp: new Date(event.timestamp),
        details: event,
      });

      // Track workshop progress
      if (event.category === 'Workshop') {
        if (event.action === 'Started') {
          journey.workshopStatus.started = true;
        } else if (event.action === 'Step Completed') {
          journey.workshopStatus.stepsCompleted.push(event.label);
        } else if (event.action === 'Completed') {
          journey.workshopStatus.completed = true;
          journey.workshopStatus.totalTime = event.value;
        } else if (event.action === 'Dropped Off') {
          journey.workshopStatus.dropOffStep = event.label;
        }
      }

      // Track content engagement
      if (event.category === 'Content') {
        if (event.action === 'Generated') {
          journey.contentEngagement.postsGenerated++;
        } else if (event.action === 'Published') {
          journey.contentEngagement.postsPublished++;
        } else if (event.action === 'Scheduled') {
          journey.contentEngagement.postsScheduled++;
        }
      }

      // Track conversions
      if (event.category === 'Conversion') {
        journey.conversionEvents.push({
          name: event.action,
          timestamp: new Date(event.timestamp),
          value: event.value,
        });
      }
    });

    // Add page views
    sessionData.pageViews.forEach(pageView => {
      journey.touchpoints.push({
        type: 'page_view',
        timestamp: new Date(pageView.timestamp),
        details: pageView,
      });
    });

    // Sort touchpoints by timestamp
    journey.touchpoints.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    return journey;
  }

  // Get workshop funnel analytics
  async getWorkshopFunnel(timeframe?: { start: Date; end: Date }): Promise<WorkshopFunnel> {
    const sessionData = trackingService.getSessionAnalytics();
    const workshopEvents = sessionData.events.filter(e => 
      e.category === 'Workshop' &&
      (!timeframe || (
        new Date(e.timestamp) >= timeframe.start &&
        new Date(e.timestamp) <= timeframe.end
      ))
    );

    const funnel: WorkshopFunnel = {
      totalStarts: 0,
      stepCompletion: {},
      overallCompletion: 0,
      avgCompletionTime: 0,
      dropOffReasons: {},
    };

    const sessions = new Map<string, any[]>();
    
    // Group events by session
    workshopEvents.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
      }
      sessions.get(event.sessionId)!.push(event);
    });

    // Analyze each session
    sessions.forEach(events => {
      const started = events.find(e => e.action === 'Started');
      const completed = events.find(e => e.action === 'Completed');
      const droppedOff = events.find(e => e.action === 'Dropped Off');

      if (started) {
        funnel.totalStarts++;
      }

      if (completed) {
        funnel.overallCompletion++;
        if (completed.value) {
          funnel.avgCompletionTime += completed.value;
        }
      }

      if (droppedOff) {
        const reason = droppedOff.customDimensions?.drop_off_reason || 'unknown';
        funnel.dropOffReasons[reason] = (funnel.dropOffReasons[reason] || 0) + 1;
      }

      // Track step completion
      events.forEach(event => {
        if (event.action === 'Step Started' || event.action === 'Step Completed') {
          const stepName = event.label;
          if (!funnel.stepCompletion[stepName]) {
            funnel.stepCompletion[stepName] = {
              started: 0,
              completed: 0,
              dropOff: 0,
              avgTimeSpent: 0,
            };
          }

          if (event.action === 'Step Started') {
            funnel.stepCompletion[stepName].started++;
          } else {
            funnel.stepCompletion[stepName].completed++;
            if (event.value) {
              funnel.stepCompletion[stepName].avgTimeSpent += event.value;
            }
          }
        }
      });
    });

    // Calculate averages and drop-off rates
    if (funnel.overallCompletion > 0) {
      funnel.avgCompletionTime /= funnel.overallCompletion;
    }

    Object.keys(funnel.stepCompletion).forEach(step => {
      const stepData = funnel.stepCompletion[step];
      stepData.dropOff = stepData.started - stepData.completed;
      if (stepData.completed > 0) {
        stepData.avgTimeSpent /= stepData.completed;
      }
    });

    return funnel;
  }

  // Get content performance analytics
  async getContentPerformance(timeframe?: { start: Date; end: Date }): Promise<ContentPerformance> {
    const sessionData = trackingService.getSessionAnalytics();
    const contentEvents = sessionData.events.filter(e => 
      e.category === 'Content' &&
      (!timeframe || (
        new Date(e.timestamp) >= timeframe.start &&
        new Date(e.timestamp) <= timeframe.end
      ))
    );

    const performance: ContentPerformance = {
      totalGenerated: 0,
      totalPublished: 0,
      byPillar: {},
      bySource: {},
      publishingTimes: {},
      topPerformingTopics: [],
    };

    contentEvents.forEach(event => {
      if (event.action === 'Generated') {
        performance.totalGenerated++;
        
        const pillar = event.customDimensions?.content_pillar || 'unknown';
        const source = event.customDimensions?.content_source || 'manual';
        
        if (!performance.byPillar[pillar]) {
          performance.byPillar[pillar] = {
            generated: 0,
            published: 0,
            avgEngagement: 0,
          };
        }
        performance.byPillar[pillar].generated++;
        
        performance.bySource[source] = (performance.bySource[source] || 0) + 1;
      } else if (event.action === 'Published') {
        performance.totalPublished++;
        
        const hour = new Date(event.timestamp).getHours();
        performance.publishingTimes[hour] = (performance.publishingTimes[hour] || 0) + 1;
      }
    });

    return performance;
  }

  // Get feature adoption analytics
  async getFeatureAdoption(featureName?: string): Promise<FeatureAdoption[]> {
    const sessionData = trackingService.getSessionAnalytics();
    const featureEvents = sessionData.events.filter(e => 
      e.category === 'Feature' &&
      (!featureName || e.label === featureName)
    );

    const features = new Map<string, FeatureAdoption>();
    const userFeatureUsage = new Map<string, Set<string>>();

    featureEvents.forEach(event => {
      const feature = event.label;
      if (!features.has(feature)) {
        features.set(feature, {
          feature,
          totalUses: 0,
          uniqueUsers: 0,
          adoptionRate: 0,
          retention: { day1: 0, day7: 0, day30: 0 },
        });
      }

      const featureData = features.get(feature)!;
      featureData.totalUses++;

      if (!featureData.firstUsed || new Date(event.timestamp) < featureData.firstUsed) {
        featureData.firstUsed = new Date(event.timestamp);
      }

      if (!featureData.lastUsed || new Date(event.timestamp) > featureData.lastUsed) {
        featureData.lastUsed = new Date(event.timestamp);
      }

      // Track unique users
      if (event.userId) {
        if (!userFeatureUsage.has(feature)) {
          userFeatureUsage.set(feature, new Set());
        }
        userFeatureUsage.get(feature)!.add(event.userId);
      }
    });

    // Calculate unique users and adoption rate
    features.forEach((featureData, feature) => {
      const uniqueUsers = userFeatureUsage.get(feature)?.size || 0;
      featureData.uniqueUsers = uniqueUsers;
      
      // This would need total user count from database
      // For now, using a placeholder
      const totalUsers = 1000;
      featureData.adoptionRate = (uniqueUsers / totalUsers) * 100;
    });

    return Array.from(features.values());
  }

  // Get user segments
  async getUserSegments(): Promise<UserSegment[]> {
    // This would typically analyze user data from database
    // For now, returning mock segments based on session data
    
    return [
      {
        segmentName: 'Power Users',
        criteria: {
          workshopCompleted: true,
          contentPublished: '>10',
          sessionDuration: '>30min',
        },
        userCount: 150,
        characteristics: {
          avgSessionDuration: 45 * 60 * 1000, // 45 minutes
          avgPageViews: 25,
          conversionRate: 0.85,
          topFeatures: ['Content Generation', 'LinkedIn Publishing', 'Analytics'],
          commonPaths: [
            ['/', '/brand-house', '/workshop/results', '/content'],
            ['/dashboard', '/content', '/content/calendar'],
          ],
        },
      },
      {
        segmentName: 'Workshop Completers',
        criteria: {
          workshopCompleted: true,
          contentPublished: '<5',
        },
        userCount: 320,
        characteristics: {
          avgSessionDuration: 25 * 60 * 1000, // 25 minutes
          avgPageViews: 15,
          conversionRate: 0.65,
          topFeatures: ['Brand House Workshop', 'Content Ideas'],
          commonPaths: [
            ['/', '/brand-house', '/workshop/results'],
            ['/get-started', '/brand-house/assessment', '/brand-house'],
          ],
        },
      },
      {
        segmentName: 'Explorers',
        criteria: {
          workshopCompleted: false,
          pageViews: '>10',
        },
        userCount: 580,
        characteristics: {
          avgSessionDuration: 15 * 60 * 1000, // 15 minutes
          avgPageViews: 12,
          conversionRate: 0.25,
          topFeatures: ['Homepage', 'Pricing', 'About'],
          commonPaths: [
            ['/', '/get-started', '/login'],
            ['/', '/pricing', '/'],
          ],
        },
      },
    ];
  }

  // Get conversion funnel for specific goals
  async getConversionFunnel(goalName: string): Promise<{
    steps: Array<{
      name: string;
      users: number;
      conversionRate: number;
    }>;
    overallConversion: number;
  }> {
    // Define funnel steps for different goals
    const funnels: Record<string, string[]> = {
      'workshop_complete': [
        'Landing Page Visit',
        'Get Started Click',
        'Workshop Started',
        'Step 1 Complete',
        'Step 2 Complete',
        'Step 3 Complete',
        'Step 4 Complete',
        'Step 5 Complete',
        'Workshop Complete',
      ],
      'content_publish': [
        'Dashboard Visit',
        'Content Page Visit',
        'Content Generated',
        'Content Edited',
        'LinkedIn Connected',
        'Content Published',
      ],
      'subscription': [
        'Pricing Page Visit',
        'Tier Selected',
        'Payment Info Entered',
        'Subscription Activated',
      ],
    };

    const steps = funnels[goalName] || [];
    const funnelData = steps.map((step, index) => ({
      name: step,
      users: Math.max(1000 - (index * 150), 100), // Mock decreasing users
      conversionRate: index === 0 ? 1 : 0.85 - (index * 0.1),
    }));

    return {
      steps: funnelData,
      overallConversion: funnelData[funnelData.length - 1].users / funnelData[0].users,
    };
  }

  // Export analytics data
  async exportAnalytics(format: 'csv' | 'json', dataType: string): Promise<Blob> {
    let data: any;

    switch (dataType) {
      case 'workshop_funnel':
        data = await this.getWorkshopFunnel();
        break;
      case 'content_performance':
        data = await this.getContentPerformance();
        break;
      case 'feature_adoption':
        data = await this.getFeatureAdoption();
        break;
      case 'user_segments':
        data = await this.getUserSegments();
        break;
      default:
        data = trackingService.getSessionAnalytics();
    }

    if (format === 'json') {
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    } else {
      // Convert to CSV
      const csv = this.convertToCSV(data);
      return new Blob([csv], { type: 'text/csv' });
    }
  }

  private convertToCSV(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const rows = data.map(item => 
        headers.map(header => JSON.stringify(item[header] || '')).join(',')
      );
      
      return [headers.join(','), ...rows].join('\n');
    } else {
      // Convert object to key-value CSV
      const rows = Object.entries(data).map(([key, value]) => 
        `${key},${JSON.stringify(value)}`
      );
      return ['Key,Value', ...rows].join('\n');
    }
  }
}

export const userAnalyticsService = new UserAnalyticsService();