import { Logger } from 'pino';
interface PerformanceMetrics {
    impressions: number;
    clicks: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    clickThroughRate: number;
    reach: number;
}
interface ContentPerformance {
    contentId: string;
    platformPostId: string;
    platform: string;
    publishedAt: Date;
    metrics: PerformanceMetrics;
    benchmarks: {
        accountAverage: PerformanceMetrics;
        industryAverage: PerformanceMetrics;
    };
    score: number;
}
interface PerformanceInsights {
    topPerformingContent: ContentPerformance[];
    underperformingContent: ContentPerformance[];
    trends: {
        engagement: TrendData;
        reach: TrendData;
        bestTimes: TimeSlotPerformance[];
        bestDays: DayPerformance[];
    };
    recommendations: string[];
}
interface TrendData {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
}
interface TimeSlotPerformance {
    hour: number;
    avgEngagement: number;
    postCount: number;
}
interface DayPerformance {
    dayOfWeek: number;
    avgEngagement: number;
    postCount: number;
}
export declare class PerformanceTrackerService {
    private logger;
    private supabase;
    private redis;
    private readonly PLATFORM_APIS;
    constructor(logger: Logger);
    trackPerformance(contentId: string, platformPostId: string, platform: string, userId: string): Promise<ContentPerformance>;
    private fetchPlatformMetrics;
    private fetchLinkedInMetrics;
    private fetchTwitterMetrics;
    private getBenchmarks;
    private getAccountAverage;
    private getIndustryAverage;
    private getDefaultMetrics;
    private calculatePerformanceScore;
    private storePerformance;
    private updateRealtimeMetrics;
    getPerformanceInsights(userId: string, platform: string, period?: number): Promise<PerformanceInsights>;
    private calculateTrends;
    private generateRecommendations;
    private getEmptyInsights;
    getRealtimeMetrics(userId: string, platform: string): Promise<PerformanceMetrics>;
}
export {};
