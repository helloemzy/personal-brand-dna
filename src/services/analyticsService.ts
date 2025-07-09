// Analytics Service for BrandPillar AI
// Tracks content performance, engagement metrics, and generates insights

import { WorkshopData } from '../store/slices/workshopSlice';

// Types
export interface ContentAnalytics {
  postId: string;
  contentPillar: 'expertise' | 'experience' | 'evolution';
  publishedAt: Date;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    engagementRate: number;
    reachScore: number;
  };
  audience: {
    industries: string[];
    roles: string[];
    locations: string[];
  };
  performance: {
    score: number; // 0-100
    trend: 'up' | 'down' | 'stable';
    benchmarkComparison: number; // % above/below average
  };
}

export interface PillarPerformance {
  pillar: string;
  postCount: number;
  avgEngagement: number;
  topPerformingTopics: string[];
  recommendedTopics: string[];
  optimalPostingTimes: string[];
}

export interface AudienceInsights {
  totalFollowers: number;
  followerGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  demographics: {
    industries: Array<{ name: string; percentage: number }>;
    seniority: Array<{ level: string; percentage: number }>;
    locations: Array<{ location: string; percentage: number }>;
    companies: Array<{ company: string; count: number }>;
  };
  engagementPatterns: {
    bestDays: string[];
    bestTimes: string[];
    contentPreferences: string[];
  };
}

export interface PerformanceMetrics {
  timeframe: '7d' | '30d' | '90d' | 'all';
  overview: {
    totalPosts: number;
    totalEngagement: number;
    avgEngagementRate: number;
    totalReach: number;
    profileViews: number;
  };
  trends: {
    engagement: Array<{ date: string; value: number }>;
    reach: Array<{ date: string; value: number }>;
    followers: Array<{ date: string; value: number }>;
  };
  topContent: ContentAnalytics[];
  contentPillars: PillarPerformance[];
  audience: AudienceInsights;
}

export interface ActionableInsights {
  recommendations: Array<{
    type: 'content' | 'timing' | 'audience' | 'strategy';
    priority: 'high' | 'medium' | 'low';
    insight: string;
    action: string;
    expectedImpact: string;
  }>;
  opportunities: Array<{
    topic: string;
    reason: string;
    suggestedAngle: string;
    estimatedEngagement: number;
  }>;
  warnings: Array<{
    issue: string;
    impact: string;
    solution: string;
  }>;
}

class AnalyticsService {
  // Mock data for demonstration
  private generateMockMetrics(timeframe: PerformanceMetrics['timeframe']): PerformanceMetrics {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    
    return {
      timeframe,
      overview: {
        totalPosts: Math.floor(days * 0.7),
        totalEngagement: Math.floor(days * 250 + Math.random() * 1000),
        avgEngagementRate: 4.2 + Math.random() * 2,
        totalReach: Math.floor(days * 1500 + Math.random() * 5000),
        profileViews: Math.floor(days * 100 + Math.random() * 500)
      },
      trends: {
        engagement: this.generateTrendData(days, 100, 500),
        reach: this.generateTrendData(days, 1000, 3000),
        followers: this.generateTrendData(days, 10, 50, true)
      },
      topContent: this.generateTopContent(5),
      contentPillars: this.generatePillarPerformance(),
      audience: this.generateAudienceInsights()
    };
  }

