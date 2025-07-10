/**
 * Example workflow demonstrating the complete publishing pipeline
 * from content generation to platform publishing with performance tracking
 */
declare const approvedContent: {
    id: string;
    userId: string;
    content: string;
    contentType: "post";
    metadata: {
        topic: string;
        pillar: string;
        archetype: string;
        voiceMatchScore: number;
        qualityScore: number;
        hashtags: string[];
        estimatedReach: number;
    };
    status: "approved";
    createdAt: Date;
};
declare const timingAnalysis: {
    userId: string;
    platform: string;
    factors: {
        audienceActivity: {
            hour: number;
            dayOfWeek: number;
            score: number;
            engagement: number;
        }[];
        historicalPerformance: {
            bestTime: {
                hour: number;
                dayOfWeek: number;
            };
            avgEngagement: number;
            recentTrend: string;
        };
        competitorActivity: {
            lowActivityWindows: {
                hour: number;
                dayOfWeek: number;
            }[];
        };
        userPreferences: {
            excludeWeekends: boolean;
            timezone: string;
            minInterval: number;
        };
    };
    recommendedTime: Date;
    confidence: number;
};
declare const publishingResult: {
    success: boolean;
    platformPostId: string;
    publishedAt: Date;
    url: string;
    formattedContent: {
        text: string;
        hashtags: string[];
        characterCount: number;
        truncated: boolean;
    };
};
declare const performanceData: {
    contentId: string;
    platformPostId: string;
    platform: string;
    metrics: {
        hour1: {
            impressions: number;
            clicks: number;
            likes: number;
            comments: number;
            shares: number;
            engagementRate: number;
            clickThroughRate: number;
        };
        hour4: {
            impressions: number;
            clicks: number;
            likes: number;
            comments: number;
            shares: number;
            engagementRate: number;
            clickThroughRate: number;
        };
        hour24: {
            impressions: number;
            clicks: number;
            likes: number;
            comments: number;
            shares: number;
            engagementRate: number;
            clickThroughRate: number;
        };
    };
    benchmarks: {
        accountAverage: {
            impressions: number;
            engagementRate: number;
            clickThroughRate: number;
        };
        industryAverage: {
            impressions: number;
            engagementRate: number;
            clickThroughRate: number;
        };
    };
    performanceScore: number;
};
declare const performanceInsights: {
    contentAnalysis: {
        successFactors: string[];
        improvements: string[];
    };
    timingInsights: {
        optimalConfirmed: boolean;
        engagement: {
            peakHour: number;
            sustainedFor: number;
        };
    };
    audienceInsights: {
        mostEngagedSegments: string[];
        geographicReach: string[];
        newFollowers: number;
    };
    recommendations: string[];
};
export { approvedContent, timingAnalysis, publishingResult, performanceData, performanceInsights };
