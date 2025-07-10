import { Logger } from 'pino';
interface SafetyCheckResult {
    safe: boolean;
    issues: SafetyIssue[];
    score: number;
    categories: {
        hate: number;
        harassment: number;
        violence: number;
        selfHarm: number;
        sexual: number;
        dangerous: number;
    };
}
interface SafetyIssue {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: string;
}
export declare class ContentSafetyService {
    private logger;
    private readonly BLOCKED_TERMS;
    private readonly SENSITIVE_TOPICS;
    constructor(logger: Logger);
    checkSafety(content: string): Promise<SafetyCheckResult>;
    private checkBlockedTerms;
    private detectSensitiveTopics;
    private detectHarmfulPatterns;
    private detectManipulation;
    private detectClickbait;
    private detectSpam;
    private categorizeContent;
    private scoreHateContent;
    private scoreHarassment;
    private scoreViolence;
    private scoreSelfHarm;
    private scoreSexualContent;
    private scoreDangerousContent;
    private calculateSafetyScore;
    generateSafetyReport(content: string): Promise<string>;
}
export {};