  private generateTrendData(days: number, min: number, max: number, cumulative = false): Array<{ date: string; value: number }> {
    const data = [];
    let cumulativeValue = 5000; // Starting followers for cumulative
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      if (cumulative) {
        cumulativeValue += Math.floor(Math.random() * (max - min) + min);
        data.push({
          date: date.toISOString().split('T')[0],
          value: cumulativeValue
        });
      } else {
        data.push({
          date: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * (max - min) + min)
        });
      }
    }
    
    return data;
  }

  private generateTopContent(count: number): ContentAnalytics[] {
    const pillars: Array<'expertise' | 'experience' | 'evolution'> = ['expertise', 'experience', 'evolution'];
    const topics = [
      'AI implementation strategies',
      'Leadership transformation stories',
      'Future of digital marketing',
      'Team building insights',
      'Innovation frameworks',
      'Customer success stories',
      'Industry trend analysis',
      'Personal growth journey'
    ];

    return Array.from({ length: count }, (_, i) => ({
      postId: `post-${i + 1}`,
      contentPillar: pillars[Math.floor(Math.random() * pillars.length)],
      publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      metrics: {
        views: Math.floor(Math.random() * 5000 + 1000),
        likes: Math.floor(Math.random() * 200 + 50),
        comments: Math.floor(Math.random() * 50 + 10),
        shares: Math.floor(Math.random() * 30 + 5),
        clicks: Math.floor(Math.random() * 100 + 20),
        engagementRate: Math.random() * 8 + 2,
        reachScore: Math.random() * 100
      },
      audience: {
        industries: ['Technology', 'Marketing', 'Consulting'],
        roles: ['Director', 'Manager', 'VP'],
        locations: ['San Francisco', 'New York', 'London']
      },
      performance: {
        score: Math.floor(Math.random() * 30 + 70),
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down',
        benchmarkComparison: Math.random() * 100 - 20
      }
    }));
  }

  private generatePillarPerformance(): PillarPerformance[] {
    return [
      {
        pillar: 'Expertise',
        postCount: 28,
        avgEngagement: 5.2,
        topPerformingTopics: ['AI implementation', 'Technical leadership', 'Innovation strategies'],
        recommendedTopics: ['Emerging technologies', 'Best practices', 'Case studies'],
        optimalPostingTimes: ['Tuesday 9AM', 'Thursday 2PM', 'Wednesday 11AM']
      },
      {
        pillar: 'Experience',
        postCount: 24,
        avgEngagement: 6.8,
        topPerformingTopics: ['Client success stories', 'Team transformations', 'Project insights'],
        recommendedTopics: ['Behind-the-scenes', 'Lessons learned', 'Personal anecdotes'],
        optimalPostingTimes: ['Monday 8AM', 'Wednesday 3PM', 'Friday 10AM']
      },
      {
        pillar: 'Evolution',
        postCount: 18,
        avgEngagement: 4.5,
        topPerformingTopics: ['Industry predictions', 'Trend analysis', 'Future vision'],
        recommendedTopics: ['Controversial takes', 'Market shifts', 'Innovation outlook'],
        optimalPostingTimes: ['Tuesday 11AM', 'Thursday 9AM', 'Monday 2PM']
      }
    ];
  }

  private generateAudienceInsights(): AudienceInsights {
    return {
      totalFollowers: 5847,
      followerGrowth: {
        daily: 15,
        weekly: 98,
        monthly: 423
      },
      demographics: {
        industries: [
          { name: 'Technology', percentage: 35 },
          { name: 'Marketing', percentage: 22 },
          { name: 'Consulting', percentage: 18 },
          { name: 'Finance', percentage: 15 },
          { name: 'Healthcare', percentage: 10 }
        ],
        seniority: [
          { level: 'Director', percentage: 28 },
          { level: 'Manager', percentage: 25 },
          { level: 'VP', percentage: 20 },
          { level: 'C-Suite', percentage: 15 },
          { level: 'Individual Contributor', percentage: 12 }
        ],
        locations: [
          { location: 'United States', percentage: 45 },
          { location: 'United Kingdom', percentage: 18 },
          { location: 'Canada', percentage: 12 },
          { location: 'Australia', percentage: 8 },
          { location: 'India', percentage: 7 }
        ],
        companies: [
          { company: 'Microsoft', count: 87 },
          { company: 'Google', count: 73 },
          { company: 'Amazon', count: 65 },
          { company: 'Meta', count: 52 },
          { company: 'Apple', count: 48 }
        ]
      },
      engagementPatterns: {
        bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
        bestTimes: ['9:00 AM', '12:00 PM', '3:00 PM'],
        contentPreferences: ['How-to guides', 'Personal stories', 'Industry insights']
      }
    };
  }

  async getPerformanceMetrics(timeframe: PerformanceMetrics['timeframe'] = '30d'): Promise<PerformanceMetrics> {
    // In production, this would fetch from analytics API
    return this.generateMockMetrics(timeframe);
  }

  async getContentAnalytics(postIds?: string[]): Promise<ContentAnalytics[]> {
    // In production, fetch specific post analytics
    return this.generateTopContent(postIds?.length || 10);
  }

  async generateInsights(workshopData: WorkshopData, metrics: PerformanceMetrics): Promise<ActionableInsights> {
    const insights: ActionableInsights = {
      recommendations: [],
      opportunities: [],
      warnings: []
    };

    // Generate recommendations based on performance
    if (metrics.overview.avgEngagementRate < 3) {
      insights.recommendations.push({
        type: 'content',
        priority: 'high',
        insight: 'Your engagement rate is below industry average',
        action: 'Focus on more personal stories from your Experience pillar',
        expectedImpact: '2-3x increase in engagement'
      });
    }

    // Identify content opportunities
    const underperformingPillar = metrics.contentPillars.find(p => p.avgEngagement < 4);
    if (underperformingPillar) {
      insights.opportunities.push({
        topic: underperformingPillar.recommendedTopics[0],
        reason: `Your ${underperformingPillar.pillar} content has room for improvement`,
        suggestedAngle: 'Share a controversial opinion or unique perspective',
        estimatedEngagement: underperformingPillar.avgEngagement * 1.5
      });
    }

    // Add timing recommendations
    insights.recommendations.push({
      type: 'timing',
      priority: 'medium',
      insight: 'Your audience is most active on Tuesday mornings',
      action: 'Schedule your most important posts for Tuesday 9-11 AM',
      expectedImpact: '25% increase in reach'
    });

    // Audience growth insights
    if (metrics.audience.followerGrowth.monthly < 300) {
      insights.recommendations.push({
        type: 'audience',
        priority: 'high',
        insight: 'Follower growth is slowing down',
        action: 'Engage more with posts from your target audience',
        expectedImpact: '50% increase in follower growth'
      });
    }

    // Content warnings
    const expertisePillar = metrics.contentPillars.find(p => p.pillar === 'Expertise');
    if (expertisePillar && expertisePillar.postCount > 40) {
      insights.warnings.push({
        issue: 'Over-indexing on Expertise content',
        impact: 'May appear less relatable and human',
        solution: 'Balance with more Experience (35%) and Evolution (25%) content'
      });
    }

    return insights;
  }

  async exportAnalytics(format: 'csv' | 'pdf' | 'json'): Promise<Blob> {
    const metrics = await this.getPerformanceMetrics('30d');
    
    switch (format) {
      case 'csv':
        return this.generateCSV(metrics);
      case 'pdf':
        return this.generateAnalyticsPDF(metrics);
      case 'json':
        return new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
      default:
        throw new Error('Unsupported export format');
    }
  }

  private generateCSV(metrics: PerformanceMetrics): Blob {
    let csv = 'Date,Engagement,Reach,Followers\n';
    
    metrics.trends.engagement.forEach((item, index) => {
      csv += `${item.date},${item.value},${metrics.trends.reach[index].value},${metrics.trends.followers[index].value}\n`;
    });
    
    return new Blob([csv], { type: 'text/csv' });
  }

  private generateAnalyticsPDF(metrics: PerformanceMetrics): Blob {
    // In production, use a PDF library like pdfmake
    // For now, return a placeholder
    return new Blob(['Analytics PDF'], { type: 'application/pdf' });
  }

  // Track custom events
  async trackEvent(eventName: string, properties?: Record<string, any>): Promise<void> {
    // In production, send to analytics service
    console.log('Analytics Event:', eventName, properties);
  }

  // Get competitive benchmarks
  async getBenchmarks(industry: string, audienceSize: number): Promise<{
    avgEngagementRate: number;
    avgPostFrequency: number;
    avgFollowerGrowth: number;
  }> {
    // Mock benchmark data
    return {
      avgEngagementRate: 3.5,
      avgPostFrequency: 4.2,
      avgFollowerGrowth: 12.5
    };
  }
}

export const analyticsService = new AnalyticsService();