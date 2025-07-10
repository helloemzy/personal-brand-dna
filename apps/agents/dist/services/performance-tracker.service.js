"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTrackerService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
class PerformanceTrackerService {
    logger;
    supabase;
    redis;
    // Platform-specific API endpoints (simplified)
    PLATFORM_APIS = {
        linkedin: 'https://api.linkedin.com/v2/socialActions',
        twitter: 'https://api.twitter.com/2/tweets',
        facebook: 'https://graph.facebook.com/v12.0'
    };
    constructor(logger) {
        this.logger = logger;
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.redis = new ioredis_1.default(process.env.REDIS_URL);
    }
    async trackPerformance(contentId, platformPostId, platform, userId) {
        try {
            // Fetch metrics from platform
            const metrics = await this.fetchPlatformMetrics(platformPostId, platform, userId);
            // Get benchmarks
            const benchmarks = await this.getBenchmarks(userId, platform);
            // Calculate performance score
            const score = this.calculatePerformanceScore(metrics, benchmarks.accountAverage);
            // Store in database
            const performance = await this.storePerformance({
                contentId,
                platformPostId,
                platform,
                userId,
                metrics,
                score
            });
            // Update real-time cache
            await this.updateRealtimeMetrics(userId, platform, metrics);
            return {
                contentId,
                platformPostId,
                platform,
                publishedAt: new Date(),
                metrics,
                benchmarks,
                score
            };
        }
        catch (error) {
            this.logger.error({ error, contentId }, 'Failed to track performance');
            throw error;
        }
    }
    async fetchPlatformMetrics(postId, platform, userId) {
        // In production, this would call actual platform APIs
        // For now, simulate with realistic data
        switch (platform) {
            case 'linkedin':
                return this.fetchLinkedInMetrics(postId, userId);
            case 'twitter':
                return this.fetchTwitterMetrics(postId, userId);
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    async fetchLinkedInMetrics(postId, userId) {
        // Simulate LinkedIn API response
        const base = Math.random() * 1000 + 500;
        return {
            impressions: Math.floor(base),
            clicks: Math.floor(base * 0.02),
            likes: Math.floor(base * 0.05),
            comments: Math.floor(base * 0.01),
            shares: Math.floor(base * 0.005),
            engagementRate: 0.065,
            clickThroughRate: 0.02,
            reach: Math.floor(base * 0.8)
        };
    }
    async fetchTwitterMetrics(postId, userId) {
        // Simulate Twitter API response
        const base = Math.random() * 5000 + 1000;
        return {
            impressions: Math.floor(base),
            clicks: Math.floor(base * 0.01),
            likes: Math.floor(base * 0.03),
            comments: Math.floor(base * 0.005),
            shares: Math.floor(base * 0.01),
            engagementRate: 0.045,
            clickThroughRate: 0.01,
            reach: Math.floor(base * 0.9)
        };
    }
    async getBenchmarks(userId, platform) {
        // Get account average from last 30 days
        const accountAvg = await this.getAccountAverage(userId, platform);
        // Get cached industry average
        const industryAvg = await this.getIndustryAverage(platform);
        return {
            accountAverage: accountAvg,
            industryAverage: industryAvg
        };
    }
    async getAccountAverage(userId, platform) {
        const { data } = await this.supabase
            .from('content_performance')
            .select('metrics')
            .eq('user_id', userId)
            .eq('platform', platform)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .limit(100);
        if (!data || data.length === 0) {
            return this.getDefaultMetrics();
        }
        // Calculate averages
        const totals = data.reduce((acc, row) => {
            const metrics = row.metrics;
            return {
                impressions: acc.impressions + metrics.impressions,
                clicks: acc.clicks + metrics.clicks,
                likes: acc.likes + metrics.likes,
                comments: acc.comments + metrics.comments,
                shares: acc.shares + metrics.shares,
                engagementRate: acc.engagementRate + metrics.engagementRate,
                clickThroughRate: acc.clickThroughRate + metrics.clickThroughRate,
                reach: acc.reach + metrics.reach
            };
        }, this.getDefaultMetrics());
        const count = data.length;
        return {
            impressions: Math.floor(totals.impressions / count),
            clicks: Math.floor(totals.clicks / count),
            likes: Math.floor(totals.likes / count),
            comments: Math.floor(totals.comments / count),
            shares: Math.floor(totals.shares / count),
            engagementRate: totals.engagementRate / count,
            clickThroughRate: totals.clickThroughRate / count,
            reach: Math.floor(totals.reach / count)
        };
    }
    async getIndustryAverage(platform) {
        const cached = await this.redis.get(`industry_avg:${platform}`);
        if (cached) {
            return JSON.parse(cached);
        }
        // Default industry averages by platform
        const defaults = {
            linkedin: {
                impressions: 1000,
                clicks: 20,
                likes: 50,
                comments: 10,
                shares: 5,
                engagementRate: 0.05,
                clickThroughRate: 0.02,
                reach: 800
            },
            twitter: {
                impressions: 3000,
                clicks: 30,
                likes: 90,
                comments: 15,
                shares: 30,
                engagementRate: 0.03,
                clickThroughRate: 0.01,
                reach: 2700
            }
        };
        const avg = defaults[platform] || this.getDefaultMetrics();
        // Cache for 24 hours
        await this.redis.setex(`industry_avg:${platform}`, 86400, JSON.stringify(avg));
        return avg;
    }
    getDefaultMetrics() {
        return {
            impressions: 0,
            clicks: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            engagementRate: 0,
            clickThroughRate: 0,
            reach: 0
        };
    }
    calculatePerformanceScore(metrics, benchmark) {
        const weights = {
            impressions: 0.15,
            clicks: 0.2,
            likes: 0.15,
            comments: 0.2,
            shares: 0.25,
            engagementRate: 0.05
        };
        let score = 0;
        for (const [metric, weight] of Object.entries(weights)) {
            const actual = metrics[metric] || 0;
            const expected = benchmark[metric] || 1;
            const ratio = Math.min(actual / expected, 2); // Cap at 200% to avoid outliers
            score += ratio * weight * 100;
        }
        return Math.round(Math.min(score, 100));
    }
    async storePerformance(data) {
        await this.supabase
            .from('content_performance')
            .insert({
            content_id: data.contentId,
            platform_post_id: data.platformPostId,
            platform: data.platform,
            user_id: data.userId,
            metrics: data.metrics,
            score: data.score,
            created_at: new Date()
        });
    }
    async updateRealtimeMetrics(userId, platform, metrics) {
        const key = `realtime:${userId}:${platform}`;
        const hourKey = `${key}:${new Date().getHours()}`;
        // Update hourly metrics
        await this.redis.multi()
            .hincrby(hourKey, 'impressions', metrics.impressions)
            .hincrby(hourKey, 'clicks', metrics.clicks)
            .hincrby(hourKey, 'likes', metrics.likes)
            .hincrby(hourKey, 'comments', metrics.comments)
            .hincrby(hourKey, 'shares', metrics.shares)
            .expire(hourKey, 86400) // 24 hour expiry
            .exec();
    }
    async getPerformanceInsights(userId, platform, period = 30 // days
    ) {
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        // Fetch performance data
        const { data: performances } = await this.supabase
            .from('content_performance')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', platform)
            .gte('created_at', startDate)
            .order('score', { ascending: false });
        if (!performances || performances.length === 0) {
            return this.getEmptyInsights();
        }
        // Calculate insights
        const topPerforming = performances.slice(0, 5).map(p => ({
            contentId: p.content_id,
            platformPostId: p.platform_post_id,
            platform: p.platform,
            publishedAt: new Date(p.created_at),
            metrics: p.metrics,
            benchmarks: { accountAverage: p.metrics, industryAverage: p.metrics },
            score: p.score
        }));
        const underperforming = performances.slice(-5).reverse().map(p => ({
            contentId: p.content_id,
            platformPostId: p.platform_post_id,
            platform: p.platform,
            publishedAt: new Date(p.created_at),
            metrics: p.metrics,
            benchmarks: { accountAverage: p.metrics, industryAverage: p.metrics },
            score: p.score
        }));
        const trends = await this.calculateTrends(performances);
        const recommendations = this.generateRecommendations(trends, performances);
        return {
            topPerformingContent: topPerforming,
            underperformingContent: underperforming,
            trends,
            recommendations
        };
    }
    async calculateTrends(performances) {
        // Calculate engagement trend
        const recentEngagement = performances
            .slice(0, Math.floor(performances.length / 2))
            .reduce((sum, p) => sum + p.metrics.engagementRate, 0) / (performances.length / 2);
        const olderEngagement = performances
            .slice(Math.floor(performances.length / 2))
            .reduce((sum, p) => sum + p.metrics.engagementRate, 0) / (performances.length / 2);
        const engagementChange = ((recentEngagement - olderEngagement) / olderEngagement) * 100;
        // Calculate best posting times
        const timeSlots = new Map();
        const days = new Map();
        performances.forEach(p => {
            const date = new Date(p.created_at);
            const hour = date.getHours();
            const day = date.getDay();
            const timeSlot = timeSlots.get(hour) || { engagement: 0, count: 0 };
            timeSlot.engagement += p.metrics.engagementRate;
            timeSlot.count += 1;
            timeSlots.set(hour, timeSlot);
            const daySlot = days.get(day) || { engagement: 0, count: 0 };
            daySlot.engagement += p.metrics.engagementRate;
            daySlot.count += 1;
            days.set(day, daySlot);
        });
        const bestTimes = Array.from(timeSlots.entries())
            .map(([hour, data]) => ({
            hour,
            avgEngagement: data.engagement / data.count,
            postCount: data.count
        }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement)
            .slice(0, 5);
        const bestDays = Array.from(days.entries())
            .map(([dayOfWeek, data]) => ({
            dayOfWeek,
            avgEngagement: data.engagement / data.count,
            postCount: data.count
        }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement);
        return {
            engagement: {
                direction: engagementChange > 5 ? 'up' : engagementChange < -5 ? 'down' : 'stable',
                percentage: Math.abs(engagementChange),
                period: '30 days'
            },
            reach: {
                direction: 'stable',
                percentage: 0,
                period: '30 days'
            },
            bestTimes,
            bestDays
        };
    }
    generateRecommendations(trends, performances) {
        const recommendations = [];
        // Timing recommendations
        if (trends.bestTimes.length > 0) {
            const bestTime = trends.bestTimes[0];
            recommendations.push(`Post at ${bestTime.hour}:00 for best engagement (${(bestTime.avgEngagement * 100).toFixed(1)}% average)`);
        }
        // Day recommendations
        if (trends.bestDays.length > 0) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const bestDay = trends.bestDays[0];
            recommendations.push(`${days[bestDay.dayOfWeek]} shows highest engagement`);
        }
        // Trend recommendations
        if (trends.engagement.direction === 'down') {
            recommendations.push('Engagement is declining - try varying content types and posting times');
        }
        else if (trends.engagement.direction === 'up') {
            recommendations.push(`Great job! Engagement is up ${trends.engagement.percentage.toFixed(1)}%`);
        }
        // Content recommendations
        const avgScore = performances.reduce((sum, p) => sum + p.score, 0) / performances.length;
        if (avgScore < 50) {
            recommendations.push('Consider adding more engaging elements like questions or polls');
        }
        return recommendations;
    }
    getEmptyInsights() {
        return {
            topPerformingContent: [],
            underperformingContent: [],
            trends: {
                engagement: { direction: 'stable', percentage: 0, period: '30 days' },
                reach: { direction: 'stable', percentage: 0, period: '30 days' },
                bestTimes: [],
                bestDays: []
            },
            recommendations: ['Start posting to gather performance data']
        };
    }
    async getRealtimeMetrics(userId, platform) {
        const key = `realtime:${userId}:${platform}`;
        const currentHour = new Date().getHours();
        // Get last 24 hours of data
        const multi = this.redis.multi();
        for (let i = 0; i < 24; i++) {
            const hour = (currentHour - i + 24) % 24;
            multi.hgetall(`${key}:${hour}`);
        }
        const results = await multi.exec();
        // Aggregate metrics
        const totals = results.reduce((acc, [err, data]) => {
            if (!err && data) {
                acc.impressions += parseInt(data.impressions || '0');
                acc.clicks += parseInt(data.clicks || '0');
                acc.likes += parseInt(data.likes || '0');
                acc.comments += parseInt(data.comments || '0');
                acc.shares += parseInt(data.shares || '0');
            }
            return acc;
        }, this.getDefaultMetrics());
        // Calculate rates
        if (totals.impressions > 0) {
            totals.engagementRate = (totals.likes + totals.comments + totals.shares) / totals.impressions;
            totals.clickThroughRate = totals.clicks / totals.impressions;
        }
        totals.reach = totals.impressions; // Simplified
        return totals;
    }
}
exports.PerformanceTrackerService = PerformanceTrackerService;
//# sourceMappingURL=performance-tracker.service.js.map