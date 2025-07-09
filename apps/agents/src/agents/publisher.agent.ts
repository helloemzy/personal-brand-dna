import { BaseAgent } from '../base/base-agent';
import { AgentType, MessageType, Priority, AgentMessage } from '@brandpillar/shared';
import { Logger } from 'pino';
import { createClient } from '@supabase/supabase-js';
import Bull from 'bull';
import Redis from 'ioredis';

interface PublishRequest {
  contentId: string;
  userId: string;
  content: string;
  platform: 'linkedin' | 'twitter' | 'facebook';
  scheduledFor?: Date;
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    mediaUrls?: string[];
  };
  qualityScore?: number;
}

interface TimingFactors {
  audienceActivity: TimeSlot[];
  historicalPerformance: PerformanceData[];
  competitorActivity: CompetitorData[];
  platformTrends: TrendData[];
  userPreferences: UserPreferences;
}

interface TimeSlot {
  hour: number;
  dayOfWeek: number;
  score: number;
  engagement: number;
}

interface PerformanceData {
  timestamp: Date;
  engagement: number;
  reach: number;
  contentType: string;
}

interface CompetitorData {
  timestamp: Date;
  competitorCount: number;
  avgEngagement: number;
}

interface TrendData {
  hour: number;
  platform: string;
  activityLevel: number;
}

interface UserPreferences {
  preferredTimes?: string[];
  excludeWeekends?: boolean;
  timezone?: string;
  minInterval?: number; // minutes between posts
}

interface PublishResult {
  success: boolean;
  platformPostId?: string;
  publishedAt?: Date;
  error?: string;
  retryable?: boolean;
}

export class PublisherAgent extends BaseAgent {
  private supabase: ReturnType<typeof createClient>;
  private publishQueue: Bull.Queue;
  private redis: Redis;
  private timingOptimizer: TimingOptimizationEngine;
  
  // Platform-specific configurations
  private readonly PLATFORM_LIMITS = {
    linkedin: {
      maxLength: 3000,
      maxHashtags: 30,
      maxMentions: 20,
      rateLimit: { daily: 10, hourly: 3 }
    },
    twitter: {
      maxLength: 280,
      maxHashtags: 5,
      maxMentions: 10,
      rateLimit: { daily: 50, hourly: 10 }
    }
  };

