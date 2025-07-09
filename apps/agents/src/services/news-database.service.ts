import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { NewsOpportunity, FeedSource } from '@brandpillar/shared';
import crypto from 'crypto';

interface NewsArticle {
  id: string;
  feed_id: string;
  guid: string;
  url: string;
  title: string;
  summary?: string;
  content?: string;
  author?: string;
  published_at: Date;
  categories?: string[];
  keywords?: string[];
  image_url?: string;
  metadata?: any;
  content_hash: string;
}

interface UserVoiceProfile {
  user_id: string;
  archetype?: string;
  industry?: string;
  expertise_keywords?: string[];
  preferred_topics?: string[];
  writing_style?: any;
  content_pillars?: any;
  audience_demographics?: any;
}

interface CompetitiveCoverage {
  article_id: string;
  competitor_name: string;
  competitor_url?: string;
  coverage_type: 'identical' | 'similar' | 'related';
  coverage_angle?: string;
  published_at?: Date;
  engagement_metrics?: any;
}

export class NewsDatabaseService {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger = createLogger('NewsDatabaseService');
  }

  // Feed Management
  async getAllActiveFeeds(): Promise<FeedSource[]> {
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

  async getUserFeeds(userId: string): Promise<FeedSource[]> {
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

  async updateFeedStatus(feedId: string, status: Partial<FeedSource>): Promise<void> {
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
  async saveArticles(articles: Partial<NewsArticle>[]): Promise<NewsArticle[]> {
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

  async getArticleById(articleId: string): Promise<NewsArticle | null> {
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

  async checkDuplicateArticles(contentHashes: string[]): Promise<Set<string>> {
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
  async saveOpportunity(opportunity: Partial<NewsOpportunity>): Promise<NewsOpportunity> {
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

  async getUserOpportunities(
    userId: string,
    limit: number = 20,
    status?: string
  ): Promise<NewsOpportunity[]> {
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

  async updateOpportunityStatus(
    opportunityId: string,
    status: string,
    metadata?: any
  ): Promise<void> {
    const updates: any = { status };
    
    if (status === 'viewed') {
      updates.viewed_at = new Date().toISOString();
    } else if (status === 'used' || status === 'dismissed') {
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
  async getUserVoiceProfile(userId: string): Promise<UserVoiceProfile | null> {
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

  async updateUserVoiceProfile(
    userId: string,
    profile: Partial<UserVoiceProfile>
  ): Promise<void> {
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
  async saveCompetitiveCoverage(coverage: Partial<CompetitiveCoverage>): Promise<void> {
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

  async getCompetitiveCoverage(articleId: string): Promise<CompetitiveCoverage[]> {
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
  async updateFeedAnalytics(feedId: string, metrics: any): Promise<void> {
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

  async refreshOpportunitySummary(): Promise<void> {
    // Refresh materialized view
    const { error } = await this.supabase.rpc('refresh_user_opportunity_summary');

    if (error) {
      this.logger.error('Error refreshing opportunity summary:', error);
    }
  }

  // Virality Tracking
  async saveViralityPattern(pattern: any): Promise<void> {
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

  async getViralityPatterns(limit: number = 100): Promise<any[]> {
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
  private generateContentHash(title: string, url: string): string {
    const content = `${title.toLowerCase().trim()}${url.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Bulk Operations
  async bulkUpdateOpportunityScores(
    opportunities: Array<{ id: string; scores: any }>
  ): Promise<void> {
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
  async searchArticles(query: string, limit: number = 20): Promise<NewsArticle[]> {
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
  async cleanupExpiredOpportunities(): Promise<number> {
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