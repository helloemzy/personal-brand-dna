import { Logger } from 'pino';
interface FormattedContent {
    text: string;
    hashtags: string[];
    mentions: string[];
    urls: string[];
    mediaUrls: string[];
    metadata: {
        truncated: boolean;
        originalLength: number;
        platform: string;
    };
}
export declare class PlatformFormatterService {
    private logger;
    private readonly PLATFORM_CONFIGS;
    constructor(logger: Logger);
    formatForPlatform(content: string, platform: string, options?: {
        hashtags?: string[];
        mentions?: string[];
        urls?: string[];
        mediaUrls?: string[];
        preservePriority?: 'content' | 'hashtags' | 'all';
    }): Promise<FormattedContent>;
    private applyPlatformRules;
    private extractHashtags;
    private extractMentions;
    private extractUrls;
    private removeHashtags;
    private removeMentions;
    private removeUrls;
    private calculateHashtagSpace;
    private calculateMentionSpace;
    private calculateUrlSpace;
    private truncateContent;
    generateOptimalHashtags(content: string, platform: string, existingHashtags: string[], maxCount?: number): string[];
    private extractKeyTopics;
    validateMediaForPlatform(mediaUrls: string[], platform: string): {
        valid: string[];
        invalid: string[];
        reasons: string[];
    };
}
export {};
