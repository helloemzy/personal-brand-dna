"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlagiarismDetectorService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class PlagiarismDetectorService {
    logger;
    fingerprintCache = new Map();
    SHINGLE_SIZE = 5; // 5-word shingles
    SIMILARITY_THRESHOLD = 0.3; // 30% similarity triggers warning
    constructor(logger) {
        this.logger = logger;
    }
    async checkPlagiarism(content, compareAgainst) {
        const fingerprint = this.generateFingerprint(content);
        // If no comparison sources provided, check against cache
        const sources = compareAgainst || Array.from(this.fingerprintCache.keys());
        const matches = [];
        let maxSimilarity = 0;
        for (const source of sources) {
            const sourceFingerprint = compareAgainst
                ? this.generateFingerprint(source)
                : this.fingerprintCache.get(source);
            if (!sourceFingerprint)
                continue;
            const similarity = this.calculateSimilarity(fingerprint, sourceFingerprint);
            if (similarity > this.SIMILARITY_THRESHOLD) {
                const matchedSegments = this.findMatchingSegments(content, source);
                matches.push({
                    source: source.substring(0, 100) + '...',
                    similarity,
                    matchedSegments
                });
                maxSimilarity = Math.max(maxSimilarity, similarity);
            }
        }
        // Cache the fingerprint for future comparisons
        this.fingerprintCache.set(content, fingerprint);
        // Limit cache size
        if (this.fingerprintCache.size > 1000) {
            const firstKey = this.fingerprintCache.keys().next().value;
            if (firstKey)
                this.fingerprintCache.delete(firstKey);
        }
        return {
            isPlagiarized: maxSimilarity > this.SIMILARITY_THRESHOLD,
            similarity: maxSimilarity,
            sources: matches.sort((a, b) => b.similarity - a.similarity),
            fingerprint: fingerprint.hash
        };
    }
    generateFingerprint(content) {
        const normalizedContent = this.normalizeContent(content);
        const words = normalizedContent.split(/\s+/);
        // Generate shingles (n-gram word sequences)
        const shingles = this.generateShingles(words);
        // Extract content features
        const features = this.extractFeatures(content, words);
        // Generate hash
        const hash = crypto_1.default
            .createHash('sha256')
            .update(normalizedContent)
            .digest('hex');
        return {
            hash,
            shingles,
            features
        };
    }
    normalizeContent(content) {
        return content
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    generateShingles(words) {
        const shingles = new Set();
        for (let i = 0; i <= words.length - this.SHINGLE_SIZE; i++) {
            const shingle = words.slice(i, i + this.SHINGLE_SIZE).join(' ');
            shingles.add(shingle);
        }
        return shingles;
    }
    extractFeatures(content, words) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim());
        const vocabulary = new Set(words);
        // Generate n-grams (2-grams and 3-grams)
        const nGrams = new Map();
        // 2-grams
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            nGrams.set(bigram, (nGrams.get(bigram) || 0) + 1);
        }
        // 3-grams
        for (let i = 0; i < words.length - 2; i++) {
            const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
            nGrams.set(trigram, (nGrams.get(trigram) || 0) + 1);
        }
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        return {
            wordCount: words.length,
            sentenceCount: sentences.length,
            avgWordLength,
            vocabulary,
            nGrams
        };
    }
    calculateSimilarity(fp1, fp2) {
        // Jaccard similarity for shingles
        const shingleSimilarity = this.jaccardSimilarity(fp1.shingles, fp2.shingles);
        // Feature-based similarity
        const featureSimilarity = this.calculateFeatureSimilarity(fp1.features, fp2.features);
        // Weighted combination
        return shingleSimilarity * 0.7 + featureSimilarity * 0.3;
    }
    jaccardSimilarity(set1, set2) {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }
    calculateFeatureSimilarity(f1, f2) {
        const scores = [];
        // Word count similarity
        const wordCountDiff = Math.abs(f1.wordCount - f2.wordCount);
        const wordCountSim = 1 - (wordCountDiff / Math.max(f1.wordCount, f2.wordCount));
        scores.push(wordCountSim);
        // Vocabulary overlap
        const vocabSim = this.jaccardSimilarity(f1.vocabulary, f2.vocabulary);
        scores.push(vocabSim);
        // Average word length similarity
        const avgLengthDiff = Math.abs(f1.avgWordLength - f2.avgWordLength);
        const avgLengthSim = 1 - (avgLengthDiff / Math.max(f1.avgWordLength, f2.avgWordLength));
        scores.push(avgLengthSim);
        // N-gram similarity
        const nGramSim = this.calculateNGramSimilarity(f1.nGrams, f2.nGrams);
        scores.push(nGramSim);
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
    calculateNGramSimilarity(nGrams1, nGrams2) {
        const allNGrams = new Set([...nGrams1.keys(), ...nGrams2.keys()]);
        let similarity = 0;
        for (const ngram of allNGrams) {
            const count1 = nGrams1.get(ngram) || 0;
            const count2 = nGrams2.get(ngram) || 0;
            similarity += Math.min(count1, count2);
        }
        const total1 = Array.from(nGrams1.values()).reduce((sum, count) => sum + count, 0);
        const total2 = Array.from(nGrams2.values()).reduce((sum, count) => sum + count, 0);
        return similarity / Math.max(total1, total2);
    }
    findMatchingSegments(content1, content2) {
        const sentences1 = content1.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
        const sentences2 = content2.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
        const matches = [];
        for (const sent1 of sentences1) {
            for (const sent2 of sentences2) {
                const similarity = this.calculateSentenceSimilarity(sent1, sent2);
                if (similarity > 0.7) { // 70% sentence similarity
                    matches.push(sent1);
                    break;
                }
            }
        }
        return matches.slice(0, 3); // Return top 3 matches
    }
    calculateSentenceSimilarity(sent1, sent2) {
        const words1 = new Set(sent1.toLowerCase().split(/\s+/));
        const words2 = new Set(sent2.toLowerCase().split(/\s+/));
        return this.jaccardSimilarity(words1, words2);
    }
    async generatePlagiarismReport(content, result) {
        const report = [
            `Plagiarism Detection Report`,
            `==========================`,
            `Status: ${result.isPlagiarized ? 'POTENTIAL PLAGIARISM DETECTED' : 'ORIGINAL CONTENT'}`,
            `Overall Similarity: ${(result.similarity * 100).toFixed(1)}%`,
            `Content Fingerprint: ${result.fingerprint.substring(0, 16)}...`,
            ``
        ];
        if (result.sources.length > 0) {
            report.push(`Matched Sources:`, ...result.sources.map((source, i) => [
                `${i + 1}. Similarity: ${(source.similarity * 100).toFixed(1)}%`,
                `   Source: ${source.source}`,
                `   Matched Segments:`,
                ...source.matchedSegments.map(seg => `   - "${seg.substring(0, 50)}..."`),
                ``
            ]).flat());
        }
        const fingerprint = this.generateFingerprint(content);
        report.push(`Content Analysis:`, `- Word Count: ${fingerprint.features.wordCount}`, `- Sentence Count: ${fingerprint.features.sentenceCount}`, `- Unique Words: ${fingerprint.features.vocabulary.size}`, `- Average Word Length: ${fingerprint.features.avgWordLength.toFixed(1)}`, `- Shingles Generated: ${fingerprint.shingles.size}`);
        return report.join('\n');
    }
    clearCache() {
        this.fingerprintCache.clear();
        this.logger.info('Plagiarism detector cache cleared');
    }
    getCacheSize() {
        return this.fingerprintCache.size;
    }
}
exports.PlagiarismDetectorService = PlagiarismDetectorService;
//# sourceMappingURL=plagiarism-detector.service.js.map