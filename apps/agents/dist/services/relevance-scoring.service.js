"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelevanceScoringService = void 0;
const logger_1 = require("../utils/logger");
const workshop_data_service_1 = require("./workshop-data.service");
const natural_1 = __importDefault(require("natural"));
class RelevanceScoringService {
    logger;
    workshopService;
    tfidf;
    tokenizer;
    constructor() {
        this.logger = (0, logger_1.createLogger)('RelevanceScoringService');
        this.workshopService = new workshop_data_service_1.WorkshopDataService();
        this.tfidf = new natural_1.default.TfIdf();
        this.tokenizer = new natural_1.default.WordTokenizer();
    }
    async calculateRelevance(userId, article, userKeywords, excludedKeywords) {
        try {
            // Get user profile
            const userProfile = await this.getUserProfile(userId);
            if (!userProfile) {
                return this.getDefaultScores();
            }
            // Calculate individual relevance components
            const topicRelevance = this.calculateTopicRelevance(article, userProfile, userKeywords);
            const expertiseAlignment = this.calculateExpertiseAlignment(article, userProfile);
            const audienceRelevance = this.calculateAudienceRelevance(article, userProfile);
            const temporalRelevance = this.calculateTemporalRelevance(article);
            const contentPillarMatch = this.calculateContentPillarMatch(article, userProfile);
            // Apply excluded keywords penalty
            const exclusionPenalty = this.calculateExclusionPenalty(article, excludedKeywords);
            // Calculate weighted overall score
            const overallScore = this.calculateOverallScore({
                topicRelevance: topicRelevance * (1 - exclusionPenalty),
                expertiseAlignment,
                audienceRelevance,
                temporalRelevance,
                contentPillarMatch
            });
            // Generate explanation and angles
            const explanation = this.generateExplanation({
                topicRelevance,
                expertiseAlignment,
                audienceRelevance,
                temporalRelevance,
                contentPillarMatch
            });
            const suggestedAngles = await this.generateContentAngles(article, userProfile);
            return {
                topicRelevance,
                expertiseAlignment,
                audienceRelevance,
                temporalRelevance,
                contentPillarMatch,
                overallScore,
                explanation,
                suggestedAngles
            };
        }
        catch (error) {
            this.logger.error('Error calculating relevance:', error);
            return this.getDefaultScores();
        }
    }
    async getUserProfile(userId) {
        try {
            const workshopData = await this.workshopService.getUserWorkshopData(userId);
            if (!workshopData)
                return null;
            return {
                userId,
                archetype: workshopData.archetype || 'default',
                industry: workshopData.audience?.industry || 'general',
                expertise: this.extractExpertise(workshopData),
                values: workshopData.values?.selected || [],
                contentPillars: workshopData.contentPillars || {},
                audience: workshopData.audience || {},
                voiceProfile: workshopData.voiceProfile
            };
        }
        catch (error) {
            this.logger.error('Error getting user profile:', error);
            return null;
        }
    }
    calculateTopicRelevance(article, profile, userKeywords) {
        // Combine all text for analysis
        const articleText = `${article.title} ${article.summary} ${article.content || ''}`.toLowerCase();
        const articleTokens = this.tokenizer.tokenize(articleText);
        // User's interest keywords
        const interestKeywords = [
            ...profile.expertise,
            ...(userKeywords || []),
            ...this.extractPillarKeywords(profile.contentPillars)
        ].map(k => k.toLowerCase());
        // Count keyword matches
        let matchCount = 0;
        let weightedScore = 0;
        for (const keyword of interestKeywords) {
            const keywordTokens = this.tokenizer.tokenize(keyword.toLowerCase());
            const matches = this.countPhraseMatches(articleTokens, keywordTokens);
            if (matches > 0) {
                matchCount++;
                // Title matches worth more
                const titleBoost = article.title.toLowerCase().includes(keyword) ? 2 : 1;
                weightedScore += matches * titleBoost;
            }
        }
        // Normalize score
        const maxPossibleScore = interestKeywords.length * 3; // Assuming max 3 mentions with title boost
        const normalizedScore = Math.min(weightedScore / maxPossibleScore, 1);
        // Apply logarithmic scaling for better distribution
        return Math.min(0.3 + (normalizedScore * 0.7), 1);
    }
    calculateExpertiseAlignment(article, profile) {
        // Check if article matches user's expertise level
        const expertiseIndicators = {
            beginner: ['introduction', 'basics', 'guide', 'how to', 'getting started'],
            intermediate: ['tips', 'strategies', 'best practices', 'improve', 'optimize'],
            advanced: ['advanced', 'expert', 'deep dive', 'technical', 'architecture'],
            thought_leader: ['future', 'trends', 'opinion', 'perspective', 'innovation']
        };
        // Determine user's expertise level based on archetype
        const userLevel = this.getUserExpertiseLevel(profile.archetype);
        const articleText = `${article.title} ${article.summary}`.toLowerCase();
        let alignmentScore = 0.5; // Base score
        // Check for expertise level indicators
        for (const [level, indicators] of Object.entries(expertiseIndicators)) {
            for (const indicator of indicators) {
                if (articleText.includes(indicator)) {
                    if (level === userLevel) {
                        alignmentScore += 0.1; // Boost for matching level
                    }
                    else {
                        alignmentScore -= 0.05; // Slight penalty for mismatch
                    }
                }
            }
        }
        return Math.max(0, Math.min(alignmentScore, 1));
    }
    calculateAudienceRelevance(article, profile) {
        if (!profile.audience)
            return 0.5;
        const articleText = `${article.title} ${article.summary}`.toLowerCase();
        let relevanceScore = 0.5;
        // Industry match
        if (profile.audience.industry) {
            const industryKeywords = this.getIndustryKeywords(profile.audience.industry);
            const industryMatches = industryKeywords.filter(k => articleText.includes(k.toLowerCase()));
            relevanceScore += industryMatches.length * 0.1;
        }
        // Problem/solution match
        if (profile.audience.challenges) {
            const challengeKeywords = profile.audience.challenges.map((c) => c.toLowerCase());
            const challengeMatches = challengeKeywords.filter((k) => articleText.includes(k));
            relevanceScore += challengeMatches.length * 0.15;
        }
        // Transformation match
        if (profile.audience.transformation) {
            const transformKeywords = this.tokenizer.tokenize(profile.audience.transformation.toLowerCase());
            const transformMatches = this.countTokenMatches(articleText, transformKeywords);
            relevanceScore += Math.min(transformMatches * 0.05, 0.2);
        }
        return Math.min(relevanceScore, 1);
    }
    calculateTemporalRelevance(article) {
        const now = new Date();
        const publishedDate = new Date(article.publishedAt);
        const hoursSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);
        // Scoring based on recency
        if (hoursSincePublished <= 6)
            return 1.0; // Last 6 hours
        if (hoursSincePublished <= 24)
            return 0.9; // Last day
        if (hoursSincePublished <= 48)
            return 0.8; // Last 2 days
        if (hoursSincePublished <= 72)
            return 0.7; // Last 3 days
        if (hoursSincePublished <= 168)
            return 0.5; // Last week
        if (hoursSincePublished <= 336)
            return 0.3; // Last 2 weeks
        return 0.1; // Older than 2 weeks
    }
    calculateContentPillarMatch(article, profile) {
        if (!profile.contentPillars)
            return 0.5;
        const pillars = ['expertise', 'experience', 'evolution'];
        const articleText = `${article.title} ${article.summary}`.toLowerCase();
        let bestMatch = 0;
        for (const pillar of pillars) {
            const pillarData = profile.contentPillars[pillar];
            if (!pillarData || !pillarData.topics)
                continue;
            let pillarScore = 0;
            const topicCount = pillarData.topics.length;
            for (const topic of pillarData.topics) {
                if (articleText.includes(topic.toLowerCase())) {
                    pillarScore += 1;
                }
            }
            const normalizedScore = topicCount > 0 ? pillarScore / topicCount : 0;
            bestMatch = Math.max(bestMatch, normalizedScore);
        }
        return Math.min(0.4 + (bestMatch * 0.6), 1);
    }
    calculateExclusionPenalty(article, excludedKeywords) {
        if (!excludedKeywords || excludedKeywords.length === 0)
            return 0;
        const articleText = `${article.title} ${article.summary}`.toLowerCase();
        let penaltyScore = 0;
        for (const excluded of excludedKeywords) {
            if (articleText.includes(excluded.toLowerCase())) {
                penaltyScore += 0.2; // 20% penalty per excluded keyword
            }
        }
        return Math.min(penaltyScore, 0.8); // Cap at 80% penalty
    }
    calculateOverallScore(scores) {
        // Weighted scoring based on importance
        const weights = {
            topicRelevance: 0.35,
            audienceRelevance: 0.25,
            contentPillarMatch: 0.20,
            temporalRelevance: 0.10,
            expertiseAlignment: 0.10
        };
        let weightedSum = 0;
        for (const [key, weight] of Object.entries(weights)) {
            weightedSum += scores[key] * weight;
        }
        return Math.round(weightedSum * 100) / 100;
    }
    async generateContentAngles(article, profile) {
        const angles = [];
        // Expertise angle
        if (profile.expertise.length > 0) {
            angles.push(`How ${article.title} impacts ${profile.expertise[0]} professionals`);
        }
        // Value-based angle
        if (profile.values.length > 0) {
            angles.push(`Why ${profile.values[0]} leaders should care about this trend`);
        }
        // Audience transformation angle
        if (profile.audience.transformation) {
            angles.push(`Using this insight to ${profile.audience.transformation}`);
        }
        // Contrarian angle
        angles.push(`The overlooked risk in ${article.title}`);
        // Personal story angle
        angles.push(`My experience with ${this.extractMainTopic(article)}`);
        return angles.slice(0, 3); // Return top 3 angles
    }
    // Helper methods
    extractExpertise(workshopData) {
        const expertise = [];
        if (workshopData.personalityQuiz?.currentRole) {
            expertise.push(workshopData.personalityQuiz.currentRole);
        }
        if (workshopData.personalityQuiz?.uniqueExpertise) {
            expertise.push(workshopData.personalityQuiz.uniqueExpertise);
        }
        if (workshopData.writingSample?.topic) {
            expertise.push(workshopData.writingSample.topic);
        }
        return [...new Set(expertise)];
    }
    extractPillarKeywords(contentPillars) {
        const keywords = [];
        for (const pillar of Object.values(contentPillars || {})) {
            if (pillar.topics) {
                keywords.push(...pillar.topics);
            }
        }
        return keywords;
    }
    countPhraseMatches(tokens, phraseTokens) {
        let matches = 0;
        for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
            let isMatch = true;
            for (let j = 0; j < phraseTokens.length; j++) {
                if (tokens[i + j] !== phraseTokens[j]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch)
                matches++;
        }
        return matches;
    }
    countTokenMatches(text, tokens) {
        let matches = 0;
        for (const token of tokens) {
            if (text.includes(token))
                matches++;
        }
        return matches;
    }
    getUserExpertiseLevel(archetype) {
        const archetypeMap = {
            'Innovative Leader': 'thought_leader',
            'Strategic Visionary': 'advanced',
            'Empathetic Expert': 'intermediate',
            'Authentic Changemaker': 'thought_leader',
            'default': 'intermediate'
        };
        return archetypeMap[archetype] || 'intermediate';
    }
    getIndustryKeywords(industry) {
        const industryKeywords = {
            technology: ['software', 'tech', 'digital', 'AI', 'cloud', 'data', 'platform'],
            finance: ['financial', 'banking', 'investment', 'fintech', 'markets', 'trading'],
            healthcare: ['health', 'medical', 'patient', 'clinical', 'pharma', 'biotech'],
            marketing: ['brand', 'campaign', 'content', 'social', 'digital marketing', 'SEO'],
            consulting: ['strategy', 'transformation', 'advisory', 'clients', 'solutions'],
            education: ['learning', 'students', 'teaching', 'curriculum', 'edtech', 'training']
        };
        return industryKeywords[industry.toLowerCase()] || [];
    }
    extractMainTopic(article) {
        // Simple extraction - take first significant noun from title
        const tokens = this.tokenizer.tokenize(article.title);
        const tagged = natural_1.default.BrillPOSTagger.tag(tokens);
        for (const [word, tag] of tagged) {
            if (tag.startsWith('NN') && word.length > 4) {
                return word.toLowerCase();
            }
        }
        return 'this development';
    }
    generateExplanation(scores) {
        const parts = [];
        if (scores.topicRelevance > 0.7) {
            parts.push('Highly relevant to your expertise');
        }
        if (scores.audienceRelevance > 0.7) {
            parts.push('Strong match for your audience interests');
        }
        if (scores.temporalRelevance > 0.8) {
            parts.push('Timely and trending');
        }
        if (scores.contentPillarMatch > 0.7) {
            parts.push('Aligns with your content strategy');
        }
        return parts.length > 0 ? parts.join('. ') + '.' : 'Moderate relevance across all factors.';
    }
    getDefaultScores() {
        return {
            topicRelevance: 0.5,
            expertiseAlignment: 0.5,
            audienceRelevance: 0.5,
            temporalRelevance: 0.5,
            contentPillarMatch: 0.5,
            overallScore: 0.5,
            explanation: 'Default scoring applied - user profile not available',
            suggestedAngles: []
        };
    }
}
exports.RelevanceScoringService = RelevanceScoringService;
//# sourceMappingURL=relevance-scoring.service.js.map