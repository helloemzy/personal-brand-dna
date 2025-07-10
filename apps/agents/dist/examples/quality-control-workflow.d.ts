/**
 * Example workflow demonstrating the Quality Control Agent
 * checking and improving content quality
 */
declare const generatedContent: {
    id: string;
    userId: string;
    content: string;
    contentType: "post";
    metadata: {
        topic: string;
        pillar: string;
        archetype: string;
        voiceMatchScore: number;
    };
    status: "draft";
    createdAt: Date;
};
declare const qualityCheckResult: {
    approved: boolean;
    overallScore: number;
    qualityScore: number;
    riskScore: number;
    brandScore: number;
    factCheckScore: number;
    issues: ({
        type: string;
        severity: string;
        description: string;
        location: string;
        suggestion: string;
    } | {
        type: string;
        severity: string;
        description: string;
        suggestion: string;
        location?: undefined;
    })[];
    suggestions: string[];
    requiresRevision: boolean;
};
declare const revisedContent: {
    id: string;
    userId: string;
    content: string;
    contentType: "post";
    status: "revised";
    metadata: {
        topic: string;
        pillar: string;
        archetype: string;
        voiceMatchScore: number;
        revisionReason: string;
        originalScores: {
            quality: number;
            risk: number;
            brand: number;
            factCheck: number;
        };
    };
    createdAt: Date;
};
declare const finalQualityCheck: {
    approved: boolean;
    overallScore: number;
    qualityScore: number;
    riskScore: number;
    brandScore: number;
    factCheckScore: number;
    issues: never[];
    suggestions: never[];
    requiresRevision: boolean;
};
export { generatedContent, qualityCheckResult, revisedContent, finalQualityCheck };
