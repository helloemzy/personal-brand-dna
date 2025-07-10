/**
 * Example workflow demonstrating how the agents work together
 * to generate content from news opportunities
 */
import { NewsOpportunity } from '@brandpillar/shared';
declare const newsOpportunity: NewsOpportunity;
declare const generatedContent: {
    id: string;
    userId: string;
    opportunityId: string;
    content: string;
    contentType: string;
    angle: string;
    voiceMatchScore: number;
    qualityScore: number;
    riskScore: number;
    status: string;
    metadata: {
        topic: string;
        pillar: string;
        hook: string;
        cta: string;
        keywords: string[];
        estimatedReadTime: number;
        characterCount: number;
        hashtagSuggestions: string[];
    };
    createdAt: Date;
};
export { newsOpportunity, generatedContent };
