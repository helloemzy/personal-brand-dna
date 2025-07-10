"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsMonitorEnhancedAgent = void 0;
const base_agent_1 = require("../framework/base-agent");
const shared_1 = require("@brandpillar/shared");
const rss_parser_1 = __importDefault(require("rss-parser"));
const news_database_service_1 = require("../services/news-database.service");
const relevance_scoring_service_1 = require("../services/relevance-scoring.service");
const virality_prediction_service_1 = require("../services/virality-prediction.service");
const competitive_analysis_service_1 = require("../services/competitive-analysis.service");
const workshop_data_service_1 = require("../services/workshop-data.service");
class NewsMonitorEnhancedAgent extends base_agent_1.BaseAgent {
    parser;
    databaseService;
    relevanceService;
    viralityService;
    competitiveService;
    workshopService;
    monitoringInterval = 15 * 60 * 1000; // 15 minutes
    monitoringTimer;
    batchSize = 50; // Articles per batch
    constructor() {
        super({
            type: shared_1.AgentType.NEWS_MONITOR,
            name: 'Enhanced News Monitor Agent',
            messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            maxConcurrentTasks: 20,
            healthCheckInterval: 60000
        });
        this.parser = new rss_parser_1.default({
            headers: {
                'User-Agent': 'BrandPillar AI News Monitor/2.0'
            },
            timeout: 30000,
            customFields: {
                item: [
                    ['media:content', 'media:content', { keepArray: true }],
                    ['media:thumbnail', 'media:thumbnail'],
                    ['dc:creator', 'creator']
                ]
            }
        });
        // Initialize services
        this.databaseService = new news_database_service_1.NewsDatabaseService();
        this.relevanceService = new relevance_scoring_service_1.RelevanceScoringService();
        this.viralityService = new virality_prediction_service_1.ViralityPredictionService();
        this.competitiveService = new competitive_analysis_service_1.CompetitiveAnalysisService();
        this.workshopService = new workshop_data_service_1.WorkshopDataService();
    }
    async initialize() {
        this.logger.info('Initializing Enhanced News Monitor Agent');
        try {
            // Load active feeds from database
            await this.loadActiveFeeds();
            // Start monitoring cycle
            this.startEnhancedMonitoring();
            // Clean up expired opportunities daily
            setInterval(() => this.cleanupExpiredOpportunities(), 24 * 60 * 60 * 1000);
            this.logger.info('Enhanced News Monitor Agent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize News Monitor Agent:', error);
            throw error;
        }
    }
    async processTask(task) {
        this.logger.info({ taskType: task.taskType }, 'Processing enhanced news monitor task');
        try {
            switch (task.taskType) {
                case 'MONITOR_USER_FEEDS':
                    return await this.monitorUserFeeds(task.userId);
                case 'ANALYZE_ARTICLE':
                    return await this.analyzeArticle(task.userId, task.payload.articleId);
                case 'FIND_CONTENT_GAPS':
                    return await this.findContentGaps(task.userId, task.payload.timeframe || 7);
                case 'GET_TOP_OPPORTUNITIES':
                    return await this.getTopOpportunities(task.userId, task.payload.limit || 10);
                case 'UPDATE_FEED_PREFERENCES':
                    return await this.updateFeedPreferences(task.userId, task.payload);
                case 'TRIGGER_CONTENT_GENERATION':
                    return await this.triggerContentGeneration(task.userId, task.payload.opportunityId);
                default:
                    throw new Error(`Unknown task type: ${task.taskType}`);
            }
        }
        catch (error) {
            this.logger.error({ error, task }, 'Error processing task');
            throw error;
        }
    }
    async validateTask(task) {
        switch (task.taskType) {
            case 'MONITOR_USER_FEEDS':
            case 'FIND_CONTENT_GAPS':
            case 'GET_TOP_OPPORTUNITIES':
                return !!task.userId;
            case 'ANALYZE_ARTICLE':
                return !!(task.userId && task.payload?.articleId);
            case 'UPDATE_FEED_PREFERENCES':
                return !!(task.userId && task.payload);
            case 'TRIGGER_CONTENT_GENERATION':
                return !!(task.userId && task.payload?.opportunityId);
            default:
                return false;
        }
    }
    async loadActiveFeeds() {
        try {
            const feeds = await this.databaseService.getAllActiveFeeds();
            this.logger.info(`Loaded ${feeds.length} active feeds`);
        }
        catch (error) {
            this.logger.error('Error loading feeds:', error);
        }
    }
    startEnhancedMonitoring() {
        this.monitoringTimer = setInterval(async () => {
            try {
                await this.runMonitoringCycle();
            }
            catch (error) {
                this.logger.error('Error in monitoring cycle:', error);
            }
        }, this.monitoringInterval);
        // Run immediately
        this.runMonitoringCycle();
    }
    async runMonitoringCycle() {
        this.logger.info('Starting enhanced monitoring cycle');
        try {
            // Get all active feeds that need checking
            const feeds = await this.databaseService.getAllActiveFeeds();
            const feedsDueForCheck = feeds.filter(feed => {
                if (!feed.last_fetched_at)
                    return true;
                const timeSinceLastFetch = Date.now() - new Date(feed.last_fetched_at).getTime();
                return timeSinceLastFetch > (feed.update_frequency || 3600) * 1000;
            });
            this.logger.info(`Checking ${feedsDueForCheck.length} feeds`);
            // Process feeds in parallel batches
            const feedBatches = this.chunkArray(feedsDueForCheck, 5);
            for (const batch of feedBatches) {
                await Promise.all(batch.map(feed => this.processFeed(feed)));
            }
            // Refresh opportunity summary
            await this.databaseService.refreshOpportunitySummary();
        }
        catch (error) {
            this.logger.error('Error in monitoring cycle:', error);
        }
    }
    async processFeed(feed) {
        try {
            const startTime = Date.now();
            const parsedFeed = await this.parser.parseURL(feed.url);
            if (!parsedFeed.items || parsedFeed.items.length === 0) {
                await this.databaseService.updateFeedStatus(feed.id, {
                    last_fetched_at: new Date(),
                    consecutive_failures: feed.consecutive_failures + 1
                });
                return;
            }
            // Prepare articles for saving
            const articles = parsedFeed.items.map(item => ({
                feed_id: feed.id,
                guid: item.guid || item.link || item.title,
                url: item.link || '',
                title: item.title || '',
                summary: item.contentSnippet || item.summary || '',
                content: item.content || item['content:encoded'] || '',
                author: item.creator || item.author || parsedFeed.title,
                published_at: new Date(item.pubDate || item.isoDate || Date.now()),
                categories: item.categories || [],
                image_url: this.extractImageUrl(item),
                metadata: {
                    enclosure: item.enclosure,
                    source: parsedFeed.title
                }
            }));
            // Save articles (deduplication handled by database)
            const savedArticles = await this.databaseService.saveArticles(articles);
            // Update feed status
            await this.databaseService.updateFeedStatus(feed.id, {
                last_fetched_at: new Date(),
                last_successful_fetch: new Date(),
                consecutive_failures: 0,
                average_items_per_fetch: parsedFeed.items.length
            });
            // Process new articles for opportunities
            await this.processNewArticles(savedArticles, feed);
            const processingTime = Date.now() - startTime;
            this.logger.info({
                feedUrl: feed.url,
                articlesFound: parsedFeed.items.length,
                articlesSaved: savedArticles.length,
                processingTime
            }, 'Feed processed successfully');
        }
        catch (error) {
            this.logger.error({ error, feedUrl: feed.url }, 'Error processing feed');
            await this.databaseService.updateFeedStatus(feed.id, {
                last_fetched_at: new Date(),
                consecutive_failures: feed.consecutive_failures + 1
            });
        }
    }
    async processNewArticles(articles, feed) {
        // Get users subscribed to this feed
        const subscriptions = await this.getSubscriptionsForFeed(feed.id);
        for (const article of articles) {
            // Process for each subscribed user
            for (const subscription of subscriptions) {
                try {
                    await this.createOpportunityForUser(subscription.user_id, article, subscription);
                }
                catch (error) {
                    this.logger.error({
                        error,
                        userId: subscription.user_id,
                        articleId: article.id
                    }, 'Error creating opportunity');
                }
            }
        }
    }
    async createOpportunityForUser(userId, article, subscription) {
        // Get user profile for scoring
        const userProfile = await this.workshopService.getUserWorkshopData(userId);
        if (!userProfile)
            return;
        // Calculate relevance score
        const relevanceScores = await this.relevanceService.calculateRelevance(userId, {
            title: article.title,
            summary: article.summary,
            content: article.content,
            categories: article.categories || [],
            keywords: article.keywords || [],
            publishedAt: article.published_at,
            source: article.metadata?.source || ''
        }, subscription.keywords, subscription.excluded_keywords);
        // Skip if below minimum relevance threshold
        if (relevanceScores.overallScore < (subscription.min_relevance_score || 0.5)) {
            return;
        }
        // Predict virality
        const viralityPrediction = await this.viralityService.predictVirality(article);
        // Analyze competitive advantage
        const competitiveAdvantage = await this.competitiveService.analyzeCompetitiveAdvantage(userId, article, userProfile);
        // Create enhanced opportunity
        const opportunity = {
            user_id: userId,
            article_id: article.id,
            relevance_score: relevanceScores.overallScore,
            virality_score: viralityPrediction.viralityScore,
            competitive_score: competitiveAdvantage.score,
            timing_score: relevanceScores.temporalRelevance,
            content_pillars: this.mapToContentPillars(relevanceScores, userProfile),
            suggested_angles: relevanceScores.suggestedAngles,
            suggested_hooks: this.generateHooks(article, userProfile),
            status: 'new',
            metadata: {
                relevanceDetails: {
                    topicRelevance: relevanceScores.topicRelevance,
                    expertiseAlignment: relevanceScores.expertiseAlignment,
                    audienceRelevance: relevanceScores.audienceRelevance,
                    explanation: relevanceScores.explanation
                },
                viralityPrediction: {
                    score: viralityPrediction.viralityScore,
                    predictedReach: viralityPrediction.predictedReach,
                    predictedEngagement: viralityPrediction.predictedEngagement,
                    timeToPeak: viralityPrediction.timeToPeak
                },
                competitiveAdvantage: {
                    score: competitiveAdvantage.score,
                    uncoveredAngle: competitiveAdvantage.uncoveredAngle,
                    uniquePerspective: competitiveAdvantage.uniquePerspective,
                    competitorsCovered: competitiveAdvantage.competitorsCovered
                }
            }
        };
        // Save opportunity
        await this.databaseService.saveOpportunity(opportunity);
        // Send high-value opportunities to content generation
        if (opportunity.relevance_score > 0.8 && opportunity.virality_score > 0.6) {
            await this.notifyHighValueOpportunity(userId, opportunity);
        }
    }
    async monitorUserFeeds(userId) {
        // Get user's feed subscriptions
        const userFeeds = await this.databaseService.getUserFeeds(userId);
        if (userFeeds.length === 0) {
            this.logger.warn({ userId }, 'User has no feed subscriptions');
            return [];
        }
        // Check each feed for new content
        for (const feed of userFeeds) {
            await this.processFeed(feed);
        }
        // Return top opportunities
        return await this.getTopOpportunities(userId, 20);
    }
    async analyzeArticle(userId, articleId) {
        const article = await this.databaseService.getArticleById(articleId);
        if (!article) {
            throw new Error('Article not found');
        }
        const userProfile = await this.workshopService.getUserWorkshopData(userId);
        if (!userProfile) {
            throw new Error('User profile not found');
        }
        // Perform full analysis
        const relevanceScores = await this.relevanceService.calculateRelevance(userId, {
            title: article.title,
            summary: article.summary || '',
            content: article.content || '',
            categories: article.categories || [],
            keywords: article.keywords || [],
            publishedAt: article.published_at,
            source: article.metadata?.source || ''
        });
        const viralityPrediction = await this.viralityService.predictVirality(article);
        const competitiveAdvantage = await this.competitiveService.analyzeCompetitiveAdvantage(userId, article, userProfile);
        return {
            id: `opp_${articleId}_${userId}`,
            userId,
            sourceUrl: article.url,
            title: article.title,
            summary: article.summary || '',
            publishedAt: article.published_at,
            relevanceScore: relevanceScores.overallScore,
            viralityScore: viralityPrediction.viralityScore,
            competitiveScore: competitiveAdvantage.score,
            contentPillars: this.mapToContentPillars(relevanceScores, userProfile),
            keywords: article.keywords || [],
            status: 'analyzed',
            createdAt: new Date(),
            relevanceDetails: {
                topicRelevance: relevanceScores.topicRelevance,
                expertiseAlignment: relevanceScores.expertiseAlignment,
                audienceRelevance: relevanceScores.audienceRelevance,
                explanation: relevanceScores.explanation
            },
            viralityPrediction: {
                score: viralityPrediction.viralityScore,
                predictedReach: viralityPrediction.predictedReach,
                predictedEngagement: viralityPrediction.predictedEngagement,
                timeToPeak: viralityPrediction.timeToPeak
            },
            competitiveAdvantage: {
                score: competitiveAdvantage.score,
                uncoveredAngle: competitiveAdvantage.uncoveredAngle,
                uniquePerspective: competitiveAdvantage.uniquePerspective,
                competitorsCovered: competitiveAdvantage.competitorsCovered
            }
        };
    }
    async findContentGaps(userId, timeframeDays) {
        const userProfile = await this.workshopService.getUserWorkshopData(userId);
        if (!userProfile)
            return [];
        return await this.competitiveService.findContentGaps(userId, userProfile, timeframeDays);
    }
    async getTopOpportunities(userId, limit) {
        const opportunities = await this.databaseService.getUserOpportunities(userId, limit, 'new');
        // Enhance with additional data
        return opportunities.map(opp => ({
            ...opp,
            relevanceDetails: opp.metadata?.relevanceDetails,
            viralityPrediction: opp.metadata?.viralityPrediction,
            competitiveAdvantage: opp.metadata?.competitiveAdvantage
        }));
    }
    async updateFeedPreferences(userId, preferences) {
        // Update user voice profile
        if (preferences.voiceProfile) {
            await this.databaseService.updateUserVoiceProfile(userId, preferences.voiceProfile);
        }
        // Update feed subscriptions
        if (preferences.feedUpdates) {
            for (const update of preferences.feedUpdates) {
                // Implementation for updating feed preferences
            }
        }
    }
    async triggerContentGeneration(userId, opportunityId) {
        // Update opportunity status
        await this.databaseService.updateOpportunityStatus(opportunityId, 'used');
        // Send to content generation agent
        const message = {
            id: this.generateMessageId(),
            type: 'CONTENT_REQUEST',
            source: this.config.type,
            target: shared_1.AgentType.CONTENT_GENERATOR,
            payload: {
                userId,
                opportunityId,
                priority: 'high'
            },
            timestamp: new Date()
        };
        await this.messageBus.publish(message);
        this.logger.info({
            userId,
            opportunityId
        }, 'Triggered content generation for opportunity');
    }
    async notifyHighValueOpportunity(userId, opportunity) {
        const message = {
            id: this.generateMessageId(),
            type: 'HIGH_VALUE_OPPORTUNITY',
            source: this.config.type,
            target: shared_1.AgentType.ORCHESTRATOR,
            payload: {
                userId,
                opportunity,
                recommendation: 'Consider immediate content creation'
            },
            timestamp: new Date()
        };
        await this.messageBus.publish(message);
    }
    mapToContentPillars(relevanceScores, userProfile) {
        const pillars = [];
        if (relevanceScores.expertiseAlignment > 0.7) {
            pillars.push('expertise');
        }
        if (relevanceScores.audienceRelevance > 0.7) {
            pillars.push('experience');
        }
        if (relevanceScores.topicRelevance > 0.6 && relevanceScores.temporalRelevance > 0.8) {
            pillars.push('evolution');
        }
        return pillars.length > 0 ? pillars : ['expertise'];
    }
    generateHooks(article, userProfile) {
        const hooks = [];
        // Question hook
        hooks.push(`Ever wondered how ${article.title.toLowerCase()} affects ${userProfile.audience?.industry || 'your industry'}?`);
        // Statistic hook
        hooks.push(`New research reveals surprising insights about ${this.extractTopic(article.title)}`);
        // Personal hook
        hooks.push(`My take on ${article.title}: Why it matters for ${userProfile.archetype || 'leaders'} like us`);
        return hooks.slice(0, 3);
    }
    extractTopic(title) {
        const words = title.split(' ').filter(w => w.length > 4);
        return words[0] || 'this trend';
    }
    extractImageUrl(item) {
        // Try multiple possible image sources
        if (item['media:thumbnail'])
            return item['media:thumbnail'].$.url;
        if (item['media:content']?.[0]?.$.url)
            return item['media:content'][0].$.url;
        if (item.enclosure?.url && item.enclosure.type?.startsWith('image/'))
            return item.enclosure.url;
        return undefined;
    }
    async getSubscriptionsForFeed(feedId) {
        // In production, query user_feed_subscriptions table
        // For now, return mock data
        return [
            {
                user_id: 'user_123',
                feed_id: feedId,
                priority: 5,
                keywords: [],
                excluded_keywords: [],
                min_relevance_score: 0.5
            }
        ];
    }
    async cleanupExpiredOpportunities() {
        try {
            const expiredCount = await this.databaseService.cleanupExpiredOpportunities();
            this.logger.info(`Cleaned up ${expiredCount} expired opportunities`);
        }
        catch (error) {
            this.logger.error('Error cleaning up opportunities:', error);
        }
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    async stop() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }
        await super.stop();
    }
}
exports.NewsMonitorEnhancedAgent = NewsMonitorEnhancedAgent;
//# sourceMappingURL=news-monitor-enhanced.agent.js.map