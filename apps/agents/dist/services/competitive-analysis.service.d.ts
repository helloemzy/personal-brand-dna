interface CompetitorProfile {
    name: string;
    domains: string[];
    linkedinHandle?: string;
    keywords: string[];
    contentStyle: string;
    postingFrequency: number;
    avgEngagement: number;
}
interface CompetitiveAdvantage {
    score: number;
    uncoveredAngle: boolean;
    timingAdvantage: number;
    uniquePerspective: string;
    competitorsCovered: string[];
    suggestedApproach: string;
    explanation: string;
}
interface ContentGap {
    topic: string;
    lastCovered: Date | null;
    competitorsCovering: string[];
    relevanceToUser: number;
    opportunity: string;
}
export declare class CompetitiveAnalysisService {
    private logger;
    private databaseService;
    private rateLimiter;
    private competitorProfiles;
    private linkedinScraper;
    constructor();
    private initializeCompetitorProfiles;
    analyzeCompetitiveAdvantage(userId: string, article: any, userProfile: any): Promise<CompetitiveAdvantage>;
    findContentGaps(userId: string, userProfile: any, timeframe?: number): Promise<ContentGap[]>;
    private getRelevantCompetitors;
    private checkCompetitorCoverage;
    private competitorHasCoveredTopic;
    private calculateTimingAdvantage;
    private findUniqueAngle;
    private calculateCompetitiveScore;
    private generateStrategicApproach;
    private generateExplanation;
    private extractKeywords;
    private getArticleTopic;
    private generateCompetitorAngle;
    private extractUserTopics;
    private getCompetitorActivityForTopic;
    private isContentGap;
    private calculateTopicRelevance;
    private generateGapOpportunity;
    private getDefaultAdvantage;
    updateCompetitorProfiles(profiles: CompetitorProfile[]): Promise<void>;
}
export {};
