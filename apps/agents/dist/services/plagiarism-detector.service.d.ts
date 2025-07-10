import { Logger } from 'pino';
interface PlagiarismResult {
    isPlagiarized: boolean;
    similarity: number;
    sources: MatchedSource[];
    fingerprint: string;
}
interface MatchedSource {
    source: string;
    similarity: number;
    matchedSegments: string[];
}
export declare class PlagiarismDetectorService {
    private logger;
    private fingerprintCache;
    private readonly SHINGLE_SIZE;
    private readonly SIMILARITY_THRESHOLD;
    constructor(logger: Logger);
    checkPlagiarism(content: string, compareAgainst?: string[]): Promise<PlagiarismResult>;
    private generateFingerprint;
    private normalizeContent;
    private generateShingles;
    private extractFeatures;
    private calculateSimilarity;
    private jaccardSimilarity;
    private calculateFeatureSimilarity;
    private calculateNGramSimilarity;
    private findMatchingSegments;
    private calculateSentenceSimilarity;
    generatePlagiarismReport(content: string, result: PlagiarismResult): Promise<string>;
    clearCache(): void;
    getCacheSize(): number;
}
export {};
