"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsMonitorAgent = void 0;
const base_agent_1 = require("../framework/base-agent");
const shared_1 = require("@brandpillar/shared");
const rss_parser_1 = __importDefault(require("rss-parser"));
class NewsMonitorAgent extends base_agent_1.BaseAgent {
    parser;
    feedSources = new Map();
    checkInterval = 5 * 60 * 1000; // 5 minutes
    monitoringTimer;
    constructor() {
        super({
            type: shared_1.AgentType.NEWS_MONITOR,
            name: 'News Monitor Agent',
            messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            maxConcurrentTasks: 10,
            healthCheckInterval: 60000
        });
        this.parser = new rss_parser_1.default({
            headers: {
                'User-Agent': 'BrandPillar AI News Monitor/1.0'
            },
            timeout: 30000
        });
    }
    async initialize() {
        this.logger.info('Initializing News Monitor Agent');
        // Load default feed sources
        this.loadDefaultFeeds();
        // Start monitoring
        this.startMonitoring();
    }
    async processTask(task) {
        this.logger.info({ taskType: task.taskType }, 'Processing news monitor task');
        switch (task.taskType) {
            case 'ADD_FEED':
                return this.addFeed(task.userId, task.payload);
            case 'REMOVE_FEED':
                return this.removeFeed(task.userId, task.payload.feedUrl);
            case 'CHECK_FEEDS':
                return this.checkUserFeeds(task.userId);
            case 'GET_OPPORTUNITIES':
                return this.getRecentOpportunities(task.userId, task.payload.limit || 10);
            default:
                throw new Error(`Unknown task type: ${task.taskType}`);
        }
    }
    async validateTask(task) {
        // Validate required fields based on task type
        switch (task.taskType) {
            case 'ADD_FEED':
                return !!(task.payload.url && task.payload.category);
            case 'REMOVE_FEED':
                return !!task.payload.feedUrl;
            case 'CHECK_FEEDS':
            case 'GET_OPPORTUNITIES':
                return true;
            default:
                return false;
        }
    }
    loadDefaultFeeds() {
        // Default tech feeds
        const techFeeds = [
            { url: 'https://techcrunch.com/feed/', category: 'technology' },
            { url: 'https://www.theverge.com/rss/index.xml', category: 'technology' },
            { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'technology' }
        ];
        // Default business feeds
        const businessFeeds = [
            { url: 'https://feeds.hbr.org/harvardbusiness', category: 'business' },
            { url: 'https://www.ft.com/rss/home', category: 'business' }
        ];
        // Store default feeds
        this.feedSources.set('default_tech', techFeeds);
        this.feedSources.set('default_business', businessFeeds);
    }
    startMonitoring() {
        this.monitoringTimer = setInterval(async () => {
            try {
                // Check all user feeds
                const users = await this.getAllUsers();
                for (const userId of users) {
                    await this.checkUserFeeds(userId);
                }
            }
            catch (error) {
                this.logger.error({ error }, 'Error in feed monitoring cycle');
            }
        }, this.checkInterval);
    }
    async addFeed(userId, feedData) {
        const { url, category } = feedData;
        // Validate feed URL
        try {
            await this.parser.parseURL(url);
        }
        catch (error) {
            throw new Error(`Invalid feed URL: ${url}`);
        }
        // Add to user's feeds
        const userFeeds = this.feedSources.get(userId) || [];
        userFeeds.push({ url, category });
        this.feedSources.set(userId, userFeeds);
        this.logger.info({ userId, url, category }, 'Added feed');
    }
    async removeFeed(userId, feedUrl) {
        const userFeeds = this.feedSources.get(userId) || [];
        const filtered = userFeeds.filter(feed => feed.url !== feedUrl);
        this.feedSources.set(userId, filtered);
        this.logger.info({ userId, feedUrl }, 'Removed feed');
    }
    async checkUserFeeds(userId) {
        const userFeeds = this.feedSources.get(userId) || [];
        const opportunities = [];
        for (const feed of userFeeds) {
            try {
                const parsedFeed = await this.parser.parseURL(feed.url);
                for (const item of parsedFeed.items || []) {
                    const opportunity = await this.createOpportunity(userId, item, feed.category);
                    if (opportunity.relevanceScore > 0.5) {
                        opportunities.push(opportunity);
                    }
                }
                feed.lastChecked = new Date();
            }
            catch (error) {
                this.logger.error({ error, feedUrl: feed.url }, 'Error parsing feed');
            }
        }
        // Sort by relevance score
        opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
        return opportunities;
    }
    async createOpportunity(userId, item, category) {
        // Calculate scores (simplified for demo)
        const relevanceScore = this.calculateRelevance(item, userId);
        const viralityScore = this.calculateVirality(item);
        const competitiveScore = this.calculateCompetitiveAdvantage(item);
        // Extract keywords
        const keywords = this.extractKeywords(item);
        return {
            id: this.generateMessageId(),
            userId,
            sourceUrl: item.link || '',
            title: item.title || '',
            summary: item.contentSnippet || item.summary || '',
            publishedAt: new Date(item.pubDate || Date.now()),
            relevanceScore,
            viralityScore,
            competitiveScore,
            contentPillars: [category],
            keywords,
            status: 'new',
            createdAt: new Date()
        };
    }
    calculateRelevance(item, userId) {
        // Simplified relevance calculation
        // In production, this would use user's voice profile and preferences
        const hasKeywords = ['AI', 'technology', 'innovation', 'startup'].some(keyword => item.title?.toLowerCase().includes(keyword.toLowerCase()));
        const recency = Date.now() - new Date(item.pubDate || Date.now()).getTime();
        const isRecent = recency < 24 * 60 * 60 * 1000; // Less than 24 hours
        let score = 0.5;
        if (hasKeywords)
            score += 0.3;
        if (isRecent)
            score += 0.2;
        return Math.min(score, 1);
    }
    calculateVirality(item) {
        // Simplified virality prediction
        // In production, would analyze engagement metrics, source authority, etc.
        return Math.random() * 0.8 + 0.2; // Random between 0.2 and 1
    }
    calculateCompetitiveAdvantage(item) {
        // Simplified competitive scoring
        // In production, would check if competitors have covered this
        return Math.random() * 0.7 + 0.3; // Random between 0.3 and 1
    }
    extractKeywords(item) {
        // Simplified keyword extraction
        const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
        const commonWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an'];
        const words = text.split(/\W+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));
        // Get unique words
        return [...new Set(words)].slice(0, 10);
    }
    async getRecentOpportunities(userId, limit) {
        // In production, this would query from database
        const opportunities = await this.checkUserFeeds(userId);
        return opportunities.slice(0, limit);
    }
    async getAllUsers() {
        // In production, this would query from database
        // For now, return users with feeds
        return Array.from(this.feedSources.keys()).filter(key => !key.startsWith('default_'));
    }
    async stop() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }
        await super.stop();
    }
}
exports.NewsMonitorAgent = NewsMonitorAgent;
//# sourceMappingURL=news-monitor.agent.js.map