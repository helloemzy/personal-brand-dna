interface ViralityPrediction {
    viralityScore: number;
    predictedReach: number;
    predictedEngagement: number;
    timeToP: any;
    eak: number;
    confidence: number;
    explanation: string;
}
export declare class ViralityPredictionService {
    private logger;
    private databaseService;
    private model;
    private emotionalWords;
    private powerWords;
    private trendingTopics;
    constructor();
    private initializeModel;
    predictVirality(article: any, historicalData?: any[]): Promise<ViralityPrediction>;
    private extractFeatures;
    private getViralityScore;
    private heuristicViralityScore;
    private calculateEmotionalIntensity;
    private getSourceAuthority;
    private getSourceEngagementRate;
    private calculateTrendingScore;
    private calculateControversyScore;
    private calculateNoveltyScore;
    private calculatePredictedReach;
    private calculatePredictedEngagement;
    private calculateTimeToPeak;
    private calculateConfidence;
    private generateExplanation;
    private updateTrendingTopics;
    trainModel(historicalData: any[]): Promise<void>;
    private getDefaultPrediction;
}
export {};
