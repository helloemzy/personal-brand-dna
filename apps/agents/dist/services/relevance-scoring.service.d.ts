interface ArticleFeatures {
    title: string;
    summary: string;
    content?: string;
    categories: string[];
    keywords: string[];
    publishedAt: Date;
    source: string;
}
interface RelevanceScores {
    topicRelevance: number;
    expertiseAlignment: number;
    audienceRelevance: number;
    temporalRelevance: number;
    contentPillarMatch: number;
    overallScore: number;
    explanation: string;
    suggestedAngles: string[];
}
export declare class RelevanceScoringService {
    private logger;
    private workshopService;
    private tfidf;
    private tokenizer;
    constructor();
    calculateRelevance(userId: string, article: ArticleFeatures, userKeywords?: string[], excludedKeywords?: string[]): Promise<RelevanceScores>;
    private getUserProfile;
    private calculateTopicRelevance;
    private calculateExpertiseAlignment;
    private calculateAudienceRelevance;
    private calculateTemporalRelevance;
    private calculateContentPillarMatch;
    private calculateExclusionPenalty;
    private calculateOverallScore;
    private generateContentAngles;
    private extractExpertise;
    private extractPillarKeywords;
    private countPhraseMatches;
    private countTokenMatches;
    private getUserExpertiseLevel;
    private getIndustryKeywords;
    private extractMainTopic;
    private generateExplanation;
    private getDefaultScores;
}
export {};