  constructor(logger: Logger) {
    super(AgentType.PUBLISHER, logger);
    
    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Initialize Redis
    this.redis = new Redis(process.env.REDIS_URL);

    // Initialize Bull queue for scheduled publishing
    this.publishQueue = new Bull('publish-queue', process.env.REDIS_URL!, {
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    // Initialize timing optimizer
    this.timingOptimizer = new TimingOptimizationEngine(this.supabase, this.redis);

    // Set up queue processor
    this.setupQueueProcessor();
  }

  protected async processTask(message: AgentMessage): Promise<void> {
    const { taskType, data } = message.payload;

    switch (taskType) {
      case 'PUBLISH_CONTENT':
        await this.handlePublishContent(data);
        break;
      case 'SCHEDULE_CONTENT':
        await this.handleScheduleContent(data);
        break;
      case 'OPTIMIZE_TIMING':
        await this.handleOptimizeTiming(data);
        break;
      case 'CANCEL_SCHEDULED':
        await this.handleCancelScheduled(data);
        break;
      default:
        this.logger.warn(`Unknown task type: ${taskType}`);
    }
  }

  private async handlePublishContent(request: PublishRequest): Promise<void> {
    try {
      const { contentId, userId, content, platform, scheduledFor } = request;

      // Check rate limits
      const canPublish = await this.checkRateLimit(userId, platform);
      if (!canPublish) {
        throw new Error(`Rate limit exceeded for ${platform}`);
      }

      // If scheduled, add to queue
      if (scheduledFor && scheduledFor > new Date()) {
        await this.schedulePost(request);
        return;
      }

      // Optimize timing if not scheduled
      if (!scheduledFor) {
        const optimalTime = await this.findOptimalTime(userId, platform, content);
        if (optimalTime > new Date()) {
          request.scheduledFor = optimalTime;
          await this.schedulePost(request);
          return;
        }
      }

      // Publish immediately
      const result = await this.publishNow(request);

      // Send result back to orchestrator
      await this.sendMessage({
        id: this.generateId(),
        timestamp: Date.now(),
        source: this.agentType,
        target: AgentType.ORCHESTRATOR,
        type: MessageType.TASK_COMPLETE,
        priority: Priority.MEDIUM,
        payload: {
          taskType: 'PUBLISH_COMPLETE',
          data: {
            contentId,
            result
          }
        },
        requiresAck: false
      });

      // Track performance
      if (result.success) {
        await this.trackPublishing(userId, platform, contentId, result.platformPostId!);
      }

    } catch (error) {
      this.logger.error({ error }, 'Publishing failed');
      throw error;
    }
  }

  private async publishNow(request: PublishRequest): Promise<PublishResult> {
    const { platform, content, metadata } = request;

    // Format content for platform
    const formatted = await this.formatForPlatform(content, platform, metadata);

    // Platform-specific publishing
    switch (platform) {
      case 'linkedin':
        return await this.publishToLinkedIn(request.userId, formatted, metadata);
      case 'twitter':
        return await this.publishToTwitter(request.userId, formatted, metadata);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async formatForPlatform(
    content: string,
    platform: string,
    metadata?: any
  ): Promise<string> {
    const limits = this.PLATFORM_LIMITS[platform];
    if (!limits) return content;

    let formatted = content;

    // Truncate if needed
    if (formatted.length > limits.maxLength) {
      formatted = this.truncateContent(formatted, limits.maxLength, metadata?.hashtags);
    }

    // Add hashtags
    if (metadata?.hashtags && metadata.hashtags.length > 0) {
      const hashtags = metadata.hashtags
        .slice(0, limits.maxHashtags)
        .map(h => `#${h.replace(/^#/, '')}`)
        .join(' ');
      
      // Add hashtags if they fit
      if (formatted.length + hashtags.length + 2 <= limits.maxLength) {
        formatted = `${formatted}\n\n${hashtags}`;
      }
    }

    return formatted;
  }

  private truncateContent(content: string, maxLength: number, hashtags?: string[]): string {
    // Reserve space for hashtags and ellipsis
    const hashtagLength = hashtags ? hashtags.slice(0, 5).join(' ').length + 10 : 0;
    const targetLength = maxLength - hashtagLength - 5; // 5 for "... "

    if (content.length <= targetLength) return content;

    // Find last complete sentence within limit
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= targetLength) {
        truncated += sentence;
      } else {
        break;
      }
    }

    // If no complete sentence fits, truncate at word boundary
    if (!truncated) {
      const words = content.split(' ');
      for (const word of words) {
        if ((truncated + word).length <= targetLength) {
          truncated += (truncated ? ' ' : '') + word;
        } else {
          break;
        }
      }
    }

    return truncated + '...';
  }

  private async publishToLinkedIn(
    userId: string,
    content: string,
    metadata?: any
  ): Promise<PublishResult> {
    try {
      // Get user's LinkedIn credentials
      const { data: connection } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'linkedin')
        .single();

      if (!connection || !connection.access_token) {
        return {
          success: false,
          error: 'No LinkedIn connection found',
          retryable: false
        };
      }

      // Use the existing LinkedIn publishing service
      // In production, this would call the actual LinkedIn API
      const response = await this.callLinkedInAPI(
        connection.access_token,
        content,
        metadata
      );

      return {
        success: true,
        platformPostId: response.id,
        publishedAt: new Date()
      };

    } catch (error: any) {
      this.logger.error({ error }, 'LinkedIn publishing failed');
      
      return {
        success: false,
        error: error.message,
        retryable: this.isRetryableError(error)
      };
    }
  }

  private async callLinkedInAPI(
    accessToken: string,
    content: string,
    metadata?: any
  ): Promise<any> {
    // Placeholder for actual LinkedIn API call
    // In production, this would use the LinkedIn Share API
    this.logger.info('Publishing to LinkedIn', { contentLength: content.length });
    
    // Simulate API response
    return {
      id: `li_${Date.now()}`,
      url: `https://linkedin.com/feed/update/urn:li:share:${Date.now()}`
    };
  }

  private async publishToTwitter(
    userId: string,
    content: string,
    metadata?: any
  ): Promise<PublishResult> {
    // Placeholder for Twitter implementation
    throw new Error('Twitter publishing not yet implemented');
  }

  private async schedulePost(request: PublishRequest): Promise<void> {
    const { contentId, scheduledFor } = request;
    
    if (!scheduledFor) return;

    const delay = scheduledFor.getTime() - Date.now();
    
    await this.publishQueue.add('publish', request, {
      delay,
      jobId: contentId
    });

    // Store scheduled job info
    await this.supabase
      .from('scheduled_posts')
      .insert({
        content_id: contentId,
        user_id: request.userId,
        platform: request.platform,
        scheduled_for: scheduledFor,
        status: 'scheduled'
      });

    this.logger.info({ contentId, scheduledFor }, 'Content scheduled for publishing');
  }

  private setupQueueProcessor(): void {
    this.publishQueue.process('publish', async (job) => {
      const request = job.data as PublishRequest;
      
      try {
        const result = await this.publishNow(request);
        
        // Update scheduled post status
        await this.supabase
          .from('scheduled_posts')
          .update({ 
            status: result.success ? 'published' : 'failed',
            published_at: result.publishedAt,
            error: result.error
          })
          .eq('content_id', request.contentId);

        return result;
      } catch (error: any) {
        this.logger.error({ error, jobId: job.id }, 'Queue job failed');
        throw error;
      }
    });
  }

  private async findOptimalTime(
    userId: string,
    platform: string,
    content: string
  ): Promise<Date> {
    const factors = await this.gatherTimingFactors(userId, platform);
    return this.timingOptimizer.calculateOptimalTime(factors, content);
  }

  private async gatherTimingFactors(userId: string, platform: string): Promise<TimingFactors> {
    const [
      audienceActivity,
      historicalPerformance,
      competitorActivity,
      platformTrends,
      userPreferences
    ] = await Promise.all([
      this.getAudienceActivity(userId, platform),
      this.getHistoricalPerformance(userId, platform),
      this.getCompetitorActivity(userId, platform),
      this.getPlatformTrends(platform),
      this.getUserPreferences(userId)
    ]);

    return {
      audienceActivity,
      historicalPerformance,
      competitorActivity,
      platformTrends,
      userPreferences
    };
  }

  private async getAudienceActivity(userId: string, platform: string): Promise<TimeSlot[]> {
    // Analyze when user's audience is most active
    const { data } = await this.supabase
      .from('audience_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .order('score', { ascending: false });

    return data || this.getDefaultTimeSlots();
  }

  private getDefaultTimeSlots(): TimeSlot[] {
    // Default optimal times for business content
    return [
      { hour: 8, dayOfWeek: 2, score: 0.9, engagement: 0.85 },  // Tuesday 8am
      { hour: 12, dayOfWeek: 3, score: 0.85, engagement: 0.8 }, // Wednesday noon
      { hour: 17, dayOfWeek: 4, score: 0.8, engagement: 0.75 }, // Thursday 5pm
      { hour: 10, dayOfWeek: 2, score: 0.75, engagement: 0.7 }, // Tuesday 10am
    ];
  }

  private async getHistoricalPerformance(
    userId: string,
    platform: string
  ): Promise<PerformanceData[]> {
    const { data } = await this.supabase
      .from('post_performance')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .order('timestamp', { ascending: false })
      .limit(100);

    return data || [];
  }

  private async getCompetitorActivity(
    userId: string,
    platform: string
  ): Promise<CompetitorData[]> {
    // In production, this would analyze competitor posting patterns
    return [];
  }

  private async getPlatformTrends(platform: string): Promise<TrendData[]> {
    // Platform-specific activity trends
    const cachedTrends = await this.redis.get(`platform_trends:${platform}`);
    if (cachedTrends) {
      return JSON.parse(cachedTrends);
    }

    // Default trends
    const trends = this.getDefaultPlatformTrends(platform);
    await this.redis.setex(`platform_trends:${platform}`, 3600, JSON.stringify(trends));
    
    return trends;
  }

  private getDefaultPlatformTrends(platform: string): TrendData[] {
    const baseTrends = [];
    
    // Business hours trends (8am-6pm weekdays)
    for (let hour = 8; hour <= 18; hour++) {
      baseTrends.push({
        hour,
        platform,
        activityLevel: hour === 12 ? 0.9 : 0.7 + (Math.random() * 0.2)
      });
    }

    return baseTrends;
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const { data } = await this.supabase
      .from('user_preferences')
      .select('publishing_preferences')
      .eq('user_id', userId)
      .single();

    return data?.publishing_preferences || {
      excludeWeekends: true,
      timezone: 'America/New_York',
      minInterval: 240 // 4 hours default
    };
  }

  private async checkRateLimit(userId: string, platform: string): Promise<boolean> {
    const limits = this.PLATFORM_LIMITS[platform];
    if (!limits) return true;

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const hourlyKey = `rate_limit:${userId}:${platform}:hourly`;
    const hourlyCount = await this.redis.get(hourlyKey);
    if (hourlyCount && parseInt(hourlyCount) >= limits.rateLimit.hourly) {
      return false;
    }

    // Check daily limit
    const dailyKey = `rate_limit:${userId}:${platform}:daily`;
    const dailyCount = await this.redis.get(dailyKey);
    if (dailyCount && parseInt(dailyCount) >= limits.rateLimit.daily) {
      return false;
    }

    return true;
  }

  private async trackPublishing(
    userId: string,
    platform: string,
    contentId: string,
    platformPostId: string
  ): Promise<void> {
    // Update rate limits
    const hourlyKey = `rate_limit:${userId}:${platform}:hourly`;
    const dailyKey = `rate_limit:${userId}:${platform}:daily`;

    await this.redis.multi()
      .incr(hourlyKey)
      .expire(hourlyKey, 3600)
      .incr(dailyKey)
      .expire(dailyKey, 86400)
      .exec();

    // Store publishing record
    await this.supabase
      .from('published_content')
      .insert({
        content_id: contentId,
        user_id: userId,
        platform,
        platform_post_id: platformPostId,
        published_at: new Date()
      });

    // Send to Learning Agent for analysis
    await this.sendMessage({
      id: this.generateId(),
      timestamp: Date.now(),
      source: this.agentType,
      target: AgentType.LEARNING,
      type: MessageType.TASK_REQUEST,
      priority: Priority.LOW,
      payload: {
        taskType: 'TRACK_PUBLISHING',
        data: {
          userId,
          contentId,
          platform,
          platformPostId,
          publishedAt: new Date()
        }
      },
      requiresAck: false
    });
  }

  private async handleScheduleContent(data: any): Promise<void> {
    // Handle bulk scheduling requests
    const { contents, strategy } = data;
    
    for (const content of contents) {
      const optimalTime = await this.findOptimalTime(
        content.userId,
        content.platform,
        content.content
      );
      
      await this.schedulePost({
        ...content,
        scheduledFor: optimalTime
      });
    }
  }

  private async handleOptimizeTiming(data: any): Promise<void> {
    // Re-optimize scheduled posts based on new data
    const { userId, platform } = data;
    
    const { data: scheduledPosts } = await this.supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'scheduled')
      .gt('scheduled_for', new Date());

    for (const post of scheduledPosts || []) {
      const newOptimalTime = await this.findOptimalTime(userId, platform, post.content);
      
      if (Math.abs(newOptimalTime.getTime() - post.scheduled_for.getTime()) > 60 * 60 * 1000) {
        // Reschedule if difference is more than 1 hour
        await this.publishQueue.removeJobs(post.content_id);
        await this.schedulePost({
          ...post,
          scheduledFor: newOptimalTime
        });
      }
    }
  }

  private async handleCancelScheduled(data: any): Promise<void> {
    const { contentId } = data;
    
    // Remove from queue
    await this.publishQueue.removeJobs(contentId);
    
    // Update database
    await this.supabase
      .from('scheduled_posts')
      .update({ status: 'cancelled' })
      .eq('content_id', contentId);
  }

  private isRetryableError(error: any): boolean {
    // Network errors, rate limits, temporary failures
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(error.response?.status) ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT';
  }
}

// Timing Optimization Engine
class TimingOptimizationEngine {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis
  ) {}

