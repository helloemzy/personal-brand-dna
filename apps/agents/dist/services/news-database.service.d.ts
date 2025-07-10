import { NewsOpportunity, FeedSource } from '@brandpillar/shared';
interface NewsArticle {
    id: string;
    feed_id: string;
    guid: string;
    url: string;
    title: string;
    summary?: string;
    content?: string;
    author?: string;
    published_at: Date;
    categories?: string[];
    keywords?: string[];
    image_url?: string;
    metadata?: any;
    content_hash: string;
}
interface UserVoiceProfile {
    user_id: string;
    archetype?: string;
    industry?: string;
    expertise_keywords?: string[];
    preferred_topics?: string[];
    writing_style?: any;
    content_pillars?: any;
    audience_demographics?: any;
}
interface CompetitiveCoverage {
    article_id: string;
    competitor_name: string;
    competitor_url?: string;
    coverage_type: 'identical' | 'similar' | 'related';
    coverage_angle?: string;
    published_at?: Date;
    engagement_metrics?: any;
}
export declare class NewsDatabaseService {
    private supabase;
    private logger;
    constructor();
    getAllActiveFeeds(): Promise<FeedSource[]>;
    getUserFeeds(userId: string): Promise<FeedSource[]>;
    updateFeedStatus(feedId: string, status: Partial<FeedSource>): Promise<void>;
    saveArticles(articles: Partial<NewsArticle>[]): Promise<NewsArticle[]>;
    getArticleById(articleId: string): Promise<NewsArticle | null>;
    checkDuplicateArticles(contentHashes: string[]): Promise<Set<string>>;
    saveOpportunity(opportunity: Partial<NewsOpportunity>): Promise<NewsOpportunity>;
    getUserOpportunities(userId: string, limit?: number, status?: string): Promise<NewsOpportunity[]>;
    updateOpportunityStatus(opportunityId: string, status: string, metadata?: any): Promise<void>;
    getUserVoiceProfile(userId: string): Promise<UserVoiceProfile | null>;
    updateUserVoiceProfile(userId: string, profile: Partial<UserVoiceProfile>): Promise<void>;
    saveCompetitiveCoverage(coverage: Partial<CompetitiveCoverage>): Promise<void>;
    getCompetitiveCoverage(articleId: string): Promise<CompetitiveCoverage[]>;
    updateFeedAnalytics(feedId: string, metrics: any): Promise<void>;
    refreshOpportunitySummary(): Promise<void>;
    saveViralityPattern(pattern: any): Promise<void>;
    getViralityPatterns(limit?: number): Promise<any[]>;
    private generateContentHash;
    bulkUpdateOpportunityScores(opportunities: Array<{
        id: string;
        scores: any;
    }>): Promise<void>;
    searchArticles(query: string, limit?: number): Promise<NewsArticle[]>;
    cleanupExpiredOpportunities(): Promise<number>;
}
export {};
