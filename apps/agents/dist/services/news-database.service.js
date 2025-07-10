"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsDatabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
class NewsDatabaseService {
    supabase;
    logger;
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        this.logger = (0, logger_1.createLogger)('NewsDatabaseService');
    }
    // Feed Management
    async getAllActiveFeeds() {
        const { data, error } = await this.supabase
            .from('rss_feed_sources')
            .select('*')
            .eq('is_active', true)
            .order('last_fetched_at', { ascending: true, nullsFirst: true });
        if (error) {
            this.logger.error('Error fetching feeds:', error);
            throw error;
        }
        return data || [];
    }
    async getUserFeeds(userId) {
        const { data, error } = await this.supabase
            .from('user_feed_subscriptions')
            .select(`
        *,
        feed:rss_feed_sources(*)
      `)
            .eq('user_id', userId)
            .eq('is_active', true);
        if (error) {
            this.logger.error('Error fetching user feeds:', error);
            throw error;
        }
        return data?.map(sub => ({
            ...sub.feed,
            priority: sub.priority,
            keywords: sub.keywords,
            excluded_keywords: sub.excluded_keywords,
            min_relevance_score: sub.min_relevance_score
        })) || [];
    }
    async updateFeedStatus(feedId, status) {
        const { error } = await this.supabase
            .from('rss_feed_sources')
            .update({
            ...status,
            updated_at: new Date().toISOString()
        })
            .eq('id', feedId);
        if (error) {
            this.logger.error('Error updating feed status:', error);
            throw error;
        }
    }
    // Article Management
    async saveArticles(articles) {
        // Generate content hashes for deduplication
        const articlesWithHashes = articles.map(article => ({
            ...article,
            content_hash: this.generateContentHash(article.title || '', article.url || '')
        }));
        const { data, error } = await this.supabase
            .from('news_articles')
            .upsert(articlesWithHashes, {
            onConflict: 'feed_id,guid',
            ignoreDuplicates: true
        })
            .select();
        if (error) {
            this.logger.error('Error saving articles:', error);
            throw error;
        }
        return data || [];
    }
    async getArticleById(articleId) {
        const { data, error } = await this.supabase
            .from('news_articles')
            .select('*')
            .eq('id', articleId)
            .single();
        if (error) {
            this.logger.error('Error fetching article:', error);
            return null;
        }
        return data;
    }
    async checkDuplicateArticles(contentHashes) {
        const { data, error } = await this.supabase
            .from('news_articles')
            .select('content_hash')
            .in('content_hash', contentHashes);
        if (error) {
            this.logger.error('Error checking duplicates:', error);
            return new Set();
        }
        return new Set(data?.map(item => item.content_hash) || []);
    }
    // Opportunity Management
    async saveOpportunity(opportunity) {
        const { data, error } = await this.supabase
            .from('news_opportunities')
            .upsert({
            ...opportunity,
            created_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,article_id'
        })
            .select()
            .single();
        if (error) {
            this.logger.error('Error saving opportunity:', error);
            throw error;
        }
        return data;
    }
    async getUserOpportunities(userId, limit = 20, status) {
        let query = this.supabase
            .from('news_opportunities')
            .select(`
        *,
        article:news_articles(*)
      `)
            .eq('user_id', userId)
            .order('overall_score', { ascending: false })
            .limit(limit);
        if (status) {
            query = query.eq('status', status);
        }
        const { data, error } = await query;
        if (error) {
            this.logger.error('Error fetching opportunities:', error);
            throw error;
        }
        return data || [];
    }
    async updateOpportunityStatus(opportunityId, status, metadata) {
        const updates = { status };
        if (status === 'viewed') {
            updates.viewed_at = new Date().toISOString();
        }
        else if (status === 'used' || status === 'dismissed') {
            updates.actioned_at = new Date().toISOString();
        }
        if (metadata) {
            updates.metadata = metadata;
        }
        const { error } = await this.supabase
            .from('news_opportunities')
            .update(updates)
            .eq('id', opportunityId);
        if (error) {
            this.logger.error('Error updating opportunity status:', error);
            throw error;
        }
    }
    // Voice Profile Management
    async getUserVoiceProfile(userId) {
        const { data, error } = await this.supabase
            .from('user_voice_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116') { // Not found is OK
            this.logger.error('Error fetching voice profile:', error);
            return null;
        }
        return data;
    }
    async updateUserVoiceProfile(userId, profile) {
        const { error } = await this.supabase
            .from('user_voice_profiles')
            .upsert({
            user_id: userId,
            ...profile,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        });
        if (error) {
            this.logger.error('Error updating voice profile:', error);
            throw error;
        }
    }
    // Competitive Analysis
    async saveCompetitiveCoverage(coverage) {
        const { error } = await this.supabase
            .from('competitive_coverage')
            .insert({
            ...coverage,
            detected_at: new Date().toISOString()
        });
        if (error) {
            this.logger.error('Error saving competitive coverage:', error);
            throw error;
        }
    }
    async getCompetitiveCoverage(articleId) {
        const { data, error } = await this.supabase
            .from('competitive_coverage')
            .select('*')
            .eq('article_id', articleId);
        if (error) {
            this.logger.error('Error fetching competitive coverage:', error);
            return [];
        }
        return data || [];
    }
    // Analytics
    async updateFeedAnalytics(feedId, metrics) {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await this.supabase
            .from('feed_analytics')
            .upsert({
            feed_id: feedId,
            date: today,
            ...metrics
        }, {
            onConflict: 'feed_id,date'
        });
        if (error) {
            this.logger.error('Error updating feed analytics:', error);
            throw error;
        }
    }
    async refreshOpportunitySummary() {
        // Refresh materialized view
        const { error } = await this.supabase.rpc('refresh_user_opportunity_summary');
        if (error) {
            this.logger.error('Error refreshing opportunity summary:', error);
        }
    }
    // Virality Tracking
    async saveViralityPattern(pattern) {
        const { error } = await this.supabase
            .from('virality_patterns')
            .insert({
            ...pattern,
            recorded_at: new Date().toISOString()
        });
        if (error) {
            this.logger.error('Error saving virality pattern:', error);
            throw error;
        }
    }
    async getViralityPatterns(limit = 100) {
        const { data, error } = await this.supabase
            .from('virality_patterns')
            .select('*')
            .order('peak_engagement', { ascending: false })
            .limit(limit);
        if (error) {
            this.logger.error('Error fetching virality patterns:', error);
            return [];
        }
        return data || [];
    }
    // Helper Methods
    generateContentHash(title, url) {
        const content = `${title.toLowerCase().trim()}${url.toLowerCase().trim()}`;
        return crypto_1.default.createHash('sha256').update(content).digest('hex');
    }
    // Bulk Operations
    async bulkUpdateOpportunityScores(opportunities) {
        const updates = opportunities.map(opp => ({
            id: opp.id,
            ...opp.scores,
            updated_at: new Date().toISOString()
        }));
        const { error } = await this.supabase
            .from('news_opportunities')
            .upsert(updates);
        if (error) {
            this.logger.error('Error bulk updating scores:', error);
            throw error;
        }
    }
    // Search and Filtering
    async searchArticles(query, limit = 20) {
        const { data, error } = await this.supabase
            .from('news_articles')
            .select('*')
            .textSearch('title', query, { type: 'websearch' })
            .order('published_at', { ascending: false })
            .limit(limit);
        if (error) {
            this.logger.error('Error searching articles:', error);
            return [];
        }
        return data || [];
    }
    // Cleanup Operations
    async cleanupExpiredOpportunities() {
        const { data, error } = await this.supabase
            .from('news_opportunities')
            .update({ status: 'expired' })
            .lt('expires_at', new Date().toISOString())
            .eq('status', 'new')
            .select('id');
        if (error) {
            this.logger.error('Error cleaning up opportunities:', error);
            return 0;
        }
        return data?.length || 0;
    }
}
exports.NewsDatabaseService = NewsDatabaseService;
//# sourceMappingURL=news-database.service.js.map