"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViralityPredictionService = void 0;
const logger_1 = require("../utils/logger");
const news_database_service_1 = require("./news-database.service");
const tf = __importStar(require("@tensorflow/tfjs-node"));
class ViralityPredictionService {
    logger;
    databaseService;
    model = null;
    emotionalWords;
    powerWords;
    trendingTopics = new Map();
    constructor() {
        this.logger = (0, logger_1.createLogger)('ViralityPredictionService');
        this.databaseService = new news_database_service_1.NewsDatabaseService();
        // Initialize emotional and power words
        this.emotionalWords = new Set([
            'amazing', 'shocking', 'incredible', 'unbelievable', 'stunning',
            'revolutionary', 'game-changing', 'breakthrough', 'exclusive',
            'urgent', 'critical', 'essential', 'must-know', 'secret'
        ]);
        this.powerWords = new Set([
            'how', 'why', 'what', 'when', 'best', 'top', 'ultimate',
            'complete', 'proven', 'guaranteed', 'free', 'new', 'instant'
        ]);
        this.initializeModel();
        this.updateTrendingTopics();
    }
    async initializeModel() {
        try {
            // In production, load pre-trained model
            // For now, create a simple neural network
            this.model = tf.sequential({
                layers: [
                    tf.layers.dense({ inputShape: [15], units: 32, activation: 'relu' }),
                    tf.layers.dropout({ rate: 0.2 }),
                    tf.layers.dense({ units: 16, activation: 'relu' }),
                    tf.layers.dense({ units: 1, activation: 'sigmoid' })
                ]
            });
            this.model.compile({
                optimizer: 'adam',
                loss: 'binaryCrossentropy',
                metrics: ['accuracy']
            });
            this.logger.info('Virality prediction model initialized');
        }
        catch (error) {
            this.logger.error('Error initializing model:', error);
        }
    }
    async predictVirality(article, historicalData) {
        try {
            // Extract features
            const features = this.extractFeatures(article);
            // Get prediction from model or heuristics
            const viralityScore = await this.getViralityScore(features);
            // Calculate additional metrics
            const predictedReach = this.calculatePredictedReach(viralityScore, features);
            const predictedEngagement = this.calculatePredictedEngagement(viralityScore, features);
            const timeToPeak = this.calculateTimeToPeak(features);
            const confidence = this.calculateConfidence(features, historicalData);
            // Generate explanation
            const explanation = this.generateExplanation(features, viralityScore);
            return {
                viralityScore,
                predictedReach,
                predictedEngagement,
                timeToPeak,
                confidence,
                explanation
            };
        }
        catch (error) {
            this.logger.error('Error predicting virality:', error);
            return this.getDefaultPrediction();
        }
    }
    extractFeatures(article) {
        const title = article.title || '';
        const publishedDate = new Date(article.publishedAt);
        return {
            // Content features
            titleLength: title.length,
            titleWordCount: title.split(/\s+/).length,
            hasQuestion: title.includes('?'),
            hasNumber: /\d/.test(title),
            emotionalIntensity: this.calculateEmotionalIntensity(title),
            // Timing features
            dayOfWeek: publishedDate.getDay(),
            hourOfDay: publishedDate.getHours(),
            isWeekend: publishedDate.getDay() === 0 || publishedDate.getDay() === 6,
            // Source features
            sourceAuthority: this.getSourceAuthority(article.source),
            sourceEngagementRate: this.getSourceEngagementRate(article.source),
            // Topic features
            trendingScore: this.calculateTrendingScore(article),
            controversyScore: this.calculateControversyScore(article),
            noveltyScore: this.calculateNoveltyScore(article)
        };
    }
    async getViralityScore(features) {
        if (this.model) {
            // Use TensorFlow model for prediction
            const inputTensor = tf.tensor2d([[
                    features.titleLength / 100,
                    features.titleWordCount / 20,
                    features.hasQuestion ? 1 : 0,
                    features.hasNumber ? 1 : 0,
                    features.emotionalIntensity,
                    features.dayOfWeek / 6,
                    features.hourOfDay / 23,
                    features.isWeekend ? 1 : 0,
                    features.sourceAuthority,
                    features.sourceEngagementRate,
                    features.trendingScore,
                    features.controversyScore,
                    features.noveltyScore,
                    0, 0 // Padding for 15 features
                ]]);
            const prediction = this.model.predict(inputTensor);
            const score = await prediction.data();
            inputTensor.dispose();
            prediction.dispose();
            return score[0];
        }
        else {
            // Fallback to heuristic scoring
            return this.heuristicViralityScore(features);
        }
    }
    heuristicViralityScore(features) {
        let score = 0.3; // Base score
        // Title features
        if (features.hasQuestion)
            score += 0.1;
        if (features.hasNumber)
            score += 0.1;
        if (features.titleWordCount >= 8 && features.titleWordCount <= 14)
            score += 0.05;
        // Emotional intensity
        score += features.emotionalIntensity * 0.2;
        // Timing
        if (features.hourOfDay >= 9 && features.hourOfDay <= 11)
            score += 0.05; // Morning peak
        if (features.hourOfDay >= 17 && features.hourOfDay <= 19)
            score += 0.05; // Evening peak
        if (!features.isWeekend)
            score += 0.05;
        // Source authority
        score += features.sourceAuthority * 0.1;
        // Topic features
        score += features.trendingScore * 0.15;
        score += features.controversyScore * 0.1;
        score += features.noveltyScore * 0.1;
        return Math.min(score, 1);
    }
    calculateEmotionalIntensity(text) {
        const words = text.toLowerCase().split(/\s+/);
        let emotionalCount = 0;
        let powerCount = 0;
        for (const word of words) {
            if (this.emotionalWords.has(word))
                emotionalCount++;
            if (this.powerWords.has(word))
                powerCount++;
        }
        const totalWords = words.length;
        const emotionalRatio = totalWords > 0 ? emotionalCount / totalWords : 0;
        const powerRatio = totalWords > 0 ? powerCount / totalWords : 0;
        return Math.min((emotionalRatio + powerRatio) * 2, 1);
    }
    getSourceAuthority(source) {
        // Source authority scores (0-1)
        const authorityScores = {
            'techcrunch.com': 0.9,
            'theverge.com': 0.85,
            'wired.com': 0.85,
            'arstechnica.com': 0.8,
            'hbr.org': 0.9,
            'ft.com': 0.95,
            'bloomberg.com': 0.95,
            'wsj.com': 0.95,
            'fortune.com': 0.85,
            'inc.com': 0.75,
            'fastcompany.com': 0.8
        };
        return authorityScores[source] || 0.5;
    }
    getSourceEngagementRate(source) {
        // Average engagement rates by source (simplified)
        const engagementRates = {
            'techcrunch.com': 0.7,
            'theverge.com': 0.65,
            'wired.com': 0.6,
            'hbr.org': 0.55,
            'bloomberg.com': 0.5,
            'inc.com': 0.6,
            'fastcompany.com': 0.65
        };
        return engagementRates[source] || 0.4;
    }
    calculateTrendingScore(article) {
        const title = article.title.toLowerCase();
        const summary = (article.summary || '').toLowerCase();
        const text = `${title} ${summary}`;
        let trendingScore = 0;
        let matchCount = 0;
        // Check against trending topics
        for (const [topic, score] of this.trendingTopics.entries()) {
            if (text.includes(topic.toLowerCase())) {
                trendingScore += score;
                matchCount++;
            }
        }
        // Normalize
        return matchCount > 0 ? Math.min(trendingScore / matchCount, 1) : 0.3;
    }
    calculateControversyScore(article) {
        const controversialTerms = [
            'debate', 'controversial', 'critics', 'backlash', 'divided',
            'dispute', 'scandal', 'accused', 'allegation', 'shocking'
        ];
        const text = `${article.title} ${article.summary || ''}`.toLowerCase();
        let controversyCount = 0;
        for (const term of controversialTerms) {
            if (text.includes(term))
                controversyCount++;
        }
        return Math.min(controversyCount * 0.2, 1);
    }
    calculateNoveltyScore(article) {
        const noveltyTerms = [
            'first', 'new', 'breakthrough', 'never before', 'exclusive',
            'just announced', 'breaking', 'unveiled', 'launched', 'revolutionary'
        ];
        const text = `${article.title} ${article.summary || ''}`.toLowerCase();
        let noveltyCount = 0;
        for (const term of noveltyTerms) {
            if (text.includes(term))
                noveltyCount++;
        }
        // Recency bonus
        const publishedDate = new Date(article.publishedAt);
        const hoursOld = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
        const recencyBonus = hoursOld < 6 ? 0.3 : hoursOld < 24 ? 0.1 : 0;
        return Math.min(noveltyCount * 0.15 + recencyBonus, 1);
    }
    calculatePredictedReach(viralityScore, features) {
        // Base reach calculation
        const baseReach = 1000;
        const authorityMultiplier = 1 + features.sourceAuthority;
        const viralityMultiplier = Math.exp(viralityScore * 3);
        return Math.round(baseReach * authorityMultiplier * viralityMultiplier);
    }
    calculatePredictedEngagement(viralityScore, features) {
        // Engagement rate typically 2-5% for normal content, up to 15% for viral
        const baseEngagementRate = 0.02;
        const viralEngagementRate = 0.15;
        const engagementRate = baseEngagementRate +
            (viralEngagementRate - baseEngagementRate) * viralityScore;
        const predictedReach = this.calculatePredictedReach(viralityScore, features);
        return Math.round(predictedReach * engagementRate);
    }
    calculateTimeToPeak(features) {
        // Time to peak in hours
        let baseTim = 24;
        // Adjust based on features
        if (features.hasQuestion)
            baseTim -= 4;
        if (features.emotionalIntensity > 0.7)
            baseTim -= 6;
        if (features.trendingScore > 0.7)
            baseTim -= 8;
        if (features.controversyScore > 0.5)
            baseTim -= 4;
        return Math.max(baseTim, 2); // Minimum 2 hours
    }
    calculateConfidence(features, historicalData) {
        let confidence = 0.7; // Base confidence
        // Increase confidence with more historical data
        if (historicalData && historicalData.length > 100) {
            confidence += 0.1;
        }
        // Increase confidence for well-known sources
        if (features.sourceAuthority > 0.8) {
            confidence += 0.1;
        }
        // Decrease confidence for extreme predictions
        if (features.controversyScore > 0.8 || features.noveltyScore > 0.8) {
            confidence -= 0.1;
        }
        return Math.max(0.3, Math.min(confidence, 0.95));
    }
    generateExplanation(features, score) {
        const factors = [];
        if (features.hasQuestion) {
            factors.push('Question headlines drive 2x more engagement');
        }
        if (features.emotionalIntensity > 0.6) {
            factors.push('High emotional intensity increases shareability');
        }
        if (features.trendingScore > 0.7) {
            factors.push('Aligns with current trending topics');
        }
        if (features.sourceAuthority > 0.8) {
            factors.push('High-authority source boosts credibility');
        }
        if (score > 0.7) {
            return `High viral potential. ${factors.join('. ')}.`;
        }
        else if (score > 0.4) {
            return `Moderate viral potential. ${factors.join('. ')}.`;
        }
        else {
            return `Lower viral potential. Consider adding emotional hooks or trending angles.`;
        }
    }
    async updateTrendingTopics() {
        // In production, this would fetch from trending APIs
        // For now, use static trending topics
        this.trendingTopics.set('AI', 0.9);
        this.trendingTopics.set('ChatGPT', 0.85);
        this.trendingTopics.set('climate change', 0.7);
        this.trendingTopics.set('remote work', 0.65);
        this.trendingTopics.set('inflation', 0.6);
        this.trendingTopics.set('cybersecurity', 0.7);
        this.trendingTopics.set('sustainability', 0.65);
        // Update every hour
        setTimeout(() => this.updateTrendingTopics(), 60 * 60 * 1000);
    }
    async trainModel(historicalData) {
        if (!this.model || historicalData.length < 100)
            return;
        try {
            // Prepare training data
            const features = historicalData.map(item => this.extractFeatures(item.article));
            const labels = historicalData.map(item => item.wentViral ? 1 : 0);
            // Convert to tensors
            const xs = tf.tensor2d(features.map(f => [
                f.titleLength / 100,
                f.titleWordCount / 20,
                f.hasQuestion ? 1 : 0,
                f.hasNumber ? 1 : 0,
                f.emotionalIntensity,
                f.dayOfWeek / 6,
                f.hourOfDay / 23,
                f.isWeekend ? 1 : 0,
                f.sourceAuthority,
                f.sourceEngagementRate,
                f.trendingScore,
                f.controversyScore,
                f.noveltyScore,
                0, 0 // Padding
            ]));
            const ys = tf.tensor2d(labels, [labels.length, 1]);
            // Train model
            await this.model.fit(xs, ys, {
                epochs: 50,
                batchSize: 32,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        this.logger.info(`Epoch ${epoch}: loss = ${logs?.loss}`);
                    }
                }
            });
            // Clean up
            xs.dispose();
            ys.dispose();
            this.logger.info('Model training completed');
        }
        catch (error) {
            this.logger.error('Error training model:', error);
        }
    }
    getDefaultPrediction() {
        return {
            viralityScore: 0.3,
            predictedReach: 500,
            predictedEngagement: 25,
            timeToPeak: 24,
            confidence: 0.5,
            explanation: 'Default prediction - unable to analyze features'
        };
    }
}
exports.ViralityPredictionService = ViralityPredictionService;
//# sourceMappingURL=virality-prediction.service.js.map