  async calculateOptimalTime(factors: TimingFactors, content: string): Promise<Date> {
    const scores: Array<{ time: Date; score: number }> = [];
    const now = new Date();
    
    // Generate candidate times for next 7 days
    for (let day = 0; day < 7; day++) {
      for (let hour = 8; hour <= 18; hour++) {
        const candidateTime = new Date(now);
        candidateTime.setDate(candidateTime.getDate() + day);
        candidateTime.setHours(hour, 0, 0, 0);
        
        if (candidateTime <= now) continue;
        
        // Skip weekends if configured
        if (factors.userPreferences.excludeWeekends) {
          const dayOfWeek = candidateTime.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        }
        
        const score = this.scoreTimeSlot(candidateTime, factors);
        scores.push({ time: candidateTime, score });
      }
    }
    
    // Sort by score and return best time
    scores.sort((a, b) => b.score - a.score);
    
    // Ensure minimum interval between posts
    const filtered = await this.filterByMinInterval(
      scores,
      factors.userPreferences.minInterval || 240
    );
    
    return filtered[0]?.time || this.getDefaultTime();
  }

  private scoreTimeSlot(time: Date, factors: TimingFactors): number {
    let score = 0;
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    
    // Audience activity score (40% weight)
    const audienceScore = factors.audienceActivity
      .find(slot => slot.hour === hour && slot.dayOfWeek === dayOfWeek)?.score || 0.5;
    score += audienceScore * 0.4;
    
    // Historical performance score (30% weight)
    const historicalScore = this.calculateHistoricalScore(time, factors.historicalPerformance);
    score += historicalScore * 0.3;
    
    // Platform trends score (20% weight)
    const trendScore = factors.platformTrends
      .find(trend => trend.hour === hour)?.activityLevel || 0.5;
    score += trendScore * 0.2;
    
    // Competitor avoidance score (10% weight)
    const competitorScore = this.calculateCompetitorScore(time, factors.competitorActivity);
    score += competitorScore * 0.1;
    
    return score;
  }

  private calculateHistoricalScore(time: Date, historicalData: PerformanceData[]): number {
    if (historicalData.length === 0) return 0.5;
    
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    
    const relevantPosts = historicalData.filter(post => {
      const postTime = new Date(post.timestamp);
      return postTime.getHours() === hour && postTime.getDay() === dayOfWeek;
    });
    
    if (relevantPosts.length === 0) return 0.5;
    
    const avgEngagement = relevantPosts.reduce((sum, post) => sum + post.engagement, 0) / relevantPosts.length;
    return Math.min(avgEngagement, 1);
  }

  private calculateCompetitorScore(time: Date, competitorData: CompetitorData[]): number {
    // Lower competitor activity = higher score
    const relevantData = competitorData.filter(data => {
      const dataTime = new Date(data.timestamp);
      return Math.abs(dataTime.getHours() - time.getHours()) <= 1;
    });
    
    if (relevantData.length === 0) return 0.8;
    
    const avgCompetitors = relevantData.reduce((sum, data) => sum + data.competitorCount, 0) / relevantData.length;
    return Math.max(0, 1 - (avgCompetitors / 100)); // Normalize assuming 100 competitors is maximum
  }

  private async filterByMinInterval(
    scores: Array<{ time: Date; score: number }>,
    minInterval: number
  ): Promise<Array<{ time: Date; score: number }>> {
    // Get existing scheduled posts
    const { data: scheduled } = await this.supabase
      .from('scheduled_posts')
      .select('scheduled_for')
      .eq('status', 'scheduled')
      .order('scheduled_for');
    
    const scheduledTimes = (scheduled || []).map(s => new Date(s.scheduled_for));
    
    return scores.filter(({ time }) => {
      for (const scheduledTime of scheduledTimes) {
        const diff = Math.abs(time.getTime() - scheduledTime.getTime());
        if (diff < minInterval * 60 * 1000) {
          return false;
        }
      }
      return true;
    });
  }

  private getDefaultTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  }
}